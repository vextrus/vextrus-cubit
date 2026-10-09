"""S18-Q1: a sheet's file moved to another Discipline and back leaves the kind Question as if it had
never moved (the re-read rule: a grouped kind Question's membership and words are recomputed on read,
never stored; docs/plans/M1.md C9, the session 18 ruling).

Review round 3 of PR #566 (on S15-Q1's head, 9dc7ec1f):
- l2-f1 and l1-f3: a kind Question whose only sheet's file moves to another Discipline is withdrawn,
  and nothing asks the sheet its kind again when the file moves back;
- l1-f2 and l2-f2: a group's stored `sheets` count is rewritten when a sheet leaves, not when it comes
  back: the card says "these 2 sheets" while it holds 3, and the answer, which cannot be undone,
  confirms 3 under words naming 2.

And the rule itself: after any sequence of moves, the count the card shows is the number of sheets its
answer confirms, and the sheets it lists are the ones confirmed.

Not pinned (no authority gives them): whether the Question asked again is the one withdrawn or a new
one; whether a sheet moved away is asked its kind in its new Discipline; the card's other words.
"""

import uuid
from collections.abc import Sequence
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import beams, jev_unsure
from vextrus.takeoff.tests.acceptance.ts15q1.moves import (
    AWAY,
    HOME,
    answer_seen,
    by_number,
    holding,
    move,
    read_file,
    structural_kind_questions,
    the_structural_kind_question,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

ANSWERED = "beam_details"
"""The QS's answer: Jev's second kind (kinds_set's stand-in ranks "Beam layout" first)."""


def test_a_sheet_whose_file_moves_away_and_back_is_asked_its_kind_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """l2-f1, l1-f3: one structural sheet Jev is unsure of; its file is set to architectural, then
    back to structural. The sheet is undecided in its own Discipline again, so an open structural kind
    Question holds it, counts it, and its answer confirms it."""
    jev_unsure(jev_offline)
    only = read_file(qs_project, monkeypatch, "KR-STR-R0.dwg", beams([1]))
    api = api_as(qs_project.member)
    s01 = by_number(api, qs_project.project_id)["S-01"]["id"]
    assert [q["proposals"] for q in structural_kind_questions(api, qs_project.project_id)] == [[s01]]

    move(api, qs_project.project_id, only, AWAY)
    away = holding(api, qs_project.project_id, s01)
    move(api, qs_project.project_id, only, HOME)

    assert away == [], "a structural kind Question still holds the sheet moved to architectural"
    back = the_structural_kind_question(api, qs_project.project_id)
    assert back["proposals"] == [s01]
    assert back["params"]["sheets"] == 1
    done = answer_seen(api, qs_project.project_id, back["id"], ANSWERED, back["proposals"])
    assert done.status_code == 200, done.content
    after = by_number(api, qs_project.project_id)["S-01"]
    assert (after["decision"], after["confirmed_kind"]) == ("confirmed", ANSWERED)


def test_a_groups_card_counts_a_sheet_whose_file_moved_away_and_back(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """l1-f2, l2-f2: S-01 and S-02 in one file, S-03 in another, one group of 3. S-03's file moves to
    architectural and back: the card holds 3 and says 3 ("these 3 sheets"), and its answer confirms
    those 3 in one act."""
    jev_unsure(jev_offline)
    read_file(qs_project, monkeypatch, "KR-STR-R0.dwg", beams([1, 2]))
    later = read_file(qs_project, monkeypatch, "KR-STR-R1.dwg", beams([3]))
    api = api_as(qs_project.member)

    move(api, qs_project.project_id, later, AWAY)
    move(api, qs_project.project_id, later, HOME)

    card = the_structural_kind_question(api, qs_project.project_id)
    ids = {n: p["id"] for n, p in by_number(api, qs_project.project_id).items()}
    assert sorted(card["proposals"]) == sorted(ids.values())
    assert card["params"]["sheets"] == 3, f"the card says {card['params']['sheets']} and holds 3"
    done = answer_seen(api, qs_project.project_id, card["id"], ANSWERED, card["proposals"])
    assert done.status_code == 200, done.content
    after = by_number(api, qs_project.project_id)
    assert [after[n]["decided_with"] for n in ("S-01", "S-02", "S-03")] == [3, 3, 3]


FILES = {"A": ("KR-STR-R0.dwg", (1, 2)), "B": ("KR-STR-R1.dwg", (3,)), "C": ("KR-STR-R2.dwg", (4,))}
"""Three structural files of one group: A holds S-01 and S-02, B holds S-03, C holds S-04."""

MOVES: dict[str, Sequence[tuple[str, str]]] = {
    "one_away": [("B", AWAY)],
    "one_away_and_back": [("B", AWAY), ("B", HOME)],
    "back_then_away_again": [("B", AWAY), ("B", HOME), ("B", AWAY)],
    "two_away_one_back": [("B", AWAY), ("C", AWAY), ("B", HOME)],
    "the_pair_away_and_back_crossed": [("A", AWAY), ("B", AWAY), ("A", HOME), ("B", HOME)],
    "all_but_one_away": [("A", AWAY), ("C", AWAY)],
    "all_away_then_the_pair_back": [("A", AWAY), ("B", AWAY), ("C", AWAY), ("A", HOME)],
}


@pytest.mark.parametrize("moves", list(MOVES.values()), ids=list(MOVES))
def test_after_any_moves_the_cards_count_is_the_sheets_its_answer_confirms(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    jev_offline: Offline,
    moves: Sequence[tuple[str, str]],
) -> None:
    """The re-read rule at the card: whatever files moved away and back, the open structural kind
    Question lists the structural sheets, its `sheets` is how many it lists, and its answer confirms
    exactly those (the count less any its words say wait: none here), each "with" that many."""
    jev_unsure(jev_offline)
    files: dict[str, uuid.UUID] = {
        key: read_file(qs_project, monkeypatch, name, beams(numbers))
        for key, (name, numbers) in FILES.items()
    }
    api = api_as(qs_project.member)
    home = dict.fromkeys(FILES, True)

    for key, discipline in moves:
        move(api, qs_project.project_id, files[key], discipline)
        home[key] = discipline == HOME

    ids = {n: p["id"] for n, p in by_number(api, qs_project.project_id).items()}
    standing = sorted(ids[f"S-{n:02d}"] for key, (_, ns) in FILES.items() if home[key] for n in ns)
    card = the_structural_kind_question(api, qs_project.project_id)
    params: dict[str, Any] = card["params"]
    assert sorted(card["proposals"]) == standing
    assert params["sheets"] == len(card["proposals"]), (params, len(card["proposals"]))
    assert params.get("waiting", 0) == 0, params
    done = answer_seen(api, qs_project.project_id, card["id"], ANSWERED, card["proposals"])
    assert done.status_code == 200, done.content
    confirmed = [
        p for p in by_number(api, qs_project.project_id).values() if p["decision"] == "confirmed"
    ]
    assert sorted(p["id"] for p in confirmed) == standing
    assert len(confirmed) == params["sheets"]
    assert {p["decided_with"] for p in confirmed} == {params["sheets"]}
    assert {p["confirmed_kind"] for p in confirmed} == {ANSWERED}
