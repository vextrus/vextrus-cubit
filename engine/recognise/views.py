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
axes of `DIVIDER_SHARE` of its side or longer (borders, dividers between rows of details). **A ruled
table** drawn with such rules (`_tables`: at least `MIN_TABLE_RULES` each way, every rule across
running between the outermost rules down and every rule down between the outermost across, within
`TABLE_TOLERANCE`) is one piece, what it holds with it, unless a drawing's title stands in it (a grid
of titled details, its rules dividing them); a table with no title is a schedule. Each title
takes the piece it lies under (a drawing titled beneath, the convention; within `TITLE_GAP` of its
height), else the piece it lies over (within `TITLE_GAP_UNDER`; a notes, legend or schedule heading
the other way round: its content stands under it), else, after all of those, the piece
whose box holds it within `TITLE_INSIDE` of its lower or upper edge (a section's ground line running
under and past its title), nearest first, one title a piece; a band less tall than `MIN_DRAWING` of its
height is never its drawing, and joins its view when it meets the title. **Section drawings one piece
holds** (a beam's long section and its cross sections, joined by their bar labels) are parted first: a
piece several section titles share (a title shares the piece whose box holds it, else its best drawing)
is cut along its widest band that at most `CUT_CROSSINGS` lines cross, down or across, at least
`SHARED_CUT_MM`, with titles on
both sides (a title in a band across is the drawing's over it), until each part holds one title, whose
drawing it is (`_cut_shared`); a piece another kind's title shares is left whole. A titled piece that
is a row under a larger piece without a title (no taller than `ROW_SHARE` of it, across its width, within
`JOIN_MM` of it) is that drawing's detached row of grid marks and dimensions, which is what the title
lies nearest: the view takes the body too. **A notes heading** (a text its kind's heading words lead,
`ViewConventions.heading_words`, written as a heading: the words alone or a colon after them,
"NOTES", "NOTE ON LAPS :"; never "NOTE 2", a callout) is a title whatever its length or lines (a block
of notes in one text) and down to `MIN_HEADING` of the tallest lettering, with its own `MAX_TITLES`,
unless a line like it stands over it in its column; one standing within a titled drawing is a view only
when it heads a block (`MIN_NOTE_LINES` lines with its own), else it is the drawing's annotation. It
heads the lines stacked under it, and what continues them in a column beside (`_beside`)
(`_column_under`: no taller than it, starting within `NOTE_INDENT` of its heights of its left edge,
each within `NOTE_LINE_GAP` of the line before, until a line taller than the one before it by
`NOTE_NEW_HEADING`, or a text taller than the heading or another title in its way; a scale-like line
among them is a note's), which are off the grid and its view's
box; one with no lines under it pairs as other titles do; one whose own
words run past `MAX_TITLE_WORDS` with no lines under it is a note of one line, its view its text. A
title's second lines, and up to `MAX_TITLE_LINES` one-line
texts standing under a drawing's title (its scale line, its storeys; not a notes, legend or schedule
heading's, whose lines are its content), are its: off the grid and in its view's box. A piece with no
title lying in a titled view's box (grown by `JOIN_MM`) is that view's, whatever its size; another is a
view when it covers `MIN_UNTITLED` of the paper (of the kind its sheet's title names, else a plan; notes
when text fills more of it than lines); a smaller one joins the view whose box, grown by `JOIN_MM`, holds
it. A view's box is its piece, its title and its scale text together; a plan's also takes its grid lines
to their ends and the marks set off it (`PLAN_MARK_MM`), never growing further into another view's box.
A long line running off a framed paper (`OFF_PAPER_SHARE`) is no view's. **Reading order** is by
rows, top to bottom (views whose heights overlap by half are one row), each left to right.

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
every view of a sheet whose Discipline is a notes one (`ViewConventions.notes_disciplines`, a Market's
General Discipline, #159) but its title block goes to Step 2, whatever its kind; title blocks, key
plans and 3D/perspective views are excluded `for_information`; a legend goes to Step
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
from collections.abc import Collection, Iterable, Mapping, Sequence
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
SHARED_CUT_MM = 4.0
"""The narrowest band (nearly) free of lines, on paper in mm, that parts the section drawings one
piece holds under their own titles (a beam's long section and its cross sections, joined by their bar
labels)."""
CUT_CROSSINGS = 1
"""The most lines crossing a band that still parts two drawings one piece holds (a leader, a base
line)."""
TALLER = 1.2
"""A title lettered this many times taller than the others a piece that cannot be cut shares is its
drawing's (a long section's title over its cross sections')."""
MAX_CUT_WEIGHS = 20_000_000
"""The most lines a sheet's cuts of shared pieces weigh together (each cut weighs its part's lines)."""
DIVIDER_SHARE = 0.6
"""A straight line along the paper's axes this share of the paper's side or longer is a border or a
divider between views (the real sets rule rows of details apart), never a view's drawing."""
MAX_REACH_LINES = 64
"""The most grid lines, the longest first, a plan's box is grown along per round."""
MAX_REACH_ROUNDS = 4
"""The most rounds of plans growing along their grid lines (a grown box meets more of them)."""
OFF_PAPER_SHARE = 0.5
"""A line running off a framed paper this share of its long side or longer is a construction line."""
PLAN_MARK_MM = 25.0
"""A plan's marks set off its drawing (a section's cut arrows, a grid bubble past its line's end) stand
within this of it on paper, in mm, and are no longer than this."""

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
MIN_HEADING = 0.01
"""A notes heading's least height, a share of the tallest lettering (`MAX_LETTER` of the paper)."""
NOTE_INDENT = 3.0
"""How far right of a notes heading's left edge, in its heights, a line under it may start (a numbered
line's hanging indent) and still be its."""
NOTE_LINE_GAP = 3.5
"""How far under the line before, in the taller one's heights, a notes heading's next line may stand (a
blank line between two notes)."""
NOTE_NEW_HEADING = 1.15
"""A line taller than this many of the line before's heights ends a notes heading's column."""
MAX_NOTE_LINES = 200
NOTE_SCAN = 4 * MAX_NOTE_LINES
"""At most this many texts, the highest first, are weighed for one notes heading's column."""
NOTE_BESIDE = 4
"""At most this many columns beside a notes block continue it."""
MIN_TABLE_RULES = 3
"""A table's fewest rules each way, dividers all (`_tables`)."""
MAX_TABLE_GROUPS = 400
"""At most this many rules across are tried as a table's (each weighs every rule)."""
TABLE_TOLERANCE = RULE_MM
"""How far, in an A1's mm (scaled to the paper), a table's rules may miss each other's ends: a table's
rules meet; a plan's grid lines run past each other to their marks."""
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
    lengths: NDArray[np.float64] | None = None
    """Each segment's length on paper before the paper's edge cut it (a viewport's own edge is no cut
    here), one per segment, filtered wherever `segments` is; its own length when none is given."""

    def __post_init__(self) -> None:
        if self.lengths is not None and len(self.lengths) != len(self.segments):
            raise ValueError("a paper's lengths are one per segment")


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
    layout = sheet.location.layout is not None
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
    table: bool = False  # a ruled table: its rules are dividers (`_tables`)

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


def _off_paper(
    segments: NDArray[np.float64], region: Bounds, lengths: NDArray[np.float64] | None = None
) -> NDArray[np.bool_]:
    """The long lines running off a framed paper (an end on its edge, cut at the frame, or past it, and
    `OFF_PAPER_SHARE` of its long side or longer as drawn, before the edge cut it): construction lines
    left in the drawing, never a view's. A shorter line drawn to the edge is still its drawing's."""
    x0, y0, x1, y1 = region
    long = max(x1 - x0, y1 - y0)
    tol = 1e-6 * long
    xs, ys = segments[:, 0::2], segments[:, 1::2]
    inside = ((xs > x0 + tol) & (xs < x1 - tol) & (ys > y0 + tol) & (ys < y1 - tol)).all(axis=1)
    length = np.hypot(segments[:, 2] - segments[:, 0], segments[:, 3] - segments[:, 1])
    if lengths is not None:
        if len(lengths) != len(segments):
            raise ValueError("the lengths are one per segment")
        length = np.maximum(length, lengths)
    return np.asarray(~inside & (length >= OFF_PAPER_SHARE * long))


def _tables(segments: NDArray[np.float64], region: Bounds) -> list[Bounds]:
    """Ruled tables drawn with dividers: at least `MIN_TABLE_RULES` dividers across and as many down
    (`DIVIDER_SHARE` of the paper's side or longer), every one across running from the leftmost one
    down to the rightmost and every one down from the lowest across to the highest, each end within
    `TABLE_TOLERANCE` (scaled to the paper); the box they rule, one per group of rules alike."""
    rx0, ry0, rx1, ry1 = region
    width, height = rx1 - rx0, ry1 - ry0
    if not len(segments) or not (width > 0 and height > 0):
        return []
    tol = TABLE_TOLERANCE * max(width, height) / REFERENCE_MM
    rule = RULE_MM * max(width, height) / REFERENCE_MM  # two rules nearer than this are one
    rows = _rules(segments, 0, rule)  # (y, x from, x to)
    columns = _rules(segments, 1, rule)  # (x, y from, y to)
    rows = rows[rows[:, 2] - rows[:, 1] >= DIVIDER_SHARE * width][:MAX_RULES]
    columns = columns[columns[:, 2] - columns[:, 1] >= DIVIDER_SHARE * height][:MAX_RULES]
    found: list[Bounds] = []
    for row in rows[:MAX_TABLE_GROUPS]:  # the rules across alike this one
        across = rows[(np.abs(rows[:, 1] - row[1]) <= tol) & (np.abs(rows[:, 2] - row[2]) <= tol)]
        if len(across) < MIN_TABLE_RULES:
            continue
        y0, y1 = float(across[:, 0].min()), float(across[:, 0].max())
        down = columns[
            (np.abs(columns[:, 1] - y0) <= tol)
            & (np.abs(columns[:, 2] - y1) <= tol)
            & (columns[:, 0] >= row[1] - tol)
            & (columns[:, 0] <= row[2] + tol)
        ]
        if len(down) < MIN_TABLE_RULES:
            continue
        x0, x1 = float(down[:, 0].min()), float(down[:, 0].max())
        if abs(x0 - row[1]) > tol or abs(x1 - row[2]) > tol:
            continue  # the rules across run past the table's sides, or stop short of them
        box = (x0, y0, x1, y1)
        if not any(_meets(box, other) for other in found):
            found.append(box)
    return found


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
    notes: frozenset[str] = frozenset()  # the Disciplines whose sheets are general notes
    headings: _Words = _Words(())  # words that make a text a heading of their kind when they lead it
    heading_tokens: frozenset[str] = frozenset()  # their words, one by one


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
        notes=frozenset(conventions.notes_disciplines),
        headings=_Words.of({str(k): v for k, v in conventions.heading_words.items()}),
        heading_tokens=frozenset(
            t for words in conventions.heading_words.values() for w in words for t in _tokens(w)
        ),
    )


def _heading(text: str, reading: _Reading) -> ViewKind | None:
    """The kind whose heading words lead the text, written as a heading's are: the heading words
    alone ("NOTES") or a colon after them ("NOTE ON LAPS :", "NOTE : ..."); else None ("NOTE 2" is a
    callout naming a note, "NOTE THE ..." a sentence)."""
    tokens = _tokens(text)
    found = reading.headings.matches(tokens)
    if not found or found[0][0] != 0:
        return None
    if ":" not in text and not all(w in reading.heading_tokens for w in tokens):
        return None
    return ViewKind(found[0][2])


def _notes_heading(t: _Text, reading: _Reading) -> bool:
    """Whether the text heads notes: led by a notes heading word, and its first line a heading's
    ("NOTES", "NOTE ON LAPS :", "NOTE : ..."): the heading words alone, or a colon after the words
    that lead it; "NOTE 2" (a callout naming a note) and "NOTE THE ..." (a sentence) are none."""
    first = t.placed.shown.strip().split("\n", 1)[0]  # a block's first line is its heading
    return _heading(_plain(first), reading) is ViewKind.NOTES


def _kind(text: str, reading: _Reading) -> ViewKind | None:
    if (heading := _heading(text, reading)) is not None:
        return heading  # a heading's leading words name its kind, whatever words follow
    return _named_kind(text, reading)


def _named_kind(text: str, reading: _Reading) -> ViewKind | None:
    """The kind the text's kind words name (the first listed wins), heading words aside."""
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
        out = _segments_in(paper.segments, held)
        paper = replace(
            paper,
            texts=[t for t in paper.texts if not _inside(_centre(t.box), block)],
            segments=paper.segments[~out],
            lengths=None if paper.lengths is None else paper.lengths[~out],
        )
    texts = paper.texts
    titles: list[int] = []
    scale_texts: list[int] = []
    heads: set[int] = set()  # notes headings: titles whatever their height or length, own cap
    for i, t in enumerate(texts):
        if _notes_heading(t, reading) and MIN_HEADING * letter <= t.height <= letter:
            if len(heads) < MAX_TITLES:  # a block of notes in one text, too
                heads.add(i)
            continue
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
            and _named_kind(t.shown, reading) is not None  # a heading word alone is no title's
        ):
            titles.append(i)
    stacks = _Stacks(texts, skip=frozenset(scale_texts))  # a title's scale line is no note's
    every = _Stacks(texts) if heads else stacks  # a notes line over a heading, scale-like or not
    titles = [i for i in titles if stacks.lines(i) < MIN_NOTE_LINES]
    heads = {  # a notes heading heads its column: no line like it stands over it
        i for i in heads if stacks.lines(i) < MIN_NOTE_LINES or every.next(i, 1) is None
    }
    titles = sorted([*titles, *heads])
    second: dict[int, list[int]] = {}  # a title's second lines
    for j in titles:
        if j in heads:
            continue  # a notes heading is never another title's second line
        head = next((i for i in titles if i != j and _subtitle(texts[j], texts[i])), None)
        if head is not None:
            second.setdefault(head, []).append(j)
    subtitles = {j for lines in second.values() for j in lines}
    titles = [i for i in titles if i not in subtitles]
    taken = set(titles) | subtitles  # a scale-like line in a column is a note's ("RAMP AT 1:12")
    placed = _Placing.of(texts) if heads else None
    columns = {i: _column_under(texts, placed, i, taken) for i in heads if placed is not None}
    for i, lines in columns.items():  # a block continued in a column beside it
        lines += _beside(texts, placed, [i, *lines], taken | set(scale_texts)) if placed else []
    lone = {  # a note of one text, its words after its heading: a view of its own
        i
        for i in heads
        if not columns[i]
        and (len(_tokens(texts[i].shown)) > MAX_TITLE_WORDS or "\n" in texts[i].placed.shown.strip())
    }
    noted = {j for lines in columns.values() for j in lines}
    scale_texts = [i for i in scale_texts if i not in noted]
    drawn_titles = [i for i in titles if _kind(texts[i].shown, reading) not in _HEADINGS]
    for ti, lines in _title_lines(texts, drawn_titles, subtitles | set(titles) | noted).items():
        second.setdefault(ti, []).extend(lines)
    subtitles = {j for lines in second.values() for j in lines}
    off_grid = set(titles) | subtitles | set(scale_texts) | noted
    titles = [i for i in titles if not columns.get(i) and i not in lone]  # the rest pair with drawings
    underlined = _underlines(paper.segments, [texts[i] for i in titles])
    off = (  # a long line running off a framed sheet is no view's
        _off_paper(paper.segments, paper.region, paper.lengths)
        if len(paper.frame)
        else np.zeros(len(paper.segments), dtype=bool)
    )
    drawn = replace(paper, segments=paper.segments[~(underlined | off)], lengths=None)
    pieces = _pieces(drawn, texts, (i for i in range(len(texts)) if i not in off_grid))
    pieces = sorted(pieces, key=lambda q: -q.area)[:MAX_PIECES]
    paper_area = (rx1 - rx0) * (ry1 - ry0)
    unit = max(rx1 - rx0, ry1 - ry0) / REFERENCE_MM  # this paper's mm per an A1's

    inside = [  # any title but a schedule's own (a table's header row may hold it)
        i for i in {*titles, *heads} if _kind(texts[i].shown, reading) is not ViewKind.SCHEDULE
    ]
    for table in _tables(drawn.segments, paper.region):
        if any(_inside(_centre(texts[i].box), table) for i in inside):
            continue  # a grid of titled drawings or of notes: its rules divide them, no table
        reach = _grown(table, TABLE_TOLERANCE * unit)
        ruled = [p for p in pieces if _holds(reach, p.box)]
        pieces = [p for p in pieces if not _holds(reach, p.box)]
        cells = (sum(p.lines for p in ruled), sum(p.words for p in ruled))
        pieces.append(_Piece(table, *cells, table=True))
    grid_texts = [i for i in range(len(texts)) if i not in off_grid]
    pieces, cut = _cut_shared(drawn, texts, titles, grid_texts, pieces, reading, unit)
    headed = {i for i in titles if _kind(texts[i].shown, reading) in _HEADINGS}  # content under
    pairs = _pairs(texts, titles, pieces, unit, headed)
    by_title: dict[int, int] = dict(cut)
    by_piece: dict[int, int] = {k: ti for ti, k in cut.items()}
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
    drawings = [v.box for v in views if v.piece is not None]  # the titled drawings
    for head in sorted(heads):  # a notes heading over its column, or a note of one text
        if not (columns[head] or head in lone) or len(views) >= MAX_VIEWS:
            continue
        noting = (  # a block of notes: lines under it, or lines of its own
            len(columns[head]) >= MIN_NOTE_LINES - 1
            or texts[head].placed.shown.strip().count("\n") >= MIN_NOTE_LINES - 1
        )
        if not noting and any(_holds(d, texts[head].box) for d in drawings):
            continue  # a note within a drawing, no block of notes: the drawing's annotation
        box = _bounds([texts[head].box, *(texts[j].box for j in columns[head])])
        views.append(_View(None, texts[head], ViewKind.NOTES, box))
    titled_boxes = [_grown(v.box, JOIN_MM * unit) for v in views]
    for k, piece in enumerate(pieces):
        if k in by_piece or any(_holds(box, piece.box) for box in titled_boxes):
            continue  # in a titled drawing's box, whatever its size, it is that drawing's (below)
        if piece.area >= MIN_UNTITLED * paper_area and len(views) < MAX_VIEWS:
            if piece.table:
                kind = ViewKind.SCHEDULE  # a ruled table with no title
            else:
                kind = ViewKind.NOTES if piece.words > piece.lines else untitled
            views.append(_View(piece, None, kind, piece.box))
    for k, piece in enumerate(pieces):
        if k in by_piece or any(v.piece is piece for v in views):
            continue
        holders = [v for v in views if _holds(_grown(v.box, JOIN_MM * unit), piece.box)]
        if holders:
            smallest = min(holders, key=lambda v: _area(v.box))
            smallest.box = _union(smallest.box, piece.box)
    _plans_reach(views, pieces, drawn.segments, (rx1 - rx0, ry1 - ry0), unit, block)
    for si in scale_texts:
        s = texts[si]
        best: tuple[float, _View] | None = None
        for v in views:
            if v.title is None or v.piece is None:  # a notes heading's column has no scale line
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


def _pairs(
    texts: Sequence[_Text],
    titles: Iterable[int],
    pieces: Sequence[_Piece],
    unit: float,
    heads: Collection[int] = (),
) -> list[tuple[float, int, int]]:
    """Each title's candidate drawings, `(score, title, piece)`, best first: a piece it lies under (its
    gap in the title's heights), else one it lies over, else one whose box holds it near an edge; a
    heading (`heads`: a notes, legend or schedule title) takes the piece it lies over first, its
    content under it."""
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
            if ti in heads and -0.5 <= above <= TITLE_GAP_UNDER:
                pairs.append((above, ti, k))
            elif -0.5 <= below <= TITLE_GAP:
                pairs.append((below + (TITLE_GAP_UNDER if ti in heads else 0.0), ti, k))
            elif -0.5 <= above <= TITLE_GAP_UNDER:
                pairs.append((above + TITLE_GAP, ti, k))
            elif py0 <= y0 and y1 <= py1:  # its drawing runs past it, under or over
                depth = min(y0 - py0, py1 - y1) / h
                if depth <= TITLE_INSIDE:
                    pairs.append((TITLE_GAP + TITLE_GAP_UNDER + depth, ti, k))
    pairs.sort()
    return pairs


def _cut_shared(
    paper: _Paper,
    texts: Sequence[_Text],
    titles: Sequence[int],
    grid_texts: Sequence[int],
    pieces: list[_Piece],
    reading: _Reading,
    unit: float,
) -> tuple[list[_Piece], dict[int, int]]:
    """Pieces several section titles share, cut into their drawings: the pieces, and the title each
    part with one title is given (title -> piece).

    A title shares the smallest piece whose box holds its centre (a cross section's title standing
    inside its beam's piece), else the piece it is the best candidate for (`_pairs`). A piece two or
    more titles share, every one a section's, and no other kind's title may take (another kind's
    drawings are left to the pairs), is cut along the
    widest band at most `CUT_CROSSINGS` of its lines cross, down or across, at least `SHARED_CUT_MM`
    wide, that leaves titles on
    both sides (a title in a band across is the drawing's over it, the convention), and each part again
    while it holds several. A part's box is its lines and the texts on the grid whose centre falls in
    its share of the piece's box. A piece that cannot be cut is its tallest title's, lettered `TALLER`
    than the rest (the main drawing's title over its cross sections'), else the pairs decide."""
    pairs = _pairs(texts, titles, pieces, unit)
    others = {k for _, ti, k in pairs if _kind(texts[ti].shown, reading) is not ViewKind.SECTION}
    best: dict[int, int] = {}
    for ti in titles:
        centre = _centre(texts[ti].box)
        holders = [k for k, piece in enumerate(pieces) if _inside(centre, piece.box)]
        if holders:
            best[ti] = min(holders, key=lambda k: pieces[k].area)
    for _, ti, k in pairs:
        best.setdefault(ti, k)
    shared: dict[int, list[int]] = {}
    for ti, k in best.items():
        shared.setdefault(k, []).append(ti)
    shared = {
        k: held
        for k, held in shared.items()
        if len(held) > 1
        and k not in others  # a drawing another kind's title may take is left to the pairs
        and all(_kind(texts[ti].shown, reading) is ViewKind.SECTION for ti in held)
    }
    if not shared:
        return pieces, {}
    rx0, ry0, rx1, ry1 = paper.region
    lines = _dividers_out(_clip(paper.segments, paper.region), rx1 - rx0, ry1 - ry0)
    words = np.array([texts[i].box for i in grid_texts], dtype=np.float64).reshape(-1, 4)
    middles = np.stack([(words[:, 0] + words[:, 2]) / 2, (words[:, 1] + words[:, 3]) / 2], axis=1)
    width = SHARED_CUT_MM * unit
    budget = MAX_CUT_WEIGHS
    out = list(pieces)
    given: dict[int, int] = {}
    for k, held in shared.items():
        budget -= len(lines)  # finding the piece's lines weighs every line
        parts: list[tuple[NDArray[np.float64], Bounds, list[int]]] = []
        stack = [(lines[_segments_in(lines, pieces[k].box)], pieces[k].box, held)] if budget >= 0 else []
        while stack:
            part_lines, region, part_titles = stack.pop()
            budget -= len(part_lines)
            found = None
            if len(part_titles) > 1 and budget >= 0:
                found = _widest_cut(part_lines, [texts[ti].box for ti in part_titles], width)
            if found is None:
                parts.append((part_lines, region, part_titles))
                continue
            axis, at, (low, high) = found
            lower, upper = list(region), list(region)
            lower[axis + 2], upper[axis] = at, at
            under = part_lines[:, [axis, axis + 2]].mean(axis=1) < at  # a line across goes by its middle
            stack.append((part_lines[under], _bounds4(lower), [part_titles[i] for i in low]))
            stack.append((part_lines[~under], _bounds4(upper), [part_titles[i] for i in high]))
        parts = [part for part in parts if len(part[0])]
        if len(parts) < 2:  # one drawing: its title is the one lettered tallest, if one is
            heights = sorted((texts[ti].height, ti) for ti in held)
            if heights[-1][0] > TALLER * heights[-2][0]:
                given[heights[-1][1]] = k
            continue
        for n, (part_lines, region, part_titles) in enumerate(parts):
            box = _bounds4(
                [
                    float(part_lines[:, [0, 2]].min()),
                    float(part_lines[:, [1, 3]].min()),
                    float(part_lines[:, [0, 2]].max()),
                    float(part_lines[:, [1, 3]].max()),
                ]
            )
            inside = (
                (middles[:, 0] >= region[0]) & (middles[:, 0] < region[2])
                & (middles[:, 1] >= region[1]) & (middles[:, 1] < region[3])
                & (middles[:, 0] >= pieces[k].box[0]) & (middles[:, 0] <= pieces[k].box[2])
                & (middles[:, 1] >= pieces[k].box[1]) & (middles[:, 1] <= pieces[k].box[3])
            )  # fmt: skip
            if inside.any():
                w = words[inside]
                box = _union(box, _bounds4([w[:, 0].min(), w[:, 1].min(), w[:, 2].max(), w[:, 3].max()]))
            piece = _Piece(box, len(part_lines), int(inside.sum()))
            index = k if n == 0 else len(out)
            if n == 0:
                out[k] = piece
            else:
                out.append(piece)
            if len(part_titles) == 1:
                given[part_titles[0]] = index
    return out, given


def _widest_cut(
    lines: NDArray[np.float64], titles: Sequence[Bounds], width: float
) -> tuple[int, float, tuple[list[int], list[int]]] | None:
    """The widest band down (axis 0) or across (axis 1) that at most `CUT_CROSSINGS` of `lines` cross
    (a leader, a base line running on), at least `width` wide, with titles on both sides: `(axis, where
    the parts meet, (the titles below it, those above it))` as indices into `titles`, else None. A
    title's side is its centre's; in a band across, it is the drawing's over it (a title stands under
    its drawing)."""
    if len(lines) < 2 or len(titles) < 2:
        return None
    centres = np.array([_centre(t) for t in titles], dtype=np.float64)
    best: tuple[float, int, float] | None = None
    for axis in (0, 1):
        lo = np.minimum(lines[:, axis], lines[:, axis + 2])
        hi = np.maximum(lines[:, axis], lines[:, axis + 2])
        at = np.concatenate([hi, lo])
        step = np.concatenate([-np.ones(len(hi)), np.ones(len(lo))])  # ends before starts at a tie
        order = np.lexsort((step, at))
        at, count = at[order], np.cumsum(step[order])
        thin = count[:-1] <= CUT_CROSSINGS  # between one event and the next
        edges = np.flatnonzero(np.diff(np.concatenate([[0], thin.astype(np.int8), [0]])))
        first, stop = edges[::2], edges[1::2]
        inner = (first > 0) & (stop < len(at) - 1)  # a band at the lines' edge parts nothing
        start, end = at[first[inner]], at[stop[inner]]
        edge = (start + end) / 2 if axis == 0 else start  # a title in a band across is its drawing's
        low, high = centres[:, axis].min(), centres[:, axis].max()
        valid = (end - start >= width) & (low < edge) & (edge <= high)
        if valid.any():
            i = int(np.argmax(np.where(valid, end - start, -np.inf)))
            if best is None or end[i] - start[i] > best[0]:
                best = (float(end[i] - start[i]), axis, float((start[i] + end[i]) / 2))
    if best is None:
        return None
    _, axis, middle = best
    edge = middle if axis == 0 else middle - best[0] / 2
    below = [i for i in range(len(titles)) if centres[i, axis] < edge]
    return axis, middle, (below, [i for i in range(len(titles)) if centres[i, axis] >= edge])


def _bounds4(values: Sequence[float]) -> Bounds:
    return (float(values[0]), float(values[1]), float(values[2]), float(values[3]))


def _plans_reach(
    views: list[_View],
    pieces: Sequence[_Piece],
    lines: NDArray[np.float64],
    size: tuple[float, float],
    unit: float,
    block: Bounds | None = None,
) -> None:
    """A plan's box takes in what a draughtsman draws around its drawing and the grid splits off: its
    grid lines to their ends (lines long enough to be read as dividers, `DIVIDER_SHARE`, lying across
    its box, and not running off the paper) and every plan with no title two or more of them run into
    (its drawing cut apart where the grid was taken out; never notes or a legend beside it); then its
    marks set off it (`PLAN_MARK_MM`: a piece left in no view, no longer than that, within that of the
    plan's box and beside it, across its span, and nearer it than any other view). Nothing grows
    further into a titled view's box or the title block's, nor into an untitled one but by taking it
    whole."""
    width, height = size
    tol = 1e-6 * max(width, height)
    xs, ys = lines[:, 0::2], lines[:, 1::2]
    on = ((xs > tol) & (xs < width - tol) & (ys > tol) & (ys < height - tol)).all(axis=1)
    lines = lines[on]  # a line running off the paper is no grid's
    dx = np.abs(lines[:, 2] - lines[:, 0])
    dy = np.abs(lines[:, 3] - lines[:, 1])
    across = lines[(dx >= DIVIDER_SHARE * width) & (dy <= 0.01 * dx)]
    down = lines[(dy >= DIVIDER_SHARE * height) & (dx <= 0.01 * dy)]

    def grow(view: _View, box: Bounds, grid: Sequence[Bounds] = ()) -> bool:
        taken = [
            v
            for v in views
            if v is not view
            and v.title is None
            and v.kind is ViewKind.PLAN
            and _overlap(box, v.box) > _overlap(view.box, v.box)
            and sum(_meets(g, v.box) for g in grid) >= 2  # a grid runs into it, not a stray line
        ]
        for v in taken:
            box = _union(box, v.box)
        others = [v.box for v in views if v is not view and not any(v is t for t in taken)]
        others += [block] if block is not None else []  # the title block is no view's
        if box == view.box or any(_overlap(box, o) > _overlap(view.box, o) for o in others):
            return False
        view.box = box
        for v in taken:
            views.remove(v)
        return True

    # a line along x as (at, lo, hi, x?): where it stands across, and its ends along
    ruled = np.concatenate(
        [
            np.stack([across[:, 1], across[:, [0, 2]].min(1), across[:, [0, 2]].max(1)], axis=1),
            np.stack([down[:, 0], down[:, [1, 3]].min(1), down[:, [1, 3]].max(1)], axis=1),
        ]
    )
    along_x = np.arange(len(ruled)) < len(across)
    for _ in range(MAX_REACH_ROUNDS):  # a round that grows no box ends it
        grown = False
        for view in list(views):
            if view.kind is not ViewKind.PLAN or not any(view is v for v in views):
                continue
            x0, y0, x1, y1 = view.box
            lo_at = np.where(along_x, y0, x0)
            hi_at = np.where(along_x, y1, x1)
            lo_box = np.where(along_x, x0, y0)
            hi_box = np.where(along_x, x1, y1)
            at, lo, hi = ruled[:, 0], ruled[:, 1], ruled[:, 2]
            crossing = (lo_at <= at) & (at <= hi_at) & (lo <= hi_box) & (lo_box <= hi)
            reaching = np.flatnonzero(crossing & ((lo < lo_box) | (hi > hi_box)))
            reaching = reaching[np.argsort(lo[reaching] - hi[reaching], kind="stable")]
            grid: list[Bounds] = []
            for k in reaching[:MAX_REACH_LINES].tolist():
                at_k, lo_k, hi_k = (float(v) for v in ruled[k])
                grid.append((lo_k, at_k, hi_k, at_k) if along_x[k] else (at_k, lo_k, at_k, hi_k))
            for line in grid:
                grown |= grow(view, _union(view.box, line), grid)
        if not grown:
            break
    reach = PLAN_MARK_MM * unit
    for piece in pieces:
        b = piece.box
        if max(b[2] - b[0], b[3] - b[1]) > reach or any(_holds(v.box, b) for v in views):
            continue
        near = min(views, key=lambda v: _gap(v.box, b), default=None)
        if near is None or near.kind is not ViewKind.PLAN or _gap(near.box, b) > reach:
            continue
        x0, y0, x1, y1 = near.box
        beside = (y0 <= b[1] and b[3] <= y1) or (x0 <= b[0] and b[2] <= x1)
        if beside:
            grow(near, _union(near.box, b))


def _overlap(a: Bounds, b: Bounds) -> float:
    return max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))


