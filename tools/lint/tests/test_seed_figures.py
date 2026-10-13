"""Units of the seed-figure lint beyond its acceptance tests (S25-SEEDLINT)."""

from pathlib import Path

from tools.lint import seed_figures

TABLE = "| Id | What | Derivation | Value |\n|---|---|---|---|\n| A1 | Rate | entered | 2.50 |\n"


def run(tmp_path: Path, body: str) -> list[str]:
    page = tmp_path / "p.md"
    page.write_text(TABLE + "\n" + body, encoding="utf-8")
    return seed_figures.check(page)


def test_a_page_without_a_seed_table_passes(tmp_path: Path) -> None:
    page = tmp_path / "p.md"
    page.write_text("A1 = 9\n", encoding="utf-8")
    assert seed_figures.check(page) == []


def test_half_rounds_up_at_the_copys_places(tmp_path: Path) -> None:
    assert run(tmp_path, "A1 = 3\n") == []
    assert len(run(tmp_path, "A1 = 2\n")) == 1


def test_a_fenced_block_is_not_read(tmp_path: Path) -> None:
    assert run(tmp_path, "```\nA1 = 9\n```\n") == []


def test_the_real_page_passes() -> None:
    assert seed_figures.check(Path(__file__).resolve().parents[3] / "docs/design/m1-screens.md") == []
