"""S24-A7: a near-tie between a specific details kind and the generic `details` kind it refines is
not a doubt; Step 1 proposes the specific kind and asks no kind Question.

The authority: the ticket S24-A7 (session 24), from G1's script layer ("questions_per_discipline":
one Discipline over the owner's Q5 cap of 3 Questions). The diagnosis: the sheet-kind Question
`takeoff.proposals.which_kind` (low_confidence) is raised when Jev's first and second kinds are within
`VEXTRUS_JEV_SHEET_TYPE_CLOSE_BY` (0.15, #228); Jev's live scores vary run to run, so a sheet whose
first is a specific details kind and whose runner-up is the generic `details` flips between a
Question and none. The rule, a shape and not a constant: when the runner-up is `details` and Jev's
first is a `*_details` kind of the sheet's Discipline (the kind catalogue,
`engine/recognise/conventions/sheet-default.json`, records `details` as each Discipline's generic
kind and no other parent), the first refines the second and is proposed, no Question. Guards: a
near-tie between two specific kinds (two different `*_details`, or a layout kind against a details
kind) still asks; a first of `details` with a specific runner-up still asks; a first that is no
`*_details` kind with `details` second still asks; a clear lead is unchanged.

Jev is a stand-in transport (nothing leaves the machine): by a sheet's title, its first and second
kinds with the given probabilities, the rest of what it is offered sharing what is left. Every
number and title is invented; the titles name no kind's words, so every kind of the Discipline is
offered.

Not pinned (no authority gives them): a near-tie's lead below which the refinement still asks, and
any parent relation other than `*_details` to `details`.

    uv run pytest vextrus/takeoff/tests/acceptance/ts24a7
"""

import json
from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any

