"""The Plot's pages against the sheets (ticket 19b), on hand-made pages and matches."""

from dataclasses import dataclass
from typing import Any

import pytest

from engine.check.plot_pages import check
from engine.recognise.tests.candidates import sheet
from engine.recognise.tests.stand_ins import stand_ins
from engine.recognise.types import CheckResult, PlotMatch, PlotTransform, SetReading, SheetCandidate

READERS = stand_ins()


@dataclass(frozen=True)
class Page:
    """A stand-in for 12's `engine.read.pdf.types.Page`: what the Check reads of it, its number."""

    number: int


def matched(page: int, on: SheetCandidate) -> PlotMatch:
    return PlotMatch(
        page=Page(page), sheet=on, transform=PlotTransform(1.0, 0, (0.0, 0.0)), residual=0.1
    )


def unmatched(page: object, reason: str = "no_sheet_matched") -> PlotMatch:
    return PlotMatch(page=page if not isinstance(page, int) else Page(page), reason=reason)


def reading(
    sheets: list[SheetCandidate], plot: list[PlotMatch], read: frozenset[str] = frozenset({"plot"})
) -> SetReading:
    return SetReading(sheets=tuple(sheets), views=tuple(() for _ in sheets), plot=tuple(plot), read=read)


def outcomes(results: list[CheckResult]) -> list[tuple[str, Any, Any]]:
    return [(str(r.outcome), r.subject, r.finding) for r in results]


def test_pages_and_sheets_are_checked_both_ways_only_where_a_disciplines_pdf_matched() -> None:
    s1, s2, s3 = sheet("S-01"), sheet("S-02"), sheet("S-03")
    a1, a2 = sheet("A-01", discipline="architectural"), sheet("A-02", discipline="architectural")
    e1 = sheet("E-01", discipline="electrical")  # no PDF: says nothing
    unnumbered = sheet(None, "Schedule")
    plot = [matched(1, s1), matched(2, s2), unmatched(3), matched(4, a1)]

    results = check(reading([s1, s2, s3, a1, a2, e1, unnumbered], plot), recognisers=READERS)

    assert all(r.code == "plot_pages" for r in results)
    no_page = "engine.plot_pages.no_page"
    assert outcomes(results) == [
        ("passed", plot[0], None),
        ("passed", plot[1], None),
        (
            "fired",
            plot[2],
            {"code": "engine.plot_pages.no_sheet", "params": {"page": 3, "reason": "no_sheet_matched"}},
        ),
        ("passed", plot[3], None),
        ("passed", s1, None),
        ("passed", s2, None),
        ("fired", s3, {"code": no_page, "params": {"number": "S-03"}}),
        ("passed", a1, None),
        ("fired", a2, {"code": no_page, "params": {"number": "A-02"}}),
    ]


def test_a_discipline_is_plotted_per_group() -> None:
    here, there = sheet("S-01"), sheet("S-01", group="building-2")

    results = check(reading([here, there], [matched(1, here)]), recognisers=READERS)

    assert [r.subject for r in results][1:] == [here]


def test_the_check_says_nothing_when_the_plot_was_not_read() -> None:
    s1 = sheet("S-01")
    assert check(reading([s1], [matched(1, s1)], read=frozenset()), recognisers=READERS) == []


@pytest.mark.parametrize(
    ("plot", "error", "match"),
    [
        (lambda s: [matched(1, sheet("S-09"))], ValueError, "does not hold"),
        (lambda s: [unmatched({"page": 1})], TypeError, "page number"),
        (lambda s: [unmatched(Page(0))], TypeError, "page number"),
        (lambda s: [unmatched(Page(True))], TypeError, "page number"),
        (lambda s: ["page 1"], TypeError, "PlotMatch"),
    ],
)
def test_a_match_the_check_cannot_name_is_refused(plot: Any, error: type[Exception], match: str) -> None:
    s1 = sheet("S-01")
    with pytest.raises(error, match=match):
        check(
            SetReading(sheets=(s1,), views=((),), plot=tuple(plot(s1)), read=frozenset({"plot"})),
            recognisers=READERS,
        )
