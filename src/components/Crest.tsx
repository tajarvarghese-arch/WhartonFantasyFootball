/**
 * The league crest. Reuses the app-icon art so the badge on screen and the
 * badge on a home screen can never drift apart — change scripts/make_icons.py
 * and every mark on the site follows.
 *
 * The source is pixel art but it is always drawn smaller than its native
 * size here, so rendering is left smooth; forcing `pixelated` on a downscale
 * aliases the laurels into noise.
 */
export default function Crest({
  size,
  className = '',
  glow = true,
}: {
  size: number
  className?: string
  glow?: boolean
}) {
  const src = size > 180 ? 'icon-512.png' : 'icon-192.png'
  return (
    <img
      src={`${import.meta.env.BASE_URL}${src}`}
      width={size}
      height={size}
      alt="WACL — Wharton Alum Champions League"
      className={className}
      style={{
        display: 'block',
        filter: glow ? 'drop-shadow(0 0 12px rgba(251, 197, 92, 0.28))' : undefined,
      }}
    />
  )
}
