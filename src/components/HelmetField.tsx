import { useEffect, useRef } from 'react'
import { MANAGER_COLOR } from '../lib/identity'

/**
 * Ten helmets in franchise colours drifting behind the page, spinning in real
 * 3D and ricocheting off each other.
 *
 * The earlier version scaled a flat sprite by cos(angle), which read as a
 * card being squished. This one software-renders an actual low-poly helmet:
 * a lat-long sphere shell with a face opening cut out, flat-shaded per quad
 * with a fixed light, a two-bar facemask with real parallax, painter-sorted
 * and drawn back to front. No 3D library — rotation matrices and a canvas.
 */

const NB = 6 // latitude bands
const NL = 14 // longitude segments

interface Vec3 {
  x: number
  y: number
  z: number
}

interface Quad {
  corners: [Vec3, Vec3, Vec3, Vec3]
  normal: Vec3 // unit, points outward (mid-vertex direction on a sphere)
}

function vertex(theta: number, phi: number): Vec3 {
  // y grows downward to match canvas space; phi = 0 faces the viewer
  return {
    x: Math.sin(theta) * Math.sin(phi),
    y: -Math.cos(theta),
    z: Math.sin(theta) * Math.cos(phi),
  }
}

function buildShell(): Quad[] {
  const quads: Quad[] = []
  const thetaTop = 0.3
  const thetaBottom = 2.05
  for (let i = 0; i < NB; i++) {
    const t0 = thetaTop + ((thetaBottom - thetaTop) * i) / NB
    const t1 = thetaTop + ((thetaBottom - thetaTop) * (i + 1)) / NB
    for (let j = 0; j < NL; j++) {
      const p0 = (j / NL) * Math.PI * 2
      const p1 = ((j + 1) / NL) * Math.PI * 2
      const midT = (t0 + t1) / 2
      let midP = (p0 + p1) / 2
      if (midP > Math.PI) midP -= Math.PI * 2
      // face opening: the lower-front region is cut away
      if (midT > 1.02 && Math.abs(midP) < 0.95) continue
      quads.push({
        corners: [vertex(t0, p0), vertex(t0, p1), vertex(t1, p1), vertex(t1, p0)],
        normal: vertex(midT, midP),
      })
    }
  }
  return quads
}

/** Facemask polylines in model space, sitting just off the shell. */
function buildMask(): Vec3[][] {
  const lines: Vec3[][] = []
  const radius = 1.1
  const scaleVec = (v: Vec3) => ({ x: v.x * radius, y: v.y * radius, z: v.z * radius })
  for (const theta of [1.28, 1.62]) {
    const bar: Vec3[] = []
    for (let k = -4; k <= 4; k++) bar.push(scaleVec(vertex(theta, (k / 4) * 0.85)))
    lines.push(bar)
  }
  for (const phi of [-0.5, 0.5]) {
    lines.push([scaleVec(vertex(1.28, phi)), scaleVec(vertex(1.62, phi))])
  }
  return lines
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

const SHELL = buildShell()
const MASK = buildMask()
const LIGHT: Vec3 = normalize({ x: -0.35, y: -0.75, z: 0.55 })

function mix(hex: string, target: number, amount: number): [number, number, number] {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const base = (value >> shift) & 0xff
    return Math.round(base + (target - base) * amount)
  }
  return [channel(16), channel(8), channel(0)]
}

const SHADE_STEPS = 8

/** Pre-mixed fill strings from deep shade to highlight, per franchise colour. */
function shadeRamp(color: string): string[] {
  const dark = mix(color, 0, 0.3)
  const light = mix(color, 255, 0.45)
  const ramp: string[] = []
  for (let i = 0; i < SHADE_STEPS; i++) {
    const t = i / (SHADE_STEPS - 1)
    const r = Math.round(dark[0] + (light[0] - dark[0]) * t)
    const g = Math.round(dark[1] + (light[1] - dark[1]) * t)
    const b = Math.round(dark[2] + (light[2] - dark[2]) * t)
    ramp.push(`rgb(${r},${g},${b})`)
  }
  return ramp
}

interface Helmet {
  x: number
  y: number
  z: number // 0.7 (near) .. 2.2 (far); scale is 1/z
  vx: number
  vy: number
  vz: number
  spin: number
  spinRate: number
  tilt: number
  ramp: string[]
}

const Z_NEAR = 0.7
const Z_FAR = 2.2
const BASE_R = 26

