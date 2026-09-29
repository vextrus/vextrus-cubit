"""Step 1, Sheets (ticket 19a; docs/data-model.md §3.4; m0-screens 6.x): its Proposals, Questions,
Coverage and progress, and the confirm service, the only writer of what the QS decides about a sheet.

    step1.proposals(project_id)          # one per printed sheet, by Discipline, in natural number order
    step1.confirm(project_id, [ids], kind=None, actor_name=user.name)
    step1.exclude(project_id, [ids], "superseded", "", actor_name=user.name)
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
on a row of its own, last (#102; how its number is compared is 21c's Question). N is the drawing list's
count where there is one; where a list read on a sheet and one the QS gave disagree, N is unknown
(`total` None, shown "—") until 21c's Question is answered.

**Coverage** (ADR 0027; m0-screens 6.11): one row per view, written from the view's proposal; a view
is proposed while its sheet is undecided, assigned once its sheet is confirmed with a step or its
Part, excluded once its sheet or itself is left out, unaccounted with no step, Part or exclusion.

For the seed and 21c's read job: `propose_sheet`, `record_coverage`, `raise_question`,
`answer_question` and `record_progress` write the rows Step 1 reads.
"""

import contextlib
import hashlib
import json
import uuid
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from engine.check import register
from engine.messages import Message
from engine.messages import register_check as list_codes
from engine.recognise.conflicts import recognisers
from engine.recognise.sheets import default_conventions
from engine.recognise.types import DisciplineConvention, SheetConventions
from vextrus.drawings import services as drawings
from vextrus.platform.services import auth, jev, markets, tenancy
from vextrus.projects import services as projects
from vextrus.takeoff import acts
from vextrus.takeoff.library import EXPECTED, SHEETS
from vextrus.takeoff.messages import step1 as said
from vextrus.takeoff.models import (
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
    Question,
    QuestionKind,
    QuestionLink,
    QuestionStatus,
    RegisterEntry,
    RegisterSource,
    StepProgress,
)

OTHER = "other"
"""The one reason that keeps the QS's words."""


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
    issue_date: str
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


@dataclass(frozen=True)
class ProgressView:
    disciplines: list[DisciplineProgress]
    not_received: list[str]
    """The Market's expected Disciplines of which no file has been added, in the Market's order."""


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
    who = dict(Confirmation.objects.filter(id__in=stamps).values_list("id", "by_name"))
    return [_proposal_view(s, by_sheet.get(s.id), names, who) for s in sheets]


def _proposal_view(
    sheet: drawings.SheetView,
    proposal: Proposal | None,
    names: Mapping[uuid.UUID, str],
    who: Mapping[uuid.UUID, str],
) -> ProposalView:
    pick = dict(proposal.jev_pick) if proposal and proposal.jev_pick else None
    return ProposalView(
        id=proposal.id if proposal else sheet.id,
        sheet_id=sheet.id,
        number=sheet.number,
        title=sheet.title,
        revision_mark=sheet.revision_mark,
        revision_mark_source=sheet.sources.get("revision_mark"),
        issue_date=sheet.issue_date,
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
        decided_by=who.get(sheet.confirmation_id) if sheet.confirmation_id else None,
        decided_at=sheet.decided_at,
    )


def questions(project_id: uuid.UUID) -> list[QuestionView]:
    """The Project's Step 1 Questions: the open ones in queue order (a held file first, as it holds a
    whole file; then as they were raised), then those answered or withdrawn."""
    projects.get(project_id)
    found = Question.objects.filter(project_id=project_id, step=SHEETS)

    def queued(q: Question) -> tuple[Any, ...]:
        return (q.status != QuestionStatus.OPEN, q.kind != QuestionKind.FILE_MISREAD, q.created_at, q.id)

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
        )
        for q in sorted(found, key=queued)
    ]


def coverage(project_id: uuid.UUID) -> CoverageView:
    """Every view of every sheet in the sheet list, counted once (a held file's views are not
    counted until it is read anyway): assigned, excluded, proposed or unaccounted; used from M1."""
    listed = {s.id for s in _sheets(project_id)}
    rows = [r for r in Coverage.objects.filter(project_id=project_id) if r.sheet_revision_id in listed]
    counts: Counter[str] = Counter()
    by_step: Counter[str] = Counter()
    by_reason: Counter[str] = Counter()
    steps: dict[uuid.UUID, list[CoverageStep]] = {}
    for step in CoverageStep.objects.filter(coverage_id__in=[r.id for r in rows]):
        steps.setdefault(step.coverage_id, []).append(step)
    used = 0
    for row in rows:
        counts[_counted(row)] += 1
        if any(s.used for s in steps.get(row.id, ())):
            used += 1
        if row.status == CoverageStatus.EXCLUDED:
            by_reason[row.reason] += 1
        elif row.status == CoverageStatus.ASSIGNED:
            for step in steps.get(row.id, ()):
                by_step[step.step] += 1
            if row.part_key and not steps.get(row.id):
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
    )


