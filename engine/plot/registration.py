"""Registering the consultant's Plot: each PDF page matched to the sheet it plots, and placed on it.

    match(pages, sheets, geometry, plots) -> list[PlotMatch]     # the harness's `plot` stage

`pages` are 12's (`engine.read.pdf.page_text`), every PDF's of the set; `sheets` are 13's; `geometry[i]`
is `sheets[i]`'s render buffers (11's `buffers.build`), or none where they were not built: the sheet's
paper and where it draws each text. Every page gets one `PlotMatch`, in the order given: the sheet it
plots with the transform that places the sheet on it, or the key of why it matched none
(`engine/messages/plot.py`).

**Which sheet** (m0-screens 6.13, "No Plot, and why"): a page names a sheet by its number, found in
the page's text, the title block's and the body's alike (the review Q4: Edison's title blocks are
strokes, and their pages are matched by the text on the page). Text and numbers are compared in 13's
normal form (`engine.recognise.conflicts.normal`). A text item that is the number, whole, names it more
surely than one that holds it among other words ("SEE S-102"); between two of a kind the larger text
does (a title block's number is its largest text). A page of a PDF whose file has a Discipline default
names that Discipline's sheets first: a number of another Discipline's sheet on it (a cross-reference,
or a number two Disciplines share) is set aside when one of its own is there. A page whose surest
number is two sheets' numbers equally, or whose number several sheets carry and whose size cannot
tell them apart, names several (`names_several_sheets`); one naming none says so (`names_no_sheet`);
a scan (`scan`) is not searched.

**By its ink** (157: a Plot whose lettering is all strokes). A page with no text at all, and one that
names several sheets alike, is matched by its drawing where its PDF is given (`by_ink`): each
candidate (the sheets it names alike; for a page with no text, every sheet on its paper, when every
sheet of the set was drawn) is placed and aligned by ink, and the one whose ink agrees clearly best
is taken; a page whose ink names no one sheet (a frame and title block alone, which every sheet
draws alike) keeps its reason (`names_several_sheets`, `no_text`).

**Where** (`PlotTransform`: sheet to page, a scale, a turn in 90° steps, then an offset in page units,
points; the sheet in its paper millimetres, as the buffers draw it). From the sizes first: the sheet is
turned when the page's orientation (landscape or portrait) differs from its paper's; it is plotted at
1:1 (72/25.4 points a millimetre) when its paper fits the page so, else fitted to the page; and it is
centred on the page. Then from the text both carry: each of the sheet's value texts (its anchors after
the frame: number, title, revision and date, where the buffers draw them) is paired with each page
item that reads one of those values; each pair says where the sheet's origin lands, and a place that
at least `MIN_PAIRS` pairs agree on, within `AGREE_MM` on paper, is taken, at each of the four turns
(the one most pairs agree on wins). **The residual** is how far those pairs lie from the place taken,
root mean square, in millimetres on paper; none when fewer than two pairs agree, since then nothing
measured the fit (the sizes alone place the sheet).

Nothing here reads a file: pages, sheets and buffers are values already read in their sandboxes.
"""

import math
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from engine.messages import plot as codes
from engine.plot import ink
from engine.read.anchor import DwgAnchor
from engine.read.pdf.types import Page, TextItem
from engine.recognise.conflicts import normal
from engine.recognise.types import PlotMatch, PlotTransform, SheetCandidate
from engine.render.buffers import Paper, SheetBuffers

PT_PER_MM = 72 / 25.4
"""A PDF point is 1/72 inch: a sheet plotted at 1:1 is this many points a paper millimetre."""
FITS = 1.01
"""A paper fits a page at 1:1 when it is no more than 1 % larger on either side (a plot's rounding)."""
AGREE_MM = 2.0
"""Text pairs agree on where the sheet lands when they are within 2 mm on paper: a plotted text's box
and the renderer's differ by their fonts' margins, a millimetre or so at a title block's sizes."""
MIN_PAIRS = 2
MIN_SIDE = 1.0
"""The shortest side, in points or millimetres, a page or a paper needs to be placed by."""
MAX_DRAWN = 64
MAX_PRINTED = 256
"""The most value texts and page items paired (a page's revision table may repeat a date many times):
the pairs are weighed against each other, so their count is bounded before it is squared."""
TURNS = (0, 90, 180, 270)
MAX_BY_INK = 32
"""The most sheets a page is tried against by ink: each is drawn and aligned (a second or so), so a
textless page of a large set with every sheet on its paper is left unmatched rather than tried 200
times."""
MAX_INK_TRIES = 128
"""The most sheets drawn and aligned by ink in one match, over all its pages (a few minutes): a PDF of
hundreds of pages with no text is hostile input as much as a Plot, and the rest of its pages keep
their reasons once this is spent."""
MIN_INK_F1 = 0.6
INK_MARGIN = 0.1
"""A sheet is a page's by its ink when their inks agree (F1, `ink.agreement`) at least 0.6 and by 0.1
more than the next sheet's: a frame and title block alone, which every sheet of a set draws alike,
agree with each about as well, and so name none."""
_WORDS = re.compile(r"[\s:;,()\[\]]+")
_MIN_TITLE_PART = 4
"""The fewest characters a page item needs to be taken as part of a sheet's title (one of its lines)."""


