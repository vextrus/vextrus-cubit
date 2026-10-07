"""S15-W9's fix round: a view's own exclusion is its own row, never rewritten by another act on it
or by its sheet's. Fixtures are 21c's (an invented Structural sheet S-04 with two views)."""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import coverage, exclude, step1
from vextrus.takeoff.tests.acceptance.ts15w9.test_exclude_a_view import (  # noqa: F401
    SECTION,
    jev_sure,
    section_id,
    sheet,
    view,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db


def test_a_view_already_left_out_is_not_left_out_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    view_id = section_id(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    before = coverage(api, qs_project.project_id)
    assert exclude(api, qs_project.project_id, [view_id], "duplicate").status_code == 200

    again = exclude(api, qs_project.project_id, [view_id], "for_information")

    assert again.status_code == 409, again.content
    shown = view(api, qs_project.project_id)
    assert (shown["decision"], shown["excluded_reason"]) == ("excluded", "duplicate")
    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200
    assert coverage(api, qs_project.project_id) == before
    assert view(api, qs_project.project_id)["decision"] is None


def test_excluding_the_sheet_keeps_a_view_left_out_on_its_own_and_so_does_its_undo(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    view_id = section_id(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert exclude(api, qs_project.project_id, [view_id], "duplicate").status_code == 200
    sheet_id = sheet(api, qs_project.project_id)["id"]

    assert exclude(api, qs_project.project_id, [sheet_id], "superseded").status_code == 200

    shown = view(api, qs_project.project_id)
    assert (shown["decision"], shown["excluded_reason"]) == ("excluded", "duplicate")
    assert sheet(api, qs_project.project_id)["decision"] == "excluded"
    by_reason = coverage(api, qs_project.project_id)["by_reason"]
    assert by_reason.get("duplicate") == 1
    assert by_reason.get("superseded", 0) > 0  # the sheet's other views follow it

    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200

    shown = view(api, qs_project.project_id)
    assert (shown["decision"], shown["excluded_reason"]) == ("excluded", "duplicate")
    assert sheet(api, qs_project.project_id)["decision"] is None
    by_reason = coverage(api, qs_project.project_id)["by_reason"]
    assert (by_reason.get("duplicate"), by_reason.get("superseded")) == (1, None)
