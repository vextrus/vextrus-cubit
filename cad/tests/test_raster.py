"""The raster lane: scans traced by the pinned vectoriser (R-TO-003, L-CAD-02, I-584, I-585).

What a QS relies on when a scanned sheet is ingested: the page is turned back square by the skew it
was scanned at, its lines are traced into page space under RASTER_TRACE keys, the page it stands on
states its DPI (or says it has none), and the very pixels the trace was taken from lie beside the
artifact. A drafted sheet with a scan pasted onto it mints both schemes on one page.

Nothing here asserts a committed RASTER_TRACE digest: a digest is the vectoriser's, and a test that
pinned one would pass on one machine's SIMD and fail on another's. Keys are proved by how they are
MADE (the canonical string) and by determinism (`test_raster_determinism.py`), never by value.
"""

from __future__ import annotations

import functools
import hashlib
import json
import math
import re
import struct
import zlib
from collections import Counter
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
import pytest

from corpus import REPO_ROOT
from vextrus_cad import EntityGraphError, keys, parse_entity_graph, raster, report
from vextrus_cad.cli import EXIT_REFUSED, main
from vextrus_cad.pdf import ingest_pdf
from vextrus_cad.raster import ingest_raster

BNBC_DIR = REPO_ROOT / "fixtures" / "rcc6-bnbc"
RASTER_DIR = BNBC_DIR / "raster"

#: F-RCC6-BNBC's R2 variant: a 200 DPI scan whose generator turned each sheet by 1.2° to 1.8°, either
#: way (fixtures/rcc6-bnbc/manifest.json, `SKEW_1_2_TO_1_8_DEG`).
R2_SHEETS = ("s-01", "s-10", "s-11", "s-17", "s-20", "s-26")
R2_SKEW = (1.2, 1.8)

#: The window of S-10 every crop in this file is cut from: a fifth of the way across, three tenths
#: down, an eighth of the sheet each way — the column grid and its marks.
CROP = (0.2, 0.3, 0.125)

RASTER_KEY = r"^RASTER_TRACE:[0-9A-F]{64}$"


@functools.cache
def _sheet(variant: str, name: str) -> np.ndarray:
    path = next((RASTER_DIR / variant).glob(f"{name}.*"))
    return raster.decode(path.read_bytes(), path.name)


def crop(grey: np.ndarray) -> np.ndarray:
    height, width = grey.shape
    x, y, size = CROP
    return np.ascontiguousarray(
        grey[int(y * height) : int((y + size) * height), int(x * width) : int((x + size) * width)]
    )


def rotate(grey: np.ndarray, degrees: float) -> np.ndarray:
    """Turn a picture counter-clockwise as a reader sees it, by numpy alone (nearest neighbour, paper
    white outside) — never by the vectoriser under test, whose own turn would prove itself."""
    height, width = grey.shape
    theta = math.radians(degrees)
    c, s = math.cos(theta), math.sin(theta)
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float64)
    cx, cy = (width - 1) / 2.0, (height - 1) / 2.0
    # Inverse map: each output pixel reads the source pixel the clockwise turn brings it from.
    sx = c * (xs - cx) - s * (ys - cy) + cx
    sy = s * (xs - cx) + c * (ys - cy) + cy
    ix, iy = np.rint(sx).astype(np.int64), np.rint(sy).astype(np.int64)
    inside = (ix >= 0) & (ix < width) & (iy >= 0) & (iy < height)
    out = np.full_like(grey, 255)
    out[inside] = grey[iy[inside], ix[inside]]
    return out


def png_with_dpi(grey: np.ndarray, dpi: float | None) -> bytes:
    """A grey PNG, with a `pHYs` chunk stating `dpi` where one is given."""
    encoded = raster.png_bytes(grey)
    if dpi is None:
        return encoded
    per_metre = round(dpi / 0.0254)
    body = b"pHYs" + struct.pack(">IIB", per_metre, per_metre, 1)
    chunk = struct.pack(">I", 9) + body + struct.pack(">I", zlib.crc32(body))
    header_end = len(raster.PNG_MAGIC) + 25  # the signature and the IHDR chunk
    return encoded[:header_end] + chunk + encoded[header_end:]


# ---- deskew --------------------------------------------------------------------------------------


