"""A sheet laid on paper (17; S15-E2's part): what each space of the file draws, walked once on the
file's `ViewBudget`, and what a sheet shows of it, in mm on its paper.

**Where a sheet's drawing is.** A layout sheet's is what its layout draws in paper space and what each of
its viewports shows of model space (AutoCAD's main viewport left out, `buffers.is_main_viewport`; a
viewport's model-to-paper transform is the renderer's, `buffers.viewport_transform`), clipped to the
viewport; a model-space sheet's is what model space draws inside its frame's box. The sheet's frame (its
first anchor, 13's: the frame insert with everything it draws, or its rectangle) and its title block's
texts are no view's. **Every box is on paper, in mm, from the sheet's lower-left corner** (the rulings,
"24s <-> 17"), and `FoundViews.paper` is the paper's extent its boxes are on (the ruling of 14:20): a
layout's paper units are taken as mm, its paper the frame's box (else the drawing's extent); a
model-space sheet's box is `(model - lower-left corner of its frame) / scale`, the scale being, in order
(`_paper_scale`): its frame insert's when the frame block is drawn at a standard sheet's size (within
0.5 %, in mm or in the drawing's units; a sheet twice another, A1 and A3, boxes both at standard scales,
and only the insert says which); else a standard sheet's at a standard scale when the box is exactly one
(`EXACT_MATCH`, both sides, in the drawing's units, the render buffers' `_standard_sheet`: a frame block
drawn at a fraction of its paper can give a paper inside a smaller sheet); else its frame insert's when
the frame lies inside a standard sheet (`BINDING_MM` within its edge, a border's binding margin,
`FRAME_MATCH` past it); else a standard sheet's when the box is one within 0.5 %; else, for a frame
drawn as a rectangle or a frame block drawn at a fraction of its plotted size, the box's long side taken
as A1's (`FALLBACK_LONG_MM`: never a smaller paper than the buffers laid before). The frame stands as in
model space's axes (a turned A3 is 297 wide and 420 tall), and its paper is the frame's box at the scale
taken.
Where the sheet's Plot page was matched (the harness passes its paper, `find(..., plot)`), its paper is
that page's at the scale that fits the frame's box to it, the box centred (`_plot_paper`), before any
of these. This is the one rule for a model-space sheet's paper: the render buffers lay theirs by
`_paper_scale` too, so a view's box and the drawing under it cannot drift apart (#160).

**The file's budget** (`ViewBudget`, one for the file's sheets, the package's docstring): each space is
walked once (model space once per file), and every walk spends the file's `MAX_VISITS` entities,
`MAX_SEGMENTS` lines and `MAX_TEXTS` texts, and every viewport weighs model space against the file's
`MAX_SCANS` and `MAX_READS` (at most `MAX_SHEET_VIEWPORTS` viewports a layout, the rest counted in
`ViewBudget.limits`, not read in full). The bounds are the package's names (`engine.recognise.views`),
as they stand when a budget is made.
"""

import math
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from importlib import import_module

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
from engine.recognise import sheets as sheet_finder
from engine.recognise.sheets import _finite_insert, _Placed, _plain, _Segmenter
from engine.recognise.types import Box, SheetCandidate
from engine.render import _shapes
from engine.render.buffers import (
    MAX_PAPER_MM,
    SCALES,
    SHEETS_MM,
    UNIT_MM,
    _standard_sheet,
    is_main_viewport,
    viewport_transform,
)

REFERENCE_MM = 841.0
"""The long side of the paper the sizes of the package are given for (A1)."""
MAX_SHEET_VIEWPORTS = 64
"""The most viewports of one layout read; the rest are counted in `ViewBudget.limits`."""
FALLBACK_LONG_MM = 841.0
"""A model-space sheet whose drawing states no paper has its box's long side taken as A1's, as the render
buffers took it before #160: never a smaller paper than that (a guess of A3 or A4 laid a sheet plotted on
A1 at a quarter of its page, #160's review)."""
FRAME_MATCH = 0.05
"""How much larger than a standard sheet, on either side, a frame's paper may be (a trim line drawn just
outside the sheet's edge)."""
EXACT_MATCH = 0.001
"""A box this close to a standard sheet at a standard scale, on both sides, is that sheet before any
frame insert's binding window (`BINDING_MM`) is tried (after a frame block drawn at a sheet's size): a
frame block drawn at a third of an A1 and inserted at 300 boxes an exact A1 at 1:100, though its insert
gives a paper inside A4's window. Looser (the render buffers' 0.5 %), a border's box can match another
sheet by chance: a 409 x 288 mm A3 border at 1:73 boxes an A0 at 1:25 within 0.44 %, and its insert's
scale is the truer reading."""
BINDING_MM = 31.0
"""How much smaller than a standard sheet, on either side, a frame's paper may be and still be that
sheet's (a border drawn inside the paper's edge: ISO 5457's 20 mm binding and 10 mm opposite, as 30 mm a
side, and a millimetre for the drawing's rounding). A frame insert whose scale gives a paper inside no
standard sheet by this margin was drawn at a fraction of its plotted size (#160: the real sets' blocks
of 130 x 92 mm), and the paper is the box's, as for a frame drawn as a rectangle."""


