"""The family package contract's types (docs/plans/M1.md C4; the session-16 contract's seams).

Every type is a frozen dataclass, keyword-constructible, its extra fields defaulted so a family's test
builds one with only what it reads. Lengths are in drawing units on the read side (`ElementCandidate`,
its `values`) and SI decimals once confirmed (`ElementFacts` onward); never a float.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from engine.read.artefact import ReadArtefact
    from engine.recognise.types import ViewCandidate

Point = tuple[Decimal, Decimal]
"""A point (x, y)."""

Polygon = tuple[Point, ...]
"""A closed outline, its last point not repeating its first."""


@dataclass(frozen=True)
class FactSpec:
    """One fact a family reads: `FactSpec(key="vx.column.section_b", kind="dimension", core=False)`."""

    key: str
    kind: str
    core: bool = False


@dataclass(frozen=True)
class Manifest:
    """What a family is: its key, Part, Takeoff Step, identity rule, IFC class and classification."""

    key: str  # "column"
    part: str  # "structural" | "building"
    step: str  # a Takeoff Step key: "columns"
    identity_rule: str  # "grid_point" | "grid_segment" | "axis_overlap" | ... | "label"
    ifc_class: str
    ifc_predefined_type: str
    classification: tuple[tuple[str, str], ...]  # (system, code): ("uniclass2015", "EF_20_10")
    facts: tuple[FactSpec, ...]
    rule_codes: tuple[str, ...]
    jev_nodes: tuple[str, ...]
    conventions: tuple[str, ...]  # the profile parts it proposes: "families.column.layers"
    n_rule: str  # "marks_x_view_storeys" | "symbols" | "labels_plus_code" | "none"
    stage: str  # the default construction stage: "piling" | "slab_casting" | ...
    milestone: str = "M1"


@dataclass(frozen=True)
class FactValue:
    """One value read for a fact: the number (`value`, in `unit`) and the text it was read from."""

    value: Decimal
    unit: str = ""
    text: str = ""


@dataclass(frozen=True)
class ElementCandidate:
    """One Element a family proposes from a view: its values in drawing units, verbatim text kept."""

    family: str
    candidate_key: str
    storey: str | None = None
    band: str | None = None
    mark: str = ""
    at: Any = None  # the grid ref and offset in drawing units
    values: Mapping[str, FactValue] = field(default_factory=dict)
    anchors: Mapping[str, Any] = field(default_factory=dict)  # fact -> DwgAnchor | PdfAnchor
    source: str = ""
    confidence: Decimal = Decimal(1)
    geometry: Any = None


@dataclass(frozen=True)
class JudgementRequest:
    """A call the family cannot make alone and asks Jev (or the QS) to make."""

    code: str
    params: Mapping[str, Any] = field(default_factory=dict)
    candidate_key: str | None = None
    anchors: tuple[Any, ...] = ()


@dataclass(frozen=True)
class ConventionProposal:
    """A Drafting Profile part the family proposes from what it read ("families.column.layers")."""

    part: str
    value: Any = None
    evidence: tuple[Any, ...] = ()


@dataclass(frozen=True)
class QuestionRaised:
    """A Question for the QS: a message code and its params ("engine.column.size_not_read")."""

    code: str
    params: Mapping[str, Any] = field(default_factory=dict)
    candidate_key: str | None = None
    anchors: tuple[Any, ...] = ()


@dataclass(frozen=True)
class Recognised:
    """What `recognise` returns."""

    candidates: tuple[ElementCandidate, ...] = ()
    judgements: tuple[JudgementRequest, ...] = ()
    conventions: tuple[ConventionProposal, ...] = ()
    questions: tuple[QuestionRaised, ...] = ()


@dataclass(frozen=True)
class ElementFacts:
    """A confirmed Element's facts, SI decimals."""

    family: str
    element_id: str
    mark: str = ""
    storey: str | None = None
    values: Mapping[str, Any] = field(default_factory=dict)
    grid_ref: str | None = None


@dataclass(frozen=True)
class OwnedSolid:
    """The solid an Element owns after the junction rules: an outline (m) from z0 to z1 (m)."""

    polygon: Polygon
    z0: Decimal
    z1: Decimal
    holes: tuple[Polygon, ...] = ()


PrimitiveKind = Literal["prism", "cylinder", "sloped_prism"]


@dataclass(frozen=True)
class Primitive:
    """One of three kinds only: `prism(polygon, holes, z0, z1)`, `cylinder(centre, radius, z0, z1)`,
    `sloped_prism(polygon, z0_at, z1_at)`. SI decimals."""

    kind: PrimitiveKind
    polygon: Polygon = ()
    holes: tuple[Polygon, ...] = ()
    z0: Decimal | None = None
    z1: Decimal | None = None
    centre: Point | None = None
    radius: Decimal | None = None
    z0_at: tuple[Decimal, ...] = ()
    z1_at: tuple[Decimal, ...] = ()


@dataclass(frozen=True)
class LineDraft:
    """A Measurement Line as a family drafts it (C11's fields), SI, never a float."""

    qty_si: Decimal
    unit_si: str
    rule_codes: tuple[str, ...] = ()
    rebar_basis: str | None = None
    item_code: str = ""
    nos: int = 1
    l_m: Decimal | None = None
    b_m: Decimal | None = None
    h_m: Decimal | None = None
    area_m2: Decimal | None = None
    diameter_mm: int | None = None
    assumed_split: bool = False
    lap: bool = False
    held: bool = False


@dataclass(frozen=True)
class RuleSetData:
    """The pinned Rule Set's data a family's `measure` reads: Rebar ratios by family (kg/m3), params."""

    rebar_ratios: Mapping[str, Decimal] = field(default_factory=dict)
    params: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ViewArtefact:
    """One Step-1-confirmed view: its ReadArtefact, the recognised view and the storey it is placed on."""

    view_id: str
    sheet_id: str
    artefact: ReadArtefact
    view: ViewCandidate | None = None
    storey: str | None = None


@dataclass(frozen=True)
class ConfirmedFacts:
    """The facts confirmed in earlier Steps (the storeys, the grid) a later family reads."""

    facts: tuple[ElementFacts, ...] = ()


@dataclass(frozen=True)
class ProjectSetup:
    """The Project's setup a family reads: the drawing unit and the storeys."""

    drawing_unit: str = "mm"
    storeys: tuple[Mapping[str, Any], ...] = ()
    params: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProfileParts:
    """A confirmed Drafting Profile inside the engine: a frozen view of C6's JSON."""

    parts: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path) -> ProfileParts:
        return cls(parts=json.loads(path.read_text(encoding="utf-8")))

    def get(self, part: str, default: Any = None) -> Any:
        return self.parts.get(part, default)
