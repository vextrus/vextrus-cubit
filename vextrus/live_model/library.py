"""`live_model`'s Library rows, which `sync_library` (02) reads (session 16's S16-L; M1.md C8;
docs/research/component-attributes-and-classification.md §9): the Element Families `storey`,
`grid_line` and `column`, each with its IFC class and its Uniclass 2015 reference, and their
Attribute Definitions, each with its meaning, reference face, datum, one storage unit and IFC mapping.

A row's identity is `(tenant_id, key)` (a classification system's `(tenant_id, name, edition)`, a
reference's `(tenant_id, system, code)`). Keys are permanent, so no row is ever removed; a change of
words is written by the next `sync_library`.

Uniclass codes and names are NBS's, from its bSDD copy (the research file's [C25], to re-check against
the current edition). Uniclass has no Elements/functions code for a storey or a grid: they take the
nearest group, EF_30_20 Floors for a storey (it is a floor's level) and EF_20_10 Superstructure for a
grid line (it sets out the frame).
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Model

from vextrus.live_model.models import (
    AttributeDefinition,
    ClassificationReference,
    ClassificationSystem,
    ElementFamily,
    FamilyAttribute,
    FamilyClassification,
)
from vextrus.platform.services.library import Library

IFC = "4.3"
DATUM = "the Building's datum: the level the drawings mark ±0 (the storey family's confirmed datum)"


@dataclass(frozen=True)
class FamilyRow:
    key: str
    name: str
    discipline: str
    takeoff_step: str
    identity_rule: str
    ifc_class: str
    ifc_predefined_type: str
    uniclass: tuple[str, str]
    """(code, name) in Uniclass 2015."""


@dataclass(frozen=True)
class DefinitionRow:
    key: str
    family: str
    name: str
    data_type: str
    dimension: str
    storage_unit: str
    meaning: str
    reference_face: str
    datum: str
    ifc: Mapping[str, str]
    group: str = "geometry"
    required: bool = False
    feeds_figures: bool = True
    allowed_values: Sequence[Mapping[str, Any]] = field(default_factory=tuple)


FAMILIES: tuple[FamilyRow, ...] = (
    FamilyRow(
        "storey",
        "Storey",
        "building",
        "storeys",
        "index",
        "IfcBuildingStorey",
        "",
        ("EF_30_20", "Floors"),
    ),
    FamilyRow(
        "grid_line",
        "Grid line",
        "building",
        "grid",
        "label",
        "IfcGridAxis",
        "",
        ("EF_20_10", "Superstructure"),
    ),
    FamilyRow(
        "column",
        "Column",
        "structural",
        "columns",
        "grid_point",
        "IfcColumn",
        "COLUMN",
        ("EF_20_10", "Superstructure"),
    ),
)


def _ifc(property_name: str, *, pset: str = "", entity: str = "") -> dict[str, str]:
    mapping = {"ifc": IFC, "property": property_name}
    if pset:
        mapping["pset"] = pset
    if entity:
        mapping["entity"] = entity
    return mapping


_LEVEL_FACE = "the top face of the storey's structural slab"
DEFINITIONS: tuple[DefinitionRow, ...] = (
    DefinitionRow(
        "vx.storey.slab_level",
        "storey",
        "Slab level",
        "decimal",
        "length",
        "m",
        "the level of the top of the storey's structural slab",
        _LEVEL_FACE,
        DATUM,
        _ifc("ElevationOfSSLRelative", pset="Pset_BuildingStoreyCommon"),
        required=True,
    ),
    DefinitionRow(
        "vx.storey.finished_floor_level",
        "storey",
        "Finished floor level",
        "decimal",
        "length",
        "m",
        "the level of the top of the storey's floor finish",
        "the top face of the floor finish",
        DATUM,
        _ifc("ElevationOfFFLRelative", pset="Pset_BuildingStoreyCommon"),
        feeds_figures=False,
    ),
    DefinitionRow(
        "vx.storey.height",
        "storey",
        "Storey height",
        "decimal",
        "length",
        "m",
        "from this storey's slab level to the next storey's slab level",
        "the top faces of the two structural slabs",
        "this storey's slab level",
        _ifc("GrossHeight", pset="Qto_BuildingStoreyBaseQuantities"),
        required=True,
    ),
    DefinitionRow(
        "vx.storey.index",
        "storey",
        "Storey order",
        "integer",
        "count",
        "count",
        "the storey's order from the lowest, counting from 0",
        "not a measurement: the storeys' order by slab level",
        "the lowest storey, numbered 0",
        _ifc("Index", pset="Vextrus_Storey"),
        group="identity",
        required=True,
    ),
    DefinitionRow(
        "vx.storey.plinth_level",
        "storey",
        "Plinth level",
        "decimal",
        "length",
        "m",
        "the plinth, which splits sub- from super-structure; default the ground storey's slab level",
        "the top face of the plinth",
        DATUM,
        _ifc("PlinthLevel", pset="Vextrus_Storey"),
    ),
    DefinitionRow(
        "vx.storey.existing_ground_level",
        "storey",
        "Existing ground level",
        "decimal",
        "length",
        "m",
        "existing ground level, held on the ground storey; boring and sand filling measure from it",
        "the existing ground surface",
        DATUM,
        _ifc("ExistingGroundLevel", pset="Vextrus_Storey"),
    ),
    DefinitionRow(
        "vx.grid_line.axis",
        "grid_line",
        "Axis",
        "text",
        "length",
        "m",
        "the grid line in the Building's frame, as its two end points",
        "the grid line's centre line as drawn",
        "the Building's frame: its origin and directions on the registered grid",
        _ifc("AxisCurve", entity="IfcGridAxis"),
        required=True,
    ),
    DefinitionRow(
        "vx.column.section_b",
        "column",
        "Section b",
        "decimal",
        "length",
        "m",
        "the section's side along the first grid direction at the column",
        "the column's outer faces, structural concrete only, finish excluded",
        "the grid intersection the column stands on",
        _ifc("XDim", entity="IfcRectangleProfileDef"),
        required=True,
    ),
    DefinitionRow(
        "vx.column.section_d",
        "column",
        "Section d",
        "decimal",
        "length",
        "m",
        "the section's side along the second grid direction at the column",
        "the column's outer faces, structural concrete only, finish excluded",
        "the grid intersection the column stands on",
        _ifc("YDim", entity="IfcRectangleProfileDef"),
        required=True,
    ),
    DefinitionRow(
        "vx.column.diameter",
        "column",
        "Diameter",
        "decimal",
        "length",
        "m",
        "a round column's diameter",
        "the column's outer face, structural concrete only, finish excluded",
        "the column's centre",
        _ifc("Diameter", pset="Vextrus_Column"),
    ),
    DefinitionRow(
        "vx.column.grid_offset",
        "column",
        "Offset from grid",
        "text",
        "length",
        "m",
        "the column centre's offset from its grid intersection, along the two grid directions",
        "the column's centre (its section's centroid)",
        "the grid intersection the column stands on",
        _ifc("GridOffset", pset="Vextrus_Column"),
        feeds_figures=False,
    ),
)

UNICLASS = {
    "name": "Uniclass 2015",
    "publisher": "NBS",
    "edition": "bSDD v1",
    "licence": "CC BY-ND 4.0",
    "attribution": "Contains information from Uniclass 2015, NBS Enterprises Ltd.",
    "may_ship": True,
    "uri": "https://www.thenbs.com/our-tools/uniclass",
}


def sync(libraries: Sequence[Library], using: str) -> int:
    """Write the families, definitions and their links, and the Uniclass references into each
    Market's Library, through `using` (the owner); the rows created or changed."""
    written = 0
    for library in libraries:
        tenant = library.library_id
        families: dict[str, ElementFamily] = {}
        for family in FAMILIES:
            row, n = _put(
                ElementFamily,
                using,
                {"tenant_id": tenant, "key": family.key},
                {
                    "discipline": family.discipline,
                    "takeoff_step": family.takeoff_step,
                    "labels": {"en": family.name},
                    "identity_rule": family.identity_rule,
                    "ifc_class": family.ifc_class,
                    "ifc_predefined_type": family.ifc_predefined_type,
                    "milestone": "M1",
                },
            )
            families[family.key] = row
            written += n
        for order, definition in enumerate(DEFINITIONS):
            made, n = _put(
                AttributeDefinition,
                using,
                {"tenant_id": tenant, "key": definition.key},
                {
                    "status": "active",
                    "data_type": definition.data_type,
                    "allowed_values": list(definition.allowed_values),
                    "dimension": definition.dimension,
                    "storage_unit": definition.storage_unit,
                    "labels": {"en": definition.name},
                    "storage": "attrs",
                    "life_phases": ["as_designed", "as_built"],
                    "source": "drawing",
                    "feeds_figures": definition.feeds_figures,
                    "ifc": dict(definition.ifc),
                    "meaning": definition.meaning,
                    "reference_face": definition.reference_face,
                    "datum": definition.datum,
                },
            )
            written += n
            _row, n = _put(
                FamilyAttribute,
                using,
                {
                    "tenant_id": tenant,
                    "definition_id": made.pk,
                    "family_id": families[definition.family].pk,
                },
                {
                    "required": definition.required,
                    "sort_order": order,
                    "group": definition.group,
                    "level": "occurrence",
                },
            )
            written += n
        system, n = _put(
            ClassificationSystem,
            using,
            {"tenant_id": tenant, "name": UNICLASS["name"], "edition": UNICLASS["edition"]},
            {k: v for k, v in UNICLASS.items() if k not in ("name", "edition")},
        )
        written += n
        for family in FAMILIES:
            code, name = family.uniclass
            reference, n = _put(
                ClassificationReference,
                using,
                {"tenant_id": tenant, "system_id": system.pk, "code": code},
                {"name": name},
            )
            written += n
            _link, n = _put(
                FamilyClassification,
                using,
                {
                    "tenant_id": tenant,
                    "family_id": families[family.key].pk,
                    "reference_id": reference.pk,
                },
                {},
            )
            written += n
    return written


def _put[M: Model](
    model: type[M], using: str, identity: Mapping[str, Any], wanted: Mapping[str, Any]
) -> tuple[M, int]:
    """The row of `identity`, created or brought to `wanted`; and 1 when it was written, else 0."""
    row = model._default_manager.using(using).filter(**identity).first()
    if row is None:
        return model._default_manager.using(using).create(**identity, **wanted), 1
    changed = [name for name, value in wanted.items() if getattr(row, name) != value]
    if not changed:
        return row, 0
    for name in changed:
        setattr(row, name, wanted[name])
    row.save(using=using, update_fields=changed)
    return row, 1
