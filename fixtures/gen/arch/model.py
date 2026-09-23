"""F-ARCH — the authored architecture of the F-RCC6-BNBC building, as plain data (the one source).

One building, one home (DECISIONS.md A-01). The STRUCTURE is F-RCC6-BNBC's and is read from
`fixtures.gen.rcc6_bnbc.model`, never edited: its module constants (grid, levels, storey heights,
the chamfer, the balcony, the sunken toilet panels, the two service ducts, the column stacks and
`column_poly`) and, read-only, what its `build()` places (the lift core's shear walls, the beams and
slab panels over each storey, and S-25's lintel schedule). Everything ARCHITECTURAL is authored
here: the brick walls with their thickness and centreline, the openings in them, the rooms with
their label text, anchor and authored clear polygon, the finish types, and the three schedules.

Nothing here derives a quantity. `build()` returns one dict; `golden.py` (path 1, room by room over
the authored clear polygons) and `golden_check.py` (path 2, rooms re-derived from the wall
centrelines ± t/2 by its own planar-face code) read that dict and nothing else.

Units: millimetres, exact in Decimal (1" = 25.4 mm). "At level L" means standing on L's slab and
rising to the next level (A-03): the walls, rooms and openings of level 1F stand between the 1F slab
and the soffit of the 2F slab.
"""

from __future__ import annotations

from decimal import Decimal
from functools import cache
from typing import Any

from fixtures.gen.rcc6_bnbc import model as S

D = Decimal
IN = S.IN
SQ2 = S.SQRT2


def ft(feet: int | str, inches: int | str = 0) -> Decimal:
    return S.ft(feet, inches)


# ---------------------------------------------------------------------------------------------
# The building's own set-out (F-RCC6-BNBC's constants, restated by name only)
# ---------------------------------------------------------------------------------------------

X1, X2, X3, X4, X5, X6 = (S.X[k] for k in ("1", "2", "3", "4", "5", "6"))
YA, YB, YC, YD, YE = (S.Y[k] for k in ("A", "B", "C", "D", "E"))
#: The plan is symmetric about the middle of bay 3-4 (15 + 14 + 9 + 14 + 15 ft).
AX = (X1 + X6) / 2
#: The E-1 chamfer grid line runs y − x = CH_C between CH_A and CH_B.
CH_A, CH_B = S.CHAMFER
CH_C = CH_A[1] - CH_A[0]

LEVELS = ("GF", "1F", "2F", "3F", "4F", "5F", "6F")
TYPICAL = LEVELS[1:]

T250 = D(250)
T125 = D(125)
#: The balcony's low planter wall (3" brick on edge, 3'-0" high) — not a storey wall (A-09).
T_LOW = ft(0, 3)
LOW_H = ft(3)

#: The existing ground level as the architect's section states it, 1'-6" below the plinth — the site
#: fact F-RCC6-BNBC's traps name (T-NOT-LEVEL); drawn only, never measured here.
EGL = -ft(1, 6)

SUNKEN_DROP = S.SUNKEN_DROP
SUNKEN_SIZE = S.SUNKEN_SIZE
SUNKEN = S.SUNKEN
DUCTS = S.DUCTS
DUCT_SIZE = S.DUCT_SIZE


def group_of(level: str) -> str:
    return "GF" if level == "GF" else "TYP"


def storey_h(level: str) -> Decimal:
    return S.storey_height(level)


def above(level: str) -> str:
    return S.STOREY_TOP[level]


def mx(x: Decimal) -> Decimal:
    """The mirror of a plan x about AX (the east flat is the west flat mirrored, A-05)."""
    return X6 - x


def chamfer_x(y: Decimal, t: Decimal) -> Decimal:
    """x of the INNER face of a wall of thickness t centred on the chamfer grid line, at height y."""
    return y - CH_C + t / 2 * SQ2


# ---------------------------------------------------------------------------------------------
# What the structure places (read-only from F-RCC6-BNBC's build; A-01)
# ---------------------------------------------------------------------------------------------


@cache
def _structure() -> dict[str, Any]:
    return S.build()


def _pt(p: Any) -> tuple[Decimal, Decimal]:
    return (D(p[0]), D(p[1]))


def columns_at(level: str) -> list[dict[str, Any]]:
    """Every column standing in the storey `level`, as its authored plan polygon (column_poly)."""
    out = []
    for stack in S._stacks():
        if level in stack["storeys"] and not stack.get("porch"):
            out.append(
                {
                    "id": f"{stack['id']}@{level}",
                    "stack": stack["id"],
                    "mark": stack["mark"],
                    "poly": [_pt(p) for p in S.column_poly(stack, level)],
                }
            )
    return sorted(out, key=lambda c: c["id"])


def core_at(level: str) -> list[dict[str, Any]]:
    """The lift core's shear walls in the storey `level` (RCC, SW1 on S-23): plan rectangles."""
    out = []
    for m in _structure()["members"]:
        if m["class"] == "SHEAR_WALL" and m["mark"] == "SW1" and m["level"] == level:
            x0, y0, x1, y1 = (D(m[k]) for k in ("x0", "y0", "x1", "y1"))
            out.append({"id": m["id"], "poly": [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], "t": D(m["t"])})
    assert len(out) == 3, f"F-RCC6-BNBC places {len(out)} lift-core walls at {level}, not 3"
    return sorted(out, key=lambda c: c["id"])


def core_faces(level: str) -> dict[str, Decimal]:
    """Named faces of the core at a level: west wall (SW1-3), east wall (SW1-4), north wall (SW1-D)."""
    by = {c["id"].split("@")[0]: c["poly"] for c in core_at(level)}
    w, e, n = by["SW1-3"], by["SW1-4"], by["SW1-D"]
    return {
        "w0": w[0][0], "w1": w[1][0], "e0": e[0][0], "e1": e[1][0],
        "n0": n[0][1], "n1": n[2][1], "s": w[0][1],
    }


def beams_over(level: str) -> list[dict[str, Any]]:
    """The beams under the slab over the storey `level` (F-RCC6-BNBC's beams at above(level))."""
    out = []
    for m in _structure()["members"]:
        if m["class"] == "BEAM" and m["level"] == above(level):
            out.append(
                {"id": m["id"], "p0": _pt(m["p0"]), "p1": _pt(m["p1"]), "b": D(m["b"]), "depth": D(m["depth"])}
            )
    return sorted(out, key=lambda b: b["id"])


def slabs_over(level: str) -> list[dict[str, Any]]:
    """The slab panels over the storey `level`: each with its polygon, thickness and whether it is a
    sunken toilet panel (dropped SUNKEN_DROP below the floor it serves, A-07)."""
    out = []
    for p in _structure()["regions"][above(level)]:
        out.append(
            {"id": p["id"], "poly": [_pt(q) for q in p["poly"]], "t": D(p["t"]), "sunken": bool(p.get("sunken"))}
        )
    return sorted(out, key=lambda p: p["id"])


