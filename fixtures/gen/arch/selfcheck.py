"""F-ARCH self-checks. Run before any byte is written; a failure writes nothing.

  1. two-path agreement: path 1 (room by room over the authored clear polygons, wall by wall over
     the authored end rules) and path 2 (rooms re-derived from the centrelines ± t/2 by planar faces,
     brickwork by band clipping) print the same quantity for every row, and neither has a row the
     other lacks;
  2. path 2's allocation of every opening to the faces either side of its host is the authored one;
  3. cross-fixture, against F-RCC6-BNBC's own build: on every framed floor the 250-wall openings of
     S-25's three size classes are exactly S-25's L1 / L2 / LS1 counts, and S-25's lintels are as
     wide as the walls they sit in; the ground floor has none; every sunken toilet panel over a storey
     is a toilet's clear polygon on it; every service duct stands in a duct void;
  4. every M4 cell of cells.json is filled by golden rows;
  5. the schedules print every mark's placements, except the registered T-OPENING-NOS;
  6. every room label's stated size is within 1" of the room it names, except the registered
     T-ROOM-SIZE-NOMINAL;
  7. the golden computes twice to the same rows.
"""

from __future__ import annotations

import json
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

from . import golden, golden_check
from . import model as M

D = Decimal
HERE = Path(__file__).resolve().parent
INCH = M.IN


def _key(r: dict[str, Any]) -> tuple[Any, ...]:
    return (r["class"], r["kind"], r["level"], r.get("component"), r.get("room") or r.get("mark"))


def two_paths(world: dict[str, Any], rows: list[dict[str, Any]], found: dict[str, Any]) -> str:
    p1 = {_key(r): r["quantity"] for r in rows}
    assert len(p1) == len(rows), "check 1: path 1 prints one key twice"
    p2 = golden_check.compute(world, found)
    only1 = sorted(set(p1) - set(p2), key=str)
    only2 = sorted(set(p2) - set(p1), key=str)
    assert not only1 and not only2, f"check 1: rows one path has and the other lacks: {only1[:5]} {only2[:5]}"
    differ = [(k, p1[k], p2[k]) for k in sorted(p1, key=str) if p1[k] != p2[k]]
    assert not differ, f"check 1 (two paths): {len(differ)} rows disagree, e.g. {differ[:5]}"
    return f"{len(rows)} rows identical (room by room over the authored clear polygons vs faces re-derived " \
           "from the wall centrelines ± t/2; wall by wall vs band clipping)"


def allocation(world: dict[str, Any], derived: dict[str, Any]) -> int:
    checked = 0
    for level, lv in world["levels"].items():
        found = derived[level]["alloc"]
        for o in lv["openings"]:
            assert sorted(found[o["id"]]) == sorted(o["rooms"]), (
                f"check 2: {level} {o['id']} opens onto {sorted(found[o['id']])} by its host's sides; the "
                f"model says {sorted(o['rooms'])}"
            )
            checked += 1
    return checked


