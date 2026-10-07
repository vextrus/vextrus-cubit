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

For the seed and 21c's read job: `propose_sheet`, `record_coverage`, `raise_question`,
`answer_question` and `record_progress` write the rows Step 1 reads.
"""

import contextlib
import hashlib
import json
import re
import uuid
from collections import Counter
from collections.abc import Hashable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any, cast

from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from engine.check import register
from engine.messages import Message
from engine.messages import register_check as list_codes
from engine.recognise import views as view_finder
from engine.recognise.conflicts import Numbers, recognisers
from engine.recognise.sheets import default_conventions
from engine.recognise.types import DisciplineConvention, SheetConventions, ValueSource
from vextrus.drawings import services as drawings
from vextrus.platform.services import auth, invitations, jev, markets, tenancy
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
    decided_by_role: str | None = None
    """The actor's role in the Developer ("qs", "vextrus_engineer"): "Nusrat Jahan, QS" (6.6)."""
    decided_with: int = 0
    """How many sheets the act that decided it decided: "Confirmed in bulk with 55 other sheets"."""
    number_source: str | None = None
    """Where its number was read: "title_block_attribute", "title_block_text", …; None for none."""
    title_source: str | None = None
    storeys_as_stated: str = ""
    layout: str | None = None
    """The layout it is laid out on, by name; None when laid out in the drawing (a frame)."""
    plot_file: str | None = None
    plot_page: int | None = None
    plot_residual: str | None = None
    plot_title_alike: bool = False
    """Its Plot page reads its title as well as its number (#229): the page is its second source."""
    plot_none: dict[str, Any] | None = None
    """Why it has no Plot (a message), or None when a page matched or no PDF was added."""
    views: list[SheetViewView] = field(default_factory=list)
    """Its views in reading order, title block included."""


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
    """Views excluded or proposed to be, by reason."""
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
    """The Project's printed sheets in the sheet list (the scope checked first); none before a file."""
    projects.get(project_id)
    drawing_set = drawings.set_of(project_id)
    return drawings.sheets(drawing_set.id) if drawing_set else []


def _proposals_of(project_id: uuid.UUID) -> list[Proposal]:
    return list(
        Proposal.objects.filter(
            project_id=project_id, step=SHEETS, subject=ProposalSubject.SHEET
        ).exclude(status=ProposalStatus.SUPERSEDED)
    )


def proposals(project_id: uuid.UUID) -> list[ProposalView]:
    """One per printed sheet in the sheet list, by Discipline in the Market's order (a sheet of no
    Discipline last), then number in natural order (S-2 before S-10), unnumbered last."""
    sheets = _sheets(project_id)
    by_sheet = {p.subject_id: p for p in _proposals_of(project_id)}
    drawing_set = drawings.set_of(project_id)
    names = {f.id: f.name for f in drawings.files(drawing_set.id)} if drawing_set else {}
    stamps = {s.confirmation_id for s in sheets if s.confirmation_id}
    # Who and when, from the act that decided each sheet (a decision put back by an undo keeps its
    # own act's name and time).
    acts = list(Confirmation.objects.filter(id__in=stamps))
    who = {c.id: (c.by_name, c.at, c.kind) for c in acts}
    roles = invitations.roles_of({c.user_id for c in acts})
    role = {c.id: roles.get(c.user_id) for c in acts}
    size = {c.id: c.proposals for c in acts}
    agreeing = _agreeing(project_id, sheets, by_sheet)
    order = markets.of_developer(_tenant()).date_order
    return [
        replace(
            _proposal_view(s, by_sheet.get(s.id), names, who, order),
            agrees=s.id in agreeing,
            decided_by_role=role.get(s.confirmation_id) if s.confirmation_id else None,
            decided_with=size.get(s.confirmation_id, 0) if s.confirmation_id else 0,
        )
        for s in sheets
    ]


_TITLE_BLOCK = frozenset({ValueSource.TITLE_BLOCK_ATTRIBUTE, ValueSource.TITLE_BLOCK_TEXT})


