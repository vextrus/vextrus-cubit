"""Ticket T-W323's acceptance tests (#323, G1 walk item FL10: "the Vextrus Engineer's Step 1 acts
appear in the MD's Members count and panel"): every Step 1 act writes one DomainEvent in its own
transaction, so `GET /api/activity` and `GET /api/members` count it under the actor's name.

The codes the ticket fixes (`vextrus/takeoff/messages/step1.py`, each `event=True`), with the ids and
counts each payload holds:

| Code                           | Act                                   | Params                 |
|--------------------------------|---------------------------------------|------------------------|
| `takeoff.step1.confirmed`      | `confirm`, single or bulk: one event  | `sheets`               |
| `takeoff.step1.left_out`       | `exclude`                             | `sheets`, `views`      |
| `takeoff.step1.views_assigned` | `assign`                              | `views`                |
| `takeoff.step1.answered`       | `answer`, any option but `keep_open`  | none                   |
| `takeoff.step1.kept_open`      | `answer` with `keep_open`             | none                   |
| `takeoff.step1.list_changed`   | `set_list` (the drawing list)         | none                   |
| `takeoff.step1.undone`         | `undo`                                | none                   |

Each event's subject is the act's Confirmation (`undone`: the one taken back), or the Question for
`answered` and `kept_open`; its actor the acting user, its Project the Project, no Building.

Every name and number here is invented (the fixture's sheets are `vextrus/testing/takeoff.py`'s).
"""

import uuid
from collections.abc import Callable
from typing import Any, cast

import pytest

from engine.messages import MessageCode
from engine.messages import conflicts as conflict_codes
from vextrus.api import api, message_codes
from vextrus.drawings import services as drawings
from vextrus.platform.models import DomainEvent
from vextrus.platform.services import events
from vextrus.takeoff.http.step1 import router
from vextrus.takeoff.messages import proposals as proposal_codes
from vextrus.takeoff.messages import step1 as step1_codes
from vextrus.takeoff.models import Confirmation, Question
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
ACT_CODES = (CONFIRMED, LEFT_OUT, VIEWS_ASSIGNED, ANSWERED, KEPT_OPEN, LIST_CHANGED, UNDONE)
PARAMS = {
    CONFIRMED: {"sheets"},
    LEFT_OUT: {"sheets", "views"},
    VIEWS_ASSIGNED: {"views"},
    ANSWERED: set(),
    KEPT_OPEN: set(),
    LIST_CHANGED: set(),
    UNDONE: set(),
}

LIST_TEXT = "S-01 to S-03"
"""The fixture's three sheets as a typed range: their second source, so they may be confirmed
together (ticket 166)."""

LIST_WITHOUT_S02 = "S-01, S-03"
"""A drawing list naming S-01 and S-03 but not S-02: S-01 agrees (its list names it) and S-02 has one
source, whether or not unbroken numbering counts as a second source (#320)."""


def url(project_id: uuid.UUID, path: str) -> str:
    return f"/api/projects/{project_id}/takeoff/step1/{path}"


def ok(response: Any) -> Any:
    assert response.status_code == 200, (response.status_code, response.content)
    return response.json()


def step1_events(member: Member) -> list[DomainEvent]:
    """The Developer's Step 1 act events, oldest first, read in the member's tenant."""
    with member.acting():
        return list(DomainEvent.objects.filter(kind__in=ACT_CODES).order_by("occurred_at", "id"))


def confirmations(member: Member, project_id: uuid.UUID) -> int:
    with member.acting():
        return Confirmation.objects.filter(project_id=project_id).count()


def engineer_of(project: Step1Project, sign_in: Callable[..., Member]) -> Member:
    return sign_in(
        role="vextrus_engineer",
        developer_id=project.member.developer_id,
        projects=[project.project_id],
    )


def md_of(project: Step1Project, sign_in: Callable[..., Member]) -> Member:
    return sign_in(role="md", developer_id=project.member.developer_id)


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


def answer(api: Api, project_id: uuid.UUID, question_id: uuid.UUID, option: str) -> Any:
    return api.post(url(project_id, f"questions/{question_id}/answer"), {"option": option, "text": ""})


def acts_of(reader: Member, actor: Member) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = ok(api_as(reader).get("/api/activity", actor=str(actor.user.pk)))
    return found


def row_of(reader: Member, section: str, member: Member) -> dict[str, Any]:
    seen = ok(api_as(reader).get("/api/members"))
    [row] = [r for r in seen[section] if r["membership_id"] == str(member.membership_id)]
    return dict(row)


