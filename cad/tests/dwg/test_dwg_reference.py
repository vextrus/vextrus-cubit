"""The DWG lane proven against a real structural working drawing (L-CAD-04, L-CAD-09).

Kept apart from test_dwg_heal.py because it is the cad suite's one long proof — a 22,000-entity
consultant's set through LibreDWG and the extractor, ~21 s of one core — and it reads a drawing that
lives only on the owner's machine. verify's cad lane sets this file aside (scripts/lib/cad-lane.mjs,
REFERENCE_TESTS) and the gate's golden lane runs it (`pnpm test:golden`), so every gate still proves it.
"""

from __future__ import annotations

from pathlib import Path

import ezdxf
import pytest

from vextrus_cad.dwg import convert_dwg
from vextrus_cad.ingest import ingest_dxf

#: A real structural working drawing kept beside the product rather than in it — a consultant's
#: sheet set, not a fixture, held in the checkout's ignored .private/reference/ (L-CAD-09: it never
#: enters the repository). When it is on this machine the lane is proven against it; when it is
#: not, the minted breaker below stands for it.
REFERENCE_DRAWING = (
    Path(__file__).resolve().parents[3]
    / ".private/reference/edison/Structural Working Drawing_Edison Lavinia_Final.dwg"
)


@pytest.mark.skipif(not REFERENCE_DRAWING.is_file(), reason="the reference sheet set is not on this machine")
def test_the_reference_structural_drawing_converts_and_ingests(tmp_path: Path) -> None:
    """22,000 entities and 100-odd layers, once refused over 13 wrapped lines of general notes."""
    result = convert_dwg(REFERENCE_DRAWING, tmp_path / "out")
    assert result.rejoined_lines >= 1, "the reference drawing no longer wraps; move this proof"
    assert result.drawn_dimensions == 0, (
        "a drawing AutoCAD wrote carries every dimension's picture: the lane draws none, rewrites nothing"
    )
    document = ezdxf.readfile(str(result.dxf_path))
    assert len(document.modelspace()) >= 22_000
    assert len(document.layers) >= 100
    artifact = ingest_dxf(result.dxf_path)
    assert len(artifact["entities"]) >= 21_000
