from PIL import Image, ImageDraw

INK = (17, 17, 17, 255)
PAPER = (255, 255, 255, 255)
SS = 4  # supersample; PIL has no antialiasing on primitives, so draw big and shrink

def draw_icon(size, bg, fg, content_ratio):
    """The wordmark's circle-and-M at `content_ratio` of the tile, centred.

    content_ratio stays modest for the maskable icon: Android may crop anything outside the
    central 80% circle, so the mark has to sit well inside that or lose its ring."""
    n = size * SS
    img = Image.new('RGBA', (n, n), bg)
    d = ImageDraw.Draw(img)

    # The source mark is a 52-unit box: circle r=24 stroke 4, and an M on a 5-wide stroke.
    scale = (n * content_ratio) / 52.0
    ox = oy = (n - 52 * scale) / 2

    def P(x, y):
        return (ox + x * scale, oy + y * scale)

    r = 24 * scale
    cx, cy = P(26, 26)
    ring = 4 * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=fg, width=int(round(ring)))

    stroke = int(round(5 * scale))
    pts = [P(17, 34), P(17, 18), P(26, 28), P(35, 18), P(35, 34)]
    d.line(pts, fill=fg, width=stroke, joint='curve')
    # Round caps, which PIL's line() doesn't do: a disc at each end of the polyline.
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2], fill=fg)

    return img.resize((size, size), Image.LANCZOS)

# Home-screen icons: dark tile, white mark. Reads as a deliberate app icon on any wallpaper,
# where the bare favicon (a thin black mark on nothing) would vanish against a dark one.
draw_icon(192, INK, PAPER, 0.60).save('public/icon-192.png')
draw_icon(512, INK, PAPER, 0.60).save('public/icon-512.png')
# Maskable: same art, pulled further in, because Android crops to a circle of unknown radius.
draw_icon(512, INK, PAPER, 0.46).save('public/icon-maskable-512.png')
# iOS applies its own rounded-rect mask and no padding of its own.
draw_icon(180, INK, PAPER, 0.60).save('public/apple-touch-icon.png')
print('written')
