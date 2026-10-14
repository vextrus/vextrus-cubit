"""M1's Takeoff steps in the API (docs/plans/M1.md C9; under `/api/projects/{project_id}/takeoff/`, A15).

Stubs of the contract freeze (M1-00): each route has its contract's request and reply, sits behind
07's guard like every route (signed out 401; a Project outside the scope 404; a role without the act
403), and then answers 501 `platform.stubs.not_built`. M1-11a, M1-11b and M1-11c replace them whole.
"""

import uuid
from typing import Literal

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.http.stubs import not_built
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.steps import (
    ActiveIn,
    AnswerIn,
    CloseIn,
    ConfirmationIn,
    ConfirmationOut,
    ProfileConfirmIn,
    ProfileOut,
    StepOut,
    StepProposalsOut,
    StepQuestionOut,
    StepReadOut,
)

router = Router()

_PREFIX = "/projects/{project_id}/takeoff"
NOT_BUILT = {501: Refusal}


@router.get(f"{_PREFIX}/steps", response={200: list[StepOut], **NOT_BUILT})
@declare(acts.LOOK, project="project_id")
def list_steps(request: HttpRequest, project_id: uuid.UUID) -> HttpResponse:
    """Every Takeoff Step with its status and n / N (M1-11b)."""
    return not_built()


@router.get(f"{_PREFIX}/steps/{{step}}/proposals", response={200: StepProposalsOut, **NOT_BUILT})
@declare(acts.LOOK, project="project_id")
def list_proposals(
    request: HttpRequest,
    project_id: uuid.UUID,
    step: str,
    group: Literal["band", "storey"] = "storey",
) -> HttpResponse:
    """A step's Proposals in groups by band or storey (M1-11b)."""
    return not_built()


@router.get(f"{_PREFIX}/steps/{{step}}/questions", response={200: list[StepQuestionOut], **NOT_BUILT})
@declare(acts.LOOK, project="project_id")
def list_questions(
    request: HttpRequest,
    project_id: uuid.UUID,
    step: str,
    status: Literal["open", "answered", "all"] = "open",
) -> HttpResponse:
    """A step's Questions (A10; M1-11b)."""
    return not_built()


@router.post(f"{_PREFIX}/steps/{{step}}/read", response={202: StepReadOut, **NOT_BUILT})
@declare(acts.READ, project="project_id")
def start_read(request: HttpRequest, project_id: uuid.UUID, step: str) -> HttpResponse:
    """The product's read of a step (C5; M1-11c)."""
    return not_built()


@router.post(f"{_PREFIX}/confirmations", response={200: ConfirmationOut, **NOT_BUILT})
@declare(acts.CONFIRM, project="project_id")
def confirm(request: HttpRequest, project_id: uuid.UUID, payload: ConfirmationIn) -> HttpResponse:
    """One act on a step's Proposals (M1-11a)."""
    return not_built()


@router.post(f"{_PREFIX}/questions/{{question_id}}/answer", response={200: ConfirmationOut, **NOT_BUILT})
@declare(acts.ANSWER, project="project_id")
def answer(
    request: HttpRequest, project_id: uuid.UUID, question_id: uuid.UUID, payload: AnswerIn
) -> HttpResponse:
    """Answer a Question (M1-11b)."""
    return not_built()


@router.post(f"{_PREFIX}/steps/{{step}}/close", response={200: StepOut, **NOT_BUILT})
@declare(acts.CLOSE, project="project_id")
def close(request: HttpRequest, project_id: uuid.UUID, step: str, payload: CloseIn) -> HttpResponse:
    """Close a step, with its Questions open or not (M1-11b)."""
    return not_built()


@router.post(f"{_PREFIX}/steps/{{step}}/reopen", response={200: StepOut, **NOT_BUILT})
@declare(acts.CLOSE, project="project_id")
def reopen(request: HttpRequest, project_id: uuid.UUID, step: str) -> HttpResponse:
    """Reopen a closed step (M1-11b)."""
    return not_built()


@router.post(f"{_PREFIX}/steps/{{step}}/active", response={204: None, **NOT_BUILT})
@declare(acts.ACTIVE, project="project_id")
def active(request: HttpRequest, project_id: uuid.UUID, step: str, payload: ActiveIn) -> HttpResponse:
    """The QS's active time on a step, one beat (M1-11b)."""
    return not_built()


@router.get(f"{_PREFIX}/profile/{{discipline}}", response={200: ProfileOut, **NOT_BUILT})
@declare(acts.LOOK, project="project_id")
def get_profile(request: HttpRequest, project_id: uuid.UUID, discipline: str) -> HttpResponse:
    """A Discipline's Drafting Profile (C6; M1-12)."""
    return not_built()


@router.post(f"{_PREFIX}/profile/{{discipline}}/confirm", response={200: ConfirmationOut, **NOT_BUILT})
@declare(acts.PROFILE, project="project_id")
def confirm_profile(
    request: HttpRequest, project_id: uuid.UUID, discipline: str, payload: ProfileConfirmIn
) -> HttpResponse:
    """Confirm a profile part's conventions (C6; M1-12)."""
    return not_built()
