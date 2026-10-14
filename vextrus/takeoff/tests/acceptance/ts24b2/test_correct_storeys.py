"""S24-B2 (issue #677, M0-FL8): the Correct act `E` corrects a plan view's storeys and their meaning,
through the API, on the demo seed's KR-01 (every title invented). m0-screens 6.9 "Corrections (`E`)":
"Correct the Proposal" offers, "for each plan view "Storeys of "<view title>", each listed" (placeholder
"3rd, 5th, 7th") with its meaning as a two-choice toggle, "at floor level" | "floor to floor" (a view
read "at ceiling level" shows that meaning as read beside the toggle, and the toggle does not offer it:
a correction picks one of the two)"; "A correction leaves the sheet a Proposal"; "Undo (`Ctrl Z`):
undoes the last act (… a correction …)"; 2.2 row E: "Correct the focused sheet's number, title or
storeys"; 6.12: the MD and a Guest change nothing. Built on S22-FL8's Correct act (PR #706): its route,
its act reply, its `corrected` flag, its Confirmation `act` "correct" and its undo.

Names chosen by the acceptance writer where no authority gives one (the builder meets them):
- `POST …/takeoff/step1/correct` also takes `"views": [{"view": id, "storeys": str, "meaning": str}]`:
  per plan view of the Proposal's sheet, the storeys as the QS typed them ("2nd, 4th, 6th") and the
  meaning's key, `at_floor_level` or `floor_to_floor` (`engine.recognise.types.StoreysMeaning`);
- the view's `storeys` (keys, low to high) and `storeys_meaning` then read as corrected in Step 1's
  Proposals and in `drawings.services.views` (what the steps after Step 1 read), with `storeys_source`
  "typed" (typed by a person, as 6.10 marks a typed drawing list);
- a refused correction answers 4xx `{code, params}` and writes nothing (its codes are the builder's).

"The Building's storeys" in M0 are the canonical storey vocabulary (6.8: "Before Step 3 the slots come
from the canonical storey vocabulary"; §8 row 9: "Real storeys are known only from Step 3"), so a storey
not in them is a word naming no storey of that vocabulary.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.drawings import services as drawings
from vextrus.platform.services import tenancy
from vextrus.takeoff.models import Confirmation
from vextrus.testing.auth import Api

from ..t19a.step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from ..t19a.step1 import NOT_FOUND, by_number, proposals, step1

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

type Demo = dict[str, Any]
"""The demo seed's ids by key (`vextrus.seed.demo.Demo`, a layer above takeoff: not imported)."""

READ = (["floor_3", "floor_5", "floor_7"], "at_floor_level")
"""S-06 "3RD, 5TH & 7TH FLOOR BEAM LAYOUT"'s one plan view, as read."""
TYPED = "2nd, 4th, 6th"
CORRECTED = ["floor_2", "floor_4", "floor_6"]


def correct(api: Api, project: uuid.UUID, body: dict[str, Any]) -> Any:
    response = api.post(f"{step1(project)}/correct", body)
    kind = response.get("Content-Type", "")
    assert kind.startswith("application/json"), f"no correct route: {response.status_code} {kind}"
    return response


def sheet(api: Api, project: uuid.UUID, number: str) -> dict[str, Any]:
    [found] = by_number(proposals(api, project), number)
    return found


def plan_of(proposal: dict[str, Any]) -> dict[str, Any]:
    plans: list[dict[str, Any]] = [v for v in proposal["views"] if v["kind"] == "plan"]
    [plan] = plans
    return plan


def storeys_of(view: dict[str, Any]) -> tuple[list[str], str | None]:
    return list(view["storeys"]), view["storeys_meaning"]


def storeys_body(
    proposal: dict[str, Any], view: dict[str, Any], typed: str, meaning: str
) -> dict[str, Any]:
    return {
        "proposal": proposal["id"],
        "views": [{"view": view["id"], "storeys": typed, "meaning": meaning}],
    }


def acts(demo: Demo, project: uuid.UUID) -> list[Confirmation]:
    with tenancy.acting_in(demo["developer:shapla"]):
        return list(Confirmation.objects.filter(project_id=project).order_by("at"))


def kept_views(demo: Demo, sheet_id: str) -> list[Any]:
    """The views as `drawings.services` gives them to the steps after Step 1."""
    with tenancy.acting_in(demo["developer:shapla"]):
        return drawings.views(uuid.UUID(sheet_id))


def view_facts(api: Api, project: uuid.UUID) -> list[tuple[str, tuple[str, ...], Any, Any]]:
    return sorted(
        (v["id"], tuple(v["storeys"]), v["storeys_meaning"], v.get("storeys_source"))
        for p in proposals(api, project)
        for v in p["views"]
    )


