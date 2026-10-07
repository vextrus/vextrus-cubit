"""Ticket 182 (M0 21e), #204: the demo seed raises S-07's conflict exactly as 21c's read job would
("Fix: the seed raises S-07's conflict exactly as 21c's job would (same subject and option keys), with
a test that no answer raises a twin"). Found on the seed: answering the no-number Question with A-08
raised a second "Two sheets are numbered S-07"; answering the seeded one with keep rev B changed
nothing and it came back.

A twin is two Questions of one kind, code and params (the same line twice in the Answered list). The
option keys of two sheets of one number are the job's (`keep_latest`, `keep_all`, `keep_open`: the
web's words for them, `web/src/takeoff/words.tsx`). Every test runs on the seeded KR-01 through Step
1's API as Nusrat Jahan answers it, with no toolchain.
"""

import json
import uuid
from collections import Counter
from typing import Any

import pytest

from vextrus.testing.auth import Api

from ..t19a.step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from ..t21c.step1_whole import answer, keys, of_number, open_questions, proposals, questions

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

SAME_NUMBER_KEYS = ["keep_latest", "keep_all", "keep_open"]
"""21c's job's options for two sheets of one number, in order."""
TYPED = "A-08"
"""The number #204's walk typed for the unnumbered door and window schedule."""


def line(q: dict[str, Any]) -> tuple[str, str, str]:
    """A Question as the Answered list words it: its kind, code and params."""
    return (q["kind"], q["code"], json.dumps(q["params"], sort_keys=True))


def twins(api: Api, project: uuid.UUID) -> list[tuple[str, str, str]]:
    counted = Counter(line(q) for q in questions(api, project))
    return [k for k, n in counted.items() if n > 1]


def s07_questions(api: Api, project: uuid.UUID) -> list[dict[str, Any]]:
    return [
        q
        for q in questions(api, project)
        if q["kind"] == "conflict" and q["params"].get("number") == "S-07"
    ]


def the_s07_question(api: Api, project: uuid.UUID) -> dict[str, Any]:
    [s07] = [q for q in s07_questions(api, project) if q["status"] == "open"]
    return s07


def test_the_seeded_s07_question_offers_the_jobs_options(nusrat: Api, kr01: uuid.UUID) -> None:
    assert keys(the_s07_question(nusrat, kr01)) == SAME_NUMBER_KEYS


def test_the_seeded_s07_question_holds_both_copies_and_is_about_one_of_them(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s07 = the_s07_question(nusrat, kr01)
    copies = of_number(proposals(nusrat, kr01), "S-07")

    assert sorted(s07["proposals"]) == sorted(p["id"] for p in copies)
    assert s07["subject_id"] in {p["sheet_id"] for p in copies}


def test_keeping_a_question_open_asks_no_twin(nusrat: Api, kr01: uuid.UUID) -> None:
    """Every answer runs the job's conflict round (`answer_question`): on the seed it finds the
    seeded S-07 Question already asked."""
    before = sorted(line(q) for q in questions(nusrat, kr01))

    response = answer(nusrat, kr01, the_s07_question(nusrat, kr01)["id"], "keep_open")

    assert response.status_code == 200, response.content
    assert twins(nusrat, kr01) == []
    assert sorted(line(q) for q in questions(nusrat, kr01)) == before


def test_typing_a_number_for_the_schedule_raises_no_second_s07_question(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    [missing] = open_questions(nusrat, kr01, "missing")

    response = answer(nusrat, kr01, missing["id"], "type_number", TYPED)

    assert response.status_code == 200, response.content
    assert len(s07_questions(nusrat, kr01)) == 1, s07_questions(nusrat, kr01)
    assert twins(nusrat, kr01) == []


def test_keeping_the_latest_s07_confirms_rev_b_and_leaves_rev_a_out(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    response = answer(nusrat, kr01, the_s07_question(nusrat, kr01)["id"], "keep_latest")

    assert response.status_code == 200, response.content
    copies = {p["revision_mark"]: p for p in of_number(proposals(nusrat, kr01), "S-07")}
    assert (copies["B"]["decision"], copies["A"]["decision"]) == ("confirmed", "excluded")
    assert [q["status"] for q in s07_questions(nusrat, kr01)] == ["answered"]


def test_answering_every_question_in_turn_never_raises_a_twin(nusrat: Api, kr01: uuid.UUID) -> None:
    """Each open Question answered with its first option (the schedule's number typed), until none
    is open that was not answered before: after each answer no line is there twice."""
    answered: set[str] = set()
    while True:
        waiting = [q for q in open_questions(nusrat, kr01) if q["id"] not in answered]
        if not waiting:
            break
        q = waiting[0]
        option = "type_number" if q["kind"] == "missing" else keys(q)[0]
        response = answer(nusrat, kr01, q["id"], option, TYPED if option == "type_number" else "")
        assert response.status_code == 200, (line(q), option, response.content)
        answered.add(q["id"])
        assert twins(nusrat, kr01) == [], f"answering {line(q)} with {option}"
        assert len(answered) < 50, "answering never ends"
