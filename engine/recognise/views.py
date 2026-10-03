"""Views within sheets (17): the drawings one sheet holds, each with its title, kind, scale, storeys,
subject and layer, and what it is proposed for.

    views.find(artefact, sheet, conventions) -> FoundViews   (the harness's `views` stage; `.paper`)
    views.working_view(views) -> int | None                            (16's and 22's fit)
    views.kind_steps(kind, discipline, conventions=None) -> tuple[str, ...]  (Step 1, #158)
    views.subjects(text, conventions=None) -> frozenset[str]             (19b's continuations)
    views.describe(text, conventions=None) -> Described                   (19b's continuations)
    views.default_conventions() -> ViewConventions

`conventions` are view conventions (`engine/recognise/conventions/view-default.json` by default: the
title words of each kind, the subject and layer words and the scale patterns, all data). The storey
words are the default sheet conventions' (13's `storeys.read`; 21b passes the Market's later).

**Where a sheet's drawing is.** A layout sheet's is what its layout draws in paper space and what each of
its viewports shows of model space (AutoCAD's main viewport left out, `buffers.is_main_viewport`; a
viewport's model-to-paper transform is the renderer's, `buffers.viewport_transform`), clipped to the
viewport; a model-space sheet's is what model space draws inside its frame's box. The sheet's frame (its
first anchor, 13's: the frame insert with everything it draws, or its rectangle) and its title block's
texts are no view's. **Every box is on paper, in mm, from the sheet's lower-left corner** (the rulings,
"24s <-> 17"), and `FoundViews.paper` is the paper's extent its boxes are on (the ruling of 14:20): a
layout's paper units are taken as mm, its paper the frame's box (else the drawing's extent); a
model-space sheet's box is `(model - lower-left corner of its frame) / scale`, the scale being its frame
insert's (the frame block drawn at paper size, in mm), else, for a frame drawn as a rectangle or a scale
giving no paper size, the one that makes the frame a standard paper size (`PAPER_SIDES`) at the roundest
scale (`ROUND_SCALES`).

**How views are found.** The sheet's lines and texts are laid on a grid of `CELL_MM` cells over its
paper, grown by `GAP_MM` so that what is drawn closer than that joins, and split into connected pieces.
These sizes, `MIN_VIEW_MM` and `JOIN_MM` are an A1 sheet's (`REFERENCE_MM` long), scaled to the sheet's
paper, so a frame whose paper is read too small or too large is split alike (a frame block drawn at a
fraction of its plotted size: the real sets' frames give papers of 130 to 420 mm plotted on A3 and A1). A
**view title** is a text of two lines at most and `MAX_TITLE_WORDS` words at most holding a kind's words
(the kind listed first in the conventions wins where several are named: "TYPICAL BEAM SECTION DETAIL" is
a detail), not in the title block, at least as tall as the sheet's median text (and at most `MAX_LETTER`
of the paper), not numbered ("5. SEE SECTION ...") and not one of a column of `MIN_NOTE_LINES` lines
alike (a note's; a scale text in the column is the title's scale line, not a note's). A title lying under
another within `SUBTITLE_GAP` of its height, across the same place, is its second line ("PRESENTATION
PLAN" under "GROUND FLOOR PLAN"), no title of its own. Titles, second lines and scale texts stay off the
grid, and so do the lines within a title's band (its underline), and straight lines along the paper's
axes of `DIVIDER_SHARE` of its side or longer (borders, dividers between rows of details). Each title
takes the piece it lies under (a drawing titled beneath, the convention; within `TITLE_GAP` of its
height), else the piece it lies over (within `TITLE_GAP_UNDER`), else, after all of those, the piece
whose box holds it within `TITLE_INSIDE` of its lower or upper edge (a section's ground line running
under and past its title), nearest first, one title a piece; a band less tall than `MIN_DRAWING` of its
height is never its drawing, and joins its view when it meets the title. A titled piece that is a row
under a larger piece without a title (no taller than `ROW_SHARE` of it, across its width, within
`JOIN_MM` of it) is that drawing's detached row of grid marks and dimensions, which is what the title
lies nearest: the view takes the body too. A title's second lines, and up to `MAX_TITLE_LINES` one-line
texts standing under a drawing's title (its scale line, its storeys; not a notes, legend or schedule
heading's, whose lines are its content), are its: off the grid and in its view's box. A piece with no
title lying in a titled view's box (grown by `JOIN_MM`) is that view's, whatever its size; another is a
view when it covers `MIN_UNTITLED` of the paper (of the kind its sheet's title names, else a plan; notes
when text fills more of it than lines); a smaller one joins the view whose box, grown by `JOIN_MM`, holds
it. A view's box is its piece, its title and its scale text together. **Reading order** is by rows, top
to bottom (views whose heights overlap by half are one row), each left to right.

**The title block is a view** (CONTEXT.md's "View"; the orchestrator's ruling R2, session 07), of kind
`title_block`, last on its sheet, after the rows: its box is where its texts stand (the values 13 read,
and the frame's own texts in their band within `CLUSTER_MM`, down or across, whichever holds more; never
a zone mark nor a name in a far corner), grown on each side to the nearest ruled line across them, the
frame's or the sheet's (`RULE_MM`), else to the paper's edge. A sheet with no value read has none, and so
has one whose box would cover more than `MAX_BLOCK_SHARE` of the paper (no title block eats the sheet's
drawings). What lies in it (a loose word, its ruled lines drawn outside the frame) is no other view's;
the sheet's median text is still measured over every text it holds. The frame's lines laid on paper for
it are charged to the file's read budget with the drawing's, and at most `MAX_RULES` straight lines along
each axis are weighed.

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
Structural view goes to the Steps of its subject (`STRUCTURAL_STEPS`: 4 to 10 only here); one whose
own title names no subject with a Step ("SECTION 1-1") goes to the Steps of every subject its sheet's
title names ("BEAM DETAILS": beams), in the title's order, its own subject kept as its title says
(#158); on a sheet whose title names none either it has no Step (unaccounted until the QS assigns it or
Step 1 tells it from the kind the sheet is confirmed as, `vextrus/takeoff/services/step1.py`). An
Architectural plan drawing the structure (a column or beam subject, named by a word not a lintel's:
`NOT_STRUCTURE_WORDS`) is excluded as a `duplicate` (the structural set governs); an Architectural
fixture plan or toilet detail goes to Steps 11 and 12 and to the Plumbing and sanitary Part as well;
another Architectural view to Steps 11 and 12. The Step keys are the seed's (`vextrus/seed/drawings.py`)
until 19a's Library names them. **Not built:** a view that draws
only a base plan is not yet told (proposed out as `blank`, Q7); nothing here reads a view's content.

**The working view** (`working_view`) is the first plan in reading order not proposed out: the view 16
and 22 open a sheet fitted to; none when the sheet has no such plan.

**Hostile input is bounded, by one budget for the whole file** (`_Walker`, held for the file's sheets):
each space is walked once (model space once per file), and every walk spends the file's `MAX_VISITS`
entities, `MAX_SEGMENTS` lines and `MAX_TEXTS` texts, so no number of layouts multiplies them, and every
viewport weighs model space against the file's `MAX_READS` (at most `MAX_SHEET_VIEWPORTS` viewports a
layout, the rest counted in `_Walker.limits`, not read in full); the grid has at most `MAX_GRID` cells a
side (its cells grow on a larger paper) and at most `MAX_SAMPLES` points are laid on it; at most
`MAX_TITLES` titles and as many scale texts, the `MAX_PIECES` largest pieces and `MAX_VIEWS` views are
read on a sheet. What is past a bound is not read.
"""

