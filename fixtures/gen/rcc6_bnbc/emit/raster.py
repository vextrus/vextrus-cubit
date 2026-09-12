"""The raster set — what happens to a drawing between the consultant's plotter and the estimator's
desk (E-fixture §3.8, W-02). Every variant is derived from the vector PDF this generator just
painted, so nothing here is a second drawing: it is the same drawing, degraded on purpose.

  R1  a clean 300 dpi greyscale PNG — the render a good scanner would give back.
  R2  a 200 dpi scan: skewed, lit unevenly, blurred, specked, stamped APPROVED over a schedule
      cell, signed, creased along a fold and punched twice on the binding edge — plus ONE DCT
      raster PDF carrying the WHOLE set, which is the file a site office actually forwards.
  R3  a 150 dpi photocopy: binarised, its strokes dilated then eroded, halftone-specked and
      cropped into the title block — the variant that loses thin hatch and hairline text.
  R4  a 150 dpi phone photograph: keystoned, vignetted, warm-cast and soft.

Determinism (FOUNDER'S LAW 5): every random draw comes from `numpy.random.default_rng([seed,
variant, sheet])` with `plan.RASTER["seed"]`, PNG is written unoptimised and JPEG at a fixed
quality and subsampling, so two builds hand back the same bytes. Nothing reads a clock.

Budget (FOUNDER'S LAW 4, W-02): each variant has a share of `plan.RASTER["budget_mb"]`. A variant
that does not fit at its planned dpi is re-rendered down the dpi ladder — never with fewer sheets —
and `variants()` reports the dpi it actually used so the manifest can record it.
"""

from __future__ import annotations

import io
import math
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from . import hershey, pdf, plan
from .scene import PAPER_MM, Sheet

MB = 1024 * 1024

#: Each variant's share of `plan.RASTER["budget_mb"]["rasters_total"]` (25 MB), in megabytes.
SHARE_MB = {"r1": 5.0, "r2": 6.0, "r2pdf": 8.0, "r3": 3.0, "r4": 3.0}

#: The bound set is 26 pages, not six, so it is scanned more gently and at its own dpi (W-02:
#: a variant that will not fit drops dpi, and the manifest records the dpi actually used).
BOUND_DPI = 150
BOUND_QUALITY = 50

#: What a variant tries, in order, until its share holds it: (dpi factor, JPEG quality). Quality
#: gives way before resolution does — a soft scan at 150 dpi reads better than a crisp one at 90.
LADDERS: dict[str, tuple[tuple[float, int], ...]] = {
    "r1": ((1.0, 0), (0.8, 0), (0.66, 0), (0.5, 0)),
    "r2": ((1.0, 70), (1.0, 55), (0.8, 60), (0.75, 50), (0.6, 50)),
    "r3": ((1.0, 60), (1.0, 45), (0.8, 55), (0.66, 50)),
    "r4": ((1.0, 60), (1.0, 45), (0.8, 55), (0.66, 50)),
    "r2pdf": ((1.0, 50), (1.0, 38), (1.0, 30), (0.8, 34), (0.66, 32), (0.5, 32)),
}

#: Fixed JPEG habits — quality, 4:2:0 subsampling, no progressive pass, no optimisation.
JPEG_KW = {"optimize": False, "progressive": False, "subsampling": 2}

#: What a reader loses in each variant (sanity.json["raster"], for the cad lane's expectations).
LOSSES = {
    "r1": [],
    "r2": [
        "SKEW_1_2_TO_1_8_DEG",
        "STAMP_OVER_SCHEDULE_CELLS",
        "SIGNATURE_OVER_TITLE_BLOCK",
        "PUNCH_HOLES_OVER_BINDING_MARGIN",
        "FOLD_CREASE_BAND",
    ],
    "r2pdf": ["NO_TEXT_LAYER", "DCT_ARTEFACTS_ON_HAIRLINES", "WHOLE_SET_AT_ONE_DPI"],
    "r3": [
        "THIN_HATCH_MERGED",
        "HAIRLINE_TEXT_BROKEN",
        "TITLE_BLOCK_EDGE_CROPPED",
        "GREY_FILL_BINARISED",
    ],
    "r4": [
        "KEYSTONE_PERSPECTIVE",
        "VIGNETTED_CORNERS",
        "WARM_COLOUR_CAST",
        "STAMP_AREA_BLURRED",
        "SHEET_EDGES_CLIPPED",
    ],
}


