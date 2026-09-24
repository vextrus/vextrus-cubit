"""Scans → traced lines, in one shot (R-TO-003, L-CAD-01 … L-CAD-05, I-584).

A scan is a picture of a drawing, and nothing in a picture is geometry until something traces it. This
module is that something: a pinned, classical, deterministic vectoriser (L-CAD-04: "raster via a
pinned classical-CV vectoriser") — OpenCV's line segment detector over a deskewed, cleaned page — and
it stops there (L-CAD-01): it reads no meaning, and what it traces is INTERPRETED wherever it is ever
measured (R-TO-003, L-QTY-01).

The pipeline, every knob of it in the raster parameter set (`parameters.py`):

1. **Decode** to 8-bit grey (PNG, JPEG, TIFF; or the pixels of an image on a PDF page).
2. **Deskew.** The page's dominant near-axis direction is read by the detector on a reduced copy, from
   the long lines near either axis, as a length-weighted histogram peak refined by its local mean, and
   rounded to 0.01° before any pixel moves; the page is turned back by that angle onto a canvas that
   holds all of it. A page skewed less than 0.05° is left unturned.
3. **Denoise.** A 3-by-3 median, then a 2-by-2 grey opening.
4. **Detect.** LSD with standard refinement, and every line shorter than a millimetre of paper
   dropped and counted.

A traced line is a LINE record in PAGE space — PostScript points, as a PDF page's are, so a scan and
its vector twin share a frame — keyed `RASTER_TRACE:<sha256>` over L-CAD-02's canonical string: the
page index, `line`, and its two ends at 0.001 pt half-even in ascending order. Two lines of one page
with one digest are one entity, the second counted collapsed.

Each traced picture carries a raster record (`rasters[]`): its page, the sha256 of the page raster the
lines were taken from — written beside the artifact by the CLI, the very pixels the viewer will paint
under the trace (I-584) — its size, its DPI and where that DPI came from, the deskew it was turned
by, the page-space corners it stands at, and how many lines it gave and dropped.

Determinism: one thread and OpenCV's runtime CPU dispatch off, both pinned in the parameter set, so
two runs over the same bytes give the same key multiset (L-CAD-02's torture corpus,
`cad/tests/test_raster_determinism.py`). Moving OpenCV, numpy or any parameter is a declared re-ingest.
"""

from __future__ import annotations

import hashlib
import math
import struct
from dataclasses import dataclass, field
from importlib.metadata import version
from pathlib import Path
from typing import Any, Final

import cv2
import numpy as np

from . import geometry, keys, report, units
from .geometry import Matrix, Point, apply, compose, invert
from .ingest import ENTITYGRAPH_VERSION, IngestError, _Counters
from .parameters import (
    RASTER_LSD_ANG_TH,
    RASTER_LSD_DENSITY_TH,
    RASTER_LSD_LOG_EPS,
    RASTER_LSD_N_BINS,
    RASTER_LSD_QUANT,
    RASTER_LSD_SCALE,
    RASTER_LSD_SIGMA_SCALE,
    RASTER_MEDIAN_KSIZE,
    RASTER_MIN_LINE_MM,
    RASTER_MIN_LINE_PX_UNSTATED,
    RASTER_OPEN_KSIZE,
    RASTER_PNG_COMPRESSION,
    RASTER_SKEW_BIN_DEG,
    RASTER_SKEW_MIN_LINE_PX,
    RASTER_SKEW_RANGE_DEG,
    RASTER_SKEW_REFINE_DEG,
    RASTER_SKEW_SAMPLE_PX,
    RASTER_SKEW_SMOOTH_BINS,
    RASTER_SKEW_STEP_DEG,
    RASTER_SKEW_THRESHOLD_DEG,
    RASTER_THREADS,
    RASTER_USE_OPTIMIZED,
    raster_parameter_set_hash,
)

#: The scheme this lane mints, and the tool whose identity scopes those keys (L-CAD-02).
SCHEME: Final = keys.RASTER_TRACE
TOOL: Final = "opencv-lsd"

#: The distribution whose version is the tool's version: the wheel's own, four parts, never the
#: three `cv2.__version__` says — two builds of one OpenCV are two vectorisers.
_DISTRIBUTION: Final = "opencv-python-headless"

