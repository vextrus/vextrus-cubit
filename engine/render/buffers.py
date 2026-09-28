"""Per-sheet render buffers: what the sheet viewer (16) draws and the engine raster rasterises.

`build(artefact, sheet)` is the stage the harness calls (the M0 plan's contract): one sheet's drawing,
already placed, cut, laid out and tessellated, in **paper millimetres from the sheet's lower-left
corner** (sheet-local, so float32 keeps a hundredth of a millimetre on an A0). The browser parses no
drawing file and lays out no text (m0-screens 4.6, "How the sheet is drawn").

What a sheet holds
------------------
- **Its space and paper.** A sheet in a layout draws that layout (its viewports showing model space,
  scaled, turned by their twist and cut to their rectangles); its paper is the layout's used extents
  in its units (`paper_source` 0). A sheet in model space draws what lies in its box, cut to it. Its
  paper is a standard sheet (ISO A0-A5, ANSI A-E, ARCH A-E1) when the box is one, within 0.5 %, at a
  standard scale (`paper_source` 1); otherwise its long side is taken as A1's 841 mm (`paper_source`
  2), since the ReadArtefact carries neither the frame's insert scale nor the plot's settings.
- **Thin lines** (`LINE`): one record per segment, drawn by the viewer as GL_LINES or quads by its
  lineweight at the current zoom (m0-screens 4.6, ruling 2), with the entity's lineweight in mm as
  plotted and its colour. Linetypes are baked in as dashes.
- **Fills** (`TRIS`): triangles: solid hatches, SOLIDs and TRACEs, and **polylines with a width, as
  quads** (two triangles a segment): their width is drawn, not plotted, so it scales like geometry.
- **Hatch patterns** as thin lines (`engine/render/_hatch.py`).
- **Text** as glyph instances (`GLYF`) over a signed-distance-field atlas (`ATLS`, `AGLY`): each
  instance places one atlas glyph by an origin and two axes. AutoCAD's SHX lettering is drawn in the
  single-stroke font as thin lines at the text's lineweight, as it plots (m0-screens 4.6).
- **Every primitive's handles** (`PRIM`, `CHNS`): the entity drawn (its source handle), its type and
  layer, the chain of inserts it was reached through (outermost first, as a `DwgAnchor`'s `inserts`),
  and its top-level handle (the outermost insert, or the entity itself). A DIMENSION's parts carry the
  DIMENSION as their type and top.
- **Its fonts** (`FONT`, the rows of the font report this sheet uses) and **its counts** (`STAT`):
  entity types not drawn, walk refusals, lineweights and colours left to their defaults, cut or
  refused hatches, texts at the default height, missing glyphs, and budgets reached.

What the ReadArtefact does not carry, and so is not drawn as AutoCAD would (the PR says so): the layer
table (a BYLAYER colour, linetype or lineweight: colour kind 0; lineweight 0.25 mm, AutoCAD's default;
linetype continuous), a text style's fixed height, width factor and oblique angle, the global
LTSCALE, and a hatch pattern's own definition (drawn from the standard table by its name).

The buffer format, version 1 (all little-endian)
------------------------------------------------
    header, 56 bytes:
      0  4  magic "VXSB"
      4  u16 version (1)             6  u16 flags (bit 0: a budget was reached; the sheet is cut)
      8  u32 header size (56)       12  u32 total size: the whole buffer, in bytes, exactly
     16  f32 paper width, mm        20  f32 paper height, mm
     24  f64 mm per sheet unit      32  u32 section count      36  u32 paper source (0, 1, 2)
     40  f64 origin x               48  f64 origin y   (the paper's lower-left corner, in drawing units)
    section table: count x 16 bytes: fourcc (4 ASCII), u32 offset, u32 length, u32 record count
    sections, each at an offset that is a multiple of 8:
      STRS  count x (u32 byte length, UTF-8 bytes): handles, types, layers and font names
      CHNS  count x (u32 n, n x u32 string index): insert chains; chain 0 is the empty chain
      PRIM  count x 20: u32 source handle, u32 type, u32 layer (string indices), u32 chain, u32 top
            handle
      LINE  count x 28: f32 x0, y0, x1, y1 (mm), f32 lineweight (mm), u32 colour, u32 primitive
      TRIS  count x 32: f32 x0, y0, x1, y1, x2, y2 (mm), u32 colour, u32 primitive
      GLYF  count x 36: u32 atlas glyph, f32 origin x, y, x axis (x, y), y axis (x, y) (mm), u32 colour,
            u32 primitive. A glyph point (gx, gy) in text units lands at origin + gx·x axis + gy·y axis
      AGLY  count x 24: u16 u0, v0, u1, v1 (the glyph's pixels in the atlas, v from the top row),
            f32 x0, y0, x1, y1 (the same rectangle in text units; y0 at its bottom edge)
      ATLS  record count 1: u32 width, u32 height, then width x height u8 (rows from the top): the
            signed distance field, 24 atlas pixels to a text unit, 127.5 at the edge, 255 at 4 atlas
            pixels or more inside and 0 at 4 or more outside, linear between (a value v is
            (v - 127.5) / 127.5 x 4 atlas pixels from the edge, positive inside)
      FONT  count x 20: u32 asked, drawn with, how close, kind (string indices), u32 texts
      STAT  record count: its names; UTF-8 JSON, at most 1 MB: one object, names to integers
    Every f32 and f64 is finite; a lineweight is from 0 to 2.11 mm; an atlas glyph's pixels
    (u0 < u1, v0 < v1) lie inside the atlas and its text-unit rectangle has x0 < x1, y0 < y1.
    A colour is a u32: its top byte 0 BYLAYER, 1 an AutoCAD colour index (the low byte), 2 an RGB true
    colour (the low 24 bits), 3 BYBLOCK left unresolved.

`from_bytes` refuses a buffer that breaks any rule above (a length larger or smaller than itself, a
section outside it or overlapping the table, a record count that does not fill its section, an index
past its table, a value off its range) with `BufferError` and nothing else, never reading past the
data. The committed fixture
`engine/render/fixtures/tiny-sheet.bin` is decoded by the viewer's own test (16).

**Budgets** (`Limits`): a sheet stops adding a kind of primitive at its budget, stops walking after
`Limits.visits` entities or `Limits.seconds`, and says so (flag bit 0 and its counts), so a block with
millions of entities can exhaust neither memory nor time.
"""

import itertools
import json
import math
import struct
import time
import weakref
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass, replace
from functools import cache, lru_cache
from typing import Any

import numpy as np
from ezdxf.tools import standards
from numpy.typing import NDArray

from engine.geometry.placement import (
    IDENTITY,
    Chain,
    Link,
    PlacementError,
    Refusal,
    Transform,
    Walk,
    chain_transform,
    own_ocs,
    rotation_z,
    scaling,
    translation,
)
from engine.read.artefact import AnyEntity, Entity, Insert, ReadArtefact, Text
from engine.recognise.types import SheetCandidate
from engine.render import _hatch, _shapes
from engine.render._text import Laid, lay_out
from engine.render.fonts import Face, FontTally
from engine.render.fonts.glyphs import SDF_PX_PER_UNIT, Field, FontKey, notdef, outline, sdf
from engine.text.mtext import Heights, HeightSource, frame

MAGIC = b"VXSB"
VERSION = 1
HEADER = struct.Struct("<4sHHIIffdIIdd")
SECTION = struct.Struct("<4sIII")
DEFAULT_LINEWEIGHT_MM = 0.25
"""AutoCAD's LWDEFAULT: the lineweight of a line whose own is by layer, by block or default."""
MAX_LINEWEIGHT_MM = 2.11
TOLERANCE_MM = 0.05
"""How far a curve's chords may stray from it, on paper."""
MIN_DASH_PERIOD_MM = 0.5
"""A linetype whose pattern repeats more often than this on paper is drawn continuous."""
MAX_DASHES = 100_000
"""The most dashes one polyline is cut into; past it, it is drawn continuous."""
ATLAS_WIDTH = 1024
ASSUMED_LONG_SIDE_MM = 841.0
MAX_PAPER_MM = 100_000.0
"""A sheet's paper past 100 m on a side is refused: no drawing is plotted on it, and float32 keeps a
tenth of a millimetre only up to about that."""
_F32_LIMIT = 1e7
STANDARD_MATCH = 0.005

LINE = np.dtype([("x0", "<f4"), ("y0", "<f4"), ("x1", "<f4"), ("y1", "<f4"), ("weight", "<f4"),
                 ("colour", "<u4"), ("prim", "<u4")])  # fmt: skip
TRIS = np.dtype([("x0", "<f4"), ("y0", "<f4"), ("x1", "<f4"), ("y1", "<f4"), ("x2", "<f4"),
                 ("y2", "<f4"), ("colour", "<u4"), ("prim", "<u4")])  # fmt: skip
GLYF = np.dtype([("glyph", "<u4"), ("ox", "<f4"), ("oy", "<f4"), ("xx", "<f4"), ("xy", "<f4"),
                 ("yx", "<f4"), ("yy", "<f4"), ("colour", "<u4"), ("prim", "<u4")])  # fmt: skip
