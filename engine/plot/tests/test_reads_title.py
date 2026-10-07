"""Ticket #229's own tests: whether a Plot page reads its sheet's title (`registration.reads_title`),
the half of "number and title read alike" the number match does not already prove."""

import pytest

from engine.plot import registration
from engine.plot.tests.test_plot import item, page_of


@pytest.mark.parametrize(
    "items",
    [
        ("S-02", "COLUMN LAYOUT PLAN"),  # one item
        ("S-02", "COLUMN LAYOUT", "PLAN"),  # a title drawn over two lines
        ("S-02", "Column  layout\N{NO-BREAK SPACE}plan"),  # case and spaces folded (13's normal form)
        ("PLAN", "S-02", "COLUMN: LAYOUT"),  # its lines' items in another order, a separator between
        (
            "S-02",
            "SHEET: COLUMN",
            "LAYOUT PLAN (R1)",
        ),  # a line ending with its start, one starting with the rest
    ],
)
def test_a_page_that_reads_the_title_in_order_reads_it(items: tuple[str, ...]) -> None:
    page = page_of(*(item(text) for text in items))

    assert registration.reads_title(page, "COLUMN LAYOUT PLAN") is True


def test_two_lines_far_apart_are_not_one_title() -> None:
    """A note ending with the title's start, far from a line starting with the rest: no title drawn
    over two lines (the stored walk of main: 14 of 27 wrong reads were such chains)."""
    page = page_of(
        item("S-02"),
        item("SEE COLUMN", box=(100.0, 100.0, 160.0, 110.0)),
        item("LAYOUT PLAN", box=(900.0, 700.0, 966.0, 710.0)),
    )
    near = page_of(
        item("S-02"),
        item("SEE COLUMN", box=(100.0, 100.0, 160.0, 110.0)),
        item("LAYOUT PLAN", box=(100.0, 114.0, 166.0, 124.0)),
    )

    assert registration.reads_title(page, "COLUMN LAYOUT PLAN") is False
    assert registration.reads_title(near, "COLUMN LAYOUT PLAN") is True


def test_a_title_over_three_lines_reads_alike() -> None:
    page = page_of(item("S-02"), item("TYPICAL"), item("COLUMN LAYOUT"), item("PLAN"))

    assert registration.reads_title(page, "TYPICAL COLUMN LAYOUT PLAN") is True


@pytest.mark.parametrize(
    ("items", "title"),
    [
        (("S-02", "FIRST FLOOR PLAN", "NOTE: FINISHED GROUND LEVEL +0.000"), "GROUND FLOOR PLAN"),
        (("S-02", "FOUNDATION LAYOUT PLAN", "ALL COLUMN DIMENSIONS ARE IN MM"), "COLUMN LAYOUT PLAN"),
        (("S-02", "PLAN LAYOUT COLUMN"), "COLUMN LAYOUT PLAN"),  # its words, out of order
        (("S-02", "COLUMN NOTES", "FOUNDATION LAYOUT PLAN"), "COLUMN LAYOUT PLAN"),
    ],
)
def test_the_titles_words_scattered_over_the_page_are_not_its_title(
    items: tuple[str, ...], title: str
) -> None:
    """Another title, the sheet's words in its notes (review 1 of #229): the page reads another
    sheet's title, not this one's."""
    page = page_of(*(item(text) for text in items))

    assert registration.reads_title(page, title) is False


@pytest.mark.parametrize(
    "items",
    [
        ("S-02", "ROOF SLAB REINFORCEMENT DETAILS"),  # another title
        ("S-02", "COLUMN LAYOUT"),  # part of it
        ("S-02", "COLUMN LAYOUTPLAN"),  # its words run together: not its words
        ("S-02",),  # no title on the page
        (),  # a page with no text (matched by its ink)
    ],
)
def test_a_page_missing_a_word_of_the_title_does_not_read_it(items: tuple[str, ...]) -> None:
    page = page_of(*(item(text) for text in items))

    assert registration.reads_title(page, "COLUMN LAYOUT PLAN") is False


@pytest.mark.parametrize("title", [None, "", "   ", "​"])
def test_a_sheet_with_no_title_reads_none_alike(title: str | None) -> None:
    """Nothing to read alike is no second source, however much the page says."""
    page = page_of(item("S-02"), item("COLUMN LAYOUT PLAN"))

    assert registration.reads_title(page, title) is False


def test_a_word_inside_a_longer_word_is_not_the_word() -> None:
    """ "PLAN" inside "PLANNING" is not the title's word."""
    page = page_of(item("S-02"), item("COLUMN LAYOUT PLANNING"))

    assert registration.reads_title(page, "COLUMN LAYOUT PLAN") is False


@pytest.mark.parametrize("title", ["-", "- / -", "()"])
def test_a_title_of_punctuation_alone_reads_none_alike(title: str) -> None:
    """A word is read by its letters or digits: a page holding a dash reads no dash title (the
    refuter, session 11)."""
    page = page_of(item("S-02"), item(title), item("COLUMN LAYOUT PLAN"))

    assert registration.reads_title(page, title) is False