def lintels_at(level: str) -> dict[str, dict[str, Any]]:
    """S-25's lintel schedule as F-RCC6-BNBC builds it for `level` (L1, L2, LS1)."""
    out: dict[str, dict[str, Any]] = {}
    for m in _structure()["members"]:
        if m["class"] == "LINTEL" and m["level"] == level:
            out[m["mark"]] = {
                "count": int(m["count"]),
                "length": D(m["length"]),
                "b": D(m["b"]),
                "depth": D(m["depth"]),
                "opening_w": D(m["opening_w"]),
            }
    return out


# ---------------------------------------------------------------------------------------------
# Walls. `stops` is path 1's end rule for the clear length: ("pt",) runs to the centreline end
# point (an L corner or a collinear joint of walls of one thickness, a free end, or an end standing
# in a column or the core, which subtracts itself); ("face", other) stops at the near face of a
# wall this one abuts (a T junction, or a 125 wall meeting a 250 one: 250 > 125, A-10).
# `ends` says which ends meet another wall ("J": the solid runs t/2 past the centreline end so the
# junction closes) and which are free ("F": an archway jamb, flush).
# ---------------------------------------------------------------------------------------------

PT = ("pt",)


def face(other: str) -> tuple[str, str]:
    return ("face", other)


def _wall(wid: str, kind: str, a: tuple[Any, Any], b: tuple[Any, Any], stops: tuple[Any, Any],
          ends: tuple[str, str] = ("J", "J"), note: str = "") -> dict[str, Any]:
    t = T250 if kind == "BW250" else T125
    return {
        "id": wid,
        "type": kind,
        "t": t,
        "a": (D(a[0]), D(a[1])),
        "b": (D(b[0]), D(b[1])),
        "stops": stops,
        "ends": ends,
        "note": note,
    }


# The sunken toilet panels' own set-out, named by the toilet they serve.
_SS = {f"T{i + 1}": (D(x), D(y)) for i, (x, y) in enumerate(SUNKEN)}
_TW, _TL = SUNKEN_SIZE  # 2438 x 1524


def _ring(prefix: str, x0: Decimal, y0: Decimal) -> list[dict[str, Any]]:
    """The four 125 walls standing on a sunken panel's drop-wall ring, centred t/2 outside it (A-07):
    the toilet's clear polygon IS the sunken panel."""
    h = T125 / 2
    xa, xb, ya, yb = x0 - h, x0 + _TW + h, y0 - h, y0 + _TL + h
    return [
        _wall(f"{prefix}s", "BW125", (xa, ya), (xb, ya), (PT, PT), note="toilet ring (south)"),
        _wall(f"{prefix}e", "BW125", (xb, ya), (xb, yb), (PT, PT), note="toilet ring (east)"),
        _wall(f"{prefix}n", "BW125", (xa, yb), (xb, yb), (PT, PT), note="toilet ring (north)"),
        _wall(f"{prefix}w", "BW125", (xa, ya), (xa, yb), (PT, PT), note="toilet ring (west)"),
    ]


def _typical_walls(level: str) -> list[dict[str, Any]]:
    """The typical floor's walls. Where a wall meets the lift core it stops flush on the core's face
    (the shear walls thin from 250 to 200 at 3F, so those ends move by level, A-06)."""
    h125 = T125 / 2
    cf = core_faces(level)
    t1x, t1y = _SS["T1"]  # west, bay 1-2 / B-C
    t2x, t2y = _SS["T3"]  # west, bay 1-2 / D-E (BNBC's third panel)
    ring_in = t1x + _TW + h125  # 3100.5: the toilets' inner ring line (toward the flat)
    ring_out = t1x - h125  # 537.5: the ring line toward the pipe shaft
    walls = [
        # the envelope (250), centred on the grid, flush with the edge beams
        _wall("A", "BW250", (X1, YA), (X6, YA), (PT, PT), note="front, grid A"),
        _wall("6", "BW250", (X6, YA), (X6, YE), (PT, PT), note="grid 6"),
        _wall("E", "BW250", (X6, YE), CH_B, (PT, PT), note="rear, grid E"),
        _wall("CH", "BW250", CH_B, CH_A, (PT, PT), note="the E-1 chamfer"),
        _wall("1", "BW250", CH_A, (X1, YA), (PT, PT), note="grid 1"),
        # party walls (250): flat / flat, flat / lobby, and the stair's own enclosure
        _wall("AXs", "BW250", (AX, YA), (AX, YB), (face("A"), PT), note="living / living"),
        _wall("KAX", "BW250", (AX, YB), (AX, D(6800)), (PT, face("LS")), note="kitchen / kitchen"),
        _wall("LS", "BW250", (X2, D(6800)), (X5, D(6800)), (face("X2c"), face("X5c")), note="lobby south"),
        _wall("X2c", "BW250", (X2, YB), (X2, YC), (PT, PT), note="west flat / lobby and kitchen"),
        _wall("X5c", "BW250", (X5, YB), (X5, YC), (PT, PT), note="east flat / lobby and kitchen"),
        _wall("S1", "BW250", (X2, YC), (cf["w0"], YC), (PT, PT), ("J", "F"), note="stair south (fire door)"),
        _wall("S2", "BW250", (X2, YD), (cf["w0"], YD), (PT, PT), ("J", "F"), note="stair north"),
        _wall("S3", "BW250", (X2, YC), (X2, YD), (PT, PT), note="stair west"),
        _wall("S1e", "BW250", (cf["e1"], YC), (X5, YC), (PT, PT), ("F", "J"), note="lobby north (east of the lift)"),
        _wall("AXn", "BW250", (AX, cf["n1"]), (AX, YE), (PT, face("E")), ("F", "J"), note="bed / bed"),
        # partitions (125)
        _wall("LF", "BW125", (cf["w1"], YC), (cf["e0"], YC), (PT, PT), ("F", "F"), note="lift front"),
        _wall("B1w", "BW125", (X1, YB), (X2, YB), (face("1"), PT), note="dining / family living"),
        _wall("B2w", "BW125", (X2, YB), (AX, YB), (PT, face("AXs")), note="living / kitchen"),
        _wall("X2a", "BW125", (X2, YA), (X2, ft(5, 6)), (face("A"), PT), ("J", "F"), note="archway stub"),
        _wall("X2b", "BW125", (X2, ft(10, 6)), (X2, YB), (PT, PT), ("F", "J"), note="archway stub"),
        _wall("X2n", "BW125", (X2, YD), (X2, YE), (face("S2"), face("E")), note="family living / bed"),
        _wall("YDw", "BW125", (X1, YD), (ring_in, YD), (face("1"), PT), note="pipe shaft (south)"),
        _wall("S2e", "BW125", (cf["e1"], YD), (X5, YD), (PT, PT), ("F", "J"), note="study north"),
        _wall("S3e", "BW125", (X5, YC), (X5, YD), (face("S1e"), PT), note="study east"),
        # the west kitchen's service duct (DUCTS[0]) enclosed in its south-west corner
        _wall("D1e", "BW125", (DUCTS[0][0] + DUCT_SIZE[0] + h125, YB),
              (DUCTS[0][0] + DUCT_SIZE[0] + h125, DUCTS[0][1] + DUCT_SIZE[1] + h125),
              (face("B2w"), PT), note="duct enclosure (east)"),
        _wall("D1n", "BW125", (X2, DUCTS[0][1] + DUCT_SIZE[1] + h125),
              (DUCTS[0][0] + DUCT_SIZE[0] + h125, DUCTS[0][1] + DUCT_SIZE[1] + h125),
              (face("X2c"), PT), note="duct enclosure (north)"),
        # the second duct (DUCTS[1]) enclosed in the east bedroom's south-east corner
        _wall("D2w", "BW125", (DUCTS[1][0] - h125, YD), (DUCTS[1][0] - h125, DUCTS[1][1] + DUCT_SIZE[1] + h125),
              (face("S2e"), PT), note="duct enclosure (west)"),
        _wall("D2n", "BW125", (DUCTS[1][0] - h125, DUCTS[1][1] + DUCT_SIZE[1] + h125),
              (X5, DUCTS[1][1] + DUCT_SIZE[1] + h125), (PT, face("X5n")), note="duct enclosure (north)"),
        # the west toilets' rings and their pipe-shaft closures
        *_ring("T1", t1x, t1y),
        _wall("T1x", "BW125", (ring_in, YB), (ring_in, t1y - h125), (face("B1w"), PT), note="pipe shaft (east)"),
        _wall("T1y", "BW125", (X1, t1y + _TL + h125), (ring_out, t1y + _TL + h125), (face("1"), PT),
              note="pipe shaft (north)"),
        *_ring("T2", t2x, t2y),
        _wall("T2x", "BW125", (ring_in, YD), (ring_in, t2y - h125), (PT, PT), note="pipe shaft (east)"),
        _wall("B2S", "BW125", (ring_in, t2y + _TL + h125), (X2, t2y + _TL + h125), (PT, face("X2n")),
              note="bed-02 / family living"),
    ]
    # the east flat: the west flat's partitions mirrored about AX (A-05) ...
    mirrored = {"B1w": "B1e", "B2w": "B2e", "X2a": "X5a", "X2b": "X5b", "X2n": "X5n", "YDw": "YDe",
                "T1s": "T3s", "T1e": "T3w", "T1n": "T3n", "T1w": "T3e", "T1x": "T3x", "T1y": "T3y",
                "T2s": "T4s", "T2e": "T4w", "T2n": "T4n", "T2w": "T4e", "T2x": "T4x", "B2S": "B2Se"}
    out = list(walls)
    for w in walls:
        if w["id"] not in mirrored:
            continue
        stops = tuple(
            ("face", {"1": "6", "AXs": "AXs", "B1w": "B1e", "X2n": "X5n", "S2": "S2e"}.get(s[1], s[1]))
            if s[0] == "face" else s
            for s in w["stops"]
        )
        out.append(
            {**w, "id": mirrored[w["id"]], "a": (mx(w["a"][0]), w["a"][1]), "b": (mx(w["b"][0]), w["b"][1]),
             "stops": stops, "note": w["note"] + " (east, mirrored)"}
        )
    # ... except where the building is not symmetric: X5n stops at the study's 125 wall, not a 250
    # stair wall, and without a chamfer the east pipe shaft north of TOILET-04 needs its own closure.
    for w in out:
        if w["id"] == "X5n":
            w["stops"] = (PT, face("E"))
    out.append(_wall("T4y", "BW125", (mx(ring_out), t2y + _TL + h125), (X6, t2y + _TL + h125), (PT, face("6")),
                     note="pipe shaft (north, east flat)"))
    return sorted(out, key=lambda w: w["id"])


