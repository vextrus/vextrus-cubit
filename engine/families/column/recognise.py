"""The column reader: a candidate per column outline per view per storey (session 16's contract).

A column is found by geometry, never by a layer name or a label's words (ADR 0039):
- an **outline** is a closed four-cornered polyline with right angles, smaller than the grid's
  smallest bay (when the grid has two lines on an axis), on the Drafting Profile's column layers when
  the profile names them (`families.column.layers`) and on any layer otherwise;
- a **label** is a text near it: a size label (two lengths joined by a times sign, `size.parse`) or a
  mark (a short token of letters then digits, or a match of the profile's
  `families.column.label_patterns`). Each label goes to the nearest outline within its reach (the
  profile's `tolerances.label_distance_factor`, else 1.5, times the outline's longer side);
- an outline becomes a candidate when it holds a mark or a size label; an outline with neither is a
  drawn rectangle, not a column the plan names.

Its `values` are `section_b` and `section_d` from the size LABEL (the label wins over the outline: size
= label), in drawing units with the label's verbatim text; a bare-number label's unit (mm or inches) is
the one nearer the outline it labels. A column with no size label has neither value, and raises
`engine.column.size_not_read` with its mark and grid ref: its size is asked, never guessed.

Its `at` is its centre's nearest grid intersection, named "<line drawn along y>/<line drawn along x>"
("B/2", the grid's confirmed `grid_line` facts: `axis` the direction the line is drawn, `offset` its
place across it in drawing units, in the view's model coordinates), and its offset from it.
A view of several storeys gives one candidate per storey, each with the view's Storey Band
("<first storey>..<last storey>"; a view of one storey: that storey).
"""

import bisect
import hashlib
import math
import re
import statistics
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal

from engine.families.column import place
from engine.families.column import size as sizes
from engine.families.column.messages import MARK_NOT_READ, SIZE_NOT_READ, VIEW_NOT_PLACED
from engine.families.types import (
    ConfirmedFacts,
    ElementCandidate,
    FactValue,
    ProfileParts,
    ProjectSetup,
    QuestionRaised,
    Recognised,
    ViewArtefact,
)
from engine.geometry.placement import Chain, walk, world
from engine.read.anchor import DwgAnchor
from engine.read.artefact import AnyEntity, Entity, ReadArtefact, Text
from engine.text import mtext
from engine.text.decode import decode

FAMILY = "column"
REACH = Decimal("1.5")
"""A label's reach, in the outline's longer sides, when the profile states no `label_distance_factor`."""
CHAR_WIDTH = 0.8
"""A character's width in text heights: enough to box a label for its distance, never to render it."""
RIGHT_ANGLE = 0.02
"""The cosine below which two edges meet square."""
LABEL_TYPES = frozenset({"TEXT", "MTEXT", "ATTRIB"})
OUTLINE_TYPES = frozenset({"LWPOLYLINE", "POLYLINE"})
MAX_COORDINATE = 1e12
"""The farthest from the origin a column or its label is read, in drawing units (no plan reaches it);
past it a hostile file's numbers would overflow the cells and the Decimals."""
MAX_SPREAD = 64
"""The cells an outline's reach may cover before it is weighed by every label instead (a huge one)."""
MAX_VOTERS = 150
"""The columns that vote on where a view's grid lies (enough for any plan; a bound on hostile ones)."""
_MARK = re.compile(r"[A-Za-z]{1,3}-?\d{1,3}[A-Za-z]?")

type Point = tuple[float, float]
type Box = tuple[float, float, float, float]


@dataclass(frozen=True)
class _Outline:
    handle: str
    inserts: tuple[str, ...]
    corners: tuple[Point, Point, Point, Point]

    @property
    def key(self) -> tuple[str, ...]:
        """The outline's place in the file: one block inserted many times draws it many times."""
        return (*self.inserts, self.handle)

    @property
    def box(self) -> Box:
        xs, ys = [p[0] for p in self.corners], [p[1] for p in self.corners]
        return (min(xs), min(ys), max(xs), max(ys))

    @property
    def centre(self) -> Point:
        x0, y0, x1, y1 = self.box
        return ((x0 + x1) / 2, (y0 + y1) / 2)

    @property
    def sides(self) -> tuple[float, float]:
        a, b, c, _ = self.corners
        return (math.dist(a, b), math.dist(b, c))


