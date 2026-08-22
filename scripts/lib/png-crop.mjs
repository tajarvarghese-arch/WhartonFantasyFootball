/**
 * Crop a PNG down to its top-left corner, in pure Node.
 *
 * Headless Chrome's viewport is shorter than the window it is asked for, so a
 * screenshot sized to the artwork clips the bottom of it. The fix is to shoot
 * with headroom and cut the square back out — which needs an image library
 * this repo deliberately does not have, so here is the ~100 lines that do it.
 *
 * Handles the only thing Chrome emits for --screenshot: 8-bit non-interlaced
 * RGB or RGBA.
 */

import zlib from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([head, body, crc])
}

function readChunks(png) {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG')
  const chunks = []
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) })
    offset += length + 12
  }
  return chunks
}

/** Undo the per-scanline filters so pixels can be addressed directly. */
function unfilter(raw, width, height, bpp) {
  const stride = width * bpp
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      let value = line[x]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (filter !== 0) throw new Error(`Unknown PNG filter ${filter}`)
      out[y * stride + x] = value & 0xff
    }
  }
  return out
}

export function cropPng(png, width, height) {
  const chunks = readChunks(png)
  const ihdr = chunks.find((entry) => entry.type === 'IHDR')
  const sourceWidth = ihdr.data.readUInt32BE(0)
  const sourceHeight = ihdr.data.readUInt32BE(4)
  const depth = ihdr.data[8]
  const colorType = ihdr.data[9]
  if (depth !== 8 || ihdr.data[12] !== 0) throw new Error('Expected 8-bit, non-interlaced PNG')
  if (colorType !== 2 && colorType !== 6) throw new Error(`Unsupported PNG colour type ${colorType}`)
  if (width > sourceWidth || height > sourceHeight) {
    throw new Error(`Crop ${width}x${height} exceeds ${sourceWidth}x${sourceHeight}`)
  }
  if (width === sourceWidth && height === sourceHeight) return png

  const bpp = colorType === 6 ? 4 : 3
  const idat = zlib.inflateSync(
    Buffer.concat(chunks.filter((entry) => entry.type === 'IDAT').map((entry) => entry.data)),
  )
  const pixels = unfilter(idat, sourceWidth, sourceHeight, bpp)

  const stride = width * bpp
  const cropped = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    cropped[y * (stride + 1)] = 0 // filter: none
    pixels.copy(cropped, y * (stride + 1) + 1, y * sourceWidth * bpp, y * sourceWidth * bpp + stride)
  }

  const header = Buffer.from(ihdr.data)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(cropped, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