def _gf_walls(level: str) -> list[dict[str, Any]]:
    h125 = T125 / 2
    cf = core_faces(level)
    t4x, t4y = _SS["T4"]  # the driver's toilet stands under 1F's fourth sunken panel
    ring_w = t4x - h125
    ring_e = t4x + _TW + h125
    ring_n = t4y + _TL + h125
    ch_s = ring_n  # the meter room's south wall runs on the same line
    walls = [
        # the lift lobby, the stair and the lift front (125: "few walls, mostly 5\"")
        _wall("gLS", "BW125", (X2, D(6800)), (X5, D(6800)), (PT, PT), note="lobby south (glass door)"),
        _wall("gX2", "BW125", (X2, D(6800)), (X2, YC), (PT, PT), note="lobby west"),
        _wall("gX5", "BW125", (X5, D(6800)), (X5, YC), (PT, PT), note="lobby east"),
        _wall("gS1", "BW125", (X2, YC), (cf["w0"], YC), (PT, PT), ("J", "F"), note="stair south"),
        _wall("gS2", "BW125", (X2, YD), (cf["w0"], YD), (PT, PT), ("J", "F"), note="stair north"),
        _wall("gS3", "BW125", (X2, YC), (X2, YD), (PT, PT), note="stair west"),
        _wall("gLF", "BW125", (cf["w1"], YC), (cf["e0"], YC), (PT, PT), ("F", "F"), note="lift front"),
        _wall("gS1e", "BW125", (cf["e1"], YC), (X5, YC), (PT, PT), ("F", "J"), note="lobby north"),
        # the guard room at the gate
        _wall("gGa", "BW125", (X5, YA), (X6, YA), (PT, PT), note="guard (front)"),
        _wall("gG6", "BW125", (X6, YA), (X6, ft(8)), (PT, PT), note="guard (east)"),
        _wall("gGn", "BW125", (X6, ft(8)), (X5, ft(8)), (PT, PT), note="guard (rear)"),
        _wall("gG5", "BW125", (X5, ft(8)), (X5, YA), (PT, PT), note="guard (west)"),
        # the driver's room and its toilet (on 1F's fourth sunken panel's ring)
        *_ring("gT", t4x, t4y),
        _wall("gD5", "BW125", (X5, ring_n), (X5, YE), (PT, PT), note="driver (west)"),
        _wall("gDE", "BW125", (X5, YE), (X6, YE), (PT, PT), note="driver (rear)"),
        _wall("gD6", "BW125", (X6, YE), (X6, ring_n), (PT, PT), note="driver (east)"),
        _wall("gDsw", "BW125", (X5, ring_n), (ring_w, ring_n), (PT, PT), note="driver (south, west part)"),
        _wall("gDse", "BW125", (ring_e, ring_n), (X6, ring_n), (PT, PT), note="driver (south, east part)"),
        # the meter room in the chamfer bay
        # (a 250 enclosure, as a meter room is; on the chamfer that also keeps the chamfer column C6
        # engaged with the wall as it is above, A-14)
        _wall("gCH", "BW250", (ch_s - CH_C, ch_s), CH_B, (PT, PT), note="meter (chamfer)"),
        _wall("gME", "BW250", CH_B, (X2, YE), (PT, PT), note="meter (rear)"),
        _wall("gM2", "BW250", (X2, YE), (X2, ch_s), (PT, PT), note="meter (east)"),
        _wall("gMs", "BW250", (X2, ch_s), (ch_s - CH_C, ch_s), (PT, PT), note="meter (south)"),
    ]
    return sorted(walls, key=lambda w: w["id"])