@dataclass(frozen=True)
class _Label:
    handle: str
    inserts: tuple[str, ...]
    text: str
    box: Box
    size: sizes.Size | None
    mark: str | None


@dataclass(frozen=True)
class _GridLine:
    mark: str
    offset: float


@dataclass(frozen=True)
class _Grid:
    along_y: tuple[_GridLine, ...]  # drawn along y: each fixes an x
    along_x: tuple[_GridLine, ...]  # drawn along x: each fixes a y

    @property
    def marks(self) -> frozenset[str]:
        return frozenset(line.mark for line in (*self.along_y, *self.along_x))

    @property
    def smallest_bay(self) -> float | None:
        bays = [
            b.offset - a.offset
            for lines in (self.along_y, self.along_x)
            for a, b in zip(sorted(lines, key=_offset), sorted(lines, key=_offset)[1:], strict=False)
            if b.offset > a.offset
        ]
        return min(bays) if bays else None

    def place(self, x: float, y: float) -> tuple[str, float, float] | None:
        """The nearest intersection's ref and the point's offset from it; None without both axes."""
        if not self.along_y or not self.along_x:
            return None
        across = min(self.along_y, key=lambda line: abs(x - line.offset))
        up = min(self.along_x, key=lambda line: abs(y - line.offset))
        return f"{across.mark}/{up.mark}", x - across.offset, y - up.offset


def _offset(line: _GridLine) -> float:
    return line.offset


def _residual(lines: Sequence[float], at: float) -> float:
    """`at` less the nearest of the sorted `lines`."""
    i = bisect.bisect_left(lines, at)
    return min((at - lines[k] for k in (i - 1, i) if 0 <= k < len(lines)), key=abs)


def _shift(offsets: Sequence[float], coords: Sequence[float], tolerance: float) -> float:
    """Where a view draws the grid along one axis: the translation that puts most column centres within
    `tolerance` of a confirmed line (columns stand on grid lines), refined by their median residual.

    The confirmed grid is the Building's registered frame (session 16's contract); a plan may be drawn
    anywhere in model space. No shift unless another puts strictly more columns on lines."""
    lines = sorted(set(offsets))
    voters = list(coords[:MAX_VOTERS])
    if not lines or not voters:
        return 0.0

    def on(t: float) -> list[float]:
        found = (_residual(lines, c - t) for c in voters)
        return [r for r in found if abs(r) <= tolerance]

    best, hits = 0.0, len(on(0.0))
    for t in sorted({c - o for c in voters for o in lines}, key=abs):
        n = len(on(t))
        if n > hits:
            best, hits = t, n
    if best == 0.0:
        return 0.0
    near = on(best)
    return best + statistics.median(near) if near else best


@dataclass(frozen=True)
class _Reading:
    """What the profile says to the column reader, each part optional."""

    layers: frozenset[str] | None
    patterns: tuple[re.Pattern[str], ...]
    reach: Decimal


def recognise(
    views: Sequence[ViewArtefact],
    confirmed: ConfirmedFacts,
    setup: ProjectSetup,
    profile: ProfileParts | None,
) -> Recognised:
    """Every column outline of every view, per storey, with its mark, size, grid ref and band."""
    grid = _grid(confirmed)
    reading = _reading(profile)
    candidates: list[ElementCandidate] = []
    questions: list[QuestionRaised] = []
    for view in views:
        found, asked = _read_view(view, grid, reading)
        candidates.extend(found)
        questions.extend(asked)
    return Recognised(
        candidates=tuple(candidates), judgements=(), conventions=(), questions=tuple(questions)
    )


# The confirmed grid and the profile


def _plain_value(held: object) -> object:
    return held.get("value") if isinstance(held, Mapping) else getattr(held, "value", held)


