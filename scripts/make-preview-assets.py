"""Assemble the preview deliverables (animated WebP + storyboard) from headless frames.

Usage:
    python scripts/make-preview-assets.py <frames-dir>

`<frames-dir>` holds `f3-000.png ... f3-069.png` captured from
`preview/index.html?t=<ms>` at 15 fps (t_i = round(i * 4600 / 70)).
"""

import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "preview")
FRAME_MS = 66

BEATS = [
    (6, "0.40s · 终端自检"),
    (14, "0.90s · 声呐扫描"),
    (19, "1.25s · 全息建立"),
    (27, "1.78s · 目标锁定"),
    (31, "2.05s · 相位黑场"),
    (36, "2.35s · 干员档案"),
    (43, "2.80s · 属性填充"),
    (50, "3.30s · 档案定格"),
    (56, "3.70s · 徽记点亮"),
    (62, "4.05s · 深海回响"),
    (66, "4.32s · 闪光"),
    (69, "4.50s · 淡出界面"),
]


def main():
    frame_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "..", ".frames")
    files = sorted(glob.glob(os.path.join(frame_dir, "*.png")))
    if len(files) < 60:
        raise SystemExit(f"need ~70 frames, found {len(files)} in {frame_dir}")
    frames = [Image.open(f).convert("RGB") for f in files]
    print("frames:", len(frames))

    webp_path = os.path.join(OUT, "startup-animation.webp")
    frames[0].save(
        webp_path,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_MS,
        loop=0,
        quality=82,
        method=6,
    )
    print("webp:", os.path.getsize(webp_path) // 1024, "KiB")

    cols, cell_w, cell_h, pad, label_h = 4, 640, 360, 18, 40
    font = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 22)
    rows = (len(BEATS) + cols - 1) // cols
    sheet = Image.new(
        "RGB",
        (cols * cell_w + (cols + 1) * pad, rows * (cell_h + label_h) + (rows + 1) * pad),
        (6, 12, 24),
    )
    draw = ImageDraw.Draw(sheet)
    for index, (frame_index, label) in enumerate(BEATS):
        frame = frames[min(frame_index, len(frames) - 1)].resize((cell_w, cell_h), Image.LANCZOS)
        x = pad + (index % cols) * (cell_w + pad)
        y = pad + (index // cols) * (cell_h + label_h + pad)
        sheet.paste(frame, (x, y))
        draw.rectangle([x, y, x + cell_w - 1, y + cell_h - 1], outline=(30, 70, 120))
        draw.text((x + 6, y + cell_h + 8), label, fill=(190, 230, 255), font=font)
    storyboard_path = os.path.join(OUT, "storyboard.png")
    sheet.save(storyboard_path, optimize=True)
    print("storyboard:", sheet.size, os.path.getsize(storyboard_path) // 1024, "KiB")


if __name__ == "__main__":
    main()
