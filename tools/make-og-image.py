"""Generate the Open Graph card and apple-touch-icon for architechbc.com."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\GMARQ\Dev\Architech\assets\img"
INK, PAPER, BRASS, SLATE = (14, 17, 22), (251, 250, 248), (217, 164, 85), (154, 162, 173)

FONTS = r"C:\Windows\Fonts"


def font(names, size):
    for n in names:
        p = os.path.join(FONTS, n)
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                pass
    return ImageFont.load_default()


serif = lambda s: font(["georgiab.ttf", "georgia.ttf", "times.ttf"], s)
sans = lambda s: font(["segoeui.ttf", "arial.ttf"], s)
sans_b = lambda s: font(["segoeuisb.ttf", "segoeuib.ttf", "arialbd.ttf"], s)
mono = lambda s: font(["consola.ttf", "cour.ttf"], s)


def mark(d, cx, cy, size, stroke, ink=PAPER, datum=BRASS):
    """The Architech mark: an 'A' as a truss standing on a datum line."""
    u = size / 100.0
    x = lambda v: cx + (v - 50) * u
    y = lambda v: cy + (v - 50) * u
    for a, b in (((50, 14), (82, 76)), ((50, 14), (18, 76)), ((31, 58), (69, 58))):
        d.line([x(a[0]), y(a[1]), x(b[0]), y(b[1])], fill=ink, width=stroke)
    d.line([x(10), y(90), x(90), y(90)], fill=datum, width=stroke)


def wrap(d, txt, f, max_w):
    words, lines, cur = txt.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ---------------------------------------------------------------- OG card
W, H = 1200, 630
img = Image.new("RGB", (W, H), INK)
d = ImageDraw.Draw(img)

# Faint blueprint grid, fading toward the left.
for gx in range(0, W + 1, 60):
    a = int(26 * min(1.0, max(0.0, (gx - 380) / 820)))
    if a:
        d.line([gx, 0, gx, H], fill=(28 + a, 32 + a, 40 + a))
for gy in range(0, H + 1, 60):
    for gx in range(380, W, 60):
        a = int(22 * min(1.0, (gx - 380) / 820))
        if a:
            d.line([gx, gy, gx + 60, gy], fill=(28 + a, 32 + a, 40 + a))

PAD = 76
mark(d, PAD + 22, PAD + 20, 46, 5)
d.text((PAD + 60, PAD + 6), "ARCHITECH", font=sans_b(23), fill=PAPER)
d.text((PAD + 60, PAD + 33), "BUSINESS CONSULTING", font=sans(15), fill=SLATE)

f_head = serif(58)
lines = wrap(d, "Salesforce architecture for orgs that have gotten complicated.", f_head, W - PAD * 2 - 30)
y = 250
for ln in lines:
    d.text((PAD, y), ln, font=f_head, fill=PAPER)
    y += 74

d.line([PAD, H - 132, PAD + 64, H - 132], fill=BRASS, width=3)
d.text((PAD, H - 112), "Integration engineering  ·  Automation audits  ·  Documentation",
       font=sans(23), fill=SLATE)
d.text((PAD, H - 72), "architechbc.com", font=mono(21), fill=BRASS)

img.save(os.path.join(OUT, "og.png"), "PNG", optimize=True)
print("og.png", img.size)

# ------------------------------------------------------- apple-touch-icon
S = 180
ic = Image.new("RGB", (S, S), INK)
di = ImageDraw.Draw(ic)
mark(di, S // 2, S // 2 - 4, 112, 10)
ic.save(os.path.join(OUT, "apple-touch-icon.png"), "PNG", optimize=True)
print("apple-touch-icon.png", ic.size)
