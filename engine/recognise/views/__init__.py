"""Views within sheets (17): the drawings one sheet holds, each with its title, kind, scale, storeys,
subject and layer, and what it is proposed for.

    views.ViewBudget(artefact)                                            (one file's bounds)
    views.find(artefact, sheet, conventions, budget=budget, sheet_conventions=None) -> FoundViews
                                                          (the `views` stage; `.paper`)
    views.working_view(views) -> int | None                            (16's and 22's fit)
    views.titled_storeys(stated, sheet_conventions=None) -> tuple[str, ...]  (Step 1's `storeys_titled`)
    views.kind_steps(kind, discipline, conventions=None) -> tuple[str, ...]  (Step 1, #158)
    views.subjects(text, conventions=None) -> frozenset[str]             (19b's continuations)
    views.describe(text, conventions=None) -> Described                   (19b's continuations)
    views.default_conventions() -> ViewConventions

`conventions` are view conventions (`engine/recognise/conventions/view-default.json` by default: the
title words of each kind, the subject and layer words and the scale patterns, all data). The storey
words are `sheet_conventions`' (the sheets' conventions, a Market's as data; the default sheet
conventions when none are given), read by 13's `storeys.read`; `storeys` is their one owner here.

Its parts, each one ticket's to change: `paper` (a sheet laid on paper, and the file's budget),
`segment` (the drawing cut into views, the title block among them), `titles` (what a title says),
`storeys` (a view's storeys) and `routing` (what a view is proposed for, and the working view). Each
part's docstring says how it reads. Routing and storeys read words, never paper or a segment; paper is
read before any title, storey or Step.

**Hostile input is bounded, by one budget for the whole file** (`ViewBudget`, passed to `find` for each
of the file's sheets; a call given none makes one of its own): each space is walked once (model space
once per file), and every walk spends the file's `MAX_VISITS` entities, `MAX_SEGMENTS` lines and
`MAX_TEXTS` texts, so no number of layouts multiplies them, and every viewport weighs model space
against the file's `MAX_SCANS` and `MAX_READS` (at most `MAX_SHEET_VIEWPORTS` viewports a layout, the
rest counted in `ViewBudget.limits`, not read in full); the grid has at most `MAX_GRID` cells a side (its
cells grow on a larger paper) and at most `MAX_SAMPLES` points are laid on it; at most `MAX_TITLES`
titles and as many scale texts, the `MAX_PIECES` largest pieces and `MAX_VIEWS` views are read on a
sheet. What is past a bound is not read. The file's bounds are this package's names: a budget reads them
as they stand when it is made.
"""

from collections.abc import Sequence

from engine.read.anchor import DwgAnchor
from engine.read.artefact import ReadArtefact
from engine.recognise import scales
from engine.recognise.types import (
    Box,
    SheetCandidate,
    SheetConventions,
    ViewCandidate,
    ViewConventions,
    ViewKind,
)
from engine.recognise.views import storeys
from engine.recognise.views.paper import MAX_SHEET_VIEWPORTS, ViewBudget, _Paper, _paper
from engine.recognise.views.routing import (
    GENERAL_NOTES,
    PLUMBING_PART,
    STEP_DISCIPLINES,
    _draws_structure,
    _proposal,
    kind_steps,
    working_view,
)
from engine.recognise.views.segment import _in_reading_order, _views
from engine.recognise.views.segment.block import _title_block
from engine.recognise.views.segment.pieces import _View
from engine.recognise.views.titles import (
    Described,
    _kind,
    _layer,
    _Reading,
    _reading,
    _subject,
    _subjects_in_order,
    default_conventions,
    describe,
    subjects,
)

__all__ = [
    "GENERAL_NOTES",
    "LIMITS",
    "MAX_READS",
    "MAX_SCANS",
    "MAX_SEGMENTS",
    "MAX_SHEET_VIEWPORTS",
    "MAX_TEXTS",
    "MAX_TEXT_READS",
    "MAX_VISITS",
    "PLUMBING_PART",
    "STEP_DISCIPLINES",
    "Described",
    "FoundViews",
    "ViewBudget",
    "default_conventions",
    "describe",
    "find",
    "kind_steps",
    "subjects",
    "titled_storeys",
    "working_view",
]