export default function HelmetField({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let width = 0
    let height = 0
    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Each helmet is rendered opaque here first, then blitted to the page at
    // whisper alpha. Drawing translucent quads directly compounds alpha where
    // neighbours overlap and the seams glow as a wireframe lattice.
    const SCRATCH = 176
    const scratch = document.createElement('canvas')
    scratch.width = SCRATCH
    scratch.height = SCRATCH
    const sctx = scratch.getContext('2d')!

    // Ten is atmosphere; twelve was traffic.
    const colors = Object.values(MANAGER_COLOR).slice(0, 10)
    const helmets: Helmet[] = colors.map((color, index) => ({
      // Deterministic spread — no Math.random, so every load looks composed.
      x: (((index * 61.8) % 100) / 100) * width,
      y: (((index * 38.2 + 15) % 100) / 100) * height,
      z: Z_NEAR + (((index * 17) % 12) / 12) * (Z_FAR - Z_NEAR),
      vx: (index % 2 ? 1 : -1) * (8 + (index % 5) * 3),
      vy: (index % 3 ? 1 : -1) * (6 + (index % 4) * 3),
      vz: (index % 2 ? 1 : -1) * 0.05,
      spin: index * 0.7,
      spinRate: (index % 2 ? 1 : -1) * (0.3 + (index % 4) * 0.12),
      tilt: 0.12 + (index % 3) * 0.08,
      ramp: shadeRamp(color),
    }))

    let last = performance.now()
    let frame = 0

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      for (const h of helmets) {
        h.x += h.vx * dt
        h.y += h.vy * dt
        h.z += h.vz * dt
        h.spin += h.spinRate * dt
        const r = BASE_R / h.z
        if ((h.x < r && h.vx < 0) || (h.x > width - r && h.vx > 0)) h.vx *= -1
        if ((h.y < r && h.vy < 0) || (h.y > height - r && h.vy > 0)) h.vy *= -1
        if ((h.z < Z_NEAR && h.vz < 0) || (h.z > Z_FAR && h.vz > 0)) h.vz *= -1
      }

      // Elastic ricochets: equal mass, exchange the normal velocity component.
      for (let i = 0; i < helmets.length; i++) {
        for (let j = i + 1; j < helmets.length; j++) {
          const a = helmets[i]
          const b = helmets[j]
          if (Math.abs(a.z - b.z) > 0.35) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy)
          const minDist = BASE_R / a.z + BASE_R / b.z
          if (dist === 0 || dist >= minDist) continue
          const nx = dx / dist
          const ny = dy / dist
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
          if (rel <= 0) continue
          a.vx -= rel * nx
          a.vy -= rel * ny
          b.vx += rel * nx
          b.vy += rel * ny
          a.spinRate *= -1
          b.spinRate *= -1
          const overlap = (minDist - dist) / 2
          a.x -= nx * overlap
          a.y -= ny * overlap
          b.x += nx * overlap
          b.y += ny * overlap
        }
      }

      ctx.clearRect(0, 0, width, height)
      const ordered = [...helmets].sort((p, q) => q.z - p.z)

      for (const h of ordered) {
        const scale = 1 / h.z
        const radius = BASE_R * scale * 1.3
        const sinS = Math.sin(h.spin)
        const cosS = Math.cos(h.spin)
        const sinT = Math.sin(h.tilt)
        const cosT = Math.cos(h.tilt)

        // spin about Y, then a fixed forward tilt about X
        const rotate = (v: Vec3): Vec3 => {
          const x = v.x * cosS + v.z * sinS
          const z0 = -v.x * sinS + v.z * cosS
          const y = v.y * cosT - z0 * sinT
          const z = v.y * sinT + z0 * cosT
          return { x, y, z }
        }

        sctx.clearRect(0, 0, SCRATCH, SCRATCH)
        const mid = SCRATCH / 2

        // shell, far quads first
        const visible: { depth: number; path: Vec3[]; fill: string }[] = []
        for (const quad of SHELL) {
          const n = rotate(quad.normal)
          if (n.z < -0.05) continue // backface
          const lit = Math.max(0, -n.x * LIGHT.x + -n.y * LIGHT.y + n.z * LIGHT.z)
          const bucket = Math.min(SHADE_STEPS - 1, Math.round(lit * (SHADE_STEPS - 1)))
          visible.push({
            depth: n.z,
            path: quad.corners.map(rotate),
            fill: h.ramp[bucket],
          })
        }
        visible.sort((a, b) => a.depth - b.depth)
        for (const { path, fill } of visible) {
          // Slight inflation seals hairline gaps; overlaps are invisible now
          // that the surface is drawn opaque.
          let cx = 0
          let cy = 0
          for (const v of path) {
            cx += v.x
            cy += v.y
          }
          cx /= path.length
          cy /= path.length
          sctx.fillStyle = fill
          sctx.beginPath()
          path.forEach((v, k) => {
            const px = mid + (cx + (v.x - cx) * 1.05) * radius
            const py = mid + (cy + (v.y - cy) * 1.05) * radius
            if (k === 0) sctx.moveTo(px, py)
            else sctx.lineTo(px, py)
          })
          sctx.closePath()
          sctx.fill()
        }

        // facemask: drawn only while the face points anywhere near the viewer
        const facing = rotate({ x: 0, y: 0, z: 1 }).z
        if (facing > -0.2) {
          sctx.strokeStyle = 'rgb(174,182,194)'
          sctx.lineWidth = Math.max(1.2, 2.6 * scale)
          sctx.lineCap = 'round'
          for (const line of MASK) {
            sctx.beginPath()
            line.forEach((v, k) => {
              const r = rotate(v)
              if (k === 0) sctx.moveTo(mid + r.x * radius, mid + r.y * radius)
              else sctx.lineTo(mid + r.x * radius, mid + r.y * radius)
            })
            sctx.stroke()
          }
        }

        // Whisper level: present in the gutters, never fighting the text.
        ctx.globalAlpha = 0.14 + 0.12 * scale
        ctx.drawImage(scratch, h.x - mid, h.y - mid)
      }
      ctx.globalAlpha = 1

      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
    />
  )
}
