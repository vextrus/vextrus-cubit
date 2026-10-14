"""The Plot matched in the read job (ticket 157; 18's registration, `engine.plot.registration.match`):
the Drawing Set's read PDFs' pages matched to its listed sheets and placed on them, each kept through
`drawings.services.record_plot`, in whichever order the DWG and its Plot are read.

    counts = plot.match(file_id)      # in the step that marks the file read, in its transaction

It runs in the transaction that marks the file read (a PDF's `matching` step, a DWG's `finishing`),
so no read PDF and read sheet are ever seen together unmatched: a sheet list asked in between sees
neither the file read nor its matches. The set's matching is held one at a time
(`drawings.services.hold_plots`), so a DWG and a PDF read at once each see the other's. In a DWG's
`finishing` it is found before Step 1's proposals (`find`: minutes on a large set, writing nothing)
and kept after them (short, locking the sheets it changes, which a QS's act on Step 1 locks too), so
an act waits on it only for the moment before the step commits (#227).

**A PDF** (`matching`) **or a DWG** (`finishing`): every read PDF's pages of the set against every
listed sheet, each placed where matched, and every listed sheet's Plot kept again from that one
match (S24-A5, #703's review: a set-level step whose outcome is a function of the set's read PDFs'
pages and listed sheets alone, so the order its files were read in cannot change it; 18's "One
page, one sheet" runs once, over all of them).

**What is kept.** A sheet named by a page gets it, placed, unless it has a page of a PDF added
before this page's (the first added PDF with a page for a sheet is its Plot, the report's rule,
whichever was read first), or another page of the same PDF is more surely its own (the number
whole, then the better fit, then the larger text; `_surest`), or an earlier page of this run named
it (the PDFs first added first, each page in order). A sheet with a number, of a Discipline a PDF
tried here covers (the PDF's own, or the PDF of none), and still with no page is kept as
`PlotNone.NO_PAGE` naming such a PDF (its own Discipline's first, then the first added: the sheet
list's order): the match ran, and found none. Any other sheet still holding a page this match did
not give it lets it go (`PlotNone.NO_PDF`, its words then the set's as it stands): every sheet's
Plot is decided again, none kept stale from an earlier read (S27-G1, #827). Another read PDF
whose copy or reading fails now is left out, never named; this file's own fails the file.
What each PDF's pages name is kept for its report (`_keep_names`: 18's reason, or the sheet named);
which pages are matched, and the page a sheet is used on, the report reads from the sheets' Plots.
"""

import math
import uuid
from collections import OrderedDict
from collections.abc import Callable, Iterator, Mapping, Sequence
from contextlib import ExitStack
from decimal import Decimal
from pathlib import Path
from typing import Any, overload

from engine.messages import Message
from engine.messages import plot as plot_codes
from engine.plot import registration
from engine.read import ReadError
from engine.read import pdf as pdf_reader
from engine.read.anchor import DwgAnchor
from engine.read.pdf.types import Page
from engine.recognise.types import Box, PlotMatch, SheetCandidate, SheetLocation, Sourced, ValueSource
from engine.render.buffers import SheetBuffers
from vextrus.drawings import services as drawings
from vextrus.drawings.messages import reports
from vextrus.platform.services import auth, jobs, storage
from vextrus.takeoff.services import step1

KEPT_BUFFERS = 4
"""The most sheets' render buffers held at once while matching (a large set's are loaded as a page
needs them, never all together under the cad worker's memory cap)."""
_WORDS = ("number", "title", "revision_mark", "issue_date")


def match(file_id: uuid.UUID) -> jobs.StepResult:
    """Match the set's Plot pages for the file just marked read (see the module); how many pages
    were tried and matched, for the step's result."""
    return find(file_id)()


def find(file_id: uuid.UUID) -> Callable[[], jobs.StepResult]:
    """`match` in two parts, in one transaction: the pages read and matched now (the long part,
    which writes nothing), and what is kept, by the call it gives back (short: it locks the sheets it
    changes, a sheet let go among them, which a QS's act on Step 1 locks too). A DWG's `finishing`
    keeps them after its proposals, so those rows are held only for the moment before it commits
    (#227's review)."""
    view = drawings.file(file_id)
    drawings.hold_plots(view.set_id)
    listed = drawings.sheets(view.set_id)
    pdfs = sorted((f for f in drawings.files(view.set_id) if _is_read_pdf(f)), key=_added)
    tried = pdfs  # every read PDF of the set, whichever file was read: one set-level match (S24-A5)
    if not listed or not tried:
        return lambda: {"pages": 0, "matched": 0}
    candidates = [candidate(s) for s in listed]
    disciplines = {pdf.sha256: pdf.discipline for pdf in pdfs}
    with ExitStack() as stack:
        paths: dict[str, Path] = {}
        pages: list[Page] = []
        for pdf in tried:
            try:
                path = stack.enter_context(drawings.original(pdf.id))
                pages += pdf_reader.page_text(path)
            except ReadError, storage.StorageError:
                if pdf.id == file_id:
                    raise  # this PDF's own copy or reading: the file's reason (the job's `not_read`)
                continue  # another PDF, read before, that cannot be read again now: left as it was
            paths[pdf.sha256] = path
        geometry = _Geometry(listed)
        found = registration.match(pages, candidates, geometry, paths, disciplines)
    read_again = set(paths)
    names = {id(c): sh for c, sh in zip(candidates, listed, strict=True)}

    def keep() -> jobs.StepResult:
        step1.lock_writes(view.project_id)  # before the sheets it locks, as every act (#227)
        matched = _keep(listed, candidates, found, pdfs, read_again)
        _keep_names(found, [pdf for pdf in tried if pdf.sha256 in read_again], names)
        return {"pages": len(found), "matched": matched}

    return keep


