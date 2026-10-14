"""Step 1, Sheets (ticket 19a; docs/data-model.md §3.4; m0-screens 6.x): its Proposals, Questions,
Coverage and progress, and the confirm service, the only writer of what the QS decides about a sheet.

    step1.proposals(project_id)          # one per printed sheet, by Discipline, in natural number order
    step1.confirm(project_id, [ids], kind=None, actor_name=user.name)
    step1.exclude(project_id, [ids], "superseded", "", actor_name=user.name)
    step1.assign(project_id, [view ids], ["beams"], actor_name=user.name)   # views in Steps (#158)
    step1.undo(project_id)               # the acting user's own last act on Step 1
    step1.read_list(project_id, "architectural", "A-01 to A-07")   # parsed back, nothing stored
    step1.set_list(project_id, "architectural", text, actor_name=user.name)
    step1.drawing_list(project_id, "architectural"); step1.questions(project_id)
    step1.coverage(project_id); step1.progress(project_id)

**What the QS decides is written on the printed sheet** (14's SheetRevision, through
`drawings.services`): confirmed with its kind, or left out with one of the seven reasons (only
"other" keeps the QS's words). Each act is one Confirmation under the QS's name, which every decision
it made carries; `undo` reverses the acting user's last act, never another person's. A change to
Jev's pick is logged through 15's `record_override`, once per act, under the QS.

**A Proposal is named by its id**; a printed sheet the read job has not yet proposed (no Proposal
row: 21c writes them) is named by the printed sheet's id, and the act writes its Proposal. An id of
another Project, another Developer, or none, is the one "not found", and no act changes anything
unless every id it names is found.

**Step 1 is per Discipline** (s02 review Q6): each Discipline's sheets are counted on their own row,
n (decided: confirmed or left out) of N; a sheet of no Discipline is never left out, and is counted
on a row of its own, last (#102; how its number is compared is 21c's Question). A sheet the read
proposed out with no number (a cover, a stale layout; #162) is counted only once the QS confirms it
in; one with a number is counted as any other (m0-screens §7 counts A-07, a 3D view). N is the
drawing list's count where there is one; where a list read on a sheet and one the QS gave disagree,
N is unknown (`total` None, shown "—") until 21c's Question is answered.

**Coverage** (ADR 0027; m0-screens 6.11): one row per view, written from the view's proposal; a view
is proposed while its sheet is undecided, assigned once its sheet is confirmed with a step or its
Part, excluded once its sheet or itself is left out, unaccounted with no step, Part or exclusion.
**A Structural view the read gave no step** (#158: its own title and its sheet's name no subject, 17's
`views`) is given the Steps its sheet's confirmed kind names (`views.kind_steps`: `beam_details`,
beams) under the act confirming it; the QS may put any view not left out in Steps 2 to 14 (`assign`,
the API's only in M0: m0-screens 6.9). A step given by an act stands while the act is not undone
(`CoverageStep.confirmation`; the app deletes no row).

For the seed and 21c's read job: `propose_sheet`, `record_coverage` (`propose_views`: a file's views
at once), `raise_question`, `answer_question` and `record_progress` write the rows Step 1 reads.
"""

import contextlib
import contextvars
import hashlib
import json
import re
import uuid
from collections import Counter
from collections.abc import Callable, Collection, Hashable, Iterable, Iterator, Mapping, Sequence
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime
from decimal import Decimal
from typing import Any, cast

from django.db import connection, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from engine.check import register
from engine.messages import Message, MessageCode
from engine.messages import register_check as list_codes
from engine.recognise import views as view_finder
from engine.recognise.conflicts import Numbers, recognisers
from engine.recognise.sheets import default_conventions
from engine.recognise.types import DisciplineConvention, SheetConventions, ValueSource
from vextrus.drawings import services as drawings
from vextrus.platform.services import activity, auth, events, invitations, jev, markets, tenancy
from vextrus.projects import services as projects
from vextrus.takeoff import acts
from vextrus.takeoff.library import EXPECTED, SHEETS, STEPS
from vextrus.takeoff.messages import proposals as answer_codes
from vextrus.takeoff.messages import step1 as said
from vextrus.takeoff.models import (
    CheckFinding,
    CheckRun,
    CheckTrigger,
    Confirmation,
    ConfirmationAct,
    ConfirmationKind,
    Coverage,
    CoverageStatus,
    CoverageStep,
    DrawingRegister,
    Proposal,
    ProposalStatus,
    ProposalSubject,
    ProposalTrace,
    Question,
    QuestionKind,
    QuestionLink,
    QuestionStatus,
    RecogniseRun,
    RegisterEntry,
    RegisterSource,
    StepProgress,
)
from vextrus.takeoff.services.issue_dates import iso_date

OTHER = "other"
"""The one reason that keeps the QS's words."""
KEEP_OPEN = "keep_open"
"""Every Question's last option: the Question stays open (m0-screens §5)."""
UNREAD_FAMILY = "sheets_unread"
"""The RecogniseRun family that keeps, per file (`cache_key`: its id), the sheets its read found
(`candidates`) and those left out for unreadable writing (`reused_answers`, #135)."""


# What Step 1 shows --------------------------------------------------------------------------------


@dataclass(frozen=True)
class ProposalView:
    id: uuid.UUID
    """The Proposal's id; the printed sheet's while the read job has not proposed it."""
    sheet_id: uuid.UUID
    """The printed sheet's (the SheetRevision's) id."""
    number: str | None
    title: str
    revision_mark: str
    revision_mark_source: str | None
    issue_date: str | None
    """The title block's issue date as an ISO date ("2026-09-12"), read in the Market's order; null
    where it wrote none or none that is one calendar day (issue_dates)."""
    discipline: str | None
    file_id: uuid.UUID
    file_name: str
    kind: str | None
    """The kind as read (the sheet's), else Jev's choice."""
    jev_pick: dict[str, Any] | None
    """Jev's answer, `{choice, options}`: what the confirm service logs a change to."""
    held: bool
    proposed_exclusion: str | None
    decision: str | None
    confirmed_kind: str | None
    excluded_reason: str | None
    excluded_text: str
    decided_by: str | None
    decided_at: datetime | None
    decided_act: str | None = None
    """The kind of the act that decided it (`ConfirmationKind`: `single`, `bulk`, or
    `question_answer` when answering a Question confirmed or left it out); None while undecided."""
    agrees: bool = False
    """Two sources agree on it (m0-screens §5, "What 'agrees' means"): its number and title from its
    title block, and its Discipline's drawing list naming it, or, with no list, its Plot page matched
    with its number and title read alike (#229; a numbering gap holds only the sheets beside it, by
    its open Question); never while held or in an open Question. Only such a sheet joins the bulk
    act (6.4); the others are Proposals "with one source"."""
    agrees_by: str | None = None
    """Its second source while it `agrees`: "list", "plot" or "run" (an unbroken run of numbers with
    no list and no PDF, the session-18 ruling); None while it does not. The bar words it (4.7)."""
    decided_by_role: str | None = None
    """The actor's role in the Developer ("qs", "vextrus_engineer"): "Nusrat Jahan, QS" (6.6)."""
    decided_with: int = 0
    """How many sheets the act that decided it decided: "Confirmed in bulk with 55 other sheets"."""
    number_source: str | None = None
    """Where its number was read: "title_block_attribute", "title_block_text", …; None for none."""
    title_source: str | None = None
    storeys_as_stated: str = ""
    storeys_titled: tuple[str, ...] | None = None
    """The storey keys its title's storey words read to (17's `views.titled_storeys`, with where a
    range runs to, a range's `top` resolved to the set's highest numbered floor: 13's `to_top`),
    derived on the read and stored nowhere; None when it states none or they read to
    no key. The screen words these, never the stated words (S15-E3)."""
    layout: str | None = None
    """The layout it is laid out on, by name; None when laid out in the drawing (a frame)."""
    x_mm: float | None = None
    """Where its frame's left edge sits in its file's drawing, in millimetres (m0-screens 6.7's
    "laid out in the drawing, x 2,460 ft"); None on a layout, and for a unit the file does not name."""
    plot_file: str | None = None
    plot_page: int | None = None
    plot_residual: str | None = None
    plot_title_alike: bool = False
    """Its Plot page reads its title as well as its number (#229): the page is its second source."""
    plot_none: dict[str, Any] | None = None
    """Why it has no Plot (a message), or None when a page matched or no PDF was added."""
    views: list[SheetViewView] = field(default_factory=list)
    """Its views in reading order, title block included."""
    continuation: str | None = None
    """The continuation run it is in, by the run's first sheet's id (`groups`, T-W334); None alone."""
    continuation_title: str | None = None
    """The run's title, its member-mark ranges joined ("GRADE BEAM GB2-GB14 DETAILS"); None alone."""
    series: str | None = None
    """The series it is in, by the series' first sheet's id; None when it is in none."""
    corrected: bool = False
    """A correction still standing changed its number or title (the State column's ", corrected",
    m0-screens 6.9)."""


@dataclass(frozen=True)
class SheetViewView:
    """A view on a printed sheet as Step 1 shows it (m0-screens §6.6's Views, §6.5's outlines)."""

    id: uuid.UUID
    ordinal: int
    kind: str
    title: str
    stated_scale: str
    not_to_scale: bool
    storeys: list[str]
    storeys_as_stated: str
    storeys_meaning: str | None
    storeys_source: str | None
    """Where its storeys were read: None for its own title, "sheet_title" for its sheet's (T-W318),
    "title_line" for a bracketed line under its title (S15-E3), "typed" once the QS corrected them
    (S24-B2; the steps after Step 1 read a typed view as one of its own title)."""
    steps: list[str]
    part: str | None
    proposed_exclusion: str | None
    decision: str | None
    excluded_reason: str | None
    box: list[str]
    """x0, y0, x1, y1 in drawing units, as decimal strings (as read)."""


@dataclass(frozen=True)
class QuestionView:
    id: uuid.UUID
    kind: str
    status: str
    code: str
    params: dict[str, Any]
    options: list[Any]
    discipline: str | None
    subject_id: uuid.UUID | None
    check_code: str | None
    answer: Any
    answered_at: datetime | None
    proposals: list[uuid.UUID] = field(default_factory=list)
    """The Proposals it holds (answering confirms or leaves them out)."""
    withdrawn_by: uuid.UUID | None = None
    """While `withdrawn` by leaving its sheet out: that exclusion (the act `undo` takes back). Such a
    Question still holds its sheet: it is answerable, and its sheet is not confirmed back in until it
    is answered (`takeoff.step1.question_first` names it). None for any other state, and for a
    Question withdrawn because a newer one replaced it."""
    blocking: bool = False
    """It holds its sheets from being confirmed: open, or withdrawn by an exclusion that still stands."""
    raised: int | None = None
    """Its place among the Project's Step 1 Questions in the order they were raised (open, answered
    and withdrawn alike), from 1: its tag (Q1…) for life, whatever is answered or left out later."""


@dataclass(frozen=True)
class UnaccountedView:
    id: uuid.UUID
    """The view's Proposal: `exclude` takes it as it takes a sheet's."""
    view_id: uuid.UUID
    sheet_id: uuid.UUID


@dataclass(frozen=True)
class CoverageView:
    views: int
    assigned: int
    excluded: int
    proposed: int
    unaccounted: int
    used: int
    by_step: dict[str, int] = field(default_factory=dict)
    """Views by the step (or Part) that will read them, proposed or assigned."""
    by_reason: dict[str, int] = field(default_factory=dict)
    """Views excluded and confirmed so, by reason: they add up to `excluded`. A view only proposed to be
    left out counts under `proposed` alone (m0-screens 6.11)."""
    unaccounted_views: list[UnaccountedView] = field(default_factory=list)
    unread_sheets: int = 0
    """Sheets the read left out for unreadable writing (#135): never silently unread."""


@dataclass(frozen=True)
class DisciplineProgress:
    discipline: str | None
    confirmed: int
    """n: its sheets decided (confirmed or left out)."""
    found: int
    """Its sheets in the sheet list."""
    listed: int | None
    """Its drawing list's count, or None with no list."""
    lists_disagree: bool
    total: int | None
    """N: the drawing list's count, else the sheets found; None ("—") while two lists disagree."""
    open_questions: int
    status: str = "not_started"
    """The StepProgress status: `confirmed` when every sheet is decided, no Question is open or
    kept open, no view is unaccounted and no file of it is reading (m0-screens 6.11); else
    `in_review` (or `not_started` with no sheet)."""
    outstanding: list[Message] = field(default_factory=list)
    """What keeps it from `confirmed` (#158), each a code with how many, in m0-screens 5's order;
    empty once confirmed."""
    plots: tuple[PlotFile, ...] = ()
    """The Plots read for it (157): each read PDF of its Discipline, and any other a sheet of it has
    a page of, first added first; so a line about its sources can name the Plot added."""


@dataclass(frozen=True)
class PlotFile:
    file_id: uuid.UUID
    name: str


@dataclass(frozen=True)
class ProgressView:
    disciplines: list[DisciplineProgress]
    not_received: list[str]
    """The Market's expected Disciplines of which no file has been added, in the Market's order."""
    qs: list[str] = field(default_factory=list)
    """The names of the QS members who may open the Project: whom the MD's and a Guest's bar names
    ("Nusrat Jahan (QS) confirms the sheet list", m0-screens §6.12)."""


@dataclass(frozen=True)
class ActView:
    confirmation_id: uuid.UUID
    act: str
    sheets: int
    by: str
    at: datetime


@dataclass(frozen=True)
class HistoryAct:
    """One act on a sheet, from the event log (m0-screens 6.6 item 5, "Who did what")."""

    id: uuid.UUID
    """The act's Confirmation: an undo has its undone act's."""
    code: str
    """The event's code (`takeoff.step1.` + `confirmed`, `confirmed_back_in`, `excluded`, `corrected`
    or `undone`)."""
    actor: str
    """The person's name as it was then."""
    actor_role: str | None
    at: datetime
    sheets: int | None = None
    """How many sheets the act decided."""
    reason: str | None = None
    """An exclusion's reason key."""
    text: str | None = None
    """An exclusion's "other" words, as the QS typed them."""
    changes: dict[str, dict[str, str | None]] | None = None
    """A correction's `{number?, title?: {old, new, old_source}}`."""
    views: list[dict[str, Any]] | None = None
    """A correction's plan views' storeys: `{title, old, new}` each, storey keys low to high (S24-B2)."""


@dataclass(frozen=True)
class ParsedList:
    discipline: str
    source: str
    numbers: list[str]
    ignored: int
    entries: list[dict[str, Any]]


@dataclass(frozen=True)
class ListView:
    discipline: str
    source: str | None
    numbers: list[str]
    ignored: int
    entered_by: str | None
    entered_at: datetime | None
    read_numbers: list[str] | None
    """The list read on a sheet of the set, when there is one."""
    agrees: bool
    read_on: uuid.UUID | None = None
    """The printed sheet the list read on a sheet was read on ("13 on the drawing list on S-01")."""
    read_revisions: dict[str, str] = field(default_factory=dict)
    """Each number the list read on a sheet gives a revision mark, with that mark ("S-07": "B"): a
    source of its own for which copy of a number is current (m0-screens 7, "Two sheets, one number")."""


# Reading ------------------------------------------------------------------------------------------


def _tenant() -> uuid.UUID:
    found = tenancy.current_tenant_id()
    if found is None:
        raise auth.NotFound
    return found


def _user() -> uuid.UUID:
    user_id = tenancy.current().user_id
    if user_id is None:
        raise auth.NotSignedIn
    return user_id


def _sheets(project_id: uuid.UUID) -> list[drawings.SheetView]:
    """The Project's printed sheets in the sheet list (the scope checked first); none before a file.
    Their anchors are not read (`drawings.UNLOADED`): Step 1's lists and acts never use them.
    Inside an act, read once between its writes (`_remembered`)."""

    def read() -> list[drawings.SheetView]:
        _in_scope(project_id)
        drawing_set = _set_of(project_id)
        return drawings.sheets(drawing_set.id, anchors=False) if drawing_set else []

    return list(_remembered(("sheets", project_id), read))


def sheets_of(project_id: uuid.UUID) -> list[drawings.SheetView]:
    """`_sheets`, for the conflicts' pass after an act (`proposals.set_conflicts`)."""
    return _sheets(project_id)


def _sheet(sheet_id: uuid.UUID) -> drawings.SheetView:
    """One printed sheet of the sheet list, without its anchors: Step 1 never reads them (its Traces
    are given, never read back), so no act, list or proposal reads that heavy JSON (S15-A1). Every
    read of one sheet in this module goes through here (`test_step1_reads_no_anchors`)."""
    return drawings.sheet(sheet_id, anchors=False)


def _facts_by_id(project_id: uuid.UUID) -> dict[uuid.UUID, drawings.SheetFacts]:
    return {s.id: s for s in _facts(project_id)}


def _facts(project_id: uuid.UUID) -> list[drawings.SheetFacts]:
    """`_sheets` as facts (`drawings.sheet_facts`, one statement): for counts and membership tests.
    Inside an act, read once between its writes (`_remembered`)."""

    def read() -> list[drawings.SheetFacts]:
        _in_scope(project_id)
        drawing_set = _set_of(project_id)
        return drawings.sheet_facts(drawing_set.id) if drawing_set else []

    return list(_remembered(("facts", project_id), read))


def _proposals_of(project_id: uuid.UUID, among: Q | None = None) -> list[Proposal]:
    """The Project's sheet Proposals not superseded; `among`: only those it matches."""
    found = Proposal.objects.filter(
        project_id=project_id, step=SHEETS, subject=ProposalSubject.SHEET
    ).exclude(status=ProposalStatus.SUPERSEDED)
    return list(found if among is None else found.filter(among))


def proposals(project_id: uuid.UUID, only: Collection[uuid.UUID] | None = None) -> list[ProposalView]:
    """One per printed sheet in the sheet list, by Discipline in the Market's order (a sheet of no
    Discipline last), then number in natural order (S-2 before S-10), unnumbered last. An undecided
    sheet's `kind` is the one its kind Question was answered with while it still stands in that
    Question's Discipline (`_kinds_answered`, read as its confirmation reads it; never stored on the
    sheet: S18-Q1), else the kind as read, else Jev's pick.

    `only`: just these printed sheets' rows (by sheet id), each exactly as the whole list words it
    (its group, its agreeing and its storeys are still read across the set), with the per-row reads
    made for them alone: an answer's reply (`Answered.moved`, S27-G7)."""
    from vextrus.takeoff.services import groups  # it reads 19b's candidates of the read job's

    sheets = _sheets(project_id)
    shown_ids = None if only is None else set(only)
    listed = sheets if shown_ids is None else [s for s in sheets if s.id in shown_ids]
    by_sheet = {p.subject_id: p for p in _proposals_of(project_id)}
    answered = _kinds_answered(
        project_id, [p.id for s in listed if not s.decision and (p := by_sheet.get(s.id)) is not None]
    )
    drawing_set = _set_of(project_id)
    files = files_of(project_id)
    names = {f.id: f.name for f in files}
    of_set = drawings.views_of_set(drawing_set.id, anchors=False) if drawing_set else {}
    viewed = [of_set.get(s.id, []) for s in sheets]  # read once: each row's and the groups'
    grouped = groups.among(sheets, viewed, {f.id: f.group for f in files}, sheet_conventions())
    stamps = {s.confirmation_id for s in listed if s.confirmation_id}
    # Who and when, from the act that decided each sheet (a decision put back by an undo keeps its
    # own act's name and time).
    acts = list(Confirmation.objects.filter(id__in=stamps))
    who = {c.id: (c.by_name, c.at, c.kind) for c in acts}
    roles = invitations.roles_of({c.user_id for c in acts})
    role = {c.id: roles.get(c.user_id) for c in acts}
    size = {c.id: c.proposals for c in acts}
    agreeing = _agreeing(project_id, sheets, by_sheet)
    corrected = _corrected(project_id)
    order = markets.of_developer(_tenant()).date_order
    titled = _titled({s.storeys_as_stated for s in sheets})
    # A range to the roof or the top floor shown up to the set's highest numbered floor (S21-C4):
    # read across every file's titles and views, here only; the checks above compare as read.
    highest = view_finder.highest_floor(
        [*(k for k in titled.values() if k), *(v.storeys for vs in viewed for v in vs)]
    )
    titled = {text: _to_top(keys, highest) for text, keys in titled.items()}
    if shown_ids is not None:
        viewed = [vs for s, vs in zip(sheets, viewed, strict=True) if s.id in shown_ids]
    shown = _as_coverage_stands(
        project_id, listed, [[_view_to_top(v, highest) for v in vs] for vs in viewed]
    )
    return [
        replace(
            _proposal_view(s, by_sheet.get(s.id), views, names, who, order, answered),
            agrees=s.id in agreeing,
            agrees_by=agreeing.get(s.id),
            storeys_titled=titled.get(s.storeys_as_stated),
            decided_by_role=role.get(s.confirmation_id) if s.confirmation_id else None,
            decided_with=size.get(s.confirmation_id, 0) if s.confirmation_id else 0,
            corrected=s.id in corrected,
            **asdict(grouped.get(s.id, groups.ALONE)),
        )
        for s, views in zip(listed, shown, strict=True)
    ]


def _corrected(project_id: uuid.UUID) -> set[uuid.UUID]:
    """The printed sheets a correction still standing changed."""
    kept = Confirmation.objects.filter(
        project_id=project_id, step=SHEETS, act=ConfirmationAct.CORRECT, undone_at__isnull=True
    ).values_list("before", flat=True)
    return {uuid.UUID(c["sheet"]) for before in kept if (c := before.get("corrected"))}


def _to_top(keys: tuple[str, ...] | None, highest: int | None) -> tuple[str, ...] | None:
    return view_finder.to_top(keys, highest) if keys else keys


def _view_to_top(view: drawings.ViewView, highest: int | None) -> drawings.ViewView:
    """A view as Step 1 shows it: a range's `top` resolved (13's `storeys.to_top`)."""
    storeys = view_finder.to_top(view.storeys, highest)
    return view if storeys == view.storeys else replace(view, storeys=storeys)


def _as_coverage_stands(
    project_id: uuid.UUID,
    sheets: Sequence[drawings.SheetView],
    shown: list[list[drawings.ViewView]],
) -> list[list[drawings.ViewView]]:
    """Once a sheet is decided, each of its views shows the steps and Part its Coverage row now
    stands at (`_steps_standing` under the sheet's deciding Confirmation; the Part is `part_key`),
    not the read's own, so a view's chips and Coverage's unaccounted count never disagree (S24-C2,
    M0-FL7). An undecided sheet's views stay as read. Every decided sheet's Coverage rows in one query
    and their standing steps once, never one query per sheet."""
    decided = {s.id: s.confirmation_id for s in sheets if s.decision}
    if not decided:
        return shown
    rows = list(Coverage.objects.filter(project_id=project_id, sheet_revision_id__in=list(decided)))
    standing = _steps_standing(rows, decided)
    of_view = {r.view_id: r for r in rows}
    return [
        [
            _stands_at(v, of_view[v.id], standing.get(of_view[v.id].id, ()))
            if s.id in decided and v.id in of_view
            else v
            for v in views
        ]
        for s, views in zip(sheets, shown, strict=True)
    ]


