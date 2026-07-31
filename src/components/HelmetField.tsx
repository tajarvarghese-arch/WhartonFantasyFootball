import { useEffect, useRef } from 'react'
import { MANAGER_COLOR } from '../lib/identity'

/**
 * The background field: helmets in franchise colours and spiraling footballs
 * drifting in pseudo-3D, ricocheting off each other elastically.
 *
 * Everything is software-rendered on one canvas — no 3D library. Helmets are
 * a lat-long shell with a cut face, recessed cavity, and a jutting cage.
 * Footballs are a pointed surface of revolution flying NOSE-FIRST along their
 * velocity (that is what a spiral is), spinning fast about their long axis so
 * the laces and tip stripes visibly rotate, and turning smoothly after a
 * ricochet rather than snapping.
 */

interface Vec3 {
  x: number
  y: number
  z: number
}

interface Quad {
  corners: [Vec3, Vec3, Vec3, Vec3]
  normal: Vec3
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}

function scaleVec3(v: Vec3, r: number): Vec3 {
  return { x: v.x * r, y: v.y * r, z: v.z * r }
}

/* ================================================================== *
 * Helmet geometry
 * ================================================================== */

const NB = 6
const NL = 14

function vertex(theta: number, phi: number): Vec3 {
  return {
    x: Math.sin(theta) * Math.sin(phi),
    y: -Math.cos(theta),
    z: Math.sin(theta) * Math.cos(phi),
  }
}

/** A helmet is not a sphere: narrower, taller, elongated front-to-back. */
const SHAPE = { x: 0.9, y: 1.04, z: 1.16 }

function shaped(v: Vec3): Vec3 {
  return { x: v.x * SHAPE.x, y: v.y * SHAPE.y, z: v.z * SHAPE.z }
}

function shapedNormal(n: Vec3): Vec3 {
  return normalize({ x: n.x / SHAPE.x, y: n.y / SHAPE.y, z: n.z / SHAPE.z })
}

function buildShellAndCavity(): { shell: Quad[]; cavity: Quad[] } {
  const shell: Quad[] = []
  const cavity: Quad[] = []
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
      const corners: [Vec3, Vec3, Vec3, Vec3] = [
        shaped(vertex(t0, p0)),
        shaped(vertex(t0, p1)),
        shaped(vertex(t1, p1)),
        shaped(vertex(t1, p0)),
      ]
      const normal = shapedNormal(vertex(midT, midP))
      if (midT > 1.02 && Math.abs(midP) < 0.95) {
        cavity.push({
          corners: corners.map((v) => scaleVec3(v, 0.72)) as [Vec3, Vec3, Vec3, Vec3],
          normal,
        })
        continue
      }
      shell.push({ corners, normal })
    }
  }
  return { shell, cavity }
}

/** Facemask cage, standing well proud of the shell dead ahead. */
function buildMask(): Vec3[][] {
  const lines: Vec3[][] = []
  const jut = (phi: number) => 1.04 + 0.42 * Math.pow(Math.cos(phi * 1.1), 2)
  for (const theta of [1.3, 1.62]) {
    const bar: Vec3[] = []
    for (let k = -5; k <= 5; k++) {
      const phi = (k / 5) * 0.95
      bar.push(shaped(scaleVec3(vertex(theta, phi), jut(phi))))
    }
    lines.push(bar)
  }
  for (const phi of [-0.45, 0, 0.45]) {
    lines.push([
      shaped(scaleVec3(vertex(1.3, phi), jut(phi))),
      shaped(scaleVec3(vertex(1.62, phi), jut(phi))),
    ])
  }
  return lines
}

/* ================================================================== *
 * Football geometry — a pointed surface of revolution about model z
 * ================================================================== */

const FB_BANDS = 8
const FB_SEGS = 10

/** Radius profile along the long axis: rounder than an ellipse mid-ball,
 *  pointier at the tips — the American football lemon. */
function fbProfile(t: number): number {
  return 0.56 * Math.pow(Math.max(1 - Math.pow(Math.abs(t), 1.9), 0.0005), 0.62)
}

function fbVertex(t: number, phi: number): Vec3 {
  const r = fbProfile(t)
  return { x: r * Math.cos(phi), y: r * Math.sin(phi), z: t }
}

function fbNormal(t: number, phi: number): Vec3 {
  // surface of revolution: slope of the profile tips the normal along the axis
  const dr = (fbProfile(t + 0.01) - fbProfile(t - 0.01)) / 0.02
  return normalize({ x: Math.cos(phi), y: Math.sin(phi), z: -dr })
}