AGLY = np.dtype([("u0", "<u2"), ("v0", "<u2"), ("u1", "<u2"), ("v1", "<u2"), ("x0", "<f4"),
                 ("y0", "<f4"), ("x1", "<f4"), ("y1", "<f4")])  # fmt: skip
PRIM = np.dtype([("source", "<u4"), ("type", "<u4"), ("layer", "<u4"), ("chain", "<u4"), ("top", "<u4")])
FONT = np.dtype([("asked", "<u4"), ("drawn_with", "<u4"), ("how_close", "<u4"), ("kind", "<u4"),
                 ("texts", "<u4")])  # fmt: skip
_FIXED = {b"LINE": LINE, b"TRIS": TRIS, b"GLYF": GLYF, b"AGLY": AGLY, b"PRIM": PRIM, b"FONT": FONT}

UNIT_MM = {1: 25.4, 2: 304.8, 4: 1.0, 5: 10.0, 6: 1000.0, 8: 0.0000254, 9: 0.0254, 10: 914.4, 14: 100.0}
"""Millimetres per drawing unit, by the header's INSUNITS; unknown units are taken as millimetres."""
_MILLIMETRE_UNITS = frozenset({4, 5, 6, 14})
SHEETS_MM = (
    (1189.0, 841.0), (841.0, 594.0), (594.0, 420.0), (420.0, 297.0), (297.0, 210.0), (210.0, 148.0),
    (279.4, 215.9), (431.8, 279.4), (558.8, 431.8), (863.6, 558.8), (1117.6, 863.6),
    (304.8, 228.6), (457.2, 304.8), (609.6, 457.2), (914.4, 609.6), (1219.2, 914.4), (1066.8, 762.0),
)  # fmt: skip
"""ISO A0-A5, ANSI A-E and ARCH A-E1, long side first."""
SCALES = (1, 2, 2.5, 5, 10, 12, 16, 20, 24, 25, 32, 40, 48, 50, 64, 75, 96, 100, 125, 128, 150, 192,
          200, 250, 300, 384, 400, 500, 1000, 1250, 2000, 2500, 5000)  # fmt: skip


class BufferError(ValueError):
    """A buffer that is not a valid version-1 sheet buffer."""


@dataclass(frozen=True)
class Limits:
    """A sheet's budgets. Memory is bounded by the counts: each segment, triangle and glyph gathered
    takes at most about 100 bytes and each primitive about 400 (with its chain), so the defaults hold a
    sheet's gathering under about 1 GB; time by `visits` (entities and MINSERT cells walked, for the
    sheet and all its viewports together) and `seconds`, asked after every entity drawn."""

    lines: int = 2_000_000
    triangles: int = 1_000_000
    glyphs: int = 500_000
    primitives: int = 500_000
    atlas_height: int = 4096
    visits: int = 10_000_000
    seconds: float = 300.0
    """How long one sheet may take; past it the sheet is cut (flag bit 0, `budget_seconds`). One
    entity's own cost is bounded apart (MAX_DASHES, the hatch budgets, MAX_POINTS), so the sheet ends
    within that of its budget."""


DEFAULT_LIMITS = Limits()


class PaperSource:
    LAYOUT = 0  # the layout's own plot settings: reserved, since the ReadArtefact does not carry them
    STANDARD = 1
    ASSUMED = 2


@dataclass(frozen=True)
class Paper:
    width_mm: float
    height_mm: float
    mm_per_unit: float
    source: int
    origin: tuple[float, float]


@dataclass
class SheetBuffers:
    """One sheet's buffers (the module's docstring has the format)."""

    paper: Paper
    strings: list[str]
    chains: list[tuple[int, ...]]
    primitives: NDArray[np.void]
    lines: NDArray[np.void]
    triangles: NDArray[np.void]
    glyphs: NDArray[np.void]
    atlas_glyphs: NDArray[np.void]
    atlas: NDArray[np.uint8]
    fonts: NDArray[np.void]
    stats: dict[str, int]
    truncated: bool = False

    def to_bytes(self) -> bytes:
        sections: list[tuple[bytes, bytes, int]] = [
            (b"STRS", _strings(self.strings), len(self.strings)),
            (b"CHNS", _chains(self.chains), len(self.chains)),
            (b"PRIM", self.primitives.tobytes(), len(self.primitives)),
            (b"LINE", self.lines.tobytes(), len(self.lines)),
            (b"TRIS", self.triangles.tobytes(), len(self.triangles)),
            (b"GLYF", self.glyphs.tobytes(), len(self.glyphs)),
            (b"AGLY", self.atlas_glyphs.tobytes(), len(self.atlas_glyphs)),
            (
                b"ATLS",
                struct.pack("<II", self.atlas.shape[1], self.atlas.shape[0]) + self.atlas.tobytes(),
                1,
            ),
            (b"FONT", self.fonts.tobytes(), len(self.fonts)),
            (b"STAT", json.dumps(self.stats, sort_keys=True).encode(), len(self.stats)),
        ]
        offset = HEADER.size + SECTION.size * len(sections)
        table, body = [], b""
        for fourcc, data, count in sections:
            start = _align(offset + len(body))
            body += b"\0" * (start - offset - len(body)) + data
            table.append(SECTION.pack(fourcc, start, len(data), count))
        total = offset + len(body)
        p = self.paper
        header = HEADER.pack(
            MAGIC, VERSION, int(self.truncated), HEADER.size, total, p.width_mm, p.height_mm,
            p.mm_per_unit, len(sections), p.source, p.origin[0], p.origin[1],
        )  # fmt: skip
        return header + b"".join(table) + body

    @classmethod
    def from_bytes(cls, data: bytes) -> SheetBuffers:
        if not isinstance(data, bytes | bytearray | memoryview):
            raise BufferError(f"a buffer is bytes, not {type(data).__name__}")
        return _decode(bytes(data))

    def to_json(self) -> dict[str, object]:
        """What the harness keeps of it in a report: its counts, never its geometry."""
        return {"counts": {**self.stats, "lines": len(self.lines), "triangles": len(self.triangles),
                           "glyphs": len(self.glyphs)}}  # fmt: skip


def _align(n: int) -> int:
    return (n + 7) // 8 * 8


def _strings(strings: list[str]) -> bytes:
    return b"".join(struct.pack("<I", len(b)) + b for b in (s.encode() for s in strings))


def _chains(chains: list[tuple[int, ...]]) -> bytes:
    return b"".join(struct.pack(f"<I{len(c)}I", len(c), *c) for c in chains)


# Decoding, with every rule checked -------------------------------------------------------------------


def _decode(data: bytes) -> SheetBuffers:
    if len(data) < HEADER.size:
        raise BufferError("shorter than its header")
    (magic, version, flags, header_size, total, width, height, mm_per_unit, count, source, ox, oy) = (
        HEADER.unpack_from(data)
    )
    if magic != MAGIC:
        raise BufferError("not a sheet buffer (its magic is wrong)")
    if version != VERSION:
        raise BufferError(f"version {version}, and this code reads only {VERSION}")
    if header_size != HEADER.size:
        raise BufferError("its header size is wrong")
    if total != len(data):
        raise BufferError(f"it says it is {total} bytes long, and it is {len(data)}")
    if not (count <= 64 and HEADER.size + count * SECTION.size <= len(data)):
        raise BufferError("its section table does not fit it")
    for value in (width, height, mm_per_unit, ox, oy):
        if not math.isfinite(value):
            raise BufferError("its paper is not finite")
    if not (0 < width <= MAX_PAPER_MM and 0 < height <= MAX_PAPER_MM and mm_per_unit > 0):
        raise BufferError("its paper is no sheet's: each side from 0 to 100 m, and mm per unit above 0")
    if source not in (0, 1, 2) or flags > 1:
        raise BufferError("its paper source or flags are unknown")
    table_end = HEADER.size + count * SECTION.size
    found: dict[bytes, tuple[bytes, int]] = {}
    spans = []
    for i in range(count):
        fourcc, offset, length, records = SECTION.unpack_from(data, HEADER.size + i * SECTION.size)
        if offset < table_end or offset + length > len(data) or offset % 8:
            raise BufferError(f"section {fourcc!r} lies outside the buffer")
        if fourcc in found:
            raise BufferError(f"section {fourcc!r} is given twice")
        spans.append((offset, offset + length))
        found[fourcc] = (data[offset : offset + length], records)
    spans.sort()
    if any(a[1] > b[0] for a, b in itertools.pairwise(spans)):
        raise BufferError("two sections overlap")
    needed = {b"STRS", b"CHNS", b"PRIM", b"LINE", b"TRIS", b"GLYF", b"AGLY", b"ATLS", b"FONT", b"STAT"}
    if set(found) != needed:
        raise BufferError("its sections are not the version's")
    arrays = {}
    for fourcc, dtype in _FIXED.items():
        raw, records = found[fourcc]
        if len(raw) != records * dtype.itemsize:
            raise BufferError(f"section {fourcc!r}'s length is not its records'")
        arrays[fourcc] = np.frombuffer(raw, dtype=dtype).copy()
    strings = _read_strings(*found[b"STRS"])
    chains = _read_chains(*found[b"CHNS"], len(strings))
    if found[b"ATLS"][1] != 1:
        raise BufferError("the atlas section's record count is not 1")
    atlas = _read_atlas(found[b"ATLS"][0])
    stats = _read_stats(*found[b"STAT"])
    _check_values(arrays)
    prims, n_strings = arrays[b"PRIM"], len(strings)
    for name in ("source", "type", "layer", "top"):
        if len(prims) and int(prims[name].max()) >= n_strings:
            raise BufferError("a primitive names a string past the table")
    if len(prims) and int(prims["chain"].max()) >= len(chains):
        raise BufferError("a primitive names a chain past the table")
    for fourcc in (b"LINE", b"TRIS", b"GLYF"):
        if len(arrays[fourcc]) and int(arrays[fourcc]["prim"].max()) >= len(prims):
            raise BufferError(f"a {fourcc.decode()} record names a primitive past the table")
    glyphs, atlas_glyphs = arrays[b"GLYF"], arrays[b"AGLY"]
    if len(glyphs) and int(glyphs["glyph"].max()) >= len(atlas_glyphs):
        raise BufferError("a glyph names an atlas glyph past the table")
    a = atlas_glyphs
    if len(a) and not (
        (a["u0"] < a["u1"]).all()
        and (a["v0"] < a["v1"]).all()
        and int(a["u1"].max()) <= atlas.shape[1]
        and int(a["v1"].max()) <= atlas.shape[0]
        and (a["x0"] < a["x1"]).all()
        and (a["y0"] < a["y1"]).all()
    ):
        raise BufferError("an atlas glyph lies outside the atlas or is empty")
    fonts = arrays[b"FONT"]
    for name in ("asked", "drawn_with", "how_close", "kind"):
        if len(fonts) and int(fonts[name].max()) >= n_strings:
            raise BufferError("a font names a string past the table")
    paper = Paper(float(width), float(height), float(mm_per_unit), int(source), (float(ox), float(oy)))
    return SheetBuffers(
        paper, strings, chains, prims, arrays[b"LINE"], arrays[b"TRIS"], glyphs, atlas_glyphs, atlas,
        fonts, stats, bool(flags & 1),
    )  # fmt: skip


