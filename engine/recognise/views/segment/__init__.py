"""The drawing cut into Views (17; the segment part): a sheet on paper (`paper`) split into its views,
each with its title text, kind, box and stated scale, in reading order (`_views`, `_in_reading_order`);
its parts: `pieces` (the grid's pieces, tables, shared cuts, a plan's reach), `texts` (titles' lines,
notes' columns) and `block` (the title block).

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

At most `MAX_GRID` cells a side (its cells grow on a larger paper) and `MAX_SAMPLES` points are laid on
the grid; at most `MAX_TITLES` titles and as many scale texts, the `MAX_PIECES` largest pieces and
`MAX_VIEWS` views are read on a sheet. What is past a bound is not read.
"""

import math
from dataclasses import replace
from statistics import median

import numpy as np

from engine.recognise import scales
from engine.recognise.types import ViewKind
from engine.recognise.views.paper import (
    REFERENCE_MM,
    Bounds,
    _area,
    _bounds,
    _centre,
    _grown,
    _holds,
    _inside,
    _meets,
    _Paper,
    _segments_in,
    _union,
)
from engine.recognise.views.segment.block import RULE_MM
from engine.recognise.views.segment.pieces import (
    MIN_DRAWING,
    TABLE_TOLERANCE,
    _cut_shared,
    _off_paper,
    _pairs,
    _Piece,
    _pieces,
    _plans_reach,
    _tables,
    _View,
)
from engine.recognise.views.segment.texts import (
    _ENUMERATED,
    MAX_TITLE_WORDS,
    MIN_HEADING,
    MIN_NOTE_LINES,
    _beside,
    _column_under,
    _notes_heading,
    _Placing,
    _Stacks,
    _subtitle,
    _title_lines,
    _underlines,
)
from engine.recognise.views.titles import _kind, _named_kind, _Reading, _tokens

ROW_SHARE = 0.25
"""A drawing's detached row (its grid marks, its dimensions) is at most this share of its body's
height."""
MAX_LETTER = 0.1
"""A text taller than this share of the paper's short side is no lettering: never a title, never the
median a title is measured by."""
MIN_UNTITLED = 0.02
"""A piece with no title is a view when its box covers this share of the paper."""
JOIN_MM = 10.0
"""A small piece joins a view whose box, grown by this on paper, in mm, holds it."""
MAX_PIECES = 2_000
MAX_TITLES = 200
MAX_VIEWS = 200

_HEADINGS = frozenset({ViewKind.NOTES, ViewKind.LEGEND, ViewKind.SCHEDULE})
"""Kinds whose title heads its content: the lines under it are the view's, not the title's."""


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


def _row_under(row: Bounds, body: Bounds, by: float) -> bool:
    """Whether `row` is a drawing's detached row under its `body` (its grid marks, its dimensions): no
    taller than `ROW_SHARE` of the body, under its top, and across the body's width (grown by `by`)."""
    return (
        row[3] - row[1] <= ROW_SHARE * (body[3] - body[1])
        and body[3] > row[3]
        and body[0] - by <= row[0]
        and row[2] <= body[2] + by
    )


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