def _stands_at(
    view: drawings.ViewView, row: Coverage, steps: Sequence[CoverageStep]
) -> drawings.ViewView:
    """The view as its Coverage row stands: the steps standing for it and its Part, and, where the
    row stands excluded (its sheet excluded, or the view), the exclusion and its reason: Coverage counts
    it excluded, so its chip must not read "no step: unaccounted"."""
    stood = replace(view, steps=tuple(s.step for s in steps), part=row.part_key or None)
    if row.status != CoverageStatus.EXCLUDED:
        return stood
    return replace(stood, decision="excluded", excluded_reason=row.reason, excluded_text=row.reason_text)


def _titled(stated: Iterable[str]) -> dict[str, tuple[str, ...] | None]:
    """Each distinct storey wording a sheet's title states, read once to its storey keys
    (`ProposalView.storeys_titled`)."""
    conventions = sheet_conventions()
    found: dict[str, tuple[str, ...] | None] = {}
    for text in stated:
        if text:
            found[text] = view_finder.titled_storeys(text, conventions) or None
    return found


_TITLE_BLOCK = frozenset({ValueSource.TITLE_BLOCK_ATTRIBUTE, ValueSource.TITLE_BLOCK_TEXT})


def _agreeing(
    project_id: uuid.UUID,
    sheets: Sequence[drawings.SheetView],
    by_sheet: Mapping[uuid.UUID, Proposal],
) -> dict[uuid.UUID, str]:
    """The printed sheets two sources agree on (`ProposalView.agrees`), each with its second source:
    "list", "plot" or "run" (`ProposalView.agrees_by`)."""
    open_questions = Question.objects.filter(
        project_id=project_id, step=SHEETS, status=QuestionStatus.OPEN
    )
    asked = set(open_questions.exclude(subject_id=None).values_list("subject_id", flat=True))
    gap_codes = {list_codes.GAP.code, list_codes.GAPS.code}
    held = _held(project_id, open_questions.values_list("id", flat=True))
    gapped = set(open_questions.filter(message_code__in=gap_codes).values_list("id", flat=True))
    linked = {p for q, ps in held.items() if q not in gapped for p in ps}
    # A numbering gap holds its neighbours only while its Discipline has no drawing list (#229): a
    # list typed after the gap was asked is the second source, not the numbering. `_held` cuts a gap
    # Question's hold to the sheets beside its gaps now (`_beside_now`).
    gap_linked = {p for q, ps in held.items() if q in gapped for p in ps}
    conventions = _conventions()
    numbers = Numbers(conventions, recognisers(conventions))
    beside = _beside_gaps(open_questions, numbers)
    of_discipline: dict[str, list[drawings.SheetView]] = {}
    for sheet in sheets:
        if sheet.discipline is not None:
            of_discipline.setdefault(sheet.discipline, []).append(sheet)
    agreeing: dict[uuid.UUID, str] = {}
    for discipline, everyone in of_discipline.items():
        # Two sheets of one number never agree: which of them is the sheet is a Question's.
        keys = Counter(numbers.key(s.number, discipline) for s in everyone if s.number)
        mine = [s for s in everyone if s.number and keys[numbers.key(s.number, discipline)] == 1]
        lists = _lists(project_id, discipline)
        standing = lists.standing
        if standing is not None and not lists.disagree:
            listed = {numbers.key(n, discipline) for n in _numbers(standing)}
            second = {s.id for s in mine if s.number and numbers.key(s.number, discipline) in listed}
            source = "list"
        elif standing is None and any(s.plot.file_id or s.plot.page is not None for s in everyone):
            # A matched Plot page whose number and title read alike, gap or no gap (#229): a gap
            # holds only the sheets beside it, through its open Question's links.
            second = {s.id for s in mine if s.plot.page is not None and s.plot.title_alike}
            source = "plot"
        elif standing is None:
            # No list and no PDF in this Discipline: an unbroken run of running numbers is the
            # second source (the owner's ruling, session 18, docs/rulings.md). A gap ends a run;
            # a number held twice breaks none; a lone number has no run. The sheets beside an open
            # gap stay held below.
            places = {_place(numbers, s.number, discipline) for s in everyone if s.number} - {None}
            second = {s.id for s in mine if _in_run(_place(numbers, s.number, discipline), places)}
            source = "run"
        else:
            second = set()
            source = "list"
        for sheet in mine:
            proposal = by_sheet.get(sheet.id)
            if (
                sheet.id in second
                and not sheet.held
                and sheet.sources.get("number") in _TITLE_BLOCK
                and sheet.sources.get("title") in _TITLE_BLOCK
                and sheet.id not in asked
                and (proposal is None or proposal.id not in linked)
                and (
                    standing is not None
                    or (
                        (proposal is None or proposal.id not in gap_linked)
                        and _place(numbers, sheet.number, discipline)
                        not in beside.get(discipline, set())
                    )
                )
            ):
                agreeing[sheet.id] = source
    return agreeing


def gap_ends(question: Question) -> list[tuple[str, str, int]]:
    """A numbering gap Question's gaps, `(after, before, missing)` each: the merged Question's list,
    or an older Question's one gap (asked one per gap before #229); none for another Question."""
    params = question.params if isinstance(question.params, dict) else {}
    if question.message_code == list_codes.GAPS.code:
        found = params.get("gaps")
        listed = [g for g in found if isinstance(g, dict)] if isinstance(found, list) else []
    elif question.message_code == list_codes.GAP.code:
        listed = [params]
    else:
        return []
    return [
        (str(g.get("after", "")), str(g.get("before", "")), int(g.get("missing") or 0)) for g in listed
    ]


def _beside_gaps(questions: QuerySet[Question], numbers: Numbers) -> dict[str, set[Hashable]]:
    """The places (series and running number, a suffix aside: "S-04A" is beside a gap after "S-04")
    of the sheets either side of each gap an open gap Question asks, by Discipline: held while it is
    open (#229), whatever the sheets' decisions were when it was asked (an undo brings one back)."""
    codes = [list_codes.GAP.code, list_codes.GAPS.code]
    held: dict[str, set[Hashable]] = {}
    for question in questions.filter(message_code__in=codes):
        for after, before, _missing in gap_ends(question):
            for end in (after, before):
                place = _place(numbers, end, question.discipline)
                if place is not None:
                    held.setdefault(question.discipline, set()).add(place)
    return held


def _in_run(place: Hashable | None, places: set[Hashable | None]) -> bool:
    """Whether a place (series, running number) has a neighbour either side in its series."""
    if place is None:
        return False
    series, at = cast("tuple[Hashable, int]", place)
    return (series, at - 1) in places or (series, at + 1) in places


def _place(numbers: Numbers, number: str | None, discipline: str) -> Hashable | None:
    """A number's series and running number in its Discipline (its suffix aside); none without."""
    parts = numbers.parts_in(number, discipline) if number else None
    return None if parts is None else (parts[0], parts[1])


_UNIT_MM = {"inch": Decimal("25.4"), "ft": Decimal("304.8"), "mm": Decimal(1), "m": Decimal(1000)}


def _frame_x_mm(sheet: drawings.SheetView) -> float | None:
    """The left edge of the frame a sheet is laid out in, in millimetres: its stored box's x0 in the
    file's drawing units. None for a sheet on a layout (no box), or a file whose unit is not named."""
    box = sheet.location.get("box")
    unit = _UNIT_MM.get(sheet.drawing_unit)
    if unit is None or not isinstance(box, list | tuple) or not box:
        return None
    try:
        x = Decimal(str(box[0])) * unit
    except ArithmeticError:
        return None
    return float(x) if x.is_finite() else None


def _proposal_view(
    sheet: drawings.SheetView,
    proposal: Proposal | None,
    views: Sequence[drawings.ViewView],
    names: Mapping[uuid.UUID, str],
    who: Mapping[uuid.UUID, tuple[str, datetime, str]],
    date_order: str,
    answered: Mapping[uuid.UUID, str],
) -> ProposalView:
    found = who.get(sheet.confirmation_id) if sheet.confirmation_id else None
    by, at, act = found if found else (None, None, None)
    pick = dict(proposal.jev_pick) if proposal and proposal.jev_pick else None
    return ProposalView(
        id=proposal.id if proposal else sheet.id,
        sheet_id=sheet.id,
        number=sheet.number,
        title=sheet.title,
        revision_mark=sheet.revision_mark,
        revision_mark_source=sheet.sources.get("revision_mark"),
        issue_date=iso_date(sheet.issue_date, date_order),
        discipline=sheet.discipline,
        file_id=sheet.file_id,
        file_name=names.get(sheet.file_id, ""),
        kind=(answered.get(proposal.id) if proposal else None)
        or sheet.kind
        or (pick or {}).get("choice"),
        jev_pick=pick,
        held=sheet.held,
        proposed_exclusion=sheet.proposed_exclusion,
        decision=sheet.decision,
        confirmed_kind=sheet.confirmed_kind,
        excluded_reason=sheet.excluded_reason,
        excluded_text=sheet.excluded_text,
        decided_by=by,
        decided_at=at or sheet.decided_at,
        decided_act=act if sheet.decision else None,
        number_source=sheet.sources.get("number"),
        title_source=sheet.sources.get("title"),
        storeys_as_stated=sheet.storeys_as_stated,
        layout=layout if isinstance(layout := sheet.location.get("layout"), str) else None,
        x_mm=_frame_x_mm(sheet),
        plot_file=names.get(sheet.plot.file_id) if sheet.plot.file_id and sheet.plot.page else None,
        plot_page=sheet.plot.page,
        plot_residual=sheet.plot.residual,
        plot_title_alike=sheet.plot.page is not None and sheet.plot.title_alike,
        plot_none=dict(sheet.plot.none) if sheet.plot.none else None,
        views=[_sheet_view_view(v) for v in views],
    )


def _sheet_view_view(view: drawings.ViewView) -> SheetViewView:
    return SheetViewView(
        id=view.id,
        ordinal=view.ordinal,
        kind=view.confirmed_kind or view.kind,
        title=view.title,
        stated_scale=view.stated_scale,
        not_to_scale=view.not_to_scale,
        storeys=list(view.storeys),
        storeys_as_stated=view.storeys_as_stated,
        storeys_meaning=view.storeys_meaning,
        # A part plan the QS corrected is "typed" to the web, as any other (the part-plan standing is the
        # steps' business).
        storeys_source="typed" if view.storeys_source == drawings.TYPED_PART else view.storeys_source,
        steps=list(view.steps),
        part=view.part,
        proposed_exclusion=view.proposed_exclusion,
        decision=view.decision,
        excluded_reason=view.excluded_reason,
        box=list(view.box),
    )


def questions(project_id: uuid.UUID) -> list[QuestionView]:
    """The Project's Step 1 Questions: the open ones in queue order (m0-screens §5: a held file first,
    as it holds a whole file; then those holding the most sheets; then conflicts, missing items and
    low-confidence ones; then as they were raised), then those answered or withdrawn."""
    _in_scope(project_id)
    held = _held(project_id)
    found = _asked(project_id, Question.objects.filter(project_id=project_id, step=SHEETS), held)
    # Counted over every Step 1 Question, asked still or not, so no tag moves when one stops being asked.
    raised = {
        qid: place
        for place, qid in enumerate(
            Question.objects.filter(project_id=project_id, step=SHEETS)
            .order_by("created_at", "id")
            .values_list("id", flat=True),
            start=1,
        )
    }

    def queued(q: Question) -> tuple[Any, ...]:
        # m0-screens §5: the held file first, then the Questions holding the most sheets, then
        # conflicts, missing items and low-confidence ones, then as they were raised.
        return (
            q.status != QuestionStatus.OPEN,
            q.kind != QuestionKind.FILE_MISREAD,
            -len(held.get(q.id, ())),
            _QUEUE.get(q.kind, len(_QUEUE)),
            q.created_at,
            q.id,
        )

    return [
        _question_view_of(q, held.get(q.id, []), raised.get(q.id)) for q in sorted(found, key=queued)
    ]


def _question_view_of(q: Question, held: list[uuid.UUID], raised: int | None) -> QuestionView:
    """A Question as `questions` lists it: `held`, its Proposals in link order; `raised`, its place
    among the Project's Step 1 Questions by when raised."""
    return QuestionView(
        id=q.id,
        kind=q.kind,
        status=q.status,
        code=q.message_code,
        params=_worded(q.project_id, q, held),
        options=list(q.options),
        discipline=q.discipline or None,
        subject_id=q.subject_id,
        check_code=q.check_code or None,
        answer=q.answer,
        answered_at=q.answered_at,
        proposals=held,
        withdrawn_by=q.withdrawn_by_id if q.status == QuestionStatus.WITHDRAWN else None,
        blocking=q.kind in FIRST
        and (q.status == QuestionStatus.OPEN or _withdrawn_by_standing_exclusion(q)),
        raised=raised,
    )


def _worded(project_id: uuid.UUID, q: Question, held: Sequence[uuid.UUID]) -> dict[str, Any]:
    """A Question's words' values as listed. A kind Question's (S15-Q1's groups) are read from the
    sheets it holds now (`held`, the links standing: S18-Q1's re-read rule, never stored): one names
    its sheet, more count them, and an open one counts the sheets its answer would leave open
    (`waiting`: review 2, l3-f2). So its words never say a number its card does not list."""
    if not _grouped(q):
        return dict(q.params)
    if len(held) == 1:
        sheet_id = Proposal.objects.filter(project_id=project_id, id=held[0]).values_list(
            "subject_id", flat=True
        )
        return kind_words([_sheet(s) for s in sheet_id])
    waiting = len(_kind_split(project_id, q, held)[1]) if q.status == QuestionStatus.OPEN else 0
    return {**kind_words([None] * len(held)), "waiting": waiting}


def kind_words(sheets: Sequence[drawings.SheetView | None]) -> dict[str, Any]:
    """A kind Question's words for the sheets it holds (`takeoff.proposals.which_kind`): one sheet by
    its number or title; more as a group, counted."""
    if len(sheets) == 1:
        return {**_named(sheets[0]), "sheets": 1}
    return {"sheet": "", "named": "group", "sheets": len(sheets)}


def _grouped(q: Question) -> bool:
    """Whether the Question is a kind Question (`ask_group`'s): its words are read from what it holds."""
    return q.kind == QuestionKind.LOW_CONFIDENCE and q.message_code == answer_codes.WHICH_KIND.code


_QUEUE: dict[str, int] = {
    QuestionKind.CONFLICT: 0,
    QuestionKind.MISSING: 1,
    QuestionKind.MISSING_DISCIPLINE: 1,
    QuestionKind.LOW_CONFIDENCE: 2,
}
"""The queue's order by kind, after the held file and the Questions holding the most sheets."""


def _held(
    project_id: uuid.UUID, among: Iterable[uuid.UUID] | None = None
) -> dict[uuid.UUID, list[uuid.UUID]]:
    """What each Question holds (of `among`, by id; else every one), its Proposals in the order
    linked: the one reading of a Question's membership, which every reader takes (the listed card,
    its words, its answer and `group_changed`, bulk confirm's hold check, `agrees`; S18-Q1's re-read
    rule, review 1 of #628). A kind Question holds no link it let go (`_let_go`), and an open one no
    sheet already decided (its answer would not decide it again). A numbering gap Question holds only
    the sheets beside its gaps now (`_beside_now`, S15-Q2). Inside an act, read once between its
    writes (`_remembered`)."""
    asked = None if among is None else frozenset(among)
    found = _remembered(("held", project_id, asked), lambda: _held_read(project_id, asked))
    return {q: list(ps) for q, ps in found.items()}


def _held_read(
    project_id: uuid.UUID, among: frozenset[uuid.UUID] | None
) -> dict[uuid.UUID, list[uuid.UUID]]:
    gone = _let_go(project_id)
    done = {s.id for s in _facts(project_id) if s.decision}
    links = QuestionLink.objects.filter(project_id=project_id)
    if among is not None:
        links = links.filter(question_id__in=list(among))
    held: dict[uuid.UUID, list[uuid.UUID]] = {}
    for question_id, proposal_id, sheet_id, kind, code, status in links.order_by("id").values_list(
        "question_id",
        "proposal_id",
        "proposal__subject_id",
        "question__kind",
        "question__message_code",
        "question__status",
    ):
        if (question_id, proposal_id) in gone:
            continue
        asking_kind = kind == QuestionKind.LOW_CONFIDENCE and code == answer_codes.WHICH_KIND.code
        if asking_kind and status == QuestionStatus.OPEN and sheet_id in done:
            continue
        held.setdefault(question_id, []).append(proposal_id)
    return _beside_now(project_id, held)


def _beside_now(
    project_id: uuid.UUID, held: Mapping[uuid.UUID, Sequence[uuid.UUID]]
) -> dict[uuid.UUID, list[uuid.UUID]]:
    """`held` (Proposals by Question) with each numbering gap Question's cut to the Proposals whose
    sheets are beside a gap it asks now (S15-Q2): the Discipline's one gap Question keeps its id while
    a later file adds or fills a gap (`ask_gaps`), and a Question's links are append-only (19a), so a
    sheet beside a gap since filled is linked still and held no more. A Proposal whose sheet is not in
    the sheet list stays (`_asked` reads it)."""
    out = {q: list(ps) for q, ps in held.items()}
    gapped = list(
        Question.objects.filter(
            project_id=project_id,
            id__in=list(held),
            message_code__in=[list_codes.GAP.code, list_codes.GAPS.code],
        )
    )
    if not gapped:
        return out
    conventions = _conventions()
    numbers = Numbers(conventions, recognisers(conventions))
    sheet_of = {s.id: s for s in _sheets(project_id)}
    subject = dict(
        Proposal.objects.filter(project_id=project_id, step=SHEETS).values_list("id", "subject_id")
    )
    for question in gapped:
        places = {
            _place(numbers, end, question.discipline) for gap in gap_ends(question) for end in gap[:2]
        }
        kept = []
        for proposal_id in out[question.id]:
            sheet_id = subject.get(proposal_id)
            sheet = sheet_of.get(sheet_id) if sheet_id is not None else None
            if sheet is None or (
                sheet.number and _place(numbers, sheet.number, question.discipline) in places
            ):
                kept.append(proposal_id)
        out[question.id] = kept
    return out


def _held_now(project_id: uuid.UUID, question: Question) -> list[uuid.UUID]:
    """One Question's Proposals, as `_held` reads them."""
    return _held(project_id, [question.id]).get(question.id, [])


def _let_go(project_id: uuid.UUID) -> set[tuple[uuid.UUID, uuid.UUID]]:
    """The (Question, Proposal) links a kind Question no longer stands on, read now (S18-Q1's re-read
    rule): its sheet is now of another Discipline than the Question's (the QS changed its file's;
    review 2, l1-f1), or the Question was answered without it (the sheet was of another Discipline
    then: the answer's `sheets` name those it stood on). Links are kept (append-only); such a sheet
    is not held by the Question and never takes its answer."""
    facts = _facts_by_id(project_id)
    gone: set[tuple[uuid.UUID, uuid.UUID]] = set()
    for question_id, asked_in, status, given, proposal_id, sheet_id in (
        QuestionLink.objects.filter(project_id=project_id, question__kind=QuestionKind.LOW_CONFIDENCE)
        .exclude(question__discipline="")
        .values_list(
            "question_id",
            "question__discipline",
            "question__status",
            "question__answer",
            "proposal_id",
            "proposal__subject_id",
        )
    ):
        sheet = facts.get(sheet_id)
        moved = sheet is not None and sheet.discipline != asked_in
        if moved or not _answered_over(status, given, proposal_id):
            gone.add((question_id, proposal_id))
    return gone


def _answered_over(status: str, given: object, proposal_id: uuid.UUID) -> bool:
    """Whether a kind Question's answer stood on the Proposal: true while it is not answered, and
    for an answer that names no `sheets` (given before S18-Q1)."""
    if status != QuestionStatus.ANSWERED or not isinstance(given, dict):
        return True
    sheets = given.get("sheets")
    return not isinstance(sheets, list) or str(proposal_id) in sheets


def _asked(
    project_id: uuid.UUID,
    found: Iterable[Question],
    held: Mapping[uuid.UUID, Sequence[uuid.UUID]],
    *,
    listed: set[uuid.UUID] | None = None,
) -> list[Question]:
    """The Questions still asked: one holding only sheets no longer in the sheet list (their file
    cancelled, or set aside) is not, so it neither shows nor holds its Discipline open; nor is a kind
    Question that let go of every sheet it held (each now of another Discipline: `_let_go`). That
    one is read again, never withdrawn, so it asks again once a sheet's file comes back (S18-Q1)."""
    found = list(found)
    on_list = listed if listed is not None else {s.id for s in _facts(project_id)}
    sheet_of = dict(
        Proposal.objects.filter(project_id=project_id, step=SHEETS).values_list("id", "subject_id")
    )
    linked = set(
        QuestionLink.objects.filter(
            project_id=project_id, question_id__in=[q.id for q in found]
        ).values_list("question_id", flat=True)
    )
    return [
        q
        for q in found
        if (not held.get(q.id) and q.id not in linked)
        or any(sheet_of.get(p) in on_list for p in held.get(q.id, ()))
    ]


def _in_list_order(
    project_id: uuid.UUID, deciding: Mapping[uuid.UUID, Any], found: list[UnaccountedView]
) -> list[UnaccountedView]:
    """The unaccounted views in the sheet list's order, then their reading order on the sheet: a
    Coverage query has no order of its own, and the list of entries must not move from load to load."""
    if len(found) < 2:
        return found
    drawing_set = _set_of(project_id)
    ordinals = {
        v.id: v.ordinal
        for views in (
            drawings.views_of_set(drawing_set.id, anchors=False) if drawing_set else {}
        ).values()
        for v in views
    }
    rank = {sheet_id: at for at, sheet_id in enumerate(deciding)}
    return sorted(
        found,
        key=lambda u: (rank.get(u.sheet_id, len(rank)), ordinals.get(u.view_id, 0), str(u.view_id)),
    )