interface FbQuad extends Quad {
  kind: 'leather' | 'stripe' | 'lace'
}

function buildFootball(): FbQuad[] {
  const quads: FbQuad[] = []
  for (let i = 0; i < FB_BANDS; i++) {
    const t0 = -1 + (2 * i) / FB_BANDS
    const t1 = -1 + (2 * (i + 1)) / FB_BANDS
    const tMid = (t0 + t1) / 2
    for (let j = 0; j < FB_SEGS; j++) {
      const p0 = (j / FB_SEGS) * Math.PI * 2
      const p1 = ((j + 1) / FB_SEGS) * Math.PI * 2
      const pMid = (p0 + p1) / 2
      quads.push({
        corners: [fbVertex(t0, p0), fbVertex(t0, p1), fbVertex(t1, p1), fbVertex(t1, p0)],
        normal: fbNormal(tMid, pMid),
        // white rings near each tip, like a college ball
        kind: Math.abs(tMid) > 0.5 && Math.abs(tMid) < 0.78 ? 'stripe' : 'leather',
      })
    }
  }
  // laces: a raised white strip along one longitude, mid-ball
  const lacePhi = -Math.PI / 2
  const halfWidth = 0.16
  for (let k = 0; k < 5; k++) {
    const t0 = -0.3 + k * 0.13
    const t1 = t0 + 0.11
    const lift = 1.04
    quads.push({
      corners: [
        scaleVec3(fbVertex(t0, lacePhi - halfWidth), lift),
        scaleVec3(fbVertex(t0, lacePhi + halfWidth), lift),
        scaleVec3(fbVertex(t1, lacePhi + halfWidth), lift),
        scaleVec3(fbVertex(t1, lacePhi - halfWidth), lift),
      ],
      normal: fbNormal((t0 + t1) / 2, lacePhi),
      kind: 'lace',
    })
  }
  return quads
}

const { shell: SHELL, cavity: CAVITY } = buildShellAndCavity()
const MASK = buildMask()
const FOOTBALL = buildFootball()
const LIGHT: Vec3 = normalize({ x: -0.35, y: -0.75, z: 0.55 })

/* ================================================================== *
 * Shading
 * ================================================================== */

function mix(hex: string, target: number, amount: number): [number, number, number] {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const base = (value >> shift) & 0xff
    return Math.round(base + (target - base) * amount)
  }
  return [channel(16), channel(8), channel(0)]
}

const SHADE_STEPS = 8

function shadeRamp(color: string, darkAmt = 0.3, lightAmt = 0.45): string[] {
  const dark = mix(color, 0, darkAmt)
  const light = mix(color, 255, lightAmt)
  const ramp: string[] = []
  for (let i = 0; i < SHADE_STEPS; i++) {
    const t = i / (SHADE_STEPS - 1)
    ramp.push(
      `rgb(${Math.round(dark[0] + (light[0] - dark[0]) * t)},${Math.round(
        dark[1] + (light[1] - dark[1]) * t,
      )},${Math.round(dark[2] + (light[2] - dark[2]) * t)})`,
    )
  }
  return ramp
}

const LEATHER_RAMP = shadeRamp('#a9714b', 0.45, 0.28)
const STRIPE_RAMP = shadeRamp('#e8e2d2', 0.35, 0.12)
const LACE_FILL = 'rgb(244,239,226)'

/* ================================================================== *
 * The field
 * ================================================================== */

interface Item {
  kind: 'helmet' | 'football'
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  spin: number
  spinRate: number
  tilt: number
  /** smoothed flight direction — footballs fly nose-first along this */
  heading: Vec3
  rFactor: number
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

    // Items render opaque here, then blit at whisper alpha — translucent quads
    // would compound where they overlap and glow as a lattice.
    const SCRATCH = 176
    const scratch = document.createElement('canvas')
    scratch.width = SCRATCH
    scratch.height = SCRATCH
    const sctx = scratch.getContext('2d')!