def _added(f: drawings.FileView) -> tuple[object, str]:
    """The set's order of PDFs: first added first (the report's "the first is its Plot")."""
    return f.added_at, str(f.id)


def _is_read_pdf(f: drawings.FileView) -> bool:
    return f.format == "pdf" and f.state == drawings.FileState.READ


def _keep(
    listed: Sequence[drawings.SheetView],
    candidates: Sequence[SheetCandidate],
    found: Sequence[PlotMatch],
    pdfs: Sequence[drawings.FileView],
    tried: set[str],
) -> int:
    """Every listed sheet's Plot from the set's pages as matched now (S24-A5: a set-level step, its
    outcome a function of the set's read PDFs' pages and its listed sheets alone, so the order its
    files were read in cannot change it): the surest page (`_surest`) of the first added PDF with a
    page naming the sheet; else, for a numbered sheet of a Discipline a PDF tried here covers,
    `PlotNone.NO_PAGE` naming it; else a sheet still holding a page lets it go (`PlotNone.NO_PDF`).
    A sheet whose kept Plot is a page of a PDF that could not be read again now is left as it was.
    `tried`: the sha256 of each PDF whose pages were matched here. How many sheets got a page."""
    by_candidate = {id(c): s for c, s in zip(candidates, listed, strict=True)}
    by_sha = {pdf.sha256: pdf for pdf in pdfs}
    by_id = {pdf.id: pdf for pdf in pdfs}
    surest = _surest(found, by_candidate, by_sha)
    # A sheet whose kept Plot is a page of a PDF that could not be read again now is left as it
    # was: its page was not matched here, so no other PDF's page may take it (#712's review).
    left = {sheet.id for sheet in listed if _unread_plot(sheet, by_id, tried)}
    given: set[uuid.UUID] = set()
    for k, m in enumerate(found):  # the pages in their PDFs' order, first added first
        sheet = by_candidate.get(id(m.sheet)) if m.sheet is not None else None
        pdf = by_sha.get(getattr(m.page, "source_sha256", ""))
        if sheet is None or pdf is None or sheet.id in given or sheet.id in left:
            continue
        if surest.get((sheet.id, pdf.id)) != k:
            continue  # another page of this PDF is more surely its page
        drawings.record_plot(sheet.id, m)
        given.add(sheet.id)
    for sheet in listed:
        if sheet.id in given or sheet.id in left:
            continue
        covering = [pdf for pdf in _covering(sheet, pdfs) if pdf.sha256 in tried]
        if covering and sheet.number is not None:
            drawings.record_plot(sheet.id, drawings.PlotNone.NO_PAGE, pdf_file_id=covering[0].id)
        elif sheet.plot.page is not None:
            # A page an earlier match kept that this one did not give: let go, never kept stale
            # (#827: a General sheet kept a Structural Plot's page after the Structural DWG's read).
            drawings.record_plot(sheet.id, drawings.PlotNone.NO_PDF)
    return len(given)


def _unread_plot(
    sheet: drawings.SheetView, by_id: Mapping[uuid.UUID, drawings.FileView], tried: set[str]
) -> bool:
    """Whether the sheet's kept Plot is a page of a read PDF of the set that was not matched here
    (its copy or reading failed now)."""
    kept = by_id.get(sheet.plot.file_id) if sheet.plot.file_id else None
    return sheet.plot.page is not None and kept is not None and kept.sha256 not in tried


def _surest(
    found: Sequence[PlotMatch],
    by_candidate: Mapping[int, drawings.SheetView],
    by_sha: Mapping[str, drawings.FileView],
) -> dict[tuple[uuid.UUID, uuid.UUID], int]:
    """For each sheet and PDF, the place in `found` of the PDF's page that is the sheet's own: of
    the pages naming it, one 18 used (`PlotMatch.used`: "One page, one sheet" took another page for
    it, by its drawing's fit or the PDF's order) before one it left unused; then one with its
    number whole (`registration.mention`) before one holding it among other words; then the one its
    drawing lies on best (the smaller residual: a real set had two pages with the number whole, the
    wrong one fitting at the residual's ceiling); then the larger text; then the first. A page that
    refers to a sheet whose own page is in the same PDF never takes it from that page."""
    best: dict[tuple[uuid.UUID, uuid.UUID], tuple[tuple[bool, bool, float, float], int]] = {}
    for k, m in enumerate(found):
        sheet = by_candidate.get(id(m.sheet)) if m.sheet is not None else None
        pdf = by_sha.get(getattr(m.page, "source_sha256", ""))
        if sheet is None or pdf is None:
            continue
        page = m.page
        sure = registration.mention(page, sheet.number or "") if isinstance(page, Page) else None
        whole, height = sure or (False, -1.0)
        # A page 18 left naming the sheet unused (`PlotMatch.used`, S24-A5) is never its page.
        rank = (m.used, whole, -(m.residual if m.residual is not None else math.inf), height)
        kept = best.get((sheet.id, pdf.id))
        if kept is None or rank > kept[0]:
            best[(sheet.id, pdf.id)] = (rank, k)
    return {key: k for key, (_, k) in best.items()}


