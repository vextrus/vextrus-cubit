"""F-ARCH's size budget: tranche 1 is one DXF and its JSON, and it stays small enough to vendor, diff
and clone. The caps are the manifest's own (`emit/manifest.py` CAPS_MB); restated here so the test
fails when the generator's plan drifts past them."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "fixtures" / "arch"
MB = 1024 * 1024
CORPUS_MB = 8
SINGLE_FILE_MB = 4


def _files() -> list[Path]:
    return sorted(p for p in OUT.rglob("*") if p.is_file())


def test_the_corpus_fits_its_budget() -> None:
    files = _files()
    assert files, f"{OUT} is empty — the corpus is not committed"
    total = sum(p.stat().st_size for p in files)
    assert total <= CORPUS_MB * MB, f"{total / MB:.2f} MB of corpus against a {CORPUS_MB} MB cap"


def test_no_single_file_is_oversized() -> None:
    big = {
        p.name: round(p.stat().st_size / MB, 2) for p in _files() if p.stat().st_size > SINGLE_FILE_MB * MB
    }
    assert big == {}, f"files over {SINGLE_FILE_MB} MB: {big}"


def test_the_manifest_states_the_caps_this_test_holds() -> None:
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["size_budget"]["caps_mb"] == {"corpus_total": CORPUS_MB, "single_file": SINGLE_FILE_MB}