def coverage(project_id: uuid.UUID) -> CoverageView:
    """Every view of every sheet in the sheet list, counted once (a held file's views are not
    counted until it is read anyway): assigned, excluded, proposed or unaccounted; used from M1."""
    deciding = {s.id: s.confirmation_id for s in _facts(project_id)}
    rows = [r for r in Coverage.objects.filter(project_id=project_id) if r.sheet_revision_id in deciding]
    counts: Counter[str] = Counter()
    by_step: Counter[str] = Counter()
    by_reason: Counter[str] = Counter()
    steps = _steps_standing(rows, deciding)
    used = 0
    unaccounted: list[UnaccountedView] = []
    view_proposals = {
        p.subject_id: p.id
        for p in Proposal.objects.filter(
            project_id=project_id, step=SHEETS, subject=ProposalSubject.VIEW
        )
    }
    for row in rows:
        counted = _counted(row)
        counts[counted] += 1
        if row.status == CoverageStatus.UNACCOUNTED:
            unaccounted.append(
                UnaccountedView(
                    view_proposals.get(row.view_id, row.view_id), row.view_id, row.sheet_revision_id
                )
            )
        if any(s.used for s in steps.get(row.id, ())):
            used += 1
        if counted == "excluded":
            # Only what the Coverage line counts as excluded (confirmed): a view proposed to be left
            # out is counted under "proposed" alone, so the two "excluded" figures agree.
            by_reason[row.reason] += 1
        elif row.status == CoverageStatus.ASSIGNED:
            # A view counts under every step and Part it serves (a toilet detail under the walls,
            # the rooms and the Plumbing and sanitary Part).
            served = [s.step for s in steps.get(row.id, ())]
            for step in served:
                by_step[step] += 1
            # A Structural or Architectural view's own Part is Step 2's Notes (m0-screens 6.11 names it
            # so): a view already in Step 2 is not counted there twice.
            notes = row.part_key in view_finder.STEP_DISCIPLINES and view_finder.GENERAL_NOTES in served
            if row.part_key and row.part_key not in served and not notes:
                by_step[row.part_key] += 1
    unaccounted = _in_list_order(project_id, deciding, unaccounted)
    return CoverageView(
        views=len(rows),
        assigned=counts["assigned"],
        excluded=counts["excluded"],
        proposed=counts["proposed"],
        unaccounted=counts["unaccounted"],
        used=used,
        by_step=dict(by_step),
        by_reason=dict(by_reason),
        unaccounted_views=unaccounted,
        unread_sheets=_unread(project_id),
    )


def _unread(project_id: uuid.UUID) -> int:
    """The sheets the read left out for unreadable writing, of the files in the sheet list."""
    drawing_set = _set_of(project_id)
    if drawing_set is None:
        return 0
    read = {
        str(f.id)
        for f in files_of(project_id)
        if f.state == drawings.FileState.READ or f.state == drawings.FileState.HELD
    }
    return sum(
        r.reused_answers
        for r in RecogniseRun.objects.filter(project_id=project_id, family_key=UNREAD_FAMILY)
        if r.cache_key in read
    )


def _counted(row: Coverage) -> str:
    if row.status == CoverageStatus.UNACCOUNTED:
        return "unaccounted"
    if row.confirmation_id is None:
        return "proposed"
    return "excluded" if row.status == CoverageStatus.EXCLUDED else "assigned"


def progress(project_id: uuid.UUID) -> ProgressView:
    """Step 1's n / N per Discipline, in the sheet list's order (a sheet of no Discipline on its own
    row, last), and the Market's expected Disciplines not yet received. Every sheet found is counted,
    a sheet proposed out and a sheet left out among them (m0-screens: excluded sheets stay in the
    count); a sheet left out is settled."""
    sheets = _facts(project_id)
    order: list[str | None] = []
    found: Counter[str | None] = Counter()
    decided: Counter[str | None] = Counter()
    for sheet in sheets:
        if sheet.discipline not in order:
            order.append(sheet.discipline)
        found[sheet.discipline] += 1
        if sheet.decision:
            decided[sheet.discipline] += 1
    open_questions = Counter(
        q.discipline or None
        for q in _asked(
            project_id,
            Question.objects.filter(project_id=project_id, step=SHEETS, status=QuestionStatus.OPEN),
            _held(project_id),
            listed={s.id for s in sheets},
        )
    )
    discipline_of = {s.id: s.discipline for s in sheets}
    unaccounted = Counter(
        discipline_of[row.sheet_revision_id]
        for row in Coverage.objects.filter(project_id=project_id, status=CoverageStatus.UNACCOUNTED)
        if row.sheet_revision_id in discipline_of
    )
    files = files_of(project_id)
    reading = Counter(
        f.discipline
        for f in files
        if f.state
        in (drawings.FileState.WAITING, drawings.FileState.READING, drawings.FileState.RETRYING)
    )
    paged: dict[str | None, set[uuid.UUID]] = {}
    for sheet in sheets:
        if sheet.plot_page is not None and sheet.plot_file_id is not None:
            paged.setdefault(sheet.discipline, set()).add(sheet.plot_file_id)
    read_pdfs = sorted(
        (f for f in files if f.format == "pdf" and f.state == drawings.FileState.READ),
        key=lambda f: (f.added_at, str(f.id)),
    )
    rows = []
    for key in order:
        lists = _lists(project_id, key) if key else _Lists(None, None)
        listed = lists.count
        disagree = lists.disagree
        total = None if disagree else (listed if listed is not None else found[key])
        done = (
            total is not None
            and decided[key] >= found[key]
            and open_questions[key] == 0
            and unaccounted[key] == 0
            and not reading[key]
        )
        rows.append(
            DisciplineProgress(
                discipline=key,
                confirmed=decided[key],
                found=found[key],
                listed=listed,
                lists_disagree=disagree,
                total=total,
                open_questions=open_questions[key],
                status="confirmed" if done else ("in_review" if found[key] else "not_started"),
                outstanding=[]
                if done
                else _outstanding(
                    reading=reading[key],
                    undecided=found[key] - decided[key],
                    disagree=total is None,
                    questions=open_questions[key],
                    unaccounted=unaccounted[key],
                ),
                plots=tuple(
                    PlotFile(f.id, f.name)
                    for f in read_pdfs
                    if (key is not None and f.discipline == key) or f.id in paged.get(key, set())
                ),
            )
        )
    return ProgressView(rows, _not_received(project_id), invitations.qs_of(project_id))


def _outstanding(
    *, reading: int, undecided: int, disagree: bool, questions: int, unaccounted: int
) -> list[Message]:
    """What keeps a Discipline from `confirmed`, in m0-screens 5's order, each once, with how many."""
    held: list[Message] = []
    if reading:
        held.append(said.FILES_READING(count=reading))
    if undecided > 0:
        held.append(said.SHEETS_UNDECIDED(count=undecided))
    if disagree:
        held.append(said.LISTS_DISAGREE())
    if questions:
        held.append(said.QUESTIONS_OPEN(count=questions))
    if unaccounted:
        held.append(said.VIEWS_UNACCOUNTED(count=unaccounted))
    return held


def proposed_out(sheet: drawings.SheetView | drawings.SheetFacts) -> bool:
    """The read proposed the sheet out and it has no number (a cover, a stale layout; #162): it is
    asked nothing. It stays in Step 1's count (#322), settled once the QS confirms it in or leaves
    it out."""
    return bool(sheet.proposed_exclusion) and not sheet.number


def _not_received(project_id: uuid.UUID) -> list[str]:
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        return []
    expected = EXPECTED.get(markets.of_developer(tenant_id).code, ())
    received = {f.discipline for f in files_of(project_id)}
    # A Discipline expected only from some storey count (Fire from 7) is listed while the count is not
    # known: M0 reads no storey count for the Building.
    return [e.discipline for e in expected if e.discipline not in received]


# The drawing lists --------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Lists:
    given: DrawingRegister | None
    read: DrawingRegister | None

    @property
    def count(self) -> int | None:
        standing = self.standing
        if standing is None:
            return None
        return RegisterEntry.objects.filter(register=standing).count()

    settled: str | None = None
    """The QS's answer to the two lists' Question, while it stands: `use_read` or `use_given`."""

    @property
    def differ(self) -> bool:
        if self.given is None or self.read is None:
            return False
        return _numbers(self.given) != _numbers(self.read)

    @property
    def disagree(self) -> bool:
        return self.differ and self.settled is None

    @property
    def standing(self) -> DrawingRegister | None:
        if self.settled == "use_read":
            return self.read or self.given
        return self.given or self.read


def _standing(project_id: uuid.UUID, discipline: str, sources: Iterable[str]) -> DrawingRegister | None:
    """The latest list of these sources for the Discipline whose act was not undone."""
    return (
        DrawingRegister.objects.filter(project_id=project_id, discipline=discipline, source__in=sources)
        .filter(Q(confirmation__isnull=True) | Q(confirmation__undone_at__isnull=True))
        .order_by("-entered_at", "-id")
        .first()
    )


def _lists(project_id: uuid.UUID, discipline: str) -> _Lists:
    given = _standing(project_id, discipline, (RegisterSource.PASTED, RegisterSource.TYPED))
    read = _standing(project_id, discipline, (RegisterSource.SHEET,))
    settled = None
    if given is not None and read is not None:
        answered = Question.objects.filter(
            project_id=project_id,
            question_key=_lists_key(given, read),
            status=QuestionStatus.ANSWERED,
        ).first()
        if answered is not None and isinstance(answered.answer, dict):
            settled = str(answered.answer.get("option"))
    return _Lists(given, read, settled)


def _named(sheet: drawings.SheetView | None) -> dict[str, str]:
    """A sheet as a Question's words name it (`takeoff.proposals`): its number, else its title."""
    if sheet is not None and sheet.number:
        return {"sheet": sheet.number, "named": "number"}
    if sheet is not None and sheet.title.strip():
        return {"sheet": sheet.title, "named": "title"}
    return {"sheet": "", "named": "none"}


def _lists_key(given: DrawingRegister, read: DrawingRegister) -> str:
    """The two lists' Question, one per pair of lists (a new list asks again)."""
    return hashlib.sha256(f"lists:{given.id}:{read.id}".encode()).hexdigest()


def _numbers(row: DrawingRegister) -> list[str]:
    return list(
        RegisterEntry.objects.filter(register=row)
        .order_by("line", "id")
        .values_list("number", flat=True)
    )


_MARK_LENGTH = RegisterEntry._meta.get_field("revision_mark").max_length or 0


def _revisions(row: DrawingRegister) -> dict[str, str]:
    return dict(
        RegisterEntry.objects.filter(register=row)
        .exclude(revision_mark="")
        .order_by("line", "id")
        .values_list("number", "revision_mark")
    )


def _discipline(key: object) -> str:
    """A Discipline of the Market, by key; else refused."""
    if not isinstance(key, str) or key not in {d.key for d in drawings.disciplines()}:
        raise auth.Refused(said.DISCIPLINE_UNKNOWN(), status=400)
    return key


def _conventions() -> SheetConventions:
    """13's default sheet conventions under the Market's Disciplines (as 21b reads the sheets)."""
    market = tuple(DisciplineConvention(d.key, tuple(d.prefixes)) for d in drawings.disciplines())
    return replace(default_conventions(), disciplines=market)


def _parse(text: object) -> register.Parsed:
    if not isinstance(text, str):
        raise auth.Refused(list_codes.NOTHING_FOUND(), status=400)
    conventions = _conventions()
    try:
        return register.parse(text, conventions, recognisers=recognisers(conventions))
    except register.Refused as refused:
        raise auth.Refused(refused.finding, status=400) from None


def read_list(project_id: uuid.UUID, discipline: str, text: str) -> ParsedList:
    """A pasted list or a typed range, read back for the QS to see before setting it; nothing kept."""
    auth.require(acts.DRAWING_LIST, project_id)
    _in_scope(project_id)
    key = _discipline(discipline)
    return _parsed_view(key, _parse(text))


def _parsed_view(discipline: str, parsed: register.Parsed) -> ParsedList:
    entries = _unique(parsed)
    return ParsedList(
        discipline=discipline,
        source=str(parsed.source),
        numbers=[e.number for e in entries],
        ignored=parsed.ignored,
        entries=[
            {"number": e.number, "title": e.title, "revision_mark": e.revision_mark, "line": e.line}
            for e in entries
        ],
    )


def _unique(parsed: register.Parsed) -> list[Any]:
    """Each number once, where it was first listed."""
    seen: set[str] = set()
    kept = []
    for entry in parsed.entries:
        if entry.number not in seen:
            seen.add(entry.number)
            kept.append(entry)
    return kept


def set_list(project_id: uuid.UUID, discipline: str, text: str, *, actor_name: str) -> ListView:
    """The QS's pasted list or typed range, set as the Discipline's drawing list, its source marked
    and under the QS's name (an act `undo` takes back)."""
    auth.require(acts.DRAWING_LIST, project_id)
    _in_scope(project_id)
    key = _discipline(discipline)
    parsed = _parse(text)
    with writing(project_id):
        act = _act(project_id, ConfirmationAct.DRAWING_LIST, 0, actor_name, discipline=key)
        row = DrawingRegister.objects.create(
            tenant_id=act.tenant_id,
            project_id=project_id,
            discipline=key,
            source=str(parsed.source),
            entered_by_id=act.user_id,
            entered_by_name=act.by_name,
            raw_text=text,
            ignored=parsed.ignored,
            confirmation=act,
        )
        RegisterEntry.objects.bulk_create(
            RegisterEntry(
                tenant_id=act.tenant_id,
                project_id=project_id,
                register=row,
                number=e.number,
                title=e.title or "",
                revision_mark=e.revision_mark or "",
                line=e.line,
            )
            for e in _unique(parsed)
        )
        _ask_if_lists_differ(project_id, key)
        record_progress(project_id)
    return drawing_list(project_id, key)


def _ask_if_lists_differ(project_id: uuid.UUID, discipline: str) -> None:
    """The list read on a sheet and the QS's differ: a `conflict` Question, which of the two stands
    (N is "—" until it is answered); an earlier such Question still open is withdrawn."""
    lists = _lists(project_id, discipline)
    key = _lists_key(lists.given, lists.read) if lists.given and lists.read else None
    Question.objects.filter(
        project_id=project_id,
        step=SHEETS,
        kind=QuestionKind.CONFLICT,
        discipline=discipline,
        message_code=answer_codes.LISTS_DISAGREE.code,
        status=QuestionStatus.OPEN,
    ).exclude(question_key=key or "").update(status=QuestionStatus.WITHDRAWN)
    if key is None or not lists.differ or lists.read is None or lists.given is None:
        return
    on = _sheet(lists.read.source_sheet_id) if lists.read.source_sheet_id else None
    Question.objects.get_or_create(
        tenant_id=_tenant(),
        project_id=project_id,
        question_key=key,
        defaults={
            "step": SHEETS,
            "kind": QuestionKind.CONFLICT,
            "subject_id": lists.read.source_sheet_id,
            "discipline": discipline,
            "message_code": answer_codes.LISTS_DISAGREE.code,
            "params": {
                **_named(on),
                "source": "typed" if lists.given.source == RegisterSource.TYPED else "pasted",
            },
            "options": [{"key": k, "picked": False} for k in ("use_read", "use_given", KEEP_OPEN)],
        },
    )


def drawing_list(project_id: uuid.UUID, discipline: str) -> ListView:
    """The Discipline's drawing list as it stands: the QS's (pasted or typed), else one read on a
    sheet; with none, no numbers."""
    _in_scope(project_id)
    key = _discipline(discipline)
    lists = _lists(project_id, key)
    standing = lists.standing
    return ListView(
        discipline=key,
        source=standing.source if standing else None,
        numbers=_numbers(standing) if standing else [],
        ignored=standing.ignored if standing else 0,
        entered_by=(standing.entered_by_name or None) if standing else None,
        entered_at=standing.entered_at if standing and standing.source != RegisterSource.SHEET else None,
        read_numbers=_numbers(lists.read) if lists.read else None,
        agrees=not lists.disagree,
        read_on=lists.read.source_sheet_id if lists.read else None,
        read_revisions=_revisions(lists.read) if lists.read else {},
    )


# Acting: confirm, exclude, undo -------------------------------------------------------------------


def _act(
    project_id: uuid.UUID,
    act: ConfirmationAct,
    sheets: int,
    actor_name: str,
    *,
    discipline: str = "",
    before: Sequence[drawings.SheetView] = (),
    answering: bool = False,
    views: int = 0,
    excluded: Mapping[str, str] | None = None,
) -> Confirmation:
    """`views`: how many of `sheets` (the act's proposals) are views left out on their own.
    `excluded`: the reason (and the QS's words) of an exclusion, kept with the act for "Who did what"."""
    given = {"excluded": dict(excluded)} if excluded else {}
    row = Confirmation.objects.create(
        before={"sheets": {str(sheet.id): _decision_of(sheet) for sheet in before}, **given},
        tenant_id=_tenant(),
        project_id=project_id,
        step=SHEETS,
        discipline=discipline,
        user_id=_user(),
        by_name=actor_name,
        kind=(
            ConfirmationKind.QUESTION_ANSWER
            if answering
            else ConfirmationKind.BULK
            if sheets > 1
            else ConfirmationKind.SINGLE
        ),
        act=act,
        proposals=sheets,
    )
    code = _event_of(act, before)
    payload = {"sheets": sheets - views, "views": views} if code == said.EXCLUDED else {"sheets": sheets}
    if answering and (moved := _ANSWER_MOVED.get()) is not None:
        moved.extend(sheet.id for sheet in before)
    if answering:
        # One answer, one event: the first act an answer takes is the answer's event (keep_latest
        # confirms one copy and leaves the others out: two acts, one answer).
        taken = _ANSWER_ACTS.get()
        if taken is not None:
            if taken:
                return row
            taken.append(row.id)
    _record(row, code, payload)
    return row


_ANSWER_ACTS: contextvars.ContextVar[list[uuid.UUID] | None] = contextvars.ContextVar(
    "step1_answer_acts", default=None
)
_ANSWER_MOVED: contextvars.ContextVar[list[uuid.UUID] | None] = contextvars.ContextVar(
    "step1_answer_moved", default=None
)
"""Inside `answer`: the printed sheets its acts confirmed or left out, as they take them."""


_EVENTS = {
    ConfirmationAct.CONFIRM: said.CONFIRMED,
    ConfirmationAct.EXCLUDE: said.EXCLUDED,
    ConfirmationAct.ASSIGN: said.ASSIGNED,
    ConfirmationAct.DRAWING_LIST: said.DRAWING_LIST_SET,
}


def _event_of(act: ConfirmationAct, before: Sequence[drawings.SheetView]) -> MessageCode:
    """The act's code in the event log: confirming sheets all excluded before is "confirmed back in"."""
    if act == ConfirmationAct.CONFIRM and before and all(s.decision == "excluded" for s in before):
        return said.CONFIRMED_BACK_IN
    return _EVENTS[act]


def _record(row: Confirmation, code: MessageCode, payload: dict[str, int] | None = None) -> None:
    """The act in the event log, in the act's own transaction (so a refused act records nothing)."""
    events.record(
        code,
        subject_type="confirmation",
        subject_id=row.id,
        actor_user_id=row.user_id,
        project_id=row.project_id,
        payload=payload or {},
    )


def act_params(events: Sequence[activity.ActView]) -> dict[uuid.UUID, dict[str, Any]]:
    """What the acts-read adds to a "confirmed back in" event (the log keeps ids and counts only):
    `excluded_before`, one `{sheet, reason}` per sheet it confirmed back in, the sheet's number and
    the code of the reason it was excluded for, from the act's `before` (m0-screens 4.4). Codes and
    numbers only, and the title of a sheet that has no number."""
    back_in = {
        e.subject_id: e
        for e in events
        if e.code == said.CONFIRMED_BACK_IN.code and e.subject_type == "confirmation" and e.subject_id
    }
    if not back_in:
        return {}
    found: dict[uuid.UUID, dict[str, Any]] = {}
    sets: dict[uuid.UUID, uuid.UUID | None] = {}
    for act in Confirmation.objects.filter(id__in=list(back_in)):
        earlier = {
            key: prior["reason"]
            for key, prior in act.before.get("sheets", {}).items()
            if prior and prior.get("decision") == "excluded" and prior.get("reason")
        }
        if act.project_id not in sets:
            drawing_set = drawings.set_of(act.project_id)
            sets[act.project_id] = drawing_set.id if drawing_set else None
        set_id = sets[act.project_id]
        if not earlier or set_id is None:
            continue
        named = drawings.sheets(set_id, anchors=False, among=[uuid.UUID(k) for k in earlier])
        entries = [
            {
                "sheet": sheet.number or "",
                "reason": earlier[str(sheet.id)],
                # A numberless sheet is named by its title, as the Step 1 list does.
                **({"title": sheet.title} if not sheet.number and sheet.title else {}),
            }
            for sheet in named
            if str(sheet.id) in earlier
        ]
        found[back_in[act.id].id] = {"excluded_before": entries}
    return found


def _chosen(
    project_id: uuid.UUID, ids: Sequence[object]
) -> list[tuple[drawings.SheetView, Proposal | None]]:
    """Each named printed sheet with its Proposal, in the order named; any id not of this Project's
    sheet list (another Project's, another Developer's, none) is not found, and nothing is done. So
    is a sheet of a held file read anyway that its read job has not proposed yet: its Questions (its
    number, its Discipline) are raised with its Proposal, so it is not decided before them."""
    if not isinstance(ids, (list, tuple)) or not ids:
        raise auth.Refused(said.NOTHING_CHOSEN(), status=400)
    named_ids: list[uuid.UUID] = []
    for given in ids:
        try:
            named_ids.append(given if isinstance(given, uuid.UUID) else uuid.UUID(str(given)))
        except ValueError:
            raise auth.NotFound from None
    # Only the named sheets' Proposals are read (an id names a Proposal or a sheet). The sheets come
    # through `_sheets` (the list Step 1 sees, the scope checked first), in a fixed number of
    # statements whatever the Project's size.
    listed_all = _sheets(project_id)
    by_id = {p.id: p for p in _proposals_of(project_id, Q(id__in=named_ids))}
    sheet_ids = {p.subject_id for p in by_id.values()} | set(named_ids)
    by_sheet = {p.subject_id: p for p in _proposals_of(project_id, Q(subject_id__in=sheet_ids))}
    listed = {s.id: s for s in listed_all if s.id in sheet_ids}
    chosen: dict[uuid.UUID, tuple[drawings.SheetView, Proposal | None]] = {}
    for named in named_ids:
        proposal = by_id.get(named)
        sheet_id = proposal.subject_id if proposal else named
        if sheet_id not in listed or (listed[sheet_id].held and sheet_id not in by_sheet):
            raise auth.NotFound
        chosen[sheet_id] = (listed[sheet_id], by_sheet.get(sheet_id))
    return list(chosen.values())


def confirm(
    project_id: uuid.UUID, ids: Sequence[object], *, kind: str | None = None, actor_name: str
) -> ActView:
    """Confirm the named sheets, one or in bulk, each with `kind` when given, else the kind its
    `low_confidence` Question was answered with (an answer given while the sheet was left out, kept
    for its confirmation back in), else its proposed kind (Jev's pick, else the kind read). Each
    change to Jev's pick is logged under the QS. Only sheets two sources agree on join a bulk act
    (m0-screens 6.4): one naming any sheet with one source is refused whole (409); such a sheet is
    confirmed on its own."""
    with transaction.atomic():
        done = _confirm(project_id, ids, kind=kind, actor_name=actor_name, answering=False)
        _after_act(project_id)
    return done


