"""The family package contract's types (docs/plans/M1.md C4, frozen by M1-00; A1).

Every type is a frozen dataclass with exactly C4's fields, in C4's order. A field has a default only
where C4 gives one: `FactSpec.core`, `Manifest.milestone`, `ElementCandidate.judgements`,
`ElementCandidate.geometry` and `OwnedSolid.holes`; every other field is given. Lengths are in drawing
units on the read side (`ElementCandidate` and its `values`) and SI decimals from `ElementFacts` on;
never a float.

A family's three functions take and give only these:

    def recognise(views: Sequence[ViewArtefact], confirmed: ConfirmedFacts, setup: ProjectSetup,
                  profile: ProfileParts | None) -> Recognised: ...
    def geometry(facts: ElementFacts, owned: OwnedSolid) -> tuple[Primitive, ...]: ...
    def measure(facts: ElementFacts, owned: OwnedSolid, rules: RuleSetData) -> tuple[LineDraft, ...]: ...
"""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from engine.read.anchor import DwgAnchor, PdfAnchor
    from engine.read.artefact import ReadArtefact
    from engine.recognise.types import ViewCandidate

type Point = tuple[Decimal, Decimal]
"""A point (x, y)."""

type Polygon = tuple[Point, ...]
"""A closed outline, its last point not repeating its first."""

type Anchor = DwgAnchor | PdfAnchor
"""Where a fact was read (`engine/read/anchor.py`), serialised as C7's anchor JSON."""

type CandidateGeometry = Polygon
"""A candidate's outline as drawn, in drawing units in the registered grid's frame. C4 names the type
and nothing more; the first family that draws one may widen it in its own PR."""


@dataclass(frozen=True)
class FactSpec:
    """One fact a family reads: `FactSpec("vx.column.section_b", "dimension")`."""

    key: str
    kind: str
    core: bool = False


@dataclass(frozen=True)
class Manifest:
    """What a family is: its key, Part, Takeoff Step, identity rule, IFC class and classification,
    the facts it reads and the views it reads them from."""

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
    view_kinds: tuple[str, ...]  # the view kinds it reads: ("plan",)
    reads_steps: tuple[str, ...]  # the Step 1 CoverageSteps that admit a view: ("grid", "columns")
    milestone: str = "M1"


# Where a candidate is: drawing units, in the registered grid's frame (C1's three forms).


@dataclass(frozen=True)
class GridPoint:
    """At a grid intersection (`ref` "B/2") and an offset from it: piles, columns."""

    ref: str
    offset: tuple[Decimal, Decimal]


@dataclass(frozen=True)
class GridSegment:
    """Along grid line `on` from line `from_` to line `to`, offset across it: beams, walls, slab
    edges."""

    on: str
    from_: str
    to: str
    offset: Decimal


@dataclass(frozen=True)
class PolygonAt:
    """An outline measured from the registered origin: slabs, pile caps."""

    points: Polygon


type At = GridPoint | GridSegment | PolygonAt
"""One of the three forms, never `Any` (in the slice an untyped `at` reached the inspector as a list)."""


@dataclass(frozen=True)
class FactValue:
    """One value read for a fact: the number in `unit`, and its `text` verbatim, as drawn."""

    value: Decimal
    unit: str
    text: str


@dataclass(frozen=True)
class ElementCandidate:
    """One Element a family proposes: the view it was read on (after C5's merge, the governing view),
    where it is, and its values in drawing units with every view's anchors per fact."""

    family: str
    candidate_key: str
    view_id: str
    sheet_id: str
    storey: str | None
    band: tuple[str, str] | None
    mark: str
    at: At
    values: Mapping[str, FactValue]
    anchors: Mapping[str, tuple[Anchor, ...]]
    source: str
    confidence: Decimal
    judgements: int = 0
    geometry: CandidateGeometry | None = None


@dataclass(frozen=True)
class JudgementRequest:
    """A call the family cannot make alone and asks Jev (or the QS) to make."""

    code: str
    params: Mapping[str, str]
    candidate_key: str | None
    anchors: tuple[Anchor, ...]


@dataclass(frozen=True)
class ConventionProposal:
    """A Drafting Profile part the family proposes from what it read ("families.column.layers")."""

    part: str
    value: object
    evidence: tuple[Anchor, ...]


@dataclass(frozen=True)
class QuestionRaised:
    """A Question for the QS: one per (code, group_key) per Building (C10), holding `blocks`."""

    code: str
    params: Mapping[str, str]
    kind: str  # C10's Question kind
    group_key: str
    blocks: tuple[str, ...]  # the candidate keys it holds
    anchors: tuple[Anchor, ...]


@dataclass(frozen=True)
class Recognised:
    """What a family's `recognise` returns."""

    candidates: tuple[ElementCandidate, ...]
    judgements: tuple[JudgementRequest, ...]
    conventions: tuple[ConventionProposal, ...]
    questions: tuple[QuestionRaised, ...]