def _agreeing(
    project_id: uuid.UUID,
    sheets: Sequence[drawings.SheetView],
    by_sheet: Mapping[uuid.UUID, Proposal],
) -> set[uuid.UUID]:
    """The printed sheets two sources agree on (`ProposalView.agrees`)."""
    open_questions = Question.objects.filter(
        project_id=project_id, step=SHEETS, status=QuestionStatus.OPEN
    )
    asked = set(open_questions.exclude(subject_id=None).values_list("subject_id", flat=True))
    gap_codes = [list_codes.GAP.code, list_codes.GAPS.code]
    links = QuestionLink.objects.filter(project_id=project_id, question__in=open_questions)
    linked = set(
        links.exclude(question__message_code__in=gap_codes).values_list("proposal_id", flat=True)
    )
    # A numbering gap holds its neighbours only while its Discipline has no drawing list (#229): a
    # list typed after the gap was asked is the second source, not the numbering.
    gap_linked = set(
        links.filter(question__message_code__in=gap_codes).values_list("proposal_id", flat=True)
    )
    conventions = _conventions()
    numbers = Numbers(conventions, recognisers(conventions))
    beside = _beside_gaps(open_questions, numbers)
    of_discipline: dict[str, list[drawings.SheetView]] = {}
    for sheet in sheets:
        if sheet.discipline is not None:
            of_discipline.setdefault(sheet.discipline, []).append(sheet)
    agreeing: set[uuid.UUID] = set()
    for discipline, everyone in of_discipline.items():
        # Two sheets of one number never agree: which of them is the sheet is a Question's.
        keys = Counter(numbers.key(s.number, discipline) for s in everyone if s.number)
        mine = [s for s in everyone if s.number and keys[numbers.key(s.number, discipline)] == 1]
        lists = _lists(project_id, discipline)
        standing = lists.standing
        if standing is not None and not lists.disagree:
            listed = {numbers.key(n, discipline) for n in _numbers(standing)}
            second = {s.id for s in mine if s.number and numbers.key(s.number, discipline) in listed}
        elif standing is None:
            # A matched Plot page whose number and title read alike, gap or no gap (#229): a gap
            # holds only the sheets beside it, through its open Question's links.
            second = {s.id for s in mine if s.plot.page is not None and s.plot.title_alike}
        else:
            second = set()
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
                agreeing.add(sheet.id)
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


def _place(numbers: Numbers, number: str | None, discipline: str) -> Hashable | None:
    """A number's series and running number in its Discipline (its suffix aside); none without."""
    parts = numbers.parts_in(number, discipline) if number else None
    return None if parts is None else (parts[0], parts[1])


def _proposal_view(
    sheet: drawings.SheetView,
    proposal: Proposal | None,
    names: Mapping[uuid.UUID, str],
    who: Mapping[uuid.UUID, tuple[str, datetime, str]],
    date_order: str,
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
        kind=sheet.kind or (pick or {}).get("choice"),
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
        plot_file=names.get(sheet.plot.file_id) if sheet.plot.file_id and sheet.plot.page else None,
        plot_page=sheet.plot.page,
        plot_residual=sheet.plot.residual,
        plot_title_alike=sheet.plot.page is not None and sheet.plot.title_alike,
        plot_none=dict(sheet.plot.none) if sheet.plot.none else None,
        views=[_sheet_view_view(v) for v in drawings.views(sheet.id)],
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
    projects.get(project_id)
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
        QuestionView(
            id=q.id,
            kind=q.kind,
            status=q.status,
            code=q.message_code,
            params=dict(q.params),
            options=list(q.options),
            discipline=q.discipline or None,
            subject_id=q.subject_id,
            check_code=q.check_code or None,
            answer=q.answer,
            answered_at=q.answered_at,
            proposals=held.get(q.id, []),
            withdrawn_by=q.withdrawn_by_id if q.status == QuestionStatus.WITHDRAWN else None,
            blocking=q.kind in FIRST
            and (q.status == QuestionStatus.OPEN or _withdrawn_by_standing_exclusion(q)),
            raised=raised.get(q.id),
        )
        for q in sorted(found, key=queued)
    ]


