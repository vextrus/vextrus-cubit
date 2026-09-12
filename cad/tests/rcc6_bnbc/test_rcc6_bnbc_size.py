"""F-RCC6-BNBC corpus size budget (adversary 7, W-02): the yardstick stays small enough to vendor,
diff and clone. The caps are `emit.plan.RASTER["budget_mb"]`, and the six Wave A JSON files keep
the 6 MB they were given before the drawings arrived."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "fixtures" / "rcc6-bnbc"
MB = 1024 * 1024

#: W-02's caps, restated here so the test fails when the generator's own plan drifts past them.
CORPUS_MB = 45
RASTERS_MB = 25
SINGLE_FILE_MB = 8

#: The golden set Wave A authored, which the drawings must not crowd out.
GOLDEN_MB = 6
GOLDEN_FILES = (
    "takeoff.golden.json",
    "bbs.golden.json",
    "cells.json",
    "traps.json",
    "site.json",
    "model.json",
)


def _files() -> list[Path]:
    return sorted(p for p in OUT.rglob("*") if p.is_file())


def test_the_corpus_fits_its_budget() -> None:
    files = _files()
    assert files, f"{OUT} is empty — the corpus is not committed"
    total = sum(p.stat().st_size for p in files)
    assert total <= CORPUS_MB * MB, f"{total / MB:.2f} MB of corpus against a {CORPUS_MB} MB cap"


def test_the_rasters_fit_their_share() -> None:
    rasters = [p for p in _files() if p.relative_to(OUT).parts[0] == "raster"]
    assert rasters, "no raster/ variants are committed"
    total = sum(p.stat().st_size for p in rasters)
    assert total <= RASTERS_MB * MB, f"{total / MB:.2f} MB of rasters against a {RASTERS_MB} MB cap"


def test_no_single_file_is_oversized() -> None:
    oversized = {
        p.relative_to(OUT).as_posix(): round(p.stat().st_size / MB, 2)
        for p in _files()
        if p.stat().st_size > SINGLE_FILE_MB * MB
    }
    assert oversized == {}, f"files over the {SINGLE_FILE_MB} MB single-file cap: {oversized}"


def test_the_golden_json_keeps_its_own_six_megabytes() -> None:
    missing = [name for name in GOLDEN_FILES if not (OUT / name).is_file()]
    assert missing == [], f"the Wave A golden is incomplete: {missing}"
    total = sum((OUT / name).stat().st_size for name in GOLDEN_FILES)
    assert total <= GOLDEN_MB * MB, f"{total / MB:.2f} MB of golden JSON against a {GOLDEN_MB} MB cap"
