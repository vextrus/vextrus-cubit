"""S24-B1 (#314): a sheet's "Who did what" lists every act on it from the event log, oldest first,
each under its actor's name and role and time; not one decision per sheet. m0-screens 6.6 item 5:
"every act on the sheet, oldest first, each "what" over "name, role, time"": "Excluded: for
information"; "Confirmed back in: … / Tanvir Ahmed, Vextrus Engineer, …". 6.12: the MD and a Guest
see every act ("every act shows who did it"). The seam's names are in `history.py`.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.testing.auth import Api

from ..t19a.step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from ..t19a.step1 import NOT_FOUND, by_number, proposals, step1
from .history import (
    ARIF,
    CONFIRMED,
    CONFIRMED_BACK_IN,
    EXCLUDED,
    UNDONE,
    act,
    codes,
    history,
    history_response,
)

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def sheet(api: Api, project: uuid.UUID, number: str) -> dict[str, Any]:
    [found] = by_number(proposals(api, project), number)
    return found


def test_a_sheet_no_one_has_acted_on_has_no_acts(nusrat: Api, kr01: uuid.UUID) -> None:
    s04 = sheet(nusrat, kr01, "S-04")

    assert history(nusrat, kr01, s04["id"]) == []


def test_an_exclusion_and_its_confirmation_back_in_are_both_listed_oldest_first(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    act(nusrat, kr01, "exclude", {"proposals": [s04["id"]], "reason": "superseded", "text": ""})
    act(nusrat, kr01, "confirm", {"proposals": [s04["id"]]})

    acts = history(nusrat, kr01, s04["id"])

    assert codes(acts) == [EXCLUDED, CONFIRMED_BACK_IN]
    assert [(a["actor"], a["actor_role"]) for a in acts] == [("Nusrat Jahan", "qs")] * 2
    assert acts[0]["reason"] == "superseded"
    assert acts[0]["at"] <= acts[1]["at"]


def test_the_vextrus_engineers_confirmation_back_in_is_under_their_own_name(
    nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api]
) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    act(nusrat, kr01, "exclude", {"proposals": [s04["id"]], "reason": "superseded", "text": ""})
    act(as_person(ARIF, "shapla"), kr01, "confirm", {"proposals": [s04["id"]]})

    acts = history(nusrat, kr01, s04["id"])

    assert [(a["code"], a["actor"], a["actor_role"]) for a in acts] == [
        (EXCLUDED, "Nusrat Jahan", "qs"),
        (CONFIRMED_BACK_IN, "Arif Rahman", "vextrus_engineer"),
    ]


def test_a_bulk_confirmation_says_how_many_sheets_it_decided(nusrat: Api, kr01: uuid.UUID) -> None:
    ids = [sheet(nusrat, kr01, n)["id"] for n in ("S-02", "S-03", "S-04")]
    act(nusrat, kr01, "confirm", {"proposals": ids})

    acts = history(nusrat, kr01, ids[1])

    assert codes(acts) == [CONFIRMED]
    assert acts[0]["sheets"] == 3


def test_an_undone_confirmation_stays_listed_followed_by_its_undo(nusrat: Api, kr01: uuid.UUID) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    act(nusrat, kr01, "confirm", {"proposals": [s04["id"]]})
    act(nusrat, kr01, "undo", {})

    acts = history(nusrat, kr01, s04["id"])

    assert codes(acts) == [CONFIRMED, UNDONE]
    assert [a["actor"] for a in acts] == ["Nusrat Jahan", "Nusrat Jahan"]


def test_an_answer_that_confirms_a_sheet_is_listed_under_the_qs(nusrat: Api, kr01: uuid.UUID) -> None:
    questions = nusrat.get(f"{step1(kr01)}/questions").json()["questions"]
    [conflict] = [q for q in questions if q["kind"] == "conflict" and q["status"] == "open"]
    response = nusrat.post(f"{step1(kr01)}/questions/{conflict['id']}/answer", {"option": "keep_latest"})
    assert response.status_code == 200, response.content
    [kept] = [p for p in by_number(proposals(nusrat, kr01), "S-07") if p["decision"] == "confirmed"]

    acts = history(nusrat, kr01, kept["id"])

    assert [(a["actor"], a["actor_role"]) for a in acts] == [("Nusrat Jahan", "qs")]


@pytest.mark.parametrize(
    "email", ["kamal@shapla-homes.example", "farhana@padma-builders.example"], ids=["md", "guest"]
)
def test_the_md_and_a_guest_read_every_act_on_the_sheet(
    nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api], email: str
) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    act(nusrat, kr01, "exclude", {"proposals": [s04["id"]], "reason": "superseded", "text": ""})
    act(as_person(ARIF, "shapla"), kr01, "confirm", {"proposals": [s04["id"]]})

    read = history(as_person(email, "shapla"), kr01, s04["id"])

    assert read == history(nusrat, kr01, s04["id"])
    assert codes(read) == [EXCLUDED, CONFIRMED_BACK_IN]


def test_another_developers_qs_cannot_read_a_sheets_history(
    nusrat: Api, kr01: uuid.UUID, as_person: Callable[[str, str], Api]
) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    act(nusrat, kr01, "exclude", {"proposals": [s04["id"]], "reason": "superseded", "text": ""})
    assert codes(history(nusrat, kr01, s04["id"])) == [EXCLUDED]

    response = history_response(as_person("tanvir@meghna.example", "meghna"), kr01, s04["id"])

    assert (response.status_code, response.json()) == (404, NOT_FOUND)


def test_the_history_of_no_proposal_of_the_project_is_the_one_404(nusrat: Api, kr01: uuid.UUID) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    assert history(nusrat, kr01, s04["id"]) == []

    response = history_response(nusrat, kr01, str(uuid.uuid4()))

    assert (response.status_code, response.json()) == (404, NOT_FOUND)
