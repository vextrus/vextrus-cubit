"""S24-A5's tests: one page a sheet and one sheet a page in a PDF (`registration.one_page_each`). A
page whose own number is small text, beside a larger mark that is another sheet's number, named that
sheet, which its own page named too: two pages on one sheet, and the page's own sheet left with none.
A page's place among the pages holding their sheets alone decides; where it does not, the ink; where
neither does, the pages are left as they named it (the product keeps the surest). A swapped pair of
pages makes only its own places unknown. The sheets and pages are invented, matched by their text
alone unless a test draws them.
"""

import random
from collections.abc import Sequence
from pathlib import Path
from typing import overload

import pytest

from engine.fixtures.pdf._writer import Page as PdfPage
from engine.fixtures.pdf._writer import Pdf, document, num, text, truetype_font
from engine.plot import ink, picture, registration
from engine.plot.registration import _order_key
from engine.plot.tests.test_plot import A1, PT, TITLE_BLOCK, body, item, sheet_buffers
from engine.plot.tests.test_plot import sheet as titled_sheet
from engine.read.pdf import page_text
from engine.read.pdf.types import Page, TextItem
from engine.recognise.types import PlotMatch, SheetCandidate, SheetLocation, Sourced, ValueSource
from engine.render.buffers import SheetBuffers

SHA_A = "a" * 64
SHA_B = "b" * 64


def sheet(number: str) -> SheetCandidate:
    return SheetCandidate(
        SheetLocation(layout=number), number=Sourced(number, ValueSource.TITLE_BLOCK_TEXT)
    )


def own(number: str) -> TextItem:
    """The page's own number, in its title block: whole, and small."""
    return item(number, 4.0, (2300.0, 40.0, 2320.0, 44.0))


def mark(number: str) -> TextItem:
    """Another sheet's number as a larger mark on the page (a detail mark, a callout)."""
    return item(number, 14.0, (900.0, 900.0, 930.0, 914.0))


def page(number: int, *items: TextItem, source: str = SHA_A) -> Page:
    w, h = A1[0] * PT, A1[1] * PT
    return Page(source, number, w, h, 0, (0.0, 0.0, w, h), False, tuple(items))


def numbered(n: int) -> list[str]:
    return [f"S-{k:02d}" for k in range(1, n + 1)]


def read(found: list[PlotMatch]) -> list[str]:
    """Each page's sheet number ("~" after it where the page names it unused), or its reason."""
    out = []
    for m in found:
        if m.sheet is not None and m.sheet.number is not None:
            out.append(m.sheet.number.value + ("" if m.used else "~"))
        else:
            out.append(str(m.reason))
    return out


def no_sheet_twice(found: list[PlotMatch]) -> None:
    """One page used a sheet in each PDF."""
    held = [(getattr(m.page, "source_sha256", None), id(m.sheet)) for m in found if m.sheet and m.used]
    assert len(held) == len(set(held))


# In order: the order decides ---------------------------------------------------------------------------


def test_a_collision_in_a_pdf_in_order_is_decided_by_the_order() -> None:
    """The real case's shape: page 3's own number is small, and a larger mark on it is S-05's
    number; page 5 is S-05's. Page 3 is S-03, page 5 is S-05, and no sheet has two pages."""
    numbers = numbered(6)
    sheets = [sheet(n) for n in numbers]
    pages = [page(k + 1, own(n)) for k, n in enumerate(numbers)]
    pages[2] = page(3, own("S-03"), mark("S-05"))

    found = registration.match(pages, sheets)

    assert read(found) == numbers
    no_sheet_twice(found)


def test_the_page_its_place_does_not_hold_names_its_sheet_unused() -> None:
    """Page 3 names S-05 alone: S-05 is page 5's by the order, and page 3 takes none (S-03 then has
    no page, and says so through the Check)."""
    numbers = numbered(6)
    sheets = [sheet(n) for n in numbers]
    pages = [page(k + 1, own(n)) for k, n in enumerate(numbers)]
    pages[2] = page(3, mark("S-05"))

    found = registration.match(pages, sheets)

    assert read(found) == ["S-01", "S-02", "S-05~", "S-04", "S-05", "S-06"]
    no_sheet_twice(found)


