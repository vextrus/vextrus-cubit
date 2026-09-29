"""The confirm service through the API (M0 plan, 19a): "writing a sheet's confirmation, exclusion and
confirmed kind on its printed sheet (14's SheetRevision) and calling 15's `record_override` for each
QS change to Jev's pick"; "exclude with a reason from the seven"; "undo"; "the QS's pasted drawing list
or typed range ("01 to 57", an en dash)" as the register with its source marked"; the ruling:
"A pasted list or typed range comes back parsed … and the QS sees the numbers before confirming"."""

import uuid
from typing import Any

import pytest

from vextrus.drawings import services as drawings
from vextrus.platform.models import JevOverride, User
from vextrus.platform.services import tenancy
from vextrus.seed.demo import Demo
from vextrus.testing.auth import Api

from .step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from .step1 import by_number, proposals, step1

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def printed(demo: Demo, number: str, mark: str | None = None) -> drawings.SheetView:
    with tenancy.acting_in(demo["developer:shapla"]):
        [found] = [
            s
            for s in drawings.sheets(demo["drawing_set:KR-01"])
            if s.number == number and (mark is None or s.revision_mark == mark)
        ]
        return found


def overrides(demo: Demo) -> list[JevOverride]:
    with tenancy.acting_in(demo["developer:shapla"]):
        return list(JevOverride.objects.all())


# Confirm, exclude, undo on the printed sheet --------------------------------------------------------


def test_confirming_a_proposal_writes_the_confirmation_on_its_printed_sheet(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")

    response = nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s05["id"]]})

    assert response.status_code == 200, response.content
    sheet = printed(demo, "S-05")
    assert (sheet.decision, sheet.confirmation_id is not None, sheet.decided_at is not None) == (
        "confirmed",
        True,
        True,
    )
    assert sheet.confirmed_kind


def test_confirming_with_a_kind_writes_that_confirmed_kind(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    kind = s05["jev_pick"]["options"][0] if s05["jev_pick"] else "beam_layout"

    nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s05["id"]], "kind": kind})

    assert printed(demo, "S-05").confirmed_kind == kind


def test_a_bulk_confirmation_stamps_every_sheet_with_one_confirmation(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    listed = proposals(nusrat, kr01)
    chosen = [by_number(listed, n)[0]["id"] for n in ("S-01", "S-02", "S-03")]

    response = nusrat.post(f"{step1(kr01)}/confirm", {"proposals": chosen})

    assert response.status_code == 200, response.content
    sheets = [printed(demo, n) for n in ("S-01", "S-02", "S-03")]
    assert {s.decision for s in sheets} == {"confirmed"}
    assert len({s.confirmation_id for s in sheets}) == 1


@pytest.mark.parametrize(
    "reason",
    ["superseded", "duplicate", "cover_index", "for_information", "by_others", "blank", "other"],
)
def test_excluding_writes_one_of_the_seven_reasons_on_the_printed_sheet(
    demo: Demo, nusrat: Api, kr01: uuid.UUID, reason: str
) -> None:
    [a07] = by_number(proposals(nusrat, kr01), "A-07")

    response = nusrat.post(
        f"{step1(kr01)}/exclude",
        {"proposals": [a07["id"]], "reason": reason, "text": "Presentation only"},
    )

    assert response.status_code == 200, response.content
    sheet = printed(demo, "A-07")
    assert (sheet.decision, sheet.excluded_reason) == ("excluded", reason)


def test_a_reason_not_among_the_seven_is_refused_with_a_code_and_changes_nothing(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    [a07] = by_number(proposals(nusrat, kr01), "A-07")

    response = nusrat.post(
        f"{step1(kr01)}/exclude", {"proposals": [a07["id"]], "reason": "reference_only", "text": ""}
    )

    assert 400 <= response.status_code < 500
    assert set(response.json()) == {"code", "params"}
    assert printed(demo, "A-07").decision is None


def test_undo_takes_back_the_last_act_on_the_printed_sheet(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")
    nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s05["id"]]})

    response = nusrat.post(f"{step1(kr01)}/undo", {})

    assert response.status_code == 200, response.content
    sheet = printed(demo, "S-05")
    assert (sheet.decision, sheet.confirmation_id, sheet.confirmed_kind) == (None, None, None)


def test_a_confirmation_shows_who_confirmed_it(demo: Demo, nusrat: Api, kr01: uuid.UUID) -> None:
    [s05] = by_number(proposals(nusrat, kr01), "S-05")

    nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s05["id"]]})

    [again] = by_number(proposals(nusrat, kr01), "S-05")
    assert "Nusrat Jahan" in str(again)


def test_progress_counts_a_confirmation_in_its_discipline_only(nusrat: Api, kr01: uuid.UUID) -> None:
    [e01] = by_number(proposals(nusrat, kr01), "E-01")

    nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [e01["id"]]})

    body = nusrat.get(f"{step1(kr01)}/progress").json()
    assert [(d["discipline"], d["confirmed"]) for d in body["disciplines"]] == [
        ("structural", 0),
        ("architectural", 0),
        ("electrical", 1),
    ]