    // Eight helmets + five footballs; deterministic spread, no Math.random.
    const colors = Object.values(MANAGER_COLOR).slice(0, 8)
    const items: Item[] = colors.map((color, index) => ({
      kind: 'helmet' as const,
      x: (((index * 61.8) % 100) / 100) * width,
      y: (((index * 38.2 + 15) % 100) / 100) * height,
      z: Z_NEAR + (((index * 17) % 12) / 12) * (Z_FAR - Z_NEAR),
      vx: (index % 2 ? 1 : -1) * (8 + (index % 5) * 3),
      vy: (index % 3 ? 1 : -1) * (6 + (index % 4) * 3),
      vz: (index % 2 ? 1 : -1) * 0.05,
      spin: index * 0.7,
      spinRate: (index % 2 ? 1 : -1) * (0.3 + (index % 4) * 0.12),
      tilt: 0.12 + (index % 3) * 0.08,
      heading: { x: 1, y: 0, z: 0 },
      rFactor: 1,
      ramp: shadeRamp(color),
    }))
    for (let k = 0; k < 5; k++) {
      const vx = (k % 2 ? 1 : -1) * (16 + (k % 3) * 6)
      const vy = (k % 3 ? -1 : 1) * (7 + (k % 4) * 4)
      items.push({
        kind: 'football',
        x: (((k * 47.3 + 28) % 100) / 100) * width,
        y: (((k * 71.1 + 40) % 100) / 100) * height,
        z: Z_NEAR + (((k * 29 + 6) % 12) / 12) * (Z_FAR - Z_NEAR),
        vx,
        vy,
        vz: (k % 2 ? -1 : 1) * 0.04,
        spin: k * 1.3,
        // the spiral: fast rotation about the long axis
        spinRate: (k % 2 ? 1 : -1) * (4.2 + (k % 3) * 1.4),
        tilt: 0,
        heading: normalize({ x: vx, y: vy, z: 0 }),
        rFactor: 0.8,
        ramp: LEATHER_RAMP,
      })
    }

    let last = performance.now()
    let frame = 0

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      for (const it of items) {
        it.x += it.vx * dt
        it.y += it.vy * dt
        it.z += it.vz * dt
        it.spin += it.spinRate * dt
        const r = (BASE_R * it.rFactor) / it.z
        if ((it.x < r && it.vx < 0) || (it.x > width - r && it.vx > 0)) it.vx *= -1
        if ((it.y < r && it.vy < 0) || (it.y > height - r && it.vy > 0)) it.vy *= -1
        if ((it.z < Z_NEAR && it.vz < 0) || (it.z > Z_FAR && it.vz > 0)) it.vz *= -1

        // Footballs bank toward their velocity rather than snapping after a
        // bounce — a quarterback's spiral, not a compass needle.
        if (it.kind === 'football') {
          const target = normalize({ x: it.vx, y: it.vy, z: it.vz * 60 })
          const ease = Math.min(1, 3.5 * dt)
          it.heading = normalize({
            x: it.heading.x + (target.x - it.heading.x) * ease,
            y: it.heading.y + (target.y - it.heading.y) * ease,
            z: it.heading.z + (target.z - it.heading.z) * ease,
          })
        }
      }

