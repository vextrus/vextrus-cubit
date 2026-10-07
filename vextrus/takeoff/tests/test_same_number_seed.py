"""#161 on the demo seed: a conflict is its words and the sheets it holds, so the S-07 Question the
read job raised on the seed (#182: its own subject and options) is the one the conflicts find again;
an act on Step 1 neither retires it nor asks a second (the second refuter's finding, severity 60)."""

import uuid
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.takeoff.tests.acceptance.t19a.step1 import *  # noqa: F403 (its fixtures, by name)
from vextrus.takeoff.tests.acceptance.t19a.step1 import by_number, proposals, step1
from vextrus.testing.auth import Api

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def same_number(api: Api, project_id: uuid.UUID) -> list[tuple[str, str, list[str]]]:
    response = api.get(f"{step1(project_id)}/questions")
    assert response.status_code == 200, response.content
    listed: list[dict[str, Any]] = response.json()["questions"]
    return [
        (q["id"], q["status"], [o["key"] for o in q["options"]])
        for q in listed
        if q["code"] == conflict_codes.SAME_NUMBER.code
    ]


def test_an_act_keeps_the_seeds_s07_question_open_and_asks_no_second(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    [(seeded, status, keys)] = same_number(nusrat, kr01)
    assert (status, keys) == ("open", ["keep_latest", "keep_all", "keep_open"])
    [s01] = by_number(proposals(nusrat, kr01), "S-01")

    response = nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s01["id"]]})

    assert response.status_code == 200, response.content
    assert same_number(nusrat, kr01) == [(seeded, "open", keys)]
