"""The element inspector (session 16's live_model contract): one Element of a Project, with its
family's IFC class and classification, its attributes in their storage units, and where each fact
came from.

An Element is named by its own id, so the service checks it is of a Building of the path's Project:
one of another Project, of another Developer (row-level security hides it) or none at all is the one
`ElementNotFound`, and nothing else is told.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from django.db.models import F

from vextrus.drawings import services as drawings
from vextrus.live_model.models import (
    AttributeDefinition,
    ClassificationReference,
    ClassificationSystem,
    Element,
    ElementFamily,
    ElementState,
    ElementTrace,
    FamilyClassification,
)
from vextrus.platform.services import auth, tenancy
from vextrus.projects import services as projects


class ElementNotFound(auth.NotFound):
    """No Element of this id in a Building of this Project that the acting tenant can read: the
    one 404 (`platform.auth.not_found`)."""


@dataclass(frozen=True)
class ClassificationView:
    system: str
    code: str


@dataclass(frozen=True)
class AttrView:
    key: str
    value: str
    unit: str


@dataclass(frozen=True)
class TraceView:
    fact: str
    kind: str
    sheet_id: str | None
    view_id: str | None
    anchor: dict[str, Any]
    sheet_number: str | None = None
    sheet_title: str | None = None


@dataclass(frozen=True)
class ElementView:
    element_id: uuid.UUID
    family: str
    mark: str
    storey: str | None
    grid_ref: str
    ifc_class: str
    classification: tuple[ClassificationView, ...]
    attrs: tuple[AttrView, ...]
    trace: tuple[TraceView, ...]


def element(project_id: uuid.UUID, element_id: uuid.UUID) -> ElementView:
    """The Element as it stands (its open state; a retired one's last), else `ElementNotFound`."""
    try:
        buildings = [b.id for b in projects.buildings(project_id)]
    except projects.ProjectNotFound as missing:
        raise ElementNotFound from missing
    found = Element.objects.filter(pk=element_id, building_id__in=buildings).first()
    if found is None:
        raise ElementNotFound
    state = (
        ElementState.objects.filter(element_id=found.pk)
        .order_by(F("valid_to_seq").desc(nulls_first=True), "-valid_from_seq")
        .first()
    )
    family = ElementFamily.objects.get(pk=found.family_id)
    attrs = dict(state.attrs) if state else {}
    return ElementView(
        element_id=found.pk,
        family=family.key,
        mark=state.mark if state else found.mark_hint,
        storey=_storey_name(state.storey_id) if state else None,
        grid_ref=state.grid_ref if state else "",
        ifc_class=family.ifc_class,
        classification=_classification(family.pk),
        attrs=tuple(
            AttrView(key, str(value), units.get(key, ""))
            for units in [_units(set(attrs))]
            for key, value in sorted(attrs.items())
        ),
        trace=tuple(
            _trace_view(t)
            for t in ElementTrace.objects.filter(element_id=found.pk, valid_to_seq=None).order_by(
                "fact", "id"
            )
        ),
    )


def _trace_view(t: ElementTrace) -> TraceView:
    number, title = _sheet(t.anchor.get("sheet_id"))
    return TraceView(
        fact=t.fact,
        kind=t.kind,
        sheet_id=_text(t.anchor.get("sheet_id")),
        view_id=_text(t.anchor.get("view_id")),
        anchor=dict(t.anchor),
        sheet_number=number,
        sheet_title=title,
    )


def _sheet(sheet_id: Any) -> tuple[str | None, str | None]:
    """The printed sheet's number and title a Trace names, else none (gone, or not a sheet's id)."""
    try:
        found = drawings.sheet(uuid.UUID(str(sheet_id)), anchors=False)
    except ValueError, TypeError, auth.NotFound:
        return None, None
    return found.number or None, found.title or None


def _storey_name(storey_id: uuid.UUID | None) -> str | None:
    if storey_id is None:
        return None
    state = ElementState.objects.filter(element_id=storey_id, valid_to_seq=None).first()
    return state.mark if state else None


def _classification(family_id: uuid.UUID) -> tuple[ClassificationView, ...]:
    reference_ids = FamilyClassification.objects.filter(family_id=family_id).values_list(
        "reference_id", flat=True
    )
    references = list(ClassificationReference.objects.filter(pk__in=list(reference_ids)))
    systems = {
        s.pk: s for s in ClassificationSystem.objects.filter(pk__in={r.system_id for r in references})
    }
    return tuple(
        sorted(
            (
                ClassificationView(f"{systems[r.system_id].name} {systems[r.system_id].edition}", r.code)
                for r in references
                if r.system_id in systems
            ),
            key=lambda c: (c.system, c.code),
        )
    )


def _units(keys: set[str]) -> dict[str, str]:
    """Each key's storage unit: the tenant's own definition's, else its Library's."""
    tenant_id = tenancy.current_tenant_id()
    found: dict[str, tuple[bool, str]] = {}
    for key, owner, unit in AttributeDefinition.objects.filter(key__in=keys).values_list(
        "key", "tenant_id", "storage_unit"
    ):
        own = owner == tenant_id
        if key not in found or own:
            found[key] = (own, unit)
    return {key: unit for key, (_own, unit) in found.items()}


def _text(value: object) -> str | None:
    return None if value in (None, "") else str(value)
