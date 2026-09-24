"""The vector-PDF lane (R-TO-002, L-CAD-02, L-CAD-03, L-CAD-04).

Two drawings are read. `forms.pdf` is the lane's own fixture, written object by object by
`fixtures/gen_forms_pdf.py` so every case a plotted set carries is present and named: Form XObjects
(placed plain, turned, scaled, mirrored, nested), Béziers, several subpaths in one path, optional
content, a turned page, an image, and three collisions. `rcc6-bnbc.pdf` is F-RCC6-BNBC's vector
set — 27 pages the TypeScript sheet index turns into cards — and it is read against an independent
count of its own page objects: every object is an entity or a named collapse, and none is lost.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import re
import shutil
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
import pytest

from corpus import FIXTURE_DIR, REPO_ROOT, artifact_path, pdf_artifact_names, pdf_path
from vextrus_cad import EntityGraphError, dumps, ingest_pdf, parse_entity_graph, pdf, report
from vextrus_cad.cli import EXIT_REFUSED, main
from vextrus_cad.ingest import IngestError
from vextrus_cad.keys import digest as keys_digest
from vextrus_cad.parameters import parameter_set_hash, pdf_parameter_set_hash

FORMS = "forms"
GENERATOR = FIXTURE_DIR / "gen_forms_pdf.py"

#: F-RCC6-BNBC's vector set and the roster its generator wrote beside it.
BNBC_DIR = REPO_ROOT / "fixtures" / "rcc6-bnbc"
BNBC_PDF = BNBC_DIR / "rcc6-bnbc.pdf"
BNBC_MANIFEST = BNBC_DIR / "manifest.json"

#: The pages of F-RCC6-BNBC's vector set that carry an image: the logo in page 1's title block, and
#: the hook-detail scan pasted onto S-03 (fixtures/rcc6-bnbc/traps.json, "F-SCAN seeds").
BNBC_PAGES_WITH_AN_IMAGE = ("Page 1", "Page 4")

#: The one of them nobody reads: the logo is a colour picture a fifth of the page's width, which the
#: raster lane takes for no scan (I-585); S-03's grey pasted scan is traced
#: (`cad/tests/test_raster.py`).
BNBC_PAGES_WITH_A_PICTURE_UNREAD = ("Page 1",)

PDF_KEY = r"^PDF_OBJECT:[0-9A-F]{64}$"


def _generator() -> Any:
    """The fixture's generator, loaded as a module — and writing no bytecode beside it: the fixture
    directory is a roster (tests/cad/dwg/dwg-lane.test.ts AC-6), and a `__pycache__` in it is a stray."""
    spec = importlib.util.spec_from_file_location("gen_forms_pdf", GENERATOR)
    assert spec is not None and spec.loader is not None, f"{GENERATOR} cannot be loaded"
    module = importlib.util.module_from_spec(spec)
    held, sys.dont_write_bytecode = sys.dont_write_bytecode, True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = held
    return module


@pytest.fixture(scope="module")
def forms() -> dict[str, Any]:
    return json.loads(artifact_path(FORMS).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def bnbc() -> tuple[dict[str, Any], report.Report]:
    notes = report.Report()
    return ingest_pdf(BNBC_PDF, notes), notes


def _on(graph: dict[str, Any], page: str, kind: str) -> list[dict[str, Any]]:
    return [entity for entity in graph["entities"] if entity["space"] == page and entity["type"] == kind]


def _text(graph: dict[str, Any], page: str, string: str) -> dict[str, Any]:
    found = [entity for entity in _on(graph, page, "TEXT") if entity["text"] == string]
    assert len(found) == 1, f"{page} carries {len(found)} texts reading {string!r}"
    return found[0]


# ---- the committed fixture: its bytes and its artifact ------------------------------------------


def test_the_forms_fixture_is_what_its_generator_writes() -> None:
    assert _generator().document() == pdf_path(FORMS).read_bytes(), (
        "forms.pdf is not what gen_forms_pdf.py writes — regenerate it (a baseline: commit)"
    )


def test_the_pdf_corpus_holds_the_forms_fixture() -> None:
    assert FORMS in pdf_artifact_names()


@pytest.mark.parametrize("name", pdf_artifact_names())
def test_a_fresh_ingest_reproduces_the_committed_artifact(name: str) -> None:
    fresh = dumps(ingest_pdf(pdf_path(name))).encode("utf-8")
    assert fresh == artifact_path(name).read_bytes(), (
        f"a fresh ingest of {name}.pdf does not reproduce the committed artifact byte-for-byte"
    )


def test_the_cli_reads_a_pdf_by_its_header_whatever_it_is_named(tmp_path: Path) -> None:
    renamed = tmp_path / "upload.bin"
    shutil.copyfile(pdf_path(FORMS), renamed)
    out = tmp_path / "artifact.json"
    assert main(["ingest", str(renamed), "--out", str(out)]) == 0
    assert out.read_bytes() == artifact_path(FORMS).read_bytes()
    parse_entity_graph(json.loads(out.read_text(encoding="utf-8")))


def test_bytes_that_are_no_pdf_are_refused_by_name(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "broken.pdf"
    source.write_bytes(b"%PDF-1.7\nthis is not a document\n")
    out = tmp_path / "artifact.json"
    out.write_text("untouched", encoding="utf-8")
    assert main(["ingest", str(source), "--out", str(out)]) == EXIT_REFUSED
    assert report.PDF_UNREADABLE in capsys.readouterr().err
    assert out.read_text(encoding="utf-8") == "untouched"


# ---- keys: content digests, scoped per scheme (L-CAD-02) -------------------------------------------


def test_every_original_is_keyed_by_a_whole_content_digest(forms: dict[str, Any]) -> None:
    keys = [entity["key"] for entity in forms["entities"]]
    assert all(re.match(PDF_KEY, key) for key in keys), keys
    assert len(set(keys)) == len(keys)


def test_a_key_is_the_digest_of_the_canonical_string(forms: dict[str, Any]) -> None:
    """The spelling is part of the identity: page index, object type, geometry at 0.001 pt."""
    border = "0|path|M 10.000,10.000 L 585.000,10.000 L 585.000,410.000 L 10.000,410.000 L 10.000,10.000 Z"
    title = "0|text|400.000,20.000|9.000|F-01 FORMS FIXTURE"
    for canonical in (border, title):
        key = "PDF_OBJECT:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest().upper()
        assert key in {entity["key"] for entity in forms["entities"]}, canonical


def test_the_quantum_rounds_half_even_and_spells_no_negative_zero() -> None:
    from vextrus_cad import keys

    # Exact halves on the 0.001 grid (dyadic, so the double IS the half): to the even neighbour.
    assert keys.quantum(0.0625) == "0.062"
    assert keys.quantum(0.1875) == "0.188"
    assert keys.quantum(2.0625) == "2.062"
    # 0.0005 is no double: the nearest one stands just above the half, and is taken exactly.
    assert keys.quantum(0.0005) == "0.001"
    assert keys.quantum(-0.0) == "0.000"
    assert keys.quantum(-0.0004) == "0.000"
    assert keys.quantum(12.5) == "12.500"


def test_two_extractions_mint_one_key_multiset(bnbc: tuple[dict[str, Any], report.Report]) -> None:
    first, _ = bnbc
    again = ingest_pdf(BNBC_PDF)
    assert Counter(entity["key"] for entity in again["entities"]) == Counter(
        entity["key"] for entity in first["entities"]
    )
    assert dumps(again) == dumps(first)


def test_a_key_names_content_never_where_the_file_wrote_it(tmp_path: Path, forms: dict[str, Any]) -> None:
    """The same page written with its objects in reverse order mints the same key multiset: a key
    is never a counter or an offset (L-CAD-02)."""
    generator = _generator()
    lines = [line for line in generator.PAGE_ONE.split("\n") if line]
    # The first line is the graphics state; the circle's `q`, its path and its `Q` travel as one
    # object, and every other line is a whole object of its own.
    state, circle = lines[0], "\n".join(lines[8:11])
    objects = [*lines[1:8], circle, *lines[11:]]
    generator.PAGE_ONE = "\n".join([state, *reversed(objects)]) + "\n"
    reordered = tmp_path / "reordered.pdf"
    reordered.write_bytes(generator.document())
    assert reordered.read_bytes() != pdf_path(FORMS).read_bytes()
    graph = ingest_pdf(reordered)
    assert Counter(entity["key"] for entity in graph["entities"]) == Counter(
        entity["key"] for entity in forms["entities"]
    )


def test_the_ingest_record_pins_the_pdf_lane_s_own_identity(forms: dict[str, Any]) -> None:
    assert forms["ingest"] == {
        "parameter_set_hash": pdf_parameter_set_hash(),
        "scheme": "PDF_OBJECT",
        "tool": "pypdfium2",
        "tool_version": pdfium.version.PYPDFIUM_INFO.version,
    }
    assert pdf_parameter_set_hash() != parameter_set_hash(), "the two lanes share no parameter set"


# ---- what each object becomes ------------------------------------------------------------------------


def test_each_page_is_a_paper_layout_named_by_its_place(forms: dict[str, Any]) -> None:
    assert [(layout["name"], layout["kind"]) for layout in forms["layouts"]] == [
        ("Page 1", "paper"),
        ("Page 2", "paper"),
    ]
    assert forms["insunits"] == {"code": 0, "unit": "unitless", "unmapped": False}


def test_text_height_comes_from_the_object_matrix(forms: dict[str, Any]) -> None:
    assert _text(forms, "Page 1", "SCALED")["height"] == 6.0  # font size 3 under a CTM of 2
    assert _text(forms, "Page 1", "F-01 FORMS FIXTURE")["height"] == 9.0
    turned = _text(forms, "Page 1", "VERTICAL")
    assert (turned["rotation"], turned["points"]) == (90.0, [[30.0, 200.0]])


def test_a_turned_page_reads_as_it_is_shown(forms: dict[str, Any]) -> None:
    title = _text(forms, "Page 2", "F-02 ROTATED PAGE")
    assert (title["points"], title["rotation"]) == ([[20.0, 170.0]], 270.0)
    line = _on(forms, "Page 2", "LWPOLYLINE")
    assert [entity["points"] for entity in line] == [[[40.0, 400.0], [40.0, 40.0]]]


def test_every_subpath_is_its_own_entity(forms: dict[str, Any]) -> None:
    dashes = [
        e
        for e in _on(forms, "Page 1", "LWPOLYLINE")
        if e["points"][0][1] == 100.0 and e["points"][0][0] < 200
    ]
    assert [dash["points"] for dash in dashes] == [
        [[100.0, 100.0], [110.0, 100.0]],
        [[120.0, 100.0], [130.0, 100.0]],
        [[140.0, 100.0], [150.0, 100.0]],
    ]
    rings = sorted(e["area"] for e in _on(forms, "Page 1", "LWPOLYLINE") if e.get("area") in (2000.0, 400.0))
    assert rings == [400.0, 400.0, 2000.0]  # the ring, its hole, and the fill-only square


def test_a_bezier_circle_flattens_within_the_page_tolerance(forms: dict[str, Any]) -> None:
    circle = [e for e in _on(forms, "Page 1", "LWPOLYLINE") if len(e["points"]) > 20]
    assert len(circle) == 1 and circle[0]["closed"] is True
    radii = [math.hypot(x - 190.0, y - 300.0) for x, y in circle[0]["points"]]
    assert max(abs(radius - 10.0) for radius in radii) <= 0.01 + 1e-6
    assert circle[0]["area"] == pytest.approx(math.pi * 100.0, rel=1e-3)


def test_images_are_listed_and_never_measured(forms: dict[str, Any]) -> None:
    (image,) = _on(forms, "Page 1", "IMAGE")
    # Its frame drawn whole, its first corner restated — and OPEN, so no outline reader takes a
    # picture's edge for a member's section (I-521); no area, because nothing of it is measured.
    assert image["points"] == [[450.0, 330.0], [490.0, 330.0], [490.0, 360.0], [450.0, 360.0], [450.0, 330.0]]
    assert image["closed"] is False and "area" not in image
    corners = "450.000,330.000 490.000,330.000 490.000,360.000 450.000,360.000"
    key = "PDF_OBJECT:" + keys_digest(f"0|image|{corners}")
    assert image["key"] == key, "the key is the four corners of its placement, as it always was"


def test_a_page_counts_what_it_carries_and_does_not_read(forms: dict[str, Any]) -> None:
    """An image's pixels and a shading's colour are carried and never read as geometry: tallied per
    page on the counters row, so the page's card can say it holds something nobody read (I-521)."""
    assert [(c["space"], c["unread"]) for c in forms["counters"]] == [
        ("Page 1", {"IMAGE": 1}),
        ("Page 2", {}),
    ]


