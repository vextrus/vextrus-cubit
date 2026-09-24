"""Vector PDF → EntityGraph v3, in one shot (R-TO-002, L-CAD-01 … L-CAD-05).

Each page is a sheet: a paper layout named by its page (`Page 1`, `Page 2` …), whose sheet number and
title the title-block grammar proposes in TypeScript like any other sheet's (L-CAD-01: this module
reads no meaning). pdfium reads the page (L-CAD-04's permissive reader) and every page object becomes
EntityGraph records under the vocabulary a DXF already speaks:

* a path → one LWPOLYLINE per subpath, Béziers flattened at the pinned page tolerance (I-511);
* a text → a TEXT at its baseline origin, its height the font size times the object matrix's own
  vertical scale — never the font size alone, which is text space (I-514);
* an image → an IMAGE at its placement, listed and never measured (I-515); a picture the raster lane
  takes for a scan — a whole-page image, or a grey one pasted onto a drawn page — is also TRACED, its
  lines RASTER_TRACE keys beside the page's PDF_OBJECT ones (R-TO-003's mixed page, I-585), and any
  other is counted on its page's `unread` tally so the card says it holds a picture nobody read
  (I-521);
* a Form XObject → an INSERT original naming its form's content digest, whose paint explodes into
  `derived`, each piece carrying `src` (L-CAD-03, I-516);
* an optional-content group → the layer (I-517).

Every original is keyed `PDF_OBJECT:<sha256>` over L-CAD-02's canonical string — page index, object
type, page-space geometry at 0.001 pt half-even, and for a text its string, anchor and height — so the
key names the object's content and never where in the file it was written. Two objects of one page
with one digest are one entity: the second collapses onto the first and is counted per page and type.

Page space is the page as it is shown (I-511): measured from the crop box's lower-left corner, with
the page's `/Rotate` applied, in PostScript points. Points are paper, not building, so the artifact
states no world unit (`units.page_space`, I-513) and a sheet's scale is a QS's to affirm.

A scanned set — every page one picture — is therefore traced page by page (I-585). A PDF none of
whose pages draws a path, a text or a traced line is refused by name: pictures and nothing read from
them (`PDF_RASTER_ONLY`), or nothing drawn at all (`PDF_NO_DRAWING`) — never stored as sheets that
look read and say nothing (I-521).
"""

from __future__ import annotations

import ctypes
import hashlib
import math
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

import numpy as np
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

from . import geometry, keys, raster, report, units
from .geometry import IDENTITY, Matrix, Point, apply, compose
from .ingest import ENTITYGRAPH_VERSION, IngestError, _Counters, _turn
from .parameters import (
    DERIVED_ENTITY_BUDGET,
    EXPLODE_DEPTH_CAP,
    FLATTEN_POINT_CAP,
    PDF_FLATTEN_TOLERANCE_PT,
    RASTER_EMBEDDED_MIN_PX,
    RASTER_EMBEDDED_PAGE_FRACTION,
    pdf_parameter_set_hash,
)

#: The scheme this lane mints, and the tool identity that scopes those keys (L-CAD-02).
SCHEME: Final = keys.PDF_OBJECT
TOOL: Final = "pypdfium2"

#: What each page is named as a layout: its place in the file, counted from one as a reader does.
#: The name is the sheet's address in the viewer; its number and title are the grammar's to read.
PAGE_LAYOUT: Final = "Page {number}"

#: The layer an object outside every optional-content group stands on — CAD's own default layer, the
#: one a DXF entity that names no layer stands on (I-517).
DEFAULT_LAYER: Final = "0"

#: pdfium's page object types.
_TEXT: Final = pdfium_c.FPDF_PAGEOBJ_TEXT
_PATH: Final = pdfium_c.FPDF_PAGEOBJ_PATH
_IMAGE: Final = pdfium_c.FPDF_PAGEOBJ_IMAGE
_SHADING: Final = pdfium_c.FPDF_PAGEOBJ_SHADING
_FORM: Final = pdfium_c.FPDF_PAGEOBJ_FORM

#: pdfium's bitmap formats, and how many bytes a pixel of each takes.
_CHANNELS: Final[dict[int, int]] = {
    pdfium_c.FPDFBitmap_Gray: 1,
    pdfium_c.FPDFBitmap_BGR: 3,
    pdfium_c.FPDFBitmap_BGRx: 4,
    pdfium_c.FPDFBitmap_BGRA: 4,
}

#: pdfium's path segment types.
_MOVETO: Final = pdfium_c.FPDF_SEGMENT_MOVETO
_LINETO: Final = pdfium_c.FPDF_SEGMENT_LINETO
_BEZIERTO: Final = pdfium_c.FPDF_SEGMENT_BEZIERTO

