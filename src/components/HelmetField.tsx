import { useEffect, useRef } from 'react'
import { MANAGER_COLOR } from '../lib/identity'

/**
 * Twelve helmets — one per franchise colour — drifting in 3D space behind the
 * page, spinning on their Y axis and ricocheting off each other elastically.
 *
 * No 3D library: positions live in (x, y, z), scale is 1/z perspective, and
 * the Y-spin is faked by scaling the sprite's width through cos(angle) and
 * mirroring on the back half — the classic sprite trick, which suits the
 * cabinet better than a real mesh would. Real NFL helmets are trademarked;
 * these are the league's own.
 */

// 14x12 pixel map: S shell, H highlight, D shade, F facemask, E earhole
const HELMET_MAP = [
  '....SSSSSS....',
  '..SSHHHHSSS...',
  '.SSHHSSSSSSS..',
  '.SSSSSSSSSSSS.',
  'SSSSSSSSSSSSS.',
  'SSSSSSSSSSSSF.',
  'SSESSSSSSSSFF.',
  'SSEESSSSSSSF..',
  'SSSSSSSSSSSFF.',
  '.SSSSSSSSSSF..',
  '..DDDDDDDDF...',
  '......FFFF....',
]
const CELL = 3
const SPRITE_W = HELMET_MAP[0].length * CELL
const SPRITE_H = HELMET_MAP.length * CELL

function mix(hex: string, target: number, amount: number): string {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const base = (value >> shift) & 0xff
    return Math.round(base + (target - base) * amount)
  }
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`
}

function paintSprite(color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_W
  canvas.height = SPRITE_H
  const ctx = canvas.getContext('2d')!
  const fills: Record<string, string> = {
    S: color,
    H: mix(color, 255, 0.4),
    D: mix(color, 0, 0.4),
    F: '#c9d4ce',
    E: '#0d0a17',
  }
  HELMET_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = row[x]
      if (key === '.') continue
      ctx.fillStyle = fills[key]
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
    }
  })
  return canvas
}

interface Helmet {
  x: number
  y: number
  z: number // 0.6 (near) .. 2.2 (far); scale is 1/z
  vx: number
  vy: number
  vz: number
  spin: number
  spinRate: number
  sprite: HTMLCanvasElement
}

const Z_NEAR = 0.7
const Z_FAR = 2.2
const BASE_R = 25

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

    // Ten is atmosphere; twelve was traffic.
    const colors = Object.values(MANAGER_COLOR).slice(0, 10)
    const helmets: Helmet[] = colors.map((color, index) => ({
      // Deterministic spread — no Math.random, so every boot looks composed.
      x: ((index * 61.8) % 100) / 100 * width,
      y: ((index * 38.2 + 15) % 100) / 100 * height,
      z: Z_NEAR + ((index * 17) % 12) / 12 * (Z_FAR - Z_NEAR),
      vx: (index % 2 ? 1 : -1) * (8 + (index % 5) * 3),
      vy: (index % 3 ? 1 : -1) * (6 + (index % 4) * 3),
      vz: (index % 2 ? 1 : -1) * 0.05,
      spin: index * 0.7,
      spinRate: (index % 2 ? 1 : -1) * (0.35 + (index % 4) * 0.15),
      sprite: paintSprite(color),
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
        const r = (BASE_R / h.z)
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
          if (rel <= 0) continue // already separating
          a.vx -= rel * nx
          a.vy -= rel * ny
          b.vx += rel * nx
          b.vy += rel * ny
          // a hit knocks the spin around a little
          a.spinRate *= -1
          b.spinRate *= -1
          // push apart so they don't stick
          const overlap = (minDist - dist) / 2
          a.x -= nx * overlap
          a.y -= ny * overlap
          b.x += nx * overlap
          b.y += ny * overlap
        }
      }

      ctx.clearRect(0, 0, width, height)
      // far helmets first, so near ones pass in front
      const ordered = [...helmets].sort((p, q) => q.z - p.z)
      for (const h of ordered) {
        const scale = 1 / h.z
        const w = SPRITE_W * scale * 2
        const hgt = SPRITE_H * scale * 2
        // Y-axis spin: width narrows through cos, mirrors on the back half.
        const cos = Math.cos(h.spin)
        // Clamp so an edge-on helmet stays an object, not a needle-thin smear.
        const spriteW = Math.max(Math.abs(cos), 0.22) * w
        ctx.save()
        // Whisper level: present in the gutters, invisible behind text.
        ctx.globalAlpha = 0.05 + 0.08 * scale
        ctx.imageSmoothingEnabled = false
        ctx.translate(h.x, h.y)
        ctx.scale(cos < 0 ? -1 : 1, 1)
        ctx.drawImage(h.sprite, -spriteW / 2, -hgt / 2, spriteW, hgt)
        ctx.restore()
      }

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
