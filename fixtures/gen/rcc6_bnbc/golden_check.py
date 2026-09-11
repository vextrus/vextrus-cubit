"""F-RCC6-BNBC golden, path 2: aggregation by mark × placements. Every member is folded into a
signature (class, level, grade, the dimensions its formula needs) with a placement count first, and
the formula is evaluated once per signature; bars fold by (class, level, diameter, shape, legs, lap)
and use the generic BS 8666 form Σlegs − bends·(0.5r + d). Path 1 (golden.py) is member by member
with the per-code formulas. The two must agree row for row at 0.001 (selfcheck). Imports model only.
"""

from __future__ import annotations

from collections import Counter
from decimal import ROUND_CEILING, ROUND_HALF_EVEN, Decimal
from typing import Any

from . import model as M

D = Decimal
BENDS = {"00": 0, "SP": 0, "11": 1, "21": 2, "51": 5, "CT": 2, "CRK": 4}
LEG_MULT = {"51": (2, 2, 0, 0, 1, 1), "CT": (1, 1, 1), "CRK": (1, 1, 1)}
UNIT = {
    "RCC_CONCRETE": "m3",
    "FORMWORK": "m2",
    "REBAR": "kg",
    "PILE_LENGTH": "m",
    "PILE_COUNT": "pcs",
    "EXCAVATION": "m3",
    "BLINDING": "m3",
    "BRICKWORK": "m3",
}
DIV = {"m3": D(10) ** 9, "m2": D(10) ** 6, "kg": D(1), "m": D(1000), "pcs": D(1)}


def generic_cutting_length(dia: int, shape: str, legs: tuple[Decimal, ...]) -> Decimal:
    r, d = M.bend_radius(dia), D(dia)
    mult = LEG_MULT.get(shape, (1,) * len(legs))
    total = sum((D(k) * leg for k, leg in zip(mult, legs, strict=True)), D(0))
    return total - BENDS[shape] * (r / 2 + d)


def signatures(
    world: dict[str, Any],
) -> tuple[Counter[tuple[Any, ...]], Counter[tuple[Any, ...]]]:
    """Fold members and bars into hashable signatures with placement counts."""
    members: Counter[tuple[Any, ...]] = Counter()
    by_id = {m["id"]: m for m in world["members"]}
    for m in world["members"]:
        c, lv, g = m["class"], m["level"], m.get("grade", "")
        if c == "PILE":
            members[(c, lv, g, "CYL", m["dia"], m["length"])] += 1
        elif c in ("PILE_CAP", "FOOTING"):
            bb = M.Build.bbox(m["poly"])
            members[
                (
                    c,
                    lv,
                    g,
                    "POLY",
                    m["area"],
                    m["perim"],
                    m["depth"],
                    bb[2] - bb[0],
                    bb[3] - bb[1],
                    m["top"],
                )
            ] += 1
        elif c == "COLUMN":
            per_area = (
                (M.PI * m["b"], M.PI / 4 * m["b"] ** 2)
                if m["geom"] == "CYL"
                else (2 * (m["sx"] + m["sy"]), m["sx"] * m["sy"])
            )
            members[
                (
                    c,
                    lv,
                    g,
                    "COL",
                    per_area[0],
                    per_area[1],
                    m["h"],
                    m["t_top"],
                    sum(m["beam_ends"], D(0)),
                )
            ] += 1
        elif c == "SHEAR_WALL":
            members[
                (
                    c,
                    lv,
                    g,
                    "WALL",
                    m["length"],
                    m["t"],
                    m["h"],
                    D(2),
                    sum(m["beam_ends"], D(0)),
                )
            ] += 1
        elif c == "WALL":
            members[
                (c, lv, g, "WALL", m["length"], m["t"], m["h"], D(m["faces"]), D(0))
            ] += 1
        elif c in ("BEAM", "TIE_BEAM", "LINTEL"):
            ss = tuple(D(v) for v in m["sunshade"]) if m.get("sunshade") else ()
            members[
                (
                    c,
                    lv,
                    g,
                    "BEAM",
                    m["b"],
                    (m["depth"] + m["depth2"]) / 2,
                    m["t_l"],
                    m["t_r"],
                    m["clear"],
                    ss,
                )
            ] += int(m.get("count", 1))
        elif c == "SLAB":
            holes = sum(
                (
                    h["area"]
                    for h in m["holes"]
                    if h["deducted"] and not h.get("outside")
                ),
                D(0),
            )
            reveals = sum(
                (
                    2 * ((h["rect"][2] - h["rect"][0]) + (h["rect"][3] - h["rect"][1]))
                    if h.get("rect")
                    else D(2400)
                )
                for h in m["holes"]
                if h["deducted"] and not h.get("outside") and h["kind"] != "SUNKEN"
            )
            bb = M.Build.bbox(m["poly"])
            members[
                (
                    c,
                    lv,
                    g,
                    "SLAB",
                    m["area"] - holes - m["col_deduct"],
                    m.get("slope", D(1)),
                    m["t"],
                    m.get("t2", m["t"]),
                    m["beam_soffit"],
                    m["free_edge"],
                    reveals,
                    M.perimeter(m["poly"]) if m.get("sunken") else D(0),
                    m["mark"] if m.get("on_ground") else "",
                    bb[2] - bb[0],
                    bb[3] - bb[1],
                    m["id"][:2] if m.get("on_ground") else "",
                )
            ] += 1
        elif c == "STAIR":
            if m["geom"] == "FLIGHT":
                members[
                    (
                        c,
                        lv,
                        g,
                        "FLIGHT",
                        m["sloped"],
                        m["width"],
                        m["waist"],
                        m["tread"],
                        m["rise_total"],
                    )
                ] += 1
            else:
                members[(c, lv, g, "LANDING", m["area"], m["t"])] += 1
        elif c == "BRICK_WALL":
            members[
                (c, lv, g, "BRICK", m["length"], m["h"], m["openings"], m["t"])
            ] += 1
    bars: Counter[tuple[Any, ...]] = Counter()
    for b in world["bars"]:
        parent = int(by_id[b["member"]].get("count", 1))
        bars[
            (
                b["class"],
                b["level"],
                b["dia"],
                b["shape"],
                tuple(b["legs"]),
                b["lap_mm"],
                b["lap_count"],
            )
        ] += b["n"] * parent
    return members, bars


