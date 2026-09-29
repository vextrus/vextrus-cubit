"""Step 1 in the API (ticket 19a): its Proposals, Questions, Coverage, progress, drawing lists and
the QS's acts. Every sentence is a message code and its parameters; a file is named by the QS's
label, a person by their name; nothing here names a storage key or a sha256."""

import uuid
from dataclasses import asdict
from datetime import datetime
from typing import Any, Self

from ninja import Schema

from vextrus.takeoff.services import step1


class _FromView(Schema):
    @classmethod
    def from_view(cls, view: object) -> Self:
        return cls.model_validate(asdict(view))  # type: ignore[call-overload]


class ProposalOut(_FromView):
    id: uuid.UUID
    """What an act names it by: the Proposal's id (the printed sheet's while none is proposed)."""
    sheet_id: uuid.UUID
    number: str | None
    title: str
    revision_mark: str
    revision_mark_source: str | None
    issue_date: str
    discipline: str | None
    file_id: uuid.UUID
    file_name: str
    kind: str | None
    jev_pick: dict[str, Any] | None
    """Jev's answer about its kind, `{choice, options}`, or null."""
    held: bool
    proposed_exclusion: str | None
    decision: str | None
    confirmed_kind: str | None
    excluded_reason: str | None
    excluded_text: str
    decided_by: str | None
    """Who confirmed or left it out, by name."""
    decided_at: datetime | None


class ProposalsOut(Schema):
    proposals: list[ProposalOut]


class QuestionOut(_FromView):
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


class QuestionsOut(Schema):
    questions: list[QuestionOut]


class CoverageOut(_FromView):
    views: int
    assigned: int
    excluded: int
    proposed: int
    unaccounted: int
    used: int
    by_step: dict[str, int]
    by_reason: dict[str, int]


class DisciplineProgressOut(Schema):
    discipline: str | None
    confirmed: int
    found: int
    listed: int | None
    lists_disagree: bool
    total: int | None
    """N; null ("—") while a list read on a sheet and one the QS gave disagree."""
    open_questions: int


class ProgressOut(_FromView):
    disciplines: list[DisciplineProgressOut]
    not_received: list[str]


class ActOut(_FromView):
    confirmation_id: uuid.UUID
    act: str
    sheets: int
    by: str
    at: datetime


class ConfirmIn(Schema):
    proposals: list[uuid.UUID]
    kind: str | None = None


class ExcludeIn(Schema):
    proposals: list[uuid.UUID]
    reason: str
    text: str = ""


class UndoIn(Schema):
    pass


class DrawingListIn(Schema):
    discipline: str
    text: str


class ParsedListOut(_FromView):
    discipline: str
    source: str
    numbers: list[str]
    ignored: int
    entries: list[dict[str, Any]]


class DrawingListOut(_FromView):
    discipline: str
    source: str | None
    numbers: list[str]
    ignored: int
    entered_by: str | None
    entered_at: datetime | None
    read_numbers: list[str] | None
    agrees: bool


__all__ = [
    "ActOut",
    "ConfirmIn",
    "CoverageOut",
    "DrawingListIn",
    "DrawingListOut",
    "ExcludeIn",
    "ParsedListOut",
    "ProgressOut",
    "ProposalsOut",
    "QuestionsOut",
    "UndoIn",
    "step1",
]