def s25_program(world: dict[str, Any]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for level, lv in world["levels"].items():
        walls = {w["id"]: w for w in lv["walls"]}
        found: Counter[str] = Counter()
        for o in lv["openings"]:
            if walls[o["host"]]["type"] != "BW250":
                continue
            cls = golden_check.s25_class(o)
            if cls is not None:
                found[cls] += 1
        s25 = {mark: lt["count"] for mark, lt in lv["lintels"].items()}
        assert dict(found) == s25, f"check 3: {level}'s 250-wall openings by S-25 class {dict(found)} ≠ S-25 {s25}"
        for mark, lt in lv["lintels"].items():
            assert lt["b"] == M.T250, f"check 3: S-25's {mark} is {lt['b']} wide, the 250 walls are not"
        out[level] = dict(sorted(found.items()))
    return out


def toilets_and_ducts(world: dict[str, Any], derived: dict[str, Any]) -> dict[str, int]:
    toilets = ducts = 0
    for level, lv in world["levels"].items():
        wet = [sorted(r["polygon"]) for r in lv["rooms"] if r["finish"] == "WET"]
        dry = [r for r in lv["rooms"] if r["finish"] not in (None, "WET") and r.get("polygon")]
        for p in lv["slabs_over"]:
            if not p["sunken"]:
                continue
            if sorted(p["poly"]) in wet:
                toilets += 1
                continue
            cx = sum((q[0] for q in p["poly"]), D(0)) / len(p["poly"])
            cy = sum((q[1] for q in p["poly"]), D(0)) / len(p["poly"])
            over = [r["id"] for r in dry if golden_check.contains(r["polygon"], (cx, cy))]
            assert level == "GF" and not over, (
                f"check 3: the sunken panel {p['id']} over {level} is no toilet's clear polygon (over {over})")
        if level == "GF":
            continue
        named = derived[level]["named"]
        duct_faces = [named[r["id"]] for r in lv["rooms"] if r["id"].endswith("DUCT")]
        for x, y in M.DUCTS:
            corners = [(x, y), (x + M.DUCT_SIZE[0], y), (x + M.DUCT_SIZE[0], y + M.DUCT_SIZE[1]),
                       (x, y + M.DUCT_SIZE[1])]
            inset = [(cx + (D(1) if cx == x else D(-1)), cy + (D(1) if cy == y else D(-1))) for cx, cy in corners]
            assert any(all(golden_check.face_contains(f, c) for c in inset) for f in duct_faces), (
                f"check 3: the duct at ({x}, {y}) on {level} stands in no duct void")
            ducts += 1
    return {"toilet_panels": toilets, "ducts": ducts}


def cells(rows: list[dict[str, Any]]) -> str:
    doc = json.loads((HERE / "cells.json").read_text(encoding="utf-8"))
    empty = [c["cell"] for c in doc["cells"] if not any(all(r.get(k) == v for k, v in c["cell"].items()) for r in rows)]
    assert not empty, f"check 4: cells the golden leaves empty: {empty}"
    return f"{len(doc['cells'])}/{len(doc['cells'])}"


def schedules(world: dict[str, Any]) -> int:
    registered = {k for k, t in _traps().items() if t.get("schedule_override")}
    checked = 0
    for lv in world["levels"].values():
        placed = Counter(o["mark"] for o in lv["openings"])
        for mark, n in placed.items():
            printed = world["printed_nos_override"].get(f"{lv['group']}:{mark}", n)
            if printed != n:
                assert "T-OPENING-NOS" in registered, f"check 5: {mark} prints {printed} against {n} placed"
            checked += 1
    return checked


def labels(world: dict[str, Any]) -> int:
    traps = _traps()
    nominal = {t["room"] for t in traps.values() if t["id"] == "T-ROOM-SIZE-NOMINAL"}
    checked = 0
    for lv in world["levels"].values():
        for r in lv["rooms"]:
            for lab in r["labels"]:
                if "stated" not in lab:
                    continue
                w, ll = lab["stated"]
                bw, bl = lab["box_size"]
                off = max(abs(w - bw), abs(ll - bl))
                if r["id"] in nominal and lab.get("nominal"):
                    assert off > INCH, f"check 6: {r['id']}'s nominal label is within an inch of its room"
                else:
                    assert off <= INCH, f"check 6: {r['id']}'s label is {off} mm off its room"
                checked += 1
    return checked


def _traps() -> dict[str, dict[str, Any]]:
    doc = json.loads((HERE / "traps.json").read_text(encoding="utf-8"))
    return {t["id"]: t for t in doc["traps"]}


def run(world: dict[str, Any] | None = None) -> dict[str, Any]:
    world = world if world is not None else M.build()
    rows = golden.compute(world)
    again = golden.compute(M.build())
    assert again == rows, "check 7: the golden computes to different rows twice"
    derived: dict[str, Any] = {}
    detail = two_paths(world, rows, derived)  # refuses (raises) on any disagreement
    return {
        "two_path_agreement": True,
        "two_path_detail": detail,
        "allocation_checked": allocation(world, derived),
        "s25_program": s25_program(world),
        "toilets_and_ducts": toilets_and_ducts(world, derived),
        "cells": cells(rows),
        "schedule_marks_checked": schedules(world),
        "labels_checked": labels(world),
        "rows_per_kind": dict(sorted(Counter(r["kind"] for r in rows).items())),
    }
