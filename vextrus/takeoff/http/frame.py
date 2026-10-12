"""Steps 3, 4 and 6 in the API (ticket S16-T2; session 16's contract: under
`/api/projects/{project_id}/takeoff/`).

Every operation declares its act through 07's guard, which answers first (signed out 401; a Project
outside the Membership's scope, or another Developer's, 404). Every role reads the steps; only the
QS and the Vextrus Engineer act. A Proposal or storey named by id that is not of the path's Project
is the one 404, and nothing is done.
"""

import uuid
from dataclasses import asdict
from typing import Any

from django.http import HttpRequest
from ninja import Field, Router, Schema, Status

from vextrus.platform.http.acts import Refusal, declare
from vextrus.takeoff import acts
from vextrus.takeoff.services import frame_steps

router = Router()

_PREFIX = "/projects/{project_id}/takeoff"


def actor(request: HttpRequest) -> str:
    return str(getattr(request.user, "name", ""))


class StepOut(Schema):
    step: str
    status: str
    n: int
    N: int
    open_questions: int


class TraceOut(Schema):
    fact: str
    sheet_id: str | None
    view_id: str | None
    anchor: dict[str, Any]


class ProposalOut(Schema):
    id: uuid.UUID
    family: str
    mark: str
    storey: str | None
    values: dict[str, Any]
    state: str
    questions: list[dict[str, Any]]
    trace: list[TraceOut]


class GroupOut(Schema):
    key: str
    label: str
    proposals: list[ProposalOut]


class ProposalsOut(Schema):
    groups: list[GroupOut]


class StoreyOut(Schema):
    id: uuid.UUID
    name: str
    order: int
    level_m: str | None
    height_m: str | None
    level_basis: str


class PlacementOut(Schema):
    view_id: uuid.UUID
    sheet_number: str
    storeys: list[uuid.UUID]


class StoreysOut(Schema):
    storeys: list[StoreyOut]
    view_placements: list[PlacementOut]


class LevelIn(Schema):
    storey_id: uuid.UUID
    level_m: str


class LevelsIn(Schema):
    levels: list[LevelIn]


class PlacementIn(Schema):
    storey_ids: list[uuid.UUID]


class ConfirmationIn(Schema):
    act: str
    step: str
    proposal_ids: list[uuid.UUID] = Field(default_factory=list)
    group_key: str | None = None
    values: dict[str, Any] | None = None
    reason: str | None = None


class ConfirmationOut(Schema):
    confirmation_id: uuid.UUID
    model_version_seq: int | None
    figures_changed: bool


class ReadOut(Schema):
    step: str
    enqueued: bool


def _storeys(view: frame_steps.StoreyList) -> StoreysOut:
    return StoreysOut.model_validate(asdict(view))


@router.get(f"{_PREFIX}/steps", response=list[StepOut])
@declare(acts.LOOK, project="project_id")
def list_steps(request: HttpRequest, project_id: uuid.UUID) -> list[StepOut]:
    """Steps 3, 4 and 6: status, n of N and open Questions."""
    return [StepOut.model_validate(asdict(row)) for row in frame_steps.steps(project_id)]


@router.post(f"{_PREFIX}/steps/{{step}}/read", response={202: ReadOut, 400: Refusal, 409: Refusal})
@declare(acts.CONFIRM, project="project_id")
def read_step(request: HttpRequest, project_id: uuid.UUID, step: str) -> Status[ReadOut]:
    """Queue the frame read of the Project's Building."""
    frame_steps.read(project_id, step)
    return Status(202, ReadOut(step=step, enqueued=True))


@router.get(f"{_PREFIX}/steps/{{step}}/proposals", response={200: ProposalsOut, 400: Refusal})
@declare(acts.LOOK, project="project_id")
def list_proposals(
    request: HttpRequest, project_id: uuid.UUID, step: str, group: str = "mark"
) -> ProposalsOut:
    groups = frame_steps.proposals(project_id, step, group)
    return ProposalsOut.model_validate({"groups": [asdict(g) for g in groups]})


@router.get(f"{_PREFIX}/storeys", response=StoreysOut)
@declare(acts.LOOK, project="project_id")
def list_storeys(request: HttpRequest, project_id: uuid.UUID) -> StoreysOut:
    return _storeys(frame_steps.storeys(project_id))


@router.put(f"{_PREFIX}/storeys/levels", response={200: StoreysOut, 400: Refusal})
@declare(acts.CONFIRM, project="project_id")
def type_levels(request: HttpRequest, project_id: uuid.UUID, payload: LevelsIn) -> StoreysOut:
    """Levels typed, not read: metres above the Building's datum."""
    levels = [(level.storey_id, level.level_m) for level in payload.levels]
    return _storeys(frame_steps.type_levels(project_id, levels, actor_name=actor(request)))


@router.put(f"{_PREFIX}/view-placements/{{view_id}}", response={200: StoreysOut, 400: Refusal})
@declare(acts.ASSIGN, project="project_id")
def place_view(
    request: HttpRequest, project_id: uuid.UUID, view_id: uuid.UUID, payload: PlacementIn
) -> StoreysOut:
    view = frame_steps.place_view(project_id, view_id, payload.storey_ids, actor_name=actor(request))
    return _storeys(view)


@router.post(f"{_PREFIX}/confirmations", response={200: ConfirmationOut, 400: Refusal, 409: Refusal})
@declare(acts.CONFIRM, project="project_id")
def post_confirmation(
    request: HttpRequest, project_id: uuid.UUID, payload: ConfirmationIn
) -> ConfirmationOut:
    """One act (confirm, exclude, edit or unconfirm): one Confirmation, one DomainEvent, one
    ModelVersion."""
    done = frame_steps.act(
        project_id,
        act=payload.act,
        step=payload.step,
        proposal_ids=payload.proposal_ids,
        group_key=payload.group_key,
        values=payload.values,
        reason=payload.reason,
        actor_name=actor(request),
    )
    return ConfirmationOut.model_validate(asdict(done))
