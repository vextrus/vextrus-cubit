"""Views within sheets (17): the drawings one sheet holds, each with its title, kind, scale, storeys,
subject and layer, and what it is proposed for.

    views.find(artefact, sheet, conventions) -> list[ViewCandidate]   (the harness's `views` stage)
    views.working_view(views) -> int | None                            (16's and 22's fit)
    views.default_conventions() -> ViewConventions

`conventions` are view conventions (`engine/recognise/conventions/view-default.json` by default: the
title words of each kind, the subject and layer words and the scale patterns, all data). The storey
words are the default sheet conventions' (13's `storeys.read`; 21b passes the Market's later).

**Where a sheet's drawing is.** A layout sheet's is what its layout draws in paper space and what each
of its viewports shows of model space (AutoCAD's main viewport left out, `buffers.is_main_viewport`;
a viewport's model-to-paper transform is the renderer's, `buffers.viewport_transform`), clipped to the
viewport; a model-space sheet's is what model space draws inside its frame's box. The sheet's frame (its
first anchor, 13's: the frame insert with everything it draws, or its rectangle) and its title block's
texts are no view's. **Every box is on paper, in mm** (the rulings, "24s <-> 17"): a layout's paper
units are taken as mm; a model-space sheet's box is `(model - lower-left corner of its frame) / scale`,
the scale being its frame insert's (the frame block drawn at paper size, in mm), else, for a frame
drawn as a rectangle or a scale giving no paper size, the one that makes the frame a standard paper size
(`PAPER_SIDES`) at the roundest scale (`ROUND_SCALES`).

**How views are found.** The sheet's lines and texts are laid on a grid of `CELL_MM` cells over its
paper, grown by `GAP_MM` so that what is drawn closer than that joins, and split into connected pieces.
A **view title** is a text of one line and at most `MAX_TITLE_WORDS` words holding a kind's words (the
kind listed first in the conventions wins where several are named: "TYPICAL BEAM SECTION DETAIL" is a
detail), not in the title block, and at least as tall as the sheet's median text; titles and scale texts
stay off the grid. Each title takes the piece it lies under (a drawing titled beneath, the convention),
else the piece it lies over, within `TITLE_GAP` of its height, nearest first, one title a piece. A piece
with no title is a view when it covers `MIN_UNTITLED` of the paper (a plan, or notes when text fills
more of it than lines); a smaller one joins the view whose box, grown by `JOIN_MM`, holds it. A view's
box is its piece, its title and its scale text together. **Reading order** is by rows, top to bottom
(views whose heights overlap by half are one row), each left to right.

**What a view says.** Its stated scale is the first scale pattern found in its title or a text on its
title's line or just under it (`scales.read`), verbatim; N.T.S. marks it not to scale. Its storeys are
a plan's only: 13's `storeys.read(title, plan_title=True)`, an explicit list (and the symbolic end a
range runs to), so "typical" is a storey only beside a floor or plan word; they mean the floors' levels
(`at_floor_level`) unless its subject is one drawn floor to floor (`FLOOR_TO_FLOOR`). Its subject is the
conventions' subject whose words stand first in the title (the longest words first: "pile cap" before
"pile"); its layer the top or bottom words ("top" before a floor or level word is a storey, not a
layer). A view drawn with no title has none of these.

**What it is proposed for** (m0-screens 6.18; the plan's review Q2 and Q7), by its sheet's Discipline:
title blocks, key plans and 3D/perspective views are excluded `for_information`; a legend goes to Step
2 for Structural and Architectural, else to its Discipline's Part; every view of an MEP sheet (any
Discipline but those of `STEP_DISCIPLINES`) to its Discipline's Part; general notes to Step 2. A
Structural view goes to the Steps of its subject (`STRUCTURAL_STEPS`: 5 to 10 only here); an
Architectural plan drawing the structure (a column or beam subject) is excluded as a `duplicate` (the
structural set governs); an Architectural fixture plan or toilet detail goes to Steps 11 and 12 and to
the Plumbing and sanitary Part as well; another Architectural view to Steps 11 and 12. The Step keys are
the seed's (`vextrus/seed/drawings.py`) until 19a's Library names them. **Not built:** a view that draws
only a base plan is not yet told (proposed out as `blank`, Q7); nothing here reads a view's content.

**The working view** (`working_view`) is the first plan in reading order not proposed out: the view 16
and 22 open a sheet fitted to; none when the sheet has no such plan.

**Hostile input is bounded:** each space is walked once (model space once per file), at most
`MAX_VISITS` entities, `MAX_SEGMENTS` lines and `MAX_TEXTS` texts kept; the grid has at most `MAX_GRID`
cells a side (its cells grow on a larger paper) and at most `MAX_SAMPLES` points are laid on it; at most
`MAX_TITLES` titles and `MAX_VIEWS` views are read on a sheet. What is past a bound is not read.
"""

import json
import math
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from statistics import median

import numpy as np
from numpy.typing import NDArray

