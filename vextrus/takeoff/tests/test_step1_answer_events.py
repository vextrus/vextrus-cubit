"""S22-FL10 round 1: every Step 1 answer is exactly one event in the log (the Engineer's Acts count
it: an answer that confirms or leaves out nothing was missed), and an exclude of views alone counts
views, not sheets. Mechanics only."""

import uuid
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    answer,
    open_questions,
    readers,
    run_job,
    step1,
    uploaded,
)
from vextrus.takeoff.tests.test_step1_undo_answer import DUPLICATE, NAME
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

STEP1 = "takeoff.step1."


def logged(
    qs: QsProject, md: Member, project_id: uuid.UUID | None = None
) -> list[tuple[str, dict[str, Any]]]:
    """The QS's Step 1 events on the Project as the MD reads them (the activity list), oldest
    first: (code, params)."""
    seen = api_as(md).get("/api/activity", actor=str(qs.member.user.pk))
    assert seen.status_code == 200, seen.content
    wanted = str(project_id or qs.project_id)
    return [
        (a["code"], a["params"])
        for a in reversed(seen.json())
        if a["code"].startswith(STEP1) and a["project_id"] == wanted
    ]


def conflict_of(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> tuple[Any, str]:
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: DUPLICATE}))
    api = api_as(qs.member)
    listed = api.post(
        f"{step1(qs.project_id)}/drawing-list",
        {"discipline": "structural", "text": "S-01 to S-02"},
    )
    assert listed.status_code == 200, listed.content
    [conflict] = open_questions(api, qs.project_id, "conflict")
    return api, conflict["id"]


def test_keep_latest_is_one_event_for_one_answer(
    qs_project: QsProject, sign_in: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    md = sign_in(role="md", developer_id=qs_project.member.developer_id)
    api, conflict = conflict_of(qs_project, monkeypatch)
    before = logged(qs_project, md)

    assert answer(api, qs_project.project_id, conflict, "keep_latest").status_code == 200

    new = logged(qs_project, md)[len(before) :]
    assert [code for code, _p in new] == [STEP1 + "confirmed"], new


def test_keeping_a_conflict_open_is_one_answered_event(
    qs_project: QsProject, sign_in: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    md = sign_in(role="md", developer_id=qs_project.member.developer_id)
    api, conflict = conflict_of(qs_project, monkeypatch)
    before = logged(qs_project, md)

    assert answer(api, qs_project.project_id, conflict, "keep_open").status_code == 200

    new = logged(qs_project, md)[len(before) :]
    assert [code for code, _p in new] == [STEP1 + "answered"], new


def test_leaving_out_views_alone_counts_views_and_no_sheets(qs_project: QsProject, sign_in: Any) -> None:
    from vextrus.drawings import services as drawings
    from vextrus.takeoff.services import step1 as service
    from vextrus.takeoff.tests.acceptance.tw319.cost import ACTED_ON, SMALL, project_of

    md = sign_in(role="md", developer_id=qs_project.member.developer_id)
    project = project_of(qs_project, SMALL)
    with project.member.acting():
        views = list(drawings.views(project.sheet_of[ACTED_ON]))[:2]
        ids = [service.propose_view(project.project_id, v) for v in views]
    api = api_as(project.member)
    reply = api.post(
        f"{project.path}/exclude", {"proposals": [str(i) for i in ids], "reason": "duplicate"}
    )
    assert reply.status_code == 200, reply.content

    [(_code, payload)] = [
        e for e in logged(qs_project, md, project.project_id) if e[0] == STEP1 + "excluded"
    ]
    assert (payload["sheets"], payload["views"]) == (0, len(ids)), payload
