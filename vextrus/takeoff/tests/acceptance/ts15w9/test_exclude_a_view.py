"""Ticket S15-W9: a View left out on its own, through Step 1's API, with a reason Coverage keeps.

docs/design/m0-screens.md §6.9: "Exclusion (`X`), per sheet or per view. With a view selected (sheet
mode), `X` excludes the view"; the picker says "Coverage keeps the reason"; the toast for a view,
""8th floor beam layout" excluded: for information. Coverage keeps the reason."; "Undo (`Ctrl Z`):
undoes the last act (… an exclusion …)". CONTEXT.md, Coverage: "The account of every view on every
sheet of a Drawing Set: assigned to the Takeoff Steps that will read it, used by them, or excluded with
a reason". m0-screens §8 item 8 and 19a's API: the MD and a Guest are refused every act; another
Developer's Project is the one 404.

Chosen by the acceptance writer where no authority names it (the builder meets it; the report says so):
- `POST {step1}/exclude` takes a View by its own id, the `id` of a view in `GET {step1}/proposals`'s
  `views` (as it takes a sheet by its Proposal's id, or by the printed sheet's id while none is
  proposed), in the same `proposals` list: `{"proposals": [<view id>], "reason": <one of the seven>}`.
  Today it takes only a view's Proposal id, which Coverage lists for an unaccounted view alone, so the
  screen has no id to send for any other view.

Everything is invented (docs/sdlc.md): one Structural sheet drawn by 13's test drawing through 21c's
harness, its views found by the view finder as it is.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.projects import services as projects
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    NOT_FOUND,
    Sheet,
    coverage,
    exclude,
    jev_says,
    progress,
    proposals,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
S04 = Sheet("S-04", "GROUND FLOOR BEAM LAYOUT", ("GROUND FLOOR BEAM LAYOUT", "BEAM SECTION 1-1"))
"""One undecided sheet with two views the read puts in beams, and its title block (proposed out)."""
SECTION = "BEAM SECTION 1-1"
REASON = "duplicate"
"""One of the seven (m0-screens §5): "Duplicate or another Discipline's copy"; no other view has it."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read_s04(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> None:
    file_id = uploaded(qs.member, qs.project_id, STRUCTURAL)
    run_job(qs.member, file_id, monkeypatch, readers({STRUCTURAL: [S04]}))


def sheet(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    return the(proposals(api, project_id), "S-04")


def view(api: Any, project_id: uuid.UUID, title: str = SECTION) -> dict[str, Any]:
    views: list[dict[str, Any]] = sheet(api, project_id)["views"]
    [found] = [v for v in views if v["title"] == title]
    return found


def section_id(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> str:
    """S-04 read, undecided: the id of its view "BEAM SECTION 1-1", as the screen has it."""
    read_s04(qs, monkeypatch)
    found: str = view(api_as(qs.member), qs.project_id)["id"]
    return found


def exclude_the_section(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> tuple[Any, dict[str, Any]]:
    """The QS leaves "BEAM SECTION 1-1" out; the Coverage before, for comparing."""
    view_id = section_id(qs, monkeypatch)
    api = api_as(qs.member)
    before = coverage(api, qs.project_id)
    response = exclude(api, qs.project_id, [view_id], REASON)
    assert response.status_code == 200, response.content
    return api, before


def test_the_qs_excludes_a_view_with_a_reason(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    view_id = section_id(qs_project, monkeypatch)
    api = api_as(qs_project.member)

    response = exclude(api, qs_project.project_id, [view_id], REASON)

    assert response.status_code == 200, response.content
    assert response.json()["by"] == qs_project.member.user.name
    shown = view(api, qs_project.project_id)
    assert (shown["decision"], shown["excluded_reason"]) == ("excluded", REASON)
    other = view(api, qs_project.project_id, "GROUND FLOOR BEAM LAYOUT")
    assert (other["decision"], other["excluded_reason"]) == (None, None)


def test_coverage_counts_the_excluded_view_as_accounted_with_its_reason(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    api, before = exclude_the_section(qs_project, monkeypatch)

    shown = coverage(api, qs_project.project_id)

    assert shown["views"] == before["views"]
    assert (shown["excluded"], shown["proposed"]) == (before["excluded"] + 1, before["proposed"] - 1)
    assert (shown["unaccounted"], shown["unaccounted_views"]) == (0, [])
    assert shown["by_reason"] == {**before["by_reason"], REASON: 1}
    assert shown["by_step"] == {"beams": before["by_step"]["beams"] - 1}


def test_excluding_a_view_leaves_its_sheet_undecided(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    api, _before = exclude_the_section(qs_project, monkeypatch)

    s04 = sheet(api, qs_project.project_id)

    assert (s04["decision"], s04["excluded_reason"], s04["decided_by"]) == (None, None, None)
    assert progress(api, qs_project.project_id)["structural"]["confirmed"] == 0


def test_undo_puts_the_view_back(qs_project: QsProject, monkeypatch: pytest.MonkeyPatch) -> None:
    api, before = exclude_the_section(qs_project, monkeypatch)

    response = api.post(f"{step1(qs_project.project_id)}/undo", {})

    assert response.status_code == 200, response.content
    assert coverage(api, qs_project.project_id) == before
    shown = view(api, qs_project.project_id)
    assert (shown["decision"], shown["excluded_reason"]) == (None, None)
    assert sheet(api, qs_project.project_id)["decision"] is None


@pytest.mark.parametrize("role", ["md", "guest"])
def test_the_md_and_a_guest_cannot_exclude_a_view(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    sign_in: Callable[..., Member],
    role: str,
) -> None:
    view_id = section_id(qs_project, monkeypatch)
    before = coverage(api_as(qs_project.member), qs_project.project_id)
    reader = api_as(
        sign_in(
            role=role,
            developer_id=qs_project.member.developer_id,
            projects=[qs_project.project_id],
        )
    )

    response = exclude(reader, qs_project.project_id, [view_id], REASON)

    refused = {"code": "platform.auth.not_allowed", "params": {"role": role}}
    assert (response.status_code, response.json()) == (403, refused)
    api = api_as(qs_project.member)
    assert coverage(api, qs_project.project_id) == before
    assert view(api, qs_project.project_id)["decision"] is None


def test_another_developer_cannot_exclude_the_view(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    view_id = section_id(qs_project, monkeypatch)
    before = coverage(api_as(qs_project.member), qs_project.project_id)
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Their project").id
    api = api_as(stranger)

    on_ours = exclude(api, qs_project.project_id, [view_id], REASON)
    on_theirs = exclude(api, theirs, [view_id], REASON)

    assert (on_ours.status_code, on_ours.json()) == (404, NOT_FOUND)
    assert (on_theirs.status_code, on_theirs.json()) == (404, NOT_FOUND)
    assert coverage(api_as(qs_project.member), qs_project.project_id) == before