@dataclass(frozen=True)
class StoreyFact:
    """A storey as Step 3 confirmed it (C19): its key, the name on screen, its order and levels (m)."""

    key: str
    name: str
    order: int
    slab_level_m: Decimal | None
    height_m: Decimal | None
    basis: Literal["read", "typed", "derived"]


@dataclass(frozen=True)
class GridLine:
    """One registered grid line: its label, its direction and its offset from the origin."""

    label: str
    angle_deg: Decimal
    offset: Decimal


@dataclass(frozen=True)
class RegisteredGrid:
    """The confirmed grid: the origin intersection (two labels) and every line, in drawing units."""

    origin: tuple[str, str]
    lines: tuple[GridLine, ...]
    drawing_unit: str


@dataclass(frozen=True)
class PlacedView:
    """Where a view's paper box sits in model space: its model box, the 2D affine from paper to model
    (six terms), its scale and the drawing unit."""

    model_box: tuple[Point, Point]
    paper_to_model: tuple[Decimal, ...]
    scale: Decimal
    drawing_unit: str


@dataclass(frozen=True)
class Unplaced:
    """A view that cannot be placed; C5 raises `engine.view.not_placed` once for it."""

    reason: str


@dataclass(frozen=True)
class ViewArtefact:
    """One Step-1-confirmed, placed view a family reads. `view` is required (never None) and
    `placement` is a `PlacedView` (A6); `storeys` come from C19's ViewPlacementStorey rows."""

    view_id: str
    sheet_id: str
    artefact: ReadArtefact
    view: ViewCandidate
    placement: PlacedView
    storeys: tuple[str, ...]
    steps: tuple[str, ...]  # its confirmed Step 1 CoverageSteps


@dataclass(frozen=True)
class ElementFacts:
    """A confirmed Element's facts: SI decimals, by Attribute key."""

    family: str
    element_id: str
    mark: str
    storey: str | None
    band: tuple[str, str] | None
    grid_ref: str | None
    x_m: Decimal
    y_m: Decimal
    rotation: Decimal
    values: Mapping[str, Decimal | str]


@dataclass(frozen=True)
class ConfirmedFacts:
    """What earlier Steps confirmed that a later family reads: Elements, the grid and the storeys."""

    facts: tuple[ElementFacts, ...]
    frame: RegisteredGrid | None
    storeys: tuple[StoreyFact, ...]


@dataclass(frozen=True)
class ProjectSetup:
    """The Project's setup a family reads: the drawing unit and the storeys."""

    drawing_unit: str
    storeys: tuple[StoreyFact, ...]


@dataclass(frozen=True)
class ProfileParts:
    """A confirmed Drafting Profile inside the engine: a frozen view of C6's JSON (its loader is
    `engine/families/profile.py`, M1-10a's)."""

    parts: Mapping[str, object]


@dataclass(frozen=True)
class OwnedSolid:
    """The solid an Element owns after the junction rules: an outline (m) from z0 to z1 (m)."""

    polygon: Polygon
    z0: Decimal
    z1: Decimal
    holes: tuple[Polygon, ...] = ()


type PrimitiveKind = Literal["prism", "cylinder", "sloped_prism"]


@dataclass(frozen=True)
class Primitive:
    """One of three kinds only, SI decimals: `prism(polygon, holes, z0, z1)`, `cylinder(centre, radius,
    z0, z1)` and `sloped_prism(polygon, z0_at, z1_at)`; the fields a kind does not use are None."""

    kind: PrimitiveKind
    polygon: Polygon | None
    holes: tuple[Polygon, ...] | None
    z0: Decimal | None
    z1: Decimal | None
    centre: Point | None
    radius: Decimal | None
    z0_at: tuple[Decimal, ...] | None
    z1_at: tuple[Decimal, ...] | None


@dataclass(frozen=True)
class LineDraft:
    """C11's Measurement Line as a family drafts it: SI, never a float."""

    qty_si: Decimal
    unit_si: str
    rule_codes: tuple[str, ...]
    rebar_basis: str | None
    item_code: str
    nos: int
    l_m: Decimal | None
    b_m: Decimal | None
    h_m: Decimal | None
    area_m2: Decimal | None
    diameter_mm: int | None
    assumed_split: bool
    lap: bool
    held: bool


@dataclass(frozen=True)
class RuleSetData:
    """The pinned Rule Set version's data (C11): Rebar ratios by family (kg/m3) and its params."""

    version_id: str
    rebar_ratios: Mapping[str, Decimal]
    params: Mapping[str, str]


@dataclass(frozen=True)
class ChainResult:
    """What the chain run gives (C5): every family's candidates, the Questions and conventions raised,
    the registered grid and the storeys."""

    candidates_by_family: Mapping[str, tuple[ElementCandidate, ...]]
    questions: tuple[QuestionRaised, ...]
    conventions: tuple[ConventionProposal, ...]
    frame: RegisteredGrid | None
    storeys: tuple[StoreyFact, ...]
