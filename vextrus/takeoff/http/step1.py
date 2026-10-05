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
from vextrus.platform.services import deadlocks
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.step1 import (
    Step1ActOut,
    Step1AnswerIn,
    Step1AssignIn,
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
from vextrus.takeoff.services.read_propose import proposals
from vextrus.takeoff.tasks import read_file

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


@router.post(f"{_PREFIX}/confirm", response={200: Step1ActOut, 400: Refusal, 409: Refusal})
@declare(acts.CONFIRM, project="project_id")
def confirm(request: HttpRequest, project_id: uuid.UUID, payload: Step1ConfirmIn) -> Step1ActOut:
    def act() -> step1.ActView:
        with step1.writing(project_id):
            view = step1.confirm(
                project_id, payload.proposals, kind=payload.kind, actor_name=actor(request)
            )
            proposals.set_conflicts(project_id)  # a decided sheet is in no conflict (#161)
        return view

    return Step1ActOut.from_view(deadlocks.retried(act, what="step1.confirm"))


@router.post(f"{_PREFIX}/exclude", response={200: Step1ActOut, 400: Refusal})
@declare(acts.EXCLUDE, project="project_id")
def exclude(request: HttpRequest, project_id: uuid.UUID, payload: Step1ExcludeIn) -> Step1ActOut:
    def act() -> step1.ActView:
        with step1.writing(project_id):
            view = step1.exclude(
                project_id, payload.proposals, payload.reason, payload.text, actor_name=actor(request)
            )
            proposals.set_conflicts(project_id)
        return view

    return Step1ActOut.from_view(deadlocks.retried(act, what="step1.exclude"))


@router.post(f"{_PREFIX}/assign", response={200: Step1ActOut, 400: Refusal, 409: Refusal})
@declare(acts.ASSIGN, project="project_id")
def assign(request: HttpRequest, project_id: uuid.UUID, payload: Step1AssignIn) -> Step1ActOut:
    """Put views in Takeoff Steps (#158): in M0 the API's only (m0-screens 6.9)."""
    view = deadlocks.retried(
        lambda: step1.assign(project_id, payload.proposals, payload.steps, actor_name=actor(request)),
        what="step1.assign",
    )
    return Step1ActOut.from_view(view)


@router.post(f"{_PREFIX}/undo", response={200: Step1ActOut, 409: Refusal})
@declare(acts.UNDO, project="project_id")
def undo(request: HttpRequest, project_id: uuid.UUID, payload: Step1UndoIn) -> Step1ActOut:
    """Undo one's own last act on Step 1: the sheets it undecided are compared again."""

    def act() -> step1.ActView:
        with step1.writing(project_id):
            view = step1.undo(project_id)
            proposals.set_conflicts(project_id)
        return view

    return Step1ActOut.from_view(deadlocks.retried(act, what="step1.undo"))


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
    view = deadlocks.retried(
        lambda: step1.set_list(project_id, payload.discipline, payload.text, actor_name=actor(request)),
        what="step1.set_list",
    )
    return Step1DrawingListOut.from_view(view)


@router.get(f"{_PREFIX}/drawing-list", response={200: Step1DrawingListOut, 400: Refusal})
@declare(acts.LOOK, project="project_id")
def get_drawing_list(
    request: HttpRequest, project_id: uuid.UUID, discipline: str
) -> Step1DrawingListOut:
    return Step1DrawingListOut.from_view(step1.drawing_list(project_id, discipline))


@router.post(
    f"{_PREFIX}/questions/{{question_id}}/answer",
    response={200: Step1QuestionOut, 400: Refusal, 409: Refusal},
)
@declare(acts.CONFIRM, project="project_id")
def answer_question(
    request: HttpRequest, project_id: uuid.UUID, question_id: uuid.UUID, payload: Step1AnswerIn
) -> Step1QuestionOut:
    """Answer a Question with one of its options (`keep_open` keeps it open). A held file read
    anyway has its read job queued again, in the answer's transaction."""

    def act() -> step1.Answered:
        with step1.writing(project_id):
            done = step1.answer(
                project_id, question_id, payload.option, payload.text, actor_name=actor(request)
            )
            if done.read_again is not None:
                read_file.read_again(done.read_again)
            if done.corrected:  # a typed number another sheet has, say: its conflict is asked
                proposals.set_questions(project_id)
            else:  # the sheets an answer decided are in no conflict (#161)
                proposals.set_conflicts(project_id)
        return done

    return Step1QuestionOut.from_view(deadlocks.retried(act, what="step1.answer").question)
