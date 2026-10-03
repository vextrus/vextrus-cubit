"""The Plot matched in the read job (ticket 157; 18's registration, `engine.plot.registration.match`):
the Drawing Set's read PDFs' pages matched to its listed sheets and placed on them, each kept through
`drawings.services.record_plot`, in whichever order the DWG and its Plot are read.

    counts = plot.match(file_id)      # in the step that marks the file read, in its transaction

It runs in the transaction that marks the file read (a PDF's `matching` step, a DWG's `finishing`),
so no read PDF and read sheet are ever seen together unmatched: a sheet list asked in between sees
neither the file read nor its matches. The set's matching is held one at a time
(`drawings.services.hold_plots`), so a DWG and a PDF read at once each see the other's.

**A PDF** (`matching`): its pages against every listed sheet of the set, each placed where matched.
**A DWG** (`finishing`): the set's read PDFs' pages against every listed sheet, its own now among
them; only the pages that could be its sheets' are matched in full (named for one of them, or naming
none surely: several sheets alike, or no text), the rest named as before, so a set's Plot is not
aligned again each time one of its DWGs is read. A page's naming depends on the page, the whole
sheet list and, for a page matched by its ink, the other pages' text (`registration.unclaimed`);
and a page given to a sheet now is let go by any sheet that held it before (`_release`), so the
set ends with one sheet per page whichever order its files were read in.

**What is kept.** A sheet named by a page gets it, placed, unless it has a page of a PDF added
before this page's (the first added PDF with a page for a sheet is its Plot, the report's rule,
whichever was read first), or another page of the same PDF is more surely its own (the number
whole, then the better fit, then the larger text; `_surest`), or an earlier page of this run named
it (the PDFs first added first, each page in order). A sheet with a number, of a Discipline a PDF
tried here covers (the PDF's own, or the PDF of none), and still with no page is kept as
`PlotNone.NO_PAGE` naming such a PDF (its own Discipline's first, then the first added: the sheet
list's order): the match ran, and found none. Another read PDF whose copy or reading fails now is
left out, never named; this file's own fails the file.
Each PDF's pages that matched no sheet are kept as its report's lines (18's reason, with the page).
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
from vextrus.platform.services import auth, jobs, storage

KEPT_BUFFERS = 4
"""The most sheets' render buffers held at once while matching (a large set's are loaded as a page
needs them, never all together under the cad worker's memory cap)."""
_WORDS = ("number", "title", "revision_mark", "issue_date")
_MAY_BE_ANY = frozenset({"names_several_sheets", "no_text"})
"""A page's reasons, named without geometry, that its geometry may still turn into a match."""


def match(file_id: uuid.UUID) -> jobs.StepResult:
    """Match the set's Plot pages for the file just marked read (see the module); how many pages
    were tried and matched, for the step's result."""
    view = drawings.file(file_id)
    drawings.hold_plots(view.set_id)
    listed = drawings.sheets(view.set_id)
    pdfs = sorted((f for f in drawings.files(view.set_id) if _is_read_pdf(f)), key=_added)
    tried = [f for f in pdfs if f.id == file_id] if view.format == "pdf" else pdfs
    if not listed or not tried:
        return {"pages": 0, "matched": 0}
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
        if view.format == "pdf":
            found = registration.match(pages, candidates, geometry, paths, disciplines)
            full = set(range(len(found)))
        else:
            found, full = _for_dwg(file_id, listed, pages, candidates, geometry, paths, disciplines)
    matched = _keep(
        listed, candidates, found, full, pdfs, set(paths), file_id if view.format == "dwg" else None
    )
    _keep_reasons(found, [pdf for pdf in tried if pdf.sha256 in paths])
    return {"pages": len(found), "matched": matched}


def _added(f: drawings.FileView) -> tuple[object, str]:
    """The set's order of PDFs: first added first (the report's "the first is its Plot")."""
    return f.added_at, str(f.id)


def _is_read_pdf(f: drawings.FileView) -> bool:
    return f.format == "pdf" and f.state == drawings.FileState.READ


