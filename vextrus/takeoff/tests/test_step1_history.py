"""S24-B1's history route at its edges (the acceptance tests in ts24b1 pin its promise): an exclusion
undone with nothing after it keeps its reason; the QS's "other" words ride with the act; another
sheet's acts stay out of a sheet's history; a sheet's id is read as its Proposal's; a bulk act's count
and a correction's sources are the acts' own; a correction does not lose the acts before it."""

import uuid
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t19a.step1 import *  # noqa: F403 (its fixtures, by name)
from vextrus.takeoff.tests.acceptance.t19a.step1 import by_number, proposals, step1
from vextrus.takeoff.tests.acceptance.ts24b1.history import (
    CONFIRMED,
    CORRECTED,
    EXCLUDED,
    UNDONE,
    act,
    codes,
    correct,
    history,
)
from vextrus.testing.auth import Api

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def sheet(api: Api, project: uuid.UUID, number: str) -> dict[str, Any]:
    [found] = by_number(proposals(api, project), number)
    return found


def test_an_exclusion_undone_with_nothing_after_it_keeps_its_reason(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    act(nusrat, kr01, "exclude", {"proposals": [s04["id"]], "reason": "for_information", "text": ""})
    act(nusrat, kr01, "undo", {})

    acts = history(nusrat, kr01, s04["id"])

    assert codes(acts) == [EXCLUDED, UNDONE]
    assert acts[0]["reason"] == "for_information"
    assert acts[0]["text"] is None


def test_the_words_of_an_other_exclusion_ride_with_the_act_and_no_others(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s04, s05 = sheet(nusrat, kr01, "S-04"), sheet(nusrat, kr01, "S-05")
    act(nusrat, kr01, "exclude", {"proposals": [s04["id"]], "reason": "other", "text": "a draft sheet"})
    act(nusrat, kr01, "exclude", {"proposals": [s05["id"]], "reason": "blank", "text": "ignored"})

    [other] = history(nusrat, kr01, s04["id"])
    [blank] = history(nusrat, kr01, s05["id"])

    assert (other["reason"], other["text"]) == ("other", "a draft sheet")
    assert (blank["reason"], blank["text"]) == ("blank", None)


def test_another_sheets_acts_stay_out_of_a_sheets_history(nusrat: Api, kr01: uuid.UUID) -> None:
    s02, s03 = sheet(nusrat, kr01, "S-02"), sheet(nusrat, kr01, "S-03")
    act(nusrat, kr01, "confirm", {"proposals": [s02["id"]]})
    correct(nusrat, kr01, {"proposal": s03["id"], "title": "A corrected title"})

    assert codes(history(nusrat, kr01, s02["id"])) == [CONFIRMED]
    assert codes(history(nusrat, kr01, s03["id"])) == [CORRECTED]


def test_a_sheet_confirmed_in_bulk_names_the_count_in_each_sheets_history(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    ids = [sheet(nusrat, kr01, n)["id"] for n in ("S-02", "S-03")]
    act(nusrat, kr01, "confirm", {"proposals": ids})

    assert [history(nusrat, kr01, i)[0]["sheets"] for i in ids] == [2, 2]


def test_a_correction_after_a_confirmation_back_in_leaves_both_listed_in_order(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    act(nusrat, kr01, "confirm", {"proposals": [s04["id"]]})
    act(nusrat, kr01, "undo", {})
    correct(nusrat, kr01, {"proposal": s04["id"], "number": "S-44", "title": "Beams, ground floor"})

    acts = history(nusrat, kr01, s04["id"])

    assert codes(acts) == [CONFIRMED, UNDONE, CORRECTED]
    assert set(acts[2]["changes"]) == {"number", "title"}
    assert acts[2]["changes"]["number"]["new"] == "S-44"
    assert acts[2]["changes"]["title"]["new"] == "Beams, ground floor"
    assert [a["at"] for a in acts] == sorted(a["at"] for a in acts)


def test_the_history_of_a_sheet_not_yet_proposed_is_read_by_the_sheets_id(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s04 = sheet(nusrat, kr01, "S-04")
    act(nusrat, kr01, "confirm", {"proposals": [s04["id"]]})

    by_sheet = history(nusrat, kr01, s04["sheet_id"])

    assert codes(by_sheet) == [CONFIRMED]
    assert by_sheet == history(nusrat, kr01, s04["id"])


def test_a_history_for_an_id_in_the_path_that_is_not_an_id_is_refused_whole(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    response = nusrat.get(f"{step1(kr01)}/proposals/not-an-id/history")

    assert response.status_code in (404, 422)
