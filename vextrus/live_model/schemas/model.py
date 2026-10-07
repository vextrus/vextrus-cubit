"""The Live Model's Element inspector in the API (the session-16 contract)."""

import uuid
from typing import Any

from ninja import Schema


class ClassificationOut(Schema):
    system: str
    code: str


class AttrOut(Schema):
    key: str
    value: str | None
    unit: str | None


class ElementTraceOut(Schema):
    fact: str
    kind: str
    sheet_id: str
    view_id: str
    anchor: dict[str, Any]


class ElementOut(Schema):
    element_id: uuid.UUID
    family: str
    mark: str
    storey: str | None
    grid_ref: str | None
    ifc_class: str
    classification: list[ClassificationOut]
    attrs: list[AttrOut]
    trace: list[ElementTraceOut]