def _confirm(
    project_id: uuid.UUID,
    ids: Sequence[object],
    *,
    kind: str | None,
    actor_name: str,
    answering: bool,
) -> ActView:
    """`confirm`; `answering` when a Question's answer confirms what it held: its sheets never agree
    (an open Question holds them), so the answer is its own act, of kind `question_answer`."""
    auth.require(acts.CONFIRM, project_id)
    with writing(project_id):
        chosen = _chosen(project_id, ids)
        _no_question_first(project_id, chosen)
        if not answering:
            _no_one_source_in_bulk(project_id, chosen)
        answered = _kinds_answered(project_id, [p.id for _s, p in chosen if p is not None])
        act = _act(
            project_id,
            ConfirmationAct.CONFIRM,
            len(chosen),
            actor_name,
            discipline=_one(chosen),
            before=[sheet for sheet, _p in chosen],
            answering=answering,
        )
        for sheet, proposal in chosen:
            proposal = proposal or _propose(project_id, sheet)
            pick = proposal.jev_pick or {}
            if kind is not None and kind not in _kinds_offered(sheet, pick):
                raise auth.Refused(said.KIND_NOT_OFFERED(), status=400)
            given = kind if kind is not None else answered.get(proposal.id)
            wanted = given if given is not None else (pick.get("choice") or sheet.kind)
            decided = drawings.confirm_sheet(
                sheet.id, confirmation_id=act.id, kind=wanted, anchors=False
            )
            _stamp(proposal, ProposalStatus.CONFIRMED, act)
            if given is not None and proposal.jev_answer_id and given != pick.get("choice"):
                # A kind Jev was not offered changes no answer of the node's: nothing to log.
                with contextlib.suppress(jev.NotAnOverride):
                    jev.record_override(
                        proposal.jev_answer_id,
                        subject_id=proposal.id,
                        qs_choice=given,
                        project_id=project_id,
                    )
            _decide_views(sheet.id, act, None, "", confirmed=decided)
    return _act_view(act)


def _no_one_source_in_bulk(
    project_id: uuid.UUID, chosen: Sequence[tuple[drawings.SheetView, Proposal | None]]
) -> None:
    """Refuse (409, nothing done) an act of more than one sheet naming any sheet that does not agree
    (`ProposalView.agrees` false). A sheet an open Question holds (by its subject or a link to its
    Proposal: a conflict, a low confidence, a held file's) is refused as `question_first` (`asks`
    `held`), naming the first such sheet and its Question: answering it, not a lone confirm, settles
    the sheet. Then a held file's sheets read anyway are refused as `held_file`, and otherwise the
    sheets with one source as `one_source`: each naming its sheets by their Proposals' ids (the
    printed sheet's while none is proposed), in the order chosen, the first by number, and how
    many. An act of exactly one whole continuation run (the server's own grouping, `groups.among`) is
    a row, not the bulk act (m0-screens 6.2): its one-source sheets pass, the Question and held-file
    refusals above still stand."""
    if len(chosen) < 2:
        return
    by_sheet = {p.subject_id: p for p in _proposals_of(project_id)}
    agreeing = _agreeing(project_id, _sheets(project_id), by_sheet)
    lone = [(sheet, p) for sheet, p in chosen if sheet.id not in agreeing]
    if not lone:
        return
    holding = _holding(project_id, lone)
    asked = [(sheet, holding[sheet.id]) for sheet, _p in lone if sheet.id in holding]
    if asked:
        first, question = asked[0]
        raise auth.Refused(
            said.QUESTION_FIRST(
                count=len(asked), asks="held", question=str(question.id), **_named(first)
            ),
            status=409,
        )
    # A held file's sheet read anyway never agrees (its file misread), whatever its sources say.
    held = [(sheet, p) for sheet, p in lone if sheet.held]
    alone = held or lone
    first, _p = alone[0]
    if not held and _is_whole_run(project_id, chosen):
        return
    code = said.HELD_FILE if held else said.ONE_SOURCE
    # `sheets` is a list, which `Message`'s params (str | int) do not type: the ruling's shape.
    message = code(count=len(alone), sheets="", **_named(first))
    message["params"]["sheets"] = cast(Any, [str(p.id if p else s.id) for s, p in alone])
    raise auth.Refused(message, status=409)


def _is_whole_run(
    project_id: uuid.UUID, chosen: Sequence[tuple[drawings.SheetView, Proposal | None]]
) -> bool:
    """Whether the chosen sheets are exactly one continuation row, built as the web's `sheetRows` and
    `continues` build it: in the Discipline's sheets in list order (`_sheets`, the order `proposals`
    returns) less those an open Question holds and the undecided ones proposed out (their own list),
    a row is a stretch of next-to-each-other sheets of one run (`groups.among`, T-W334) decided alike
    (never two sheets decided apart). A run split by another sheet is two rows; part of a row, or a
    row and another sheet, is not one."""
    from vextrus.takeoff.services import groups  # as `proposals`: it reads 19b's candidates

    sheets = _sheets(project_id)
    drawing_set = _set_of(project_id)
    of_set = drawings.views_of_set(drawing_set.id, anchors=False) if drawing_set else {}
    grouped = groups.among(
        sheets,
        [of_set.get(s.id, []) for s in sheets],
        {f.id: f.group for f in files_of(project_id)},
        sheet_conventions(),
    )

    def run_of(sheet: drawings.SheetView) -> str | None:
        return grouped.get(sheet.id, groups.ALONE).continuation

    def state_of(sheet: drawings.SheetView) -> tuple[str | None, str | None]:
        return (sheet.decision, sheet.excluded_reason)

    first, _p = chosen[0]
    if run_of(first) is None or len({sheet.discipline for sheet, _p in chosen}) != 1:
        return False
    by_sheet = {p.subject_id: p for p in _proposals_of(project_id)}
    mine = [(s, by_sheet.get(s.id)) for s in sheets if s.discipline == first.discipline]
    held = _holding(project_id, mine)
    rows: list[list[drawings.SheetView]] = []
    for sheet, _p in mine:
        if sheet.id in held or (sheet.decision is None and sheet.proposed_exclusion):
            continue
        last = rows[-1][-1] if rows else None
        if (
            last
            and run_of(last) == run_of(sheet)
            and state_of(last) == state_of(sheet)
            and run_of(sheet)
        ):
            rows[-1].append(sheet)
        else:
            rows.append([sheet])
    wanted = {sheet.id for sheet, _p in chosen}
    return any({s.id for s in row} == wanted for row in rows)


def _holding(
    project_id: uuid.UUID, chosen: Sequence[tuple[drawings.SheetView, Proposal | None]]
) -> dict[uuid.UUID, Question]:
    """The open Step 1 Question (any kind; the oldest when several) holding each chosen sheet that one
    holds, by its subject, a link to its Proposal, or (the two drawing lists disagreeing) its
    Discipline: until that Question is answered no sheet of the Discipline agrees (`_agreeing`),
    though its subject is only the sheet the list was read on. By sheet."""
    sheet_ids = [sheet.id for sheet, _p in chosen]
    proposal_of = {p.id: sheet.id for sheet, p in chosen if p is not None}
    open_questions = Question.objects.filter(
        project_id=project_id, step=SHEETS, status=QuestionStatus.OPEN
    )
    of_discipline: dict[str, list[uuid.UUID]] = {}
    for sheet, _p in chosen:
        if sheet.discipline is not None:
            of_discipline.setdefault(sheet.discipline, []).append(sheet.id)
    linked: dict[uuid.UUID, set[uuid.UUID]] = {}
    for question_id, holds in _held(project_id, open_questions.values_list("id", flat=True)).items():
        for proposal_id in holds:
            if proposal_id in proposal_of:
                linked.setdefault(question_id, set()).add(proposal_of[proposal_id])
    holding: dict[uuid.UUID, Question] = {}
    lists_disagree = Q(
        kind=QuestionKind.CONFLICT,
        message_code=answer_codes.LISTS_DISAGREE.code,
        discipline__in=list(of_discipline),
    )
    # A numbering gap holds nothing in a Discipline with a drawing list (#229, as `_agreeing`).
    listed = [d for d in of_discipline if _lists(project_id, d).standing is not None]
    gaps_listed = Q(message_code__in=[list_codes.GAP.code, list_codes.GAPS.code], discipline__in=listed)
    for q in (
        open_questions.filter(Q(subject_id__in=sheet_ids) | Q(id__in=list(linked)) | lists_disagree)
        .exclude(gaps_listed)
        .order_by("created_at", "id")
    ):
        held = linked.get(q.id, set()) | ({q.subject_id} & set(sheet_ids) if q.subject_id else set())
        if q.kind == QuestionKind.CONFLICT and q.message_code == answer_codes.LISTS_DISAGREE.code:
            held |= set(of_discipline.get(q.discipline or "", []))
        for sheet_id in held:
            holding.setdefault(sheet_id, q)
    return holding


def _held_first(project_id: uuid.UUID, sheet_id: uuid.UUID, proposal: Proposal | None) -> bool:
    """Whether a `missing` or `missing_discipline` Question still holds the sheet (as `confirm`
    refuses it)."""
    try:
        _no_question_first(project_id, [(_sheet(sheet_id), proposal)])
    except auth.Refused:
        return True
    return False


def _kinds_answered(project_id: uuid.UUID, proposal_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, str]:
    """The kind each Proposal's answered `low_confidence` Question chose (its option, a kind; the
    newest answer when there are several), by Proposal: only an answer that stood on it, and while
    it is of that Question's Discipline (`_let_go`)."""
    kinds: dict[uuid.UUID, str] = {}
    if not proposal_ids:
        return kinds
    answered = Question.objects.filter(
        project_id=project_id,
        kind=QuestionKind.LOW_CONFIDENCE,
        status=QuestionStatus.ANSWERED,
    )
    held = _held(project_id, [q.id for q in answered])
    wanted = set(proposal_ids)
    for question in sorted(answered, key=lambda q: (q.answered_at, q.id)):
        given = question.answer.get("option") if isinstance(question.answer, dict) else None
        if not isinstance(given, str) or given == KEEP_OPEN:
            continue
        for proposal_id in held.get(question.id, ()):
            if proposal_id in wanted:
                kinds[proposal_id] = given
    return kinds


FIRST = (QuestionKind.MISSING, QuestionKind.MISSING_DISCIPLINE)
"""The Questions whose sheet is confirmed only once answered (its number or Discipline is the
answer's to set, which a confirmed sheet no longer takes)."""


def _withdrawn_by_standing_exclusion(question: Question) -> bool:
    """Withdrawn when its sheet was left out (`_withdraw_first`), by an act not undone: its sheet is
    still out, so the Question still waits there, answerable, for the sheet to come back in. The act
    is the Question's own column, which no answer ("keep open" included) overwrites."""
    if question.status != QuestionStatus.WITHDRAWN or question.withdrawn_by_id is None:
        return False
    return Confirmation.objects.filter(
        project_id=question.project_id, id=question.withdrawn_by_id, undone_at__isnull=True
    ).exists()


def _no_question_first(
    project_id: uuid.UUID, chosen: Sequence[tuple[drawings.SheetView, Proposal | None]]
) -> None:
    """Refuse (409, nothing done) sheets a `missing` or `missing_discipline` Question holds (open, or
    withdrawn by an exclusion that still stands, whether or not it was kept open: confirming the sheet
    back in would confirm it with no number or Discipline for good), naming the first of them (in the
    order chosen), its Question (`question`: its id, one `questions` lists), what it asks, and how
    many."""
    asked = [
        q
        for q in Question.objects.filter(
            project_id=project_id,
            step=SHEETS,
            status__in=(QuestionStatus.OPEN, QuestionStatus.WITHDRAWN),
            kind__in=FIRST,
        )
        if q.status == QuestionStatus.OPEN or _withdrawn_by_standing_exclusion(q)
    ]
    if not asked:
        return
    by_proposal: dict[uuid.UUID, Question] = {}
    holds = _held(project_id, [q.id for q in asked])
    for q in sorted(asked, key=lambda q: (q.created_at, q.id)):  # the oldest holding it names it
        for proposal_id in holds.get(q.id, ()):
            by_proposal.setdefault(proposal_id, q)
    by_sheet: dict[uuid.UUID, Question] = {}
    for q in sorted(asked, key=lambda q: (q.created_at, q.id)):
        if q.subject_id is not None:
            by_sheet.setdefault(q.subject_id, q)
    held = [
        (sheet, by_sheet.get(sheet.id) or (by_proposal.get(p.id) if p is not None else None))
        for sheet, p in chosen
    ]
    found = [(sheet, q) for sheet, q in held if q is not None]
    if found:
        first, question = found[0]
        raise auth.Refused(
            said.QUESTION_FIRST(
                count=len(found),
                asks="number" if question.kind == QuestionKind.MISSING else "discipline",
                question=str(question.id),
                **_named(first),
            ),
            status=409,
        )


def _withdraw_first(
    project_id: uuid.UUID,
    chosen: Sequence[tuple[drawings.SheetView, Proposal | None]],
    act: Confirmation,
) -> None:
    """Sheets left out are no longer asked their number or Discipline: those open Questions are
    withdrawn by the act (`withdrawn_by`, never overwritten by an answer), and its undo asks them
    again. Each still holds its sheet from coming back in until it is answered."""
    sheet_ids = {sheet.id for sheet, _p in chosen}
    proposal_ids = {p.id for _s, p in chosen if p is not None}
    linked = [q for q, held in _held(project_id).items() if proposal_ids & set(held)]
    Question.objects.filter(
        project_id=project_id, step=SHEETS, status=QuestionStatus.OPEN, kind__in=FIRST
    ).filter(Q(subject_id__in=sheet_ids) | Q(id__in=list(linked))).update(
        status=QuestionStatus.WITHDRAWN, withdrawn_by=act
    )


def exclude(
    project_id: uuid.UUID, ids: Sequence[object], reason: str, text: str = "", *, actor_name: str
) -> ActView:
    """Leave the named sheets out, for one of the seven reasons ("other" with the QS's words; with any
    other reason the words are not kept); their views are excluded with them."""
    with transaction.atomic():
        done = _exclude(project_id, ids, reason, text, actor_name=actor_name, answering=False)
        _after_act(project_id)
    return done


def _exclude(
    project_id: uuid.UUID,
    ids: Sequence[object],
    reason: str,
    text: str = "",
    *,
    actor_name: str,
    answering: bool,
) -> ActView:
    """`exclude`; `answering` when a Question's answer leaves the sheets out (`_confirm`'s)."""
    auth.require(acts.EXCLUDE, project_id)
    words = text if reason == OTHER else ""
    with writing(project_id):
        views, ids = _views_chosen(project_id, ids)
        chosen = _chosen(project_id, ids) if ids or not views else []
        act = _act(
            project_id,
            ConfirmationAct.EXCLUDE,
            len(chosen) + len(views),
            actor_name,
            discipline=_one(chosen) if chosen else "",
            before=[sheet for sheet, _p in chosen],
            answering=answering,
            views=len(views),
            excluded={"reason": reason, "text": words},
        )
        _withdraw_first(project_id, chosen, act)
        for sheet, proposal in chosen:
            proposal = proposal or _propose(project_id, sheet)
            drawings.exclude(sheet.id, reason, words, confirmation_id=act.id, anchors=False)
            proposal.rejected_reason = reason
            _stamp(proposal, ProposalStatus.REJECTED, act)
            _decide_views(sheet.id, act, reason, words.strip())
        _exclude_views(project_id, act, views, reason, words)
    return _act_view(act)


def _views_chosen(
    project_id: uuid.UUID, ids: Sequence[object]
) -> tuple[list[Proposal], Sequence[object]]:
    """The named view Proposals of this Project (an unaccounted view's), and the other ids."""
    if not isinstance(ids, (list, tuple)):
        return [], ids  # refused by `_chosen`
    by_id = {
        p.id: p
        for p in Proposal.objects.filter(
            project_id=project_id, step=SHEETS, subject=ProposalSubject.VIEW
        )
    }
    views: dict[uuid.UUID, Proposal] = {}
    rest: list[object] = []
    for given in ids:
        try:
            named = given if isinstance(given, uuid.UUID) else uuid.UUID(str(given))
        except ValueError:
            rest.append(given)
            continue
        if named in by_id:
            views[named] = by_id[named]
        else:
            rest.append(given)
    return list(views.values()), rest


def _exclude_views(
    project_id: uuid.UUID, act: Confirmation, views: Sequence[Proposal], reason: str, words: str
) -> None:
    """Leave views out on their own (an unaccounted view: "part of the title block"): each view's
    Coverage excluded under the act; its sheet's later confirmation keeps it so."""
    if not views:
        return
    listed = {s.id for s in _facts(project_id)}
    rows = {
        r.view_id: r
        for r in Coverage.objects.select_for_update().filter(
            project_id=project_id, view_id__in=[p.subject_id for p in views]
        )
    }
    for proposal in views:
        row = rows.get(proposal.subject_id)
        if row is None or row.sheet_revision_id not in listed:
            raise auth.NotFound
        drawings.exclude(proposal.subject_id, reason, words, confirmation_id=act.id, anchors=False)
        row.status, row.reason, row.reason_text = CoverageStatus.EXCLUDED, reason, words.strip()
        row.confirmation = act
        row.confirmed_by_id = act.user_id
        row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])
        proposal.rejected_reason = reason
        _stamp(proposal, ProposalStatus.REJECTED, act)


ASSIGNABLE = frozenset(step.key for step in STEPS if step.key != SHEETS)
"""The Steps a view may be put in: 2 to 14 (Step 1 reads sheets, never a view)."""


def assign(
    project_id: uuid.UUID, ids: Sequence[object], steps: Sequence[object], *, actor_name: str
) -> ActView:
    """Put the named views in the named Takeoff Steps (#158), one act under the QS's name, before or
    after their sheets are confirmed: a view no step accounted for is then proposed with them, or
    assigned under its sheet's act once its sheet is confirmed. A step the view already has is kept
    as it is. A key that is no Step 2 to 14 is refused (400); a view left out, on its own or with its
    sheet, is refused (409); an id not of this Project's views is not found; nothing is done."""
    auth.require(acts.ASSIGN, project_id)
    _in_scope(project_id)  # a Project not in scope (of another Developer, or none) is not found
    if (
        not isinstance(steps, (list, tuple))
        or not steps
        or any(not isinstance(step, str) or step not in ASSIGNABLE for step in steps)
    ):
        raise auth.Refused(said.STEP_UNKNOWN(), status=400)
    if not isinstance(ids, (list, tuple)) or not ids:
        raise auth.Refused(said.NO_VIEW_CHOSEN(), status=400)
    with writing(project_id):
        views, rest = _views_chosen(project_id, ids)
        if rest:
            raise auth.NotFound
        listed = {s.id: s for s in _sheets(project_id)}
        rows = {
            r.view_id: r
            for r in Coverage.objects.select_for_update().filter(
                project_id=project_id, view_id__in=[p.subject_id for p in views]
            )
        }
        chosen: list[Coverage] = []
        for proposal in views:
            row = rows.get(proposal.subject_id)
            if row is None or row.sheet_revision_id not in listed:
                raise auth.NotFound
            chosen.append(row)
        if any(row.status == CoverageStatus.EXCLUDED for row in chosen):
            raise auth.Refused(said.VIEW_EXCLUDED(), status=409)
        accounted = [row for row in chosen if _accounted(row)]
        if accounted:
            raise auth.Refused(said.VIEW_ACCOUNTED(count=len(accounted)), status=409)
        disciplines = {listed[row.sheet_revision_id].discipline or "" for row in chosen}
        act = _act(
            project_id,
            ConfirmationAct.ASSIGN,
            len(chosen),
            actor_name,
            discipline=disciplines.pop() if len(disciplines) == 1 else "",
        )
        for row in chosen:
            for step in dict.fromkeys(steps):
                _give_step(row, str(step), act)
            if row.status == CoverageStatus.UNACCOUNTED:
                _follow_sheet(row)
        record_progress(project_id)
    return _act_view(act)


def _accounted(row: Coverage) -> bool:
    """A view the read or its standing steps already account for (m0-screens 6.9: only a view still
    unaccounted is put in Steps): the read proposed it a step, a Part or an exclusion, or a step
    stands for it (the QS's `assign`, or its sheet's confirmed kind)."""
    return row.proposed_status != CoverageStatus.UNACCOUNTED or bool(_standing_steps(row))


def _stands(given: CoverageStep, deciding: uuid.UUID | None) -> bool:
    """A step stands when the read proposed it, or the QS's `assign` not undone gave it, or the
    confirmation still deciding its sheet gave it by the kind confirmed (a sheet confirmed again as
    another kind stands on the new kind's steps only)."""
    act = given.confirmation
    if act is None:
        return True
    if act.undone_at is not None:
        return False
    return act.act == ConfirmationAct.ASSIGN or act.id == deciding


def _steps_standing(
    rows: Sequence[Coverage], deciding: Mapping[uuid.UUID, uuid.UUID | None]
) -> dict[uuid.UUID, list[CoverageStep]]:
    """Each view's standing steps, each step once (every act that gave it keeps its own row, so one
    act undone leaves the step to another still standing); `deciding`: each sheet's deciding act.
    Where a step the QS put the view in stands, the steps its sheet's kind gave do not: the QS's
    steps replace the kind's, whichever came first."""
    sheet_of = {r.id: r.sheet_revision_id for r in rows}
    standing: dict[uuid.UUID, list[CoverageStep]] = {}
    for given in (
        CoverageStep.objects.select_related("confirmation")
        .filter(coverage_id__in=list(sheet_of))
        .order_by("step", "id")
    ):
        if _stands(given, deciding.get(sheet_of[given.coverage_id])):
            standing.setdefault(given.coverage_id, []).append(given)
    found: dict[uuid.UUID, list[CoverageStep]] = {}
    for row, steps in standing.items():
        assigned = [s for s in steps if s.confirmation and s.confirmation.act == ConfirmationAct.ASSIGN]
        kept = assigned or steps
        found[row] = list({s.step: s for s in reversed(kept)}.values())[::-1]
    return found


def _standing_steps(row: Coverage, sheet: drawings.SheetView | None = None) -> list[str]:
    """The view's standing steps; `sheet`: its sheet as it stands, when already in hand (else read)."""
    if sheet is not None:
        deciding = sheet.confirmation_id
    else:
        try:
            deciding = _sheet(row.sheet_revision_id).confirmation_id
        except auth.NotFound:
            deciding = None
    return [s.step for s in _steps_standing([row], {row.sheet_revision_id: deciding}).get(row.id, [])]


def _give_step(row: Coverage, step: str, act: Confirmation) -> None:
    """The view in `step` by `act`: a row of its own, so undoing another act that gave the same step
    leaves it standing (the refuter's case, #158)."""
    CoverageStep.objects.get_or_create(
        tenant_id=row.tenant_id,
        project_id=row.project_id,
        coverage=row,
        step=step,
        confirmation=act,
    )


