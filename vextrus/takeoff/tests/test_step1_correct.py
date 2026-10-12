"""S22-FL8's Correct act at its edges (the acceptance tests in ts22fl8 pin its promise): a sheet with no
number is numbered and its undo takes the number away again; a confirmed sheet is not corrected; a title
over two lines or past its length is refused; the conflict a corrected number raised is retired by its
undo; a value changed again since the correction is left as it stands by its undo."""

import uuid
from typing import Any

import pytest

from vextrus.drawings.services.corrections import TITLE_LENGTH
from vextrus.platform.services import tenancy
from vextrus.takeoff.models import Confirmation
from vextrus.takeoff.tests.acceptance.t19a.step1 import *  # noqa: F403 (its fixtures, by name)
from vextrus.takeoff.tests.acceptance.t19a.step1 import by_number, proposals, step1
from vextrus.testing.auth import Api

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def correct(api: Api, project: uuid.UUID, body: dict[str, Any]) -> Any:
    return api.post(f"{step1(project)}/correct", body)


def undo(api: Api, project: uuid.UUID) -> Any:
    response = api.post(f"{step1(project)}/undo", {})
    assert response.status_code == 200, response.content
    return response


def the(api: Api, project: uuid.UUID, proposal_id: str) -> dict[str, Any]:
    [found] = [p for p in proposals(api, project) if p["id"] == proposal_id]
    return found


def facts(api: Api, project: uuid.UUID) -> list[tuple[Any, ...]]:
    return sorted(
        (p["id"], p["number"], p["title"], p["decision"], p["corrected"])
        for p in proposals(api, project)
    )


def confirmations(demo: Any, project: uuid.UUID) -> list[Confirmation]:
    with tenancy.acting_in(demo["developer:shapla"]):
        return list(Confirmation.objects.filter(project_id=project))


def conflicts_holding(api: Api, project: uuid.UUID, proposal_id: str) -> list[dict[str, Any]]:
    listed = api.get(f"{step1(project)}/questions").json()["questions"]
    return [
        q
        for q in listed
        if q["kind"] == "conflict" and q["status"] == "open" and proposal_id in map(str, q["proposals"])
    ]


def test_a_sheet_with_no_number_is_numbered_and_its_undo_takes_the_number_away(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    unnumbered = by_number(proposals(nusrat, kr01), None)
    if not unnumbered:
        pytest.skip("the seed's KR-01 has no sheet without a number")
    sheet = unnumbered[0]

    response = correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-90"})

    assert response.status_code == 200, response.content
    assert the(nusrat, kr01, sheet["id"])["number"] == "A-90"
    undo(nusrat, kr01)
    after = the(nusrat, kr01, sheet["id"])
    assert (after["number"], after["title"], after["corrected"]) == (None, sheet["title"], False)


def test_a_confirmed_sheet_is_refused_and_nothing_is_written(nusrat: Api, kr01: uuid.UUID) -> None:
    [s01] = by_number(proposals(nusrat, kr01), "S-01")
    confirmed = nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s01["id"]]})
    assert confirmed.status_code == 200, confirmed.content
    before = facts(nusrat, kr01)

    response = correct(nusrat, kr01, {"proposal": s01["id"], "title": "Another title"})

    assert response.status_code == 409
    assert response.json() == {"code": "takeoff.step1.confirmed_not_corrected", "params": {}}
    assert facts(nusrat, kr01) == before


UNKEEPABLE = ["Two\nlines", "  ", "A {\\fArial|b0;bold} code", "a\x00b", "a\ud800b", "a‮b"]
"""Typed text no title block prints (the refuter of S22-FL8: a NUL or a lone surrogate reached the
act's jsonb before it was checked, a 500)."""