#: What a traced line is, and the layer every traced line stands on — its own, so a reader can show
#: or hide the trace apart from the page's vector paint.
LINE: Final = "LINE"
TRACE_LAYER: Final = "TRACE"

#: A traced line is drawn in the canvas ink, as a listed image's frame is (I-515).
_TRACE_COLOUR: Final = {"rgb": [0, 0, 0], "source": "truecolor"}

#: The canonical string's object-type word for a traced line.
_KIND_LINE: Final = "line"

#: A standalone scan is one page, named as a PDF's first page is.
PAGE_ONE: Final = "Page 1"

#: Where a raster's DPI came from (I-584): the file's own resolution tag, or the size its picture
#: is placed at on a PDF page — or nowhere, unstated, and then its page space is its pixels. It is
#: never guessed from the pixels' proportions: every ISO A sheet shares one, so the same pixels are
#: an A1 at 300 DPI and an A3 at 600, and a DPI printed on a card is a fact or it is not printed.
DPI_FILE: Final = "file"
DPI_PLACEMENT: Final = "placement"
DPI_UNSTATED: Final = "unstated"
DPI_SOURCES: Final[tuple[str, ...]] = (DPI_FILE, DPI_PLACEMENT, DPI_UNSTATED)

#: A resolution tag outside this window is a file's nonsense, not a scan's DPI.
_DPI_WINDOW: Final = (10.0, 10000.0)

_MM_PER_INCH: Final = 25.4
_PT_PER_INCH: Final = 72.0

#: The magic numbers a raster file is known by (the CLI's door, `cli.py`).
PNG_MAGIC: Final = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC: Final = b"\xff\xd8\xff"
TIFF_MAGICS: Final[tuple[bytes, ...]] = (b"II*\x00", b"MM\x00*")
RASTER_SUFFIXES: Final = frozenset({".png", ".jpg", ".jpeg", ".tif", ".tiff"})


def is_raster(head: bytes) -> bool:
    """Is this the head of a file this lane reads — PNG, JPEG or TIFF?"""
    return head.startswith(PNG_MAGIC) or head.startswith(JPEG_MAGIC) or head[:4] in TIFF_MAGICS


def identity() -> dict[str, str]:
    """The vectoriser's identity: its tool, the wheel's version and the raster parameter set's hash."""
    return {
        "tool": TOOL,
        "tool_version": version(_DISTRIBUTION),
        "parameter_set_hash": raster_parameter_set_hash(),
    }


def _pin() -> None:
    """The determinism pins, set before any pixel is touched: one thread, no runtime CPU dispatch."""
    cv2.setNumThreads(RASTER_THREADS)
    cv2.setUseOptimized(RASTER_USE_OPTIMIZED)


def _detector() -> Any:
    return cv2.createLineSegmentDetector(
        cv2.LSD_REFINE_STD,
        RASTER_LSD_SCALE,
        RASTER_LSD_SIGMA_SCALE,
        RASTER_LSD_QUANT,
        RASTER_LSD_ANG_TH,
        RASTER_LSD_LOG_EPS,
        RASTER_LSD_DENSITY_TH,
        RASTER_LSD_N_BINS,
    )


def _segments(image: np.ndarray) -> np.ndarray:
    """The detector's lines over one grey image, as an N-by-4 float64 array of (x1, y1, x2, y2)."""
    found = _detector().detect(image)[0]
    if found is None:
        return np.zeros((0, 4), dtype=np.float64)
    return found.reshape(-1, 4).astype(np.float64)


# ---- decode and DPI ----------------------------------------------------------------------------


def decode(data: bytes, name: str) -> np.ndarray:
    """A raster file's pixels as 8-bit grey, or a refusal naming it (L-CAD-04)."""
    _pin()
    pixels = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    if pixels is None or pixels.size == 0:
        raise IngestError(report.RASTER_UNREADABLE, f"OpenCV cannot decode {name} as an image")
    return np.ascontiguousarray(pixels)


def grey_of_bgr(pixels: np.ndarray) -> np.ndarray:
    """A colour picture's pixels (blue, green, red) as the 8-bit grey the trace reads."""
    _pin()
    return np.ascontiguousarray(cv2.cvtColor(np.ascontiguousarray(pixels), cv2.COLOR_BGR2GRAY))


