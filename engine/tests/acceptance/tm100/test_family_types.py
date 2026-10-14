"""M1-00, the contract freeze: `engine/families/types.py` holds C4's types with exactly C4's fields
(docs/plans/M1.md C4: "M1-00 commits `engine/families/types.py` with exactly these"; "Every type is a
frozen dataclass"). The ticket's test: "every C4 type constructs with its fields and refuses a missing
one".

A field is required when C4 gives it no default; C4's defaults are `FactSpec.core = False`,
`Manifest.milestone = "M1"`, `ElementCandidate.judgements = 0`, `ElementCandidate.geometry = None` and
`OwnedSolid.holes = ()`. `Primitive` and `LineDraft` are listed by field name only, so only their names
(and `Primitive.kind`) are pinned here.
"""

import dataclasses
import enum
import importlib
import re
import typing
from decimal import Decimal

import pytest

D = Decimal
P0 = (D("0"), D("0"))
SQUARE = ((D("0"), D("0")), (D("1"), D("0")), (D("1"), D("1")), (D("0"), D("1")))
ARTEFACT = object()
VIEW = object()


def types() -> typing.Any:
    return importlib.import_module("engine.families.types")


def _samples() -> dict[str, dict[str, object]]:
    """Each C4 type's fields, in C4's order, with a value for each (C4's examples where it gives one)."""
    t = types()
    fact = t.FactSpec(key="vx.column.section_b", kind="dimension", core=False)
    value = t.FactValue(value=D("250"), unit="mm", text="250")
    at = t.GridPoint(ref="B/2", offset=(D("0"), D("0")))
    storey = t.StoreyFact(
        key="floor_1", name="1st", order=1, slab_level_m=D("3.048"), height_m=D("3.048"), basis="read"
    )
    grid = t.RegisteredGrid(
        origin=("A", "1"),
        lines=(t.GridLine(label="A", angle_deg=D("0"), offset=D("0")),),
        drawing_unit="mm",
    )
    placed = t.PlacedView(
        model_box=(P0, (D("1000"), D("1000"))),
        paper_to_model=(D("1"), D("0"), D("0"), D("1"), D("0"), D("0")),
        scale=D("100"),
        drawing_unit="mm",
    )
    candidate_fields: dict[str, object] = {
        "family": "column",
        "candidate_key": "column|B/2|floor_1",
        "view_id": "view-1",
        "sheet_id": "sheet-1",
        "storey": "floor_1",
        "band": ("floor_1", "floor_3"),
        "mark": "C2",
        "at": at,
        "values": {"vx.column.section_b": value},
        "anchors": {"vx.column.section_b": ()},
        "source": "plan",
        "confidence": D("0.9"),
        "judgements": 0,
        "geometry": None,
    }
    candidate = t.ElementCandidate(**candidate_fields)
    question_fields: dict[str, object] = {
        "code": "engine.column.mark_not_in_schedule",
        "params": {"mark": "C2"},
        "kind": "conflict",
        "group_key": "C2",
        "blocks": ("column|B/2|floor_1",),
        "anchors": (),
    }
    convention_fields: dict[str, object] = {
        "part": "families.column.layers",
        "value": ["COLUMN"],
        "evidence": (),
    }
    facts_fields: dict[str, object] = {
        "family": "column",
        "element_id": "element-1",
        "mark": "C2",
        "storey": "floor_1",
        "band": None,
        "grid_ref": "B/2",
        "x_m": D("4.572"),
        "y_m": D("3.048"),
        "rotation": D("0"),
        "values": {"vx.column.section_b": D("0.254")},
    }
    return {
        "FactSpec": {"key": "vx.column.section_b", "kind": "dimension", "core": False},
        "Manifest": {
            "key": "column",
            "part": "structural",
            "step": "columns",
            "identity_rule": "grid_point",
            "ifc_class": "IfcColumn",
            "ifc_predefined_type": "COLUMN",
            "classification": (("uniclass2015", "EF_20_10"),),
            "facts": (fact,),
            "rule_codes": ("F3",),
            "jev_nodes": ("label_binding",),
            "conventions": ("families.column.layers",),
            "n_rule": "marks_x_view_storeys",
            "stage": "slab_casting",
            "view_kinds": ("plan",),
            "reads_steps": ("grid", "columns"),
            "milestone": "M1",
        },
        "GridPoint": {"ref": "B/2", "offset": (D("0"), D("0"))},
        "GridSegment": {"on": "B", "from_": "1", "to": "2", "offset": D("0")},
        "PolygonAt": {"points": SQUARE},
        "FactValue": {"value": D("250"), "unit": "mm", "text": "250"},
        "ElementCandidate": candidate_fields,
        "JudgementRequest": {
            "code": "engine.column.label_binding",
            "params": {"mark": "C2"},
            "candidate_key": "column|B/2|floor_1",
            "anchors": (),
        },
        "ConventionProposal": convention_fields,
        "QuestionRaised": question_fields,
        "Recognised": {
            "candidates": (candidate,),
            "judgements": (),
            "conventions": (t.ConventionProposal(**convention_fields),),
            "questions": (t.QuestionRaised(**question_fields),),
        },
        "StoreyFact": {
            "key": "floor_1",
            "name": "1st",
            "order": 1,
            "slab_level_m": D("3.048"),
            "height_m": D("3.048"),
            "basis": "read",
        },
        "GridLine": {"label": "A", "angle_deg": D("0"), "offset": D("0")},
        "RegisteredGrid": {"origin": ("A", "1"), "lines": grid.lines, "drawing_unit": "mm"},
        "PlacedView": {
            "model_box": (P0, (D("1000"), D("1000"))),
            "paper_to_model": (D("1"), D("0"), D("0"), D("1"), D("0"), D("0")),
            "scale": D("100"),
            "drawing_unit": "mm",
        },
        "Unplaced": {"reason": "engine.view.not_placed"},
        "ViewArtefact": {
            "view_id": "view-1",
            "sheet_id": "sheet-1",
            "artefact": ARTEFACT,
            "view": VIEW,
            "placement": placed,
            "storeys": ("floor_1", "floor_2"),
            "steps": ("grid", "columns"),
        },
        "ConfirmedFacts": {
            "facts": (t.ElementFacts(**facts_fields),),
            "frame": grid,
            "storeys": (storey,),
        },
        "ProjectSetup": {"drawing_unit": "mm", "storeys": (storey,)},
        "ProfileParts": {"parts": {"grid": {"layers": ["GRID"]}}},
        "ElementFacts": facts_fields,
        "OwnedSolid": {"polygon": SQUARE, "z0": D("0"), "z1": D("2.921"), "holes": ()},
        "Primitive": {
            "kind": "prism",
            "polygon": SQUARE,
            "holes": (),
            "z0": D("0"),
            "z1": D("2.921"),
            "centre": None,
            "radius": None,
            "z0_at": None,
            "z1_at": None,
        },
        "LineDraft": {
            "qty_si": D("0.376902"),
            "unit_si": "m3",
            "rule_codes": ("F3", "J1"),
            "rebar_basis": "by_ratio",
            "item_code": "RCC-COL-1:1.5:3",
            "nos": 1,
            "l_m": D("0.254"),
            "b_m": D("0.508"),
            "h_m": D("2.921"),
            "area_m2": None,
            "diameter_mm": None,
            "assumed_split": False,
            "lap": False,
            "held": False,
        },
        "RuleSetData": {
            "version_id": "rule-set-version-1",
            "rebar_ratios": {"column": D("180")},
            "params": {},
        },
        "ChainResult": {
            "candidates_by_family": {"column": (candidate,)},
            "questions": (),
            "conventions": (),
            "frame": grid,
            "storeys": (storey,),
        },
    }


