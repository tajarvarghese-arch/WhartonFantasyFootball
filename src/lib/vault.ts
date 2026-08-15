/**
 * The commissioner password. A static site has no server to check a password
 * against, so the password IS the key: the GitHub token is sealed with
 * AES-256-GCM under a key derived from the password (PBKDF2-SHA256, 600k
 * iterations), and the sealed blob lives in the public repo. Any device can
 * fetch the blob; only the password opens it. The password itself never
 * leaves the browser.
 *
 * Threat model, stated honestly: the blob is public, so an attacker can
 * brute-force offline. 600k PBKDF2 iterations plus a decent passphrase makes
 * that impractical; a weak password does not. The UI enforces a minimum, and
 * the token behind it is a fine-grained PAT scoped to this one repository —
 * revocable in one click on GitHub if anything ever feels off.
 */

export interface VaultBlob {
  v: 1
  kdf: 'PBKDF2-SHA256'
  iter: number
  salt: string
  iv: string
  ct: string
}

export const MIN_PASSWORD_LENGTH = 12
const ITERATIONS = 600_000

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0))
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function sealToken(token: string, password: string): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ITERATIONS)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoder.encode(token),
  )
  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ct)),
  }
}

export async function openVault(blob: VaultBlob, password: string): Promise<string> {
  const key = await deriveKey(password, fromBase64(blob.salt), blob.iter)
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(blob.iv) as BufferSource },
      key,
      fromBase64(blob.ct) as BufferSource,
    )
    return decoder.decode(plain)
  } catch {
    throw new Error('Wrong password.')
  }
}
