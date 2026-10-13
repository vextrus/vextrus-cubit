# ruff: noqa: RUF001
"""Units of the seed-working lint: a row's arithmetic rebuilt from the figures it prints."""

from pathlib import Path

from tools.lint import seed_workings

HEAD = "| Id | What | Derivation | Value |\n|---|---|---|---|\n"


def run(tmp_path: Path, rows: str) -> list[str]:
    page = tmp_path / "p.md"
    page.write_text(HEAD + rows, encoding="utf-8")
    return seed_workings.check(page)


def test_a_product_that_holds_passes(tmp_path: Path) -> None:
    rows = "| E1 | Stub | 1.3889 sft × 2′-3″ = 3.13 cft | 3.13 cft |\n"
    assert run(tmp_path, rows) == []


def test_an_unrounded_product_is_a_finding(tmp_path: Path) -> None:
    rows = "| M3 | Piles | 47 × 65′-0″ × E4 2.18166 sft = 6,664.98 cft × R1 276.67 | 18,44,000.02 |\n"
    found = run(tmp_path, rows)
    assert len(found) == 1
    assert "6,664.98" in found[0]


def test_the_last_chain_is_the_value(tmp_path: Path) -> None:
    ok = "| M5 | Rebar | 6,665.07 × 1.7 = 11,330.62, whole kg 11,331 kg × R3 92.36 | 10,46,531.16 |\n"
    assert run(tmp_path, ok) == []
    bad = ok.replace("10,46,531.16", "10,02,705.00")
    assert len(run(tmp_path, bad)) == 1


def test_a_bare_row_id_is_not_checked(tmp_path: Path) -> None:
    assert (
        run(tmp_path, "| C1 | Piling | M3 + M4 = 6,869.99 cft × 0.218 = 1,497.66 net | 1,528 bags |\n")
        == []
    )


def test_the_real_page_passes() -> None:
    page = Path(__file__).resolve().parents[3] / "docs/design/m1-screens.md"
    assert seed_workings.check(page) == []
