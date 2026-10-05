"""KR-01's Questions carry the tags the screen shows (`raised`: the order the read job raised them,
web/src/takeoff/model.ts `raisedTags`), and m0-screens §7 names them by those tags: the older
structural file is added and read first, so its Question is Q1 (review 1 of #182)."""

import uuid

import pytest

from vextrus.seed.demo import Demo
from vextrus.seed.tests.acceptance.t136.seeded import *  # noqa: F403 (its fixtures)
from vextrus.seed.tests.acceptance.t136.seeded import get_json, step1
from vextrus.testing.auth import Api


@pytest.mark.django_db(databases=["default", "owner"])
def test_kr01s_questions_are_tagged_as_section_7_names_them(demo: Demo, nusrat: Api) -> None:
    project: uuid.UUID = demo["project:KR-01"]
    questions = get_json(nusrat, f"{step1(project)}/questions")["questions"]

    tags = {q["raised"]: (q["kind"], q["params"].get("number", "")) for q in questions}

    assert tags == {
        1: ("file_misread", ""),
        2: ("conflict", "S-07"),
        3: ("check", "S-13"),
        4: ("low_confidence", ""),
        5: ("missing", ""),
    }