def low_walls(level: str) -> list[dict[str, Any]]:
    """The balcony's low walls (not storey brickwork, A-09): the planter along its edge — straight
    along the west end and the front, a quarter circle at the A-6 end — and the divider between the
    two flats' verandahs. The curved piece is carried exactly as an arc (centre, radii, span)."""
    if level == "GF":
        return []
    b = S.BALCONY
    y_edge = -b["depth"]
    r_out = b["r"]
    x_edge = X6 + S.EDGE_HALF  # the slab's outer face at grid 6 (the edge beam's)
    centre = (x_edge - r_out, y_edge + r_out)
    y_wall = -T250 / 2  # the front wall's outer face
    return [
        {"id": "PLw", "kind": "RECT", "poly": [(X2, y_edge), (X2 + T_LOW, y_edge), (X2 + T_LOW, y_wall), (X2, y_wall)]},
        {"id": "PLs", "kind": "RECT", "poly": [(X2, y_edge), (centre[0], y_edge), (centre[0], y_edge + T_LOW),
                                               (X2, y_edge + T_LOW)]},
        {"id": "PLc", "kind": "ARC", "centre": centre, "r_in": r_out - T_LOW, "r_out": r_out, "y_cut": y_wall},
        {"id": "DIV", "kind": "RECT", "poly": [(AX - T125 / 2, y_edge + T_LOW), (AX + T125 / 2, y_edge + T_LOW),
                                               (AX + T125 / 2, y_wall), (AX - T125 / 2, y_wall)]},
    ]


def walls(level: str) -> list[dict[str, Any]]:
    return _gf_walls(level) if level == "GF" else _typical_walls(level)


# ---------------------------------------------------------------------------------------------
# Openings. `lo` is the jamb nearer the wall's lower axis coordinate (x on an x-running wall, y on
# a y-running one; on the chamfer, the distance from its `a` end); `rooms` names what each face of
# the opening opens onto (a room id, a void id, or None for outside) — path 1's allocation, which
# path 2 re-derives by host-wall adjacency. `lintel` is the S-25 class of a 250-wall opening.
# ---------------------------------------------------------------------------------------------

DOOR_H = ft(7)
SILL_W = ft(3)

#: Every mark the schedules carry: type, size, sill, leaf, and the schedule's own group heading.
MARKS: dict[str, dict[str, Any]] = {
    "D1": {"type": "MAIN DOOR", "w": ft(4), "h": DOOR_H, "sill": D(0), "leaf": "HINGED", "group": "DOOR"},
    "FD1": {"type": "FIRE DOOR", "w": ft(4), "h": DOOR_H, "sill": D(0), "leaf": "HINGED", "group": "DOOR"},
    "SD1": {"type": "SLIDING DOOR", "w": ft(4), "h": DOOR_H, "sill": D(0), "leaf": "SLIDING", "group": "DOOR"},
    "D2": {"type": "FLUSH DOOR", "w": ft(3), "h": DOOR_H, "sill": D(0), "leaf": "HINGED", "group": "DOOR"},
    "D3": {"type": "TOILET DOOR", "w": ft(2, 6), "h": DOOR_H, "sill": D(0), "leaf": "HINGED", "group": "DOOR"},
    "GD1": {"type": "GLASS DOOR", "w": ft(4), "h": DOOR_H, "sill": D(0), "leaf": "HINGED", "group": "DOOR"},
    "LD": {"type": "LIFT DOOR", "w": D(900), "h": D(2100), "sill": D(0), "leaf": "SLIDING", "group": "DOOR"},
    "W1": {"type": "WINDOW", "w": ft(3, 4), "h": ft(4), "sill": SILL_W, "leaf": "SLIDING", "group": "WINDOW"},
    "W2": {"type": "WINDOW WITH SUNSHADE", "w": ft(5), "h": ft(4), "sill": SILL_W, "leaf": "SLIDING",
           "group": "WINDOW"},
    "V1": {"type": "VENTILATOR", "w": ft(1, 6), "h": ft(1), "sill": ft(6), "leaf": "FIXED", "group": "WINDOW"},
    "V2": {"type": "LOUVRE", "w": ft(1), "h": ft(1), "sill": ft(5), "leaf": "LOUVRE", "group": "WINDOW"},
}

#: S-25's lintel class of each mark that stands in a 250 wall (A-11): L1 over the 3'-4" windows,
#: LS1 (lintel-cum-sunshade) over the 5'-0" ones, L2 over the 4'-0" door-height openings.
S25_CLASS = {"W1": "L1", "W2": "LS1", "D1": "L2", "FD1": "L2", "SD1": "L2"}


def _op(oid: str, mark: str, host: str, lo: Any, rooms: tuple[Any, ...], hand: str = "L",
        note: str = "") -> dict[str, Any]:
    spec = MARKS[mark]
    return {
        "id": oid,
        "mark": mark,
        "host": host,
        "lo": D(lo),
        "w": spec["w"],
        "h": spec["h"],
        "sill": spec["sill"],
        "leaf": spec["leaf"],
        "rooms": tuple(r for r in rooms if r is not None),
        "hand": hand,
        "note": note,
    }


