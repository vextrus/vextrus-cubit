"""F-SCAN — S-08 re-issued as a mixed page: its drawing a pasted scan, its caption and title block drawn
(R-TO-003, I-392; W-52).

A Dhaka office re-issues an old sheet inside a new title block: the plan comes back from the copier
as a scan and is pasted onto a drafted page, and the page's furniture — border, title strip, view
captions, key plan, north arrow, scale bar — is the CAD station's own vector work. This module mints
that page from the vector S-08 this generator just composed, so nothing here is a second drawing:

  * the body — both of S-08's views, the plan and the ramp section (the pasted detail), each clipped
    to its own window — is painted alone, rendered at `DPI`, cut out window by window and degraded
    the R2 way (skewed about its own centre, lit unevenly, blurred, specked, creased), then pasted back
    centred on its window as a greyscale DCT image at exactly `DPI` on the page;
  * the paper scene is painted on top in TrueType, so the captions and the title block are PDF text
    and the page's view is a layout plan anchored on its caption.

`golden()` states the figure the scan leg's hand trace is judged against (`scan.golden.json`), from
the generator's own model: the slab on grade's outline less the lift pit and the FDN column plans
clipped to it, at the 75 mm blinding, and the band the traced line may not exceed (+0 %).

Determinism: every draw comes from `numpy.random.default_rng([seed, SCAN_VARIANT, sheet index])`,
JPEG at a fixed quality with the raster set's fixed habits, reportlab with `invariant=1`.
"""

from __future__ import annotations

import io
from decimal import Decimal
from typing import Any

import numpy as np
from PIL import Image, ImageFilter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from . import pdf, raster
from .scene import PAPER_MM, Sheet

#: The sheet the scan re-issues, the file it lands in, and the render it is scanned at (R2's 200 dpi).
SHEET = "S-08"
FILE = "scan/s-08.pdf"
DPI = 200
#: The seed stream's variant index: r1..r4 are 1..4 and the bound set is 5.
SCAN_VARIANT = 6
#: The paper the copier caught round each window, in mm (the paste is the window plus this margin).
MARGIN_MM = 2.0
#: Its share of `plan.RASTER["budget_mb"]["rasters_total"]`, in MiB, and what it tries in order:
#: (dpi factor, JPEG quality) — quality gives way before resolution, as the raster set's ladders do.
SHARE_MB = 3.5
LADDER: tuple[tuple[float, int], ...] = ((1.0, 70), (1.0, 55), (1.0, 45), (0.8, 50), (0.75, 45))

#: What a reader loses on this page (sanity.json["raster"]["scan"]).
LOSSES = [
    "PLAN_BODY_RASTER_ONLY",
    "SKEW_1_2_TO_1_8_DEG_PER_PASTE",
    "DCT_ARTEFACTS_ON_HAIRLINES",
    "FOLD_CREASE_BAND",
    "NO_TEXT_LAYER_INSIDE_THE_PASTE",
]

MM2_PER_M2 = Decimal(1_000_000)
MM_PER_M = Decimal(1000)


# ---------------------------------------------------------------------------------------------
# The page
# ---------------------------------------------------------------------------------------------


def _body_pdf(sheet: Sheet, blocks: Any, images: Any) -> bytes:
    """The sheet's views alone, each clipped to its window, on a blank page of the sheet's paper."""
    pdf.register_fonts()
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer, pagesize=pdf.page_size_pt(sheet.size), invariant=1, pageCompression=1)
    painter = pdf.Painter(document, pdf._as_blocks(blocks), pdf._as_images(images), "ttf")
    document.setStrokeGray(0.0)
    document.setFillGray(0.0)
    for view in sheet.views:
        document.saveState()
        window = document.beginPath()
        window.rect(
            view.paper_at[0] * pdf.PT_PER_MM,
            view.paper_at[1] * pdf.PT_PER_MM,
            view.paper_size[0] * pdf.PT_PER_MM,
            view.paper_size[1] * pdf.PT_PER_MM,
        )
        document.clipPath(window, stroke=0, fill=0)
        painter.scene(view.scene, pdf.view_xf(view), view.unit)
        document.restoreState()
    document.showPage()
    document.save()
    return buffer.getvalue()


def _cut(page: Image.Image, at: tuple[float, float], size: tuple[float, float], paper_h: float, dpi: int) -> Image.Image:
    """The window plus its margin, cut from a page rendered top-down at `dpi`."""
    k = dpi / 25.4
    x0, y0 = at[0] - MARGIN_MM, at[1] - MARGIN_MM
    x1, y1 = at[0] + size[0] + MARGIN_MM, at[1] + size[1] + MARGIN_MM
    box = (round(x0 * k), round((paper_h - y1) * k), round(x1 * k), round((paper_h - y0) * k))
    return page.crop(box)


