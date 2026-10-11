"""Train C's join of S21-C3 and Train A's #642 fix: `title_read`'s shared `budget` (C3: one budget
the reads of a page share) is charged every comparison the read makes, the tables' building as the
walk (#642), and a read the shared budget cannot pay for is cut. Every word is invented."""

import time
from collections.abc import Callable

import pytest

from engine.plot import registration
from engine.plot.tests.test_plot import item, page_of
from engine.plot.tests.test_title_named import marks, named, titled
from engine.read.pdf.types import Page
from engine.recognise.types import SheetCandidate


def test_a_read_that_finds_no_title_still_charges_the_shared_budget_its_tables() -> None:
    page = page_of(
        *(item(f"INVENTED SLAB {k}", 7.0, (10.0, 30.0 + 10 * k, 90.0, 37.0 + 10 * k)) for k in range(5))
    )
    budget = [1000]

    read = registration.title_read(page, "INVENTED SLAB PLAN", budget)

    assert read == registration.TitleRead(False)
    assert budget[0] < 1000


def test_a_spent_shared_budget_cuts_the_next_read_unread() -> None:
    page = page_of(item("INVENTED SLAB PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)))

    assert registration.title_read(page, "INVENTED SLAB PLAN", [0]) == registration.TitleRead(
        False, cut=True
    )
    assert registration.title_read(page, "INVENTED SLAB PLAN") == registration.TitleRead(True)


def test_a_shared_budget_too_small_for_the_tables_cuts_the_read() -> None:
    page = page_of(
        *(item(f"INVENTED SLAB {k}", 7.0, (10.0, 30.0 + 10 * k, 90.0, 37.0 + 10 * k)) for k in range(50))
    )

    assert registration.title_read(page, "INVENTED SLAB PLAN", [3]).cut


def _scattered_titles_page() -> tuple[Page, list[SheetCandidate]]:
    """Review 1 of #653's invented page: 32 sheets tied on the page's surest number, each title's two
    words on the page but far apart (never read as a chain), and 1500 padding items of 2000
    characters each, so that putting the page's items in normal form is the read's dearest work."""
    count = registration.MAX_TITLE_READS
    numbers = [f"S-{k}" for k in range(count)]
    sheets = [titled(number, f"INVENTEDHEAD{k} INVENTEDTAIL{k}") for k, number in enumerate(numbers)]
    heads = [
        item(f"INVENTEDHEAD{k}", 7.0, (10.0, 30.0 + 20 * k, 90.0, 37.0 + 20 * k)) for k in range(count)
    ]
    tails = [
        item(f"INVENTEDTAIL{k}", 7.0, (1500.0, 30.0 + 20 * k, 1580.0, 37.0 + 20 * k))
        for k in range(count)
    ]
    pad = [
        item(f"PAD{i:05d} " + "X" * 1990, 1.0, (5000.0 + i, 5000.0, 5001.0 + i, 5001.0))
        for i in range(1500)
    ]
    return page_of(*marks(numbers), *heads, *tails, *pad), sheets


def test_a_page_of_many_scattered_titles_costs_about_one_read() -> None:
    """Review 1 of #653: each candidate's read put every item of the page in normal form again, work
    the shared budget never charged, so 32 candidates whose titles' words are all on the page cost 33
    page passes. The page's items are put in normal form once; its reads share one budget."""
    page, sheets = _scattered_titles_page()

    began = time.monotonic()
    registration.title_read(page, "INVENTEDHEAD0 INVENTEDTAIL0")
    one = time.monotonic() - began
    began = time.monotonic()
    found = named(page, sheets)
    page_reads = time.monotonic() - began

    assert found == "names_several_sheets"
    assert page_reads < 4 * one + 0.05, (page_reads, one)


def test_title_named_puts_each_item_of_the_page_in_normal_form_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The class of review 1 of #653: however many candidates' titles a page is read for, each of its
    items is put in normal form exactly once (a caller reading the page anew per candidate fails)."""
    page, sheets = _scattered_titles_page()
    texts = {it.text for it in page.items}
    counts: dict[str, int] = {}
    words = registration._words

    def counted(text: str | None) -> list[str]:
        if text is not None and text in texts:
            counts[text] = counts.get(text, 0) + 1
        return words(text)

    monkeypatch.setattr(registration, "_words", counted)
    for n in (2, 8, registration.MAX_TITLE_READS):
        counts.clear()
        registration._title_named(page, sheets, list(range(n)))
        assert set(counts) == texts, n
        assert set(counts.values()) == {1}, (n, max(counts.values()))


def test_a_page_of_many_short_items_and_scattered_titles_costs_about_one_read() -> None:
    """The refuter's page on the first fix of review 1 of #653: 20000 one-word items besides the
    scattered titles. A read that walked every line of the page, charged nothing for a line holding
    none of its title's words, made 32 reads cost about 12; a read visits only the lines it is
    charged for."""
    count = registration.MAX_TITLE_READS
    numbers = [f"S-{k}" for k in range(count)]
    sheets = [titled(number, f"INVENTEDHEAD{k} INVENTEDTAIL{k}") for k, number in enumerate(numbers)]
    heads = [
        item(f"INVENTEDHEAD{k}", 7.0, (10.0, 30.0 + 20 * k, 90.0, 37.0 + 20 * k)) for k in range(count)
    ]
    tails = [
        item(f"INVENTEDTAIL{k}", 7.0, (1500.0, 30.0 + 20 * k, 1580.0, 37.0 + 20 * k))
        for k in range(count)
    ]
    pad = [item(f"W{i}X", 1.0, (5000.0 + i % 97, 5000.0, 5001.0 + i % 97, 5001.0)) for i in range(20000)]
    page = page_of(*marks(numbers), *heads, *tails, *pad)

    began = time.monotonic()
    registration.title_read(page, "INVENTEDHEAD0 INVENTEDTAIL0")
    one = time.monotonic() - began
    began = time.monotonic()
    found = named(page, sheets)
    page_reads = time.monotonic() - began

    assert found == "names_several_sheets"
    assert page_reads < 4 * one + 0.05, (page_reads, one)


def test_a_page_of_short_lines_each_starting_every_title_costs_about_one_read() -> None:
    """The refuter's page on the second fix of review 1 of #653: 20000 one-word lines, each the first
    word every candidate's title starts with. Each line a read visits is charged, but a shared budget
    of a whole read's (32 steps an item) let 32 reads visit every line, about 10 reads' time; the
    page's reads share a few steps an item (`TITLE_STEPS_PER_ITEM`)."""
    count = registration.MAX_TITLE_READS
    numbers = [f"S-{k}" for k in range(count)]
    sheets = [titled(number, f"INVENTEDLEAD INVENTEDTAIL{k}") for k, number in enumerate(numbers)]
    tails = [
        item(f"INVENTEDTAIL{k}", 7.0, (1500.0, 30.0 + 20 * k, 1580.0, 37.0 + 20 * k))
        for k in range(count)
    ]
    pad = [
        item("INVENTEDLEAD", 1.0, (5000.0 + i % 97, 5000.0, 5001.0 + i % 97, 5001.0))
        for i in range(20000)
    ]
    page = page_of(*marks(numbers), *pad, *tails)

    began = time.monotonic()
    registration.title_read(page, "INVENTEDLEAD INVENTEDTAIL0")
    one = time.monotonic() - began
    began = time.monotonic()
    found = named(page, sheets)
    page_reads = time.monotonic() - began

    assert found == "names_several_sheets"
    assert page_reads < 4 * one + 0.05, (page_reads, one)
    assert registration.TITLE_STEPS_PER_ITEM < registration.CHAIN_STEPS_PER_ITEM


def test_a_page_whose_first_candidates_read_is_cheap_and_the_rest_dear_costs_about_one_read() -> None:
    """The refuter's page on the third fix of review 1 of #653: candidate 0's title leads with a word
    one line holds, the other 31 with a word 20000 short lines are. One read of candidate 0's title is
    one page pass; at 4 steps an item the other reads visited 4 lines an item, 5 to 7 such reads'
    time. The page's reads together visit about as many lines as it has (`TITLE_STEPS_PER_ITEM`)."""
    count = registration.MAX_TITLE_READS
    numbers = [f"S-{k}" for k in range(count)]
    lead = ["INVENTEDRARE", *(["INVENTEDLEAD"] * (count - 1))]
    sheets = [titled(number, f"{lead[k]} INVENTEDTAIL{k}") for k, number in enumerate(numbers)]
    rare = [item("INVENTEDRARE", 7.0, (10.0, 30.0, 90.0, 37.0))]
    tails = [
        item(f"INVENTEDTAIL{k}", 7.0, (1500.0, 60.0 + 20 * k, 1580.0, 67.0 + 20 * k))
        for k in range(count)
    ]
    pad = [
        item("INVENTEDLEAD", 1.0, (5000.0 + i % 97, 5000.0, 5001.0 + i % 97, 5001.0))
        for i in range(60000)
    ]
    page = page_of(*marks(numbers), *rare, *pad, *tails)

    one = min(
        _timed(lambda: registration.title_read(page, "INVENTEDRARE INVENTEDTAIL0")) for _ in range(3)
    )
    page_reads = _timed(lambda: named(page, sheets))

    assert named(page, sheets) == "names_several_sheets"
    assert page_reads < 4 * one + 0.05, (page_reads, one)
    assert registration.TITLE_STEPS_PER_ITEM == 1


def _timed(call: Callable[[], object]) -> float:
    began = time.monotonic()
    call()
    return time.monotonic() - began


# Review 2 of #653: titles held whole are read first, for every candidate at once, never cut


def _column_page(
    columns: int, count: int, own: int, label: str = ""
) -> tuple[Page, list[SheetCandidate]]:
    """The reviewer's column plan: `count` sheets tied on the page's number, every title starting
    COLUMN, `columns` items 'COLUMN C<n>' (and `label`, where given), the page's own title (sheet
    `own`'s) one whole item and the others' words scattered far apart."""
    numbers = [f"S-{k}" for k in range(count)]
    sheets = [titled(number, f"COLUMN INVENTED{k} PLAN") for k, number in enumerate(numbers)]
    scattered = [
        item(f"INVENTED{k}", 7.0, (3000.0, 30.0 + 20 * k, 3080.0, 37.0 + 20 * k))
        for k in range(count)
        if k != own
    ]
    grid = [
        item(
            f"COLUMN C{n}{label}",
            5.0,
            (
                100.0 + 60 * (n % 40),
                100.0 + 30 * (n // 40),
                140.0 + 60 * (n % 40),
                105.0 + 30 * (n // 40),
            ),
        )
        for n in range(columns)
    ]
    page = page_of(
        *marks(numbers),
        *grid,
        *scattered,
        item("PLAN", 7.0, (3500.0, 700.0, 3540.0, 707.0)),
        item(f"COLUMN INVENTED{own} PLAN", 7.0, (2500.0, 1000.0, 2600.0, 1007.0)),
    )
    return page, sheets


def test_a_column_plan_whose_own_title_is_whole_names_its_sheet() -> None:
    """Review 2 of #653: 1204 items, four tied candidates whose titles start COLUMN, 1200 items
    'COLUMN C<n>'. Each chain read costs about 2400 steps; under one shared budget the third was cut
    and the page named several, though its own title is one whole item."""
    page, sheets = _column_page(1200, 4, own=2)

    assert named(page, sheets) == 2


def test_a_smaller_column_plan_of_three_candidates_names_its_sheet() -> None:
    """The same loss at about 800 items with three candidates (the reviewer's measure), each column
    label three words, so that each read is charged about three steps a label."""
    page, sheets = _column_page(800, 3, own=0, label=" INVENTEDTYPE")

    assert named(page, sheets) == 0


def test_32_candidates_of_2000_word_titles_one_held_whole_stays_within_the_bound() -> None:
    """32 titles of about 2000 words (review 1 of #641's length), each of distinct length, on a page of
    300 items of 500 of their words: the whole reads are one walk of the page's words, however long
    the titles; the title held whole in one item is read, the others' chains cut."""
    count = registration.MAX_TITLE_READS
    numbers = [f"S-{k}" for k in range(count)]
    titles = [" ".join(["INVENTEDA"] * (1968 + k) + [f"INVENTEDEND{k}"]) for k in range(count)]
    sheets = [titled(number, title) for number, title in zip(numbers, titles, strict=True)]
    filler = " ".join(["INVENTEDA"] * 500)
    lines = [
        item(filler, 1.0, (5000.0 + i % 13, 100.0 + i % 11, 5001.0 + i % 13, 101.0 + i % 11))
        for i in range(300)
    ]
    ends = [
        item(f"INVENTEDEND{k}", 7.0, (3000.0, 30.0 + 20 * k, 3080.0, 37.0 + 20 * k))
        for k in range(count)
    ]
    page = page_of(*marks(numbers), *lines, *ends, item(titles[0], 1.0, (10.0, 10.0, 11.0, 11.0)))

    one = min(_timed(lambda: registration.title_read(page, titles[0])) for _ in range(3))
    page_reads = _timed(lambda: named(page, sheets))

    assert named(page, sheets) == 0
    assert page_reads < 4 * one + 0.05, (page_reads, one)


def test_a_match_puts_each_sheets_title_in_normal_form_once_however_many_pages_name_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The refuter on review 2 of #653: 32 candidates' long titles, none of their words on the page,
    were each put in normal form for every page that named them, uncharged (27 reads of one a page).
    A match reads each sheet's title once, for all its pages."""
    count = registration.MAX_TITLE_READS
    numbers = [f"S-{k}" for k in range(count)]
    titles = [" ".join(f"INVENTEDOFF{k}W{w}" for w in range(50)) for k in range(count)]
    sheets = [titled(number, title) for number, title in zip(numbers, titles, strict=True)]
    pages = [page_of(*marks(numbers)) for _ in range(5)]
    counts: dict[str, int] = {}
    words = registration._words

    def counted(text: str | None) -> list[str]:
        if text in titles:
            counts[text] = counts.get(text, 0) + 1
        return words(text)

    monkeypatch.setattr(registration, "_words", counted)
    found = registration.match(pages, sheets)

    assert [f.reason for f in found] == ["names_several_sheets"] * len(pages)
    assert set(counts) == set(titles)
    assert set(counts.values()) == {1}, max(counts.values())


def test_chain_reads_charge_each_line_they_visit_holding_a_titles_first_word_mid_line() -> None:
    """Review 2 of #653's own regression: the chain reads skip the whole-item loop that charged each
    line holding the title's first word, so 60000 lines 'A<i> INVENTEDLEAD B C' were visited by 31
    reads uncharged, 6.6 reads of one. Each line a chain read visits is charged."""
    count = registration.MAX_TITLE_READS
    numbers = [f"S-{k}" for k in range(count)]
    lead = ["INVENTEDRARE", *(["INVENTEDLEAD"] * (count - 1))]
    sheets = [titled(number, f"{lead[k]} INVENTEDTAIL{k}") for k, number in enumerate(numbers)]
    rare = [item("INVENTEDRARE", 7.0, (10.0, 30.0, 90.0, 37.0))]
    tails = [
        item(f"INVENTEDTAIL{k}", 7.0, (1500.0, 60.0 + 20 * k, 1580.0, 67.0 + 20 * k))
        for k in range(count)
    ]
    pad = [
        item(f"A{i} INVENTEDLEAD B C", 1.0, (5000.0 + i % 97, 5000.0, 5001.0 + i % 97, 5001.0))
        for i in range(60000)
    ]
    page = page_of(*marks(numbers), *rare, *pad, *tails)

    one = min(
        _timed(lambda: registration.title_read(page, "INVENTEDRARE INVENTEDTAIL0")) for _ in range(3)
    )
    page_reads = _timed(lambda: named(page, sheets))

    assert named(page, sheets) == "names_several_sheets"
    assert page_reads < 4 * one + 0.05, (page_reads, one)
