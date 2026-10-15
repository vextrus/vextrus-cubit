"""Ticket S29-M0b, part 2: every Step 1 act G1's act timer measures answers with its server time.

G1 walk #1 of 9101c005 failed `act_p95_during_read` on the Edison set (the slow kind undo, p95 1,159 ms
against 1,000), and the walk could not tell the server's work from waiting: it records only the time
from the key to the answer. The owner (session 29): "Also change undo now".

Promise pinned: each act route the timer measures (web/e2e/real/act-timer.ts `ACT_PATHS`: confirm,
undo, exclude, a Question's answer) answers with a `Server-Timing` header carrying `app;dur=<ms>` (the
server's work on the request) and `lock;dur=<ms>` (the time waited for Step 1's write lock), as
numbers; a refused act carries it too. Only the shape is pinned, never a value (no wall clock).

    uv run pytest -rf vextrus/takeoff/tests/acceptance/ts29m0b
"""

import re
import uuid
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    KEEP_OPEN,
    Sheet,
    answer,
    jev_says,
    open_questions,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db

HEADER = "Server-Timing"
NUMBER = re.compile(r"[0-9]+(\.[0-9]+)?")
METRIC = re.compile(r"([A-Za-z0-9_-]+)((?:\s*;\s*[A-Za-z0-9_-]+(?:=[^;,]*)?)*)")


def base(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1/"


def durations(response: Any) -> dict[str, str]:
    """The `Server-Timing` metrics by name, each its `dur` as written; fails naming what is missing."""
    value = response.headers.get(HEADER)
    assert value, f"no Server-Timing header (status {response.status_code})"
    found: dict[str, str] = {}
    for part in value.split(","):
        matched = METRIC.fullmatch(part.strip())
        assert matched, f"a Server-Timing metric is malformed: {part!r}"
        params = [p.strip() for p in matched.group(2).split(";") if p.strip()]
        dur = [p.split("=", 1)[1].strip() for p in params if p.split("=", 1)[0].strip() == "dur"]
        found[matched.group(1)] = dur[0] if dur else ""
    return found


def assert_timed(response: Any) -> None:
    found = durations(response)
    for name in ("app", "lock"):
        assert name in found, f"Server-Timing has no {name} metric"
        assert NUMBER.fullmatch(found[name]), f"Server-Timing {name};dur is not a number"


def test_a_confirm_answers_with_its_server_and_lock_time(step1_project: Step1Project) -> None:
    api = api_as(step1_project.member)
    r = api.post(
        base(step1_project.project_id) + "confirm", {"proposals": [str(step1_project.proposals[0])]}
    )
    assert r.status_code == 200, r.content
    assert_timed(r)


def test_an_exclude_answers_with_its_server_and_lock_time(step1_project: Step1Project) -> None:
    api = api_as(step1_project.member)
    r = api.post(
        base(step1_project.project_id) + "exclude",
        {"proposals": [str(step1_project.proposals[1])], "reason": "other", "text": "a test"},
    )
    assert r.status_code == 200, r.content
    assert_timed(r)


def test_an_undo_answers_with_its_server_and_lock_time(step1_project: Step1Project) -> None:
    api = api_as(step1_project.member)
    path = base(step1_project.project_id)
    assert (
        api.post(path + "confirm", {"proposals": [str(step1_project.proposals[0])]}).status_code == 200
    )
    r = api.post(path + "undo", {})
    assert r.status_code == 200, r.content
    assert_timed(r)


def test_a_refused_undo_still_answers_with_its_server_and_lock_time(step1_project: Step1Project) -> None:
    """Nothing to undo: refused 409, and timed all the same (a refusal is an act the timer measures)."""
    r = api_as(step1_project.member).post(base(step1_project.project_id) + "undo", {})
    assert r.status_code == 409, r.content
    assert_timed(r)


def test_an_answer_answers_with_its_server_and_lock_time(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    file_id = uploaded(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg")
    sheets = [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
        Sheet("S-03", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
    ]
    run_job(qs_project.member, file_id, monkeypatch, readers({"KR-STR-R0.dwg": sheets}))
    api = api_as(qs_project.member)
    [question] = open_questions(api, qs_project.project_id, "missing")
    r = answer(api, qs_project.project_id, question["id"], KEEP_OPEN)
    assert r.status_code == 200, r.content
    assert_timed(r)


def test_an_answer_to_no_question_is_refused_and_still_timed(step1_project: Step1Project) -> None:
    r = answer(api_as(step1_project.member), step1_project.project_id, str(uuid.uuid4()), KEEP_OPEN)
    assert r.status_code == 404, r.content
    assert_timed(r)
