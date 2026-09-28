"""Sheet segmentation (13): the sheets of one drawing file, with what each one's title block says.

    sheets.find(artefact, file_discipline, conventions) -> list[SheetCandidate]   (the harness's stage)
    sheets.segment(artefact, file_discipline, conventions) -> Segmentation        (the same, with counts)
    sheets.sequence(number, conventions) -> NumberParts | None
    sheets.judgement(sheet, view_titles=(), *, conventions=None) -> JudgementRequest | None

**Where sheets are.** A sheet is a frame in model space or a layout (the M0 plan, ticket 13):
- **A frame** is a closed rectangle (a polyline with four right-angled corners) whose region holds a
  title block: at least `MIN_EVIDENCE` of the conventions' title-block labels ("SHEET NO", "SCALE",
  "DATE"; `title_block_fields` and `title_block_words`), or an attribute tagged with one. The rectangle
  is a frame block's own (its largest closed rectangle, each insert of the block placed through 11's
  `placement`, so a rotated, scaled or mirrored frame lands where AutoCAD draws it, whatever the
  block's name or its base point), or one drawn in model space itself. A frame inside another frame is
  part of it (one sheet); a rectangle holding two frames or more (a box around a row of sheets) is not
  a sheet. A closed rectangle with no title block is a sheet too when it stands outside every frame,
  is a sheet's shape (`COVER_ASPECT`) and between `COVER_SIZE` of the file's frames in size, and holds
  `MIN_COVER_CONTENT` lines of text or more (a cover, or a contents sheet); it has no number.
- **A layout** is a sheet when its viewports show model space (`MIN_SHOWN` drawn things or more), or
  when it draws a title block and more in paper space. AutoCAD's own main viewport is left out by the
  renderer's rule (`buffers.is_main_viewport`), and a viewport's region is found as the renderer finds
  it (`buffers.viewport_window`). **A layout whose viewports show nothing is not a sheet:** it is
  dropped, or, where it carries a title block, proposed out as `blank`, with no value read from it
  (a stale layout's title block is a template's; the QS review, Q7); one with no viewport of its own
  that draws only a title block is a template's tab, and dropped. A layout that shows a
  model-space frame, with no title block of its own, is that frame's plot: the frame is the sheet
  (one sheet, not two); one with its own title block showing one frame is the sheet, and the frame
  is not.

**What a title block says.** Each field (number, title, revision mark, issue date) is read in order
from: (1) the frame insert's attributes whose tag names the field (`SHEET_NO`, `TITLE`, `TITLE2`: the
lines of one title in their order); (2) text placed where the frame block defines such an attribute
(attributes burst to text); (3) text by its place in the title block: the text after its label on its
line, or under it, as a person reads it, in the label's own direction (so a title block turned a
quarter turn reads as an upright one), each text the value of the nearest label before it. Labels
are the conventions' words, preferred in their order ("sheet title" before "title" before "drawing
title"). A value is decoded by 11's `engine.text.decode`, its lines joined by a space; one longer than
its field's bound (`MAX_FIELD`) is no value. **The revision mark comes else from the file name** by
the conventions' pattern ("R0, from the file name"; "Final" is not a mark), the file's name alone:
nothing is opened, joined or followed. **The Discipline** is the file's, else the one whose prefix the
number carries ("S-" of "S-01"), among the Disciplines the conventions carry. **Storeys as stated**
are `storeys.read`'s of the title.

**Anchors.** A sheet's anchors are its frame first (the frame insert, or its rectangle), then each
value's text, as `DwgAnchor`s. A layout sheet's anchor key (`DwgAnchor.sheet`) is its layout's name; a
model-space sheet's is `MODEL_SHEET` followed by its frame's handles, the inserts it is reached
through and then the frame's own, joined by "/" (`model/1A2B`): a `/` no layout name can hold, and
handles stable within the file. 14's `resolve` treats it as opaque.

**Hostile input is bounded** (a ReadArtefact is the drawing's): model space and each layout are walked
once each through `placement.Walk` with a visit budget (`MAX_VISITS`); an insert with a scale of 0 or
not finite, or a viewport whose values are not finite or past `MAX_COORDINATE`, is skipped and counted,
never divided by; a text longer than `MAX_RAW_TEXT` is not decoded; texts and drawn points are indexed
once per artefact, sorted, so a frame or viewport query is a search, not a scan per layout; a
layout's name that is empty, or one repeated, is counted and read once. `Segmentation.counts` says what
was skipped, by name.

**Numbers** (`sequence`): the first run of digits is the running number, what comes before it the
prefix and what follows the suffix ("S-01/1" is "S-", 1, "/1"), unless a conventions pattern with the
groups `prefix`, `running` and `suffix` matches first. Numbers are never normalised ("S-O1" has the
prefix "S-O"). A digit is a Unicode decimal digit of any script; a superscript is not one. Invisible
format characters (zero width, bidi) are not part of a number; a run of more than `MAX_RUNNING_DIGITS`
digits is no number.
"""

import bisect
import json
import math
import re
import unicodedata
from collections import Counter
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field, replace
from functools import cache
from pathlib import Path, PureWindowsPath

from engine.geometry.placement import (
    IDENTITY,
    Chain,
    PlacementError,
    Transform,
    Walk,
    chain_transform,
    link,
    own_ocs,
)
from engine.read.anchor import DwgAnchor
from engine.read.artefact import AnyEntity, Entity, Insert, ReadArtefact, Text
from engine.recognise import storeys
from engine.recognise.types import (
    Box,
    Exclusion,
    ExclusionReason,
    JudgementRequest,
    SheetCandidate,
    SheetConventions,
    SheetField,
    SheetLocation,
    Sourced,
    ValueSource,
    pattern_search,
)
from engine.render.buffers import is_main_viewport, viewport_window
from engine.text.decode import decode
from engine.text.mtext import Heights, frame

MODEL_SHEET = "model/"
"""The start of a model-space sheet's anchor key: no layout's name holds a `/`."""
DEFAULT_CONVENTIONS = Path(__file__).with_name("conventions") / "sheet-default.json"