def _number(held: object) -> float | None:
    inner = _plain_value(held)
    if isinstance(inner, bool) or not isinstance(inner, int | float | Decimal | str):
        return None
    try:
        number = float(inner)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def _grid(confirmed: ConfirmedFacts) -> _Grid:
    along: dict[str, list[_GridLine]] = {"x": [], "y": []}
    for fact in confirmed.facts:
        if fact.family != "grid_line":
            continue
        axis = str(_plain_value(fact.values.get("axis", ""))).lower()
        offset = _number(fact.values.get("offset"))
        if axis in along and offset is not None and fact.mark:
            along[axis].append(_GridLine(mark=fact.mark, offset=offset))
    return _Grid(along_y=tuple(along["y"]), along_x=tuple(along["x"]))


def _part(held: object, key: str) -> object:
    if isinstance(held, Mapping):
        return held.get(key)
    return getattr(held, key, None)


def _conventions(profile: ProfileParts | None) -> object:
    if profile is None:
        return None
    for name in ("conventions", "data", "parts"):
        held = getattr(profile, name, None)
        if isinstance(held, Mapping):
            return held
    return profile


def _strings(held: object) -> tuple[str, ...]:
    if isinstance(held, str) or not isinstance(held, Sequence):
        return ()
    return tuple(item for item in held if isinstance(item, str))


def _reading(profile: ProfileParts | None) -> _Reading:
    conventions = _conventions(profile)
    column = _part(_part(conventions, "families"), FAMILY)
    layers = _strings(_part(column, "layers"))
    patterns: list[re.Pattern[str]] = []
    for pattern in _strings(_part(column, "label_patterns")):
        try:
            patterns.append(re.compile(pattern))
        except re.error:
            continue
    reach = _number(_part(_part(conventions, "tolerances"), "label_distance_factor"))
    return _Reading(
        layers=frozenset(layers) if layers else None,
        patterns=tuple(patterns),
        reach=Decimal(repr(reach)) if reach is not None and reach > 0 else REACH,
    )


# One view


def _model(artefact: ReadArtefact) -> tuple[str, str] | None:
    for handle, block in artefact.blocks.items():
        if block.layout == "Model":
            return handle, block.layout
    return None


def _window(view: ViewArtefact) -> Box | None:
    """The view's box in model space (`place.model_box`; the whole model space for no view)."""
    if view.view is None or getattr(view.view, "box", None) is None:
        return None
    return place.model_box(view.artefact, view.view)


def _inside(point: Point, window: Box | None) -> bool:
    if window is None:
        return True
    x, y = point
    return window[0] <= x <= window[2] and window[1] <= y <= window[3]


def _storeys(view: ViewArtefact) -> tuple[str, ...]:
    if view.storey:
        return (view.storey,)
    listed = tuple(getattr(view.view, "storeys", ()) or ())
    return listed or ("",)


def _read_view(
    view: ViewArtefact, grid: _Grid, reading: _Reading
) -> tuple[list[ElementCandidate], list[QuestionRaised]]:
    artefact = view.artefact
    model = _model(artefact)
    if model is None:
        return [], []
    handle, sheet = model
    window = _window(view)
    if getattr(view.view, "box", None) is not None and window is None:
        return [], [QuestionRaised(**VIEW_NOT_PLACED(view_id=view.view_id))]
    outlines: list[_Outline] = []
    labels: list[_Label] = []
    bay = grid.smallest_bay
    for entity, chain in walk(artefact, handle):
        outline = _outline(entity, chain, reading)
        if outline is not None and _inside(outline.centre, window):
            if bay is None or max(outline.sides) < bay:
                outlines.append(outline)
            continue
        label = _label(entity, chain, artefact, reading, grid)
        if label is not None and _inside((label.box[0], label.box[1]), window):
            labels.append(label)
    held = _assign(outlines, labels, reading.reach)
    unit = _drawing_unit(artefact, outlines, held)
    storeys = _storeys(view)
    band = storeys[0] if storeys[0] == storeys[-1] else f"{storeys[0]}..{storeys[-1]}"
    candidates: list[ElementCandidate] = []
    named = []
    questions: list[QuestionRaised] = []
    for outline in outlines:
        mine = held.get(outline.key, [])
        mark = next((x for x in mine if x.mark), None)
        sized = next((x for x in mine if x.size), None)
        if mark is not None:
            named.append((outline, mark, sized))
        elif sized is not None:  # a sized outline with no column mark: a wall or a pier, asked
            questions.append(_mark_not_read(view, sheet, outline, sized))
    shift = _view_shift(grid, [outline for outline, _, _ in named])
    for outline, mark, sized in named:
        for storey in storeys:
            candidate = _candidate(view, sheet, outline, mark, sized, grid, shift, unit, storey, band)
            candidates.append(candidate)
            if sized is None:
                questions.append(_size_not_read(candidate))
    return candidates, questions