@pytest.mark.parametrize("field", ["number", "title"])
@pytest.mark.parametrize("text", [*UNKEEPABLE, "x" * (TITLE_LENGTH + 1)])
def test_typed_text_that_cannot_be_kept_is_refused_with_a_code_and_nothing_is_written(
    demo: Any, nusrat: Api, kr01: uuid.UUID, field: str, text: str
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    before, acts = facts(nusrat, kr01), len(confirmations(demo, kr01))

    response = correct(nusrat, kr01, {"proposal": s05["id"], field: text})

    assert response.status_code == 400, response.content
    assert response.json() == {"code": f"drawings.sheets.{field}_unreadable", "params": {}}
    assert facts(nusrat, kr01) == before
    assert len(confirmations(demo, kr01)) == acts


def test_a_confirmed_sheet_corrects_once_excluded_then_confirms_back_in(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # The way round for a sheet another person confirmed (the words gate of S22-FL8).
    [s01] = by_number(proposals(nusrat, kr01), "S-01")
    path = step1(kr01)
    assert nusrat.post(f"{path}/confirm", {"proposals": [s01["id"]]}).status_code == 200
    out = nusrat.post(f"{path}/exclude", {"proposals": [s01["id"]], "reason": "superseded"})
    assert out.status_code == 200, out.content

    assert correct(nusrat, kr01, {"proposal": s01["id"], "title": "Renamed"}).status_code == 200
    back = nusrat.post(f"{path}/confirm", {"proposals": [s01["id"]]})

    assert back.status_code == 200, back.content
    after = the(nusrat, kr01, s01["id"])
    assert (after["title"], after["decision"], after["corrected"]) == ("Renamed", "confirmed", True)


def test_the_same_number_and_title_again_is_nothing_to_correct(nusrat: Api, kr01: uuid.UUID) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")

    response = correct(nusrat, kr01, {"proposal": s05["id"], "number": " S-05 ", "title": s05["title"]})

    assert response.status_code == 400
    assert response.json() == {"code": "takeoff.step1.nothing_to_correct", "params": {}}


def test_undoing_a_correction_retires_the_conflict_its_number_raised(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    assert correct(nusrat, kr01, {"proposal": s05["id"], "number": "S-06"}).status_code == 200
    assert len(conflicts_holding(nusrat, kr01, s05["id"])) == 1

    undo(nusrat, kr01)

    assert the(nusrat, kr01, s05["id"])["number"] == "S-05"
    assert conflicts_holding(nusrat, kr01, s05["id"]) == []


def test_a_title_changed_again_since_is_left_by_the_first_corrections_undo(
    nusrat: Api, kr01: uuid.UUID, as_person: Any
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    assert correct(nusrat, kr01, {"proposal": s05["id"], "title": "First"}).status_code == 200
    # The Vextrus Engineer corrects it again: the QS's undo takes back only the QS's own act.
    arif = as_person("arif@vextrus.example", "shapla")
    second = correct(arif, kr01, {"proposal": s05["id"], "title": "Second"})
    assert second.status_code == 200, second.content

    undo(nusrat, kr01)

    after = the(nusrat, kr01, s05["id"])
    assert (after["title"], after["corrected"]) == ("Second", True)


def missing_question(api: Api, project: uuid.UUID, sheet_id: str) -> list[str]:
    listed = api.get(f"{step1(project)}/questions").json()["questions"]
    return [q["status"] for q in listed if q["kind"] == "missing" and str(q["subject_id"]) == sheet_id]


def test_a_number_given_by_e_answers_the_sheets_missing_question_so_it_confirms(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # Review 1 of #680 (75): the numbered sheet's confirmation was refused as `question_first`.
    [sheet] = by_number(proposals(nusrat, kr01), None)
    assert missing_question(nusrat, kr01, sheet["sheet_id"]) == ["open"]

    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-90"}).status_code == 200
    assert missing_question(nusrat, kr01, sheet["sheet_id"]) == ["answered"]
    confirmed = nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [sheet["id"]]})

    assert confirmed.status_code == 200, confirmed.content


def test_undoing_the_number_asks_the_missing_question_again(nusrat: Api, kr01: uuid.UUID) -> None:
    [sheet] = by_number(proposals(nusrat, kr01), None)
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-90"}).status_code == 200

    undo(nusrat, kr01)

    assert the(nusrat, kr01, sheet["id"])["number"] is None
    assert missing_question(nusrat, kr01, sheet["sheet_id"]) == ["open"]


def test_an_excluded_sheet_numbered_by_e_confirms_back_in(nusrat: Api, kr01: uuid.UUID) -> None:
    [sheet] = by_number(proposals(nusrat, kr01), None)
    path = step1(kr01)
    out = nusrat.post(f"{path}/exclude", {"proposals": [sheet["id"]], "reason": "superseded"})
    assert out.status_code == 200, out.content
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-91"}).status_code == 200

    back = nusrat.post(f"{path}/confirm", {"proposals": [sheet["id"]]})

    assert back.status_code == 200, back.content


def test_a_bangla_title_holding_a_joiner_or_a_soft_hyphen_is_kept(nusrat: Api, kr01: uuid.UUID) -> None:
    # Review 1 of #680 (50): ra + ZWJ + virama + ya ("ramp"), and a soft hyphen, are a title's own.
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    title = "র‍্যাম্প ক্­ষ"

    response = correct(nusrat, kr01, {"proposal": s05["id"], "title": title})

    assert response.status_code == 200, response.content
    assert the(nusrat, kr01, s05["id"])["title"] == title


def step1_events(md: Api, project: uuid.UUID) -> list[tuple[str, Any, Any]]:
    """Step 1's acts of the Project as the MD reads them (the activity list), oldest first:
    (code, subject, actor)."""
    seen = md.get("/api/activity", project=str(project), limit=200)
    assert seen.status_code == 200, seen.content
    acts = [a for a in seen.json() if a["code"].startswith("takeoff.step1.")]
    return [(a["code"], a["subject_id"], (a["actor"] or {}).get("id")) for a in reversed(acts)]


def test_a_correction_records_one_corrected_event_and_its_undo_an_undone_one(
    demo: Any, nusrat: Api, kr01: uuid.UUID, as_person: Any
) -> None:
    # S22-FL10's event log (#681): a correction is a Step 1 act like the others.
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    kamal = as_person("kamal@shapla-homes.example", "shapla")
    earlier = len(step1_events(kamal, kr01))

    assert correct(nusrat, kr01, {"proposal": s05["id"], "title": "Renamed"}).status_code == 200
    refused = correct(nusrat, kr01, {"proposal": s05["id"], "title": "Renamed"})
    assert refused.status_code == 400  # nothing to correct: no event
    undo(nusrat, kr01)

    [act] = [c for c in confirmations(demo, kr01) if c.act == "correct"]
    added = step1_events(kamal, kr01)[earlier:]
    assert [(code, subject) for code, subject, _who in added] == [
        ("takeoff.step1.corrected", str(act.id)),
        ("takeoff.step1.undone", str(act.id)),
    ]
    assert {who for _code, _subject, who in added} == {str(act.user_id)}