from engine.geometry.placement import (
    Chain,
    PlacementError,
    Transform,
    Walk,
    chain_transform,
    link,
    scaling,
    translation,
    world,
)
from engine.geometry.placement import chain as chain_of
from engine.read.anchor import DwgAnchor
from engine.read.artefact import Entity, Insert, ReadArtefact, Text
from engine.recognise import scales, storeys
from engine.recognise import sheets as sheet_finder
from engine.recognise.sheets import _finite_insert, _Placed, _plain, _Segmenter
from engine.recognise.types import (
    Box,
    Exclusion,
    ExclusionReason,
    Layer,
    SheetCandidate,
    StoreysMeaning,
    ViewCandidate,
    ViewConventions,
    ViewKind,
)
from engine.render import _shapes
from engine.render.buffers import is_main_viewport, viewport_transform

DEFAULT_CONVENTIONS = Path(__file__).with_name("conventions") / "view-default.json"

CELL_MM = 2.0
"""The grid's cell on paper, in mm (larger on a paper past `MAX_GRID` cells a side)."""
GAP_MM = 8.0
"""What is drawn closer than this on paper, in mm, is one piece."""
MAX_TITLE_WORDS = 12
"""A text of more words is a note, not a view title."""
TITLE_GAP = 6.0
"""The farthest a title lies from its drawing, in the title's heights."""
MIN_VIEW_MM = 10.0
"""A titled piece's longer side on paper is at least this, in mm."""
MIN_UNTITLED = 0.02
"""A piece with no title is a view when its box covers this share of the paper."""
JOIN_MM = 10.0
"""A small piece joins a view whose box, grown by this on paper, in mm, holds it."""
BORDER_SHARE = 0.6
"""A closed rectangle this share of the paper or more, both ways, is a border, not a drawing."""

MAX_VISITS = 4_000_000
MAX_SEGMENTS = 3_000_000
MAX_TEXTS = 200_000
MAX_GRID = 1_500
MAX_SAMPLES = 8_000_000
MAX_TITLES = 200
MAX_VIEWS = 200

PAPER_SIDES = (1189.0, 841.0, 594.0, 420.0, 297.0, 210.0)
"""The long sides of the standard papers (ISO A0 to A5), in mm."""
ROUND_SCALES = (1.0, 1.25, 2.0, 2.5, 5.0, 7.5)
"""The scales a frame is drawn at, times a power of ten."""
MIN_PAPER_MM, MAX_PAPER_MM = 100.0, 5000.0
"""A frame insert's scale giving a paper outside these long sides, in mm, is not the paper's."""

STEP_DISCIPLINES = frozenset({"structural", "architectural"})
"""The Disciplines M0 measures: every other one's views go to its Part (MEP, M3 onwards)."""
GENERAL_NOTES = "general_notes"
"""Step 2: General notes and specification."""
STRUCTURAL_STEPS: Mapping[str, tuple[str, ...]] = {
    "pile": ("foundations",),
    "pile_cap": ("foundations",),
    "foundation": ("foundations",),
    "retaining_wall": ("foundations",),
    "column": ("columns",),
    "shear_wall": ("columns",),
    "beam": ("beams",),
    "slab": ("slabs",),
    "stair": ("stairs",),
    "tank": ("tanks",),
}
"""Steps 5 to 10 (foundations to tanks) by a Structural view's subject."""
ARCHITECTURAL_STEPS = ("walls", "rooms")
"""Steps 11 and 12: walls and openings, rooms and finishes."""
STRUCTURE_SUBJECTS = frozenset({"column", "beam", "shear_wall"})
"""What an architectural plan draws that the structural set governs."""
PLUMBING_SUBJECTS = frozenset({"fixture", "toilet"})
PLUMBING_PART = "plumbing"
"""The Plumbing and sanitary Part, by its Discipline's key."""
FLOOR_TO_FLOOR = frozenset({"column", "shear_wall"})
"""Subjects whose storeys run floor to floor (a column from the 1st to the 10th floor)."""

_EXCLUDED_KINDS = frozenset({ViewKind.TITLE_BLOCK, ViewKind.KEY_PLAN, ViewKind.PERSPECTIVE})

type Bounds = tuple[float, float, float, float]


@cache
def default_conventions() -> ViewConventions:
    return ViewConventions.from_json(json.loads(DEFAULT_CONVENTIONS.read_text(encoding="utf-8")))


# What a space draws ------------------------------------------------------------------------------------


@dataclass
class _Drawn:
    """One space walked: its lines as segments (x0, y0, x1, y1) with the chain and entity each came
    from, its placed texts with their chains, and its viewports (a layout's)."""

    segments: NDArray[np.float64]
    segment_chain: NDArray[np.int32]
    segment_entity: NDArray[np.int32]
    chains: list[tuple[str, ...]]
    entities: list[str]
    texts: list[_Placed]
    text_chain: list[int]
    viewports: list[Entity]


