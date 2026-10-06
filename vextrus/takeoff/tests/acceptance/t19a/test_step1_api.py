"""Step 1's API (M0 plan, 19a): "the Step 1 API (proposals in natural sheet-number order with revision
mark …; Questions; …; Coverage; progress); cross-tenant and Project-scope API tests"; "the MD and a
Guest refused by role through 07's decorator, and every act checked against the Project scope"."""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.drawings import services as drawings
from vextrus.platform.services import tenancy
from vextrus.seed.demo import Demo
from vextrus.testing.auth import Api

from .step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from .step1 import NOT_FOUND, proposals, step1

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

READS = ("proposals", "questions", "coverage", "progress", "drawing-list?discipline=architectural")


def acts(first: str) -> list[tuple[str, dict[str, Any]]]:
    return [
        ("confirm", {"proposals": [first]}),
        ("exclude", {"proposals": [first], "reason": "other", "text": "Not needed"}),
        ("undo", {}),
        ("drawing-list/read", {"discipline": "architectural", "text": "A-01\u2013A-07"}),
        ("drawing-list", {"discipline": "architectural", "text": "A-01\u2013A-07"}),
    ]


def decisions(demo: Demo) -> list[str | None]:
    with tenancy.acting_in(demo["developer:shapla"]):
        return [s.decision for s in drawings.sheets(demo["drawing_set:KR-01"])]


# The shapes -------------------------------------------------------------------------------------