#: The canonical string's object-type words (L-CAD-02: "page index + object type + geometry").
_KIND_PATH: Final = "path"
_KIND_TEXT: Final = "text"
_KIND_IMAGE: Final = "image"
_KIND_FORM: Final = "form"

#: The EntityGraph type each object becomes.
LWPOLYLINE: Final = "LWPOLYLINE"
TEXT: Final = "TEXT"
IMAGE: Final = "IMAGE"
INSERT: Final = "INSERT"

#: What a smooth shading is tallied as on a page's `unread` counter: it becomes no entity, so it has
#: no EntityGraph type, and is named by what it is (I-521).
SHADING: Final = "SHADING"

#: The marked-content tag and property an optional-content group is named by.
_OPTIONAL_CONTENT: Final = "OC"
_OCG_NAME: Final = b"Name"

#: A text object's origin is the start of its baseline: left, on the baseline (DXF's codes 0, 0).
_LEFT: Final = 0
_BASELINE: Final = 0

#: What pdfium's text layer answers for a character it cannot map to Unicode.
_UNMAPPED: Final = 0
_REPLACEMENT: Final = "\N{REPLACEMENT CHARACTER}"

#: The paint a Form XObject states of its own: none — every piece it paints states its own colour, as
#: a DXF block's BYBLOCK paint takes its reference's (I-516).
_FORM_COLOUR: Final = {"rgb": [0, 0, 0], "source": "byblock"}

#: An image states no colour at all; its frame is drawn in the canvas ink (I-515).
_IMAGE_COLOUR: Final = {"rgb": [0, 0, 0], "source": "truecolor"}

def page_frame(rotation: int, box: tuple[float, float, float, float]) -> Matrix:
    """The transform from a page's own space into the page as shown (I-511): the crop box's
    lower-left corner at the origin, and the page's `/Rotate` — clockwise, in quarter turns — applied.
    """
    x0, y0, x1, y1 = box
    turned = rotation % 360
    if turned == 90:
        return (0.0, -1.0, 1.0, 0.0, -y0, x1)
    if turned == 180:
        return (-1.0, 0.0, 0.0, -1.0, x1, y1)
    if turned == 270:
        return (0.0, 1.0, -1.0, 0.0, y1, -x0)
    return (1.0, 0.0, 0.0, 1.0, -x0, -y0)


def _finite_point(point: Point) -> Point:
    if not (math.isfinite(point[0]) and math.isfinite(point[1])):
        raise ValueError(f"a page object stands at a non-finite point {point!r}")
    return point


def _wang_steps(p0: Point, p1: Point, p2: Point, p3: Point) -> int:
    """How many equal parameter steps flatten one cubic within the pinned tolerance — Wang's formula:
    n = ⌈√(3/4 · M / tolerance)⌉, M the larger second difference of the control polygon. Closed-form,
    so the same curve flattens to the same vertices on every machine."""
    second = max(
        math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]),
        math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]),
    )
    return max(1, math.ceil(math.sqrt(0.75 * second / PDF_FLATTEN_TOLERANCE_PT)))


def _cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: float) -> Point:
    mt = 1.0 - t
    a, b, c, d = mt * mt * mt, 3 * mt * mt * t, 3 * mt * t * t, t * t * t
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


@dataclass
class Subpath:
    """One subpath of a path object, resolved into some frame: its flattened vertices, whether it
    closes, and the canonical spelling of its segments (the digest's geometry)."""

    points: list[Point] = field(default_factory=list)
    tokens: list[str] = field(default_factory=list)
    closed: bool = False

    def canonical(self) -> str:
        return " ".join([*self.tokens, "Z"] if self.closed else self.tokens)