def _account(
    row: Coverage,
    sheet: drawings.SheetView,
    act: Confirmation,
    standing: Sequence[str] | None = None,
) -> bool:
    """A view the read gave no step, on a sheet confirmed by `act`: assigned under the act when a step
    stands for it (the QS's `assign`), else when its sheet's confirmed kind names Steps, given them by
    the act (a Structural `beam_details`: beams). False when neither: it stays unaccounted.
    `standing`: its standing steps, when already read (`_steps_standing` of the sheet's views)."""
    if not (_standing_steps(row, sheet) if standing is None else standing):
        given = view_finder.kind_steps(sheet.confirmed_kind or "", sheet.discipline)
        for step in given:
            _give_step(row, step, act)
        if not given or not _standing_steps(row, sheet):
            return False
    row.status, row.reason, row.reason_text = CoverageStatus.ASSIGNED, "", ""
    row.confirmation = act
    row.confirmed_by_id = act.user_id
    row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])
    return True


def correct(
    project_id: uuid.UUID,
    proposal: object,
    *,
    number: object = None,
    title: object = None,
    views: Sequence[tuple[object, object, object]] | None = None,
    opened: Mapping[str, object] | None = None,
    actor_name: str,
) -> ActView:
    """The QS corrects a sheet's number, title or plan views' storeys (m0-screens 2.2 and 6.9, `E`),
    one act: the sheet stays a Proposal (an excluded one stays out); a confirmed one is refused (409),
    its Confirmation to be undone first. `views` are `(view, storeys as typed, meaning)`: the view's
    storeys and meaning are then the QS's, marked typed. A value given as it already is changes
    nothing; none changed is refused (400). The act keeps what it changed (`before["corrected"]`) for
    its undo, and the set's Questions are asked again: a number another sheet of the Discipline has is
    a conflict, and the storeys the plans name are compared with the title's again."""
    auth.require(acts.CORRECT, project_id)
    with transaction.atomic(), writing(project_id):
        [(sheet, _proposal)] = _chosen(project_id, [proposal])
        # The form's own values (`opened`): a value another person corrected since is theirs, not
        # silently overwritten by a save from a form opened before it (review of #706, B).
        now = {"number": sheet.number or "", "title": sheet.title}
        for field, sent in (("number", number), ("title", title)):
            was = (opened or {}).get(field)
            if (
                isinstance(sent, str)
                and isinstance(was, str)
                and now[field] != was
                and sent.strip() != now[field]
            ):
                # Named by the number the QS saw when the form opened, then what it is now.
                seen = str((opened or {}).get("number") or "")
                titled = str((opened or {}).get("title") or "")
                named = _label(seen, sheet)
                if not seen and titled:  # a sheet that had no number: by the title the form opened with
                    named = {**named, "sheet": titled, "named": "title"}
                raise auth.Refused(
                    said.CORRECTED_SINCE(
                        field=field, value=now[field], has="yes" if now[field] else "no", **named
                    ),
                    status=409,
                )
        # Typed text checked before the act is written: its `before` keeps the new values too.
        changed: dict[str, Any] = {"sheet": str(sheet.id)}
        if isinstance(number, str) and number.strip() != (sheet.number or ""):
            changed["number"] = [sheet.number or "", drawings.typed_number(number)]
        if isinstance(title, str) and title.strip() != sheet.title:
            changed["title"] = [sheet.title, drawings.typed_title(title)]
        if views:
            _refuse_if_views_read_again(opened, sheet, views)
        viewed = drawings.typed_view_storeys(sheet.id, views or [])
        if viewed:
            # The sheet is locked (`typed_view_storeys`): these are the views just read and judged.
            read = drawings.views(sheet.id)
            _refuse_if_storeys_moved(opened, viewed, sheet, read)
            places = _plan_places(read)
            by_id = {v.id: v for v in read}
            changed["views"] = []
            for b, a in viewed:
                if b.view not in by_id:  # read again since (review 2 of #780): refused, never a 500
                    raise _storeys_since(opened, sheet, b.view, "", 0)
                changed["views"].append(_view_change(b, a, by_id[b.view], places[b.view]))
        if len(changed) == 1:
            raise auth.Refused(said.NOTHING_TO_CORRECT(), status=400)
        # Where each value was read, for its undo (the reading's source, not the correction's).
        changed["sources"] = {
            name: sheet.sources.get(name) for name in ("number", "title") if name in changed
        }
        if sheet.plot.page is not None and sheet.plot.title_alike:
            changed["plot_alike"] = True  # cleared by the correction, given back by its undo
        if sheet.decision == "confirmed":
            raise auth.Refused(said.CONFIRMED_NOT_CORRECTED(), status=409)
        asked = _number_asked(project_id, sheet.id) if "number" in changed else None
        if asked is not None:  # its status before, for the undo to put back
            changed["question"] = {
                "id": str(asked.id),
                "status": asked.status,
                "answer": asked.answer,  # a "keep open" answer given before, kept for the undo
                "answered_by": str(asked.answered_by_id) if asked.answered_by_id else None,
                "answered_at": asked.answered_at.isoformat() if asked.answered_at else None,
            }
        act = _correction_act(project_id, sheet, changed, actor_name)
        _record(act, said.CORRECTED, {"sheets": 1})
        if "number" in changed:
            drawings.set_sheet_number(sheet.id, changed["number"][1])
        if asked is not None:
            # The number the sheet's `missing` Question asks for is given: answered by the correction,
            # so the numbered sheet is a Proposal its confirmation is not refused for (review 1, 75).
            asked.status = QuestionStatus.ANSWERED
            asked.answer = {
                "option": "type_number",
                "text": changed["number"][1],
                "by": actor_name,
                "given_by": "correction",
            }
            asked.answered_by_id = _user()
            asked.answered_at = timezone.now()
            asked.save(update_fields=["status", "answer", "answered_by", "answered_at"])
        if "title" in changed:
            drawings.set_sheet_title(sheet.id, changed["title"][1])
        if viewed:
            written = drawings.set_view_storeys(sheet.id, [after for _before, after in viewed])
            # A view not written was read again under the act: refused, the whole act with it, never
            # answered as corrected with its storeys left as read (review 2 of #780).
            for v in changed["views"]:
                if uuid.UUID(v["view"]) not in written:
                    raise _storeys_since(opened, sheet, uuid.UUID(v["view"]), v["title"], v["place"])
        _after_act(project_id, corrected=True)
    return _act_view(act)


def _refuse_if_views_read_again(
    opened: Mapping[str, object] | None,
    sheet: drawings.SheetView,
    views: Sequence[tuple[object, object, object]],
) -> None:
    """A view the form opened with that is no longer the sheet's (its file read again since: its rows
    replaced, with new ids) is refused as changed since (409, whose words say to open the form
    again), not as a view unknown to the sheet (400), judged before the views are looked up (review 1
    of #811). It is named as the form named it (`opened["views"]`' `title` and `place`), else by its
    place among the views sent."""
    seen = (opened or {}).get("views")
    if not isinstance(seen, Mapping):
        return
    drawings.lock_sheet(sheet.id)  # the views read are those the correction then judges
    now = {v.id for v in drawings.views(sheet.id)}
    for at, (view, _storeys, _meaning) in enumerate(views, start=1):
        was = seen.get(str(view))
        if not isinstance(view, uuid.UUID) or view in now or not isinstance(was, Mapping):
            continue
        title, place = was.get("title"), was.get("place")
        named = title if isinstance(title, str) else ""
        counted = place if isinstance(place, int) and not isinstance(place, bool) and place > 0 else at
        raise _storeys_since(opened, sheet, view, named, counted)


def _refuse_if_storeys_moved(
    opened: Mapping[str, object] | None,
    viewed: Sequence[tuple[drawings.ViewStoreys, drawings.ViewStoreys]],
    sheet: drawings.SheetView,
    read: Sequence[drawings.ViewView],
) -> None:
    """A view's storeys another person corrected since the form opened are theirs, not silently
    overwritten (409), as a number or title is: `opened["views"]` holds, per view the form sends, the
    storeys (keys) and meaning it opened with. A view the form sent no opened state for is not judged."""
    seen = (opened or {}).get("views")
    if not isinstance(seen, Mapping):
        return
    titles = {v.id: v.title for v in read}
    places = _plan_places(read)
    for before, _after in viewed:
        was = seen.get(str(before.view))
        if not isinstance(was, Mapping):
            continue
        storeys, meaning = was.get("storeys"), was.get("meaning")
        # A view's opened state of other types is unreadable, so not judged (review 1 of #780, 50).
        if storeys is None:
            storeys = []
        if not isinstance(storeys, list) or not all(isinstance(k, str) for k in storeys):
            continue
        if meaning is not None and not isinstance(meaning, str):
            continue
        if (list(before.storeys), before.meaning or "") != (storeys, meaning or ""):
            raise _storeys_since(
                opened, sheet, before.view, titles.get(before.view, ""), places.get(before.view, 0)
            )


def _storeys_since(
    opened: Mapping[str, object] | None,
    sheet: drawings.SheetView,
    view: uuid.UUID,
    title: str,
    place: int,
) -> auth.Refused:
    """A plan view's storeys changed under the correction (409, nothing written): the view named by
    its title, or, untitled, by its place among the sheet's plans (`titled` "no"; review 2 of #780)."""
    named = _label(str((opened or {}).get("number") or ""), sheet)
    title = title.strip()
    return auth.Refused(
        said.STOREYS_CORRECTED_SINCE(
            view=title[:80],
            view_id=str(view),
            titled="yes" if title else "no",
            place=place,
            **named,
        ),
        status=409,
    )


def _plan_places(read: Sequence[drawings.ViewView]) -> dict[uuid.UUID, int]:
    """Each plan view's place among its sheet's plans, from 1 in reading order: an untitled plan is
    named by it ("plan view 2 (untitled)"), as the correction form names it (review 2 of #780)."""
    plans = sorted((v for v in read if (v.confirmed_kind or v.kind) == "plan"), key=lambda v: v.ordinal)
    return {v.id: n for n, v in enumerate(plans, start=1)}


def _view_change(
    before: drawings.ViewStoreys, after: drawings.ViewStoreys, view: drawings.ViewView, place: int
) -> dict[str, Any]:
    """A plan view's storeys correction as the act keeps it: each of storeys, meaning and source as
    `[before, after]` (the undo puts the first back, and stands only while the second is kept), the
    view's title for the sheet's history, and its place and kind: with its title, what a re-read
    carries the typed storeys by (`drawings.record_views`), for the undo to find the view again."""
    return {
        "view": str(before.view),
        "title": view.title,
        "place": place,  # among the sheet's plans: an untitled one's name in its history
        "ordinal": view.ordinal,
        "kind": view.kind,
        "storeys": [list(before.storeys), list(after.storeys)],
        "meaning": [before.meaning, after.meaning],
        "source": [before.source, after.source],
    }


def _view_storeys(changed: Mapping[str, Any], side: int) -> list[drawings.ViewStoreys]:
    """The views a correction changed, as they were (`side` 0) or as it left them (`side` 1)."""
    return [
        drawings.ViewStoreys(
            uuid.UUID(v["view"]),
            tuple(v["storeys"][side]),
            v["meaning"][side],
            v["source"][side],
        )
        for v in changed.get("views") or []
    ]


def _views_now(sheet_id: uuid.UUID, changed: Mapping[str, Any]) -> dict[str, drawings.ViewView]:
    """The views a correction changed as the sheet keeps them now, by the act's view id: the same
    row, or the one a re-read carried its typed storeys to (same place, kind and title; review 1 of
    #780). A view the reading no longer holds is not here: it holds nothing to put back."""
    kept = drawings.views(sheet_id)
    by_id = {str(v.id): v for v in kept}
    by_place = {(v.ordinal, v.kind, v.title): v for v in kept}
    found: dict[str, drawings.ViewView] = {}
    for one in changed.get("views") or []:
        now = by_id.get(one["view"]) or by_place.get(
            (one.get("ordinal"), one.get("kind"), one.get("title"))
        )
        if now is not None:
            found[one["view"]] = now
    return found


def _correction_act(
    project_id: uuid.UUID, sheet: drawings.SheetView, changed: Mapping[str, Any], actor_name: str
) -> Confirmation:
    """A correction's act, one sheet's, with what it changed in `before["corrected"]` (the app writes
    a Confirmation once: its `undone_at` is the only column it may change)."""
    return Confirmation.objects.create(
        before={"sheets": {}, "corrected": dict(changed)},
        tenant_id=_tenant(),
        project_id=project_id,
        step=SHEETS,
        discipline=sheet.discipline or "",
        user_id=_user(),
        by_name=actor_name,
        kind=ConfirmationKind.SINGLE,
        act=ConfirmationAct.CORRECT,
        proposals=1,
    )


def _number_asked(project_id: uuid.UUID, sheet_id: uuid.UUID) -> Question | None:
    """The sheet's `missing` Question still asking its number: open, or withdrawn by its exclusion
    still standing (answerable while the sheet is out)."""
    for row in Question.objects.select_for_update().filter(
        project_id=project_id,
        step=SHEETS,
        kind=QuestionKind.MISSING,
        subject_id=sheet_id,
        status__in=[QuestionStatus.OPEN, QuestionStatus.WITHDRAWN],
    ):
        if row.status == QuestionStatus.OPEN or _withdrawn_by_standing_exclusion(row):
            return row
    return None


def _correction_stands(act: Confirmation) -> bool:
    """Whether a correction can be taken back: it is its sheet's latest standing correction, and the
    sheet's number, title and `missing` Question are exactly as it left them (review 3 of #680: an
    undo restores that correction's own `before` and nothing older, so it is taken back only while
    nothing has moved on since). A sheet off the sheet list holds nothing to put back."""
    changed = act.before.get("corrected") or {}
    try:
        sheet = _sheet(uuid.UUID(changed["sheet"]))
    except KeyError, ValueError, auth.NotFound:
        return True
    later = Confirmation.objects.filter(
        project_id=act.project_id,
        step=SHEETS,
        act=ConfirmationAct.CORRECT,
        undone_at__isnull=True,
        before__corrected__sheet=changed["sheet"],
    ).exclude(id=act.id)
    if any((c.at, c.id) > (act.at, act.id) for c in later):
        return False
    if sheet.decision == "confirmed":
        return False
    if sheet.confirmation_id and sheet.confirmation_id != act.id:
        # Decided by an act since (an answer's confirm or exclusion included): taking this back
        # would go through it. A decision made before the correction stands with it (an exclusion).
        decider = Confirmation.objects.filter(id=sheet.confirmation_id, undone_at__isnull=True).first()
        if decider is not None and (decider.at, decider.id) > (act.at, act.id):
            return False
    number, title = changed.get("number"), changed.get("title")
    if number and (sheet.number or "") != number[1]:
        return False
    if title and sheet.title != title[1]:
        return False
    if changed.get("views"):
        kept = _views_now(sheet.id, changed)
        for left in _view_storeys(changed, 1):
            now = kept.get(str(left.view))  # a view the reading no longer holds: nothing to put back
            if now is not None and (tuple(now.storeys), now.storeys_meaning, now.storeys_source) != (
                left.storeys,
                left.meaning,
                left.source,
            ):
                return False
    asked = changed.get("question")
    if asked and number:
        question = Question.objects.filter(project_id=act.project_id, id=uuid.UUID(asked["id"])).first()
        given = (question.answer or {}) if question else {}
        if (
            question is None
            or question.status != QuestionStatus.ANSWERED
            or given.get("given_by") != "correction"
            or given.get("text") != number[1]
        ):
            return False
    return True


def _put_back_correction(act: Confirmation) -> None:
    """A correction undone (`_correction_stands` first): the number and title it changed go back to
    its own `before`, with their sources, and so do its plan views' storeys, meaning and source; the
    `missing` Question it answered asks again as the sheet stands now, with the answer (a "keep
    open") it had before the correction."""
    changed = act.before.get("corrected") or {}
    try:
        sheet = _sheet(uuid.UUID(changed["sheet"]))
    except KeyError, ValueError, auth.NotFound:
        return  # off the sheet list since
    number, title = changed.get("number"), changed.get("title")
    sources = changed.get("sources") or {}
    if changed.get("views"):
        # The sheet is locked before its views are read, as the correction locks it (review 3 of #780):
        # a re-read cannot replace them between the read and the write. A view the write still misses
        # (read again under the undo) is refused with the whole undo, never stamped undone unwritten.
        drawings.lock_sheet(sheet.id)
        kept = _views_now(sheet.id, changed)
        put_back = [
            replace(was, view=kept[str(was.view)].id)
            for was in _view_storeys(changed, 0)
            if str(was.view) in kept
        ]
        if drawings.put_back_view_storeys(sheet.id, put_back) != {v.view for v in put_back}:
            raise auth.Refused(said.CORRECTION_MOVED_ON(**_passed_named(act)), status=409)
    back = drawings.put_back_sheet(
        sheet.id,
        number=number[0] if number else None,
        title=title[0] if title else None,
        number_source=sources.get("number") if number else None,
        title_source=sources.get("title") if title else None,
        plot_title_alike=bool(changed.get("plot_alike")),
    )
    asked = changed.get("question")
    if not asked or back.number:
        return
    held_by = back.confirmation_id if back.decision == "excluded" else None
    at = asked.get("answered_at")
    Question.objects.filter(
        project_id=act.project_id,
        id=uuid.UUID(asked["id"]),
        status=QuestionStatus.ANSWERED,
        answer__given_by="correction",
    ).update(
        status=QuestionStatus.WITHDRAWN if held_by else QuestionStatus.OPEN,
        withdrawn_by=held_by,
        answer=asked.get("answer"),
        answered_by=uuid.UUID(asked["answered_by"]) if asked.get("answered_by") else None,
        answered_at=datetime.fromisoformat(at) if at else None,
    )


def _label(typed: str, sheet: drawings.SheetView | None) -> dict[str, str]:
    """A sheet as the words name it when its number has moved since the QS saw or typed `typed`:
    "S-06, now S-07" (`moved` "yes"), "S-06, now without a number" ("none"), else as `_named`."""
    now = (sheet.number or "") if sheet is not None else ""
    if typed and typed != now:
        return {"sheet": typed, "named": "number", "moved": "yes" if now else "none", "now": now}
    return {**_named(sheet), "moved": "no", "now": now}


def _passed_named(correction: Confirmation) -> dict[str, str]:
    """The sheet of a correction the undo passed over, named by the number the correction set (or the
    sheet's own, when it set none), and where it is now if that has moved (review of #706)."""
    changed = correction.before.get("corrected") or {}
    try:
        sheet = _sheet(uuid.UUID(changed["sheet"]))
    except KeyError, ValueError, auth.NotFound:
        return {**_named(None), "moved": "no", "now": ""}
    number = changed.get("number")
    return _label(number[1] if number else (sheet.number or ""), sheet)


def undo(project_id: uuid.UUID) -> ActView:
    """Take back the acting user's own last act on Step 1 not yet undone (a confirmation, an
    exclusion, a drawing list, a correction); refused as `answer_stays` when that act answered a
    Question. A correction's number, title and views' storeys go back (`_put_back_correction`). Each
    sheet it still decides goes back to what it carried before the act (another person's decision
    included), or to undecided; its Proposal and its views' Coverage
    follow. A sheet another act has decided since is left as that act decided it."""
    auth.require(acts.UNDO, project_id)
    _in_scope(project_id)  # a Project not in scope (of another Developer, or none) is not found
    with writing(project_id):
        # The acting user's own last act not undone, passing over a correction whose sheet has moved
        # on (it stays, and Ctrl Z reaches the act before it: review 1 of #691); with nothing else
        # to take back, that correction is refused in words.
        mine = Confirmation.objects.filter(
            project_id=project_id, step=SHEETS, user_id=_user(), undone_at__isnull=True
        ).order_by("-at", "-id")
        act = None
        passed: Confirmation | None = None
        for candidate in mine.iterator():
            if candidate.act == ConfirmationAct.CORRECT and not _correction_stands(candidate):
                passed = passed or candidate
                continue
            act = Confirmation.objects.select_for_update().get(id=candidate.id)
            break
        if act is None:
            if passed is not None:
                raise auth.Refused(said.CORRECTION_MOVED_ON(**_passed_named(passed)), status=409)
            raise auth.Refused(said.NOTHING_TO_UNDO(), status=409)
        if act.kind == ConfirmationKind.QUESTION_ANSWER:
            # An answer has no undo: taking back its confirm or exclusion would leave the Question
            # answered by sheets it no longer decides. Its sheets are still excluded or confirmed.
            raise auth.Refused(
                said.ANSWER_STAYS_AFTER_CORRECTION(**_passed_named(passed))
                if passed is not None
                else said.ANSWER_STAYS(),
                status=409,
            )
        listed = {s.id for s in _facts(project_id) if s.confirmation_id == act.id}
        # Every sheet the act still decides, those off the sheet list now included (a held file set
        # aside after the act): drawings clears them all; a sheet off the list cannot be decided
        # again, so its Proposal and Coverage go back to undecided with it.
        # A view the act left out on its own is put back as its sheet stands, below.
        own_views = set(
            Proposal.objects.filter(
                project_id=project_id, confirmation=act, subject=ProposalSubject.VIEW
            ).values_list("subject_id", flat=True)
        )
        off_list = {
            p.subject_id
            for p in Proposal.objects.filter(
                project_id=project_id, confirmation=act, subject=ProposalSubject.SHEET
            )
            if p.subject_id not in listed
        } | {
            row.sheet_revision_id
            for row in Coverage.objects.filter(project_id=project_id, confirmation=act)
            if row.sheet_revision_id not in listed and row.view_id not in own_views
        }
        drawings.undo(act.id)
        act.undone_at = timezone.now()
        act.save(update_fields=["undone_at"])
        if act.act == ConfirmationAct.CORRECT:
            # Its number and title go back, and the set's Questions are asked again (a conflict its
            # number raised retired); the act decided no sheet, so nothing below finds one of it.
            _put_back_correction(act)
            _ask_set_again(project_id)
        # The Questions the act withdrew (its sheets left out) and not answered since are asked again
        # (a "keep open" given meanwhile stays, as on any open Question).
        Question.objects.filter(
            project_id=project_id, status=QuestionStatus.WITHDRAWN, withdrawn_by=act
        ).update(status=QuestionStatus.OPEN, withdrawn_by=None)
        for proposal in Proposal.objects.filter(
            project_id=project_id, confirmation=act, subject=ProposalSubject.VIEW
        ):
            proposal.status, proposal.confirmation, proposal.rejected_reason = (
                ProposalStatus.OPEN,
                None,
                "",
            )
            proposal.save(update_fields=["status", "confirmation", "rejected_reason"])
            for row in Coverage.objects.select_for_update().filter(
                project_id=project_id, view_id=proposal.subject_id, confirmation=act
            ):
                _follow_sheet(row)
        for sheet_id in listed:
            standing = _standing_before(act, sheet_id)
            if standing is not None and standing[1].get("decision") == "confirmed":
                # A value another person corrected since (the sheet was out: a correction is allowed) was
                # never confirmed: the sheet comes back a Proposal, not "confirmed" under it (#706 r3).
                moved = Confirmation.objects.filter(
                    project_id=project_id,
                    step=SHEETS,
                    act=ConfirmationAct.CORRECT,
                    undone_at__isnull=True,
                    before__corrected__sheet=str(sheet_id),
                    at__gt=act.at,
                ).exists()
                if moved:
                    standing = None
            _put_back_sheet(project_id, sheet_id, standing)
        for sheet_id in off_list:
            _put_back_sheet(project_id, sheet_id, None)
        # The views the act put in Steps (an `assign`) stand as their sheets do without its steps;
        # a view left out since stays out.
        given = CoverageStep.objects.filter(project_id=project_id, confirmation=act).values_list(
            "coverage_id", flat=True
        )
        for row in Coverage.objects.select_for_update().filter(
            project_id=project_id, id__in=list(given)
        ):
            if row.status != CoverageStatus.EXCLUDED:
                _follow_sheet(row)
        _record(act, said.UNDONE)
        _after_act(project_id)
    return _act_view(act)