def test_optional_content_is_the_layer(forms: dict[str, Any]) -> None:
    grid = [entity for entity in forms["entities"] if entity["layer"] == "S-GRID"]
    assert sorted(entity["type"] for entity in grid) == ["INSERT", "LWPOLYLINE", "LWPOLYLINE"]
    (placed,) = [entity for entity in grid if entity["type"] == "INSERT"]
    assert {record["layer"] for record in forms["derived"] if record["src"] == placed["key"]} == {"S-GRID"}
    assert [layer["name"] for layer in forms["layers"]] == ["0", "S-GRID"]


def test_form_xobjects_explode_to_derived_paint_carrying_src(forms: dict[str, Any]) -> None:
    inserts = [entity for entity in forms["entities"] if entity["type"] == "INSERT"]
    assert len(inserts) == 7  # five column symbols and the pair on page 1, one more on page 2
    by_key = {entity["key"]: entity for entity in inserts}
    painted = Counter(record["src"] for record in forms["derived"])
    assert set(painted) == set(by_key), "every derived piece names a placed form, and every form paints"
    symbols = [entity for entity in inserts if entity["block"]["name"] != inserts[5]["block"]["name"]]
    assert {painted[entity["key"]] for entity in symbols} == {3}
    assert painted[inserts[5]["key"]] == 6  # the nested pair: two symbols, three pieces each
    digests = {entity["block"]["definition_sha256"] for entity in symbols}
    assert len(digests) == 1, "one symbol keeps one digest wherever and however it is placed"
    placements = [(e["block"]["rotation"], e["block"]["scale"], e["block"]["mirrored"]) for e in inserts[:5]]
    assert placements == [
        (0.0, [1.0, 1.0], False),
        (0.0, [1.0, 1.0], False),
        (90.0, [1.0, 1.0], False),
        (0.0, [2.0, 2.0], False),
        (180.0, [1.0, 1.0], True),
    ]
    turned = [r for r in forms["derived"] if r["src"] == inserts[2]["key"] and r["type"] == "TEXT"]
    assert [(r["points"], r["rotation"]) for r in turned] == [([[147.0, 248.0]], 90.0)]