# The override log: each QS change to Jev's pick ----------------------------------------------------


def jev_picked(listed: list[dict[str, Any]]) -> dict[str, Any]:
    """A Proposal Jev picked for (the seed carries at least one: m0-screens 6.13, "TypeSafe
    unavailable: no pre-pick where Jev would have been a source", implies the others have one)."""
    picked = [p for p in listed if p["jev_pick"] and len(p["jev_pick"]["options"]) > 1]
    assert picked, "the seed's KR-01 carries no Proposal with Jev's pick"
    return picked[0]


def test_changing_jevs_pick_logs_one_override_under_the_qs(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    proposal = jev_picked(proposals(nusrat, kr01))
    jev_choice = proposal["jev_pick"]["choice"]
    other = next(o for o in proposal["jev_pick"]["options"] if o != jev_choice)

    response = nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [proposal["id"]], "kind": other})

    assert response.status_code == 200, response.content
    [logged] = overrides(demo)
    assert (str(logged.subject_id), logged.jev_choice, logged.qs_choice) == (
        proposal["id"],
        jev_choice,
        other,
    )
    assert logged.user_id == User.objects.get(email="nusrat@shapla-homes.example").pk


def test_confirming_jevs_own_pick_logs_no_override(demo: Demo, nusrat: Api, kr01: uuid.UUID) -> None:
    proposal = jev_picked(proposals(nusrat, kr01))

    response = nusrat.post(
        f"{step1(kr01)}/confirm",
        {"proposals": [proposal["id"]], "kind": proposal["jev_pick"]["choice"]},
    )

    assert response.status_code == 200, response.content
    assert overrides(demo) == []


def test_each_change_to_jevs_pick_is_logged_again(demo: Demo, nusrat: Api, kr01: uuid.UUID) -> None:
    proposal = jev_picked(proposals(nusrat, kr01))
    jev_choice = proposal["jev_pick"]["choice"]
    other = next(o for o in proposal["jev_pick"]["options"] if o != jev_choice)

    nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [proposal["id"]], "kind": other})
    nusrat.post(f"{step1(kr01)}/undo", {})
    nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [proposal["id"]], "kind": other})

    assert [o.qs_choice for o in overrides(demo)] == [other, other]


# The drawing list: parsed back first, then set as the register --------------------------------------


def test_a_typed_range_comes_back_parsed_and_is_not_yet_the_register(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    response = nusrat.post(
        f"{step1(kr01)}/drawing-list/read", {"discipline": "architectural", "text": "A-01\u2013A-07"}
    )

    body = response.json()
    assert response.status_code == 200, response.content
    assert body["source"] == "typed"
    assert body["numbers"] == ["A-01", "A-02", "A-03", "A-04", "A-05", "A-06", "A-07"]
    held = nusrat.get(f"{step1(kr01)}/drawing-list", discipline="architectural")
    assert held.status_code == 200
    assert held.json()["numbers"] == []


def test_a_pasted_list_comes_back_parsed_with_the_lines_it_ignored(nusrat: Api, kr01: uuid.UUID) -> None:
    text = "Transmittal 12\nA-01 SITE PLAN\nA-02 GROUND FLOOR PLAN\n"

    response = nusrat.post(
        f"{step1(kr01)}/drawing-list/read", {"discipline": "architectural", "text": text}
    )

    body = response.json()
    assert response.status_code == 200, response.content
    assert (body["source"], body["numbers"], body["ignored"]) == ("pasted", ["A-01", "A-02"], 1)


def test_setting_the_drawing_list_stores_it_with_its_source_and_who(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    response = nusrat.post(
        f"{step1(kr01)}/drawing-list", {"discipline": "architectural", "text": "A-01\u2013A-07"}
    )

    assert response.status_code == 200, response.content
    held = nusrat.get(f"{step1(kr01)}/drawing-list", discipline="architectural").json()
    assert (held["source"], len(held["numbers"])) == ("typed", 7)
    assert "Nusrat Jahan" in str(held)


def test_a_drawing_list_with_no_sheet_line_is_refused_with_its_code(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    for path in ("drawing-list/read", "drawing-list"):
        response = nusrat.post(
            f"{step1(kr01)}/{path}", {"discipline": "architectural", "text": "no numbers here"}
        )
        assert (response.status_code, response.json()) == (
            400,
            {"code": "engine.register_check.nothing_found", "params": {}},
        ), path


def test_undo_takes_back_a_drawing_list(nusrat: Api, kr01: uuid.UUID) -> None:
    nusrat.post(f"{step1(kr01)}/drawing-list", {"discipline": "architectural", "text": "A-01\u2013A-07"})

    nusrat.post(f"{step1(kr01)}/undo", {})

    held = nusrat.get(f"{step1(kr01)}/drawing-list", discipline="architectural").json()
    assert held["numbers"] == []
