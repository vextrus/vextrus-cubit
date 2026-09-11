"""F-RCC6-BNBC self-checks (E-fixture §3.10). Runs before any byte is written; a failure writes nothing.

Wave A covers the model and the golden: two-path agreement, schedule coverage, geometry (beams vs
openings, supports, shoelace, tiling, risers), ACI 318 / BNBC plausibility, BBS reconciliation, the
36 M3 cells, registered traps, determinism. Wave B adds the drawn-string and sanity-tally checks.
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from . import golden, golden_check
from . import model as M

D = Decimal
HERE = Path(__file__).resolve().parent
LEGAL_SUPPORT = {"COLUMN", "WALL", "CAP", "BEAM", "JOINT", "FREE"}


def key(r: dict[str, Any]) -> tuple[Any, ...]:
    return (
        r["class"],
        r["kind"],
        r["level"],
        r.get("grade", ""),
        r.get("diameter_mm", 0),
        r.get("component", ""),
    )


def schedule_marks() -> dict[str, list[str]]:
    """Which schedule/detail sheet lists each member mark (S-xx per E-fixture §3.4)."""
    return {
        "S-05": ["P"],
        "S-06": sorted(M.CAPS),
        "S-07": ["F1"],
        "S-09": sorted({b for b in M.BEAM_TYPES if b.startswith("GB")}),
        "S-11": sorted(M.COLUMN_MARKS),
        "S-23": ["SW1", "PIT", "LPS"],
        "S-16": [
            "TG1",
            *[f"1B{i}" for i in range(1, 60)],
            "1CB1",
            "1CB2",
            "1CB3",
            "1CB4",
            "1EB1",
            "1EB2",
            "PB4",
            "PB5",
        ],
        "S-17": [f"B{i}" for i in range(1, 60)]
        + ["CB1", "CB2", "CB3", "CB4", "EB1", "EB2", "LB1"],
        "S-18": [f"RB{i}" for i in range(1, 60)]
        + ["REB2", "SB-R1", "SB-R2", "SB-R3", "SB-R4"],
        "S-19": ["CS1", "SS1", "PS1", "FL"],
        "S-20": [f"S{i}" for i in range(1, 11)],
        "S-08": ["SOG", "RAMP"],
        "S-21": [f"R{i}" for i in range(1, 30)] + ["SRR", "MRR", "PP1"],
        "S-22": ["FL1", "FL2", "ML1"],
        "S-24": [
            "OHWT-B",
            "OHWT-T",
            "OHWT-W",
            "UGWR-B",
            "UGWR-T",
            "UGWR-W",
            "ST-B",
            "ST-T",
            "ST-W",
        ],
        "S-25": ["L1", "L2", "LS1", "BW250", "BW125"],
    }


def run(world: dict[str, Any] | None = None) -> dict[str, Any]:
    w = world or M.build()
    g = golden.Golden(w)
    rows, bbs = g.compute()
    report: dict[str, Any] = {}

    # 1. two paths agree row for row
    p2 = golden_check.compute(w)
    p1 = {key(r): r["quantity"] for r in rows}
    diffs = [
        (k, p1.get(k), p2.get(k))
        for k in sorted(set(p1) | set(p2), key=repr)
        if p1.get(k) != p2.get(k)
    ]
    assert not diffs, diffs[:5]
    report["two_path_agreement"] = (
        f"{len(rows)} rows identical (member-by-member vs mark × placements)"
    )

    # 2. every mark on a schedule; every bar mark belongs to a scheduled member
    scheduled = {m for marks in schedule_marks().values() for m in marks}
    unscheduled = sorted({m["mark"] for m in w["members"]} - scheduled)
    assert not unscheduled, unscheduled
    assert all(b["mark"] in scheduled for b in w["bars"])

    # 3. geometry: no beam crosses an opening; every beam end has a support; areas; tiling; risers
    by_id = {m["id"]: m for m in w["members"]}
    stacks = {s["id"]: s for s in M._stacks()}
    for m in w["members"]:
        if m["class"] in ("BEAM", "TIE_BEAM"):
            assert m["clear"] > 0, (
                m["id"],
                m["clear"],
            )  # a beam on its own support is a modelling fault
            for kind, sid in m["supports"]:
                assert kind in LEGAL_SUPPORT, (m["id"], kind)
                if kind == "COLUMN":
                    assert m["storey"] in stacks[sid]["storeys"], (m["id"], sid)
                if kind == "BEAM":
                    assert sid in by_id, (m["id"], sid)
            for end, (kind, sid) in enumerate(m["supports"]):
                pos, u = m["p0" if end == 0 else "p1"], m["end_dirs"][end]
                if kind != "COLUMN" or stacks[sid].get("rot_deg") or (u[0] and u[1]):
                    continue  # the 45° column and the diagonal porch beams are checked in golden_check
                r = M.column_rect(stacks[sid], m["storey"])
                if u[0]:  # the face the span leaves from, along ±x
                    face = (
                        (r["cx"] + r["sx"] / 2) if u[0] > 0 else (r["cx"] - r["sx"] / 2)
                    )
                    want = (face - pos[0]) * u[0]
                else:
                    face = (
                        (r["cy"] + r["sy"] / 2) if u[1] > 0 else (r["cy"] - r["sy"] / 2)
                    )
                    want = (face - pos[1]) * u[1]
                assert m["extents"][end] == want, (
                    m["id"],
                    end,
                    m["extents"][end],
                    want,
                )
            if m["axis"] in "xy":
                lo, hi = sorted([m["p0"], m["p1"]])
                rect = (
                    lo[0] - m["b"] / 2,
                    lo[1] - m["b"] / 2,
                    hi[0] + m["b"] / 2,
                    hi[1] + m["b"] / 2,
                )
                for p in w["regions"].get(m["level"], []):
                    for h in p["holes"]:
                        if h.get("rect") and not h.get("outside"):
                            assert M.Build.rect_overlap(rect, h["rect"]) == 0, (
                                m["id"],
                                h["kind"],
                            )
    for m in w["members"]:
        if m["class"] == "SLAB" and not m.get("curved_cut"):
            sl = M.shoelace(m["poly"])
            assert abs(m["area"] - sl) <= sl * D("0.005"), m["id"]
    for level in M.FLOORS:
        gross = sum(
            (
                p["area"] + p["curved_cut"]
                for p in w["regions"][level]
                if not p["sunken"] and p["mark"] != "PS1" and not p.get("region")
            ),
            D(0),
        )
        bays = (M.CORE["x1"] - M.CORE["x0"]) * (M.CORE["y1"] - M.CORE["y0"]) + (
            M.STAIR["x1"] - M.STAIR["x0"]
        ) * (M.STAIR["y1"] - M.STAIR["y0"])
        assert gross + bays == M.shoelace(M.outline(level)), level
    for storey, risers in M.STAIR["risers"].items():
        h = M.storey_height(storey)
        fl = [
            m
            for m in w["members"]
            if m["class"] == "STAIR" and m["level"] == storey and m["geom"] == "FLIGHT"
        ]
        assert (
            sum(f["risers"] for f in fl) == risers
            and sum((f["rise_total"] for f in fl), D(0)) == h
        ), storey
        assert (
            by_id["COL:B4@1F"]["stack"] == "B4" and by_id["TG1@1F"]["carries"] == "B4"
        )
    for cap in [m for m in w["members"] if m["class"] == "PILE_CAP"]:
        piles = [by_id[p] for p in cap["piles"]]
        assert len(piles) == cap["n_piles"]
        cx = sum((p["x"] for p in piles), D(0)) / len(piles)
        cy = sum((p["y"] for p in piles), D(0)) / len(piles)
        bb = M.Build.bbox(cap["poly"])
        assert (
            abs(cx - (bb[0] + bb[2]) / 2) <= 75
            and abs(cy - (bb[1] + bb[3]) / 2) <= 75
            or cap["mark"] == "PC2"
        ), cap["id"]

    # 4. ACI 318 / BNBC plausibility
    for m in w["members"]:
        if m["class"] == "COLUMN":
            ag = M.PI / 4 * m["b"] ** 2 if m["geom"] == "CYL" else m["sx"] * m["sy"]
            rho = D(m["nbar"]) * M.BAR_AREA[m["dbar"]] / ag
            assert D("0.01") <= rho <= D("0.04"), (m["id"], rho)
            td, _s_end, s_mid = M.COLUMN_MARKS[m["mark"]]["ties"]
            assert s_mid <= min(16 * m["dbar"], 48 * td, int(min(m["b"], m["d"]))), m[
                "id"
            ]
        if m["class"] in ("BEAM", "TIE_BEAM"):
            bt = M.BEAM_TYPES[m["type"]]
            n, d = bt["bot"]
            n2, d2 = bt["bot_x"]
            need = (n + n2) * max(d, d2) + (n + n2 - 1) * 25
            assert need <= m["b"] - 2 * M.COVER["BEAM"] - 2 * bt["st"][0], m["id"]
    for t, (dia, s) in M.SLAB_BARS.items():
        assert s <= min(3 * t, 450) and dia >= 8

    # 5. printed values: only registered traps may disagree with the authored value
    traps = json.loads((HERE / "traps.json").read_text())
    for t in traps["traps"]:
        if t["id"] == "T-BBS-TOTAL":
            assert D(t["printed"]) != D(bbs["grand_total_kg"]) and D(t["true"]) == D(
                bbs["grand_total_kg"]
            ), t
            assert abs(D(t["printed"]) / D(t["true"]) - 1) < D("0.02")
    assert len({t["id"] for t in traps["traps"]}) == len(traps["traps"])

    # 6. BBS reconciles with the REBAR rows exactly (raw sums) and per row to 0.001
    raw_by_dia: dict[int, Decimal] = {}
    for dia, kg in g.raw_kg:
        raw_by_dia[dia] = raw_by_dia.get(dia, D(0)) + kg
    for dia, total in raw_by_dia.items():
        rows_total = sum(
            (v for k, v in g.tot.items() if k[1] == "REBAR" and k[4] == dia), D(0)
        )
        assert abs(total - rows_total) < D("0.000001"), (
            dia
        )  # same terms, summation order only
    for r in bbs["rows"]:
        assert (
            D(r["cutting_rounded_mm"]) >= D(r["cutting_raw_mm"])
            and D(r["cutting_rounded_mm"]) - D(r["cutting_raw_mm"]) < 25
        )
        assert r["shape"] in golden.SHAPE_FORMULA
        assert (
            D(r["cutting_raw_mm"]) / r["pieces_per_bar"] <= M.STOCK
            or r["pieces_per_bar"] > 1
        )

    # 7. the 36 M3 cells all have at least one golden row
    cells = json.loads((HERE / "cells.json").read_text())["cells"]
    assert len(cells) == 36
    uncovered = []
    for c in cells:
        sel = c["cell"]
        hits = [r for r in rows if sel.items() <= r.items() and D(r["quantity"]) != 0]
        if not hits:
            uncovered.append(sel)
    assert not uncovered, uncovered
    report["cells"] = "36/36"

    # 8. determinism: a second build reproduces the bytes
    rows2, bbs2 = golden.compute(M.build())
    assert json.dumps(rows, sort_keys=True) == json.dumps(rows2, sort_keys=True)
    assert json.dumps(bbs, sort_keys=True) == json.dumps(bbs2, sort_keys=True)
    report["rows_per_kind"] = {
        k: sum(1 for r in rows if r["kind"] == k) for k in golden.Golden.UNIT
    }
    return report