def match(
    pages: Sequence[Page],
    sheets: Sequence[SheetCandidate],
    geometry: Sequence[SheetBuffers | None] = (),
    plots: Mapping[str, Path] | None = None,
    disciplines: Mapping[str, str | None] | None = None,
) -> list[PlotMatch]:
    """Every page's match, in the order given (the module's rules). `plots` names each PDF's path by
    its contents' sha256, for the ink's placement; without its page's, a page is placed by its text
    and sizes alone. `disciplines` names each PDF's Discipline default by the same key, where it has
    one."""
    by_number: dict[str, list[int]] = {}
    for i, sheet in enumerate(sheets):
        key = normal(sheet.number.value) if sheet.number is not None else None
        if key is not None:
            by_number.setdefault(key, []).append(i)
    found = []
    budget = [MAX_INK_TRIES]
    for page in pages:
        if page.scan:
            found.append(PlotMatch(page, reason=_reason(codes.SCAN)))
            continue
        plot = (plots or {}).get(page.source_sha256)
        if not page.items:
            # Every sheet on the page's paper is a candidate; a sheet never drawn has no known paper
            # and cannot be ruled out, so with one such the page is not guessed at.
            drawn = [_buffers(geometry, i) for i in range(len(sheets))]
            known = all(b is not None for b in drawn)
            fitting = [i for i, b in enumerate(drawn) if known and _fits_size(page, b)]
            inked = by_ink(
                page,
                [sheets[i] for i in fitting],
                [_buffers(geometry, i) for i in fitting],
                plot,
                budget,
            )
            if inked is None:
                found.append(PlotMatch(page, reason=_reason(codes.NO_TEXT)))
            else:
                k, transform, residual = inked
                found.append(
                    PlotMatch(page, sheet=sheets[fitting[k]], transform=transform, residual=residual)
                )
            continue
        discipline = (disciplines or {}).get(page.source_sha256)
        chosen = _sheet_named(page, sheets, by_number, geometry, discipline)
        if isinstance(chosen, list):  # several sheets named alike: their ink may tell them apart
            inked = by_ink(
                page,
                [sheets[i] for i in chosen],
                [_buffers(geometry, i) for i in chosen],
                plot,
                budget,
            )
            if inked is None:
                found.append(PlotMatch(page, reason=_reason(codes.NAMES_SEVERAL_SHEETS)))
            else:
                k, transform, residual = inked
                found.append(
                    PlotMatch(page, sheet=sheets[chosen[k]], transform=transform, residual=residual)
                )
            continue
        if isinstance(chosen, str):
            found.append(PlotMatch(page, reason=chosen))
            continue
        sheet = sheets[chosen]
        buffers = geometry[chosen] if chosen < len(geometry) else None
        if buffers is None:
            found.append(PlotMatch(page, sheet=sheet))
            continue
        placed = place(page, sheet, buffers)
        if placed is None:
            found.append(PlotMatch(page, sheet=sheet))
            continue
        transform, residual = placed
        if plot is not None:
            transform, residual = ink.align(page, buffers, transform, plot)
        found.append(PlotMatch(page, sheet=sheet, transform=transform, residual=residual))
    return found


def _reason(code: object) -> str:
    return str(getattr(code, "code", "")).rsplit(".", 1)[1]


# Which sheet -----------------------------------------------------------------------------------------