def _typical_openings() -> list[dict[str, Any]]:
    w_ops = [
        # the 8 door-height openings of S-25's L2 class
        _op("SD1-1", "SD1", "A", "5112.4", ("W-LIVING", "W-VERANDAH")),
        _op("SD1-2", "SD1", "A", "7079.6", ("W-LIVING", "W-VERANDAH")),
        _op("D1-W", "D1", "X2c", "6960", ("W-F.LIVING", "LOBBY"), hand="R"),
        _op("FD1", "FD1", "S1", "7100", ("LOBBY", "STAIR")),
        # the 10 windows of S-25's L1 class and the 6 of its LS1 class (west half)
        _op("W2-1", "W2", "A", "1500", ("W-LIVING",)),
        _op("W1-1", "W1", "1", "1800", ("W-LIVING",)),
        _op("W1-2", "W1", "1", "7300", ("W-F.LIVING",)),
        _op("W2-2", "W2", "1", "9296", ("W-F.LIVING",)),
        _op("W1-3", "W1", "CH", "300", ("W-BED-02",)),
        _op("W1-4", "W1", "E", "3092", ("W-BED-02",)),
        _op("W2-3", "W2", "E", "5100", ("W-BED-01",)),
        _op("W1-5", "W1", "E", "7250", ("W-BED-01",)),
        # internal doors (125 walls)
        _op("D2-1", "D2", "B2w", "6800", ("W-LIVING", "W-KITCHEN")),
        _op("D2-3", "D2", "B1w", "3300", ("W-LIVING", "W-F.LIVING")),
        _op("D2-5", "D2", "X2n", "12000", ("W-F.LIVING", "W-BED-01")),
        _op("D2-7", "D2", "B2S", "3350", ("W-F.LIVING", "W-BED-02")),
        _op("D3-1", "D3", "T1e", "5900", ("W-TOILET-01", "W-F.LIVING")),
        _op("D3-2", "D3", "T2e", "12300", ("W-TOILET-02", "W-F.LIVING")),
        _op("V1-1", "V1", "T1w", "6000", ("W-TOILET-01", "W-SHAFT-1")),
        _op("V1-2", "V1", "T2w", "12400", ("W-TOILET-02", "W-SHAFT-2")),
        _op("V2-1", "V2", "D1e", "5700", ("W-KITCHEN", "W-DUCT")),
    ]
    host_mirror = {"A": "A", "X2c": "X5c", "1": "6", "E": "E", "B2w": "B2e", "B1w": "B1e", "X2n": "X5n",
                   "B2S": "B2Se", "T1e": "T3w", "T2e": "T4w", "T1w": "T3e", "T2w": "T4e"}
    out = list(w_ops)
    for o in w_ops:
        if o["id"] in ("FD1", "W1-3", "W1-4", "V2-1"):
            continue  # the stair door, the chamfer's windows and the duct louvre have no east twin
        host = host_mirror[o["host"]]
        axis_x = host in ("A", "E", "B2e", "B1e", "B2Se")
        lo = mx(o["lo"] + o["w"]) if axis_x else o["lo"]
        rooms = tuple({"LOBBY": "LOBBY", "STAIR": "STAIR"}.get(r, "E-" + r[2:]) for r in o["rooms"])
        rooms = tuple({"E-SHAFT-1": "E-SHAFT-3", "E-SHAFT-2": "E-SHAFT-4", "E-TOILET-01": "E-TOILET-03",
                       "E-TOILET-02": "E-TOILET-04"}.get(r, r) for r in rooms)
        if o["id"] == "D2-5":
            continue  # the east twin stands elsewhere (below)
        oid = {"SD1-1": "SD1-4", "SD1-2": "SD1-3", "D1-W": "D1-E", "W2-1": "SD1-5", "W1-1": "W1-7",
               "W1-2": "W1-8", "W2-2": "W2-5", "W2-3": "W2-4", "W1-5": "W1-6", "D2-1": "D2-2", "D2-3": "D2-4",
               "D2-5": "D2-6", "D2-7": "D2-8", "D3-1": "D3-3", "D3-2": "D3-4", "V1-1": "V1-3",
               "V1-2": "V1-4"}[o["id"]]
        mark = o["mark"]
        if oid == "SD1-5":
            # the east dining opens onto the balcony where the west one looks past its end (A-12)
            mark = "SD1"
            lo = D("17550")
            rooms = ("E-LIVING", "E-VERANDAH")
        spec = MARKS[mark]
        out.append({**o, "id": oid, "mark": mark, "host": host, "lo": lo, "w": spec["w"], "h": spec["h"],
                    "sill": spec["sill"], "leaf": spec["leaf"], "rooms": rooms,
                    "hand": "R" if o["hand"] == "L" else "L", "note": "east, mirrored"})
    out += [
        _op("LD", "LD", "LF", AX - D(450), ("LOBBY", "LIFT")),
        # the east flat's own: its bedroom-02 has no chamfer, so its two windows stand on E and 6
        _op("W2-6", "W2", "E", "16300", ("E-BED-02",)),
        _op("W1-9", "W1", "E", "18700", ("E-BED-02",)),
        _op("W1-10", "W1", "6", "14100", ("E-BED-02",)),
        _op("D2-9", "D2", "S3e", "9500", ("E-F.LIVING", "E-STUDY"), hand="R"),
        # the east bedroom-01 is entered through the study: its duct shaft stands where the west
        # bedroom's door is (A-05)
        _op("D2-6", "D2", "S2e", "12500", ("E-STUDY", "E-BED-01")),
    ]
    return sorted(out, key=lambda o: o["id"])


def _gf_openings() -> list[dict[str, Any]]:
    _, t4y = _SS["T4"]
    return sorted(
        [
            _op("GD1", "GD1", "gLS", AX - ft(2), ("GF-LOBBY",)),
            _op("gFD1", "FD1", "gS1", "7100", ("GF-LOBBY", "GF-STAIR")),
            _op("gLD", "LD", "gLF", AX - D(450), ("GF-LOBBY", "GF-LIFT")),
            _op("gD2-1", "D2", "gG5", "800", ("GUARD",)),
            _op("gW1-1", "W1", "gGa", "17800", ("GUARD",)),
            _op("gD2-2", "D2", "gD5", "14000", ("DRIVER",)),
            _op("gW1-2", "W1", "gDE", "17800", ("DRIVER",)),
            _op("gD3-1", "D3", "gTn", "18200", ("DRIVER-TOILET", "DRIVER")),
            _op("gV1-1", "V1", "gTe", str(t4y + D(500)), ("DRIVER-TOILET",)),
            _op("gD2-3", "D2", "gMs", "2800", ("METER",)),
        ],
        key=lambda o: o["id"],
    )


def openings(level: str) -> list[dict[str, Any]]:
    return _gf_openings() if level == "GF" else _typical_openings()


#: The archways: a gap in a partition with no leaf, wider than 4'-0", that joins two labelled areas
#: into one space (T-ARCHWAY, A-13). Carried as the gap between two wall stubs; listed for the drawing.
ARCHWAYS = {
    "TYP": [
        {"id": "AR-W", "line": "x", "at": X2, "lo": ft(5, 6), "hi": ft(10, 6), "t": T125},
        {"id": "AR-E", "line": "x", "at": X5, "lo": ft(5, 6), "hi": ft(10, 6), "t": T125},
    ],
    "GF": [],
}


# ---------------------------------------------------------------------------------------------
# Rooms: path 1's authored clear polygons (wall faces only — A-14), the label as the plan writes
# it, and the anchor the label stands at. Voids (shafts, ducts, the stair, the lift) are named so
# path 2 can account for every face it finds; they carry no finish.
# ---------------------------------------------------------------------------------------------

FINISH_TYPES: dict[str, dict[str, Any]] = {
    "DRY": {
        "rooms": "LIVING, DINING, F.LIVING, BED, STUDY",
        "floor": "24\"x24\" HOMOGENEOUS FLOOR TILES",
        "skirting": ft(0, 4),
        "dado": None,
        "wall": "12 THK. 1:6 C.M. PLASTER, 3 COATS PLASTIC PAINT",
        "ceiling": "6 THK. 1:4 C.M. PLASTER, 3 COATS PLASTIC PAINT",
    },
    "KIT": {
        "rooms": "KITCHEN",
        "floor": "12\"x12\" ANTI-SKID CERAMIC TILES",
        "skirting": None,
        "dado": ft(5),
        "dado_spec": "10\"x16\" GLAZED WALL TILES TO 5'-0\" ON ALL WALLS",
        "wall": "12 THK. 1:6 C.M. PLASTER ABOVE DADO, 3 COATS PLASTIC PAINT",
        "ceiling": "6 THK. 1:4 C.M. PLASTER, 3 COATS PLASTIC PAINT",
    },
    "WET": {
        "rooms": "TOILET",
        "floor": "12\"x12\" ANTI-SKID CERAMIC TILES",
        "skirting": None,
        "dado": ft(7),
        "dado_spec": "10\"x16\" GLAZED WALL TILES TO 7'-0\" ON ALL WALLS",
        "wall": "12 THK. 1:6 C.M. PLASTER ABOVE DADO, 3 COATS PLASTIC PAINT",
        "ceiling": "6 THK. 1:4 C.M. PLASTER, 3 COATS PLASTIC PAINT",
    },
    "LOBBY": {
        "rooms": "LIFT LOBBY",
        "floor": "24\"x24\" GRANITE",
        "skirting": ft(0, 4),
        "dado": None,
        "wall": "12 THK. 1:6 C.M. PLASTER, 3 COATS PLASTIC PAINT",
        "ceiling": "6 THK. 1:4 C.M. PLASTER, 3 COATS PLASTIC PAINT",
    },
    "SERVICE": {
        "rooms": "GUARD, DRIVER, METER",
        "floor": "12\"x12\" CERAMIC TILES",
        "skirting": ft(0, 4),
        "dado": None,
        "wall": "12 THK. 1:6 C.M. PLASTER, 2 COATS DISTEMPER",
        "ceiling": "6 THK. 1:4 C.M. PLASTER, 2 COATS DISTEMPER",
    },
    "BALC": {
        "rooms": "VERANDAH",
        "floor": "12\"x12\" ANTI-SKID CERAMIC TILES",
        "skirting": None,
        "dado": None,
        "wall": None,
        "ceiling": None,
    },
}


