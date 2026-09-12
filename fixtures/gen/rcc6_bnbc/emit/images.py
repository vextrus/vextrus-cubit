"""The two rasters the drawing itself carries, authored deterministically with Pillow (D1).

    author() -> dict[name, png_bytes]

`dxf.py` writes each under `images/<name>.png` beside the DXF and points an IMAGEDEF at that
relative path, so the corpus is self-contained and an IMAGE entity resolves wherever it is unpacked.

Both images are drawn from a fixed seed with the bitmap font Pillow ships, never a system font
(W-03), and saved with `optimize=False` at a fixed compression level, so two builds are byte-equal.
Images are listed and never measured (T-IMAGE-LOGO).
"""

from __future__ import annotations

import io
import math
import random

from PIL import Image, ImageDraw

from . import plan

#: The names `emit.sheets` inserts and `emit.dxf` writes.
LOGO = "consultant-logo"
SCAN = "hook-detail-scan"

#: Pixel sizes (the IMAGE entity's size in drawing units is the composer's business).
LOGO_PX = (600, 300)
SCAN_PX = (720, 480)

_SEED = plan.RASTER["seed"]


def _png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=False, compress_level=6)
    return buffer.getvalue()


def _logo() -> bytes:
    """The consultant's logo: a drawn mark (a stylised portal frame over a river) plus the name."""
    w, h = LOGO_PX
    img = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([2, 2, w - 3, h - 3], outline=(20, 40, 90), width=4)
    # the mark: two columns, a beam, and three river lines under it
    d.rectangle([40, 60, 70, 210], fill=(20, 40, 90))
    d.rectangle([170, 60, 200, 210], fill=(20, 40, 90))
    d.rectangle([40, 60, 200, 90], fill=(20, 40, 90))
    for i in range(3):
        y = 225 + i * 14
        d.arc([40, y - 10, 200, y + 10], 200, 340, fill=(0, 120, 160), width=4)
    for i in range(6):
        x = 55 + i * 25
        d.line([x, 210, x, 95], fill=(200, 210, 230), width=3)
    d.text((230, 90), "MEGHNA", fill=(20, 40, 90))
    d.text((230, 110), "STRUCTURAL", fill=(20, 40, 90))
    d.text((230, 130), "CONSULTANTS LTD.", fill=(20, 40, 90))
    d.text((230, 170), "BANANI, DHAKA-1213", fill=(90, 90, 90))
    d.line([230, 155, w - 40, 155], fill=(0, 120, 160), width=2)
    return _png(img)


def _scan() -> bytes:
    """The "pasted scanned detail": a greyscale sketch of a 135 degrees hook, photocopied badly —
    illumination gradient, speckle and a fold crease, exactly the noise the F-SCAN lane expects."""
    w, h = SCAN_PX
    img = Image.new("L", (w, h), 235)
    d = ImageDraw.Draw(img)
    # the stirrup: a rectangle with two 135 degrees hooks at the top-right corner
    d.rectangle([160, 120, 520, 360], outline=40, width=6)
    d.line([520, 120, 600, 40], fill=40, width=6)
    d.line([480, 120, 560, 40], fill=40, width=6)
    d.arc([500, 100, 540, 140], 0, 270, fill=40, width=5)
    d.text((150, 380), "135 DEG HOOK, 10d EXTN., MIN 75", fill=30)
    d.text((150, 400), "TYPICAL STIRRUP / TIE  (S-03)", fill=30)
    d.line([160, 100, 520, 100], fill=90, width=2)
    d.text((330, 78), "b - 2c", fill=60)
    px = img.load()
    rng = random.Random(_SEED)
    # illumination gradient + speckle
    for y in range(h):
        for x in range(0, w, 3):
            g = px[x, y]
            lit = int(g - 18 * math.sin(math.pi * x / w) - 10 * (y / h))
            if rng.random() < 0.05:
                lit -= rng.randint(10, 70)
            px[x, y] = max(0, min(255, lit))
    # a fold crease down the middle
    for y in range(h):
        x = int(w * 0.52 + 6 * math.sin(y / 37.0))
        for dx in (-1, 0, 1):
            px[max(0, min(w - 1, x + dx)), y] = max(0, px[x, y] - 45)
    return _png(img)


def author() -> dict[str, bytes]:
    """Every raster the DXF carries, by name (sorted; the writer writes them in this order)."""
    return {LOGO: _logo(), SCAN: _scan()}