def _plausible(dpi: float) -> float | None:
    if not math.isfinite(dpi) or not _DPI_WINDOW[0] <= dpi <= _DPI_WINDOW[1]:
        return None
    return round(dpi, 2)


def _png_dpi(data: bytes) -> float | None:
    at = len(PNG_MAGIC)
    while at + 8 <= len(data):
        (length,) = struct.unpack(">I", data[at : at + 4])
        kind = data[at + 4 : at + 8]
        body = data[at + 8 : at + 8 + length]
        if kind == b"pHYs" and len(body) == 9:
            per_unit, _, unit = struct.unpack(">IIB", body)
            # Unit 1 is the metre; 0 states an aspect ratio and no resolution at all.
            return _plausible(per_unit * 0.0254) if unit == 1 else None
        if kind in (b"IDAT", b"IEND"):
            return None
        at += 12 + length
    return None


def _jpeg_dpi(data: bytes) -> float | None:
    at = 2
    while at + 4 <= len(data) and data[at] == 0xFF:
        marker = data[at + 1]
        (length,) = struct.unpack(">H", data[at + 2 : at + 4])
        body = data[at + 4 : at + 2 + length]
        if marker == 0xE0 and body[:5] == b"JFIF\x00" and len(body) >= 12:
            unit = body[7]
            (density,) = struct.unpack(">H", body[8:10])
            # Unit 1 is dots per inch and 2 dots per centimetre; 0 states an aspect ratio only.
            if unit == 1:
                return _plausible(float(density))
            if unit == 2:
                return _plausible(density * 2.54)
            return None
        if marker in (0xDA, 0xD9):
            return None
        at += 2 + length
    return None


def _tiff_dpi(data: bytes) -> float | None:
    order = "<" if data[:2] == b"II" else ">"
    try:
        (offset,) = struct.unpack(f"{order}I", data[4:8])
        (count,) = struct.unpack(f"{order}H", data[offset : offset + 2])
        resolution: float | None = None
        unit = 2
        for index in range(count):
            entry = data[offset + 2 + 12 * index : offset + 14 + 12 * index]
            tag, kind, _, value = struct.unpack(f"{order}HHI4s", entry)
            if tag == 282 and kind == 5:
                (at,) = struct.unpack(f"{order}I", value)
                numerator, denominator = struct.unpack(f"{order}II", data[at : at + 8])
                resolution = numerator / denominator if denominator else None
            elif tag == 296 and kind == 3:
                (unit,) = struct.unpack(f"{order}H", value[:2])
    except struct.error:
        return None
    if resolution is None:
        return None
    # ResolutionUnit 2 is the inch (TIFF's default) and 3 the centimetre; 1 states no unit.
    if unit == 2:
        return _plausible(resolution)
    if unit == 3:
        return _plausible(resolution * 2.54)
    return None


def file_dpi(data: bytes) -> float | None:
    """The resolution a raster file states of itself — PNG `pHYs`, JPEG JFIF density, TIFF
    `XResolution` — in dots per inch, or None where it states none."""
    if data.startswith(PNG_MAGIC):
        return _png_dpi(data)
    if data.startswith(JPEG_MAGIC):
        return _jpeg_dpi(data)
    if data[:4] in TIFF_MAGICS:
        return _tiff_dpi(data)
    return None


# ---- deskew, clean, detect -----------------------------------------------------------------------