_HISTORY = (said.CONFIRMED, said.CONFIRMED_BACK_IN, said.EXCLUDED, said.CORRECTED, said.UNDONE)


def history(project_id: uuid.UUID, proposal: uuid.UUID) -> list[HistoryAct]:
    """Every act on a printed sheet, oldest first, from the event log (and the Confirmation of an
    answer's second act, which logs none): confirmations (bulk ones with
    how many sheets they decided), exclusions with their reason, corrections old to new, and each
    undo after the act it took back (the undone act stays listed). `proposal`: the Proposal's id, or
    the sheet's while none is proposed; any other, of another Project or none, is not found. An act is
    found by the sheet its Confirmation names (`before`), so a sheet's number or title moving does not
    lose it."""
    sheet_id = next((p.subject_id for p in _proposals_of(project_id, Q(id=proposal))), proposal)
    if sheet_id not in {s.id for s in _sheets(project_id)}:
        raise auth.NotFound
    named = str(sheet_id)
    acts_of = {
        c.id: c
        for c in Confirmation.objects.filter(project_id=project_id, step=SHEETS).filter(
            Q(before__sheets__has_key=named) | Q(before__corrected__sheet=named)
        )
    }
    recorded = events.of_subjects(_HISTORY, subject_type="confirmation", subject_ids=acts_of)
    roles = invitations.roles_of({c.user_id for c in acts_of.values()})
    found: list[HistoryAct] = []
    for event in recorded:
        act = acts_of[event.subject_id]
        counted = event.payload.get("sheets")
        found.append(
            HistoryAct(
                id=act.id,
                code=event.kind,
                actor=act.by_name,
                actor_role=roles.get(act.user_id),
                at=event.occurred_at,
                sheets=counted if isinstance(counted, int) else None,
                **_given_by(event.kind, act, named),
            )
        )
    # One answer is one event: the second act an answer takes (keep_latest confirms one copy and
    # leaves the others out) logs none (`_act`), so its sheet's act is read from its Confirmation.
    logged = {e.subject_id for e in recorded}
    for act in acts_of.values():
        if act.id in logged or act.act not in (ConfirmationAct.CONFIRM, ConfirmationAct.EXCLUDE):
            continue
        code = _event_of_act(act)
        found.append(
            HistoryAct(
                id=act.id,
                code=code.code,
                actor=act.by_name,
                actor_role=roles.get(act.user_id),
                at=act.at,
                sheets=act.proposals,
                **_given_by(code.code, act, named),
            )
        )
    return sorted(found, key=lambda a: a.at)


def _event_of_act(act: Confirmation) -> MessageCode:
    """The code `_event_of` gave an act, read back from its Confirmation: confirming sheets all
    excluded before is "confirmed back in"."""
    if act.act == ConfirmationAct.EXCLUDE:
        return said.EXCLUDED
    before = list((act.before.get("sheets") or {}).values())
    if before and all(d and d.get("decision") == "excluded" for d in before):
        return said.CONFIRMED_BACK_IN
    return said.CONFIRMED


def _given_by(code: str, act: Confirmation, sheet: str) -> dict[str, Any]:
    """What an act gave, for its history entry: an exclusion's reason, a correction's changes."""
    if code == said.EXCLUDED.code:
        given = act.before.get("excluded") or {}
        reason = given.get("reason")
        text = given.get("text") if reason == "other" else None
        return {"reason": reason, "text": text or None}
    if code == said.CORRECTED.code:
        made = act.before.get("corrected") or {}
        sources = made.get("sources") or {}
        return {
            "changes": {
                name: {"old": made[name][0], "new": made[name][1], "old_source": sources.get(name)}
                for name in ("number", "title")
                if name in made
            },
            "views": [
                {
                    "title": v.get("title") or "",
                    "place": v.get("place"),
                    "old": v["storeys"][0],
                    "new": v["storeys"][1],
                }
                for v in made.get("views") or []
            ]
            or None,
        }
    return {}


def _after_act(project_id: uuid.UUID, *, corrected: bool = False) -> None:
    """The one pass each act (confirm, exclude, undo, an answer) ends in, in its transaction: the
    set's conflicts asked again (a decided sheet is in no conflict, one undecided again is compared
    again: #161), or every Question of the set after an answer, a correction or its undo
    `corrected` a sheet's number, title or Discipline (a typed number another sheet has is a
    conflict); then the progress rows written once, last, so they count every Question the pass
    raised or retired."""
    from vextrus.takeoff.services.read_propose import proposals  # it imports this module

    if corrected:
        proposals.set_questions(project_id)
    else:
        proposals.set_conflicts(project_id)
    ask_kind_again(project_id, [s for s in _facts(project_id) if not s.decision])
    record_progress(project_id)


def _ask_set_again(project_id: uuid.UUID) -> None:
    """Every Question of the set asked again, after a sheet's number or title moved."""
    from vextrus.takeoff.services.read_propose import proposals  # it imports this module

    proposals.set_questions(project_id)


def _decision_of(sheet: drawings.SheetView) -> dict[str, Any] | None:
    if not sheet.decision:
        return None
    return {
        "decision": sheet.decision,
        "confirmation_id": str(sheet.confirmation_id) if sheet.confirmation_id else None,
        "kind": sheet.confirmed_kind,
        "reason": sheet.excluded_reason,
        "text": sheet.excluded_text,
    }


def _standing_before(
    act: Confirmation, sheet_id: uuid.UUID
) -> tuple[Confirmation, dict[str, Any]] | None:
    """The newest decision on the sheet before `act` whose own act still stands: walking back over
    acts undone since (each keeps what it overwrote), else None (undecided)."""
    key = str(sheet_id)
    prior = act.before.get("sheets", {}).get(key)
    seen = {act.id}
    while prior and prior.get("confirmation_id"):
        earlier = Confirmation.objects.filter(
            project_id=act.project_id, id=uuid.UUID(prior["confirmation_id"])
        ).first()
        if earlier is None or earlier.id in seen:
            return None
        if earlier.undone_at is None:
            return earlier, prior
        seen.add(earlier.id)
        prior = earlier.before.get("sheets", {}).get(key)
    return None


def _put_back_sheet(
    project_id: uuid.UUID, sheet_id: uuid.UUID, standing: tuple[Confirmation, dict[str, Any]] | None
) -> None:
    proposal = next(iter(_proposals_of(project_id, Q(subject_id=sheet_id))), None)
    if standing is None:
        if proposal is not None:
            proposal.status, proposal.confirmation, proposal.rejected_reason = (
                ProposalStatus.OPEN,
                None,
                "",
            )
            proposal.save(update_fields=["status", "confirmation", "rejected_reason"])
        own = _excluded_on_their_own(project_id, sheet_id)
        for row in Coverage.objects.select_for_update().filter(
            project_id=project_id, sheet_revision_id=sheet_id
        ):
            if row.view_id not in own:  # a view the QS left out by an act of its own stays out
                _put_back(row)
        return
    earlier, prior = standing
    if prior["decision"] != "excluded" and _held_first(project_id, sheet_id, proposal):
        # A confirmation is never put back on a sheet whose number or Discipline is still asked
        # (one made before its Question was raised): it goes back to undecided, its Question open.
        _put_back_sheet(project_id, sheet_id, None)
        return
    if prior["decision"] == "excluded":
        drawings.exclude(
            sheet_id, prior["reason"], prior["text"] or "", confirmation_id=earlier.id, anchors=False
        )
        _decide_views(sheet_id, earlier, prior["reason"], prior["text"] or "")
        if proposal is not None:
            proposal.rejected_reason = prior["reason"]
            _stamp(proposal, ProposalStatus.REJECTED, earlier)
    else:
        confirmed = drawings.confirm_sheet(
            sheet_id, confirmation_id=earlier.id, kind=prior["kind"], anchors=False
        )
        _decide_views(sheet_id, earlier, None, "", confirmed=confirmed)
        if proposal is not None:
            proposal.rejected_reason = ""
            _stamp(proposal, ProposalStatus.CONFIRMED, earlier)


def _kinds_offered(sheet: drawings.SheetView, pick: Mapping[str, Any]) -> set[str]:
    """The kinds a QS may confirm a sheet as: its Discipline's (every Discipline's for a sheet of
    none) and the common ones, by 13's conventions; Jev's options for it; the kind as read."""
    conventions = default_conventions()
    by_discipline = conventions.sheet_kinds
    kinds = (
        set(by_discipline.get(sheet.discipline, ()))
        if sheet.discipline
        else {k for ks in by_discipline.values() for k in ks}
    )
    kinds |= set(conventions.common_sheet_kinds) | set(pick.get("options") or ())
    if sheet.kind:
        kinds.add(sheet.kind)
    return kinds


def _one(chosen: Sequence[tuple[drawings.SheetView, Proposal | None]]) -> str:
    keys = {sheet.discipline or "" for sheet, _p in chosen}
    return keys.pop() if len(keys) == 1 else ""


def _stamp(proposal: Proposal, status: ProposalStatus, act: Confirmation) -> None:
    proposal.status = status
    proposal.confirmation = act
    proposal.save(update_fields=["status", "confirmation", "rejected_reason"])


def _act_view(act: Confirmation) -> ActView:
    return ActView(act.id, act.act, act.proposals, act.by_name, act.at)


def _decide_views(
    sheet_id: uuid.UUID,
    act: Confirmation,
    reason: str | None,
    text: str,
    *,
    confirmed: drawings.SheetView | None = None,
) -> None:
    """The sheet's views' Coverage follows it: confirmed as proposed (an unaccounted view stays so),
    or excluded with the sheet's reason. `confirmed`: the sheet as its confirmation left it, when in
    hand (read once here otherwise, never once a view)."""
    own = _excluded_on_their_own(act.project_id, sheet_id)
    sheet = None
    if reason is None:
        sheet = confirmed if confirmed is not None else _sheet(sheet_id)
    rows = list(
        Coverage.objects.select_for_update().filter(
            project_id=act.project_id, sheet_revision_id=sheet_id
        )
    )
    standing: dict[uuid.UUID, list[CoverageStep]] | None = None
    for row in rows:
        if reason is None and row.view_id in own:
            continue  # the QS left this view out on its own: confirming its sheet keeps it so
        if sheet is not None and row.proposed_status == CoverageStatus.UNACCOUNTED:
            if standing is None:  # the sheet's views' standing steps, read once
                standing = _steps_standing(rows, {sheet_id: sheet.confirmation_id})
            steps = [s.step for s in standing.get(row.id, [])]
            if not _account(row, sheet, act, steps):
                # Nothing given by its kind: its standing steps are still those read.
                kind = view_finder.kind_steps(sheet.confirmed_kind or "", sheet.discipline)
                _put_back(row, sheet, None if kind else steps)
            continue
        if reason is None:
            row.status, row.reason, row.reason_text = row.proposed_status, row.proposed_reason, ""
        else:
            row.status, row.reason, row.reason_text = CoverageStatus.EXCLUDED, reason, text
        row.confirmation = act
        row.confirmed_by_id = act.user_id
        row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])


def _excluded_on_their_own(project_id: uuid.UUID, sheet_id: uuid.UUID) -> set[uuid.UUID]:
    """The sheet's views the QS left out by an act of their own (not undone)."""
    return set(
        Proposal.objects.filter(
            project_id=project_id,
            step=SHEETS,
            subject=ProposalSubject.VIEW,
            status=ProposalStatus.REJECTED,
            confirmation__undone_at__isnull=True,
            values__sheet_id=str(sheet_id),
        ).values_list("subject_id", flat=True)
    )


def _follow_sheet(row: Coverage) -> None:
    """A view's own exclusion undone: it stands as its sheet does (confirmed: as proposed, under the
    sheet's act; left out: with the sheet's reason; undecided: proposed)."""
    try:
        sheet = _sheet(row.sheet_revision_id)
    except auth.NotFound:
        sheet = None
    if sheet is None or not sheet.decision or sheet.confirmation_id is None:
        _put_back(row)
        return
    act = Confirmation.objects.get(project_id=row.project_id, id=sheet.confirmation_id)
    if sheet.decision == "excluded":
        row.status, row.reason = CoverageStatus.EXCLUDED, sheet.excluded_reason or OTHER
        row.reason_text = sheet.excluded_text
    elif row.proposed_status == CoverageStatus.UNACCOUNTED:
        if not _account(row, sheet, act):
            _put_back(row, sheet)
        return
    else:
        row.status, row.reason, row.reason_text = row.proposed_status, row.proposed_reason, ""
    row.confirmation = act
    row.confirmed_by_id = act.user_id
    row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])


def _put_back(
    row: Coverage, sheet: drawings.SheetView | None = None, standing: Sequence[str] | None = None
) -> None:
    """The view as proposed: as the read proposed it, or proposed with the steps the QS put it in;
    `sheet`: its sheet as it stands, and `standing`: its standing steps, when in hand."""
    row.status, row.reason, row.reason_text = row.proposed_status, row.proposed_reason, ""
    steps = standing if standing is not None else None
    if row.status == CoverageStatus.UNACCOUNTED and (
        steps if steps is not None else _standing_steps(row, sheet)
    ):
        row.status = CoverageStatus.ASSIGNED
    row.confirmation = None
    row.confirmed_by = None
    row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])


# Writing what Step 1 reads (the seed; 21c's read job) ---------------------------------------------


def _propose(project_id: uuid.UUID, sheet: drawings.SheetView) -> Proposal:
    return _proposal_row(project_id, sheet, None)


type Traces = Sequence[tuple[str, Mapping[str, Any]]]
"""A Proposal's Traces: each fact with the anchor (a JSON object) where it was read."""


def propose_sheet(
    sheet_id: uuid.UUID, *, answer: jev.Answer | None = None, traces: Traces = ()
) -> uuid.UUID:
    """A printed sheet as a Step 1 Proposal: its kind as read and, when Jev answered its kind, that
    answer (its choice and the options offered, in order), with its Traces; the Proposal's id.
    Idempotent per sheet."""
    sheet = _sheet(sheet_id)
    row = _proposal_row(_project_of(sheet), sheet, answer)
    _trace(row, traces)
    return row.id


def propose_view(project_id: uuid.UUID, view: drawings.ViewView, *, traces: Traces = ()) -> uuid.UUID:
    """A view of a printed sheet as a Step 1 Proposal (what 17 proposes to do with it: its steps,
    its Part, or leaving it out), with its Traces; the Proposal's id. Idempotent per view."""
    _in_scope(project_id)
    sheet = _sheet(view.sheet_revision_id)
    if _project_of(sheet) != project_id:
        raise auth.NotFound
    return _view_rows(project_id, [(view, traces)])[view.id]


def propose_views(
    project_id: uuid.UUID,
    viewed: Sequence[tuple[drawings.SheetView, Sequence[drawings.ViewView]]],
    traces: Callable[[drawings.ViewView], Traces],
) -> int:
    """Each view of the printed sheets given (each sheet with its views, as `drawings.views` lists
    them) as `propose_view` and `record_coverage` write it, the views' rows written together: the
    scope and each file's Project read once, every view's Proposal in one upsert, their Traces in one
    insert, every Coverage row in one upsert and its Coverage Steps in one insert (S22-LOCKHOLD: the
    read job writes them under Step 1's write lock, which an act waits on for 3 s at most). The
    same rows as the per-view writes; idempotent; the views written."""
    _in_scope(project_id)
    owners: dict[uuid.UUID, uuid.UUID] = {}
    for sheet, views in viewed:
        if sheet.file_id not in owners:
            owners[sheet.file_id] = drawings.file(sheet.file_id).project_id
        if owners[sheet.file_id] != project_id or any(v.sheet_revision_id != sheet.id for v in views):
            raise auth.NotFound
    every = [view for _sheet_, views in viewed for view in views]
    _view_rows(project_id, [(view, traces(view)) for view in every])
    return _coverage_rows(project_id, every)


def _view_values(view: drawings.ViewView) -> dict[str, Any]:
    return {
        "sheet_id": str(view.sheet_revision_id),
        "title": view.title,
        "kind": view.kind,
        "steps": list(view.steps),
        "part": view.part,
        "exclusion": view.proposed_exclusion,
    }


def _view_rows(
    project_id: uuid.UUID, viewed: Sequence[tuple[drawings.ViewView, Traces]]
) -> dict[uuid.UUID, uuid.UUID]:
    """The views' Proposals (keyed `view:<id>`; an existing one's subject and values updated in
    place, as `update_or_create` did) in one upsert, then their Traces; each Proposal's id by its
    view's. Statements: a fixed few, whatever the number of views."""
    if not viewed:
        return {}
    tenant_id = _tenant()
    by_key = {f"view:{view.id}": (view, traces) for view, traces in viewed}
    Proposal.objects.bulk_create(
        [
            Proposal(
                tenant_id=tenant_id,
                project_id=project_id,
                step=SHEETS,
                candidate_key=key,
                subject=ProposalSubject.VIEW,
                subject_id=view.id,
                values=_view_values(view),
            )
            for key, (view, _traces) in by_key.items()
        ],
        update_conflicts=True,
        unique_fields=["tenant_id", "project_id", "step", "candidate_key"],
        update_fields=["subject", "subject_id", "values"],
    )
    ids = dict(
        Proposal.objects.filter(
            tenant_id=tenant_id, project_id=project_id, step=SHEETS, candidate_key__in=by_key
        ).values_list("candidate_key", "id")
    )
    _traces(tenant_id, project_id, [(ids[key], traces) for key, (_view, traces) in by_key.items()])
    return {view.id: ids[key] for key, (view, _traces) in by_key.items()}


def _trace(proposal: Proposal, traces: Traces) -> None:
    _traces(proposal.tenant_id, proposal.project_id, [(proposal.id, traces)])


def _traces(
    tenant_id: uuid.UUID, project_id: uuid.UUID, given: Sequence[tuple[uuid.UUID, Traces]]
) -> None:
    """Each Proposal's Traces, once each (fact cut to 64, anchor): a Trace already written is kept,
    as `get_or_create` kept it; the missing ones inserted together. Two statements at most."""
    wanted = [(pid, fact[:64], dict(anchor)) for pid, traces in given for fact, anchor in traces]
    if not wanted:
        return
    have = {
        (pid, fact, _same(anchor))
        for pid, fact, anchor in ProposalTrace.objects.filter(
            tenant_id=tenant_id, project_id=project_id, proposal_id__in={w[0] for w in wanted}
        ).values_list("proposal_id", "fact", "anchor")
    }
    made = []
    for pid, fact, anchor in wanted:
        key = (pid, fact, _same(anchor))
        if key not in have:
            have.add(key)
            made.append(
                ProposalTrace(
                    tenant_id=tenant_id, project_id=project_id, proposal_id=pid, fact=fact, anchor=anchor
                )
            )
    if made:
        ProposalTrace.objects.bulk_create(made)


def _same(value: Any) -> Hashable:
    """A JSON value as a key equal for values PostgreSQL's `jsonb` holds equal (`get_or_create`'s
    `anchor=` matched in the database): numbers by value (1 and 1.0 alike), a boolean never a number,
    objects whatever their keys' order."""
    if isinstance(value, Mapping):
        return ("object", frozenset((str(k), _same(v)) for k, v in value.items()))
    if isinstance(value, list | tuple):
        return ("array", tuple(_same(v) for v in value))
    if isinstance(value, bool) or value is None:
        return ("literal", value)
    if isinstance(value, int | float):
        return ("number", Decimal(repr(value)))
    return ("string", str(value))


def proposal_ids(project_id: uuid.UUID) -> dict[uuid.UUID, uuid.UUID]:
    """Each printed sheet's Proposal id, by the sheet's id."""
    return {p.subject_id: p.id for p in _proposals_of(project_id)}


def sheet_conventions() -> SheetConventions:
    """13's default sheet conventions under the Market's Disciplines (as the read job reads)."""
    return _conventions()


def record_unread(project_id: uuid.UUID, file_id: uuid.UUID, *, sheet_found: int, unread: int) -> None:
    """How many sheets a file's read found and how many it left out for unreadable writing (#135),
    which Coverage counts while the file is in the sheet list."""
    _in_scope(project_id)
    RecogniseRun.objects.update_or_create(
        tenant_id=_tenant(),
        project_id=project_id,
        building_id=None,
        family_key=UNREAD_FAMILY,
        cache_key=str(file_id),
        defaults={"candidates": sheet_found + unread, "reused_answers": max(0, unread)},
    )


@dataclass(frozen=True)
class ReadList:
    sheet_id: uuid.UUID
    discipline: str
    entries: list[tuple[str, str]]


def read_lists(project_id: uuid.UUID) -> list[ReadList]:
    """The drawing lists read on sheets, the latest per sheet and Discipline."""
    latest: dict[tuple[uuid.UUID, str], DrawingRegister] = {}
    for row in DrawingRegister.objects.filter(
        project_id=project_id, source=RegisterSource.SHEET
    ).order_by("entered_at", "id"):
        if row.source_sheet_id is not None:
            latest[(row.source_sheet_id, row.discipline)] = row
    return [
        ReadList(
            sheet_id,
            discipline,
            list(
                RegisterEntry.objects.filter(register=row)
                .order_by("line", "id")
                .values_list("number", "title")
            ),
        )
        for (sheet_id, discipline), row in latest.items()
    ]


@dataclass(frozen=True)
class GivenList:
    discipline: str
    source: str
    numbers: list[str]


def given_lists(project_id: uuid.UUID) -> list[GivenList]:
    """The QS's standing pasted or typed list of each Discipline."""
    keys = set(
        DrawingRegister.objects.filter(project_id=project_id)
        .exclude(source=RegisterSource.SHEET)
        .values_list("discipline", flat=True)
    )
    found = []
    for key in sorted(keys):
        row = _standing(project_id, key, (RegisterSource.PASTED, RegisterSource.TYPED))
        if row is not None:
            found.append(GivenList(key, row.source, _numbers(row)))
    return found


def record_check_run(
    project_id: uuid.UUID,
    check_key: str,
    version: int,
    *,
    passed: int,
    total: int,
    findings: Sequence[tuple[Message, Sequence[uuid.UUID], uuid.UUID | None]] = (),
) -> uuid.UUID:
    """One run of a Check on reading: how many subjects passed of N, and each finding (its message,
    its subjects' ids and the Question it raised)."""
    _in_scope(project_id)
    run = CheckRun.objects.create(
        tenant_id=_tenant(),
        project_id=project_id,
        check_key=check_key,
        check_version=version,
        trigger=CheckTrigger.READ,
        passed=passed,
        total=total,
    )
    for message, subjects, question_id in findings:
        CheckFinding.objects.create(
            tenant_id=run.tenant_id,
            project_id=project_id,
            run=run,
            subject_ids=[str(s) for s in subjects],
            message_code=message["code"],
            params=dict(message["params"]),
            question_id=question_id,
        )
    return run.id


