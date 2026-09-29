"""Coverage: no view unaccounted (ticket 19b)."""

from typing import Any

import pytest

from engine import export
from engine.check.coverage import check, status
from engine.recognise.tests.candidates import plan, sheet, view
from engine.recognise.tests.stand_ins import stand_ins
from engine.recognise.types import (
    Exclusion,
    ExclusionReason,
    SetReading,
    SheetCandidate,
    ViewCandidate,
    ViewKind,
)

READERS = stand_ins()


def reading(
    pairs: list[tuple[SheetCandidate, list[ViewCandidate]]],
    read: frozenset[str] = frozenset({"views"}),
) -> SetReading:
    return SetReading(
        sheets=tuple(s for s, _ in pairs), views=tuple(tuple(v) for _, v in pairs), read=read
    )


def test_every_view_is_examined_and_each_unaccounted_one_fires_named_as_m0_screens_names_it() -> None:
    beams = plan(["floor_8"], "beam", title="8th floor beam layout", steps=("beams",))
    loose = plan(["floor_8"], "beam", title="8th floor beam layout")
    box = view(ViewKind.DETAIL)
    block = view(ViewKind.TITLE_BLOCK, exclusion=Exclusion(ExclusionReason.FOR_INFORMATION))
    legend = view(ViewKind.LEGEND, part="electrical")
    s20 = sheet("S-20", "Beam layout")

    results = check(reading([(s20, [beams, loose, box, block, legend])]), recognisers=READERS)

    assert all(r.code == "coverage" for r in results)
    assert [(str(r.outcome), r.subject, r.finding) for r in results] == [
        ("passed", beams, None),
        (
            "fired",
            loose,
            {
                "code": "engine.coverage.unaccounted",
                "params": {"sheet": "S-20", "named": "number", "view": "8th floor beam layout"},
            },
        ),
        (
            "fired",
            box,
            {
                "code": "engine.coverage.unaccounted_untitled",
                "params": {"sheet": "S-20", "named": "number", "kind": "detail"},
            },
        ),
        ("passed", block, None),
        ("passed", legend, None),
    ]


def test_a_view_on_an_excluded_sheet_counts_as_excluded() -> None:
    superseded = sheet("S-07", exclusion=Exclusion(ExclusionReason.SUPERSEDED))
    loose = view(ViewKind.PLAN, title="Slab")

    [result] = check(reading([(superseded, [loose])]), recognisers=READERS)

    assert (str(result.outcome), result.finding) == ("passed", None)
    assert status(loose, superseded) == "excluded"
    assert export.coverage(loose) == "unaccounted"


@pytest.mark.parametrize(
    "candidate",
    [
        view(ViewKind.DETAIL),
        view(ViewKind.DETAIL, steps=("stairs",)),
        view(ViewKind.LEGEND, part="electrical"),
        view(ViewKind.DETAIL, steps=("stairs",), part="plumbing"),
        view(ViewKind.KEY_PLAN, exclusion=Exclusion(ExclusionReason.FOR_INFORMATION)),
    ],
)
def test_on_a_sheet_not_excluded_the_status_is_the_exports(candidate: ViewCandidate) -> None:
    assert status(candidate, sheet("S-01")) == export.coverage(candidate)


@pytest.mark.parametrize(
    ("on", "params"),
    [
        (sheet(None, "Stair details"), {"sheet": "Stair details", "named": "title"}),
        (sheet(None, None), {"sheet": "", "named": "none"}),
        (sheet("\u200b", "\ufeff"), {"sheet": "", "named": "none"}),
    ],
)
def test_a_sheet_with_no_number_is_named_by_its_title_or_not_at_all(
    on: SheetCandidate, params: dict[str, Any]
) -> None:
    [result] = check(reading([(on, [view(ViewKind.NOTES, title="\u00ad")])]), recognisers=READERS)

    assert result.finding == {
        "code": "engine.coverage.unaccounted_untitled",
        "params": {**params, "kind": "notes"},
    }


def test_the_check_says_nothing_when_the_views_were_not_read() -> None:
    pairs = [(sheet("S-01"), [view()])]
    assert check(reading(pairs, read=frozenset({"register"})), recognisers=READERS) == []


def test_a_hundred_thousand_views() -> None:
    pairs = [(sheet(f"S-{k}"), [view() for _ in range(100)]) for k in range(1000)]

    results = check(reading(pairs), recognisers=READERS)

    assert len(results) == 100_000
    assert {r.finding["code"] for r in results if r.finding} == {"engine.coverage.unaccounted_untitled"}
