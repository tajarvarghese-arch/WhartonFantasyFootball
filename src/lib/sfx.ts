/**
 * 8-bit sound effects, synthesized with WebAudio — no audio files. Off by
 * default; the SFX toggle in the status bar flips it per browser. Browsers
 * refuse audio before a user gesture, so the context is created lazily on the
 * first play attempt after an interaction.
 */

const KEY = 'wacl.sfx'

export function sfxOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function setSfxOn(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'on')
    else localStorage.removeItem(KEY)
  } catch {
    /* private browsing */
  }
}

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  a: AudioContext,
  type: OscillatorType,
  freq: number,
  start: number,
  duration: number,
  volume = 0.08,
  slideTo?: number,
) {
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, a.currentTime + start)
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, a.currentTime + start + duration)
  gain.gain.setValueAtTime(volume, a.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + duration)
  osc.connect(gain).connect(a.destination)
  osc.start(a.currentTime + start)
  osc.stop(a.currentTime + start + duration + 0.02)
}

function noise(a: AudioContext, start: number, duration: number, volume = 0.12) {
  const buffer = a.createBuffer(1, a.sampleRate * duration, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1200, a.currentTime + start)
  filter.frequency.exponentialRampToValueAtTime(250, a.currentTime + start + duration)
  const gain = a.createGain()
  gain.gain.setValueAtTime(volume, a.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + duration)
  src.connect(filter).connect(gain).connect(a.destination)
  src.start(a.currentTime + start)
}

export type SfxName = 'blip' | 'coin' | 'roar' | 'trombone' | 'fanfare' | 'whistle'

export function play(name: SfxName): void {
  if (!sfxOn()) return
  const a = audio()
  if (!a) return
  switch (name) {
    case 'blip':
      tone(a, 'square', 660, 0, 0.05, 0.05, 880)
      break
    case 'coin':
      tone(a, 'square', 988, 0, 0.08, 0.07)
      tone(a, 'square', 1319, 0.08, 0.22, 0.07)
      break
    case 'roar':
      // crowd: filtered noise swell + a rising major arpeggio on top
      noise(a, 0, 0.9, 0.16)
      ;[523, 659, 784].forEach((f, i) => tone(a, 'square', f, 0.05 + i * 0.09, 0.14, 0.05))
      tone(a, 'square', 1047, 0.32, 0.4, 0.06)
      break
    case 'trombone':
      // the sad walk down
      ;[392, 370, 349, 330].forEach((f, i) => tone(a, 'sawtooth', f, i * 0.19, 0.18, 0.06))
      tone(a, 'sawtooth', 311, 0.76, 0.5, 0.06, 296)
      break
    case 'whistle':
      tone(a, 'sine', 2200, 0, 0.12, 0.06, 2400)
      tone(a, 'sine', 2200, 0.16, 0.3, 0.06, 2500)
      break
    case 'fanfare':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(a, 'square', f, i * 0.11, 0.12, 0.06))
      tone(a, 'square', 1047, 0.44, 0.5, 0.07)
      tone(a, 'square', 784, 0.44, 0.5, 0.04)
      break
  }
}