def _degrade(cut: Image.Image, rng: np.random.Generator, quality: int) -> tuple[bytes, float, tuple[int, int]]:
    """R2's copier pass over one paste: skewed about its centre (the canvas grows to hold it all),
    lit unevenly, blurred, specked and creased — never stamped, signed or punched, which belong to a
    whole sheet on the platen, not to a cutting."""
    skew = float(rng.uniform(1.2, 1.8)) * (1.0 if rng.integers(0, 2) else -1.0)
    image = cut.rotate(skew, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=255)
    image = Image.fromarray(raster._illumination(np.asarray(image).copy(), rng), mode="L")
    image = image.filter(ImageFilter.GaussianBlur(radius=0.6))
    image = Image.fromarray(raster._speckle(np.asarray(image).copy(), rng, 0.0006), mode="L")
    image = raster._crease(image, rng)
    return raster._jpeg(image, quality), skew, image.size


def _compose(sheet: Sheet, blocks: Any, images: Any, pastes: list[dict[str, Any]], dpi: int) -> bytes:
    """The mixed page: each paste at `dpi`, centred on its window, then the paper scene in TrueType."""
    pdf.register_fonts()
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer, pagesize=pdf.page_size_pt(sheet.size), invariant=1, pageCompression=1)
    document.setTitle(f"{sheet.number} {sheet.title} (RE-ISSUED, SCANNED PLAN)")
    document.setAuthor(pdf.AUTHOR)
    document.setSubject(f"{pdf.SUBJECT} F-SCAN")
    document.setCreator(pdf.CREATOR)
    document.setProducer(pdf.CREATOR)
    for paste in pastes:
        w_pt = paste["px"][0] * 72.0 / dpi
        h_pt = paste["px"][1] * 72.0 / dpi
        cx, cy = paste["centre_mm"]
        document.drawImage(
            ImageReader(io.BytesIO(paste["jpeg"])),
            cx * pdf.PT_PER_MM - w_pt / 2.0,
            cy * pdf.PT_PER_MM - h_pt / 2.0,
            width=w_pt,
            height=h_pt,
        )
    painter = pdf.Painter(document, pdf._as_blocks(blocks), pdf._as_images(images), "ttf")
    document.setStrokeGray(0.0)
    document.setFillGray(0.0)
    painter.scene(sheet.paper, pdf.paper_xf(), "mm")
    document.showPage()
    document.save()
    return buffer.getvalue()


def page(sheets: list[Sheet], blocks: Any, images: Any) -> tuple[dict[str, bytes], dict[str, Any]]:
    """`scan/s-08.pdf` and the report of what was pasted, at which dpi and quality, for the manifest."""
    index = next(i for i, sheet in enumerate(sheets) if sheet.number == SHEET)
    sheet = sheets[index]
    body = _body_pdf(sheet, blocks, images)
    paper_h = PAPER_MM[sheet.size][1]
    payload, pastes, used, quality = b"", [], DPI, 0
    for step, quality in LADDER:
        used = max(72, int(DPI * step))
        rendered = raster.render(body, 0, used)
        rng = raster._rng(SCAN_VARIANT, index)
        pastes = []
        for view in sheet.views:
            cut = _cut(rendered, view.paper_at, view.paper_size, paper_h, used)
            jpeg, skew, px = _degrade(cut, rng, quality)
            centre = (
                view.paper_at[0] + view.paper_size[0] / 2.0,
                view.paper_at[1] + view.paper_size[1] / 2.0,
            )
            pastes.append({"view": view.title, "scale": view.scale, "jpeg": jpeg, "skew": skew, "px": px,
                           "centre_mm": centre})
        payload = _compose(sheet, blocks, images, pastes, used)
        if len(payload) <= SHARE_MB * raster.MB:
            break
    report = {
        "file": FILE,
        "sheet": SHEET,
        "dpi": used,
        "planned_dpi": DPI,
        "format": f"JPEG q{quality} pasted into a vector page",
        "bytes": len(payload),
        "share_mb": SHARE_MB,
        "pastes": [
            {
                "view": p["view"],
                "scale": p["scale"],
                "skew_deg": round(p["skew"], 6),
                "px": list(p["px"]),
                "centre_mm": [round(c, 3) for c in p["centre_mm"]],
            }
            for p in pastes
        ],
        "vector": "border, title strip, view captions, key plan, north arrow, scale bar (TrueType)",
        "losses": LOSSES,
    }
    return {FILE: payload}, report


# ---------------------------------------------------------------------------------------------
# The golden: what the scan leg traces, from the model
# ---------------------------------------------------------------------------------------------


