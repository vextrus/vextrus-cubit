"""A sheet's drawing in pieces (17): what is drawn closer than `GAP_MM` on a grid over its paper, the
ruled tables, the pieces several section titles share cut apart, each title's candidate drawings, and a
plan's reach along its grid lines (the segment part's docstring, "How views are found")."""

import math
from collections.abc import Collection, Iterable, Sequence
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from engine.recognise import scales
from engine.recognise.types import ViewKind
from engine.recognise.views.paper import (
    REFERENCE_MM,
    Bounds,
    _bounds4,
    _centre,
    _clip,
    _gap,
    _holds,
    _inside,
    _meets,
    _overlap,
    _Paper,
    _segments_in,
    _Text,
    _union,
)
from engine.recognise.views.segment.block import MAX_RULES, RULE_MM, _rules
from engine.recognise.views.titles import _kind, _Reading

CELL_MM = 2.0
"""The grid's cell on paper, in mm (larger on a paper past `MAX_GRID` cells a side)."""
GAP_MM = 8.0
"""What is drawn closer than this on paper, in mm, is one piece."""
TITLE_GAP = 20.0
"""The farthest a title lies under its drawing, in the title's heights (the real sets put a scale line
between them)."""
TITLE_GAP_UNDER = 6.0
"""The farthest a title lies over its drawing (a schedule's heading), in its heights."""
TITLE_INSIDE = 3.0
"""The farthest a title lies inside its drawing's box from the box's lower or upper edge (a section's
ground line or a legend's rows running past its title), in its heights; weighed after every title
under or over a drawing."""
MIN_DRAWING = 3.0
"""A piece less tall than this many of a title's heights is a band (its frame, a row of labels), never
the title's drawing; one meeting the title is part of its view."""
MIN_VIEW_MM = 10.0
"""A titled piece's longer side on paper is at least this, in mm."""
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
MIN_TABLE_RULES = 3
"""A table's fewest rules each way, dividers all (`_tables`)."""
MAX_TABLE_GROUPS = 400
"""At most this many rules across are tried as a table's (each weighs every rule)."""
TABLE_TOLERANCE = RULE_MM
"""How far, in an A1's mm (scaled to the paper), a table's rules may miss each other's ends: a table's
rules meet; a plan's grid lines run past each other to their marks."""
MAX_GRID = 1_500
MAX_SAMPLES = 4_000_000


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


@dataclass
class _View:
    piece: _Piece | None
    title: _Text | None
    kind: ViewKind
    box: Bounds
    scale: scales.Scale | None = None
    extra: list[_Piece] = field(default_factory=list)


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


# Drawings several titles share -------------------------------------------------------------------------


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


# A plan's reach ----------------------------------------------------------------------------------------


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