# ---------------------------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------------------------


def render(pdf_bytes: bytes, sheet_index: int, dpi: int) -> Image.Image:
    """One page of the vector PDF as a greyscale image at `dpi`."""
    import pypdfium2 as pdfium

    document = pdfium.PdfDocument(pdf_bytes)
    try:
        page = document[sheet_index]
        image = page.render(scale=dpi / 72.0, grayscale=True).to_pil().convert("L")
        page.close()
    finally:
        document.close()
    return image


def _rng(variant_index: int, sheet_index: int) -> np.random.Generator:
    return np.random.default_rng([int(plan.RASTER["seed"]), variant_index, sheet_index])


def _jpeg(image: Image.Image, quality: int) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality, **JPEG_KW)
    return buffer.getvalue()


def _png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=False, compress_level=6)
    return buffer.getvalue()


# ---------------------------------------------------------------------------------------------
# The degradations
# ---------------------------------------------------------------------------------------------


def _speckle(pixels: np.ndarray, rng: np.random.Generator, fraction: float) -> np.ndarray:
    count = int(pixels.size * fraction)
    if count <= 0:
        return pixels
    where = rng.choice(pixels.size, size=count, replace=False)
    flat = pixels.reshape(-1)
    half = count // 2
    flat[where[:half]] = rng.integers(0, 70, size=half, dtype=np.uint8)
    flat[where[half:]] = rng.integers(200, 256, size=count - half, dtype=np.uint8)
    return flat.reshape(pixels.shape)


def _illumination(pixels: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """A lamp that is not square to the platen: a smooth corner-to-corner falloff."""
    h, w = pixels.shape
    ax, ay = rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)
    xs = np.linspace(-1.0, 1.0, w, dtype=np.float32)
    ys = np.linspace(-1.0, 1.0, h, dtype=np.float32)
    field = 1.0 - 0.18 * ((xs[None, :] * ax + ys[:, None] * ay) + 1.0) / 2.0 - 0.06 * (
        xs[None, :] ** 2 + ys[:, None] ** 2
    )
    return np.clip(pixels.astype(np.float32) * field, 0, 255).astype(np.uint8)


def _crease(image: Image.Image, rng: np.random.Generator) -> Image.Image:
    """A fold: one soft dark band with a lighter lip, across the middle third."""
    w = image.size[0]
    x = int(w * rng.uniform(0.42, 0.58))
    band = max(3, w // 400)
    pixels = np.asarray(image).astype(np.float32)
    for offset, factor in ((-band, 1.06), (0, 0.82), (band, 1.04)):
        lo, hi = max(0, x + offset - band // 2), min(w, x + offset + band // 2 + 1)
        pixels[:, lo:hi] *= factor
    return Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), mode="L")


def _punch_holes(image: Image.Image, dpi: int) -> Image.Image:
    """Two 6 mm holes 80 mm apart on the binding edge, as a copier sees them: black."""
    draw = ImageDraw.Draw(image)
    h = image.size[1]
    r = 3.0 * dpi / 25.4
    x = 12.0 * dpi / 25.4
    for y in (h / 2 - 40.0 * dpi / 25.4, h / 2 + 40.0 * dpi / 25.4):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=25, outline=0)
    return image


def _strokes_on(
    draw: ImageDraw.ImageDraw,
    text: str,
    at: tuple[float, float],
    height: float,
    fill: int,
    width: int,
    rotation_deg: float = 0.0,
) -> None:
    """Stamp text drawn with the Hershey pen — the generator owns no bitmap font (W-03)."""
    k = height / hershey.CAP
    radians = math.radians(rotation_deg)
    for stroke in hershey.text_strokes(text):
        points = []
        for x, y in stroke:
            sx, sy = x * k, y * k
            points.append(
                (
                    at[0] + sx * math.cos(radians) - sy * math.sin(radians),
                    at[1] - (sx * math.sin(radians) + sy * math.cos(radians)),
                )
            )
        draw.line(points, fill=fill, width=width)


