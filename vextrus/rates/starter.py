"""The starter Market Price set and Rate Analyses, as data (docs/plans/M1.md C12; docs/data-model.md
§3.4, "Library prices").

Source of every price: [SoR-2R] PWD Schedule of Rates 2022, 2nd Revised, Part A: Civil Works, in force
from 22 January 2026, the first zone column ("Dhaka, Mymensingh"). Each is read from
`docs/research/pwd-sor-2022-input-prices.md`, which gives its row (SL), its printed page and its PDF
page; `source_ref` repeats them as "p. <printed> / PDF <n>". A price the SoR does not print is either
derived there from printed rows (the reference says how) or is not in this set: **no figure is
written here that the research does not cite** (an empty price is "rate not entered").

Quantities per unit are PWD's own relations, as `docs/research/qs-defaults.md` §2.3 works them (per
100 cft or 100 sft, here per 1); wastage is the owner's practice default (`docs/specs/bd-defaults.md`,
"Rate Analyses"; Low). Mark-ups sit in the Estimate's layers, never in a rate (the same document), so
an item rate the SoR prints with mark-ups is entered net (printed ÷ 1.2611, qs-defaults §2.4).

What the starter Rate Analyses leave out, and why, so no rate is silently short:
- **Labour of casting, rebar work and brick soling:** the SoR prices labour per day only (research §5);
  a Labour Contract covers it (C12; not in this slice). A rate shows the materials, and the formwork's
  placing and removing of shutter.
- **Shutter hire and props for formwork:** the SoR prints no price for them (research, conclusions 6).
"""

from dataclasses import dataclass
from decimal import Decimal

STARTER_LABEL = "PWD SoR 2022 2nd Rev (Dhaka)"
"""The starter set's name: the contract's ("PWD SoR 2022 2nd Rev (Dhaka)")."""
STARTER_SOURCE = (
    "PWD Schedule of Rates 2022 (2nd Revised), Part A: Civil Works, in force 22 January 2026, "
    "Dhaka, Mymensingh column"
)
STARTER_DATE = (2026, 1, 22)
"""The edition's in-force date: (year, month, day)."""

MARKET_CODE = "BD"
"""The Market whose Library carries this set (the Bangladesh Market's code)."""


@dataclass(frozen=True)
class ResourceRow:
    code: str
    name: str
    kind: str
    unit: str
    price: Decimal | None
    source_ref: str
    group: str = ""
    in_material_schedule: bool = False
    lead_days: int | None = None


@dataclass(frozen=True)
class LineRow:
    resource: str
    kind: str
    qty: Decimal
    wastage_pct: Decimal
    source_ref: str


@dataclass(frozen=True)
class AnalysisRow:
    item_code: str
    per_unit: str
    lines: tuple[LineRow, ...]
    mix: str = ""
    dry_volume_factor: Decimal | None = None
    benchmark_ref: str = ""
    notes: str = ""


def _d(text: str) -> Decimal:
    return Decimal(text)


# Resources and their starter prices ---------------------------------------------------------------