def subpaths(raw: Any, matrix: Matrix) -> list[Subpath]:
    """A path object's subpaths, every point taken through `matrix` (I-511).

    A subpath starts at each move-to; line-to adds a vertex; a Bézier (three pdfium segments: two
    control points and its end) is spelled whole in the canonical string and flattened into the
    vertices. A close flag ends the subpath closed. A subpath of one vertex paints nothing in PDF and
    is no atom.
    """
    found: list[Subpath] = []
    current: Subpath | None = None
    pending: list[Point] = []
    x = ctypes.c_float()
    y = ctypes.c_float()
    for index in range(pdfium_c.FPDFPath_CountSegments(raw)):
        segment = pdfium_c.FPDFPath_GetPathSegment(raw, index)
        pdfium_c.FPDFPathSegment_GetPoint(segment, x, y)
        kind = pdfium_c.FPDFPathSegment_GetType(segment)
        at = _finite_point(apply(matrix, float(x.value), float(y.value)))
        if kind == _MOVETO or current is None:
            if current is not None:
                found.append(current)
            current = Subpath(points=[at], tokens=[f"M {keys.point(*at)}"])
            pending = []
        elif kind == _LINETO:
            current.points.append(at)
            current.tokens.append(f"L {keys.point(*at)}")
        elif kind == _BEZIERTO:
            pending.append(at)
            if len(pending) == 3:
                start = current.points[-1]
                c1, c2, end = pending
                steps = _wang_steps(start, c1, c2, end)
                current.points.extend(
                    _cubic(start, c1, c2, end, step / steps) for step in range(1, steps + 1)
                )
                current.tokens.append(f"C {keys.point(*c1)} {keys.point(*c2)} {keys.point(*end)}")
                pending = []
        if pdfium_c.FPDFPathSegment_GetClose(segment):
            current.closed = True
    if current is not None:
        found.append(current)
    return [one for one in found if len(one.points) >= 2]


def _matrix(raw: Any) -> Matrix:
    held = pdfium_c.FS_MATRIX()
    if not pdfium_c.FPDFPageObj_GetMatrix(raw, held):
        return IDENTITY
    return (float(held.a), float(held.b), float(held.c), float(held.d), float(held.e), float(held.f))


def _address(raw: Any) -> int:
    return int(ctypes.cast(raw, ctypes.c_void_p).value or 0)


def _colour(raw: Any, stroked: bool) -> dict[str, Any]:
    """The colour an object paints in, as the PDF states it — an explicit RGB (I-516)."""
    r, g, b, a = ctypes.c_uint(), ctypes.c_uint(), ctypes.c_uint(), ctypes.c_uint()
    getter = pdfium_c.FPDFPageObj_GetStrokeColor if stroked else pdfium_c.FPDFPageObj_GetFillColor
    if not getter(raw, r, g, b, a):
        return {"rgb": [0, 0, 0], "source": "truecolor"}
    return {"rgb": [int(r.value) & 255, int(g.value) & 255, int(b.value) & 255], "source": "truecolor"}


def _is_stroked(raw: Any) -> bool:
    fill = ctypes.c_int()
    stroke = ctypes.c_int()
    if not pdfium_c.FPDFPath_GetDrawMode(raw, fill, stroke):
        return True
    return bool(stroke.value)