def _area(ring: list[tuple[Decimal, Decimal]]) -> Decimal:
    total = Decimal(0)
    for i, (x0, y0) in enumerate(ring):
        x1, y1 = ring[(i + 1) % len(ring)]
        total += x0 * y1 - x1 * y0
    return abs(total) / 2


def _clip(subject: list[tuple[Decimal, Decimal]], clipper: list[tuple[Decimal, Decimal]]) -> list[tuple[Decimal, Decimal]]:
    """Sutherland–Hodgman: `subject` clipped to the convex `clipper` (counter-clockwise), in Decimal."""

    def inside(p: tuple[Decimal, Decimal], a: tuple[Decimal, Decimal], b: tuple[Decimal, Decimal]) -> bool:
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0

    def cross(
        p: tuple[Decimal, Decimal], q: tuple[Decimal, Decimal], a: tuple[Decimal, Decimal], b: tuple[Decimal, Decimal]
    ) -> tuple[Decimal, Decimal]:
        dx, dy = q[0] - p[0], q[1] - p[1]
        ex, ey = b[0] - a[0], b[1] - a[1]
        t = (ex * (p[1] - a[1]) - ey * (p[0] - a[0])) / (ey * dx - ex * dy)
        return (p[0] + t * dx, p[1] + t * dy)

    out = list(subject)
    for i, a in enumerate(clipper):
        b = clipper[(i + 1) % len(clipper)]
        if not out:
            break
        given, out = out, []
        for j, p in enumerate(given):
            q = given[(j + 1) % len(given)]
            if inside(q, a, b):
                if not inside(p, a, b):
                    out.append(cross(p, q, a, b))
                out.append(q)
            elif inside(p, a, b):
                out.append(cross(p, q, a, b))
    return out


def _ccw(ring: list[tuple[Decimal, Decimal]]) -> list[tuple[Decimal, Decimal]]:
    signed = sum(
        (ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring))),
        Decimal(0),
    )
    return ring if signed > 0 else list(reversed(ring))


def _m3(mm3: Decimal) -> Decimal:
    return mm3 / (MM2_PER_M2 * MM_PER_M)


