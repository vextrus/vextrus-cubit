"""S27-G1's unit tests (#827): a page of a PDF of a known Discipline never names a sheet of another
known Discipline (`registration._foreign`), in the text match and in "One page, one sheet"; a sheet
of no Discipline stays one it may name. The sheets and pages are invented, matched by their text.
"""

from engine.plot import registration
from engine.plot.tests.test_one_page_each import SHA_A, mark, own, page, read
from engine.recognise.types import SheetCandidate, SheetLocation, Sourced, ValueSource


def sheet(number: str, discipline: str | None, layout: str = "") -> SheetCandidate:
    return SheetCandidate(
        SheetLocation(layout=layout or f"{discipline}-{number}"),
        number=Sourced(number, ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced(discipline, ValueSource.FILE) if discipline is not None else None,
    )


def disciplines(of: str | None) -> dict[str, str | None]:
    return {SHA_A: of}


def test_a_structural_page_names_a_sheet_of_no_discipline_of_its_number() -> None:
    """A sheet whose Discipline is not known is no other Discipline's: the page still names it."""
    sheets = [sheet("01", None)]

    found = registration.match([page(1, own("01"))], sheets, disciplines=disciplines("structural"))

    assert found[0].sheet is sheets[0]


def test_of_a_general_and_a_no_discipline_sheet_alike_a_structural_page_names_the_latter() -> None:
    """The General sheet of its number is set aside, not counted as a second sheet alike."""
    sheets = [sheet("01", "general"), sheet("01", None)]

    found = registration.match([page(1, own("01"))], sheets, disciplines=disciplines("structural"))

    assert found[0].sheet is sheets[1]


def test_a_page_naming_only_other_disciplines_sheets_names_no_sheet() -> None:
    sheets = [sheet("01", "general"), sheet("01", "architectural")]

    found = registration.match([page(1, own("01"))], sheets, disciplines=disciplines("structural"))

    assert found[0].sheet is None
    assert found[0].reason == "names_no_sheet"


def test_one_page_each_never_moves_a_page_to_another_disciplines_sheet() -> None:
    """Page 3's own number is S-03's, a General sheet's; its larger mark is S-05's, whose own page
    is 5. Page 3 is not moved to S-03 (in its place, free, but of another Discipline): it names
    S-05 unused, as a page naming nothing else would."""
    numbers = [f"S-{k:02d}" for k in range(1, 7)]
    sheets = [sheet(n, "general" if n == "S-03" else "structural") for n in numbers]
    pages = [page(k + 1, own(n)) for k, n in enumerate(numbers)]
    pages[2] = page(3, own("S-03"), mark("S-05"))

    found = registration.match(pages, sheets, disciplines=disciplines("structural"))

    assert read(found) == ["S-01", "S-02", "S-05~", "S-04", "S-05", "S-06"]


def test_a_pdf_of_no_discipline_names_any_disciplines_sheet() -> None:
    """Today's rule kept: with no Discipline, page 3 is S-03's, General or not."""
    numbers = [f"S-{k:02d}" for k in range(1, 7)]
    sheets = [sheet(n, "general" if n == "S-03" else "structural") for n in numbers]
    pages = [page(k + 1, own(n)) for k, n in enumerate(numbers)]
    pages[2] = page(3, own("S-03"), mark("S-05"))

    found = registration.match(pages, sheets, disciplines=disciplines(None))

    assert read(found) == numbers
