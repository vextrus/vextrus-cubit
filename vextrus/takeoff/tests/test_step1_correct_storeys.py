"""S24-B2's Correct act on a plan view's storeys at its edges (the acceptance tests in ts24b2 pin its
promise): a number and storeys corrected in one act are undone together; a view given as it already is
changes nothing; one bad view refuses the whole act and writes nothing; a storeys correction does not
stand once the view's storeys changed since (another person's later correction); and the app role can
write the three columns it corrects, no more."""

import uuid
from typing import Any

import pytest
from django.db import connection

from vextrus.drawings import services as drawings
from vextrus.platform.services import tenancy
from vextrus.takeoff.models import Confirmation
from vextrus.takeoff.tests.acceptance.t19a.step1 import *  # noqa: F403 (its fixtures, by name)
from vextrus.takeoff.tests.acceptance.t19a.step1 import by_number, proposals, step1
from vextrus.takeoff.tests.acceptance.ts24b1.history import history
from vextrus.testing.auth import Api

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

READ = (["floor_3", "floor_5", "floor_7"], "at_floor_level")
MOVED_ON = "takeoff.step1.correction_moved_on"


def s06_plan(api: Api, project: uuid.UUID) -> tuple[dict[str, Any], dict[str, Any]]:
    [sheet] = by_number(proposals(api, project), "S-06")
    [plan] = [v for v in sheet["views"] if v["kind"] == "plan"]
    return sheet, plan


def body(sheet: dict[str, Any], *views: tuple[str, str, str], **more: Any) -> dict[str, Any]:
    return {
        "proposal": sheet["id"],
        "views": [{"view": v, "storeys": s, "meaning": m} for v, s, m in views],
        **more,
    }


def correct(api: Api, project: uuid.UUID, payload: dict[str, Any]) -> Any:
    return api.post(f"{step1(project)}/correct", payload)


def plan_now(
    api: Api, project: uuid.UUID, number: str = "S-06"
) -> tuple[list[str], str | None, str | None]:
    [sheet] = by_number(proposals(api, project), number)
    [plan] = [v for v in sheet["views"] if v["kind"] == "plan"]
    return list(plan["storeys"]), plan["storeys_meaning"], plan["storeys_source"]


def acts(demo: Any, project: uuid.UUID) -> int:
    with tenancy.acting_in(demo["developer:shapla"]):
        return Confirmation.objects.filter(project_id=project).count()


