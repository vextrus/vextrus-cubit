"""F-SCAN — S-08 re-issued as a mixed page (R-TO-003, I-392; the generator's W-52).

The committed `scan/s-08.pdf` is read the way the product reads it: pypdfium2 for what the page is, and
the cad lane's own PDF reader for what an ingest makes of it — the captions and the title block as
PDF_OBJECT text, both pastes traced into RASTER_TRACE lines at the dpi their placement states, each
deskewed by the angle the generator skewed it. `scan.golden.json` is re-derived from the committed
`model.json`: the slab on grade's outline less the lift pit and the FDN column plans, at 75 mm, with a
ceiling at +0 % that the page alone (no columns drawn on it) reads over.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

from vextrus_cad import pdf as cad_pdf

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "fixtures" / "rcc6-bnbc"
PAGE = OUT / "scan" / "s-08.pdf"

#: The two views S-08 draws, each a paste on the re-issued page, and their captions as the page prints them.
CAPTIONS = ("GRADE BEAM LAYOUT & GF SLAB ON GRADE SCALE 1:100", "RAMP SECTION SCALE 1:50")
A1_PT = (841.0 * 72.0 / 25.4, 594.0 * 72.0 / 25.4)


def _golden() -> dict:
    return json.loads((OUT / "scan.golden.json").read_text(encoding="utf-8"))


def _manifest_scan() -> dict:
    return json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))["raster"]["scan"]


def _shoelace(ring: list[list[str]]) -> Decimal:
    points = [(Decimal(x), Decimal(y)) for x, y in ring]
    total = sum(
        (points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1]
         for i in range(len(points))),
        Decimal(0),
    )
    return abs(total) / 2


def test_the_page_is_one_a1_sheet_with_two_pastes_and_its_captions_in_vector_text() -> None:
    document = pdfium.PdfDocument(PAGE.read_bytes())
    try:
        assert len(document) == 1
        page = document[0]
        width, height = page.get_size()
        assert (round(width, 2), round(height, 2)) == (round(A1_PT[0], 2), round(A1_PT[1], 2))
        kinds = [obj.type for obj in page.get_objects()]
        assert kinds.count(pdfium_c.FPDF_PAGEOBJ_IMAGE) == 2, "the plan and the ramp section, each pasted"
        texts = page.get_textpage().get_text_bounded()
        flat = re.sub(r"\s+", " ", texts)
        for caption in CAPTIONS:
            assert caption in flat, f"{caption!r} is not vector text on the page"
        assert "S-08" in flat, "the title block's sheet number is not vector text"
    finally:
        document.close()


def test_the_cad_lane_mints_both_schemes_and_recovers_each_pastes_skew() -> None:
    rasters: dict[str, bytes] = {}
    artifact = cad_pdf.ingest_pdf(PAGE, rasters=rasters)
    schemes = {entity["key"].split(":", 1)[0] for entity in artifact["entities"]}
    assert schemes == {"PDF_OBJECT", "RASTER_TRACE"}, schemes
    traced = [e for e in artifact["entities"] if e["key"].startswith("RASTER_TRACE:")]
    assert all(e["type"] == "LINE" for e in traced)
    assert len(traced) > 1000, f"only {len(traced)} traced lines off two 200 dpi pastes"
    texts = {e["text"] for e in artifact["entities"] if e["type"] == "TEXT"}
    for caption in CAPTIONS:
        assert caption in texts, f"{caption!r} is not a PDF_OBJECT text of the ingest"

    records = artifact["rasters"]
    pastes = _manifest_scan()["pastes"]
    assert len(records) == len(pastes) == 2
    assert len(rasters) == 2, "each traced paste's deskewed raster is handed back"
    for record in records:
        assert record["dpi_source"] == "placement"
        assert abs(float(record["dpi"]) - 200.0) < 0.01, record["dpi"]
    authored = sorted(p["skew_deg"] for p in pastes)
    recovered = sorted(float(r["deskew_degrees"]) for r in records)
    for a, r in zip(authored, recovered, strict=True):
        assert 1.2 <= abs(a) <= 1.8
        assert abs(a - r) < 0.1, (authored, recovered)


def test_the_golden_is_the_models_slab_on_grade_outline_less_the_pit_and_the_columns() -> None:
    model = json.loads((OUT / "model.json").read_text(encoding="utf-8"))
    members = {m["id"]: m for m in model["members"]}
    sog, ramp = members["SOG@GF"], members["RAMP@GF"]
    pit = next(h for h in sog["holes"] if h["kind"] == "LIFT_PIT")
    t = Decimal(model["site"]["sog_blinding_thickness_mm"])
    ring, a_pit = Decimal(sog["area"]), Decimal(pit["area"])
    assert abs(_shoelace(sog["poly"]) - ring) < Decimal("1e-9"), "the model's area is its outline's"
    columns = Decimal(sog["col_deduct"]) + Decimal(ramp["col_deduct"])
    figure = (ring - a_pit - columns) * t / Decimal(10) ** 9
    q = Decimal("0.000001")

    golden = _golden()
    item = {"class": "SLAB", "kind": "BLINDING", "level": "GF", "unit": "m3"}
    assert golden["item"] == {**golden["item"], **item}
    assert Decimal(golden["trace"]["ring_mm2"]) == ring
    assert Decimal(golden["trace"]["cutouts"][0]["mm2"]) == a_pit
    assert Decimal(golden["undrawn_on_page"]["mm2"]) == columns
    assert golden["undrawn_on_page"]["meeting_the_ring"] == 25
    assert Decimal(golden["figure"]["m3"]) == figure.quantize(q)
    # s-measure's I-393 hand figure, read off the DXF: the same item, the same number
    assert golden["figure"]["m3"] == "23.755468"
    # not the golden row (RAMP@GF + SOG@GF, the ramp sloped, a net area): the leg traces one ring on plan
    rows = json.loads((OUT / "takeoff.golden.json").read_text(encoding="utf-8"))["rows"]
    row = next(r for r in rows if r["class"] == "SLAB" and r["kind"] == "BLINDING" and r["level"] == "GF")
    assert Decimal(row["quantity"]) != Decimal(golden["figure"]["m3"])


def test_the_band_caps_the_trace_at_the_figure_and_the_page_alone_reads_over_it() -> None:
    golden = _golden()
    figure = Decimal(golden["figure"]["m3"])
    band = golden["band"]
    assert Decimal(band["ceiling_m3"]) == figure and band["ceiling_pct"] == "+0"
    assert Decimal(band["floor_m3"]) < figure
    page_alone = Decimal(golden["figure"]["page_alone_m3"])
    assert page_alone > Decimal(band["ceiling_m3"]), "the page alone, columns undeducted, must read over"
    assert page_alone - figure == Decimal(golden["undrawn_on_page"]["m3"])


def test_the_golden_states_quantities_and_counts_never_a_key() -> None:
    text = (OUT / "scan.golden.json").read_text(encoding="utf-8")
    for scheme in ("PDF_OBJECT:", "RASTER_TRACE:", "DXF_HANDLE:"):
        assert scheme not in text
    assert not re.search(r'"handle"|"key"|[0-9a-f]{64}', text), "a key or a digest in the golden"
    golden = json.loads(text)
    assert golden["sightings"]["offers"] == 1 and golden["sightings"]["basis"] == "INTERPRETED"
    assert golden["corroboration"] == {**golden["corroboration"], "reading": "AGREED", "lines_after": 1}