def answered_findings(project_id: uuid.UUID, check_key: str) -> dict[tuple[str, str], uuid.UUID]:
    """The findings of a Check the QS has answered (each run's finding whose Question is answered),
    by (subject id, params as JSON): the Question that answered each. The same finding found again
    on the same subject is decided, and asked no more (#436's review round 1)."""
    _in_scope(project_id)
    found: dict[tuple[str, str], uuid.UUID] = {}
    rows = CheckFinding.objects.filter(
        project_id=project_id, run__check_key=check_key, question__status=QuestionStatus.ANSWERED
    ).values_list("subject_ids", "params", "question_id")
    for subjects, params, question_id in rows:
        said = json.dumps(params, sort_keys=True, default=str)
        for subject in subjects or ():
            found.setdefault((str(subject), said), question_id)
    return found


def _project_of(sheet: drawings.SheetView) -> uuid.UUID:
    return drawings.file(sheet.file_id).project_id


def _proposal_row(
    project_id: uuid.UUID, sheet: drawings.SheetView, answer: jev.Answer | None
) -> Proposal:
    values = {
        "number": sheet.number,
        "title": sheet.title,
        "revision_mark": sheet.revision_mark,
        "kind": sheet.kind,
        "exclusion": sheet.proposed_exclusion,
    }
    pick = None
    if answer is not None:
        pick = {"choice": answer.choice, "options": [option for option, _p in answer.probabilities]}
    row, _made = Proposal.objects.update_or_create(
        tenant_id=_tenant(),
        project_id=project_id,
        step=SHEETS,
        candidate_key=f"sheet:{sheet.id}",
        defaults={
            "subject": ProposalSubject.SHEET,
            "subject_id": sheet.id,
            "values": values,
            "source": "jev" if answer is not None else "reader",
            "confidence": answer.confidence if answer is not None else None,
            "jev_answer_id": answer.id if answer is not None else None,
            "jev_pick": pick,
        },
    )
    return row


def record_coverage(sheet_id: uuid.UUID) -> int:
    """Each view of a printed sheet as a Coverage row, from its proposal: to its Takeoff Steps or its
    Discipline Part, left out with a reason, or unaccounted. Idempotent; the rows written."""
    sheet = _sheet(sheet_id)
    return _coverage_rows(_project_of(sheet), drawings.views(sheet_id))


def _coverage_rows(project_id: uuid.UUID, views: Sequence[drawings.ViewView]) -> int:
    """The views' Coverage rows (an existing proposed row's proposal and standing put back as read,
    as `update_or_create` did) in one upsert, then their proposed Coverage Steps in one insert, an
    existing one kept. Statements: a fixed few, whatever the number of views; the rows written."""
    if not views:
        return 0
    tenant_id = _tenant()
    rows = {}
    for view in views:
        if view.proposed_exclusion:
            status, reason = CoverageStatus.EXCLUDED, view.proposed_exclusion
        elif view.steps or view.part:
            status, reason = CoverageStatus.ASSIGNED, ""
        else:
            status, reason = CoverageStatus.UNACCOUNTED, ""
        rows[view.id] = Coverage(
            tenant_id=tenant_id,
            project_id=project_id,
            drawing_set_state_id=None,
            view_id=view.id,
            sheet_revision_id=view.sheet_revision_id,
            proposed_status=status,
            proposed_reason=reason,
            status=status,
            reason=reason,
            part_key=view.part or "",
        )
    Coverage.objects.bulk_create(
        list(rows.values()),
        update_conflicts=True,
        unique_fields=["tenant_id", "project_id", "drawing_set_state_id", "view_id"],
        update_fields=[
            "sheet_revision_id",
            "proposed_status",
            "proposed_reason",
            "status",
            "reason",
            "part_key",
        ],
    )
    ids = dict(
        Coverage.objects.filter(
            tenant_id=tenant_id, project_id=project_id, drawing_set_state_id=None, view_id__in=rows
        ).values_list("view_id", "id")
    )
    steps = {(ids[view.id], step) for view in views for step in view.steps}
    if steps:
        CoverageStep.objects.bulk_create(
            [
                CoverageStep(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    coverage_id=coverage_id,
                    step=step,
                    confirmation=None,
                )
                for coverage_id, step in sorted(steps, key=lambda s: (str(s[0]), s[1]))
            ],
            ignore_conflicts=True,
        )
    return len(rows)


def raise_question(
    project_id: uuid.UUID,
    kind: QuestionKind | str,
    message: Message,
    *,
    subject_id: uuid.UUID | None = None,
    discipline: str | None = None,
    options: Sequence[Any] = (),
    check_code: str = "",
    blocks: Sequence[uuid.UUID] = (),
    keyed_by_holds: bool = False,
    keyed_by: Sequence[str] = (),
) -> uuid.UUID:
    """A Step 1 Question, as a code and its parameters, once per (kind, subject, evidence): the
    same Question raised again is the one already asked. `blocks`: the Proposals it holds.
    `keyed_by_holds`: the Proposals it holds are part of its evidence too (a Question over a group of
    sheets, T-W318's per Discipline: the same words over other sheets are another Question, since a
    Question's holds are only ever added to). `keyed_by`: more evidence that is no word of it (the
    storey-titles findings with their plans' storeys, S15-E3: an answered Question is never the one a
    changed disagreement is asked by)."""
    _in_scope(project_id)
    chosen = QuestionKind(kind)
    evidence: list[Any] = [chosen, str(subject_id or ""), message["code"], message["params"]]
    if keyed_by_holds:
        evidence.append(sorted(str(b) for b in blocks))
    if keyed_by:
        evidence.append(sorted(keyed_by))
    identity = json.dumps(evidence, sort_keys=True, default=str)
    key = hashlib.sha256(identity.encode()).hexdigest()
    row, _made = Question.objects.get_or_create(
        tenant_id=_tenant(),
        project_id=project_id,
        question_key=key,
        defaults={
            "step": SHEETS,
            "kind": chosen,
            "subject_id": subject_id,
            "discipline": discipline or "",
            "message_code": message["code"],
            "params": dict(message["params"]),
            "options": list(options),
            "check_code": check_code,
        },
    )
    for proposal_id in blocks:
        proposal = Proposal.objects.get(project_id=project_id, id=proposal_id)
        QuestionLink.objects.get_or_create(
            tenant_id=row.tenant_id, project_id=project_id, question=row, proposal=proposal
        )
    return row.id


def ask_gaps(
    project_id: uuid.UUID,
    discipline: str,
    message: Message,
    *,
    options: Sequence[Any] = (),
    check_code: str = "",
    blocks: Sequence[uuid.UUID] = (),
) -> uuid.UUID:
    """The Discipline's one numbering gap Question (S15-Q2, the owner's session-11 ruling: "all of one
    Discipline's gaps are asked as one Question"), its identity the Discipline and never its gaps'
    sheet numbers: a file that adds a gap or fills one changes what it asks (`message`) and the sheets
    it holds (`blocks`; a sheet beside a gap since filled is held no more, `_beside_now`), never
    which Question it is. The Discipline's last one not
    answered is the one asked (reopened if a past round retired it); after an answer, a new one (the
    Discipline once more: a gap found later is asked, never settled by an answer given before it).

    A kept-open answer stays while every gap it asks lies within a gap asked when it was kept open (a
    file that fills a gap, or part of one, asks no number the QS has not seen); a number missing that
    it never asked makes it the QS's to answer again (review 1 of #229). Two read jobs take turns on the
    Discipline (a transaction lock), as `ask_group`'s do."""
    _in_scope(project_id)
    base = hashlib.sha256(
        json.dumps([QuestionKind.CHECK, "gaps", discipline], sort_keys=True).encode()
    ).hexdigest()[:_GROUP_KEY]
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                "select pg_advisory_xact_lock(hashtextextended(%s, 0))",
                [f"takeoff.question_group:{project_id}:{base}"],
            )
        tenant = _tenant()
        asked = list(
            Question.objects.select_for_update()
            .filter(tenant_id=tenant, project_id=project_id, question_key__startswith=base)
            .order_by("created_at", "id")
        )
        last = asked[-1] if asked else None
        reusable = last is not None and (
            last.status == QuestionStatus.OPEN
            or (last.status == QuestionStatus.WITHDRAWN and last.withdrawn_by_id is None)
        )
        if last is not None and reusable:
            row = last
            params = dict(message["params"])
            if row.params != params:
                was = set(gap_ends(row))
                row.params = params
                fields = ["params"]
                if row.answer is not None and not _within(gap_ends(row), was, discipline):
                    row.answer = None  # a number the QS never kept open is theirs to answer
                    fields.append("answer")
                row.save(update_fields=fields)
        else:
            row = Question.objects.create(
                tenant_id=tenant,
                project_id=project_id,
                question_key=f"{base}{len(asked):0{64 - _GROUP_KEY}x}",
                step=SHEETS,
                kind=QuestionKind.CHECK,
                subject_id=None,
                discipline=discipline,
                message_code=message["code"],
                params=dict(message["params"]),
                options=list(options),
                check_code=check_code,
            )
        # Links are append-only (19a): one beside a gap since filled stays, held no more
        # (`_beside_now`).
        for proposal_id in dict.fromkeys(blocks):
            proposal = Proposal.objects.get(project_id=project_id, id=proposal_id)
            QuestionLink.objects.get_or_create(
                tenant_id=row.tenant_id, project_id=project_id, question=row, proposal=proposal
            )
    return row.id


def _within(
    gaps: Iterable[tuple[str, str, int]], before: Iterable[tuple[str, str, int]], discipline: str
) -> bool:
    """Whether each gap `(after, before, missing)` lies within one of `before`: the same series, its
    two ends on or between that gap's (S15-Q2: a gap split by a sheet that came asks nothing new). A
    number the conventions do not place matches only the same gap."""
    conventions = _conventions()
    numbers = Numbers(conventions, recognisers(conventions))

    def ends(gap: tuple[str, str, int]) -> tuple[Any, Any]:
        return numbers.parts_in(gap[0], discipline), numbers.parts_in(gap[1], discipline)

    was = list(before)
    for gap in gaps:
        if gap in was:
            continue
        low, high = ends(gap)
        if low is None or high is None:
            return False
        if not any(
            (lo := ends(old)[0]) is not None
            and (hi := ends(old)[1]) is not None
            and lo[0] == low[0] == high[0] == hi[0]
            and lo[1] <= low[1]
            and high[1] <= hi[1]
            for old in was
        ):
            return False
    return True


def answered_gaps(project_id: uuid.UUID) -> dict[tuple[str, str, str, int], uuid.UUID]:
    """Each numbering gap a QS has answered (not kept open), as `(discipline, after, before,
    missing)`, with the Question that answered it: settled, never asked again (#229)."""
    settled: dict[tuple[str, str, str, int], uuid.UUID] = {}
    for question in Question.objects.filter(
        project_id=project_id,
        step=SHEETS,
        status=QuestionStatus.ANSWERED,
        message_code__in=[list_codes.GAP.code, list_codes.GAPS.code],
    ).order_by("answered_at", "id"):
        for gap in gap_ends(question):
            settled.setdefault((question.discipline, *gap), question.id)
    return settled


def ask_group(
    project_id: uuid.UUID,
    kind: QuestionKind | str,
    code: MessageCode,
    *,
    identity: Sequence[str],
    proposal_id: uuid.UUID,
    discipline: str | None = None,
    options: Sequence[Any] = (),
) -> uuid.UUID:
    """A kind Question (`kind` `low_confidence`, `code` `takeoff.proposals.which_kind`: the only
    group Question, refused otherwise) that groups the Proposals it asks about (S15-Q1: "a Question
    groups the Sheets it asks about"), one per `identity` (what the group shares: never a sheet's
    name, so a sheet named before or after the others joins the same Question), holding
    `proposal_id`. The Question already holding the Proposal is the one asked (a read again asks
    nothing new); else the group's open one, which it joins; else a new one (the group's identity
    once more, after its last was answered or withdrawn: a sheet that came later is asked, never
    decided by an answer given before it). Its subject is none: it is about all its sheets. What it
    holds and its words are read, never stored (S18-Q1's re-read rule: `_held`, `_worded`): the
    params kept are its first sheet's, for the record.

    Two read jobs asking one group take turns (a transaction lock on the group's identity), and the
    group's Questions are locked while it is chosen, so an answer given meanwhile waits or comes
    first: a sheet never joins a Question answered without it (the refuter's case)."""
    _in_scope(project_id)
    chosen = QuestionKind(kind)
    if chosen != QuestionKind.LOW_CONFIDENCE or code.code != answer_codes.WHICH_KIND.code:
        raise ValueError(f"a group Question is a kind Question, not {chosen} {code.code}")
    base = hashlib.sha256(json.dumps([chosen, "group", *identity], sort_keys=True).encode()).hexdigest()[
        :_GROUP_KEY
    ]
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                "select pg_advisory_xact_lock(hashtextextended(%s, 0))",
                [f"takeoff.question_group:{project_id}:{base}"],
            )
        return _join_group(project_id, chosen, base, proposal_id, discipline, options)


def _join_group(
    project_id: uuid.UUID,
    chosen: QuestionKind,
    base: str,
    proposal_id: uuid.UUID,
    discipline: str | None,
    options: Sequence[Any],
) -> uuid.UUID:
    """`ask_group`'s choice, under its lock."""
    tenant = _tenant()
    asked = list(
        Question.objects.select_for_update()
        .filter(tenant_id=tenant, project_id=project_id, question_key__startswith=base)
        .order_by("created_at", "id")
    )
    proposal = Proposal.objects.get(project_id=project_id, id=proposal_id)
    holding = {q for q, held in _held(project_id, [q.id for q in asked]).items() if proposal.id in held}
    row = next((q for q in asked if q.id in holding), None) or next(
        (q for q in asked if q.status == QuestionStatus.OPEN), None
    )
    if row is None:
        message = answer_codes.WHICH_KIND(**kind_words([_sheet(proposal.subject_id)]))
        row, _made = Question.objects.get_or_create(
            tenant_id=tenant,
            project_id=project_id,
            question_key=f"{base}{len(asked):0{64 - _GROUP_KEY}x}",
            defaults={
                "step": SHEETS,
                "kind": chosen,
                "subject_id": None,
                "discipline": discipline or "",
                "message_code": message["code"],
                "params": dict(message["params"]),
                "options": list(options),
            },
        )
    QuestionLink.objects.get_or_create(
        tenant_id=row.tenant_id, project_id=project_id, question=row, proposal=proposal
    )
    return row.id


def ask_kind_again(
    project_id: uuid.UUID, sheets: Sequence[drawings.SheetView | drawings.SheetFacts]
) -> int:
    """After the QS changed these sheets' Discipline (their file's), or after an act (`_after_act`):
    each undecided one of the Discipline of a kind Question that asked it, and held by none now (its
    Question was answered while it was away or left out: `_let_go`), is asked again in that
    Question's group (`ask_group`'s choice: its open one, else a new one), never decided by an answer
    given without it (S18-Q1; review 2 of #628). How many."""
    by_sheet = {s.id: s for s in sheets if not s.decision and s.discipline}
    if not by_sheet:
        return 0
    gone = _let_go(project_id)
    standing: set[uuid.UUID] = set()
    asked_before: dict[uuid.UUID, Question] = {}
    for link in (
        QuestionLink.objects.filter(
            project_id=project_id,
            question__kind=QuestionKind.LOW_CONFIDENCE,
            question__message_code=answer_codes.WHICH_KIND.code,
            proposal__subject_id__in=list(by_sheet),
        )
        .select_related("question", "proposal")
        .order_by("question__created_at", "question_id")
    ):
        if (link.question_id, link.proposal_id) not in gone:
            standing.add(link.proposal_id)
        elif link.question.discipline == by_sheet[link.proposal.subject_id].discipline:
            asked_before[link.proposal_id] = link.question  # the newest such Question, last
    again = 0
    for proposal_id, question in asked_before.items():
        if proposal_id in standing:
            continue
        base = question.question_key[:_GROUP_KEY]
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    "select pg_advisory_xact_lock(hashtextextended(%s, 0))",
                    [f"takeoff.question_group:{project_id}:{base}"],
                )
            _join_group(
                project_id,
                QuestionKind.LOW_CONFIDENCE,
                base,
                proposal_id,
                question.discipline,
                question.options,
            )
        again += 1
    return again


_GROUP_KEY = 56
"""A group Question's key: its identity's digest, this many hex digits, then its generation."""


def asked_of(
    project_id: uuid.UUID, message: Message, proposals: Iterable[uuid.UUID]
) -> uuid.UUID | None:
    """The Question already asked with these words of exactly these Proposals, however it was raised
    (its subject and options aside: the demo's S-07 Question is raised by hand), the earliest; else
    None. A conflict is its words and the sheets it holds (#161)."""
    wanted = set(proposals)
    rows = list(
        Question.objects.filter(
            project_id=project_id, step=SHEETS, message_code=message["code"], params=message["params"]
        ).order_by("created_at", "id")
    )
    held = _held(project_id, [row.id for row in rows])
    return next((row.id for row in rows if set(held.get(row.id, ())) == wanted), None)


def open_questions(project_id: uuid.UUID, ids: Iterable[uuid.UUID]) -> set[uuid.UUID]:
    """Those of these Step 1 Questions still open (neither answered nor withdrawn)."""
    _in_scope(project_id)
    wanted = list(set(ids))
    if not wanted:
        return set()
    return set(
        Question.objects.filter(
            tenant_id=_tenant(),
            project_id=project_id,
            step=SHEETS,
            id__in=wanted,
            status=QuestionStatus.OPEN,
        ).values_list("id", flat=True)
    )


def retire_questions(project_id: uuid.UUID, codes: Iterable[str], raised: Iterable[uuid.UUID]) -> int:
    """After a round that asked the set's Questions of these codes again (#161): each one `raised`
    that a past round retired is open again, and each still open that was not raised is retired,
    `withdrawn` and still listed. An answered Question, or one withdrawn by leaving its sheet out, is
    never touched. One the QS kept open hands that answer to the Question that supersedes it (its
    code, holding every sheet it held, not answered yet); a numbering gap's, to the Discipline's
    `gaps` Question that asks only gaps they kept open (`_heir_of_gaps`). How many were retired. No
    progress row is written: the round's caller writes them once, last (an act's `_after_act`, the read
    job)."""
    _in_scope(project_id)
    asked = set(raised)
    ours = Question.objects.filter(project_id=project_id, step=SHEETS, message_code__in=list(codes))
    ours.filter(id__in=asked, status=QuestionStatus.WITHDRAWN, withdrawn_by__isnull=True).update(
        status=QuestionStatus.OPEN
    )
    leaving = ours.filter(status=QuestionStatus.OPEN).exclude(id__in=asked)
    # A number listed and in no file (or in a file and not listed) is about its own number: its keep-open
    # answer is never handed to another number's Question (the owner's ruling of 11 Oct 2026; #706 r2).
    kept = [
        q
        for q in leaving
        if isinstance(q.answer, dict)
        and q.answer.get("option") == KEEP_OPEN
        and q.message_code not in (list_codes.NOT_FOUND.code, list_codes.NOT_LISTED.code)
    ]
    if kept:
        held = _links(project_id, [q.id for q in kept] + list(asked))
        heirs = list(ours.filter(id__in=asked, status=QuestionStatus.OPEN, answer__isnull=True))
        gapped = [q for q in kept if q.message_code in (list_codes.GAP.code, list_codes.GAPS.code)]
        for given in _heir_of_gaps(gapped, heirs):
            heirs.remove(given)
        for old in (q for q in kept if q not in gapped):
            heir = next(
                (q for q in heirs if q.message_code == old.message_code and held[old.id] <= held[q.id]),
                None,
            )
            if heir is not None:
                heir.answer = old.answer
                heir.save(update_fields=["answer"])
                heirs.remove(heir)
    return leaving.update(status=QuestionStatus.WITHDRAWN)


def _heir_of_gaps(kept: Sequence[Question], heirs: Sequence[Question]) -> list[Question]:
    """The `gaps` Questions given the keep-open answer of the numbering gap Questions they supersede,
    each of a Discipline whose kept-open Questions asked every gap it asks (review 1 of #229: a read
    that fills one gap re-asks the rest, which the QS kept open; a Question asked one per gap before
    #229 is the merged one's predecessor). Matched by the gaps, not the sheets held: the filled gap's
    sheets leave the hold. One asking a gap no kept-open Question asked is the QS's to answer."""
    given = []
    for heir in heirs:
        if heir.message_code != list_codes.GAPS.code:
            continue
        before = [q for q in kept if q.discipline == heir.discipline]
        asked = {gap for q in before for gap in gap_ends(q)}
        wanted = set(gap_ends(heir))
        if before and wanted and wanted <= asked:
            heir.answer = before[0].answer
            heir.save(update_fields=["answer"])
            given.append(heir)
    return given


def _links(project_id: uuid.UUID, ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, set[uuid.UUID]]:
    """Each Question's Proposals (`_held`), by the Question's id."""
    wanted = list(ids)
    held = _held(project_id, wanted)
    return {i: set(held.get(i, ())) for i in wanted}


def record_read_list(
    sheet_id: uuid.UUID,
    discipline: str,
    numbers: Sequence[tuple[str, str] | tuple[str, str, str]],
) -> uuid.UUID:
    """A Discipline's drawing list as read on a printed sheet of the set (13's register entries:
    each number with its title and, where the list gives one, its revision mark, in the list's
    order); its id. Kept beside a list the QS gives: when
    the two disagree, N is unknown until 21c's Question is answered."""
    sheet = _sheet(sheet_id)
    project_id = _project_of(sheet)
    key = _discipline(discipline)
    with writing(project_id):
        row = DrawingRegister.objects.create(
            tenant_id=_tenant(),
            project_id=project_id,
            discipline=key,
            source=RegisterSource.SHEET,
            source_sheet_id=sheet.id,
        )
        seen: set[str] = set()
        for line, entry in enumerate(numbers, start=1):
            number, title = entry[0], entry[1]
            if number in seen:
                continue
            seen.add(number)
            RegisterEntry.objects.create(
                tenant_id=row.tenant_id,
                project_id=project_id,
                register=row,
                number=number,
                title=title,
                # A mark too long to keep is dropped, never cut: cut, it could name the other copy.
                revision_mark=mark
                if len(mark := entry[2] if len(entry) > 2 else "") <= _MARK_LENGTH
                else "",
                line=line,
            )
        record_progress(project_id)
    return row.id


def answer_question(project_id: uuid.UUID, question_id: uuid.UUID, answer: Any) -> None:
    """Record a Question's answer, by the acting user, now (21c answers held files through it)."""
    _in_scope(project_id)
    with writing(project_id):
        row = Question.objects.select_for_update().filter(project_id=project_id, id=question_id).first()
        if row is None:
            raise auth.NotFound
        row.status = QuestionStatus.ANSWERED
        row.answer = answer
        row.answered_by_id = _user()
        row.answered_at = timezone.now()
        row.save(update_fields=["status", "answer", "answered_by", "answered_at"])
        record_progress(project_id)


