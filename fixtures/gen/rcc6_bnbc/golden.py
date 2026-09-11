"""F-RCC6-BNBC golden, path 1: member by member from the authored model (L-QTY-06: never from the
drawing). Imports the model only — never derive/emit code (cad/tests/fixtures/test_rcc6_bnbc_lint.py).

Rows: {class, kind, level, quantity, unit, formula} as F-RCC6's readers expect, plus optional
`grade`, `diameter_mm`, `component`, `members`. Kinds: RCC_CONCRETE m3 · FORMWORK m2 (SIDES / SOFFIT /
EDGE / RISERS) · REBAR kg (NET / LAP, by diameter) · PILE_LENGTH m · PILE_COUNT pcs · EXCAVATION m3 ·
BLINDING m3 · BRICKWORK m3 (AM-07 subset, informational beyond the 36 cells).
"""

from __future__ import annotations

from decimal import ROUND_CEILING, ROUND_HALF_EVEN, Decimal
from typing import Any, ClassVar

from . import model as M

D = Decimal
Q3 = D("0.001")
MM3 = D(10) ** 9
MM2 = D(10) ** 6
MM = D(1000)

# BS 8666 cutting lengths per L-FRM-05 (bend radius 2d ≤16 mm else 3.5d). SP = spiral (developed
# length authored), CT = cross tie (two 135° hooks), CRK = alternate crank (four 45° bends).
SHAPE_FORMULA: dict[str, str] = {
    "00": "A",
    "11": "A+B−0.5r−d",
    "21": "A+B+C−r−2d",
    "51": "2(A+B)+2C−2.5r−5d",
    "SP": "A",
    "CT": "A+2C−r−2d",
    "CRK": "A+2B−2r−4d",
}


def cutting_length(dia: int, shape: str, legs: list[Decimal]) -> Decimal:
    r, d = M.bend_radius(dia), D(dia)
    a = legs
    if shape in ("00", "SP"):
        return a[0]
    if shape == "11":
        return a[0] + a[1] - r / 2 - d
    if shape == "21":
        return a[0] + a[1] + a[2] - r - 2 * d
    if shape == "51":
        return 2 * (a[0] + a[1]) + 2 * a[4] - D("2.5") * r - 5 * d
    if shape == "CT":
        return a[0] + 2 * a[1] - r - 2 * d
    if shape == "CRK":
        return a[0] + 2 * a[1] - 2 * r - 4 * d
    raise KeyError(shape)


def is_additive_length(dia: int, shape: str, legs: list[Decimal]) -> Decimal:
    """IS 2502 site convention: Σ straight legs + hook allowances − bend deductions (printed, never billed)."""
    d = D(dia)
    a = legs
    if shape in ("00", "SP"):
        return a[0]
    if shape == "11":
        return a[0] + 12 * d - 2 * d if a[1] == 12 * d else a[0] + a[1] - 2 * d
    if shape == "21":
        return a[1] + 2 * (12 * d) - 2 * (2 * d)
    if shape == "51":
        return 2 * (a[0] + a[1]) + 2 * (10 * d) - 3 * (2 * d) - 2 * (3 * d)
    if shape == "CT":
        return a[0] + 2 * (10 * d) - 2 * (3 * d)
    if shape == "CRK":
        return a[0] + 2 * a[1] - 4 * d
    raise KeyError(shape)


def pieces(length: Decimal, lap: Decimal) -> int:
    if length <= M.STOCK:
        return 1
    return int(
        ((length - lap) / (M.STOCK - lap)).to_integral_value(rounding=ROUND_CEILING)
    )


def round25(length: Decimal) -> Decimal:
    return (length / 25).to_integral_value(rounding=ROUND_CEILING) * 25


def q(v: Decimal) -> str:
    return format(v.quantize(Q3, rounding=ROUND_HALF_EVEN), "f")