class _Walker:
    def __init__(self, artefact: ReadArtefact) -> None:
        self.artefact = artefact
        self.segmenter = _Segmenter(artefact, None, sheet_finder.default_conventions())
        self._model: _Drawn | None = None
        self.layouts = {
            b.layout: h for h, b in artefact.blocks.items() if b.layout not in (None, "Model")
        }
        self.model_handle = next((h for h, b in artefact.blocks.items() if b.layout == "Model"), None)

    def model(self) -> _Drawn | None:
        if self._model is None and self.model_handle is not None:
            self._model = self.walk(self.model_handle)
        return self._model

    def walk(self, handle: str) -> _Drawn:
        walk = Walk(
            self.artefact,
            max_visits=MAX_VISITS,
            enter=lambda new, inner: _finite_insert(inner[-1].insert),
        )
        pieces: list[NDArray[np.float64]] = []
        piece_chain: list[int] = []
        piece_entity: list[int] = []
        count = 0
        chains: list[tuple[str, ...]] = []
        chain_ids: dict[int, tuple[Chain, int]] = {}
        entities: list[str] = []
        texts: list[_Placed] = []
        text_chain: list[int] = []
        viewports: list[Entity] = []

        def chain_id(chain: Chain) -> int:
            held = chain_ids.get(id(chain))
            if held is not None and held[0] is chain:
                return held[1]
            chains.append(tuple(link.insert.handle for link in chain))
            chain_ids[id(chain)] = (chain, len(chains) - 1)
            return len(chains) - 1

        for entity, chain in walk.entities(handle):
            if isinstance(entity, Text):
                if entity.type == "ATTDEF" or len(texts) >= MAX_TEXTS:
                    continue
                placed = self.segmenter._place(entity, chain)
                if placed is not None:
                    texts.append(placed)
                    text_chain.append(chain_id(chain))
                continue
            if isinstance(entity, Insert):
                continue
            if entity.type == "VIEWPORT":
                if not chain:
                    viewports.append(entity)
                continue
            if count >= MAX_SEGMENTS:
                continue
            found = _segments(entity, chain)
            if found is None or not len(found):
                continue
            found = found[: MAX_SEGMENTS - count]
            count += len(found)
            pieces.append(found)
            piece_chain.append(chain_id(chain))
            entities.append(entity.handle)
            piece_entity.append(len(entities) - 1)
        if pieces:
            segments = np.concatenate(pieces)
            lengths = [len(p) for p in pieces]
            seg_chain = np.repeat(np.array(piece_chain, dtype=np.int32), lengths)
            seg_entity = np.repeat(np.array(piece_entity, dtype=np.int32), lengths)
        else:
            segments = np.empty((0, 4))
            seg_chain = seg_entity = np.empty(0, dtype=np.int32)
        return _Drawn(segments, seg_chain, seg_entity, chains, entities, texts, text_chain, viewports)


def _segments(entity: Entity, chain: Chain) -> NDArray[np.float64] | None:
    """The entity's lines in its space, as segments; its box's outline for a type not drawn here."""
    found = _shapes.bounds(entity)
    if found is None:
        return None
    x0, y0, x1, y1 = found
    size = (x1 - x0) + (y1 - y0)
    if not math.isfinite(size):
        return None
    try:
        placed = world(entity, chain)
    except PlacementError, ValueError:
        return None
    shape = _shapes.shape(entity, max(size * 0.02, 1e-9))
    paths: list[tuple[NDArray[np.float64], bool]] = []
    if shape is not None:
        paths.extend(shape.lines)
        paths.extend((triangle, True) for fill in shape.fills for triangle in fill)
    else:
        paths.append((np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), True))
    out = []
    for points, closed in paths:
        if len(points) < 2:
            continue
        xy = placed.xy(np.asarray(points, dtype=np.float64)[:, :2])
        if closed:
            xy = np.vstack([xy, xy[:1]])
        out.append(np.hstack([xy[:-1], xy[1:]]))
    if not out:
        return None
    segments = np.concatenate(out)
    return segments[np.isfinite(segments).all(axis=1)]


_held: list[_Walker] = []
"""The walker of the file last read: the harness calls `find` once per sheet of one file, and model
space is walked once for all of them."""


def _walker(artefact: ReadArtefact) -> _Walker:
    if not _held or _held[0].artefact is not artefact:
        _held[:] = [_Walker(artefact)]
    return _held[0]


# A sheet on paper --------------------------------------------------------------------------------------


@dataclass
class _Text:
    placed: _Placed
    chain: tuple[str, ...]
    box: Bounds  # on paper, mm
    height: float  # on paper, mm
    shown: str  # one line, plain


@dataclass
class _Paper:
    """A sheet laid on paper: its region (mm), its segments and texts in mm, and what its title
    block holds."""

    region: Bounds
    segments: NDArray[np.float64]
    texts: list[_Text]
    key: str | None = None  # the sheet's anchor key (a layout's name, or 13's model key)
    anchor: DwgAnchor | None = None


