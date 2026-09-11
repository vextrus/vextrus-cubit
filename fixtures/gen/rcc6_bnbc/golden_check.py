"""F-RCC6-BNBC golden, path 2: aggregation by mark × placements over geometry it derives ITSELF.

This path reads only the raw authored inputs — the grid, levels and catalogues in model.py and, per
member, the authored fields (mark, level, axis end points, supports, polygons, thicknesses, section
marks, bar legs). It never reads a derived field (`clear`, `area`, `col_deduct`, `beam_soffit`,
`beam_ends`, `h`, `t_top`, `perim`, `extents`, column rectangles, stair slopes …): those are poisoned
in cad/tests/fixtures/test_rcc6_bnbc_lint.py and the key strings are forbidden in this file. Spans,
areas, deductions and contact faces are recomputed here with this module's own geometry code, folded
into signatures with placement counts, and evaluated once per signature. Bars are authored data, but
every beam main bar's A is re-derived from this path's own clear span and must match the authored leg.
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
EDGE = D(125)
Pt = tuple[Decimal, Decimal]


# -- own geometry ------------------------------------------------------------------------------
def area_of(poly: list[Pt]) -> Decimal:
    return (
        abs(
            sum(
                (
                    poly[i][0] * poly[(i + 1) % len(poly)][1]
                    - poly[(i + 1) % len(poly)][0] * poly[i][1]
                    for i in range(len(poly))
                ),
                D(0),
            )
        )
        / 2
    )


def perim_of(poly: list[Pt]) -> Decimal:
    return sum(
        (
            (
                (poly[(i + 1) % len(poly)][0] - p[0]) ** 2
                + (poly[(i + 1) % len(poly)][1] - p[1]) ** 2
            ).sqrt()
            for i, p in enumerate(poly)
        ),
        D(0),
    )


def box(poly: list[Pt]) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    return (min(xs), min(ys), max(xs), max(ys))


def overlap(a: tuple[Decimal, ...], b: tuple[Decimal, ...]) -> Decimal:
    w, h = min(a[2], b[2]) - max(a[0], b[0]), min(a[3], b[3]) - max(a[1], b[1])
    return w * h if w > 0 and h > 0 else D(0)


def storey_of(level: str) -> str:
    return next((s for s, top in M.STOREY_TOP.items() if top == level), "FDN")


def storey_h(storey: str) -> Decimal:
    return M.ELEV[M.STOREY_TOP[storey]] - (
        M.ELEV["PCTOP"] if storey == "FDN" else M.ELEV[storey]
    )


def band_of(mark: str, storey: str) -> tuple[int, int, int, int]:
    bands = M.COLUMN_MARKS[mark]["bands"]
    for i, (_, storeys) in enumerate(M.BANDS):
        if storey in storeys:
            return bands[min(i, len(bands) - 1)]
    raise KeyError(storey)


def col_poly(stack: dict[str, Any], storey: str) -> tuple[list[Pt], Decimal, Decimal]:
    """Own derivation of the column plan: band section, outer face flush with band 1 (S-11 set-out)."""
    b0, d0, *_ = M.COLUMN_MARKS[stack["mark"]]["bands"][0]
    b, d, *_ = band_of(stack["mark"], storey)
    along_y = stack["axis"] == "y"
    sx, sy = (D(b), D(d)) if along_y else (D(d), D(b))
    sx0, sy0 = (D(b0), D(d0)) if along_y else (D(d0), D(b0))
    cx = stack["x"] + stack["outer"][0] * (sx0 - sx) / 2
    cy = stack["y"] + stack["outer"][1] * (sy0 - sy) / 2
    if stack.get("rot_deg"):
        hx, hy, k = D(d) / 2, D(b) / 2, D(1) / D(2).sqrt()
        return (
            [
                (cx + (x - y) * k, cy + (x + y) * k)
                for x, y in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))
            ],
            sx,
            sy,
        )
    return (
        [
            (cx - sx / 2, cy - sy / 2),
            (cx + sx / 2, cy - sy / 2),
            (cx + sx / 2, cy + sy / 2),
            (cx - sx / 2, cy + sy / 2),
        ],
        sx,
        sy,
    )


def outline(level: str) -> list[Pt]:
    x0, x1, y0, y1 = -EDGE, M.X["6"] + EDGE, -EDGE, M.Y["E"] + EDGE
    c = M.ft(43) + EDGE * D(2).sqrt()
    front = (
        [(M.X["2"], y0), (M.X["2"], -M.BALCONY["depth"]), (x1, -M.BALCONY["depth"])]
        if level in M.FLOORS and level != "ROOF"
        else [(x1, y0)]
    )
    return [(x0, y0), *front, (x1, y1), (y1 - c, y1), (x0, x0 + c)]


class Derive:
    """Second, independent derivation of every geometric quantity the golden needs."""

    def __init__(self, world: dict[str, Any]) -> None:
        self.w = world
        self.by_id = {m["id"]: m for m in world["members"]}
        self.stacks = {s["id"]: s for s in M._stacks()}
        self.clear: dict[str, Decimal] = {}
        self.length: dict[str, Decimal] = {}
        self.ends: Counter[str] = Counter()
        for m in world["members"]:
            if m["class"] in ("BEAM", "TIE_BEAM"):
                self.span(m)

    def support_poly(self, kind: str, sid: str, storey: str) -> list[Pt] | None:
        if kind == "COLUMN":
            return col_poly(self.stacks[sid], storey)[0]
        if kind == "WALL":
            w = self.by_id[f"SW1-{sid}@{storey}"]
            return [
                (w["x0"], w["y0"]),
                (w["x1"], w["y0"]),
                (w["x1"], w["y1"]),
                (w["x0"], w["y1"]),
            ]
        if kind == "CAP":
            return (
                self.by_id[f"PC-{sid}"]["poly"]
                if f"PC-{sid}" in self.by_id
                else self.by_id["F1"]["poly"]
            )
        return None

    def extent(self, kind: str, sid: str, storey: str, pos: Pt, u: Pt) -> Decimal:
        if kind == "COLUMN" and M.COLUMN_MARKS[self.stacks[sid]["mark"]].get(
            "circular"
        ):
            return D(band_of(self.stacks[sid]["mark"], storey)[0]) / 2
        if kind == "BEAM":
            return D(M.BEAM_TYPES[self.by_id[sid]["type"]]["b"]) / 2
        poly = self.support_poly(kind, sid, storey)
        if poly is None:
            return D(0)
        return max((vx - pos[0]) * u[0] + (vy - pos[1]) * u[1] for vx, vy in poly)

    def span(self, m: dict[str, Any]) -> None:
        p0, p1 = m["p0"], m["p1"]
        chord = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2).sqrt()
        u0 = ((p1[0] - p0[0]) / chord, (p1[1] - p0[1]) / chord)
        u1 = (-u0[0], -u0[1])
        length = chord
        if m.get(
            "curved"
        ):  # EB1's arc: straight to the curve start, then a quarter circle to A6
            r = M.BALCONY["r"] - EDGE
            length = (M.X["6"] - M.BALCONY["r"] - M.X["5"]) + M.PI * r / 2
            u0, u1 = (D(1), D(0)), (D(0), D(-1))
        storey = m["storey"]
        e0 = self.extent(m["supports"][0][0], m["supports"][0][1], storey, p0, u0)
        e1 = self.extent(m["supports"][1][0], m["supports"][1][1], storey, p1, u1)
        self.length[m["id"]], self.clear[m["id"]] = length, length - e0 - e1
        bt = M.BEAM_TYPES[m["type"]]
        for (kind, sid), depth in (
            (m["supports"][0], D(bt["D"])),
            (m["supports"][1], D(bt.get("D2", bt["D"]))),
        ):
            contact = D(bt["b"]) * (depth - max(m["t_l"], m["t_r"]))
            if kind in ("COLUMN", "WALL") and contact > M.END_NO_DEDUCT_MM2:
                key = (
                    f"COL:{sid}@{storey}" if kind == "COLUMN" else f"SW1-{sid}@{storey}"
                )
                if key in self.by_id:
                    self.ends[key] += contact

    def plan_deductions(self, p: dict[str, Any]) -> tuple[Decimal, Decimal]:
        """Column/wall plan area inside a panel and beam plan area under it (own overlap code)."""
        level, storey = p["level"], storey_of(p["level"])
        bb = box(p["poly"])
        cols = D(0)
        for s in self.stacks.values():
            if storey in s["storeys"] and not s.get("porch"):
                poly, sx, sy = col_poly(s, storey)
                if s.get("rot_deg"):
                    cx, cy = (
                        sum((q[0] for q in poly), D(0)) / 4,
                        sum((q[1] for q in poly), D(0)) / 4,
                    )
                    cols += (
                        sx * sy
                        if bb[0] <= cx <= bb[2] and bb[1] <= cy <= bb[3]
                        else D(0)
                    )
                else:
                    cols += overlap(bb, box(poly))
        for w in self.w["members"]:
            if w["class"] == "SHEAR_WALL" and w["level"] == storey:
                cols += overlap(bb, (w["x0"], w["y0"], w["x1"], w["y1"]))
        soffit = D(0)
        for bm in self.w["members"]:
            if (
                bm["class"] != "BEAM"
                or bm["level"] != level
                or max(bm["t_l"], bm["t_r"]) == 0
            ):
                continue
            (x0, y0), (x1, y1), hb = bm["p0"], bm["p1"], bm["b"] / 2
            if x0 == x1 or y0 == y1:
                ex, ey = (
                    (hb, D(0)) if x0 == x1 else (D(0), hb)
                )  # a y-beam widens in x, an x-beam in y
                soffit += overlap(
                    bb,
                    (
                        min(x0, x1) - ex,
                        min(y0, y1) - ey,
                        max(x0, x1) + ex,
                        max(y0, y1) + ey,
                    ),
                )
            else:
                mx, my = (x0 + x1) / 2, (y0 + y1) / 2
                host = next(
                    q
                    for q in self.w["regions"][level]
                    if not q["sunken"]
                    and box(q["poly"])[0] <= mx <= box(q["poly"])[2]
                    and box(q["poly"])[1] <= my <= box(q["poly"])[3]
                )
                if host is p:
                    soffit += bm["b"] * self.length[bm["id"]]
        return cols, soffit

    def slab_top_over(self, m: dict[str, Any]) -> Decimal:
        top = M.STOREY_TOP[m["level"]]
        poly, _, _ = col_poly(self.stacks[m["stack"]], m["level"])
        cx, cy = (
            sum((q[0] for q in poly), D(0)) / 4,
            sum((q[1] for q in poly), D(0)) / 4,
        )
        ts = [
            q["t"]
            for q in self.w["regions"].get(top, [])
            if not q.get("on_ground")
            and box(q["poly"])[0] - 1 <= cx <= box(q["poly"])[2] + 1
            and box(q["poly"])[1] - 1 <= cy <= box(q["poly"])[3] + 1
        ]
        return max(ts) if ts else D(125)


def generic_cutting_length(dia: int, shape: str, legs: tuple[Decimal, ...]) -> Decimal:
    r, d = M.bend_radius(dia), D(dia)
    mult = LEG_MULT.get(shape, (1,) * len(legs))
    return sum((D(k) * leg for k, leg in zip(mult, legs, strict=True)), D(0)) - BENDS[
        shape
    ] * (r / 2 + d)


def signatures(
    world: dict[str, Any],
) -> tuple[Counter[tuple[Any, ...]], Counter[tuple[Any, ...]]]:
    """Fold members and bars into hashable signatures with placement counts, geometry derived here."""
    dv = Derive(world)
    members: Counter[tuple[Any, ...]] = Counter()
    for m in world["members"]:
        c, lv, g = m["class"], m["level"], m.get("grade", "")
        if c == "PILE":
            members[(c, lv, g, "CYL", m["dia"], m["length"])] += 1
        elif c in ("PILE_CAP", "FOOTING"):
            bb = box(m["poly"])
            members[
                (
                    c,
                    lv,
                    g,
                    "POLY",
                    area_of(m["poly"]),
                    perim_of(m["poly"]),
                    m["depth"],
                    bb[2] - bb[0],
                    bb[3] - bb[1],
                    m["top"],
                )
            ] += 1
        elif c == "COLUMN":
            b, d, *_ = band_of(m["mark"], m["level"])
            if m["geom"] == "CYL":
                per, ar = M.PI * D(b), M.PI / 4 * D(b) ** 2
            else:
                per, ar = 2 * (D(b) + D(d)), D(b) * D(d)
            t_top = D(0) if m["level"] == "FDN" else dv.slab_top_over(m)
            members[
                (
                    c,
                    lv,
                    g,
                    "COL",
                    per,
                    ar,
                    storey_h(m["level"]),
                    t_top,
                    dv.ends[m["id"]],
                )
            ] += 1
        elif c == "SHEAR_WALL":
            length = max(m["x1"] - m["x0"], m["y1"] - m["y0"])
            h = storey_h(lv) if lv != "PIT" else M.ELEV["PCTOP"] - M.CORE["pit_bottom"]
            members[(c, lv, g, "WALL", length, m["t"], h, D(2), dv.ends[m["id"]])] += 1
        elif c == "WALL":
            if m["mark"] == "PP1":
                length, t, h = (
                    perim_of(outline("ROOF")),
                    D(M.PARAPET["t"]),
                    M.PARAPET["h"],
                )
            else:  # tank walls from the tank catalogues: N/S legs span the outer length, E/W the inner width
                tid, leg = m["id"].split("-W")
                cat = {"OHWT": M.OHWT, "UGWR": M.UGWR, "ST": M.SEPTIC}[tid]
                inner_ly = D(cat["ly"]) * cat.get("chambers", 1) + D(
                    cat.get("baffle", 0)
                )
                if leg.startswith("BF"):
                    length, t = D(cat["lx"]), D(cat["baffle"])
                elif leg in ("N", "S"):
                    length, t = D(cat["lx"]) + 2 * D(cat["wall"]), D(cat["wall"])
                else:
                    length, t = inner_ly, D(cat["wall"])
                h = D(cat["h"])
            members[(c, lv, g, "WALL", length, t, h, D(m["faces"]), D(0))] += 1
        elif c in ("BEAM", "TIE_BEAM", "LINTEL"):
            bt = M.BEAM_TYPES[m["type"]]
            ln = (m["opening_w"] + 600) if c == "LINTEL" else dv.clear[m["id"]]
            ss = tuple(D(v) for v in bt["sunshade"]) if bt.get("sunshade") else ()
            members[
                (
                    c,
                    lv,
                    g,
                    "BEAM",
                    D(bt["b"]),
                    (D(bt["D"]) + D(bt.get("D2", bt["D"]))) / 2,
                    m["t_l"],
                    m["t_r"],
                    ln,
                    ss,
                )
            ] += int(m.get("count", 1))
        elif c == "SLAB":
            gross = area_of(m["poly"]) - (
                M.balcony_corner_cut() if m["mark"] == "CS1" else D(0)
            )

            def hole_area(h: dict[str, Any]) -> Decimal:
                r = h.get("rect")
                return (
                    (r[2] - r[0]) * (r[3] - r[1])
                    if r
                    else D(M.OHWT["manhole"][0]) * D(M.OHWT["manhole"][1])
                    if h["kind"] == "MANHOLE"
                    else area_of(h["poly"])
                )

            holes = sum(
                (
                    hole_area(h)
                    for h in m["holes"]
                    if not h.get("outside")
                    and (
                        h["kind"] in ("SUNKEN", "MANHOLE", "LIFT_PIT", "RAMP")
                        or hole_area(h) > M.OPENING_THRESHOLD_MM2
                    )
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
                if not h.get("outside")
                and h["kind"] != "SUNKEN"
                and (h["kind"] == "MANHOLE" or hole_area(h) > M.OPENING_THRESHOLD_MM2)
            )
            cols, soffit = (
                dv.plan_deductions(m)
                if m.get("region") != "tank" and lv != "PIT"
                else (D(0), D(0))
            )
            run, rise = M.RAMP["y1"] - M.RAMP["y0"], M.RAMP["rise"]
            slope = (run**2 + rise**2).sqrt() / run if m["mark"] == "RAMP" else D(1)
            free = {
                "CS1": (M.X["6"] + EDGE - M.X["2"])
                + M.BALCONY["depth"]
                + (M.PI * M.BALCONY["r"] / 2 - 2 * M.BALCONY["r"]),
                "PS1": perim_of(m["poly"]) - (M.X["5"] - M.X["4"]),
            }.get(m["mark"], perim_of(m["poly"]) if m["mark"].endswith("-T") else D(0))
            bb = box(m["poly"])
            members[
                (
                    c,
                    lv,
                    g,
                    "SLAB",
                    gross - holes - cols,
                    slope,
                    m["t"],
                    m.get("t2", m["t"]),
                    soffit,
                    free,
                    reveals,
                    perim_of(m["poly"]) if m.get("sunken") else D(0),
                    m["mark"] if m.get("on_ground") else "",
                    bb[2] - bb[0],
                    bb[3] - bb[1],
                    m["id"][:2] if m.get("on_ground") else "",
                )
            ] += 1
        elif c == "STAIR":
            if m["geom"] == "FLIGHT":
                half = storey_h(lv) / 2
                run = (D(m["risers"]) - 1) * m["tread"]
                members[
                    (
                        c,
                        lv,
                        g,
                        "FLIGHT",
                        (run**2 + half**2).sqrt(),
                        m["width"],
                        m["waist"],
                        m["tread"],
                        half,
                    )
                ] += 1
            else:
                members[(c, lv, g, "LANDING", area_of(m["poly"]), m["t"])] += 1
        elif c == "BRICK_WALL":
            length = (
                m["partition_length"]
                if m["mark"] == "BW125"
                else perim_of(outline(lv))
                - (M.X["6"] - M.X["2"])
                - 2 * M.BALCONY["depth"]
            )
            members[
                (
                    c,
                    lv,
                    g,
                    "BRICK",
                    length,
                    storey_h(storey_of(lv)) - 450,
                    m["openings"],
                    m["t"],
                )
            ] += 1
    bars: Counter[tuple[Any, ...]] = Counter()
    for b in world["bars"]:
        host = dv.by_id[b["member"]]
        if host["class"] in ("BEAM", "TIE_BEAM") and b["role"] in (
            "MAIN",
            "EXTRA_BOTTOM",
        ):  # tie the authored legs to this path's span
            ln = dv.clear[host["id"]]
            want = {
                "MAIN": ln
                + 2
                * D((M.LD if b["bar_mark"].endswith("-b") else M.LD_TOP) * b["dia"]),
                "EXTRA_BOTTOM": ln / 2,
            }[b["role"]]
            assert b["legs"][0] == want, (
                b["member"],
                b["bar_mark"],
                b["legs"][0],
                want,
            )
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
        ] += b["n"] * int(host.get("count", 1))
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