FIELDS: dict[str, tuple[str, ...]] = {
    "FactSpec": ("key", "kind", "core"),
    "Manifest": (
        "key",
        "part",
        "step",
        "identity_rule",
        "ifc_class",
        "ifc_predefined_type",
        "classification",
        "facts",
        "rule_codes",
        "jev_nodes",
        "conventions",
        "n_rule",
        "stage",
        "view_kinds",
        "reads_steps",
        "milestone",
    ),
    "GridPoint": ("ref", "offset"),
    "GridSegment": ("on", "from_", "to", "offset"),
    "PolygonAt": ("points",),
    "FactValue": ("value", "unit", "text"),
    "ElementCandidate": (
        "family",
        "candidate_key",
        "view_id",
        "sheet_id",
        "storey",
        "band",
        "mark",
        "at",
        "values",
        "anchors",
        "source",
        "confidence",
        "judgements",
        "geometry",
    ),
    "JudgementRequest": ("code", "params", "candidate_key", "anchors"),
    "ConventionProposal": ("part", "value", "evidence"),
    "QuestionRaised": ("code", "params", "kind", "group_key", "blocks", "anchors"),
    "Recognised": ("candidates", "judgements", "conventions", "questions"),
    "StoreyFact": ("key", "name", "order", "slab_level_m", "height_m", "basis"),
    "GridLine": ("label", "angle_deg", "offset"),
    "RegisteredGrid": ("origin", "lines", "drawing_unit"),
    "PlacedView": ("model_box", "paper_to_model", "scale", "drawing_unit"),
    "Unplaced": ("reason",),
    "ViewArtefact": ("view_id", "sheet_id", "artefact", "view", "placement", "storeys", "steps"),
    "ConfirmedFacts": ("facts", "frame", "storeys"),
    "ProjectSetup": ("drawing_unit", "storeys"),
    "ProfileParts": ("parts",),
    "ElementFacts": (
        "family",
        "element_id",
        "mark",
        "storey",
        "band",
        "grid_ref",
        "x_m",
        "y_m",
        "rotation",
        "values",
    ),
    "OwnedSolid": ("polygon", "z0", "z1", "holes"),
    "Primitive": ("kind", "polygon", "holes", "z0", "z1", "centre", "radius", "z0_at", "z1_at"),
    "LineDraft": (
        "qty_si",
        "unit_si",
        "rule_codes",
        "rebar_basis",
        "item_code",
        "nos",
        "l_m",
        "b_m",
        "h_m",
        "area_m2",
        "diameter_mm",
        "assumed_split",
        "lap",
        "held",
    ),
    "RuleSetData": ("version_id", "rebar_ratios", "params"),
    "ChainResult": ("candidates_by_family", "questions", "conventions", "frame", "storeys"),
}
"""C4's types and their fields, in C4's order."""

