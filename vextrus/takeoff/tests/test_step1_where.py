"""Where each of a sheet's facts was read (ticket 22; the design gate's M7 and M2; m0-screens 6.2,
6.6): the Step 1 proposals carry each value's source, where in the file the sheet is laid out, its
storeys as stated, its Plot page or why it has none, and its views in reading order."""

from typing import Any

import pytest

from vextrus.testing.auth import api_as
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db


def test_each_proposal_says_where_its_facts_were_read(step1_project: Step1Project) -> None:
    body: dict[str, Any] = (
        api_as(step1_project.member)
        .get(f"/api/projects/{step1_project.project_id}/takeoff/step1/proposals")
        .json()
    )

    first = body["proposals"][0]
    assert first["sources"]["number"] == "title_block_text"
    assert first["sources"]["title"] == "title_block_text"
    assert first["layout"] is None  # laid out in the drawing
    assert first["storeys_as_stated"] == ""
    assert first["plot_page"] is None
    assert first["plot_file_name"] is None
    assert first["plot_none"]["code"].startswith("drawings.")
    [view] = first["views"]
    assert view["kind"] == "title_block"
    assert view["ordinal"] in {0, 1}
    assert len(view["box"]) == 4
    assert {len(p["views"]) for p in body["proposals"]} == {1}