MIN_EVIDENCE = 2
"""The fewest distinct title-block labels that make a rectangle a frame."""
MIN_SHOWN = 3
"""The fewest drawn things a layout's viewports must show for it to be a sheet."""
COVER_ASPECT = (1.2, 1.75)
"""A sheet's shape, long side over short (ISO, ANSI and ARCH papers lie between)."""
COVER_SIZE = (0.3, 2.0)
"""A rectangle with no title block, as a fraction of the file's frames' median long side."""
MIN_COVER_CONTENT = 3
"""The fewest lines of text a rectangle with no title block must hold to be a sheet (a cover)."""
MAX_VISITS = 5_000_000
"""The most entities one walk visits (placement's budget)."""
MAX_VIEWPORTS = 10_000
"""The most viewports one file's layouts are asked what they show."""
MAX_RAW_TEXT = 4096
"""The longest text decoded, in characters as stored."""
MAX_FIELD = {
    SheetField.NUMBER: 24,
    SheetField.TITLE: 256,
    SheetField.REVISION_MARK: 16,
    SheetField.ISSUE_DATE: 32,
}
"""The longest value of each field, in characters: a longer text is no field candidate."""
MAX_RUNNING_DIGITS = 9
"""The most digits a running number holds (`int()` is never given more)."""
MAX_COORDINATE = 1e12
"""A viewport value past this (drawing units) is not read."""
MAX_FACTS = 12
"""The most view titles a judgement request carries."""
MAX_FACT = 256
"""The longest fact a judgement request carries, in characters."""
NODE = "sheet_type"
QUESTION = "What kind of sheet is this?"
"""The closed question the sheet-type node asks Jev (15's `ask`); Jev's words, not a QS's."""


# Numbers -----------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class NumberParts:
    """A sheet number's prefix ("S-"), its running number (9 for "09") and its suffix ("A", "/1")."""

    prefix: str
    running: int
    suffix: str


def sequence(number: str, conventions: SheetConventions) -> NumberParts | None:
    """The number's parts (the module's docstring, "Numbers"); none when it holds no digit."""
    if not isinstance(number, str):
        return None
    shown = _visible(number).strip()
    if not shown:
        return None
    for pattern in conventions.number_patterns:
        match = pattern_search(pattern, shown)
        if match is not None and {"prefix", "running", "suffix"} <= set(match.groupdict()):
            running = match.group("running") or ""
            value = _digits(running)
            if value is not None and match.group(0) == shown:
                return NumberParts(match.group("prefix") or "", value, match.group("suffix") or "")
    for i, c in enumerate(shown):
        if unicodedata.category(c) == "Nd":
            j = i
            while j < len(shown) and unicodedata.category(shown[j]) == "Nd":
                j += 1
            value = _digits(shown[i:j])
            if value is None:
                return None
            return NumberParts(shown[:i], value, shown[j:])
    return None


def _digits(run: str) -> int | None:
    if not run or len(run) > MAX_RUNNING_DIGITS:
        return None
    if not all(unicodedata.category(c) == "Nd" for c in run):
        return None
    return int("".join(str(unicodedata.decimal(c)) for c in run))


def _visible(text: str) -> str:
    """The text without invisible format characters (zero width, bidi marks, the byte-order mark)."""
    return "".join(c for c in text if unicodedata.category(c) != "Cf")


# The result --------------------------------------------------------------------------------------------


@dataclass
class Segmentation:
    """The sheets found, and what was skipped or dropped on the way, counted by name."""

    sheets: list[SheetCandidate] = field(default_factory=list)
    counts: Counter[str] = field(default_factory=Counter)


def find(
    artefact: ReadArtefact, file_discipline: str | None, conventions: SheetConventions
) -> list[SheetCandidate]:
    """The file's sheets (the harness's `sheets` stage; the module's docstring). `group` is left
    unset: the caller stamps it."""
    return segment(artefact, file_discipline, conventions).sheets


def segment(
    artefact: ReadArtefact, file_discipline: str | None, conventions: SheetConventions
) -> Segmentation:
    """`find`, with the counts of what was skipped (the module's docstring)."""
    return _Segmenter(artefact, file_discipline, conventions).run()


# Words -------------------------------------------------------------------------------------------------


def _normal(text: str) -> str:
    """Lower case, every run of punctuation and space one space: "Sheet No.:" is "sheet no"."""
    return " ".join(re.findall(r"[^\W_]+", text.casefold()))


def _tag_words(tag: str) -> tuple[str, int]:
    """An attribute tag's words and its line number: `TITLE2` is ("title", 2), `SHEET_NO` ("sheet no",
    0); a number inside the tag (`REV1_DATE`) is kept, so it names no field."""
    words = re.findall(r"[^\W\d_]+|\d+", tag.casefold())
    line = 0
    if words and words[-1].isdigit() and len(words) > 1 and len(words[-1]) <= 3:
        line = int(words[-1])
        words = words[:-1]
    return " ".join(words), line


@dataclass(frozen=True)
class _Labels:
    """The conventions' title-block words: each field's, in order of preference, and the rest."""

    fields: Mapping[str, tuple[SheetField, int]]  # normal word -> (field, preference)
    others: frozenset[str]

    @classmethod
    def of(cls, conventions: SheetConventions) -> _Labels:
        fields: dict[str, tuple[SheetField, int]] = {}
        for f in conventions.title_block_fields:
            if f.field == SheetField.STOREYS:
                continue
            for rank, word in enumerate(f.words):
                fields.setdefault(_normal(word), (f.field, rank))
        others = frozenset(_normal(w) for w in conventions.title_block_words) - set(fields)
        return cls(fields, others - {""})

    def label(self, raw: str) -> tuple[str, str | None] | None:
        """The label word a text is, and the value written after it on the same text ("DATE:
        12.08.2026"), or none when the text is no label."""
        normal = _normal(raw)
        if normal in self.fields or normal in self.others:
            return normal, None
        head, sep, tail = raw.partition(":")
        if sep and tail.strip():
            word = _normal(head)
            if word in self.fields or word in self.others:
                return word, tail.strip()
        return None


# Placed texts and points -------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Placed:
    """A text where it is drawn: decoded, its world origin, baseline and up axes (one height long),
    its box in its own axes (in heights: x along the baseline, y up), and how it was reached."""

    entity: Text
    chain: Chain
    shown: str
    origin: tuple[float, float]
    x_axis: tuple[float, float]
    y_axis: tuple[float, float]
    box: tuple[float, float, float, float]
    loose: bool  # drawn in the space itself, not inside a block

    @property
    def height(self) -> float:
        return math.hypot(*self.y_axis)

    def centre(self) -> tuple[float, float]:
        x0, y0, x1, y1 = self.box
        return self.point((x0 + x1) / 2, (y0 + y1) / 2)

    def point(self, u: float, v: float) -> tuple[float, float]:
        ox, oy = self.origin
        return (
            ox + u * self.x_axis[0] + v * self.y_axis[0],
            oy + u * self.x_axis[1] + v * self.y_axis[1],
        )

    def corners(self) -> list[tuple[float, float]]:
        x0, y0, x1, y1 = self.box
        return [self.point(x0, y0), self.point(x1, y0), self.point(x1, y1), self.point(x0, y1)]

    def in_frame_of(self, other: _Placed) -> tuple[float, float, float, float]:
        """This text's box in `other`'s axes, in `other`'s heights, from `other`'s origin."""
        ux, uy = _unit(other.x_axis)
        vx, vy = _unit(other.y_axis)
        h = other.height or 1.0
        ox, oy = other.origin
        us, vs = [], []
        for x, y in self.corners():
            dx, dy = x - ox, y - oy
            us.append((dx * ux + dy * uy) / h)
            vs.append((dx * vx + dy * vy) / h)
        return (min(us), min(vs), max(us), max(vs))


