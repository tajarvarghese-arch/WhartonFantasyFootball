import { useEffect, useRef } from 'react'

/**
 * The retro-neon wordmark, rendered with a deliberate pixel grain: every layer
 * (blue 3D extrusion, banded sunset fill, white neon tube, glow) is drawn to a
 * low-resolution canvas and upscaled with smoothing off, so the smooth Barlow
 * One glyphs come out chunky — same DNA as the heap sprites.
 */

interface Word {
  text: string
  palette: 'pink' | 'gold'
  /** display px height of the glyphs */
  size: number
  /** extra letter spacing in em */
  tracking?: number
  /** per-word grain override — small words need finer pixels to stay legible */
  pixel?: number
}

interface Props {
  words: Word[]
  /** chunkiness: display pixels per rendered pixel */
  pixel?: number
  /** lean, in degrees. Baked into the canvas so no CSS transform can lose it. */
  tilt?: number
  className?: string
}

// 'pink' is the money-green primary, 'gold' the amber favourite line — the
// palette keys are legacy names shared with every call site.
const BANDS: Record<'pink' | 'gold', string[]> = {
  pink: ['#eaffdf', '#b8f795', '#84e95e', '#53d337', '#33a81f'],
  gold: ['#fff3d6', '#ffe3a1', '#ffcb62', '#ffb636', '#ff921f'],
}
const DEPTHS = ['#3d4855', '#353f4c', '#2c3542', '#242c38', '#1c232d']

export default function PixelSign({ words, pixel = 4, tilt = -5, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return

    const render = () => {
      if (cancelled || !canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // ---- layout at display scale ----
      const pad = Math.max(...words.map((w) => w.size)) * 0.42
      const gap = 6
      const measure = document.createElement('canvas').getContext('2d')!
      let width = 0
      let height = pad
      const lines = words.map((word) => {
        measure.font = `italic 800 ${word.size}px "Barlow Condensed"`
        const spacing = (word.tracking ?? 0.04) * word.size
        const w = measure.measureText(word.text).width + spacing * (word.text.length - 1)
        width = Math.max(width, w)
        const line = { ...word, w, y: height + word.size }
        height += word.size + gap
        return line
      })
      height += pad * 1.2
      width += pad * 2.6

      // ---- render each word at its own grain, then composite -------------
      // The lean is drawn, not styled: rotate the whole composition inside
      // the canvas and size the canvas to the rotated bounding box.
      const rad = (tilt * Math.PI) / 180
      const cos = Math.abs(Math.cos(rad))
      const sin = Math.abs(Math.sin(rad))
      const outW = Math.ceil(width * cos + height * sin)
      const outH = Math.ceil(width * sin + height * cos)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = outW * dpr
      canvas.height = outH * dpr
      canvas.style.width = `${outW}px`
      canvas.style.height = `${outH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, outW, outH)
      ctx.translate(outW / 2, outH / 2)
      ctx.rotate(rad)
      ctx.translate(-width / 2, -height / 2)
      ctx.imageSmoothingEnabled = false

      const blits: { img: HTMLCanvasElement; x: number; y: number; w: number; h: number }[] = []
      for (const line of lines) {
        // A small word through a coarse grain renders below legibility, so
        // each word picks its own pixel size (default: scale with glyph size).
        const p = Math.max(2, line.pixel ?? Math.max(2, Math.round(pixel * (line.size / 52))))
        const step = line.size * 0.055
        const margin = line.size * 0.5
        const boxW = line.w + margin * 2
        const boxH = line.size + margin * 2
        const low = document.createElement('canvas')
        low.width = Math.ceil(boxW / p)
        low.height = Math.ceil(boxH / p)
        const lctx = low.getContext('2d')!
        lctx.textAlign = 'center'
        lctx.textBaseline = 'alphabetic'
        lctx.font = `italic 800 ${line.size / p}px "Barlow Condensed"`

        const spacing = ((line.tracking ?? 0.04) * line.size) / p
        const widths = [...line.text].map((ch) => lctx.measureText(ch).width)
        const total = widths.reduce((a, b) => a + b, 0) + spacing * (line.text.length - 1)
        const baseY = (margin + line.size * 0.82) / p
        const charsAt = (dx: number, dy: number) => {
          let x = low.width / 2 - total / 2 + dx / p
          const out: { ch: string; x: number }[] = []
          ;[...line.text].forEach((ch, i) => {
            out.push({ ch, x: x + widths[i] / 2 })
            x += widths[i] + spacing
          })
          return { chars: out, y: baseY + dy / p }
        }

        // 1. blue extrusion, deep to shallow
        for (let d = DEPTHS.length - 1; d >= 0; d--) {
          const { chars, y } = charsAt((d + 1) * step, (d + 1) * step * 1.35)
          lctx.fillStyle = DEPTHS[d]
          for (const c of chars) lctx.fillText(c.ch, c.x, y)
        }
        // 2. banded fill
        const bands = BANDS[line.palette]
        const gTop = margin / p
        const grad = lctx.createLinearGradient(0, gTop, 0, gTop + line.size / p)
        bands.forEach((color, i) => {
          grad.addColorStop(i / bands.length, color)
          grad.addColorStop(Math.min((i + 1) / bands.length, 1), color)
        })
        const { chars, y } = charsAt(0, 0)
        lctx.fillStyle = grad
        for (const c of chars) lctx.fillText(c.ch, c.x, y)
        // 3. neon tube
        lctx.strokeStyle = 'rgba(255,255,255,0.95)'
        lctx.lineWidth = Math.max(1, line.size / p / 16)
        lctx.lineJoin = 'round'
        for (const c of chars) lctx.strokeText(c.ch, c.x, y)

        blits.push({
          img: low,
          x: width / 2 - boxW / 2,
          y: line.y - line.size - margin,
          w: boxW,
          h: boxH,
        })
      }

      // glow halo from the pixel art itself, then the crisp pass on top
      const heroSize = Math.max(...words.map((w) => w.size))
      for (const pass of [
        { color: 'rgba(83,211,55,0.5)', blur: heroSize * 0.28 },
        { color: 'rgba(255,182,54,0.32)', blur: heroSize * 0.5 },
        { color: 'transparent', blur: 0 },
      ]) {
        ctx.shadowColor = pass.color
        ctx.shadowBlur = pass.blur
        for (const b of blits) ctx.drawImage(b.img, b.x, b.y, b.w, b.h)
      }
      ctx.shadowBlur = 0
    }

    // Barlow Condensed must be resident or the canvas draws a fallback face.
    const sized = words.map((w) => `italic 800 ${w.size}px "Barlow Condensed"`)
    Promise.all(sized.map((f) => document.fonts.load(f)))
      .then(() => {
        if (!cancelled) render()
      })
      .catch(() => {
        if (!cancelled) render()
      })

    return () => {
      cancelled = true
    }
  }, [words, pixel, tilt])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: 'pixelated' }}
      aria-hidden
    />
  )
}