def _for_dwg(
    file_id: uuid.UUID,
    listed: Sequence[drawings.SheetView],
    pages: list[Page],
    candidates: list[SheetCandidate],
    geometry: Sequence[SheetBuffers | None],
    paths: dict[str, Path],
    disciplines: dict[str, str | None],
) -> tuple[list[PlotMatch], set[int]]:
    """Every page's match: named without geometry, then matched in full where it could be one of
    the file's sheets (see the module); and the places of those matched in full."""
    ours = {id(c) for c, s in zip(candidates, listed, strict=True) if s.file_id == file_id}
    named = registration.match(pages, candidates, (), None, disciplines)
    again = [
        i
        for i, m in enumerate(named)
        if (m.sheet is not None and id(m.sheet) in ours) or (m.sheet is None and m.reason in _MAY_BE_ANY)
    ]
    full = registration.match([pages[i] for i in again], candidates, geometry, paths, disciplines)
    found = list(named)
    for i, m in zip(again, full, strict=True):
        found[i] = m
    # A page matched by its ink never takes a sheet another page names by its text, whichever of
    # the pages was matched in full here (18's rule, over every page, as a PDF's own match has it).
    inked = {
        i: str(named[i].reason) for i in again if named[i].sheet is None and found[i].sheet is not None
    }
    return registration.unclaimed(found, inked), set(again)


def _keep(
    listed: Sequence[drawings.SheetView],
    candidates: Sequence[SheetCandidate],
    found: Sequence[PlotMatch],
    full: set[int],
    pdfs: Sequence[drawings.FileView],
    tried: set[str],
    dwg_id: uuid.UUID | None,
) -> int:
    """Keep each named sheet's page and each unmatched covered sheet's `NO_PAGE` (see the module);
    for a DWG, only its own sheets. `tried`: the sha256 of each PDF whose pages were matched here.
    How many sheets got a page."""
    by_candidate = {id(c): s for c, s in zip(candidates, listed, strict=True)}
    by_sha = {pdf.sha256: pdf for pdf in pdfs}
    by_id = {pdf.id: pdf for pdf in pdfs}
    given: set[uuid.UUID] = set()
    surest = _surest(found, by_candidate, by_sha)

    def give(
        of: Callable[[drawings.SheetView], bool], let_go: set[uuid.UUID], only: set[int] | None
    ) -> None:
        for k, m in enumerate(found):
            if only is not None and k not in only:
                continue
            sheet = by_candidate.get(id(m.sheet)) if m.sheet is not None else None
            if sheet is None or sheet.id in given or not of(sheet):
                continue
            pdf = by_sha.get(getattr(m.page, "source_sha256", ""))
            if pdf is None or surest.get((sheet.id, pdf.id)) != k:
                continue  # another page of this PDF names the sheet more surely: its page
            held = sheet.plot.page is not None and sheet.id not in let_go
            kept = by_id.get(sheet.plot.file_id) if held and sheet.plot.file_id else None
            if kept is not None and kept.id != pdf.id and _added(kept) < _added(pdf):
                continue  # its Plot is a page of a PDF added before this one: the first added keeps it
            drawings.record_plot(sheet.id, m)
            given.add(sheet.id)

    give(lambda sheet: dwg_id is None or sheet.file_id == dwg_id, set(), None)
    released = _release(listed, found, full, by_candidate, by_sha, surest, given)
    # A sheet let go (of any file) is kept again from this run's pages matched in full, so the set's
    # Plot is the same whichever order its files were read in (157's review, N2).
    give(lambda sheet: sheet.id in released, released, full)
    for sheet in listed:
        if sheet.id in given or sheet.number is None or sheet.plot.page is not None:
            continue
        if dwg_id is not None and sheet.file_id != dwg_id:
            continue
        # Named only by a PDF whose pages were matched here: one that could not be read again
        # was never tried against the sheet.
        covering = [pdf for pdf in _covering(sheet, pdfs) if pdf.sha256 in tried]
        if not covering:
            continue  # no PDF tried here is its Discipline's: what it says is unchanged
        drawings.record_plot(sheet.id, drawings.PlotNone.NO_PAGE, pdf_file_id=covering[0].id)
    return len(given)


