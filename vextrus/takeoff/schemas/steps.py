"""M1's Takeoff steps in the API (docs/plans/M1.md C9; frozen by M1-00, built by M1-11a, M1-11b and
M1-11c): each step's status, its Proposals and Questions, its read, the QS's confirmations, answers,
closing and active time, and the Drafting Profile.

The state words are two named enums the web imports as generated unions (A12): `StepStatus` and
`ProposalState`.
"""

import uuid
from enum import StrEnum
from typing import Any

from ninja import Schema
from pydantic import Field


class StepStatus(StrEnum):
    """Where a Takeoff Step stands."""

    NOT_STARTED = "not_started"
    READING = "reading"
    IN_REVIEW = "in_review"
    CONFIRMED = "confirmed"
    CLOSED_WITH_QUESTIONS = "closed_with_questions"
    REOPENED = "reopened"


class ProposalState(StrEnum):
    """Where a Proposal stands."""

    OPEN = "open"
    HELD = "held"
    BLOCKED = "blocked"
    CONFIRMED = "confirmed"
    EXCLUDED = "excluded"
    SUPERSEDED = "superseded"


class StepOut(Schema):
    """One Takeoff Step: its status, n of N, its open Questions (the length of its Questions list),
    the Elements awaiting an answer, and its basis."""

    step: str
    status: StepStatus
    n: int
    N: int
    open_questions: int
    awaiting_answer: int
    basis: str


class StepProposalOut(Schema):
    """One Proposal in a group: its state and the Questions linked to it (QuestionLink, A10)."""

    id: uuid.UUID
    candidate_key: str
    state: ProposalState
    questions: list[uuid.UUID]


class StepProposalGroupOut(Schema):
    """A row: the Proposals of one band or storey (`group`), gated only by their own Questions."""

    group_key: str
    proposals: list[StepProposalOut]


class StepProposalsOut(Schema):
    step: str
    groups: list[StepProposalGroupOut]


class StepQuestionOptionOut(Schema):
    """An option of a Question: its key and its words, a code and its params."""

    key: str
    code: str
    params: dict[str, Any]


class StepQuestionOut(Schema):
    """A Question of a step (A10; M1-11b): what it asks, its options, and the Proposals it holds."""

    id: uuid.UUID
    code: str
    params: dict[str, Any]
    kind: str
    options: list[StepQuestionOptionOut]
    blocks: list[uuid.UUID]
    group_key: str


class StepReadOut(Schema):
    """A read started (C5): 202."""

    step: str
    enqueued: bool


class ConfirmationIn(Schema):
    """One act on a step's Proposals (C9's ConfirmationAct): named by id, or a whole group."""

    act: str
    step: str
    proposal_ids: list[uuid.UUID] | None = None
    group_key: str | None = None
    values: dict[str, str] | None = None
    reason: str | None = None


class ConfirmationOut(Schema):
    """What an act wrote: its Confirmation, the ModelVersion it made, and whether figures changed."""

    confirmation_id: uuid.UUID
    model_version_seq: int
    figures_changed: bool


class AnswerIn(Schema):
    """An answer: an option offered, or a typed value."""

    option_key: str | None = None
    typed: str | None = None


class CloseIn(Schema):
    with_questions: bool


class ActiveIn(Schema):
    """The QS's active seconds on a step since the last beat, capped at the idle cut-off
    (`VEXTRUS_ACTIVE_IDLE_SECONDS`)."""

    seconds: int = Field(ge=0)


class ProfileOut(Schema):
    """A Discipline's Drafting Profile: its parts and their conventions (C6)."""

    discipline: str
    parts: dict[str, Any]


class ProfileConfirmIn(Schema):
    part: str
    convention_keys: list[str]
