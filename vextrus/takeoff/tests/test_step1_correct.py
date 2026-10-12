"""S22-FL8's Correct act at its edges (the acceptance tests in ts22fl8 pin its promise): a sheet with no
number is numbered and its undo takes the number away again; a confirmed sheet is not corrected; a title
over two lines or past its length is refused; the conflict a corrected number raised is retired by its
undo; a value changed again since the correction is left as it stands by its undo."""

import uuid
from typing import Any

import pytest
from django.db import connection

from vextrus.drawings.services.corrections import TITLE_LENGTH
from vextrus.platform.services import tenancy
from vextrus.takeoff.models import Confirmation
from vextrus.takeoff.tests.acceptance.t19a.step1 import *  # noqa: F403 (its fixtures, by name)
from vextrus.takeoff.tests.acceptance.t19a.step1 import by_number, proposals, step1
from vextrus.testing.auth import Api, api_as
from vextrus.testing.tenancy import Member

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
    cause = (
        "empty"
        if not text.strip()
        else "many_lines"
        if "\n" in text
        else "drawing_code"
        if "{\\" in text or "%%" in text
        else "too_long"
        if len(text) > TITLE_LENGTH or (field == "number" and len(text) > 64)
        else "unreadable"
    )
    assert response.json() == {"code": f"drawings.sheets.{field}_{cause}", "params": {}}
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


MOVED_ON = {"code": "takeoff.step1.correction_moved_on", "params": {}}


def test_a_correction_is_not_undone_once_another_correction_stands_after_it(
    nusrat: Api, kr01: uuid.UUID, as_person: Any
) -> None:
    # Review 3 of #680: undo takes back only the sheet's latest standing correction.
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    assert correct(nusrat, kr01, {"proposal": s05["id"], "title": "First"}).status_code == 200
    arif = as_person("arif@vextrus.example", "shapla")
    second = correct(arif, kr01, {"proposal": s05["id"], "title": "Second"})
    assert second.status_code == 200, second.content

    refused = nusrat.post(f"{step1(kr01)}/undo", {})

    assert (refused.status_code, refused.json()) == (409, MOVED_ON)
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


def second_qs(demo: Any, sign_in: Any, kr01: uuid.UUID) -> Api:
    """Another QS of the Developer on the Project (the Engineer's part in a two-person sequence)."""
    member: Member = sign_in(role="qs", developer_id=demo["developer:shapla"], projects=[kr01])
    return api_as(member)


def test_a_correction_undone_after_the_exclusion_it_followed_was_undone_asks_the_question_open(
    demo: Any, nusrat: Api, kr01: uuid.UUID, sign_in: Any
) -> None:
    # Review 2 of #680 (60/55): the Question was put back "withdrawn" by an exclusion no longer
    # standing, so the numberless sheet confirmed (200).
    other = second_qs(demo, sign_in, kr01)
    [sheet] = by_number(proposals(nusrat, kr01), None)
    path = step1(kr01)
    assert (
        other.post(f"{path}/exclude", {"proposals": [sheet["id"]], "reason": "superseded"}).status_code
        == 200
    )
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-92"}).status_code == 200
    undo(other, kr01)  # their exclusion is taken back: the sheet is a Proposal again
    undo(nusrat, kr01)  # the correction is taken back: no number again

    after = the(nusrat, kr01, sheet["id"])
    assert (after["number"], after["decision"]) == (None, None)
    assert missing_question(nusrat, kr01, sheet["sheet_id"]) == ["open"]
    confirmed = nusrat.post(f"{path}/confirm", {"proposals": [sheet["id"]]})
    assert confirmed.status_code == 409, confirmed.content


def test_a_correction_undone_while_the_exclusion_stands_keeps_the_question_withdrawn(
    demo: Any, nusrat: Api, kr01: uuid.UUID, sign_in: Any
) -> None:
    other = second_qs(demo, sign_in, kr01)
    [sheet] = by_number(proposals(nusrat, kr01), None)
    path = step1(kr01)
    assert (
        other.post(f"{path}/exclude", {"proposals": [sheet["id"]], "reason": "superseded"}).status_code
        == 200
    )
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-92"}).status_code == 200

    undo(nusrat, kr01)

    assert missing_question(nusrat, kr01, sheet["sheet_id"]) == ["withdrawn"]
    # Their exclusion stands, so it still holds the Question: undoing it asks the number again.
    undo(other, kr01)
    assert missing_question(nusrat, kr01, sheet["sheet_id"]) == ["open"]


