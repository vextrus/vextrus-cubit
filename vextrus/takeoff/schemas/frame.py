"""The frame Steps in the API (session 16: Steps 3 storeys, 4 grid and 6 columns; docs/plans/M1.md
C9, C17). Base `/api/projects/{project_id}/takeoff/`. Quantities and lengths travel as decimal
strings, never floats; an input value that needs checking is taken as text so the service answers a
bad one with a 400 `{code, params}`, not Ninja's 422."""

import uuid
from decimal import Decimal
from typing import Any, Literal

from ninja import Field, Schema


class FrameStepOut(Schema):
    """One frame Step's state: n of N confirmed, and its open Questions."""

    step: str  # "storeys" | "grid" | "columns"
    status: str
    n: int
    N: int
    open_questions: int


class FrameStepsOut(Schema):
    steps: list[FrameStepOut]


class FrameTraceOut(Schema):
    """Where one fact was read: the sheet, the view and the anchor in it."""

    fact: str
    sheet_id: uuid.UUID | None
    view_id: uuid.UUID | None
    anchor: dict[str, Any] | None


class FrameProposalOut(Schema):
    id: uuid.UUID
    family: str
    mark: str
    storey: str | None
    values: dict[str, Any]
    """Fact -> `{value, unit, text}`: the value in drawing units, a decimal string; the text verbatim."""
    state: str
    questions: list[dict[str, Any]]
    """Each open Question on the Proposal: `{id, code, params}`."""
    trace: list[FrameTraceOut]


class FrameGroupOut(Schema):
    key: str
    label: str
    proposals: list[FrameProposalOut]


class FrameProposalsOut(Schema):
    """`GET steps/{step}/proposals?group=band|mark`."""

    groups: list[FrameGroupOut]


class FrameReadOut(Schema):
    """`POST steps/{step}/read`'s 202: the read is enqueued."""

    step: str
    enqueued: bool


class StoreyOut(Schema):
    id: uuid.UUID
    name: str
    order: int
    level_m: Decimal | None
    height_m: Decimal | None
    level_basis: Literal["typed", "default"]


class ViewPlacementOut(Schema):
    view_id: uuid.UUID
    sheet_number: str
    storeys: list[uuid.UUID]


class StoreysOut(Schema):
    """`GET storeys`."""

    storeys: list[StoreyOut]
    view_placements: list[ViewPlacementOut]


class StoreyLevelIn(Schema):
    storey_id: uuid.UUID
    level_m: str
    """A decimal string in metres; the service refuses one it cannot read."""


class StoreyLevelsIn(Schema):
    """`PUT storeys/levels`: levels typed, not read."""

    levels: list[StoreyLevelIn]


class ViewPlacementIn(Schema):
    """`PUT view-placements/{view_id}`."""

    storey_ids: list[uuid.UUID]


class FrameConfirmationIn(Schema):
    """`POST confirmations`: one act on Proposals named by id or by a group's key. `edit` with
    `values {section_b, section_d, unit}` answers a column's size."""

    act: str  # "confirm" | "exclude" | "edit" | "unconfirm"
    step: str
    proposal_ids: list[uuid.UUID] | None = None
    group_key: str | None = None
    values: dict[str, Any] | None = None
    reason: str | None = None


class FrameConfirmationOut(Schema):
    confirmation_id: uuid.UUID
    model_version_seq: int
    figures_changed: bool


class PrimitiveOut(Schema):
    """One C4 primitive, SI decimals: a prism (`polygon`, `holes`, `z0`, `z1`), a cylinder (`centre`,
    `radius`, `z0`, `z1`) or a sloped prism (`polygon`, `z0_at`, `z1_at`)."""

    kind: Literal["prism", "cylinder", "sloped_prism"]
    polygon: list[list[Decimal]] = Field(default_factory=list)
    holes: list[list[list[Decimal]]] = Field(default_factory=list)
    z0: Decimal | None = None
    z1: Decimal | None = None
    centre: list[Decimal] | None = None
    radius: Decimal | None = None
    z0_at: list[Decimal] = Field(default_factory=list)
    z1_at: list[Decimal] = Field(default_factory=list)


class ElementPrimitivesOut(Schema):
    """C17: one Element's primitives and its state (`confirmed` | `proposal` | `held`)."""

    element_id: uuid.UUID
    family: str
    storey: str | None
    part: str
    state: str
    primitives: list[PrimitiveOut]