def _view_shift(grid: _Grid, columns: Sequence[_Outline]) -> Point:
    if not columns:
        return (0.0, 0.0)
    tolerance = statistics.median(max(outline.sides) for outline in columns)
    centres = [outline.centre for outline in columns]
    return (
        _shift([line.offset for line in grid.along_y], [x for x, _ in centres], tolerance),
        _shift([line.offset for line in grid.along_x], [y for _, y in centres], tolerance),
    )


# Outlines and labels


def _vertices(values: Mapping[str, object]) -> list[Point] | None:
    raw = values.get("points", values.get("vertices"))
    if not isinstance(raw, list) or not 4 <= len(raw) <= 5:
        return None
    out: list[Point] = []
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


def _closed(values: Mapping[str, object], points: list[Point]) -> list[Point] | None:
    flags = values.get("flags")
    closed = (isinstance(flags, int) and not isinstance(flags, bool) and bool(flags & 1)) or (
        values.get("closed") is True
    )
    if len(points) == 5 and math.dist(points[0], points[4]) <= 1e-9 * (1 + math.hypot(*points[0])):
        return points[:4]
    return points if closed and len(points) == 4 else None


def _square(points: Sequence[Point]) -> bool:
    for i in range(4):
        ax, ay = points[i - 1]
        bx, by = points[i]
        cx, cy = points[(i + 1) % 4]
        u, v = (bx - ax, by - ay), (cx - bx, cy - by)
        lu, lv = math.hypot(*u), math.hypot(*v)
        if not (lu > 0 and lv > 0) or abs(u[0] * v[0] + u[1] * v[1]) > RIGHT_ANGLE * lu * lv:
            return False
    return True


def _outline(entity: AnyEntity, chain: Chain, reading: _Reading) -> _Outline | None:
    if not isinstance(entity, Entity) or entity.type not in OUTLINE_TYPES:
        return None
    if reading.layers is not None and entity.layer not in reading.layers:
        return None
    points = _vertices(entity.values)
    corners = None if points is None else _closed(entity.values, points)
    if corners is None or not _square(corners):
        return None
    z = _number(entity.values.get("elevation")) or 0.0
    transform = world(entity, chain)
    placed = [transform.apply((x, y, z))[:2] for x, y in corners]
    if not all(math.isfinite(c) and abs(c) < MAX_COORDINATE for p in placed for c in p):
        return None
    inserts = tuple(link.insert.handle for link in chain)
    return _Outline(entity.handle, inserts, (placed[0], placed[1], placed[2], placed[3]))


def _mark_in(text: str, size: sizes.Size | None, reading: _Reading, grid: _Grid) -> str | None:
    for pattern in reading.patterns:
        match = pattern.search(text)
        if match is not None:
            named = match.groupdict().get("mark")
            return (named or match.group(0)).strip() or None
    if reading.patterns:
        return None
    rest = text
    if size is not None:
        found = sizes.find(text)
        if found is not None:
            rest = text[: found[0]] + " " + text[found[1] :]
    for token in re.split(r"[\s,;:()\[\]]+", rest):
        if _MARK.fullmatch(token) and token not in grid.marks:
            return token
    return None


