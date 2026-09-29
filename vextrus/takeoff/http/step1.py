"""Step 1 in the API (ticket 19a; the ruling: `/api/projects/{project_id}/takeoff/step1/`).

Every operation declares its act through 07's guard, which answers first: signed out 401; no current
Membership 403; a Project outside the Membership's scope 404, before the role; the MD or a Guest
acting 403. Every role reads Step 1; only the QS and the Vextrus Engineer act on it. A Proposal is
named by its own id, so the service checks it is of the path's Project: one of another Project, of
another Developer, or none at all is the one 404 (`platform.auth.not_found`), and nothing is done.
"""

import uuid

from django.http import HttpRequest
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.step1 import (
    Step1ActOut,
    Step1ConfirmIn,
    Step1CoverageOut,
    Step1DrawingListIn,
    Step1DrawingListOut,
    Step1ExcludeIn,
    Step1ParsedListOut,
    Step1ProgressOut,
    Step1ProposalOut,
    Step1ProposalsOut,
    Step1QuestionOut,
    Step1QuestionsOut,
    Step1UndoIn,
)
from vextrus.takeoff.services import step1

router = Router()

_PREFIX = "/projects/{project_id}/takeoff/step1"


def actor(request: HttpRequest) -> str:
    return str(getattr(request.user, "name", ""))


@router.get(f"{_PREFIX}/proposals", response=Step1ProposalsOut)
@declare(acts.LOOK, project="project_id")
def list_proposals(request: HttpRequest, project_id: uuid.UUID) -> Step1ProposalsOut:
    """One per printed sheet: by Discipline, then number in natural order, with who decided it."""
    return Step1ProposalsOut(
        proposals=[Step1ProposalOut.from_view(p) for p in step1.proposals(project_id)]
    )


@router.get(f"{_PREFIX}/questions", response=Step1QuestionsOut)
@declare(acts.LOOK, project="project_id")
def list_questions(request: HttpRequest, project_id: uuid.UUID) -> Step1QuestionsOut:
    """The open Questions in queue order, then those answered."""
    return Step1QuestionsOut(
        questions=[Step1QuestionOut.from_view(q) for q in step1.questions(project_id)]
    )


@router.get(f"{_PREFIX}/coverage", response=Step1CoverageOut)
@declare(acts.LOOK, project="project_id")
def get_coverage(request: HttpRequest, project_id: uuid.UUID) -> Step1CoverageOut:
    return Step1CoverageOut.from_view(step1.coverage(project_id))


@router.get(f"{_PREFIX}/progress", response=Step1ProgressOut)
@declare(acts.LOOK, project="project_id")
def get_progress(request: HttpRequest, project_id: uuid.UUID) -> Step1ProgressOut:
    """n / N per Discipline and the Disciplines not yet received (never shown to the client)."""
    return Step1ProgressOut.from_view(step1.progress(project_id))


@router.post(f"{_PREFIX}/confirm", response={200: Step1ActOut, 400: Refusal})
@declare(acts.CONFIRM, project="project_id")
def confirm(request: HttpRequest, project_id: uuid.UUID, payload: Step1ConfirmIn) -> Step1ActOut:
    view = step1.confirm(project_id, payload.proposals, kind=payload.kind, actor_name=actor(request))
    return Step1ActOut.from_view(view)


@router.post(f"{_PREFIX}/exclude", response={200: Step1ActOut, 400: Refusal})
@declare(acts.EXCLUDE, project="project_id")
def exclude(request: HttpRequest, project_id: uuid.UUID, payload: Step1ExcludeIn) -> Step1ActOut:
    view = step1.exclude(
        project_id, payload.proposals, payload.reason, payload.text, actor_name=actor(request)
    )
    return Step1ActOut.from_view(view)


@router.post(f"{_PREFIX}/undo", response={200: Step1ActOut, 409: Refusal})
@declare(acts.UNDO, project="project_id")
def undo(request: HttpRequest, project_id: uuid.UUID, payload: Step1UndoIn) -> Step1ActOut:
    """Undo one's own last act on Step 1."""
    return Step1ActOut.from_view(step1.undo(project_id))


@router.post(f"{_PREFIX}/drawing-list/read", response={200: Step1ParsedListOut, 400: Refusal})
@declare(acts.DRAWING_LIST, project="project_id")
def read_drawing_list(
    request: HttpRequest, project_id: uuid.UUID, payload: Step1DrawingListIn
) -> Step1ParsedListOut:
    """A pasted list or typed range read back, for the QS to see the numbers first; nothing kept."""
    return Step1ParsedListOut.from_view(step1.read_list(project_id, payload.discipline, payload.text))


@router.post(f"{_PREFIX}/drawing-list", response={200: Step1DrawingListOut, 400: Refusal})
@declare(acts.DRAWING_LIST, project="project_id")
def set_drawing_list(
    request: HttpRequest, project_id: uuid.UUID, payload: Step1DrawingListIn
) -> Step1DrawingListOut:
    view = step1.set_list(project_id, payload.discipline, payload.text, actor_name=actor(request))
    return Step1DrawingListOut.from_view(view)


@router.get(f"{_PREFIX}/drawing-list", response={200: Step1DrawingListOut, 400: Refusal})
@declare(acts.LOOK, project="project_id")
def get_drawing_list(
    request: HttpRequest, project_id: uuid.UUID, discipline: str
) -> Step1DrawingListOut:
    return Step1DrawingListOut.from_view(step1.drawing_list(project_id, discipline))