_QUEUE: dict[str, int] = {
    QuestionKind.CONFLICT: 0,
    QuestionKind.MISSING: 1,
    QuestionKind.MISSING_DISCIPLINE: 1,
    QuestionKind.LOW_CONFIDENCE: 2,
}
"""The queue's order by kind, after the held file and the Questions holding the most sheets."""


def _held(project_id: uuid.UUID) -> dict[uuid.UUID, list[uuid.UUID]]:
    """Each Question's Proposals, in the order linked."""
    held: dict[uuid.UUID, list[uuid.UUID]] = {}
    for link in QuestionLink.objects.filter(project_id=project_id).order_by("id"):
        held.setdefault(link.question_id, []).append(link.proposal_id)
    return held


def _asked(
    project_id: uuid.UUID,
    found: Iterable[Question],
    held: Mapping[uuid.UUID, Sequence[uuid.UUID]],
    *,
    listed: set[uuid.UUID] | None = None,
) -> list[Question]:
    """The Questions still asked: one holding only sheets no longer in the sheet list (their file
    cancelled, or set aside) is not, so it neither shows nor holds its Discipline open."""
    on_list = listed if listed is not None else {s.id for s in _sheets(project_id)}
    sheet_of = dict(
        Proposal.objects.filter(project_id=project_id, step=SHEETS).values_list("id", "subject_id")
    )
    return [
        q for q in found if not held.get(q.id) or any(sheet_of.get(p) in on_list for p in held[q.id])
    ]