def _sheet_named(
    page: Page,
    sheets: Sequence[SheetCandidate],
    by_number: dict[str, list[int]],
    geometry: Sequence[SheetBuffers | None],
    discipline: str | None = None,
) -> int | str | list[int]:
    """The index of the sheet the page names; the indices of the sheets it names alike, none more
    surely (`names_several_sheets` unless their ink tells them apart); or the key of why none."""

    def ours(i: int) -> bool:
        d = sheets[i].discipline
        return discipline is not None and d is not None and d.value == discipline

    best: dict[str, tuple[bool, float]] = {}  # number -> (whole, height) of its surest mention
    for item in page.items:
        text = normal(item.text)
        if text is None:
            continue
        height = _height(item)
        mentions = [(text, True)] if text in by_number else []
        mentions += [(w, False) for w in _WORDS.split(text) if w != text and w in by_number]
        for number, whole in mentions:
            if (whole, height) > best.get(number, (False, -1.0)):
                best[number] = (whole, height)
    if not best:
        return _reason(codes.NAMES_NO_SHEET)
    # A Discipline's PDF plots that Discipline's sheets: where some number the page names is one of
    # them, the others' numbers (a cross-reference, another Discipline's sheet) are set aside.
    if any(ours(i) for n in best for i in by_number[n]):
        best = {n: v for n, v in best.items() if any(ours(i) for i in by_number[n])}
    ranked = sorted(best.items(), key=lambda kv: kv[1], reverse=True)
    if len(ranked) > 1 and _as_sure(ranked[0][1], ranked[1][1]):
        tied = [n for n, v in ranked if _as_sure(ranked[0][1], v)]
        several = [i for n in tied for i in by_number[n]]
        return [i for i in several if ours(i)] or several
    candidates = by_number[ranked[0][0]]
    candidates = [i for i in candidates if ours(i)] or candidates
    if len(candidates) == 1:
        return candidates[0]
    fitting = [i for i in candidates if _fits_size(page, _buffers(geometry, i))]
    if len(fitting) == 1:
        return fitting[0]
    return fitting or candidates


def _buffers(geometry: Sequence[SheetBuffers | None], i: int) -> SheetBuffers | None:
    return geometry[i] if i < len(geometry) else None


def _height(item: TextItem) -> float:
    x0, y0, x1, y1 = item.anchor.box
    return item.size if item.size is not None else min(abs(x1 - x0), abs(y1 - y0))


def _as_sure(a: tuple[bool, float], b: tuple[bool, float]) -> bool:
    """Two mentions of different numbers are as sure when both are whole or both not, and the second's
    text is at least nine tenths the first's size."""
    return a[0] == b[0] and b[1] >= 0.9 * a[1]


def _fits_size(page: Page, buffers: SheetBuffers | None) -> bool:
    """Whether the sheet's paper is the page's size (at 1:1, turned or not, within 2 %)."""
    if buffers is None:
        return False
    w, h = buffers.paper.width_mm * PT_PER_MM, buffers.paper.height_mm * PT_PER_MM
    return any(
        abs(a - page.width) <= 0.02 * page.width and abs(b - page.height) <= 0.02 * page.height
        for a, b in ((w, h), (h, w))
    )


# Which sheet, by its ink ------------------------------------------------------------------------------


def by_ink(
    page: Page,
    sheets: Sequence[SheetCandidate],
    geometry: Sequence[SheetBuffers | None],
    plot: Path | None,
    budget: list[int] | None = None,
) -> tuple[int, PlotTransform, float | None] | None:
    """Which of the sheets the page plots, by their ink (a page with no text, or one naming several
    sheets alike): each placed on the page (`place`, then `ink.align`) and scored by how well the
    two inks agree (`ink.agreement`); the best is taken, with its transform and residual, when it
    agrees at least `MIN_INK_F1` and by `INK_MARGIN` more than the next. None when it does not, when
    the page's PDF or a sheet's buffers are missing (a sheet never drawn cannot be ruled out), when
    there are more than `MAX_BY_INK` sheets to try, or more than `budget[0]` tries left (the match's,
    `MAX_INK_TRIES`, spent by each sheet tried)."""
    left = budget if budget is not None else [MAX_INK_TRIES]
    if plot is None or not 1 <= len(sheets) <= min(MAX_BY_INK, left[0]):
        return None
    if any(b is None for b in geometry):
        return None
    left[0] -= len(sheets)
    scored: list[tuple[float, int, PlotTransform, float | None]] = []
    for k, (sheet, buffers) in enumerate(zip(sheets, geometry, strict=True)):
        placed = place(page, sheet, buffers) if buffers is not None else None
        if buffers is None or placed is None:
            return None
        transform, residual = ink.align(page, buffers, placed[0], plot)
        agrees = ink.agreement(page, buffers, transform, plot)
        if agrees is None:
            return None
        scored.append((agrees, k, transform, residual))
    scored.sort(key=lambda s: s[0], reverse=True)
    best = scored[0]
    if best[0] < MIN_INK_F1 or (len(scored) > 1 and best[0] - scored[1][0] < INK_MARGIN):
        return None
    return best[1], best[2], best[3]