def _gap(a: Bounds, b: Bounds) -> float:
    """How far apart two boxes are (0 when they meet)."""
    return math.hypot(max(0.0, a[0] - b[2], b[0] - a[2]), max(0.0, a[1] - b[3], b[1] - a[3]))


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

    def next(self, i: int, direction: int) -> int | None:
        """The line like it standing next over it (`direction` 1) or under it (-1), if any."""
        return self._next(i, direction)

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


@dataclass(frozen=True)
class _Placing:
    """Every text's box and height as arrays, built once for all notes headings."""

    boxes: NDArray[np.float64]
    heights: NDArray[np.float64]

    @classmethod
    def of(cls, texts: Sequence[_Text]) -> _Placing:
        boxes = np.array([t.box for t in texts], dtype=np.float64).reshape(-1, 4)
        return cls(boxes, np.array([t.height for t in texts], dtype=np.float64))


def _column_under(
    texts: Sequence[_Text], placed: _Placing, head: int, taken: Collection[int]
) -> list[int]:
    """A notes heading's lines: the texts no taller than it stacked under it, top to bottom, each
    starting at most `NOTE_INDENT` of its heights right of its left edge (or a height left of it) and
    standing at most `NOTE_LINE_GAP` of the taller one's heights under the line before. The column
    ends at a text in its way that is taller than the heading or taken (another title, a title's
    second line: what stands under the notes is another view's), and at `MAX_NOTE_LINES`; at most
    `NOTE_SCAN` texts are weighed."""
    t = texts[head]
    h = t.height
    if not h > 0 or not len(placed.boxes):
        return []
    boxes, heights = placed.boxes, placed.heights
    near = (
        (boxes[:, 0] >= t.box[0] - h)
        & (boxes[:, 0] <= t.box[0] + NOTE_INDENT * h)
        & (boxes[:, 3] <= t.box[1] + 0.2 * h)
    )
    near[head] = False
    found = np.flatnonzero(near)
    if len(found) > NOTE_SCAN:  # the highest first: a column is read from its top
        found = found[np.argpartition(-boxes[found, 3], NOTE_SCAN - 1)[:NOTE_SCAN]]
    order = found[np.argsort(-boxes[found, 3], kind="stable")].tolist()
    lines: list[int] = []
    at = t
    for j in order:
        o = texts[j]
        gap = (at.box[1] - o.box[3]) / max(at.height, o.height, 1e-9)
        if gap > NOTE_LINE_GAP or len(lines) >= MAX_NOTE_LINES:
            break
        if gap < -0.2:
            continue  # beside the line before, not under it
        if j in taken or not 0 < heights[j] <= 1.05 * h:
            break  # another view's title, or lettering taller than the notes: their column ends
        if lines and o.height > NOTE_NEW_HEADING * at.height:
            break  # a line taller than the one before heads the next block
        lines.append(j)
        at = o
    return lines