def _covering(sheet: drawings.SheetView, pdfs: Sequence[drawings.FileView]) -> list[drawings.FileView]:
    """The read PDFs that may plot the sheet, as the sheet list names them: its Discipline's first,
    then those of none, each first added first (a sheet of no Discipline: every PDF)."""
    mine = [p for p in pdfs if sheet.discipline is None or p.discipline in (None, sheet.discipline)]
    return sorted(mine, key=lambda p: (p.discipline is None, _added(p)))


def _keep_names(
    found: Sequence[PlotMatch],
    tried: Sequence[drawings.FileView],
    by_candidate: Mapping[int, drawings.SheetView],
) -> None:
    """Keep, for each tried PDF, what each of its pages names: 18's reason for a page that names no
    sheet, or `PAGES_SAME_SHEET` (its `used_page` 0) for a page that names a sheet. Which pages are
    matched, and which page a sheet is plotted on, is not kept here: the report reads that from the
    sheets' Plots when it is asked for (`drawings.services.reports`), in any order files were read."""
    for pdf in tried:
        lines: list[Message] = []
        for m in found:
            page = m.page
            if getattr(page, "source_sha256", None) != pdf.sha256:
                continue
            number = getattr(page, "number", 0)
            sheet = by_candidate.get(id(m.sheet)) if m.sheet is not None else None
            if sheet is not None:
                lines.append(
                    reports.PAGES_SAME_SHEET(first_page=number, used_page=0, sheet=sheet.number or "")
                )
                continue
            code = plot_codes.REASONS.get(m.reason or "")
            if code is not None:
                lines.append(code(page=number))
        drawings.record_page_reasons(pdf.id, lines)


def candidate(sheet: drawings.SheetView) -> SheetCandidate:
    """A listed sheet as 18 matches it: its words as read, with their sources, its Discipline and its
    anchors (the frame's first, then its values', as its reading kept them)."""
    location = sheet.location
    if "layout" in location:
        place = SheetLocation(layout=str(location["layout"]))
    else:
        x0, y0, x1, y1 = (float(Decimal(str(v))) for v in location["box"])
        place = SheetLocation(box=Box(x0, y0, x1, y1))
    words: dict[str, Any] = {}
    for name in _WORDS:
        value = getattr(sheet, name)
        if value:
            source = sheet.sources.get(name, ValueSource.TITLE_BLOCK_TEXT)
            words[name] = Sourced(value, ValueSource(source))
    discipline = (
        Sourced(sheet.discipline, ValueSource(sheet.sources.get("discipline", ValueSource.FILE)))
        if sheet.discipline is not None
        else None
    )
    anchors = tuple(a for a in (s.anchor() for s in sheet.anchors) if isinstance(a, DwgAnchor))
    return SheetCandidate(location=place, discipline=discipline, anchors=anchors, **words)


class _Geometry(Sequence[SheetBuffers | None]):
    """The listed sheets' render buffers, loaded as they are asked for, the last few kept."""

    def __init__(self, listed: Sequence[drawings.SheetView]) -> None:
        self._listed = listed
        self._kept: OrderedDict[int, SheetBuffers | None] = OrderedDict()

    def __len__(self) -> int:
        return len(self._listed)

    @overload
    def __getitem__(self, index: int) -> SheetBuffers | None: ...
    @overload
    def __getitem__(self, index: slice) -> Sequence[SheetBuffers | None]: ...
    def __getitem__(self, index: int | slice) -> SheetBuffers | Sequence[SheetBuffers | None] | None:
        if isinstance(index, slice):
            return [self[i] for i in range(*index.indices(len(self)))]
        if index in self._kept:
            self._kept.move_to_end(index)
            return self._kept[index]
        buffers = self._load(self._listed[index])
        self._kept[index] = buffers
        while len(self._kept) > KEPT_BUFFERS:
            self._kept.popitem(last=False)
        return buffers

    def __iter__(self) -> Iterator[SheetBuffers | None]:
        return (self[i] for i in range(len(self)))

    @staticmethod
    def _load(sheet: drawings.SheetView) -> SheetBuffers | None:
        if not sheet.has_render:
            return None
        try:
            return SheetBuffers.from_bytes(drawings.render(sheet.id))
        except auth.NotFound, ValueError:  # its render lost or damaged: placed by its text alone
            return None
