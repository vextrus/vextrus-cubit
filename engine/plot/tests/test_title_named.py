"""S21-C3's own tests: a page naming several sheets alike is the one candidate's whose title it reads
(`registration._title_named`), at the seams its acceptance tests do not reach: several sheets sharing
the page's surest number, the bound on how many titles are read, and a read cut at its budget."""

from engine.plot import registration
from engine.plot.tests.test_plot import item, page_of
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


def test_a_read_cut_at_its_budget_tells_nothing_apart() -> None:
    """One candidate's title read past its walk's budget may be on the page: the other candidate's
    title, read whole, is not the only one, so the page still names several."""
    packed = [
        item("A", 10.0, (2000.0 + i % 7, 10.0 + i % 5, 2030.0 + i % 7, 20.0 + i % 5))
        for i in range(1500)
    ]
    sheets = [titled("S-1", " ".join(["A"] * 10 + ["B"])), titled("S-2", "INVENTED SLAB PLAN")]
    page = page_of(
        *marks(["S-1", "S-2"]),
        *packed,
        item("B", 10.0, (2000.0, 400.0, 2010.0, 410.0)),
        item("INVENTED SLAB PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)),
    )
    assert registration.title_read(page, sheets[0].title.value).cut  # type: ignore[union-attr]

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
