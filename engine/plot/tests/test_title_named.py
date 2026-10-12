"""S21-C3's own tests: a page naming several sheets alike is the one candidate's whose title it reads
(`registration._title_named`), at the seams its acceptance tests do not reach: several sheets sharing
the page's surest number, the bound on how many titles are read, and a read cut at its budget."""

from engine.plot import registration
from engine.plot.tests.test_plot import item, page_of, sheet_buffers
from engine.plot.tests.timing import best_of
from engine.read.pdf.types import Page, TextItem
from engine.recognise.types import SheetCandidate, SheetLocation, Sourced, ValueSource


def titled(number: str, title: str | None, layout: str | None = None) -> SheetCandidate:
    return SheetCandidate(
        SheetLocation(layout=layout or number),
        number=Sourced(number, ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced(title, ValueSource.TITLE_BLOCK_TEXT) if title is not None else None,
    )


def named(page: Page, sheets: list[SheetCandidate]) -> object:
    (found,) = registration.match([page], sheets)
    return found.reason if found.sheet is None else sheets.index(found.sheet)


def marks(numbers: list[str]) -> list[TextItem]:
    """Each number a whole item, as large as the others, far from the rest of the page."""
    return [
        item(n, 10.0, (100.0 + 50.0 * k, 900.0, 120.0 + 50.0 * k, 910.0)) for k, n in enumerate(numbers)
    ]


def test_two_sheets_sharing_the_pages_number_are_told_apart_by_the_title_read() -> None:
    sheets = [titled("S-1", "INVENTED BEAM PLAN", "a"), titled("S-1", "INVENTED SLAB PLAN", "b")]
    page = page_of(item("S-1"), item("INVENTED SLAB PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)))

    assert named(page, sheets) == 1


def test_two_sheets_sharing_the_pages_number_and_a_title_still_name_several() -> None:
    sheets = [titled("S-1", "INVENTED SLAB PLAN", "a"), titled("S-1", "INVENTED SLAB PLAN", "b")]
    page = page_of(item("S-1"), item("INVENTED SLAB PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)))

    assert named(page, sheets) == "names_several_sheets"


def test_a_page_naming_more_sheets_than_the_bound_reads_no_title() -> None:
    def case(n: int) -> object:
        numbers = [f"S-{k}" for k in range(n)]
        sheets = [titled(number, f"INVENTED PLAN {number}") for number in numbers]
        page = page_of(*marks(numbers), item("INVENTED PLAN S-3", 7.0, (10.0, 30.0, 90.0, 37.0)))
        return named(page, sheets)

    assert case(registration.MAX_TITLE_READS) == 3
    assert case(registration.MAX_TITLE_READS + 1) == "names_several_sheets"


def _packed() -> list[TextItem]:
    """1500 items 'A' packed near each other: a chain read of a title of ten 'A's and a 'B' walks
    past its budget."""
    return [
        item("A", 10.0, (2000.0 + i % 7, 10.0 + i % 5, 2030.0 + i % 7, 20.0 + i % 5))
        for i in range(1500)
    ]


def test_a_title_read_whole_stands_over_a_chain_read_of_another_cut_at_its_budget() -> None:
    """The ruling on review 2 of #653: a title held whole in one item outranks a chain the budget
    could not finish (S21-C3 had the page name several)."""
    sheets = [titled("S-1", " ".join(["A"] * 10 + ["B"])), titled("S-2", "INVENTED SLAB PLAN")]
    page = page_of(
        *marks(["S-1", "S-2"]),
        *_packed(),
        item("B", 10.0, (2000.0, 400.0, 2010.0, 410.0)),
        item("INVENTED SLAB PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)),
    )
    assert registration.title_read(page, sheets[0].title.value).cut  # type: ignore[union-attr]

    assert named(page, sheets) == 1


def test_a_chain_read_cut_at_its_budget_where_no_title_is_read_whole_tells_nothing_apart() -> None:
    """No title held whole, and one candidate's chain read cut: its title may be on the page, so the
    other's chain read is not the only one and the page still names several."""
    sheets = [titled("S-1", " ".join(["A"] * 10 + ["B"])), titled("S-2", "INVENTED SLAB PLAN")]
    page = page_of(
        *marks(["S-1", "S-2"]),
        *_packed(),
        item("B", 10.0, (2000.0, 400.0, 2010.0, 410.0)),
        item("INVENTED SLAB", 7.0, (10.0, 30.0, 90.0, 37.0)),
        item("PLAN", 7.0, (10.0, 39.0, 40.0, 46.0)),
    )
    assert registration.title_read(page, sheets[0].title.value).cut  # type: ignore[union-attr]
    assert registration.reads_title(page, "INVENTED SLAB PLAN")

    assert named(page, sheets) == "names_several_sheets"


def test_a_title_whose_words_are_not_all_on_the_page_is_not_read() -> None:
    """The cheap test before a read: a candidate whose title holds a word no item holds is passed by,
    and the one whose title reads is the page's."""
    sheets = [
        titled("S-1", "INVENTED BEAM PLAN"),
        titled("S-2", "INVENTED SLAB PLAN"),
        titled("S-3", None),
    ]
    page = page_of(
        *marks(["S-1", "S-2", "S-3"]), item("INVENTED SLAB PLAN", 7.0, (10.0, 30.0, 90.0, 37.0))
    )

    assert named(page, sheets) == 1


def test_a_sheet_whose_paper_the_page_rules_out_is_not_taken_by_its_title() -> None:
    """Three sheets share the page's number; two are on the page's paper. The page reads the third's
    title: its paper is not the page's, so it is no candidate, and the two still name several."""
    sheets = [
        titled("S-1", "INVENTED BEAM PLAN", "a"),
        titled("S-1", "INVENTED SLAB PLAN", "b"),
        titled("S-1", "INVENTED ROOF PLAN", "c"),
    ]
    geometry = [sheet_buffers((420.0, 297.0)), sheet_buffers(), sheet_buffers()]
    page = page_of(item("S-1"), item("INVENTED BEAM PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)))
    (found,) = registration.match([page], sheets, geometry)

    assert found.sheet is None
    assert found.reason == "names_several_sheets"


def test_a_smaller_cross_reference_is_not_taken_over_the_sheets_sharing_the_pages_number() -> None:
    """The page's surest number (whole, its largest) is two sheets'; a smaller whole number, another
    sheet's, has its title read on the page: that sheet is a cross-reference, not the page's."""
    sheets = [
        titled("S-1", "INVENTED BEAM PLAN", "a"),
        titled("S-1", "INVENTED SLAB PLAN", "b"),
        titled("S-9", "INVENTED NINTH PLAN"),
    ]
    page = page_of(
        item("S-1", 10.0),
        item("S-9", 6.0, (400.0, 400.0, 420.0, 406.0)),
        item("INVENTED NINTH PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)),
    )

    assert named(page, sheets) == "names_several_sheets"


def test_two_sheets_sharing_a_number_held_only_in_a_note_are_not_told_apart_by_title() -> None:
    sheets = [titled("S-1", "INVENTED BEAM PLAN", "a"), titled("S-1", "INVENTED SLAB PLAN", "b")]
    page = page_of(item("SEE S-1"), item("INVENTED SLAB PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)))

    assert named(page, sheets) == "names_several_sheets"


def test_a_page_whose_reads_all_walk_near_their_budget_stays_fast() -> None:
    """32 candidates, each title's words all on the page, each walk long but uncut: the page's reads
    share one read's budget, so the page costs about one read, not 32 (the refuter's hostile page)."""
    numbers = [f"S-{k}" for k in range(registration.MAX_TITLE_READS)]
    sheets = [titled(number, " ".join(["A"] * 10 + ["B"])) for number in numbers]
    packed = [
        item("A", 10.0, (2000.0 + i % 7, 10.0 + i % 5, 2030.0 + i % 7, 20.0 + i % 5)) for i in range(250)
    ]
    pad = [item(f"P{i}", 1.0, (5000.0 + i, 5000.0, 5001.0 + i, 5001.0)) for i in range(20000)]
    page = page_of(*marks(numbers), *packed, *pad, item("B", 10.0, (2000.0, 900.0, 2010.0, 910.0)))

    one = best_of(
        lambda: registration.title_read(page, sheets[0].title.value if sheets[0].title else None)
    )
    page_reads = best_of(lambda: named(page, sheets))
    found = named(page, sheets)

    assert page_reads < 4 * one + 0.05, (page_reads, one)
    assert found == "names_several_sheets"