def test_two_pages_as_sure_in_the_same_place_are_left_as_they_named_it() -> None:
    """Pages 3 and 4 both name S-03 alone, between S-02 and S-05: nothing here tells which, so both
    are left naming it, as before (the product keeps one, its report saying both show it)."""
    sheets = [sheet(n) for n in numbered(5)]
    pages = [
        page(1, own("S-01")),
        page(2, own("S-02")),
        page(3, own("S-03")),
        page(4, own("S-03")),
        page(5, own("S-05")),
    ]

    assert read(registration.match(pages, sheets)) == ["S-01", "S-02", "S-03", "S-03", "S-05"]


def test_two_pages_in_the_same_place_leave_the_sheet_to_the_surer() -> None:
    """S15-A5's case (m0-screens 4.5, "Pages 4 and 5 both show S-04; page 5 is used."): pages 3 and
    4 both name S-03 in one place, page 4 in larger text. Both are left naming it: the product keeps
    page 4, and its report says both show S-03."""
    sheets = [sheet(n) for n in numbered(5)]
    pages = [
        page(1, own("S-01")),
        page(2, own("S-02")),
        page(3, own("S-03")),
        page(4, mark("S-03")),
        page(5, own("S-05")),
    ]

    assert read(registration.match(pages, sheets)) == ["S-01", "S-02", "S-03", "S-03", "S-05"]


def test_a_swapped_pair_elsewhere_leaves_the_order_to_decide() -> None:
    """Pages 2 and 3 are swapped (S-03, S-02), and page 4's larger mark is S-06's number: page 4's
    place (S-02 to S-05) is known all the same, so it is S-04 and page 6 is S-06 (#703's review: one
    swapped pair made the whole PDF out of order)."""
    sheets = [sheet(n) for n in numbered(6)]
    pages = [
        page(1, own("S-01")),
        page(2, own("S-03")),
        page(3, own("S-02")),
        page(4, own("S-04"), mark("S-06")),
        page(5, own("S-05")),
        page(6, own("S-06")),
    ]

    found = registration.match(pages, sheets)

    assert read(found) == ["S-01", "S-03", "S-02", "S-04", "S-05", "S-06"]
    no_sheet_twice(found)


def test_a_page_between_a_swapped_pair_is_unused_beside_the_page_whose_place_holds_it() -> None:
    """Page 3 lies between S-04 and S-02, a swapped pair: its place is not known. Page 6's place
    holds S-06, which page 3's larger mark names too: page 6 is S-06's, and page 3 says so."""
    sheets = [sheet(n) for n in numbered(6)]
    pages = [
        page(1, own("S-01")),
        page(2, own("S-04")),
        page(3, own("S-03"), mark("S-06")),
        page(4, own("S-02")),
        page(5, own("S-05")),
        page(6, own("S-06")),
    ]

    assert read(registration.match(pages, sheets)) == ["S-01", "S-04", "S-06~", "S-02", "S-05", "S-06"]


def test_a_page_given_its_sheet_by_the_order_frees_the_next_choice() -> None:
    """Pages 3 and 4 both name S-03 (page 4's mark), page 4 S-04 too: page 3 can be only S-03, so
    page 4 is S-04."""
    sheets = [sheet(n) for n in numbered(5)]
    pages = [
        page(1, own("S-01")),
        page(2, own("S-02")),
        page(3, own("S-03")),
        page(4, own("S-04"), mark("S-03")),
        page(5, own("S-05")),
    ]

    found = registration.match(pages, sheets)

    assert read(found) == numbered(5)


def test_sheet_numbers_are_in_order_by_their_numbers_value() -> None:
    """A-99 comes before A-100: a PDF of A-98 to A-101 is in order, and its collision decided."""
    numbers = ["A-98", "A-99", "A-100", "A-101"]
    sheets = [sheet(n) for n in numbers]
    pages = [page(k + 1, own(n)) for k, n in enumerate(numbers)]
    pages[1] = page(2, own("A-99"), mark("A-101"))

    assert read(registration.match(pages, sheets)) == numbers


