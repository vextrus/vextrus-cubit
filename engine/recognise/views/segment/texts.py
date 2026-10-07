"""A sheet's texts in their places (17): a notes heading, a title's lines under it, a note's line in
its column, a notes heading's column and what continues it beside, and a title's underline (the segment
part's docstring, "How views are found")."""

import math
import re
from collections.abc import Collection, Iterable, Sequence
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from engine.recognise.sheets import _plain
from engine.recognise.types import ViewKind
from engine.recognise.views.paper import _bounds, _Text
from engine.recognise.views.titles import _heading, _Reading, _tokens

MAX_TITLE_WORDS = 12
"""A text of more words is a note, not a view title."""
MAX_TITLE_LINES = 3
"""The most lines a title holds under it (its second line, its scale line, its storeys)."""
SUBTITLE_GAP = 3.5
"""The farthest a title's second line lies under it, in the title's heights."""
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


def _notes_heading(t: _Text, reading: _Reading) -> bool:
    """Whether the text heads notes: led by a notes heading word, and its first line a heading's
    ("NOTES", "NOTE ON LAPS :", "NOTE : ..."): the heading words alone, or a colon after the words
    that lead it; "NOTE 2" (a callout naming a note) and "NOTE THE ..." (a sentence) are none."""
    first = t.placed.shown.strip().split("\n", 1)[0]  # a block's first line is its heading
    return _heading(_plain(first), reading) is ViewKind.NOTES


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
