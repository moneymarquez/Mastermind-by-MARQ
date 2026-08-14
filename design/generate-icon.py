"""
Regenerates public/icons/*.png (and the favicon) from design/marq-wordmark.png,
the hand-drawn "MARQ" mountain-letter master art.

Why this exists: the wordmark PNG's edges are genuinely soft in the source
file itself (measured ~4-5px grayscale ramp before hitting full white at
1254px resolution, not just a downsampling artifact) — that softness is what
read as "blurry" at icon sizes. This script thresholds the source into a
crisp binary mask before compositing, so every exported size gets a clean
edge instead of inheriting and compounding that native blur. It also
recenters the glyph slightly left of dead-center (the source's glyph
bounding box sits ~2.3% right of center) and forces a true pure-black /
pure-white pairing for maximum contrast.

Requires Pillow (`pip install pillow`) — a one-time asset-generation tool,
not a runtime or build dependency of the app. Run with:
    python3 design/generate-icon.py
"""

from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SOURCE = os.path.join(HERE, 'marq-wordmark.png')
MASTER_SIZE = 1024
LEFT_SHIFT_FRAC = 0.045  # fraction of canvas width to shift the glyph left by

OUTPUTS = [
    (512, os.path.join(ROOT, 'public', 'icons', 'icon-512.png')),
    (192, os.path.join(ROOT, 'public', 'icons', 'icon-192.png')),
    (180, os.path.join(ROOT, 'public', 'icons', 'apple-touch-icon.png')),
    (32, os.path.join(ROOT, 'public', 'icons', 'favicon-32.png')),
    (16, os.path.join(ROOT, 'public', 'icons', 'favicon-16.png')),
]


def build_master() -> Image.Image:
    src = Image.open(SOURCE).convert('L')

    # Threshold to a crisp binary mask — kills the soft gray fringe baked
    # into the source art so every downstream size starts from a hard edge.
    mask = src.point(lambda p: 255 if p > 110 else 0, mode='L')
    bbox = mask.getbbox()
    glyph = mask.crop(bbox)

    # Fit the glyph to occupy the same proportion of the canvas the source
    # art used (~57% of height) so the mark's size doesn't change, only its
    # crispness and position.
    target_h = round(MASTER_SIZE * 0.57)
    scale = target_h / glyph.height
    target_w = round(glyph.width * scale)
    glyph = glyph.resize((target_w, target_h), Image.LANCZOS)
    # Re-threshold post-resize so LANCZOS's own smoothing doesn't reintroduce
    # a wide gray ramp — leaves a clean ~1px anti-alias edge, not a haze.
    glyph = glyph.point(lambda p: 255 if p > 140 else 0, mode='L')

    master = Image.new('RGB', (MASTER_SIZE, MASTER_SIZE), (0, 0, 0))
    cx = (MASTER_SIZE - target_w) // 2 - round(MASTER_SIZE * LEFT_SHIFT_FRAC)
    cy = (MASTER_SIZE - target_h) // 2
    white = Image.new('RGB', glyph.size, (255, 255, 255))
    master.paste(white, (cx, cy), glyph)
    return master


def main():
    master = build_master()
    master_path = os.path.join(HERE, 'icon-master.png')
    master.save(master_path)
    print('wrote', master_path)

    for size, out_path in OUTPUTS:
        # Slight supersample-then-downsize (master is 1024, targets are
        # smaller) via LANCZOS gives smooth, non-jagged, non-hazy edges.
        resized = master.resize((size, size), Image.LANCZOS)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        resized.save(out_path)
        print('wrote', out_path)


if __name__ == '__main__':
    main()
