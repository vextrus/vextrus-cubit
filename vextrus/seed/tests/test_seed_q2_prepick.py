"""KR-01's Q2 on the seed is the read job's (#182, #204: the seed pre-picks only what the job would):
its options are the job's own, none pre-picked (a pick needs two sources, 22's card decides it); the
two copies differ by revision mark and the later is dated after the earlier, which the card reads."""

import uuid

import pytest

from vextrus.seed.demo import Demo
from vextrus.seed.tests.acceptance.t136.seeded import *  # noqa: F403 (its fixtures)
from vextrus.seed.tests.acceptance.t136.seeded import get_json, step1
from vextrus.testing.auth import Api


@pytest.mark.django_db(databases=["default", "owner"])
def test_q2_is_the_jobs_own_with_nothing_pre_picked(demo: Demo, nusrat: Api) -> None:
    project: uuid.UUID = demo["project:KR-01"]
    listed = get_json(nusrat, f"{step1(project)}/proposals")["proposals"]
    copies = {p["revision_mark"]: p for p in listed if p["number"] == "S-07"}
    assert set(copies) == {"A", "B"}
    assert copies["B"]["issue_date"] > copies["A"]["issue_date"]

    questions = get_json(nusrat, f"{step1(project)}/questions")["questions"]
    [q2] = [q for q in questions if q["kind"] == "conflict" and q["params"].get("number") == "S-07"]
    assert [o["key"] for o in q2["options"]] == ["keep_latest", "keep_all", "keep_open"]
    assert [o["key"] for o in q2["options"] if o["picked"]] == []
