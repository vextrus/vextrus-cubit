"""F-RCC6-BNBC corpus size budget (adversary 7): the golden set stays small enough to vendor and diff."""

from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parents[3] / "fixtures" / "rcc6-bnbc"
MB = 1024 * 1024


def test_corpus_within_size_budget() -> None:
    files = sorted(p for p in OUT.rglob("*") if p.is_file())
    assert files
    total = sum(p.stat().st_size for p in files)
    assert total <= 6 * MB, f"{total / MB:.2f} MB total"
    for p in files:
        assert p.stat().st_size <= 3 * MB, f"{p.name}: {p.stat().st_size / MB:.2f} MB"
