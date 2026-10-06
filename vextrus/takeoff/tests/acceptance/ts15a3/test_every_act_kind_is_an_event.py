"""Ticket S15-A3's acceptance tests (re-submits #432, T-W323; G1 walk item FL10): "Every Step 1 act
records a DomainEvent in the one place acts are created, with a check that each does; the MD's Members
and Acts views count every act."

T-W323's own tests (`../tw323/`) pin the seven codes, their params, who reads them and that a refused
act writes none. These add the check the ticket names:

1. Every kind of Step 1 act, enumerated: each act (`ConfirmationAct`: what the act was) in each way
   it is made (one sheet, in bulk, by answering a Question), and the acts that make no Confirmation
   (undo, keep open), done by the Vextrus Engineer, writes exactly one DomainEvent the MD reads in the
   Acts view. A new act (a new `ConfirmationAct` value) fails `test_the_cases_name_every_act` until a
   case here drives it and finds its event.
2. The MD's Members row for the Engineer counts every one of those acts, and its last.

Everything is read through the API the MD's screens read (`GET /api/activity`, `GET /api/members`).
Every name and number here is invented (the fixture's sheets are `vextrus/testing/takeoff.py`'s).
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.drawings import services as drawings
from vextrus.takeoff.messages import proposals as proposal_codes
from vextrus.takeoff.models import Confirmation, ConfirmationAct
from vextrus.takeoff.services import step1
from vextrus.testing.auth import Api, api_as
from vextrus.testing.takeoff import Step1Project
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

CONFIRMED = "takeoff.step1.confirmed"
LEFT_OUT = "takeoff.step1.left_out"
VIEWS_ASSIGNED = "takeoff.step1.views_assigned"
ANSWERED = "takeoff.step1.answered"
KEPT_OPEN = "takeoff.step1.kept_open"
LIST_CHANGED = "takeoff.step1.list_changed"
UNDONE = "takeoff.step1.undone"
ACT_CODES = {CONFIRMED, LEFT_OUT, VIEWS_ASSIGNED, ANSWERED, KEPT_OPEN, LIST_CHANGED, UNDONE}

LIST_TEXT = "S-01 to S-03"
"""The fixture's three sheets as a typed range: their second source, so they may be confirmed
together (ticket 166)."""


# Helpers ------------------------------------------------------------------------------------------


def url(project_id: uuid.UUID, path: str) -> str:
    return f"/api/projects/{project_id}/takeoff/step1/{path}"


def ok(response: Any) -> Any:
    assert response.status_code == 200, (response.status_code, response.content)
    return response.json()


def engineer_of(project: Step1Project, sign_in: Callable[..., Member]) -> Member:
    return sign_in(
        role="vextrus_engineer",
        developer_id=project.member.developer_id,
        projects=[project.project_id],
    )


def md_of(project: Step1Project, sign_in: Callable[..., Member]) -> Member:
    return sign_in(role="md", developer_id=project.member.developer_id)


def acts_seen(md: Member, project_id: uuid.UUID) -> list[dict[str, Any]]:
    """Every act on the Project the MD reads in the Acts view, newest first."""
    found: list[dict[str, Any]] = ok(api_as(md).get("/api/activity", project=str(project_id), limit=200))
    return found


def made_since(member: Member, project_id: uuid.UUID, seen: set[uuid.UUID]) -> list[Confirmation]:
    with member.acting():
        return list(Confirmation.objects.filter(project_id=project_id).exclude(id__in=seen))


def confirmation_ids(member: Member, project_id: uuid.UUID) -> set[uuid.UUID]:
    with member.acting():
        return set(Confirmation.objects.filter(project_id=project_id).values_list("id", flat=True))


def views_proposed(project: Step1Project, count: int) -> list[str]:
    """The first `count` views of the fixture's sheets (one title-block view each, unaccounted),
    proposed as Step 1 view Proposals; their ids."""
    with project.member.acting():
        found = [view for sheet in project.sheets for view in drawings.views(sheet)][:count]
        assert len(found) == count
        return [str(step1.propose_view(project.project_id, view)) for view in found]


def which_kind(project: Step1Project, index: int) -> uuid.UUID:
    """A `low_confidence` Question on one fixture sheet holding its one Proposal: two Structural
    kinds and `keep_open`, as 21c raises it."""
    with project.member.acting():
        return step1.raise_question(
            project.project_id,
            "low_confidence",
            proposal_codes.WHICH_KIND(sheet=f"S-0{index + 1}", named="number"),
            subject_id=project.sheets[index],
            discipline="structural",
            options=[
                {"key": key, "picked": False} for key in ("column_layout", "slab_layout", "keep_open")
            ],
            blocks=[project.proposals[index]],
        )


def same_number(project: Step1Project) -> uuid.UUID:
    """A stand-in `conflict` Question holding the fixture's three Proposals as copies of one number:
    `keep_latest` confirms one and leaves the other two out, in one answer."""
    with project.member.acting():
        return step1.raise_question(
            project.project_id,
            "conflict",
            conflict_codes.SAME_NUMBER(number="S-02", copies=3),
            discipline="structural",
            options=[{"key": key, "picked": False} for key in ("keep_latest", "keep_all", "keep_open")],
            blocks=list(project.proposals),
        )


def answer(api: Api, project_id: uuid.UUID, question_id: uuid.UUID, option: str) -> Any:
    return api.post(url(project_id, f"questions/{question_id}/answer"), {"option": option, "text": ""})


# 1. Every kind of Step 1 act, enumerated ----------------------------------------------------------


@dataclass(frozen=True)
class Case:
    """One kind of Step 1 act: how to make it ready (`ready`, as the QS or the Engineer: its own
    events are not counted), the act itself (`act`, as the Engineer), the one event it writes, what it
    is about, and the Confirmations it makes, as (act, kind) (kind None: not pinned here)."""

    code: str
    ready: Callable[[Step1Project, Api, Api], Any]
    act: Callable[[Step1Project, Api, Any], Any]
    subject: str
    """What its event is about: `confirmation` (the act's own), `undone` (the act taken back)
    or `question`."""
    makes: tuple[tuple[str, str | None], ...]


def _nothing(project: Step1Project, qs: Api, engineer: Api) -> None:
    return None


def _proposal(project: Step1Project, index: int) -> str:
    return str(project.proposals[index])


def _every(project: Step1Project) -> list[str]:
    return [str(p) for p in project.proposals]


def _listed(project: Step1Project, qs: Api, engineer: Api) -> None:
    ok(qs.post(url(project.project_id, "drawing-list"), {"discipline": "structural", "text": LIST_TEXT}))


def _two_views(project: Step1Project, qs: Api, engineer: Api) -> list[str]:
    return views_proposed(project, 2)


def _engineer_confirmed(project: Step1Project, qs: Api, engineer: Api) -> str:
    made = ok(engineer.post(url(project.project_id, "confirm"), {"proposals": [_proposal(project, 0)]}))
    return str(made["confirmation_id"])


def _engineer_listed(project: Step1Project, qs: Api, engineer: Api) -> None:
    ok(
        engineer.post(
            url(project.project_id, "drawing-list"), {"discipline": "structural", "text": LIST_TEXT}
        )
    )


CASES: dict[str, Case] = {
    "a drawing list set": Case(
        LIST_CHANGED,
        _nothing,
        lambda p, e, _: e.post(
            url(p.project_id, "drawing-list"), {"discipline": "structural", "text": LIST_TEXT}
        ),
        "confirmation",
        (("drawing_list", None),),
    ),
    "a drawing list replaced": Case(
        LIST_CHANGED,
        _listed,
        lambda p, e, _: e.post(
            url(p.project_id, "drawing-list"), {"discipline": "structural", "text": "S-01, S-02"}
        ),
        "confirmation",
        (("drawing_list", None),),
    ),
    "one sheet confirmed": Case(
        CONFIRMED,
        _nothing,
        lambda p, e, _: e.post(url(p.project_id, "confirm"), {"proposals": [_proposal(p, 0)]}),
        "confirmation",
        (("confirm", "single"),),
    ),
    "sheets confirmed in bulk": Case(
        CONFIRMED,
        _listed,
        lambda p, e, _: e.post(url(p.project_id, "confirm"), {"proposals": _every(p)}),
        "confirmation",
        (("confirm", "bulk"),),
    ),
    "one sheet left out": Case(
        LEFT_OUT,
        _nothing,
        lambda p, e, _: e.post(
            url(p.project_id, "exclude"), {"proposals": [_proposal(p, 1)], "reason": "blank"}
        ),
        "confirmation",
        (("exclude", "single"),),
    ),
    "sheets left out in bulk": Case(
        LEFT_OUT,
        _nothing,
        lambda p, e, _: e.post(
            url(p.project_id, "exclude"), {"proposals": _every(p), "reason": "blank"}
        ),
        "confirmation",
        (("exclude", "bulk"),),
    ),
    "views left out on their own": Case(
        LEFT_OUT,
        _two_views,
        lambda p, e, views: e.post(
            url(p.project_id, "exclude"), {"proposals": views, "reason": "blank"}
        ),
        "confirmation",
        (("exclude", None),),
    ),
    "views put in a Takeoff Step": Case(
        VIEWS_ASSIGNED,
        _two_views,
        lambda p, e, views: e.post(
            url(p.project_id, "assign"), {"proposals": views, "steps": ["slabs"]}
        ),
        "confirmation",
        (("assign", None),),
    ),
    "a confirm undone": Case(
        UNDONE,
        _engineer_confirmed,
        lambda p, e, _: e.post(url(p.project_id, "undo"), {}),
        "undone",
        (),
    ),
    "a drawing list undone": Case(
        UNDONE,
        _engineer_listed,
        lambda p, e, _: e.post(url(p.project_id, "undo"), {}),
        "undone",
        (),
    ),
    "a Question answered, confirming its sheet": Case(
        ANSWERED,
        lambda p, q, e: which_kind(p, 1),
        lambda p, e, question: answer(e, p.project_id, question, "slab_layout"),
        "question",
        (("confirm", "question_answer"),),
    ),
    "a Question answered, confirming one sheet and leaving two out": Case(
        ANSWERED,
        lambda p, q, e: same_number(p),
        lambda p, e, question: answer(e, p.project_id, question, "keep_latest"),
        "question",
        (("confirm", "question_answer"), ("exclude", "question_answer")),
    ),
    "a Question kept open": Case(
        KEPT_OPEN,
        lambda p, q, e: which_kind(p, 0),
        lambda p, e, question: answer(e, p.project_id, question, "keep_open"),
        "question",
        (),
    ),
}
"""Every kind of Step 1 act. A new act goes here, with the event it writes."""


def test_the_cases_name_every_act() -> None:
    """The tripwire: every act a Step 1 Confirmation records (`ConfirmationAct`), each way an act
    is made (one sheet, bulk, answering), and each of the seven codes, has a case above."""
    made = {made for case in CASES.values() for made in case.makes}

    assert {act for act, _kind in made} == set(ConfirmationAct.values)
    assert {kind for _act, kind in made if kind} == {"single", "bulk", "question_answer"}
    assert {case.code for case in CASES.values()} == ACT_CODES


@pytest.mark.parametrize("name", list(CASES))
def test_each_kind_of_step_1_act_writes_its_one_event_the_md_reads(
    name: str, step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    case, project, qs = CASES[name], step1_project.project_id, step1_project.member
    engineer, md = engineer_of(step1_project, sign_in), md_of(step1_project, sign_in)
    acting = api_as(engineer)
    before_ready = confirmation_ids(qs, project)
    readied = case.ready(step1_project, api_as(qs), acting)
    made_ready = made_since(qs, project, before_ready)
    acts_before = {a["id"] for a in acts_seen(md, project)}
    made_before = confirmation_ids(qs, project)

    ok(case.act(step1_project, acting, readied))

    written = [a for a in acts_seen(md, project) if a["id"] not in acts_before]
    made = made_since(qs, project, made_before)
    assert [a["code"] for a in written] == [case.code], name
    [event] = written
    assert event["actor"]["id"] == str(engineer.user.pk), name
    assert event["actor"]["vextrus"] is True, name
    assert event["params"]["actor"] == engineer.user.name, name
    assert (event["project_id"], event["building_id"]) == (str(project), None), name
    kinds_pinned = {act for act, kind in case.makes if kind is not None}
    assert sorted(((c.act, c.kind if c.act in kinds_pinned else None) for c in made), key=str) == sorted(
        case.makes, key=str
    ), name
    subject = (event["subject_type"], event["subject_id"])
    if case.subject == "confirmation":
        [act] = made
        assert subject == ("confirmation", str(act.id)), name
    elif case.subject == "undone":
        [taken_back] = made_ready
        assert subject == ("confirmation", str(taken_back.id)), name
    else:
        assert subject == ("question", str(readied)), name


# 2. The Members and Acts views count every one of the Engineer's acts -----------------------------


def test_the_md_s_members_row_and_acts_view_count_each_of_the_engineer_s_step_1_acts(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    project = step1_project.project_id
    engineer, md = engineer_of(step1_project, sign_in), md_of(step1_project, sign_in)
    acting = api_as(engineer)
    first, second, _third = (str(p) for p in step1_project.proposals)
    [view] = views_proposed(step1_project, 1)
    question = which_kind(step1_project, 2)

    def row() -> dict[str, Any]:
        seen = ok(api_as(md).get("/api/members"))
        [found] = [
            r for r in seen["vextrus_access"] if r["membership_id"] == str(engineer.membership_id)
        ]
        return dict(found)

    assert (row()["acts"], row()["last_act_at"]) == (0, None)
    people_before = ok(api_as(md).get("/api/members"))["people"]
    ok(acting.post(url(project, "drawing-list"), {"discipline": "structural", "text": LIST_TEXT}))
    ok(acting.post(url(project, "confirm"), {"proposals": [first]}))
    ok(acting.post(url(project, "exclude"), {"proposals": [second], "reason": "blank"}))
    ok(acting.post(url(project, "assign"), {"proposals": [view], "steps": ["beams"]}))
    ok(acting.post(url(project, "undo"), {}))
    ok(answer(acting, project, question, "keep_open"))
    ok(answer(acting, project, question, "column_layout"))

    theirs: list[dict[str, Any]] = ok(
        api_as(md).get("/api/activity", actor=str(engineer.user.pk), limit=200)
    )
    assert [a["code"] for a in theirs] == [
        ANSWERED,
        KEPT_OPEN,
        UNDONE,
        VIEWS_ASSIGNED,
        LEFT_OUT,
        CONFIRMED,
        LIST_CHANGED,
    ]
    assert {a["params"]["actor"] for a in theirs} == {engineer.user.name}
    after = row()
    assert (after["acts"], after["last_act_at"]) == (7, theirs[0]["occurred_at"])
    assert ok(api_as(md).get("/api/members"))["people"] == people_before
