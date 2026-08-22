/**
 * Export every manager badge as a standalone icon file.
 *
 *     node scripts/manager_icons.mjs
 *
 * The badge — colour tile, dark two-letter monogram — is the league's identity
 * unit on the site (src/components/ManagerTag.tsx). This writes the same mark
 * out as files people can actually take with them: chat avatars, group-chat
 * icons, slides.
 *
 * Colours are read straight out of src/lib/identity.ts and names out of
 * public/data/managers.json, so the exports can never drift from the site.
 * Nothing here writes to public/data — it only reads it.
 *
 * SVG is generated directly (Barlow Condensed embedded, so the file is
 * self-contained); PNG is rasterised by the Chromium that ships with this
 * container, so there is no image library to install.
 */

import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { cropPng } from './lib/png-crop.mjs'

const run = promisify(execFile)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'assets/manager-icons')
const TMP = path.join(ROOT, '.icon-build')

/** Matches .badge in src/index.css and the inline sizing in ManagerTag. */
const RADIUS = 6 / 26
const TEXT_SIZE = 0.33
const INK = '#06090d'
const PNG_SIZES = [1024, 512, 128]

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700'
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
]

function chromeBinary() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate
  }
  throw new Error('No Chromium found — set CHROME_PATH to a Chrome/Chromium binary.')
}

/** Read the palette from the TypeScript source rather than duplicating it. */
async function managerColors() {
  const source = await readFile(path.join(ROOT, 'src/lib/identity.ts'), 'utf8')
  const block = source.match(/MANAGER_COLOR[^{]*\{([\s\S]*?)\n\}/)
  if (!block) throw new Error('Could not find MANAGER_COLOR in src/lib/identity.ts')
  const colors = {}
  for (const [, id, hex] of block[1].matchAll(/(\w+):\s*'(#[0-9a-fA-F]{6})'/g)) colors[id] = hex
  const fallback = source.match(/FALLBACK_COLOR\s*=\s*'(#[0-9a-fA-F]{6})'/)
  return { colors, fallback: fallback ? fallback[1] : '#8d84a8' }
}

/** Same rule as managerInitials() in src/lib/identity.ts. */
function initials(manager) {
  const source = manager.displayName ?? manager.id ?? '?'
  const parts = source.trim().split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

const fontCache = new Map()

/**
 * Barlow Condensed Bold, cut down to just the letters one monogram needs and
 * inlined, so each SVG is self-contained without carrying a whole alphabet.
 */
async function fontDataUri(text) {
  const glyphs = [...new Set(text)].sort().join('')
  if (fontCache.has(glyphs)) return fontCache.get(glyphs)
  const css = await fetch(`${FONT_CSS}&text=${encodeURIComponent(glyphs)}`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  }).then((response) => {
    if (!response.ok) throw new Error(`Google Fonts said ${response.status}`)
    return response.text()
  })
  // With text= Google returns one face holding exactly those glyphs, served
  // from a /l/font endpoint with no file extension — match on the format hint.
  const faces = [...css.matchAll(/url\((https:[^)]+)\)\s*format\('woff2'\)/g)]
  const url = faces.at(-1)?.[1]
  if (!url) throw new Error('No woff2 in the Google Fonts response')
  const font = Buffer.from(await fetch(url).then((response) => response.arrayBuffer()))
  const uri = `data:font/woff2;base64,${font.toString('base64')}`
  fontCache.set(glyphs, uri)
  return uri
}

function svg(manager, color, font) {
  const size = 512
  const label = `${manager.displayName ?? manager.id} — WACL`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}">
  <title>${label}</title>
  <defs>
    <style>
      @font-face {
        font-family: 'Barlow Condensed';
        font-style: normal;
        font-weight: 700;
        src: url(${font}) format('woff2');
      }
    </style>
  </defs>
  <rect width="${size}" height="${size}" rx="${(size * RADIUS).toFixed(2)}" ry="${(size * RADIUS).toFixed(2)}" fill="${color}"/>
  <text x="50%" y="50%" fill="${INK}" text-anchor="middle" dominant-baseline="central"
        font-family="'Barlow Condensed', 'Inter', system-ui, sans-serif" font-weight="700"
        font-size="${(size * TEXT_SIZE).toFixed(2)}" letter-spacing="${(size * 0.01).toFixed(2)}"
        >${initials(manager)}</text>
</svg>
`
}

/**
 * Headless Chrome hands back a viewport shorter than the window it was given,
 * which clips the tile, so shoot with headroom and cut the square back out.
 */
const HEADROOM = 240

async function png(chrome, name, markup, size) {
  const page = path.join(TMP, `${name}-${size}.html`)
  const raw = path.join(TMP, `${name}-${size}.png`)
  const shot = path.join(OUT, `${name}-${size}.png`)
  await writeFile(
    page,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}
svg{display:block;width:${size}px;height:${size}px}</style>${markup}`,
  )
  await run(chrome, [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${size},${size + HEADROOM}`,
    `--screenshot=${raw}`,
    `file://${page}`,
  ])
  await writeFile(shot, cropPng(await readFile(raw), size, size))
  return shot
}

async function main() {
  const chrome = chromeBinary()
  const managers = JSON.parse(await readFile(path.join(ROOT, 'public/data/managers.json'), 'utf8'))
  const { colors, fallback } = await managerColors()

  await rm(TMP, { recursive: true, force: true })
  await mkdir(TMP, { recursive: true })
  await mkdir(OUT, { recursive: true })

  let written = 0
  for (const manager of managers) {
    const color = colors[manager.id] ?? fallback
    const markup = svg(manager, color, await fontDataUri(initials(manager)))
    await writeFile(path.join(OUT, `${manager.id}.svg`), markup)
    written += 1
    // Sequential on purpose: sixteen managers is fast enough, and one Chromium
    // at a time keeps the container's memory out of trouble.
    for (const size of PNG_SIZES) {
      await png(chrome, manager.id, markup, size)
      written += 1
    }
    console.log(
      `${manager.id.padEnd(12)} ${initials(manager).padEnd(3)} ${color}${manager.active ? '' : '  (former)'}`,
    )
  }

  await rm(TMP, { recursive: true, force: true })
  console.log(`\n${written} files → ${path.relative(ROOT, OUT)}`)
}

await main()