def _counted(row: Coverage) -> str:
    if row.status == CoverageStatus.UNACCOUNTED:
        return "unaccounted"
    if row.confirmation_id is None:
        return "proposed"
    return "excluded" if row.status == CoverageStatus.EXCLUDED else "assigned"


def progress(project_id: uuid.UUID) -> ProgressView:
    """Step 1's n / N per Discipline, in the sheet list's order (a sheet of no Discipline on its own
    row, last), and the Market's expected Disciplines not yet received."""
    sheets = _sheets(project_id)
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
        for q in Question.objects.filter(project_id=project_id, step=SHEETS, status=QuestionStatus.OPEN)
    )
    rows = []
    for key in order:
        lists = _lists(project_id, key) if key else _Lists(None, None)
        listed = lists.count
        disagree = lists.disagree
        rows.append(
            DisciplineProgress(
                discipline=key,
                confirmed=decided[key],
                found=found[key],
                listed=listed,
                lists_disagree=disagree,
                total=None if disagree else (listed if listed is not None else found[key]),
                open_questions=open_questions[key],
            )
        )
    return ProgressView(rows, _not_received(project_id))


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
        standing = self.given or self.read
        if standing is None:
            return None
        return RegisterEntry.objects.filter(register=standing).count()

    @property
    def disagree(self) -> bool:
        if self.given is None or self.read is None:
            return False
        return _numbers(self.given) != _numbers(self.read)


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
    return _Lists(given, read)