MAX_STATS_BYTES = 1 << 20


def _read_stats(raw: bytes, count: int) -> dict[str, int]:
    if len(raw) > MAX_STATS_BYTES:
        raise BufferError("its counts are larger than a megabyte")
    try:
        stats = json.loads(raw.decode())
    except (UnicodeDecodeError, ValueError, RecursionError) as error:
        raise BufferError("its counts are not JSON") from error
    if not isinstance(stats, dict) or not all(
        isinstance(k, str) and isinstance(v, int) and not isinstance(v, bool) for k, v in stats.items()
    ):
        raise BufferError("its counts are not names to integers")
    if len(stats) != count:
        raise BufferError("the counts section's record count is not its names'")
    return stats


def _check_values(arrays: dict[bytes, NDArray[np.void]]) -> None:
    """Every float finite; every lineweight from 0 to MAX_LINEWEIGHT_MM."""
    for fourcc, table in arrays.items():
        for name in table.dtype.names or ():
            column = table[name]
            if column.dtype.kind == "f" and not np.isfinite(column).all():
                raise BufferError(f"a {fourcc.decode()} value is not finite")
    weights = arrays[b"LINE"]["weight"]
    if len(weights) and not ((weights >= 0).all() and (weights <= MAX_LINEWEIGHT_MM + 1e-6).all()):
        raise BufferError("a lineweight is off its range")


def _read_strings(raw: bytes, count: int) -> list[str]:
    strings, at = [], 0
    for _ in range(count):
        if at + 4 > len(raw):
            raise BufferError("the strings run past their section")
        (length,) = struct.unpack_from("<I", raw, at)
        at += 4
        if at + length > len(raw):
            raise BufferError("a string runs past its section")
        try:
            strings.append(raw[at : at + length].decode())
        except UnicodeDecodeError as error:
            raise BufferError("a string is not UTF-8") from error
        at += length
    if at != len(raw):
        raise BufferError("the strings section has bytes left over")
    return strings


def _read_chains(raw: bytes, count: int, strings: int) -> list[tuple[int, ...]]:
    chains, at = [], 0
    for _ in range(count):
        if at + 4 > len(raw):
            raise BufferError("the chains run past their section")
        (n,) = struct.unpack_from("<I", raw, at)
        at += 4
        if at + 4 * n > len(raw):
            raise BufferError("a chain runs past its section")
        items = struct.unpack_from(f"<{n}I", raw, at)
        at += 4 * n
        if any(i >= strings for i in items):
            raise BufferError("a chain names a string past the table")
        chains.append(tuple(items))
    if at != len(raw) or not chains or chains[0] != ():
        raise BufferError("the chains section is not a list of chains starting with the empty one")
    return chains


def _read_atlas(raw: bytes) -> NDArray[np.uint8]:
    if len(raw) < 8:
        raise BufferError("the atlas has no size")
    width, height = struct.unpack_from("<II", raw)
    if width * height != len(raw) - 8:
        raise BufferError("the atlas's size is not its pixels'")
    return np.frombuffer(raw, dtype=np.uint8, offset=8).reshape(height, width).copy()


# Building -------------------------------------------------------------------------------------------


def _colour(values: object) -> int:
    if not isinstance(values, dict):
        return 0
    true = values.get("true_color")
    if isinstance(true, int) and not isinstance(true, bool) and 0 <= true <= 0xFFFFFF:
        return (2 << 24) | true
    aci = values.get("color", 256)
    if isinstance(aci, int) and not isinstance(aci, bool):
        if aci == 0:
            return 3 << 24
        if 1 <= aci <= 255:
            return (1 << 24) | aci
    return 0


def _lineweight(values: object, stats: Counter[str]) -> float:
    value = values.get("lineweight", -1) if isinstance(values, dict) else -1
    if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 211:
        return value / 100.0
    stats["lineweight_default"] += 1
    return DEFAULT_LINEWEIGHT_MM


@cache
def _linetypes() -> dict[str, list[float]]:
    return {name.upper(): list(pattern) for name, _, pattern in standards.linetypes()}


def _standard_sheet(
    long_units: float, short_units: float, units_mm: Iterable[float], scales: Iterable[float]
) -> float | None:
    """Millimetres a unit when the box is a standard sheet, within STANDARD_MATCH, for one of the
    units (mm a drawing unit) at one of the scales; the closest match, or none."""
    best: tuple[float, float] | None = None
    for unit in units_mm:
        for long_mm, short_mm in SHEETS_MM:
            for scale in scales:
                a = long_units * unit / scale
                b = short_units * unit / scale
                error = max(abs(a - long_mm) / long_mm, abs(b - short_mm) / short_mm)
                if error <= STANDARD_MATCH and (best is None or error < best[0]):
                    best = (error, unit / scale)
    return None if best is None else best[1]


def _paper_for_box(
    box: tuple[float, float, float, float],
    insunits: int,
    units_mm: Iterable[float] | None = None,
    scales: Iterable[float] = SCALES,
    unmatched_mm_per_unit: float | None = None,
) -> Paper:
    """A box's paper: a standard sheet when it is one, else assumed. A model-space box is tried in the
    drawing's units at the standard scales, and one that matches none has its long side taken as A1's;
    a layout's, which INSUNITS does not govern, as millimetres or inches at 1:1, and one that matches
    none (a frame drawn inside the sheet's edge, as most are) is taken at `unmatched_mm_per_unit`."""
    x0, y0, x1, y1 = box
    width, height = x1 - x0, y1 - y0
    long_units, short_units = max(width, height), min(width, height)
    units = units_mm if units_mm is not None else (UNIT_MM.get(insunits, 1.0),)
    matched = _standard_sheet(long_units, short_units, units, scales)
    if matched is not None:
        mm_per_unit, source = matched, PaperSource.STANDARD
    elif unmatched_mm_per_unit is not None:
        mm_per_unit, source = unmatched_mm_per_unit, PaperSource.ASSUMED
    else:
        mm_per_unit = ASSUMED_LONG_SIDE_MM / long_units if long_units > 0 else 1.0
        source = PaperSource.ASSUMED
    return Paper(width * mm_per_unit, height * mm_per_unit, mm_per_unit, source, (x0, y0))