def test_a_number_and_storeys_corrected_in_one_act_are_undone_together(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    done = correct(nusrat, kr01, body(sheet, (plan["id"], "2nd, 4th", "floor_to_floor"), number="S-61"))
    assert done.status_code == 200, done.content
    assert plan_now(nusrat, kr01, "S-61") == (["floor_2", "floor_4"], "floor_to_floor", "typed")

    assert nusrat.post(f"{step1(kr01)}/undo", {}).status_code == 200

    [back] = [p for p in proposals(nusrat, kr01) if p["id"] == sheet["id"]]
    assert (back["number"], back["corrected"]) == ("S-06", False)
    assert plan_now(nusrat, kr01)[:2] == READ


def test_the_meaning_alone_may_be_corrected(demo: Any, nusrat: Api, kr01: uuid.UUID) -> None:
    sheet, plan = s06_plan(nusrat, kr01)

    done = correct(nusrat, kr01, body(sheet, (plan["id"], "3rd, 5th, 7th", "floor_to_floor")))

    assert done.status_code == 200, done.content
    assert plan_now(nusrat, kr01) == (READ[0], "floor_to_floor", "typed")


def test_a_view_given_as_it_already_is_changes_nothing(demo: Any, nusrat: Api, kr01: uuid.UUID) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    earlier = acts(demo, kr01)

    done = correct(nusrat, kr01, body(sheet, (plan["id"], "3rd, 5th, 7th", "at_floor_level")))

    assert (done.status_code, done.json()["code"]) == (400, "takeoff.step1.nothing_to_correct")
    assert plan_now(nusrat, kr01) == (READ[0], READ[1], plan["storeys_source"])
    assert acts(demo, kr01) == earlier


def test_one_bad_view_refuses_the_whole_act_and_writes_nothing(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    [elsewhere] = by_number(proposals(nusrat, kr01), "S-05")
    earlier = acts(demo, kr01)
    mixed = body(
        sheet,
        (plan["id"], "2nd, 4th", "floor_to_floor"),
        (elsewhere["views"][0]["id"], "2nd", "floor_to_floor"),
        title="A title that must not be kept",
    )

    refused = correct(nusrat, kr01, mixed)

    assert 400 <= refused.status_code < 500, refused.content
    assert plan_now(nusrat, kr01)[:2] == READ
    [after] = [p for p in proposals(nusrat, kr01) if p["id"] == sheet["id"]]
    assert (after["title"], after["corrected"]) == (sheet["title"], False)
    assert acts(demo, kr01) == earlier


def test_a_view_named_twice_is_refused(demo: Any, nusrat: Api, kr01: uuid.UUID) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    twice = body(sheet, (plan["id"], "2nd", "floor_to_floor"), (plan["id"], "4th", "floor_to_floor"))

    refused = correct(nusrat, kr01, twice)

    assert (refused.status_code, refused.json()["code"]) == (400, "drawings.sheets.storeys_view_twice")
    assert plan_now(nusrat, kr01)[:2] == READ


def test_a_range_is_refused_with_the_item_named(nusrat: Api, kr01: uuid.UUID) -> None:
    sheet, plan = s06_plan(nusrat, kr01)

    refused = correct(nusrat, kr01, body(sheet, (plan["id"], "2nd, basement to 3rd", "floor_to_floor")))

    assert refused.status_code == 400
    assert refused.json()["code"] == "drawings.sheets.storeys_range"
    assert refused.json()["params"]["word"] == "basement to 3rd"


def test_a_storeys_correction_does_not_stand_once_another_persons_correction_follows_it(
    nusrat: Api, kr01: uuid.UUID, as_person: Any
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    assert correct(nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor"))).status_code == 200
    arif = as_person("arif@vextrus.example", "shapla")
    assert correct(arif, kr01, body(sheet, (plan["id"], "9th", "at_floor_level"))).status_code == 200

    refused = nusrat.post(f"{step1(kr01)}/undo", {})

    assert (refused.status_code, refused.json()["code"]) == (409, MOVED_ON)
    assert plan_now(nusrat, kr01) == (["floor_9"], "at_floor_level", "typed")


def test_a_storeys_correction_does_not_stand_once_the_view_changed_under_it(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    assert correct(nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor"))).status_code == 200
    with tenancy.acting_in(demo["developer:shapla"]):  # changed since, by something else than an act
        drawings.set_view_storeys(
            uuid.UUID(sheet["sheet_id"]),
            [drawings.ViewStoreys(uuid.UUID(plan["id"]), ("floor_8",), "floor_to_floor", "typed")],
        )

    refused = nusrat.post(f"{step1(kr01)}/undo", {})

    assert (refused.status_code, refused.json()["code"]) == (409, MOVED_ON)
    assert plan_now(nusrat, kr01)[0] == ["floor_8"]


def test_the_app_writes_a_views_storeys_meaning_and_source_and_no_other_column(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    with tenancy.acting_in(demo["developer:shapla"]), connection.cursor() as cursor:
        cursor.execute(
            "select has_column_privilege(current_user, 'drawings_view', %s, 'UPDATE')", ["storeys"]
        )
        assert cursor.fetchone() == (True,)
        for column in ("storeys_meaning", "storeys_source"):
            cursor.execute(
                "select has_column_privilege(current_user, 'drawings_view', %s, 'UPDATE')", [column]
            )
            assert cursor.fetchone() == (True,)
        for column in ("title", "kind", "box", "storeys_as_stated", "sheet_revision_id"):
            cursor.execute(
                "select has_column_privilege(current_user, 'drawings_view', %s, 'UPDATE')", [column]
            )
            assert cursor.fetchone() == (False,), column


# Review of #777 --------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("typed", "meaning", "code"),
    [
        ("", "at_floor_level", "drawings.sheets.storeys_empty"),
        ("2nd, kitchen", "at_floor_level", "drawings.sheets.storeys_not_a_storey"),
        ("2nd", "at ceiling", "drawings.sheets.storeys_meaning_unknown"),
    ],
)
def test_a_storeys_refusal_names_the_view_it_is_about(
    nusrat: Api, kr01: uuid.UUID, typed: str, meaning: str, code: str
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)

    refused = correct(nusrat, kr01, body(sheet, (plan["id"], typed, meaning)))

    assert (refused.status_code, refused.json()["code"]) == (400, code)
    assert refused.json()["params"]["view_id"] == plan["id"]
    assert refused.json()["params"]["view_title"] == plan["title"][:80]


def opened_with(plan: dict[str, Any]) -> dict[str, Any]:
    return {"views": {plan["id"]: {"storeys": plan["storeys"], "meaning": plan["storeys_meaning"]}}}


def post_opened(api: Api, project: uuid.UUID, payload: dict[str, Any], opened: dict[str, Any]) -> Any:
    """`correct` as the form sends it: with the values it opened with in its header."""
    import json
    from urllib.parse import quote

    return api.client.post(
        f"{step1(project)}/correct",
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-CSRFToken": api.csrf_token(), "X-Step1-Opened-With": quote(json.dumps(opened))},
    )


def test_storeys_another_person_corrected_since_the_form_opened_are_not_overwritten(
    nusrat: Api, kr01: uuid.UUID, as_person: Any
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    arif = as_person("arif@vextrus.example", "shapla")
    assert correct(arif, kr01, body(sheet, (plan["id"], "9th", "at_floor_level"))).status_code == 200

    stale = post_opened(
        nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor")), opened_with(plan)
    )

    assert (stale.status_code, stale.json()["code"]) == (409, "takeoff.step1.storeys_corrected_since")
    assert stale.json()["params"]["view"] == plan["title"][:80]
    assert stale.json()["params"]["view_id"] == plan["id"]
    assert plan_now(nusrat, kr01) == (["floor_9"], "at_floor_level", "typed")


def test_storeys_saved_from_a_form_that_is_current_go_through(nusrat: Api, kr01: uuid.UUID) -> None:
    sheet, plan = s06_plan(nusrat, kr01)

    done = post_opened(
        nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor")), opened_with(plan)
    )

    assert done.status_code == 200, done.content
    assert plan_now(nusrat, kr01)[0] == ["floor_2"]


def test_a_sheets_history_names_the_storeys_a_correction_changed(nusrat: Api, kr01: uuid.UUID) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    assert (
        correct(nusrat, kr01, body(sheet, (plan["id"], "2nd, 4th", "floor_to_floor"))).status_code == 200
    )

    [act] = [a for a in history(nusrat, kr01, sheet["id"]) if a["code"] == "takeoff.step1.corrected"]

    assert act["views"] == [
        {"title": plan["title"], "place": 1, "old": READ[0], "new": ["floor_2", "floor_4"]}
    ]


def test_a_corrected_part_plan_stays_out_of_the_same_storey_comparison(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    from vextrus.takeoff.services.read_propose import proposals as reading

    sheet, plan = s06_plan(nusrat, kr01)
    sheet_id = uuid.UUID(sheet["sheet_id"])
    with tenancy.acting_in(demo["developer:shapla"]):  # a part plan: its storeys read from a title line
        drawings.set_view_storeys(
            sheet_id,
            [drawings.ViewStoreys(uuid.UUID(plan["id"]), ("floor_3",), "at_floor_level", "title_line")],
        )
    [sheet] = by_number(proposals(nusrat, kr01), "S-06")
    [plan] = [v for v in sheet["views"] if v["kind"] == "plan"]

    assert correct(nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor"))).status_code == 200

    with tenancy.acting_in(demo["developer:shapla"]):
        [kept] = [v for v in drawings.views(sheet_id) if str(v.id) == plan["id"]]
        assert kept.storeys_source == drawings.TYPED_PART
        assert str(reading.view_candidate(kept).storeys_source) == "title_line"
    assert plan_now(nusrat, kr01) == (["floor_2"], "floor_to_floor", "typed")


# Review 1 of #780 ------------------------------------------------------------------------------------


def test_undo_after_a_re_read_puts_the_storeys_back(demo: Any, nusrat: Api, kr01: uuid.UUID) -> None:
    from vextrus.takeoff.services.read_propose import proposals as reading

    sheet, plan = s06_plan(nusrat, kr01)
    sheet_id = uuid.UUID(sheet["sheet_id"])
    assert correct(nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor"))).status_code == 200
    with tenancy.acting_in(demo["developer:shapla"]):  # the file's views read again: new view rows
        again = [reading.view_candidate(v) for v in drawings.views(sheet_id)]
        drawings.record_views(sheet_id, again)
    [_sheet, moved] = s06_plan(nusrat, kr01)
    assert moved["id"] != plan["id"]
    assert plan_now(nusrat, kr01) == (["floor_2"], "floor_to_floor", "typed")

    undone = nusrat.post(f"{step1(kr01)}/undo", {})

    assert undone.status_code == 200, undone.content
    assert plan_now(nusrat, kr01) == (READ[0], READ[1], plan["storeys_source"])


@pytest.mark.parametrize(
    "views",
    [
        "storeys",
        ["not", "a", "mapping"],
        {"PLAN": {"storeys": 5, "meaning": "at_floor_level"}},
        {"PLAN": {"storeys": True, "meaning": "at_floor_level"}},
        {"PLAN": {"storeys": 2.5, "meaning": "at_floor_level"}},
        {"PLAN": {"storeys": [3, 5], "meaning": "at_floor_level"}},
        {"PLAN": {"storeys": {"floor_3": 1}, "meaning": "at_floor_level"}},
        {"PLAN": {"storeys": ["floor_3"], "meaning": 7}},
        {"PLAN": {"storeys": ["floor_3"], "meaning": ["at_floor_level"]}},
    ],
)
def test_an_opened_with_view_of_the_wrong_types_counts_as_no_header(
    nusrat: Api, kr01: uuid.UUID, views: Any
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    if isinstance(views, dict):
        views = {plan["id"]: views["PLAN"]}

    done = post_opened(
        nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor")), {"views": views}
    )

    assert done.status_code == 200, done.content
    assert plan_now(nusrat, kr01)[0] == ["floor_2"]


# Review 2 of #780 ------------------------------------------------------------------------------------


def read_again_after(demo: Any, real: Any, sheet_id: uuid.UUID) -> Any:
    """`real`, called once the sheet's file is read again (new view rows) inside the act: the re-read a
    read job makes between the act reading the views and writing them."""
    from vextrus.takeoff.services.read_propose import proposals as reading

    def then(*args: Any, **kwargs: Any) -> Any:
        with tenancy.acting_in(demo["developer:shapla"]):
            drawings.record_views(
                sheet_id, [reading.view_candidate(v) for v in drawings.views(sheet_id)]
            )
        return real(*args, **kwargs)

    return then


@pytest.mark.parametrize("between", ["set_view_storeys", "typed_view_storeys"])
def test_a_storeys_correction_read_again_under_it_is_refused_and_writes_nothing(
    demo: Any, nusrat: Api, kr01: uuid.UUID, monkeypatch: pytest.MonkeyPatch, between: str
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    sheet_id = uuid.UUID(sheet["sheet_id"])
    earlier = acts(demo, kr01)
    if between == "set_view_storeys":  # re-read before the write: the write would update no row
        monkeypatch.setattr(
            drawings, "set_view_storeys", read_again_after(demo, drawings.set_view_storeys, sheet_id)
        )
    else:  # re-read just after the views were judged: they are gone when the act names them
        real = drawings.typed_view_storeys

        def judged(*args: Any, **kwargs: Any) -> Any:
            out = real(*args, **kwargs)
            read_again_after(demo, lambda: None, sheet_id)()
            return out

        monkeypatch.setattr(drawings, "typed_view_storeys", judged)

    refused = correct(nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor")))

    assert (refused.status_code, refused.json()["code"]) == (
        409,
        "takeoff.step1.storeys_corrected_since",
    )
    monkeypatch.undo()
    [after, kept] = s06_plan(nusrat, kr01)
    assert (kept["id"], after["corrected"]) == (plan["id"], False)  # the re-read went with the act
    assert plan_now(nusrat, kr01)[:2] == READ
    assert acts(demo, kr01) == earlier


def untitled_plans(demo: Any, api: Api, project: uuid.UUID) -> tuple[dict[str, Any], list[Any]]:
    """S-06 read again with two plan views and no title on either."""
    from dataclasses import replace

    from vextrus.takeoff.services.read_propose import proposals as reading

    sheet, _plan = s06_plan(api, project)
    sheet_id = uuid.UUID(sheet["sheet_id"])
    with tenancy.acting_in(demo["developer:shapla"]):
        read = [reading.view_candidate(v) for v in drawings.views(sheet_id)]
        [plan] = [replace(c, title=None) for c in read if str(c.kind) == "plan"]
        drawings.record_views(sheet_id, [plan, plan, *(c for c in read if str(c.kind) != "plan")])
    [sheet] = by_number(proposals(api, project), "S-06")
    plans = sorted((v for v in sheet["views"] if v["kind"] == "plan"), key=lambda v: v["ordinal"])
    assert [v["title"] for v in plans] == ["", ""]
    return sheet, plans


def test_an_untitled_plan_is_named_by_its_place_when_its_storeys_moved_on(
    demo: Any, nusrat: Api, kr01: uuid.UUID, as_person: Any
) -> None:
    sheet, [_first, second] = untitled_plans(demo, nusrat, kr01)
    arif = as_person("arif@vextrus.example", "shapla")
    assert correct(arif, kr01, body(sheet, (second["id"], "9th", "at_floor_level"))).status_code == 200

    stale = post_opened(
        nusrat, kr01, body(sheet, (second["id"], "2nd", "floor_to_floor")), opened_with(second)
    )

    assert (stale.status_code, stale.json()["code"]) == (409, "takeoff.step1.storeys_corrected_since")
    params = stale.json()["params"]
    assert (params["view"], params["titled"], params["place"]) == ("", "no", 2)


def test_a_titled_plan_moved_on_is_named_by_its_title(
    nusrat: Api, kr01: uuid.UUID, as_person: Any
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    arif = as_person("arif@vextrus.example", "shapla")
    assert correct(arif, kr01, body(sheet, (plan["id"], "9th", "at_floor_level"))).status_code == 200

    stale = post_opened(
        nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor")), opened_with(plan)
    )

    params = stale.json()["params"]
    assert (params["view"], params["titled"], params["place"]) == (plan["title"][:80], "yes", 1)


def test_a_sheets_history_names_an_untitled_plan_by_its_place(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    sheet, [first, second] = untitled_plans(demo, nusrat, kr01)
    done = correct(
        nusrat,
        kr01,
        body(sheet, (first["id"], "2nd", "floor_to_floor"), (second["id"], "4th", "floor_to_floor")),
    )
    assert done.status_code == 200, done.content

    [act] = [a for a in history(nusrat, kr01, sheet["id"]) if a["code"] == "takeoff.step1.corrected"]

    assert [(v["title"], v["place"]) for v in act["views"]] == [("", 1), ("", 2)]


# Review 3 of #780 ------------------------------------------------------------------------------------


def test_a_storeys_undo_read_again_under_it_is_refused_and_takes_nothing_back(
    demo: Any, nusrat: Api, kr01: uuid.UUID, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    sheet_id = uuid.UUID(sheet["sheet_id"])
    assert correct(nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor"))).status_code == 200
    # Read again between the undo reading the views and putting them back: the write finds no row.
    monkeypatch.setattr(
        drawings,
        "put_back_view_storeys",
        read_again_after(demo, drawings.put_back_view_storeys, sheet_id),
    )

    refused = nusrat.post(f"{step1(kr01)}/undo", {})

    assert (refused.status_code, refused.json()["code"]) == (409, MOVED_ON)
    monkeypatch.undo()
    [_sheet, kept] = s06_plan(nusrat, kr01)
    assert kept["id"] == plan["id"]  # the re-read went with the undo
    assert plan_now(nusrat, kr01) == (["floor_2"], "floor_to_floor", "typed")
    with tenancy.acting_in(demo["developer:shapla"]):
        [act] = Confirmation.objects.filter(project_id=kr01, act="correct")
    assert act.undone_at is None  # never stamped undone with nothing put back
    assert nusrat.post(f"{step1(kr01)}/undo", {}).status_code == 200
    assert plan_now(nusrat, kr01)[:2] == READ


def test_a_storeys_undo_locks_the_sheet_before_reading_its_views(
    nusrat: Api, kr01: uuid.UUID, monkeypatch: pytest.MonkeyPatch
) -> None:
    from vextrus.takeoff.services import step1 as service

    sheet, plan = s06_plan(nusrat, kr01)
    assert correct(nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor"))).status_code == 200
    calls: list[str] = []

    def spy(name: str, real: Any) -> Any:
        def called(*args: Any, **kwargs: Any) -> Any:
            calls.append(name)
            return real(*args, **kwargs)

        return called

    monkeypatch.setattr(drawings, "lock_sheet", spy("lock", drawings.lock_sheet))
    monkeypatch.setattr(service, "_views_now", spy("views", service._views_now))
    monkeypatch.setattr(
        drawings, "put_back_view_storeys", spy("put_back", drawings.put_back_view_storeys)
    )

    assert nusrat.post(f"{step1(kr01)}/undo", {}).status_code == 200

    assert calls[-3:] == ["lock", "views", "put_back"]


# The design gate of #811 (the orchestrator's ruling, for the owner's M0 walk): a typed storeys
# correction is the QS's own word, so the title-against-plans Check asks no Question over it.
DIFFERS = "engine.storey_titles.differs"


def holding(api: Api, project: uuid.UUID, sheet: dict[str, Any]) -> list[str]:
    """The codes of the open Questions that hold the sheet's Proposal."""
    listed = api.get(f"{step1(project)}/questions").json()
    items = listed["questions"]
    return [q["code"] for q in items if q["status"] == "open" and sheet["id"] in q["proposals"]]


def latest_findings(demo: Any, project: uuid.UUID, number: str) -> list[dict[str, Any]]:
    """The storey-titles Check's findings naming the sheet in its latest run."""
    from vextrus.takeoff.models import CheckFinding, CheckRun

    with tenancy.acting_in(demo["developer:shapla"]):
        run = CheckRun.objects.filter(project_id=project, check_key="storey_titles").latest("at")
        rows = CheckFinding.objects.filter(run=run).values_list("params", flat=True)
        return [dict(p) for p in rows if p.get("sheet") == number]


def test_typed_storeys_against_the_title_ask_no_question_and_are_recorded_as_the_qs_correction(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)

    done = correct(nusrat, kr01, body(sheet, (plan["id"], "2nd, 4th, 6th", "floor_to_floor")))

    assert done.status_code == 200, done.content
    assert DIFFERS not in holding(nusrat, kr01, sheet)
    [after] = [p for p in proposals(nusrat, kr01) if p["id"] == sheet["id"]]
    assert after["corrected"] is True  # the State column's ", corrected", at once
    # Recorded, never silent: the Check's finding stands, marked as the QS's correction.
    [finding] = latest_findings(demo, kr01, "S-06")
    assert finding["answered"] == "correction"

    assert nusrat.post(f"{step1(kr01)}/undo", {}).status_code == 200
    assert plan_now(nusrat, kr01)[:2] == READ
    assert latest_findings(demo, kr01, "S-06") == []  # as read, the title agrees


def test_typed_storeys_ask_no_title_question_but_a_real_duplicate_still_is_one(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    [s04] = by_number(proposals(nusrat, kr01), "S-04")
    [plan] = [v for v in s04["views"] if v["kind"] == "plan"]

    done = correct(nusrat, kr01, body(s04, (plan["id"], "Ground, 1st", "at_floor_level")))

    assert done.status_code == 200, done.content
    codes = holding(nusrat, kr01, s04)
    assert DIFFERS not in codes
    # Two beam layouts now draw the 1st floor (S-04 typed, S-05 read): a real duplicate, still asked.
    assert codes, codes


# Review 1 of #811 ------------------------------------------------------------------------------------


def test_a_view_read_again_under_an_open_form_is_refused_as_changed_since(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    from vextrus.takeoff.services.read_propose import proposals as reading

    sheet, plan = s06_plan(nusrat, kr01)
    sheet_id = uuid.UUID(sheet["sheet_id"])
    with tenancy.acting_in(demo["developer:shapla"]):  # the file read again: new view rows, new ids
        again = [reading.view_candidate(v) for v in drawings.views(sheet_id)]
        drawings.record_views(sheet_id, again)
    opened = {
        "views": {
            plan["id"]: {**opened_with(plan)["views"][plan["id"]], "title": plan["title"], "place": 1}
        }
    }

    stale = post_opened(nusrat, kr01, body(sheet, (plan["id"], "2nd", "floor_to_floor")), opened)

    assert (stale.status_code, stale.json()["code"]) == (409, "takeoff.step1.storeys_corrected_since")
    assert stale.json()["params"]["view"] == plan["title"][:80]
    assert (stale.json()["params"]["titled"], stale.json()["params"]["place"]) == ("yes", 1)
    assert plan_now(nusrat, kr01)[:2] == READ


def test_a_view_unknown_to_a_form_that_never_opened_it_is_still_refused_as_unknown(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    sheet, plan = s06_plan(nusrat, kr01)
    stranger = str(uuid.uuid4())

    refused = post_opened(
        nusrat, kr01, body(sheet, (stranger, "2nd", "floor_to_floor")), opened_with(plan)
    )

    assert (refused.status_code, refused.json()["code"]) == (400, "drawings.sheets.storeys_view_unknown")
