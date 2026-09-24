"""Masonry has one home, F-ARCH (R0-G3, W-51, D-009).

BNBC mints no brick wall and bills no brickwork; it keeps its S-25 lintels, whose golden rows do not
move, and S-25 still prints the two wall types the lintels sit in — from `model.WALL_TYPES`, not from
a member. Nothing flows from F-ARCH into BNBC.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from fixtures.gen.rcc6_bnbc import __main__ as gen  # noqa: E402
from fixtures.gen.rcc6_bnbc import golden, golden_check, selfcheck  # noqa: E402
from fixtures.gen.rcc6_bnbc import model as M  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import sheets as S  # noqa: E402

PKG = ROOT / "fixtures" / "gen" / "rcc6_bnbc"
COMMITTED = ROOT / "fixtures" / "rcc6-bnbc" / "takeoff.golden.json"


@pytest.fixture(scope="module")
def world() -> dict[str, Any]:
    return M.build()


@pytest.fixture(scope="module")
def rows(world: dict[str, Any]) -> list[dict[str, Any]]:
    got, bbs = golden.compute(world)
    doc = json.loads(gen.golden_documents(world, got, bbs)["takeoff.golden.json"])
    return doc["rows"]


def test_bnbc_builds_no_brick_wall_and_keeps_its_lintels(world: dict[str, Any]) -> None:
    classes = {m["class"] for m in world["members"]}
    assert "BRICK_WALL" not in classes
    lintels = sorted(m["id"] for m in world["members"] if m["class"] == "LINTEL")
    levels = ["1F", *M.TYPICAL]
    assert lintels == sorted(f"{mark}@{lv}" for mark in ("L1", "L2", "LS1") for lv in levels)
    assert not any(m["mark"] in M.WALL_TYPES for m in world["members"])


def test_neither_golden_path_bills_brickwork(world: dict[str, Any], rows: list[dict[str, Any]]) -> None:
    assert [r for r in rows if r["class"] == "BRICK_WALL" or r["kind"] == "BRICKWORK"] == []
    assert not any(k[0] == "BRICK_WALL" or k[1] == "BRICKWORK" for k in golden_check.compute(world))
    assert "BRICKWORK" not in golden.Golden.UNIT and "BRICKWORK" not in golden_check.UNIT
    assert "BRICK_WALL" not in golden.Golden.CLASSES


def test_the_lintel_rows_are_the_committed_ones_byte_for_byte(rows: list[dict[str, Any]]) -> None:
    committed = json.loads(COMMITTED.read_text(encoding="utf-8"))["rows"]

    def lintel(rs: list[dict[str, Any]]) -> str:
        return json.dumps([r for r in rs if r["class"] == "LINTEL"], ensure_ascii=False)

    assert '"LINTEL"' in lintel(rows)
    assert lintel(rows) == lintel(committed)


def test_s25_prints_the_wall_types_from_the_table(world: dict[str, Any]) -> None:
    assert M.WALL_TYPES == {"BW250": 250, "BW125": 125}
    assert selfcheck.schedule_marks()["S-25"] == ["L1", "L2", "LS1", "BW250", "BW125"]
    s25 = next(sheet for sheet in S.compose(world) if sheet.number == "S-25")
    view = next(v for v in s25.views if v.title == "LINTEL & SUNSHADE SCHEDULE")
    texts = [i for i in view.scene.items if i["kind"] == "TEXT"]
    for mark, t in M.WALL_TYPES.items():
        line = [i for i in texts if i["s"] == f"{mark}  BRICK WALL {t} THK"]
        assert len(line) == 1, mark
        assert line[0]["fact"] == {"authored": str(t)}, mark
        assert [i for i in texts if i["s"] == mark and i.get("family") == "mark"], mark


def test_bnbc_reads_nothing_from_f_arch() -> None:
    pattern = re.compile(r"^\s*(from|import)\s+[\w.]*\barch\b", re.MULTILINE)
    readers = [p.relative_to(PKG) for p in PKG.rglob("*.py") if pattern.search(p.read_text(encoding="utf-8"))]
    assert readers == []