type Bounds = tuple[float, float, float, float]


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
    text_origins: NDArray[np.float64] = field(default_factory=lambda: np.empty((0, 2)))


class ViewBudget:
    """One file's budget for its sheets' views (the module's docstring): pass the same one to every
    `find` of the file's sheets, so they spend its bounds together and model space is walked once for
    all of them. It holds the file while it is held, and nothing else does."""

    def __init__(self, artefact: ReadArtefact) -> None:
        bounds = import_module(__name__.rpartition(".")[0])  # the package's names, as they stand now
        self.artefact = artefact
        self.segmenter = _Segmenter(artefact, None, sheet_finder.default_conventions())
        self._model: _Drawn | None = None
        self.visits: int = bounds.MAX_VISITS
        self.segments: int = bounds.MAX_SEGMENTS
        self.texts: int = bounds.MAX_TEXTS
        self.scans: int = bounds.MAX_SCANS
        self.reads: int = bounds.MAX_READS
        self.text_reads: int = bounds.MAX_TEXT_READS
        """What the file's sheets may still take from what was walked: lines and texts laid on paper,
        and model-space items weighed by a viewport's window."""
        self.limits: Counter[str] = Counter()
        """What a bound left unread, by name (`viewports_capped`, `scan_budget`, `read_budget`)."""
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
            max_visits=self.visits,
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
                if entity.type == "ATTDEF" or len(texts) >= self.texts:
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
            if count >= self.segments:
                continue
            found = _segments(entity, chain)
            if found is None or not len(found):
                continue
            found = found[: self.segments - count]
            count += len(found)
            pieces.append(found)
            piece_chain.append(chain_id(chain))
            entities.append(entity.handle)
            piece_entity.append(len(entities) - 1)
        self.visits = max(self.visits - walk.visits, 0)
        self.segments -= count
        self.texts -= len(texts)
        if pieces:
            segments = np.concatenate(pieces)
            lengths = [len(p) for p in pieces]
            seg_chain = np.repeat(np.array(piece_chain, dtype=np.int32), lengths)
            seg_entity = np.repeat(np.array(piece_entity, dtype=np.int32), lengths)
        else:
            segments = np.empty((0, 4))
            seg_chain = seg_entity = np.empty(0, dtype=np.int32)
        origins = np.array([t.origin for t in texts], dtype=np.float64).reshape(-1, 2)
        return _Drawn(
            segments, seg_chain, seg_entity, chains, entities, texts, text_chain, viewports, origins
        )


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
    frame: NDArray[np.float64] = field(default_factory=lambda: np.empty((0, 4)))
    """The frame's own segments on paper (left out of `segments`)."""
    block: list[_Text] = field(default_factory=list)
    """The title block's texts on paper: the frame's own and the values 13 read (no view's)."""
    values: frozenset[str] = frozenset()
    """The handles of the values 13 read (among `block`): where the title block is sought from."""
    lengths: NDArray[np.float64] | None = None
    """Each segment's length on paper before the paper's edge cut it (a viewport's own edge is no cut
    here), one per segment, filtered wherever `segments` is; its own length when none is given."""

    def __post_init__(self) -> None:
        if self.lengths is not None and len(self.lengths) != len(self.segments):
            raise ValueError("a paper's lengths are one per segment")


