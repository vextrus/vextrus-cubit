"""F-RCC6-BNBC — the authored building, as plain data (the one source; E-fixture §3.2–3.3).

A fictional G+6 residential building, "Proposed G+6 storied residential building at Plot 23, Road 7,
Block C, Bashundhara R/A, Dhaka", by a fictional consultant. Every dimension is authored in feet-inches
(1" = 25.4 mm exactly, so Decimal stays exact) or in whole millimetres. Nothing here derives geometry
for drawing and nothing here imports an emitter: `build()` returns one dict of members, bars, panels,
openings and conventions; golden.py and golden_check.py read that dict and nothing else.

Junction ownership (AM-02 default, DECISIONS.md): pile > pile cap > column / shear wall (floor-to-floor,
through joints) > beam (clear between support faces, depth below the slab soffit) > slab (runs through;
outline − column/wall plan areas − openings > 0.1 m²). No volume has two owners.
"""

from __future__ import annotations

from decimal import Decimal, getcontext
from itertools import pairwise
from typing import Any

getcontext().prec = 34
D = Decimal
PI = D("3.141592653589793238462643383279")
IN = D("25.4")


def ft(feet: int | str, inches: int | str = 0) -> Decimal:
    return (D(feet) * 12 + D(inches)) * IN


def sqrt(v: Decimal) -> Decimal:
    return v.sqrt()


def shoelace(poly: list[tuple[Decimal, Decimal]]) -> Decimal:
    s = D(0)
    for i, (x0, y0) in enumerate(poly):
        x1, y1 = poly[(i + 1) % len(poly)]
        s += x0 * y1 - x1 * y0
    return abs(s) / 2


def perimeter(poly: list[tuple[Decimal, Decimal]]) -> Decimal:
    s = D(0)
    for i, (x0, y0) in enumerate(poly):
        x1, y1 = poly[(i + 1) % len(poly)]
        s += sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
    return s


def count_at(distance: Decimal, spacing: Decimal) -> int:
    """L-FRM-05 counting rule ⌊(distance + 0.5 mm)/spacing⌋ + 1."""
    return (
        int(((distance + D("0.5")) / spacing).to_integral_value(rounding="ROUND_FLOOR"))
        + 1
    )


# ---------------------------------------------------------------------------------------------
# Grid, levels, materials, detailing values as the drawings state them (S-01/S-02)
# ---------------------------------------------------------------------------------------------

X = {"1": D(0), "2": ft(15), "3": ft(29), "4": ft(38), "5": ft(52), "6": ft(67)}
Y = {"A": D(0), "B": ft(16), "C": ft(29), "D": ft(37), "E": ft(52)}
XN = ["1", "2", "3", "4", "5", "6"]
YL = ["A", "B", "C", "D", "E"]
SUBGRID = {
    "2'": X["2"] + ft(4)
}  # half-landing beam LB1 (see DECISIONS.md D-01: 2' not C')
CHAMFER = (
    (D(0), ft(43)),
    (ft(9), ft(52)),
)  # skew grid 1a through the rear corner E-1 (45°)

ELEV = {
    "PILE_TOE": ft(-6) - ft(70),
    "PILE_CUT": ft(-6),
    "PCTOP": ft(-2),
    "GF": D(0),
    "1F": ft(11),
    "2F": ft(21),
    "3F": ft(31),
    "4F": ft(41),
    "5F": ft(51),
    "6F": ft(61),
    "ROOF": ft(71),
    "SRR": ft(80),
    "OHWT": ft(86),
}
STOREYS = ["FDN", "GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF"]
STOREY_TOP = {
    "FDN": "GF",
    "GF": "1F",
    "1F": "2F",
    "2F": "3F",
    "3F": "4F",
    "4F": "5F",
    "5F": "6F",
    "6F": "ROOF",
    "ROOF": "SRR",
}
STOREY_BOTTOM_ELEV = {"FDN": ELEV["PCTOP"], **{s: ELEV[s] for s in STOREYS[1:]}}


def storey_height(storey: str) -> Decimal:
    return ELEV[STOREY_TOP[storey]] - STOREY_BOTTOM_ELEV[storey]


FLOORS = ["1F", "2F", "3F", "4F", "5F", "6F", "ROOF"]  # framed floors
TYPICAL = ["2F", "3F", "4F", "5F", "6F"]

GRADE = {
    "default": "C3500PSI",
    "pile": "C3000PSI",
}  # f'c 3500 psi (24 MPa) / piles 3000 psi
FY = "500W"  # BDS ISO 6935-2 B500DWR — stated as fy = 500 MPa (72,500 psi) on S-01
COVER = {
    "BEAM": D(25),
    "COLUMN": D(40),
    "WALL": D(20),
    "SLAB": D(20),
    "FOOTING": D(75),
    "PILE_CAP": D(75),
    "PILE": D(75),
    "STAIR": D(20),
    "LINTEL": D(25),
    "TANK": D(30),
}
LAP_T = 50  # × d  (S-02 general note; overrides the BNBC table — J-032)
LAP_C = 40
LD = 50  # × d  bottom / straight bars (S-02 table, fy 500 f'c 3500 row authored on the sheet)
LD_TOP = 65  # × d  top bars ×1.3
HOOK_90 = 12  # × d
HOOK_135 = 10  # × d, min 75 mm (S-03 typical detail; DECISIONS.md AM-03 stirrup hook)
STOCK = D(12000)
OPENING_THRESHOLD_MM2 = D(100000)  # 0.1 m²
END_NO_DEDUCT_MM2 = D(50000)  # 500 cm² member-end contact threshold
KG_PER_M = {
    8: D("0.395"),
    10: D("0.616"),
    12: D("0.888"),
    16: D("1.579"),
    20: D("2.466"),
    25: D("3.854"),
}
SITE = {  # site.json — SITE facts (L-MEA-06) entered by the fixture as its own drawing states them
    "egl_mm": str(ft(-1, 6)),
    "working_allowance_mm": str(ft(1, 6)),
    "depth_extra_mm": str(ft(0, 6)),
    "blinding_projection_mm": str(ft(0, 3)),
    "blinding_thickness_mm": str(ft(0, 3)),
    "sog_blinding_thickness_mm": "75",
}


def bend_radius(dia: int) -> Decimal:
    return D(dia) * (D(2) if dia <= 16 else D("3.5"))


# ---------------------------------------------------------------------------------------------
# Member catalogue
# ---------------------------------------------------------------------------------------------

# Column marks: bands (storeys) × (b, d) mm × main bars × ties. d is the dimension along the column's
# "depth axis" (perpendicular to the edge it sits on). Steel ratio 1–4 % (selfcheck).
BANDS = [
    ("GF-2F", ["FDN", "GF", "1F", "2F"]),
    ("3F-4F", ["3F", "4F"]),
    ("5F-6F", ["5F", "6F"]),
    ("ROOF-SRR", ["ROOF"]),
]
COLUMN_MARKS: dict[str, dict[str, Any]] = {
    "C1": {
        "bands": [(400, 400, 8, 16), (350, 350, 8, 16), (300, 300, 8, 16)],
        "ties": (10, 100, 150),
    },
    "C2": {
        "bands": [(300, 600, 10, 20), (300, 500, 8, 20), (300, 400, 8, 16)],
        "ties": (10, 100, 150),
    },
    "C3": {
        "bands": [(300, 500, 8, 20), (300, 400, 8, 16), (300, 350, 6, 16)],
        "ties": (10, 100, 150),
    },
    "C4": {
        "bands": [
            (450, 600, 12, 25),
            (400, 500, 10, 25),
            (350, 450, 8, 20),
            (300, 375, 6, 16),
        ],
        "ties": (10, 100, 150),
        "cross_ties": 2,
    },
    "C5": {
        "bands": [(300, 450, 8, 20), (300, 450, 8, 20), (300, 450, 6, 20)],
        "ties": (10, 100, 150),
    },
    "C6": {
        "bands": [(300, 500, 8, 20), (300, 400, 8, 16), (300, 350, 6, 16)],
        "ties": (10, 100, 150),
    },
    "C7": {"bands": [(450, 450, 8, 20)], "ties": (10, 100, 100), "circular": True},
}
BAR_AREA = {16: D("201.0619"), 20: D("314.1593"), 25: D("490.8739")}


# stacks: (id, mark, x, y, outer direction (ox, oy) for face-flush tapering, depth axis 'x'|'y', rot)
def _stacks() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    corner = {("A", "1"): (-1, -1), ("A", "6"): (1, -1), ("E", "6"): (1, 1)}
    for (yl, xn), o in corner.items():
        out.append(
            {
                "id": f"{yl}{xn}",
                "mark": "C1",
                "x": X[xn],
                "y": Y[yl],
                "outer": o,
                "axis": "y",
                "storeys": STOREYS[:8],
            }
        )
    for xn in ["2", "3", "4", "5"]:
        out.append(
            {
                "id": f"A{xn}",
                "mark": "C2",
                "x": X[xn],
                "y": Y["A"],
                "outer": (0, -1),
                "axis": "y",
                "storeys": STOREYS[:8],
            }
        )
        out.append(
            {
                "id": f"E{xn}",
                "mark": "C2",
                "x": X[xn],
                "y": Y["E"],
                "outer": (0, 1),
                "axis": "y",
                "storeys": STOREYS[:8],
            }
        )
    for yl in ["B", "C", "D"]:
        out.append(
            {
                "id": f"{yl}1",
                "mark": "C3",
                "x": X["1"],
                "y": Y[yl],
                "outer": (-1, 0),
                "axis": "x",
                "storeys": STOREYS[:8],
            }
        )
        out.append(
            {
                "id": f"{yl}6",
                "mark": "C3",
                "x": X["6"],
                "y": Y[yl],
                "outer": (1, 0),
                "axis": "x",
                "storeys": STOREYS[:8],
            }
        )
    for yl, xn in [
        ("B", "2"),
        ("B", "3"),
        ("B", "5"),
        ("C", "2"),
        ("C", "5"),
        ("D", "2"),
        ("D", "5"),
    ]:
        st = STOREYS[:8] + (["ROOF"] if (yl, xn) in (("C", "2"), ("D", "2")) else [])
        out.append(
            {
                "id": f"{yl}{xn}",
                "mark": "C4",
                "x": X[xn],
                "y": Y[yl],
                "outer": (0, 0),
                "axis": "y",
                "storeys": st,
            }
        )
    out.append(
        {
            "id": "B4",
            "mark": "C5",
            "x": X["4"],
            "y": Y["B"],
            "outer": (0, 0),
            "axis": "y",
            "storeys": STOREYS[2:8],
            "floating_on": "TG1",
        }
    )
    # C6: off-grid, rotated 45°, centred 300 mm inside the chamfer midpoint (normal (−1, 1)/√2)
    mx, my = (CHAMFER[0][0] + CHAMFER[1][0]) / 2, (CHAMFER[0][1] + CHAMFER[1][1]) / 2
    n = D(300) / sqrt(D(2))
    out.append(
        {
            "id": "C6X",
            "mark": "C6",
            "x": mx + n,
            "y": my - n,
            "outer": (0, 0),
            "axis": "n",
            "rot_deg": 45,
            "storeys": STOREYS[:8],
        }
    )
    out.append(
        {
            "id": "C7X",
            "mark": "C7",
            "x": ft(45),
            "y": ft(-10),
            "outer": (0, 0),
            "axis": "y",
            "storeys": ["FDN", "GF"],
            "porch": True,
        }
    )
    return out


