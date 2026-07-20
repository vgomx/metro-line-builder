from PIL import Image, ImageDraw, ImageFont

W, H, SS = 1200, 630, 2
PAGE, INK, MUTED = (247, 247, 247, 255), (17, 17, 17, 255), (110, 110, 116, 255)
GRID, RIVER = (226, 226, 228, 255), (198, 219, 243, 255)
RED, BLUE, GREEN, YELLOW, PURPLE = '#C62828', '#1565C0', '#2E7D32', '#F9A825', '#6A1B9A'

img = Image.new('RGBA', (W * SS, H * SS), PAGE)
d = ImageDraw.Draw(img)
S = lambda v: int(v * SS)

for x in range(0, W + 1, 40):
    d.line([(S(x), 0), (S(x), H * SS)], fill=GRID, width=SS)
for y in range(0, H + 1, 40):
    d.line([(0, S(y)), (W * SS, S(y))], fill=GRID, width=SS)

def route(points, colour, width):
    """A line in the app's own vocabulary: thick stroke, round joins, round caps."""
    pts = [(S(x), S(y)) for x, y in points]
    w = S(width)
    d.line(pts, fill=colour, width=w, joint='curve')
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=colour)

# A river, laid down first so the network crosses over it.
route([(150, 630), (250, 430), (250, 330), (390, 130), (390, 0)], RIVER, 34)

# Four lines, all orthogonal or 45° — the constraint the whole app is built on.
route([(90, 250), (250, 250), (350, 350), (620, 350), (720, 250), (1010, 250)], RED, 13)
route([(560, -60), (560, 210), (700, 350), (700, 520), (860, 520)], BLUE, 13)
route([(120, 470), (300, 470), (420, 350), (560, 350), (700, 490), (1060, 490)], GREEN, 13)
route([(430, 452), (430, 430), (560, 300), (560, 130), (760, 130), (900, 270), (900, 430)], YELLOW, 13)
route([(200, 130), (330, 130), (470, 270), (830, 270), (1000, 100), (1260, 100)], PURPLE, 13)

def stop(x, y, interchange=False):
    r, ring = (S(15), S(6)) if interchange else (S(9), S(4))
    d.ellipse([S(x) - r, S(y) - r, S(x) + r, S(y) + r], fill=PAGE, outline=INK, width=ring)

for x, y in [(350, 350), (560, 350), (700, 350), (560, 270), (900, 270), (470, 270), (700, 490)]:
    stop(x, y, True)
for x, y in [(90, 250), (250, 250), (1010, 250), (120, 470), (300, 470), (1060, 490), (860, 520), (200, 130), (760, 130), (900, 430), (430, 452)]:
    stop(x, y)

# Wordmark, bottom left, on a plate so it stays legible whatever a line does underneath it.
FONTS = '/Users/vitorgomes/vgomes-design/metro-ds/assets/fonts/'
cond = ImageFont.truetype(FONTS + 'BarlowCondensed-Bold.ttf', S(30))
body = ImageFont.truetype(FONTS + 'Barlow-Medium.ttf', S(23))

plate = [S(48), S(474), S(556), S(582)]
d.rounded_rectangle(plate, radius=S(14), fill=PAGE)

# The mark itself, at the same proportions as the app icon.
mx, my, mr = S(92), S(516), S(26)
d.ellipse([mx - mr, my - mr, mx + mr, my + mr], outline=INK, width=S(4))
m = [(mx - S(10), my + S(9)), (mx - S(10), my - S(9)), (mx, my + S(2)), (mx + S(10), my - S(9)), (mx + S(10), my + S(9))]
d.line(m, fill=INK, width=S(5), joint='curve')
for x, y in (m[0], m[-1]):
    d.ellipse([x - S(2.5), y - S(2.5), x + S(2.5), y + S(2.5)], fill=INK)

d.text((S(130), S(492)), 'METRO LINE BUILDER', font=cond, fill=INK)
d.text((S(131), S(524)), "A transit map for a city that doesn't exist yet.", font=body, fill=MUTED)

img = img.resize((W, H), Image.LANCZOS)
img.convert('RGB').save('public/social-card.png', optimize=True)
print('social-card.png', img.size)
