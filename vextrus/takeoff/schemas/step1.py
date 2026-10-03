"""Step 1 in the API (ticket 19a): its Proposals, Questions, Coverage, progress, drawing lists and
the QS's acts. Every sentence is a message code and its parameters; a file is named by the QS's
label, a person by their name; nothing here names a storage key or a sha256."""

import uuid
from dataclasses import asdict
from datetime import datetime
from typing import Any, Self

from ninja import Field, Schema

from vextrus.takeoff.services import step1


class _FromView(Schema):
    @classmethod
    def from_view(cls, view: object) -> Self:
        return cls.model_validate(asdict(view))  # type: ignore[call-overload]


class Step1ViewOut(Schema):
    """A view on a printed sheet (m0-screens §6.6's Views, §6.5's outlines)."""

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
    """x0, y0, x1, y1 in paper mm from the sheet's lower-left corner (engine/recognise/views.py), as
    decimal strings."""


class Step1ProposalOut(_FromView):
    id: uuid.UUID
    """What an act names it by: the Proposal's id (the printed sheet's while none is proposed)."""
    sheet_id: uuid.UUID
    number: str | None
    title: str
    revision_mark: str
    revision_mark_source: str | None
    issue_date: str | None
    """An ISO date ("2026-09-12"), read in the Market's order; null where none was read."""
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
    decided_act: str | None
    """The kind of the act that decided it: `single`, `bulk` (with other sheets in one act) or
    `question_answer` (answering a Question confirmed or left it out); null while undecided."""
    agrees: bool
    """Two sources agree on it (m0-screens §5): it joins the bulk act; else "Proposal, one source"."""
    decided_by_role: str | None
    """The actor's role in the Developer ("qs", "vextrus_engineer", …): "Nusrat Jahan, QS" (6.6)."""
    decided_with: int
    """How many sheets the deciding act decided (0 while undecided): "Confirmed in bulk with 55 other
    sheets" (6.6)."""
    number_source: str | None
    """Where its number was read ("title_block_attribute", "title_block_text"); null for none."""
    title_source: str | None
    storeys_as_stated: str
    """The storeys its title states, as drawn ("3RD, 5TH & 7TH FLOOR"); "" for none."""
    layout: str | None
    """The layout it is laid out on, by name; null when laid out in the drawing."""
    plot_file: str | None
    plot_page: int | None
    plot_residual: str | None
    """How closely its Plot page registered, in mm, as a decimal string."""
    plot_none: dict[str, Any] | None
    """Why it has no Plot, as a message `{code, params}`; null when a page matched or none was added."""
    views: list[Step1ViewOut]
    """Its views in reading order, title block included (the Views column counts them)."""


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
    withdrawn_by: uuid.UUID | None = Field(
        None,
        description="While `status` is `withdrawn` because its sheet was left out: that exclusion "
        "(the Step 1 act whose undo asks it again). Null otherwise, and for a Question a newer one "
        "replaced.",
    )
    blocking: bool = Field(
        False,
        description="It holds its sheets from being confirmed until it is answered: open, or "
        "withdrawn by an exclusion that still stands (then it is still answerable, and "
        "`takeoff.step1.question_first` names it by `params.question`).",
    )


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


class Step1OutstandingOut(Schema):
    code: str
    params: dict[str, int]


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
    outstanding: list[Step1OutstandingOut]
    """What keeps it from `confirmed`, in m0-screens 5's order, each a code with how many
    (`takeoff.step1.views_unaccounted` `{count}`, #158); empty once confirmed."""


class Step1ProgressOut(_FromView):
    disciplines: list[Step1DisciplineProgressOut]
    not_received: list[str]
    qs: list[str]
    """The names of the QS members who may open the Project (m0-screens §6.12's read-only bar)."""


class Step1ActOut(_FromView):
    confirmation_id: uuid.UUID
    act: str
    sheets: int
    by: str
    at: datetime


class Step1ConfirmIn(Schema):
    proposals: list[uuid.UUID]
    kind: str | None = None


class Step1AssignIn(Schema):
    proposals: list[uuid.UUID]
    """The views' Proposals (Coverage's `unaccounted_views[].id`)."""
    steps: list[str]
    """Takeoff Step keys, 2 to 14 (`vextrus/takeoff/library.py`)."""


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
    read_on: uuid.UUID | None
    """The printed sheet the list read on a sheet was read on; null for none."""
    read_revisions: dict[str, str]
    """Each number the list read on a sheet gives a revision mark, with that mark ("S-07": "B")."""


__all__ = [
    "Step1ActOut",
    "Step1AssignIn",
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