def _release(
    listed: Sequence[drawings.SheetView],
    found: Sequence[PlotMatch],
    full: set[int],
    by_candidate: Mapping[int, drawings.SheetView],
    by_sha: Mapping[str, drawings.FileView],
    surest: Mapping[tuple[uuid.UUID, uuid.UUID], int],
    given: set[uuid.UUID],
) -> set[uuid.UUID]:
    """One page, one sheet: a page matched in full here (with its geometry), that now names another
    sheet surely, or names none (several, which its ink cannot tell apart), is let go by each sheet
    that held it before (a DWG read later carries the sheet the page plots). Never on a page only
    named here: a ranking made without geometry is not surer than
    the one that gave the page. A sheet let go is kept as `PlotNone.NO_PAGE` naming that PDF (the
    PDF's report lists it, "has no page in this PDF"), unless this run's pages give it another
    (`_keep`). The sheets let go."""
    holders: dict[tuple[uuid.UUID, int], list[drawings.SheetView]] = {}
    for sheet in listed:
        if sheet.plot.page is not None and sheet.plot.file_id is not None:
            holders.setdefault((sheet.plot.file_id, sheet.plot.page), []).append(sheet)
    released: set[uuid.UUID] = set()
    for k, m in enumerate(found):
        pdf = by_sha.get(getattr(m.page, "source_sha256", ""))
        number = getattr(m.page, "number", None)
        if k not in full or pdf is None or not isinstance(number, int):
            continue
        named = by_candidate.get(id(m.sheet)) if m.sheet is not None else None
        if named is not None and surest.get((named.id, pdf.id)) != k:
            continue  # another page of this PDF names the sheet more surely: that page decides
        # A page matched in full that names no sheet (several, or none) is let go by all that held
        # it: kept, the Plot would hang on the order the files were read in (157's re-check).
        owner = named.id if named is not None else None
        for held in holders.get((pdf.id, number), ()):
            if held.id != owner and held.id not in given:
                drawings.record_plot(held.id, drawings.PlotNone.NO_PAGE, pdf_file_id=pdf.id)
                released.add(held.id)
    return released


def _surest(
    found: Sequence[PlotMatch],
    by_candidate: Mapping[int, drawings.SheetView],
    by_sha: Mapping[str, drawings.FileView],
) -> dict[tuple[uuid.UUID, uuid.UUID], int]:
    """For each sheet and PDF, the place in `found` of the PDF's page that is the sheet's own: of
    the pages naming it, one with its number whole (`registration.mention`) before one holding it
    among other words; then the one its drawing lies on best (the smaller residual: a real set had
    two pages with the number whole, the wrong one fitting at the residual's ceiling); then the
    larger text; then the first. A page that refers to a sheet whose own page is in the same PDF
    never takes it from that page."""
    best: dict[tuple[uuid.UUID, uuid.UUID], tuple[tuple[bool, float, float], int]] = {}
    for k, m in enumerate(found):
        sheet = by_candidate.get(id(m.sheet)) if m.sheet is not None else None
        pdf = by_sha.get(getattr(m.page, "source_sha256", ""))
        if sheet is None or pdf is None:
            continue
        page = m.page
        sure = registration.mention(page, sheet.number or "") if isinstance(page, Page) else None
        whole, height = sure or (False, -1.0)
        rank = (whole, -(m.residual if m.residual is not None else math.inf), height)
        kept = best.get((sheet.id, pdf.id))
        if kept is None or rank > kept[0]:
            best[(sheet.id, pdf.id)] = (rank, k)
    return {key: k for key, (_, k) in best.items()}


def _covering(sheet: drawings.SheetView, pdfs: Sequence[drawings.FileView]) -> list[drawings.FileView]:
    """The read PDFs that may plot the sheet, as the sheet list names them: its Discipline's first,
    then those of none, each first added first (a sheet of no Discipline: every PDF)."""
    mine = [p for p in pdfs if sheet.discipline is None or p.discipline in (None, sheet.discipline)]
    return sorted(mine, key=lambda p: (p.discipline is None, _added(p)))


def _keep_reasons(found: Sequence[PlotMatch], tried: Sequence[drawings.FileView]) -> None:
    """Each tried PDF's pages that matched no sheet, as its report's lines (18's reason, the page)."""
    for pdf in tried:
        lines: list[Message] = []
        for m in found:
            page = m.page
            if getattr(page, "source_sha256", None) != pdf.sha256 or m.sheet is not None:
                continue
            code = plot_codes.REASONS.get(m.reason or "")
            if code is not None:
                lines.append(code(page=getattr(page, "number", 0)))
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