def _band_index(mark: str, storey: str) -> int:
    for i, (_, storeys) in enumerate(BANDS):
        if storey in storeys:
            return min(i, len(COLUMN_MARKS[mark]["bands"]) - 1)
    raise KeyError(storey)


def column_rect(stack: dict[str, Any], storey: str) -> dict[str, Decimal]:
    """Plan extents at a storey: bands taper with the outer face flush (band-1 face)."""
    mark = COLUMN_MARKS[stack["mark"]]
    bi = _band_index(stack["mark"], storey)
    b0, d0 = D(mark["bands"][0][0]), D(mark["bands"][0][1])
    b, d = D(mark["bands"][bi][0]), D(mark["bands"][bi][1])
    if stack["axis"] == "y":
        sx, sy, sx0, sy0 = b, d, b0, d0
    else:
        sx, sy, sx0, sy0 = d, b, d0, b0
    ox, oy = stack["outer"]
    # the outer face stays where band 1 put it, so the centre moves toward the outer side by half the step
    cx = stack["x"] + ox * (sx0 - sx) / 2
    cy = stack["y"] + oy * (sy0 - sy) / 2
    return {"cx": cx, "cy": cy, "sx": sx, "sy": sy, "b": b, "d": d}


def column_poly(stack: dict[str, Any], storey: str) -> list[tuple[Decimal, Decimal]]:
    """Plan polygon of a column at a storey (the 45° column rotated about its centre)."""
    r = column_rect(stack, storey)
    hx, hy = r["sx"] / 2, r["sy"] / 2
    corners = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
    if stack.get("rot_deg"):
        hx, hy = r["d"] / 2, r["b"] / 2  # local depth axis along the chamfer (1, 1)/√2
        s2 = D(1) / sqrt(D(2))
        corners = [
            ((x - y) * s2, (x + y) * s2)
            for x, y in [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
        ]
    return [(r["cx"] + x, r["cy"] + y) for x, y in corners]


# Beam sections (b × overall D, main bars, stirrups): "typical" grid beams are 250×450 (10"×18"),
# long-line perimeter beams 300×600 (12"×24"), transfer girder TG1 400×900.
BEAM_TYPES: dict[str, dict[str, Any]] = {
    "T": {
        "b": 250,
        "D": 450,
        "bot": (3, 16),
        "bot_x": (2, 16),
        "top": (2, 16),
        "top_x": (2, 20),
        "st": (10, 100, 150),
        "legs": 2,
    },
    "L": {
        "b": 300,
        "D": 600,
        "bot": (3, 20),
        "bot_x": (2, 20),
        "top": (3, 16),
        "top_x": (3, 20),
        "st": (10, 100, 150),
        "legs": 2,
    },
    "TG": {
        "b": 400,
        "D": 900,
        "bot": (4, 25),
        "bot_x": (2, 25),
        "top": (4, 25),
        "top_x": (2, 25),
        "st": (12, 100, 100),
        "legs": 4,
    },
    "CB": {
        "b": 250,
        "D": 450,
        "D2": 300,
        "bot": (2, 16),
        "bot_x": (0, 16),
        "top": (3, 20),
        "top_x": (2, 20),
        "st": (10, 100, 100),
        "legs": 2,
    },
    "EB": {
        "b": 250,
        "D": 300,
        "bot": (3, 16),
        "bot_x": (0, 16),
        "top": (3, 16),
        "top_x": (0, 16),
        "st": (10, 150, 150),
        "legs": 2,
    },
    "SB": {
        "b": 250,
        "D": 400,
        "bot": (3, 16),
        "bot_x": (0, 16),
        "top": (2, 16),
        "top_x": (2, 16),
        "st": (10, 100, 150),
        "legs": 2,
    },
    "LB": {
        "b": 250,
        "D": 375,
        "bot": (3, 16),
        "bot_x": (0, 16),
        "top": (2, 16),
        "top_x": (2, 16),
        "st": (10, 100, 150),
        "legs": 2,
    },
    "CPL": {
        "b": 250,
        "D": 600,
        "bot": (3, 20),
        "bot_x": (0, 20),
        "top": (3, 20),
        "top_x": (0, 20),
        "st": (10, 100, 100),
        "legs": 2,
    },
    "R": {
        "b": 250,
        "D": 400,
        "bot": (3, 16),
        "bot_x": (0, 16),
        "top": (2, 16),
        "top_x": (2, 16),
        "st": (10, 100, 150),
        "legs": 2,
    },
    "S": {
        "b": 250,
        "D": 375,
        "bot": (3, 16),
        "bot_x": (0, 16),
        "top": (2, 16),
        "top_x": (2, 16),
        "st": (10, 100, 150),
        "legs": 2,
    },
    "PB": {
        "b": 300,
        "D": 600,
        "bot": (3, 20),
        "bot_x": (2, 20),
        "top": (3, 20),
        "top_x": (2, 20),
        "st": (10, 100, 150),
        "legs": 2,
    },
    "GB1": {
        "b": 300,
        "D": 600,
        "bot": (3, 20),
        "bot_x": (0, 20),
        "top": (3, 20),
        "top_x": (0, 20),
        "st": (10, 150, 150),
        "legs": 2,
    },
    "GB2": {
        "b": 250,
        "D": 450,
        "bot": (3, 16),
        "bot_x": (0, 16),
        "top": (3, 16),
        "top_x": (0, 16),
        "st": (10, 150, 150),
        "legs": 2,
    },
    "GB3": {
        "b": 250,
        "D": 450,
        "bot": (3, 16),
        "bot_x": (0, 16),
        "top": (3, 16),
        "top_x": (0, 16),
        "st": (10, 150, 150),
        "legs": 2,
    },
    "GB4": {
        "b": 250,
        "D": 375,
        "bot": (2, 16),
        "bot_x": (0, 16),
        "top": (2, 16),
        "top_x": (0, 16),
        "st": (10, 150, 150),
        "legs": 2,
    },
    "GB5": {
        "b": 300,
        "D": 750,
        "bot": (4, 20),
        "bot_x": (0, 20),
        "top": (4, 20),
        "top_x": (0, 20),
        "st": (10, 150, 150),
        "legs": 2,
    },
    "LT1": {
        "b": 250,
        "D": 150,
        "bot": (2, 12),
        "bot_x": (0, 12),
        "top": (2, 12),
        "top_x": (0, 12),
        "st": (8, 150, 150),
        "legs": 2,
    },
    "LT2": {
        "b": 250,
        "D": 200,
        "bot": (2, 12),
        "bot_x": (0, 12),
        "top": (2, 12),
        "top_x": (0, 12),
        "st": (8, 150, 150),
        "legs": 2,
    },
    "LS1": {
        "b": 250,
        "D": 200,
        "bot": (2, 12),
        "bot_x": (0, 12),
        "top": (2, 12),
        "top_x": (0, 12),
        "st": (8, 150, 150),
        "legs": 2,
        "sunshade": (600, 75),
    },
}

# Slab types
SLAB_T = {
    "S": 125,
    "SL": 150,
    "S10": 125,
    "CS1": (150, 100),
    "SS1": 125,
    "SOG": 125,
    "RAMP": 125,
    "R": 125,
    "SRR": 125,
    "MRR": 150,
    "PS1": 125,
    "FL": 150,
    "OHWT-B": 200,
    "OHWT-T": 100,
    "UG-B": 250,
    "UG-T": 150,
    "ST-B": 200,
    "ST-T": 125,
}
SLAB_BARS = {
    125: (10, 150),
    150: (12, 150),
    200: (12, 125),
    250: (16, 150),
    100: (10, 150),
}

PILE = {
    "dia": 500,
    "length": ft(70),
    "main_full": (4, 20),
    "main_curtailed": (3, 20, D(12000)),
    "spiral": (10, 75, D(3000), 150),
    "embed": ft(0, 3),
}
CAP_DEPTH = ft(4, 3)
CAPS: dict[str, dict[str, Any]] = {
    # plan is authored as a polygon (mm) about the column centre; piles at (dx, dy)
    "PC1": {
        "poly": [(-1000, -500), (1000, -500), (1000, 500), (-1000, 500)],
        "piles": [(-750, 0), (750, 0)],
        "mesh": (16, 150),
        "top": (12, 200),
    },
    "PC2": {
        "poly": [
            (-1000, -650),
            (1000, -650),
            (1200, -300),
            (1200, 300),
            (1000, 650),
            (-1000, 650),
        ][:0]
        or [
            (-1050, -650),
            (1050, -650),
            (1050, 350),
            (500, 1100),
            (-500, 1100),
            (-1050, 350),
        ],
        "piles": [(-750, -350), (750, -350), (0, 850)],
        "mesh": (16, 150),
        "top": (12, 200),
    },
    "PC3": {
        "poly": [(-1000, -1000), (1000, -1000), (1000, 1000), (-1000, 1000)],
        "piles": [(-750, -750), (750, -750), (750, 750), (-750, 750)],
        "mesh": (16, 125),
        "top": (12, 200),
    },
    "PC4": {
        "poly": [(-1300, -1300), (1300, -1300), (1300, 1300), (-1300, 1300)],
        "piles": [(-1050, -1050), (1050, -1050), (1050, 1050), (-1050, 1050), (0, 0)],
        "mesh": (20, 125),
        "top": (12, 200),
    },
    "PC5": {
        "poly": [(-1750, -1750), (1750, -1750), (1750, 1750), (-1750, 1750)],
        "piles": [(dx, dy) for dy in (-1500, 0, 1500) for dx in (-1500, 0, 1500)],
        "mesh": (20, 125),
        "top": (16, 150),
    },
}
CAP_OF = {
    "C1": "PC1",
    "C6": "PC1",
    "C2": "PC2",
    "C3": "PC2",
    "C4": "PC3",
    "CORE": "PC5",
}
PC4_STACKS = {"B3", "B5"}
FOOTING_F1 = {"l": 1500, "b": 1500, "depth": 450, "mesh": (12, 150)}
CORE = {
    "x0": X["3"],
    "x1": X["4"],
    "y0": Y["C"],
    "y1": Y["D"],
    "t_low": D(250),
    "t_high": D(200),
    "door": (D(900), D(2100)),
    "pit_bottom": ft(-5),
    "pit_slab": D(300),
}
CORE_CENTRE = ((CORE["x0"] + CORE["x1"]) / 2, (CORE["y0"] + CORE["y1"]) / 2)
STAIR = {
    "x0": X["2"],
    "x1": X["3"],
    "y0": Y["C"],
    "y1": Y["D"],
    "width": ft(3, 6),
    "well": ft(1),
    "landing": ft(4),
    "tread": D(250),
    "waist": D(150),
    "landing_t": D(150),
    "risers": {"GF": 20, "1F": 18, "2F": 18, "3F": 18, "4F": 18, "5F": 18, "6F": 18},
    "bars": (12, 125),
    "dist": (8, 200),
}
BALCONY = {"x0": X["2"], "x1": X["6"], "depth": ft(5), "r": ft(5)}
OHWT = {
    "lx": 3658,
    "ly": 2438,
    "h": 1829,
    "base": 200,
    "wall": 150,
    "top": 100,
    "manhole": (600, 600),
}
UGWR = {
    "x0": ft(15),
    "y0": ft(-25),
    "lx": 4877,
    "ly": 2438,
    "h": 2438,
    "base": 250,
    "wall": 200,
    "top": 150,
    "manholes": 2,
    "bottom": ft(-9),
}
SEPTIC = {
    "x0": ft(50),
    "y0": ft(-25),
    "lx": 3658,
    "ly": 1524,
    "chambers": 2,
    "h": 1829,
    "base": 200,
    "wall": 200,
    "top": 125,
    "baffle": 125,
    "bottom": ft(-8),
}
PARAPET = {"t": 100, "h": ft(3, 6), "bars": ((10, 200), (8, 250))}
RAMP = {
    "x0": X["4"],
    "x1": X["5"],
    "y0": Y["A"],
    "y1": Y["A"] + ft(12),
    "rise": ft(1, 6),
}  # 1:8 → run 12'-0"
SUNKEN = [
    (X["1"] + 600, Y["B"] + 600),
    (X["6"] - 600 - 2438, Y["B"] + 600),
    (X["1"] + 600, Y["D"] + 600),
    (X["6"] - 600 - 2438, Y["D"] + 600),
]
SUNKEN_SIZE = (D(2438), D(1524))
SUNKEN_DROP = D(300)
DUCTS = [(X["2"] + 300, Y["B"] + 300), (X["5"] - 300 - 600, Y["D"] + 300)]
DUCT_SIZE = (D(600), D(1200))
SLEEVES = [
    (X["1"] + 2000, Y["A"] + 2000),
    (X["1"] + 2000, Y["D"] + 500),
    (X["6"] - 2200, Y["A"] + 2000),
    (X["6"] - 2200, Y["D"] + 500),
]
SLEEVE_SIZE = (D(150), D(150))


# ---------------------------------------------------------------------------------------------
# The build: member instances, plan regions per level, openings, and the authored bars
# ---------------------------------------------------------------------------------------------

SQRT2 = sqrt(D(2))
ZERO = D(0)
ONE = D(1)
EDGE_HALF = D(125)  # edge beams are 250 wide; the slab outline runs to their outer face


def outline(level: str) -> list[tuple[Decimal, Decimal]]:
    """Slab plate outline at a framed floor: the grid box to the edge-beam outer faces, the E-1 chamfer
    offset outward by 125, and the front balcony (grids 2–6, curved at A-6) from 1F up. The curved
    corner is authored analytically (see balcony_area); the outline polygon uses the corner point."""
    x0, x1, y0, y1 = -EDGE_HALF, X["6"] + EDGE_HALF, -EDGE_HALF, Y["E"] + EDGE_HALF
    c = ft(43) + EDGE_HALF * SQRT2  # offset chamfer line x − y + c = 0
    poly = [(x0, y0)]
    if level in FLOORS and level != "ROOF":
        poly += [(X["2"], y0), (X["2"], -BALCONY["depth"]), (x1, -BALCONY["depth"])]
    else:
        poly += [(x1, y0)]
    poly += [(x1, y1), (y1 - c, y1), (x0, x0 + c)]
    return poly


def balcony_corner_cut() -> Decimal:
    """Area removed from the square balcony corner by the R 1524 curve: r² − πr²/4."""
    r = BALCONY["r"]
    return r * r - PI * r * r / 4


class Build:
    def __init__(self) -> None:
        self.members: list[dict[str, Any]] = []
        self.bars: list[dict[str, Any]] = []
        self.regions: dict[str, list[dict[str, Any]]] = {}
        self.stacks = _stacks()
        self.by_id: dict[str, dict[str, Any]] = {}

    # -- helpers ------------------------------------------------------------------------------
    def add(self, **m: Any) -> dict[str, Any]:
        assert m["id"] not in self.by_id, m["id"]
        self.members.append(m)
        self.by_id[m["id"]] = m
        return m

    def bar(
        self,
        member: dict[str, Any],
        bmark: str,
        dia: int,
        shape: str,
        legs: list[Decimal],
        n: int,
        role: str,
        lap_count: int = 0,
        lap_mult: int = LAP_T,
    ) -> None:
        if n <= 0:
            return
        self.bars.append(
            {
                "member": member["id"],
                "class": member["class"],
                "level": member["level"],
                "mark": member["mark"],
                "bar_mark": bmark,
                "dia": dia,
                "shape": shape,
                "legs": [D(v) for v in legs],
                "n": n,
                "role": role,
                "lap_mm": D(dia) * lap_mult,
                "lap_count": lap_count,
            }
        )

    def stirrups(
        self,
        m: dict[str, Any],
        b: Decimal,
        depth: Decimal,
        dia: int,
        s_end: int,
        s_mid: int,
        clear: Decimal,
        legs: int,
        bmark: str,
        cover: Decimal,
    ) -> None:
        a, bb, hook = b - 2 * cover, depth - 2 * cover, max(D(HOOK_135 * dia), D(75))
        end_zone = 2 * depth
        if clear <= 2 * end_zone + D(200):
            n = count_at(clear - D(100), D(s_end))
        else:
            n = 2 * count_at(end_zone, D(s_end)) + count_at(
                clear - 2 * end_zone - D(100), D(s_mid)
            )
        self.bar(m, bmark, dia, "51", [a, bb, a, bb, hook, hook], n, "STIRRUP")
        if legs == 4:
            self.bar(
                m,
                bmark + "i",
                dia,
                "51",
                [a / 2, bb, a / 2, bb, hook, hook],
                n,
                "STIRRUP",
            )

    # -- foundations --------------------------------------------------------------------------
    def foundations(self) -> None:
        pile_no = 0
        self.cap_rects: dict[str, tuple[Decimal, Decimal, Decimal, Decimal]] = {}
        groups = [
            (
                s["id"],
                s["x"],
                s["y"],
                CAP_OF[s["mark"]] if s["id"] not in PC4_STACKS else "PC4",
            )
            for s in self.stacks
            if not s.get("porch") and not s.get("floating_on")
        ]
        groups.append(("CORE", CORE_CENTRE[0], CORE_CENTRE[1], "PC5"))
        for gid, cx, cy, cap in groups:
            spec = CAPS[cap]
            poly = [(cx + D(px), cy + D(py)) for px, py in spec["poly"]]
            if (
                gid == "C6X"
            ):  # the chamfer cap follows the column: rotate 45° about the centre
                poly = [
                    (cx + (D(px) - D(py)) / SQRT2, cy + (D(px) + D(py)) / SQRT2)
                    for px, py in spec["poly"]
                ]
            xs, ys = [p[0] for p in poly], [p[1] for p in poly]
            self.cap_rects[gid] = (min(xs), min(ys), max(xs), max(ys))
            m = self.add(
                id=f"PC-{gid}",
                **{"class": "PILE_CAP"},
                mark=cap,
                level="FDN",
                geom="PRISM_POLY",
                poly=poly,
                depth=CAP_DEPTH,
                area=shoelace(poly),
                perim=perimeter(poly),
                n_piles=len(spec["piles"]),
                top=ELEV["PCTOP"],
                grade=GRADE["default"],
            )
            piles = []
            for px, py in spec["piles"]:
                pile_no += 1
                ppx, ppy = (
                    (cx + D(px), cy + D(py))
                    if gid != "C6X"
                    else (cx + (D(px) - D(py)) / SQRT2, cy + (D(px) + D(py)) / SQRT2)
                )
                piles.append(f"P{pile_no}")
                self.add(
                    id=f"P{pile_no}",
                    **{"class": "PILE"},
                    mark="P",
                    level="PILE",
                    geom="CYL",
                    cap=m["id"],
                    x=ppx,
                    y=ppy,
                    dia=D(PILE["dia"]),
                    length=PILE["length"],
                    grade=GRADE["pile"],
                )
            m["piles"] = piles
            self.cap_bars(m, spec)
        for p in [x for x in self.members if x["class"] == "PILE"]:
            self.pile_bars(p)
        # isolated footing F1 under the porch column C7
        s = next(s for s in self.stacks if s.get("porch"))
        f = FOOTING_F1
        poly = [
            (s["x"] - D(f["l"]) / 2, s["y"] - D(f["b"]) / 2),
            (s["x"] + D(f["l"]) / 2, s["y"] - D(f["b"]) / 2),
            (s["x"] + D(f["l"]) / 2, s["y"] + D(f["b"]) / 2),
            (s["x"] - D(f["l"]) / 2, s["y"] + D(f["b"]) / 2),
        ]
        self.cap_rects["C7X"] = (poly[0][0], poly[0][1], poly[2][0], poly[2][1])
        m = self.add(
            id="F1",
            **{"class": "FOOTING"},
            mark="F1",
            level="FDN",
            geom="PRISM_RECT",
            poly=poly,
            l=D(f["l"]),
            b=D(f["b"]),
            depth=D(f["depth"]),
            area=shoelace(poly),
            perim=perimeter(poly),
            top=ELEV["PCTOP"],
            grade=GRADE["default"],
        )
        self.mesh(m, "F1-b", f["mesh"], D(f["l"]), D(f["b"]), COVER["FOOTING"])
        self.bar(
            m, "F1-s", 12, "00", [4 * (D(f["l"]) - 2 * COVER["FOOTING"])], 1, "SIDE"
        )

    def mesh(
        self,
        m: dict[str, Any],
        bmark: str,
        spec: tuple[int, int],
        lx: Decimal,
        ly: Decimal,
        cover: Decimal,
    ) -> None:
        dia, s = spec
        hook = D(HOOK_90 * dia)
        self.bar(
            m,
            bmark + "x",
            dia,
            "21",
            [hook, lx - 2 * cover, hook],
            count_at(ly - 2 * cover, D(s)),
            "MAIN",
        )
        self.bar(
            m,
            bmark + "y",
            dia,
            "21",
            [hook, ly - 2 * cover, hook],
            count_at(lx - 2 * cover, D(s)),
            "MAIN",
        )

    def cap_bars(self, m: dict[str, Any], spec: dict[str, Any]) -> None:
        x0, y0, x1, y1 = self.cap_rects[m["id"][3:]]
        c = COVER["PILE_CAP"]
        self.mesh(m, f"{m['mark']}-b", spec["mesh"], x1 - x0, y1 - y0, c)
        self.mesh(m, f"{m['mark']}-t", spec["top"], x1 - x0, y1 - y0, c)
        self.bar(m, f"{m['mark']}-s", 12, "00", [m["perim"] - 8 * c], 3, "SIDE")

    def pile_bars(self, p: dict[str, Any]) -> None:
        n_full, d_full = PILE["main_full"]
        n_cut, d_cut, l_cut = PILE["main_curtailed"]
        proj = D(40 * d_full)  # dowel projection into the cap (40d compression)
        self.bar(
            p,
            "P-m1",
            d_full,
            "00",
            [PILE["length"] + PILE["embed"] + proj],
            n_full,
            "MAIN",
        )
        self.bar(p, "P-m2", d_cut, "00", [l_cut + PILE["embed"] + proj], n_cut, "MAIN")
        sd, p1, z1, p2 = PILE["spiral"]
        dc = D(PILE["dia"]) - 2 * COVER["PILE"]
        turns1, turns2 = count_at(z1, D(p1)), count_at(PILE["length"] - z1, D(p2))
        per1, per2 = (
            sqrt((PI * dc) ** 2 + D(p1) ** 2),
            sqrt((PI * dc) ** 2 + D(p2) ** 2),
        )
        self.bar(p, "P-sp1", sd, "SP", [turns1 * per1], 1, "SPIRAL")
        self.bar(p, "P-sp2", sd, "SP", [turns2 * per2], 1, "SPIRAL")

    # -- columns and the core ---------------------------------------------------------------
    def columns(self) -> None:
        for s in self.stacks:
            spec = COLUMN_MARKS[s["mark"]]
            for storey in s["storeys"]:
                r = column_rect(s, storey)
                bi = _band_index(s["mark"], storey)
                _, _, nbar, dbar = spec["bands"][bi]
                h = storey_height(storey)
                m = self.add(
                    id=f"COL:{s['id']}@{storey}",
                    **{"class": "COLUMN"},
                    mark=s["mark"],
                    level=storey,
                    stack=s["id"],
                    geom="CYL" if spec.get("circular") else "PRISM_RECT",
                    cx=r["cx"],
                    cy=r["cy"],
                    sx=r["sx"],
                    sy=r["sy"],
                    b=r["b"],
                    d=r["d"],
                    h=h,
                    rot=s.get("rot_deg", 0),
                    band=BANDS[bi][0],
                    nbar=nbar,
                    dbar=dbar,
                    beam_ends=[],
                    t_top=D(0),
                    grade=GRADE["default"],
                )
                c = COVER["COLUMN"]
                if (
                    storey == "FDN"
                ):  # dowels: cap depth − cover + neck + one lap, 90° hooked foot
                    self.bar(
                        m,
                        f"{s['mark']}-d",
                        dbar,
                        "11",
                        [CAP_DEPTH - COVER["PILE_CAP"] + h, D(HOOK_90 * dbar)],
                        nbar,
                        "MAIN",
                        lap_count=1,
                    )
                else:
                    self.bar(
                        m, f"{s['mark']}-v", dbar, "00", [h], nbar, "MAIN", lap_count=1
                    )
                td, s_end, s_mid = spec["ties"]
                clear = h - D(450)
                lo = max(r["sx"], r["sy"], clear / 6, D(450))
                n_ties = (
                    2 * count_at(lo, D(s_end))
                    + count_at(max(clear - 2 * lo, D(0)), D(s_mid))
                    + count_at(D(450), D(s_end))
                )
                hook = max(D(HOOK_135 * td), D(75))
                if spec.get("circular"):
                    dc = r["b"] - 2 * c
                    self.bar(
                        m,
                        f"{s['mark']}-sp",
                        td,
                        "SP",
                        [count_at(h, D(s_mid)) * sqrt((PI * dc) ** 2 + D(s_mid) ** 2)],
                        1,
                        "SPIRAL",
                    )
                else:
                    self.bar(
                        m,
                        f"{s['mark']}-t",
                        td,
                        "51",
                        [
                            r["b"] - 2 * c,
                            r["d"] - 2 * c,
                            r["b"] - 2 * c,
                            r["d"] - 2 * c,
                            hook,
                            hook,
                        ],
                        n_ties,
                        "TIE",
                    )
                    if spec.get("cross_ties"):
                        self.bar(
                            m,
                            f"{s['mark']}-ct",
                            td,
                            "CT",
                            [r["d"] - 2 * c, hook, hook],
                            n_ties * spec["cross_ties"],
                            "TIE",
                        )
        # SW1: C-shaped core, legs on grids 3, 4 (C–D) and D (3–4); door face on C with coupling beam
        for storey in STOREYS:
            t = CORE["t_low"] if storey in ("FDN", "GF", "1F", "2F") else CORE["t_high"]
            h = storey_height(storey)
            legs = [
                (
                    "3",
                    CORE["x0"] - t / 2,
                    CORE["y0"],
                    CORE["x0"] + t / 2,
                    CORE["y1"] + t / 2,
                ),
                (
                    "4",
                    CORE["x1"] - t / 2,
                    CORE["y0"],
                    CORE["x1"] + t / 2,
                    CORE["y1"] + t / 2,
                ),
                (
                    "D",
                    CORE["x0"] + t / 2,
                    CORE["y1"] - t / 2,
                    CORE["x1"] - t / 2,
                    CORE["y1"] + t / 2,
                ),
            ]
            for leg, x0, y0, x1, y1 in legs:
                length = (x1 - x0) if leg == "D" else (y1 - y0)
                m = self.add(
                    id=f"SW1-{leg}@{storey}",
                    **{"class": "SHEAR_WALL"},
                    mark="SW1",
                    level=storey,
                    geom="PRISM_RECT",
                    x0=x0,
                    y0=y0,
                    x1=x1,
                    y1=y1,
                    t=t,
                    length=length,
                    h=h,
                    beam_ends=[],
                    t_top=D(0),
                    openings=[],
                    grade=GRADE["default"],
                )
                c = COVER["WALL"]
                self.bar(
                    m,
                    "SW1-v",
                    12,
                    "00",
                    [h],
                    2 * count_at(length - 2 * c, D(150)),
                    "MAIN",
                    lap_count=1,
                )
                self.bar(
                    m,
                    "SW1-h",
                    10,
                    "11",
                    [length - 2 * c, D(HOOK_90 * 10)],
                    2 * count_at(h - D(100), D(150)),
                    "HORIZONTAL",
                )
        # lift pit: walls below PCTOP on all four sides and the pit slab
        t, hp = CORE["t_low"], ELEV["PCTOP"] - CORE["pit_bottom"]
        for leg, x0, y0, x1, y1 in [
            (
                "3",
                CORE["x0"] - t / 2,
                CORE["y0"] - t / 2,
                CORE["x0"] + t / 2,
                CORE["y1"] + t / 2,
            ),
            (
                "4",
                CORE["x1"] - t / 2,
                CORE["y0"] - t / 2,
                CORE["x1"] + t / 2,
                CORE["y1"] + t / 2,
            ),
            (
                "C",
                CORE["x0"] + t / 2,
                CORE["y0"] - t / 2,
                CORE["x1"] - t / 2,
                CORE["y0"] + t / 2,
            ),
            (
                "D",
                CORE["x0"] + t / 2,
                CORE["y1"] - t / 2,
                CORE["x1"] - t / 2,
                CORE["y1"] + t / 2,
            ),
        ]:
            length = (x1 - x0) if leg in "CD" else (y1 - y0)
            m = self.add(
                id=f"PIT-{leg}",
                **{"class": "SHEAR_WALL"},
                mark="PIT",
                level="PIT",
                geom="PRISM_RECT",
                x0=x0,
                y0=y0,
                x1=x1,
                y1=y1,
                t=t,
                length=length,
                h=hp,
                beam_ends=[],
                t_top=D(0),
                openings=[],
                grade=GRADE["default"],
            )
            self.bar(
                m,
                "PIT-v",
                12,
                "11",
                [hp + CORE["pit_slab"] - D(50), D(HOOK_90 * 12)],
                2 * count_at(length - D(40), D(150)),
                "MAIN",
            )
            self.bar(
                m,
                "PIT-h",
                10,
                "11",
                [length - D(40), D(HOOK_90 * 10)],
                2 * count_at(hp - D(100), D(150)),
                "HORIZONTAL",
            )
        poly = [
            (CORE["x0"] - t / 2, CORE["y0"] - t / 2),
            (CORE["x1"] + t / 2, CORE["y0"] - t / 2),
            (CORE["x1"] + t / 2, CORE["y1"] + t / 2),
            (CORE["x0"] - t / 2, CORE["y1"] + t / 2),
        ]
        m = self.add(
            id="PIT-SLAB",
            **{"class": "SLAB"},
            mark="LPS",
            level="PIT",
            geom="AREA_THICK",
            poly=poly,
            holes=[],
            t=CORE["pit_slab"],
            area=shoelace(poly),
            col_deduct=D(0),
            beam_soffit=D(0),
            free_edge=D(0),
            grade=GRADE["default"],
        )
        self.mesh(
            m,
            "LPS-b",
            (12, 150),
            poly[1][0] - poly[0][0],
            poly[2][1] - poly[0][1],
            COVER["FOOTING"],
        )
        self.mesh(
            m,
            "LPS-t",
            (12, 150),
            poly[1][0] - poly[0][0],
            poly[2][1] - poly[0][1],
            COVER["FOOTING"],
        )

    # -- beams --------------------------------------------------------------------------------
    def support_extent(
        self,
        kind: str,
        sid: str,
        storey: str,
        pos: tuple[Decimal, Decimal],
        u: tuple[Decimal, Decimal],
    ) -> Decimal:
        """Distance from the beam's authored end point (on the grid line) to the support's real face
        toward the span: the largest projection of the support's plan polygon onto the unit direction
        `u` (pointing into the span). Face-flush bands shift a column's centre off the grid, so the
        face is never assumed at half a width (adversary finding 1)."""
        if kind == "COLUMN":
            stack = next(s for s in self.stacks if s["id"] == sid)
            if COLUMN_MARKS[stack["mark"]].get(
                "circular"
            ):  # concentric circle: the radius, any direction
                return column_rect(stack, storey)["sx"] / 2
            poly = column_poly(stack, storey)
        elif kind == "WALL":
            w = self.by_id[f"SW1-{sid}@{storey}"]
            poly = [
                (w["x0"], w["y0"]),
                (w["x1"], w["y0"]),
                (w["x1"], w["y1"]),
                (w["x0"], w["y1"]),
            ]
        elif kind == "CAP":
            poly = (
                self.by_id[f"PC-{sid}"]["poly"]
                if f"PC-{sid}" in self.by_id
                else self.by_id["F1"]["poly"]
            )
        elif kind == "BEAM":  # a beam-to-beam joint: clear to the crossing beam's face
            return D(BEAM_TYPES[self.by_id[sid]["type"]]["b"]) / 2
        else:
            return D(0)  # FREE (cantilever tip), JOINT corner
        return max((vx - pos[0]) * u[0] + (vy - pos[1]) * u[1] for vx, vy in poly)

    def resolve(self, kind: str, sid: str, level: str) -> tuple[str, str]:
        if kind == "BEAM" and sid not in self.by_id:
            sid = f"{sid}@{level}"
        return (kind, sid)

    def find_beam(
        self, level: str, p0: tuple[Decimal, Decimal], p1: tuple[Decimal, Decimal]
    ) -> str:
        return next(
            m["id"]
            for m in self.members
            if m["class"] == "BEAM"
            and m["level"] == level
            and m["p0"] == p0
            and m["p1"] == p1
        )

    def beam(
        self,
        bid: str,
        mark: str,
        btype: str,
        level: str,
        p0: tuple[Decimal, Decimal],
        p1: tuple[Decimal, Decimal],
        s0: tuple[str, str],
        s1: tuple[str, str],
        t_sides: tuple[Decimal, Decimal],
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        bt = BEAM_TYPES[btype]
        storey = next((s for s, top in STOREY_TOP.items() if top == level), "FDN")
        axis = "x" if p0[1] == p1[1] else ("y" if p0[0] == p1[0] else "s")
        length = sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2)
        if extra and "arc_len" in extra:
            length = extra["arc_len"]
        s0, s1 = (tuple(self.resolve(k, sid, level)) for k, sid in (s0, s1))
        chord = sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2)
        u0 = ((p1[0] - p0[0]) / chord, (p1[1] - p0[1]) / chord)
        u1 = (-u0[0], -u0[1])
        if extra and "end_dirs" in extra:  # curved: the tangents at the supports
            u0, u1 = extra["end_dirs"]
        e0 = self.support_extent(s0[0], s0[1], storey, p0, u0)
        e1 = self.support_extent(s1[0], s1[1], storey, p1, u1)
        clear = length - e0 - e1
        m = self.add(
            id=bid,
            **{
                "class": "TIE_BEAM"
                if btype.startswith("GB")
                else ("LINTEL" if btype.startswith("LT") or btype == "LS1" else "BEAM")
            },
            mark=mark,
            type=btype,
            level=level,
            storey=storey,
            geom="TAPER_LINEAR" if "D2" in bt else "PRISM_RECT",
            p0=p0,
            p1=p1,
            axis=axis,
            length=length,
            clear=clear,
            b=D(bt["b"]),
            depth=D(bt["D"]),
            depth2=D(bt.get("D2", bt["D"])),
            t_l=t_sides[0],
            t_r=t_sides[1],
            supports=[s0, s1],
            extents=[e0, e1],
            end_dirs=[u0, u1],
            grade=GRADE["default"],
            **{k: v for k, v in (extra or {}).items() if k != "end_dirs"},
        )
        # contact faces this beam removes from its supports' formwork (member-end threshold 500 cm²)
        for (kind, sid), depth_end in (
            (s0, D(bt["D"])),
            (s1, D(bt.get("D2", bt["D"]))),
        ):
            area = D(bt["b"]) * (depth_end - max(t_sides))
            if kind in ("COLUMN", "WALL") and area > END_NO_DEDUCT_MM2:
                key = (
                    f"COL:{sid}@{storey}" if kind == "COLUMN" else f"SW1-{sid}@{storey}"
                )
                if key in self.by_id:
                    self.by_id[key]["beam_ends"].append(area)
        self.beam_bars(m, bt)
        return m

    def beam_bars(self, m: dict[str, Any], bt: dict[str, Any]) -> None:
        c = COVER["LINTEL"] if m["class"] == "LINTEL" else COVER["BEAM"]
        ln, mk = m["clear"], m["mark"]
        n, d = bt["bot"]
        self.bar(m, f"{mk}-b", d, "00", [ln + 2 * D(LD * d)], n, "MAIN")
        n, d = bt["bot_x"]
        self.bar(m, f"{mk}-bx", d, "00", [ln / 2], n, "EXTRA_BOTTOM")
        n, d = bt["top"]
        self.bar(m, f"{mk}-t", d, "00", [ln + 2 * D(LD_TOP * d)], n, "MAIN")
        n, d = bt["top_x"]
        if n and m.get("ext_top"):
            for end, length in m["ext_top"]:
                self.bar(m, f"{mk}-tx{end}", d, "00", [length], n, "EXTRA_TOP")
        sd, s_end, s_mid = bt["st"]
        self.stirrups(
            m,
            m["b"],
            (m["depth"] + m["depth2"]) / 2,
            sd,
            s_end,
            s_mid,
            ln,
            bt["legs"],
            f"{mk}-s",
            c,
        )

    def line_beams(self, level: str, prefix: str, btype_of: Any, t_of: Any) -> None:
        """Beams along every grid line between consecutive supports, the core and chamfer handled."""
        counter = [0]

        def nxt() -> str:
            counter[0] += 1
            return f"{prefix}B{counter[0]}"

        def sup(yl: str, xn: str) -> tuple[str, str] | None:
            sid = f"{yl}{xn}"
            if yl in "CD" and xn in "34":
                return ("WALL", xn if yl == "C" or xn in "34" else yl)
            if sid == "B4" and level == "1F":
                return ("BEAM", "TG1")
            if sid == "E1":
                return None
            if any(s["id"] == sid for s in self.stacks):
                return ("COLUMN", sid)
            return None

        if level == "1F":  # TG1 first: B4 (the floating column) bears on it
            m = self.beam(
                "TG1@1F",
                "TG1",
                "TG",
                "1F",
                (X["3"], Y["B"]),
                (X["5"], Y["B"]),
                ("COLUMN", "B3"),
                ("COLUMN", "B5"),
                (t_of(X["4"], Y["B"] - 1), t_of(X["4"], Y["B"] + 1)),
                {"ext_top": [(0, (X["5"] - X["3"]) / 3), (1, (X["5"] - X["3"]) / 3)]},
            )
            m["carries"] = "B4"
        lines: list[tuple[str, list[tuple[Decimal, Decimal, tuple[str, str]]]]] = []
        for yl in YL:
            pts = [(X[xn], Y[yl], sup(yl, xn)) for xn in XN if sup(yl, xn)]
            if yl == "E":
                pts = [(CHAMFER[1][0], CHAMFER[1][1], ("JOINT", "CH2"))] + pts
            lines.append((yl, pts))
        for xn in XN:
            pts = [(X[xn], Y[yl], sup(yl, xn)) for yl in YL if sup(yl, xn)]
            if xn == "1":
                pts = pts + [(CHAMFER[0][0], CHAMFER[0][1], ("JOINT", "CH1"))]
            lines.append((xn, pts))
        for name, pts in lines:
            spans = []
            for i in range(len(pts) - 1):
                (x0, y0, s0), (x1, y1, s1) = pts[i], pts[i + 1]
                if name == "D" and x0 == X["3"] and x1 == X["4"]:
                    continue  # wall leg D
                if name in "34" and y0 == Y["C"] and y1 == Y["D"]:
                    continue  # wall legs 3 and 4
                if (
                    name == "B"
                    and level == "1F"
                    and x0 in (X["3"], X["4"])
                    and x1 in (X["4"], X["5"])
                ):
                    continue  # TG1 takes B 3–5 at 1F
                spans.append(((x0, y0), (x1, y1), s0, s1))
            self.emit_spans(level, name, spans, nxt, btype_of, t_of)
        # skew chamfer beam through C6, two spans; joints at the chamfer corners
        mid = next(s for s in self.stacks if s["id"] == "C6X")
        cx = (CHAMFER[0][0] + CHAMFER[1][0]) / 2
        cy = (CHAMFER[0][1] + CHAMFER[1][1]) / 2
        _ = mid
        self.beam(
            f"{prefix}EB2a@{level}",
            f"{prefix}EB2",
            btype_of("skew"),
            level,
            CHAMFER[0],
            (cx, cy),
            ("JOINT", "CH1"),
            ("COLUMN", "C6X"),
            (t_of(cx - 400, cy), D(0)),
        )
        self.beam(
            f"{prefix}EB2b@{level}",
            f"{prefix}EB2",
            btype_of("skew"),
            level,
            (cx, cy),
            CHAMFER[1],
            ("COLUMN", "C6X"),
            ("JOINT", "CH2"),
            (t_of(cx - 400, cy), D(0)),
        )

    def emit_spans(
        self,
        level: str,
        name: str,
        spans: list[Any],
        nxt: Any,
        btype_of: Any,
        t_of: Any,
    ) -> None:
        for i, (p0, p1, s0, s1) in enumerate(spans):
            ln = sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2)
            ext = []
            if i == 0:
                ext.append((0, ln / 3 + D(LD_TOP * 20)))
            ln_next = (
                sqrt(
                    (spans[i + 1][1][0] - spans[i + 1][0][0]) ** 2
                    + (spans[i + 1][1][1] - spans[i + 1][0][1]) ** 2
                )
                if i + 1 < len(spans)
                else None
            )
            ext.append(
                (1, ln / 3 + (ln_next / 3 if ln_next is not None else D(LD_TOP * 20)))
            )
            mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
            if p0[1] == p1[1]:
                t_sides = (t_of(mx, my - 1), t_of(mx, my + 1))
            else:
                t_sides = (t_of(mx - 1, my), t_of(mx + 1, my))
            mark = nxt()
            self.beam(
                f"{mark}@{level}",
                mark,
                btype_of(name),
                level,
                p0,
                p1,
                s0,
                s1,
                t_sides,
                {"ext_top": ext, "line": name},
            )

    # -- slabs: panels, holes, deductions ----------------------------------------------------
    def panel(
        self,
        pid: str,
        mark: str,
        level: str,
        poly: list[tuple[Decimal, Decimal]],
        t: Decimal,
        t2: Decimal | None = None,
        slope: Decimal = ONE,
        free_edge: Decimal = ZERO,
        curved_cut: Decimal = ZERO,
        sunken: bool = False,
    ) -> dict[str, Any]:
        area = shoelace(poly) - curved_cut
        return self.add(
            id=pid,
            **{"class": "SLAB"},
            mark=mark,
            level=level,
            geom="AREA_THICK" if t2 is None else "TAPER_LINEAR",
            poly=poly,
            holes=[],
            t=t,
            t2=t2 if t2 is not None else t,
            slope=slope,
            area=area,
            col_deduct=D(0),
            beam_soffit=D(0),
            free_edge=free_edge,
            sunken=sunken,
            curved_cut=curved_cut,
            grade=GRADE["default"],
        )

    @staticmethod
    def rect_overlap(
        a: tuple[Decimal, Decimal, Decimal, Decimal],
        b: tuple[Decimal, Decimal, Decimal, Decimal],
    ) -> Decimal:
        w = min(a[2], b[2]) - max(a[0], b[0])
        h = min(a[3], b[3]) - max(a[1], b[1])
        return w * h if w > 0 and h > 0 else D(0)

    @staticmethod
    def bbox(
        poly: list[tuple[Decimal, Decimal]],
    ) -> tuple[Decimal, Decimal, Decimal, Decimal]:
        return (
            min(p[0] for p in poly),
            min(p[1] for p in poly),
            max(p[0] for p in poly),
            max(p[1] for p in poly),
        )

    def floor_slabs(self, level: str) -> list[dict[str, Any]]:
        """Bay panels at a framed floor; the stair bay and core are their own regions."""
        panels: list[dict[str, Any]] = []
        roof = level == "ROOF"
        n = 0
        thick_panels = {
            (1, 1),
            (3, 1),
        }  # 150 mm in two large panels (bays 2–3 × B–C and 4–5 × B–C)
        for j in range(4):
            for i in range(5):
                if (i, j) in ((2, 2), (1, 2)):
                    continue  # core bay (3–4 × C–D) and stair bay (2–3 × C–D)
                x0, x1 = X[XN[i]], X[XN[i + 1]]
                y0, y1 = Y[YL[j]], Y[YL[j + 1]]
                if i == 0:
                    x0 -= EDGE_HALF
                if i == 4:
                    x1 += EDGE_HALF
                if j == 0 and (i == 0 or roof):
                    y0 -= EDGE_HALF
                if j == 3:
                    y1 += EDGE_HALF
                if (i, j) == (0, 3):  # chamfer bay: pentagon
                    c = ft(43) + EDGE_HALF * SQRT2
                    poly = [(x0, y0), (x1, y0), (x1, y1), (y1 - c, y1), (x0, x0 + c)]
                else:
                    poly = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
                n += 1
                mark = (
                    (f"R{n}")
                    if roof
                    else ("S10" if j == 2 else (f"S{n}" if n <= 9 else "S3"))
                )
                t = D(150) if (i, j) in thick_panels and not roof else D(125)
                panels.append(
                    self.panel(f"{mark}#{i}{j}@{level}", mark, level, poly, t)
                )
        if not roof:
            # balcony cantilever slab CS1 (150 → 100 taper), curved corner at A-6
            poly = [
                (X["2"], D(0)),
                (X["2"], -BALCONY["depth"]),
                (X["6"] + EDGE_HALF, -BALCONY["depth"]),
                (X["6"] + EDGE_HALF, D(0)),
            ]
            free = (
                (X["6"] + EDGE_HALF - X["2"])
                + BALCONY["depth"]
                + (PI * BALCONY["r"] / 2 - 2 * BALCONY["r"])
            )
            panels.append(
                self.panel(
                    f"CS1@{level}",
                    "CS1",
                    level,
                    poly,
                    D(150),
                    D(100),
                    free_edge=D(0),
                    curved_cut=balcony_corner_cut(),
                )
            )
            panels[-1]["free_edge"] = (
                free  # tip + returns, the beam-less edges, EB1 outer face is the beam's side
            )
            for k, (sx, sy) in enumerate(SUNKEN):
                poly = [
                    (sx, sy),
                    (sx + SUNKEN_SIZE[0], sy),
                    (sx + SUNKEN_SIZE[0], sy + SUNKEN_SIZE[1]),
                    (sx, sy + SUNKEN_SIZE[1]),
                ]
                panels.append(
                    self.panel(
                        f"SS1-{k + 1}@{level}", "SS1", level, poly, D(125), sunken=True
                    )
                )
            if level == "1F":
                s = next(s for s in self.stacks if s.get("porch"))
                poly = [
                    (X["4"], -BALCONY["depth"]),
                    (X["5"], -BALCONY["depth"]),
                    (s["x"], s["y"]),
                ]
                panels.append(
                    self.panel(
                        "PS1@1F",
                        "PS1",
                        "1F",
                        poly,
                        D(125),
                        free_edge=perimeter(poly) - (X["5"] - X["4"]),
                    )
                )
        return panels

    def place_holes(self, level: str, panels: list[dict[str, Any]]) -> None:
        holes: list[tuple[str, tuple[Decimal, Decimal, Decimal, Decimal]]] = []
        if level != "ROOF":
            holes += [
                ("DUCT", (x, y, x + DUCT_SIZE[0], y + DUCT_SIZE[1])) for x, y in DUCTS
            ]
            holes += [
                ("SLEEVE", (x, y, x + SLEEVE_SIZE[0], y + SLEEVE_SIZE[1]))
                for x, y in SLEEVES
            ]
            holes += [
                ("SUNKEN", (x, y, x + SUNKEN_SIZE[0], y + SUNKEN_SIZE[1]))
                for x, y in SUNKEN
            ]
        for kind, r in holes:
            host = next(
                p
                for p in panels
                if not p["sunken"]
                and self.rect_overlap(self.bbox(p["poly"]), r)
                == (r[2] - r[0]) * (r[3] - r[1])
            )
            area = (r[2] - r[0]) * (r[3] - r[1])
            host["holes"].append(
                {
                    "kind": kind,
                    "area": area,
                    "rect": r,
                    "deducted": area > OPENING_THRESHOLD_MM2 or kind == "SUNKEN",
                }
            )

    def deduct_columns(self, level: str, panels: list[dict[str, Any]]) -> None:
        storey = next(s for s, top in STOREY_TOP.items() if top == level)
        rects = []
        for s in self.stacks:
            if storey in s["storeys"] and not s.get("porch"):
                r = column_rect(s, storey)
                if s.get("rot_deg"):
                    rects.append((s["id"], None, r["b"] * r["d"], (r["cx"], r["cy"])))
                else:
                    rects.append(
                        (
                            s["id"],
                            (
                                r["cx"] - r["sx"] / 2,
                                r["cy"] - r["sy"] / 2,
                                r["cx"] + r["sx"] / 2,
                                r["cy"] + r["sy"] / 2,
                            ),
                            None,
                            None,
                        )
                    )
        t = CORE["t_low"] if storey in ("FDN", "GF", "1F", "2F") else CORE["t_high"]
        for w in [
            m
            for m in self.members
            if m["class"] == "SHEAR_WALL" and m["level"] == storey
        ]:
            rects.append((w["id"], (w["x0"], w["y0"], w["x1"], w["y1"]), None, None))
        _ = t
        for p in panels:
            bb = self.bbox(p["poly"])
            for sid, r, area, centre in rects:
                if r is not None:
                    p["col_deduct"] += self.rect_overlap(bb, r)
                elif bb[0] <= centre[0] <= bb[2] and bb[1] <= centre[1] <= bb[3]:
                    p["col_deduct"] += area

    def deduct_beam_soffits(self, level: str, panels: list[dict[str, Any]]) -> None:
        for bm in [
            m for m in self.members if m["class"] in ("BEAM",) and m["level"] == level
        ]:
            if max(bm["t_l"], bm["t_r"]) == 0:
                continue
            if bm["axis"] in "xy":
                p0, p1 = bm["p0"], bm["p1"]
                if bm["axis"] == "x":
                    lo, hi = sorted([p0[0], p1[0]])
                    r = (lo, p0[1] - bm["b"] / 2, hi, p0[1] + bm["b"] / 2)
                else:
                    lo, hi = sorted([p0[1], p1[1]])
                    r = (p0[0] - bm["b"] / 2, lo, p0[0] + bm["b"] / 2, hi)
                for p in panels:
                    p["beam_soffit"] += self.rect_overlap(self.bbox(p["poly"]), r)
            else:
                mx, my = (
                    (bm["p0"][0] + bm["p1"][0]) / 2,
                    (bm["p0"][1] + bm["p1"][1]) / 2,
                )
                host = next(
                    p
                    for p in panels
                    if not p["sunken"]
                    and self.bbox(p["poly"])[0] <= mx <= self.bbox(p["poly"])[2]
                    and self.bbox(p["poly"])[1] <= my <= self.bbox(p["poly"])[3]
                )
                host["beam_soffit"] += bm["b"] * bm["length"]

    def slab_bars(self, p: dict[str, Any]) -> None:
        c = COVER["SLAB"]
        bb = self.bbox(p["poly"])
        lx, ly = bb[2] - bb[0], bb[3] - bb[1]
        t = p["t"]
        dia, s = SLAB_BARS[int(t)]
        hook = D(HOOK_90 * dia)
        mk = p["mark"]
        if mk == "CS1":
            self.bar(
                p,
                "CS1-t",
                10,
                "11",
                [BALCONY["depth"] + D(1000), D(125)],
                count_at(lx - 2 * c, D(125)),
                "MAIN",
            )
            self.bar(
                p,
                "CS1-d",
                8,
                "00",
                [lx - 2 * c],
                count_at(BALCONY["depth"] - 2 * c, D(200)),
                "DISTRIBUTION",
            )
            return
        if mk == "SOG":
            self.bar(
                p, "SOG-x", 10, "00", [lx - 2 * c], count_at(ly - 2 * c, D(200)), "MAIN"
            )
            self.bar(
                p, "SOG-y", 10, "00", [ly - 2 * c], count_at(lx - 2 * c, D(200)), "MAIN"
            )
            return
        if mk == "RAMP":
            self.bar(
                p,
                "RAMP-x",
                10,
                "00",
                [lx * p["slope"] - 2 * c],
                count_at(ly - 2 * c, D(200)),
                "MAIN",
            )
            self.bar(
                p,
                "RAMP-y",
                10,
                "00",
                [ly - 2 * c],
                count_at(lx * p["slope"] - 2 * c, D(200)),
                "MAIN",
            )
            return
        if mk == "S10":  # one-way: main across the short (y) span, distribution along x
            self.bar(
                p,
                "S10-m",
                10,
                "21",
                [hook, ly - 2 * c, hook],
                count_at(lx - 2 * c, D(125)),
                "MAIN",
            )
            self.bar(
                p,
                "S10-d",
                8,
                "00",
                [lx - 2 * c],
                count_at(ly - 2 * c, D(200)),
                "DISTRIBUTION",
            )
            self.bar(
                p,
                "S10-xt",
                10,
                "00",
                [ly / 4 + ly / 4],
                count_at(lx - 2 * c, D(125)),
                "EXTRA_TOP",
            )
            return
        nx, ny = count_at(ly - 2 * c, D(s)), count_at(lx - 2 * c, D(s))
        crank = D("0.42") * (t - 2 * c)
        for axis, length, cnt in (("x", lx, nx), ("y", ly, ny)):
            n_str, n_crk = (cnt + 1) // 2, cnt // 2
            self.bar(
                p,
                f"{mk}-b{axis}",
                dia,
                "21",
                [hook, length - 2 * c, hook],
                n_str,
                "MAIN",
            )
            self.bar(
                p,
                f"{mk}-c{axis}",
                dia,
                "CRK",
                [length - 2 * c, crank, crank],
                n_crk,
                "MAIN",
            )
            self.bar(
                p,
                f"{mk}-t{axis}",
                dia,
                "11",
                [length / 4 + length / 4, hook],
                2 * cnt,
                "EXTRA_TOP",
            )

    # -- stairs -------------------------------------------------------------------------------
    def stairs(self) -> None:
        st = STAIR
        x_land = SUBGRID["2'"]
        for storey, risers in st["risers"].items():
            level_top = STOREY_TOP[storey]
            h = storey_height(storey)
            half = (
                h / 2
            )  # exact: even riser counts; the per-riser rise is display only (trap T-RISER-ROUNDED)
            per_flight = risers // 2
            run = (per_flight - 1) * st["tread"]
            sloped = sqrt(run**2 + half**2)
            for k in (1, 2):
                y0 = st["y0"] + (D(0) if k == 1 else st["width"] + st["well"])
                m = self.add(
                    id=f"FL{k}@{storey}",
                    **{"class": "STAIR"},
                    mark="FL1" if storey == "GF" else "FL2",
                    level=storey,
                    geom="FLIGHT",
                    x0=x_land,
                    x1=x_land + run,
                    y0=y0,
                    y1=y0 + st["width"],
                    run=run,
                    rise_total=half,
                    risers=per_flight,
                    width=st["width"],
                    waist=st["waist"],
                    sloped=sloped,
                    tread=st["tread"],
                    grade=GRADE["default"],
                )
                self.bar(
                    m,
                    f"{m['mark']}-m",
                    st["bars"][0],
                    "00",
                    [sloped + D(1000)],
                    count_at(st["width"] - 2 * COVER["STAIR"], D(st["bars"][1])),
                    "MAIN",
                )
                self.bar(
                    m,
                    f"{m['mark']}-d",
                    st["dist"][0],
                    "21",
                    [D(HOOK_90 * 8), st["width"] - 2 * COVER["STAIR"], D(HOOK_90 * 8)],
                    count_at(sloped, D(st["dist"][1])),
                    "DISTRIBUTION",
                )
            # mid-landing (half level) on LB1 at 2'; floor landing FL at the grid-3 end (level above)
            poly = [
                (st["x0"], st["y0"]),
                (x_land, st["y0"]),
                (x_land, st["y1"]),
                (st["x0"], st["y1"]),
            ]
            m = self.add(
                id=f"ML1@{storey}",
                **{"class": "STAIR"},
                mark="ML1",
                level=storey,
                geom="AREA_THICK",
                poly=poly,
                t=st["landing_t"],
                area=shoelace(poly),
                grade=GRADE["default"],
                free_edge=D(0),
            )
            self.mesh(
                m,
                "ML1-b",
                (10, 150),
                x_land - st["x0"],
                st["y1"] - st["y0"],
                COVER["STAIR"],
            )
            if (
                storey != "GF"
            ):  # floor-level landing at this floor, from the departing flights' foot to grid 3
                self.floor_landing(storey, run)
            if storey == "6F":
                self.floor_landing("ROOF", run)
            bc = self.find_beam(level_top, (st["x0"], st["y0"]), (st["x1"], st["y0"]))
            bd = self.find_beam(level_top, (st["x0"], st["y1"]), (st["x1"], st["y1"]))
            lb = self.beam(
                f"LB1@{storey}",
                "LB1",
                "LB",
                level_top,
                (x_land, st["y0"]),
                (x_land, st["y1"]),
                ("BEAM", bc),
                ("BEAM", bd),
                (st["landing_t"], D(0)),
            )
            lb["level"] = storey
            lb["half_level"] = str(STOREY_BOTTOM_ELEV[storey] + h / 2)

    def floor_landing(self, level: str, run: Decimal) -> None:
        st, x_land = STAIR, SUBGRID["2'"]
        fl = self.panel(
            f"FL@{level}",
            "FL",
            level,
            [
                (x_land + run, st["y0"]),
                (st["x1"], st["y0"]),
                (st["x1"], st["y1"]),
                (x_land + run, st["y1"]),
            ],
            st["landing_t"],
        )
        fl["region"] = "stair"
        fl["holes"].append(
            {
                "kind": "STAIRWELL",
                "area": st["well"] * run,
                "rect": (
                    x_land,
                    st["y0"] + st["width"],
                    x_land + run,
                    st["y0"] + st["width"] + st["well"],
                ),
                "deducted": True,
                "outside": True,
            }
        )

    # -- roof furniture, tanks, parapet, lintels, brick walls ------------------------------
    def tank(
        self,
        tid: str,
        cls: str,
        level: str,
        x0: Decimal,
        y0: Decimal,
        lx: Decimal,
        ly: Decimal,
        h: Decimal,
        base: Decimal,
        wall: Decimal,
        top: Decimal,
        manholes: int,
        baffles: int = 0,
        baffle_t: Decimal = ZERO,
    ) -> None:
        ox, oy = lx + 2 * wall, ly + 2 * wall
        poly = [(x0, y0), (x0 + ox, y0), (x0 + ox, y0 + oy), (x0, y0 + oy)]
        b = self.add(
            id=f"{tid}-B",
            **{"class": "SLAB"},
            mark=f"{tid}-B",
            level=level,
            geom="AREA_THICK",
            poly=poly,
            holes=[],
            t=base,
            area=shoelace(poly),
            col_deduct=D(0),
            beam_soffit=D(0),
            free_edge=D(0),
            sunken=False,
            curved_cut=D(0),
            grade=GRADE["default"],
            region="tank",
            on_ground=cls == "UG",
        )
        self.mesh(b, f"{tid}-Bb", SLAB_BARS[int(base)], ox, oy, COVER["TANK"])
        self.mesh(b, f"{tid}-Bt", SLAB_BARS[int(base)], ox, oy, COVER["TANK"])
        t = self.add(
            id=f"{tid}-T",
            **{"class": "SLAB"},
            mark=f"{tid}-T",
            level=level,
            geom="AREA_THICK",
            poly=poly,
            holes=[
                {"kind": "MANHOLE", "area": D(360000), "deducted": True}
                for _ in range(manholes)
            ],
            t=top,
            area=shoelace(poly),
            col_deduct=D(0),
            beam_soffit=D(0),
            free_edge=perimeter(poly),
            sunken=False,
            curved_cut=D(0),
            grade=GRADE["default"],
            region="tank",
        )
        self.mesh(t, f"{tid}-Tb", SLAB_BARS[int(top)], ox, oy, COVER["TANK"])
        legs = [("N", ox), ("S", ox), ("E", oy - 2 * wall), ("W", oy - 2 * wall)] + [
            (f"BF{k + 1}", ly) for k in range(baffles)
        ]
        for name, length in legs:
            tw = baffle_t if name.startswith("BF") else wall
            w = self.add(
                id=f"{tid}-W{name}",
                **{"class": "WALL"},
                mark=f"{tid}-W",
                level=level,
                geom="PRISM_RECT",
                length=length,
                t=tw,
                h=h,
                faces=2,
                beam_ends=[],
                t_top=D(0),
                openings=[],
                grade=GRADE["default"],
            )
            self.bar(
                w,
                f"{tid}-Wv",
                10,
                "11",
                [h + base - D(60), D(HOOK_90 * 10)],
                2 * count_at(length - 2 * COVER["TANK"], D(150)),
                "MAIN",
            )
            self.bar(
                w,
                f"{tid}-Wh",
                10,
                "11",
                [length - 2 * COVER["TANK"], D(HOOK_90 * 10)],
                2 * count_at(h - D(100), D(150)),
                "HORIZONTAL",
            )

    def roof_furniture(self) -> None:
        # SRR: stair-room roof over the stair bay (125) and machine-room roof over the core (150)
        st = STAIR
        srr = self.panel(
            "SRR@SRR",
            "SRR",
            "SRR",
            [
                (st["x0"] - EDGE_HALF, st["y0"] - EDGE_HALF),
                (CORE["x0"], st["y0"] - EDGE_HALF),
                (CORE["x0"], st["y1"] + EDGE_HALF),
                (st["x0"] - EDGE_HALF, st["y1"] + EDGE_HALF),
            ],
            D(125),
        )
        mrr = self.panel(
            "MRR@SRR",
            "MRR",
            "SRR",
            [
                (CORE["x0"], CORE["y0"] - EDGE_HALF),
                (CORE["x1"] + EDGE_HALF, CORE["y0"] - EDGE_HALF),
                (CORE["x1"] + EDGE_HALF, CORE["y1"] + EDGE_HALF),
                (CORE["x0"], CORE["y1"] + EDGE_HALF),
            ],
            D(150),
        )
        srr["region"] = mrr["region"] = "srr"
        for p in (srr, mrr):
            p["free_edge"] = D(0)
        # SRR beams: around the stair/lift room on the column stubs C2, D2 and the core walls
        t = D(0)
        self.beam(
            "SB-R1@SRR",
            "SB-R1",
            "S",
            "SRR",
            (X["2"], Y["C"]),
            (X["3"], Y["C"]),
            ("COLUMN", "C2"),
            ("WALL", "3"),
            (t, D(125)),
        )
        self.beam(
            "SB-R2@SRR",
            "SB-R2",
            "S",
            "SRR",
            (X["2"], Y["D"]),
            (X["3"], Y["D"]),
            ("COLUMN", "D2"),
            ("WALL", "3"),
            (D(125), t),
        )
        self.beam(
            "SB-R3@SRR",
            "SB-R3",
            "S",
            "SRR",
            (X["2"], Y["C"]),
            (X["2"], Y["D"]),
            ("COLUMN", "C2"),
            ("COLUMN", "D2"),
            (t, D(125)),
        )
        self.beam(
            "SB-R4@SRR",
            "SB-R4",
            "S",
            "SRR",
            (X["3"], Y["C"]),
            (X["4"], Y["C"]),
            ("WALL", "3"),
            ("WALL", "4"),
            (t, D(150)),
        )
        self.beam(
            "SB-R5@SRR",
            "SB-R5",
            "S",
            "SRR",
            (X["3"], Y["D"]),
            (X["4"], Y["D"]),
            ("WALL", "3"),
            ("WALL", "4"),
            (D(150), t),
        )
        self.beam(
            "SB-R6@SRR",
            "SB-R6",
            "S",
            "SRR",
            (X["4"], Y["C"]),
            (X["4"], Y["D"]),
            ("WALL", "4"),
            ("WALL", "4"),
            (D(150), t),
        )
        # OHWT on the stair room: base 200 sits on the SRR slab (its own slab), walls 150, cover 100
        o = OHWT
        self.tank(
            "OHWT",
            "OH",
            "OHWT",
            st["x0"],
            st["y0"],
            D(o["lx"]),
            D(o["ly"]),
            D(o["h"]),
            D(o["base"]),
            D(o["wall"]),
            D(o["top"]),
            1,
        )
        u = UGWR
        self.tank(
            "UGWR",
            "UG",
            "FDN",
            u["x0"],
            u["y0"],
            D(u["lx"]),
            D(u["ly"]),
            D(u["h"]),
            D(u["base"]),
            D(u["wall"]),
            D(u["top"]),
            u["manholes"],
        )
        s = SEPTIC
        self.tank(
            "ST",
            "UG",
            "FDN",
            s["x0"],
            s["y0"],
            D(s["lx"]),
            D(s["ly"]) * s["chambers"] + D(s["baffle"]),
            D(s["h"]),
            D(s["base"]),
            D(s["wall"]),
            D(s["top"]),
            s["chambers"],
            baffles=1,
            baffle_t=D(s["baffle"]),
        )
        # parapet: RCC 100 × 3'-6" along the roof outline (the SRR block sides excluded: SRR walls are brick)
        length = perimeter(outline("ROOF"))
        w = self.add(
            id="PARAPET@ROOF",
            **{"class": "WALL"},
            mark="PP1",
            level="ROOF",
            geom="PRISM_RECT",
            length=length,
            t=D(PARAPET["t"]),
            h=PARAPET["h"],
            faces=2,
            beam_ends=[],
            t_top=D(0),
            openings=[],
            grade=GRADE["default"],
        )
        (vd, vs), (hd, hs) = PARAPET["bars"]
        self.bar(
            w,
            "PP1-v",
            vd,
            "11",
            [PARAPET["h"] - D(20), D(300)],
            count_at(length, D(vs)),
            "MAIN",
        )
        self.bar(
            w,
            "PP1-h",
            hd,
            "00",
            [length],
            count_at(PARAPET["h"] - D(40), D(hs)),
            "HORIZONTAL",
        )

    def lintels_and_walls(self) -> None:
        """AM-07 subset: brick walls 250 (perimeter) and 125 (partitions) per typical floor with the
        openings the lintel schedule names; lintels L1/L2 and lintel-cum-sunshade LS1 by arch mark."""
        schedule = [
            ("L1", "LT1", D(1000), D(1200), 10),
            ("L2", "LT2", D(1200), D(2100), 8),
            ("LS1", "LS1", D(1500), D(1200), 6),
        ]
        for level in ["1F", *TYPICAL]:
            storey = next(s for s, top in STOREY_TOP.items() if top == level)
            h = storey_height(storey) - D(450)
            perim = (
                perimeter(outline(level)) - (X["6"] - X["2"]) - BALCONY["depth"] * 2
            )  # the balcony front is open
            openings = sum((w * hh * n for _, _, w, hh, n in schedule), D(0))
            self.add(
                id=f"BW250@{level}",
                **{"class": "BRICK_WALL"},
                mark="BW250",
                level=level,
                geom="AREA_THICK",
                length=perim,
                h=h,
                t=D(250),
                openings=openings,
                grade="BRICK",
            )
            self.add(
                id=f"BW125@{level}",
                **{"class": "BRICK_WALL"},
                mark="BW125",
                level=level,
                geom="AREA_THICK",
                length=D(60000),
                h=h,
                t=D(125),
                openings=D(2100) * D(900) * 12,
                grade="BRICK",
            )
            for mark, btype, w, _hh, n in schedule:
                bt = BEAM_TYPES[btype]
                m = self.add(
                    id=f"{mark}@{level}",
                    **{"class": "LINTEL"},
                    mark=mark,
                    type=btype,
                    level=level,
                    geom="PRISM_RECT",
                    length=w + 2 * D(300),
                    clear=w + 2 * D(300),
                    b=D(bt["b"]),
                    depth=D(bt["D"]),
                    depth2=D(bt["D"]),
                    t_l=D(0),
                    t_r=D(0),
                    count=n,
                    supports=[("WALL", "BW"), ("WALL", "BW")],
                    sunshade=bt.get("sunshade"),
                    grade=GRADE["default"],
                )
                self.beam_bars(m, bt)
                if bt.get("sunshade"):
                    proj, _ts = bt["sunshade"]
                    self.bar(
                        m,
                        f"{mark}-ss",
                        8,
                        "11",
                        [D(proj) + D(200), D(150)],
                        count_at(w + D(600), D(150)),
                        "MAIN",
                    )
                    self.bar(
                        m,
                        f"{mark}-sd",
                        8,
                        "00",
                        [w + D(600) - D(50)],
                        count_at(D(proj), D(200)),
                        "DISTRIBUTION",
                    )

    # -- the whole ----------------------------------------------------------------------------
    def framed_floor(self, level: str) -> None:
        panels = self.floor_slabs(level)
        self.place_holes(level, panels)
        self.deduct_columns(level, panels)
        for p in panels:
            self.slab_bars(p)

        def t_of(x: Decimal, y: Decimal) -> Decimal:
            for p in panels:
                bb = self.bbox(p["poly"])
                if bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3] and not p["sunken"]:
                    return p["t"]
            if STAIR["x0"] <= x <= STAIR["x1"] and STAIR["y0"] <= y <= STAIR["y1"]:
                return STAIR["landing_t"]
            return D(0)

        prefix = "R" if level == "ROOF" else ("1" if level == "1F" else "")

        def btype_of(name: str) -> str:
            if level == "ROOF":
                return "R"
            if name in ("A", "E", "1", "6"):
                return "L"
            return "T"

        self.line_beams(level, prefix, btype_of, t_of)
        if level != "ROOF":
            # cantilever beams CB1–CB4 on grids 2–5 and the curved edge beam EB1 (arc at A-6, lands on A6)
            tip = -BALCONY["depth"] + EDGE_HALF
            for k, xn in enumerate(["2", "3", "4", "5"], start=1):
                self.beam(
                    f"{prefix}CB{k}@{level}",
                    f"{prefix}CB{k}",
                    "CB",
                    level,
                    (X[xn], D(0)),
                    (X[xn], tip),
                    ("COLUMN", f"A{xn}"),
                    ("FREE", "TIP"),
                    (D(150), D(150)),
                )
            r_cl = BALCONY["r"] - EDGE_HALF
            pts = [X["2"], X["3"], X["4"], X["5"]]
            for k in range(3):
                self.beam(
                    f"{prefix}EB1{'abc'[k]}@{level}",
                    f"{prefix}EB1",
                    "EB",
                    level,
                    (pts[k], tip),
                    (pts[k + 1], tip),
                    ("BEAM", f"{prefix}CB{k + 1}@{level}"),
                    ("BEAM", f"{prefix}CB{k + 2}@{level}"),
                    (D(150), D(0)),
                )
            arc = PI * r_cl / 2
            self.beam(
                f"{prefix}EB1d@{level}",
                f"{prefix}EB1",
                "EB",
                level,
                (X["5"], tip),
                (X["6"], D(0)),
                ("BEAM", f"{prefix}CB4@{level}"),
                ("COLUMN", "A6"),
                (D(150), D(0)),
                {
                    "arc_len": (X["6"] - BALCONY["r"] - X["5"]) + arc,
                    "curved": True,
                    "end_dirs": ((ONE, ZERO), (ZERO, -ONE)),
                },
            )
            if level == "1F":
                s = next(s for s in self.stacks if s.get("porch"))
                for xn in ("4", "5"):
                    self.beam(
                        f"PB{xn}@1F",
                        f"PB{xn}",
                        "PB",
                        "1F",
                        (X[xn], tip),
                        (s["x"], s["y"]),
                        ("BEAM", "1EB1c@1F"),
                        ("COLUMN", "C7X"),
                        (D(125), D(0)),
                    )
        self.deduct_beam_soffits(level, panels)
        self.regions[level] = panels

    def ground(self) -> None:
        """GF slab-on-grade with the 1:8 car ramp; grade beams GB1–GB5 between cap faces."""
        poly = outline("GF")
        core = [
            (CORE["x0"] - CORE["t_low"] / 2, CORE["y0"] - CORE["t_low"] / 2),
            (CORE["x1"] + CORE["t_low"] / 2, CORE["y0"] - CORE["t_low"] / 2),
            (CORE["x1"] + CORE["t_low"] / 2, CORE["y1"] + CORE["t_low"] / 2),
            (CORE["x0"] - CORE["t_low"] / 2, CORE["y1"] + CORE["t_low"] / 2),
        ]
        ramp = [
            (RAMP["x0"], RAMP["y0"]),
            (RAMP["x1"], RAMP["y0"]),
            (RAMP["x1"], RAMP["y1"]),
            (RAMP["x0"], RAMP["y1"]),
        ]
        sog = self.panel("SOG@GF", "SOG", "GF", poly, D(125))
        sog["holes"] += [
            {"kind": "LIFT_PIT", "area": shoelace(core), "deducted": True},
            {"kind": "RAMP", "area": shoelace(ramp), "deducted": True},
        ]
        sog["on_ground"] = True
        run, rise = RAMP["y1"] - RAMP["y0"], RAMP["rise"]
        rp = self.panel(
            "RAMP@GF", "RAMP", "GF", ramp, D(125), slope=sqrt(run**2 + rise**2) / run
        )
        rp["on_ground"] = True
        self.deduct_columns("GF", [sog, rp])
        self.slab_bars(sog)
        self.slab_bars(rp)
        self.regions["GF"] = [sog, rp]
        # grade beams: GB1 perimeter (A, E, 1, 6), GB2 letters, GB3 numerals, GB4 skew, GB5 porch tie
        counter = {"GB1": 0, "GB2": 0, "GB3": 0, "GB4": 0, "GB5": 0}

        def gb(
            btype: str,
            p0: Any,
            p1: Any,
            s0: str,
            s1: str,
            k0: str = "CAP",
            k1: str = "CAP",
        ) -> None:
            counter[btype] += 1
            self.beam(
                f"{btype}-{counter[btype]}@FDN",
                btype,
                btype,
                "FDN",
                p0,
                p1,
                (k0, s0),
                (k1, s1),
                (D(0), D(0)),
            )

        def cap_id(yl: str, xn: str) -> str | None:
            sid = f"{yl}{xn}"
            if yl in "CD" and xn in "34":
                return "CORE"
            if sid in ("E1", "B4"):
                return None
            return sid if sid in self.cap_rects else None

        for yl in YL:
            pts = [(X[xn], Y[yl], cap_id(yl, xn)) for xn in XN if cap_id(yl, xn)]
            for (x0, y0, c0), (x1, y1, c1) in pairwise(pts):
                if c0 == c1 == "CORE":
                    continue
                gb("GB1" if yl in "AE" else "GB2", (x0, y0), (x1, y1), c0, c1)
        for xn in XN:
            pts = [(X[xn], Y[yl], cap_id(yl, xn)) for yl in YL if cap_id(yl, xn)]
            for (x0, y0, c0), (x1, y1, c1) in pairwise(pts):
                if c0 == c1 == "CORE":
                    continue
                gb("GB1" if xn in "16" else "GB3", (x0, y0), (x1, y1), c0, c1)
        cmx, cmy = (
            (CHAMFER[0][0] + CHAMFER[1][0]) / 2,
            (CHAMFER[0][1] + CHAMFER[1][1]) / 2,
        )
        gb("GB4", (X["1"], Y["D"]), CHAMFER[0], "D1", "CH1", "CAP", "JOINT")
        gb("GB4", CHAMFER[0], (cmx, cmy), "CH1", "C6X", "JOINT", "CAP")
        gb("GB4", (cmx, cmy), CHAMFER[1], "C6X", "CH2", "CAP", "JOINT")
        gb("GB4", CHAMFER[1], (X["2"], Y["E"]), "CH2", "E2", "JOINT", "CAP")
        s = next(s for s in self.stacks if s.get("porch"))
        gb("GB5", (X["4"], Y["A"]), (s["x"], s["y"]), "A4", "C7X")
        gb("GB5", (X["5"], Y["A"]), (s["x"], s["y"]), "A5", "C7X")

    def run(self) -> dict[str, Any]:
        self.foundations()
        self.columns()
        self.ground()
        for level in FLOORS:
            self.framed_floor(level)
        self.stairs()
        self.roof_furniture()
        self.lintels_and_walls()
        # column formwork: the slab over each column's top (max thickness of panels around it)
        for m in self.members:
            if m["class"] == "COLUMN" and m["level"] != "FDN":
                top = STOREY_TOP[m["level"]]
                ts = [
                    p["t"]
                    for p in self.regions.get(top, [])
                    if not p.get("on_ground")
                    and self.bbox(p["poly"])[0] - 1
                    <= m["cx"]
                    <= self.bbox(p["poly"])[2] + 1
                    and self.bbox(p["poly"])[1] - 1
                    <= m["cy"]
                    <= self.bbox(p["poly"])[3] + 1
                ]
                m["t_top"] = max(ts) if ts else D(125)
        return {
            "fixture": "F-RCC6-BNBC",
            "grid": {
                "x": {k: str(v) for k, v in X.items()},
                "y": {k: str(v) for k, v in Y.items()},
                "subgrid": {k: str(v) for k, v in SUBGRID.items()},
                "chamfer": [[str(c) for c in p] for p in CHAMFER],
            },
            "levels": {k: str(v) for k, v in ELEV.items()},
            "storeys": {s: str(storey_height(s)) for s in STOREYS},
            "members": self.members,
            "bars": self.bars,
            "regions": self.regions,
            "site": SITE,
            "conventions": CONVENTIONS,
        }


