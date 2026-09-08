"""Generate the full favicon / app-icon set for architechbc.com.

Everything is drawn at 4x and downsampled with LANCZOS so edges stay clean at
small sizes. Below 24px the crossbar of the 'A' is dropped — at that scale it
merges with the legs and turns the mark into a blob.
"""
import os
from PIL import Image, ImageDraw

OUT = r"C:\Users\GMARQ\Dev\Architech\assets\img"
ROOT = r"C:\Users\GMARQ\Dev\Architech"

INK = (14, 17, 22)
PAPER = (251, 250, 248)
BRASS = (217, 164, 85)

SS = 4  # supersample factor


def draw_mark(size, tile=True, pad_ratio=0.18, radius_ratio=0.20):
    """Render the Architech mark at `size` px."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if tile:
        r = int(S * radius_ratio)
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=INK)

    # Working box inside the tile.
    pad = S * pad_ratio
    box = S - pad * 2

    def px(x, y):
        return (pad + box * x, pad + box * y)

    # Stroke weight scales with size but stays chunky when small.
    w = max(2, int(round(S * (0.115 if size < 24 else 0.095))))

    apex = px(0.5, 0.06)
    left = px(0.06, 0.74)
    right = px(0.94, 0.74)

    d.line([apex, right], fill=PAPER, width=w)
    d.line([apex, left], fill=PAPER, width=w)

    if size >= 24:
        d.line([px(0.25, 0.55), px(0.75, 0.55)], fill=PAPER, width=w)

    # The datum line the mark stands on, in brass.
    d.line([px(0.0, 0.93), px(1.0, 0.93)], fill=BRASS, width=w)

    return img.resize((size, size), Image.LANCZOS)


made = []

# --- favicon.ico: multi-resolution, the universal fallback ---------------
ico_sizes = [16, 24, 32, 48, 64]
frames = [draw_mark(s).convert("RGB") for s in ico_sizes]
ico_path = os.path.join(ROOT, "favicon.ico")
frames[-1].save(ico_path, format="ICO",
                sizes=[(s, s) for s in ico_sizes])
made.append(("favicon.ico (root)", ico_sizes))

# --- PNG favicons for browsers that prefer them --------------------------
for s in (16, 32, 48, 96):
    p = os.path.join(OUT, f"favicon-{s}.png")
    draw_mark(s).convert("RGB").save(p, "PNG", optimize=True)
    made.append((f"favicon-{s}.png", s))

# --- Apple touch icon: no transparency, no rounding (iOS masks it) -------
apple = draw_mark(180, radius_ratio=0.0).convert("RGB")
apple.save(os.path.join(OUT, "apple-touch-icon.png"), "PNG", optimize=True)
made.append(("apple-touch-icon.png", 180))

# --- Android / PWA -------------------------------------------------------
for s in (192, 512):
    draw_mark(s).convert("RGB").save(
        os.path.join(OUT, f"icon-{s}.png"), "PNG", optimize=True)
    made.append((f"icon-{s}.png", s))

# Maskable: generous safe-area padding so Android can crop to any shape.
for s in (192, 512):
    img = Image.new("RGB", (s, s), INK)
    inner = draw_mark(int(s * 0.62), tile=False, pad_ratio=0.0)
    off = (s - inner.width) // 2
    img.paste(inner, (off, off), inner)
    img.save(os.path.join(OUT, f"icon-maskable-{s}.png"), "PNG", optimize=True)
    made.append((f"icon-maskable-{s}.png", s))

for name, s in made:
    print(f"  {name:28} {s}")