def _paper(artefact: ReadArtefact, sheet: SheetCandidate) -> _Paper | None:
    walker = _walker(artefact)
    frame = next((a for a in sheet.anchors if isinstance(a, DwgAnchor)), None)
    values = frozenset(a.handle for a in sheet.anchors[1:] if isinstance(a, DwgAnchor))
    frame_path: tuple[str, ...] | None = None
    frame_rectangle: tuple[tuple[str, ...], str] | None = None
    if frame is not None:
        entity = artefact.entities.get(frame.handle)
        if isinstance(entity, Insert):
            frame_path = (*frame.inserts, frame.handle)
        elif entity is not None:
            frame_rectangle = (tuple(frame.inserts), frame.handle)

    def keep_segments(drawn: _Drawn) -> NDArray[np.bool_]:
        keep = np.ones(len(drawn.segments), dtype=bool)
        if frame_path is not None:
            n = len(frame_path)
            bad = [i for i, c in enumerate(drawn.chains) if c[:n] == frame_path]
            if bad:
                keep &= ~np.isin(drawn.segment_chain, np.array(bad, dtype=np.int32))
        if frame_rectangle is not None:
            inserts, handle = frame_rectangle
            ids = [i for i, h in enumerate(drawn.entities) if h == handle]
            chains = [i for i, c in enumerate(drawn.chains) if c == inserts]
            if ids and chains:
                keep &= ~(
                    np.isin(drawn.segment_entity, np.array(ids, dtype=np.int32))
                    & np.isin(drawn.segment_chain, np.array(chains, dtype=np.int32))
                )
        return keep

    def keep_text(drawn: _Drawn, i: int) -> bool:
        placed = drawn.texts[i]
        chain = drawn.chains[drawn.text_chain[i]]
        if placed.entity.handle in values:
            return False
        if frame_path is not None:
            if chain[: len(frame_path)] == frame_path:
                return False
            if placed.entity.owner == frame_path[-1] and chain == frame_path[:-1]:
                return False  # the frame insert's own attributes
        return True

    parts: list[tuple[_Drawn, Transform, Bounds | None, Bounds | None]] = []
    region: Bounds | None = None
    if sheet.location.layout is not None:
        handle = walker.layouts.get(sheet.location.layout)
        if handle is None:
            return None
        drawn = walker.walk(handle)
        parts.append((drawn, Transform(), None, None))
        first = True
        for viewport in drawn.viewports:
            values_of = dict(viewport.values)
            main = is_main_viewport(values_of, first)
            first = False
            through = None if main else viewport_transform(values_of)
            rect = None if main else _shapes_rect(values_of)
            model = walker.model()
            if through is None or rect is None or model is None:
                continue
            try:
                shown = _box_through(rect, through.inverse())
            except PlacementError:
                continue
            parts.append((model, through, shown, rect))
        if frame_path is not None or frame_rectangle is not None:
            region = _frame_box(drawn, keep_segments(drawn))
    else:
        box = sheet.location.box
        model = walker.model()
        if box is None or model is None:
            return None
        scale = _paper_scale(artefact, frame, box)
        to_paper = scaling(1 / scale, 1 / scale) @ translation(-box.x0, -box.y0)
        region = (0.0, 0.0, (box.x1 - box.x0) / scale, (box.y1 - box.y0) / scale)
        parts.append((model, to_paper, (box.x0, box.y0, box.x1, box.y1), region))

    segments: list[NDArray[np.float64]] = []
    texts: list[_Text] = []
    for drawn, to_paper, window, clip in parts:
        keep = keep_segments(drawn)
        chosen = drawn.segments[keep]
        if window is not None:
            chosen = _clip(chosen, window)
        moved = _move(chosen, to_paper)
        if clip is not None:
            moved = _clip(moved, clip)
        segments.append(moved)
        scale = to_paper.xy_scale
        for i, placed in enumerate(drawn.texts):
            if window is not None and not _inside(placed.origin, window):
                continue
            if not keep_text(drawn, i):
                continue
            corners = np.array(placed.corners(), dtype=np.float64)
            moved_corners = to_paper.xy(corners)
            text_box: Bounds = (
                float(moved_corners[:, 0].min()),
                float(moved_corners[:, 1].min()),
                float(moved_corners[:, 0].max()),
                float(moved_corners[:, 1].max()),
            )
            if not all(math.isfinite(v) for v in text_box):
                continue
            chain = drawn.chains[drawn.text_chain[i]]
            height = placed.height * scale
            texts.append(_Text(placed, chain, text_box, height, _plain(placed.shown)))
    all_segments = np.concatenate(segments) if segments else np.empty((0, 4))
    if region is None:
        region = _extent(all_segments, texts)
    if region is None:
        return None
    return _Paper(region, all_segments, texts, None if frame is None else frame.sheet, frame)


def _shapes_rect(values: Mapping[str, object]) -> Bounds | None:
    try:
        cx, cy, _ = _shapes._point(values, "center")
        width, height = _shapes._number(values, "width"), _shapes._number(values, "height")
    except _shapes.Undrawable:
        return None
    if not (width > 0 and height > 0):
        return None
    return (cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)


def _box_through(box: Bounds, transform: Transform) -> Bounds:
    x0, y0, x1, y1 = box
    corners = [transform.apply((x, y)) for x in (x0, x1) for y in (y0, y1)]
    xs, ys = [c[0] for c in corners], [c[1] for c in corners]
    return (min(xs), min(ys), max(xs), max(ys))


def _frame_box(drawn: _Drawn, keep: NDArray[np.bool_]) -> Bounds | None:
    """The frame's box in its layout: the segments left out as the frame's."""
    frame = drawn.segments[~keep]
    if not len(frame):
        return None
    return (
        float(min(frame[:, 0].min(), frame[:, 2].min())),
        float(min(frame[:, 1].min(), frame[:, 3].min())),
        float(max(frame[:, 0].max(), frame[:, 2].max())),
        float(max(frame[:, 1].max(), frame[:, 3].max())),
    )