def test_collisions_collapse_and_are_counted_per_page_and_type(forms: dict[str, Any]) -> None:
    assert [(c["space"], c["collapsed"]) for c in forms["counters"]] == [
        ("Page 1", {"LWPOLYLINE": 2, "TEXT": 1}),
        ("Page 2", {}),
    ]
    notes = report.Report()
    ingest_pdf(pdf_path(FORMS), notes)
    assert notes.lines() == [
        "EMBEDDED_IMAGE: 1 embedded image(s) listed at their placement,"
        " none of their pixels taken as geometry",
        "OBJECTS_COLLAPSED: Page 1: 2 LWPOLYLINE, 1 TEXT",
    ]


def test_the_explode_budget_and_depth_cap_trip_by_name(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pdf, "EXPLODE_DEPTH_CAP", 1)
    capped = ingest_pdf(pdf_path(FORMS))
    first = capped["counters"][0]
    assert first["explode_truncated"] is True and first["explode_losses"] == {"INSERT": 2}
    names = {e["block"]["name"] for e in capped["entities"] if e["type"] == "INSERT"}
    assert "XOBJECT" in names, "a form nesting past the cap carries no digest"

    monkeypatch.setattr(pdf, "EXPLODE_DEPTH_CAP", 8)
    monkeypatch.setattr(pdf, "DERIVED_ENTITY_BUDGET", 4)
    spent = ingest_pdf(pdf_path(FORMS))
    assert len(spent["derived"]) == 4
    losses = [counter["explode_losses"] for counter in spent["counters"]]
    # Page 1: the grouped symbol paints its three pieces and the next symbol one, then the budget is
    # spent — that symbol's other two pieces and the three symbols after it (11) are lost, and so are
    # the pair's two nested symbols, each one INSERT entry never entered. Page 2: its three pieces.
    assert losses == [{"INSERT": 2, "LWPOLYLINE": 7, "TEXT": 4}, {"LWPOLYLINE": 2, "TEXT": 1}]
    assert all(counter["explode_truncated"] for counter in spent["counters"])