DEFAULTS: dict[tuple[str, str], object] = {
    ("FactSpec", "core"): False,
    ("Manifest", "milestone"): "M1",
    ("ElementCandidate", "judgements"): 0,
    ("ElementCandidate", "geometry"): None,
    ("OwnedSolid", "holes"): (),
}
"""The only defaults C4 gives."""

UNSPECIFIED = {"Primitive", "LineDraft"}
"""Listed by field name only: C4 does not say which fields are required (but `Primitive.kind`)."""

REQUIRED = [
    (name, field)
    for name, fields in FIELDS.items()
    for field in fields
    if (name, field) not in DEFAULTS
    and (name not in UNSPECIFIED or (name, field) == ("Primitive", "kind"))
]


@pytest.mark.parametrize("name", list(FIELDS))
def test_each_c4_type_is_a_frozen_dataclass_with_exactly_c4s_fields_in_order(name: str) -> None:
    held = getattr(types(), name)

    assert dataclasses.is_dataclass(held), f"{name} is not a dataclass"
    params: typing.Any = getattr(held, "__dataclass_params__", None)
    assert getattr(params, "frozen", False), f"{name} is not frozen"
    assert tuple(field.name for field in dataclasses.fields(held)) == FIELDS[name]


@pytest.mark.parametrize("name", list(FIELDS))
def test_each_c4_type_constructs_with_its_fields(name: str) -> None:
    values = _samples()[name]

    made = getattr(types(), name)(**values)

    for field, value in values.items():
        assert getattr(made, field) is value or getattr(made, field) == value, (name, field)
    with pytest.raises(dataclasses.FrozenInstanceError):
        setattr(made, FIELDS[name][0], values[FIELDS[name][0]])


@pytest.mark.parametrize(("name", "field"), REQUIRED, ids=[f"{n}.{f}" for n, f in REQUIRED])
def test_each_c4_type_refuses_a_missing_required_field(name: str, field: str) -> None:
    values = {key: value for key, value in _samples()[name].items() if key != field}

    with pytest.raises(TypeError, match=re.escape(f"'{field}'")):
        getattr(types(), name)(**values)


@pytest.mark.parametrize(("name", "field"), list(DEFAULTS), ids=[f"{n}.{f}" for n, f in DEFAULTS])
def test_c4s_defaults_are_its_only_defaults(name: str, field: str) -> None:
    [held] = [f for f in dataclasses.fields(getattr(types(), name)) if f.name == field]

    assert held.default == DEFAULTS[(name, field)], (name, field, held.default)


def test_a_view_artefact_must_be_given_its_view_and_its_placement() -> None:
    """C4: "`ViewArtefact.view` is required and `placement` is a `PlacedView`" (A6)."""
    fields = {f.name: f for f in dataclasses.fields(types().ViewArtefact)}

    for name in ("view", "placement"):
        assert fields[name].default is dataclasses.MISSING, f"ViewArtefact.{name} has a default"
        assert fields[name].default_factory is dataclasses.MISSING, f"ViewArtefact.{name} has a default"


def _args(alias: typing.Any) -> set[typing.Any]:
    value = getattr(alias, "__value__", alias)  # a `type At = ...` alias holds its union in __value__
    return set(typing.get_args(value))


def test_at_is_one_of_the_three_forms_never_any() -> None:
    """C4: "`at` is one of the three forms, never `Any`": `At = GridPoint | GridSegment | PolygonAt`."""
    t = types()

    assert _args(t.At) == {t.GridPoint, t.GridSegment, t.PolygonAt}


def _kinds(annotation: typing.Any) -> set[str]:
    if isinstance(annotation, type) and issubclass(annotation, enum.Enum):
        return {str(member.value) for member in annotation}
    value = getattr(annotation, "__value__", annotation)
    return {str(arg) for arg in typing.get_args(value)}


def test_a_primitive_is_a_prism_a_cylinder_or_a_sloped_prism_only() -> None:
    hints = typing.get_type_hints(types().Primitive)

    assert _kinds(hints["kind"]) == {"prism", "cylinder", "sloped_prism"}


def test_a_storey_facts_basis_is_read_typed_or_derived() -> None:
    hints = typing.get_type_hints(types().StoreyFact)

    assert _kinds(hints["basis"]) == {"read", "typed", "derived"}