class _Bounds:
    """Each block's extents in its own coordinates, for culling a sheet (larger than exact is fine).
    Without `text`, texts are left out: a text's reach is generous (its height times its length, every
    way), so a layout's paper is measured from its geometry and viewports alone."""

    def __init__(self, artefact: ReadArtefact, text: bool = True, viewports: bool = True) -> None:
        self.artefact = artefact
        self.text = text
        self.viewports = viewports
        self.cache: dict[str, tuple[float, float, float, float] | None] = {}
        self.entities: dict[str, tuple[float, float, float, float] | None] = {}
        self.open: set[str] = set()

    def block(self, handle: str, depth: int = 0) -> tuple[float, float, float, float] | None:
        if handle in self.cache:
            return self.cache[handle]
        record = self.artefact.blocks.get(handle)
        if record is None or handle in self.open or depth > 32:
            return None
        self.open.add(handle)
        box = None
        for h in record.entities:
            entity = self.artefact.entities.get(h)
            if entity is not None:
                box = _union(box, self.entity(entity, depth))
        self.open.discard(handle)
        self.cache[handle] = box
        return box

    def entity(self, entity: AnyEntity, depth: int = 0) -> tuple[float, float, float, float] | None:
        if entity.handle in self.entities:
            return self.entities[entity.handle]
        box = self._entity(entity, depth)
        if not isinstance(entity, Insert) or entity.block not in self.open:
            self.entities[entity.handle] = box
        return box

    def _entity(self, entity: AnyEntity, depth: int) -> tuple[float, float, float, float] | None:
        if isinstance(entity, Insert):
            inner = self.block(entity.block, depth + 1)
            if inner is None:
                return None
            record = self.artefact.blocks[entity.block]
            box = None
            rows, columns = _grid_size(entity)
            for row, column in {(0, 0), (rows - 1, columns - 1), (rows - 1, 0), (0, columns - 1)}:
                box = _union(
                    box, _transform_box(Link(entity, record.base_point, row, column).transform(), inner)
                )
            return box
        if isinstance(entity, Text):
            if not self.text:
                return None
            reach = (entity.height or 0.0) * (len(entity.text) + 2) + (entity.width or 0.0)
            reach = reach if math.isfinite(reach) else 0.0
            x, y, _ = own_ocs(entity).apply(entity.position)
            return (x - reach, y - reach, x + reach, y + reach)
        if entity.type == "VIEWPORT":  # its view centre and target are model space's, not the layout's
            return _viewport_rect(entity) if self.viewports else None
        local = _shapes.bounds(entity)
        return None if local is None else _transform_box(own_ocs(entity), local)


_last_bounds: list[tuple[weakref.ref[ReadArtefact], _Bounds]] = []


def _bounds_of(artefact: ReadArtefact) -> _Bounds:
    """The drawing's bounds, shared by its sheets (the harness builds every sheet of one artefact in
    turn); only the last artefact's are kept."""
    if _last_bounds and _last_bounds[0][0]() is artefact:
        return _last_bounds[0][1]
    found = _Bounds(artefact)
    _last_bounds[:] = [(weakref.ref(artefact), found)]
    return found


def _grid_size(insert: Insert) -> tuple[int, int]:
    out = []
    for key in ("row_count", "column_count"):
        value = insert.values.get(key, 1)
        out.append(
            min(value, 10_000)
            if isinstance(value, int) and not isinstance(value, bool) and value >= 1
            else 1
        )
    return out[0], out[1]


def _union(
    a: tuple[float, float, float, float] | None, b: tuple[float, float, float, float] | None
) -> tuple[float, float, float, float] | None:
    if a is None:
        return b
    if b is None:
        return a
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def _transform_box(
    t: Transform, box: tuple[float, float, float, float]
) -> tuple[float, float, float, float] | None:
    corners = np.array([[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]])
    placed = t.xy(corners)
    if not np.isfinite(placed).all():
        return None
    return (
        float(placed[:, 0].min()),
        float(placed[:, 1].min()),
        float(placed[:, 0].max()),
        float(placed[:, 1].max()),
    )


def _contains(
    outer: tuple[float, float, float, float], inner: tuple[float, float, float, float]
) -> bool:
    return (
        outer[0] <= inner[0] and outer[1] <= inner[1] and inner[2] <= outer[2] and inner[3] <= outer[3]
    )


def _overlaps(a: tuple[float, float, float, float] | None, b: tuple[float, float, float, float]) -> bool:
    return a is not None and a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


def clip_segments(
    segments: NDArray[np.float64], rect: tuple[float, float, float, float]
) -> NDArray[np.float64]:
    """Segments (Nx4) cut to a rectangle (Liang-Barsky); those wholly outside dropped."""
    keep, cut = clip_mask(segments, rect)
    return cut[keep]


def clip_mask(
    segments: NDArray[np.float64], rect: tuple[float, float, float, float]
) -> tuple[NDArray[np.bool_], NDArray[np.float64]]:
    """Each segment cut to the rectangle, and whether anything of it is left."""
    if not len(segments):
        return np.zeros(0, dtype=bool), segments
    x0, y0, x1, y1 = segments.T
    # Half differences: x1 - x0 overflows for endpoints near the float range's ends, x1/2 - x0/2 never.
    dx, dy = x1 / 2 - x0 / 2, y1 / 2 - y0 / 2
    xmin, ymin, xmax, ymax = rect
    n = len(segments)
    t0, t1 = np.zeros(n), np.ones(n)
    keep = np.ones(n, dtype=bool)
    # Where an edge cuts a segment, the cut point's coordinate on that edge's axis is the edge itself:
    # set it exactly, since t times a difference near the float range loses the sheet's scale.
    snapped = np.full((n, 4), np.nan)
    halves = ((x0 / 2 - xmin / 2), (xmax / 2 - x0 / 2), (y0 / 2 - ymin / 2), (ymax / 2 - y0 / 2))
    edges = (xmin, xmax, ymin, ymax)
    for axis, edge, p, q in zip((0, 0, 1, 1), edges, (-dx, dx, -dy, dy), halves, strict=True):
        parallel = p == 0
        keep &= ~(parallel & (q < 0))
        with np.errstate(divide="ignore", invalid="ignore"):
            r = np.where(parallel, 0.0, q / np.where(parallel, 1.0, p))
        enters = ~parallel & (p < 0) & (r > t0)
        leaves = ~parallel & (p > 0) & (r < t1)
        t0, t1 = np.where(enters, r, t0), np.where(leaves, r, t1)
        snapped[enters, 0:2] = np.nan
        snapped[enters, axis] = edge
        snapped[leaves, 2:4] = np.nan
        snapped[leaves, 2 + axis] = edge
    keep &= t0 <= t1
    out = np.column_stack(
        [x0 + t0 * dx + t0 * dx, y0 + t0 * dy + t0 * dy, x0 + t1 * dx + t1 * dx, y0 + t1 * dy + t1 * dy]
    )
    out = np.where(np.isnan(snapped), out, snapped)
    with np.errstate(invalid="ignore"):
        out = np.clip(out, (xmin, ymin, xmin, ymin), (xmax, ymax, xmax, ymax))
    keep &= np.isfinite(out).all(axis=1)
    return keep, out


def _clip_polygon(
    points: list[tuple[float, float]], rect: tuple[float, float, float, float]
) -> list[tuple[float, float]]:
    xmin, ymin, xmax, ymax = rect
    edges: list[Callable[[tuple[float, float]], float]] = [
        lambda p: p[0] - xmin, lambda p: xmax - p[0], lambda p: p[1] - ymin, lambda p: ymax - p[1],
    ]  # fmt: skip
    for inside in edges:
        if not points:
            break
        out = []
        for i, current in enumerate(points):
            previous = points[i - 1]
            a, b = inside(previous), inside(current)
            if b >= 0:
                if a < 0:
                    t = a / (a - b)
                    out.append(
                        (
                            previous[0] + t * (current[0] - previous[0]),
                            previous[1] + t * (current[1] - previous[1]),
                        )
                    )
                out.append(current)
            elif a >= 0:
                t = a / (a - b)
                out.append(
                    (
                        previous[0] + t * (current[0] - previous[0]),
                        previous[1] + t * (current[1] - previous[1]),
                    )
                )
        points = out
    return points


def clip_triangles(
    triangles: NDArray[np.float64], rect: tuple[float, float, float, float]
) -> NDArray[np.float64]:
    """Triangles (Mx3x2) cut to a rectangle: inside kept, outside dropped, crossing ones clipped."""
    if not len(triangles):
        return triangles
    lo, hi = triangles.min(axis=1), triangles.max(axis=1)
    inside = (
        (lo[:, 0] >= rect[0]) & (lo[:, 1] >= rect[1]) & (hi[:, 0] <= rect[2]) & (hi[:, 1] <= rect[3])
    )
    outside = (hi[:, 0] < rect[0]) | (hi[:, 1] < rect[1]) | (lo[:, 0] > rect[2]) | (lo[:, 1] > rect[3])
    pieces = [triangles[inside]]
    for triangle in triangles[~inside & ~outside]:
        polygon = _clip_polygon([tuple(p) for p in triangle], rect)
        for k in range(1, len(polygon) - 1):
            pieces.append(np.array([[polygon[0], polygon[k], polygon[k + 1]]]))
    return np.concatenate(pieces).reshape(-1, 3, 2)