@pytest.mark.parametrize("sheet", R2_SHEETS)
def test_r2_deskew_recovers_the_skew_it_was_scanned_at(sheet: str) -> None:
    """Every R2 sheet was turned 1.2°-1.8° one way or the other; the deskew finds that turn, and the
    page it turns back reads square. Read off the sheet decoded at half size — a turn reads the same
    at any scale, the estimate samples at most 2,000 px anyway, and the lane's budget holds (verify
    ≤ 60 s; the whole A1 at 300 DPI is M4P-11's PERF spec)."""
    path = next((RASTER_DIR / "r2").glob(f"{sheet}.*"))
    grey = cv2.imdecode(np.frombuffer(path.read_bytes(), dtype=np.uint8), cv2.IMREAD_REDUCED_GRAYSCALE_2)
    skew = raster.skew_of(grey)
    assert R2_SKEW[0] <= abs(skew) <= R2_SKEW[1], f"r2/{sheet} read {skew}°"
    turned, _, applied = raster.deskew(grey, skew)
    assert applied == skew
    assert abs(raster.skew_of(turned)) <= 0.05, "the turned page reads square"


@pytest.mark.parametrize("degrees", [1.5, -1.5])
def test_the_deskew_reads_the_turn_numpy_gave_a_square_crop_and_its_sign(degrees: float) -> None:
    square = crop(_sheet("r1", "s-10"))
    assert raster.skew_of(square) == 0.0, "r1 is a clean 300 DPI render: it stands square"
    assert raster.skew_of(rotate(square, degrees)) == pytest.approx(degrees, abs=0.1)


