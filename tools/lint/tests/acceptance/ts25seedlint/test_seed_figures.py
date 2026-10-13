"""Ticket S25-SEEDLINT (#762): "a lint over docs/design/m1-screens.md that reads the one seed table (6.1)
and refuses any figure elsewhere on the page that names a seed row (by its id, e.g. A2, T6, W1 ...) and
disagrees with it under the page's one rounding convention".

The page's convention (m1-screens 1.3): a copy may print fewer places than its row, rounded to the
nearest ("the strip carries whole taka", "a whole percent"); Indian and plain grouping are one number
("1,24,56,780" and "12456780"). A row's id is cited as `<figure> (<id>)`, `<id> <figure>` or
`<id> = <figure>`; an id is the whole token (E1 is not E1b, M1 is not M1-20).
"""

from pathlib import Path

from .support import MODULE, command, line_of, naming, page, write

AGREEING = (
    "Gross Floor Area 42,000 sft (G1); 110 on the column schedule (G3).",
    "A column reads 13.31 cft (E1); a held one at its best candidate 15.97 cft (E1b).",
    "RCC at ৳276.67 (R1), outside the contract ৳308.17 (R1).",
    (
        "| Strip (whole taka) | Measured T1 ৳67,56,094 (67.56 lakh) · Awaiting answer T2 ৳1,31,379 "
        "(1.31 lakh) · T5 ৳2,668 per sft · Measured T6 6% of the total |"
    ),
    "In the grid T2 = 1,31,378.85 and Steps 9 to 14 read ৳7,14,42,000.00 (A4a).",
)


def test_copies_that_agree_with_their_rows_pass(tmp_path: Path) -> None:
    write(tmp_path, page(*AGREEING))
    code, text = command(tmp_path, "page.md")
    assert code == 0, f"{MODULE}: {text}"


def test_a_stale_money_figure_fails_naming_file_line_row_and_both_values(tmp_path: Path) -> None:
    stale = "The awaiting answer is ৳1,31,387.85 (T2)."
    text = page(*AGREEING, stale)
    write(tmp_path, text)
    code, output = command(tmp_path, "page.md")
    assert code == 1, f"{MODULE}: {output}"
    line = line_of(text, "1,31,387.85")
    assert naming(output, "page.md", line, "T2", "1,31,387.85", "1,31,378.85"), f"{MODULE}: {output}"


def test_a_stale_percentage_fails_naming_the_row(tmp_path: Path) -> None:
    stale = "The strip's last figure: Measured T6 7% of the total."
    text = page(*AGREEING, stale)
    write(tmp_path, text)
    code, output = command(tmp_path, "page.md")
    assert code == 1, f"{MODULE}: {output}"
    line = line_of(text, "T6 7%")
    assert naming(output, "page.md", line, "T6", "7", "6.03"), f"{MODULE}: {output}"


def test_a_stale_quantity_fails_naming_the_row(tmp_path: Path) -> None:
    stale = "The casting area is the floor's, G1 = 37,800 sft."
    text = page(*AGREEING, stale)
    write(tmp_path, text)
    code, output = command(tmp_path, "page.md")
    assert code == 1, f"{MODULE}: {output}"
    line = line_of(text, "37,800")
    assert naming(output, "page.md", line, "G1", "37,800", "42,000"), f"{MODULE}: {output}"


def test_a_stale_figure_of_a_row_with_two_values_fails(tmp_path: Path) -> None:
    stale = "Outside the contract RCC is ৳308.71 (R1)."
    text = page(*AGREEING, stale)
    write(tmp_path, text)
    code, output = command(tmp_path, "page.md")
    assert code == 1, f"{MODULE}: {output}"
    line = line_of(text, "308.71")
    assert naming(output, "page.md", line, "R1", "308.71", "308.17"), f"{MODULE}: {output}"


def test_whole_taka_is_rounded_to_the_nearest_not_cut(tmp_path: Path) -> None:
    stale = "Measured so far: ৳67,56,093 (T1)."
    text = page(*AGREEING, stale)
    write(tmp_path, text)
    code, output = command(tmp_path, "page.md")
    assert code == 1, f"{MODULE}: {output}"
    line = line_of(text, "67,56,093 (T1)")
    assert naming(output, "page.md", line, "T1", "67,56,093", "67,56,093.82"), f"{MODULE}: {output}"


