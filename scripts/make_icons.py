"""
Generate the league's app icons: WACL in pixel-art neon.

    python scripts/make_icons.py

Draws the wordmark from a hand-built 5x7 bitmap font so the letters stay
genuinely blocky at every size, fills them with the same banded greens the
site's PixelSign wordmark uses, and lays a blurred green/amber bloom behind
them for the neon. Writes the Apple touch icon, the PWA icons, and the
favicons into public/.

iOS applies its own rounded-corner mask, so these are drawn as full squares.
"""

from __future__ import annotations

import pathlib

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public'

BG = (11, 14, 18)                    # --color-arc-bg
BANDS = ['#eaffdf', '#b8f795', '#84e95e', '#53d337', '#33a81f']
GLOW_GREEN = (83, 211, 55)
GLOW_AMBER = (255, 182, 54)

FONT: dict[str, list[str]] = {
    'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
}
GW, GH = 5, 7


def cells(layout: list[str], grid: int) -> list[tuple[int, int, int]]:
    """Place the rows of letters centred in a grid; returns (x, y, band)."""
    rows = len(layout)
    per_row = max(len(r) for r in layout)
    block_w = per_row * GW + (per_row - 1)
    block_h = rows * GH + (rows - 1)
    x0 = (grid - block_w) // 2
    y0 = (grid - block_h) // 2

    out: list[tuple[int, int, int]] = []
    for r, word in enumerate(layout):
        for c, ch in enumerate(word):
            gx = x0 + c * (GW + 1)
            gy = y0 + r * (GH + 1)
            for row, bits in enumerate(FONT[ch]):
                band = min(int(row / GH * len(BANDS)), len(BANDS) - 1)
                for col, bit in enumerate(bits):
                    if bit == '1':
                        out.append((gx + col, gy + row, band))
    return out


def render(size: int, layout: list[str], grid: int) -> Image.Image:
    scale = size / grid
    placed = cells(layout, grid)

    def paint(canvas: Image.Image, colour) -> None:
        d = ImageDraw.Draw(canvas)
        for gx, gy, band in placed:
            fill = colour if colour is not None else BANDS[band]
            d.rectangle(
                [round(gx * scale), round(gy * scale),
                 round((gx + 1) * scale) - 1, round((gy + 1) * scale) - 1],
                fill=fill,
            )

    img = Image.new('RGB', (size, size), BG)

    # Two bloom passes added as light: a tight green halo, then a wider amber
    # wash. Additive keeps the background dark while the glow reads as emission.
    for colour, blur, strength in (
        (GLOW_GREEN, scale * 1.5, 0.85),
        (GLOW_AMBER, scale * 3.2, 0.30),
    ):
        layer = Image.new('RGB', (size, size), (0, 0, 0))
        paint(layer, colour)
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
        layer = layer.point(lambda v, s=strength: int(v * s))
        img = ImageChops.add(img, layer)

    paint(img, None)  # crisp banded letters on top
    return img


def main() -> None:
    full = ['WA', 'CL']
    single = ['W']
    targets = [
        ('apple-touch-icon.png', 180, full, 20),
        ('icon-192.png', 192, full, 20),
        ('icon-512.png', 512, full, 20),
        ('favicon-32.png', 32, single, 9),
        ('favicon-16.png', 16, single, 9),
    ]
    for name, size, layout, grid in targets:
        render(size, layout, grid).save(OUT / name, 'PNG', optimize=True)
        print(f'{name:<22} {size}x{size}  {(OUT / name).stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