import json
import math
import re
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
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

REFERENCE_MM = 841.0
"""The long side of the paper the sizes below are given for (A1)."""
CELL_MM = 2.0
"""The grid's cell on paper, in mm (larger on a paper past `MAX_GRID` cells a side)."""
GAP_MM = 8.0
"""What is drawn closer than this on paper, in mm, is one piece."""
MAX_TITLE_WORDS = 12
"""A text of more words is a note, not a view title."""
TITLE_GAP = 20.0
"""The farthest a title lies under its drawing, in the title's heights (the real sets put a scale line
between them)."""
TITLE_GAP_UNDER = 6.0
"""The farthest a title lies over its drawing (a schedule's heading), in its heights."""
ROW_SHARE = 0.25
"""A drawing's detached row (its grid marks, its dimensions) is at most this share of its body's
height."""
MAX_TITLE_LINES = 3
"""The most lines a title holds under it (its second line, its scale line, its storeys)."""
SUBTITLE_GAP = 3.5
"""The farthest a title's second line lies under it, in the title's heights."""
TITLE_INSIDE = 3.0
"""The farthest a title lies inside its drawing's box from the box's lower or upper edge (a section's
ground line or a legend's rows running past its title), in its heights; weighed after every title
under or over a drawing."""
MAX_LETTER = 0.1
"""A text taller than this share of the paper's short side is no lettering: never a title, never the
median a title is measured by."""
MIN_DRAWING = 3.0
"""A piece less tall than this many of a title's heights is a band (its frame, a row of labels), never
the title's drawing; one meeting the title is part of its view."""
MIN_VIEW_MM = 10.0
"""A titled piece's longer side on paper is at least this, in mm."""
MIN_UNTITLED = 0.02
"""A piece with no title is a view when its box covers this share of the paper."""
JOIN_MM = 10.0
"""A small piece joins a view whose box, grown by this on paper, in mm, holds it."""
DIVIDER_SHARE = 0.6
"""A straight line along the paper's axes this share of the paper's side or longer is a border or a
divider between views (the real sets rule rows of details apart), never a view's drawing."""

RULE_MM = 1.0
"""Lines on one line within this on paper, in mm, are one ruled line (a title block's border drawn in
pieces), and a ruled line this near a title block's texts bounds it."""

CLUSTER_MM = 30.0
"""A frame's own text whose centre lies within this on paper, in mm (an A1's, scaled to the paper), of
the band the title block's values stand in, across or down, is one of its texts."""
MAX_BLOCK_SHARE = 0.4
"""A title block covering more of the paper than this is not read as one (no view is left out for it)."""
MAX_BLOCK_TEXTS = 2_000
"""The most frame texts weighed for a sheet's title block."""