def _paper(
    artefact: ReadArtefact,
    sheet: SheetCandidate,
    budget: ViewBudget,
    plot: tuple[float, float] | None = None,
) -> _Paper | None:
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
    layout = sheet.location.layout is not None
    if sheet.location.layout is not None:
        handle = budget.layouts.get(sheet.location.layout)
        if handle is None:
            return None
        drawn = budget.walk(handle)
        parts.append((drawn, Transform(), None, None))
        first = True
        for n, viewport in enumerate(drawn.viewports):
            if n >= MAX_SHEET_VIEWPORTS:
                budget.limits["viewports_capped"] += len(drawn.viewports) - n
                break
            values_of = dict(viewport.values)
            main = is_main_viewport(values_of, first)
            first = False
            through = None if main else viewport_transform(values_of)
            rect = None if main else _shapes_rect(values_of)
            model = budget.model()
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
        model = budget.model()
        if box is None or model is None:
            return None
        scale, read = _paper_scale(artefact, frame, box)
        fitted = _plot_paper(box, plot, scale if read else None) if plot is not None else None
        if fitted is not None:
            scale, (ox, oy), (paper_w, paper_h) = fitted
        else:
            ox, oy = box.x0, box.y0
            paper_w, paper_h = (box.x1 - box.x0) / scale, (box.y1 - box.y0) / scale
        to_paper = scaling(1 / scale, 1 / scale) @ translation(-ox, -oy)
        region = (0.0, 0.0, paper_w, paper_h)
        x0, y0 = (box.x0 - ox) / scale, (box.y0 - oy) / scale
        shown_box = (x0, y0, x0 + (box.x1 - box.x0) / scale, y0 + (box.y1 - box.y0) / scale)
        parts.append((model, to_paper, (box.x0, box.y0, box.x1, box.y1), shown_box))

    segments: list[NDArray[np.float64]] = []
    lengths: list[NDArray[np.float64]] = []  # each segment's on paper before the paper's edge cut it
    frame_segments: list[NDArray[np.float64]] = []
    texts: list[_Text] = []
    block: list[_Text] = []
    kept: dict[int, NDArray[np.bool_]] = {}  # each space's frame test, once for all its viewports
    for drawn, to_paper, window, clip in parts:
        if id(drawn) not in kept:
            kept[id(drawn)] = keep_segments(drawn)
        keep = kept[id(drawn)]
        weighed = len(drawn.segments) + len(drawn.texts) if window is not None else 0
        if weighed > budget.scans:
            budget.limits["scan_budget"] += 1
            continue  # past the file's budget: this part is not read
        budget.scans -= weighed
        chosen_texts = np.arange(len(drawn.texts))
        seen = np.ones(len(drawn.segments), dtype=bool)
        if window is not None:
            wx0, wy0, wx1, wy1 = window
            seg = drawn.segments
            seen = (
                (np.minimum(seg[:, 0], seg[:, 2]) <= wx1) & (np.maximum(seg[:, 0], seg[:, 2]) >= wx0)
                & (np.minimum(seg[:, 1], seg[:, 3]) <= wy1) & (np.maximum(seg[:, 1], seg[:, 3]) >= wy0)
            )  # fmt: skip
            keep = keep & seen
            o = drawn.text_origins
            chosen_texts = np.flatnonzero(
                (o[:, 0] >= wx0) & (o[:, 0] <= wx1) & (o[:, 1] >= wy0) & (o[:, 1] <= wy1)
            )
        framed = seen & ~kept[id(drawn)]
        taken = int(keep.sum()) + int(framed.sum())
        if taken > budget.reads or len(chosen_texts) > budget.text_reads:
            budget.limits["read_budget"] += 1
            continue
        budget.reads -= taken
        budget.text_reads -= len(chosen_texts)
        for mask, out in ((keep, segments), (framed, frame_segments)):
            chosen = drawn.segments[mask]
            whole = _move(chosen, to_paper)  # a model sheet's window is its paper: measured before it
            length = np.hypot(whole[:, 2] - whole[:, 0], whole[:, 3] - whole[:, 1])
            if window is not None:
                chosen, kept_now = _clip_kept(chosen, window)
                length = length[kept_now]
            moved = _move(chosen, to_paper)
            if layout:  # a viewport's edge is no paper's: measured from there
                length = np.hypot(moved[:, 2] - moved[:, 0], moved[:, 3] - moved[:, 1])
            if clip is not None:
                moved, kept_now = _clip_kept(moved, clip)
                length = length[kept_now]
            out.append(moved)
            if out is segments:
                lengths.append(length)
        scale = to_paper.xy_scale
        for i in chosen_texts.tolist():
            placed = drawn.texts[i]
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
            placed_text = _Text(placed, chain, text_box, height, _plain(placed.shown))
            (texts if keep_text(drawn, i) else block).append(placed_text)
    all_segments = np.concatenate(segments) if segments else np.empty((0, 4))
    frame_drawn = np.concatenate(frame_segments) if frame_segments else np.empty((0, 4))
    if region is None:
        region = _extent(all_segments, texts)
    if region is None or not all(math.isfinite(v) for v in (*region, region[2] - region[0],
                                                           region[3] - region[1])):  # fmt: skip
        return None  # a paper past what a float holds: nothing is read on it
    x0, y0 = region[0], region[1]
    if (
        x0 or y0
    ):  # every box on paper from the sheet's lower-left corner (a layout's frame may lie off 0)
        all_segments = all_segments - np.array([x0, y0, x0, y0])
        frame_drawn = frame_drawn - np.array([x0, y0, x0, y0])
        for t in (*texts, *block):
            b = t.box
            t.box = (b[0] - x0, b[1] - y0, b[2] - x0, b[3] - y0)
        region = (0.0, 0.0, region[2] - x0, region[3] - y0)
    return _Paper(
        region,
        all_segments,
        texts,
        None if frame is None else frame.sheet,
        frame,
        frame_drawn,
        block,
        values,
        np.concatenate(lengths) if lengths else np.empty(0),
    )


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