def _label(
    entity: AnyEntity, chain: Chain, artefact: ReadArtefact, reading: _Reading, grid: _Grid
) -> _Label | None:
    if not isinstance(entity, Text) or entity.type not in LABEL_TYPES:
        return None
    text = decode(entity.text, mtext=entity.type == "MTEXT").strip()
    if not text or len(text) > 80:
        return None
    size = sizes.parse(text)
    mark = _mark_in(text, size, reading, grid)
    if size is None and mark is None:
        return None
    transform = world(entity, chain)
    x, y, _ = transform.apply(entity.position)
    if not (math.isfinite(x) and math.isfinite(y)):
        return None
    try:
        height = mtext.height(entity, chain, artefact=artefact)
        angle = mtext.world_angle(entity, chain)
    except ArithmeticError, ValueError:
        height, angle = 0.0, 0.0
    if not (math.isfinite(height) and math.isfinite(angle)):
        height, angle = 0.0, 0.0
    width = CHAR_WIDTH * height * max(len(line) for line in text.splitlines())
    ux, uy = math.cos(angle), math.sin(angle)
    corners = [(x, y), (x + width * ux, y + width * uy), (x - height * uy, y + height * ux)]
    corners.append((corners[1][0] - height * uy, corners[1][1] + height * ux))
    xs, ys = [p[0] for p in corners], [p[1] for p in corners]
    if not all(math.isfinite(c) and abs(c) < MAX_COORDINATE for c in (*xs, *ys)):
        return None
    inserts = tuple(link.insert.handle for link in chain)
    return _Label(entity.handle, inserts, text, (min(xs), min(ys), max(xs), max(ys)), size, mark)


def _gap(outline: Box, label: Box) -> float:
    """How far a label lies from an outline's edges: outside it, from the nearest edge; inside it, how
    deep it lies (a mark written inside a column lies near its edge; a text inside a frame drawn round
    a whole plan lies far from the frame's)."""
    dx = max(outline[0] - label[2], label[0] - outline[2], 0.0)
    dy = max(outline[1] - label[3], label[1] - outline[3], 0.0)
    if dx or dy:
        return math.hypot(dx, dy)
    return max(
        0.0,
        min(label[0] - outline[0], outline[2] - label[2], label[1] - outline[1], outline[3] - label[3]),
    )


def _cells(box: Box, cell: float, margin: float) -> tuple[range, range]:
    return (
        range(math.floor((box[0] - margin) / cell), math.floor((box[2] + margin) / cell) + 1),
        range(math.floor((box[1] - margin) / cell), math.floor((box[3] + margin) / cell) + 1),
    )


def _assign(
    outlines: Sequence[_Outline], labels: Sequence[_Label], reach: Decimal
) -> dict[tuple[str, ...], list[_Label]]:
    """Each label to its nearest outline within reach, each outline's labels nearest first.

    Coincident outlines (one rectangle drawn twice) are one. Each outline is bucketed in the square
    cells its reach covers, the cells as wide as the median reach, so a label weighs only the outlines
    of the cells it lies in; an outline whose reach covers more than `MAX_SPREAD` cells is weighed by
    every label. A plan of many rectangles and texts stays near linear."""
    held: dict[tuple[str, ...], list[tuple[float, _Label]]] = {}
    factor = float(reach)
    unique = list({tuple(round(c, 6) for c in o.box): o for o in reversed(outlines)}.values())
    if not unique:
        return {}
    cell = max(statistics.median(factor * max(o.sides) for o in unique), 1e-6)
    buckets: dict[tuple[int, int], list[_Outline]] = {}
    wide: list[_Outline] = []
    for outline in unique:
        columns, rows = _cells(outline.box, cell, factor * max(outline.sides))
        if (columns.stop - columns.start) * (rows.stop - rows.start) > MAX_SPREAD:
            wide.append(outline)
            continue
        for i in columns:
            for j in rows:
                buckets.setdefault((i, j), []).append(outline)
    for label in labels:
        columns, rows = _cells(label.box, cell, 0.0)
        span = (columns.stop - columns.start) * (rows.stop - rows.start)
        if span > len(buckets):
            found = [o for (i, j), os in buckets.items() if i in columns and j in rows for o in os]
        else:
            found = [o for i in columns for j in rows for o in buckets.get((i, j), ())]
        best: tuple[float, _Outline] | None = None
        for outline in {id(o): o for o in (*found, *wide)}.values():
            gap = _gap(outline.box, label.box)
            if gap <= factor * max(outline.sides) and (
                best is None or (gap, outline.key) < (best[0], best[1].key)
            ):
                best = (gap, outline)
        if best is not None:
            held.setdefault(best[1].key, []).append((best[0], label))
    return {key: [label for _, label in sorted(found, key=_first)] for key, found in held.items()}


