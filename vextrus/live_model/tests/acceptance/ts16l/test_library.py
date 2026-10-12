"""S16-L's Library rows for storey, grid_line and column: an IFC class, a Uniclass reference, and
Attribute Definitions each with meaning, reference face, datum, one storage unit and an IFC mapping
(M1.md C8: "Each Attribute Definition carries its meaning, reference face, datum and one storage unit,
and its IFC mapping"; M1-09's "fails on a key without all four").

The fields `meaning`, `reference_face` and `datum` on AttributeDefinition are this writer's pin of C8's
three words; FamilyClassification is docs/data-model.md §3.3's link of a Family to its reference."""

from collections.abc import Callable
from typing import Any

import pytest

from vextrus.live_model.tests.acceptance.ts16l.model import tables
from vextrus.testing.tenancy import Member

IFC_CLASS = {
    "storey": {"IfcBuildingStorey"},
    "grid_line": {"IfcGridAxis", "IfcGrid"},
    "column": {"IfcColumn"},
}
KEYS = {
    "storey": {
        "vx.storey.slab_level",
        "vx.storey.finished_floor_level",
        "vx.storey.height",
        "vx.storey.index",
        "vx.storey.plinth_level",
        "vx.storey.existing_ground_level",
    },
    "grid_line": {"vx.grid_line.axis"},
    "column": {
        "vx.column.section_b",
        "vx.column.section_d",
        "vx.column.diameter",
        "vx.column.grid_offset",
    },
}
IN_METRES = {
    "vx.storey.slab_level",
    "vx.storey.finished_floor_level",
    "vx.storey.height",
    "vx.storey.plinth_level",
    "vx.storey.existing_ground_level",
    "vx.column.section_b",
    "vx.column.section_d",
    "vx.column.diameter",
    "vx.column.grid_offset",
}


def definitions(family: str) -> list[Any]:
    fam = tables.ElementFamily.objects.get(key=family)
    ids = tables.FamilyAttribute.objects.filter(family=fam).values_list("definition_id", flat=True)
    return list(tables.AttributeDefinition.objects.filter(pk__in=ids))


@pytest.mark.django_db
@pytest.mark.parametrize("family", sorted(IFC_CLASS))
def test_the_family_names_its_ifc_class(family: str, sign_in: Callable[..., Member]) -> None:
    member: Member = sign_in(role="qs")
    with member.acting():
        assert tables.ElementFamily.objects.get(key=family).ifc_class in IFC_CLASS[family]


@pytest.mark.django_db
@pytest.mark.parametrize("family", sorted(IFC_CLASS))
def test_the_family_has_a_uniclass_reference(family: str, sign_in: Callable[..., Member]) -> None:
    member: Member = sign_in(role="qs")
    with member.acting():
        links = tables.FamilyClassification.objects.filter(family__key=family).select_related(
            "reference", "reference__system"
        )
        uniclass = [link.reference for link in links if "Uniclass" in link.reference.system.name]
        assert uniclass, f"{family} has no Uniclass reference"
        assert all(ref.code for ref in uniclass)


@pytest.mark.django_db
def test_the_column_s_uniclass_reference_is_an_element(sign_in: Callable[..., Member]) -> None:
    member: Member = sign_in(role="qs")
    with member.acting():
        links = tables.FamilyClassification.objects.filter(family__key="column").select_related(
            "reference", "reference__system"
        )
        codes = [link.reference.code for link in links if "Uniclass" in link.reference.system.name]
        assert codes
        assert all(code.startswith("EF_") for code in codes)


@pytest.mark.django_db
@pytest.mark.parametrize("family", sorted(KEYS))
def test_the_family_carries_its_c8_attribute_definitions(
    family: str, sign_in: Callable[..., Member]
) -> None:
    member: Member = sign_in(role="qs")
    with member.acting():
        assert KEYS[family] <= {d.key for d in definitions(family)}


@pytest.mark.django_db
@pytest.mark.parametrize("family", sorted(KEYS))
def test_every_definition_has_meaning_face_datum_unit_and_ifc(
    family: str, sign_in: Callable[..., Member]
) -> None:
    member: Member = sign_in(role="qs")
    with member.acting():
        found = definitions(family)
    assert found
    for d in found:
        missing = [
            name
            for name, value in (
                ("meaning", d.meaning),
                ("reference_face", d.reference_face),
                ("datum", d.datum),
                ("storage_unit", d.storage_unit),
                ("ifc", d.ifc),
            )
            if not value
        ]
        assert not missing, f"{d.key} lacks {missing}"
        assert d.ifc.get("ifc"), f"{d.key}'s IFC mapping names no IFC version"
        assert d.ifc.get("property"), f"{d.key}'s IFC mapping names no property"


@pytest.mark.django_db
def test_lengths_and_levels_are_stored_in_metres(sign_in: Callable[..., Member]) -> None:
    member: Member = sign_in(role="qs")
    with member.acting():
        units = {
            d.key: d.storage_unit for d in tables.AttributeDefinition.objects.filter(key__in=IN_METRES)
        }
    assert units == dict.fromkeys(IN_METRES, "m")