def test_correcting_a_plan_views_storeys_and_meaning_shows_them_on_its_proposal(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    plan = plan_of(s06)
    assert storeys_of(plan) == READ

    response = correct(nusrat, kr01, storeys_body(s06, plan, TYPED, "floor_to_floor"))

    assert response.status_code == 200, response.content
    assert response.json()["act"] == "correct"
    after = plan_of(sheet(nusrat, kr01, "S-06"))
    assert storeys_of(after) == (CORRECTED, "floor_to_floor")


def test_the_corrected_storeys_are_marked_typed_and_the_sheet_stays_a_corrected_proposal(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")

    correct(nusrat, kr01, storeys_body(s06, plan_of(s06), TYPED, "at_floor_level"))

    after = sheet(nusrat, kr01, "S-06")
    assert plan_of(after)["storeys_source"] == "typed"
    assert (after["decision"], after["corrected"]) == (None, True)


def test_a_storeys_correction_is_a_correct_act_under_the_qss_name_with_the_storeys_read_in_before(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    earlier = len(acts(demo, kr01))

    correct(nusrat, kr01, storeys_body(s06, plan_of(s06), TYPED, "floor_to_floor"))

    done = acts(demo, kr01)
    assert len(done) == earlier + 1
    assert (done[-1].act, done[-1].by_name) == ("correct", "Nusrat Jahan")
    before = str(done[-1].before)
    assert all(key in before for key in READ[0])
    assert READ[1] in before


def test_the_steps_after_step_1_read_the_corrected_storeys(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    plan = plan_of(s06)

    correct(nusrat, kr01, storeys_body(s06, plan, TYPED, "floor_to_floor"))

    [kept] = [v for v in kept_views(demo, s06["sheet_id"]) if str(v.id) == plan["id"]]
    assert (list(kept.storeys), kept.storeys_meaning, kept.storeys_source) == (
        CORRECTED,
        "floor_to_floor",
        "typed",
    )


def test_confirming_a_corrected_sheet_keeps_the_corrected_storeys(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    plan = plan_of(s06)
    correct(nusrat, kr01, storeys_body(s06, plan, TYPED, "floor_to_floor"))

    confirmed = nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s06["id"]]})

    assert confirmed.status_code == 200, confirmed.content
    after = sheet(nusrat, kr01, "S-06")
    assert after["decision"] == "confirmed"
    assert storeys_of(plan_of(after)) == (CORRECTED, "floor_to_floor")
    [kept] = [v for v in kept_views(demo, s06["sheet_id"]) if str(v.id) == plan["id"]]
    assert (list(kept.storeys), kept.storeys_meaning) == (CORRECTED, "floor_to_floor")


def test_undo_puts_back_the_storeys_and_meaning_as_read(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    plan = plan_of(s06)
    correct(nusrat, kr01, storeys_body(s06, plan, TYPED, "floor_to_floor"))

    response = nusrat.post(f"{step1(kr01)}/undo", {})

    assert response.status_code == 200, response.content
    after = sheet(nusrat, kr01, "S-06")
    assert storeys_of(plan_of(after)) == READ
    assert plan_of(after)["storeys_source"] == plan["storeys_source"]
    assert (after["decision"], after["corrected"]) == (None, False)
    [kept] = [v for v in kept_views(demo, s06["sheet_id"]) if str(v.id) == plan["id"]]
    assert (list(kept.storeys), kept.storeys_meaning) == READ


def test_undo_after_a_confirmation_takes_back_the_confirmation_then_the_storeys_correction(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    correct(nusrat, kr01, storeys_body(s06, plan_of(s06), TYPED, "floor_to_floor"))
    nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s06["id"]]})

    first = nusrat.post(f"{step1(kr01)}/undo", {})
    middle = sheet(nusrat, kr01, "S-06")
    second = nusrat.post(f"{step1(kr01)}/undo", {})

    assert (first.status_code, second.status_code) == (200, 200), (first.content, second.content)
    assert (middle["decision"], storeys_of(plan_of(middle))) == (None, (CORRECTED, "floor_to_floor"))
    assert storeys_of(plan_of(sheet(nusrat, kr01, "S-06"))) == READ


def test_a_second_storeys_correction_is_undone_to_the_first_not_to_the_reading(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    plan = plan_of(s06)
    correct(nusrat, kr01, storeys_body(s06, plan, TYPED, "floor_to_floor"))
    correct(nusrat, kr01, storeys_body(s06, plan, "8th", "at_floor_level"))

    response = nusrat.post(f"{step1(kr01)}/undo", {})

    assert response.status_code == 200, response.content
    assert storeys_of(plan_of(sheet(nusrat, kr01, "S-06"))) == (CORRECTED, "floor_to_floor")


@pytest.mark.parametrize(
    ("typed", "meaning", "why"),
    [
        pytest.param(
            "3rd, kitchen, 7th", "at_floor_level", "a word naming no storey", id="not-a-storey"
        ),
        pytest.param("kitchen", "at_floor_level", "no storey at all", id="no-storey"),
        pytest.param("6th to 2nd", "floor_to_floor", "a range from above to below", id="from-above-to"),
        pytest.param("", "at_floor_level", "an empty list", id="empty"),
        pytest.param(
            "3rd, 5th, 7th", "at_ceiling_level", "a meaning the toggle does not offer", id="ceiling"
        ),
        pytest.param("3rd, 5th, 7th", "upside_down", "no meaning", id="no-meaning"),
        pytest.param("3rd, " * 400, "at_floor_level", "longer than any title", id="oversized"),
    ],
)
def test_an_invalid_storeys_correction_is_refused_with_a_code_and_writes_nothing(
    demo: Demo, nusrat: Api, kr01: uuid.UUID, typed: str, meaning: str, why: str
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    facts, earlier = view_facts(nusrat, kr01), len(acts(demo, kr01))

    response = correct(nusrat, kr01, storeys_body(s06, plan_of(s06), typed, meaning))

    assert 400 <= response.status_code < 500, (why, response.status_code, response.content)
    assert set(response.json()) == {"code", "params"}, why
    assert view_facts(nusrat, kr01) == facts, why
    assert len(acts(demo, kr01)) == earlier, why


def test_a_view_that_is_not_a_plan_has_no_storeys_to_correct(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    s05 = sheet(nusrat, kr01, "S-05")
    [section] = [v for v in s05["views"] if v["kind"] == "section"]
    facts, earlier = view_facts(nusrat, kr01), len(acts(demo, kr01))

    response = correct(nusrat, kr01, storeys_body(s05, section, TYPED, "floor_to_floor"))

    assert 400 <= response.status_code < 500, response.content
    assert set(response.json()) == {"code", "params"}
    assert view_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier


def test_a_view_of_another_sheet_is_not_corrected_through_this_one(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    other = plan_of(sheet(nusrat, kr01, "S-05"))
    facts, earlier = view_facts(nusrat, kr01), len(acts(demo, kr01))

    response = correct(nusrat, kr01, storeys_body(s06, other, TYPED, "floor_to_floor"))

    assert 400 <= response.status_code < 500, response.content
    assert set(response.json()) == {"code", "params"}
    assert view_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier


def test_a_confirmed_sheets_storeys_are_not_corrected(demo: Demo, nusrat: Api, kr01: uuid.UUID) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s06["id"]]})
    facts, earlier = view_facts(nusrat, kr01), len(acts(demo, kr01))

    response = correct(nusrat, kr01, storeys_body(s06, plan_of(s06), TYPED, "floor_to_floor"))

    assert response.status_code == 409, response.content
    assert set(response.json()) == {"code", "params"}
    assert view_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier


@pytest.mark.parametrize(
    ("email", "role"),
    [("kamal@shapla-homes.example", "md"), ("farhana@padma-builders.example", "guest")],
)
def test_the_md_and_a_guest_are_refused_a_storeys_correction_and_nothing_is_written(
    demo: Demo,
    nusrat: Api,
    kr01: uuid.UUID,
    as_person: Callable[[str, str], Api],
    email: str,
    role: str,
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    facts, earlier = view_facts(nusrat, kr01), len(acts(demo, kr01))

    response = correct(
        as_person(email, "shapla"), kr01, storeys_body(s06, plan_of(s06), TYPED, "floor_to_floor")
    )

    refused = {"code": "platform.auth.not_allowed", "params": {"role": role}}
    assert (response.status_code, response.json()) == (403, refused)
    assert view_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier


def test_another_developers_qs_cannot_correct_the_storeys_of_kr_01(
    demo: Demo, nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api]
) -> None:
    s06 = sheet(nusrat, kr01, "S-06")
    facts, earlier = view_facts(nusrat, kr01), len(acts(demo, kr01))

    tanvir = as_person("tanvir@meghna.example", "meghna")
    response = correct(tanvir, kr01, storeys_body(s06, plan_of(s06), TYPED, "floor_to_floor"))

    assert (response.status_code, response.json()) == (404, NOT_FOUND)
    assert view_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier
