"""S15-E3's builder tests: `views.storeys`, the one owner of a plan's storeys (its title, a bracketed
line under it, its sheet's title, in the storey words given). The acceptance cases are in
`engine/recognise/tests/acceptance/ts15e3/`; their invented sheets are reused here. Every title and
storey word is invented.

    uv run pytest engine/recognise/tests/test_view_storeys.py
"""

import pytest

from engine.recognise import views
from engine.recognise.tests.acceptance.ts15e3.sheet import Drawn, plans, read, with_storey_words
from engine.recognise.types import StoreysSource, ViewKind
from engine.recognise.views import storeys


def test_a_line_not_bracketed_whole_gives_no_storeys() -> None:
    """Only a line bracketed whole is a storeys line: "2ND TO 6TH FLOOR" bare, or a bracket left
    open, is another line (a second title, a note)."""
    for line in ["2ND TO 6TH FLOOR", "(2ND TO 6TH FLOOR", "2ND TO 6TH FLOOR)"]:
        found = storeys.read("TOILET LAYOUT PLAN", ViewKind.PLAN, "toilet", [line])
        assert found.keys == ("not_stated",), line
        assert found.source is None


def test_a_square_bracketed_line_is_read_and_its_source_kept() -> None:
    found = storeys.read("KITCHEN LAYOUT PLAN", ViewKind.PLAN, None, ["[3RD & 5TH FLOOR]"])
    assert found.keys == ("floor_3", "floor_5")
    assert found.as_stated == "3RD & 5TH FLOOR"
    assert found.source is StoreysSource.TITLE_LINE


def test_the_first_bracketed_line_naming_a_storey_is_read() -> None:
    found = storeys.read(
        "PANTRY PART PLAN", ViewKind.PLAN, None, ["(SCALE 1:7)", "(41ST FLOOR)", "(43RD FLOOR)"]
    )
    assert found.keys == ("floor_41",)


def test_a_typical_title_is_not_replaced_by_a_bracketed_line() -> None:
    """A title stating a storey, a symbolic one too, keeps it: the line is read only for a plan whose
    own title states none."""
    found = storeys.read("TYPICAL FLOOR PLAN", ViewKind.PLAN, None, ["(2ND TO 6TH FLOOR)"])
    assert found.keys == ("typical",)
    assert found.source is None


def test_a_view_of_another_kind_takes_no_storeys_from_a_line() -> None:
    assert storeys.read("SECTION A-A", ViewKind.SECTION, None, ["(2ND FLOOR)"]).keys == ()


def test_a_bracketed_line_on_the_sheet_marks_the_part_plan() -> None:
    found = read([Drawn("TOILET LAYOUT PLAN", "(2ND TO 6TH FLOOR)")])
    (plan,) = plans(found.views)
    assert plan.storeys_source is StoreysSource.TITLE_LINE


def test_titled_storeys_reads_the_market_words_and_none_for_no_key() -> None:
    market = with_storey_words("mezzanine", "entresol")
    assert views.titled_storeys("ENTRESOL FLOOR", market) == ("mezzanine",)
    assert views.titled_storeys("ENTRESOL FLOOR") == ()
    assert views.titled_storeys("6TH FLOOR TO ROOF") == ("floor_6", "roof", "top")
    assert views.titled_storeys("") == ()
    assert views.titled_storeys(None) == ()


def test_find_refuses_sheet_conventions_of_another_type() -> None:
    with pytest.raises(TypeError, match="SheetConventions"):
        read([Drawn("SLAB LAYOUT PLAN")], sheet_conventions={"storey_words": []})


@pytest.mark.parametrize(
    "line", ["(SEE 3RD FLOOR PLAN)", "(NOT FOR 5TH FLOOR)", "(1ST FLOOR) AND (TYP.)"]
)
def test_a_bracketed_line_of_other_words_gives_no_storeys(line: str) -> None:
    """S15-E3's refuter: a reference or two brackets in one line are no storeys line."""
    found = storeys.read("SLAB LAYOUT PLAN", ViewKind.PLAN, "slab", [line])
    assert found.keys == ("not_stated",)
    assert found.source is None