def coverage(project_id: uuid.UUID) -> CoverageView:
    """Every view of every sheet in the sheet list, counted once (a held file's views are not
    counted until it is read anyway): assigned, excluded, proposed or unaccounted; used from M1."""
    deciding = {s.id: s.confirmation_id for s in _sheets(project_id)}
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
        counts[_counted(row)] += 1
        if row.status == CoverageStatus.UNACCOUNTED:
            unaccounted.append(
                UnaccountedView(
                    view_proposals.get(row.view_id, row.view_id), row.view_id, row.sheet_revision_id
                )
            )
        if any(s.used for s in steps.get(row.id, ())):
            used += 1
        if row.status == CoverageStatus.EXCLUDED:
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
    drawing_set = drawings.set_of(project_id)
    if drawing_set is None:
        return 0
    read = {
        str(f.id)
        for f in drawings.files(drawing_set.id)
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
    row, last), and the Market's expected Disciplines not yet received. A sheet proposed out with no
    number is not counted unless the QS confirmed it."""
    sheets = [s for s in _sheets(project_id) if _counted_sheet(s)]
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
    drawing_set = drawings.set_of(project_id)
    files = drawings.files(drawing_set.id) if drawing_set else []
    reading = Counter(
        f.discipline
        for f in files
        if f.state
        in (drawings.FileState.WAITING, drawings.FileState.READING, drawings.FileState.RETRYING)
    )
    paged: dict[str | None, set[uuid.UUID]] = {}
    for sheet in sheets:
        if sheet.plot.page is not None and sheet.plot.file_id is not None:
            paged.setdefault(sheet.discipline, set()).add(sheet.plot.file_id)
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


def proposed_out(sheet: drawings.SheetView) -> bool:
    """The read proposed the sheet out and it has no number (a cover, a stale layout; #162): it is
    asked nothing, and Step 1 does not count it unless the QS confirms it in."""
    return bool(sheet.proposed_exclusion) and not sheet.number


def _counted_sheet(sheet: drawings.SheetView) -> bool:
    return not proposed_out(sheet) or sheet.decision == "confirmed"


def _not_received(project_id: uuid.UUID) -> list[str]:
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        return []
    expected = EXPECTED.get(markets.of_developer(tenant_id).code, ())
    drawing_set = drawings.set_of(project_id)
    received = {f.discipline for f in drawings.files(drawing_set.id)} if drawing_set else set()
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
    projects.get(project_id)
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
    projects.get(project_id)
    key = _discipline(discipline)
    parsed = _parse(text)
    with transaction.atomic():
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
    on = drawings.sheet(lists.read.source_sheet_id) if lists.read.source_sheet_id else None
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
    projects.get(project_id)
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
) -> Confirmation:
    return Confirmation.objects.create(
        before={"sheets": {str(sheet.id): _decision_of(sheet) for sheet in before}},
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


def _chosen(
    project_id: uuid.UUID, ids: Sequence[object]
) -> list[tuple[drawings.SheetView, Proposal | None]]:
    """Each named printed sheet with its Proposal, in the order named; any id not of this Project's
    sheet list (another Project's, another Developer's, none) is not found, and nothing is done. So
    is a sheet of a held file read anyway that its read job has not proposed yet: its Questions (its
    number, its Discipline) are raised with its Proposal, so it is not decided before them."""
    if not isinstance(ids, (list, tuple)) or not ids:
        raise auth.Refused(said.NOTHING_CHOSEN(), status=400)
    listed = {s.id: s for s in _sheets(project_id)}
    proposed = _proposals_of(project_id)
    by_id = {p.id: p for p in proposed}
    by_sheet = {p.subject_id: p for p in proposed}
    chosen: dict[uuid.UUID, tuple[drawings.SheetView, Proposal | None]] = {}
    for given in ids:
        try:
            named = given if isinstance(given, uuid.UUID) else uuid.UUID(str(given))
        except ValueError:
            raise auth.NotFound from None
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
    return _confirm(project_id, ids, kind=kind, actor_name=actor_name, answering=False)


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
    with transaction.atomic():
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
            drawings.confirm_sheet(sheet.id, confirmation_id=act.id, kind=wanted)
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
            _decide_views(sheet.id, act, None, "")
        record_progress(project_id)
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
    many."""
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
    code = said.HELD_FILE if held else said.ONE_SOURCE
    # `sheets` is a list, which `Message`'s params (str | int) do not type: the ruling's shape.
    message = code(count=len(alone), sheets="", **_named(first))
    message["params"]["sheets"] = cast(Any, [str(p.id if p else s.id) for s, p in alone])
    raise auth.Refused(message, status=409)


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
    for link in QuestionLink.objects.filter(
        project_id=project_id, question__in=open_questions, proposal_id__in=list(proposal_of)
    ):
        linked.setdefault(link.question_id, set()).add(proposal_of[link.proposal_id])
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
        _no_question_first(project_id, [(drawings.sheet(sheet_id), proposal)])
    except auth.Refused:
        return True
    return False


def _kinds_answered(project_id: uuid.UUID, proposal_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, str]:
    """The kind each Proposal's answered `low_confidence` Question chose (its option, a kind; the
    newest answer when there are several), by Proposal."""
    kinds: dict[uuid.UUID, str] = {}
    if not proposal_ids:
        return kinds
    links = QuestionLink.objects.filter(
        project_id=project_id,
        proposal_id__in=proposal_ids,
        question__kind=QuestionKind.LOW_CONFIDENCE,
        question__status=QuestionStatus.ANSWERED,
    ).select_related("question")
    for link in sorted(links, key=lambda link: (link.question.answered_at, link.question_id)):
        option = link.question.answer.get("option") if isinstance(link.question.answer, dict) else None
        if isinstance(option, str) and option != KEEP_OPEN:
            kinds[link.proposal_id] = option
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
    for link in QuestionLink.objects.filter(project_id=project_id, question__in=asked).order_by("id"):
        by_proposal.setdefault(link.proposal_id, next(q for q in asked if q.id == link.question_id))
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
    linked = QuestionLink.objects.filter(
        project_id=project_id, proposal_id__in=proposal_ids
    ).values_list("question_id", flat=True)
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
    return _exclude(project_id, ids, reason, text, actor_name=actor_name, answering=False)


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
    with transaction.atomic():
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
        )
        _withdraw_first(project_id, chosen, act)
        for sheet, proposal in chosen:
            proposal = proposal or _propose(project_id, sheet)
            drawings.exclude(sheet.id, reason, words, confirmation_id=act.id)
            proposal.rejected_reason = reason
            _stamp(proposal, ProposalStatus.REJECTED, act)
            _decide_views(sheet.id, act, reason, words.strip())
        _exclude_views(project_id, act, views, reason, words)
        record_progress(project_id)
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
    listed = {s.id for s in _sheets(project_id)}
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
        drawings.exclude(proposal.subject_id, reason, words, confirmation_id=act.id)
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
    projects.get(project_id)  # a Project not in scope (of another Developer, or none) is not found
    if (
        not isinstance(steps, (list, tuple))
        or not steps
        or any(not isinstance(step, str) or step not in ASSIGNABLE for step in steps)
    ):
        raise auth.Refused(said.STEP_UNKNOWN(), status=400)
    if not isinstance(ids, (list, tuple)) or not ids:
        raise auth.Refused(said.NO_VIEW_CHOSEN(), status=400)
    with transaction.atomic():
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