def test_a_page_under_the_threshold_is_left_unturned() -> None:
    square = crop(_sheet("r1", "s-10"))
    turned, forward, applied = raster.deskew(square, 0.04)
    assert applied == 0.0 and forward == (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    assert turned is square, "no resample for a turn nobody could see"


# ---- DPI ------------------------------------------------------------------------------------------


def test_a_png_states_its_dpi_in_its_phys_chunk_and_a_bare_one_states_none() -> None:
    square = crop(_sheet("r1", "s-10"))
    assert raster.file_dpi(png_with_dpi(square, 300)) == pytest.approx(300.0, abs=0.01)
    assert raster.file_dpi(png_with_dpi(square, None)) is None


def test_a_jpeg_states_its_dpi_in_its_jfif_density() -> None:
    def jfif(unit: int, density: int) -> bytes:
        body = b"JFIF\x00\x01\x02" + bytes([unit]) + struct.pack(">HH", density, density) + b"\x00\x00"
        return b"\xff\xd8" + b"\xff\xe0" + struct.pack(">H", len(body) + 2) + body + b"\xff\xda"

    assert raster.file_dpi(jfif(1, 200)) == 200.0
    assert raster.file_dpi(jfif(2, 118)) == pytest.approx(299.72)
    assert raster.file_dpi(jfif(0, 1)) is None, "unit 0 states an aspect ratio, never a resolution"


def test_a_tiff_states_its_dpi_in_its_x_resolution() -> None:
    def tiff(unit: int) -> bytes:
        entries = [(282, 5, 1, struct.pack("<I", 38)), (296, 3, 1, struct.pack("<HH", unit, 0))]
        ifd = struct.pack("<H", len(entries)) + b"".join(struct.pack("<HHI4s", *e) for e in entries)
        return b"II*\x00" + struct.pack("<I", 8) + ifd + b"\x00\x00\x00\x00" + struct.pack("<II", 600, 2)

    assert raster.file_dpi(tiff(2)) == 300.0
    assert raster.file_dpi(tiff(3)) == pytest.approx(762.0)
    assert raster.file_dpi(tiff(1)) is None


# ---- a scan, ingested whole ----------------------------------------------------------------------


def _ingest(tmp_path: Path, data: bytes, name: str) -> tuple[dict[str, Any], Path]:
    source = tmp_path / name
    source.write_bytes(data)
    out = tmp_path / "out" / "scan.entitygraph.json"
    assert main(["ingest", str(source), "--out", str(out)]) == 0
    return json.loads(out.read_text(encoding="utf-8")), out.parent


def test_a_scan_is_traced_into_page_space_under_the_vectoriser_s_identity(tmp_path: Path) -> None:
    square = crop(_sheet("r1", "s-10"))
    graph, beside = _ingest(tmp_path, png_with_dpi(square, 300), "crop.png")
    parse_entity_graph(graph)
    assert graph["ingest"] == {"scheme": keys.RASTER_TRACE, **raster.identity()}
    assert graph["ingest"]["tool"] == "opencv-lsd" and graph["ingest"]["tool_version"] == "4.13.0.90"
    assert [layout["name"] for layout in graph["layouts"]] == ["Page 1"]
    assert graph["insunits"] == {"code": 0, "unit": "unitless", "unmapped": False}
    lines = graph["entities"]
    assert len(lines) > 50, "the crop's grid and marks trace to lines"
    assert all(e["type"] == "LINE" and e["layer"] == "TRACE" for e in lines)
    assert all(re.match(RASTER_KEY, e["key"]) for e in lines)

    (record,) = graph["rasters"]
    height, width = square.shape
    assert record["space"] == "Page 1"
    assert (record["dpi"], record["dpi_source"], record["deskew_degrees"]) == (300.0, "file", 0.0)
    assert (record["width"], record["height"]) == (width, height)
    assert record["traced"] == len(lines)
    # Page space is paper points at the stated DPI, upright from the lower-left corner.
    scale = 72.0 / 300.0
    assert record["placement"] == [
        [0.0, pytest.approx(height * scale)],
        [pytest.approx(width * scale), pytest.approx(height * scale)],
        [pytest.approx(width * scale), 0.0],
        [0.0, 0.0],
    ]
    for line in lines:
        for x, y in line["points"]:
            assert -1e-6 <= x <= width * scale + 1e-6 and -1e-6 <= y <= height * scale + 1e-6

    # The page raster the lines were taken from lies beside the artifact, under the name it records.
    written = beside / f"{record['sha256']}.png"
    assert hashlib.sha256(written.read_bytes()).hexdigest() == record["sha256"]
    pixels = cv2.imdecode(np.frombuffer(written.read_bytes(), dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    assert pixels.shape == (height, width) and pixels.dtype == np.uint8


def test_a_traced_key_is_the_digest_of_its_canonical_line_whichever_end_came_first() -> None:
    a, b = (10.0004, 20.0), (30.0, 40.0015)
    assert raster.canonical_line(a, b) == raster.canonical_line(b, a) == "line|10.000,20.000 30.000,40.002"
    square = crop(_sheet("r1", "s-10"))
    graph = ingest_raster_bytes(png_with_dpi(square, 300))
    for line in graph["entities"][:20]:
        start, end = line["points"]
        canonical = f"0|{raster.canonical_line(tuple(start), tuple(end))}"
        assert line["key"] == f"RASTER_TRACE:{keys.digest(canonical)}"


def ingest_raster_bytes(data: bytes, name: str = "scan.png") -> dict[str, Any]:
    import tempfile

    with tempfile.TemporaryDirectory() as scratch:
        path = Path(scratch) / name
        path.write_bytes(data)
        return ingest_raster(path)


def test_a_skewed_scan_is_turned_square_and_says_by_how_much(tmp_path: Path) -> None:
    turned = rotate(crop(_sheet("r1", "s-10")), 1.5)
    notes = report.Report()
    source = tmp_path / "skewed.png"
    source.write_bytes(png_with_dpi(turned, 300))
    graph = ingest_raster(source, notes)
    (record,) = graph["rasters"]
    assert record["deskew_degrees"] == pytest.approx(1.5, abs=0.1)
    assert record["width"] > turned.shape[1], "the turned canvas holds the whole page"
    said = [line for line in notes.lines() if line.startswith(report.RASTER_TRACED)]
    assert said and f"deskewed {record['deskew_degrees']:g}°" in said[0] and "300 DPI (file)" in said[0]


def test_a_scan_that_states_no_dpi_says_so_and_its_page_space_is_its_pixels(tmp_path: Path) -> None:
    square = crop(_sheet("r1", "s-10"))
    notes = report.Report()
    source = tmp_path / "bare.png"
    source.write_bytes(png_with_dpi(square, None))
    graph = ingest_raster(source, notes)
    (record,) = graph["rasters"]
    assert (record["dpi"], record["dpi_source"]) == (None, "unstated")
    assert record["placement"][2] == [square.shape[1], 0.0]
    assert {note.code for note in notes.notes} >= {report.RASTER_TRACED, report.RASTER_DPI_UNSTATED}


def test_a_colour_photograph_is_traced_as_grey(tmp_path: Path) -> None:
    """R4 is a phone photo in colour: a whole scan, read as grey and traced."""
    path = RASTER_DIR / "r4" / "s-10.jpg"
    colour = cv2.imdecode(np.frombuffer(path.read_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
    assert colour.ndim == 3
    ok, encoded = cv2.imencode(".jpg", crop_colour(colour))
    assert ok
    graph = ingest_raster_bytes(encoded.tobytes(), "photo.jpg")
    assert graph["rasters"][0]["traced"] == len(graph["entities"]) > 0


def crop_colour(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    x, y, size = CROP
    return np.ascontiguousarray(
        image[int(y * height) : int((y + size) * height), int(x * width) : int((x + size) * width)]
    )


def test_bytes_that_are_no_image_are_refused_by_name(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "broken.png"
    source.write_bytes(raster.PNG_MAGIC + b"not a picture")
    out = tmp_path / "artifact.json"
    assert main(["ingest", str(source), "--out", str(out)]) == EXIT_REFUSED
    assert not out.exists()
    assert f"{report.RASTER_UNREADABLE}: OpenCV cannot decode broken.png" in capsys.readouterr().err


def test_a_blank_scan_is_refused_by_name_never_stored_as_an_empty_sheet(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "blank.png"
    source.write_bytes(png_with_dpi(np.full((400, 600), 255, dtype=np.uint8), 300))
    out = tmp_path / "artifact.json"
    assert main(["ingest", str(source), "--out", str(out)]) == EXIT_REFUSED
    assert not out.exists() and list(tmp_path.glob("*.png")) == [source], "nothing is written beside"
    assert f"{report.RASTER_NO_LINE}: blank.png" in capsys.readouterr().err


# ---- scans on PDF pages ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def bnbc() -> tuple[dict[str, Any], dict[str, bytes]]:
    rasters: dict[str, bytes] = {}
    return ingest_pdf(BNBC_DIR / "rcc6-bnbc.pdf", report.Report(), rasters), rasters


def test_s03_mints_both_schemes_on_one_page(bnbc: tuple[dict[str, Any], dict[str, bytes]]) -> None:
    """S-03 (Page 4) is a drafted sheet with a hook-detail scan pasted onto it: its objects are
    pdfium's PDF_OBJECT keys and its scan's lines the vectoriser's RASTER_TRACE keys, one page, both
    identities pinned (L-CAD-02, R-TO-003's mixed page)."""
    graph, rasters = bnbc
    parse_entity_graph(graph)
    on_s03 = Counter(keys.scheme_of(e["key"]) for e in graph["entities"] if e["space"] == "Page 4")
    assert on_s03[keys.PDF_OBJECT] > 0 and on_s03[keys.RASTER_TRACE] > 0
    assert graph["ingest"]["scheme"] == keys.PDF_OBJECT and graph["ingest"]["trace"] == raster.identity()
    others = {e["space"] for e in graph["entities"] if keys.scheme_of(e["key"]) == keys.RASTER_TRACE}
    assert others == {"Page 4"}, "only the page carrying a scan mints traced keys"

    (record,) = graph["rasters"]
    (image,) = [e for e in graph["entities"] if e["space"] == "Page 4" and e["type"] == "IMAGE"]
    assert record["image"] == image["key"], "the record names the picture it was traced from"
    # 720 px across 340.157 pt of paper: 152.4 DPI, read off where the picture is placed.
    assert (record["dpi"], record["dpi_source"]) == (152.4, "placement")
    assert record["traced"] == on_s03[keys.RASTER_TRACE]
    assert hashlib.sha256(rasters[record["sha256"]]).hexdigest() == record["sha256"]
    # The traced lines stand inside the picture's own frame on the page.
    xs = [x for x, _ in image["points"]]
    ys = [y for _, y in image["points"]]
    for line in (e for e in graph["entities"] if keys.scheme_of(e["key"]) == keys.RASTER_TRACE):
        for x, y in line["points"]:
            assert min(xs) - 0.5 <= x <= max(xs) + 0.5 and min(ys) - 0.5 <= y <= max(ys) + 0.5


def test_the_logo_is_listed_and_left_unread(bnbc: tuple[dict[str, Any], dict[str, bytes]]) -> None:
    """Page 1's title-block logo is a colour picture a tenth of the page wide: a picture, not a scan
    (I-585). It is listed as an IMAGE, counted unread, and traces nothing."""
    graph, _ = bnbc
    on_page_one = [e["type"] for e in graph["entities"] if e["space"] == "Page 1"]
    assert on_page_one.count("IMAGE") == 1 and "LINE" not in on_page_one
    unread = {c["space"]: c["unread"] for c in graph["counters"]}
    assert unread["Page 1"] == {"IMAGE": 1} and unread["Page 4"] == {}


def _scanned_pdf(path: Path, grey: np.ndarray, page: tuple[float, float]) -> None:
    """A one-page PDF holding one grey picture over the whole page — built by pdfium's own writer."""
    document = pdfium.PdfDocument.new()
    sheet = document.new_page(*page)
    height, width = grey.shape
    stride = (width + 3) // 4 * 4
    buffer = np.full((height, stride), 255, dtype=np.uint8)
    buffer[:, :width] = grey
    pointer = buffer.ctypes.data_as(pdfium_c.POINTER(pdfium_c.c_ubyte))
    raw = pdfium_c.FPDFBitmap_CreateEx(width, height, pdfium_c.FPDFBitmap_Gray, pointer, stride)
    image = pdfium_c.FPDFPageObj_NewImageObj(document.raw)
    assert pdfium_c.FPDFImageObj_SetBitmap(None, 0, image, raw)
    assert pdfium_c.FPDFImageObj_SetMatrix(image, page[0], 0, 0, page[1], 0, 0)
    pdfium_c.FPDFPage_InsertObject(sheet.raw, image)
    assert pdfium_c.FPDFPage_GenerateContent(sheet.raw)
    pdfium_c.FPDFBitmap_Destroy(raw)
    sheet.close()
    document.save(str(path))
    document.close()


def test_a_scanned_pdf_is_traced_page_by_page_not_refused(tmp_path: Path) -> None:
    """A scanned set — every page one picture, nothing drawn — was refused PDF_RASTER_ONLY until the
    raster lane stood (I-521); now each page's scan is traced, and the picture is still listed."""
    square = crop(_sheet("r1", "s-10"))
    source = tmp_path / "scan.pdf"
    height, width = square.shape
    _scanned_pdf(source, square, (width * 72 / 300, height * 72 / 300))
    out = tmp_path / "out.json"
    assert main(["ingest", str(source), "--out", str(out)]) == 0
    graph = json.loads(out.read_text(encoding="utf-8"))
    parse_entity_graph(graph)
    kinds = Counter(e["type"] for e in graph["entities"])
    assert kinds["IMAGE"] == 1 and kinds["LINE"] > 50
    (record,) = graph["rasters"]
    assert (record["dpi"], record["dpi_source"]) == (pytest.approx(300.0, abs=0.01), "placement")
    assert graph["counters"][0]["unread"] == {}
    assert (tmp_path / f"{record['sha256']}.png").exists()


# ---- the mirror ---------------------------------------------------------------------------------


@pytest.fixture(scope="module")
def scan() -> dict[str, Any]:
    return ingest_raster_bytes(png_with_dpi(crop(_sheet("r1", "s-10")), 300))


@pytest.mark.parametrize(
    ("change", "refusal"),
    [
        ({"dpi": None}, "null exactly when"),
        ({"dpi_source": "unstated"}, "null exactly when"),
        ({"dpi_source": "sheet"}, "outside the closed set"),
        ({"sha256": "A" * 64}, "lowercase hex"),
        ({"space": "Page 9"}, "names no layout"),
        ({"placement": [[0, 0]]}, "four corners"),
        ({"traced": -1}, "at least 0"),
        ({"image": "PDF_OBJECT:" + "A" * 64}, "names no IMAGE"),
        ({"note": 1}, "outside the closed set"),
    ],
)
def test_the_mirror_refuses_a_raster_record_it_cannot_read(
    scan: dict[str, Any], change: dict[str, Any], refusal: str
) -> None:
    parse_entity_graph(scan)
    broken = {**scan, "rasters": [{**scan["rasters"][0], **change}]}
    with pytest.raises(EntityGraphError, match=refusal):
        parse_entity_graph(broken)


def test_the_mirror_refuses_traced_lines_without_their_record_or_a_record_without_an_identity(
    scan: dict[str, Any],
) -> None:
    with pytest.raises(EntityGraphError, match="no traced picture's record"):
        parse_entity_graph({key: value for key, value in scan.items() if key != "rasters"})
    pdf_like = {**scan, "entities": [], "ingest": {**scan["ingest"], "scheme": keys.PDF_OBJECT}}
    with pytest.raises(EntityGraphError, match="no vectoriser's identity is pinned"):
        parse_entity_graph(pdf_like)
    with pytest.raises(EntityGraphError, match="never carries"):
        parse_entity_graph({k: v for k, v in scan.items() if k != "layers"} | {"entitygraph_version": 2})
