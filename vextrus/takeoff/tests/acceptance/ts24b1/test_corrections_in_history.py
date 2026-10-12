"""S24-B1 (#678, #689 item 1, PR #706's design-gate walk defects 2 and 3): "Who did what" records each
correction, old to new, under whoever made it; two people's corrections are two acts; an undone
correction stays listed, followed by its undo. m0-screens 6.9: ""Who did what" records "Corrected:
number — → S-12; title; …"". And the not_listed Question a number correction raises offers its own
options, not a missing sheet's ("Not sent yet …", "It is in a file I haven't added yet": m0-screens
§5's table, the drawing list against sheets, gives a sheet in a file but not on the list its own words).
The seam's names are in `history.py`.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.testing.auth import Api

from ..t19a.step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from ..t19a.step1 import by_number, proposals, step1
from .history import ARIF, CORRECTED, UNDONE, act, codes, correct, history

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

NOT_LISTED = "engine.register_check.not_listed"
MISSING_SHEETS_OPTIONS = {"not_sent_yet", "file_not_added"}


def sheet(api: Api, project: uuid.UUID, number: str) -> dict[str, Any]:
    [found] = by_number(proposals(api, project), number)
    return found


def test_a_number_correction_is_listed_old_to_new_under_who_made_it(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s05 = sheet(nusrat, kr01, "S-05")
    correct(nusrat, kr01, {"proposal": s05["id"], "number": "S-51"})

    acts = history(nusrat, kr01, s05["id"])

    assert codes(acts) == [CORRECTED]
    assert (acts[0]["actor"], acts[0]["actor_role"]) == ("Nusrat Jahan", "qs")
    assert acts[0]["changes"]["number"] == {
        "old": "S-05",
        "new": "S-51",
        "old_source": s05["number_source"],
    }
    assert "title" not in acts[0]["changes"]


def test_two_peoples_corrections_of_one_sheet_are_both_listed_oldest_first(
    nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api]
) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    correct(nusrat, kr01, {"proposal": s04["id"], "title": "Ground beam layout"})
    correct(as_person(ARIF, "shapla"), kr01, {"proposal": s04["id"], "title": "Ground floor beams"})

    acts = history(nusrat, kr01, s04["id"])

    assert [(a["code"], a["actor"]) for a in acts] == [
        (CORRECTED, "Nusrat Jahan"),
        (CORRECTED, "Arif Rahman"),
    ]
    assert acts[0]["changes"]["title"]["old"] == s04["title"]
    assert acts[0]["changes"]["title"]["new"] == "Ground beam layout"
    assert acts[1]["changes"]["title"]["old"] == "Ground beam layout"
    assert acts[1]["changes"]["title"]["new"] == "Ground floor beams"
    assert acts[1]["actor_role"] == "vextrus_engineer"


def test_an_undone_correction_stays_listed_followed_by_its_undo(nusrat: Api, kr01: uuid.UUID) -> None:
    s05 = sheet(nusrat, kr01, "S-05")
    correct(nusrat, kr01, {"proposal": s05["id"], "number": "S-51"})
    act(nusrat, kr01, "undo", {})

    acts = history(nusrat, kr01, s05["id"])

    assert codes(acts) == [CORRECTED, UNDONE]
    assert [a["actor"] for a in acts] == ["Nusrat Jahan", "Nusrat Jahan"]


def test_the_not_listed_question_a_number_correction_raises_offers_no_missing_sheets_options(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s02 = sheet(nusrat, kr01, "S-02")
    correct(nusrat, kr01, {"proposal": s02["id"], "number": "S-02A"})

    questions = nusrat.get(f"{step1(kr01)}/questions").json()["questions"]
    raised = [
        q
        for q in questions
        if q["code"] == NOT_LISTED and q["status"] == "open" and q["params"].get("number") == "S-02A"
    ]

    assert len(raised) == 1, [(q["code"], q["params"]) for q in questions]
    keys = {o["key"] for o in raised[0]["options"]}
    assert "keep_open" in keys
    assert not keys & MISSING_SHEETS_OPTIONS, keys
