"""S22-FL8 (issue #656): the Correct act on Step 1, through the API. m0-screens 2.2 row E ("Correct the
focused sheet's number, title or storeys, in the inspector", In M0: yes); 6.9 "Corrections (E)": "A
correction leaves the sheet a Proposal"; "Undo (Ctrl Z): undoes the last act (… a correction …)"; 6.12:
the MD and a Guest act on nothing. Tonight's cut (the orchestrator's): a sheet's number and title.

Names chosen by the acceptance writer where no authority gives one (the builder meets them):
- `POST /api/projects/{project_id}/takeoff/step1/correct` takes `{"proposal": id, "number"?: str,
  "title"?: str}` (at least one) and answers 19a's act reply with `act` "correct";
- the act is a Confirmation with `act` "correct" (ConfirmationAct.CORRECT), the old values in `before`;
- a Proposal says it was corrected: `corrected` true (the State column's ", corrected", 6.9);
- the act runs the set's Questions again, so a number another sheet of the Discipline has raises the
  set's `conflict` Question ("Two sheets, one number", 6.7) holding the corrected Proposal.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.platform.services import tenancy
from vextrus.takeoff.models import Confirmation
from vextrus.testing.auth import Api

from ..t19a.step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from ..t19a.step1 import NOT_FOUND, by_number, proposals, step1

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

NEW_TITLE = "Lift core wall details"

type Demo = dict[str, Any]
"""The demo seed's ids by key (`vextrus.seed.demo.Demo`, a layer above takeoff: not imported)."""


def correct(api: Api, project: uuid.UUID, body: dict[str, Any]) -> Any:
    response = api.post(f"{step1(project)}/correct", body)
    kind = response.get("Content-Type", "")
    assert kind.startswith("application/json"), f"no correct route: {response.status_code} {kind}"
    return response


def the(api: Api, project: uuid.UUID, proposal_id: str) -> dict[str, Any]:
    [found] = [p for p in proposals(api, project) if p["id"] == proposal_id]
    return found


def acts(demo: Demo, project: uuid.UUID) -> list[Confirmation]:
    with tenancy.acting_in(demo["developer:shapla"]):
        return list(Confirmation.objects.filter(project_id=project).order_by("at"))


def sheet_facts(api: Api, project: uuid.UUID) -> list[tuple[str, Any, Any, Any]]:
    return sorted((p["id"], p["number"], p["title"], p["decision"]) for p in proposals(api, project))


def test_correcting_a_sheets_number_and_title_shows_them_on_its_proposal(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")

    response = correct(nusrat, kr01, {"proposal": s05["id"], "number": "S-51", "title": NEW_TITLE})

    assert response.status_code == 200, response.content
    assert response.json()["act"] == "correct"
    after = the(nusrat, kr01, s05["id"])
    assert (after["number"], after["title"]) == ("S-51", NEW_TITLE)


def test_a_corrected_sheet_stays_a_proposal_and_says_it_was_corrected(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")

    correct(nusrat, kr01, {"proposal": s05["id"], "title": NEW_TITLE})

    after = the(nusrat, kr01, s05["id"])
    assert (after["decision"], after["corrected"]) == (None, True)


def test_a_correction_is_a_correct_act_with_the_old_number_and_title_in_before(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    earlier = len(acts(demo, kr01))

    correct(nusrat, kr01, {"proposal": s05["id"], "number": "S-51", "title": NEW_TITLE})

    done = acts(demo, kr01)
    assert len(done) == earlier + 1
    assert done[-1].act == "correct"
    assert "S-05" in str(done[-1].before)
    assert s05["title"] in str(done[-1].before)


def test_undo_puts_back_the_number_and_title_a_correction_changed(nusrat: Api, kr01: uuid.UUID) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    correct(nusrat, kr01, {"proposal": s05["id"], "number": "S-51", "title": NEW_TITLE})

    response = nusrat.post(f"{step1(kr01)}/undo", {})

    assert response.status_code == 200, response.content
    after = the(nusrat, kr01, s05["id"])
    assert (after["number"], after["title"], after["decision"]) == ("S-05", s05["title"], None)


def test_a_number_another_sheet_of_the_discipline_has_raises_the_conflict_question(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    listed = proposals(nusrat, kr01)
    [s05] = by_number(listed, "S-05")
    [s06] = by_number(listed, "S-06")
    assert s05["discipline"] == s06["discipline"]

    response = correct(nusrat, kr01, {"proposal": s05["id"], "number": "S-06"})

    assert response.status_code == 200, response.content
    questions = nusrat.get(f"{step1(kr01)}/questions").json()["questions"]
    raised = [
        q
        for q in questions
        if q["kind"] == "conflict" and q["status"] == "open" and s05["id"] in map(str, q["proposals"])
    ]
    assert len(raised) == 1, questions


@pytest.mark.parametrize(
    ("email", "role"),
    [("kamal@shapla-homes.example", "md"), ("farhana@padma-builders.example", "guest")],
)
def test_the_md_and_a_guest_are_refused_a_correction_and_nothing_is_written(
    demo: Demo,
    nusrat: Api,
    kr01: uuid.UUID,
    as_person: Callable[[str, str], Api],
    email: str,
    role: str,
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    facts, earlier = sheet_facts(nusrat, kr01), len(acts(demo, kr01))

    response = correct(as_person(email, "shapla"), kr01, {"proposal": s05["id"], "number": "S-51"})

    refused = {"code": "platform.auth.not_allowed", "params": {"role": role}}
    assert (response.status_code, response.json()) == (403, refused)
    assert sheet_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier


def test_another_developers_qs_cannot_correct_a_sheet_of_kr_01(
    demo: Demo, nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api]
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    facts, earlier = sheet_facts(nusrat, kr01), len(acts(demo, kr01))

    tanvir = as_person("tanvir@meghna.example", "meghna")

    response = correct(tanvir, kr01, {"proposal": s05["id"], "number": "S-51"})

    assert (response.status_code, response.json()) == (404, NOT_FOUND)
    assert sheet_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier


def test_a_correction_naming_no_proposal_of_the_project_is_the_one_404_and_writes_nothing(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    facts, earlier = sheet_facts(nusrat, kr01), len(acts(demo, kr01))

    response = correct(nusrat, kr01, {"proposal": str(uuid.uuid4()), "number": "S-51"})

    assert (response.status_code, response.json()) == (404, NOT_FOUND)
    assert sheet_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier


def test_a_correction_with_neither_number_nor_title_is_refused_with_a_code_and_writes_nothing(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    facts, earlier = sheet_facts(nusrat, kr01), len(acts(demo, kr01))

    response = correct(nusrat, kr01, {"proposal": s05["id"]})

    assert 400 <= response.status_code < 500
    assert set(response.json()) == {"code", "params"}
    assert sheet_facts(nusrat, kr01) == facts
    assert len(acts(demo, kr01)) == earlier
