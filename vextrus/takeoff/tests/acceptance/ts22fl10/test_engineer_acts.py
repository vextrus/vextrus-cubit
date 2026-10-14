"""Ticket S22-FL10's acceptance tests (#658; G1 blocker M0-FL10): every Step 1 act reaches the event
log, so Members and access counts and lists a Vextrus Engineer's Step 1 acts.

m0-screens 4.4, Vextrus access: "'Acts' reads '12 acts, last 26 Sep 2026' and opens, in a side panel,
the Engineer's acts from the event log in words, newest first ('Confirmed S-07 back in, excluded
before as superseded ...')". docs/specs/M0.md, walk step 10: the MD invites a Vextrus Engineer, who
"confirms one excluded sheet back in under their own name; the MD sees that act".

The Engineer is invited by the MD and accepts (`platform.invitations.accepted`: in the event log, but
not counted as an act on Members and access, S27-G6, f-18), then takes
Step 1's acts over HTTP as the screen does, on T-W319's invented Project (`tw319.cost`). The MD reads
`GET /api/members` (the row's `acts`) and `GET /api/activity?actor=<them>` (the codes, newest first).

The codes of the confirm, the exclude, the confirm back in and the undo are the orchestrator's (and
`takeoff.step1.confirmed`, S15-W6's); an assign's, a drawing list's and an answer's codes are the
builder's to name: each is held to the messages convention (declared in `vextrus/takeoff/messages/`
with `event=True`, worded in `web/src/messages/`), not to a name.
"""

import re
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from engine.messages import collect_codes
from vextrus.drawings import services as drawings
from vextrus.platform.messages import invitations as invitation_codes
from vextrus.platform.services import tenancy
from vextrus.takeoff.services import step1
from vextrus.takeoff.tests.acceptance.ts15a1.acts import GIVEN_LIST, OverHttp
from vextrus.takeoff.tests.acceptance.tw319.cost import (
    ACTED_ON,
    SMALL,
    CostProject,
    kinds_of,
    low_confidence,
    project_of,
)
from vextrus.testing.auth import Api, accept_as, api_as, invitation
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

CONFIRMED = "takeoff.step1.confirmed"
EXCLUDED = "takeoff.step1.excluded"
CONFIRMED_BACK_IN = "takeoff.step1.confirmed_back_in"
UNDONE = "takeoff.step1.undone"

WORDS = Path(__file__).resolve().parents[5] / "web" / "src" / "messages" / "takeoff"


# The Engineer, invited by the MD ------------------------------------------------------------------


def engineer_of(project: CostProject, md: Member, staff: Any) -> tuple[Member, Api]:
    """`staff` invited by the MD as a Vextrus Engineer and accepting, signed in on a client in the
    Developer: the Member and their API (CSRF and session fetched)."""
    membership_id, token = invitation(md, staff.email)
    accept_as(token, staff)
    client = Client()
    client.force_login(staff)
    session = client.session
    session[tenancy.SESSION_TENANT] = str(md.developer_id)
    session.save()
    member = Member(staff, md.developer_id, membership_id, "vextrus_engineer", frozenset(), client)
    api = api_as(member)
    api.csrf_token()
    assert api.get(f"{project.path}/progress").status_code == 200
    return member, api


@pytest.fixture
def setting(
    qs_project: QsProject, sign_in: Callable[..., Member], other_staff: Any
) -> tuple[CostProject, Member, Member, OverHttp]:
    """The invented Project, the MD of its Developer, the Engineer and the Engineer's Step 1 acts."""
    project = project_of(qs_project, SMALL)
    md = sign_in(role="md", developer_id=qs_project.member.developer_id)
    engineer, api = engineer_of(project, md, other_staff)
    return project, md, engineer, OverHttp(project, api)


def row_of(md: Member, engineer: Member) -> dict[str, Any]:
    seen = api_as(md).get("/api/members")
    assert seen.status_code == 200, seen.content
    rows: list[dict[str, Any]] = seen.json()["vextrus_access"]
    [row] = [r for r in rows if r["membership_id"] == str(engineer.membership_id)]
    return row


def acts_of(md: Member, engineer: Member) -> list[dict[str, Any]]:
    """The Engineer's acts as the MD reads them, newest first."""
    seen = api_as(md).get("/api/activity", actor=str(engineer.user.pk))
    assert seen.status_code == 200, seen.content
    found: list[dict[str, Any]] = seen.json()
    return found


def codes_of(md: Member, engineer: Member) -> list[str]:
    return [a["code"] for a in acts_of(md, engineer)]


def events_by(md: Member, engineer: Member) -> list[str]:
    """The Engineer's acts' codes, oldest first."""
    return codes_of(md, engineer)[::-1]