def alike(demo: Any, sheet: dict[str, Any]) -> None:
    """Its Plot page reads its title as well as its number (a second source, #229)."""
    with tenancy.acting_in(demo["developer:shapla"]), connection.cursor() as cursor:
        cursor.execute(
            "update drawings_sheetrevision set plot_title_alike = true"
            " where id = %s and plot_page is not null",
            [sheet["sheet_id"]],
        )
        assert cursor.rowcount == 1


def test_correcting_a_title_clears_the_plot_page_that_read_the_old_title(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    # Review 2 of #680 (50): as `record_sheets` does on any title change (#229).
    [sheet] = by_number(proposals(nusrat, kr01), "S-05")
    alike(demo, sheet)
    assert the(nusrat, kr01, sheet["id"])["plot_title_alike"] is True

    assert correct(nusrat, kr01, {"proposal": sheet["id"], "title": "Another title"}).status_code == 200

    assert the(nusrat, kr01, sheet["id"])["plot_title_alike"] is False


def test_correcting_a_number_clears_the_plot_page_that_read_the_old_numbers_title(
    demo: Any, nusrat: Api, kr01: uuid.UUID
) -> None:
    [sheet] = by_number(proposals(nusrat, kr01), "S-05")
    alike(demo, sheet)

    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "S-55"}).status_code == 200

    assert the(nusrat, kr01, sheet["id"])["plot_title_alike"] is False


def sources_of(api: Api, project: uuid.UUID, proposal_id: str) -> tuple[Any, Any]:
    found = the(api, project, proposal_id)
    return found["number_source"], found["title_source"]