MAX_VISITS = 8_000_000
MAX_SEGMENTS = 3_000_000
MAX_PIECES = 2_000
MAX_SCANS = 400_000_000
"""The walked items a file's sheets may weigh against a window together (each model-space sheet and
each viewport tests every line and text of model space once), so no number of viewports or frames
multiplies the walk past it."""
MAX_READS = 12_000_000
"""The lines a file's sheets may lay on paper together."""
MAX_TEXT_READS = 250_000
"""The texts a file's sheets may lay on paper together."""
MAX_SHEET_VIEWPORTS = 64
"""The most viewports of one layout read; the rest are counted in `_Walker.limits`."""
MAX_STACK = 64
"""The most texts weighed in one cell of the note-line index."""
MIN_NOTE_LINES = 3
"""A text in a column of this many lines alike (same height, same left edge) is a note's line."""
MAX_TEXTS = 200_000
MAX_GRID = 1_500
MAX_SAMPLES = 4_000_000
MAX_TITLES = 200
MAX_VIEWS = 200
MAX_RULES = 200_000
"""The most straight lines along one axis weighed for a sheet's title block."""

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
    "grid": ("grid",),
}
"""Steps 4 to 10 (the grid, then foundations to tanks) by a Structural view's subject (the subject
words make a lintel a beam over an opening and a sunshade, or chajja, a cantilever slab)."""
ARCHITECTURAL_STEPS = ("walls", "rooms")
"""Steps 11 and 12: walls and openings, rooms and finishes."""
STRUCTURE_SUBJECTS = frozenset({"column", "beam", "shear_wall"})
NOT_STRUCTURE_WORDS = frozenset({"lintel", "lintels"})
"""Beam words an Architectural plan names without drawing the structure: a lintel layout is the
architect's (`lintel_layout`), so it is never proposed out as the structural set's duplicate."""
"""What an architectural plan draws that the structural set governs."""
PLUMBING_SUBJECTS = frozenset({"fixture", "toilet"})
PLUMBING_PART = "plumbing"
"""The Plumbing and sanitary Part, by its Discipline's key."""
FLOOR_TO_FLOOR = frozenset({"column", "shear_wall"})
"""Subjects whose storeys run floor to floor (a column from the 1st to the 10th floor)."""

_HEADINGS = frozenset({ViewKind.NOTES, ViewKind.LEGEND, ViewKind.SCHEDULE})
"""Kinds whose title heads its content: the lines under it are the view's, not the title's."""
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
    text_origins: NDArray[np.float64] = field(default_factory=lambda: np.empty((0, 2)))


class _Walker:
    def __init__(self, artefact: ReadArtefact) -> None:
        self.artefact = artefact
        self.segmenter = _Segmenter(artefact, None, sheet_finder.default_conventions())
        self._model: _Drawn | None = None
        self.visits = MAX_VISITS
        self.segments = MAX_SEGMENTS
        self.texts = MAX_TEXTS
        self.scans = MAX_SCANS
        self.reads = MAX_READS
        self.text_reads = MAX_TEXT_READS
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
    frame: NDArray[np.float64] = field(default_factory=lambda: np.empty((0, 4)))
    """The frame's own segments on paper (left out of `segments`)."""
    block: list[_Text] = field(default_factory=list)
    """The title block's texts on paper: the frame's own and the values 13 read (no view's)."""
    values: frozenset[str] = frozenset()
    """The handles of the values 13 read (among `block`): where the title block is sought from."""


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
        for n, viewport in enumerate(drawn.viewports):
            if n >= MAX_SHEET_VIEWPORTS:
                walker.limits["viewports_capped"] += len(drawn.viewports) - n
                break
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
    frame_segments: list[NDArray[np.float64]] = []
    texts: list[_Text] = []
    block: list[_Text] = []
    kept: dict[int, NDArray[np.bool_]] = {}  # each space's frame test, once for all its viewports
    for drawn, to_paper, window, clip in parts:
        if id(drawn) not in kept:
            kept[id(drawn)] = keep_segments(drawn)
        keep = kept[id(drawn)]
        weighed = len(drawn.segments) + len(drawn.texts) if window is not None else 0
        if weighed > walker.scans:
            walker.limits["scan_budget"] += 1
            continue  # past the file's budget: this part is not read
        walker.scans -= weighed
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
        if taken > walker.reads or len(chosen_texts) > walker.text_reads:
            walker.limits["read_budget"] += 1
            continue
        walker.reads -= taken
        walker.text_reads -= len(chosen_texts)
        for mask, out in ((keep, segments), (framed, frame_segments)):
            chosen = drawn.segments[mask]
            if window is not None:
                chosen = _clip(chosen, window)
            moved = _move(chosen, to_paper)
            if clip is not None:
                moved = _clip(moved, clip)
            out.append(moved)
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


def _centre(box: Bounds) -> tuple[float, float]:
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def _segments_in(segments: NDArray[np.float64], box: Bounds) -> NDArray[np.bool_]:
    """The segments with both ends in the box."""
    x, y = segments[:, [0, 2]], segments[:, [1, 3]]
    inside = (x >= box[0]) & (x <= box[2]) & (y >= box[1]) & (y <= box[3])
    return np.asarray(inside.all(axis=1), dtype=np.bool_)


# The title block ---------------------------------------------------------------------------------------


def _title_block(paper: _Paper) -> Bounds | None:
    """The title block's extent on paper: the box the centres of its texts fill (the values 13 read, and
    the frame's own texts in their band within `CLUSTER_MM` of it, down or across, whichever holds
    more of them: a strip's or a corner box's; never a zone mark along the border nor a name in a
    far corner), grown on each side to the nearest ruled line across it (the frame's or the
    sheet's), else to the paper's edge. None when 13 read no value on its paper, or when the box
    would cover more than `MAX_BLOCK_SHARE` of the paper (no title block eats the sheet's drawings),
    then sought from the values alone (a real title block beside far frame notes or a separate
    revision table)."""
    rx0, ry0, rx1, ry1 = paper.region
    unit = max(rx1 - rx0, ry1 - ry0) / REFERENCE_MM
    on_paper = [t for t in paper.block if _inside(_centre(t.box), paper.region)]
    held = [t for t in on_paper if t.placed.entity.handle in paper.values]
    if not held:
        return None
    rest = [
        t
        for t in on_paper
        if t.placed.entity.handle not in paper.values
        and not all(_mark(w) for w in _tokens(t.shown))  # a zone mark ("7", "C") is the border's
    ][:MAX_BLOCK_TEXTS]
    vx0, vy0, vx1, vy1 = _bounds([t.box for t in held])
    gap = CLUSTER_MM * unit
    centres = [_centre(t.box) for t in rest]
    column = [t for t, c in zip(rest, centres, strict=True) if vx0 - gap <= c[0] <= vx1 + gap]
    row = [t for t, c in zip(rest, centres, strict=True) if vy0 - gap <= c[1] <= vy1 + gap]
    band = column if len(column) >= len(row) else row  # the strip's direction holds more of them
    return _ruled_box(paper, [*held, *band]) or _ruled_box(paper, held)  # far notes: its values alone