def _plot_paper(
    box: Box, plot: tuple[float, float], read: float | None = None
) -> tuple[float, tuple[float, float], tuple[float, float]] | None:
    """A model-space sheet's paper where its Plot page was matched (#160, the ruling of session 09):
    the page's paper, in mm, at the scale that fits the frame's box to it, the box centred on it.
    Model units per paper mm, the paper's lower-left corner in model units, and its width and height;
    none for a page or a box with no size. The paper keeps model space's axes: a page whose
    orientation differs from the box's plotted the sheet turned (the Plot's registration turns it
    back), so its sides are taken in the box's orientation. A page larger than any sheet
    (`MAX_PAPER_MM`) gives none, and the sheet keeps the paper its drawing gives. `read` is the scale
    the drawing gave (`_paper_scale`, read): where it lays the box on the page within `BINDING_MM`
    of its edge (a frame's border drawn inside the sheet's edge: 409 mm or 390 mm on a 420 mm page),
    it is kept, since fitting the border to the page's edge would enlarge the drawing by its margin."""
    width, height = box.x1 - box.x0, box.y1 - box.y0
    sides = (width, height, *plot)
    if not all(math.isfinite(v) and v > 0 for v in sides):
        return None
    long_mm, short_mm = max(plot), min(plot)
    if long_mm > MAX_PAPER_MM:
        return None  # a page larger than any sheet (a hostile PDF's): the paper the drawing gives
    paper_w, paper_h = (long_mm, short_mm) if width >= height else (short_mm, long_mm)
    scale = max(width / paper_w, height / paper_h)
    if not (math.isfinite(scale) and scale > 0):
        return None
    if (
        read is not None
        and math.isfinite(read)
        and scale <= read
        and width / read >= paper_w - BINDING_MM
        and height / read >= paper_h - BINDING_MM
    ):
        scale = read  # the drawing's scale lays the box on the page, inside its edge
    origin = (box.x0 - (paper_w * scale - width) / 2, box.y0 - (paper_h * scale - height) / 2)
    if not all(map(math.isfinite, origin)):
        return None
    return scale, origin, (paper_w, paper_h)


def _paper_scale(artefact: ReadArtefact, frame: DwgAnchor | None, box: Box) -> tuple[float, bool]:
    """Model units per paper mm for a model-space sheet (the module's docstring), and whether the drawing
    gave it rather than the fallback, A1's long side (`FALLBACK_LONG_MM`). In order: the frame insert's
    scale where the frame block is drawn at a standard sheet's size (within the buffers' 0.5 %); the box
    exactly a standard sheet at a standard scale (`EXACT_MATCH`); the frame insert's scale where its
    paper lies inside a standard sheet's binding window (`BINDING_MM`); the box a standard sheet at a
    standard scale within 0.5 %. The render buffers' paper is laid by this too
    (`buffers._model_paper`)."""
    width, height = box.x1 - box.x0, box.y1 - box.y0
    long, short = max(width, height), min(width, height)
    if not short > 0:
        scale = long / FALLBACK_LONG_MM
        return (scale, False) if scale > 0 and math.isfinite(scale) else (1.0, False)
    unit = UNIT_MM.get(artefact.summary.insunits, 1.0)
    readings = _insert_readings(artefact, frame, unit)
    # 1. A frame block drawn at a standard sheet's size states its sheet: a sheet twice another (A1 and
    # A3, A2 and A4, ANSI C and A) boxes both at standard scales, and only the insert says which (#160's
    # review, round 3).
    for per_mm in readings:
        if _standard_sheet(long / per_mm, short / per_mm, (1.0,), (1,)) is not None:
            return per_mm, True
    # 2. The box exactly a standard sheet at a standard scale: a frame block drawn at a fraction of its
    # paper (a third of an A1, inserted at 300) gives a paper inside a smaller sheet's binding window,
    # and its box says which sheet it is (round 2).
    exact = _standard_sheet(long, short, (unit,), SCALES, EXACT_MATCH)
    if exact is not None:
        return 1 / exact, True
    # 3. A border drawn inside its sheet's edge (round 1).
    for per_mm in readings:
        if _inside_a_sheet(long / per_mm, short / per_mm):
            return per_mm, True
    # 4. The box a standard sheet at a standard scale, within the buffers' 0.5 %.
    matched = _standard_sheet(long, short, (unit,), SCALES)
    if matched is not None:
        return 1 / matched, True
    scale = long / FALLBACK_LONG_MM
    if not (scale > 0 and math.isfinite(scale)):
        return 1.0, False  # a box with no size a float holds: its units taken as mm
    return scale, False