def evaluate(
    members: Counter[tuple[Any, ...]], bars: Counter[tuple[Any, ...]]
) -> dict[tuple[Any, ...], Decimal]:
    out: dict[tuple[Any, ...], Decimal] = {}
    site = {k: D(v) for k, v in M.SITE.items()}

    def add(
        cls: str,
        kind: str,
        lv: str,
        v: Decimal,
        grade: str = "",
        dia: int = 0,
        comp: str = "",
    ) -> None:
        out[(cls, kind, lv, grade, dia, comp)] = (
            out.get((cls, kind, lv, grade, dia, comp), D(0)) + v
        )

    for sig, n in sorted(members.items(), key=repr):
        c, lv, g, kind, *v = sig
        n = D(n)
        if kind == "CYL":
            dia, length = v
            add(c, "RCC_CONCRETE", lv, n * (M.PI / 4 * dia * dia * length), g)
            add(c, "PILE_LENGTH", lv, n * length)
            add(c, "PILE_COUNT", lv, n)
        elif kind == "POLY":
            area, perim, depth, lx, ly, top = v
            add(c, "RCC_CONCRETE", lv, n * area * depth, g)
            add(c, "FORMWORK", lv, n * perim * depth, comp="SIDES")
            a, dx, p, tb = (
                site["working_allowance_mm"],
                site["depth_extra_mm"],
                site["blinding_projection_mm"],
                site["blinding_thickness_mm"],
            )
            add(
                c,
                "EXCAVATION",
                lv,
                n
                * (lx + 2 * a)
                * (ly + 2 * a)
                * (site["egl_mm"] - top + depth + tb + dx),
                comp="PIT",
            )
            add(c, "BLINDING", lv, n * (lx + 2 * p) * (ly + 2 * p) * tb, comp="CC")
        elif kind == "COL":
            per, area, h, t_top, ends = v
            add(c, "RCC_CONCRETE", lv, n * area * h, g)
            add(c, "FORMWORK", lv, n * (per * (h - t_top) - ends), comp="SIDES")
        elif kind == "WALL":
            length, t, h, faces, ends = v
            add(c, "RCC_CONCRETE", lv, n * length * t * h, g)
            add(c, "FORMWORK", lv, n * (faces * length * h - ends), comp="SIDES")
        elif kind == "BEAM":
            b, dm, tl, tr, ln, ss = v
            add(c, "RCC_CONCRETE", lv, n * b * (dm - max(tl, tr)) * ln, g)
            add(c, "FORMWORK", lv, n * (2 * dm - tl - tr) * ln, comp="SIDES")
            add(c, "FORMWORK", lv, n * b * ln, comp="SOFFIT")
            if ss:
                add(c, "RCC_CONCRETE", lv, n * ss[0] * ss[1] * ln, g)
                add(
                    c,
                    "FORMWORK",
                    lv,
                    n * (ss[0] * ln + ss[1] * (ln + 2 * ss[0])),
                    comp="SOFFIT",
                )
        elif kind == "SLAB":
            (
                net,
                slope,
                t,
                t2,
                soffit,
                free,
                reveals,
                sunk_per,
                ground_mark,
                lx,
                ly,
                tank,
            ) = v
            add(c, "RCC_CONCRETE", lv, n * net * slope * ((t + t2) / 2), g)
            if sunk_per:
                add(c, "RCC_CONCRETE", lv, n * sunk_per * 125 * (M.SUNKEN_DROP - t), g)
                add(
                    c,
                    "FORMWORK",
                    lv,
                    n * 2 * sunk_per * (M.SUNKEN_DROP - t),
                    comp="SIDES",
                )
            if not ground_mark:
                add(c, "FORMWORK", lv, n * (net - soffit) * slope, comp="SOFFIT")
            edge = free * t2 + reveals * t
            if edge:
                add(c, "FORMWORK", lv, n * edge, comp="EDGE")
            if ground_mark:
                if ground_mark in ("SOG", "RAMP"):
                    add(
                        c,
                        "BLINDING",
                        lv,
                        n * net * slope * site["sog_blinding_thickness_mm"],
                        comp="CC",
                    )
                else:
                    p, tb, a, dx = (
                        site["blinding_projection_mm"],
                        site["blinding_thickness_mm"],
                        site["working_allowance_mm"],
                        site["depth_extra_mm"],
                    )
                    add(
                        c,
                        "BLINDING",
                        lv,
                        n * (lx + 2 * p) * (ly + 2 * p) * tb,
                        comp="CC",
                    )
                    bottom = M.UGWR["bottom"] if tank == "UG" else M.SEPTIC["bottom"]
                    add(
                        "WALL",
                        "EXCAVATION",
                        lv,
                        n
                        * (lx + 2 * a)
                        * (ly + 2 * a)
                        * (site["egl_mm"] - bottom + tb + dx),
                        comp="PIT",
                    )
        elif kind == "FLIGHT":
            sloped, width, waist, tread, rise_total = v
            add(
                c,
                "RCC_CONCRETE",
                lv,
                n * width * (sloped * waist + tread * rise_total / 2),
                g,
            )
            add(c, "FORMWORK", lv, n * sloped * width, comp="SOFFIT")
            add(c, "FORMWORK", lv, n * rise_total * width, comp="RISERS")
            add(c, "FORMWORK", lv, n * 2 * sloped * waist, comp="SIDES")
        elif kind == "LANDING":
            area, t = v
            add(c, "RCC_CONCRETE", lv, n * area * t, g)
            add(c, "FORMWORK", lv, n * area, comp="SOFFIT")
        elif kind == "BRICK":
            length, h, openings, t = v
            add(c, "BRICKWORK", lv, n * (length * h - openings) * t, comp=str(t))
    for (c, lv, dia, shape, legs, lap, lap_count), n in sorted(bars.items(), key=repr):
        raw = generic_cutting_length(dia, shape, legs)
        pcs = (
            1
            if raw <= M.STOCK
            else int(
                ((raw - lap) / (M.STOCK - lap)).to_integral_value(
                    rounding=ROUND_CEILING
                )
            )
        )
        w = M.KG_PER_M[dia] / 1000
        add(c, "REBAR", lv, D(n) * raw * w, M.FY, dia, "NET")
        laps = (pcs - 1 + lap_count) * lap
        if laps:
            add(c, "REBAR", lv, D(n) * laps * w, M.FY, dia, "LAP")
    return out


def compute(world: dict[str, Any] | None = None) -> dict[tuple[Any, ...], str]:
    members, bars = signatures(world or M.build())
    totals = evaluate(members, bars)
    return {
        k: format(
            (v / DIV[UNIT[k[1]]]).quantize(D("0.001"), rounding=ROUND_HALF_EVEN), "f"
        )
        for k, v in totals.items()
    }