def _ruled_box(paper: _Paper, held: Sequence[_Text]) -> Bounds | None:
    """The box the texts' centres fill, grown on each side to the nearest ruled line across it, else
    to the paper's edge; none when it covers more than `MAX_BLOCK_SHARE` of the paper."""
    rx0, ry0, rx1, ry1 = paper.region
    unit = max(rx1 - rx0, ry1 - ry0) / REFERENCE_MM
    centres = [_centre(t.box) for t in held]
    ex0, ey0 = min(c[0] for c in centres), min(c[1] for c in centres)
    ex1, ey1 = max(c[0] for c in centres), max(c[1] for c in centres)
    tol = RULE_MM * unit
    lines = np.concatenate([paper.frame, paper.segments]) if len(paper.segments) else paper.frame
    across = _rules(lines, 0, tol)  # (y, x from, x to): lines along x
    down = _rules(lines, 1, tol)  # (x, y from, y to): lines along y
    spans_x = (across[:, 1] <= ex0 + tol) & (across[:, 2] >= ex1 - tol)
    spans_y = (down[:, 1] <= ey0 + tol) & (down[:, 2] >= ey1 - tol)
    top = across[spans_x & (across[:, 0] >= ey1 - tol), 0]
    bottom = across[spans_x & (across[:, 0] <= ey0 + tol), 0]
    left = down[spans_y & (down[:, 0] <= ex0 + tol), 0]
    right = down[spans_y & (down[:, 0] >= ex1 - tol), 0]
    box = (
        float(left.max()) if len(left) else rx0,
        float(bottom.max()) if len(bottom) else ry0,
        float(right.min()) if len(right) else rx1,
        float(top.min()) if len(top) else ry1,
    )
    if _area(box) > MAX_BLOCK_SHARE * (rx1 - rx0) * (ry1 - ry0):
        return None
    return box


def _bounds(boxes: Sequence[Bounds]) -> Bounds:
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def _rules(segments: NDArray[np.float64], axis: int, tol: float) -> NDArray[np.float64]:
    """The straight lines along one axis of the paper (0: x, 1: y), those on one line within `tol` of
    each other joined where they meet or nearly meet: (place across, from, to) rows."""
    a, b = segments[:, axis], segments[:, axis + 2]
    c, d = segments[:, 1 - axis], segments[:, 3 - axis]
    along = np.abs(b - a)
    straight = (along > 0) & (np.abs(d - c) <= 0.01 * along)
    rows = np.stack(
        [(c + d)[straight] / 2, np.minimum(a, b)[straight], np.maximum(a, b)[straight]], axis=1
    )
    rows = rows[np.lexsort((rows[:, 1], np.round(rows[:, 0] / tol)))][:MAX_RULES]
    out: list[list[float]] = []
    for place, lo, hi in rows.tolist():
        last = out[-1] if out else None
        if last is not None and abs(last[0] - place) <= tol and lo <= last[2] + tol:
            last[2] = max(last[2], hi)
        else:
            out.append([place, lo, hi])
    return np.array(out, dtype=np.float64).reshape(-1, 3)


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
    if not (0 < width < math.inf and 0 < height < math.inf):
        return []
    k = max(width, height) / REFERENCE_MM
    cell = max(CELL_MM * k, max(width, height) / MAX_GRID)
    nx, ny = int(width / cell) + 1, int(height / cell) + 1
    lines = _dividers_out(_clip(paper.segments, paper.region), width, height)
    words = _text_rows([texts[i].box for i in held], paper.region, cell, ny)
    segments = np.concatenate([lines, words]) if len(words) else lines
    flags = np.concatenate([np.zeros(len(lines), dtype=np.int8), np.ones(len(words), dtype=np.int8)])
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
        which = np.repeat(np.arange(len(segments), dtype=np.int32), counts)
        t = np.arange(total, dtype=np.float64)
        t -= np.repeat(np.cumsum(counts) - counts, counts)
        t /= np.maximum(counts - 1, 1)[which]
        for column, out in ((0, points_x), (1, points_y)):
            start = segments[:, column][which]
            start += t * (segments[:, column + 2] - segments[:, column])[which]
            out.append(start)
        kinds.append(flags[which])
        del which, t
    if not points_x:
        return []
    xs, ys, kind = np.concatenate(points_x), np.concatenate(points_y), np.concatenate(kinds)
    inside = (xs >= rx0) & (xs <= rx1) & (ys >= ry0) & (ys <= ry1)
    xs, ys, kind = xs[inside], ys[inside], kind[inside]
    cx = np.clip(((xs - rx0) / cell).astype(np.int64), 0, nx - 1)
    cy = np.clip(((ys - ry0) / cell).astype(np.int64), 0, ny - 1)
    grid = np.zeros((ny, nx), dtype=bool)
    grid[cy, cx] = True
    grown = _grow(grid, max(1, math.ceil(GAP_MM * k / 2 / cell)))
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


