"""Ticket T-249 (PR A)'s invented Drawing Sets for the export's burden block: printed sheets kept
through `drawings.services` as a read job keeps them (`vextrus.testing.drawings.read_dwg`'s way, with
the sheet's values a test gives), each proposed through `step1.propose_sheet`, and Questions raised
through `step1.raise_question` where the job cannot be made to raise one. No toolchain, no real
drawing: every title, number and layout here is made up.

The block is read through the export's seam, `export.export(developer, project, paths, folder=,
run=)["burden"]`, and compared with what `step1.proposals` and `step1.questions` give for the same
Project, never with a literal the product could drift from.
"""

import uuid
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from engine.check.bangla_ansi import BanglaAnsi
from engine.messages import Message
from engine.messages import conflicts as conflict_codes
from engine.messages import decoders_agree as agree_codes
from engine.recognise.types import (
    Box,
    CheckOutcome,
    CheckResult,
    Exclusion,
    ExclusionReason,
    SheetCandidate,
    SheetLocation,
    Sourced,
    StoreysMeaning,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from vextrus.drawings import services as drawings
from vextrus.takeoff.models import QuestionKind
from vextrus.takeoff.services import export, step1
from vextrus.testing.drawings import QsProject, add, artefact_for, drawing, frame

RUN = {
    "id": "invented-burden-run",
    "commit": None,
    "code_hash": None,
    "started_at": "2026-10-05T00:00:00Z",
    "seconds": 2.25,
}

ROW_KEYS = frozenset(
    {
        "sheets",
        "sheets_counted",
        "bulk_confirmable",
        "one_source",
        "held",
        "questions_open",
        "conflicts",
        "gap_questions",
        "gap_files",
        "machine_doubt",
        "counted_toward_cap",
        "plan_sheets_no_storey",
        "proposed_out",
        "proposed_out_by_reason",
    }
)
"""A Discipline row's keys, the ticket's closed list (section 3, A1)."""
CONFLICT_KEYS = frozenset({"same_number", "same_title", "same_storey"})
GAP_CODES = frozenset({"engine.register_check.gap", "engine.register_check.gaps"})
CONFLICT_CODES = {
    "engine.conflicts.same_number": "same_number",
    "engine.conflicts.same_title": "same_title",
    "engine.conflicts.same_storey": "same_storey",
}
REASONS = frozenset(reason.value for reason in ExclusionReason)
KINDS = frozenset(kind.value for kind in QuestionKind)
NONE = "none"
"""The row of sheets and Questions of no Discipline."""


@dataclass(frozen=True)
class Drawn:
    """One invented printed sheet: its title block's values, where it sits and its views."""

    number: str | None
    title: str
    discipline: str | None
    storeys: str | None = None
    exclusion: ExclusionReason | None = None
    layout: str | None = None
    views: tuple[ViewCandidate, ...] = ()


def plan(*storeys: str, title: str = "Made-up floor outline") -> ViewCandidate:
    """A plan view, on the given storeys (13's keys) or on none."""
    return ViewCandidate(
        box=Box(20.0, 40.0, 120.0, 120.0),
        kind=ViewKind.PLAN,
        title=title,
        storeys=storeys,
        storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL if storeys else None,
    )


def detail(title: str = "Made-up joint detail") -> ViewCandidate:
    return ViewCandidate(box=Box(130.0, 40.0, 200.0, 120.0), kind=ViewKind.DETAIL, title=title)


@dataclass
class Read:
    """One file kept as read: its id, its sha256 and its printed sheets in the given order."""

    file_id: uuid.UUID
    sha256: str
    name: str
    sheets: list[drawings.SheetView] = field(default_factory=list)


def read_file(qs: QsProject, name: str, drawn: Sequence[Drawn], *, held: bool = False) -> Read:
    """A DWG added and kept as its read job keeps it: its artefact and reports, its printed sheets
    with their views, then read; or held (its readers disagree) and read anyway, its sheets marked."""
    member = qs.member
    added = add(member, qs.project_id, name, drawing("dwg", marker=f"{name}-{uuid.uuid4().hex}"))
    file_id = added.file.id
    with member.acting():
        found = drawings.file(file_id)
        layouts = [d.layout for d in drawn if d.layout is not None]
        drawings.store_artefact(
            file_id, artefact_for(found.sha256, found.name, len(drawn), layouts=layouts)
        )
        drawings.record_reports(
            file_id,
            cross_check=CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED),
            bangla_ansi=BanglaAnsi(()),
        )
        candidates = [_candidate(i, d, found.group) for i, d in enumerate(drawn)]
        printed = drawings.record_sheets(file_id, candidates)
        for sheet, d in zip(printed, drawn, strict=True):
            drawings.record_views(sheet.id, list(d.views))
        if held:
            disagree = agree_codes.DISAGREE(
                items=4, only_first=1, only_second=2, kinds=0, layers=1, unread=0
            )
            drawings.quarantine(file_id, disagree)
            drawings.answer_held(file_id, drawings.HeldAnswer.READ_ANYWAY)
        drawings.mark_read(file_id)
        listed = {s.id: s for s in drawings.sheets(found.set_id)}
        read = Read(file_id, found.sha256, name, [listed[s.id] for s in printed])
        for sheet in read.sheets:
            step1.propose_sheet(sheet.id)
    return read