# ---- the mirror: one scheme per key, pinned per scheme (L-CAD-02) ---------------------------------


def _keyless(graph: dict[str, Any]) -> dict[str, Any]:
    return {**graph, "entities": [], "derived": [], "block_attributes": []}


def test_the_mirror_refuses_a_key_of_a_scheme_the_record_pins_no_identity_for(forms: dict[str, Any]) -> None:
    raster = {**forms["entities"][0], "key": "RASTER_TRACE:" + "A" * 64}
    with pytest.raises(EntityGraphError, match="pins no identity"):
        parse_entity_graph({**_keyless(forms), "entities": [raster]})
    handle = {**forms["entities"][0], "key": "DXF_HANDLE:1F"}
    with pytest.raises(EntityGraphError, match="pins no identity"):
        parse_entity_graph({**_keyless(forms), "entities": [handle]})
    traced = {
        **_keyless(forms),
        "ingest": {
            **forms["ingest"],
            "trace": {"tool": "vectoriser", "tool_version": "1", "parameter_set_hash": "0" * 64},
        },
        "entities": [raster],
    }
    # A traced line's page carries the record of the picture it was traced from (I-584).
    with pytest.raises(EntityGraphError, match="no traced picture's record"):
        parse_entity_graph(traced)
    record = {
        "space": raster["space"],
        "sha256": "0" * 64,
        "width": 4,
        "height": 4,
        "dpi": None,
        "dpi_source": "unstated",
        "deskew_degrees": 0.0,
        "placement": [[0, 4], [4, 4], [4, 0], [0, 0]],
        "traced": 1,
        "dropped_short": 0,
    }
    parse_entity_graph({**traced, "rasters": [record]})


