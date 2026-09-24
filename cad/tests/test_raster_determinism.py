"""The vectoriser is deterministic: L-CAD-02's torture corpus (R-TO-003, I-584).

"The vectoriser is deterministic (torture corpus: two runs give an identical multiset)." The corpus is
derived here at test time from F-RCC6-BNBC's committed scans — a crop of S-10 from each of R1..R4 (a
clean render, a skewed stamped scan, a photocopy, a phone photo), each also turned ±1.5° by numpy
alone, never by the vectoriser under test — and every crop is traced twice. The second run is made
with OpenCV's thread count and CPU dispatch deliberately moved first, so the pins the trace sets for
itself are what is being proved, not the state the first run happened to leave.

Only multisets are compared, run against run. No digest is committed as an expected value: a key is
the vectoriser's reading of these pixels on this build, and pinning one here would make a test of the
machine rather than of the determinism.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import pytest

from test_raster import RASTER_DIR, crop, rotate
from vextrus_cad import raster
from vextrus_cad.ingest import _Counters

VARIANTS = ("r1", "r2", "r3", "r4")
TURNS = (0.0, 1.5, -1.5)


def _corpus_crop(variant: str) -> np.ndarray:
    path: Path = next((RASTER_DIR / variant).glob("s-10.*"))
    return crop(raster.decode(path.read_bytes(), path.name))


def _keys(grey: np.ndarray) -> Counter[str]:
    traced = raster.trace(grey, None)
    height = traced.image.shape[0]
    to_page = (1.0, 0.0, 0.0, -1.0, 0.0, float(height))
    minted = raster.lines_on_page(traced, to_page, 0, "Page 1", set(), _Counters(collapsed={}))
    return Counter(entity["key"] for entity in minted.entities)


@pytest.mark.parametrize("variant", VARIANTS)
def test_two_runs_over_the_torture_crops_mint_one_multiset(variant: str) -> None:
    base = _corpus_crop(variant)
    for turn in TURNS:
        grey = base if turn == 0.0 else rotate(base, turn)
        first = _keys(grey)
        assert sum(first.values()) > 20, f"{variant} at {turn}° traces nothing: a vacuous corpus"
        # Move what the pins pin, then trace again: the run must set them back itself.
        cv2.setNumThreads(4)
        cv2.setUseOptimized(True)
        second = _keys(grey)
        assert second == first, f"{variant} at {turn}°: two runs minted different key multisets"


def test_the_pins_hold_after_a_trace() -> None:
    cv2.setNumThreads(4)
    cv2.setUseOptimized(True)
    raster.trace(np.full((80, 80), 255, dtype=np.uint8), None)
    assert (cv2.getNumThreads(), cv2.useOptimized()) == (1, False)


def test_the_identity_names_the_pins_and_moves_with_any_parameter(monkeypatch: pytest.MonkeyPatch) -> None:
    from vextrus_cad import parameters

    held = parameters.raster_parameter_set_hash()
    assert parameters.raster_parameter_set()["threads"] == 1
    assert parameters.raster_parameter_set()["use_optimized"] is False
    assert parameters.raster_parameter_set()["numpy"] == np.__version__
    monkeypatch.setattr(parameters, "RASTER_MIN_LINE_MM", 1.5)
    assert parameters.raster_parameter_set_hash() != held, "a moved knob is a declared re-ingest"