def _unit(v: tuple[float, float]) -> tuple[float, float]:
    length = math.hypot(*v)
    return (1.0, 0.0) if not length > 0 else (v[0] / length, v[1] / length)


class _Index:
    """Points sorted by x, for counting and listing what lies in a box (a search, not a scan)."""

    def __init__(self, items: Iterable[tuple[float, float, int]]) -> None:
        ordered = sorted(items)
        self.xs = [p[0] for p in ordered]
        self.items = ordered

    def within(self, box: tuple[float, float, float, float]) -> Iterator[int]:
        x0, y0, x1, y1 = box
        start = bisect.bisect_left(self.xs, x0)
        stop = bisect.bisect_right(self.xs, x1)
        for _x, y, i in self.items[start:stop]:
            if y0 <= y <= y1:
                yield i

    def entries(self, box: tuple[float, float, float, float]) -> Iterator[tuple[float, float, int]]:
        x0, y0, x1, y1 = box
        start = bisect.bisect_left(self.xs, x0)
        stop = bisect.bisect_right(self.xs, x1)
        for x, y, i in self.items[start:stop]:
            if y0 <= y <= y1:
                yield x, y, i

    def count(self, box: tuple[float, float, float, float], enough: int) -> int:
        found = 0
        for _ in self.within(box):
            found += 1
            if found >= enough:
                break
        return found


# Frames ------------------------------------------------------------------------------------------------

type Corners = tuple[tuple[float, float], tuple[float, float], tuple[float, float], tuple[float, float]]
type Bounds = tuple[float, float, float, float]


@dataclass
class _Frame:
    """A candidate frame: its rectangle's four corners in its space, how it was found (the frame
    insert and the inserts it is reached through, or a rectangle drawn in the space itself), and its
    title-block evidence (the distinct labels inside it)."""

    corners: Corners
    handle: str  # the frame insert's, or the rectangle's
    chain: Chain  # the inserts it is reached through (not the frame insert itself)
    insert: Insert | None
    transform: Transform  # the frame block's coordinates to its space (identity for a rectangle)
    evidence: frozenset[str] = frozenset()
    label_texts: frozenset[int] = frozenset()  # the label texts inside it, by their index in the space

    @property
    def bbox(self) -> Bounds:
        xs = [c[0] for c in self.corners]
        ys = [c[1] for c in self.corners]
        return (min(xs), min(ys), max(xs), max(ys))

    @property
    def area(self) -> float:
        long, short = self.sides
        return long * short

    @property
    def sides(self) -> tuple[float, float]:
        a = math.dist(self.corners[0], self.corners[1])
        b = math.dist(self.corners[1], self.corners[2])
        return (max(a, b), min(a, b))

    def contains(self, point: tuple[float, float], margin: float = 0.0) -> bool:
        return _inside(self.corners, point, margin)

    def holds(self, other: _Frame) -> bool:
        margin = 1e-6 * max(self.sides[0], 1.0)
        return all(self.contains(c, margin) for c in other.corners)

    def key(self) -> str:
        return MODEL_SHEET + "/".join([*(link.insert.handle for link in self.chain), self.handle])

    def chain_handles(self) -> tuple[str, ...]:
        return tuple(link.insert.handle for link in self.chain)


def _inside(corners: Sequence[tuple[float, float]], point: tuple[float, float], margin: float) -> bool:
    """Whether a point lies in a convex quadrilateral (either winding), `margin` outside counted in."""
    px, py = point
    sign = 0.0
    for i in range(4):
        ax, ay = corners[i]
        bx, by = corners[(i + 1) % 4]
        edge = math.hypot(bx - ax, by - ay) or 1.0
        cross = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / edge
        if abs(cross) <= margin:
            continue
        if sign == 0.0:
            sign = cross
        elif (cross > 0) != (sign > 0):
            return False
    return True


def _rectangle(entity: AnyEntity) -> Corners | None:
    """A closed polyline's four corners, in its block's coordinates, when it is a rectangle (four
    right angles, no bulge); none for any other shape."""
    if not isinstance(entity, Entity) or entity.type not in ("LWPOLYLINE", "POLYLINE"):
        return None
    values = entity.values
    points = _vertices(values)
    if points is None:
        return None
    closed = bool(_int(values.get("flags")) & 1) or values.get("closed") is True
    if len(points) == 5 and math.dist(points[0], points[4]) <= 1e-9 * (1 + math.hypot(*points[0])):
        points = points[:4]
        closed = True
    if not closed or len(points) != 4:
        return None
    for i in range(4):
        ax, ay = points[i - 1]
        bx, by = points[i]
        cx, cy = points[(i + 1) % 4]
        u, v = (bx - ax, by - ay), (cx - bx, cy - by)
        lu, lv = math.hypot(*u), math.hypot(*v)
        if not (lu > 0 and lv > 0) or abs(u[0] * v[0] + u[1] * v[1]) > 0.02 * lu * lv:
            return None
    ocs = own_ocs(entity)
    z = _elevation(values)
    placed = [ocs.apply((x, y, z))[:2] for x, y in points]
    if not all(math.isfinite(c) for p in placed for c in p):
        return None
    return (placed[0], placed[1], placed[2], placed[3])


def _vertices(values: Mapping[str, object]) -> list[tuple[float, float]] | None:
    raw = values.get("points", values.get("vertices"))
    if not isinstance(raw, list) or not 4 <= len(raw) <= 5:
        return None
    out = []
    for p in raw:
        if not isinstance(p, list | tuple) or len(p) < 2:
            return None
        if len(p) >= 5 and _number(p[4]) not in (0.0, None):
            return None  # a bulge: an arc, not a corner
        x, y = _number(p[0]), _number(p[1])
        if x is None or y is None:
            return None
        out.append((x, y))
    return out


def _number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        return None
    return float(value)


