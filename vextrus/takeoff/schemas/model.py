"""The 3D's data and the Element inspector in the API (docs/plans/M1.md C17, A18; frozen by M1-00,
built by M1-25). Primitives are C4's three kinds in SI decimals; the inspector names everything in the
words a QS sees (an Attribute Definition's label, the value in the Display Units, a grid ref "3/C")."""

import uuid
from decimal import Decimal
from typing import Literal

from ninja import Schema

from vextrus.live_model.services import TraceKind
from vextrus.takeoff.schemas.refs import SheetRefOut, StoreyRefOut


class PrimitiveOut(Schema):
    """One of C4's three kinds: `prism(polygon, holes, z0, z1)`, `cylinder(centre, radius, z0, z1)` or
    `sloped_prism(polygon, z0_at, z1_at)`; a kind's unused fields are null. Metres."""

    kind: Literal["prism", "cylinder", "sloped_prism"]
    polygon: list[list[Decimal]] | None
    holes: list[list[list[Decimal]]] | None
    z0: Decimal | None
    z1: Decimal | None
    centre: list[Decimal] | None
    radius: Decimal | None
    z0_at: list[Decimal] | None
    z1_at: list[Decimal] | None


class ElementPrimitivesOut(Schema):
    """One part of one Element in the 3D, keyed by (element_id, part) (#599), with its state."""

    element_id: uuid.UUID
    family: str
    storey: StoreyRefOut | None
    part: str
    state: Literal["open", "held", "confirmed"]
    primitives: list[PrimitiveOut]


class ClassificationOut(Schema):
    """A classification code: its system ("uniclass2015") and code."""

    system: str
    code: str


class InspectorAttrOut(Schema):
    """An Attribute as a QS reads it: its definition's label, its value in the Display Units and its
    unit."""

    key: str
    label: str
    value: str
    unit: str


class InspectorTraceOut(Schema):
    """One fact's Trace as the inspector shows it: the sheet by number and title, the view, the box."""

    fact: str
    kind: TraceKind
    sheet: SheetRefOut | None
    view_id: uuid.UUID | None
    bbox_sheet_mm: list[Decimal] | None


class ElementInspectorOut(Schema):
    element_id: uuid.UUID
    family: str
    mark: str
    storey: StoreyRefOut | None
    grid_ref: str | None
    ifc_class: str
    classification: list[ClassificationOut]
    attrs: list[InspectorAttrOut]
    trace: list[InspectorTraceOut]