def test_the_proposals_are_kr_01s_24_sheets_by_discipline_in_natural_number_order(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    listed = proposals(nusrat, kr01)

    def numbers(discipline: str) -> list[str | None]:
        return [p["number"] for p in listed if p["discipline"] == discipline]

    assert [p["discipline"] for p in listed] == ["structural"] * 13 + ["architectural"] * 8 + [
        "electrical"
    ] * 3
    assert numbers("structural") == [
        "S-01", "S-02", "S-03", "S-04", "S-05", "S-06", "S-07", "S-07", "S-08", "S-09", "S-10",
        "S-11", "S-12",
    ]  # fmt: skip
    assert numbers("architectural") == [
        "A-01", "A-02", "A-03", "A-04", "A-05", "A-06", "A-07", None,
    ]  # fmt: skip
    assert numbers("electrical") == ["E-01", "E-02", "E-03"]
    assert sorted(p["revision_mark"] for p in listed if p["number"] == "S-07") == ["A", "B"]
    assert all({"id", "number", "revision_mark", "discipline", "jev_pick"} <= set(p) for p in listed)


def test_the_seed_has_five_open_questions_the_held_file_first(nusrat: Api, kr01: uuid.UUID) -> None:
    response = nusrat.get(f"{step1(kr01)}/questions")

    body = response.json()
    assert response.status_code == 200
    assert len(body["questions"]) == 5
    assert body["questions"][0]["kind"] == "file_misread"


def test_coverage_on_the_seed_is_70_views_70_proposed_0_unaccounted(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # m0-screens §7: "Coverage 70 views: 0 assigned, 0 excluded, ..."; used 0. Amended for S15-E5
    # (#549, #316; the owner's ruling of 5 Oct 2026, "notes to General notes"): S-01, the seed's
    # general-notes sheet, has its drawing list and its hook and bend detail proposed to Step 2, so
    # the 2 once unaccounted are proposed: 70 proposed, 0 unaccounted.
    response = nusrat.get(f"{step1(kr01)}/coverage")

    assert response.status_code == 200
    counts = ("views", "assigned", "excluded", "proposed", "unaccounted", "used")
    assert {k: response.json()[k] for k in counts} == {
        "views": 70, "assigned": 0, "excluded": 0, "proposed": 70, "unaccounted": 0, "used": 0,
    }  # fmt: skip


def test_progress_is_per_discipline_with_those_not_yet_received(nusrat: Api, kr01: uuid.UUID) -> None:
    # m0-screens §7: "Disciplines not yet received: Plumbing and sanitary · Fire (…) · Lift".
    response = nusrat.get(f"{step1(kr01)}/progress")

    body = response.json()
    assert response.status_code == 200
    assert [(d["discipline"], d["confirmed"], d["found"]) for d in body["disciplines"]] == [
        ("structural", 0, 13),
        ("architectural", 0, 8),
        ("electrical", 0, 3),
    ]
    assert body["not_received"] == ["plumbing", "fire", "lift"]


# Who may do what --------------------------------------------------------------------------------


def test_signed_out_is_refused_with_a_body(demo: Demo, kr01: uuid.UUID) -> None:
    for path in READS:
        response = Api().get(f"{step1(kr01)}/{path}")
        assert (response.status_code, response.json()) == (
            401,
            {"code": "platform.auth.signed_out", "params": {}},
        ), path


def test_an_act_without_the_csrf_token_is_refused_and_changes_nothing(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    first = proposals(nusrat, kr01)[0]["id"]
    before = decisions(demo)

    for path, body in acts(first):
        response = nusrat.post(f"{step1(kr01)}/{path}", body, csrf=False)
        assert response.status_code == 403, path
    assert decisions(demo) == before


@pytest.mark.parametrize(
    ("email", "role"),
    [("kamal@shapla-homes.example", "md"), ("farhana@padma-builders.example", "guest")],
)
def test_the_md_and_a_guest_read_step_1_but_every_act_is_refused(
    demo: Demo, nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api], email: str, role: str
) -> None:
    looker = as_person(email, "shapla")
    first = proposals(nusrat, kr01)[0]["id"]
    before = decisions(demo)

    for path in READS:
        assert looker.get(f"{step1(kr01)}/{path}").status_code == 200, path
    refused = {"code": "platform.auth.not_allowed", "params": {"role": role}}
    for path, body in acts(first):
        response = looker.post(f"{step1(kr01)}/{path}", body)
        assert (response.status_code, response.json()) == (403, refused), path
    assert decisions(demo) == before


def test_another_developers_qs_finds_nothing_of_kr_01(
    demo: Demo, nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api]
) -> None:
    tanvir = as_person("tanvir@meghna.example", "meghna")
    first = proposals(nusrat, kr01)[0]["id"]
    before = decisions(demo)

    for path in READS:
        response = tanvir.get(f"{step1(kr01)}/{path}")
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path
    for path, body in acts(first):
        response = tanvir.post(f"{step1(kr01)}/{path}", body)
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path
    assert decisions(demo) == before


def test_a_proposal_of_another_developer_named_under_ones_own_project_is_not_found(
    demo: Demo, nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api]
) -> None:
    tanvir = as_person("tanvir@meghna.example", "meghna")
    theirs = demo["project:MG-01"]
    first = proposals(nusrat, kr01)[0]["id"]
    before = decisions(demo)

    for path, body in acts(first)[:2]:
        response = tanvir.post(f"{step1(theirs)}/{path}", body)
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path
    assert decisions(demo) == before


def test_a_proposal_of_another_project_is_not_found_under_this_one(
    demo: Demo, nusrat: Api, kr01: uuid.UUID
) -> None:
    other = demo["project:BP-02"]
    first = proposals(nusrat, kr01)[0]["id"]

    for path, body in acts(first)[:2]:
        response = nusrat.post(f"{step1(other)}/{path}", body)
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path
    assert set(decisions(demo)) == {None}


def test_a_guest_given_only_kr_01_finds_no_other_project(
    demo: Demo, as_person: Callable[[str, str], Api]
) -> None:
    farhana = as_person("farhana@padma-builders.example", "shapla")

    for path in READS:
        response = farhana.get(f"{step1(demo['project:BP-02'])}/{path}")
        assert (response.status_code, response.json()) == (404, NOT_FOUND), path


def test_a_random_project_is_not_found(nusrat: Api) -> None:
    response = nusrat.get(f"{step1(uuid.uuid4())}/proposals")

    assert (response.status_code, response.json()) == (404, NOT_FOUND)