def _utf16(read: Callable[..., Any], *head: Any) -> str | None:
    """A UTF-16LE string pdfium writes into a buffer the caller sizes: asked once for the length."""
    size = ctypes.c_ulong()
    if not read(*head, None, 0, ctypes.byref(size)) or size.value < 2:
        return None
    buffer = (ctypes.c_ushort * (size.value // 2))()
    if not read(*head, buffer, size.value, ctypes.byref(size)):
        return None
    return bytes(buffer)[: max(size.value - 2, 0)].decode("utf-16-le", errors="replace")


def _layer(raw: Any, inherited: str) -> str:
    """The optional-content group an object is marked into, by its own name, or what it inherits."""
    for index in range(pdfium_c.FPDFPageObj_CountMarks(raw)):
        mark = pdfium_c.FPDFPageObj_GetMark(raw, index)
        if _utf16(pdfium_c.FPDFPageObjMark_GetName, mark) != _OPTIONAL_CONTENT:
            continue
        name = _utf16(pdfium_c.FPDFPageObjMark_GetParamStringValue, mark, _OCG_NAME)
        if name:
            return name
    return inherited


def _font_size(raw: Any) -> float:
    size = ctypes.c_float()
    if not pdfium_c.FPDFTextObj_GetFontSize(raw, ctypes.byref(size)):
        return 0.0
    return float(size.value)


def _bounds(raw: Any) -> tuple[float, float, float, float] | None:
    left, bottom, right, top = ctypes.c_float(), ctypes.c_float(), ctypes.c_float(), ctypes.c_float()
    if not pdfium_c.FPDFPageObj_GetBounds(raw, left, bottom, right, top):
        return None
    return (float(left.value), float(bottom.value), float(right.value), float(top.value))


def _overlap(one: tuple[float, float, float, float], other: tuple[float, float, float, float]) -> bool:
    return one[0] <= other[2] and other[0] <= one[2] and one[1] <= other[3] and other[1] <= one[3]


def text_layer(textpage: Any) -> dict[int, str]:
    """Each text object's own string, as pdfium's text layer reads the page (I-514).

    The layer is walked character by character, and every character the layer GENERATED — the spaces
    and line breaks it infers between objects — is left out, so a string is what its object says and
    nothing its neighbours imply. A character the font maps to no Unicode reads as U+FFFD: it was
    there, and it could not be read.
    """
    said: dict[int, list[str]] = {}
    for index in range(pdfium_c.FPDFText_CountChars(textpage)):
        if pdfium_c.FPDFText_IsGenerated(textpage, index) == 1:
            continue
        owner = _address(pdfium_c.FPDFText_GetTextObject(textpage, index))
        if owner == 0:
            continue
        code = int(pdfium_c.FPDFText_GetUnicode(textpage, index))
        said.setdefault(owner, []).append(_REPLACEMENT if code == _UNMAPPED else chr(code))
    return {owner: "".join(chars) for owner, chars in said.items()}


@dataclass
class _Container:
    """The text objects one container (a page, or one form) has shown so far, for the one case the
    text layer leaves an object without characters: pdfium drops a text that repeats an earlier one
    over itself — a doubled stroke for bold — so its string is that earlier object's."""

    shown: list[tuple[str, float, tuple[float, float, float, float]]] = field(default_factory=list)

    def recover(self, size: float, box: tuple[float, float, float, float] | None) -> str | None:
        if box is None:
            return None
        for string, held_size, held_box in reversed(self.shown):
            if held_size == size and _overlap(box, held_box):
                return string
        return None


@dataclass
class Atom:
    """One drawable piece of a page object, resolved in some frame: what it becomes in the artifact
    and how the canonical string spells it (without the page index, which the caller adds)."""

    type: str
    canonical: str
    record: dict[str, Any]
    points: list[Point]


@dataclass
class _Reader:
    """One page's reading: the text layer, what was decoded and how the texts were recovered."""

    strings: dict[int, str]
    undecoded: int = 0

    def text(self, raw: Any, container: _Container) -> str:
        address = _address(raw)
        size = _font_size(raw)
        box = _bounds(raw)
        string = self.strings.get(address)
        if string is None:
            string = container.recover(size, box)
        if string is None:
            self.undecoded += 1
            string = ""
        if box is not None:
            container.shown.append((string, size, box))
        return string

    def peek(self, raw: Any, container: _Container) -> str:
        """A text's string for a definition's digest — read as the paint walk reads it, without
        counting an undecoded text twice: the paint walk says so where it paints."""
        undecoded = self.undecoded
        string = self.text(raw, container)
        self.undecoded = undecoded
        return string


def _point_record(points: list[Point]) -> list[list[float]]:
    return [[geometry.quantise(x), geometry.quantise(y)] for x, y in points]


def _capped(points: list[Point]) -> tuple[list[Point], bool]:
    if len(points) <= FLATTEN_POINT_CAP:
        return points, False
    kept = geometry.capped_indices(len(points))
    return [point for index, point in enumerate(points) if index in kept], True


def path_atoms(raw: Any, matrix: Matrix, layer: str, capped: Callable[[str], None]) -> list[Atom]:
    """A path object's subpaths as LWPOLYLINE atoms (I-511)."""
    colour = _colour(raw, _is_stroked(raw))
    atoms: list[Atom] = []
    for subpath in subpaths(raw, compose(matrix, _matrix(raw))):
        points, was_capped = _capped(subpath.points)
        if was_capped:
            capped(LWPOLYLINE)
        spelled = _point_record(points)
        if subpath.closed and len(spelled) > 2 and spelled[0] == spelled[-1]:
            spelled = spelled[:-1]
        record: dict[str, Any] = {
            "type": LWPOLYLINE,
            "layer": layer,
            "colour": colour,
            "points": spelled,
            "closed": subpath.closed,
        }
        if subpath.closed and len(spelled) >= 3:
            record["area"] = geometry.shoelace_area([(x, y) for x, y in spelled])
        canonical = f"{_KIND_PATH}|{subpath.canonical()}"
        atoms.append(Atom(LWPOLYLINE, canonical, record, [(x, y) for x, y in spelled]))
    return atoms


def text_atom(raw: Any, matrix: Matrix, layer: str, string: str) -> Atom:
    """A text object as a TEXT atom: its baseline origin, its height and its turn (I-514)."""
    a, b, c, d, e, f = compose(matrix, _matrix(raw))
    anchor = _finite_point((e, f))
    height = abs(_font_size(raw) * math.hypot(c, d))
    if not math.isfinite(height):
        raise ValueError(f"a text stands at a non-finite height {height!r}")
    rotation = _turn(math.degrees(math.atan2(b, a))) if (a, b) != (0.0, 0.0) else 0.0
    record: dict[str, Any] = {
        "type": TEXT,
        "layer": layer,
        "colour": _colour(raw, False),
        "text": string,
        "height": geometry.quantise(height),
        "points": _point_record([anchor]),
        "rotation": rotation,
        "halign": _LEFT,
        "valign": _BASELINE,
    }
    canonical = f"{_KIND_TEXT}|{keys.point(*anchor)}|{keys.quantum(height)}|{string}"
    return Atom(TEXT, canonical, record, [anchor])


def image_atom(raw: Any, matrix: Matrix, layer: str) -> Atom:
    """An image object as an IMAGE atom: the four corners of its placement, listed and never measured
    (I-515). The frame is written OPEN, its first corner restated at its end so it still draws
    whole: a closed record is what every outline reader of the partition takes a member's section
    from, and a picture's edge is no member's (I-521). The key is the four corners, unmoved."""
    placed = compose(matrix, _matrix(raw))
    corners = [
        _finite_point(apply(placed, x, y)) for x, y in ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    ]
    record: dict[str, Any] = {
        "type": IMAGE,
        "layer": layer,
        "colour": dict(_IMAGE_COLOUR),
        "points": _point_record([*corners, corners[0]]),
        "closed": False,
    }
    canonical = f"{_KIND_IMAGE}|" + " ".join(keys.point(*corner) for corner in corners)
    return Atom(IMAGE, canonical, record, corners)


def placement(matrix: Matrix) -> dict[str, Any]:
    """A form's placement, spelled as a DXF block reference's is (I-416): where its origin lands, the
    world angle of its x axis, the length each axis is scaled to, and whether it reflects."""
    a, b, c, d, e, f = matrix
    at = _finite_point((e, f))
    heading = _turn(math.degrees(math.atan2(b, a))) if (a, b) != (0.0, 0.0) else 0.0
    return {
        "at": [geometry.quantise(at[0]), geometry.quantise(at[1])],
        "rotation": heading,
        "scale": [geometry.quantise(math.hypot(a, b)), geometry.quantise(math.hypot(c, d))],
        "mirrored": (a * d - b * c) < 0,
    }


def _placement_canonical(matrix: Matrix) -> str:
    """A placement as page-space geometry: where the form's origin and its two unit axes land."""
    return " ".join(keys.point(*apply(matrix, x, y)) for x, y in ((0.0, 0.0), (1.0, 0.0), (0.0, 1.0)))


def _children(raw: Any) -> Iterator[Any]:
    for index in range(pdfium_c.FPDFFormObj_CountObjects(raw)):
        child = pdfium_c.FPDFFormObj_GetObject(raw, index)
        if child:
            yield child


class _Page:
    """One page's extraction: its originals, its derived paint, its counters and extents."""

    def __init__(
        self,
        index: int,
        name: str,
        frame: Matrix,
        reader: _Reader,
        budget: list[int],
        area: float = 0.0,
        rasters: dict[str, bytes] | None = None,
    ) -> None:
        self.index = index
        self.name = name
        self.frame = frame
        self.reader = reader
        self.counters = _Counters(collapsed={}, unread={})
        self.entities: list[dict[str, Any]] = []
        self.derived: list[dict[str, Any]] = []
        self.boxes: list[tuple[float, float, float, float]] = []
        #: How many paths and texts this page drew — originals, collapses and a form's paint alike:
        #: the vector content a scanned page has none of (I-521).
        self.drawn = 0
        self._keys: set[str] = set()
        #: How much of the invocation's derived-entity budget is left, shared across pages.
        self._budget = budget
        #: The page's area in square points, which a picture's share of decides whether it is a scan.
        self._area = area
        #: The traced pictures' records, and the sink their page rasters go to under their sha256.
        self.traced: list[dict[str, Any]] = []
        self._rasters = rasters
        self._trace_keys: set[str] = set()

    def _box(self, points: list[Point]) -> None:
        box = geometry.bounds(points)
        if box is not None:
            self.boxes.append(box)

    def _original(self, atom: Atom) -> str | None:
        """Key an atom and keep it, or count it collapsed onto the earlier original with its digest."""
        key = keys.content_key(SCHEME, f"{self.index}|{atom.canonical}")
        if key in self._keys:
            self.counters.collapse(atom.type)
            return None
        self._keys.add(key)
        self.entities.append({"key": key, "space": self.name, **atom.record})
        self._box(atom.points)
        return key

    def read(self, raw: Any, container: _Container) -> None:
        """One top-level page object."""
        kind = pdfium_c.FPDFPageObj_GetType(raw)
        layer = _layer(raw, DEFAULT_LAYER)
        if kind == _PATH:
            for atom in path_atoms(raw, self.frame, layer, self.counters.cap):
                self.drawn += 1
                self._original(atom)
        elif kind == _TEXT:
            self.drawn += 1
            self._original(text_atom(raw, self.frame, layer, self.reader.text(raw, container)))
        elif kind == _IMAGE:
            key = self._original(image_atom(raw, self.frame, layer))
            if key is None or not self._trace(raw, key):
                self.counters.leave_unread(IMAGE)
        elif kind == _SHADING:
            self.counters.leave_unread(SHADING)
        elif kind == _FORM:
            self._form(raw, layer)

    def _trace(self, raw: Any, key: str) -> bool:
        """Trace a top-level picture the raster lane takes for a scan (I-585), minting its lines
        beside the page's own objects; False where it is no scan, and it stays a picture unread."""
        pixels = _image_pixels(raw)
        if pixels is None:
            return False
        grey, is_grey = pixels
        height, width = grey.shape
        if min(width, height) < RASTER_EMBEDDED_MIN_PX:
            return False
        placed = compose(self.frame, _matrix(raw))
        a, b, c, d, _, _ = placed
        share = abs(a * d - b * c) / self._area if self._area > 0 else 0.0
        if not is_grey and share < RASTER_EMBEDDED_PAGE_FRACTION:
            return False
        dpi = raster.placement_dpi(placed, width)
        traced = raster.trace(grey, dpi)
        to_page = raster.embedded_to_page(placed, width, height, traced)
        minted = raster.lines_on_page(traced, to_page, self.index, self.name, self._trace_keys, self.counters)
        self.entities.extend(minted.entities)
        self.boxes.extend(minted.boxes)
        self.drawn += len(minted.entities)
        page_raster = raster.png_bytes(traced.image)
        digest = hashlib.sha256(page_raster).hexdigest()
        if self._rasters is not None:
            self._rasters[digest] = page_raster
        source = raster.DPI_UNSTATED if dpi is None else raster.DPI_PLACEMENT
        corners = raster.canvas_corners(traced, to_page)
        self.traced.append(
            raster.raster_record(self.name, traced, digest, dpi, source, corners, len(minted.entities), key)
        )
        return True

    def _form(self, raw: Any, layer: str) -> None:
        """A Form XObject: an INSERT original naming its content, and its paint exploded (L-CAD-03)."""
        placed = compose(self.frame, _matrix(raw))
        digest = definition(raw, self.reader, 1)
        name = "XOBJECT" if digest is None else f"XOBJECT-{digest[:12].upper()}"
        canonical = f"{_KIND_FORM}|{_placement_canonical(placed)}|{digest or '-'}"
        record: dict[str, Any] = {
            "type": INSERT,
            "layer": layer,
            "colour": dict(_FORM_COLOUR),
            "block": {"name": name, "definition_sha256": digest, **placement(placed)},
        }
        key = self._original(Atom(INSERT, canonical, record, []))
        if key is not None:
            self._explode(raw, placed, key, layer, 1, _Container())

    def _explode(
        self, raw: Any, placed: Matrix, key: str, layer: str, depth: int, container: _Container
    ) -> None:
        """Paint a form's children into `derived`, each carrying `src` — for rendering only, under the
        depth cap and the derived-entity budget, every trip counted (L-CAD-03)."""
        for child in _children(raw):
            kind = pdfium_c.FPDFPageObj_GetType(child)
            if self._budget[0] <= 0:
                self.counters.lose(_ENTITY_TYPE.get(kind, "OTHER"))
                continue
            self._budget[0] -= 1
            own = _layer(child, layer)
            atoms: list[Atom] = []
            if kind == _PATH:
                atoms = path_atoms(child, placed, own, self.counters.cap)
                self.drawn += len(atoms)
            elif kind == _TEXT:
                atoms = [text_atom(child, placed, own, self.reader.text(child, container))]
                self.drawn += 1
            elif kind == _IMAGE:
                self.counters.leave_unread(IMAGE)
                atoms = [image_atom(child, placed, own)]
            elif kind == _SHADING:
                self.counters.leave_unread(SHADING)
            elif kind == _FORM:
                if depth + 1 > EXPLODE_DEPTH_CAP:
                    self.counters.lose(INSERT)
                    continue
                self._explode(child, compose(placed, _matrix(child)), key, own, depth + 1, _Container())
            for atom in atoms:
                self.derived.append({"src": key, "space": self.name, **atom.record})
                self._box(atom.points)


#: The EntityGraph type each pdfium object type becomes, for a loss counted before it was read.
_ENTITY_TYPE: Final[dict[int, str]] = {_PATH: LWPOLYLINE, _TEXT: TEXT, _IMAGE: IMAGE, _FORM: INSERT}


def definition(raw: Any, reader: _Reader, depth: int) -> str | None:
    """A form's content digest (I-516, after I-416): sha256 over the sorted multiset of its
    children's canonical strings in the FORM's own space — so the same symbol keeps the same digest
    wherever and however often it is placed — and over a nested form's own digest and placement. None
    where it nests past the explode depth cap, as a DXF block's is."""
    if depth > EXPLODE_DEPTH_CAP:
        return None
    items: list[str] = []
    container = _Container()
    for child in _children(raw):
        kind = pdfium_c.FPDFPageObj_GetType(child)
        if kind == _PATH:
            items.extend(atom.canonical for atom in path_atoms(child, IDENTITY, DEFAULT_LAYER, _ignore))
        elif kind == _TEXT:
            items.append(text_atom(child, IDENTITY, DEFAULT_LAYER, reader.peek(child, container)).canonical)
        elif kind == _IMAGE:
            items.append(image_atom(child, IDENTITY, DEFAULT_LAYER).canonical)
        elif kind == _FORM:
            nested = definition(child, reader, depth + 1)
            if nested is None:
                return None
            items.append(f"{_KIND_FORM}|{_placement_canonical(_matrix(child))}|{nested}")
    return hashlib.sha256("\n".join(sorted(items)).encode("utf-8")).hexdigest()


def _ignore(_type: str) -> None:
    """A cap trip met while digesting a definition: the paint walk counts it where it paints."""


def _image_pixels(raw: Any) -> tuple[np.ndarray, bool] | None:
    """An image object's own pixels, decoded at their own size (no page render, no mask applied), as
    8-bit grey with whether they were grey to begin with — or None where pdfium decodes none."""
    bitmap = pdfium_c.FPDFImageObj_GetBitmap(raw)
    if not bitmap:
        return None
    try:
        width = int(pdfium_c.FPDFBitmap_GetWidth(bitmap))
        height = int(pdfium_c.FPDFBitmap_GetHeight(bitmap))
        stride = int(pdfium_c.FPDFBitmap_GetStride(bitmap))
        channels = _CHANNELS.get(int(pdfium_c.FPDFBitmap_GetFormat(bitmap)))
        buffer = pdfium_c.FPDFBitmap_GetBuffer(bitmap)
        if channels is None or width <= 0 or height <= 0 or not buffer:
            return None
        flat = np.ctypeslib.as_array(
            ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)), shape=(height * stride,)
        )
        rows = flat.reshape(height, stride)[:, : width * channels].reshape(height, width, channels).copy()
    finally:
        pdfium_c.FPDFBitmap_Destroy(bitmap)
    if channels == 1:
        return np.ascontiguousarray(rows[:, :, 0]), True
    return raster.grey_of_bgr(rows[:, :, :3]), False