def test_an_id_with_a_suffix_is_its_own_row(tmp_path: Path) -> None:
    stale = "A held column at its best candidate reads 13.31 cft (E1b)."
    text = page(*AGREEING, stale)
    write(tmp_path, text)
    code, output = command(tmp_path, "page.md")
    assert code == 1, f"{MODULE}: {output}"
    line = line_of(text, "13.31 cft (E1b)")
    assert naming(output, "page.md", line, "E1b", "13.31", "15.97"), f"{MODULE}: {output}"


def test_every_stale_copy_is_named_not_only_the_first(tmp_path: Path) -> None:
    money = "The awaiting answer is ৳1,31,387.85 (T2)."
    share = "The strip's last figure: Measured T6 7% of the total."
    quantity = "The casting area is the floor's, G1 = 37,800 sft."
    text = page(money, *AGREEING, share, quantity)
    write(tmp_path, text)
    code, output = command(tmp_path, "page.md")
    assert code == 1, f"{MODULE}: {output}"
    found = [
        naming(output, "page.md", line_of(text, "1,31,387.85"), "T2", "1,31,387.85", "1,31,378.85"),
        naming(output, "page.md", line_of(text, "T6 7%"), "T6", "7", "6.03"),
        naming(output, "page.md", line_of(text, "37,800"), "G1", "37,800", "42,000"),
    ]
    assert found == [True, True, True], f"{MODULE}: {output}"


def test_a_figure_that_cites_no_row_is_ignored(tmp_path: Path) -> None:
    lines = (
        "The demo's other Project costs ৳9,99,999.00 and covers 37,800 sft.",
        "A row the table does not hold is no citation: 7% (Z9).",
    )
    write(tmp_path, page(*AGREEING, *lines))
    code, text = command(tmp_path, "page.md")
    assert code == 0, f"{MODULE}: {text}"


def test_a_ticket_name_is_not_a_citation_of_a_row(tmp_path: Path) -> None:
    lines = ("G1-20 adds 3 screens; T2-7 shows 4 cards; E1b-2 draws 9 columns.",)
    write(tmp_path, page(*AGREEING, *lines))
    code, text = command(tmp_path, "page.md")
    assert code == 0, f"{MODULE}: {text}"


def test_plain_grouping_agrees_with_an_indian_grouped_row(tmp_path: Path) -> None:
    lines = ("Awaiting answer ৳131,378.85 (T2), or as typed ৳131378.85 (T2).",)
    write(tmp_path, page(*AGREEING, *lines))
    code, text = command(tmp_path, "page.md")
    assert code == 0, f"{MODULE}: {text}"


def test_indian_grouping_agrees_with_a_plain_grouped_row(tmp_path: Path) -> None:
    lines = ("The plain row reads ৳1,31,378.85 (X9).",)
    write(tmp_path, page(*AGREEING, *lines))
    code, text = command(tmp_path, "page.md")
    assert code == 0, f"{MODULE}: {text}"


def test_a_grouping_does_not_hide_a_stale_digit(tmp_path: Path) -> None:
    stale = "The plain row reads ৳1,31,387.85 (X9)."
    text = page(*AGREEING, stale)
    write(tmp_path, text)
    code, output = command(tmp_path, "page.md")
    assert code == 1, f"{MODULE}: {output}"
    line = line_of(text, "1,31,387.85")
    assert naming(output, "page.md", line, "X9", "1,31,387.85", "131378.85"), f"{MODULE}: {output}"


def test_every_page_named_is_read(tmp_path: Path) -> None:
    write(tmp_path, page(*AGREEING), "clean.md")
    stale = "The casting area is the floor's, G1 = 37,800 sft."
    text = page(*AGREEING, stale)
    write(tmp_path, text, "stale.md")
    code, output = command(tmp_path, "clean.md", "stale.md")
    assert code == 1, f"{MODULE}: {output}"
    line = line_of(text, "37,800")
    assert naming(output, "stale.md", line, "G1", "37,800", "42,000"), f"{MODULE}: {output}"


def test_a_page_that_does_not_exist_is_not_passed(tmp_path: Path) -> None:
    code, text = command(tmp_path, "absent.md")
    assert code != 0, f"{MODULE}: exit {code}: {text}"
    assert "absent.md" in text, f"{MODULE}: exit {code}: {text}"