def settle_by_convention(
    project_id: uuid.UUID,
    question_id: uuid.UUID,
    option: str,
    traces: Sequence[tuple[uuid.UUID, str, Mapping[str, Any]]],
) -> bool:
    """Settle an open Question by a convention (S19-B2: the owner's ruling, 9 Oct 2026): its answer
    is `option` by "convention", and each `(proposal, fact, anchor)` is recorded as its Trace. One
    already answered, or kept open by the QS, is left as it is; whether this call settled it."""
    projects.get(project_id)
    with writing(project_id):
        row = Question.objects.select_for_update().filter(project_id=project_id, id=question_id).first()
        if row is None:
            raise auth.NotFound
        if row.status != QuestionStatus.OPEN or row.answer:
            return False
        for proposal_id, fact, anchor in traces:
            proposal = Proposal.objects.get(project_id=project_id, id=proposal_id)
            ProposalTrace.objects.get_or_create(
                tenant_id=row.tenant_id,
                project_id=project_id,
                proposal=proposal,
                question=row,
                fact=fact[:64],
                anchor=dict(anchor),
            )
        row.status = QuestionStatus.ANSWERED
        row.answer = {"option": option, "by": "convention"}
        row.answered_at = timezone.now()
        row.save(update_fields=["status", "answer", "answered_at"])
        record_progress(project_id)
    return True


def reopen_by_claim(project_id: uuid.UUID, question_id: uuid.UUID) -> bool:
    """Open again a Question the convention settled (`settle_by_convention`) once a third plan claims
    its storey (the owner's ruling, session 19: the convention settles two plans; a third plan's claim
    is asked; review 1 of #648): its answer is withdrawn, so the QS answers it; the convention's
    Traces stay (Traces are never deleted: they say what was read). One the QS answered, or still
    open, is left as it is; whether this call opened it."""
    projects.get(project_id)
    with writing(project_id):
        row = Question.objects.select_for_update().filter(project_id=project_id, id=question_id).first()
        if row is None:
            raise auth.NotFound
        if row.status != QuestionStatus.ANSWERED or (row.answer or {}).get("by") != "convention":
            return False
        row.status = QuestionStatus.OPEN
        row.answer = None
        row.answered_at = None
        row.save(update_fields=["status", "answer", "answered_at"])
        record_progress(project_id)
    return True


@dataclass(frozen=True)
class Answered:
    question: QuestionView
    read_again: uuid.UUID | None
    """A held file the QS chose to read anyway: its read job is to run again (the caller queues it)."""
    corrected: bool = False
    """A sheet's number or Discipline was corrected: the set's Questions were asked again
    (`_after_act`: a typed number another sheet has is a conflict)."""
    moved: tuple[ProposalView, ...] = ()
    """Each Proposal the answer confirmed, left out or corrected, as `proposals` lists it once the
    answer is made; none when it moved no sheet (S27-G7: Step 1's screen shows the answer from these,
    without reading the whole list again). Read for these sheets alone (`proposals`' `only`)."""
    progress: ProgressView | None = None
    """Step 1's progress once the answer is made (`progress`), the one its rows were written from: an
    answer that moves no sheet still closes a Question, and a Discipline's open Questions, status and
    total are progress's (S27-G7's review). None when `answer` ran inside an outer act's block, which
    writes the rows as it ends: its caller counts them there (`progress_counted`)."""


def answer(
    project_id: uuid.UUID,
    question_id: uuid.UUID,
    option: object,
    text: str = "",
    *,
    actor_name: str,
    seen: Sequence[uuid.UUID] | None = None,
) -> Answered:
    """The QS answers a Question with one of its options (m0-screens §5 and 6.7): recorded under
    their name and time, and what the Question held is confirmed, left out or corrected by it. "Keep
    open, ask the consultant" keeps it open. An option the Question does not offer is refused (400),
    and one already answered or withdrawn (409); nothing changes. `seen`: the Proposals the QS saw it
    hold; a kind Question (which grows while open: S15-Q1's groups) holding others now is refused
    (409, `group_changed`, counting the sheets it holds now), so an answer never confirms, for good,
    a sheet the QS did not see. A kind Question that let go of every sheet (`_asked`) is no longer
    asked (409)."""
    auth.require(acts.CONFIRM, project_id)
    _in_scope(project_id)
    taken: list[uuid.UUID] = []
    moved: list[uuid.UUID] = []
    token = _ANSWER_ACTS.set(taken)
    moving = _ANSWER_MOVED.set(moved)
    try:
        with progress_counted() as counted, writing(project_id):
            done = _answer(project_id, question_id, option, text, actor_name, seen, taken)
            if done.corrected and done.question.subject_id is not None:
                moved.append(done.question.subject_id)
            if moved:
                done = replace(done, moved=tuple(proposals(project_id, only=moved)))
        # Counted as the rows were written; inside an outer act's block, none yet (its caller's).
        return replace(done, progress=counted.get(project_id))
    finally:
        _ANSWER_MOVED.reset(moving)
        _ANSWER_ACTS.reset(token)


def _answered(row: Question) -> None:
    """An answer that took no act (it confirmed and left out nothing) in the event log, under the
    QS: so their Acts count every answer (`takeoff.step1.answered`, S22-FL10 round 1)."""
    events.record(
        said.ANSWERED,
        subject_type="question",
        subject_id=row.id,
        actor_user_id=_user(),
        project_id=row.project_id,
    )


def _answer(
    project_id: uuid.UUID,
    question_id: uuid.UUID,
    option: object,
    text: str,
    actor_name: str,
    seen: Sequence[uuid.UUID] | None,
    taken: list[uuid.UUID],
) -> Answered:
    """`answer`, in its transaction. Every answer is one event in the log: the confirm or exclude
    it took (`_act`), else `takeoff.step1.answered`, the Question's own."""
    read_again = None
    row = (
        Question.objects.select_for_update()
        .filter(project_id=project_id, step=SHEETS, id=question_id)
        .first()
    )
    if row is None:
        raise auth.NotFound
    if row.status != QuestionStatus.OPEN and not _withdrawn_by_standing_exclusion(row):
        raise auth.Refused(answer_codes.ANSWERED_ALREADY(), status=409)
    held = _held_now(project_id, row)
    if _grouped(row) and not held:
        raise auth.Refused(answer_codes.ANSWERED_ALREADY(), status=409)
    offered = [o.get("key") for o in row.options if isinstance(o, dict)]
    if not isinstance(option, str) or option not in offered:
        raise auth.Refused(answer_codes.OPTION_NOT_OFFERED(), status=400)
    words = text.strip() if isinstance(text, str) else ""
    given: dict[str, Any] = {"option": option, "by": actor_name}
    if words and option == "type_number":  # the only option that takes the QS's words
        given["text"] = words
    if option == KEEP_OPEN:
        row.answer = given
        row.save(update_fields=["answer"])
        _answered(row)
        _after_act(project_id)
        return Answered(_question_view(project_id, row.id), None)
    if row.kind == QuestionKind.LOW_CONFIDENCE and seen is not None and set(seen) != set(held):
        raise auth.Refused(answer_codes.GROUP_CHANGED(sheets=len(held)), status=409)
    if _grouped(row):  # what its card listed, for good (`_let_go`): never a sheet left out then
        given["sheets"] = [str(p) for p in held]
    read_again = _apply(project_id, row, option, words, held, actor_name)
    corrected = (
        row.kind == QuestionKind.MISSING and option == "type_number"
    ) or row.kind == QuestionKind.MISSING_DISCIPLINE
    row.status = QuestionStatus.ANSWERED
    row.answer = given
    row.answered_by_id = _user()
    row.answered_at = timezone.now()
    row.save(update_fields=["status", "answer", "answered_by", "answered_at"])
    if not taken:
        _answered(row)
    _after_act(project_id, corrected=corrected)
    return Answered(_question_view(project_id, row.id), read_again, corrected)


def answer_disciplines(
    project_id: uuid.UUID, sheets: Sequence[drawings.SheetView], *, actor_name: str = ""
) -> int:
    """The open `missing_discipline` Questions of these sheets, answered by the Discipline each now
    has (its file's, chosen by the QS: #159), as if the QS had picked it; how many were answered."""
    given = {s.id: s.discipline for s in sheets if s.discipline}
    answered = 0
    with writing(project_id):
        for row in Question.objects.select_for_update().filter(
            project_id=project_id,
            step=SHEETS,
            status=QuestionStatus.OPEN,
            kind=QuestionKind.MISSING_DISCIPLINE,
            subject_id__in=list(given),
        ):
            assert row.subject_id is not None
            row.status = QuestionStatus.ANSWERED
            row.answer = {
                "option": given[row.subject_id],
                "by": actor_name,
                "given_by": "file_discipline",
            }
            row.answered_by_id = _user()
            row.answered_at = timezone.now()
            row.save(update_fields=["status", "answer", "answered_by", "answered_at"])
            answered += 1
        if answered:
            record_progress(project_id)
    return answered


def _question_view(project_id: uuid.UUID, question_id: uuid.UUID) -> QuestionView:
    """The one Question as `questions` lists it, read on its own (not every Question of the Project)."""
    _in_scope(project_id)
    of_step = Question.objects.filter(project_id=project_id, step=SHEETS)
    q = of_step.filter(id=question_id).first()
    held = _held_now(project_id, q) if q is not None else []
    if q is None or not _asked(project_id, [q], {q.id: held}):
        return next(q for q in questions(project_id) if q.id == question_id)  # as it always was
    before = Q(created_at__lt=q.created_at) | Q(created_at=q.created_at, id__lt=q.id)
    return _question_view_of(q, held, of_step.filter(before).count() + 1)


def _apply(
    project_id: uuid.UUID,
    row: Question,
    option: str,
    text: str,
    held: Sequence[uuid.UUID],
    actor_name: str,
) -> uuid.UUID | None:
    """What answering does, by the Question's kind (see `answer`)."""
    kind = row.kind
    if kind == QuestionKind.FILE_MISREAD:
        assert row.subject_id is not None
        drawings.answer_held(row.subject_id, option)
        return row.subject_id if option == "read_anyway" else None
    if kind == QuestionKind.CONFLICT and row.message_code != answer_codes.LISTS_DISAGREE.code:
        if option == "keep_latest":
            copies = _copies(project_id, held)
            if copies:
                latest = max(copies, key=lambda copy: copy[1])
                _confirm(project_id, [latest[0]], kind=None, actor_name=actor_name, answering=True)
                others = [i for i, _place in copies if i != latest[0]]
                if others:
                    _exclude(project_id, others, "superseded", actor_name=actor_name, answering=True)
        elif option == "keep_all" and held:
            _confirm(project_id, list(held), kind=None, actor_name=actor_name, answering=True)
    elif kind == QuestionKind.MISSING and option == "type_number":
        if not text:
            raise auth.Refused(answer_codes.NUMBER_NEEDED(), status=400)
        assert row.subject_id is not None
        drawings.set_sheet_number(row.subject_id, text)
    elif kind == QuestionKind.MISSING_DISCIPLINE:
        assert row.subject_id is not None
        drawings.set_sheet_discipline(row.subject_id, option)
    elif kind == QuestionKind.LOW_CONFIDENCE and held:
        _answer_kind(project_id, held, option, actor_name, question=row)
    return None


def _answer_kind(
    project_id: uuid.UUID,
    held: Sequence[uuid.UUID],
    option: str,
    actor_name: str,
    *,
    question: Question,
) -> None:
    """A kind Question's answer, over the sheets it holds now (`_held_now`: a sheet now of another
    Discipline is let go, so the answer never reaches it; review 2, l1-f1): every one that is ready
    (`_kind_split`) confirmed with the kind in one act (S15-Q1; each sheet's `decided_with` counts
    them). A sheet another open Question holds (its number, its Discipline, a conflict: review 2,
    l2-f1) is not confirmed, as bulk confirm's `question_first` would hold it, and nothing is written
    on it: its confirmation reads the kind from this answer once that Question is answered, while it
    is still of this Question's Discipline (`_kinds_answered`; review 3, l1-f1). A sheet already
    decided is not decided again (one left out stays out)."""
    ready, _waiting = _kind_split(project_id, question, held)
    if ready:
        _confirm(project_id, ready, kind=option, actor_name=actor_name, answering=True)


def _kind_split(
    project_id: uuid.UUID, question: Question, held: Sequence[uuid.UUID]
) -> tuple[list[uuid.UUID], list[uuid.UUID]]:
    """What a kind Question's answer would do with the Proposals it holds (`_held_now`), in order:
    those it would confirm; and those it leaves open because another open Question holds them (by a
    link or by its subject). The two drawing lists' Question, which holds a Discipline, and the
    Discipline's numbering gap Question (S15-Q2), which holds the sheets beside its gaps from their
    agreeing (`_agreeing`), are aside: neither asks what a sheet is, and the gap Question's links
    stay after its gaps change (append-only), so a kind answer never waits on them. An open kind
    Question holds no decided sheet (`_held`), so its words and its answer count the same."""
    facts = {s.id: s for s in _facts(project_id)}
    proposals_held = {p.id: p for p in Proposal.objects.filter(project_id=project_id, id__in=held)}
    others = (
        Question.objects.filter(project_id=project_id, step=SHEETS, status=QuestionStatus.OPEN)
        .exclude(id=question.id)
        .exclude(message_code__in=[list_codes.GAP.code, list_codes.GAPS.code])
    )
    linked = {
        p for ps in _held(project_id, others.values_list("id", flat=True)).values() for p in ps
    } & set(proposals_held)
    subjects = {p.subject_id for p in proposals_held.values()}
    asked = set(others.filter(subject_id__in=list(subjects)).values_list("subject_id", flat=True))
    ready: list[uuid.UUID] = []
    waiting: list[uuid.UUID] = []
    for i in held:
        proposal = proposals_held.get(i)
        sheet = facts.get(proposal.subject_id) if proposal is not None else None
        if proposal is None or sheet is None:
            continue
        if i in linked or proposal.subject_id in asked:
            waiting.append(i)
        else:
            ready.append(i)
    return ready, waiting


def _copies(project_id: uuid.UUID, held: Sequence[uuid.UUID]) -> list[tuple[uuid.UUID, tuple[Any, ...]]]:
    """The held Proposals `proposals` lists (each its sheet's one Proposal, the sheet in the sheet
    list), in held order, each with its place among copies of one number (its issue date as
    `proposals` words it, then its revision mark): read for these sheets alone, not the whole list
    (S15-A2's 500 ms)."""
    by_sheet = {p.subject_id: p for p in _proposals_of(project_id)}
    listed = {s.id: s for s in _sheets(project_id)}
    sheet_of = {p.id: listed[sheet_id] for sheet_id, p in by_sheet.items() if sheet_id in listed}
    order = markets.of_developer(_tenant()).date_order
    return [
        (i, (_date_of(iso_date(sheet.issue_date, order)), _natural(sheet.revision_mark)))
        for i in held
        if (sheet := sheet_of.get(i)) is not None
    ]


def _date_of(text: str | None) -> tuple[int, int, int]:
    parts = [int(p) for p in re.split(r"[./-]", text.strip()) if p.isdigit()] if text else []
    if len(parts) != 3:
        return (0, 0, 0)
    day, month, year = parts
    if day > 31:  # written year first
        day, year = year, day
    return (year, month, day)


def _natural(text: str) -> list[tuple[int, int, str]]:
    return [
        (0, int(p), "") if p.isdigit() else (1, 0, p.casefold())
        for p in re.split(r"(\d+)", text or "")
        if p
    ]


_PROGRESS_AT_END: contextvars.ContextVar[set[uuid.UUID] | None] = contextvars.ContextVar(
    "step1_progress_at_end", default=None
)
_PROGRESS_COUNTED: contextvars.ContextVar[dict[uuid.UUID, ProgressView] | None] = contextvars.ContextVar(
    "step1_progress_counted", default=None
)


@contextlib.contextmanager
def progress_counted() -> Iterator[dict[uuid.UUID, ProgressView]]:
    """The progress `record_progress` counts as it writes the rows inside the block, by Project, so
    an answer's reply carries the count the rows were written from, never counting it again
    (S27-G7). The innermost block is the one filled; open it around the block whose end writes them
    (`writing`'s, the outermost)."""
    counted: dict[uuid.UUID, ProgressView] = {}
    token = _PROGRESS_COUNTED.set(counted)
    try:
        yield counted
    finally:
        _PROGRESS_COUNTED.reset(token)


@contextlib.contextmanager
def writing(project_id: uuid.UUID) -> Iterator[None]:
    """An act's transaction on Step 1 (#227): Step 1's write lock on the Project taken first
    (`lock_writes`), and its progress rows written last (`progress_at_end`); the sheet list's facts
    and the Questions' holdings read once between its writes (`reads_between_writes`)."""
    with transaction.atomic(), reads_between_writes(), progress_at_end():
        lock_writes(project_id)
        yield


_READS: contextvars.ContextVar[dict[Hashable, Any] | None] = contextvars.ContextVar(
    "step1_reads", default=None
)


def _in_scope(project_id: uuid.UUID) -> None:
    """Refuse a Project not in the acting Membership's scope as not found (`projects.get`); inside an
    act, checked once (`_remembered`: a refusal is never remembered, so it refuses again)."""
    _remembered(("scope", project_id), lambda: projects.get(project_id))


def _set_of(project_id: uuid.UUID) -> drawings.SetView | None:
    """The Project's Drawing Set (`drawings.set_of`); inside an act, read once between its writes."""
    return _remembered(("set", project_id), lambda: drawings.set_of(project_id))


def files_of(project_id: uuid.UUID) -> list[drawings.FileView]:
    """The files of the Project's Drawing Set (`drawings.files`), none before its first. Read every
    time, never remembered: a file's state is its read job's, which a worker moves on its own
    connection, outside Step 1's write lock."""
    drawing_set = _set_of(project_id)
    return drawings.files(drawing_set.id) if drawing_set else []


def _remembered[T](key: Hashable, read: Callable[[], T]) -> T:
    """`read()`, or inside `reads_between_writes` what it gave since the act's last write. The
    caller copies what it hands out, so no reader changes another's."""
    memo = _READS.get()
    if memo is None:
        return read()
    if key not in memo:
        memo[key] = read()
    return cast(T, memo[key])


def _reading(sql: str) -> bool:
    """Whether a statement only reads: a SELECT that sets no setting (`set_config` moves the tenant
    row-level security reads by), or a savepoint made or released (a nested act's: neither changes
    a row). Anything else (a write, a rollback to a savepoint) is a write."""
    words = sql.lstrip().lower()
    if words.startswith(("savepoint", "release savepoint")):  # a rollback to one is a write
        return True
    return words.startswith("select") and "set_config" not in words


@contextlib.contextmanager
def reads_between_writes() -> Iterator[None]:
    """An act's repeated reads of the same rows answered once until its next write (S15-A2's 500 ms
    bound, #638): every statement the act's connection runs that is not a plain read
    (`_reading`) forgets them all, before it runs, so a read after a write is read again. Another
    transaction's writes are not waited for: Step 1's write lock keeps a read job's writes out
    while an act holds it (`lock_writes`). A block inside another shares the outer one's."""
    if _READS.get() is not None:
        yield
        return
    memo: dict[Hashable, Any] = {}

    def forget_on_write(
        execute: Callable[..., Any], sql: str, params: Any, many: bool, context: Any
    ) -> Any:
        if not _reading(sql):
            memo.clear()
        return execute(sql, params, many, context)

    token = _READS.set(memo)
    try:
        with connection.execute_wrapper(forget_on_write):
            yield
    finally:
        _READS.reset(token)


def lock_writes(project_id: uuid.UUID) -> None:
    """Step 1's write lock on the Project, held to the transaction's end (#227, review round 3).
    Every act takes it as its transaction's first statement, before any row lock (`writing`); a
    read job takes it just before its short write phase (the proposals' rows, the set's Questions,
    the Plot's matches kept), after its long reading (the Plot's pages, Jev's answers, the set's
    recognisers: S21-C1's `proposals.find_questions`), which holds no row an act locks. So an act
    and a job share their rows one at a time: an act waits at most for a job's write phase
    (seconds), never for its reading, and the two never wait on each other
    in a cycle, whatever rows they share (a sheet the match lets go, a Question both retire, a PDF's
    row). The Discipline change takes it first too (`drawings.before_discipline_change`). Taken
    again in the same transaction, it is already held; an act aborted anyway is run again
    (`platform.services.deadlocks`)."""
    assert connection.in_atomic_block, "Step 1's write lock is a transaction's"
    with connection.cursor() as cursor:
        cursor.execute(
            "select pg_advisory_xact_lock(hashtextextended(%s, 0))", [f"step1-write:{project_id}"]
        )


@contextlib.contextmanager
def progress_at_end() -> Iterator[None]:
    """Step 1's progress rows written once, as the block ends, however often it records them; a
    block inside another is written as the outer one ends. `record_progress` takes a per-Project
    lock, so the progress lock is the last lock any transaction takes, after all its own row locks:
    every act and every read job's step runs inside one, the whole of its transaction (#227).
    A read job's step holds the rows only for the moment before it commits, never while it
    proposes. That alone does not keep an act and a job out of a cycle on the rows before it (a
    Question both retire, a sheet the match lets go): Step 1's write lock does (`lock_writes`).
    Nothing is written if the block raises (its transaction rolls back)."""
    if _PROGRESS_AT_END.get() is not None:
        yield
        return
    held: set[uuid.UUID] = set()
    token = _PROGRESS_AT_END.set(held)
    try:
        yield
    finally:
        _PROGRESS_AT_END.reset(token)
    for project_id in sorted(held, key=str):
        record_progress(project_id)


def record_progress(project_id: uuid.UUID) -> None:
    """Keep Step 1's progress rows as `progress` counts them, one per Discipline (and one for the
    sheets of none); inside `progress_at_end` (every act's and every read job's), as its block
    ends."""
    held = _PROGRESS_AT_END.get()
    if held is not None:
        held.add(project_id)
        return
    # Counted and written under one lock per Project, held to the transaction's end: an act and a
    # read job writing the rows at once never write a count that misses the other's (#227's review).
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                "select pg_advisory_xact_lock(hashtextextended(%s, 0))", [f"step1-progress:{project_id}"]
            )
        tenant_id = _tenant()
        counted = progress(project_id)
        if (kept := _PROGRESS_COUNTED.get()) is not None:
            kept[project_id] = counted
        for row in counted.disciplines:
            status = row.status
            StepProgress.objects.update_or_create(
                tenant_id=tenant_id,
                project_id=project_id,
                building_id=None,
                step=SHEETS,
                discipline=row.discipline or "",
                defaults={
                    "status": status,
                    "placed": row.confirmed,
                    "total": row.total,
                    "open_questions": row.open_questions,
                    "updated_at": timezone.now(),
                },
            )
