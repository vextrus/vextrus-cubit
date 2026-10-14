"""M1-00, the contract freeze: "`StateChange`, `Snapshot` (C7) and `MeasurementLine` (C11) as types"
(docs/plans/M1.md, M1-00), with C7's and C11's fields.

The plan names no module for them, only the services that take and give them: `live_model.services`'
`apply(building_id, confirmation_id, changes: Sequence[StateChange], *, cause)` and
`snapshot(building_id, seq=None) -> Snapshot` (C7), with `StateChange.trace: tuple[TraceEntry, ...]`; and
`measurement.services.preview(...) -> tuple[MeasurementLine, ...]` (C11). So each is looked up on the
services package that names it.
"""

import dataclasses
import importlib
import typing

import pytest

STATE_CHANGE = (
    "element_key",
    "family",
    "mark",
    "grid_ref",
    "x_m",
    "y_m",
    "rotation",
    "storey_id",
    "band_from_id",
    "band_to_id",
    "mix",
    "grade",
    "rebar_basis",
    "construction_stage",
    "attrs",
    "trace",
    "retire",
)
"""C7: `StateChange(element_key, family, mark, grid_ref, x_m, y_m, rotation, storey_id, band_from_id,
band_to_id, mix, grade, rebar_basis, construction_stage, attrs: Mapping[str, str],
trace: tuple[TraceEntry, ...], retire: bool)`. The typed core never travels in `attrs`."""

TRACE_ENTRY = ("fact", "kind", "anchor", "question_id")
"""C7: "A `TraceEntry` is `{fact, kind, anchor | null, question_id | null}`"."""

SNAPSHOT = ("building_id", "seq", "figures_hash", "elements")
"""C7: "`Snapshot(building_id, seq, figures_hash, elements)`"."""

MEASUREMENT_LINE = {
    "item_code",
    "element_id",
    "mark",
    "storey",
    "storey_id",
    "rule_codes",
    "nos",
    "l_m",
    "b_m",
    "h_m",
    "area_m2",
    "qty_si",
    "unit_si",
    "rebar_basis",
    "diameter_mm",
    "assumed_split",
    "lap",
    "held",
    "trace",
}
"""C11's Measurement Line, its JSON's keys (A8: it carries its Element's mark, storey_id and trace)."""


def held(package: str, name: str) -> typing.Any:
    module = importlib.import_module(package)
    assert hasattr(module, name), f"{package} has no attribute '{name}'"
    return getattr(module, name)


def field_names(kind: typing.Any) -> tuple[str, ...]:
    """A type's fields, in order: a dataclass's, a pydantic (Ninja) schema's, or a typed dict's."""
    if dataclasses.is_dataclass(kind):
        return tuple(field.name for field in dataclasses.fields(kind))
    model_fields = getattr(kind, "model_fields", None)
    if isinstance(model_fields, dict):
        return tuple(model_fields)
    return tuple(typing.get_type_hints(kind))


@pytest.mark.parametrize(
    ("package", "name", "fields"),
    [
        ("vextrus.live_model.services", "StateChange", STATE_CHANGE),
        ("vextrus.live_model.services", "TraceEntry", TRACE_ENTRY),
        ("vextrus.live_model.services", "Snapshot", SNAPSHOT),
    ],
    ids=["StateChange", "TraceEntry", "Snapshot"],
)
def test_the_live_model_type_has_exactly_c7s_fields(
    package: str, name: str, fields: tuple[str, ...]
) -> None:
    assert set(field_names(held(package, name))) == set(fields)


def test_a_measurement_line_has_c11s_fields() -> None:
    found = set(field_names(held("vextrus.measurement.services", "MeasurementLine")))

    assert found >= MEASUREMENT_LINE, f"MeasurementLine lacks {sorted(MEASUREMENT_LINE - found)}"