def _open(source: Path) -> Any:
    try:
        data = source.read_bytes()
    except OSError as error:
        raise IngestError(report.SOURCE_NOT_READABLE, str(error)) from error
    try:
        return pdfium.PdfDocument(data)
    except pdfium.PdfiumError as error:
        raise IngestError(report.PDF_UNREADABLE, f"pdfium cannot open it: {error}") from error


def _page_box(page: Any) -> tuple[float, float, float, float]:
    left, bottom, right, top = page.get_cropbox()
    return (float(left), float(bottom), float(right), float(top))


def ingest_document(
    document: Any, notes: report.Report, rasters: dict[str, bytes] | None = None
) -> dict[str, Any]:
    """The whole artifact for an opened PDF, with what it carries but does not draw written into
    `notes` (L-CAD-04: never a silent loss), and each traced picture's page raster put in `rasters`
    under its sha256."""
    pages: list[_Page] = []
    dropped: list[str] = []
    budget = [DERIVED_ENTITY_BUDGET]
    undecoded = 0
    drawn = 0
    for index in range(len(document)):
        page = document[index]
        textpage = page.get_textpage()
        try:
            box = _page_box(page)
            frame = page_frame(int(page.get_rotation()), box)
            reading = _Page(
                index,
                PAGE_LAYOUT.format(number=index + 1),
                frame,
                _Reader(text_layer(textpage.raw)),
                budget,
                area=abs((box[2] - box[0]) * (box[3] - box[1])),
                rasters=rasters,
            )
            container = _Container()
            for position in range(pdfium_c.FPDFPage_CountObjects(page.raw)):
                reading.read(pdfium_c.FPDFPage_GetObject(page.raw, position), container)
        finally:
            textpage.close()
            page.close()
        undecoded += reading.reader.undecoded
        drawn += reading.drawn
        # A page with nothing on it is inventory, not a sheet: dropped and counted, as a DXF's is.
        if not reading.entities and not reading.derived:
            dropped.append(reading.name)
            continue
        pages.append(reading)

    _say(pages, undecoded, notes)
    traced = [record for page in pages for record in page.traced]
    raster.said(traced, notes)
    if drawn == 0:
        _refuse_undrawn(len(document), pages)
    layers = sorted({record["layer"] for page in pages for record in (*page.entities, *page.derived)})
    layouts = []
    for page in pages:
        box, strays = geometry.robust_extents(page.boxes)
        layouts.append(
            {
                "name": page.name,
                "kind": "paper",
                "bbox": None if box is None else {"max": [box[2], box[3]], "min": [box[0], box[1]]},
                "strays_rejected": strays,
                "viewports": [],
            }
        )
    ingest: dict[str, Any] = {
        "parameter_set_hash": pdf_parameter_set_hash(),
        "scheme": SCHEME,
        "tool": TOOL,
        "tool_version": pdfium.version.PYPDFIUM_INFO.version,
    }
    # The vectoriser's identity rides beside pdfium's only where it traced something, and the raster
    # records with it: a PDF with no scan on it spells the bytes it always did (I-518).
    extra: dict[str, Any] = {}
    if traced:
        ingest["trace"] = raster.identity()
        extra["rasters"] = traced
    return {
        "block_attributes": [],
        "counters": [page.counters.record(page.name) for page in pages],
        "derived": [record for page in pages for record in page.derived],
        "dropped_layouts": dropped,
        "entities": [record for page in pages for record in page.entities],
        "entitygraph_version": ENTITYGRAPH_VERSION,
        "ingest": ingest,
        "insunits": units.page_space(),
        # Restated as on and plotted: pdfium exposes no reading of a file's optional-content
        # configuration, and a plotted set shows every group it carries (I-517).
        "layers": [{"name": name, "on": True, "frozen": False, "plot": True} for name in layers],
        "layouts": layouts,
        **extra,
    }