def _first(pair: tuple[float, _Label]) -> float:
    return pair[0]


# Units and values


def _drawing_unit(
    artefact: ReadArtefact,
    outlines: Sequence[_Outline],
    held: Mapping[tuple[str, ...], list[_Label]],
) -> str:
    """The plan's unit, from its size labels against the outlines they label (`size.drawing_unit`)."""
    labelled = [
        (label.size, outline.sides)
        for outline in outlines
        for label in held.get(outline.key, [])
        if label.size is not None
    ]
    return sizes.drawing_unit(artefact.summary.insunits, labelled)


def _decimal(value: float, places: int = 3) -> Decimal:
    return sizes.plain(Decimal(repr(value)), places)


def _anchor(artefact: ReadArtefact, sheet: str, inserts: tuple[str, ...], handle: str) -> DwgAnchor:
    s = artefact.summary
    return DwgAnchor(s.source_sha256, s.reader, s.reader_version, sheet, inserts, handle)


def _candidate(
    view: ViewArtefact,
    sheet: str,
    outline: _Outline,
    mark: _Label,
    sized: _Label | None,
    grid: _Grid,
    shift: Point,
    unit: str,
    storey: str,
    band: str,
) -> ElementCandidate:
    artefact = view.artefact
    outline_anchor = _anchor(artefact, sheet, outline.inserts, outline.handle)
    anchors: dict[str, tuple[DwgAnchor, ...]] = {"outline": (outline_anchor,), "at": (outline_anchor,)}
    values: dict[str, FactValue] = {}
    confidence = Decimal("0.5")
    anchors["mark"] = (_anchor(artefact, sheet, mark.inserts, mark.handle),)
    confidence += Decimal("0.25")
    if sized is not None and sized.size is not None:
        label_unit = sizes.resolve(sized.size, unit, outline.sides)
        b, d = sizes.to_drawing(sized.size, label_unit, unit)
        size_anchor = (_anchor(artefact, sheet, sized.inserts, sized.handle),)
        values["section_b"] = FactValue(value=b, unit=unit, text=sized.text)
        values["section_d"] = FactValue(value=d, unit=unit, text=sized.text)
        anchors["section_b"] = anchors["section_d"] = size_anchor
        drawn = sorted(outline.sides)
        if all(abs(float(s) / side - 1) <= 0.05 for s, side in zip(sorted((b, d)), drawn, strict=True)):
            confidence += Decimal("0.25")
    cx, cy = outline.centre
    placed = grid.place(cx - shift[0], cy - shift[1])
    at = _at(placed)
    key = hashlib.sha256("|".join((FAMILY, view.view_id, storey, *outline.key)).encode()).hexdigest()[
        :16
    ]
    return ElementCandidate(
        family=FAMILY,
        candidate_key=key,
        storey=storey,
        band=band,
        mark=mark.mark or "",
        at=at,
        values=values,
        anchors=anchors,
        source="reader",
        confidence=confidence,
        geometry=tuple((_decimal(x), _decimal(y)) for x, y in outline.corners),
    )


def _at(placed: tuple[str, float, float] | None) -> tuple[str, Decimal, Decimal]:
    if placed is None:
        return ("", Decimal(0), Decimal(0))
    ref, dx, dy = placed
    return (ref, _decimal(dx), _decimal(dy))


def _size_not_read(candidate: ElementCandidate) -> QuestionRaised:
    message = SIZE_NOT_READ(mark=candidate.mark, grid_ref=str(candidate.at[0]))
    return QuestionRaised(
        code=message["code"],
        params=message["params"],
        candidate_key=candidate.candidate_key,
        anchors=tuple(candidate.anchors.get("outline", ())),
    )


def _mark_not_read(view: ViewArtefact, sheet: str, outline: _Outline, sized: _Label) -> QuestionRaised:
    artefact = view.artefact
    return QuestionRaised(
        code=MARK_NOT_READ.code,
        params=MARK_NOT_READ(text=sized.text)["params"],
        anchors=(
            _anchor(artefact, sheet, outline.inserts, outline.handle),
            _anchor(artefact, sheet, sized.inserts, sized.handle),
        ),
    )