def _standing_steps(row: Coverage) -> list[str]:
    try:
        deciding = drawings.sheet(row.sheet_revision_id).confirmation_id
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


def _account(row: Coverage, sheet: drawings.SheetView, act: Confirmation) -> bool:
    """A view the read gave no step, on a sheet confirmed by `act`: assigned under the act when a step
    stands for it (the QS's `assign`), else when its sheet's confirmed kind names Steps, given them by
    the act (a Structural `beam_details`: beams). False when neither: it stays unaccounted."""
    if not _standing_steps(row):
        for step in view_finder.kind_steps(sheet.confirmed_kind or "", sheet.discipline):
            _give_step(row, step, act)
        if not _standing_steps(row):
            return False
    row.status, row.reason, row.reason_text = CoverageStatus.ASSIGNED, "", ""
    row.confirmation = act
    row.confirmed_by_id = act.user_id
    row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])
    return True


def undo(project_id: uuid.UUID) -> ActView:
    """Take back the acting user's own last act on Step 1 not yet undone (a confirmation, an
    exclusion, a drawing list); refused as `answer_stays` when that act answered a Question. Each
    sheet it still decides goes back to what it carried before the act (another person's decision
    included), or to undecided; its Proposal and its views' Coverage
    follow. A sheet another act has decided since is left as that act decided it."""
    auth.require(acts.UNDO, project_id)
    projects.get(project_id)  # a Project not in scope (of another Developer, or none) is not found
    with transaction.atomic():
        act = (
            Confirmation.objects.select_for_update()
            .filter(project_id=project_id, step=SHEETS, user_id=_user(), undone_at__isnull=True)
            .order_by("-at", "-id")
            .first()
        )
        if act is None:
            raise auth.Refused(said.NOTHING_TO_UNDO(), status=409)
        if act.kind == ConfirmationKind.QUESTION_ANSWER:
            # An answer has no undo: taking back its confirm or exclusion would leave the Question
            # answered by sheets it no longer decides. Its sheets are still excluded or confirmed.
            raise auth.Refused(said.ANSWER_STAYS(), status=409)
        listed = {s.id for s in _sheets(project_id) if s.confirmation_id == act.id}
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
            _put_back_sheet(project_id, sheet_id, _standing_before(act, sheet_id))
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
        record_progress(project_id)
    return _act_view(act)


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
    proposal = next((p for p in _proposals_of(project_id) if p.subject_id == sheet_id), None)
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
        drawings.exclude(sheet_id, prior["reason"], prior["text"] or "", confirmation_id=earlier.id)
        _decide_views(sheet_id, earlier, prior["reason"], prior["text"] or "")
        if proposal is not None:
            proposal.rejected_reason = prior["reason"]
            _stamp(proposal, ProposalStatus.REJECTED, earlier)
    else:
        drawings.confirm_sheet(sheet_id, confirmation_id=earlier.id, kind=prior["kind"])
        _decide_views(sheet_id, earlier, None, "")
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


