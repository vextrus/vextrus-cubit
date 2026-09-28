"""One row of each `live_model` table, for the tenancy tests: nothing writes these tables in M0.

Each builder writes through the database alias `using` (`default`, as `vextrus_app` under the acting
tenant's policies; `owner` for the Library's rows) and returns the saved row. References are set by
id, so a tenant's row may name a Library row the owner wrote.
"""

import datetime
import itertools
import uuid
from typing import Any

from vextrus.live_model.models import (
    AttributeDefinition,
    ClassificationReference,
    ClassificationSystem,
    Element,
    ElementFamily,
    ElementRelation,
    FamilyAttribute,
    Record,
)
from vextrus.platform.ids import new_id

_numbers = itertools.count(1)
BUILDING = uuid.UUID("01a0e800-0000-7000-8000-000000000001")


def family(tenant: uuid.UUID, using: str = "default", key: str | None = None) -> ElementFamily:
    return ElementFamily.objects.using(using).create(
        tenant_id=tenant,
        key=key or f"column_{next(_numbers)}",
        discipline="structural",
        takeoff_step="columns",
        labels={"en": "Column"},
        identity_rule="grid_intersection_storey",
        ifc_class="IfcColumn",
        ifc_predefined_type="COLUMN",
        milestone="M1",
    )


def definition(tenant: uuid.UUID, using: str = "default") -> AttributeDefinition:
    return AttributeDefinition.objects.using(using).create(
        tenant_id=tenant,
        key=f"vx.column.section_b_{next(_numbers)}",
        status="active",
        data_type="decimal",
        dimension="length",
        storage_unit="m",
        labels={"en": "Section width"},
        storage="attrs",
        life_phases=["as_designed", "as_built"],
        source="drawing",
        feeds_figures=True,
    )


def family_attribute(
    tenant: uuid.UUID,
    using: str = "default",
    *,
    of: AttributeDefinition | None = None,
    on: ElementFamily | None = None,
) -> FamilyAttribute:
    return FamilyAttribute.objects.using(using).create(
        tenant_id=tenant,
        definition_id=(of or definition(tenant, using)).pk,
        family_id=(on or family(tenant, using)).pk,
        required=True,
        group="geometry",
        level="type",
    )


def system(tenant: uuid.UUID, using: str = "default") -> ClassificationSystem:
    return ClassificationSystem.objects.using(using).create(
        tenant_id=tenant,
        name=f"Uniclass {next(_numbers)}",
        publisher="NBS",
        edition="2015 v1.30",
        licence="CC BY-ND 4.0",
        attribution="Contains information from Uniclass 2015.",
        may_ship=True,
    )


def reference(
    tenant: uuid.UUID, using: str = "default", *, within: ClassificationSystem | None = None
) -> ClassificationReference:
    return ClassificationReference.objects.using(using).create(
        tenant_id=tenant,
        system_id=(within or system(tenant, using)).pk,
        code=f"EF_20_{next(_numbers):02}",
        name="Columns",
    )


def element(tenant: uuid.UUID, using: str = "default", *, of: ElementFamily | None = None) -> Element:
    return Element.objects.using(using).create(
        tenant_id=tenant,
        building_id=BUILDING,
        family_id=(of or family(tenant, using)).pk,
        identity_key=f"col|B/{next(_numbers)}|4F",
        created_seq=1,
    )


def record(
    tenant: uuid.UUID,
    using: str = "default",
    *,
    on: Element | None = None,
    supersedes: Record | None = None,
) -> Record:
    return Record.objects.using(using).create(
        tenant_id=tenant,
        element_id=(on or element(tenant, using)).pk,
        attribute_key="vx.column.cast_on",
        life_phase="as_built",
        value="2026-09-28",
        observed_on=datetime.date(2026, 9, 28),
        recorded_by_id=new_id(),
        design_version_seq=1,
        source="site_record",
        supersedes_id=supersedes.pk if supersedes else None,
    )


def relation(
    tenant: uuid.UUID,
    using: str = "default",
    *,
    between: tuple[Element, Element] | None = None,
) -> ElementRelation:
    first, second = between or (element(tenant, using), element(tenant, using))
    return ElementRelation.objects.using(using).create(
        tenant_id=tenant,
        kind="junction",
        from_element_id=first.pk,
        to_element_id=second.pk,
        valid_from_seq=1,
        confirmation_id=new_id(),
    )


def every_l_table(tenant: uuid.UUID, using: str = "default") -> dict[str, Any]:
    """One row of each L table in the tenant, by table: a family attribute on the family and
    definition beside it, a reference within the system beside it."""
    made_family = family(tenant, using)
    made_definition = definition(tenant, using)
    made_system = system(tenant, using)
    return {
        "live_model_elementfamily": made_family,
        "live_model_attributedefinition": made_definition,
        "live_model_familyattribute": family_attribute(
            tenant, using, of=made_definition, on=made_family
        ),
        "live_model_classificationsystem": made_system,
        "live_model_classificationreference": reference(tenant, using, within=made_system),
    }


def every_table(tenant: uuid.UUID) -> dict[str, Any]:
    """One row of every table in the tenant, by table, each naming the tenant's own rows."""
    made = every_l_table(tenant)
    made_element = element(tenant, of=made["live_model_elementfamily"])
    return {
        **made,
        "live_model_element": made_element,
        "live_model_record": record(tenant, on=made_element),
        "live_model_elementrelation": relation(
            tenant, between=(made_element, element(tenant, of=made["live_model_elementfamily"]))
        ),
    }
