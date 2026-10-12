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


def test_a_view_given_as_it_already_is_changes_nothing(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
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
    assert refused.json() == {
        "code": "drawings.sheets.storeys_range",
        "params": {"word": "basement to 3rd"},
    }


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
    with tenancy.acting_in(demo["developer:shapla"]):
        with connection.cursor() as cursor:
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
