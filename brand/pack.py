"""Packs the Chromium rasters from brand/render.mjs into the files shipped in public/.

    python3 brand/pack.py <raw-dir> <public-dir>

PNGs are re-encoded with Pillow's optimize=True; favicon.ico gets the hand-tuned
16 and 32 px rasters plus the 48 px one as separate BMP frames (no resampling).
"""

import os
import sys

from PIL import Image

OG_LIMIT = 300 * 1024

# raw file -> (shipped file, mode); RGB where the platform shows no transparency
PNGS = {
    "og-ko.png": ("og-image-ko.png", "RGB"),
    "og-en.png": ("og-image-en.png", "RGB"),
    "og-result-ko.png": ("og-result-ko.png", "RGB"),
    "og-result-en.png": ("og-result-en.png", "RGB"),
    "apple-touch-icon.png": ("apple-touch-icon.png", "RGB"),
    "icon-maskable-512.png": ("icon-maskable-512.png", "RGB"),
    "icon-192.png": ("icon-192.png", "RGBA"),
    "icon-512.png": ("icon-512.png", "RGBA"),
}


def main(raw: str, out: str) -> int:
    failed = False
    for src, (dst, mode) in PNGS.items():
        with Image.open(os.path.join(raw, src)) as im:
            im = im.convert(mode)
            path = os.path.join(out, dst)
            im.save(path, "PNG", optimize=True)
        size = os.path.getsize(path)
        print(f"[pack] {dst:24} {im.width}x{im.height} {mode:4} {size / 1024:7.1f} KB")
        if dst.startswith("og-") and size > OG_LIMIT:
            print(f"[pack] {dst} is over {OG_LIMIT // 1024} KB", file=sys.stderr)
            failed = True

    frames = {s: Image.open(os.path.join(raw, f"icon-{s}.png")).convert("RGBA") for s in (16, 32, 48)}
    ico = os.path.join(out, "favicon.ico")
    frames[48].save(
        ico,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[frames[16], frames[32]],
        bitmap_format="bmp",
    )
    with Image.open(ico) as check:
        got = sorted(check.info["sizes"])
    print(f"[pack] {'favicon.ico':24} {got} {os.path.getsize(ico) / 1024:7.1f} KB")
    if got != [(16, 16), (32, 32), (48, 48)]:
        print("[pack] favicon.ico frames are wrong", file=sys.stderr)
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