def _text_rows(
    boxes: Sequence[Bounds], region: Bounds, cell: float, rows_at_most: int
) -> NDArray[np.float64]:
    """Texts as rows of segments filling their boxes, clipped to the paper (a text a kilometre tall is
    as many rows as the grid has), at most `MAX_SAMPLES` rows in all."""
    found = np.array(boxes, dtype=np.float64).reshape(-1, 4)
    found = found[np.isfinite(found).all(axis=1)]
    x0 = np.maximum(found[:, 0], region[0])
    y0 = np.maximum(found[:, 1], region[1])
    x1 = np.minimum(found[:, 2], region[2])
    y1 = np.minimum(found[:, 3], region[3])
    keep = (x0 <= x1) & (y0 <= y1)
    x0, y0, x1, y1 = x0[keep], y0[keep], x1[keep], y1[keep]
    if not len(x0):
        return np.empty((0, 4))
    rows = np.minimum(np.ceil((y1 - y0) / cell).astype(np.int64) + 1, rows_at_most + 1)
    total = int(rows.sum())
    if total > MAX_SAMPLES:
        rows = np.maximum((rows * (MAX_SAMPLES / total)).astype(np.int64), 1)
        total = int(rows.sum())
    which = np.repeat(np.arange(len(x0)), rows)
    offsets = np.arange(total) - np.repeat(np.cumsum(rows) - rows, rows)
    y = y0[which] + (y1 - y0)[which] * offsets / np.maximum(rows - 1, 1)[which]
    return np.stack([x0[which], y, x1[which], y], axis=1)


def _dividers_out(segments: NDArray[np.float64], width: float, height: float) -> NDArray[np.float64]:
    """The segments without borders and dividers (`DIVIDER_SHARE`)."""
    if not len(segments):
        return segments
    dx = np.abs(segments[:, 2] - segments[:, 0])
    dy = np.abs(segments[:, 3] - segments[:, 1])
    across = (dx >= DIVIDER_SHARE * width) & (dy <= 0.01 * dx)
    down = (dy >= DIVIDER_SHARE * height) & (dx <= 0.01 * dy)
    return segments[~(across | down)]


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
    common: frozenset[str]  # the plan, floor and level words: no evidence of what a title names


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
        common=frozenset(
            t for w in (*sheet.plan_words, *sheet.floor_words, *sheet.level_words) for t in _tokens(w)
        ),
    )


def _kind(text: str, reading: _Reading) -> ViewKind | None:
    found = reading.kinds.matches(_tokens(text))
    if not found:
        return None
    return ViewKind(min((key for _, _, key in found), key=lambda k: reading.order[k]))


def _subject(text: str, reading: _Reading) -> str | None:
    found = reading.subjects.matches(_tokens(text))
    return found[0][2] if found else None


def _draws_structure(text: str, reading: _Reading) -> bool:
    """Whether the text's subject (its first subject words, as `_subject`) is one the structural set
    governs, named by a word other than a lintel's (`NOT_STRUCTURE_WORDS`): "BEAM LAYOUT PLAN" is,
    "LINTEL LAYOUT PLAN" is not, nor "STAIR AND BEAM PLAN" (its subject is the stair)."""
    tokens = _tokens(text)
    found = reading.subjects.matches(tokens)
    if not found:
        return False
    start, end, key = found[0]
    return key in STRUCTURE_SUBJECTS and " ".join(tokens[start:end]) not in NOT_STRUCTURE_WORDS


def _subjects_in_order(text: str, reading: _Reading) -> tuple[str, ...]:
    """Every subject the text names, each once, in the order they stand ("COLUMN & BEAM DETAILS")."""
    return tuple(dict.fromkeys(key for _, _, key in reading.subjects.matches(_tokens(text))))


@dataclass(frozen=True)
class Described:
    """What a title says, for 19b's continuations (#102): its kind, its layer, and its other words (not
    the kind's or layer's words, nor the plan, floor and level words, nor marks: a word with a digit,
    two letters or fewer, or a continued-sheet word), in normal form."""

    kind: ViewKind | None
    layer: Layer | None
    words: frozenset[str]


def describe(text: str, conventions: ViewConventions | None = None) -> Described:
    """A title's kind, layer and other words (`Described`)."""
    reading = _reading(conventions if conventions is not None else default_conventions())
    tokens = _tokens(text)
    spent: set[int] = set()
    for words in (reading.kinds, reading.layers):
        for start, end, _ in words.matches(tokens):
            spent.update(range(start, end))
    rest = frozenset(t for i, t in enumerate(tokens) if i not in spent and not _mark(t)) - reading.common
    return Described(_kind(text, reading), _layer(text, reading), rest)


CONTINUED = frozenset({"cont", "contd", "continued"})
"""The words that mark a continued sheet: no evidence of what it names (review 2 of 17)."""


def _mark(word: str) -> bool:
    """A mark, not a word naming something: it holds a digit ("B1", "1"), has two letters or fewer
    ("of", "a"), or says the sheet is continued."""
    return any(c.isdigit() for c in word) or len(word) <= 2 or word in CONTINUED


def subjects(text: str, conventions: ViewConventions | None = None) -> frozenset[str]:
    """Every subject a text names by the conventions' subject words (19b's continuations, #102)."""
    reading = _reading(conventions if conventions is not None else default_conventions())
    return frozenset(key for _, _, key in reading.subjects.matches(_tokens(text)))


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