# Where -------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Fit:
    turn: int
    scale: float
    offset: tuple[float, float]
    pairs: int
    residual_mm: float | None


def place(
    page: Page, sheet: SheetCandidate, buffers: SheetBuffers
) -> tuple[PlotTransform, float | None] | None:
    """The sheet's transform onto the page and the fit's residual (the module's rules); none for a
    page or a paper with no size to place by (a page of 0 by 0 points names a sheet all the same)."""
    paper = buffers.paper
    sizes = (page.width, page.height, paper.width_mm, paper.height_mm)
    if not all(math.isfinite(v) and v >= MIN_SIDE for v in sizes):
        return None
    anchors = [a for a in sheet.anchors[1:] if isinstance(a, DwgAnchor)][:MAX_DRAWN]
    drawn = [box for a in anchors if (box := drawn_at(buffers, a)) is not None]
    printed = [
        i.anchor.box for i in page.items if _on_page(i.anchor.box, page) and _reads_a_value(i, sheet)
    ][:MAX_PRINTED]
    with np.errstate(all="ignore"):
        fits = [_fit(page, paper, turn, drawn, printed) for turn in TURNS]
    upright = (paper.width_mm >= paper.height_mm) == (page.width >= page.height)
    default = fits[0] if upright else fits[1]
    best = max(fits, key=lambda f: (f.pairs >= MIN_PAIRS, f.pairs, f is default))
    if best.pairs < MIN_PAIRS or not all(map(math.isfinite, (*best.offset, best.residual_mm or 0))):
        best = default
    if not all(map(math.isfinite, (best.scale, *best.offset))) or best.scale <= 0:
        return None
    return PlotTransform(best.scale, best.turn, best.offset), best.residual_mm


def _on_page(box: tuple[float, float, float, float], page: Page) -> bool:
    """Whether a text's box lies on the page (a margin of a page's size about it): a text placed
    off it, as far as a hostile file likes, is no evidence of where the sheet lands."""
    x0, y0, x1, y1 = box
    return all(map(math.isfinite, box)) and (
        -page.width <= min(x0, x1) and max(x0, x1) <= 2 * page.width
        and -page.height <= min(y0, y1) and max(y0, y1) <= 2 * page.height
    )  # fmt: skip


def _scale(page: Page, paper: Paper, turn: int) -> float:
    w, h = (paper.width_mm, paper.height_mm) if turn in (0, 180) else (paper.height_mm, paper.width_mm)
    if w * PT_PER_MM <= page.width * FITS and h * PT_PER_MM <= page.height * FITS:
        return PT_PER_MM
    return min(page.width / w, page.height / h)


def _turn(turn: int, x: float, y: float) -> tuple[float, float]:
    c, s = {0: (1, 0), 90: (0, 1), 180: (-1, 0), 270: (0, -1)}[turn]
    return c * x - s * y, s * x + c * y


type _Box = tuple[float, float, float, float]


def _marks(box: _Box) -> tuple[bool, list[tuple[float, float]]]:
    """A text's box's run (along x or not) and three points along it: its start, middle and end. A
    plotted text and the renderer's differ in width (their fonts), so only the point the text is
    aligned by agrees; which one it is, the pairs' agreement finds."""
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if x1 - x0 >= y1 - y0:
        return True, [(x0, cy), (cx, cy), (x1, cy)]
    return False, [(cx, y0), (cx, cy), (cx, y1)]