def _decide_views(sheet_id: uuid.UUID, act: Confirmation, reason: str | None, text: str) -> None:
    """The sheet's views' Coverage follows it: confirmed as proposed (an unaccounted view stays so),
    or excluded with the sheet's reason."""
    own = _excluded_on_their_own(act.project_id, sheet_id)
    sheet = drawings.sheet(sheet_id) if reason is None else None
    for row in Coverage.objects.select_for_update().filter(
        project_id=act.project_id, sheet_revision_id=sheet_id
    ):
        if reason is None and row.view_id in own:
            continue  # the QS left this view out on its own: confirming its sheet keeps it so
        if sheet is not None and row.proposed_status == CoverageStatus.UNACCOUNTED:
            if not _account(row, sheet, act):
                _put_back(row)
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
        sheet = drawings.sheet(row.sheet_revision_id)
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
            _put_back(row)
        return
    else:
        row.status, row.reason, row.reason_text = row.proposed_status, row.proposed_reason, ""
    row.confirmation = act
    row.confirmed_by_id = act.user_id
    row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])


def _put_back(row: Coverage) -> None:
    """The view as proposed: as the read proposed it, or proposed with the steps the QS put it in."""
    row.status, row.reason, row.reason_text = row.proposed_status, row.proposed_reason, ""
    if row.status == CoverageStatus.UNACCOUNTED and _standing_steps(row):
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
    sheet = drawings.sheet(sheet_id)
    row = _proposal_row(_project_of(sheet), sheet, answer)
    _trace(row, traces)
    return row.id


def propose_view(project_id: uuid.UUID, view: drawings.ViewView, *, traces: Traces = ()) -> uuid.UUID:
    """A view of a printed sheet as a Step 1 Proposal (what 17 proposes to do with it: its steps,
    its Part, or leaving it out), with its Traces; the Proposal's id. Idempotent per view."""
    projects.get(project_id)
    sheet = drawings.sheet(view.sheet_revision_id)
    if _project_of(sheet) != project_id:
        raise auth.NotFound
    values = {
        "sheet_id": str(view.sheet_revision_id),
        "title": view.title,
        "kind": view.kind,
        "steps": list(view.steps),
        "part": view.part,
        "exclusion": view.proposed_exclusion,
    }
    row, _made = Proposal.objects.update_or_create(
        tenant_id=_tenant(),
        project_id=project_id,
        step=SHEETS,
        candidate_key=f"view:{view.id}",
        defaults={"subject": ProposalSubject.VIEW, "subject_id": view.id, "values": values},
    )
    _trace(row, traces)
    return row.id


def _trace(proposal: Proposal, traces: Traces) -> None:
    for fact, anchor in traces:
        ProposalTrace.objects.get_or_create(
            tenant_id=proposal.tenant_id,
            project_id=proposal.project_id,
            proposal=proposal,
            fact=fact[:64],
            anchor=dict(anchor),
        )


def proposal_ids(project_id: uuid.UUID) -> dict[uuid.UUID, uuid.UUID]:
    """Each printed sheet's Proposal id, by the sheet's id."""
    return {p.subject_id: p.id for p in _proposals_of(project_id)}


def sheet_conventions() -> SheetConventions:
    """13's default sheet conventions under the Market's Disciplines (as the read job reads)."""
    return _conventions()


def record_unread(project_id: uuid.UUID, file_id: uuid.UUID, *, sheet_found: int, unread: int) -> None:
    """How many sheets a file's read found and how many it left out for unreadable writing (#135),
    which Coverage counts while the file is in the sheet list."""
    projects.get(project_id)
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
    projects.get(project_id)
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
    sheet = drawings.sheet(sheet_id)
    project_id = _project_of(sheet)
    tenant_id = _tenant()
    written = 0
    for view in drawings.views(sheet_id):
        if view.proposed_exclusion:
            status, reason = CoverageStatus.EXCLUDED, view.proposed_exclusion
        elif view.steps or view.part:
            status, reason = CoverageStatus.ASSIGNED, ""
        else:
            status, reason = CoverageStatus.UNACCOUNTED, ""
        row, _made = Coverage.objects.update_or_create(
            tenant_id=tenant_id,
            project_id=project_id,
            drawing_set_state_id=None,
            view_id=view.id,
            defaults={
                "sheet_revision_id": sheet_id,
                "proposed_status": status,
                "proposed_reason": reason,
                "status": status,
                "reason": reason,
                "part_key": view.part or "",
            },
        )
        for step in view.steps:
            CoverageStep.objects.get_or_create(
                tenant_id=tenant_id, project_id=project_id, coverage=row, step=step, confirmation=None
            )
        written += 1
    return written


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
) -> uuid.UUID:
    """A Step 1 Question, as a code and its parameters, once per (kind, subject, evidence): the
    same Question raised again is the one already asked. `blocks`: the Proposals it holds."""
    projects.get(project_id)
    chosen = QuestionKind(kind)
    identity = json.dumps(
        [chosen, str(subject_id or ""), message["code"], message["params"]], sort_keys=True, default=str
    )
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