def test_a_corrected_value_is_sourced_to_the_correction_so_the_sheet_does_not_agree(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # Review 3 of #680 (60): m0-screens 5, a sheet agrees only on values read from its title block.
    [sheet] = by_number(proposals(nusrat, kr01), "S-05")
    first = sources_of(nusrat, kr01, sheet["id"])
    assert the(nusrat, kr01, sheet["id"])["agrees"] is True

    assert correct(nusrat, kr01, {"proposal": sheet["id"], "title": "Another title"}).status_code == 200

    after = the(nusrat, kr01, sheet["id"])
    assert (after["title_source"], after["agrees"]) == ("typed", False)
    assert after["number_source"] == first[0]
    undo(nusrat, kr01)
    back = the(nusrat, kr01, sheet["id"])
    assert (back["title_source"], back["agrees"]) == (first[1], True)


def test_two_people_correcting_one_sheet_undo_only_the_latest_each_time(
    demo: Any, nusrat: Api, kr01: uuid.UUID, sign_in: Any
) -> None:
    # Reviews 2 and 3 of #680: A corrects, B corrects; A's undo is refused (B's number would be
    # overwritten); B's takes the sheet back to A's number; then A's takes it back to the reading.
    other = second_qs(demo, sign_in, kr01)
    [sheet] = by_number(proposals(nusrat, kr01), None)
    was = the(nusrat, kr01, sheet["id"])
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-93"}).status_code == 200
    assert correct(other, kr01, {"proposal": sheet["id"], "number": "A-94"}).status_code == 200

    refused = nusrat.post(f"{step1(kr01)}/undo", {})
    assert (refused.status_code, refused.json()) == (409, MOVED_ON)
    assert the(nusrat, kr01, sheet["id"])["number"] == "A-94"

    undo(other, kr01)
    mid = the(nusrat, kr01, sheet["id"])
    assert (mid["number"], mid["corrected"], mid["number_source"]) == ("A-93", True, "typed")
    assert missing_question(nusrat, kr01, sheet["sheet_id"]) == ["answered"]

    undo(nusrat, kr01)
    after = the(nusrat, kr01, sheet["id"])
    assert (after["number"], after["corrected"], after["number_source"]) == (
        None,
        False,
        was["number_source"],
    )
    assert missing_question(nusrat, kr01, sheet["sheet_id"]) == ["open"]


def test_a_number_typed_through_the_question_since_is_not_undone_by_an_older_correction(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # Review 3 of #680 (70): the correction's undo restored the oldest `before` over a typed number.
    [sheet] = by_number(proposals(nusrat, kr01), None)
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-93"}).status_code == 200
    undo(nusrat, kr01)  # the Question asks again
    [question] = [
        q
        for q in nusrat.get(f"{step1(kr01)}/questions").json()["questions"]
        if q["kind"] == "missing" and str(q["subject_id"]) == sheet["sheet_id"]
    ]
    typed = nusrat.post(
        f"{step1(kr01)}/questions/{question['id']}/answer", {"option": "type_number", "text": "A-96"}
    )
    assert typed.status_code == 200, typed.content

    refused = nusrat.post(f"{step1(kr01)}/undo", {})

    assert refused.status_code == 409  # an answer has no undo, nor anything before it
    assert the(nusrat, kr01, sheet["id"])["number"] == "A-96"


def test_a_keep_open_answer_given_after_an_undone_correction_is_kept_by_the_next_ones_undo(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # Review 3 of #680 (52, 50): the Question's answer comes from the undone correction's own
    # snapshot only, never an older one.
    [sheet] = by_number(proposals(nusrat, kr01), None)
    path = step1(kr01)

    def question() -> dict[str, Any]:
        listed = nusrat.get(f"{path}/questions").json()["questions"]
        [found] = [
            q for q in listed if q["kind"] == "missing" and str(q["subject_id"]) == sheet["sheet_id"]
        ]
        found: dict[str, Any]
        return found

    first_id = question()["id"]
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-93"}).status_code == 200
    undo(nusrat, kr01)
    kept = nusrat.post(f"{path}/questions/{first_id}/answer", {"option": "keep_open"})
    assert kept.status_code == 200, kept.content
    given = (question()["status"], question().get("answer"))
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-97"}).status_code == 200

    undo(nusrat, kr01)

    assert (question()["status"], question().get("answer")) == given


def test_undoing_a_correction_keeps_a_keep_open_answer_given_before_it(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # Review 3 of #680 (50): the undo erased the answer, as an exclusion's undo does not.
    [sheet] = by_number(proposals(nusrat, kr01), None)
    [question] = [
        q
        for q in nusrat.get(f"{step1(kr01)}/questions").json()["questions"]
        if q["kind"] == "missing" and str(q["subject_id"]) == sheet["sheet_id"]
    ]
    kept = nusrat.post(f"{step1(kr01)}/questions/{question['id']}/answer", {"option": "keep_open"})
    assert kept.status_code == 200, kept.content

    def answer_of() -> Any:
        listed = nusrat.get(f"{step1(kr01)}/questions").json()["questions"]
        [found] = [q for q in listed if q["id"] == question["id"]]
        return found["status"], found.get("answer")

    before = answer_of()
    assert correct(nusrat, kr01, {"proposal": sheet["id"], "number": "A-95"}).status_code == 200
    undo(nusrat, kr01)

    assert answer_of() == before


def test_each_cause_of_an_unkeepable_number_or_title_has_its_own_words(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # Review 3 of #680 (52): one message named every cause, and not the drawing code.
    [sheet] = by_number(proposals(nusrat, kr01), "S-05")

    def refused(**typed: str) -> str:
        response = correct(nusrat, kr01, {"proposal": sheet["id"], **typed})
        assert response.status_code == 400, response.content
        return str(response.json()["code"])

    sheets = "drawings.sheets."
    assert refused(title="   ") == sheets + "title_empty"
    assert refused(title="a" * 501) == sheets + "title_too_long"
    assert refused(title="one\ntwo") == sheets + "title_many_lines"
    assert refused(title="pile %%c20") == sheets + "title_drawing_code"
    assert refused(title="pile\x07") == sheets + "title_unreadable"
    assert refused(number="S-%%c1") == sheets + "number_drawing_code"
    assert refused(number="S" * 200) == sheets + "number_too_long"
    assert refused(number="S-1\nS-2") == sheets + "number_many_lines"
    assert refused(number="S-\x071") == sheets + "number_unreadable"