class Golden:
    def __init__(self, world: dict[str, Any]) -> None:
        self.w = world
        self.tot: dict[tuple[Any, ...], Decimal] = {}
        self.formula: dict[tuple[str, str], str] = {}
        self.members: dict[tuple[Any, ...], set[str]] = {}

    def add(
        self,
        cls: str,
        kind: str,
        level: str,
        amount: Decimal,
        formula: str,
        grade: str = "",
        dia: int = 0,
        comp: str = "",
        member: str = "",
    ) -> None:
        key = (cls, kind, level, grade, dia, comp)
        self.tot[key] = self.tot.get(key, D(0)) + amount
        self.formula[cls, kind] = formula
        if member:
            self.members.setdefault(key, set()).add(member)

    # -- per member ---------------------------------------------------------------------------
    def member(self, m: dict[str, Any]) -> None:
        c, lv, g, mid = m["class"], m["level"], m.get("grade", ""), m["id"]
        if c == "PILE":
            self.add(
                c,
                "RCC_CONCRETE",
                lv,
                M.PI / 4 * m["dia"] ** 2 * m["length"],
                "sum(π/4 · d² · length below cut-off)",
                g,
                member=mid,
            )
            self.add(
                c,
                "PILE_LENGTH",
                lv,
                m["length"],
                "sum(length below cut-off)",
                member=mid,
            )
            self.add(c, "PILE_COUNT", lv, D(1), "count", member=mid)
        elif c in ("PILE_CAP", "FOOTING"):
            self.add(
                c,
                "RCC_CONCRETE",
                lv,
                m["area"] * m["depth"],
                "sum(shoelace(plan) · depth)",
                g,
                member=mid,
            )
            self.add(
                c,
                "FORMWORK",
                lv,
                m["perim"] * m["depth"],
                "sum(perimeter · depth)  [sides only]",
                comp="SIDES",
                member=mid,
            )
            self.earthwork(m)
        elif c == "COLUMN":
            if m["geom"] == "CYL":
                area, per = M.PI / 4 * m["b"] ** 2, M.PI * m["b"]
            else:
                area, per = m["sx"] * m["sy"], 2 * (m["sx"] + m["sy"])
            self.add(
                c,
                "RCC_CONCRETE",
                lv,
                area * m["h"],
                "sum(b · d · floor-to-floor)  [band-aware, through joints]",
                g,
                member=mid,
            )
            self.add(
                c,
                "FORMWORK",
                lv,
                per * (m["h"] - m["t_top"]) - sum(m["beam_ends"], D(0)),
                "sum(2(b+d) · (floor-to-floor − slab t) − beam-end contacts > 500 cm²)",
                comp="SIDES",
                member=mid,
            )
        elif c == "SHEAR_WALL":
            self.add(
                c,
                "RCC_CONCRETE",
                lv,
                m["length"] * m["t"] * m["h"],
                "sum(length · t · floor-to-floor − openings)",
                g,
                member=mid,
            )
            self.add(
                c,
                "FORMWORK",
                lv,
                2 * m["length"] * m["h"] - sum(m["beam_ends"], D(0)),
                "sum(2 · length · h − beam-end contacts)",
                comp="SIDES",
                member=mid,
            )
        elif c in ("BEAM", "TIE_BEAM", "LINTEL"):
            n = D(m.get("count", 1))
            t = max(m["t_l"], m["t_r"])
            dm = (m["depth"] + m["depth2"]) / 2
            ln = m["clear"]
            self.add(
                c,
                "RCC_CONCRETE",
                lv,
                n * m["b"] * (dm - t) * ln,
                "sum(b · (D − slab t) · clear span)  [taper: mean D]",
                g,
                member=mid,
            )
            self.add(
                c,
                "FORMWORK",
                lv,
                n * ((dm - m["t_l"]) + (dm - m["t_r"])) * ln,
                "sum(((D − t_left) + (D − t_right)) · clear)",
                comp="SIDES",
                member=mid,
            )
            self.add(
                c,
                "FORMWORK",
                lv,
                n * m["b"] * ln,
                "sum(b · clear)",
                comp="SOFFIT",
                member=mid,
            )
            if m.get("sunshade"):
                proj, ts = (D(v) for v in m["sunshade"])
                self.add(
                    c,
                    "RCC_CONCRETE",
                    lv,
                    n * proj * ts * ln,
                    "sum(b · (D − slab t) · clear span)  [taper: mean D]",
                    g,
                    member=mid,
                )
                self.add(
                    c,
                    "FORMWORK",
                    lv,
                    n * (proj * ln + ts * (ln + 2 * proj)),
                    "sum(sunshade soffit + edge)",
                    comp="SOFFIT",
                    member=mid,
                )
        elif c == "SLAB":
            self.slab(m)
        elif c == "STAIR":
            if m["geom"] == "FLIGHT":
                waist = m["sloped"] * m["width"] * m["waist"]
                steps = (
                    m["tread"] * m["rise_total"] / 2 * m["width"]
                )  # risers × ½ · tread · rise, rise = total/risers
                self.add(
                    c,
                    "RCC_CONCRETE",
                    lv,
                    waist + steps,
                    "sum(sloped · width · waist + risers · ½ · tread · rise · width) + landings area · t",
                    g,
                    member=mid,
                )
                self.add(
                    c,
                    "FORMWORK",
                    lv,
                    m["sloped"] * m["width"],
                    "sum(flight soffit + landing soffit)",
                    comp="SOFFIT",
                    member=mid,
                )
                self.add(
                    c,
                    "FORMWORK",
                    lv,
                    m["rise_total"] * m["width"],
                    "sum(risers · rise · width)",
                    comp="RISERS",
                    member=mid,
                )
                self.add(
                    c,
                    "FORMWORK",
                    lv,
                    2 * m["sloped"] * m["waist"],
                    "sum(2 · sloped · waist)  [strings]",
                    comp="SIDES",
                    member=mid,
                )
            else:
                self.add(
                    c,
                    "RCC_CONCRETE",
                    lv,
                    m["area"] * m["t"],
                    "sum(sloped · width · waist + risers · ½ · tread · rise · width) + landings area · t",
                    g,
                    member=mid,
                )
                self.add(
                    c,
                    "FORMWORK",
                    lv,
                    m["area"],
                    "sum(flight soffit + landing soffit)",
                    comp="SOFFIT",
                    member=mid,
                )
        elif c == "WALL":
            self.add(
                c,
                "RCC_CONCRETE",
                lv,
                m["length"] * m["t"] * m["h"],
                "sum(length · t · h)",
                g,
                member=mid,
            )
            self.add(
                c,
                "FORMWORK",
                lv,
                D(m["faces"]) * m["length"] * m["h"],
                "sum(faces · length · h)",
                comp="SIDES",
                member=mid,
            )
        elif c == "BRICK_WALL":
            self.add(
                c,
                "BRICKWORK",
                lv,
                (m["length"] * m["h"] - m["openings"]) * m["t"],
                "sum((length · h − scheduled openings) · nominal t)",
                comp=str(m["t"]),
                member=mid,
            )

    def slab(self, m: dict[str, Any]) -> None:
        c, lv, g, mid = "SLAB", m["level"], m["grade"], m["id"]
        holes = sum(
            (h["area"] for h in m["holes"] if h["deducted"] and not h.get("outside")),
            D(0),
        )
        slope = m.get("slope", D(1))
        net = (m["area"] - holes - m["col_deduct"]) * slope
        tm = (m["t"] + m.get("t2", m["t"])) / 2
        self.add(
            c,
            "RCC_CONCRETE",
            lv,
            net * tm,
            "sum((area − openings > 0.1 m² − column/wall plan) · t)  [taper: mean t; ramp: sloped area]",
            g,
            member=mid,
        )
        if m.get("sunken"):
            per = M.perimeter(m["poly"])
            self.add(
                c,
                "RCC_CONCRETE",
                lv,
                per * D(125) * (M.SUNKEN_DROP - m["t"]),
                "sum((area − openings > 0.1 m² − column/wall plan) · t)  [taper: mean t; ramp: sloped area]",
                g,
                member=mid,
            )
            self.add(
                c,
                "FORMWORK",
                lv,
                2 * per * (M.SUNKEN_DROP - m["t"]),
                "sum(sunken drop faces)",
                comp="SIDES",
                member=mid,
            )
        if not m.get("on_ground"):
            self.add(
                c,
                "FORMWORK",
                lv,
                net - m["beam_soffit"] * slope,
                "sum(net area − beam soffits)",
                comp="SOFFIT",
                member=mid,
            )
        edge = m["free_edge"] * m.get("t2", m["t"])
        for h in m["holes"]:
            if h["deducted"] and not h.get("outside") and h["kind"] != "SUNKEN":
                r = h.get("rect")
                per = 2 * ((r[2] - r[0]) + (r[3] - r[1])) if r else D(2400)
                edge += per * m["t"]
        if edge:
            self.add(
                c,
                "FORMWORK",
                lv,
                edge,
                "sum(free edges · t + opening reveals · t)",
                comp="EDGE",
                member=mid,
            )
        if m.get("on_ground"):
            t_bl = (
                D(M.SITE["sog_blinding_thickness_mm"])
                if m["mark"] in ("SOG", "RAMP")
                else D(M.SITE["blinding_thickness_mm"])
            )
            p = (
                D(0)
                if m["mark"] in ("SOG", "RAMP")
                else D(M.SITE["blinding_projection_mm"])
            )
            bb = M.Build.bbox(m["poly"])
            area = net if p == 0 else (bb[2] - bb[0] + 2 * p) * (bb[3] - bb[1] + 2 * p)
            self.add(
                c,
                "BLINDING",
                lv,
                area * t_bl,
                "sum((L + 2p) · (B + 2p) · t)  [slab on grade: net area · 75]",
                comp="CC",
                member=mid,
            )
            if m["mark"] not in ("SOG", "RAMP"):
                a, dx = D(M.SITE["working_allowance_mm"]), D(M.SITE["depth_extra_mm"])
                depth = (
                    D(M.SITE["egl_mm"])
                    - (
                        M.UGWR["bottom"]
                        if m["id"].startswith("UGWR")
                        else M.SEPTIC["bottom"]
                    )
                    + t_bl
                )
                self.add(
                    "WALL",
                    "EXCAVATION",
                    lv,
                    (bb[2] - bb[0] + 2 * a) * (bb[3] - bb[1] + 2 * a) * (depth + dx),
                    "sum((L + 2a) · (B + 2a) · (depth + dx))  [pits from EGL to blinding underside]",
                    comp="PIT",
                    member=mid,
                )

    def earthwork(self, m: dict[str, Any]) -> None:
        bb = M.Build.bbox(m["poly"])
        a, dx, p, tb = (
            D(M.SITE[k])
            for k in (
                "working_allowance_mm",
                "depth_extra_mm",
                "blinding_projection_mm",
                "blinding_thickness_mm",
            )
        )
        depth = D(M.SITE["egl_mm"]) - (m["top"] - m["depth"]) + tb
        self.add(
            m["class"],
            "EXCAVATION",
            m["level"],
            (bb[2] - bb[0] + 2 * a) * (bb[3] - bb[1] + 2 * a) * (depth + dx),
            "sum((L + 2a) · (B + 2a) · (depth + dx))  [polygon caps by bounding box; EGL −1'-6\"]",
            comp="PIT",
            member=m["id"],
        )
        self.add(
            m["class"],
            "BLINDING",
            m["level"],
            (bb[2] - bb[0] + 2 * p) * (bb[3] - bb[1] + 2 * p) * tb,
            "sum((L + 2p) · (B + 2p) · t)",
            comp="CC",
            member=m["id"],
        )

    def rebar(self, b: dict[str, Any]) -> dict[str, Any]:
        parent = D(self.w_by_id[b["member"]].get("count", 1))
        n = D(b["n"]) * parent
        raw = cutting_length(b["dia"], b["shape"], b["legs"])
        k = M.KG_PER_M[b["dia"]] / MM
        pcs = pieces(raw, b["lap_mm"])
        lap_total = (pcs - 1 + b["lap_count"]) * b["lap_mm"]
        self.add(
            b["class"],
            "REBAR",
            b["level"],
            raw * n * k,
            "sum(BS 8666 cutting length · bars · table kg/m)  [net of laps]",
            M.FY,
            b["dia"],
            "NET",
            b["member"],
        )
        if lap_total:
            self.add(
                b["class"],
                "REBAR",
                b["level"],
                lap_total * n * k,
                "sum(BS 8666 cutting length · bars · table kg/m)  [net of laps]",
                M.FY,
                b["dia"],
                "LAP",
                b["member"],
            )
        self.raw_kg.append((b["dia"], (raw + lap_total) * n * k))
        return {
            "member": b["member"],
            "class": b["class"],
            "level": b["level"],
            "mark": b["mark"],
            "bar_mark": b["bar_mark"],
            "role": b["role"],
            "dia_mm": b["dia"],
            "shape": b["shape"],
            "dims_mm": {k2: q(v) for k2, v in zip("ABCDEF", b["legs"], strict=False)},
            "cutting_raw_mm": q(raw),
            "cutting_rounded_mm": str(round25(raw)),
            "cutting_is_additive_mm": q(
                is_additive_length(b["dia"], b["shape"], b["legs"])
            ),
            "pieces_per_bar": pcs,
            "lap_mm": str(b["lap_mm"]) if lap_total else "0",
            "laps_per_bar": pcs - 1 + b["lap_count"],
            "bars_per_unit": b["n"],
            "parent_count": str(parent),
            "bars": str(n),
            "kg": q((raw + lap_total) * n * k),
            "kg_net": q(raw * n * k),
            "kg_lap": q(lap_total * n * k),
        }

    # -- assembly -----------------------------------------------------------------------------
    def compute(self) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        self.w_by_id = {m["id"]: m for m in self.w["members"]}
        self.raw_kg: list[tuple[int, Decimal]] = []
        for m in self.w["members"]:
            self.member(m)
        bbs = [self.rebar(b) for b in self.w["bars"]]
        return self.rows(), self.bbs(bbs)

    UNIT: ClassVar[dict[str, tuple[str, Decimal]]] = {
        "RCC_CONCRETE": ("m3", MM3),
        "FORMWORK": ("m2", MM2),
        "REBAR": ("kg", D(1)),
        "PILE_LENGTH": ("m", MM),
        "PILE_COUNT": ("pcs", D(1)),
        "EXCAVATION": ("m3", MM3),
        "BLINDING": ("m3", MM3),
        "BRICKWORK": ("m3", MM3),
    }
    LEVELS: ClassVar[list[str]] = [
        "PILE",
        "FDN",
        "PIT",
        "GF",
        "1F",
        "2F",
        "3F",
        "4F",
        "5F",
        "6F",
        "ROOF",
        "SRR",
        "OHWT",
    ]
    CLASSES: ClassVar[list[str]] = [
        "PILE",
        "PILE_CAP",
        "FOOTING",
        "TIE_BEAM",
        "COLUMN",
        "SHEAR_WALL",
        "BEAM",
        "SLAB",
        "STAIR",
        "LINTEL",
        "WALL",
        "BRICK_WALL",
    ]

    def rows(self) -> list[dict[str, Any]]:
        out = []
        order = {c: i for i, c in enumerate(self.CLASSES)}
        lorder = {lv: i for i, lv in enumerate(self.LEVELS)}
        korder = {k: i for i, k in enumerate(self.UNIT)}
        for key in sorted(
            self.tot,
            key=lambda k: (order[k[0]], korder[k[1]], lorder[k[2]], k[3], k[4], k[5]),
        ):
            cls, kind, level, grade, dia, comp = key
            unit, div = self.UNIT[kind]
            row: dict[str, Any] = {"class": cls, "kind": kind, "level": level}
            if grade:
                row["grade"] = grade
            if dia:
                row["diameter_mm"] = dia
            if comp:
                row["component"] = comp
            row.update(
                {
                    "quantity": q(self.tot[key] / div),
                    "unit": unit,
                    "formula": self.formula[cls, kind],
                    "members": sorted(self.members.get(key, ())),
                }
            )
            out.append(row)
        return out

    def bbs(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        per_dia: dict[int, Decimal] = {}
        per_mark: dict[str, Decimal] = {}
        stock: dict[int, dict[str, Any]] = {}
        for dia, kg in self.raw_kg:
            per_dia[dia] = per_dia.get(dia, D(0)) + kg
        for r in rows:
            per_mark[r["mark"]] = per_mark.get(r["mark"], D(0)) + D(r["kg"])
        for dia in sorted(per_dia):
            # cutting stock: best-fit-decreasing over capacity buckets (identical pieces grouped), 12 m stock
            groups: dict[Decimal, int] = {}
            for r in rows:
                if r["dia_mm"] != dia:
                    continue
                raw, pcs, lap = (
                    D(r["cutting_raw_mm"]),
                    r["pieces_per_bar"],
                    D(r["lap_mm"]),
                )
                n = int(D(r["bars"]))
                if pcs == 1:
                    groups[raw] = groups.get(raw, 0) + n
                else:
                    per_piece = (raw + (pcs - 1) * lap) / pcs
                    groups[per_piece] = groups.get(per_piece, 0) + n * pcs
            bins: dict[Decimal, int] = {}
            for length in sorted(groups, reverse=True):
                qty = groups[length]
                for cap in sorted(bins, reverse=True):
                    if qty == 0:
                        break
                    if cap >= length and bins[cap] > 0:
                        take = min(qty, bins[cap])
                        bins[cap] -= take
                        bins[cap - length] = bins.get(cap - length, 0) + take
                        qty -= take
                if qty:
                    per_bar = int(
                        (M.STOCK / length).to_integral_value(rounding="ROUND_FLOOR")
                    )
                    full, rest = divmod(qty, per_bar)
                    if full:
                        bins[M.STOCK - per_bar * length] = (
                            bins.get(M.STOCK - per_bar * length, 0) + full
                        )
                    if rest:
                        bins[M.STOCK - rest * length] = (
                            bins.get(M.STOCK - rest * length, 0) + 1
                        )
            n_bins = sum(bins.values())
            offcut = sum((cap * n for cap, n in bins.items()), D(0))
            stock[dia] = {
                "stock_bars_12m": n_bins,
                "pieces": sum(groups.values()),
                "offcut_m": q(offcut / MM),
                "method": "best-fit-decreasing over capacity buckets, identical pieces grouped",
            }
        return {
            "fixture": "F-RCC6-BNBC",
            "schema": 2,
            "stock_mm": str(M.STOCK),
            "rounding_mm": 25,
            "rows": rows,
            "per_diameter_kg": {str(k): q(v) for k, v in sorted(per_dia.items())},
            "per_mark_kg": {k: q(v) for k, v in sorted(per_mark.items())},
            "cutting_stock": {str(k): v for k, v in stock.items()},
            "grand_total_kg": q(sum(per_dia.values(), D(0))),
        }


def compute(
    world: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return Golden(world or M.build()).compute()