def asked_of(
    project_id: uuid.UUID, message: Message, proposals: Iterable[uuid.UUID]
) -> uuid.UUID | None:
    """The Question already asked with these words of exactly these Proposals, however it was raised
    (its subject and options aside: the demo's S-07 Question is raised by hand), the earliest; else
    None. A conflict is its words and the sheets it holds (#161)."""
    held = set(proposals)
    for row in Question.objects.filter(
        project_id=project_id, step=SHEETS, message_code=message["code"], params=message["params"]
    ).order_by("created_at", "id"):
        if set(QuestionLink.objects.filter(question=row).values_list("proposal_id", flat=True)) == held:
            return row.id
    return None


def retire_questions(project_id: uuid.UUID, codes: Iterable[str], raised: Iterable[uuid.UUID]) -> int:
    """After a round that asked the set's Questions of these codes again (#161): each one `raised`
    that a past round retired is open again, and each still open that was not raised is retired,
    `withdrawn` and still listed. An answered Question, or one withdrawn by leaving its sheet out, is
    never touched. One the QS kept open hands that answer to the Question that supersedes it (its
    code, holding every sheet it held, not answered yet); a numbering gap's, to the Discipline's
    `gaps` Question that asks only gaps they kept open (`_heir_of_gaps`). How many were retired."""
    projects.get(project_id)
    asked = set(raised)
    ours = Question.objects.filter(project_id=project_id, step=SHEETS, message_code__in=list(codes))
    ours.filter(id__in=asked, status=QuestionStatus.WITHDRAWN, withdrawn_by__isnull=True).update(
        status=QuestionStatus.OPEN
    )
    leaving = ours.filter(status=QuestionStatus.OPEN).exclude(id__in=asked)
    kept = [q for q in leaving if isinstance(q.answer, dict) and q.answer.get("option") == KEEP_OPEN]
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
    retired = leaving.update(status=QuestionStatus.WITHDRAWN)
    record_progress(project_id)
    return retired


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
    """Each Question's Proposals, by the Question's id."""
    held: dict[uuid.UUID, set[uuid.UUID]] = {i: set() for i in ids}
    for question_id, proposal_id in QuestionLink.objects.filter(
        project_id=project_id, question_id__in=list(held)
    ).values_list("question_id", "proposal_id"):
        held[question_id].add(proposal_id)
    return held


def record_read_list(
    sheet_id: uuid.UUID,
    discipline: str,
    numbers: Sequence[tuple[str, str] | tuple[str, str, str]],
) -> uuid.UUID:
    """A Discipline's drawing list as read on a printed sheet of the set (13's register entries:
    each number with its title and, where the list gives one, its revision mark, in the list's
    order); its id. Kept beside a list the QS gives: when
    the two disagree, N is unknown until 21c's Question is answered."""
    sheet = drawings.sheet(sheet_id)
    project_id = _project_of(sheet)
    key = _discipline(discipline)
    with transaction.atomic():
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
    projects.get(project_id)
    with transaction.atomic():
        row = Question.objects.select_for_update().filter(project_id=project_id, id=question_id).first()
        if row is None:
            raise auth.NotFound
        row.status = QuestionStatus.ANSWERED
        row.answer = answer
        row.answered_by_id = _user()
        row.answered_at = timezone.now()
        row.save(update_fields=["status", "answer", "answered_by", "answered_at"])
        record_progress(project_id)


