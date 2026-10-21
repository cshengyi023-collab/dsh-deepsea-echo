"""Generate the plugin-market icon (256x256 PNG) from the chibi artwork."""

import os

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHIBI = os.path.join(ROOT, "assets", "whale-chibi.webp")
OUT = os.path.join(ROOT, "assets", "plugin-icon.png")

SIZE = 256
img = Image.open(CHIBI).convert("RGBA")
# Use the head region (top ~66%) so the icon reads at 32-64 px.
head = img.crop((0, 0, img.width, int(img.height * 0.66)))
head = head.crop(head.getbbox())

icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(icon)

# Rounded navy plate with a cyan rim.
draw.rounded_rectangle([4, 4, SIZE - 5, SIZE - 5], radius=56, fill=(7, 22, 44, 255))
draw.rounded_rectangle([4, 4, SIZE - 5, SIZE - 5], radius=56, outline=(110, 200, 255, 235), width=3)

# Soft volumetric glow behind the character (alpha-composited so it blends).
glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
cx, cy = SIZE // 2, int(SIZE * 0.62)
for radius in range(118, 0, -2):
    t = 1 - radius / 118
    gd.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=(40, 110, 210, int(6 + 18 * t * t)),
    )
icon.alpha_composite(glow)

# Fit the head into the plate, centered a little low.
target = 214
scale = min(target / head.width, target / head.height)
head = head.resize((round(head.width * scale), round(head.height * scale)), Image.LANCZOS)
x = (SIZE - head.width) // 2
y = SIZE - head.height - 6
icon.alpha_composite(head, (x, y))

icon.save(OUT, "PNG", optimize=True)
print("icon:", OUT, icon.size, os.path.getsize(OUT) // 1024, "KiB")
