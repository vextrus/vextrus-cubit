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


class Step1ProposalOut(_FromView):
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
    agrees: bool
    """Two sources agree on it (m0-screens §5): it joins the bulk act; else "Proposal, one source"."""


class Step1ProposalsOut(Schema):
    proposals: list[Step1ProposalOut]


class Step1QuestionOut(_FromView):
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
    proposals: list[uuid.UUID]
    """The Proposals it holds: answering confirms, leaves out or corrects them."""


class Step1QuestionsOut(Schema):
    questions: list[Step1QuestionOut]


class Step1UnaccountedViewOut(Schema):
    id: uuid.UUID
    view_id: uuid.UUID
    sheet_id: uuid.UUID


class Step1CoverageOut(_FromView):
    views: int
    assigned: int
    excluded: int
    proposed: int
    unaccounted: int
    used: int
    by_step: dict[str, int]
    by_reason: dict[str, int]
    unaccounted_views: list[Step1UnaccountedViewOut]
    """Each view no step, Part or exclusion accounts for: `id` its Proposal, which `exclude` takes."""
    unread_sheets: int
    """The sheets left out for unreadable writing (#135): counted, never silently unread."""


class Step1DisciplineProgressOut(Schema):
    discipline: str | None
    confirmed: int
    found: int
    listed: int | None
    lists_disagree: bool
    total: int | None
    """N; null ("—") while a list read on a sheet and one the QS gave disagree."""
    open_questions: int
    status: str
    """The StepProgress status: `in_review`, `confirmed` (m0-screens 6.11) or `not_started`."""


class Step1ProgressOut(_FromView):
    disciplines: list[Step1DisciplineProgressOut]
    not_received: list[str]


class Step1ActOut(_FromView):
    confirmation_id: uuid.UUID
    act: str
    sheets: int
    by: str
    at: datetime


class Step1ConfirmIn(Schema):
    proposals: list[uuid.UUID]
    kind: str | None = None


class Step1ExcludeIn(Schema):
    proposals: list[uuid.UUID]
    reason: str
    text: str = ""


class Step1UndoIn(Schema):
    pass


class Step1AnswerIn(Schema):
    option: str
    text: str = ""


class Step1DrawingListIn(Schema):
    discipline: str
    text: str


class Step1ParsedListOut(_FromView):
    discipline: str
    source: str
    numbers: list[str]
    ignored: int
    entries: list[dict[str, Any]]


class Step1DrawingListOut(_FromView):
    discipline: str
    source: str | None
    numbers: list[str]
    ignored: int
    entered_by: str | None
    entered_at: datetime | None
    read_numbers: list[str] | None
    agrees: bool


__all__ = [
    "Step1ActOut",
    "Step1ConfirmIn",
    "Step1CoverageOut",
    "Step1DrawingListIn",
    "Step1DrawingListOut",
    "Step1ExcludeIn",
    "Step1ParsedListOut",
    "Step1ProgressOut",
    "Step1ProposalsOut",
    "Step1QuestionsOut",
    "Step1UndoIn",
    "step1",
]
