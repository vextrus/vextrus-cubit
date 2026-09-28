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
from dataclasses import dataclass
from functools import cache, lru_cache

import numpy as np
from ezdxf.tools import standards
from numpy.typing import NDArray

from engine.geometry.placement import (
    Chain,
    Link,
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
from engine.render.fonts import Substitute
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
    lines: int = 4_000_000
    triangles: int = 2_000_000
    glyphs: int = 1_000_000
    atlas_height: int = 4096
    visits: int = 10_000_000
    seconds: float = 300.0
    """How long one sheet may take; past it the sheet is cut (flag bit 0, `budget_seconds`)."""


DEFAULT_LIMITS = Limits()


class PaperSource:
    LAYOUT = 0
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


def _paper_for_box(box: tuple[float, float, float, float], insunits: int) -> Paper:
    x0, y0, x1, y1 = box
    width, height = x1 - x0, y1 - y0
    unit = UNIT_MM.get(insunits, 1.0)
    long_units, short_units = max(width, height), min(width, height)
    best: tuple[float, float] | None = None
    for long_mm, short_mm in SHEETS_MM:
        for scale in SCALES:
            a = long_units * unit / scale
            b = short_units * unit / scale
            error = max(abs(a - long_mm) / long_mm, abs(b - short_mm) / short_mm)
            if error <= STANDARD_MATCH and (best is None or error < best[0]):
                best = (error, unit / scale)
    if best is not None:
        mm_per_unit, source = best[1], PaperSource.STANDARD
    else:
        mm_per_unit = ASSUMED_LONG_SIDE_MM / long_units if long_units > 0 else 1.0
        source = PaperSource.ASSUMED
    return Paper(width * mm_per_unit, height * mm_per_unit, mm_per_unit, source, (x0, y0))


class _Bounds:
    """Each block's extents in its own coordinates, for culling a sheet (larger than exact is fine)."""

    def __init__(self, artefact: ReadArtefact) -> None:
        self.artefact = artefact
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
            reach = (entity.height or 0.0) * (len(entity.text) + 2) + (entity.width or 0.0)
            reach = reach if math.isfinite(reach) else 0.0
            x, y, _ = own_ocs(entity).apply(entity.position)
            return (x - reach, y - reach, x + reach, y + reach)
        if entity.type == "VIEWPORT":  # its view centre and target are model space's, not the layout's
            return _viewport_rect(entity)
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
    dx, dy = x1 - x0, y1 - y0
    xmin, ymin, xmax, ymax = rect
    t0 = np.zeros(len(segments))
    t1 = np.ones(len(segments))
    keep = np.ones(len(segments), dtype=bool)
    for p, q in ((-dx, x0 - xmin), (dx, xmax - x0), (-dy, y0 - ymin), (dy, ymax - y0)):
        parallel = p == 0
        keep &= ~(parallel & (q < 0))
        with np.errstate(divide="ignore", invalid="ignore"):
            r = np.where(parallel, 0.0, q / np.where(parallel, 1.0, p))
        t0 = np.where(~parallel & (p < 0), np.maximum(t0, r), t0)
        t1 = np.where(~parallel & (p > 0), np.minimum(t1, r), t1)
    keep &= t0 <= t1
    out = np.column_stack([x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy])
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


def dash(
    points: NDArray[np.float64], pattern: list[float], budget: int
) -> list[NDArray[np.float64]] | None:
    """A polyline cut into a linetype's dashes (lengths along it: positive drawn, negative gaps, zero a
    dot); none when it would take more than `budget` pieces."""
    steps = np.diff(points, axis=0)
    lengths = np.hypot(steps[:, 0], steps[:, 1])
    total = float(lengths.sum())
    period = sum(abs(x) for x in pattern)
    if total <= 0 or period <= 0:
        return [points]
    if total / period * len(pattern) > budget:
        return None
    cumulative = np.concatenate([[0.0], np.cumsum(lengths)])
    out = []
    position = 0.0
    index = 0
    while position < total:
        length = pattern[index % len(pattern)]
        end = min(position + abs(length), total)
        if length >= 0:
            a, b = position, max(end, position)
            inner = (cumulative > a) & (cumulative < b)
            xs = np.concatenate(
                [
                    [np.interp(a, cumulative, points[:, 0])],
                    points[inner, 0],
                    [np.interp(b, cumulative, points[:, 0])],
                ]
            )
            ys = np.concatenate(
                [
                    [np.interp(a, cumulative, points[:, 1])],
                    points[inner, 1],
                    [np.interp(b, cumulative, points[:, 1])],
                ]
            )
            out.append(np.column_stack([xs, ys]))
        position = end
        index += 1
    return out


@lru_cache(maxsize=16384)
def _field(key: FontKey, char: str | None) -> Field | None:
    glyph = notdef(key) if char is None else outline(key, char)
    return None if glyph is None else sdf(glyph)


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
        # Gathered in chunks, each with its attributes and the rectangle it is cut to, and cut and
        # packed once at the end (cutting each entity's few segments alone cost most of the time).
        self.segment_chunks: list[
            tuple[NDArray[np.float64], float, int, int, tuple[float, float, float, float]]
        ] = []
        self.triangle_chunks: list[
            tuple[NDArray[np.float64], int, int, tuple[float, float, float, float]]
        ] = []
        self.block_names = {b.name: h for h, b in artefact.blocks.items()}
        self.glyphs: list[tuple[object, ...]] = []
        self.atlas_index: dict[tuple[FontKey, str | None], int] = {}
        self.atlas_fields: list[Field] = []
        self.fonts: Counter[Substitute] = Counter()
        self.stats: Counter[str] = Counter()
        self.counts = {"lines": 0, "triangles": 0}
        self.truncated = False
        self.heights = Heights(artefact)
        self.iso = artefact.summary.insunits in _MILLIMETRE_UNITS  # acadiso.lin and .pat, not acad
        self.bounds = _bounds_of(artefact)
        self.deadline = time.monotonic() + limits.seconds

    def string(self, value: str) -> int:
        if value not in self.string_index:
            self.string_index[value] = len(self.strings)
            self.strings.append(value)
        return self.string_index[value]

    def primitive(self, entity: AnyEntity, chain: Chain, via: AnyEntity | None) -> int:
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
        self.segment_chunks.append((segments[:room], weight, colour, prim, clip or self.rect))
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
        pieces = [points]
        if pattern is not None:
            cut = dash(points, pattern, min(MAX_DASHES, self.limits.lines - self.counts["lines"]))
            if cut is None:
                self.stats["linetype_too_long"] += 1
            else:
                pieces = cut
        for piece in pieces:
            if len(piece) >= 2:
                self.add_segments(np.column_stack([piece[:-1], piece[1:]]), weight, colour, prim, clip)

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
        self.triangle_chunks.append((triangles[:room], colour, prim, clip or self.rect))
        self.counts["triangles"] += room

    def packed_lines(self) -> NDArray[np.void]:
        """Every gathered segment, cut to its rectangle, as LINE records."""
        groups: dict[tuple[float, float, float, float], list[int]] = {}
        for i, chunk in enumerate(self.segment_chunks):
            groups.setdefault(chunk[4], []).append(i)
        records = []
        for rect, members in groups.items():
            chunks = [self.segment_chunks[i] for i in members]
            sizes = [len(c[0]) for c in chunks]
            segments = np.concatenate([c[0] for c in chunks]).reshape(-1, 4)
            attributes = np.repeat(
                np.array([(c[1], c[2], c[3]) for c in chunks], dtype=np.float64), sizes, axis=0
            )
            keep, cut = clip_mask(segments, rect)
            record = np.zeros(int(keep.sum()), dtype=LINE)
            record["x0"], record["y0"], record["x1"], record["y1"] = cut[keep].T
            record["weight"] = attributes[keep, 0]
            record["colour"] = attributes[keep, 1].astype(np.uint32)
            record["prim"] = attributes[keep, 2].astype(np.uint32)
            records.append(record)
        return np.concatenate(records) if records else np.zeros(0, dtype=LINE)

    def packed_triangles(self) -> NDArray[np.void]:
        records = []
        for triangles, colour, prim, rect in self.triangle_chunks:
            cut = clip_triangles(triangles, rect)
            record = np.zeros(len(cut), dtype=TRIS)
            flat = cut.reshape(-1, 6)
            for i, name in enumerate(("x0", "y0", "x1", "y1", "x2", "y2")):
                record[name] = flat[:, i]
            record["colour"], record["prim"] = colour, prim
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
        self.glyphs.append((index, *origin, *x_axis, *y_axis, colour, prim))


def _space(
    artefact: ReadArtefact, sheet: SheetCandidate
) -> tuple[str, Paper, tuple[float, float, float, float] | None]:
    """The block the sheet draws, its paper, and the window it is cut to (in drawing units)."""
    location = sheet.location
    if location.layout is not None:
        handle = next((h for h, b in artefact.blocks.items() if b.layout == location.layout), None)
        if handle is None:
            raise ValueError(f"the sheet's layout {location.layout!r} is not in the drawing")
        box = _bounds_of(artefact).block(handle)
        for h in artefact.blocks[handle].entities:
            viewport = artefact.entities.get(h)
            if isinstance(viewport, Entity) and viewport.type == "VIEWPORT":
                box = _union(box, _viewport_rect(viewport))
        box = box or (0.0, 0.0, 1.0, 1.0)
        unit = UNIT_MM.get(artefact.summary.insunits, 1.0)
        paper = Paper(
            (box[2] - box[0]) * unit,
            (box[3] - box[1]) * unit,
            unit,
            PaperSource.LAYOUT,
            (box[0], box[1]),
        )
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
        """The chain's transform, remembered for the walk (siblings share one chain object)."""
        found = self._transforms.get(id(chain))
        if found is None or found[0] is not chain:
            found = self._transforms[id(chain)] = (chain, chain_transform(chain))
        return found[1]

    def run(self, block: str) -> None:
        artefact = self.sheet.artefact
        bounds = self.sheet.bounds
        window = self.window
        self._transforms: dict[int, tuple[Chain, Transform]] = {}
        inside: dict[int, tuple[Chain, bool]] = {}  # chains whose whole block lies inside the window

        def enter(link: Link, chain: Chain) -> bool:
            if window is None:
                return True
            inner = bounds.block(link.insert.block)
            placed = None if inner is None else _transform_box(self.transform(chain), inner)
            if placed is not None and _contains(window, placed):
                inside[id(chain)] = (chain, True)
            return _overlaps(placed, window)

        deadline = self.sheet.deadline
        walk = Walk(
            artefact,
            max_visits=self.sheet.limits.visits,
            enter=enter,
            stop=lambda: time.monotonic() > deadline,
        )
        for entity, chain in walk.entities(block):
            if isinstance(entity, Insert):
                continue
            if self.sheet.full("lines") and self.sheet.full("triangles"):
                self.sheet.stats["budget_entities_left"] += 1
                continue
            known = inside.get(id(chain))
            if window is not None and not (known is not None and known[0] is chain):
                local = bounds.entity(entity)
                if local is not None and not _overlaps(
                    _transform_box(self.transform(chain), local), window
                ):
                    continue
            self.draw(entity, chain, walk)
        for reason, count in walk.refused.items():
            if reason in (Refusal.STOPPED, Refusal.VISIT_LIMIT):
                self.sheet.truncated = True
            name = "budget_seconds" if reason is Refusal.STOPPED else f"refused_{reason}"
            self.sheet.stats[name] += count

    def draw(self, entity: AnyEntity, chain: Chain, walk: Walk, via: AnyEntity | None = None) -> None:
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
            self.hatch(entity, placed, tolerance, colour, prim)
            return
        found = _shapes.shape(entity, tolerance)
        if found is None:
            sheet.stats[f"not_drawn_{kind}"] += 1
            return
        prim = sheet.primitive(entity, chain, via)
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
        colour = 0
        for used in laid.fonts:
            if used.asked:
                sheet.fonts[used] += 1
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
        number = values.get("id")
        if number == 1 or (number is None and first):
            first = False
            continue  # the layout's own overall viewport shows paper space itself
        first = False
        try:
            cx, cy, _ = _shapes._point(values, "center")
            width, height = _shapes._number(values, "width"), _shapes._number(values, "height")
            vx, vy, _ = _shapes._point(values, "view_center_point")
            view_height = _shapes._number(values, "view_height")
            twist = math.radians(_shapes._number(values, "view_twist_angle", 0.0))
        except _shapes.Undrawable:
            sheet.stats["viewport_unreadable"] += 1
            continue
        direction = values.get("view_direction_vector")
        if isinstance(direction, list) and len(direction) == 3 and (direction[0] or direction[1]):
            sheet.stats["viewport_not_plan"] += 1
            continue
        if width <= 0 or height <= 0 or view_height <= 0:
            continue
        if values.get("clipping_boundary_handle") not in (None, "0", 0):
            sheet.stats["viewport_clip_as_rectangle"] += 1
        if twist:
            sheet.stats["viewport_twisted"] += 1
        scale = height / view_height
        to_layout = (
            translation(cx, cy) @ rotation_z(twist) @ scaling(scale, scale) @ translation(-vx, -vy)
        )
        half_w, half_h = width / scale / 2, height / scale / 2
        reach = math.hypot(half_w, half_h)
        window = (vx - reach, vy - reach, vx + reach, vy + reach)
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
    glyphs = np.array(sheet.glyphs, dtype=GLYF) if sheet.glyphs else np.zeros(0, dtype=GLYF)
    if len(glyphs) and len(atlas_glyphs) < len(sheet.atlas_fields):
        glyphs = glyphs[glyphs["glyph"] < len(atlas_glyphs)]
    fonts = np.array(
        [
            (
                sheet.string(s.asked),
                sheet.string(s.drawn_with),
                sheet.string(str(s.how_close)),
                sheet.string(s.kind),
                n,
            )
            for s, n in sorted(sheet.fonts.items(), key=lambda i: (i[0].asked.casefold(), i[0].key))
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
]