def test_two_sheets_of_one_number_keep_the_pdf_in_order() -> None:
    """Two sheets drawn with one number (a drafting slip) are each a page: the PDF stays in order."""
    numbers = ["S-01", "S-02", "S-02", "S-04", "S-05"]
    sheets = [sheet(n) for n in numbers]
    pages = [page(k + 1, own(n)) for k, n in enumerate(numbers)]
    pages[3] = page(4, own("S-04"), mark("S-05"))
    found = registration.match(pages, sheets)

    assert read(found)[3:] == ["S-04", "S-05"]
    no_sheet_twice(found)


# The order says nothing: the ink tells them apart, or neither takes it ------------------------------


def _two_page_plot(
    tmp_path: Path, before: str | None = None, after: str | None = None, middle: str | None = None
) -> Path:
    """A PDF at 1:1 whose two pages both carry S-201's title block alike: the first draws another
    drawing (a page referring to S-201), the second S-201's own body (157's review, N1); with a
    page before them naming `before` alone and one after naming `after`, where given."""
    pdf = Pdf()
    font = truetype_font(pdf)
    size = (A1[0] * PT, A1[1] * PT)
    pages = []
    if before is not None:
        pages.append(PdfPage(content=text(60, 60, before, size=10), size=size, fonts={"F1": font}))
    other = [(60.0 + 31.0 * i, 80.0, 90.0 + 31.0 * i, 420.0 - 9.0 * i) for i in range(18)]
    for n, lines in enumerate((other, body(A1))):
        if n == 1 and middle is not None:
            content = text(60, 60, middle, size=10)
            pages.append(PdfPage(content=content, size=size, fonts={"F1": font}))
        content = b"0.5 w\n"
        for x0, y0, x1, y1 in lines:
            content += b"%s %s m %s %s l S\n" % (num(PT * x0), num(PT * y0), num(PT * x1), num(PT * y1))
        for value, (x0, y0, _, y1) in TITLE_BLOCK.values():
            content += text(PT * x0, PT * y0, value, size=(y1 - y0) * PT)
        pages.append(PdfPage(content=content, size=size, fonts={"F1": font}))
    if after is not None:
        pages.append(PdfPage(content=text(60, 60, after, size=10), size=size, fonts={"F1": font}))
    path = tmp_path / "two.pdf"
    path.write_bytes(document(pdf, pages, info={"Producer": "AutoCAD"}))
    return path


