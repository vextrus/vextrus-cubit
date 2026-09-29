"""Step 1's acts by the attacker's every route (ticket 19a): a member of the same Developer undoing
another's act, a list of ids mixing this Project's with another's, an empty act, a Discipline the
Market lacks; and the drawing lists: a list read on a sheet and one the QS gives that disagree leave
N unknown ("—", m0-screens §7) until the QS's list is taken back."""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.drawings import services as drawings
from vextrus.projects import services as projects
from vextrus.takeoff.services import step1
from vextrus.testing.auth import Api, api_as
from vextrus.testing.drawings import add, drawing, read_dwg
from vextrus.testing.takeoff import Step1Project
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def url(project_id: uuid.UUID, path: str) -> str:
    return f"/api/projects/{project_id}/takeoff/step1/{path}"


def decisions(project: Step1Project) -> list[str | None]:
    with project.member.acting():
        return [drawings.sheet(s).decision for s in project.sheets]


def structural(client: Api, project_id: uuid.UUID) -> dict[str, Any]:
    body = client.get(url(project_id, "progress")).json()
    [row] = [d for d in body["disciplines"] if d["discipline"] == "structural"]
    return dict(row)


def test_undo_takes_back_only_ones_own_act(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    qs = api_as(step1_project.member)
    colleague = sign_in(role="qs", developer_id=step1_project.member.developer_id)
    qs.post(url(step1_project.project_id, "confirm"), {"proposals": [str(step1_project.proposals[0])]})

    response = api_as(colleague).post(url(step1_project.project_id, "undo"), {})

    assert (response.status_code, response.json()) == (
        409,
        {"code": "takeoff.step1.nothing_to_undo", "params": {}},
    )
    assert decisions(step1_project) == ["confirmed", None, None]


def test_an_act_naming_no_sheet_is_refused(step1_project: Step1Project) -> None:
    qs = api_as(step1_project.member)

    for path, body in (
        ("confirm", {"proposals": []}),
        ("exclude", {"proposals": [], "reason": "blank", "text": ""}),
    ):
        response = qs.post(url(step1_project.project_id, path), body)
        assert (response.status_code, response.json()) == (
            400,
            {"code": "takeoff.step1.nothing_chosen", "params": {}},
        ), path


def test_ids_mixing_this_project_with_another_change_nothing(step1_project: Step1Project) -> None:
    member = step1_project.member
    with member.acting():
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project")
    theirs = add(member, other.id, "KR-STR-R1.dwg", drawing()).file
    [their_sheet] = read_dwg(member, theirs.id, ["S-01"])
    qs = api_as(member)
    mixed = [str(step1_project.proposals[0]), str(their_sheet.id)]

    for path, body in (
        ("confirm", {"proposals": mixed}),
        ("exclude", {"proposals": mixed, "reason": "blank", "text": ""}),
    ):
        response = qs.post(url(step1_project.project_id, path), body)
        assert (response.status_code, response.json()) == (
            404,
            {"code": "platform.auth.not_found", "params": {}},
        ), path
    assert decisions(step1_project) == [None, None, None]
    with member.acting():
        assert drawings.sheet(their_sheet.id).decision is None


def test_a_discipline_the_market_lacks_is_refused(step1_project: Step1Project) -> None:
    qs = api_as(step1_project.member)
    refused = {"code": "takeoff.step1.discipline_unknown", "params": {}}
    body = {"discipline": "landscape", "text": "L-01 to L-03"}

    for path in ("drawing-list/read", "drawing-list"):
        response = qs.post(url(step1_project.project_id, path), body)
        assert (response.status_code, response.json()) == (400, refused), path
    response = qs.get(url(step1_project.project_id, "drawing-list"), discipline="landscape")
    assert (response.status_code, response.json()) == (400, refused)


def test_other_keeps_the_qss_words_and_a_listed_reason_keeps_none(step1_project: Step1Project) -> None:
    qs = api_as(step1_project.member)
    first, second = (str(p) for p in step1_project.proposals[:2])

    exclude = url(step1_project.project_id, "exclude")
    qs.post(exclude, {"proposals": [first], "reason": "other", "text": "Part of the title block"})
    qs.post(exclude, {"proposals": [second], "reason": "blank", "text": "ignored"})

    with step1_project.member.acting():
        one, two, _three = (drawings.sheet(s) for s in step1_project.sheets)
    assert (one.excluded_reason, one.excluded_text) == ("other", "Part of the title block")
    assert (two.excluded_reason, two.excluded_text) == ("blank", "")


def test_other_without_words_is_refused_and_changes_nothing(step1_project: Step1Project) -> None:
    qs = api_as(step1_project.member)

    response = qs.post(
        url(step1_project.project_id, "exclude"),
        {"proposals": [str(step1_project.proposals[0])], "reason": "other", "text": "  "},
    )

    assert (response.status_code, response.json()["code"]) == (400, "drawings.sheets.other_needs_text")
    assert decisions(step1_project) == [None, None, None]
    with step1_project.member.acting():
        assert qs.post(url(step1_project.project_id, "undo"), {}).status_code == 409


def test_coverage_follows_its_sheet_and_undo_puts_the_proposal_back(step1_project: Step1Project) -> None:
    qs = api_as(step1_project.member)
    before = qs.get(url(step1_project.project_id, "coverage")).json()
    # read_dwg's title blocks carry no proposed exclusion: each view is unaccounted.
    assert (before["views"], before["unaccounted"]) == (3, 3)

    first = str(step1_project.proposals[0])
    qs.post(
        url(step1_project.project_id, "exclude"), {"proposals": [first], "reason": "blank", "text": ""}
    )
    after = qs.get(url(step1_project.project_id, "coverage")).json()
    qs.post(url(step1_project.project_id, "undo"), {})
    undone = qs.get(url(step1_project.project_id, "coverage")).json()

    assert (after["excluded"], after["unaccounted"], after["by_reason"]) == (1, 2, {"blank": 1})
    assert (undone["excluded"], undone["unaccounted"]) == (0, 3)


def test_a_read_list_and_a_pasted_one_that_disagree_leave_n_unknown(step1_project: Step1Project) -> None:
    qs = api_as(step1_project.member)
    project_id = step1_project.project_id
    with step1_project.member.acting():
        step1.record_read_list(
            step1_project.sheets[0],
            "structural",
            [("S-01", "NOTES"), ("S-02", "PLAN"), ("S-03", "PLAN")],
        )
    assert (structural(qs, project_id)["total"], structural(qs, project_id)["listed"]) == (3, 3)

    qs.post(url(project_id, "drawing-list"), {"discipline": "structural", "text": "S-01 to S-04"})

    row = structural(qs, project_id)
    held = qs.get(url(project_id, "drawing-list"), discipline="structural").json()
    assert (row["total"], row["lists_disagree"], row["found"]) == (None, True, 3)
    assert (held["source"], held["numbers"][-1], held["read_numbers"], held["agrees"]) == (
        "typed",
        "S-04",
        ["S-01", "S-02", "S-03"],
        False,
    )

    qs.post(url(project_id, "undo"), {})

    assert (structural(qs, project_id)["total"], structural(qs, project_id)["lists_disagree"]) == (
        3,
        False,
    )


def test_a_list_the_qs_gives_that_agrees_sets_n(step1_project: Step1Project) -> None:
    qs = api_as(step1_project.member)

    body = {"discipline": "structural", "text": "S-01 to S-04"}
    qs.post(url(step1_project.project_id, "drawing-list"), body)

    row = structural(qs, step1_project.project_id)
    assert (row["found"], row["listed"], row["total"], row["confirmed"]) == (3, 4, 4, 0)


def test_every_act_on_a_project_out_of_scope_is_not_found(step1_project: Step1Project) -> None:
    qs = api_as(step1_project.member)
    first = str(step1_project.proposals[0])
    acts = [
        ("confirm", {"proposals": [first]}),
        ("exclude", {"proposals": [first], "reason": "blank", "text": ""}),
        ("undo", {}),
        ("drawing-list/read", {"discipline": "structural", "text": "S-01 to S-03"}),
        ("drawing-list", {"discipline": "structural", "text": "S-01 to S-03"}),
    ]
    qs.post(url(step1_project.project_id, "confirm"), {"proposals": [first]})

    for path, body in acts:
        response = qs.post(url(uuid.uuid4(), path), body)
        assert (response.status_code, response.json()) == (
            404,
            {"code": "platform.auth.not_found", "params": {}},
        ), path
    assert decisions(step1_project) == ["confirmed", None, None]


# Undo puts back what the act overwrote (the refuter's findings, scored 70 and 55) -----------------


def decided(project: Step1Project) -> tuple[str | None, uuid.UUID | None]:
    with project.member.acting():
        sheet = drawings.sheet(project.sheets[0])
    return sheet.decision, sheet.confirmation_id


def test_a_colleagues_undo_puts_back_my_decision(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    mine, first = api_as(step1_project.member), str(step1_project.proposals[0])
    theirs = api_as(sign_in(role="qs", developer_id=step1_project.member.developer_id))
    confirmed = mine.post(url(step1_project.project_id, "confirm"), {"proposals": [first]}).json()
    blank = {"proposals": [first], "reason": "blank", "text": ""}
    theirs.post(url(step1_project.project_id, "exclude"), blank)

    theirs.post(url(step1_project.project_id, "undo"), {})

    assert decided(step1_project) == ("confirmed", uuid.UUID(confirmed["confirmation_id"]))
    listed = mine.get(url(step1_project.project_id, "proposals")).json()["proposals"]
    [item] = [p for p in listed if p["id"] == first]
    assert item["decided_by"] == step1_project.member.user.name
    coverage = mine.get(url(step1_project.project_id, "coverage")).json()
    assert (coverage["excluded"], coverage["unaccounted"]) == (0, 3)


def test_undo_after_changing_ones_mind_puts_back_the_first_decision(step1_project: Step1Project) -> None:
    qs, first = api_as(step1_project.member), str(step1_project.proposals[0])
    confirmed = qs.post(url(step1_project.project_id, "confirm"), {"proposals": [first]}).json()
    duplicate = {"proposals": [first], "reason": "duplicate", "text": ""}
    qs.post(url(step1_project.project_id, "exclude"), duplicate)

    qs.post(url(step1_project.project_id, "undo"), {})
    after_one = decided(step1_project)
    qs.post(url(step1_project.project_id, "undo"), {})
    after_two = decided(step1_project)
    third = qs.post(url(step1_project.project_id, "undo"), {})

    assert after_one == ("confirmed", uuid.UUID(confirmed["confirmation_id"]))
    assert after_two == (None, None)
    assert third.status_code == 409


def test_undo_walks_back_past_an_act_already_undone(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    mine, first = api_as(step1_project.member), str(step1_project.proposals[0])
    theirs = api_as(sign_in(role="qs", developer_id=step1_project.member.developer_id))
    mine.post(url(step1_project.project_id, "confirm"), {"proposals": [first]})
    blank = {"proposals": [first], "reason": "blank", "text": ""}
    theirs.post(url(step1_project.project_id, "exclude"), blank)

    mine.post(url(step1_project.project_id, "undo"), {})  # mine no longer decides the sheet: kept
    kept = decided(step1_project)[0]
    theirs.post(url(step1_project.project_id, "undo"), {})  # back past my undone confirmation

    assert (kept, decided(step1_project)) == ("excluded", (None, None))