RESOURCES: tuple[ResourceRow, ...] = (
    ResourceRow(
        "cement_opc",
        "Cement, OPC (50 kg bag)",
        "material",
        "bag",
        _d("520.00"),
        "SoR-2R C6 SL 187, p. 7 / PDF 23",
        group="Cement OPC",
        in_material_schedule=True,
    ),
    ResourceRow(
        "sand_sylhet",
        "Sand, Sylhet or coarse (F.M. 2.2)",
        "material",
        "cft",
        _d("53.80"),
        "SoR-2R C8 SL 226, p. 8 / PDF 24 (5,380 per 100 cft)",
        group="Sand",
        in_material_schedule=True,
    ),
    ResourceRow(
        "sand_local",
        "Sand, local (F.M. 1.2)",
        "material",
        "cft",
        _d("19.00"),
        "SoR-2R C8 SL 225, p. 8 / PDF 24 (1,900 per 100 cft)",
        group="Sand",
        in_material_schedule=True,
    ),
    ResourceRow(
        "sand_filling",
        "Sand, filling (F.M. 0.8)",
        "material",
        "cft",
        _d("16.70"),
        "SoR-2R C8 SL 224, p. 8 / PDF 24 (1,670 per 100 cft)",
        group="Sand",
        in_material_schedule=True,
    ),
    ResourceRow(
        "stone_chips",
        "Stone chips, 20 mm down",
        "material",
        "cft",
        _d("218.04"),
        "SoR-2R C7 SL 191, p. 7 / PDF 23 (21,804 per 100 cft)",
        group="Stone chips",
        in_material_schedule=True,
    ),
    ResourceRow(
        "brick_chips",
        "Brick chips, 20 mm down (picked jhama, broken on site)",
        "material",
        "cft",
        _d("120.20"),
        "Derived, not printed: 850 bricks per 100 cft (SoR-2R p. x / PDF 16) at C5 SL 165, "
        "p. 6 / PDF 22, plus breaking C3 SL 141, p. 5 / PDF 21",
        group="Brick chips",
        in_material_schedule=True,
    ),
    ResourceRow(
        "brick_first_class",
        "Bricks, first class",
        "material",
        "nos",
        _d("13.00"),
        "SoR-2R C5 SL 165, p. 6 / PDF 22 (13,000 per 1,000)",
        group="Bricks",
        in_material_schedule=True,
    ),
    ResourceRow(
        "rebar_500w",
        "Rebar, Grade 500 (500 MPa)",
        "material",
        "kg",
        _d("87.00"),
        "SoR-2R C10 SL 290, p. 10 / PDF 26 (87,000 per M. ton, as printed)",
        group="Rebar",
        in_material_schedule=True,
    ),
    ResourceRow(
        "binding_wire",
        "Binding wire (G.I. wire)",
        "material",
        "kg",
        _d("120.00"),
        "SoR-2R C24 SL 1940, p. 58 / PDF 74 (G.I. wire: the SoR lists no binding wire row)",
        group="Binding wire",
        in_material_schedule=True,
    ),
    ResourceRow(
        "form_oil",
        "Shutter releasing agent (form oil)",
        "material",
        "litre",
        _d("180.00"),
        "SoR-2R C7 SL 216, p. 7 / PDF 23",
        group="Form oil",
        in_material_schedule=True,
    ),
    ResourceRow(
        "labour_shutter",
        "Placing and removing shutter for formwork (labour, excluding materials)",
        "labour",
        "sft",
        _d("18.00"),
        "SoR-2R C3 SL 145, p. 5 / PDF 21",
    ),
    ResourceRow(
        "labour_excavation",
        "Earthwork in excavation, up to 1.5 m depth, 10 m lead (net of mark-ups)",
        "labour",
        "cft",
        _d("3.88"),
        "Derived: SoR-2R 02.1.2, p. 72 / PDF 88 (173 per cum printed) less mark-ups, ÷ 1.2611",
    ),
    ResourceRow(
        "labour_sand_filling",
        "Sand filling in plinth, labour (net of mark-ups)",
        "labour",
        "cft",
        _d("6.88"),
        "Derived, Low: SoR-2R 02.10.2, p. 73 / PDF 89 (1,199 per cum printed), net, less the sand",
    ),
    ResourceRow(
        "labour_pile_boring",
        "Cast-in-situ pile boring, 500 mm, rig and casing included (net of mark-ups)",
        "labour",
        "rft",
        _d("303.33"),
        "Derived: SoR-2R 09.1.3, p. 118 / PDF 134 (1,255 per metre printed) less mark-ups, ÷ 1.2611",
    ),
    ResourceRow(
        "labour_pile_head_breaking",
        "Breaking one pile head, 500 mm pile, 600 mm over-cast (net of mark-ups)",
        "labour",
        "nos",
        _d("345.18"),
        "Derived, an assumption of the pile's size: SoR-2R 09.7, p. 119 / PDF 135 (3,695 per cum "
        "printed) less mark-ups, ÷ 1.2611",
    ),
)

# Rate Analyses ------------------------------------------------------------------------------------

_QS = "qs-defaults §2.3"
_WASTE = {
    "cement_opc": _d("2"),
    "sand_sylhet": _d("5"),
    "sand_local": _d("5"),
    "sand_filling": _d("0"),
    "stone_chips": _d("3"),
    "brick_chips": _d("3"),
    "brick_first_class": _d("3"),
    "rebar_500w": _d("3"),
    "form_oil": _d("0"),
}
"""The owner's wastage defaults (bd-defaults, "Rate Analyses": cement 2 %, sand 5 %, stone and brick
chips 3 %, bricks 3 %, rebar 3 %). Low."""


def _material(resource: str, qty: str, cite: str) -> LineRow:
    return LineRow(resource, "material", _d(qty), _WASTE.get(resource, _d("0")), cite)


def _labour(resource: str, qty: str, cite: str) -> LineRow:
    return LineRow(resource, "labour", _d(qty), _d("0"), cite)


def _rcc(item_code: str, benchmark: str, element: str) -> AnalysisRow:
    """RCC 1:1.5:3 in stone chips, per cft: 21.8 bags, 40.9 cft sand F.M. 2.2 and 81.8 cft chips per
    100 cft (the dry volume 1.5 x 100 split 1 : 1.5 : 3; SoR-2R p. x / PDF 16)."""
    cite = f"{_QS} row 1 (SoR-2R p. x / PDF 16: 1.5 dry volume)"
    return AnalysisRow(
        item_code,
        "cft",
        (
            _material("cement_opc", "0.218", f"{cite}; price C6 SL 187, p. 7 / PDF 23"),
            _material("sand_sylhet", "0.409", f"{cite}; price C8 SL 226, p. 8 / PDF 24"),
            _material("stone_chips", "0.818", f"{cite}; price C7 SL 191, p. 7 / PDF 23"),
        ),
        mix="1:1.5:3",
        dry_volume_factor=_d("1.5"),
        benchmark_ref=benchmark,
        notes=f"{element}: materials only; casting labour is a Labour Contract's.",
    )