def _stamp(image: Image.Image, rng: np.random.Generator, dpi: int) -> Image.Image:
    """The consultant's round APPROVED stamp, over a schedule cell in the sheet's upper right."""
    draw = ImageDraw.Draw(image)
    w, h = image.size
    px = dpi / 25.4
    r = 26.0 * px
    cx = w - rng.uniform(150.0, 200.0) * px
    cy = h * rng.uniform(0.30, 0.45)
    ink = 70
    pen = max(2, int(px * 0.6))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ink, width=pen)
    draw.ellipse([cx - r * 0.86, cy - r * 0.86, cx + r * 0.86, cy + r * 0.86], outline=ink, width=max(1, pen // 2))
    _strokes_on(draw, "APPROVED", (cx - 21.0 * px, cy + 3.0 * px), 7.0 * px, ink, pen)
    _strokes_on(draw, "FOR CONSTRUCTION", (cx - 22.0 * px, cy + 12.0 * px), 3.4 * px, ink, max(1, pen // 2))
    _strokes_on(draw, "MSC LTD.", (cx - 12.0 * px, cy - 8.0 * px), 4.0 * px, ink, max(1, pen // 2))
    return image


def _signature(image: Image.Image, rng: np.random.Generator, dpi: int) -> Image.Image:
    """A seeded random walk across the title block's signature line."""
    draw = ImageDraw.Draw(image)
    w, h = image.size
    px = dpi / 25.4
    x, y = w - 120.0 * px, h - 28.0 * px
    points = [(x, y)]
    for _ in range(26):
        x += rng.uniform(1.0, 4.0) * px
        y += rng.uniform(-3.2, 3.2) * px
        points.append((x, y))
    draw.line(points, fill=40, width=max(2, int(px * 0.7)), joint="curve")
    return image


def _keystone(image: Image.Image, rng: np.random.Generator) -> Image.Image:
    """The perspective a phone held over a desk puts on a sheet: the page lands on the photo as a
    trapezoid whose top edge is narrower than its bottom (the far edge is further away), with a
    small tilt. The full page stays in frame, so the keystone is measurable row by row."""
    w, h = image.size
    top_inset = rng.uniform(0.07, 0.11)  # each top corner, as a share of the width
    bottom_inset = rng.uniform(0.005, 0.02)
    tilt = rng.uniform(-0.015, 0.015)  # a little in-plane lean on top of the keystone
    top_y, bottom_y = rng.uniform(0.02, 0.04), rng.uniform(0.96, 0.985)
    # where each page corner lands on the output (tl, tr, br, bl)
    target = [
        (w * (top_inset + tilt), h * top_y),
        (w * (1 - top_inset + tilt), h * (top_y + 0.01)),
        (w * (1 - bottom_inset - tilt), h * bottom_y),
        (w * (bottom_inset - tilt), h * (bottom_y - 0.008)),
    ]
    source = [(0.0, 0.0), (float(w), 0.0), (float(w), float(h)), (0.0, float(h))]
    # PIL's PERSPECTIVE maps an output pixel to the input it samples: solve output → input
    matrix = []
    for (tx, ty), (sx, sy) in zip(target, source, strict=True):
        matrix.append([tx, ty, 1.0, 0.0, 0.0, 0.0, -sx * tx, -sx * ty])
        matrix.append([0.0, 0.0, 0.0, tx, ty, 1.0, -sy * tx, -sy * ty])
    coefficients = np.linalg.solve(np.array(matrix, dtype=np.float64), np.array(source).reshape(8))
    return image.transform(
        (w, h), Image.Transform.PERSPECTIVE, tuple(coefficients), Image.Resampling.BICUBIC, fillcolor=(236, 232, 224)
    )


def _vignette_and_cast(image: Image.Image, rng: np.random.Generator) -> Image.Image:
    pixels = np.asarray(image).astype(np.float32)
    h, w = pixels.shape[:2]
    xs = np.linspace(-1.0, 1.0, w, dtype=np.float32)
    ys = np.linspace(-1.0, 1.0, h, dtype=np.float32)
    radius = np.sqrt(xs[None, :] ** 2 + ys[:, None] ** 2)
    fall = np.clip(1.0 - 0.42 * radius**2.2, 0.35, 1.0)[:, :, None]
    warm = np.array([1.0, 0.965, 0.895], dtype=np.float32) * float(rng.uniform(0.95, 1.0))
    return Image.fromarray(np.clip(pixels * fall * warm, 0, 255).astype(np.uint8), mode="RGB")


# ---------------------------------------------------------------------------------------------
# The four variants
# ---------------------------------------------------------------------------------------------


def r1(page: Image.Image) -> bytes:
    return _png(page)


def r2(page: Image.Image, rng: np.random.Generator, dpi: int, quality: int) -> bytes:
    skew = float(rng.uniform(1.2, 1.8)) * (1.0 if rng.integers(0, 2) else -1.0)
    image = page.rotate(skew, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=255)
    image = Image.fromarray(_illumination(np.asarray(image).copy(), rng), mode="L")
    image = image.filter(ImageFilter.GaussianBlur(radius=0.6))
    image = Image.fromarray(_speckle(np.asarray(image).copy(), rng, 0.0006), mode="L")
    image = _crease(image, rng)
    image = _stamp(image, rng, dpi)
    image = _signature(image, rng, dpi)
    image = _punch_holes(image, dpi)
    return _jpeg(image, quality)


def r2_bound(page: Image.Image, rng: np.random.Generator, dpi: int, quality: int, stamped: bool) -> bytes:
    """The same platen, one pass, no second handling: what a whole set looks like scanned at once."""
    skew = float(rng.uniform(1.2, 1.8)) * (1.0 if rng.integers(0, 2) else -1.0)
    image = page.rotate(skew, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=255)
    image = Image.fromarray(_illumination(np.asarray(image).copy(), rng), mode="L")
    image = image.filter(ImageFilter.GaussianBlur(radius=0.5))
    image = _punch_holes(image, dpi)
    if stamped:
        image = _stamp(image, rng, dpi)
    return _jpeg(image, quality)


def r3(page: Image.Image, rng: np.random.Generator, dpi: int, quality: int) -> bytes:
    pixels = np.asarray(page)
    binarised = Image.fromarray(np.where(pixels < 176, 0, 255).astype(np.uint8), mode="L")
    thickened = binarised.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    speckled = Image.fromarray(_speckle(np.asarray(thickened).copy(), rng, 0.0022), mode="L")
    w, h = speckled.size
    crop_mm = float(rng.uniform(8.0, 15.0))
    cut = int(crop_mm * dpi / 25.4)
    cropped = speckled.crop((0, 0, w - cut, h - cut))
    return _jpeg(cropped, quality)


def r4(page: Image.Image, rng: np.random.Generator, quality: int) -> bytes:
    image = _keystone(page.convert("RGB"), rng)
    image = _vignette_and_cast(image, rng)
    image = image.filter(ImageFilter.GaussianBlur(radius=0.8))
    return _jpeg(image, quality)


# ---------------------------------------------------------------------------------------------
# The set
# ---------------------------------------------------------------------------------------------


def _subset_indices(sheets: list[Sheet]) -> list[int]:
    numbers = [sheet.number for sheet in sheets]
    return [numbers.index(number) for number in plan.RASTER["subset"] if number in numbers]


def _pages(pdf_bytes: bytes, indices: list[int], dpi: int) -> dict[int, Image.Image]:
    import pypdfium2 as pdfium

    document = pdfium.PdfDocument(pdf_bytes)
    out: dict[int, Image.Image] = {}
    try:
        for index in indices:
            page = document[index]
            out[index] = page.render(scale=dpi / 72.0, grayscale=True).to_pil().convert("L")
            page.close()
    finally:
        document.close()
    return out


def _raster_pdf(jpegs: list[tuple[Sheet, bytes]], dpi: int) -> bytes:
    """The whole set as one DCT-only PDF: every page an image at its own paper size."""
    first = pdf.page_size_pt(jpegs[0][0].size)
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer, pagesize=first, invariant=1, pageCompression=1)
    document.setTitle(f"{pdf.SUBJECT} SCANNED SET ({dpi} dpi)")
    document.setAuthor(pdf.AUTHOR)
    document.setSubject(pdf.SUBJECT)
    document.setCreator(pdf.CREATOR)
    document.setProducer(pdf.CREATOR)
    for sheet, payload in jpegs:
        width, height = pdf.page_size_pt(sheet.size)
        document.setPageSize((width, height))
        document.drawImage(ImageReader(io.BytesIO(payload)), 0, 0, width=width, height=height)
        document.showPage()
    document.save()
    return buffer.getvalue()


def _fits(payloads: list[bytes], share_mb: float) -> bool:
    return sum(len(p) for p in payloads) <= share_mb * MB and all(
        len(p) <= float(plan.RASTER["budget_mb"]["single_file"]) * MB for p in payloads
    )


def variants(ttf_pdf_bytes: bytes, sheets: list[Sheet]) -> tuple[dict[str, bytes], dict[str, Any]]:
    """Every raster file the corpus carries, keyed by its path under `fixtures/rcc6-bnbc/`, and
    the report of what was actually rendered — dpi, quality, losses — for the manifest."""
    indices = _subset_indices(sheets)
    whole = list(range(len(sheets)))
    rendered: dict[int, dict[int, Image.Image]] = {}

    def pages_at(dpi: int, wanted: list[int]) -> dict[int, Image.Image]:
        have = rendered.setdefault(dpi, {})
        missing = [index for index in wanted if index not in have]
        if missing:
            have.update(_pages(ttf_pdf_bytes, missing, dpi))
        return have

    files: dict[str, bytes] = {}
    report: dict[str, Any] = {"seed": int(plan.RASTER["seed"]), "subset": list(plan.RASTER["subset"])}

    for key, variant_index, planned in (
        ("r1", 1, int(plan.RASTER["R1"]["dpi"])),
        ("r2", 2, int(plan.RASTER["R2"]["dpi"])),
        ("r3", 3, int(plan.RASTER["R3"]["dpi"])),
        ("r4", 4, int(plan.RASTER["R4"]["dpi"])),
    ):
        made: dict[str, bytes] = {}
        used, quality = planned, 0
        for step, quality in LADDERS[key]:
            used = max(72, int(planned * step))
            pages = pages_at(used, indices)
            made = {}
            for index in indices:
                sheet, rng, page = sheets[index], _rng(variant_index, index), pages[index]
                if key == "r1":
                    made[f"raster/r1/{sheet.slug}.png"] = r1(page)
                elif key == "r2":
                    made[f"raster/r2/{sheet.slug}.jpg"] = r2(page, rng, used, quality)
                elif key == "r3":
                    made[f"raster/r3/{sheet.slug}.jpg"] = r3(page, rng, used, quality)
                else:
                    made[f"raster/r4/{sheet.slug}.jpg"] = r4(page, rng, quality)
            if _fits(list(made.values()), SHARE_MB[key]):
                break
        files.update(made)
        report[key] = {
            "dpi": used,
            "planned_dpi": planned,
            "format": "PNG" if key == "r1" else f"JPEG q{quality}",
            "bytes": sum(len(p) for p in made.values()),
            "files": sorted(made),
            "losses": LOSSES[key],
        }

    # R2 again, this time the whole set bound as one DCT raster PDF (the file a site office sends).
    used, quality, payload = BOUND_DPI, BOUND_QUALITY, b""
    for step, quality in LADDERS["r2pdf"]:
        used = max(72, int(BOUND_DPI * step))
        pages = pages_at(used, whole)
        bound = [
            (sheet, r2_bound(pages[index], _rng(5, index), used, quality, index in indices))
            for index, sheet in enumerate(sheets)
        ]
        payload = _raster_pdf(bound, used)
        if _fits([payload], SHARE_MB["r2pdf"]):
            break
    files["rcc6-bnbc.r2.pdf"] = payload
    report["r2pdf"] = {
        "dpi": used,
        "planned_dpi": BOUND_DPI,
        "format": f"JPEG q{quality} in PDF",
        "pages": len(sheets),
        "bytes": len(payload),
        "losses": LOSSES["r2pdf"],
    }
    report["total_bytes"] = sum(len(p) for p in files.values())
    report["budget_mb"] = dict(plan.RASTER["budget_mb"])
    report["share_mb"] = dict(SHARE_MB)
    return files, report


def paper_pixels(sheet: Sheet, dpi: int) -> tuple[int, int]:
    """The pixel size a sheet renders to — the sanity check a budget argument starts from."""
    w, h = PAPER_MM[sheet.size]
    return (round(w * dpi / 25.4), round(h * dpi / 25.4))