MAX_VISITS = 8_000_000
MAX_SEGMENTS = 3_000_000
MAX_SCANS = 400_000_000
"""The walked items a file's sheets may weigh against a window together (each model-space sheet and
each viewport tests every line and text of model space once), so no number of viewports or frames
multiplies the walk past it."""
MAX_READS = 12_000_000
"""The lines a file's sheets may lay on paper together."""
MAX_TEXT_READS = 250_000
"""The texts a file's sheets may lay on paper together."""
MAX_TEXTS = 200_000


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
    artefact: ReadArtefact,
    sheet: SheetCandidate,
    conventions: ViewConventions | None = None,
    plot: tuple[float, float] | None = None,
    *,
    budget: ViewBudget | None = None,
    sheet_conventions: SheetConventions | None = None,
) -> FoundViews:
    """The sheet's views, in reading order (the package's docstring), on the file's `budget` (one of
    its own when none is given), their storeys read with `sheet_conventions`' storey words. `plot` is
    the paper of the Plot page matched to a model-space sheet, in mm (`paper._plot_paper`; a layout's
    paper is its own)."""
    if sheet_conventions is not None and not isinstance(sheet_conventions, SheetConventions):
        raise TypeError(
            f"sheet conventions are SheetConventions, not {type(sheet_conventions).__name__}"
        )
    if not isinstance(sheet, SheetCandidate):
        raise TypeError(f"a sheet is a SheetCandidate, not {type(sheet).__name__}")
    if budget is None:
        budget = ViewBudget(artefact)
    elif budget.artefact is not artefact:
        raise ValueError("a view budget is its own file's: this sheet is another file's")
    held = conventions if conventions is not None else default_conventions()
    reading = _reading(held)
    paper = _paper(artefact, sheet, budget, plot)
    if paper is None:
        empty = FoundViews()
        empty.limits = _report(budget)
        return empty
    fallback = _kind(sheet.title.value, reading) if sheet.title is not None else None
    block = _title_block(paper)
    found = _in_reading_order(_views(paper, reading, fallback or ViewKind.PLAN, block))
    if block is not None:
        found.append(_View(None, None, ViewKind.TITLE_BLOCK, block))
    discipline = sheet.discipline.value if sheet.discipline is not None else None
    on_sheet = _subjects_in_order(sheet.title.value, reading) if sheet.title is not None else ()
    held_words = storeys.words(sheet_conventions)
    made = [_candidate(v, paper, reading, discipline, on_sheet, held_words) for v in found]
    result = FoundViews(storeys.inherit(made, sheet, on_sheet, held_words))
    result.paper = (paper.region[2], paper.region[3])
    result.limits = _report(budget)
    return result


def titled_storeys(
    stated: str | None, sheet_conventions: SheetConventions | None = None
) -> tuple[str, ...]:
    """The storey keys a sheet title's stated storey words read to (`storeys.titled`): the one
    reading Step 1 shows for a sheet with no plan, so the screen parses none."""
    return storeys.titled(stated, sheet_conventions)


def _report(budget: ViewBudget) -> dict[str, int]:
    return {**dict.fromkeys(LIMITS, 0), **budget.limits}


def _candidate(
    view: _View,
    paper: _Paper,
    reading: _Reading,
    discipline: str | None,
    on_sheet: Sequence[str] = (),
    storey_words: SheetConventions | None = None,
) -> ViewCandidate:
    title = " ".join(view.title.shown.split()) if view.title is not None else None
    scale = view.scale
    if title is not None and scale is None:
        scale = scales.read(title, reading.patterns)
    subject = _subject(title, reading) if title is not None else None
    layer = _layer(title, reading) if title is not None else None
    lines = [" ".join(u.shown.split()) for u in view.lines]
    stated = storeys.read(title, view.kind, subject, lines, storey_words)
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
        storeys_as_stated=stated.as_stated,
        storeys=stated.keys,
        storeys_meaning=stated.meaning,
        storeys_source=stated.source,
        subject=subject,
        layer=layer,
        steps=steps,
        part=part,
        exclusion=exclusion,
        anchors=anchors,
    )
