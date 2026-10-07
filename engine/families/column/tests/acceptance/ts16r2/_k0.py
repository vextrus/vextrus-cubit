"""The one place these tests build and read K0's types (`engine/families/types.py`, docs/plans/M1.md C4).

C4 names the types but not their fields; every field name these tests assume is here, so a correction
after K0 lands touches this file only. Readers of a value accept the shapes C4's words allow (a bare
value, or one carrying its verbatim text).
"""

from collections.abc import Mapping
from decimal import Decimal
from pathlib import Path

from engine.families.types import (  # type: ignore[import-not-found, unused-ignore]
    ConfirmedFacts,
    ElementCandidate,
    ElementFacts,
    LineDraft,
    OwnedSolid,
    ProjectSetup,
    RuleSetData,
    ViewArtefact,
)
from engine.read import read


def plan_view(dwg: Path, storey: str) -> ViewArtefact:
    """A plan view of one storey: the whole model space of a DWG read through M0's reader."""
    return ViewArtefact(view_id="V1", sheet_id="S1", storey=storey, artefact=read(dwg))


def grid_line(mark: str, axis: str, offset: str) -> ElementFacts:
    """A confirmed grid line (session 16's contract: `values` hold `axis` and `offset`)."""
    return ElementFacts(
        family="grid_line",
        element_id=f"grid-{mark}",
        mark=mark,
        storey="",
        values={"axis": axis, "offset": Decimal(offset)},
    )


def confirmed(*facts: ElementFacts) -> ConfirmedFacts:
    return ConfirmedFacts(facts=tuple(facts))


def setup() -> ProjectSetup:
    return ProjectSetup()


def column(b_m: str, d_m: str) -> ElementFacts:
    """A confirmed column, its section in metres (C4's Units rule: SI inside the product)."""
    return ElementFacts(
        family="column",
        element_id="col-C1",
        mark="C1",
        storey="floor_1",
        values={"section_b": Decimal(b_m), "section_d": Decimal(d_m)},
    )


def owned(b_m: str, d_m: str, z0_m: str, z1_m: str) -> OwnedSolid:
    """The column's owned solid after the junction: its section from z0 to z1 (metres)."""
    b, d = Decimal(b_m), Decimal(d_m)
    zero = Decimal(0)
    polygon = ((zero, zero), (b, zero), (b, d), (zero, d))
    return OwnedSolid(polygon=polygon, z0=Decimal(z0_m), z1=Decimal(z1_m))


def rules(column_ratio_kg_per_m3: str) -> RuleSetData:
    """A Rule Set holding a column Rebar Ratio in kg/m3."""
    return RuleSetData(rebar_ratios={"column": Decimal(column_ratio_kg_per_m3)})


def value_of(candidate: ElementCandidate, key: str) -> Decimal:
    """A candidate's named value as a Decimal (a bare value, or one carrying `value`)."""
    held: object = candidate.values[key]
    inner = held.get("value") if isinstance(held, Mapping) else getattr(held, "value", held)
    assert not isinstance(inner, float), f"{key} is a float: {inner!r}"
    return Decimal(str(inner))


def verbatim_of(candidate: ElementCandidate, key: str) -> str:
    """The verbatim text a candidate kept for a named value."""
    held: object = candidate.values[key]
    for name in ("text", "verbatim"):
        found = held.get(name) if isinstance(held, Mapping) else getattr(held, name, None)
        if isinstance(found, str):
            return found
    raise AssertionError(f"{key} keeps no verbatim text: {held!r}")


def grid_ref_of(candidate: ElementCandidate) -> str:
    """The grid ref in a candidate's `at` (C4: "the grid ref and offset")."""
    at: object = candidate.at
    if isinstance(at, str):
        return at.split()[0].split("+")[0]
    if isinstance(at, tuple):
        return str(at[0])
    for name in ("grid_ref", "ref"):
        found = at.get(name) if isinstance(at, Mapping) else getattr(at, name, None)
        if isinstance(found, str):
            return found
    raise AssertionError(f"no grid ref in at: {at!r}")


def quantity_of(line: LineDraft) -> Decimal:
    qty: object = line.qty_si
    assert not isinstance(qty, float), f"qty_si is a float: {qty!r}"
    return Decimal(str(qty))