class FoundViews(list[ViewCandidate]):
    """`find`'s result: the views, and `paper`, the paper's extent (width, height) in mm their boxes
    are on (the ruling of 14:20: a layout's paper, or a model-space frame's extent over its scale),
    none when the sheet's paper could not be read."""

    paper: tuple[float, float] | None = None
    limits: dict[str, int] | None = None
    """What the file's bounds have left unread so far (`LIMITS`, each given even at 0): the harness
    writes the last sheet's into the file's export as `view_report`, so a sheet a bound cut is never
    read as having no views without its reason."""


LIMITS = ("viewports_capped", "scan_budget", "read_budget")


def find(
    artefact: ReadArtefact, sheet: SheetCandidate, conventions: ViewConventions | None = None
) -> FoundViews:
    """The sheet's views, in reading order (the module's docstring)."""
    if not isinstance(sheet, SheetCandidate):
        raise TypeError(f"a sheet is a SheetCandidate, not {type(sheet).__name__}")
    held = conventions if conventions is not None else default_conventions()
    reading = _reading(held)
    paper = _paper(artefact, sheet)
    if paper is None:
        empty = FoundViews()
        empty.limits = _report(artefact)
        return empty
    fallback = _kind(sheet.title.value, reading) if sheet.title is not None else None
    block = _title_block(paper)
    found = _in_reading_order(_views(paper, reading, fallback or ViewKind.PLAN, block))
    if block is not None:
        found.append(_View(None, None, ViewKind.TITLE_BLOCK, block))
    discipline = sheet.discipline.value if sheet.discipline is not None else None
    on_sheet = _subjects_in_order(sheet.title.value, reading) if sheet.title is not None else ()
    result = FoundViews(_candidate(v, paper, reading, discipline, on_sheet) for v in found)
    result.paper = (paper.region[2], paper.region[3])
    result.limits = _report(artefact)
    return result


def _report(artefact: ReadArtefact) -> dict[str, int]:
    return {**dict.fromkeys(LIMITS, 0), **_walker(artefact).limits}


def _views(
    paper: _Paper, reading: _Reading, untitled: ViewKind, block: Bounds | None = None
) -> list[_View]:
    rx0, ry0, rx1, ry1 = paper.region
    letter = MAX_LETTER * min(rx1 - rx0, ry1 - ry0)  # taller is no lettering (a hostile height)
    heights = [t.height for t in paper.texts if 0 < t.height <= letter]
    tall = (
        median(heights) if heights else 0.0
    )  # the sheet's lettering, the title block's loose texts too
    if block is not None:  # what lies in the title block is its, never another view's
        edge = RULE_MM * max(rx1 - rx0, ry1 - ry0) / REFERENCE_MM
        held = _grown(block, edge)
        paper = replace(
            paper,
            texts=[t for t in paper.texts if not _inside(_centre(t.box), block)],
            segments=paper.segments[~_segments_in(paper.segments, held)],
        )
    texts = paper.texts
    titles: list[int] = []
    scale_texts: list[int] = []
    for i, t in enumerate(texts):
        if t.placed.shown.strip().count("\n") > 1:  # a title of two lines at most
            continue
        words = _tokens(t.shown)
        if (
            len(words) <= MAX_TITLE_WORDS
            and scales.read(t.shown, reading.patterns) is not None
            and _kind(t.shown, reading) is None
        ):
            if len(scale_texts) < MAX_TITLES:
                scale_texts.append(i)
            continue
        if (
            len(titles) < MAX_TITLES
            and 0 < len(words) <= MAX_TITLE_WORDS
            and tall <= t.height <= letter
            and not _ENUMERATED.match(t.shown)
            and _kind(t.shown, reading) is not None
        ):
            titles.append(i)
    stacks = _Stacks(texts, skip=frozenset(scale_texts))  # a title's scale line is no note's
    titles = [i for i in titles if stacks.lines(i) < MIN_NOTE_LINES]
    second: dict[int, list[int]] = {}  # a title's second lines
    for j in titles:
        head = next((i for i in titles if i != j and _subtitle(texts[j], texts[i])), None)
        if head is not None:
            second.setdefault(head, []).append(j)
    subtitles = {j for lines in second.values() for j in lines}
    titles = [i for i in titles if i not in subtitles]
    drawn_titles = [i for i in titles if _kind(texts[i].shown, reading) not in _HEADINGS]
    for ti, lines in _title_lines(texts, drawn_titles, subtitles | set(titles)).items():
        second.setdefault(ti, []).extend(lines)
    subtitles = {j for lines in second.values() for j in lines}
    off_grid = set(titles) | subtitles | set(scale_texts)
    underlined = _underlines(paper.segments, [texts[i] for i in titles])
    drawn = replace(paper, segments=paper.segments[~underlined])
    pieces = _pieces(drawn, texts, (i for i in range(len(texts)) if i not in off_grid))
    pieces = sorted(pieces, key=lambda q: -q.area)[:MAX_PIECES]
    paper_area = (rx1 - rx0) * (ry1 - ry0)
    unit = max(rx1 - rx0, ry1 - ry0) / REFERENCE_MM  # this paper's mm per an A1's

    pairs: list[tuple[float, int, int]] = []
    for ti in titles:
        t = texts[ti]
        x0, y0, x1, y1 = t.box
        h = max(t.height, 1e-9)
        for k, piece in enumerate(pieces):
            px0, py0, px1, py1 = piece.box
            if max(px1 - px0, py1 - py0) < MIN_VIEW_MM * unit or px0 > x1 or px1 < x0:
                continue
            if py1 - py0 < MIN_DRAWING * h:
                continue  # a band: the title's own frame or a row of labels, not its drawing
            below = (py0 - y1) / h  # the drawing above its title
            above = (y0 - py1) / h  # the drawing under its title
            if -0.5 <= below <= TITLE_GAP:
                pairs.append((below, ti, k))
            elif -0.5 <= above <= TITLE_GAP_UNDER:
                pairs.append((above + TITLE_GAP, ti, k))
            elif py0 <= y0 and y1 <= py1:  # its drawing runs past it, under or over
                depth = min(y0 - py0, py1 - y1) / h
                if depth <= TITLE_INSIDE:
                    pairs.append((TITLE_GAP + TITLE_GAP_UNDER + depth, ti, k))
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
        box = _union(titled.box, t.box)
        for j in second.get(ti, ()):
            box = _union(box, texts[j].box)
        for k, piece in enumerate(pieces):  # the title's bands: its frame, its underline's row
            band = piece.box[3] - piece.box[1] < MIN_DRAWING * t.height
            if k not in by_piece and band and _meets(piece.box, _grown(t.box, t.height)):
                by_piece[k] = ti
                box = _union(box, piece.box)
        views.append(_View(titled, t, kind, box))
    for view in views:  # a drawing's body over its detached row (its grid marks, its dimensions)
        assert view.piece is not None
        near = _grown(view.piece.box, JOIN_MM * unit)
        over = [
            k
            for k, piece in enumerate(pieces)
            if k not in by_piece
            and _row_under(view.piece.box, piece.box, JOIN_MM * unit)
            and _meets(piece.box, near)
        ]
        if over:
            k = max(over, key=lambda k: pieces[k].area)
            by_piece[k] = -1  # claimed by the titled view
            view.extra.append(pieces[k])
            view.box = _union(view.box, pieces[k].box)
    titled_boxes = [_grown(v.box, JOIN_MM * unit) for v in views]
    for k, piece in enumerate(pieces):
        if k in by_piece or any(_holds(box, piece.box) for box in titled_boxes):
            continue  # in a titled drawing's box, whatever its size, it is that drawing's (below)
        if piece.area >= MIN_UNTITLED * paper_area and len(views) < MAX_VIEWS:
            kind = ViewKind.NOTES if piece.words > piece.lines else untitled
            views.append(_View(piece, None, kind, piece.box))
    for k, piece in enumerate(pieces):
        if k in by_piece or any(v.piece is piece for v in views):
            continue
        holders = [v for v in views if _holds(_grown(v.box, JOIN_MM * unit), piece.box)]
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


