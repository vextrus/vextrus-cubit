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
does (a title block's number is its largest text). A page whose surest number is two sheets' numbers
equally, or whose number several sheets carry and whose size cannot tell them apart, names several
(`names_several_sheets`); one naming none says so (`names_no_sheet`); a scan (`scan`) or a page with
no text (`no_text`) is not searched.

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
MAX_DRAWN = 64
MAX_PRINTED = 256
"""The most value texts and page items paired (a page's revision table may repeat a date many times):
the pairs are weighed against each other, so their count is bounded before it is squared."""
TURNS = (0, 90, 180, 270)
_WORDS = re.compile(r"[\s:;,()\[\]]+")
_MIN_TITLE_PART = 4
"""The fewest characters a page item needs to be taken as part of a sheet's title (one of its lines)."""


def match(
    pages: Sequence[Page],
    sheets: Sequence[SheetCandidate],
    geometry: Sequence[SheetBuffers | None] = (),
    plots: Mapping[str, Path] | None = None,
) -> list[PlotMatch]:
    """Every page's match, in the order given (the module's rules). `plots` names each PDF's path by
    its contents' sha256, for the ink's placement; without its page's, a page is placed by its text
    and sizes alone."""
    by_number: dict[str, list[int]] = {}
    for i, sheet in enumerate(sheets):
        key = normal(sheet.number.value) if sheet.number is not None else None
        if key is not None:
            by_number.setdefault(key, []).append(i)
    found = []
    for page in pages:
        if page.scan:
            found.append(PlotMatch(page, reason=_reason(codes.SCAN)))
            continue
        if not page.items:
            found.append(PlotMatch(page, reason=_reason(codes.NO_TEXT)))
            continue
        chosen = _sheet_named(page, sheets, by_number, geometry)
        if isinstance(chosen, str):
            found.append(PlotMatch(page, reason=chosen))
            continue
        sheet = sheets[chosen]
        buffers = geometry[chosen] if chosen < len(geometry) else None
        if buffers is None:
            found.append(PlotMatch(page, sheet=sheet))
            continue
        transform, residual = place(page, sheet, buffers)
        plot = (plots or {}).get(page.source_sha256)
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
) -> int | str:
    """The index of the sheet the page names, or the key of why none."""
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
    ranked = sorted(best.items(), key=lambda kv: kv[1], reverse=True)
    if len(ranked) > 1 and _as_sure(ranked[0][1], ranked[1][1]):
        return _reason(codes.NAMES_SEVERAL_SHEETS)
    candidates = by_number[ranked[0][0]]
    if len(candidates) == 1:
        return candidates[0]
    fitting = [i for i in candidates if _fits_size(page, geometry[i] if i < len(geometry) else None)]
    if len(fitting) == 1:
        return fitting[0]
    return _reason(codes.NAMES_SEVERAL_SHEETS)


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
) -> tuple[PlotTransform, float | None]:
    """The sheet's transform onto the page and the fit's residual (the module's rules)."""
    paper = buffers.paper
    anchors = [a for a in sheet.anchors[1:] if isinstance(a, DwgAnchor)][:MAX_DRAWN]
    drawn = [box for a in anchors if (box := drawn_at(buffers, a)) is not None]
    printed = [i.anchor.box for i in page.items if _reads_a_value(i, sheet)][:MAX_PRINTED]
    fits = [_fit(page, paper, turn, drawn, printed) for turn in TURNS]
    upright = (paper.width_mm >= paper.height_mm) == (page.width >= page.height)
    default = fits[0] if upright else fits[1]
    best = max(fits, key=lambda f: (f.pairs >= MIN_PAIRS, f.pairs, f is default))
    if best.pairs < MIN_PAIRS:
        best = default
    return PlotTransform(best.scale, best.turn, best.offset), best.residual_mm


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