def _plain(d: Decimal) -> str:
    """A Decimal in positional notation without trailing zeros (4051875.000… → 4051875)."""
    text = format(d, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def golden(world: dict[str, Any]) -> dict[str, Any]:
    """`scan.golden.json`: quantities and counts only, never a key.

    The ring the leg traces is the slab on grade's outline (the SOG panel's `poly`, the POLYLINE S-08
    draws, on which Rev C's five blinding LINEs close), with the lift pit — drawn on the page — cut
    out of it. The FDN columns stand through the 75 mm course (L-MEA-09, I-389) but are drawn on
    S-10, not on this page: their plans clipped to the ring's net region are the deduction the page
    alone does not show. The figure is the ring less both, the ramp's blinding taken on plan. The
    band's ceiling is that figure at +0 %: the page alone, traced without the columns, reads over it,
    and that is over-measurement — a hard block, never a disclosure."""
    members = world["members"]
    sog = next(m for m in members if m["id"] == "SOG@GF")
    ramp = next(m for m in members if m["id"] == "RAMP@GF")
    ring = _ccw([(Decimal(x), Decimal(y)) for x, y in sog["poly"]])
    pit_hole = next(h for h in sog["holes"] if h["kind"] == "LIFT_PIT")
    pit = _ccw([(Decimal(x), Decimal(y)) for x, y in pit_hole["poly"]])
    t = Decimal(world["site"]["sog_blinding_thickness_mm"])

    a_ring, a_pit = _area(ring), _area(pit)
    assert a_ring == Decimal(sog["area"]), (a_ring, sog["area"])
    assert a_pit == Decimal(pit_hole["area"]), (a_pit, pit_hole["area"])

    columns = sorted(
        (m for m in members if m["class"] == "COLUMN" and m["level"] == "FDN"), key=lambda m: m["id"]
    )
    meeting, straddling, clipped_total = 0, 0, Decimal(0)
    for c in columns:
        cx, cy, hx, hy = Decimal(c["cx"]), Decimal(c["cy"]), Decimal(c["sx"]) / 2, Decimal(c["sy"]) / 2
        if c["geom"] == "CYL":
            # the porch column (C7) stands clear of the slab: its circle misses the ring's box
            r = hx
            xs, ys = [p[0] for p in ring], [p[1] for p in ring]
            assert cx + r < min(xs) or cx - r > max(xs) or cy + r < min(ys) or cy - r > max(ys), c["id"]
            continue
        if c.get("rot"):
            # the skewed bay's column (C6X, 45°) along the chamfer: whole inside the ring, clear of the
            # pit, so its whole plan is deducted; one that straddled would need the exact clip
            k = Decimal(2).sqrt() / 2
            assert int(c["rot"]) == 45, c["id"]
            corners = [(cx + (sx * hx - sy * hy) * k, cy + (sx * hx + sy * hy) * k)
                       for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            assert _clip(corners, ring) and _area(_clip(corners, ring)) > _area(corners) - Decimal("1e-9"), c["id"]
            assert not _clip(corners, pit), c["id"]
            meeting += 1
            clipped_total += Decimal(c["sx"]) * Decimal(c["sy"])
            continue
        rect = [(cx - hx, cy - hy), (cx + hx, cy - hy), (cx + hx, cy + hy), (cx - hx, cy + hy)]
        on_ring = _clip(rect, ring)
        a_on_ring = _area(on_ring) if len(on_ring) >= 3 else Decimal(0)
        in_pit = _clip(on_ring, pit) if len(on_ring) >= 3 else []
        a_net = a_on_ring - (_area(in_pit) if len(in_pit) >= 3 else Decimal(0))
        if a_net > 0:
            meeting += 1
            clipped_total += a_net
            if a_net < _area(rect):
                straddling += 1
    # the independent clip agrees with the model's own deduction under the two GF panels (K21)
    model_deduct = Decimal(sog["col_deduct"]) + Decimal(ramp["col_deduct"])
    assert clipped_total == model_deduct, (clipped_total, model_deduct)

    traced = a_ring - a_pit
    net = traced - clipped_total
    figure = _m3(net * t)
    page_alone = _m3(traced * t)
    q = Decimal("0.000001")
    return {
        "fixture": "F-SCAN",
        "derives_from": "F-RCC6-BNBC",
        "schema": 1,
        "provenance": "HAND_FROM_AUTHORED_SOURCE",
        "file": FILE,
        "page": {
            "sheet": SHEET,
            "pages": 1,
            "size": "A1",
            "dpi": DPI,
            "pastes": 2,
            "views": [
                {"title": "GRADE BEAM LAYOUT & GF SLAB ON GRADE", "scale": 100, "type": "LAYOUT_PLAN", "level": "GF"},
                {"title": "RAMP SECTION", "scale": 50, "type": "SECTION"},
            ],
            "schemes": ["PDF_OBJECT", "RASTER_TRACE"],
            "grid_axes": {"letters": 5, "numerals": 6},
        },
        "item": {
            "class": "SLAB",
            "kind": "BLINDING",
            "component": "CC",
            "level": "GF",
            "member": "SOG@GF",
            "unit": "m3",
            "thickness_mm": _plain(t),
            "thickness_source": "the page's note: 75 THK BLINDING UNDER SLAB ON GRADE & RAMP",
        },
        "trace": {
            "ring_vertices": len(ring),
            "ring_mm2": _plain(a_ring),
            "cutouts": [{"what": "LIFT_PIT", "vertices": len(pit), "mm2": _plain(a_pit)}],
            "traced_net_mm2": _plain(traced),
            "ramp": "on plan (the 1:8 slope is not taken)",
        },
        "undrawn_on_page": {
            "what": "FDN column plans clipped to the ring's net region (L-MEA-09; I-389)",
            "drawn_on": "S-10",
            "columns": len(columns),
            "meeting_the_ring": meeting,
            "straddling_the_edge": straddling,
            "mm2": _plain(clipped_total),
            "m3": str(_m3(clipped_total * t).quantize(q)),
        },
        "figure": {
            "m3": str(figure.quantize(q)),
            "exact_m3": _plain(figure),
            "formula": "(ring - lift pit - FDN column plans clipped to the ring) x 0.075",
            "page_alone_m3": str(page_alone.quantize(q)),
            "page_alone_over_by_m3": str((page_alone - figure).quantize(q)),
        },
        "band": {
            "ceiling_m3": str(figure.quantize(q)),
            "ceiling_pct": "+0",
            "floor_m3": str((figure * Decimal("0.97")).quantize(q)),
            "floor_pct": "-3",
            "over_the_ceiling": "over-measurement: a hard block (L-QTY-04)",
        },
        "sightings": {
            "offers": 1,
            "basis": "INTERPRETED",
            "engine": "RASTER",
            "queued_as": "INTERPRETED_UNCORROBORATED",
            "lines_before_corroboration": 0,
        },
        "corroboration": {
            "act": "CORROBORATE",
            "reading": "AGREED",
            "resolutions": 1,
            "lines_after": 1,
            "line_basis": "INTERPRETED",
            "line_engine": "RASTER",
            "carries": ["vectoriser id", "vectoriser version", "render dpi"],
            "disagreeing_reading": "stays queued; no line",
        },
    }