def _numbers(row: DrawingRegister) -> list[str]:
    return list(
        RegisterEntry.objects.filter(register=row)
        .order_by("line", "id")
        .values_list("number", flat=True)
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
        record_progress(project_id)
    return drawing_list(project_id, key)


def drawing_list(project_id: uuid.UUID, discipline: str) -> ListView:
    """The Discipline's drawing list as it stands: the QS's (pasted or typed), else one read on a
    sheet; with none, no numbers."""
    projects.get(project_id)
    key = _discipline(discipline)
    lists = _lists(project_id, key)
    standing = lists.given or lists.read
    return ListView(
        discipline=key,
        source=standing.source if standing else None,
        numbers=_numbers(standing) if standing else [],
        ignored=standing.ignored if standing else 0,
        entered_by=(standing.entered_by_name or None) if standing else None,
        entered_at=standing.entered_at if standing and standing.source != RegisterSource.SHEET else None,
        read_numbers=_numbers(lists.read) if lists.read else None,
        agrees=not lists.disagree,
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
) -> Confirmation:
    return Confirmation.objects.create(
        before={"sheets": {str(sheet.id): _decision_of(sheet) for sheet in before}},
        tenant_id=_tenant(),
        project_id=project_id,
        step=SHEETS,
        discipline=discipline,
        user_id=_user(),
        by_name=actor_name,
        kind=ConfirmationKind.BULK if sheets > 1 else ConfirmationKind.SINGLE,
        act=act,
        proposals=sheets,
    )


def _chosen(
    project_id: uuid.UUID, ids: Sequence[object]
) -> list[tuple[drawings.SheetView, Proposal | None]]:
    """Each named printed sheet with its Proposal, in the order named; any id not of this Project's
    sheet list (another Project's, another Developer's, none) is not found, and nothing is done."""
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
        if sheet_id not in listed:
            raise auth.NotFound
        chosen[sheet_id] = (listed[sheet_id], by_sheet.get(sheet_id))
    return list(chosen.values())


def confirm(
    project_id: uuid.UUID, ids: Sequence[object], *, kind: str | None = None, actor_name: str
) -> ActView:
    """Confirm the named sheets, one or in bulk, each with `kind` when given, else its proposed kind
    (Jev's pick, else the kind read). Each change to Jev's pick is logged under the QS."""
    auth.require(acts.CONFIRM, project_id)
    with transaction.atomic():
        chosen = _chosen(project_id, ids)
        act = _act(
            project_id,
            ConfirmationAct.CONFIRM,
            len(chosen),
            actor_name,
            discipline=_one(chosen),
            before=[sheet for sheet, _p in chosen],
        )
        for sheet, proposal in chosen:
            proposal = proposal or _propose(project_id, sheet)
            pick = proposal.jev_pick or {}
            wanted = kind if kind is not None else (pick.get("choice") or sheet.kind)
            drawings.confirm_sheet(sheet.id, confirmation_id=act.id, kind=wanted)
            _stamp(proposal, ProposalStatus.CONFIRMED, act)
            if kind is not None and proposal.jev_answer_id and kind != pick.get("choice"):
                # A kind Jev was not offered changes no answer of the node's: nothing to log.
                with contextlib.suppress(jev.NotAnOverride):
                    jev.record_override(
                        proposal.jev_answer_id,
                        subject_id=proposal.id,
                        qs_choice=kind,
                        project_id=project_id,
                    )
            _decide_views(sheet.id, act, None, "")
        record_progress(project_id)
    return _act_view(act)


def exclude(
    project_id: uuid.UUID, ids: Sequence[object], reason: str, text: str = "", *, actor_name: str
) -> ActView:
    """Leave the named sheets out, for one of the seven reasons ("other" with the QS's words; with any
    other reason the words are not kept); their views are excluded with them."""
    auth.require(acts.EXCLUDE, project_id)
    words = text if reason == OTHER else ""
    with transaction.atomic():
        chosen = _chosen(project_id, ids)
        act = _act(
            project_id,
            ConfirmationAct.EXCLUDE,
            len(chosen),
            actor_name,
            discipline=_one(chosen),
            before=[sheet for sheet, _p in chosen],
        )
        for sheet, proposal in chosen:
            proposal = proposal or _propose(project_id, sheet)
            drawings.exclude(sheet.id, reason, words, confirmation_id=act.id)
            proposal.rejected_reason = reason
            _stamp(proposal, ProposalStatus.REJECTED, act)
            _decide_views(sheet.id, act, reason, words.strip())
        record_progress(project_id)
    return _act_view(act)


def undo(project_id: uuid.UUID) -> ActView:
    """Take back the acting user's own last act on Step 1 not yet undone (a confirmation, an
    exclusion, a drawing list). Each sheet it still decides goes back to what it carried before the
    act (another person's decision included), or to undecided; its Proposal and its views' Coverage
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
        stamped = [s for s in _sheets(project_id) if s.confirmation_id == act.id]
        drawings.undo(act.id)
        act.undone_at = timezone.now()
        act.save(update_fields=["undone_at"])
        for sheet in stamped:
            _put_back_sheet(project_id, sheet.id, _standing_before(act, sheet.id))
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
        for row in Coverage.objects.select_for_update().filter(
            project_id=project_id, sheet_revision_id=sheet_id
        ):
            _put_back(row)
        return
    earlier, prior = standing
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
    for row in Coverage.objects.select_for_update().filter(
        project_id=act.project_id, sheet_revision_id=sheet_id
    ):
        if reason is None and row.proposed_status == CoverageStatus.UNACCOUNTED:
            _put_back(row)
            continue
        if reason is None:
            row.status, row.reason, row.reason_text = row.proposed_status, row.proposed_reason, ""
        else:
            row.status, row.reason, row.reason_text = CoverageStatus.EXCLUDED, reason, text
        row.confirmation = act
        row.confirmed_by_id = act.user_id
        row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])


def _put_back(row: Coverage) -> None:
    row.status, row.reason, row.reason_text = row.proposed_status, row.proposed_reason, ""
    row.confirmation = None
    row.confirmed_by = None
    row.save(update_fields=["status", "reason", "reason_text", "confirmation", "confirmed_by"])


# Writing what Step 1 reads (the seed; 21c's read job) ---------------------------------------------


def _propose(project_id: uuid.UUID, sheet: drawings.SheetView) -> Proposal:
    return _proposal_row(project_id, sheet, None)


def propose_sheet(sheet_id: uuid.UUID, *, answer: jev.Answer | None = None) -> uuid.UUID:
    """A printed sheet as a Step 1 Proposal: its kind as read and, when Jev answered its kind, that
    answer (its choice and the options offered, in order); the Proposal's id. Idempotent per sheet."""
    sheet = drawings.sheet(sheet_id)
    return _proposal_row(_project_of(sheet), sheet, answer).id


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
                tenant_id=tenant_id, project_id=project_id, coverage=row, step=step
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


def record_read_list(
    sheet_id: uuid.UUID, discipline: str, numbers: Sequence[tuple[str, str]]
) -> uuid.UUID:
    """A Discipline's drawing list as read on a printed sheet of the set (13's register entries:
    each number with its title, in the list's order); its id. Kept beside a list the QS gives: when
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
        for line, (number, title) in enumerate(numbers, start=1):
            if number in seen:
                continue
            seen.add(number)
            RegisterEntry.objects.create(
                tenant_id=row.tenant_id,
                project_id=project_id,
                register=row,
                number=number,
                title=title,
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


def record_progress(project_id: uuid.UUID) -> None:
    """Keep Step 1's progress rows as `progress` counts them, one per Discipline (and one for the
    sheets of none)."""
    tenant_id = _tenant()
    for row in progress(project_id).disciplines:
        done = row.total is not None and row.confirmed >= row.found and row.open_questions == 0
        status = "confirmed" if done else ("in_review" if row.found else "not_started")
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