import httpx
import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, proposals
from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import (
    STRUCTURAL,
    kind_questions,
    read,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

ARCHITECTURAL = "KR-ARC-R0.dwg"
GENERIC = "details"
"""Each Discipline's generic details kind (the kind catalogue)."""
REFINED = "a specific kind's near-tie with the generic kind it refines asked as a doubt"
"""What each red test says on a base that asks every near-tie."""

Ranked = tuple[tuple[str, str], tuple[str, str]]
"""Jev's first and second kinds, each with its probability."""

STRUCTURAL_DETAILS = (
    "pile_details",
    "pile_cap_details",
    "foundation_details",
    "shear_wall_details",
    "beam_details",
    "slab_details",
    "stair_details",
    "retaining_wall_details",
    "tank_details",
    "roof_structure_details",
)
"""Every structural `*_details` kind of the kind catalogue."""


def titled(n: int) -> str:
    """An invented title naming no kind's words, its own per sheet."""
    return f"BLOCK K{n:02d} PANEL"


def jev_by_title(offline: Offline, ranks: Mapping[str, Ranked]) -> None:
    """Jev answers each sheet by its title in `ranks`: its first and second kinds as given, the rest
    of what it is offered sharing what is left."""

    def answer_it(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        (top, p_top), (second, p_second) = ranks[body["state"]["title"]]
        answers = {}
        for node, asked in body["questions"].items():
            options = list(asked["criteria"])
            assert top in options, (top, options)
            assert second in options, (second, options)
            others = [o for o in options if o not in (top, second)]
            given = Decimal(p_top) + Decimal(p_second)
            rest = (Decimal(1) - given) / max(len(others), 1)
            probabilities = {o: float(rest) for o in others}
            probabilities |= {top: float(Decimal(p_top)), second: float(Decimal(p_second))}
            answers[node] = {
                "type": "choice",
                "choice": top,
                "confidence": float(Decimal(p_top)),
                "probabilities": probabilities,
            }
        return httpx.Response(200, json={"model": body["model"], "answers": answers})

    offline.use(httpx.MockTransport(answer_it))


def read_ranked(
    qs: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    offline: Offline,
    name: str,
    ranked: Sequence[Ranked],
) -> list[dict[str, Any]]:
    """One file of sheets S-01.., the n-th ranked by Jev as `ranked[n-1]`; the kind Questions
    left open after its read."""
    ranks = {titled(n): pair for n, pair in enumerate(ranked, start=1)}
    jev_by_title(offline, ranks)
    sheets = [Sheet(f"S-{n:02d}", titled(n), (f"PANEL Q{n}",)) for n in range(1, len(ranked) + 1)]
    read(qs, monkeypatch, name, sheets)
    return kind_questions(api_as(qs.member), qs.project_id)


def kinds_proposed(qs: QsProject) -> dict[str, tuple[Any, Any]]:
    """Each sheet's (decision, kind) by its number, as Step 1 lists its Proposals."""
    return {p["number"]: (p["decision"], p["kind"]) for p in proposals(api_as(qs.member), qs.project_id)}


def asked_sheets(qs: QsProject, asked: Sequence[dict[str, Any]]) -> list[str]:
    """The numbers of the sheets the kind Questions hold, sorted."""
    by_id = {p["id"]: p["number"] for p in proposals(api_as(qs.member), qs.project_id)}
    return sorted(by_id[i] for q in asked for i in q["proposals"])


# The rule: a specific details kind over the generic `details` is proposed ---------------------------


@pytest.mark.parametrize("first", ["0.45", "0.40"])
def test_a_details_kind_near_tied_with_the_generic_details_is_proposed_without_a_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline, first: str
) -> None:
    """retaining_wall_details at 0.45 (and at 0.40) with `details` at 0.33, a lead under 0.15: the
    first refines the second, so the sheet is proposed retaining_wall_details and no kind Question is
    asked."""
    asked = read_ranked(
        qs_project,
        monkeypatch,
        jev_offline,
        STRUCTURAL,
        [(("retaining_wall_details", first), (GENERIC, "0.33"))],
    )

    assert asked == [], f"{REFINED}: kind Questions holding {asked_sheets(qs_project, asked)}"
    assert kinds_proposed(qs_project) == {"S-01": (None, "retaining_wall_details")}


def test_every_structural_details_kind_near_tied_with_details_is_proposed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The shape, not one kind: each structural `*_details` kind at 0.45 with `details` at 0.33 is
    proposed as itself, and the Discipline is asked no kind Question."""
    asked = read_ranked(
        qs_project,
        monkeypatch,
        jev_offline,
        STRUCTURAL,
        [((kind, "0.45"), (GENERIC, "0.33")) for kind in STRUCTURAL_DETAILS],
    )

    assert asked == [], f"{REFINED}: kind Questions holding {asked_sheets(qs_project, asked)}"
    assert kinds_proposed(qs_project) == {
        f"S-{n:02d}": (None, kind) for n, kind in enumerate(STRUCTURAL_DETAILS, start=1)
    }


def test_an_architectural_details_kind_near_tied_with_details_is_proposed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """Another Discipline's generic kind: boundary_wall_gate_details at 0.40 with `details` at 0.33
    on an architectural sheet is proposed, no kind Question."""
    asked = read_ranked(
        qs_project,
        monkeypatch,
        jev_offline,
        ARCHITECTURAL,
        [(("boundary_wall_gate_details", "0.40"), (GENERIC, "0.33"))],
    )

    assert asked == [], f"{REFINED}: kind Questions holding {asked_sheets(qs_project, asked)}"
    assert kinds_proposed(qs_project) == {"S-01": (None, "boundary_wall_gate_details")}


# The guards: every other near-tie still asks; a clear lead is unchanged -----------------------------


@pytest.mark.parametrize(
    ("first", "second"),
    [
        pytest.param("retaining_wall_details", "tank_details", id="two_specific_details_kinds"),
        pytest.param("beam_layout", "beam_details", id="a_layout_kind_against_a_details_kind"),
        pytest.param("beam_details", "beam_layout", id="a_details_kind_against_a_layout_kind"),
        pytest.param(GENERIC, "retaining_wall_details", id="details_first_a_specific_kind_second"),
        pytest.param("slab_layout", GENERIC, id="a_layout_kind_first_details_second"),
    ],
)
def test_a_near_tie_that_is_no_refinement_of_details_still_asks(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    jev_offline: Offline,
    first: str,
    second: str,
) -> None:
    """At 0.45 against 0.33, a near-tie whose first is no `*_details` kind over the generic `details`
    is a doubt: the sheet is held by one kind Question offering both kinds, and not proposed."""
    asked = read_ranked(
        qs_project, monkeypatch, jev_offline, STRUCTURAL, [((first, "0.45"), (second, "0.33"))]
    )

    assert len(asked) == 1, f"a true doubt not asked: {len(asked)} kind Questions"
    assert asked_sheets(qs_project, asked) == ["S-01"]
    assert {first, second} <= {o["key"] for o in asked[0]["options"]}
    assert kinds_proposed(qs_project)["S-01"][0] is None


@pytest.mark.parametrize(
    ("first", "second"),
    [
        pytest.param("retaining_wall_details", GENERIC, id="a_details_kind_over_details"),
        pytest.param("beam_layout", "beam_details", id="a_layout_kind_over_a_details_kind"),
    ],
)
def test_a_clear_lead_is_proposed_without_a_question(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    jev_offline: Offline,
    first: str,
    second: str,
) -> None:
    """A lead of 0.22 (0.55 against 0.33), over 0.15: proposed as Jev's first, as before."""
    asked = read_ranked(
        qs_project, monkeypatch, jev_offline, STRUCTURAL, [((first, "0.55"), (second, "0.33"))]
    )

    assert asked == [], f"a clear lead asked: kind Questions holding {asked_sheets(qs_project, asked)}"
    assert kinds_proposed(qs_project) == {"S-01": (None, first)}