# 1. The FL10 story --------------------------------------------------------------------------------


def test_the_md_reads_the_engineer_s_exclusion_and_confirmation_back_in(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    project = step1_project.project_id
    engineer, md = engineer_of(step1_project, sign_in), md_of(step1_project, sign_in)
    first = str(step1_project.proposals[0])
    acting = api_as(engineer)
    left = ok(acting.post(url(project, "exclude"), {"proposals": [first], "reason": "superseded"}))
    back = ok(acting.post(url(project, "confirm"), {"proposals": [first]}))

    acts = acts_of(md, engineer)

    assert [(a["code"], a["params"]["sheets"]) for a in acts] == [(CONFIRMED, 1), (LEFT_OUT, 1)]
    assert acts[1]["params"]["views"] == 0
    for act, made in zip(acts, (back, left), strict=True):
        assert act["params"]["actor"] == engineer.user.name
        assert act["actor"]["id"] == str(engineer.user.pk)
        assert act["actor"]["vextrus"] is True
        assert act["project_id"] == str(project)
        assert act["building_id"] is None
        assert act["subject_type"] == "confirmation"
        assert act["subject_id"] == made["confirmation_id"]
    with step1_project.member.acting():
        assert Confirmation.objects.get(id=acts[0]["subject_id"]).act == "confirm"
        assert Confirmation.objects.get(id=acts[1]["subject_id"]).act == "exclude"
    assert acts[1]["occurred_at"] < acts[0]["occurred_at"]


# 2. The Members count -----------------------------------------------------------------------------


def test_the_members_row_counts_the_step_1_acts_and_the_last_one(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    project, qs = step1_project.project_id, step1_project.member
    engineer, md = engineer_of(step1_project, sign_in), md_of(step1_project, sign_in)
    before = row_of(md, "vextrus_access", engineer)
    qs_before = row_of(md, "people", qs)["acts"]
    second, third = (str(p) for p in step1_project.proposals[1:])

    acting = api_as(engineer)
    ok(acting.post(url(project, "exclude"), {"proposals": [second], "reason": "blank"}))
    ok(acting.post(url(project, "confirm"), {"proposals": [second]}))
    ok(api_as(qs).post(url(project, "confirm"), {"proposals": [third]}))
    ok(api_as(qs).post(url(project, "exclude"), {"proposals": [third], "reason": "blank"}))

    after = row_of(md, "vextrus_access", engineer)
    [newest, _older] = acts_of(md, engineer)
    assert (before["acts"], before["last_act_at"]) == (0, None)
    assert (after["acts"], after["last_act_at"]) == (2, newest["occurred_at"])
    assert newest["code"] == CONFIRMED
    assert row_of(md, "people", qs)["acts"] == qs_before + 2


# 3. Who sees them ---------------------------------------------------------------------------------


def test_only_those_who_may_see_the_project_read_its_step_1_acts(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    project, developer = step1_project.project_id, step1_project.member.developer_id
    engineer, md = engineer_of(step1_project, sign_in), md_of(step1_project, sign_in)
    first = str(step1_project.proposals[0])
    acting = api_as(engineer)
    ok(acting.post(url(project, "exclude"), {"proposals": [first], "reason": "superseded"}))
    ok(acting.post(url(project, "confirm"), {"proposals": [first]}))
    unscoped_qs = sign_in(role="qs", developer_id=developer)
    scoped_qs = sign_in(role="qs", developer_id=developer, projects=[uuid.uuid4()])
    stranger_md = sign_in(role="md")
    guest = sign_in(role="guest", developer_id=developer)

    def step1_codes_seen(reader: Member) -> list[str]:
        acts = ok(api_as(reader).get("/api/activity"))
        return sorted(a["code"] for a in acts if a["code"].startswith("takeoff.step1."))

    assert step1_codes_seen(md) == [CONFIRMED, LEFT_OUT]
    assert step1_codes_seen(unscoped_qs) == [CONFIRMED, LEFT_OUT]
    assert step1_codes_seen(scoped_qs) == []
    assert step1_codes_seen(stranger_md) == []
    assert acts_of(stranger_md, engineer) == []
    refused = api_as(guest).get("/api/activity")
    assert (refused.status_code, refused.json()["code"]) == (403, "platform.auth.not_allowed")


# 4. A bulk act is one event -----------------------------------------------------------------------


def test_a_bulk_confirm_is_one_event_counting_its_sheets(step1_project: Step1Project) -> None:
    project, qs = step1_project.project_id, step1_project.member
    every = [str(p) for p in step1_project.proposals]
    ok(api_as(qs).post(url(project, "drawing-list"), {"discipline": "structural", "text": LIST_TEXT}))

    made = ok(api_as(qs).post(url(project, "confirm"), {"proposals": every}))

    confirmed = [e for e in step1_events(qs) if e.kind == CONFIRMED]
    assert [(e.payload, str(e.subject_id)) for e in confirmed] == [
        ({"sheets": 3}, made["confirmation_id"])
    ]
    with qs.acting():
        assert Confirmation.objects.get(id=made["confirmation_id"]).kind == "bulk"


def test_a_bulk_exclusion_is_one_event_counting_its_sheets(step1_project: Step1Project) -> None:
    project, qs = step1_project.project_id, step1_project.member
    every = [str(p) for p in step1_project.proposals]

    made = ok(api_as(qs).post(url(project, "exclude"), {"proposals": every, "reason": "blank"}))

    assert [(e.kind, e.payload, str(e.subject_id)) for e in step1_events(qs)] == [
        (LEFT_OUT, {"sheets": 3, "views": 0}, made["confirmation_id"])
    ]


def test_views_left_out_on_their_own_are_one_event_counting_the_views(
    step1_project: Step1Project,
) -> None:
    project, qs = step1_project.project_id, step1_project.member
    views = views_proposed(step1_project, 2)

    made = ok(api_as(qs).post(url(project, "exclude"), {"proposals": views, "reason": "blank"}))

    assert [(e.kind, e.payload, str(e.subject_id)) for e in step1_events(qs)] == [
        (LEFT_OUT, {"sheets": 0, "views": 2}, made["confirmation_id"])
    ]


# 5. Views put in Steps ----------------------------------------------------------------------------


def test_views_put_in_a_step_are_one_event_counting_the_views(step1_project: Step1Project) -> None:
    project, qs = step1_project.project_id, step1_project.member
    views = views_proposed(step1_project, 2)

    made = ok(api_as(qs).post(url(project, "assign"), {"proposals": views, "steps": ["slabs"]}))

    [event] = step1_events(qs)
    assert (event.kind, event.payload, str(event.subject_id)) == (
        VIEWS_ASSIGNED,
        {"views": 2},
        made["confirmation_id"],
    )
    assert (event.subject_type, event.project_id, event.building_id) == (
        "confirmation",
        project,
        None,
    )
    assert event.actor_user_id == qs.user.pk


# 6. A drawing list and an undo --------------------------------------------------------------------


def test_a_drawing_list_and_its_undo_are_one_event_each_on_the_same_act(
    step1_project: Step1Project,
) -> None:
    project, qs = step1_project.project_id, step1_project.member
    acting = api_as(qs)

    ok(acting.post(url(project, "drawing-list"), {"discipline": "structural", "text": LIST_TEXT}))
    [listed] = step1_events(qs)
    ok(acting.post(url(project, "undo"), {}))

    assert (listed.kind, listed.payload, listed.subject_type) == (LIST_CHANGED, {}, "confirmation")
    assert listed.subject_id is not None
    with qs.acting():
        assert Confirmation.objects.get(id=listed.subject_id).act == "drawing_list"
    [_listed, undone] = step1_events(qs)
    assert (undone.kind, undone.payload, undone.subject_type) == (UNDONE, {}, "confirmation")
    assert undone.subject_id == listed.subject_id
    assert (undone.actor_user_id, undone.project_id) == (qs.user.pk, project)


def test_undoing_a_confirm_names_the_confirm_taken_back(step1_project: Step1Project) -> None:
    project, qs = step1_project.project_id, step1_project.member
    acting = api_as(qs)
    made = ok(acting.post(url(project, "confirm"), {"proposals": [str(step1_project.proposals[2])]}))

    ok(acting.post(url(project, "undo"), {}))

    assert [(e.kind, str(e.subject_id)) for e in step1_events(qs)] == [
        (CONFIRMED, made["confirmation_id"]),
        (UNDONE, made["confirmation_id"]),
    ]


# 7. An answer is one event ------------------------------------------------------------------------


def test_an_answer_that_confirms_a_sheet_is_one_answered_event(step1_project: Step1Project) -> None:
    project, qs = step1_project.project_id, step1_project.member
    question = which_kind(step1_project, 1)

    ok(answer(api_as(qs), project, question, "slab_layout"))

    [event] = step1_events(qs)
    assert (event.kind, event.payload, event.subject_type, event.subject_id) == (
        ANSWERED,
        {},
        "question",
        question,
    )
    assert (event.actor_user_id, event.project_id, event.building_id) == (qs.user.pk, project, None)
    with qs.acting():
        [act] = Confirmation.objects.filter(project_id=project)
        assert (act.act, act.kind) == ("confirm", "question_answer")
        assert drawings.sheet(step1_project.sheets[1]).decision == "confirmed"


def test_keep_open_is_one_kept_open_event_and_the_question_stays_open(
    step1_project: Step1Project,
) -> None:
    project, qs = step1_project.project_id, step1_project.member
    question = which_kind(step1_project, 0)

    ok(answer(api_as(qs), project, question, "keep_open"))

    assert [(e.kind, e.subject_type, e.subject_id, e.payload) for e in step1_events(qs)] == [
        (KEPT_OPEN, "question", question, {})
    ]
    with qs.acting():
        assert Question.objects.get(id=question).status == "open"
        assert Confirmation.objects.filter(project_id=project).count() == 0


def test_an_answer_leaving_two_sheets_out_and_one_in_is_still_one_event(
    step1_project: Step1Project,
) -> None:
    """A stand-in `conflict` Question holding the fixture's three Proposals as copies of one number:
    `keep_latest` confirms one and leaves the other two out, in one answer."""
    project, qs = step1_project.project_id, step1_project.member
    with qs.acting():
        question = step1.raise_question(
            project,
            "conflict",
            conflict_codes.SAME_NUMBER(number="S-02", copies=3),
            discipline="structural",
            options=[{"key": key, "picked": False} for key in ("keep_latest", "keep_all", "keep_open")],
            blocks=list(step1_project.proposals),
        )

    ok(answer(api_as(qs), project, question, "keep_latest"))

    assert [(e.kind, e.subject_id) for e in step1_events(qs)] == [(ANSWERED, question)]
    with qs.acting():
        decided = sorted(str(drawings.sheet(s).decision) for s in step1_project.sheets)
        assert decided == ["confirmed", "excluded", "excluded"]


# 8. Refused acts write nothing; the event is in the act's transaction -----------------------------


def test_a_refused_act_writes_no_event_and_no_confirmation(step1_project: Step1Project) -> None:
    """S-02 is left off the drawing list, so it has one source under either rule (a list standing,
    a sheet it does not name) and a bulk act naming it is refused."""
    project, qs = step1_project.project_id, step1_project.member
    acting = api_as(qs)
    first, second, third = (str(p) for p in step1_project.proposals)

    def refused(act: Callable[[], Any], status: int, code: str) -> None:
        events_before = len(step1_events(qs))
        acts_before = confirmations(qs, project)
        response = act()
        assert (response.status_code, response.json()["code"]) == (status, code)
        assert len(step1_events(qs)) == events_before, code
        assert confirmations(qs, project) == acts_before, code

    refused(lambda: acting.post(url(project, "undo"), {}), 409, "takeoff.step1.nothing_to_undo")
    ok(acting.post(url(project, "drawing-list"), {"discipline": "structural", "text": LIST_WITHOUT_S02}))
    with qs.acting():
        step1.raise_question(
            project,
            "missing",
            step1_codes.NO_NUMBER(),
            subject_id=step1_project.sheets[2],
            discipline="structural",
            blocks=[step1_project.proposals[2]],
        )

    refused(
        lambda: acting.post(url(project, "confirm"), {"proposals": []}),
        400,
        "takeoff.step1.nothing_chosen",
    )
    refused(
        lambda: acting.post(url(project, "confirm"), {"proposals": [first], "kind": "kitchen_details"}),
        400,
        "takeoff.step1.kind_not_offered",
    )
    refused(
        lambda: acting.post(url(project, "confirm"), {"proposals": [first, second]}),
        409,
        "takeoff.step1.one_source",
    )
    asked = which_kind(step1_project, 1)
    refused(
        lambda: acting.post(url(project, "confirm"), {"proposals": [third]}),
        409,
        "takeoff.step1.question_first",
    )
    refused(
        lambda: answer(acting, project, asked, "pile_layout"),
        400,
        "takeoff.proposals.option_not_offered",
    )
    ok(answer(acting, project, asked, "column_layout"))
    refused(lambda: acting.post(url(project, "undo"), {}), 409, "takeoff.step1.answer_stays")
    refused(
        lambda: answer(acting, project, asked, "slab_layout"),
        409,
        "takeoff.proposals.answered_already",
    )


class _Failed(RuntimeError):
    """Raised by the act's last statement, after its writes."""


def test_an_act_that_fails_after_its_writes_leaves_no_event(
    step1_project: Step1Project, monkeypatch: pytest.MonkeyPatch
) -> None:
    project, qs = step1_project.project_id, step1_project.member

    def fail(project_id: uuid.UUID) -> None:
        raise _Failed

    monkeypatch.setattr(step1, "record_progress", fail)
    with qs.acting(), pytest.raises(_Failed):
        step1.confirm(project, [step1_project.proposals[0]], actor_name=qs.user.name)

    assert step1_events(qs) == []
    assert confirmations(qs, project) == 0


# 9. The class: every Step 1 act writes its event --------------------------------------------------

ACTS = {
    "drawing-list": LIST_CHANGED,
    "confirm": CONFIRMED,
    "exclude": LEFT_OUT,
    "assign": VIEWS_ASSIGNED,
    "undo": UNDONE,
    "questions/{question_id}/answer": ANSWERED,
}
"""Each POST operation of Step 1's router that is an act, by its path after `.../step1/`, with the
code it writes. A new act goes here, with its event."""
NOT_ACTS = {"drawing-list/read"}
"""The POST operations that change nothing (a pasted list read back)."""


def posted_operations() -> set[str]:
    prefix = "/projects/{project_id}/takeoff/step1/"
    found: set[str] = set()
    for path, view in router.path_operations.items():
        for operation in view.operations:
            if "POST" in operation.methods:
                assert path.startswith(prefix), path
                found.add(path.removeprefix(prefix))
    return found


def test_every_step_1_post_is_an_act_with_its_event_or_named_as_none() -> None:
    assert posted_operations() == set(ACTS) | NOT_ACTS


def test_each_step_1_act_writes_exactly_its_one_event(step1_project: Step1Project) -> None:
    project, qs = step1_project.project_id, step1_project.member
    acting = api_as(qs)
    first, second, _third = (str(p) for p in step1_project.proposals)
    [view] = views_proposed(step1_project, 1)
    question = which_kind(step1_project, 2)
    drive: dict[str, Callable[[], Any]] = {
        "drawing-list": lambda: acting.post(
            url(project, "drawing-list"), {"discipline": "structural", "text": LIST_TEXT}
        ),
        "confirm": lambda: acting.post(url(project, "confirm"), {"proposals": [first]}),
        "exclude": lambda: acting.post(
            url(project, "exclude"), {"proposals": [second], "reason": "blank"}
        ),
        "assign": lambda: acting.post(url(project, "assign"), {"proposals": [view], "steps": ["beams"]}),
        "undo": lambda: acting.post(url(project, "undo"), {}),
        "questions/{question_id}/answer": lambda: answer(acting, project, question, "column_layout"),
    }
    assert set(drive) == set(ACTS)

    for route, code in ACTS.items():  # in this order: the undo takes back the assign
        before = len(step1_events(qs))
        ok(drive[route]())
        written = step1_events(qs)[before:]
        assert [e.kind for e in written] == [code], route
        assert (written[0].actor_user_id, written[0].project_id) == (qs.user.pk, project), route


# 10. The codes are events, declared, and their payloads ids and counts ----------------------------


def declared() -> dict[str, MessageCode]:
    return {code.code: code for code in message_codes()}


def test_each_step_1_act_code_is_declared_as_an_event_with_its_params() -> None:
    codes = declared()

    assert [c for c in ACT_CODES if c not in codes] == []
    for code in ACT_CODES:
        assert codes[code].event is True, code
        assert set(codes[code].params) == PARAMS[code], code


def test_the_schema_lists_each_step_1_act_code_as_an_event_code() -> None:
    enum = api.get_openapi_schema()["components"]["schemas"]["EventCode"]["enum"]

    assert [c for c in ACT_CODES if c not in enum] == []


def test_an_event_payload_holding_words_is_refused(sign_in: Callable[..., Member]) -> None:
    codes = declared()
    member = sign_in(role="qs")

    with member.acting():
        for code in ACT_CODES:
            with pytest.raises(TypeError):
                events.record(
                    codes[code],
                    subject_type="confirmation",
                    subject_id=uuid.uuid4(),
                    payload=cast(Any, {"sheets": "three sheets"}),
                )