def _title_lines(
    texts: Sequence[_Text], titles: Sequence[int], taken: Iterable[int]
) -> dict[int, list[int]]:
    """Each title's lines under it: up to `MAX_TITLE_LINES` one-line texts of at most `MAX_TITLE_WORDS`
    words, each under the one before within `SUBTITLE_GAP` of the title's height, across the same place,
    between half and one and a half of its height (its scale line, its storeys, its "PRESENTATION
    PLAN"), none another title's."""
    if not texts or not titles:
        return {}
    boxes = np.array([t.box for t in texts], dtype=np.float64)
    heights = np.array([t.height for t in texts], dtype=np.float64)
    free = np.array(
        ["\n" not in t.placed.shown.strip() and len(_tokens(t.shown)) <= MAX_TITLE_WORDS for t in texts],
        dtype=bool,
    )
    free[list(titles)] = False
    free[list(taken)] = False
    found: dict[int, list[int]] = {}
    for ti in titles:
        h = max(texts[ti].height, 1e-9)
        at = texts[ti].box
        for _ in range(MAX_TITLE_LINES):
            gap = (at[1] - boxes[:, 3]) / h
            near = (
                free
                & (gap >= -0.2)
                & (gap <= SUBTITLE_GAP)
                & (boxes[:, 0] <= at[2])
                & (boxes[:, 2] >= at[0])
                & (heights >= 0.5 * h)
                & (heights <= 1.5 * h)
            )
            if not near.any():
                break
            j = int(np.flatnonzero(near)[np.argmin(gap[near])])
            found.setdefault(ti, []).append(j)
            free[j] = False
            at = texts[j].box
    return found


def _row_under(row: Bounds, body: Bounds, by: float) -> bool:
    """Whether `row` is a drawing's detached row under its `body` (its grid marks, its dimensions): no
    taller than `ROW_SHARE` of the body, under its top, and across the body's width (grown by `by`)."""
    return (
        row[3] - row[1] <= ROW_SHARE * (body[3] - body[1])
        and body[3] > row[3]
        and body[0] - by <= row[0]
        and row[2] <= body[2] + by
    )


def _subtitle(lower: _Text, upper: _Text) -> bool:
    """A title's second line (a plan's "PRESENTATION PLAN" under its "GROUND FLOOR PLAN", a scale line
    between them): under the title within `SUBTITLE_GAP` of its height, and across the same place."""
    gap = (upper.box[1] - lower.box[3]) / max(upper.height, 1e-9)
    return 0 <= gap <= SUBTITLE_GAP and lower.box[0] <= upper.box[2] and upper.box[0] <= lower.box[2]


_ENUMERATED = re.compile(r"\s{0,4}\(?(?:\d{1,3}[.)]|[A-Za-z]\))\s")
"""A numbered line ("5. See ...", "(a) ..."): a note's, not a view title."""


