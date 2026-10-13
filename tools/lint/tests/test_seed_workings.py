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


def test_a_bracketed_aside_is_dropped_and_the_working_checked(tmp_path: Path) -> None:
    good = "| R3 | Rebar | rod 1 kg × 1.03 (3% cutting wastage) × 88.50 = 91.155 | 91.16 |\n"
    assert run(tmp_path, good) == []
    bad = good.replace("91.155", "91.255")
    assert len(run(tmp_path, bad)) == 1


def test_a_word_before_the_operator_is_read(tmp_path: Path) -> None:
    good = "| A4b | Plinth | 8,400 cft: labour × 6.88 = 57,792.00 | 57,792.00 |\n"
    assert run(tmp_path, good) == []
    assert (
        len(
            run(
                tmp_path,
                good.replace("57,792.00 |", "57,792.00 |").replace("= 57,792.00", "= 57,793.00"),
            )
        )
        == 1
    )


def test_a_given_is_resolved_from_its_row(tmp_path: Path) -> None:
    rows = (
        "| G1 | Area | entered | 42,000 sft |\n"
        "| A4b | RCC | 0.068 × G1 = 2,856 cft × 308.17 = 8,80,133.52 | 8,80,133.52 |\n"
    )
    assert run(tmp_path, rows) == []
    assert run(tmp_path, rows.replace("= 2,856", "= 2,857"))


def test_a_rate_less_working_is_reported_unchecked_by_name(tmp_path: Path) -> None:
    page = tmp_path / "p.md"
    page.write_text(
        HEAD + "| A2 | Slabs | 20,412 cft = 56,47,388.04 | 56,47,388.04 |\n", encoding="utf-8"
    )
    assert seed_workings.check(page) == []
    listed = seed_workings.unchecked(page)
    assert len(listed) == 1
    assert "row A2" in listed[0]
    assert "56,47,388.04" in listed[0]


def test_a_bump_of_a_checked_working_fails_and_the_rest_are_listed() -> None:
    """The mutation test: bump the last digit of every printed result on the real page; the bump is
    a finding, or the working was reported unchecked (the known gap in the module's docstring)."""
    import re
    import tempfile

    page = Path(__file__).resolve().parents[3] / "docs/design/m1-screens.md"
    lines = page.read_text(encoding="utf-8").splitlines()
    start = next(
        i for i, line in enumerate(lines) if line.lower().startswith("| id | what | derivation")
    )
    end = next(i for i in range(start, len(lines)) if not lines[i].startswith("|"))
    table = lines[start:end]
    survived: list[str] = []
    with tempfile.TemporaryDirectory() as folder:
        scratch = Path(folder) / "p.md"
        for at, row in enumerate(table[2:], start=2):
            cells = [c.strip() for c in row.strip().strip("|").split("|")]
            if len(cells) < 4:
                continue
            for hit in re.finditer(r"= (\d[\d,]*\.\d+)(?![\d])", cells[2]):
                figure = hit.group(1)
                digit = figure[-1]
                bumped = figure[:-1] + str((int(digit) + 1) % 10)
                changed = table.copy()
                changed[at] = row.replace(f"= {figure}", f"= {bumped}", 1)
                scratch.write_text("\n".join(changed) + "\n", encoding="utf-8")
                found = seed_workings.check(scratch)
                if not found and not any(f"= {bumped}" in u for u in seed_workings.unchecked(scratch)):
                    survived.append(f"{cells[0]}: {figure} -> {bumped}")
    assert survived == [], survived
