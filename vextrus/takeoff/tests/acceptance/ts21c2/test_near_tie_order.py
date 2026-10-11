"""S21-C2 (b): sheets Jev is unsure of between the same two kinds are one kind Question whichever of
the two it ranks first.

The authority: the ticket S21-C2 (session 21, Train C), from G1's script layer on Train B's head ("one
Discipline raises 4 machine-doubt Questions, cap 3"): "key which_kind's kind_group on the sorted top
two kinds, so Jev's near-tie order does not split one group into two Questions". The diagnosis: the
same pair reversed was two Questions; grouping per Discipline whatever the kinds would merge unlike
pairs under one answer, so the unordered pair (the sorted top two) is the narrow rule. S15-Q1 before
it: "a Question groups the Sheets it asks about, one answer confirms them all"; the owner's Q5 cap, at
most 3 Questions per Discipline.

Jev is a stand-in transport (nothing leaves the machine): by the word in a sheet's title, its first
and second kinds, close (0.40 and 0.35, under #228's 0.15 lead), the rest of what it is offered
sharing what is left. Every number and title is invented; the titles name no kind's whole words.

Not pinned (no authority gives them): which kind the grouped Question picks first, and its words.

    uv run pytest vextrus/takeoff/tests/acceptance/ts21c2
"""

import json
from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any

import httpx
import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, answer, proposals
from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import (
    STRUCTURAL,
    ids_of,
    kind_questions,
    open_in,
    read,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

LIMIT = 3
"""The owner's Q5: at most 3 Questions per Discipline."""
TOP, SECOND = Decimal("0.40"), Decimal("0.35")
SPLIT = "one near-tie pair split by Jev's order"
"""What each red test says on a base that keys the group on the pair's order."""

PAIRS: Mapping[str, tuple[str, str]] = {
    "NORTH": ("beam_layout", "beam_details"),
    "SOUTH": ("beam_details", "beam_layout"),
    "EAST": ("beam_details", "column_schedule"),
}
"""By the word in a title: Jev's first and second kinds. NORTH and SOUTH are one pair in either
order; EAST shares one kind with them and is another pair."""


def sheets(word: str, numbers: Sequence[int]) -> list[Sheet]:
    """Beam sheets S-<n>, titled by the pair's word and their own letter (no two titles alike)."""
    return [Sheet(f"S-{n:02d}", f"BLOCK {word} {chr(64 + n)}", (f"PANEL Q{n}",)) for n in numbers]


def jev_near_tie(offline: Offline) -> None:
    """Jev answers each sheet by its title's word in `PAIRS`, its top two close."""

    def answer_it(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        title = body["state"]["title"]
        top, second = next((pair for word, pair in PAIRS.items() if word in title), ("", ""))
        answers = {}
        for node, asked in body["questions"].items():
            options = list(asked["criteria"])
            ranked = [k for k in (top, second) if k in options]
            ranked += [o for o in options if o not in ranked]
            given = [TOP, SECOND][: len(ranked)]
            rest = (Decimal(1) - sum(given, Decimal(0))) / max(len(ranked) - len(given), 1)
            probabilities = {o: float(rest) for o in ranked[len(given) :]}
            probabilities |= {o: float(p) for o, p in zip(ranked, given, strict=False)}
            answers[node] = {
                "type": "choice",
                "choice": ranked[0],
                "confidence": float(probabilities[ranked[0]]),
                "probabilities": probabilities,
            }
        return httpx.Response(200, json={"model": body["model"], "answers": answers})

    offline.use(httpx.MockTransport(answer_it))


def held(asked: Sequence[dict[str, Any]]) -> list[list[str]]:
    return sorted(sorted(q["proposals"]) for q in asked)


def test_sheets_ranked_the_same_two_kinds_in_either_order_are_one_kind_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """ "Jev's near-tie order does not split one group into two Questions": sheets ranked
    (beam_layout, beam_details) and sheets ranked (beam_details, beam_layout), interleaved by number,
    are asked by one kind Question holding all of them and offering both kinds."""
    jev_near_tie(jev_offline)
    listed = sorted(
        [*sheets("NORTH", [1, 3, 5]), *sheets("SOUTH", [2, 4, 6])], key=lambda s: s.number or ""
    )
    read(qs_project, monkeypatch, STRUCTURAL, listed)
    api = api_as(qs_project.member)

    asked = kind_questions(api, qs_project.project_id)

    assert len(asked) == 1, f"{SPLIT}: {len(asked)} kind Questions holding {held(asked)}"
    [q] = asked
    assert q["discipline"] == "structural"
    assert sorted(q["proposals"]) == sorted(ids_of(api, qs_project.project_id).values())
    assert {"beam_layout", "beam_details"} <= {o["key"] for o in q["options"]}


def test_a_set_of_one_pair_in_both_orders_asks_the_discipline_at_most_three_questions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The cap, on a set of one near-tie pair in both orders and one other pair: two kind Questions,
    the Discipline at most 3."""
    jev_near_tie(jev_offline)
    read(
        qs_project,
        monkeypatch,
        STRUCTURAL,
        [*sheets("NORTH", [1, 2]), *sheets("SOUTH", [3, 4]), *sheets("EAST", [5, 6])],
    )
    api = api_as(qs_project.member)

    asked = kind_questions(api, qs_project.project_id)

    assert len(asked) == 2, f"{SPLIT}: {len(asked)} kind Questions holding {held(asked)}"
    assert len(open_in(api, qs_project.project_id, "structural")) <= LIMIT


def test_pairs_sharing_only_one_kind_stay_two_questions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The narrow rule: sheets ranked (beam_layout, beam_details) and sheets ranked
    (beam_details, column_schedule) share one kind only, so they are two kind Questions, never one
    answer for both."""
    jev_near_tie(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, [*sheets("NORTH", [1, 2]), *sheets("EAST", [3, 4])])
    api = api_as(qs_project.member)
    ids = ids_of(api, qs_project.project_id)

    asked = kind_questions(api, qs_project.project_id)

    assert held(asked) == sorted(
        [sorted([ids["S-01"], ids["S-02"]]), sorted([ids["S-03"], ids["S-04"]])]
    )


def test_one_answer_confirms_every_sheet_of_the_pair_in_either_order(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """S15-Q1's "one answer confirms them all", across the order: answering the one Question with
    beam_details confirms each sheet with that kind, whichever kind Jev ranked first for it."""
    jev_near_tie(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, [*sheets("NORTH", [1, 2]), *sheets("SOUTH", [3, 4])])
    api = api_as(qs_project.member)
    asked = kind_questions(api, qs_project.project_id)
    assert len(asked) == 1, f"{SPLIT}: {len(asked)} kind Questions holding {held(asked)}"

    response = answer(api, qs_project.project_id, asked[0]["id"], "beam_details")

    assert response.status_code == 200, response.content
    after = proposals(api, qs_project.project_id)
    assert [p["decision"] for p in after] == ["confirmed"] * 4
    assert [p["confirmed_kind"] for p in after] == ["beam_details"] * 4
    assert [p["decided_with"] for p in after] == [4] * 4