def test_the_mirror_admits_a_vectoriser_identity_only_beside_a_pdf(forms: dict[str, Any]) -> None:
    trace = {"tool": "vectoriser", "tool_version": "1", "parameter_set_hash": "0" * 64}
    for scheme in ("DXF_HANDLE", "RASTER_TRACE"):
        with pytest.raises(EntityGraphError, match="rides only beside"):
            parse_entity_graph(
                {**_keyless(forms), "ingest": {**forms["ingest"], "scheme": scheme, "trace": trace}}
            )
    with pytest.raises(EntityGraphError, match="outside the closed set"):
        parse_entity_graph({**_keyless(forms), "ingest": {**forms["ingest"], "trace": {**trace, "dpi": 300}}})
    with pytest.raises(EntityGraphError, match="outside L-CAD-02"):
        parse_entity_graph({**_keyless(forms), "ingest": {**forms["ingest"], "scheme": "PDF_HANDLE"}})


def test_the_mirror_admits_a_page_s_unread_tally_and_refuses_one_that_is_not_a_tally(
    forms: dict[str, Any],
) -> None:
    parse_entity_graph(forms)
    counters = [dict(forms["counters"][0], unread={"IMAGE": -1}), *forms["counters"][1:]]
    with pytest.raises(EntityGraphError, match="unread"):
        parse_entity_graph({**forms, "counters": counters})


def test_the_mirror_refuses_a_digest_key_that_is_not_a_whole_sha256(forms: dict[str, Any]) -> None:
    short = {**forms["entities"][0], "key": "PDF_OBJECT:9B26C360"}
    with pytest.raises(EntityGraphError, match="whole sha256"):
        parse_entity_graph({**_keyless(forms), "entities": [short]})


# ---- F-RCC6-BNBC's vector set --------------------------------------------------------------------


