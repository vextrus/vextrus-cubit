"""AC-2 — reconciliation is a pure, named function returning refusals as data (L-CAD-04).

The tallies here are written by hand rather than read off a drawing: the law is about the *rule*
(a per-type shortfall, or an `UNKNOWN_ENT` in the census, refuses that class on that sheet by name)
and a rule proved only by whichever counts today's fixture happens to produce is a rule nothing
checks. Nothing in this module touches the filesystem — `reconcile` is declared pure.

The suite derives everything from `Path(__file__)` and never imports `corpus`: under pytest's
prepend import mode this directory is the only one on `sys.path` for these modules.
"""

from __future__ import annotations

import copy

from vextrus_cad import report
from vextrus_cad.dwg import SHORTFALL, UNKNOWN_ENT, RefusedClass, losses_by_space, reconcile

# A census with, per space, one type that falls short, one that matches, and one the conversion
# over-produced. The paper space is deliberately named so that code-point order puts it before
# "model" — the sort is by (space, dxftype), not by insertion.
CENSUS: dict[str, dict[str, int]] = {
    "model": {"LINE": 5, "CIRCLE": 2, "TEXT": 1},
    "SHEET A-101": {"LINE": 3, "INSERT": 2, "ARC": 4},
}
GEOMETRY: dict[str, dict[str, int]] = {
    "model": {"LINE": 4, "CIRCLE": 2, "TEXT": 3},
    "SHEET A-101": {"LINE": 3, "ARC": 1},
    # A space the census never named: nothing there can be short of anything.
    "SHEET A-102": {"LINE": 9},
}


def _pairs(refused: list[RefusedClass]) -> list[tuple[str, str]]:
    return [(entry.space, entry.dxftype) for entry in refused]


def test_ac2_a_shortfall_refuses_that_class_by_name() -> None:
    refused = reconcile(CENSUS, GEOMETRY)

    # Exactly the classes the conversion lost, and no others: a match and an excess are not losses.
    assert _pairs(refused) == [("SHEET A-101", "ARC"), ("SHEET A-101", "INSERT"), ("model", "LINE")]

    by_pair = {(entry.space, entry.dxftype): entry for entry in refused}
    for (space, dxftype), entry in by_pair.items():
        assert entry.reason == SHORTFALL
        assert entry.census == CENSUS[space][dxftype]
        assert entry.converted == GEOMETRY.get(space, {}).get(dxftype, 0)
        assert entry.converted < entry.census
        # "refuses that class on that sheet BY NAME" — the message names both halves.
        message = entry.message()
        assert space in message, message
        assert dxftype in message, message


def test_ac2_the_refusal_list_is_sorted_by_space_then_type() -> None:
    refused = reconcile(CENSUS, GEOMETRY)
    assert _pairs(refused) == sorted(_pairs(refused))
    # Distinct classes carry distinct messages — one shared sentence would name nothing.
    assert len({entry.message() for entry in refused}) == len(refused)


def test_ac2_an_unknown_entity_refuses_its_space_under_its_own_reason() -> None:
    census = {"model": {"LINE": 2, UNKNOWN_ENT: 3}, "SHEET A-101": {"LINE": 1}}
    geometry = {"model": {"LINE": 2}, "SHEET A-101": {"LINE": 1}}

    refused = reconcile(census, geometry)

    unknown = [entry for entry in refused if entry.dxftype == UNKNOWN_ENT]
    assert len(unknown) == 1, "one entry per space holding UNKNOWN_ENT, not one per rule that fires"
    entry = unknown[0]
    assert entry.space == "model"
    assert entry.reason == UNKNOWN_ENT
    assert entry.census == 3
    assert entry.converted == 0
    assert "model" in entry.message()
    assert UNKNOWN_ENT in entry.message()
    # The space that reconciles cleanly is untouched by its neighbour's refusal.
    assert [item for item in refused if item.space == "SHEET A-101"] == []


def test_ac2_a_refusal_says_how_many_were_lost_and_the_code_it_travels_under() -> None:
    """The two facts the artifact and the operator need beside the sentence.

    A refusal that only says "this class is short" leaves every reader to subtract for itself, and
    a code from `report.py`'s closed table is what lets a loss be found among the run's other
    statements without reading prose.
    """
    short = RefusedClass("model", "LINE", SHORTFALL, 5, 4)
    assert short.lost == 1
    assert short.note_code() == report.CONVERSION_SHORTFALL
    # One sentence, said once: the note code names the rule, so the detail beside it does not.
    assert short.message() == f"{SHORTFALL}: {short.detail()}"
    assert not short.detail().startswith(SHORTFALL)

    # Nothing the conversion carried can be matched to a class nothing can name, so the whole
    # census count is what no geometry in the artifact stands for.
    unknown = RefusedClass("model", UNKNOWN_ENT, UNKNOWN_ENT, 3, 0)
    assert unknown.lost == 3
    assert unknown.note_code() == report.CONVERSION_UNKNOWN_ENT

    assert {short.note_code(), unknown.note_code()} <= set(report.NOTE_CODES), (
        "a refusal travels under a note code neither mirror of the report knows"
    )


def test_ac2_the_losses_are_carried_per_space_and_per_class() -> None:
    """The shape the artifact's counters keep a loss in: space → class → how many (R-TO-001)."""
    assert losses_by_space(reconcile(CENSUS, GEOMETRY)) == {
        "SHEET A-101": {"ARC": 3, "INSERT": 2},
        "model": {"LINE": 1},
    }
    assert losses_by_space([]) == {}, "a clean conversion adds no key to any artifact"


def test_ac2_a_clean_pair_of_tallies_refuses_nothing() -> None:
    assert reconcile(CENSUS, copy.deepcopy(CENSUS)) == []
    assert reconcile({}, {}) == []


def test_ac2_reconcile_is_pure() -> None:
    census = copy.deepcopy(CENSUS)
    geometry = copy.deepcopy(GEOMETRY)

    first = reconcile(census, geometry)
    second = reconcile(census, geometry)

    assert census == CENSUS, "reconcile mutated the census it was handed"
    assert geometry == GEOMETRY, "reconcile mutated the geometry tally it was handed"
    assert _pairs(first) == _pairs(second)