def dash(points: NDArray[np.float64], pattern: list[float], budget: int) -> NDArray[np.float64] | None:
    """A polyline cut into a linetype's dashes (lengths along it: positive drawn, negative gaps, zero a
    dot), as segments (N x 4); none when it would take more than `budget` dashes.

    Vectorised: the cut points are the polyline's own vertices and every dash's ends, sorted along its
    length, and a piece between two of them is drawn when its middle lies in a drawn dash. So the cost
    is in proportion to the vertices plus the dashes, never their product."""
    steps = np.diff(points, axis=0)
    lengths = np.hypot(steps[:, 0], steps[:, 1])
    total = float(lengths.sum())
    period = sum(abs(x) for x in pattern)
    if not (total > 0 and period > 0 and math.isfinite(total)):
        return np.column_stack([points[:-1], points[1:]])
    repeats = math.ceil(total / period)
    if repeats * len(pattern) > budget:
        return None
    cumulative = np.concatenate([[0.0], np.cumsum(lengths)])
    edges = np.concatenate([[0.0], np.cumsum([abs(x) for x in pattern])])  # within one period
    drawn = np.array([x > 0 for x in pattern])
    offsets = np.arange(repeats)[:, None] * period
    boundaries = (offsets + edges[None, :-1]).ravel()  # a period's end is the next one's start
    cuts = np.unique(np.concatenate([cumulative, boundaries[boundaries < total], [total]]))
    middle = (cuts[:-1] + cuts[1:]) / 2
    phase = np.mod(middle, period)
    which = np.clip(np.searchsorted(edges, phase, side="right") - 1, 0, len(pattern) - 1)
    on = drawn[which] & (cuts[1:] > cuts[:-1])
    xs = np.interp(cuts, cumulative, points[:, 0])
    ys = np.interp(cuts, cumulative, points[:, 1])
    pieces = np.column_stack([xs[:-1], ys[:-1], xs[1:], ys[1:]])[on]
    dots = [edges[i] for i, x in enumerate(pattern) if x == 0]
    if dots:
        at = (offsets + np.array(dots)[None, :]).ravel()
        at = at[at <= total]
        dx, dy = np.interp(at, cumulative, points[:, 0]), np.interp(at, cumulative, points[:, 1])
        pieces = np.concatenate([pieces, np.column_stack([dx, dy, dx, dy])])
    return np.asarray(pieces, dtype=np.float64)


@lru_cache(maxsize=16384)
def _field(key: FontKey, char: str | None) -> Field | None:
    glyph = notdef(key) if char is None else outline(key, char)
    return None if glyph is None else sdf(glyph)


_SEGMENT = np.dtype([("x0", "<f8"), ("y0", "<f8"), ("x1", "<f8"), ("y1", "<f8"), ("weight", "<f4"),
                     ("colour", "<u4"), ("prim", "<u4"), ("clip", "<u4")])  # fmt: skip
_TRIANGLE = np.dtype([("x0", "<f8"), ("y0", "<f8"), ("x1", "<f8"), ("y1", "<f8"), ("x2", "<f8"),
                      ("y2", "<f8"), ("colour", "<u4"), ("prim", "<u4"), ("clip", "<u4")])  # fmt: skip


class _Rows:
    """A growing packed array of records (capacity doubling), so gathering costs its records' bytes,
    not a Python object per entity."""

    def __init__(self, dtype: np.dtype[np.void]) -> None:
        self.data = np.zeros(256, dtype=dtype)
        self.size = 0

    def __len__(self) -> int:
        return self.size

    def add(self, count: int) -> NDArray[np.void]:
        """`count` new records, to be filled in place."""
        needed = self.size + count
        if needed > len(self.data):
            grown = np.zeros(max(needed, 2 * len(self.data)), dtype=self.data.dtype)
            grown[: self.size] = self.data[: self.size]
            self.data = grown
        rows = self.data[self.size : needed]
        self.size = needed
        return rows

    def view(self) -> NDArray[np.void]:
        return self.data[: self.size]


def _inside(corners: NDArray[np.float64], rect: tuple[float, float, float, float]) -> NDArray[np.bool_]:
    lo, hi = corners.min(axis=1), corners.max(axis=1)
    return (lo[:, 0] >= rect[0]) & (lo[:, 1] >= rect[1]) & (hi[:, 0] <= rect[2]) & (hi[:, 1] <= rect[3])


class _Sheet:
    """A sheet's buffers as they are gathered."""

    def __init__(self, artefact: ReadArtefact, paper: Paper, limits: Limits) -> None:
        self.artefact = artefact
        self.paper = paper
        self.limits = limits
        self.rect = (0.0, 0.0, paper.width_mm, paper.height_mm)
        self.to_paper = scaling(paper.mm_per_unit, paper.mm_per_unit) @ translation(
            -paper.origin[0], -paper.origin[1]
        )
        self.strings: list[str] = []
        self.string_index: dict[str, int] = {}
        self.chains: list[tuple[int, ...]] = [()]
        self.chain_index: dict[tuple[int, ...], int] = {(): 0}
        self.primitives: list[tuple[int, int, int, int, int]] = []
        self.primitive_index: dict[tuple[int, ...], int] = {}
        # Gathered into growing packed arrays with their attributes and the rectangle each is cut to,
        # and cut once at the end (cutting each entity's few segments alone cost most of the time).
        self.clips: list[tuple[float, float, float, float]] = []
        self.clip_index: dict[tuple[float, float, float, float], int] = {}
        self.segments = _Rows(_SEGMENT)
        self.triangles = _Rows(_TRIANGLE)
        self.glyphs = _Rows(GLYF)
        self.block_names = {b.name: h for h, b in artefact.blocks.items()}
        self.atlas_index: dict[tuple[FontKey, str | None], int] = {}
        self.atlas_fields: list[Field] = []
        self.fonts = FontTally()
        self.stats: Counter[str] = Counter()
        self.counts = {"lines": 0, "triangles": 0}
        self.truncated = False
        self.heights = Heights(artefact)
        self.iso = artefact.summary.insunits in _MILLIMETRE_UNITS  # acadiso.lin and .pat, not acad
        self.bounds = _bounds_of(artefact)
        self.deadline = time.monotonic() + limits.seconds
        self.visits_left = limits.visits

    def over_time(self) -> bool:
        if time.monotonic() > self.deadline:
            if not self.stats["budget_seconds"]:
                self.stats["budget_seconds"] = 1
            self.truncated = True
            return True
        return False

    def clip_id(self, clip: tuple[float, float, float, float] | None) -> int:
        rect = clip or self.rect
        if rect not in self.clip_index:
            self.clip_index[rect] = len(self.clips)
            self.clips.append(rect)
        return self.clip_index[rect]

    def string(self, value: str) -> int:
        if value not in self.string_index:
            self.string_index[value] = len(self.strings)
            self.strings.append(value)
        return self.string_index[value]

    def primitive(self, entity: AnyEntity, chain: Chain, via: AnyEntity | None) -> int:
        """The primitive's index, or -1 once the primitive budget is spent (the entity is left out)."""
        if len(self.primitives) >= self.limits.primitives:
            self.truncated = True
            self.stats["budget_primitives"] += 1
            return -1
        chain_key = tuple(self.string(link.insert.handle) for link in chain)
        if chain_key not in self.chain_index:
            self.chain_index[chain_key] = len(self.chains)
            self.chains.append(chain_key)
        top = chain[0].insert.handle if chain else (via or entity).handle
        record = (
            self.string(entity.handle),
            self.string((via or entity).type),
            self.string(entity.layer),
            self.chain_index[chain_key],
            self.string(top),
        )
        if record not in self.primitive_index:
            self.primitive_index[record] = len(self.primitives)
            self.primitives.append(record)
        return self.primitive_index[record]

    def full(self, kind: str) -> bool:
        """Whether a kind's budget is spent (what is gathered past it would be dropped anyway)."""
        return self.counts[kind] >= (self.limits.lines if kind == "lines" else self.limits.triangles)

    def _room(self, kind: str, wanted: int) -> int:
        limit = self.limits.lines if kind == "lines" else self.limits.triangles
        left = limit - self.counts[kind]
        if wanted > left:
            self.truncated = True
            self.stats[f"budget_{kind}"] += wanted - max(left, 0)
        return max(0, min(wanted, left))

    def add_segments(
        self,
        segments: NDArray[np.float64],
        weight: float,
        colour: int,
        prim: int,
        clip: tuple[float, float, float, float] | None,
    ) -> None:
        segments = segments[np.isfinite(segments).all(axis=1)]
        room = self._room("lines", len(segments))
        if room == 0:
            return
        rows = self.segments.add(room)
        rows["x0"], rows["y0"], rows["x1"], rows["y1"] = segments[:room].T
        rows["weight"], rows["colour"], rows["prim"] = weight, colour, prim
        rows["clip"] = self.clip_id(clip)
        self.counts["lines"] += room

    def add_polyline(
        self,
        points: NDArray[np.float64],
        closed: bool,
        weight: float,
        colour: int,
        prim: int,
        clip: tuple[float, float, float, float] | None,
        pattern: list[float] | None = None,
    ) -> None:
        if closed and len(points) > 2:
            points = np.vstack([points, points[:1]])
        if len(points) < 2 or not np.isfinite(points).all():
            return
        segments = None
        if pattern is not None:
            segments = dash(points, pattern, min(MAX_DASHES, self.limits.lines - self.counts["lines"]))
            if segments is None:
                self.stats["linetype_too_long"] += 1
        if segments is None:
            segments = np.column_stack([points[:-1], points[1:]])
        self.add_segments(segments, weight, colour, prim, clip)

    def add_triangles(
        self,
        triangles: NDArray[np.float64],
        colour: int,
        prim: int,
        clip: tuple[float, float, float, float] | None,
    ) -> None:
        triangles = triangles[np.isfinite(triangles).all(axis=(1, 2))]
        room = self._room("triangles", len(triangles))
        if room == 0:
            return
        rows = self.triangles.add(room)
        flat = triangles[:room].reshape(-1, 6)
        for i, name in enumerate(("x0", "y0", "x1", "y1", "x2", "y2")):
            rows[name] = flat[:, i]
        rows["colour"], rows["prim"], rows["clip"] = colour, prim, self.clip_id(clip)
        self.counts["triangles"] += room

    def packed_lines(self) -> NDArray[np.void]:
        """Every gathered segment, cut to its rectangle, as LINE records."""
        rows = self.segments.view()
        records = []
        for index, rect in enumerate(self.clips):
            mine = rows[rows["clip"] == index]
            if not len(mine):
                continue
            ends = np.column_stack([mine["x0"], mine["y0"], mine["x1"], mine["y1"]])
            keep, cut = clip_mask(ends, rect)
            record = np.zeros(int(keep.sum()), dtype=LINE)
            record["x0"], record["y0"], record["x1"], record["y1"] = cut[keep].T
            record["weight"], record["colour"], record["prim"] = (
                mine["weight"][keep], mine["colour"][keep], mine["prim"][keep],
            )  # fmt: skip
            records.append(record)
        return np.concatenate(records) if records else np.zeros(0, dtype=LINE)

    def packed_triangles(self) -> NDArray[np.void]:
        rows = self.triangles.view()
        records = []
        for index, rect in enumerate(self.clips):
            mine = rows[rows["clip"] == index]
            if not len(mine):
                continue
            names = ("x0", "y0", "x1", "y1", "x2", "y2")
            corners = np.column_stack([mine[n] for n in names]).reshape(-1, 3, 2)
            inside = _inside(corners, rect)
            pieces = [(corners[inside], mine["colour"][inside], mine["prim"][inside])]
            for k in np.flatnonzero(~inside):
                cut = clip_triangles(corners[k : k + 1], rect)
                pieces.append(
                    (cut, np.full(len(cut), mine["colour"][k]), np.full(len(cut), mine["prim"][k]))
                )
            for cut, colour, prim in pieces:
                cut = cut.reshape(-1, 3, 2)
                keep = np.isfinite(cut).all(axis=(1, 2))
                record = np.zeros(int(keep.sum()), dtype=TRIS)
                flat = cut[keep].reshape(-1, 6)
                for i, name in enumerate(names):
                    record[name] = flat[:, i]
                record["colour"], record["prim"] = colour[keep], prim[keep]
                records.append(record)
        return np.concatenate(records) if records else np.zeros(0, dtype=TRIS)

    def add_glyph(
        self,
        key: FontKey,
        char: str | None,
        origin: tuple[float, float],
        x_axis: tuple[float, float],
        y_axis: tuple[float, float],
        colour: int,
        prim: int,
        clip: tuple[float, float, float, float] | None,
    ) -> None:
        rect = clip or self.rect
        if not (rect[0] <= origin[0] <= rect[2] and rect[1] <= origin[1] <= rect[3]):
            return
        if not all(abs(v) < _F32_LIMIT for v in (*x_axis, *y_axis)):
            self.stats["text_too_large"] += 1
            return
        if len(self.glyphs) >= self.limits.glyphs:
            self.truncated = True
            self.stats["budget_glyphs"] += 1
            return
        index = self.atlas_index.get((key, char))
        if index is None:
            found = _field(key, char)
            if found is None:
                return
            index = self.atlas_index[(key, char)] = len(self.atlas_fields)
            self.atlas_fields.append(found)
        row = self.glyphs.add(1)
        row["glyph"], row["colour"], row["prim"] = index, colour, prim
        row["ox"], row["oy"], row["xx"], row["xy"], row["yx"], row["yy"] = (*origin, *x_axis, *y_axis)