def _refuse_undrawn(page_count: int, pages: list[_Page]) -> None:
    """A PDF that draws no path, no text and no traced line on any page is refused by name (I-521):
    pictures the raster lane took for no scan, or traced to nothing, stored as sheets would be blank
    cards that look read — and a file with nothing drawn has no sheet to show."""
    images = sum((page.counters.unread or {}).get(IMAGE, 0) for page in pages)
    if images:
        raise IngestError(
            report.PDF_RASTER_ONLY,
            f"{page_count} page(s) holding {images} image(s) and no path, text or traced line: pictures"
            " the raster lane takes for no scan, or traced to nothing (R-TO-003, I-585)",
        )
    raise IngestError(
        report.PDF_NO_DRAWING, f"{page_count} page(s) and no path, text or image drawn on any of them"
    )


def _say(pages: list[_Page], undecoded: int, notes: report.Report) -> None:
    """What the run collapsed, listed and could not take, once each (L-CAD-04)."""
    collapsed: list[str] = []
    total = 0
    for page in pages:
        tally = page.counters.collapsed or {}
        if tally:
            collapsed.append(
                f"{page.name}: " + ", ".join(f"{count} {kind}" for kind, count in sorted(tally.items()))
            )
            total += sum(tally.values())
    if total:
        notes.add(report.OBJECTS_COLLAPSED, "; ".join(collapsed), total)
    images = sum((page.counters.unread or {}).get(IMAGE, 0) for page in pages)
    if images:
        notes.add(
            report.EMBEDDED_IMAGE,
            f"{images} embedded image(s) listed at their placement, none of their pixels taken as geometry",
            images,
        )
    shadings = sum((page.counters.unread or {}).get(SHADING, 0) for page in pages)
    if shadings:
        notes.add(report.SHADING_NOT_TAKEN, f"{shadings} carried, none turned into geometry", shadings)
    if undecoded:
        notes.add(
            report.TEXT_NOT_DECODED,
            f"{undecoded} text object(s) pdfium's text layer carries no character of, taken with no words",
            undecoded,
        )


def ingest_pdf(
    source: Path, notes: report.Report | None = None, rasters: dict[str, bytes] | None = None
) -> dict[str, Any]:
    """Read a PDF and return its EntityGraph v3 artifact, its traced pictures' page rasters put in
    `rasters`, or refuse it by name (L-CAD-04)."""
    notes = report.Report() if notes is None else notes
    document = _open(source)
    try:
        return ingest_document(document, notes, rasters)
    except (ValueError, ArithmeticError, pdfium.PdfiumError) as error:
        # A page object this lane cannot read through — a coordinate that leaves the finite world, a
        # page pdfium cannot load — refuses the file by name rather than writing half an artifact.
        raise IngestError(report.PDF_UNEXTRACTABLE, f"unextractable PDF: {error}") from error
    finally:
        document.close()