def skew_of(grey: np.ndarray) -> float:
    """The page's skew in degrees, counter-clockwise as a reader sees the sheet turned, rounded to
    the pinned step; 0 where too few long near-axis lines stand to say."""
    _pin()
    height, width = grey.shape
    factor = min(1.0, RASTER_SKEW_SAMPLE_PX / max(height, width))
    sample = grey
    if factor < 1.0:
        size = (max(1, round(width * factor)), max(1, round(height * factor)))
        sample = cv2.resize(grey, size, interpolation=cv2.INTER_AREA)
    lines = _segments(sample)
    if len(lines) == 0:
        return 0.0
    dx = lines[:, 2] - lines[:, 0]
    dy = lines[:, 3] - lines[:, 1]
    length = np.hypot(dx, dy)
    # Image rows run down the page, so a line a reader sees turned counter-clockwise climbs to the
    # right with a NEGATIVE row step; folding by a quarter turn puts verticals with horizontals.
    angle = (np.degrees(np.arctan2(-dy, dx)) + 45.0) % 90.0 - 45.0
    kept = (length >= RASTER_SKEW_MIN_LINE_PX) & (np.abs(angle) <= RASTER_SKEW_RANGE_DEG)
    if not np.any(kept):
        return 0.0
    angle, length = angle[kept], length[kept]
    bins = round(2 * RASTER_SKEW_RANGE_DEG / RASTER_SKEW_BIN_DEG)
    weights, edges = np.histogram(
        angle, bins=bins, range=(-RASTER_SKEW_RANGE_DEG, RASTER_SKEW_RANGE_DEG), weights=length
    )
    smoothed = np.convolve(weights, np.ones(RASTER_SKEW_SMOOTH_BINS), mode="same")
    peak = int(np.argmax(smoothed))
    centre = (edges[peak] + edges[peak + 1]) / 2.0
    near = np.abs(angle - centre) <= RASTER_SKEW_REFINE_DEG
    refined = float(np.sum(angle[near] * length[near]) / np.sum(length[near]))
    steps = round(refined / RASTER_SKEW_STEP_DEG)
    return round(steps * RASTER_SKEW_STEP_DEG, 2) + 0.0


def deskew(grey: np.ndarray, degrees: float) -> tuple[np.ndarray, Matrix, float]:
    """The page turned back by its skew onto a canvas that holds all of it, the map from the scan's
    pixels to the turned canvas's, and the turn applied — 0 where the skew is under the threshold."""
    _pin()
    if abs(degrees) < RASTER_SKEW_THRESHOLD_DEG:
        return grey, geometry.IDENTITY, 0.0
    height, width = grey.shape
    theta = math.radians(degrees)
    cos, sin = abs(math.cos(theta)), abs(math.sin(theta))
    turned_width = round(width * cos + height * sin)
    turned_height = round(width * sin + height * cos)
    # A reader's clockwise turn by `degrees` in row-down pixels: x' = c·x - s·y, y' = s·x + c·y about
    # the page's centre, landing at the new canvas's centre.
    c, s = math.cos(theta), math.sin(theta)
    cx, cy = width / 2.0, height / 2.0
    tx, ty = turned_width / 2.0, turned_height / 2.0
    forward: Matrix = (c, s, -s, c, tx - (c * cx - s * cy), ty - (s * cx + c * cy))
    a, b, cc, d, e, f = forward
    warp = np.array([[a, cc, e], [b, d, f]], dtype=np.float64)
    turned = cv2.warpAffine(
        grey,
        warp,
        (turned_width, turned_height),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=255,
    )
    return np.ascontiguousarray(turned), forward, degrees


def clean(grey: np.ndarray) -> np.ndarray:
    """The pinned denoise: a median, then a grey opening."""
    _pin()
    median = cv2.medianBlur(grey, RASTER_MEDIAN_KSIZE)
    kernel = np.ones((RASTER_OPEN_KSIZE, RASTER_OPEN_KSIZE), dtype=np.uint8)
    return np.ascontiguousarray(cv2.morphologyEx(median, cv2.MORPH_OPEN, kernel))


def min_line_px(dpi: float | None) -> float:
    """The shortest line kept, in this raster's pixels."""
    return RASTER_MIN_LINE_PX_UNSTATED if dpi is None else RASTER_MIN_LINE_MM * dpi / _MM_PER_INCH


@dataclass
class Traced:
    """One picture's trace: the pixels it was taken from (deskewed and cleaned), the map from the
    ORIGINAL picture's pixels to those, the turn applied, the lines kept and how many were dropped."""

    image: np.ndarray
    forward: Matrix
    skew: float
    segments: np.ndarray
    dropped_short: int


def trace(grey: np.ndarray, dpi: float | None) -> Traced:
    """Deskew, clean and detect over one grey picture (the pipeline this module's docstring states)."""
    turned, forward, applied = deskew(grey, skew_of(grey))
    cleaned = clean(turned)
    lines = _segments(cleaned)
    length = np.hypot(lines[:, 2] - lines[:, 0], lines[:, 3] - lines[:, 1])
    keep = length >= min_line_px(dpi)
    return Traced(cleaned, forward, applied, lines[keep], int(np.count_nonzero(~keep)))


