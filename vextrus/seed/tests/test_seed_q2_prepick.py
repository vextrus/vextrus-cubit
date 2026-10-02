"""KR-01's Q2 can be pre-picked (the design gate's S6; m0-screens §7, "pre-picked keep rev B"): the
card pre-picks only where two sources agree (ruling 2), and the seed gives both. The title block's
later revision mark and date on S-07 rev B, and the drawing list on S-01 listing S-07 at rev B
(`read_revisions`, what the web's `pickSources` reads)."""

import uuid

import pytest

from vextrus.seed.demo import Demo
from vextrus.seed.tests.acceptance.t136.seeded import *  # noqa: F403 (its fixtures)
from vextrus.seed.tests.acceptance.t136.seeded import get_json, step1
from vextrus.testing.auth import Api


@pytest.mark.django_db(databases=["default", "owner"])
def test_q2s_two_sources_agree_on_keeping_s07_rev_b(demo: Demo, nusrat: Api) -> None:
    project: uuid.UUID = demo["project:KR-01"]
    held = get_json(nusrat, f"{step1(project)}/drawing-list", discipline="structural")
    assert held["read_revisions"]["S-07"] == "B"
    assert "S-13" not in held["read_revisions"]

    listed = get_json(nusrat, f"{step1(project)}/proposals")["proposals"]
    copies = {p["revision_mark"]: p for p in listed if p["number"] == "S-07"}
    assert set(copies) == {"A", "B"}
    assert copies["B"]["issue_date"] > copies["A"]["issue_date"]

    questions = get_json(nusrat, f"{step1(project)}/questions")["questions"]
    [q2] = [q for q in questions if q["kind"] == "conflict" and q["params"].get("number") == "S-07"]
    assert [o["key"] for o in q2["options"] if o["picked"]] == ["keep_b"]
