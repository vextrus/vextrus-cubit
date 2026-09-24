"""The DWG minting keeps what Rev C appends (W-50), and stops when the product's lane refuses a class.

`emit/dwg.mint` writes the sheets again as the DWG source, converts it with `dxf2dwg` and reads the DWG
back through the product's own lane (`vextrus_cad.dwg.convert_dwg`). The census counts what the DWG
holds; the product reads what `dwg2dxf` carries across. R0-G2's review found the two apart: the source
ended Rev B with a mid-issue save, so its OBJECTS section closed below every record Rev C appends,
`dxf2dwg` minted its own APPID, VX_CONTROL and VX_TABLE_RECORD over Rev C's first three handles, and
every model-space entity Rev C appends was left out of the conversion while the census still read
whole. This suite proves, over a two-revision sheet small enough to mint in a second:

- the source as `mint` writes it now converts with nothing refused, Rev C's model-space entities
  carried across in both drawings;
- the mint stops, by class, when the source ends the issue as the paper set does (the defect put back)
  — the proof has teeth, and the cause is the one named.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from fixtures.gen.rcc6_bnbc.emit import dwg as D  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import dxf as X  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit.scene import APPENDED, Scene, Sheet, View  # noqa: E402

pytestmark = pytest.mark.skipif(
    not all(shutil.which(tool) for tool in ("dxf2dwg", "dwg2dxf", "dwgread")),
    reason="LibreDWG (dxf2dwg, dwg2dxf, dwgread) is not on PATH",
)

#: What the sheet's one view draws in each revision, in model space.
REV_B_LINES = 5
REV_C_LINES = 4


def _sheets() -> list[Sheet]:
    """One Rev B sheet with one view: Rev B's lines and caption, then Rev C's lines and note in the
    same view and a Rev C note on the paper — the shape R0-G2's additions take on the real set."""
    scene = Scene()
    for i in range(REV_B_LINES):
        scene.line((i * 1000.0, 0.0), (i * 1000.0, 3000.0))
    scene.text("REV B VIEW TEXT", (0.0, -500.0), 150.0)
    with scene.revision(APPENDED):
        for i in range(REV_C_LINES):
            scene.line((i * 1000.0, 4000.0), (i * 1000.0 + 500.0, 6000.0))
        scene.text("REV C VIEW TEXT", (0.0, 6500.0), 150.0)
    paper = Scene()
    paper.text("REV B PAPER TEXT", (20.0, 20.0), 3.0, "S-SHEET")
    with paper.revision(APPENDED):
        paper.text("REV C PAPER TEXT", (20.0, 30.0), 3.0, "S-SHEET")
    view = View("MINT PROBE PLAN", scene, 100, (40.0, 40.0), (200.0, 120.0), (-1000.0, -1000.0))
    return [Sheet("S-01", "MINT PROBE", "A3", [view], paper, "1:100")]


def _mint(tmp_path: Path) -> dict[str, Any]:
    # no canary is run: every feature is taken as carried, so nothing is left out of the source and
    # any shortfall is the minting's own
    return D.mint(_sheets(), [], {}, {}, tmp_path)


def test_the_source_mint_writes_carries_every_rev_c_entity_in_both_drawings(tmp_path: Path) -> None:
    minted = _mint(tmp_path)
    for name in D.MINTED.values():
        spec = minted["spec"][name]
        assert spec["refused"] == [], f"{name}: the lane refused {spec['refused']}"
        assert spec["losses"] == {}, f"{name}: {spec['losses']}"
        # the census the sanity test pins reads Rev B's and Rev C's lines alike
        assert spec["expected"]["model"]["LINE"] == REV_B_LINES + REV_C_LINES, (name, spec["expected"])


def test_a_source_that_ends_the_issue_mid_write_is_refused_by_class(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    ends_the_issue = X._close_issue

    def as_the_paper_set(doc: Any, placer: Any, blocks: Any, *, issue: bool = True) -> None:
        del issue
        ends_the_issue(doc, placer, blocks, issue=True)

    monkeypatch.setattr(X, "_close_issue", as_the_paper_set)
    with pytest.raises(AssertionError, match=r"rcc6-bnbc\.dwg: the product's DWG lane refused .*"
                       r"LINE is refused on model — the census counted 9, the conversion carried 5"):
        _mint(tmp_path)