CONVENTIONS: dict[str, Any] = {
    "junction_ownership": [
        "pile > pile cap > column/shear wall (full floor-to-floor, through joints) > beam (clear between support faces, depth below the slab soffit) > slab (runs through; outline − column/wall plan areas − openings > 0.1 m²)",
        "grade beams clear between cap faces; stair flights sloped length × width × waist + step triangles; landings AREA_THICK",
        "formwork: column 2(b+d) × (floor-to-floor − slab t) − beam-end contacts > 500 cm²; beam sides (D − t each side) + soffit b, × clear; slab soffit net of beam soffits and columns, free edges × t as EDGE; caps/GB/footing sides only; piles none; stair soffit + risers + strings",
        "a junction deduction may defer only where the published figure is then under, never over (AM-02)",
    ],
    "opening_threshold_m2": "0.1",
    "member_end_no_deduct_cm2": "500",
    "unit_weights": "L-FRM-05 table (8→0.395, 10→0.616, 12→0.888, 16→1.579, 20→2.466, 25→3.854 kg/m); d²/162 is a check only",
    "cutting_length": "BS 8666 per L-FRM-05 (bend radius 2d ≤16 mm else 3.5d; generic Σlegs − bends·(0.5r + d)); IS-additive printed beside, never billed",
    "rounded_cutting_length_mm": 25,
    "stock_mm": "12000",
    "stock_split": "n = ⌈(L − lap)/(stock − lap)⌉, billable L + (n − 1)·lap; laps are the LAP component",
    "laps": "tension 50d / compression 40d (S-02 general note overrides the BNBC table, J-032); columns and walls one lap per storey",
    "hooks": "90° = 12d; stirrup/tie 135° = 10d, min 75 mm (S-03)",
    "counting": "⌊(distance + 0.5 mm)/spacing⌋ + 1",
    "wastage": "none in net quantities; 3 % and binding wire 8 kg/t belong to resource summaries only (AM-03a)",
    "rebar_unit": "kg = cutting length (raw, unrounded) × table kg/m",
    "sunken_slab": "drop 300: slab 125 + drop walls 125 × 175 on the cut-out perimeter; formwork soffit + both drop faces",
    "ramp": "sloped area × thickness (plan × √(run² + rise²)/run)",
    "curved_balcony": "the R 1524 corner is authored analytically (rect − r² + πr²/4) in both golden paths; the outline polygon keeps the corner point",
}


def build() -> dict[str, Any]:
    return Build().run()
