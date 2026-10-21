"""Local-only helper: re-pack the plugin's artwork from an installed copy of the
whale-maid skin (only needed to regenerate assets/ from the skin's runtime files;
a plain checkout already contains the packed .webp/png files and needs only
`node scripts/build.mjs`).

- copy the two transparent whale-girl illustrations this plugin reuses (from the
  installed maid-atelier skin), trim transparent margins, resize, and encode as
  WebP so they can be embedded in the client bundle as data URIs;
- generate a small tiling grain/noise PNG used by the animation overlay.

The source artwork's copyright belongs to its authors (see NOTICE-ARTWORK.md);
this script only transforms copies for this plugin's artwork.
"""

import base64
import io
import os

from PIL import Image

HOME = os.path.expanduser("~")
SKIN_RUNTIME = os.path.join(
    HOME,
    ".dsh/profiles/desktop/node_modules/@smalltailqwq/dsh-client-ui-skin-maid-atelier/assets/runtime",
)
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))

CHIBI_SRC = os.path.join(
    SKIN_RUNTIME, "06eaf23edd8d5efcf8dfd2ff573307d92ad4422f4a5c022064e9659d34258b8d.png"
)
SPLASH_SRC = os.path.join(
    SKIN_RUNTIME, "2818e5359596b13c5d64f5b1c5d4a9e0c05be477824779af8af37a0e10016b07.webp"
)


def trim(im):
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def fit(im, target_w, target_h):
    scale = min(target_w / im.width, target_h / im.height)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return im


def encode_webp(im, quality=90):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


def main():
    os.makedirs(OUT, exist_ok=True)

    chibi = trim(Image.open(CHIBI_SRC).convert("RGBA"))
    chibi = fit(chibi, 680, 680)
    chibi_bytes = encode_webp(chibi, 92)
    with open(os.path.join(OUT, "whale-chibi.webp"), "wb") as f:
        f.write(chibi_bytes)
    print("chibi", chibi.size, len(chibi_bytes), "bytes")

    splash = trim(Image.open(SPLASH_SRC).convert("RGBA"))
    if splash.height > 1500:
        splash = splash.resize((round(splash.width * 1500 / splash.height), 1500), Image.LANCZOS)
    splash_bytes = encode_webp(splash, 90)
    with open(os.path.join(OUT, "whale-splash.webp"), "wb") as f:
        f.write(splash_bytes)
    print("splash", splash.size, len(splash_bytes), "bytes")

    # 160x160 tileable grain: two octaves of smoothed noise, alpha-only.
    import random

    random.seed(20261021)
    w = h = 160
    small = Image.new("L", (w // 2, h // 2))
    small.putdata([random.randint(96, 160) for _ in range((w // 2) * (h // 2))])
    grain = small.resize((w, h), Image.BICUBIC)
    rgba = Image.new("RGBA", (w, h))
    rgba.putalpha(grain)
    buf = io.BytesIO()
    rgba.save(buf, "PNG", optimize=True)
    noise = buf.getvalue()
    with open(os.path.join(OUT, "grain.png"), "wb") as f:
        f.write(noise)
    print("grain", len(noise), "bytes")


if __name__ == "__main__":
    main()