def _objects(path: Path) -> tuple[Counter[str], int]:
    """An independent reading of the file: every top-level page object by type, and every subpath
    a path object starts (its move-tos) — the count the extractor's entities must account for."""
    document = pdfium.PdfDocument(str(path))
    tally: Counter[str] = Counter()
    subpaths = 0
    names = {pdfium_c.FPDF_PAGEOBJ_PATH: "path", pdfium_c.FPDF_PAGEOBJ_TEXT: "text"}
    names |= {pdfium_c.FPDF_PAGEOBJ_IMAGE: "image", pdfium_c.FPDF_PAGEOBJ_FORM: "form"}
    try:
        for index in range(len(document)):
            page = document[index]
            for position in range(pdfium_c.FPDFPage_CountObjects(page.raw)):
                raw = pdfium_c.FPDFPage_GetObject(page.raw, position)
                kind = pdfium_c.FPDFPageObj_GetType(raw)
                tally[names.get(kind, "other")] += 1
                if kind == pdfium_c.FPDF_PAGEOBJ_PATH:
                    segments = range(pdfium_c.FPDFPath_CountSegments(raw))
                    subpaths += sum(
                        pdfium_c.FPDFPathSegment_GetType(pdfium_c.FPDFPath_GetPathSegment(raw, i))
                        == pdfium_c.FPDF_SEGMENT_MOVETO
                        for i in segments
                    )
            page.close()
    finally:
        document.close()
    return tally, subpaths


def test_bnbc_every_page_object_is_an_entity_or_a_named_collapse(
    bnbc: tuple[dict[str, Any], report.Report],
) -> None:
    graph, notes = bnbc
    objects, subpaths = _objects(BNBC_PDF)
    manifest = json.loads(BNBC_MANIFEST.read_text(encoding="utf-8"))["pdf"]["rcc6-bnbc.pdf"]
    assert objects["text"] == manifest["text_objects"], "the independent reading agrees with the roster"
    assert objects["form"] == 0 and objects["other"] == 0
    entities = Counter(entity["type"] for entity in graph["entities"])
    collapsed: Counter[str] = Counter()
    for counter in graph["counters"]:
        collapsed.update(counter["collapsed"])
    assert entities["LWPOLYLINE"] + collapsed["LWPOLYLINE"] == subpaths == objects["path"]
    assert entities["TEXT"] + collapsed["TEXT"] == objects["text"]
    assert entities["IMAGE"] + collapsed["IMAGE"] == objects["image"]
    # Beside them, the lines traced off S-03's pasted scan: keys of the vectoriser's, not pdfium's.
    assert set(entities) <= {"LWPOLYLINE", "TEXT", "IMAGE", "LINE"}
    assert all(e["key"].startswith("RASTER_TRACE:") for e in graph["entities"] if e["type"] == "LINE")
    said = {note.code: note.count for note in notes.notes}
    assert said.get(report.OBJECTS_COLLAPSED, 0) == sum(collapsed.values())
    assert said[report.EMBEDDED_IMAGE] == len(BNBC_PAGES_WITH_A_PICTURE_UNREAD)
    assert said[report.RASTER_TRACED] == objects["image"] - len(BNBC_PAGES_WITH_A_PICTURE_UNREAD)


def test_bnbc_each_page_is_a_sheet_carrying_its_numbered_title_line(
    bnbc: tuple[dict[str, Any], report.Report],
) -> None:
    graph, _ = bnbc
    sheets = json.loads(BNBC_MANIFEST.read_text(encoding="utf-8"))["sheets"]
    assert [layout["name"] for layout in graph["layouts"]] == [f"Page {i + 1}" for i in range(len(sheets))]
    for index, sheet in enumerate(sheets):
        page = f"Page {index + 1}"
        numbered = [
            e["text"] for e in _on(graph, page, "TEXT") if e["text"].startswith(f"{sheet['number']} ")
        ]
        assert numbered, f"{page} carries no line opening with its number {sheet['number']}"
    s10 = _text(graph, "Page 11", "S-10 COLUMN LAYOUT PLAN")
    assert s10["height"] == pytest.approx(3.2 * 72 / 25.4, abs=1e-5)  # 3.2 mm of paper, in points


def test_bnbc_names_the_pages_that_carry_a_picture_nobody_read(
    bnbc: tuple[dict[str, Any], report.Report],
) -> None:
    graph, notes = bnbc
    objects, _ = _objects(BNBC_PDF)
    unread = {counter["space"]: counter["unread"] for counter in graph["counters"]}
    assert set(unread) == {layout["name"] for layout in graph["layouts"]}, "every page carries the tally"
    assert {page: tally for page, tally in unread.items() if tally} == {
        page: {"IMAGE": 1} for page in BNBC_PAGES_WITH_A_PICTURE_UNREAD
    }
    # Every picture is listed where it stands; the one traced is read, and only the other is unread.
    assert {e["space"] for e in graph["entities"] if e["type"] == "IMAGE"} == set(BNBC_PAGES_WITH_AN_IMAGE)
    assert [record["space"] for record in graph["rasters"]] == ["Page 4"]
    assert sum(tally.get("IMAGE", 0) for tally in unread.values()) == objects["image"] - 1
    assert {note.code: note.count for note in notes.notes}[report.EMBEDDED_IMAGE] == 1