def _insert_readings(artefact: ReadArtefact, frame: DwgAnchor | None, unit: float) -> tuple[float, ...]:
    """The scales (model units per paper mm) a frame insert may state: its block drawn in mm (at paper
    size), else in the drawing's own units (an A3 frame 16.5 inches long in a drawing in inches); none
    for a frame drawn as a rectangle or an insert with no finite scale."""
    if frame is None:
        return ()
    entity = artefact.entities.get(frame.handle)
    if not isinstance(entity, Insert):
        return ()
    try:
        placed = chain_transform((*chain_of(artefact, frame.inserts), link(artefact, entity)))
        scale = placed.xy_scale
    except PlacementError, ValueError:
        return ()
    return tuple(v for v in (scale, scale / unit) if v > 0 and math.isfinite(v))


def _inside_a_sheet(long_mm: float, short_mm: float) -> bool:
    """Whether a frame's paper (its long and short sides, mm) lies inside a standard sheet, within
    `BINDING_MM` of its edge on each side (and at most `FRAME_MATCH` past it)."""
    return any(
        sheet_long - BINDING_MM <= long_mm <= sheet_long * (1 + FRAME_MATCH)
        and sheet_short - BINDING_MM <= short_mm <= sheet_short * (1 + FRAME_MATCH)
        for sheet_long, sheet_short in SHEETS_MM
    )


def _move(segments: NDArray[np.float64], transform: Transform) -> NDArray[np.float64]:
    if not len(segments):
        return segments
    a = transform.xy(segments[:, :2])
    b = transform.xy(segments[:, 2:])
    return np.hstack([a, b])


def _clip(segments: NDArray[np.float64], box: Bounds) -> NDArray[np.float64]:
    """The segments' parts inside the box (Liang and Barsky's clip, for every segment at once)."""
    return _clip_kept(segments, box)[0]


def _clip_kept(
    segments: NDArray[np.float64], box: Bounds
) -> tuple[NDArray[np.float64], NDArray[np.bool_]]:
    """`_clip`, and which of the segments have a part inside the box."""
    if not len(segments):
        return segments, np.ones(0, dtype=bool)
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
    return out[keep], keep


def _inside(point: tuple[float, float], box: Bounds) -> bool:
    return box[0] <= point[0] <= box[2] and box[1] <= point[1] <= box[3]


def _centre(box: Bounds) -> tuple[float, float]:
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def _segments_in(segments: NDArray[np.float64], box: Bounds) -> NDArray[np.bool_]:
    """The segments with both ends in the box."""
    x, y = segments[:, [0, 2]], segments[:, [1, 3]]
    inside = (x >= box[0]) & (x <= box[2]) & (y >= box[1]) & (y <= box[3])
    return np.asarray(inside.all(axis=1), dtype=np.bool_)


# Boxes on paper ----------------------------------------------------------------------------------------


def _bounds(boxes: Sequence[Bounds]) -> Bounds:
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def _bounds4(values: Sequence[float]) -> Bounds:
    return (float(values[0]), float(values[1]), float(values[2]), float(values[3]))


def _union(a: Bounds, b: Bounds) -> Bounds:
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def _grown(a: Bounds, by: float) -> Bounds:
    return (a[0] - by, a[1] - by, a[2] + by, a[3] + by)


def _meets(a: Bounds, b: Bounds) -> bool:
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]


def _holds(outer: Bounds, inner: Bounds) -> bool:
    return (
        outer[0] <= inner[0] and outer[1] <= inner[1] and inner[2] <= outer[2] and inner[3] <= outer[3]
    )


def _area(a: Bounds) -> float:
    return (a[2] - a[0]) * (a[3] - a[1])


def _overlap(a: Bounds, b: Bounds) -> float:
    return max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))


def _gap(a: Bounds, b: Bounds) -> float:
    """How far apart two boxes are (0 when they meet)."""
    return math.hypot(max(0.0, a[0] - b[2], b[0] - a[2]), max(0.0, a[1] - b[3], b[1] - a[3]))
