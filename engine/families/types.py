"""The family package contract's types (docs/plans/M1.md C4, settled by the session-16 contract).

Every type is a frozen dataclass, keyword-constructible, its extra fields defaulted, so a family's test
builds only what it reads. Quantities are SI `Decimal`s; values read off a drawing stay in drawing
units with their verbatim text (`Value`). No layer name or label text lives here (ADR 0039).

A family package's functions:

    def recognise(views: Sequence[ViewArtefact], confirmed: ConfirmedFacts, setup: ProjectSetup,
                  profile: ProfileParts | None) -> Recognised: ...
    def geometry(facts: ElementFacts, owned: OwnedSolid) -> tuple[Primitive, ...]: ...
    def measure(facts: ElementFacts, owned: OwnedSolid, rules: RuleSetData) -> tuple[LineDraft, ...]: ...
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Literal

from engine.read.anchor import Anchor
from engine.read.artefact import ReadArtefact
from engine.recognise.types import ViewCandidate

Point = tuple[Decimal, Decimal]
"""(x, y): in drawing units on a candidate, in metres on a Primitive."""

PrimitiveKind = Literal["prism", "cylinder", "sloped_prism"]


@dataclass(frozen=True)
class FactSpec:
    """One fact a family reads: `FactSpec(key="vx.column.section_b", kind="dimension", core=False)`."""

    key: str
    kind: str = "dimension"
    core: bool = False


@dataclass(frozen=True)
class Manifest:
    """What a family is: its key, its Takeoff Step, its identity rule, its IFC class and the rest."""

    key: str  # "column"
    part: str  # "structural" | "building"
    step: str  # a TakeoffStep key: "columns"
    identity_rule: str  # "grid_point" | "grid_segment" | "axis_overlap" | "polygon_overlap" | ...
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
class Value:
    """A value read off a drawing: in drawing units (`unit`), with the verbatim text it was read from."""

    value: Decimal
    unit: str = ""
    text: str = ""


@dataclass(frozen=True)
class ViewArtefact:
    """One Step-1-confirmed view's read: its ids, the read artefact, the view and its storey."""

    view_id: str
    sheet_id: str
    artefact: ReadArtefact
    view: ViewCandidate | None = None
    storey: str | None = None


@dataclass(frozen=True)
class ConfirmedFacts:
    """The facts confirmed in earlier Takeoff Steps (the storeys, the grid), as ElementFacts."""

    facts: tuple[ElementFacts, ...] = ()


@dataclass(frozen=True)
class ProjectSetup:
    """The Project's settings a family reads; every field defaulted."""

    market: str = ""
    drawing_unit: str = ""
    storeys: tuple[Mapping[str, Any], ...] = ()


@dataclass(frozen=True)
class ProfileParts:
    """A confirmed Drafting Profile's conventions (C6), a frozen view of its JSON."""

    parts: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ElementCandidate:
    """One Element a family proposes: where it is (`at`: grid ref and offset, drawing units), its values
    (fact key to `Value`), per-fact anchors, where it came from and how sure, and candidate geometry."""

    family: str
    candidate_key: str
    storey: str | None = None
    band: str = ""
    mark: str = ""
    at: Mapping[str, Any] = field(default_factory=dict)
    values: Mapping[str, Value] = field(default_factory=dict)
    anchors: Mapping[str, Anchor] = field(default_factory=dict)
    source: str = ""
    confidence: Decimal = Decimal("1")
    geometry: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class JudgementRequest:
    """A decision a family asks Jev (or the QS) to make."""

    code: str
    params: Mapping[str, Any] = field(default_factory=dict)
    candidate_keys: tuple[str, ...] = ()
    jev_node: str = ""


@dataclass(frozen=True)
class ConventionProposal:
    """A Drafting Profile convention a family proposes (C6): its part, its value, the evidence."""

    part: str
    value: Any = None
    anchors: tuple[Anchor, ...] = ()


@dataclass(frozen=True)
class QuestionRaised:
    """A Question a family raises (`engine.column.size_not_read`), with its params and anchors."""

    code: str
    params: Mapping[str, Any] = field(default_factory=dict)
    candidate_key: str | None = None
    anchors: tuple[Anchor, ...] = ()


@dataclass(frozen=True)
class Recognised:
    """What `recognise` returns."""

    candidates: tuple[ElementCandidate, ...] = ()
    judgements: tuple[JudgementRequest, ...] = ()
    conventions: tuple[ConventionProposal, ...] = ()
    questions: tuple[QuestionRaised, ...] = ()


@dataclass(frozen=True)
class ElementFacts:
    """A confirmed (or proposed) Element's facts, as geometry and measure read them."""

    family: str
    element_id: str
    mark: str = ""
    storey: str | None = None
    values: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class OwnedSolid:
    """The solid an Element owns after junctions (C4's `junction.own`), in metres."""

    polygon: tuple[Point, ...]
    z0: Decimal
    z1: Decimal


@dataclass(frozen=True)
class Primitive:
    """One 3D primitive, SI decimals: `prism(polygon, holes, z0, z1)`, `cylinder(centre, radius, z0,
    z1)` or `sloped_prism(polygon, z0_at, z1_at)`; the fields a kind does not use stay defaulted."""

    kind: PrimitiveKind
    polygon: tuple[Point, ...] = ()
    holes: tuple[tuple[Point, ...], ...] = ()
    z0: Decimal | None = None
    z1: Decimal | None = None
    centre: Point | None = None
    radius: Decimal | None = None
    z0_at: tuple[Decimal, ...] = ()
    z1_at: tuple[Decimal, ...] = ()


@dataclass(frozen=True)
class LineDraft:
    """One Measurement Line a family drafts: an SI quantity, its unit and the rule codes behind it."""

    qty_si: Decimal
    unit_si: str
    rule_codes: tuple[str, ...] = ()
    rebar_basis: str | None = None
    item_code: str = ""
    element_id: str = ""


@dataclass(frozen=True)
class RuleSetData:
    """The Rule Set's data a family measures with: rebar ratios by family, kg/m3."""

    rebar_ratios: Mapping[str, Decimal] = field(default_factory=dict)