def png_bytes(image: np.ndarray) -> bytes:
    """The page raster as the CLI writes it: a grey PNG at the pinned compression."""
    _pin()
    ok, encoded = cv2.imencode(".png", image, [cv2.IMWRITE_PNG_COMPRESSION, RASTER_PNG_COMPRESSION])
    if not ok:
        raise ValueError("OpenCV could not encode the page raster as PNG")
    return encoded.tobytes()


# ---- traced lines as EntityGraph records ---------------------------------------------------------


def canonical_line(start: Point, end: Point) -> str:
    """A traced line's geometry as the canonical string spells it: both ends at 0.001 pt half-even,
    in ascending order, so the detector's direction takes no part in the key."""
    ends = sorted((keys.point(*start), keys.point(*end)))
    return f"{_KIND_LINE}|{ends[0]} {ends[1]}"


@dataclass
class Minted:
    """What one picture's lines became on one page: its records, and how many collapsed."""

    entities: list[dict[str, Any]] = field(default_factory=list)
    boxes: list[tuple[float, float, float, float]] = field(default_factory=list)


def lines_on_page(
    traced: Traced,
    to_page: Matrix,
    page_index: int,
    space: str,
    held: set[str],
    counters: _Counters,
) -> Minted:
    """Each kept line mapped into page space and keyed; a line whose digest the page already holds
    collapses onto it and is counted (L-CAD-02)."""
    minted = Minted()
    for x1, y1, x2, y2 in traced.segments.tolist():
        start = apply(to_page, x1, y1)
        end = apply(to_page, x2, y2)
        key = keys.content_key(SCHEME, f"{page_index}|{canonical_line(start, end)}")
        if key in held:
            counters.collapse(LINE)
            continue
        held.add(key)
        points = [[geometry.quantise(start[0]), geometry.quantise(start[1])],
                  [geometry.quantise(end[0]), geometry.quantise(end[1])]]
        minted.entities.append(
            {
                "key": key,
                "space": space,
                "type": LINE,
                "layer": TRACE_LAYER,
                "colour": dict(_TRACE_COLOUR),
                "points": points,
            }
        )
        minted.boxes.append(
            (min(start[0], end[0]), min(start[1], end[1]), max(start[0], end[0]), max(start[1], end[1]))
        )
    return minted


def canvas_corners(traced: Traced, to_page: Matrix) -> list[Point]:
    """Where the page raster's four corners stand in page space: top-left, top-right, bottom-right,
    bottom-left of the picture as written."""
    height, width = traced.image.shape
    return [apply(to_page, x, y) for x, y in ((0.0, 0.0), (width, 0.0), (width, height), (0.0, height))]


def raster_record(
    space: str,
    traced: Traced,
    raster_sha256: str,
    dpi: float | None,
    dpi_source: str,
    corners: list[Point],
    traced_lines: int,
    image_key: str | None,
) -> dict[str, Any]:
    """One traced picture's record (`rasters[]`): what the card and the viewer read of it."""
    height, width = traced.image.shape
    record: dict[str, Any] = {
        "space": space,
        "sha256": raster_sha256,
        "width": int(width),
        "height": int(height),
        "dpi": dpi,
        "dpi_source": dpi_source,
        "deskew_degrees": traced.skew,
        "placement": [[geometry.quantise(x), geometry.quantise(y)] for x, y in corners],
        "traced": traced_lines,
        "dropped_short": traced.dropped_short,
    }
    if image_key is not None:
        record["image"] = image_key
    return record


def pixels_to_unit(width: int, height: int) -> Matrix:
    """A picture's pixels (rows down) onto PDF's image space: the unit square, its first row on top."""
    return (1.0 / width, 0.0, 0.0, -1.0 / height, 0.0, 1.0)


