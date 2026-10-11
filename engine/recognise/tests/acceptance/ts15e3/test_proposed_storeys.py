"""S15-E3's acceptance, the engine part: one owner of a Sheet's storeys (#536; M0's clause "gets a
proposed ... storey"). The proposer reads a plan View's storeys from its title, from a bracketed storeys
line drawn under that title (#413: "A plan title with a bracketed storeys line under it ... part plans
... that name their floors only in that line stay `not_stated`"), and from its Sheet's title when it is
the Sheet's only plan (T-W318's tests, `engine/recognise/tests/acceptance/w318`, pin that part), always
with the storey words of the conventions it is given (a Market's vocabulary is data, never the
reader's default alone).

The seams: `engine.recognise.views.find(artefact, sheet, conventions, **kw)` on a hand-built
ReadArtefact (S15-E4 makes `views` a package; `find` stays its entry point) and
`engine.recognise.conflicts.find(sheets, views, conventions)`. The one new name, fixed here:
`views.find(..., sheet_conventions=<SheetConventions>)`, the conventions whose storey words the views'
storeys are read with (the default sheet conventions when not given), as the product already names
the conventions it reads Sheets with (`sheet_conventions`).

Every number, title and storey word is invented; they prove mechanics only.

    uv run pytest engine/recognise/tests/acceptance/ts15e3 -rf
"""

from dataclasses import replace

from engine.recognise import conflicts
from engine.recognise.tests.acceptance.ts15e3.sheet import Drawn, Read, plans, read, with_storey_words
from engine.recognise.tests.drawing import DEFAULT
from engine.recognise.types import Conflict

SAME_STOREY = "same_storey"
TWO_TO_SIX = ("floor_2", "floor_3", "floor_4", "floor_5", "floor_6")


def same_storey(*sheets: Read) -> list[Conflict]:
    """The `same_storey` Conflicts among these Sheets, each Sheet of one building group (each test
    gives its Sheets titles and numbers of their own: a run of one title is one place)."""
    stamped = [replace(s.sheet, group="building-1") for s in sheets]
    found = conflicts.find(stamped, [s.views for s in sheets], DEFAULT)
    return [c for c in found if isinstance(c, Conflict) and c.kind == SAME_STOREY]


# A bracketed storeys line under a plan's title --------------------------------------------------------


def test_a_bracketed_storeys_line_under_a_plans_title_gives_the_plan_its_storeys() -> None:
    """#413: "TOILET LAYOUT PLAN" over "(2ND TO 6TH FLOOR)": the plan is on the 2nd to the 6th floor,
    stated as the line states it."""
    found = read([Drawn("TOILET LAYOUT PLAN", "(2ND TO 6TH FLOOR)")])

    (plan,) = plans(found.views)

    assert plan.storeys == TWO_TO_SIX
    assert plan.storeys_as_stated is not None
    assert "2ND TO 6TH FLOOR" in plan.storeys_as_stated


def test_a_plans_own_title_storeys_are_not_replaced_by_a_line_naming_none() -> None:
    """A bracketed line that names no storey ("(SCALE 1:50)") leaves the title's own storeys as read."""
    found = read([Drawn("3RD FLOOR SLAB LAYOUT PLAN", "(SCALE 1:50)")])

    (plan,) = plans(found.views)

    assert plan.storeys == ("floor_3",)


# Part plans and the same-storey Conflict -------------------------------------------------------------


def test_two_part_plans_over_one_bracketed_range_read_it_and_raise_no_same_storey() -> None:
    """#413's acceptance check: "two Sheets each holding a part plan over the same bracketed floor range
    read those storeys and raise no `same_storey` Conflict" (each bath is a different room)."""
    first = read(
        [Drawn("TOILET T1 LAYOUT PLAN", "(2ND TO 6TH FLOOR)")], number="A-21", title="TOILET T1 DETAILS"
    )
    second = read(
        [Drawn("TOILET T2 LAYOUT PLAN", "(2ND TO 6TH FLOOR)")],
        number="A-35",
        title="TOILET T2 DETAILS",
        source_name="other.dwg",
    )

    assert [p.storeys for p in plans(first.views)] == [TWO_TO_SIX]
    assert [p.storeys for p in plans(second.views)] == [TWO_TO_SIX]
    assert same_storey(first, second) == []


def test_two_storey_plans_of_one_floor_still_raise_one_same_storey() -> None:
    """#413: "two storey plans of one floor still raise one" (a guard: green on main, kept so)."""
    first = read([Drawn("3RD FLOOR SLAB LAYOUT PLAN")], number="S-31", title="SLAB LAYOUT")
    second = read(
        [Drawn("3RD FLOOR SLAB LAYOUT PLAN")],
        number="S-45",
        title="SLAB REINFORCEMENT",
        source_name="other.dwg",
    )

    assert len(same_storey(first, second)) == 1


# The Market's storey words, as data ------------------------------------------------------------------


def test_a_plans_title_is_read_with_the_storey_words_it_is_given() -> None:
    """A Market's word for a storey ("ENTRESOL", invented here as a word for the mezzanine) is read
    from the sheet conventions given, as the Sheet's own title is; the default words do not know it."""
    market = with_storey_words("mezzanine", "entresol")

    given = read([Drawn("ENTRESOL FLOOR SLAB LAYOUT PLAN")], sheet_conventions=market)
    default = read([Drawn("ENTRESOL FLOOR SLAB LAYOUT PLAN")])

    assert [p.storeys for p in plans(given.views)] == [("mezzanine",)]
    assert [p.storeys for p in plans(default.views)] == [("not_stated",)]


def test_the_only_plan_takes_its_sheet_titles_storeys_in_the_markets_words() -> None:
    """The Sheet states "ENTRESOL FLOOR" over its only plan, which states none: the plan takes the
    mezzanine, read with the Market's words."""
    market = with_storey_words("mezzanine", "entresol")

    found = read(
        [Drawn("SLAB LAYOUT PLAN")],
        title="SLAB LAYOUT, ENTRESOL FLOOR",
        stated="ENTRESOL FLOOR",
        sheet_conventions=market,
    )

    (plan,) = plans(found.views)

    assert plan.storeys == ("mezzanine",)
    assert plan.storeys_as_stated == "ENTRESOL FLOOR"


def test_a_bracketed_line_is_read_with_the_storey_words_it_is_given() -> None:
    """The bracketed line too: "(ENTRESOL FLOOR)" under a part plan's title is the mezzanine with the
    Market's words."""
    market = with_storey_words("mezzanine", "entresol")

    found = read([Drawn("KITCHEN LAYOUT PLAN", "(ENTRESOL FLOOR)")], sheet_conventions=market)

    (plan,) = plans(found.views)

    assert plan.storeys == ("mezzanine",)