def test_bnbc_the_text_layer_reads_every_object_s_own_words(
    bnbc: tuple[dict[str, Any], report.Report],
) -> None:
    graph, notes = bnbc
    assert report.TEXT_NOT_DECODED not in notes.codes()
    assert not [e for e in graph["entities"] if e["type"] == "TEXT" and e["text"] == ""]


def test_the_text_layer_leaves_out_what_it_generated() -> None:
    """pdfium infers a space after a text that stands close to the next one; the object said none."""
    document = pdfium.PdfDocument(str(pdf_path(FORMS)))
    try:
        page = document[0]
        textpage = page.get_textpage()
        strings = pdf.text_layer(textpage.raw)
        generated = sum(
            pdfium_c.FPDFText_IsGenerated(textpage.raw, i) == 1
            for i in range(pdfium_c.FPDFText_CountChars(textpage.raw))
        )
        assert generated > 0, "the fixture no longer makes pdfium generate a character"
        assert all(not string.endswith((" ", "\r", "\n")) for string in strings.values()), strings
        textpage.close()
        page.close()
    finally:
        document.close()


# ---- a PDF the vector lane has nothing to read in (I-521) ---------------------------------------


def _refused(source: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> str:
    """Run the CLI over `source` exactly as the ingest seam does, and answer what it said: the run is
    refused, and `--out` is left as it stood."""
    out = tmp_path / "artifact.json"
    out.write_text("untouched", encoding="utf-8")
    assert main(["ingest", str(source), "--out", str(out)]) == EXIT_REFUSED
    assert out.read_text(encoding="utf-8") == "untouched", "a refused PDF writes no artifact"
    return capsys.readouterr().err


def test_a_page_of_pictures_among_drawn_pages_is_read_and_a_file_of_them_is_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The judgement is the whole file's: one drawn page makes it a vector set, whose picture pages
    are sheets that name their unread images; a file whose every page is a picture the raster lane
    takes for no scan (a 4-pixel ramp, I-585) is refused. A scanned set the lane DOES take is
    traced, not refused (`cad/tests/test_raster.py`)."""
    generator = _generator()
    picture = "q 595 0 0 420 0 0 cm /Im1 Do Q\n"

    generator.PAGE_TWO = "BT /F1 9 Tf 1 0 0 1 250 20 Tm (F-02 DRAWN PAGE) Tj ET\n"
    generator.PAGE_ONE = picture
    mixed = tmp_path / "mixed.pdf"
    mixed.write_bytes(generator.document())
    graph = ingest_pdf(mixed)
    unread = [(c["space"], c["unread"]) for c in graph["counters"]]
    assert unread == [("Page 1", {"IMAGE": 1}), ("Page 2", {})]

    generator.PAGE_TWO = ""
    scan = tmp_path / "scan.pdf"
    scan.write_bytes(generator.document())
    with pytest.raises(IngestError) as refused:
        ingest_pdf(scan)
    assert refused.value.code == report.PDF_RASTER_ONLY
    assert str(refused.value).startswith("PDF_RASTER_ONLY: 2 page(s) holding 1 image(s)")
    # At the CLI the same file ends refused, naming the pictures it met on the way out.
    said = _refused(scan, tmp_path, capsys)
    assert f"{report.PDF_RASTER_ONLY}: 2 page(s) holding 1 image(s) and no path, text or traced line" in said
    assert f"{report.NOTE_PREFIX}{report.EMBEDDED_IMAGE}: 1 embedded image(s)" in said


def test_a_pdf_with_nothing_drawn_is_refused_by_name(tmp_path: Path) -> None:
    generator = _generator()
    generator.PAGE_ONE = ""
    generator.PAGE_TWO = ""
    blank = tmp_path / "blank.pdf"
    blank.write_bytes(generator.document())
    with pytest.raises(IngestError) as refused:
        ingest_pdf(blank)
    assert refused.value.code == report.PDF_NO_DRAWING
    assert "2 page(s)" in str(refused.value)