def _space(
    artefact: ReadArtefact, sheet: SheetCandidate
) -> tuple[str, Paper, tuple[float, float, float, float] | None]:
    """The block the sheet draws, its paper, and the window it is cut to (in drawing units)."""
    location = sheet.location
    if location.layout is not None:
        handle = next((h for h, b in artefact.blocks.items() if b.layout == location.layout), None)
        if handle is None:
            raise ValueError(f"the sheet's layout {location.layout!r} is not in the drawing")
        box, padded = _layout_box(artefact, handle)
        # Paper space's units are the layout's plot settings', which the artefact does not carry
        # (INSUNITS governs model space): a standard sheet in mm or in inches at 1:1, else one unit
        # a millimetre (assumed), as most layouts are drawn; never rescaled to a sheet's size.
        paper = _paper_for_box(box, 0, units_mm=(1.0, 25.4), scales=(1,), unmatched_mm_per_unit=1.0)
        if padded:
            paper = replace(paper, source=PaperSource.ASSUMED)
        return handle, paper, None
    assert location.box is not None
    handle = next((h for h, b in artefact.blocks.items() if b.layout == "Model"), None)
    if handle is None:
        handle = next((h for h, b in artefact.blocks.items() if b.name.lower() == "*model_space"), None)
    if handle is None:
        raise ValueError("the drawing has no model space")
    b = location.box
    window = (b.x0, b.y0, b.x1, b.y1)
    return handle, _paper_for_box(window, artefact.summary.insunits), window


def _layout_box(artefact: ReadArtefact, handle: str) -> tuple[tuple[float, float, float, float], bool]:
    """A layout's extents for its paper, and whether they were padded to have an area.

    From its geometry and its viewports, without AutoCAD's main viewport (its window at the last
    save, not the sheet) and without the texts' generous reach (a title near the frame would push
    the box past every standard sheet). When that has no area, or leaves out most of the texts
    placed in the layout itself (a sheet of notes), the texts' reach is taken in too. A side still
    of no length (a lone line) is padded to A-series proportions, so no paper is ever without area.
    """
    entities = [e for h in artefact.blocks[handle].entities if (e := artefact.entities.get(h))]
    box = _Bounds(artefact, text=False, viewports=False).block(handle)
    first = True
    for entity in entities:
        if isinstance(entity, Entity) and entity.type == "VIEWPORT":
            if not is_main_viewport(dict(entity.values), first):
                box = _union(box, _viewport_rect(entity))
            first = False
    points = [own_ocs(e).apply(e.position)[:2] for e in entities if isinstance(e, Text)]
    if box is None or not _has_area(box) or _most_outside(points, box):
        box = _union(box, _Bounds(artefact, viewports=False).block(handle))
    if box is None:
        return (0.0, 0.0, 1.0, 1.0), True
    if _has_area(box):
        return box, False
    x0, y0, x1, y1 = box
    long = max(x1 - x0, y1 - y0)
    if not long > 0:
        return (x0 - 0.5, y0 - 0.5, x0 + 0.5, y0 + 0.5), True
    short = long / math.sqrt(2)
    if x1 - x0 < short:
        middle = (x0 + x1) / 2
        return (middle - short / 2, y0, middle + short / 2, y1), True
    middle = (y0 + y1) / 2
    return (x0, middle - short / 2, x1, middle + short / 2), True


def _has_area(box: tuple[float, float, float, float]) -> bool:
    return box[2] - box[0] > 0 and box[3] - box[1] > 0


def _most_outside(points: list[tuple[float, float]], box: tuple[float, float, float, float]) -> bool:
    x0, y0, x1, y1 = box
    outside = sum(not (x0 <= x <= x1 and y0 <= y <= y1) for x, y in points)
    return outside * 2 > len(points)


def is_main_viewport(values: dict[str, Any], first: bool) -> bool:
    """AutoCAD's main viewport of a layout: its window on paper space at the last save, not a view
    of model space nor the sheet. It is id 1; a reader that gives no id, or 0 for every viewport
    (ACadSharp's DWGs), leaves the layout's first viewport, when it shows paper space itself (its
    view centred on its own centre at its own height) or carries no id at all."""
    number = values.get("id")
    if number == 1:
        return True
    if not first or (isinstance(number, int) and not isinstance(number, bool) and number >= 2):
        return False
    if number is None:
        return True
    try:
        cx, cy, _ = _shapes._point(values, "center")
        vx, vy, _ = _shapes._point(values, "view_center_point")
        height = _shapes._number(values, "height")
        view_height = _shapes._number(values, "view_height")
    except _shapes.Undrawable:
        return False
    near = 1e-3 * max(abs(height), 1.0)
    return abs(cx - vx) <= near and abs(cy - vy) <= near and abs(height - view_height) <= near


MAX_VIEW_COORDINATE = 1e15
"""A viewport whose model region or scale reaches past this is not read."""