class _Stacks:
    """Texts by their left edge, to tell a note's line (one of a column of lines alike) from a title."""

    def __init__(self, texts: Sequence[_Text], skip: frozenset[int] = frozenset()) -> None:
        self.texts = texts
        self.columns: dict[tuple[int, int], list[int]] = {}
        for i, t in enumerate(texts):
            if t.height > 0 and i not in skip:
                self.columns.setdefault(self._key(t.box[0], t.height), []).append(i)

    @staticmethod
    def _key(x: float, height: float) -> tuple[int, int]:
        step = max(round(math.log(height, 1.25)), -400)
        return step, math.floor(x / height)

    def _next(self, i: int, direction: int) -> int | None:
        t = self.texts[i]
        step, column = self._key(t.box[0], t.height)
        best: tuple[float, int] | None = None
        for s in (step - 1, step, step + 1):
            for c in (column - 1, column, column + 1):
                for j in self.columns.get((s, c), ())[:MAX_STACK]:
                    o = self.texts[j]
                    gap = (o.box[1] - t.box[1]) * direction / t.height
                    same = abs(o.height - t.height) <= 0.15 * t.height
                    near = j != i and same and abs(o.box[0] - t.box[0]) <= t.height
                    if near and 0.5 < gap < 2.5 and (best is None or gap < best[0]):
                        best = (gap, j)
        return None if best is None else best[1]

    def lines(self, i: int) -> int:
        """How many lines stand in the text's column, it among them (at most `MIN_NOTE_LINES`)."""
        count = 1
        for direction in (1, -1):
            at: int | None = i
            while count < MIN_NOTE_LINES and at is not None:
                at = self._next(at, direction)
                count += at is not None
        return count


def _underlines(segments: NDArray[np.float64], titles: Sequence[_Text]) -> NDArray[np.bool_]:
    """The segments that underline or box a title: both ends within its line's band."""
    found = np.zeros(len(segments), dtype=bool)
    for t in titles:
        x0, y0, x1, y1 = t.box
        h = t.height
        bx0, by0, bx1, by1 = x0 - h, y0 - 0.8 * h, x1 + h, y1 + 0.5 * h
        found |= (
            (segments[:, 0] >= bx0) & (segments[:, 2] >= bx0) & (segments[:, 0] <= bx1)
            & (segments[:, 2] <= bx1) & (segments[:, 1] >= by0) & (segments[:, 3] >= by0)
            & (segments[:, 1] <= by1) & (segments[:, 3] <= by1)
        )  # fmt: skip
    return found


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


def _candidate(
    view: _View,
    paper: _Paper,
    reading: _Reading,
    discipline: str | None,
    on_sheet: Sequence[str] = (),
) -> ViewCandidate:
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
    structure = title is not None and _draws_structure(title, reading)
    steps, part, exclusion = _proposal(view.kind, subject, discipline, on_sheet, structure=structure)
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
    kind: ViewKind,
    subject: str | None,
    discipline: str | None,
    on_sheet: Sequence[str] = (),
    *,
    structure: bool | None = None,
) -> tuple[tuple[str, ...], str | None, Exclusion | None]:
    """A view's proposed Takeoff Steps, Part or exclusion (the module's docstring); `on_sheet`: the
    subjects its sheet's title names, in order; `structure`: whether its title names the structure
    by a word not a lintel's (`_draws_structure`; by default, whether its subject is one)."""
    if structure is None:
        structure = subject in STRUCTURE_SUBJECTS
    if kind in _EXCLUDED_KINDS:
        return (), None, Exclusion(ExclusionReason.FOR_INFORMATION)
    if discipline is None:
        return (), None, None
    if discipline not in STEP_DISCIPLINES:
        return (), discipline, None
    if kind in (ViewKind.LEGEND, ViewKind.NOTES):
        return (GENERAL_NOTES,), None, None
    if discipline == "structural":
        own = STRUCTURAL_STEPS.get(subject or "", ())
        if own:
            return own, None, None
        steps = (step for key in on_sheet for step in STRUCTURAL_STEPS.get(key, ()))
        return tuple(dict.fromkeys(steps)), None, None
    if kind is ViewKind.PLAN and structure:
        return (), None, Exclusion(ExclusionReason.DUPLICATE)
    if subject in PLUMBING_SUBJECTS:
        return ARCHITECTURAL_STEPS, PLUMBING_PART, None
    return ARCHITECTURAL_STEPS, None, None


def kind_steps(
    kind: str, discipline: str | None, conventions: ViewConventions | None = None
) -> tuple[str, ...]:
    """The Takeoff Steps a Structural sheet's kind names by its subject words, in order
    (`beam_details`: beams; `column_schedule` and `shear_wall_details`: columns; `pile_cap_details`:
    foundations; `general_notes`: Step 2; `details` or `site_plan`: none): what Step 1 gives a view
    of that sheet whose own title and sheet's title name no subject, once the QS confirms the sheet
    as that kind (#158). No other Discipline's kind names a Step here."""
    if discipline != "structural":
        return ()
    if kind == GENERAL_NOTES:
        return (GENERAL_NOTES,)
    reading = _reading(conventions if conventions is not None else default_conventions())
    named = _subjects_in_order(kind.replace("_", " "), reading)
    return tuple(dict.fromkeys(step for key in named for step in STRUCTURAL_STEPS.get(key, ())))


def working_view(views: Sequence[ViewCandidate]) -> int | None:
    """The index of the sheet's working view: its first plan not proposed out, or none."""
    return next(
        (i for i, v in enumerate(views) if v.kind == ViewKind.PLAN and v.exclusion is None), None
    )
