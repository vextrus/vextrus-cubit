"""The Live Model in the API (session 16; docs/plans/M1.md C7, C8): one Element as the inspector
reads it, `GET /api/projects/{project_id}/model/elements/{element_id}`."""

import uuid
from typing import Any

from ninja import Schema


class ClassificationOut(Schema):
    system: str  # "uniclass2015"
    code: str  # "EF_20_10"


class AttributeOut(Schema):
    key: str
    value: Any
    """A decimal string for a number, never a float."""
    unit: str | None


class ElementTraceOut(Schema):
    fact: str
    kind: str
    sheet_id: uuid.UUID | None
    view_id: uuid.UUID | None
    anchor: dict[str, Any] | None


class ElementOut(Schema):
    element_id: uuid.UUID
    family: str
    mark: str
    storey: str | None
    grid_ref: str | None
    ifc_class: str
    classification: list[ClassificationOut]
    attrs: list[AttributeOut]
    trace: list[ElementTraceOut]