def viewport_transform(values: dict[str, Any]) -> Transform | None:
    """A plan viewport's model-to-paper transform, as the DXF reference defines it (and ezdxf's
    `Viewport.get_transformation_matrix` computes it): model space is taken from the view target,
    scaled by the viewport's height over its view height, turned by the view twist, and moved so the
    view centre (measured from the target, in the view's own turned axes) lands on the viewport's
    centre on paper. None when a value is missing, not finite or of no size (13's analysts found real
    layouts whose view target lies far from the origin, which 11's first renderer left out)."""
    try:
        cx, cy, _ = _shapes._point(values, "center")
        width, height = _shapes._number(values, "width"), _shapes._number(values, "height")
        vx, vy, _ = _shapes._point(values, "view_center_point")
        view_height = _shapes._number(values, "view_height")
        twist = math.radians(_shapes._number(values, "view_twist_angle", 0.0))
        tx, ty = 0.0, 0.0
        if values.get("view_target_point") is not None:
            tx, ty, _ = _shapes._point(values, "view_target_point")
    except _shapes.Undrawable:
        return None
    if not (width > 0 and height > 0 and view_height > 0):
        return None
    scale = height / view_height
    numbers = (cx, cy, vx, vy, tx, ty, width, height, view_height, scale, 1.0 / scale)
    if not all(math.isfinite(v) and abs(v) < MAX_VIEW_COORDINATE for v in numbers):
        return None
    return (
        translation(cx - scale * vx, cy - scale * vy)
        @ rotation_z(twist)
        @ scaling(scale, scale)
        @ translation(-tx, -ty)
    )


def viewport_window(values: dict[str, Any]) -> tuple[float, float, float, float] | None:
    """The model region a plan viewport shows (the box around it, when the view is twisted), in
    drawing units; none when `viewport_transform` has none. 13 asks it whether a layout's viewports
    show anything, so the sheet finder and the renderer look at the same region."""
    to_paper = viewport_transform(values)
    if to_paper is None:
        return None
    try:
        to_model = to_paper.inverse()
    except PlacementError:
        return None
    cx, cy, _ = _shapes._point(values, "center")
    half_w, half_h = _shapes._number(values, "width") / 2, _shapes._number(values, "height") / 2
    corners = [to_model.apply((cx + sx * half_w, cy + sy * half_h)) for sx in (-1, 1) for sy in (-1, 1)]
    xs, ys = [c[0] for c in corners], [c[1] for c in corners]
    window = (min(xs), min(ys), max(xs), max(ys))
    if not all(math.isfinite(v) and abs(v) < MAX_VIEW_COORDINATE for v in window):
        return None
    return window


def _viewport_rect(viewport: Entity) -> tuple[float, float, float, float] | None:
    try:
        cx, cy, _ = _shapes._point(dict(viewport.values), "center")
        width = _shapes._number(dict(viewport.values), "width")
        height = _shapes._number(dict(viewport.values), "height")
    except _shapes.Undrawable:
        return None
    return (cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)


class _Drawer:
    """Draws what a walk yields into a sheet, through one extra transform (a viewport's, or none)."""

    def __init__(
        self,
        sheet: _Sheet,
        outer: Transform,
        window: tuple[float, float, float, float] | None,
        clip: tuple[float, float, float, float] | None,
    ) -> None:
        self.sheet = sheet
        self.outer = outer  # drawing units of the walked space to paper mm
        self.window = window  # the walked space's region to draw (drawing units), or all
        self.clip = clip  # paper mm to cut to, or the sheet's own paper
        self.scale = outer.xy_scale or 1.0

    def transform(self, chain: Chain) -> Transform:
        """The chain's transform. Only the walk's current path is remembered (the walk is depth
        first, and siblings share one chain object), so memory stays in proportion to its depth."""
        depth = len(chain)
        if depth == 0:
            return IDENTITY
        path = self._path
        found = path.get(depth)
        if found is not None and found[0] is chain:
            return found[1]
        parent = path.get(depth - 1)
        if (
            parent is not None
            and len(parent[0]) == depth - 1
            and all(a is b for a, b in zip(parent[0], chain, strict=False))
        ):
            placed = parent[1] @ chain[-1].transform()
        else:
            placed = chain_transform(chain)
        for deeper in [d for d in path if d >= depth]:
            del path[deeper]
        path[depth] = (chain, placed, False)
        return placed

    def run(self, block: str) -> None:
        artefact = self.sheet.artefact
        bounds = self.sheet.bounds
        window = self.window
        # depth -> (chain, its transform, whether its block lies wholly inside the window)
        self._path: dict[int, tuple[Chain, Transform, bool]] = {}
        sheet = self.sheet

        def enter(link: Link, chain: Chain) -> bool:
            if window is None:
                return True
            inner = bounds.block(link.insert.block)
            placed = None if inner is None else _transform_box(self.transform(chain), inner)
            if placed is not None and _contains(window, placed):
                entry = self._path[len(chain)]
                self._path[len(chain)] = (entry[0], entry[1], True)
            return _overlaps(placed, window)

        walk = Walk(artefact, max_visits=sheet.visits_left, enter=enter, stop=sheet.over_time)
        for entity, chain in walk.entities(block):
            if isinstance(entity, Insert):
                continue
            if sheet.over_time():
                break
            if sheet.full("lines") and sheet.full("triangles") and not isinstance(entity, Text):
                sheet.stats["budget_entities_left"] += 1
                continue
            entry = self._path.get(len(chain)) if chain else None
            known = entry is not None and entry[0] is chain and entry[2]
            if window is not None and not known:
                local = bounds.entity(entity)
                if local is not None and not _overlaps(
                    _transform_box(self.transform(chain), local), window
                ):
                    continue
            self.draw(entity, chain, walk)
        sheet.visits_left = max(0, sheet.visits_left - walk.visits)
        for reason, count in walk.refused.items():
            if reason is Refusal.STOPPED:
                continue  # over_time has said so
            if reason is Refusal.VISIT_LIMIT:
                sheet.truncated = True
            sheet.stats[f"refused_{reason}"] += count

    def draw(self, entity: AnyEntity, chain: Chain, walk: Walk, via: AnyEntity | None = None) -> None:
        """Draw one entity. An arithmetic surprise in its values loses that entity, counted as
        `failed_<TYPE>`, never the sheet."""
        try:
            self._draw(entity, chain, walk, via)
        except ArithmeticError, ValueError, IndexError, RuntimeWarning:
            self.sheet.stats[f"failed_{(via or entity).type}"] += 1

    def _draw(self, entity: AnyEntity, chain: Chain, walk: Walk, via: AnyEntity | None = None) -> None:
        sheet = self.sheet
        if isinstance(entity, Text):
            if entity.type == "ATTDEF" and chain:
                return  # an ATTDEF inside a block shows through its ATTRIBs
            self.text(entity, chain, via)
            return
        assert isinstance(entity, Entity)
        kind = entity.type
        if kind == "DIMENSION" and via is None:
            name = entity.values.get("geometry")
            block = sheet.block_names.get(name) if isinstance(name, str) else None
            if block is None:
                sheet.stats["not_drawn_DIMENSION"] += 1
                return
            for part, inner in walk.entities(block, chain):
                if not isinstance(part, Insert):
                    self.draw(part, inner, walk, via=entity)
            return
        if kind == "VIEWPORT" or kind == "DIMENSION":
            return
        placed = self.outer @ self.transform(chain) @ own_ocs(entity)
        tolerance = TOLERANCE_MM / max(placed.xy_scale, 1e-12)
        colour = _colour(entity.values)
        prim = -1
        if kind == "HATCH":
            prim = sheet.primitive(entity, chain, via)
            if prim < 0:
                return
            self.hatch(entity, placed, tolerance, colour, prim)
            return
        found = _shapes.shape(entity, tolerance)
        if found is None:
            sheet.stats[f"not_drawn_{kind}"] += 1
            return
        prim = sheet.primitive(entity, chain, via)
        if prim < 0:
            return
        weight = _lineweight(entity.values, sheet.stats)
        pattern = self.linetype(entity, placed)
        for points, closed in found.lines:
            sheet.add_polyline(
                placed.xy(points, found.elevation), closed, weight, colour, prim, self.clip, pattern
            )
        for triangles in found.fills:
            if len(triangles):
                flat = placed.xy(triangles.reshape(-1, 2), found.elevation).reshape(-1, 3, 2)
                sheet.add_triangles(flat, colour, prim, self.clip)

    def linetype(self, entity: Entity, placed: Transform) -> list[float] | None:
        name = entity.values.get("linetype")
        if not isinstance(name, str) or name.upper() in ("BYLAYER", "BYBLOCK", "CONTINUOUS", ""):
            if isinstance(name, str) and name.upper() in ("BYLAYER", "BYBLOCK"):
                self.sheet.stats["linetype_by_layer"] += 1
            return None
        pattern = _linetypes().get(name.upper())
        if pattern is None or len(pattern) < 2:
            self.sheet.stats["linetype_unknown"] += 1
            return None
        scale = entity.values.get("ltscale", 1.0)
        scale = (
            float(scale)
            if isinstance(scale, int | float)
            and not isinstance(scale, bool)
            and math.isfinite(scale)
            and scale > 0
            else 1.0
        )
        if self.sheet.iso and not name.upper().startswith("ACAD_ISO"):
            scale *= (
                25.4  # acad.lin's patterns are in inches; a millimetre drawing's (acadiso.lin) in mm
            )
        dashes = [x * scale * placed.xy_scale for x in pattern[1:]]
        if sum(abs(x) for x in dashes) < MIN_DASH_PERIOD_MM:
            self.sheet.stats["linetype_too_fine"] += 1
            return None
        return dashes

    def hatch(self, entity: Entity, placed: Transform, tolerance: float, colour: int, prim: int) -> None:
        sheet = self.sheet
        values = dict(entity.values)
        try:
            loops = _hatch.boundary(values, tolerance)
            elevation = _shapes._point(values, "elevation")[2] if "elevation" in values else 0.0
            if values.get("solid_fill") == 1:
                triangles = _hatch.fill(loops)
                if len(triangles):
                    flat = placed.xy(triangles.reshape(-1, 2), elevation).reshape(-1, 3, 2)
                    sheet.add_triangles(flat, colour, prim, self.clip)
                return
            name = values.get("pattern_name")
            if not isinstance(name, str) or not _hatch.has_pattern(name, sheet.iso):
                sheet.stats["hatch_pattern_unknown"] += 1
                return
            scale = values.get("pattern_scale", 1.0)
            angle = values.get("pattern_angle", 0.0)
            segments = _hatch.pattern(
                loops, name, float(scale) if isinstance(scale, int | float) else 1.0,
                float(angle) if isinstance(angle, int | float) else 0.0, sheet.iso,
            )  # fmt: skip
        except _hatch.TooComplex:
            sheet.stats["hatch_too_complex"] += 1
            return
        except _shapes.Undrawable:
            sheet.stats["not_drawn_HATCH"] += 1
            return
        if len(segments):
            ends = placed.xy(segments.reshape(-1, 2), elevation).reshape(-1, 4)
            sheet.add_segments(ends, _lineweight(values, sheet.stats), colour, prim, self.clip)

    def text(self, entity: Text, chain: Chain, via: AnyEntity | None) -> None:
        sheet = self.sheet
        local, source = sheet.heights.local(entity)
        if source is HeightSource.DEFAULT:
            sheet.stats["text_height_default"] += 1
        laid: Laid = lay_out(entity, local)
        if not laid.glyphs and not laid.strokes:
            return
        at = frame(entity, chain, local)
        o = self.outer.apply((*at.origin, 0.0))
        xv = self.outer.vector((*at.x_axis, 0.0))
        yv = self.outer.vector((*at.y_axis, 0.0))
        if not all(math.isfinite(v) for v in (*o, *xv, *yv)):
            return
        prim = sheet.primitive(entity, chain, via)
        if prim < 0:
            return
        colour = 0
        sheet.fonts.add((used, Face.REGULAR) for used in laid.fonts)
        if laid.missing:
            sheet.stats["glyphs_missing"] += laid.missing
        if laid.cut:
            sheet.stats["text_characters_cut"] += laid.cut
        for g in laid.glyphs:
            origin = (o[0] + g.u * xv[0] + g.v * yv[0], o[1] + g.u * xv[1] + g.v * yv[1])
            x_axis = (g.sx * xv[0], g.sx * xv[1])
            y_axis = (g.sy * yv[0] + g.shear * xv[0], g.sy * yv[1] + g.shear * xv[1])
            sheet.add_glyph(g.key, g.char, origin, x_axis, y_axis, colour, prim, self.clip)
        weight = DEFAULT_LINEWEIGHT_MM
        for stroke in laid.strokes:
            px = o[0] + stroke[:, 0] * xv[0] + stroke[:, 1] * yv[0]
            py = o[1] + stroke[:, 0] * xv[1] + stroke[:, 1] * yv[1]
            sheet.add_polyline(np.column_stack([px, py]), False, weight, colour, prim, self.clip)