def _fit(page: Page, paper: Paper, turn: int, drawn: list[_Box], printed: list[_Box]) -> _Fit:
    scale = _scale(page, paper, turn)
    cx, cy = _turn(turn, paper.width_mm / 2, paper.height_mm / 2)
    centred = (page.width / 2 - scale * cx, page.height / 2 - scale * cy)
    offsets: list[tuple[float, float]] = []
    tags: list[tuple[int, int]] = []
    ours = [_marks(_turned(turn, scale, box)) for box in drawn]
    theirs = [_marks(box) for box in printed]
    for i, (along_x, points) in enumerate(ours):
        for j, (their_x, their_points) in enumerate(theirs):
            if along_x != their_x:
                continue
            for (ax, ay), (bx, by) in zip(points, their_points, strict=True):
                offsets.append((bx - ax, by - ay))
                tags.append((i, j))
    if not offsets:
        return _Fit(turn, scale, centred, 0, None)
    at = np.array(offsets)
    apart = np.hypot(*(at[:, None, :] - at[None, :, :]).transpose(2, 0, 1)) <= AGREE_MM * scale
    support = _distinct_support(apart, np.array(tags))
    pick = int(np.argmax(support))
    if support[pick] < MIN_PAIRS:
        return _Fit(turn, scale, centred, int(support[pick]), None)
    members = at[apart[pick]]
    offset = members.mean(axis=0)
    residual = float(np.sqrt(np.mean(np.sum((members - offset) ** 2, axis=1)))) / scale
    return _Fit(turn, scale, (float(offset[0]), float(offset[1])), int(support[pick]), residual)


def _turned(turn: int, scale: float, box: _Box) -> _Box:
    corners = [_turn(turn, x, y) for x in (box[0], box[2]) for y in (box[1], box[3])]
    xs, ys = [scale * c[0] for c in corners], [scale * c[1] for c in corners]
    return min(xs), min(ys), max(xs), max(ys)


def _distinct_support(apart: np.ndarray, tags: np.ndarray) -> np.ndarray:
    """For each pair, how many pairs agree with it, each drawn text and each page item counted once."""
    support = np.zeros(len(tags), dtype=np.int64)
    for k in range(len(tags)):
        agreeing = tags[np.flatnonzero(apart[k])]
        support[k] = min(len(set(agreeing[:, 0])), len(set(agreeing[:, 1])))
    return support


def _reads_a_value(item: TextItem, sheet: SheetCandidate) -> bool:
    """Whether a page item reads one of the sheet's values: its number, revision or date whole, or a
    line of its title."""
    text = normal(item.text)
    if text is None:
        return False
    for value in (sheet.number, sheet.revision_mark, sheet.issue_date):
        if value is not None and normal(value.value) == text:
            return True
    title = normal(sheet.title.value) if sheet.title is not None else None
    return title is not None and len(text) >= _MIN_TITLE_PART and text in title


def drawn_at(buffers: SheetBuffers, anchor: DwgAnchor) -> _Box | None:
    """The box, in paper millimetres, of what the buffers draw for the anchor's entity reached
    through its inserts; none when they draw nothing of it."""
    index = {s: i for i, s in reversed(list(enumerate(buffers.strings)))}
    source = index.get(anchor.handle)
    chain = tuple(index.get(h, -1) for h in anchor.inserts)
    chains = [i for i, c in enumerate(buffers.chains) if tuple(c) == chain]
    if source is None or not chains:
        return None
    prims = buffers.primitives
    mine = np.flatnonzero((prims["source"] == source) & np.isin(prims["chain"], chains))
    if not len(mine):
        return None
    xs: list[np.ndarray] = []
    ys: list[np.ndarray] = []
    lines = buffers.lines[np.isin(buffers.lines["prim"], mine)]
    xs += [lines["x0"], lines["x1"]]
    ys += [lines["y0"], lines["y1"]]
    tris = buffers.triangles[np.isin(buffers.triangles["prim"], mine)]
    xs += [tris["x0"], tris["x1"], tris["x2"]]
    ys += [tris["y0"], tris["y1"], tris["y2"]]
    glyphs = buffers.glyphs[np.isin(buffers.glyphs["prim"], mine)]
    if len(glyphs):
        rects = buffers.atlas_glyphs[glyphs["glyph"]]
        for gx, gy in (("x0", "y0"), ("x1", "y1")):
            xs.append(glyphs["ox"] + rects[gx] * glyphs["xx"] + rects[gy] * glyphs["yx"])
            ys.append(glyphs["oy"] + rects[gx] * glyphs["xy"] + rects[gy] * glyphs["yy"])
    x = np.concatenate(xs).astype(np.float64)
    y = np.concatenate(ys).astype(np.float64)
    if not len(x):
        return None
    box = (float(x.min()), float(y.min()), float(x.max()), float(y.max()))
    return box if all(map(math.isfinite, box)) else None