def _rect(x0: Any, y0: Any, x1: Any, y1: Any) -> list[tuple[Decimal, Decimal]]:
    x0, y0, x1, y1 = D(x0), D(y0), D(x1), D(y1)
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def _mirror_poly(poly: list[tuple[Decimal, Decimal]]) -> list[tuple[Decimal, Decimal]]:
    """Mirror about AX and restore counter-clockwise order."""
    return [(mx(x), y) for x, y in reversed(poly)]


def _room(rid: str, kind: str, ftype: str | None, labels: list[tuple[str, tuple[Any, Any]]],
          poly: list[tuple[Decimal, Decimal]] | None, flat: str, **extra: Any) -> dict[str, Any]:
    return {
        "id": rid,
        "kind": kind,
        "finish": ftype,
        "labels": [{"text": text, "at": (D(p[0]), D(p[1]))} for text, p in labels],
        "polygon": poly,
        "flat": flat,
        **extra,
    }


def _typical_rooms(level: str) -> list[dict[str, Any]]:
    cf = core_faces(level)
    h1, h2 = T125 / 2, T250 / 2
    wf = {  # the wall faces the polygons are written in
        "1i": X1 + h2, "6i": X6 - h2, "Ai": YA + h2, "Ei": YE - h2,
        "YBs": YB - h1, "YBn": YB + h1,
        "X2w250": X2 - h2, "X2e250": X2 + h2, "X2w": X2 - h1, "X2e": X2 + h1,
        "AXw": AX - h2, "AXe": AX + h2,
        "LSs": D(6800) - h2, "LSn": D(6800) + h2,
        "YCs": YC - h2, "YCn": YC + h2, "YDs": YD - h2, "YDn": YD + h2,
        "YDn125": YD + h1, "YDs125": YD - h1,
        "ring_in_e": _SS["T1"][0] + _TW + T125, "ring_out_w": _SS["T1"][0] - T125,
        "T1yn": _SS["T1"][1] + _TL + T125, "T1s_s": _SS["T1"][1] - T125,
        "T2s_s": _SS["T3"][1] - T125, "T2n_n": _SS["T3"][1] + _TL + T125,
        "LFs": YC - h1, "LFn": YC + h1,
    }
    t1x, t1y = _SS["T1"]
    t2x, t2y = _SS["T3"]
    d1x, d1y = DUCTS[0]
    d2x, d2y = DUCTS[1]
    arch_lo, arch_hi = ft(5, 6), ft(10, 6)
    x_ch_ring = chamfer_x(wf["T2n_n"], T250)
    x_ch_e = chamfer_x(wf["Ei"], T250)
    rooms = [
        _room("W-LIVING", "ROOM", "DRY", [("LIVING", (7360, 2440)), ("DINING", (2300, 2440))],
              [(wf["1i"], wf["Ai"]), (wf["X2w"], wf["Ai"]), (wf["X2w"], arch_lo), (wf["X2e"], arch_lo),
               (wf["X2e"], wf["Ai"]), (wf["AXw"], wf["Ai"]), (wf["AXw"], wf["YBs"]), (wf["X2e"], wf["YBs"]),
               (wf["X2e"], arch_hi), (wf["X2w"], arch_hi), (wf["X2w"], wf["YBs"]), (wf["1i"], wf["YBs"])], "W"),
        _room("W-KITCHEN", "ROOM", "KIT", [("KITCHEN", (7800, 5800))],
              [(d1x + DUCT_SIZE[0] + T125, wf["YBn"]), (wf["AXw"], wf["YBn"]), (wf["AXw"], wf["LSs"]),
               (wf["X2e250"], wf["LSs"]), (wf["X2e250"], d1y + DUCT_SIZE[1] + T125),
               (d1x + DUCT_SIZE[0] + T125, d1y + DUCT_SIZE[1] + T125)], "W"),
        _room("W-DUCT", "VOID", None, [("DUCT", (5170, 5700))], None, "W"),
        _room("W-F.LIVING", "ROOM", "DRY", [("F.LIVING", (2300, 9200))],
              [(wf["ring_in_e"], wf["YBn"]), (wf["X2w250"], wf["YBn"]), (wf["X2w250"], wf["YDn"]),
               (wf["X2w"], wf["YDn"]), (wf["X2w"], t2y + _TL), (wf["ring_in_e"], t2y + _TL),
               (wf["ring_in_e"], wf["YDs125"]), (wf["1i"], wf["YDs125"]), (wf["1i"], wf["T1yn"]),
               (wf["ring_in_e"], wf["T1yn"])], "W"),
        _room("W-TOILET-01", "ROOM", "WET", [("TOILET-01", (1820, 6240))], _rect(t1x, t1y, t1x + _TW, t1y + _TL),
              "W"),
        _room("W-SHAFT-1", "VOID", None, [("SHAFT", (300, 6000))], None, "W"),
        _room("W-TOILET-02", "ROOM", "WET", [("TOILET-02", (1820, 12640))], _rect(t2x, t2y, t2x + _TW, t2y + _TL),
              "W"),
        _room("W-SHAFT-2", "VOID", None, [("SHAFT", (300, 12400))], None, "W"),
        _room("W-BED-02", "ROOM", "DRY", [("BED-02", (3400, 14500))],
              [(x_ch_ring, wf["T2n_n"]), (wf["X2w"], wf["T2n_n"]), (wf["X2w"], wf["Ei"]), (x_ch_e, wf["Ei"])], "W"),
        _room("W-BED-01", "ROOM", "DRY", [("BED-01", (7360, 13560))],
              _bed01_west(level, wf, cf), "W"),
        _room("LOBBY", "ROOM", "LOBBY", [("LIFT LOBBY", (AX, 7820))], _lobby(wf, cf, typical=True), "COMMON"),
        _room("STAIR", "VOID", None, [("STAIR", (6700, 10060))], None, "COMMON"),
        _room("LIFT", "VOID", None, [("LIFT", (AX, 10060))], None, "COMMON"),
        _room("W-VERANDAH", "VERANDAH", "BALC", [("VERANDAH", (7400, -790))],
              _rect(X2 + T_LOW, -S.BALCONY["depth"] + T_LOW, AX - h1, -h2), "W"),
    ]
    east = []
    for r in rooms:
        if r["flat"] != "W":
            continue
        rid = "E-" + r["id"][2:]
        rid = {"E-TOILET-01": "E-TOILET-03", "E-TOILET-02": "E-TOILET-04", "E-SHAFT-1": "E-SHAFT-3",
               "E-SHAFT-2": "E-SHAFT-4", "E-DUCT": "E-DUCT"}.get(rid, rid)
        labels = [(lab["text"], (mx(lab["at"][0]), lab["at"][1])) for lab in r["labels"]]
        labels = [({"TOILET-01": "TOILET-03", "TOILET-02": "TOILET-04"}.get(t, t), p) for t, p in labels]
        poly = None if r["polygon"] is None else _mirror_poly(r["polygon"])
        east.append({**r, "id": rid, "labels": [{"text": t, "at": p} for t, p in labels], "polygon": poly,
                     "flat": "E"})
    by = {r["id"]: r for r in east}
    # where the east flat is not the west one mirrored (A-05):
    by["E-KITCHEN"]["polygon"] = _rect(wf["AXe"], wf["YBn"], mx(wf["X2e250"]), wf["LSs"])
    by["E-DUCT"] = _room("E-DUCT", "VOID", None, [("DUCT", (15370, 12100))], None, "E")
    by["E-F.LIVING"]["polygon"] = [
        (mx(wf["X2w250"]), wf["YBn"]), (mx(wf["ring_in_e"]), wf["YBn"]), (mx(wf["ring_in_e"]), wf["T1yn"]),
        (mx(wf["1i"]), wf["T1yn"]), (mx(wf["1i"]), wf["YDs125"]), (mx(wf["ring_in_e"]), wf["YDs125"]),
        (mx(wf["ring_in_e"]), t2y + _TL), (mx(wf["X2w"]), t2y + _TL), (mx(wf["X2w"]), wf["YCn"]),
        (mx(wf["X2w250"]), wf["YCn"]),
    ]
    by["E-BED-02"]["polygon"] = _rect(mx(wf["X2w"]), wf["T2n_n"], mx(wf["1i"]), wf["Ei"])
    by["E-BED-01"]["polygon"] = _bed01_east(level, wf, cf, d2x, d2y)
    by["E-VERANDAH"]["polygon"] = None
    by["E-VERANDAH"]["arc"] = _east_verandah()
    by["E-STUDY"] = _room("E-STUDY", "ROOM", "DRY", [("STUDY", (13700, 10060))],
                          _rect(cf["e1"], wf["YCn"], mx(wf["X2e"]), wf["YDs125"]), "E")
    return sorted(rooms + list(by.values()), key=lambda r: r["id"])