      // Elastic ricochets, equal mass.
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i]
          const b = items[j]
          if (Math.abs(a.z - b.z) > 0.35) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy)
          const minDist = (BASE_R * a.rFactor) / a.z + (BASE_R * b.rFactor) / b.z
          if (dist === 0 || dist >= minDist) continue
          const nx = dx / dist
          const ny = dy / dist
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
          if (rel <= 0) continue
          a.vx -= rel * nx
          a.vy -= rel * ny
          b.vx += rel * nx
          b.vy += rel * ny
          if (a.kind === 'helmet') a.spinRate *= -1
          if (b.kind === 'helmet') b.spinRate *= -1
          const overlap = (minDist - dist) / 2
          a.x -= nx * overlap
          a.y -= ny * overlap
          b.x += nx * overlap
          b.y += ny * overlap
        }
      }

      ctx.clearRect(0, 0, width, height)
      const ordered = [...items].sort((p, q) => q.z - p.z)
      const mid = SCRATCH / 2

      for (const it of ordered) {
        const scale = 1 / it.z
        const radius = BASE_R * scale * 1.3
        sctx.clearRect(0, 0, SCRATCH, SCRATCH)

        if (it.kind === 'helmet') {
          drawHelmet(sctx, it, radius, mid, scale)
        } else {
          drawFootball(sctx, it, radius, mid)
        }

        ctx.globalAlpha = 0.14 + 0.12 * scale
        ctx.drawImage(scratch, it.x - mid, it.y - mid)
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

/* ================================================================== *
 * Renderers (opaque, into the scratch canvas)
 * ================================================================== */

function drawHelmet(
  sctx: CanvasRenderingContext2D,
  it: Item,
  radius: number,
  mid: number,
  scale: number,
) {
  const sinS = Math.sin(it.spin)
  const cosS = Math.cos(it.spin)
  const sinT = Math.sin(it.tilt)
  const cosT = Math.cos(it.tilt)
  const rotate = (v: Vec3): Vec3 => {
    const x = v.x * cosS + v.z * sinS
    const z0 = -v.x * sinS + v.z * cosS
    const y = v.y * cosT - z0 * sinT
    const z = v.y * sinT + z0 * cosT
    return { x, y, z }
  }

  sctx.fillStyle = 'rgb(9,7,16)'
  for (const quad of CAVITY) {
    const n = rotate(quad.normal)
    if (n.z < 0.05) continue
    sctx.beginPath()
    quad.corners.forEach((v, k) => {
      const r = rotate(v)
      if (k === 0) sctx.moveTo(mid + r.x * radius, mid + r.y * radius)
      else sctx.lineTo(mid + r.x * radius, mid + r.y * radius)
    })
    sctx.closePath()
    sctx.fill()
  }

  const visible: { depth: number; path: Vec3[]; fill: string }[] = []
  for (const quad of SHELL) {
    const n = rotate(quad.normal)
    if (n.z < -0.05) continue
    const lit = Math.max(0, -n.x * LIGHT.x + -n.y * LIGHT.y + n.z * LIGHT.z)
    const bucket = Math.min(SHADE_STEPS - 1, Math.round(lit * (SHADE_STEPS - 1)))
    visible.push({ depth: n.z, path: quad.corners.map(rotate), fill: it.ramp[bucket] })
  }
  paintQuads(sctx, visible, radius, mid)

  const facing = rotate({ x: 0, y: 0, z: 1 }).z
  if (facing > -0.2) {
    sctx.strokeStyle = 'rgb(198,205,216)'
    sctx.lineWidth = Math.max(1.6, 3.4 * scale)
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
}

function drawFootball(sctx: CanvasRenderingContext2D, it: Item, radius: number, mid: number) {
  // Basis with model z aligned to the flight direction: nose-first.
  const w = it.heading
  const upRef: Vec3 = Math.abs(w.z) > 0.94 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 }
  const u = normalize(cross(upRef, w))
  const t2 = cross(w, u)
  const sinS = Math.sin(it.spin)
  const cosS = Math.cos(it.spin)

  const rotate = (v: Vec3): Vec3 => {
    // the spiral: spin about the long (model z) axis first
    const x = v.x * cosS - v.y * sinS
    const y = v.x * sinS + v.y * cosS
    const z = v.z
    return {
      x: x * u.x + y * t2.x + z * w.x,
      y: x * u.y + y * t2.y + z * w.y,
      z: x * u.z + y * t2.z + z * w.z,
    }
  }

  // Slightly longer than the helmet radius so the ball reads as a ball.
  const r = radius * 1.15
  const visible: { depth: number; path: Vec3[]; fill: string }[] = []
  for (const quad of FOOTBALL) {
    const n = rotate(quad.normal)
    if (quad.kind !== 'lace' && n.z < -0.05) continue
    const lit = Math.max(0, -n.x * LIGHT.x + -n.y * LIGHT.y + n.z * LIGHT.z)
    const bucket = Math.min(SHADE_STEPS - 1, Math.round(lit * (SHADE_STEPS - 1)))
    const path = quad.corners.map(rotate)
    if (quad.kind === 'lace') {
      // laces live above the surface; hide them when they spin behind
      const depth = path.reduce((total, v) => total + v.z, 0) / path.length
      if (depth < 0) continue
      visible.push({ depth: depth + 0.03, path, fill: LACE_FILL })
    } else {
      const depth = path.reduce((total, v) => total + v.z, 0) / path.length
      visible.push({
        depth,
        path,
        fill: quad.kind === 'stripe' ? STRIPE_RAMP[bucket] : it.ramp[bucket],
      })
    }
  }
  paintQuads(sctx, visible, r, mid)
}

function paintQuads(
  sctx: CanvasRenderingContext2D,
  visible: { depth: number; path: Vec3[]; fill: string }[],
  radius: number,
  mid: number,
) {
  visible.sort((a, b) => a.depth - b.depth)
  for (const { path, fill } of visible) {
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
}
