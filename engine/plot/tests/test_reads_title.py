"""Ticket #229's own tests: whether a Plot page reads its sheet's title (`registration.reads_title`),
the half of "number and title read alike" the number match does not already prove."""

import pytest

from engine.plot import registration
from engine.plot.tests.test_plot import item, page_of
from engine.read.pdf.types import Page


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


# Review 1 of #638: the chain walk is bounded, linear in the page's items -------------------------

TITLE_11 = "FIRST FLOOR BEAM LAYOUT PLAN AND SECTION DETAILS OF GRID LINES"


def _packed(n: int, word: str) -> Page:
    """`n` short items of one word, all within one block (each near every other)."""
    boxes = [(10.0 + i % 7, 10.0 + i % 5, 40.0 + i % 7, 20.0 + i % 5) for i in range(n)]
    return page_of(*[item(word, 10.0, box) for box in boxes])


def test_a_page_of_items_repeating_the_titles_first_word_is_read_fast() -> None:
    import time

    page = _packed(1500, "FIRST")
    began = time.monotonic()
    read = registration.reads_title(page, TITLE_11)
    assert time.monotonic() - began < 0.2
    assert read is False


def test_a_title_of_one_word_repeated_over_a_page_of_it_stops_at_its_budget() -> None:
    import time

    page = _packed(1500, "A")
    began = time.monotonic()
    read = registration.title_read(page, " ".join(["A"] * 10 + ["B"]))
    assert time.monotonic() - began < 0.2
    assert read == registration.TitleRead(False, cut=True)
    assert registration.reads_title(page, " ".join(["A"] * 10 + ["B"])) is False


def test_a_title_over_three_lines_is_read_among_many_far_items() -> None:
    far = [item("FIRST", 10.0, (5000.0 + i, 5000.0, 5030.0 + i, 5010.0)) for i in range(1500)]
    lines = [
        item("FIRST FLOOR BEAM", 10.0, (100.0, 100.0, 200.0, 110.0)),
        item("LAYOUT PLAN AND SECTION", 10.0, (100.0, 112.0, 240.0, 122.0)),
        item("DETAILS OF GRID LINES", 10.0, (100.0, 124.0, 230.0, 134.0)),
    ]
    read = registration.title_read(page_of(*far, *lines), TITLE_11)
    assert read == registration.TitleRead(True)


def _walked_unbounded(page: Page, title: str) -> bool:
    """#229's walk as it was before its budget: the reference the bounded walk must agree with."""
    words_of = registration._words
    wanted = words_of(title)
    if not wanted:
        return False
    lines = [(it, w) for it in page.items if (w := words_of(it.text))]
    n = len(wanted)
    if any(registration._holds(w, wanted) for _, w in lines):
        return True
    reached = [(it, k) for it, w in lines for k in range(1, n) if w[-k:] == wanted[:k]]
    seen: set[tuple[int, int]] = set()
    while reached:
        last, k = reached.pop()
        if (id(last), k) in seen:
            continue
        seen.add((id(last), k))
        for it, w in lines:
            if it is last or not registration._near(last, it):
                continue
            if w[: n - k] == wanted[k:]:
                return True
            if k + len(w) < n and wanted[k : k + len(w)] == w:
                reached.append((it, k + len(w)))
    return False


def test_the_bounded_walk_reads_as_the_unbounded_one_did_on_small_pages() -> None:
    import random

    rng = random.Random(638)
    vocabulary = ["GROUND", "FLOOR", "PLAN", "BEAM", "LAYOUT", "S-02", "-", "NOTE"]
    for _ in range(400):
        title = " ".join(rng.choice(vocabulary[:5]) for _ in range(rng.randint(1, 4)))
        items = []
        for _ in range(rng.randint(0, 9)):
            text = " ".join(rng.choice(vocabulary) for _ in range(rng.randint(1, 3)))
            x, y = rng.choice([0.0, 40.0, 400.0]) + rng.random() * 20, rng.choice([0.0, 15.0, 300.0])
            items.append(item(text, 10.0, (x, y, x + 60.0, y + 10.0)))
        page = page_of(*items)
        assert registration.reads_title(page, title) is _walked_unbounded(page, title), (title, items)