def _bed01_west(level: str, wf: dict[str, Decimal], cf: dict[str, Decimal]) -> list[tuple[Decimal, Decimal]]:
    s2n = wf["YDn"]  # the stair's north wall face (250 brick)
    pts = [(wf["X2e"], s2n)]
    if cf["n1"] != s2n:  # the core's north face steps where the shear walls thin (3F up, A-06)
        pts += [(cf["w0"], s2n), (cf["w0"], cf["n1"])]
        pts += [(wf["AXw"], cf["n1"])]
    else:
        pts += [(wf["AXw"], s2n)]
    pts += [(wf["AXw"], wf["Ei"]), (wf["X2e"], wf["Ei"])]
    return pts


def _bed01_east(level: str, wf: dict[str, Decimal], cf: dict[str, Decimal], d2x: Decimal,
                d2y: Decimal) -> list[tuple[Decimal, Decimal]]:
    return [
        (wf["AXe"], cf["n1"]), (cf["e1"], cf["n1"]), (cf["e1"], wf["YDn125"]),
        (d2x - T125, wf["YDn125"]), (d2x - T125, d2y + DUCT_SIZE[1] + T125),
        (mx(wf["X2e"]), d2y + DUCT_SIZE[1] + T125), (mx(wf["X2e"]), wf["Ei"]), (wf["AXe"], wf["Ei"]),
    ]


def _lobby(wf: dict[str, Decimal], cf: dict[str, Decimal], *, typical: bool) -> list[tuple[Decimal, Decimal]]:
    """The lift lobby: its south wall, the two party walls at 2 and 5, the stair's south wall and the
    study's (250 on typical floors, 125 on the ground floor), the lift front between the core walls,
    and the ends of the core's side walls (they stop on grid C)."""
    h = T250 / 2 if typical else T125 / 2
    south = D(6800) + h
    west = X2 + h
    east = X5 - h
    north = YC - h
    lf_s = YC - T125 / 2
    return [
        (west, south), (east, south), (east, north), (cf["e1"], north), (cf["e1"], cf["s"]), (cf["e0"], cf["s"]),
        (cf["e0"], lf_s), (cf["w1"], lf_s), (cf["w1"], cf["s"]), (cf["w0"], cf["s"]), (cf["w0"], north),
        (west, north),
    ]


def _east_verandah() -> dict[str, Any]:
    """The east verandah: a rectangle closed at its east end by the planter's quarter circle, whose
    centre stands on the balcony's edge line one radius in from the corner (the slab's own R 5'-0"
    corner, BALCONY in F-RCC6-BNBC). Carried analytically (A-15)."""
    b = S.BALCONY
    x_edge = X6 + S.EDGE_HALF
    r_in = b["r"] - T_LOW
    centre = (x_edge - b["r"], -b["depth"] + b["r"])
    return {
        "x0": AX + T125 / 2,
        "y0": -b["depth"] + T_LOW,
        "y1": -T250 / 2,
        "centre": centre,
        "r": r_in,
    }


def _gf_rooms(level: str) -> list[dict[str, Any]]:
    cf = core_faces(level)
    h1 = T125 / 2
    t4x, t4y = _SS["T4"]
    ring_n = t4y + _TL + h1
    wf = {"YCn": YC + h1, "YDs": YD - h1}
    return sorted(
        [
            _room("GF-LOBBY", "ROOM", "LOBBY", [("LIFT LOBBY", (AX, 7820))], _lobby(wf, cf, typical=False), "GF"),
            _room("GF-STAIR", "VOID", None, [("STAIR", (6700, 10060))], None, "GF"),
            _room("GF-LIFT", "VOID", None, [("LIFT", (AX, 10060))], None, "GF"),
            _room("GUARD", "ROOM", "SERVICE", [("GUARD ROOM", (18135, 1220))],
                  _rect(X5 + h1, YA + h1, X6 - h1, ft(8) - h1), "GF"),
            _room("DRIVER-TOILET", "ROOM", "WET", [("TOILET", (t4x + _TW / 2, t4y + _TL / 2))],
                  _rect(t4x, t4y, t4x + _TW, t4y + _TL), "GF"),
            _room("DRIVER", "ROOM", "SERVICE", [("DRIVER", (18135, 14650))],
                  _rect(X5 + h1, ring_n + h1, X6 - h1, YE - h1), "GF"),
            _room("METER", "ROOM", "SERVICE", [("METER ROOM", (3000, 14650))],
                  [(chamfer_x(ring_n + T250 / 2, T250), ring_n + T250 / 2), (X2 - T250 / 2, ring_n + T250 / 2),
                   (X2 - T250 / 2, YE - T250 / 2), (chamfer_x(YE - T250 / 2, T250), YE - T250 / 2)], "GF"),
        ],
        key=lambda r: r["id"],
    )