def _extent(segments: NDArray[np.float64], texts: list[_Text]) -> Bounds | None:
    xs: list[float] = []
    ys: list[float] = []
    if len(segments):
        xs += [float(segments[:, [0, 2]].min()), float(segments[:, [0, 2]].max())]
        ys += [float(segments[:, [1, 3]].min()), float(segments[:, [1, 3]].max())]
    for t in texts:
        xs += [t.box[0], t.box[2]]
        ys += [t.box[1], t.box[3]]
    if not xs or max(xs) <= min(xs) or max(ys) <= min(ys):
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def _paper_scale(artefact: ReadArtefact, frame: DwgAnchor | None, box: Box) -> float:
    """Model units per paper mm for a model-space sheet (the module's docstring)."""
    long = max(box.x1 - box.x0, box.y1 - box.y0)
    if frame is not None:
        entity = artefact.entities.get(frame.handle)
        if isinstance(entity, Insert):
            try:
                placed = chain_transform((*chain_of(artefact, frame.inserts), link(artefact, entity)))
                scale = placed.xy_scale
            except PlacementError, ValueError:
                scale = 0.0
            if scale > 0 and math.isfinite(scale) and MIN_PAPER_MM <= long / scale <= MAX_PAPER_MM:
                return scale
    best, best_score = 1.0, math.inf
    for side in PAPER_SIDES:
        scale = long / side
        if not scale > 0 or not math.isfinite(scale):
            continue
        power = 10 ** math.floor(math.log10(scale))
        score = min(abs(math.log(scale / (r * p))) for r in ROUND_SCALES for p in (power, power * 10))
        if score < best_score:
            best, best_score = scale, score
    return best


def _move(segments: NDArray[np.float64], transform: Transform) -> NDArray[np.float64]:
    if not len(segments):
        return segments
    a = transform.xy(segments[:, :2])
    b = transform.xy(segments[:, 2:])
    return np.hstack([a, b])


def _clip(segments: NDArray[np.float64], box: Bounds) -> NDArray[np.float64]:
    """The segments' parts inside the box (Liang and Barsky's clip, for every segment at once)."""
    if not len(segments):
        return segments
    x0, y0, x1, y1 = (segments[:, i] for i in range(4))
    dx, dy = x1 - x0, y1 - y0
    t0 = np.zeros(len(segments))
    t1 = np.ones(len(segments))
    keep = np.ones(len(segments), dtype=bool)
    for p, q in ((-dx, x0 - box[0]), (dx, box[2] - x0), (-dy, y0 - box[1]), (dy, box[3] - y0)):
        parallel = p == 0
        keep &= ~(parallel & (q < 0))
        with np.errstate(divide="ignore", invalid="ignore"):
            r = np.where(parallel, 0.0, q / np.where(parallel, 1.0, p))
        t0 = np.where(~parallel & (p < 0), np.maximum(t0, r), t0)
        t1 = np.where(~parallel & (p > 0), np.minimum(t1, r), t1)
    keep &= t0 <= t1
    out = np.stack([x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy], axis=1)
    return out[keep]


def _inside(point: tuple[float, float], box: Bounds) -> bool:
    return box[0] <= point[0] <= box[2] and box[1] <= point[1] <= box[3]


# Pieces on a grid --------------------------------------------------------------------------------------


@dataclass
class _Piece:
    box: Bounds
    lines: int = 0
    words: int = 0
    title_block: bool = False

    @property
    def area(self) -> float:
        return (self.box[2] - self.box[0]) * (self.box[3] - self.box[1])


def _pieces(paper: _Paper, texts: Sequence[_Text], held: Iterable[int]) -> list[_Piece]:
    """The sheet's drawing split into pieces: what is drawn closer than `GAP_MM` is one piece.
    `texts[i]` for `i` in `held` are on the grid; the rest (titles, scales) are not."""
    rx0, ry0, rx1, ry1 = paper.region
    width, height = rx1 - rx0, ry1 - ry0
    if not (width > 0 and height > 0):
        return []
    cell = max(CELL_MM, max(width, height) / MAX_GRID)
    nx, ny = int(width / cell) + 1, int(height / cell) + 1
    segments = _clip(paper.segments, paper.region)
    points_x: list[NDArray[np.float64]] = []
    points_y: list[NDArray[np.float64]] = []
    kinds: list[NDArray[np.int8]] = []
    if len(segments):
        lengths = np.hypot(segments[:, 2] - segments[:, 0], segments[:, 3] - segments[:, 1])
        counts = np.minimum(np.ceil(lengths / (cell / 2)).astype(np.int64) + 1, 1 + int(2 * (nx + ny)))
        total = int(counts.sum())
        if total > MAX_SAMPLES:
            counts = np.maximum((counts * (MAX_SAMPLES / total)).astype(np.int64), 2)
            total = int(counts.sum())
        which = np.repeat(np.arange(len(segments)), counts)
        starts = np.repeat(np.cumsum(counts) - counts, counts)
        steps = np.maximum(counts - 1, 1)
        t = (np.arange(total) - starts) / steps[which]
        s = segments[which]
        points_x.append(s[:, 0] + t * (s[:, 2] - s[:, 0]))
        points_y.append(s[:, 1] + t * (s[:, 3] - s[:, 1]))
        kinds.append(np.zeros(total, dtype=np.int8))
    for i in held:
        x0, y0, x1, y1 = texts[i].box
        gx = np.linspace(x0, x1, max(2, int((x1 - x0) / cell) + 2))
        gy = np.linspace(y0, y1, max(2, int((y1 - y0) / cell) + 2))
        mx, my = np.meshgrid(gx, gy)
        points_x.append(mx.ravel())
        points_y.append(my.ravel())
        kinds.append(np.ones(mx.size, dtype=np.int8))
    if not points_x:
        return []
    xs, ys, kind = np.concatenate(points_x), np.concatenate(points_y), np.concatenate(kinds)
    inside = (xs >= rx0) & (xs <= rx1) & (ys >= ry0) & (ys <= ry1)
    xs, ys, kind = xs[inside], ys[inside], kind[inside]
    cx = np.clip(((xs - rx0) / cell).astype(np.int64), 0, nx - 1)
    cy = np.clip(((ys - ry0) / cell).astype(np.int64), 0, ny - 1)
    grid = np.zeros((ny, nx), dtype=bool)
    grid[cy, cx] = True
    grown = _grow(grid, max(1, math.ceil(GAP_MM / 2 / cell)))
    labels, count = _label(grown)
    if not count:
        return []
    of = labels[cy, cx]
    lo_x = np.full(count, np.inf)
    lo_y = np.full(count, np.inf)
    hi_x = np.full(count, -np.inf)
    hi_y = np.full(count, -np.inf)
    np.minimum.at(lo_x, of, xs)
    np.minimum.at(lo_y, of, ys)
    np.maximum.at(hi_x, of, xs)
    np.maximum.at(hi_y, of, ys)
    line_cells = np.zeros(count, dtype=np.int64)
    word_cells = np.zeros(count, dtype=np.int64)
    cells = cy * nx + cx
    for flag, target in ((0, line_cells), (1, word_cells)):
        chosen = kind == flag
        unique = np.unique(cells[chosen])
        np.add.at(target, labels.ravel()[unique], 1)
    return [
        _Piece(
            (float(lo_x[k]), float(lo_y[k]), float(hi_x[k]), float(hi_y[k])),
            int(line_cells[k]),
            int(word_cells[k]),
        )
        for k in range(count)
        if math.isfinite(lo_x[k])
    ]