def said(records: list[dict[str, Any]], notes: report.Report) -> None:
    """The traced rasters on the run's stream, once each (L-CAD-04: what was interpreted is named)."""
    if not records:
        return
    described = []
    for record in records:
        dpi = "DPI unstated" if record["dpi"] is None else f"{record['dpi']:g} DPI ({record['dpi_source']})"
        described.append(
            f"{record['space']}: {record['traced']} line(s), {record['dropped_short']} shorter than"
            f" {RASTER_MIN_LINE_MM:g} mm dropped, deskewed {record['deskew_degrees']:g}°, {dpi}"
        )
    notes.add(report.RASTER_TRACED, "; ".join(described), len(records))
    unstated = [record["space"] for record in records if record["dpi"] is None]
    if unstated:
        notes.add(
            report.RASTER_DPI_UNSTATED,
            f"{', '.join(unstated)}: the file states no resolution — its page space is its pixels",
            len(unstated),
        )


# ---- a raster file, whole --------------------------------------------------------------------------


def ingest_raster(
    source: Path, notes: report.Report | None = None, rasters: dict[str, bytes] | None = None
) -> dict[str, Any]:
    """Read a scan — PNG, JPEG or TIFF, one page — and return its EntityGraph v3 artifact, the page
    raster its lines were taken from put in `rasters` under its sha256, or refuse it by name."""
    notes = report.Report() if notes is None else notes
    try:
        data = source.read_bytes()
    except OSError as error:
        raise IngestError(report.SOURCE_NOT_READABLE, str(error)) from error
    grey = decode(data, source.name)
    height, width = grey.shape
    dpi = file_dpi(data)
    dpi_source = DPI_UNSTATED if dpi is None else DPI_FILE

    traced = trace(grey, dpi)
    scale = 1.0 if dpi is None else _PT_PER_INCH / dpi
    turned_height = traced.image.shape[0]
    # The page is the turned canvas, upright, in points from its lower-left corner.
    to_page: Matrix = (scale, 0.0, 0.0, -scale, 0.0, turned_height * scale)
    counters = _Counters(collapsed={})
    minted = lines_on_page(traced, to_page, 0, PAGE_ONE, set(), counters)
    if not minted.entities:
        raise IngestError(
            report.RASTER_NO_LINE,
            f"{source.name}: {width} by {height} px decoded and no line at least"
            f" {RASTER_MIN_LINE_MM:g} mm long traced ({traced.dropped_short} shorter dropped)",
        )
    raster = png_bytes(traced.image)
    digest = hashlib.sha256(raster).hexdigest()
    if rasters is not None:
        rasters[digest] = raster
    corners = canvas_corners(traced, to_page)
    record = raster_record(
        PAGE_ONE, traced, digest, dpi, dpi_source, corners, len(minted.entities), None
    )
    said([record], notes)
    if counters.collapsed:
        notes.add(
            report.OBJECTS_COLLAPSED,
            f"{PAGE_ONE}: {counters.collapsed.get(LINE, 0)} {LINE}",
            sum(counters.collapsed.values()),
        )
    box, strays = geometry.robust_extents([*minted.boxes, _box_of(corners)])
    return {
        "block_attributes": [],
        "counters": [counters.record(PAGE_ONE)],
        "derived": [],
        "dropped_layouts": [],
        "entities": minted.entities,
        "entitygraph_version": ENTITYGRAPH_VERSION,
        "ingest": {"scheme": SCHEME, **identity()},
        "insunits": units.page_space(),
        "layers": [{"name": TRACE_LAYER, "on": True, "frozen": False, "plot": True}],
        "layouts": [
            {
                "name": PAGE_ONE,
                "kind": "paper",
                "bbox": None if box is None else {"max": [box[2], box[3]], "min": [box[0], box[1]]},
                "strays_rejected": strays,
                "viewports": [],
            }
        ],
        "rasters": [record],
    }


def _box_of(points: list[Point]) -> tuple[float, float, float, float]:
    box = geometry.bounds(points)
    assert box is not None
    return box


def embedded_to_page(placed: Matrix, width: int, height: int, traced: Traced) -> Matrix:
    """The map from an embedded picture's TRACED pixels to page space: back through the deskew onto
    the picture's own pixels, onto its unit square, and through its placement on the page."""
    return compose(placed, compose(pixels_to_unit(width, height), invert(traced.forward)))


def placement_dpi(placed: Matrix, width: int) -> float | None:
    """The DPI a picture is placed at on paper: its pixels across over its placed width in inches."""
    a, b, *_ = placed
    inches = math.hypot(a, b) / _PT_PER_INCH
    return None if inches == 0.0 else _plausible(width / inches)