def _viewports(
    sheet: _Sheet, layout: str
) -> Iterable[tuple[Transform, tuple[float, float, float, float], tuple[float, float, float, float]]]:
    """Each viewport of a layout: its model-to-paper transform, its model window and its paper clip."""
    artefact = sheet.artefact
    first = True
    for handle in artefact.blocks[layout].entities:
        viewport = artefact.entities.get(handle)
        if not isinstance(viewport, Entity) or viewport.type != "VIEWPORT":
            continue
        values = dict(viewport.values)
        main = is_main_viewport(values, first)
        first = False
        if main:
            continue  # the layout's own overall viewport shows paper space itself
        try:
            cx, cy, _ = _shapes._point(values, "center")
            width, height = _shapes._number(values, "width"), _shapes._number(values, "height")
            _shapes._point(values, "view_center_point")
            _shapes._number(values, "view_height")
            twist = math.radians(_shapes._number(values, "view_twist_angle", 0.0))
        except _shapes.Undrawable:
            sheet.stats["viewport_unreadable"] += 1
            continue
        direction = values.get("view_direction_vector")
        if isinstance(direction, list) and len(direction) == 3 and (direction[0] or direction[1]):
            sheet.stats["viewport_not_plan"] += 1
            continue
        to_layout = viewport_transform(values)
        window = viewport_window(values)
        if to_layout is None or window is None:
            continue
        if values.get("clipping_boundary_handle") not in (None, "0", 0):
            sheet.stats["viewport_clip_as_rectangle"] += 1
        if twist:
            sheet.stats["viewport_twisted"] += 1
        corners = [
            sheet.to_paper.apply((cx + sx * width / 2, cy + sy * height / 2))
            for sx in (-1, 1)
            for sy in (-1, 1)
        ]
        clip = (
            min(c[0] for c in corners),
            min(c[1] for c in corners),
            max(c[0] for c in corners),
            max(c[1] for c in corners),
        )
        sheet.stats["viewports_drawn"] += 1
        yield sheet.to_paper @ to_layout, window, clip


def build(
    artefact: ReadArtefact, sheet: SheetCandidate, *, limits: Limits = DEFAULT_LIMITS
) -> SheetBuffers:
    """The sheet's buffers (the module's docstring)."""
    block, paper, window = _space(artefact, sheet)
    values = (paper.width_mm, paper.height_mm, paper.mm_per_unit, *paper.origin)
    if min(paper.width_mm, paper.height_mm) <= 0:
        raise ValueError("the sheet's paper has no area")
    if not all(math.isfinite(v) for v in values) or max(paper.width_mm, paper.height_mm) > MAX_PAPER_MM:
        size = f"{paper.width_mm:g} x {paper.height_mm:g} mm"
        raise ValueError(f"the sheet's paper, {size}, is larger than any sheet's")
    gathered = _Sheet(artefact, paper, limits)
    _Drawer(gathered, gathered.to_paper, window, None).run(block)
    if sheet.location.layout is not None:
        model = next((h for h, b in artefact.blocks.items() if b.layout == "Model"), None)
        if model is not None:
            for transform, model_window, clip in list(_viewports(gathered, block)):
                _Drawer(gathered, transform, model_window, clip).run(model)
    return _finish(gathered)


def _finish(sheet: _Sheet) -> SheetBuffers:
    atlas, atlas_glyphs = _pack(sheet)
    glyphs = sheet.glyphs.view().copy()
    if len(glyphs) and len(atlas_glyphs) < len(sheet.atlas_fields):
        glyphs = glyphs[glyphs["glyph"] < len(atlas_glyphs)]
    fonts = np.array(
        [
            (
                sheet.string(use.substitute.asked),
                sheet.string(use.substitute.drawn_with),
                sheet.string(str(use.substitute.how_close)),
                sheet.string(use.substitute.kind),
                use.texts,
            )
            for use in sheet.fonts.rows()
        ],
        dtype=FONT,
    ) if sheet.fonts else np.zeros(0, dtype=FONT)  # fmt: skip
    return SheetBuffers(
        paper=sheet.paper,
        strings=sheet.strings,
        chains=sheet.chains,
        primitives=np.array(sheet.primitives, dtype=PRIM)
        if sheet.primitives
        else np.zeros(0, dtype=PRIM),
        lines=sheet.packed_lines(),
        triangles=sheet.packed_triangles(),
        glyphs=glyphs,
        atlas_glyphs=atlas_glyphs,
        atlas=atlas,
        fonts=fonts,
        stats=dict(sorted(sheet.stats.items())),
        truncated=sheet.truncated,
    )


def _pack(sheet: _Sheet) -> tuple[NDArray[np.uint8], NDArray[np.void]]:
    """Every glyph field on shelves ATLAS_WIDTH wide; fields past the atlas's height are left out."""
    placed: list[tuple[int, int, Field]] = []
    x = y = shelf = 0
    for field_ in sheet.atlas_fields:
        h, w = field_.pixels.shape
        if x + w > ATLAS_WIDTH:
            x, y, shelf = 0, y + shelf, 0
        if y + h > sheet.limits.atlas_height:
            sheet.truncated = True
            sheet.stats["budget_atlas"] += len(sheet.atlas_fields) - len(placed)
            break
        placed.append((x, y, field_))
        x += w
        shelf = max(shelf, h)
    height = y + shelf if placed else 0
    atlas = np.zeros((height, ATLAS_WIDTH if placed else 0), dtype=np.uint8)
    table = np.zeros(len(placed), dtype=AGLY)
    for i, (u, v, found) in enumerate(placed):
        h, w = found.pixels.shape
        atlas[v : v + h, u : u + w] = found.pixels
        table[i] = (u, v, u + w, v + h, *found.box)
    return atlas, table


__all__ = [
    "DEFAULT_LIMITS",
    "SDF_PX_PER_UNIT",
    "BufferError",
    "Limits",
    "Paper",
    "SheetBuffers",
    "build",
    "is_main_viewport",
    "viewport_transform",
    "viewport_window",
]