def _beside(
    texts: Sequence[_Text], placed: _Placing, members: Sequence[int], taken: Collection[int]
) -> list[int]:
    """Texts continuing a notes block in a column beside it: no taller than its heading, the top of
    each level with the block's top (within half the heading's height: a dimension or a label set
    lower is a drawing's) and its left edge at most `NOTE_INDENT` of the heading's heights right of
    the block's right edge; the block grows by each, for at most `NOTE_BESIDE` columns and
    `MAX_NOTE_LINES` texts. None taken (titles, their second lines, scale lines)."""
    h = texts[members[0]].height
    if not h > 0:
        return []
    box = _bounds([texts[j].box for j in members])
    boxes, heights = placed.boxes, placed.heights
    free = (heights > 0) & (heights <= 1.05 * h)
    free[list(members)] = False
    if taken:
        free[list(taken)] = False
    found: list[int] = []
    for _ in range(NOTE_BESIDE):
        near = (
            free
            & (boxes[:, 0] > box[2] - 0.5 * h)
            & (boxes[:, 0] <= box[2] + NOTE_INDENT * h)
            & (np.abs(boxes[:, 3] - box[3]) <= 0.5 * h)
        )
        more = np.flatnonzero(near)[: MAX_NOTE_LINES - len(found)].tolist()
        if not more:
            break
        free[more] = False
        found += more
        box = _bounds([box, *(texts[j].box for j in more)])
    return found


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
    steps, part, exclusion = _proposal(
        view.kind, subject, discipline, on_sheet, notes=reading.notes, structure=structure
    )
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
    notes: Collection[str] = (),
    structure: bool | None = None,
) -> tuple[tuple[str, ...], str | None, Exclusion | None]:
    """A view's proposed Takeoff Steps, Part or exclusion (the module's docstring); `on_sheet`: the
    subjects its sheet's title names, in order; `notes`: the Disciplines whose sheets are general notes
    (`ViewConventions.notes_disciplines`): every view of theirs is Step 2's, whatever its kind, but its
    title block (never a note: #159's acceptance); `structure`: whether its title names the structure
    by a word not a lintel's (`_draws_structure`; by default, whether its subject is one)."""
    if discipline is not None and discipline in notes and kind is not ViewKind.TITLE_BLOCK:
        return (GENERAL_NOTES,), None, None
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