# The Engineer's acts on Members and access --------------------------------------------------------


def test_the_md_sees_the_engineer_s_two_acts_after_an_exclude_and_a_confirm_back_in(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    way.exclude([project.proposal_of[ACTED_ON]])
    way.confirm([project.proposal_of[ACTED_ON]])

    assert row_of(md, engineer)["acts"] == 2, "accepting the invitation is not an act"


def test_the_engineer_s_acts_read_newest_first_from_the_confirm_back_in(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    way.exclude([project.proposal_of[ACTED_ON]])
    way.confirm([project.proposal_of[ACTED_ON]])

    assert codes_of(md, engineer) == [CONFIRMED_BACK_IN, EXCLUDED, invitation_codes.ACCEPTED.code]


def test_an_undo_is_one_more_act_of_the_engineer(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    way.exclude([project.proposal_of[ACTED_ON]])
    way.confirm([project.proposal_of[ACTED_ON]])
    way.undo()

    assert row_of(md, engineer)["acts"] == 3, "accepting the invitation is not an act"
    assert codes_of(md, engineer)[:2] == [UNDONE, CONFIRMED_BACK_IN]


def test_a_confirm_of_a_sheet_never_excluded_is_a_confirmed_act(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    way.confirm([project.proposal_of[ACTED_ON]])

    assert codes_of(md, engineer) == [CONFIRMED, invitation_codes.ACCEPTED.code]


# Each Step 1 act kind records exactly one event ---------------------------------------------------


def _assign(project: CostProject, way: OverHttp) -> None:
    """Put the acted-on sheet's detail view in Beams (#158), its view Proposal made as the read job
    makes it (not measured)."""
    with project.member.acting():
        view = next(v for v in drawings.views(project.sheet_of[ACTED_ON]) if v.kind == "detail")
        proposal = step1.propose_view(project.project_id, view)
    reply = way.api.post(f"{project.path}/assign", {"proposals": [str(proposal)], "steps": ["beams"]})
    assert reply.status_code == 200, reply.content


def _answer(project: CostProject, way: OverHttp) -> None:
    question = low_confidence(project)
    way.answer(question, kinds_of()[0])


ACT_KINDS: dict[str, Callable[[CostProject, OverHttp], None]] = {
    "confirm": lambda p, w: w.confirm([p.proposal_of[ACTED_ON]]),
    "exclude": lambda p, w: w.exclude([p.proposal_of[ACTED_ON]]),
    "assign": _assign,
    "drawing list": lambda p, w: w.set_list("structural", GIVEN_LIST),
    "answer": _answer,
}


def _declared_events() -> dict[str, bool]:
    return {code.code: code.event for code in collect_codes("vextrus.takeoff.messages")}


def _worded() -> set[str]:
    found: set[str] = set()
    for po in WORDS.glob("*/en.po"):
        found.update(re.findall(r'^msgid "([^"]+)"', po.read_text(encoding="utf-8"), re.MULTILINE))
    return found


@pytest.mark.parametrize("kind", list(ACT_KINDS))
def test_each_step1_act_records_one_event_of_a_declared_and_worded_code(
    setting: tuple[CostProject, Member, Member, OverHttp], kind: str
) -> None:
    project, md, engineer, way = setting
    before = events_by(md, engineer)

    ACT_KINDS[kind](project, way)

    new = events_by(md, engineer)[len(before) :]
    assert len(new) == 1, new
    [code] = new
    assert code.startswith("takeoff.step1."), code
    assert _declared_events().get(code) is True, f"{code} is not declared with event=True"
    assert code in _worded(), f"{code} has no words in web/src/messages/takeoff/"


def test_the_act_s_event_is_on_its_project_and_names_its_actor(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    way.exclude([project.proposal_of[ACTED_ON]])

    found = [(a["project_id"], a["actor"]["id"]) for a in acts_of(md, engineer) if a["code"] == EXCLUDED]
    assert found == [(str(project.project_id), str(engineer.user.pk))]


def test_a_refused_act_records_no_event(
    setting: tuple[CostProject, Member, Member, OverHttp],
) -> None:
    project, md, engineer, way = setting
    way.confirm([project.proposal_of[ACTED_ON]])
    taken = events_by(md, engineer)

    nothing = way.api.post(f"{project.path}/confirm", {"proposals": []})
    unknown = way.api.post(f"{project.path}/confirm", {"proposals": [str(uuid.uuid4())]})

    assert nothing.status_code == 400, nothing.content
    assert unknown.status_code in (400, 404, 409), unknown.content
    assert taken[-1] == CONFIRMED
    assert events_by(md, engineer) == taken
