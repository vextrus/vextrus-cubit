"""The frame steps' shapes in the API (Steps 3, 4 and 6: storeys, grid, columns; the session-16
contract, C9 and C17). Quantities are decimal strings, never floats; refusals are `Refusal`."""

import uuid
from typing import Any, Literal

from ninja import Field, Schema

StepKey = Literal["storeys", "grid", "columns"]


class FrameStepOut(Schema):
    step: str
    status: str
    n: int
    N: int
    open_questions: int


class FrameStepsOut(Schema):
    steps: list[FrameStepOut]


class FrameTraceOut(Schema):
    fact: str
    sheet_id: str
    view_id: str
    anchor: dict[str, Any]


class FrameProposalOut(Schema):
    id: uuid.UUID
    family: str
    mark: str
    storey: str | None
    values: dict[str, Any]
    state: str
    questions: list[str]
    trace: list[FrameTraceOut]


class FrameGroupOut(Schema):
    key: str
    label: str
    proposals: list[FrameProposalOut]


class FrameProposalsOut(Schema):
    groups: list[FrameGroupOut]


class StoreyOut(Schema):
    id: uuid.UUID
    name: str
    order: int
    level_m: str | None
    height_m: str | None
    level_basis: Literal["typed", "default"]


class ViewPlacementOut(Schema):
    view_id: uuid.UUID
    sheet_number: str
    storeys: list[uuid.UUID]


class StoreysOut(Schema):
    storeys: list[StoreyOut]
    view_placements: list[ViewPlacementOut]


class StoreyLevelIn(Schema):
    storey_id: uuid.UUID
    level_m: str


class StoreyLevelsIn(Schema):
    """Typed levels ("levels typed, not read")."""

    levels: list[StoreyLevelIn]


class ViewPlacementIn(Schema):
    storey_ids: list[uuid.UUID]


class FrameConfirmationIn(Schema):
    """One act on a step's Proposals, named by id or by a group's key; `edit`'s `values`
    (`{section_b, section_d, unit}`) is the size answer."""

    act: Literal["confirm", "exclude", "edit", "unconfirm"]
    step: StepKey
    proposal_ids: list[uuid.UUID] | None = None
    group_key: str | None = None
    values: dict[str, str] | None = None
    reason: str | None = None


class FrameConfirmationOut(Schema):
    confirmation_id: uuid.UUID
    model_version_seq: int
    figures_changed: bool


class ReadStartedOut(Schema):
    step: str


class PrimitiveOut(Schema):
    """A C4 Primitive: `prism` (polygon, z0, z1; holes), `cylinder` or `sloped_prism`, SI decimals."""

    kind: Literal["prism", "cylinder", "sloped_prism"]
    polygon: list[list[str]] = Field(default_factory=list)
    holes: list[list[list[str]]] = Field(default_factory=list)
    z0: str | None = None
    z1: str | None = None
    centre: list[str] | None = None
    radius: str | None = None
    z0_at: list[str] = Field(default_factory=list)
    z1_at: list[str] = Field(default_factory=list)


class ModelElementPrimitivesOut(Schema):
    element_id: uuid.UUID
    family: str
    storey: str | None
    part: str
    state: Literal["confirmed", "proposal", "held"]
    primitives: list[PrimitiveOut]
