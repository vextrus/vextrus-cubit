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
        ("PLAN", "S-02", "COLUMN: LAYOUT"),  # in another order, a separator between
    ],
)
def test_a_page_that_holds_every_word_of_the_title_reads_it(items: tuple[str, ...]) -> None:
    page = page_of(*(item(text) for text in items))

    assert registration.reads_title(page, "COLUMN LAYOUT PLAN") is True


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
