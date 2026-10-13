"""Ticket S25-D5's acceptance tests (#719; G1 walk 1's f-5, FL10): a Vextrus Engineer's "confirmed back
in" act, as Members and access reads it, names each sheet and the reason it was left out before.

m0-screens 4.4, Vextrus access: "'Acts' ... opens, in a side panel, the Engineer's acts from the event
log in words, newest first ('Confirmed S-07 back in, excluded before as superseded · Kadam Residence ·
26 Sep 2026, 15:42')". Today the act carries only how many sheets (`sheets`), so the panel cannot say
which sheet or why it was out.

The contract these tests name (no earlier authority names the key): the act's `params` in
`GET /api/activity` carry `excluded_before`, one entry per sheet confirmed back in, each
`{"sheet": <the sheet's number>, "reason": <its earlier exclusion reason's code>}` (the codes of
`vextrus.drawings.models.ExclusionReason`: "superseded", "duplicate", ...). Codes only: no drawing
text beyond the sheet number (never the sheet's title), so the words are the web's.

The Engineer is invited by the MD and accepts, then acts over HTTP as the screen does, on T-W319's
invented Project (`tw319.cost`: sheets S-001.. titled "Trial sheet S-001"..).
"""

import json
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.ts15a1.acts import OverHttp
from vextrus.takeoff.tests.acceptance.ts22fl10.test_engineer_acts import (
    CONFIRMED_BACK_IN,
    acts_of,
    engineer_of,
)
from vextrus.takeoff.tests.acceptance.tw319.cost import SMALL, CostProject, posted, project_of
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

KEY = "excluded_before"
FIRST = "S-001"
SECOND = "S-002"


@pytest.fixture
def setting(
    qs_project: QsProject, sign_in: Callable[..., Member], other_staff: Any
) -> tuple[CostProject, Member, Member, OverHttp]:
    """The invented Project, the MD of its Developer, the Engineer and the Engineer's Step 1 acts."""
    project = project_of(qs_project, SMALL)
    md = sign_in(role="md", developer_id=qs_project.member.developer_id)
    engineer, api = engineer_of(project, md, other_staff)
    return project, md, engineer, OverHttp(project, api)


def exclude(way: OverHttp, number: str, reason: str) -> None:
    project = way.project
    posted(
        way.api,
        f"{project.path}/exclude",
        {"proposals": [str(project.proposal_of[number])], "reason": reason},
    )()


def back_in(md: Member, engineer: Member) -> dict[str, Any]:
    """The Engineer's newest act as the MD reads it: their confirm back in."""
    newest = acts_of(md, engineer)[0]
    assert newest["code"] == CONFIRMED_BACK_IN, newest
    return newest


def test_a_sheet_confirmed_back_in_is_named_with_the_reason_it_was_excluded_for(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    exclude(way, FIRST, "superseded")
    way.confirm([project.proposal_of[FIRST]])

    act = back_in(md, engineer)

    assert act["params"][KEY] == [{"sheet": FIRST, "reason": "superseded"}]


def test_several_sheets_back_in_at_once_each_keep_their_own_earlier_reason(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    exclude(way, FIRST, "superseded")
    exclude(way, SECOND, "duplicate")
    way.confirm([project.proposal_of[FIRST], project.proposal_of[SECOND]])

    act = back_in(md, engineer)

    entries = act["params"][KEY]
    assert sorted(entries, key=lambda e: e["sheet"]) == [
        {"sheet": FIRST, "reason": "superseded"},
        {"sheet": SECOND, "reason": "duplicate"},
    ]
    assert act["params"]["sheets"] == 2


def test_the_act_carries_no_drawing_text_beyond_the_sheet_number(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    exclude(way, FIRST, "for_information")
    way.confirm([project.proposal_of[FIRST]])

    act = back_in(md, engineer)

    assert act["params"][KEY] == [{"sheet": FIRST, "reason": "for_information"}]
    said = json.dumps(act)
    assert f"Trial sheet {FIRST}" not in said
    assert "Trial plan" not in said
    assert "Trial detail" not in said


def test_a_second_tenant_cannot_read_the_engineer_s_back_in_act(
    setting: tuple[CostProject, Member, Member, OverHttp], sign_in: Callable[..., Member]
) -> None:
    project, md, engineer, way = setting
    exclude(way, FIRST, "superseded")
    way.confirm([project.proposal_of[FIRST]])
    assert back_in(md, engineer)["params"][KEY] == [{"sheet": FIRST, "reason": "superseded"}]

    stranger = sign_in(role="md")
    seen = api_as(stranger).get("/api/activity", actor=str(engineer.user.pk))

    assert seen.status_code in (200, 403, 404), seen.content
    if seen.status_code == 200:
        assert seen.json() == []
    assert FIRST not in seen.content.decode()
    assert str(project.project_id) not in seen.content.decode()