def _candidate(i: int, d: Drawn, group: str) -> SheetCandidate:
    def title_block(value: str | None) -> Sourced | None:
        return None if value is None else Sourced(value, ValueSource.TITLE_BLOCK_TEXT)

    location = SheetLocation(layout=d.layout) if d.layout is not None else SheetLocation(box=frame(i))
    return SheetCandidate(
        location=location,
        number=title_block(d.number),
        title=title_block(d.title),
        discipline=None if d.discipline is None else Sourced(d.discipline, ValueSource.FILE),
        storeys_as_stated=title_block(d.storeys),
        exclusion=None if d.exclusion is None else Exclusion(d.exclusion),
        group=group,
    )


def proposal_of(qs: QsProject, sheet: drawings.SheetView) -> uuid.UUID:
    with qs.member.acting():
        return step1.proposal_ids(qs.project_id)[sheet.id]


def ask(
    qs: QsProject,
    kind: str,
    message: Message,
    on: Sequence[drawings.SheetView],
    *,
    discipline: str | None,
    check_code: str = "",
) -> uuid.UUID:
    """A Step 1 Question holding the given sheets, as the job raises one."""
    blocks = [proposal_of(qs, sheet) for sheet in on]
    with qs.member.acting():
        return step1.raise_question(
            qs.project_id,
            kind,
            message,
            subject_id=on[0].id if on else None,
            discipline=discipline,
            options=[{"key": "keep_open", "picked": False}],
            check_code=check_code,
            blocks=blocks,
        )


def gap(
    qs: QsProject, sheet: drawings.SheetView, after: str, before: str, *, code: str = "gap"
) -> uuid.UUID:
    params: dict[str, Any] = {
        "after": after,
        "before": before,
        "missing": 1,
        "discipline": sheet.discipline or "",
    }
    message: Message = {"code": f"engine.register_check.{code}", "params": params}
    return ask(qs, "check", message, [sheet], discipline=sheet.discipline, check_code="register")


def low_confidence(qs: QsProject, sheet: drawings.SheetView) -> uuid.UUID:
    message: Message = {
        "code": "takeoff.proposals.which_kind",
        "params": {"sheet": sheet.number or "", "named": "number"},
    }
    return ask(qs, "low_confidence", message, [sheet], discipline=sheet.discipline)


def same_number(qs: QsProject, sheets: Sequence[drawings.SheetView]) -> uuid.UUID:
    message = conflict_codes.SAME_NUMBER(number=sheets[0].number or "", copies=len(sheets))
    return ask(qs, "conflict", message, sheets, discipline=sheets[0].discipline)


def same_title(qs: QsProject, sheets: Sequence[drawings.SheetView]) -> uuid.UUID:
    message = conflict_codes.SAME_TITLE(title=sheets[0].title, sheets=len(sheets))
    return ask(qs, "conflict", message, sheets, discipline=sheets[0].discipline)


def burden(qs: QsProject, reads: Sequence[Read]) -> dict[str, Any]:
    """The export's burden block for the Project, its paths the files' names."""
    paths = {read.name: read.sha256 for read in reads}
    document = export.export(
        qs.member.developer_id, qs.project_id, paths, folder=Path("/nonexistent"), run=RUN
    )
    block: dict[str, Any] = document["burden"]  # type: ignore[assignment]
    return block


def rows(block: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    found: dict[str, dict[str, Any]] = block["disciplines"]
    return found


def nonzero(counts: Mapping[str, int]) -> dict[str, int]:
    """A count map without its zero entries (a row may list every closed key or only those it saw)."""
    return {key: n for key, n in counts.items() if n}


def expected_from_step1(qs: QsProject) -> dict[str, dict[str, Any]]:
    """Per Discipline, what the product's own Step 1 answers say (section 3, A1's definitions)."""
    with qs.member.acting():
        proposals = step1.proposals(qs.project_id)
        questions = step1.questions(qs.project_id)
    found: dict[str, dict[str, Any]] = {}
    for p in proposals:
        row = found.setdefault(
            p.discipline or NONE,
            {
                "sheets": 0,
                "bulk_confirmable": 0,
                "one_source": 0,
                "held": 0,
                "questions_open": Counter(),
            },
        )
        row["sheets"] += 1
        row["bulk_confirmable"] += int(p.agrees and not p.held)
        row["one_source"] += int(not p.agrees)
        row["held"] += int(p.held)
    for q in questions:
        if q.status != "open":
            continue
        row = found.setdefault(
            q.discipline or NONE,
            {
                "sheets": 0,
                "bulk_confirmable": 0,
                "one_source": 0,
                "held": 0,
                "questions_open": Counter(),
            },
        )
        row["questions_open"][q.kind] += 1
    return found


def leaves(value: Any, where: str = "$") -> list[tuple[str, Any]]:
    """Every leaf of a JSON value with where it sits."""
    if isinstance(value, dict):
        return [leaf for key, inner in value.items() for leaf in leaves(inner, f"{where}.{key}")]
    if isinstance(value, list):
        return [leaf for n, inner in enumerate(value) for leaf in leaves(inner, f"{where}[{n}]")]
    return [(where, value)]


def the_market_disciplines(qs: QsProject) -> set[str]:
    with qs.member.acting():
        return {d.key for d in drawings.disciplines()}