#: A label's own box where a room carries two (the one space LIVING + DINING, T-ARCHWAY).
_LABEL_BOX = {
    ("W-LIVING", "LIVING"): (X2 + T125 / 2, YA + T250 / 2, AX - T250 / 2, YB - T125 / 2),
    ("W-LIVING", "DINING"): (X1 + T250 / 2, YA + T250 / 2, X2 - T125 / 2, YB - T125 / 2),
}
#: The label that states a nominal size, not the clear one (T-ROOM-SIZE-NOMINAL, A-20).
NOMINAL_LABEL = ("W-BED-01", "BED-01")


def _inch(mm: Decimal) -> Decimal:
    return (mm / IN).quantize(D(1)) * IN


def _box_of(r: dict[str, Any]) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    if r.get("polygon"):
        xs = [p[0] for p in r["polygon"]]
        ys = [p[1] for p in r["polygon"]]
        return (min(xs), min(ys), max(xs), max(ys))
    arc = r["arc"]
    cx, cy = arc["centre"]
    x1 = cx + (arc["r"] ** 2 - (cy - arc["y1"]) ** 2).sqrt()
    return (arc["x0"], arc["y0"], x1, arc["y1"])


def _stated(r: dict[str, Any]) -> None:
    """What each label writes after the name: the clear size W x L to the nearest inch, as the
    architect writes it (a cross-check, never a quantity)."""
    for lab in r["labels"]:
        key = (r["id"], lab["text"])
        east = r["id"].startswith("E-")
        box = _LABEL_BOX.get(("W-" + r["id"][2:], lab["text"]) if east else key)
        if box is not None and east:
            box = (mx(box[2]), box[1], mx(box[0]), box[3])
        x0, y0, x1, y1 = box if box is not None else _box_of(r)
        bw, bl = x1 - x0, y1 - y0
        lab["box_size"] = (bw, bl)
        if key == NOMINAL_LABEL:
            lab["stated"] = ((bw / IN / 12).quantize(D(1)) * 12 * IN, (bl / IN / 12).quantize(D(1)) * 12 * IN)
            lab["nominal"] = True
        else:
            lab["stated"] = (_inch(bw), _inch(bl))


def rooms(level: str) -> list[dict[str, Any]]:
    out = _gf_rooms(level) if level == "GF" else _typical_rooms(level)
    for r in out:
        if r["kind"] != "VOID":
            _stated(r)
    return out


#: Labels that stand in no room: the ground floor's open parking (SURFACE-OPEN — not closed by walls
#: on its open side, so no room and no finish row, A-16).
OPEN_LABELS = {"GF": [("CAR PARKING", (D(6600), D(2400))), ("CAR PARKING", (D(13300), D(13000)))], "TYP": []}


# ---------------------------------------------------------------------------------------------
# The schedules as the architect prints them
# ---------------------------------------------------------------------------------------------

#: Printed quantities that are NOT the placements (a registered trap each, A-17). Everything else is
#: printed as placed.
PRINTED_NOS_OVERRIDE = {("TYP", "D2"): 8}  # T-OPENING-NOS: nine are placed on every typical floor

#: How the schedule spells a mark (hyphenated) against the plan's circled tag (unhyphenated).
def schedule_spelling(mark: str) -> str:
    head = mark.rstrip("0123456789")
    return f"{head}-{mark[len(head):]}" if head != mark else mark


WALL_TYPES = [
    {"mark": "BW250", "t": T250, "spec": "250 THK. (10\") FIRST CLASS BRICK WALL IN 1:4 C.M.",
     "where": "EXTERNAL WALLS, FLAT / FLAT AND FLAT / LOBBY PARTY WALLS, STAIR ENCLOSURE"},
    {"mark": "BW125", "t": T125, "spec": "125 THK. (5\") FIRST CLASS BRICK WALL IN 1:4 C.M., 2 NOS 6 mm DIA "
     "BARS AT EVERY 4TH LAYER", "where": "PARTITIONS, TOILET WALLS, DUCT AND SHAFT ENCLOSURES"},
    {"mark": "RCC", "t": None, "spec": "RCC SHEAR WALL (LIFT CORE) - SEE STRUCTURAL DRAWING S-23",
     "where": "LIFT CORE"},
]


CONVENTIONS: dict[str, Any] = {
    "units": "millimetres; every architectural size authored in feet-inches (1\" = 25.4 mm exactly)",
    "level": "at level L = standing on L's slab, rising to the soffit of the slab of the level above",
    "room": "the clear region bounded by wall faces (brick, low walls and the lift core); columns are "
            "obstructions judged by the 0.1 m² rule, never room boundary (A-14)",
    "floor": "room area less each column piece standing in it whose plan area exceeds 0.1 m²; smaller "
             "pieces retained and listed (A-14)",
    "ceiling": "equal to the floor: slab soffit plastered and painted; beam drops not carried (A-19)",
    "wall_face": "per boundary edge: length × (FFL to the soffit of the slab over the room at that edge); "
                 "plaster and paint cover the band above the tiled band (skirting or dado); each opening "
                 "whose whole area w × h exceeds 0.1 m² deducts its overlap with each band it meets, from "
                 "every room it opens onto; smaller openings retained and listed (L-MEA-02/03, A-18)",
    "skirting": "dry rooms: boundary length less the width of every opening that reaches the floor",
    "brickwork": "each wall between the faces of what owns its ends (column / shear wall > 250 > 125; "
                 "walls of one thickness meet at corners on their centrelines, a 125 wall stops at the "
                 "face of the wall it abuts); height from the slab top to the soffit over its centreline "
                 "(beam, a sunken panel's drop wall, or slab); less openings > 0.1 m² × t and the S-25 "
                 "lintels embedded (b × D × length) (A-10, A-11)",
    "openings": "count and area (w × h) per mark per level, as placed; the schedule's printed quantity "
                "is evidence to check, never the count (L-MEA-02, A-17)",
    "threshold_m2": "0.1 (strictly greater deducts)",
}


def build() -> dict[str, Any]:
    """The whole authored architecture, level by level, with the structure it stands on."""
    out: dict[str, Any] = {"fixture": "F-ARCH", "levels": {}, "conventions": CONVENTIONS}
    for level in LEVELS:
        g = group_of(level)
        out["levels"][level] = {
            "group": g,
            "elev": S.ELEV[level],
            "storey_h": storey_h(level),
            "above": above(level),
            "walls": walls(level),
            "low_walls": low_walls(level),
            "openings": openings(level),
            "archways": ARCHWAYS[g],
            "rooms": rooms(level),
            "open_labels": [{"text": t, "at": p} for t, p in OPEN_LABELS[g]],
            "columns": columns_at(level),
            "core": core_at(level),
            "beams_over": beams_over(level),
            "slabs_over": slabs_over(level),
            "lintels": lintels_at(level),
        }
    out["marks"] = MARKS
    out["s25_class"] = S25_CLASS
    out["finish_types"] = FINISH_TYPES
    out["wall_types"] = WALL_TYPES
    out["printed_nos_override"] = {f"{g}:{m}": n for (g, m), n in PRINTED_NOS_OVERRIDE.items()}
    out["sunken_drop"] = SUNKEN_DROP
    out["low_wall_h"] = LOW_H
    return out