def _int(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _elevation(values: Mapping[str, object]) -> float:
    return _number(values.get("elevation")) or 0.0


def _finite_insert(insert: Insert) -> bool:
    values = (*insert.point, *insert.scale, insert.rotation_radians, *insert.extrusion)
    return all(math.isfinite(v) for v in values) and insert.scale[0] != 0 and insert.scale[1] != 0


def _flat(insert: Insert) -> Insert:
    """An insert with a Z scale of 0 lies flat: its XY placement is its own, so it is placed with a Z
    scale of 1 (10's reader met such a file); its frame is then never singular in XY."""
    if insert.scale[2] != 0:
        return insert
    return replace(insert, scale=(insert.scale[0], insert.scale[1], 1.0))


def _anchor_point(entity: Entity) -> tuple[float, float, float] | None:
    """One point an entity draws, in its own coordinates (where a viewport would show it)."""
    values = entity.values
    for key in ("start", "center", "location", "insert", "defpoint", "vtx0"):
        raw = values.get(key)
        if isinstance(raw, list) and len(raw) >= 2:
            x, y = _number(raw[0]), _number(raw[1])
            if x is not None and y is not None:
                z = _number(raw[2]) if len(raw) > 2 else 0.0
                return (x, y, z or 0.0)
    for key in ("points", "vertices", "control_points"):
        raw = values.get(key)
        if isinstance(raw, list) and raw and isinstance(raw[0], list | tuple) and len(raw[0]) >= 2:
            x, y = _number(raw[0][0]), _number(raw[0][1])
            if x is not None and y is not None:
                return (x, y, _elevation(values))
    return None


def _text_box(entity: Text, shown: str, local_height: float) -> Bounds:
    """A text's box in its own axes, in heights: along its baseline from its origin, and up."""
    lines = shown.split("\n")
    longest = max(len(line) for line in lines)
    if entity.type != "MTEXT":
        return (0.0, 0.0, max(longest * 0.75, 0.5), 1.0)
    reference = entity.width if entity.width is not None and math.isfinite(entity.width) else 0.0
    width = reference / local_height if local_height > 0 and reference > 0 else longest * 0.75
    width = min(max(width, 0.5), longest * 1.5 + 1.0)
    height = 1.0 + (len(lines) - 1) * 1.667
    attachment = (
        entity.attachment if entity.attachment is not None and 1 <= entity.attachment <= 9 else 1
    )
    column, row = (attachment - 1) % 3, (attachment - 1) // 3
    left = -column * width / 2
    top = row * height / 2
    return (left, top - height, left + width, top)


def _box_share(inner: Bounds, outer: Bounds) -> float:
    """The share of `inner`'s area inside `outer`."""
    w = min(inner[2], outer[2]) - max(inner[0], outer[0])
    h = min(inner[3], outer[3]) - max(inner[1], outer[1])
    area = (inner[2] - inner[0]) * (inner[3] - inner[1])
    return 0.0 if w <= 0 or h <= 0 or area <= 0 else (w * h) / area


def _sheet_shape(frame: _Frame) -> bool:
    long, short = frame.sides
    return short > 0 and long / short <= MAX_ASPECT


MAX_ASPECT = 3.0
"""A frame's long side is at most this many times its short side (a strip is a title block)."""


# The segmenter -----------------------------------------------------------------------------------------


@dataclass
class _Space:
    """What one space (model space, or a layout) draws: its texts, placed; the points it draws; and
    its candidate frames."""

    handle: str
    texts: list[_Placed]
    points: _Index
    candidates: list[_Frame]
    labels: _Index  # the texts that are labels, by their origin
    text_index: _Index  # every text, by its origin
    frames: list[_Frame] = field(default_factory=list)


class _Segmenter:
    def __init__(
        self, artefact: ReadArtefact, file_discipline: str | None, conventions: SheetConventions
    ) -> None:
        self.artefact = artefact
        self.conventions = conventions
        self.discipline = file_discipline if file_discipline in conventions.discipline_keys() else None
        self.labels = _Labels.of(conventions)
        self.counts: Counter[str] = Counter()
        self.heights = Heights(artefact)
        self.transforms: dict[int, tuple[Chain, Transform]] = {}
        self.rectangles: dict[str, Corners | None] = {}
        self.attdefs: dict[str, list[Text]] = {}
        self.viewports_asked = 0

    # Walking a space

    def _transform(self, chain: Chain) -> Transform:
        if not chain:
            return IDENTITY
        held = self.transforms.get(id(chain))
        if held is not None and held[0] is chain:
            return held[1]
        placed = chain_transform(chain)
        self.transforms[id(chain)] = (chain, placed)
        return placed

    def space(self, handle: str) -> _Space:
        """Walk one space once: its texts, its drawn points and its candidate frames."""
        walk = Walk(self.artefact, max_visits=MAX_VISITS, enter=self._enter)
        texts: list[_Placed] = []
        points: list[tuple[float, float]] = []
        candidates: list[_Frame] = []
        self.transforms.clear()
        for entity, chain in walk.entities(handle):
            placed = self._transform(chain)
            if isinstance(entity, Text):
                if entity.type == "ATTDEF":
                    continue  # a definition: drawn only through its insert's attribute
                found = self._place(entity, chain)
                if found is not None:
                    texts.append(found)
                    points.append(found.origin)
            elif isinstance(entity, Insert):
                frame = self._insert_frame(entity, chain, placed)
                if frame is not None:
                    candidates.append(frame)
            else:
                point = _anchor_point(entity)
                if point is not None:
                    x, y, _ = (placed @ own_ocs(entity)).apply(point)
                    if math.isfinite(x) and math.isfinite(y):
                        points.append((x, y))
                corners = _rectangle(entity) if not chain else None
                if corners is not None:
                    candidates.append(_Frame(corners, entity.handle, (), None, IDENTITY))
        self.transforms.clear()
        for reason, count in walk.refused.items():
            self.counts[f"walk_{reason}"] += count
        labels = _Index(
            (t.origin[0], t.origin[1], i)
            for i, t in enumerate(texts)
            if self.labels.label(t.shown) is not None
        )
        space = _Space(
            handle,
            texts,
            _Index((x, y, i) for i, (x, y) in enumerate(points)),
            candidates,
            labels,
            _Index((t.origin[0], t.origin[1], i) for i, t in enumerate(texts)),
        )
        for frame in candidates:
            frame.evidence = self._evidence(frame, space)
        space.frames = self._resolve(candidates)
        return space

    def _enter(self, new: object, inner: Chain) -> bool:
        if not _finite_insert(inner[-1].insert):
            self.counts["insert_degenerate"] += 1
            return False
        return True

    def _place(self, entity: Text, chain: Chain) -> _Placed | None:
        if len(entity.text) > MAX_RAW_TEXT:
            self.counts["text_too_long"] += 1
            return None
        shown = decode(entity.text, mtext=entity.type == "MTEXT").strip()
        if not shown:
            return None
        try:
            height = self.heights.resolve(entity, chain)
            axes = frame(entity, chain, height.local)
        except ValueError, ZeroDivisionError, OverflowError:
            self.counts["text_unplaced"] += 1
            return None
        values = (*axes.origin, *axes.x_axis, *axes.y_axis)
        if not all(math.isfinite(v) for v in values) or not math.hypot(*axes.y_axis) > 0:
            self.counts["text_unplaced"] += 1
            return None
        box = _text_box(entity, shown, height.local)
        return _Placed(entity, chain, shown, axes.origin, axes.x_axis, axes.y_axis, box, not chain)

    # Frames

    def _block_rectangle(self, block: str) -> Corners | None:
        """A block's largest closed rectangle, in its own coordinates (and its attribute
        definitions, kept for the attributes burst to text)."""
        if block in self.rectangles:
            return self.rectangles[block]
        record = self.artefact.blocks.get(block)
        best: Corners | None = None
        best_area = 0.0
        attdefs: list[Text] = []
        for handle in record.entities if record is not None else ():
            entity = self.artefact.entities.get(handle)
            if isinstance(entity, Text) and entity.type == "ATTDEF":
                attdefs.append(entity)
                continue
            corners = _rectangle(entity) if entity is not None else None
            if corners is not None:
                area = math.dist(corners[0], corners[1]) * math.dist(corners[1], corners[2])
                if area > best_area:
                    best, best_area = corners, area
        self.rectangles[block] = best
        self.attdefs[block] = attdefs
        return best

    def _insert_frame(self, insert: Insert, chain: Chain, placed: Transform) -> _Frame | None:
        local = self._block_rectangle(insert.block)
        if local is None:
            return None
        if any(link.insert.block == insert.block for link in chain):
            return None  # a block inserting itself: the walk refuses the loop, and so does this
        if not _finite_insert(insert):
            self.counts["frame_degenerate"] += 1
            return None
        try:
            transform = placed @ link(self.artefact, _flat(insert)).transform()
            transform.inverse()  # a frame whose inverse does not exist cannot be read
        except PlacementError:
            self.counts["frame_degenerate"] += 1
            return None
        corners = tuple(transform.apply((x, y, 0.0))[:2] for x, y in local)
        if not all(math.isfinite(c) for p in corners for c in p):
            self.counts["frame_degenerate"] += 1
            return None
        return _Frame(corners, insert.handle, chain, insert, transform)  # type: ignore[arg-type]

    def _evidence(self, frame: _Frame, space: _Space) -> frozenset[str]:
        """The distinct title-block labels inside a frame (its texts', its attributes' tags and its
        block's attribute definitions'); the label texts found are kept on the frame."""
        found: set[str] = set()
        texts: set[int] = set()
        for i in space.labels.within(frame.bbox):
            text = space.texts[i]
            label = self.labels.label(text.shown)
            if label is not None and frame.contains(text.origin):
                found.add(label[0])
                texts.add(i)
        frame.label_texts = frozenset(texts)
        if frame.insert is not None:
            tags = [a.tag for a in self.attdefs.get(frame.insert.block, ())]
            for handle in frame.insert.attribs:
                attrib = self.artefact.entities.get(handle)
                if isinstance(attrib, Text):
                    tags.append(attrib.tag)
            for tag in tags:
                word, _ = _tag_words(tag or "")
                if word in self.labels.fields:
                    found.add(word)
        return frozenset(found)

    def _resolve(self, candidates: list[_Frame]) -> list[_Frame]:
        """The frames that are sheets, from the titled candidates, largest first: one inside a kept
        frame is part of it (one sheet); one holding two or more that lie apart is a box around a row
        of sheets, and one holding a single frame whose labels are all its own is a box around that
        frame: neither is a sheet."""
        titled = [f for f in candidates if len(f.evidence) >= MIN_EVIDENCE and _sheet_shape(f)]
        titled.sort(key=lambda f: -f.area)
        index = _Index((f.bbox[0], f.bbox[1], i) for i, f in enumerate(titled))
        inside_kept: set[int] = set()
        kept: list[_Frame] = []
        for i, f in enumerate(titled):
            if i in inside_kept:
                self.counts["frame_inside_frame"] += 1
                continue
            inner = [
                j
                for j in index.within(f.bbox)
                if j != i
                and (titled[j].area < f.area * 0.999 or j > i)  # a frame drawn twice is one
                and f.holds(titled[j])
            ]
            if _two_apart([titled[j] for j in inner]):
                self.counts["frame_holds_frames"] += 1
                continue
            if any(_box_around(f, titled[j]) for j in inner):
                self.counts["frame_box_around_frame"] += 1
                continue
            kept.append(f)
            inside_kept.update(inner)
        return kept

    def covers(self, space: _Space) -> list[_Frame]:
        """Closed rectangles with no title block that are sheets (the module's docstring)."""
        frames = space.frames
        if not frames:
            return []
        sides = sorted(f.sides[0] for f in frames)
        median = sides[len(sides) // 2]
        low, high = COVER_SIZE[0] * median, COVER_SIZE[1] * median
        frame_index = _Index((f.bbox[0], f.bbox[1], i) for i, f in enumerate(frames))
        plain = []
        for f in space.candidates:
            long, short = f.sides
            if f.insert is not None or len(f.evidence) >= MIN_EVIDENCE or not short > 0:
                continue
            if not (low <= long <= high and COVER_ASPECT[0] <= long / short <= COVER_ASPECT[1]):
                continue
            x0, y0, x1, y1 = f.bbox
            reach = (x0 - high, y0 - high, x1, y1)
            if any(_box_share(frames[j].bbox, f.bbox) > 0 or _box_share(f.bbox, frames[j].bbox) > 0
                   for j in frame_index.within(reach)):  # fmt: skip
                continue
            plain.append(f)
        plain.sort(key=lambda f: -f.area)
        found: list[_Frame] = []
        for f in plain:
            if any(g.holds(f) for g in found):
                continue
            lines = sum(
                space.texts[i].shown.count("\n") + 1
                for x, y, i in space.text_index.entries(f.bbox)
                if f.contains((x, y))
            )
            if lines >= MIN_COVER_CONTENT:
                found.append(f)
        self.counts["cover"] += len(found)
        return found

    # The run

    def run(self) -> Segmentation:
        model = next((h for h, b in self.artefact.blocks.items() if b.layout == "Model"), None)
        sheets: list[SheetCandidate] = []
        space = self.space(model) if model is not None else None
        frames = space.frames if space is not None else []
        self.counts["frame"] += len(frames)
        covers = self.covers(space) if space is not None else []
        plotted: set[int] = set()
        layout_sheets: list[SheetCandidate] = []
        for name, handle in self._layout_blocks():
            sheet, shown = self._layout(name, handle, space)
            if sheet is not None:
                layout_sheets.append(sheet)
            plotted.update(id(f) for f in shown)
        if space is not None:
            reader = _Reader(self, space)
            height = sorted(f.sides[1] for f in frames)[len(frames) // 2] if frames else 1.0
            for f in sorted([*frames, *covers], key=lambda f: _reading_order(f, height)):
                if id(f) in plotted:
                    self.counts["frame_plotted_by_layout"] += 1
                    continue
                sheets.append(reader.model_sheet(f, titled=f in frames))
        sheets.extend(layout_sheets)
        return Segmentation(sheets, self.counts)

    # Layouts

    def _layout_blocks(self) -> Iterator[tuple[str, str]]:
        """Each layout once, in tab order: a name that is empty or all whitespace, or one given twice,
        is counted and left out."""
        order = {name: i for i, name in enumerate(self.artefact.summary.layouts)}
        blocks = sorted(
            ((h, b.layout) for h, b in self.artefact.blocks.items() if b.layout not in (None, "Model")),
            key=lambda hb: (order.get(hb[1] or "", len(order)), hb[0]),
        )
        seen: set[str] = set()
        for handle, name in blocks:
            assert name is not None
            if not _visible(name).strip():
                self.counts["layout_unnamed"] += 1
            elif name in seen:
                self.counts["layout_repeated"] += 1
            else:
                seen.add(name)
                yield name, handle

    def _layout(
        self, name: str, handle: str, model: _Space | None
    ) -> tuple[SheetCandidate | None, list[_Frame]]:
        """A layout's sheet, if it is one, and the model-space frames it is the sheet of."""
        record = self.artefact.blocks[handle]
        entities = [e for h in record.entities if (e := self.artefact.entities.get(h)) is not None]
        viewports = [e for e in entities if isinstance(e, Entity) and e.type == "VIEWPORT"]
        own_entities = [e for e in entities if e not in viewports]
        windows = self._windows(viewports)
        views = sum(1 for _ in windows)
        shown = 0
        for window in windows:
            if window is not None and model is not None and shown < MIN_SHOWN:
                shown += model.points.count(window, MIN_SHOWN - shown)
        if not own_entities and views == 0:
            self.counts["layout_empty"] += 1
            return None, []
        paper = self.space(handle) if own_entities else None
        title_words = {
            label[0] for t in (paper.texts if paper else []) if (label := self.labels.label(t.shown))
        }
        titled = bool(paper and paper.frames) or len(title_words) >= MIN_EVIDENCE
        frames_shown = [
            f
            for f in (model.frames if model is not None else [])
            if any(w is not None and _box_share(f.bbox, w) >= 0.5 for w in windows)
        ]
        drawn = len(own_entities) - (len(paper.frames) if paper else 0) - len(title_words)
        if shown >= MIN_SHOWN or (views == 0 and titled and drawn >= MIN_PAPER_CONTENT):
            if not titled and frames_shown:
                self.counts["layout_plots_frames"] += 1
                return None, []
            assert paper is not None or not titled
            sheet = (
                _Reader(self, paper).layout_sheet(name, entities)
                if paper
                else self._bare(name, entities)
            )
            return sheet, frames_shown if titled and len(frames_shown) == 1 else []
        if titled and views == 0:
            self.counts["layout_title_block_only"] += 1  # a template tab: nothing to propose
            return None, []
        if titled:
            self.counts["layout_blank"] += 1
            first = paper.frames[0].handle if paper and paper.frames else entities[0].handle
            return (
                SheetCandidate(
                    SheetLocation(layout=name),
                    discipline=self._discipline(None),
                    exclusion=Exclusion(ExclusionReason.BLANK),
                    anchors=(self.anchor(name, (), first),),
                ),
                [],
            )
        self.counts["layout_shows_nothing"] += 1
        return None, []

    def _windows(self, viewports: list[Entity]) -> list[Bounds | None]:
        """The model region each of a layout's viewports shows (none where its values cannot be
        read), AutoCAD's main viewport left out, as the renderer does."""
        out: list[Bounds | None] = []
        first = True
        for viewport in viewports:
            values = dict(viewport.values)
            main = is_main_viewport(values, first)
            first = False
            if main:
                continue
            if self.viewports_asked >= MAX_VIEWPORTS:
                self.counts["viewport_budget"] += 1
                out.append(None)
                continue
            self.viewports_asked += 1
            window = viewport_window(values)
            if window is None or not all(abs(v) < MAX_COORDINATE for v in window):
                self.counts["viewport_unreadable"] += 1
                out.append(None)
                continue
            out.append(window)
        return out

    def _bare(self, name: str, entities: list[AnyEntity]) -> SheetCandidate:
        return SheetCandidate(
            SheetLocation(layout=name),
            discipline=self._discipline(None),
            revision_mark=self._file_revision(),
            anchors=(self.anchor(name, (), entities[0].handle),),
        )

    # Values

    def anchor(self, sheet: str, chain: Sequence[str], handle: str) -> DwgAnchor:
        s = self.artefact.summary
        return DwgAnchor(s.source_sha256, s.reader, s.reader_version, sheet, tuple(chain), handle)

    def _discipline(self, number: Sourced | None) -> Sourced | None:
        """The file's Discipline, else the one whose prefix the number carries (one only)."""
        if self.discipline is not None:
            return Sourced(self.discipline, ValueSource.FILE)
        if number is None:
            return None
        parts = sequence(number.value, self.conventions)
        prefix = _normal(parts.prefix) if parts is not None else ""
        if not prefix:
            return None
        matched = {
            d.key for d in self.conventions.disciplines if any(_normal(p) == prefix for p in d.prefixes)
        }
        return Sourced(matched.pop(), number.source) if len(matched) == 1 else None

    def _file_revision(self) -> Sourced | None:
        """The revision mark in the file's name, by the conventions' pattern: the name alone, its
        last part after any folder, never opened or followed."""
        pattern = self.conventions.revision_mark_pattern
        name = self.artefact.summary.source_name
        if pattern is None or not isinstance(name, str) or "\x00" in name:
            return None
        base = PureWindowsPath(name).name
        stem = base.rsplit(".", 1)[0] if "." in base else base
        match = pattern_search(pattern, stem)
        if match is None:
            return None
        mark = (match.group(1) if match.re.groups else match.group(0)) or ""
        mark = _visible(mark).strip()
        return Sourced(mark, ValueSource.FILE_NAME) if mark else None


MIN_PAPER_CONTENT = 20
"""The fewest things a layout with no viewport must draw beyond its title block to be a sheet."""


DOUBLE_BORDER = 0.8
"""A rectangle holding another of at least this share of its area is one border drawn twice."""


def _box_around(outer: _Frame, inner: _Frame) -> bool:
    """Whether `outer` is only a box drawn around `inner`: every label inside it is inside `inner`,
    and `inner` is well inside it (a frame's own double border is not a box around it)."""
    return outer.label_texts <= inner.label_texts and inner.area < DOUBLE_BORDER * outer.area


def _two_apart(frames: list[_Frame]) -> bool:
    """Whether two of the frames lie apart (neither holds the other): a box around them is no sheet."""
    for i, a in enumerate(frames):
        for b in frames[i + 1 :]:
            if not a.holds(b) and not b.holds(a):
                return True
        if i >= 64:
            return len(frames) > 1
    return False


def _reading_order(frame: _Frame, height: float) -> tuple[float, float]:
    """Rows top to bottom, then left to right."""
    x0, y0, _, y1 = frame.bbox
    return (-math.floor((y0 + y1) / 2 / max(height, 1e-9)), x0)


# Reading one sheet -------------------------------------------------------------------------------------

type _Found = dict[SheetField, tuple[str, ValueSource, list[_Placed]]]


class _Reader:
    """Reads the fields of a space's sheets from its placed texts."""

    def __init__(self, segmenter: _Segmenter, space: _Space) -> None:
        self.s = segmenter
        self.space = space
        self.index = space.text_index
        self.by_handle = {t.entity.handle: t for t in space.texts}

    def model_sheet(self, frame: _Frame, *, titled: bool) -> SheetCandidate:
        key = frame.key()
        inside = [
            self.space.texts[i]
            for i in self.index.within(frame.bbox)
            if frame.contains(self.space.texts[i].origin)
        ]
        values = self._fields(frame, inside) if titled else {}
        anchors = [self.s.anchor(key, frame.chain_handles(), frame.handle)]
        return self._candidate(SheetLocation(box=Box(*frame.bbox)), key, values, anchors)

    def layout_sheet(self, name: str, entities: list[AnyEntity]) -> SheetCandidate:
        frame = self.space.frames[0] if self.space.frames else None
        if frame is not None:
            inside = [t for t in self.space.texts if frame.contains(t.origin)]
            anchor = self.s.anchor(name, frame.chain_handles(), frame.handle)
        else:
            inside = list(self.space.texts)
            anchor = self.s.anchor(name, (), entities[0].handle)
        return self._candidate(SheetLocation(layout=name), name, self._fields(frame, inside), [anchor])

    def _candidate(
        self, location: SheetLocation, key: str, values: _Found, anchors: list[DwgAnchor]
    ) -> SheetCandidate:
        sourced: dict[SheetField, Sourced] = {}
        for name in (
            SheetField.NUMBER,
            SheetField.TITLE,
            SheetField.REVISION_MARK,
            SheetField.ISSUE_DATE,
        ):
            if name not in values:
                continue
            value, source, used = values[name]
            sourced[name] = Sourced(value, source)
            anchors.extend(self.s.anchor(key, _handles(t.chain), t.entity.handle) for t in used)
        number = sourced.get(SheetField.NUMBER)
        title = sourced.get(SheetField.TITLE)
        stated = None
        if title is not None:
            plan = storeys.names_a_plan(title.value, self.s.conventions)
            found = storeys.read(title.value, self.s.conventions, plan_title=plan)
            if found.as_stated:
                stated = Sourced(found.as_stated, title.source)
        return SheetCandidate(
            location,
            number=number,
            title=title,
            discipline=self.s._discipline(number),
            revision_mark=sourced.get(SheetField.REVISION_MARK) or self.s._file_revision(),
            issue_date=sourced.get(SheetField.ISSUE_DATE),
            storeys_as_stated=stated,
            anchors=tuple(dict.fromkeys(anchors)),
        )

    def _fields(self, frame: _Frame | None, inside: list[_Placed]) -> _Found:
        found: _Found = {}
        if frame is not None and frame.insert is not None:
            found.update(self._attributes(frame.insert))
            for name, value in self._definitions(frame, inside).items():
                found.setdefault(name, value)
        for name, value in self._by_label(inside).items():
            found.setdefault(name, value)
        return found

    def _attributes(self, insert: Insert) -> _Found:
        """The frame insert's attributes whose tags name a field; a title's lines in their order."""
        by_field: dict[SheetField, list[tuple[int, int, str, list[_Placed]]]] = {}
        for handle in insert.attribs:
            attrib = self.s.artefact.entities.get(handle)
            if not isinstance(attrib, Text) or len(attrib.text) > MAX_RAW_TEXT:
                continue
            word, line = _tag_words(attrib.tag or "")
            held = self.s.labels.fields.get(word)
            shown = decode(attrib.text).strip()
            if held is not None and shown:
                placed = self.by_handle.get(handle)
                by_field.setdefault(held[0], []).append(
                    (held[1], line, shown, [placed] if placed else [])
                )
        return _pick(by_field, ValueSource.TITLE_BLOCK_ATTRIBUTE, self.s.conventions)

    def _definitions(self, frame: _Frame, inside: list[_Placed]) -> _Found:
        """Text drawn where the frame block defines a field's attribute (attributes burst to text)."""
        assert frame.insert is not None
        attdefs = self.s.attdefs.get(frame.insert.block, [])
        loose = [t for t in inside if t.loose]
        if not attdefs or frame.insert.attribs or not loose:
            return {}
        by_field: dict[SheetField, list[tuple[int, int, str, list[_Placed]]]] = {}
        for attdef in attdefs:
            word, line = _tag_words(attdef.tag or "")
            held = self.s.labels.fields.get(word)
            if held is None:
                continue
            x, y, _ = (frame.transform @ own_ocs(attdef)).apply(attdef.position)
            near = min(loose, key=lambda t: math.dist(t.origin, (x, y)))
            if math.dist(near.origin, (x, y)) <= 0.5 * near.height:
                by_field.setdefault(held[0], []).append((held[1], line, near.shown, [near]))
        return _pick(by_field, ValueSource.TITLE_BLOCK_TEXT, self.s.conventions)

    def _by_label(self, inside: list[_Placed]) -> _Found:
        """Text by its place in the title block: each text the value of the nearest label before it
        (the module's docstring); where one field has several labels, the most preferred word's, and
        of those, a loose value's (drawn for this sheet) before one inside the frame's block."""
        labels: list[tuple[_Placed, str, str | None]] = []
        values: list[_Placed] = []
        for text in inside:
            found = self.s.labels.label(text.shown)
            if found is not None:
                labels.append((text, *found))
            elif len(text.shown) <= MAX_FIELD[SheetField.TITLE]:
                values.append(text)
        owner: dict[int, tuple[float, int]] = {}
        for li, (label_text, _, inline) in enumerate(labels):
            if inline is not None:
                continue
            for vi, value in enumerate(values):
                score = _after(label_text, value)
                if score is not None and (vi not in owner or score < owner[vi][0]):
                    owner[vi] = (score, li)
        claimed: dict[int, list[tuple[float, _Placed]]] = {}
        for vi, (score, li) in owner.items():
            claimed.setdefault(li, []).append((score, values[vi]))
        best: dict[SheetField, tuple[int, str, list[_Placed]]] = {}
        for li, (label_text, word, inline) in enumerate(labels):
            held = self.s.labels.fields.get(word)
            if held is None:
                continue
            name, rank = held
            if inline is not None:
                stated, used = inline, [label_text]
            else:
                ranked = [v for _, v in sorted(claimed.get(li, []), key=lambda sv: sv[0])]
                if not ranked:
                    continue
                used = [ranked[0]]
                if name == SheetField.TITLE:
                    used += _continuation(ranked[0], ranked[1:])
                stated = " ".join(" ".join(t.shown.split()) for t in used)
            checked = _value(name, stated)
            if checked is None:
                continue
            order = rank * 2 + (0 if all(t.loose for t in used) else 1)
            if name not in best or order < best[name][0]:
                best[name] = (order, checked, used)
        return {name: (v, ValueSource.TITLE_BLOCK_TEXT, u) for name, (_, v, u) in best.items()}


def _handles(chain: Chain) -> tuple[str, ...]:
    return tuple(link.insert.handle for link in chain)


def _pick(
    by_field: dict[SheetField, list[tuple[int, int, str, list[_Placed]]]],
    source: ValueSource,
    conventions: SheetConventions,
) -> _Found:
    """From (preference, line, text, texts) per field: the most preferred word's lines in their order
    (a title's, joined), or its first line (any other field's)."""
    out: _Found = {}
    for name, items in by_field.items():
        best = min(i[0] for i in items)
        chosen = sorted((i for i in items if i[0] == best), key=lambda i: i[1])
        if name != SheetField.TITLE:
            chosen = chosen[:1]
        value = _value(name, " ".join(" ".join(i[2].split()) for i in chosen))
        if value is not None:
            out[name] = (value, source, [t for i in chosen for t in i[3]])
    return out


def _after(label: _Placed, value: _Placed) -> float | None:
    """How far `value` lies after `label` as a person reads the title block (after it on its line,
    or under it), in the label's heights; none when it lies before it or too far."""
    x0, y0, x1, y1 = value.in_frame_of(label)
    lx0, ly0, lx1, ly1 = label.box
    overlap = min(y1, ly1) - max(y0, ly0)
    if overlap >= 0.3 * min(y1 - y0, ly1 - ly0) and lx1 - 0.5 <= x0 <= lx1 + 40:
        return max(x0 - lx1, 0.0) * 0.5
    gap = ly0 - y1
    if -0.3 <= gap <= 12 and x0 <= lx1 + 25 and x1 >= lx0 - 5:
        return max(gap, 0.0) + 0.1 * max(0.0, x0 - lx1, lx0 - x1) + 0.01 * abs(x0 - lx0)
    return None


def _continuation(first: _Placed, rest: list[_Placed]) -> list[_Placed]:
    """The lines under a title's first line that carry it on: the same height, the same column,
    one under the other."""
    lines: list[_Placed] = []
    last = first
    for text in sorted(rest, key=lambda t: -t.in_frame_of(first)[3]):
        x0, _, _, y1 = text.in_frame_of(last)
        lx0, ly0, _, _ = last.box
        same = abs(text.height - first.height) <= 0.25 * first.height
        if same and -0.3 <= ly0 - y1 <= 1.2 and abs(x0 - lx0) <= 2.0:
            lines.append(text)
            last = text
    return lines


def _value(name: SheetField, text: str) -> str | None:
    """A field's value as stated, its lines joined by a space; none when it is longer than the
    field's bound, shows nothing, is no more than punctuation (an empty field's dash), or is a
    number or a date with no digit."""
    shown = " ".join(text.split())
    if len(shown) > MAX_FIELD[name] or not any(c.isalnum() for c in _visible(shown)):
        return None
    digit = any(unicodedata.category(c) == "Nd" for c in shown)
    if name in (SheetField.NUMBER, SheetField.ISSUE_DATE) and not digit:
        return None  # a number and a date hold a digit: a path or a word is neither
    return shown


# The sheet-type judgement ------------------------------------------------------------------------------


@cache
def default_conventions() -> SheetConventions:
    """The default sheet conventions (`conventions/sheet-default.json`), read once."""
    return SheetConventions.from_json(json.loads(DEFAULT_CONVENTIONS.read_text(encoding="utf-8")))


def judgement(
    sheet: SheetCandidate,
    view_titles: Sequence[str] = (),
    *,
    conventions: SheetConventions | None = None,
) -> JudgementRequest | None:
    """The sheet-type question for Jev (15's `ask`; ADR 0011: code gives the facts, Jev picks among
    the options). The node is `sheet_type`; the facts are code's only, each bounded to `MAX_FACT`
    characters (the title, the Discipline, the number, and up to `MAX_FACTS` view titles when given);
    the options are the kinds of the sheet's Discipline, then the kinds every Discipline has (the
    owner's ruling of 29 Sep 2026, "Per-Discipline kinds"), from `conventions` (the default when
    none are given); ranking them is Jev's. None when the sheet has no Discipline, its Discipline
    has no kinds, or there is nothing to judge from (no title and no view title)."""
    held = conventions if conventions is not None else default_conventions()
    if sheet.discipline is None:
        return None
    options = held.kinds(sheet.discipline.value)
    titles = [fact for t in view_titles if isinstance(t, str) and (fact := _fact(t))][:MAX_FACTS]
    title = _fact(sheet.title.value) if sheet.title is not None else ""
    if len(options) < 2 or not (title or titles):
        return None
    facts: dict[str, str] = {"discipline": sheet.discipline.value}
    if title:
        facts["title"] = title
    if sheet.number is not None and (number := _fact(sheet.number.value)):
        facts["number"] = number
    for i, view in enumerate(titles, 1):
        facts[f"view_title_{i}"] = view
    return JudgementRequest(NODE, facts, QUESTION, options)


def _fact(text: str) -> str:
    return " ".join(_visible(text).split())[:MAX_FACT]


# Texts on a sheet, for the register (13's `register.find`) ---------------------------------------------


def texts_on(
    artefact: ReadArtefact, sheets: Sequence[SheetCandidate], conventions: SheetConventions
) -> dict[int, list[_Placed]]:
    """The placed texts of each sheet, by its position in `sheets`: a layout's paper-space texts, or
    the model-space texts inside a model-space sheet's box. Each space is walked once."""
    segmenter = _Segmenter(artefact, None, conventions)
    out: dict[int, list[_Placed]] = {}
    model = next((h for h, b in artefact.blocks.items() if b.layout == "Model"), None)
    boxes = [(i, s.location.box) for i, s in enumerate(sheets) if s.location.box is not None]
    if model is not None and boxes:
        space = segmenter.space(model)
        for i, box in boxes:
            assert box is not None
            within = space.text_index.within((box.x0, box.y0, box.x1, box.y1))
            out[i] = [space.texts[j] for j in within]
    names = {b.layout: h for h, b in artefact.blocks.items() if b.layout not in (None, "Model")}
    for i, sheet in enumerate(sheets):
        handle = names.get(sheet.location.layout) if sheet.location.layout is not None else None
        if handle is not None:
            out[i] = segmenter.space(handle).texts
    return out