@dataclass(frozen=True)
class Answered:
    question: QuestionView
    read_again: uuid.UUID | None
    """A held file the QS chose to read anyway: its read job is to run again (the caller queues it)."""
    corrected: bool = False
    """A sheet's number or Discipline was corrected: the set's Questions are asked again (the caller
    runs `read_propose.proposals.set_questions`: a typed number another sheet has is a conflict)."""


def answer(
    project_id: uuid.UUID, question_id: uuid.UUID, option: object, text: str = "", *, actor_name: str
) -> Answered:
    """The QS answers a Question with one of its options (m0-screens §5 and 6.7): recorded under
    their name and time, and what the Question held is confirmed, left out or corrected by it. "Keep
    open, ask the consultant" keeps it open. An option the Question does not offer is refused (400),
    and one already answered or withdrawn (409); nothing changes."""
    auth.require(acts.CONFIRM, project_id)
    projects.get(project_id)
    read_again = None
    with transaction.atomic():
        row = (
            Question.objects.select_for_update()
            .filter(project_id=project_id, step=SHEETS, id=question_id)
            .first()
        )
        if row is None:
            raise auth.NotFound
        if row.status != QuestionStatus.OPEN and not _withdrawn_by_standing_exclusion(row):
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
            record_progress(project_id)
            return Answered(_question_view(project_id, row.id), None)
        held = list(
            QuestionLink.objects.filter(project_id=project_id, question=row)
            .order_by("id")
            .values_list("proposal_id", flat=True)
        )
        read_again = _apply(project_id, row, option, words, held, actor_name)
        corrected = (
            row.kind == QuestionKind.MISSING and option == "type_number"
        ) or row.kind == QuestionKind.MISSING_DISCIPLINE
        row.status = QuestionStatus.ANSWERED
        row.answer = given
        row.answered_by_id = _user()
        row.answered_at = timezone.now()
        row.save(update_fields=["status", "answer", "answered_by", "answered_at"])
        record_progress(project_id)
    return Answered(_question_view(project_id, row.id), read_again, corrected)


def answer_disciplines(
    project_id: uuid.UUID, sheets: Sequence[drawings.SheetView], *, actor_name: str = ""
) -> int:
    """The open `missing_discipline` Questions of these sheets, answered by the Discipline each now
    has (its file's, chosen by the QS: #159), as if the QS had picked it; how many were answered."""
    given = {s.id: s.discipline for s in sheets if s.discipline}
    answered = 0
    with transaction.atomic():
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
    return next(q for q in questions(project_id) if q.id == question_id)


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
            listed = {p.id: p for p in proposals(project_id)}
            copies = [listed[i] for i in held if i in listed]
            if copies:
                latest = max(copies, key=_newest)
                _confirm(project_id, [latest.id], kind=None, actor_name=actor_name, answering=True)
                others = [p.id for p in copies if p.id != latest.id]
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
        try:
            _confirm(project_id, list(held), kind=option, actor_name=actor_name, answering=True)
        except auth.Refused as refused:  # its number or Discipline is still asked: keep the kind
            if refused.message["code"] != said.QUESTION_FIRST.code:
                raise
            left_out = {s.id for s in _sheets(project_id) if s.decision == "excluded"}
            for proposal in Proposal.objects.filter(project_id=project_id, id__in=held):
                # A sheet left out keeps its kind in the answer alone (a decided sheet's kind is
                # not rewritten); the QS confirms it back in once its number is answered.
                if proposal.subject_id not in left_out:
                    drawings.record_kind(proposal.subject_id, option)
    return None


def _newest(proposal: ProposalView) -> tuple[Any, ...]:
    """A copy's place among copies of one number: its issue date, then its revision mark."""
    return (_date_of(proposal.issue_date), _natural(proposal.revision_mark))


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


def record_progress(project_id: uuid.UUID) -> None:
    """Keep Step 1's progress rows as `progress` counts them, one per Discipline (and one for the
    sheets of none)."""
    tenant_id = _tenant()
    for row in progress(project_id).disciplines:
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
