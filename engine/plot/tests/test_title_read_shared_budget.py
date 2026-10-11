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