def _grow(grid: NDArray[np.bool_], r: int) -> NDArray[np.bool_]:
    out = grid.copy()
    for _ in range(r):
        step = out.copy()
        step[1:, :] |= out[:-1, :]
        step[:-1, :] |= out[1:, :]
        step[:, 1:] |= out[:, :-1]
        step[:, :-1] |= out[:, 1:]
        out = step
    return out


def _label(grid: NDArray[np.bool_]) -> tuple[NDArray[np.int64], int]:
    """The grid's connected pieces (eight neighbours), numbered from 0; -1 where nothing is."""
    ny, nx = grid.shape
    parent: list[int] = []

    def root(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    runs_of: list[list[tuple[int, int, int]]] = []
    padded = np.zeros(nx + 2, dtype=np.int8)
    for y in range(ny):
        padded[1:-1] = grid[y]
        edges = np.flatnonzero(np.diff(padded))
        runs = []
        for start, end in zip(edges[::2], edges[1::2], strict=True):
            parent.append(len(parent))
            runs.append((int(start), int(end), len(parent) - 1))
        if y:
            above = runs_of[-1]
            j = 0
            for start, end, run in runs:
                while j < len(above) and above[j][1] < start:  # ends before this one starts - 1
                    j += 1
                k = j
                while k < len(above) and above[k][0] <= end:  # starts by this one's end + 1
                    parent[root(above[k][2])] = root(run)
                    k += 1
        runs_of.append(runs)
    labels = np.full((ny, nx), -1, dtype=np.int64)
    numbers: dict[int, int] = {}
    for y, runs in enumerate(runs_of):
        for start, end, run in runs:
            number = numbers.setdefault(root(run), len(numbers))
            labels[y, start:end] = number
    return labels, len(numbers)


# Titles ------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Words:
    """A conventions' word lists, matched whole, ignoring case, the longest first."""

    phrases: tuple[tuple[tuple[str, ...], str], ...]  # (words, key), longest first

    @classmethod
    def of(cls, lists: Mapping[str, tuple[str, ...]]) -> _Words:
        found = [(tuple(_tokens(w)), str(key)) for key, words in lists.items() for w in words]
        found = [f for f in found if f[0]]
        found.sort(key=lambda f: -len(f[0]))
        return cls(tuple(found))

    def matches(self, tokens: Sequence[str]) -> list[tuple[int, int, str]]:
        """Each (start, end, key) found, left to right, none overlapping (the longest wins)."""
        taken = [False] * len(tokens)
        found = []
        for words, key in self.phrases:
            n = len(words)
            for i in range(len(tokens) - n + 1):
                if tuple(tokens[i : i + n]) == words and not any(taken[i : i + n]):
                    found.append((i, i + n, key))
                    for j in range(i, i + n):
                        taken[j] = True
        found.sort()
        return found


def _tokens(text: str) -> list[str]:
    return "".join(c if c.isalnum() else " " for c in text.casefold()).split()


@dataclass(frozen=True)
class _Reading:
    kinds: _Words
    order: Mapping[str, int]
    subjects: _Words
    layers: _Words
    patterns: tuple[str, ...]
    after_top: frozenset[str]  # words after "top" that make it a storey


_readings: list[tuple[ViewConventions, _Reading]] = []
"""The conventions last read with, and their words prepared (conventions hold dicts: no hash)."""


def _reading(conventions: ViewConventions) -> _Reading:
    if not _readings or _readings[0][0] is not conventions:
        _readings[:] = [(conventions, _prepare(conventions))]
    return _readings[0][1]


def _prepare(conventions: ViewConventions) -> _Reading:
    sheet = sheet_finder.default_conventions()
    after = {t for w in (*sheet.floor_words, *sheet.level_words) for t in _tokens(w)}
    return _Reading(
        kinds=_Words.of({str(k): v for k, v in conventions.kind_words.items()}),
        order={str(k): i for i, k in enumerate(conventions.kind_words)},
        subjects=_Words.of(conventions.subject_words),
        layers=_Words.of({str(k): v for k, v in conventions.layer_words.items()}),
        patterns=conventions.scale_patterns,
        after_top=frozenset(after),
    )


def _kind(text: str, reading: _Reading) -> ViewKind | None:
    found = reading.kinds.matches(_tokens(text))
    if not found:
        return None
    return ViewKind(min((key for _, _, key in found), key=lambda k: reading.order[k]))


def _subject(text: str, reading: _Reading) -> str | None:
    found = reading.subjects.matches(_tokens(text))
    return found[0][2] if found else None


def _layer(text: str, reading: _Reading) -> Layer | None:
    tokens = _tokens(text)
    for _, end, key in reading.layers.matches(tokens):
        if end < len(tokens) and tokens[end] in reading.after_top:
            continue  # "top floor": a storey
        return Layer(key)
    return None


# Finding views -----------------------------------------------------------------------------------------


@dataclass
class _View:
    piece: _Piece | None
    title: _Text | None
    kind: ViewKind
    box: Bounds
    scale: scales.Scale | None = None
    extra: list[_Piece] = field(default_factory=list)


def find(
    artefact: ReadArtefact, sheet: SheetCandidate, conventions: ViewConventions | None = None
) -> list[ViewCandidate]:
    """The sheet's views, in reading order (the module's docstring)."""
    if not isinstance(sheet, SheetCandidate):
        raise TypeError(f"a sheet is a SheetCandidate, not {type(sheet).__name__}")
    held = conventions if conventions is not None else default_conventions()
    reading = _reading(held)
    paper = _paper(artefact, sheet)
    if paper is None:
        return []
    found = _views(paper, reading)
    discipline = sheet.discipline.value if sheet.discipline is not None else None
    return [_candidate(v, paper, reading, discipline) for v in _in_reading_order(found)]


def _views(paper: _Paper, reading: _Reading) -> list[_View]:
    texts = paper.texts
    heights = [t.height for t in texts if t.height > 0]
    tall = median(heights) if heights else 0.0
    titles: list[int] = []
    scale_texts: list[int] = []
    for i, t in enumerate(texts):
        if "\n" in t.placed.shown:
            continue
        words = _tokens(t.shown)
        if (
            len(words) <= MAX_TITLE_WORDS
            and scales.read(t.shown, reading.patterns) is not None
            and _kind(t.shown, reading) is None
        ):
            scale_texts.append(i)
            continue
        if (
            len(titles) < MAX_TITLES
            and 0 < len(words) <= MAX_TITLE_WORDS
            and t.height >= tall
            and _kind(t.shown, reading) is not None
        ):
            titles.append(i)
    off_grid = set(titles) | set(scale_texts)
    pieces = _pieces(paper, texts, (i for i in range(len(texts)) if i not in off_grid))
    rx0, ry0, rx1, ry1 = paper.region
    paper_area = (rx1 - rx0) * (ry1 - ry0)

    pairs: list[tuple[float, int, int]] = []
    for ti in titles:
        t = texts[ti]
        x0, y0, x1, y1 = t.box
        h = max(t.height, 1e-9)
        for k, piece in enumerate(pieces):
            px0, py0, px1, py1 = piece.box
            if max(px1 - px0, py1 - py0) < MIN_VIEW_MM or px0 > x1 or px1 < x0:
                continue
            below = (py0 - y1) / h  # the drawing above its title
            above = (y0 - py1) / h  # the drawing under its title
            if -0.5 <= below <= TITLE_GAP:
                pairs.append((below, ti, k))
            elif -0.5 <= above <= TITLE_GAP:
                pairs.append((above + TITLE_GAP, ti, k))
    pairs.sort()
    by_title: dict[int, int] = {}
    by_piece: dict[int, int] = {}
    for _, ti, k in pairs:
        if ti in by_title or k in by_piece:
            continue
        by_title[ti] = k
        by_piece[k] = ti

    views: list[_View] = []
    for ti in titles:
        t = texts[ti]
        kind = _kind(t.shown, reading)
        assert kind is not None
        if ti not in by_title:
            continue  # a title with no drawing: not a view
        titled = pieces[by_title[ti]]
        views.append(_View(titled, t, kind, _union(titled.box, t.box)))
    for k, piece in enumerate(pieces):
        if k in by_piece:
            continue
        if piece.area >= MIN_UNTITLED * paper_area and len(views) < MAX_VIEWS:
            kind = ViewKind.NOTES if piece.words > piece.lines else ViewKind.PLAN
            views.append(_View(piece, None, kind, piece.box))
    for k, piece in enumerate(pieces):
        if k in by_piece or any(v.piece is piece for v in views):
            continue
        holders = [v for v in views if _holds(_grown(v.box, JOIN_MM), piece.box)]
        if holders:
            smallest = min(holders, key=lambda v: _area(v.box))
            smallest.box = _union(smallest.box, piece.box)
    for si in scale_texts:
        s = texts[si]
        best: tuple[float, _View] | None = None
        for v in views:
            if v.title is None:
                continue
            _, ty0, _, ty1 = v.title.box
            h = max(v.title.height, 1e-9)
            level = abs((s.box[1] + s.box[3]) / 2 - (ty0 + ty1) / 2) / h
            under = (ty0 - s.box[3]) / h
            within = v.box[0] - h <= s.box[0] and s.box[2] <= v.box[2] + h
            if within and (level <= 0.8 or 0 <= under <= 3):
                score = min(level, under if under >= 0 else math.inf)
                if best is None or score < best[0]:
                    best = (score, v)
        if best is not None and best[1].scale is None:
            best[1].scale = scales.read(s.shown, reading.patterns)
            best[1].box = _union(best[1].box, s.box)
    return views[:MAX_VIEWS]


def _union(a: Bounds, b: Bounds) -> Bounds:
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def _grown(a: Bounds, by: float) -> Bounds:
    return (a[0] - by, a[1] - by, a[2] + by, a[3] + by)


def _holds(outer: Bounds, inner: Bounds) -> bool:
    return (
        outer[0] <= inner[0] and outer[1] <= inner[1] and inner[2] <= outer[2] and inner[3] <= outer[3]
    )


def _area(a: Bounds) -> float:
    return (a[2] - a[0]) * (a[3] - a[1])


def _in_reading_order(views: list[_View]) -> list[_View]:
    """Rows top to bottom (views whose heights overlap by half are a row), each left to right."""
    rows: list[list[_View]] = []
    for view in sorted(views, key=lambda v: -v.box[3]):
        for row in rows:
            top = min(v.box[1] for v in row), max(v.box[3] for v in row)
            overlap = min(top[1], view.box[3]) - max(top[0], view.box[1])
            smaller = min(top[1] - top[0], view.box[3] - view.box[1])
            if smaller > 0 and overlap >= smaller / 2:
                row.append(view)
                break
        else:
            rows.append([view])
    return [v for row in rows for v in sorted(row, key=lambda v: v.box[0])]


# What a view says and is proposed for ------------------------------------------------------------------


def _candidate(view: _View, paper: _Paper, reading: _Reading, discipline: str | None) -> ViewCandidate:
    title = " ".join(view.title.shown.split()) if view.title is not None else None
    scale = view.scale
    if title is not None and scale is None:
        scale = scales.read(title, reading.patterns)
    subject = _subject(title, reading) if title is not None else None
    layer = _layer(title, reading) if title is not None else None
    keys: tuple[str, ...] = ()
    as_stated = None
    if title is not None and view.kind is ViewKind.PLAN:
        read = storeys.read(title, sheet_finder.default_conventions(), plan_title=True)
        keys = tuple(dict.fromkeys((*read.keys, *([read.runs_to] if read.runs_to else []))))
        as_stated = read.as_stated
    meaning = None
    if keys:
        meaning = (
            StoreysMeaning.FLOOR_TO_FLOOR if subject in FLOOR_TO_FLOOR else StoreysMeaning.AT_FLOOR_LEVEL
        )
    steps, part, exclusion = _proposal(view.kind, subject, discipline)
    anchors: tuple[DwgAnchor, ...] = ()
    if view.title is not None and paper.anchor is not None:
        a = paper.anchor
        anchors = (
            DwgAnchor(
                a.source_sha256,
                a.reader,
                a.reader_version,
                a.sheet,
                view.title.chain,
                view.title.placed.entity.handle,
            ),
        )
    return ViewCandidate(
        box=Box(*view.box),
        kind=view.kind,
        title=title or None,
        not_to_scale=scale is not None and scale.not_to_scale,
        stated_scale=scale.stated if scale is not None else None,
        storeys_as_stated=as_stated,
        storeys=keys,
        storeys_meaning=meaning,
        subject=subject,
        layer=layer,
        steps=steps,
        part=part,
        exclusion=exclusion,
        anchors=anchors,
    )


def _proposal(
    kind: ViewKind, subject: str | None, discipline: str | None
) -> tuple[tuple[str, ...], str | None, Exclusion | None]:
    """A view's proposed Takeoff Steps, Part or exclusion (the module's docstring)."""
    if kind in _EXCLUDED_KINDS:
        return (), None, Exclusion(ExclusionReason.FOR_INFORMATION)
    if discipline is None:
        return (), None, None
    if discipline not in STEP_DISCIPLINES:
        return (), discipline, None
    if kind in (ViewKind.LEGEND, ViewKind.NOTES):
        return (GENERAL_NOTES,), None, None
    if discipline == "structural":
        return STRUCTURAL_STEPS.get(subject or "", ()), None, None
    if kind is ViewKind.PLAN and subject in STRUCTURE_SUBJECTS:
        return (), None, Exclusion(ExclusionReason.DUPLICATE)
    if subject in PLUMBING_SUBJECTS:
        return ARCHITECTURAL_STEPS, PLUMBING_PART, None
    return ARCHITECTURAL_STEPS, None, None


def working_view(views: Sequence[ViewCandidate]) -> int | None:
    """The index of the sheet's working view: its first plan not proposed out, or none."""
    return next(
        (i for i, v in enumerate(views) if v.kind == ViewKind.PLAN and v.exclusion is None), None
    )