def _formwork(item_code: str, element: str) -> AnalysisRow:
    """Steel-shutter formwork, per sft: placing and removing the shutter, and form oil (0.3 litre per
    100 sft, Low; qs-defaults row 7)."""
    return AnalysisRow(
        item_code,
        "sft",
        (
            _labour("labour_shutter", "1", "SoR-2R C3 SL 145, p. 5 / PDF 21"),
            _material("form_oil", "0.003", f"{_QS} row 7 (Low); price C7 SL 216, p. 7 / PDF 23"),
        ),
        benchmark_ref="07.12.x",
        notes=f"{element}: shutter hire and props are not priced by the SoR, so not in this rate.",
    )


ANALYSES: tuple[AnalysisRow, ...] = (
    # The columns (Step 6): the three items the slice measures.
    _rcc("RCC-COL-1:1.5:3", "07.3.2", "Columns and walls"),
    _formwork("FW-COL", "Columns"),
    AnalysisRow(
        "REBAR-500W",
        "kg",
        (
            _material(
                "rebar_500w",
                "1",
                f"{_QS} row 8 (3 % cutting wastage, Low); price C10 SL 290, p. 10 / PDF 26",
            ),
            _material(
                "binding_wire",
                "0.01",
                f"{_QS} row 8 (10 kg per ton, Low); price C24 SL 1940, p. 58 / PDF 74",
            ),
        ),
        benchmark_ref="08.1.3",
        notes="Cut, bent, bound and placed; the labour is a Labour Contract's. One item for every "
        "element's Rebar.",
    ),
    # The other steps' allowance items (docs/research/tax-and-allowances.md §B.2).
    _rcc("RCC-BM-1:1.5:3", "07.3.3", "Beams"),
    _rcc("RCC-SLB-1:1.5:3", "07.3.3", "Slabs, lintels and stairs"),
    _rcc("RCC-FDN-1:1.5:3", "07.3.1", "Pile caps, grade beams, footings, raft and slab on grade"),
    _rcc("RCC-PILE-1:1.5:3", "", "Bored piles"),
    _formwork("FW-BM", "Beams"),
    _formwork("FW-SLB", "Slabs"),
    _formwork("FW-FDN", "Pile cap and grade beam sides"),
    AnalysisRow(
        "CC-1:3:6",
        "cft",
        (
            _material("cement_opc", "0.12", f"{_QS} row 6; price C6 SL 187, p. 7 / PDF 23"),
            _material("sand_local", "0.45", f"{_QS} row 6; price C8 SL 225, p. 8 / PDF 24"),
            _material("brick_chips", "0.9", f"{_QS} row 6; price derived, p. x / PDF 16"),
        ),
        mix="1:3:6",
        dry_volume_factor=_d("1.5"),
        benchmark_ref="03.4.1",
        notes="Blinding and lean concrete in brick chips; the cement is taken as OPC like the "
        "reinforced concrete's (the library does not name a type).",
    ),
    AnalysisRow(
        "EXC-EARTH",
        "cft",
        (_labour("labour_excavation", "1", "SoR-2R 02.1.2, p. 72 / PDF 88"),),
        benchmark_ref="02.1.2",
        notes="Earthwork in excavation up to 1.5 m depth, 10 m lead.",
    ),
    AnalysisRow(
        "FILL-SAND",
        "cft",
        (
            _material(
                "sand_filling",
                "1.2",
                f"{_QS} row 16 (1.20 compaction, Low); price C8 SL 224, p. 8 / PDF 24",
            ),
            _labour("labour_sand_filling", "1", "SoR-2R 02.10.2, p. 73 / PDF 89 (derived, Low)"),
        ),
        benchmark_ref="02.10.2",
        notes="Sand filling in the plinth, F.M. 0.8, in 150 mm layers.",
    ),
    AnalysisRow(
        "SOL-BRICK",
        "sft",
        (
            _material(
                "brick_first_class",
                "3",
                f"{_QS} row 17 (300 per 100 sft); price C5 SL 165, p. 6 / PDF 22",
            ),
            _material("sand_local", "0.02", f"{_QS} row 17 (Low); price C8 SL 225, p. 8 / PDF 24"),
        ),
        benchmark_ref="03.1.1",
        notes="Brick flat soling; no labour per unit is in the SoR.",
    ),
    AnalysisRow(
        "PILE-BORE",
        "rft",
        (_labour("labour_pile_boring", "1", "SoR-2R 09.1.3, p. 118 / PDF 134"),),
        benchmark_ref="09.1.3",
        notes="Boring only, with rig, casing and bentonite. The Developer's piling contract, labour "
        "only or with materials, is not in this slice (C12).",
    ),
    AnalysisRow(
        "PILE-HEAD",
        "nos",
        (_labour("labour_pile_head_breaking", "1", "SoR-2R 09.7, p. 119 / PDF 135 (derived)"),),
        benchmark_ref="09.7",
        notes="Head breaking, per pile.",
    ),
)