@pytest.fixture
def _no_sandbox(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    picture._kept.clear()
    ink._last.clear()


@pytest.mark.usefixtures("_no_sandbox")
def test_two_pages_naming_a_sheet_alike_are_told_apart_by_its_ink(tmp_path: Path) -> None:
    """No other page gives an order: the sheet is the page its ink agrees with clearly best."""
    path = _two_page_plot(tmp_path)
    pages = page_text(path)
    plots = {pages[0].source_sha256: path}

    found = registration.match(pages, [titled_sheet()], [sheet_buffers()], plots)

    assert read(found) == ["S-201~", "S-201"]
    assert found[1].transform is not None


@pytest.mark.usefixtures("_no_sandbox")
def test_a_clear_fit_by_the_ink_outranks_the_order(tmp_path: Path) -> None:
    """The same two pages between S-101's page and S-102's: S-201 fits neither's place, and the
    second page's ink agrees with it clearly best: it is used, the first names it unused (#703's
    review: a clear fit outranks the order)."""
    path = _two_page_plot(tmp_path, before="S-101", after="S-102")
    pages = page_text(path)
    sheets = [titled_sheet(), sheet("S-101"), sheet("S-102")]
    plots = {pages[0].source_sha256: path}

    found = registration.match(pages, sheets, [sheet_buffers()], plots)

    assert read(found) == ["S-101", "S-201~", "S-201", "S-102"]


@pytest.mark.usefixtures("_no_sandbox")
def test_the_ink_is_tried_only_within_the_budget_it_is_given(tmp_path: Path) -> None:
    """The ink tries are the match's (`MAX_INK_TRIES`, shared): with fewer left than the pages to
    try, nothing is drawn and the pages are left as they named it; with enough, the ink decides."""
    path = _two_page_plot(tmp_path)
    pages = page_text(path)
    plots = {pages[0].source_sha256: path}
    one, buffers = titled_sheet(), sheet_buffers()
    found = []
    for p in pages:
        placed = registration.place(p, one, buffers)
        assert placed is not None
        found.append(PlotMatch(p, sheet=one, transform=placed[0]))

    spent = [1]
    short = registration.one_page_each(found, [one], [buffers], plots, budget=spent)
    assert read(short) == ["S-201", "S-201"]  # left as they named it
    assert spent == [1]
    enough = registration.one_page_each(found, [one], [buffers], plots, budget=[2])
    assert read(enough) == ["S-201~", "S-201"]


def test_the_budget_is_checked_before_a_sheets_buffers_are_asked_for() -> None:
    """With no ink tries left, no sheet's buffers are loaded (a large set's are loaded as asked
    for: #703's review)."""

    class Counted(Sequence[SheetBuffers | None]):
        """A set's buffers, loaded as asked for (as the product's), counting each ask."""

        def __init__(self, held: list[SheetBuffers | None]) -> None:
            self.held, self.asked = held, 0

        def __len__(self) -> int:
            return len(self.held)

        @overload
        def __getitem__(self, index: int) -> SheetBuffers | None: ...
        @overload
        def __getitem__(self, index: slice) -> Sequence[SheetBuffers | None]: ...
        def __getitem__(self, index: int | slice) -> SheetBuffers | Sequence[SheetBuffers | None] | None:
            self.asked += 1
            return self.held[index]

    one = sheet("S-01")
    found = [PlotMatch(page(k, own("S-01")), sheet=one) for k in (1, 2)]
    geometry = Counted([sheet_buffers()])

    registration.one_page_each(found, [one], geometry, {SHA_A: Path("unused.pdf")}, budget=[0])

    assert geometry.asked == 0


def test_without_its_ink_two_pages_naming_a_sheet_alike_are_left_as_they_named_it(
    tmp_path: Path,
) -> None:
    """The same pages with no buffers to draw: nothing tells them apart, so both are left naming
    it, as before (the product keeps the surer)."""
    pages = page_text(_two_page_plot(tmp_path))

    assert read(registration.match(pages, [titled_sheet()])) == ["S-201", "S-201"]


# Out of order: raised, never a double match ----------------------------------------------------------


def test_a_collision_is_decided_by_the_places_around_it_in_a_pdf_out_of_order() -> None:
    """Pages out of their numbers' order (S-04, S-01, S-02), page 3's larger mark naming S-05: page
    3's place (S-01 to S-02) does not hold S-05, page 5's does; page 5 is S-05's."""
    sheets = [sheet(n) for n in numbered(5)]
    pages = [
        page(1, own("S-04")),
        page(2, own("S-01")),
        page(3, own("S-03"), mark("S-05")),
        page(4, own("S-02")),
        page(5, own("S-05")),
    ]

    assert read(registration.match(pages, sheets)) == ["S-04", "S-01", "S-05~", "S-02", "S-05"]


def test_pages_of_two_pdfs_naming_one_sheet_are_left_to_the_product() -> None:
    """A full Plot and a partial one both plot S-02: each PDF's page is the sheet's in its PDF (the
    product keeps the first added's), as before."""
    sheets = [sheet(n) for n in numbered(3)]
    pages = [page(k + 1, own(n)) for k, n in enumerate(numbered(3))]
    pages.append(page(1, own("S-02"), source=SHA_B))

    assert read(registration.match(pages, sheets)) == ["S-01", "S-02", "S-03", "S-02"]


@pytest.mark.parametrize("seed", range(300))
def test_the_pass_never_uses_a_sheet_twice_nor_drops_a_page(seed: int) -> None:
    """Pages naming numbers at random, in order or not: a sheet is used on two pages only where
    both named it before the pass; a page given another sheet names it whole; a page left naming
    a sheet unused has another page used for it; no page is given a reason."""
    rng = random.Random(seed)
    numbers = numbered(rng.randint(3, 12))
    sheets = [sheet(n) for n in numbers]
    order = list(numbers)
    if rng.random() < 0.5:
        rng.shuffle(order)
    pages = []
    for k, n in enumerate(order):
        items = [own(n)] if rng.random() < 0.8 else []
        items += [rng.choice((own, mark))(rng.choice(numbers)) for _ in range(rng.randint(0, 2))]
        pages.append(page(k + 1, *items))

    before = registration.match(pages, sheets, one_each=False)
    after = registration.match(pages, sheets)

    used: dict[int, list[int]] = {}
    for k, m in enumerate(after):
        assert (m.sheet is None) != (m.reason is None)
        assert m.reason == before[k].reason  # the pass gives no page a reason
        if m.sheet is not None and m.sheet is not before[k].sheet:
            assert m.sheet.number.value in {i.text for i in m.page.items}  # type: ignore[union-attr, attr-defined]
        if m.sheet is not None and m.used:
            used.setdefault(id(m.sheet), []).append(k)
    for ks in used.values():
        if len(ks) > 1:  # left as they named it: nothing told them apart
            assert all(before[k].sheet is after[k].sheet for k in ks)
    for m in after:
        if not m.used:  # another page is used for its sheet
            assert used.get(id(m.sheet))


# A clear fit outranks the order (#703's review, round 2) --------------------------------------------


def test_a_page_that_fits_its_sheet_clearly_is_used_whatever_the_order_says() -> None:
    """Page 1 refers to S-201 (it fits it at 3.0 mm), page 2 is S-250's, page 3 is S-201's own
    (0.0 mm): page 1's place holds S-201 and page 3's does not, yet page 3 is used, page 1 unused."""
    s201, s250 = sheet("S-201"), sheet("S-250")
    pages = [page(1, own("S-201")), page(2, own("S-250")), page(3, own("S-201"))]
    found = [
        PlotMatch(pages[0], sheet=s201, residual=3.0),
        PlotMatch(pages[1], sheet=s250, residual=0.0),
        PlotMatch(pages[2], sheet=s201, residual=0.0),
    ]

    assert read(registration.one_page_each(found, [s201, s250])) == ["S-201~", "S-250", "S-201"]


def test_a_page_is_never_moved_off_its_only_sheet_by_the_order_alone() -> None:
    """Pages S-01, S-02, S-03, S-05, S-04, then S-06 with a larger mark reading S-05: page 4 names
    S-05 alone and keeps it; page 6 names S-06 whole in its place and takes it (#703's review)."""
    sheets = [sheet(n) for n in numbered(6)]
    pages = [
        page(1, own("S-01")),
        page(2, own("S-02")),
        page(3, own("S-03")),
        page(4, own("S-05")),
        page(5, own("S-04")),
        page(6, own("S-06"), mark("S-05")),
    ]

    assert read(registration.match(pages, sheets)) == ["S-01", "S-02", "S-03", "S-05", "S-04", "S-06"]


@pytest.mark.usefixtures("_no_sandbox")
def test_the_reviewers_three_pages_keep_the_sheets_own_page(tmp_path: Path) -> None:
    """The drawn case: page 1 another drawing with S-201's title block, page 2 S-250's, page 3
    S-201's own drawing. Page 3 is used for S-201 and page 1 names it unused."""
    path = _two_page_plot(tmp_path, before=None, after=None, middle="S-250")
    pages = page_text(path)
    sheets = [titled_sheet(), sheet("S-250")]
    plots = {pages[0].source_sha256: path}

    found = registration.match(pages, sheets, [sheet_buffers()], plots)

    assert read(found) == ["S-201~", "S-250", "S-201"]


# The order's key ---------------------------------------------------------------------------------------


def test_the_order_key_reads_digits_by_their_value_without_making_an_integer() -> None:
    assert _order_key("S-9") < _order_key("S-10")  # type: ignore[operator]
    assert _order_key("A-99") < _order_key("A-100")  # type: ignore[operator]
    assert _order_key("01") == _order_key("1")
    assert _order_key(None) is None
    long = "9" * 50_000  # a hostile number: past Python's int-from-text limit, never made an int
    assert _order_key(long) > _order_key("1" + "0" * 49_998)  # type: ignore[operator]
