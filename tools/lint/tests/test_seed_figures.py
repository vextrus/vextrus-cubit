"""Units of the seed-figure lint beyond its acceptance tests (S25-SEEDLINT)."""

from pathlib import Path

from tools.lint import seed_figures

TABLE = (
    "| Id | What | Derivation | Value |\n|---|---|---|---|\n"
    "| A1 | Rate | entered | 2.50 |\n"
    "| **T2** | Total | W1 to W3 | **1,31,378.85** |\n"
    "| W3 | Awaiting | entered | 672.48 |\n"
    "| G4 | Columns | by state | 100 + 8 + 2 = 110 |\n"
    "| G2 | Storeys | by level | the level table of 6.2 |\n"
)


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


def test_an_ids_own_digit_is_not_a_figure(tmp_path: Path) -> None:
    assert run(tmp_path, "T4 = A1 + T2, and in M1 (A1) too.\n") == []


def test_a_values_result_is_after_its_last_equals_and_prose_gives_none(tmp_path: Path) -> None:
    assert run(tmp_path, "110 columns (G4)\n") == []
    assert len(run(tmp_path, "G4 100\n")) == 1
    assert run(tmp_path, "G2 6.2\n") == []


def test_bold_ids_and_figures_are_read(tmp_path: Path) -> None:
    assert len(run(tmp_path, "**T2** \u09f31,31,387\n")) == 1
    assert len(run(tmp_path, "**\u09f31,31,387.85** (T2)\n")) == 1
    assert run(tmp_path, "**\u09f31,31,379** (T2)\n") == []


def test_a_list_of_rows_passes_if_one_matches(tmp_path: Path) -> None:
    assert run(tmp_path, "\u09f3672.48 (T2, W3)\n") == []
    assert len(run(tmp_path, "\u09f3672.49 (T2, W3)\n")) == 1


def test_a_share_with_a_short_phrase_before_its_id_is_read(tmp_path: Path) -> None:
    assert len(run(tmp_path, "Rate 3% of the total (A1)\n")) == 0
    assert len(run(tmp_path, "Rate 4% of the total (A1)\n")) == 1


def test_a_citation_wrapped_to_the_next_line_is_read(tmp_path: Path) -> None:
    found = run(tmp_path, "The awaiting answer is \u09f31,31,387.85\n(T2) today.\n")
    assert [line.split(":")[1] for line in found] == [str(len(TABLE.splitlines()) + 2)]


def test_a_signed_change_or_a_working_is_not_the_rows_figure(tmp_path: Path) -> None:
    assert (
        run(tmp_path, "+\u09f347.00 (A1), 2 sft \u00d7 3.00 = \u09f36.00 (A1); G4 100 \u00d7 E1 = 5\n")
        == []
    )
