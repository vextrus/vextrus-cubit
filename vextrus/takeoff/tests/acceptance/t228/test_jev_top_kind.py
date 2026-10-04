"""Ticket 228 (issue #228, review of main D2): Step 1 proposes Jev's top kind.

The authority, the owner's ruling (session 11, "Propose Jev's top kind"): "Jev's first choice becomes
the sheet's proposed kind (a Proposal confirmed in the list or in bulk); a Question is raised only when
Jev's top two are close or the title contradicts it; 'Slab details' is added to the structural kinds."

The rulings the acceptance writer pinned where the ruling names no value (the report lists each):
- "Close" is Jev's top probability less its second's under a setting,
  `VEXTRUS_JEV_SHEET_TYPE_CLOSE_BY` (`vextrus/settings/jev.py`, a `Decimal`; 0.15 recommended, tuned
  in the scored loop). The tests here use leads far from 0.15 (0.50 and 0.25 clear; 0.05 close), and
  one moves the setting to prove it decides.
- The close Question is the kind Question 21c raises (`low_confidence`, "What kind of sheet is N?",
  `takeoff.proposals.which_kind`), Jev's first choice pre-picked.
- A title that contradicts Jev's top: no title-keyword rule exists yet, so the case pinned is the plain
  one, a title that is word for word another kind's English ("COLUMN SCHEDULE") while Jev ranks "Beam
  layout" first. Which Question it is (its kind, any pre-pick) is the builder's; that one is open on
  the sheet, offering both kinds, is pinned. A title naming Jev's top kind itself ("... BEAM DETAILS",
  "Beam details") asks nothing.
- A Jev-proposed kind changes nothing about "agrees" (m0-screens §5): Jev is no source of the sheet's
  number and title, so a one-source sheet stays out of the bulk act, and agreeing sheets join it.

Jev is a stand-in transport (nothing leaves the machine), answering each sheet by its title.
"""

import json
from collections.abc import Mapping
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
import pytest

from engine.messages import sheets as sheet_codes
from vextrus.settings import jev as jev_settings
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    KEEP_OPEN,
    Sheet,
    confirm,
    english,
    keys,
    picked,
    proposals,
    questions,
    readers,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

REPO = Path(__file__).resolve().parents[5]
CONVENTIONS = REPO / "engine" / "recognise" / "conventions" / "sheet-default.json"
STRUCTURAL = "KR-STR-R0.dwg"
ELECTRICAL = "KR-ELE-R0.dwg"
WHICH_KIND = "takeoff.proposals.which_kind"

type Ranks = Mapping[str, tuple[str, str, str, str]]
"""Per sheet title: Jev's first kind, its probability, its second kind, its probability."""


def jev_ranks(offline: Offline, ranks: Ranks) -> dict[str, list[str]]:
    """Jev answers each sheet by its title (`ranks`): its first and second kinds with the
    probabilities given, the rest of the kinds offered sharing what is left. Answers the kinds
    offered for each title, as they were offered."""
    offered: dict[str, list[str]] = {}

    def answer_it(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        title = body["state"]["title"]
        top, p_top, second, p_second = ranks[title]
        answers = {}
        for node, asked in body["questions"].items():
            options = list(asked["criteria"])
            offered[title] = options
            assert top in options, (title, options)
            assert second in options, (title, options)
            rest = (Decimal(1) - Decimal(p_top) - Decimal(p_second)) / max(len(options) - 2, 1)
            probabilities = {o: float(rest) for o in options} | {
                second: float(Decimal(p_second)),
                top: float(Decimal(p_top)),
            }
            answers[node] = {
                "type": "choice",
                "choice": top,
                "confidence": float(Decimal(p_top)),
                "probabilities": probabilities,
            }
        return httpx.Response(200, json={"model": body["model"], "answers": answers})

    offline.use(httpx.MockTransport(answer_it))
    return offered


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, drawn: dict[str, list[Sheet]]) -> None:
    for name, sheets in drawn.items():
        file_id = uploaded(qs.member, qs.project_id, name)
        run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))


def kind_questions_on(api: Any, project_id: Any, sheet: Mapping[str, Any]) -> list[dict[str, Any]]:
    """The open Questions asking this sheet's kind ("What kind of sheet is N?")."""
    return [
        q
        for q in questions(api, project_id)
        if q["status"] == "open" and q["code"] == WHICH_KIND and q["subject_id"] == sheet["sheet_id"]
    ]


BEAM_DETAILS = Sheet("S-07", "TYPICAL FLOOR BEAM DETAILS", ("BEAM B1 LONG SECTION",))


# (1) Jev's top kind, clearly ahead, is the proposed kind -------------------------------------------


@pytest.mark.parametrize(("p_top", "p_second"), [("0.60", "0.10"), ("0.40", "0.15")])
def test_jevs_top_kind_clearly_ahead_but_under_0_90_is_the_sheets_proposed_kind_and_no_kind_question(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    jev_offline: Offline,
    p_top: str,
    p_second: str,
) -> None:
    """The ruling: "Jev's first choice becomes the sheet's proposed kind", where the issue saw a kind
    Question "whenever Jev's answer is under 0.90"."""
    jev_ranks(jev_offline, {BEAM_DETAILS.title: ("beam_details", p_top, "beam_layout", p_second)})
    read(qs_project, monkeypatch, {STRUCTURAL: [BEAM_DETAILS]})
    api = api_as(qs_project.member)

    [sheet] = proposals(api, qs_project.project_id)

    assert sheet["kind"] == "beam_details"
    assert sheet["jev_pick"] is not None
    assert sheet["jev_pick"]["choice"] == "beam_details"
    assert kind_questions_on(api, qs_project.project_id, sheet) == []
    assert [q for q in questions(api, qs_project.project_id) if q["kind"] == "low_confidence"] == []


# (2) Jev's top two close: a kind Question, Jev's first choice pre-picked -------------------------


def test_jevs_top_two_close_raise_a_kind_question_with_jevs_first_choice_picked(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The ruling: "a Question is raised only when Jev's top two are close"; the brief: "with Jev's
    first choice pre-picked"."""
    jev_ranks(jev_offline, {BEAM_DETAILS.title: ("beam_details", "0.40", "beam_layout", "0.35")})
    read(qs_project, monkeypatch, {STRUCTURAL: [BEAM_DETAILS]})
    api = api_as(qs_project.member)
    [sheet] = proposals(api, qs_project.project_id)

    [q] = kind_questions_on(api, qs_project.project_id, sheet)

    assert q["kind"] == "low_confidence"
    assert q["proposals"] == [sheet["id"]]
    assert keys(q)[:2] == ["beam_details", "beam_layout"]
    assert keys(q)[-1] == KEEP_OPEN
    assert picked(q) == ["beam_details"]


def test_how_close_is_close_is_the_setting_vextrus_jev_sheet_type_close_by(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    jev_offline: Offline,
    settings: Any,
) -> None:
    """The closeness ("close") is a setting (the brief: "a setting"), so the scored loop tunes it on the
    real sets: with it at 0.60, a lead of 0.50 is close and asks."""
    assert isinstance(getattr(jev_settings, "VEXTRUS_JEV_SHEET_TYPE_CLOSE_BY", None), Decimal)
    settings.VEXTRUS_JEV_SHEET_TYPE_CLOSE_BY = Decimal("0.60")
    jev_ranks(jev_offline, {BEAM_DETAILS.title: ("beam_details", "0.60", "beam_layout", "0.10")})
    read(qs_project, monkeypatch, {STRUCTURAL: [BEAM_DETAILS]})
    api = api_as(qs_project.member)
    [sheet] = proposals(api, qs_project.project_id)

    [q] = kind_questions_on(api, qs_project.project_id, sheet)

    assert picked(q) == ["beam_details"]


# (3) A title that contradicts Jev's top: a Question ----------------------------------------------


def test_a_title_naming_another_kind_than_jevs_clear_top_raises_a_kind_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The ruling: "a Question is raised only when ... the title contradicts it". The title is "Column
    schedule" word for word; Jev ranks "Beam layout" first, clearly ahead."""
    schedule = Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",))
    jev_ranks(jev_offline, {schedule.title: ("beam_layout", "0.60", "column_layout", "0.10")})
    read(qs_project, monkeypatch, {STRUCTURAL: [schedule]})
    api = api_as(qs_project.member)
    [sheet] = proposals(api, qs_project.project_id)

    [q] = kind_questions_on(api, qs_project.project_id, sheet)

    assert q["proposals"] == [sheet["id"]]
    assert {"beam_layout", "column_schedule"} <= set(keys(q))
    assert keys(q)[-1] == KEEP_OPEN


# (4) Jev's kind is no second source: "agrees" is the sheet's own ---------------------------------


ONE_SOURCE = [
    Sheet("E-02", "TYPICAL FLOOR LIGHTING LAYOUT", ("TYPICAL FLOOR LIGHTING LAYOUT",)),
    Sheet("E-03", "TYPICAL FLOOR POWER LAYOUT", ("TYPICAL FLOOR POWER LAYOUT",)),
]
"""Electrical with no drawing list and no Plot: one source each (m0-screens §7's KR-ELE-R0.dwg)."""
ONE_SOURCE_RANKS: Ranks = {
    "TYPICAL FLOOR LIGHTING LAYOUT": ("lighting_layout", "0.60", "point_wiring_layout", "0.10"),
    "TYPICAL FLOOR POWER LAYOUT": ("power_wiring_layout", "0.60", "point_wiring_layout", "0.10"),
}

LISTED = (("S-01", "GENERAL NOTES"), ("S-02", "PILE LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"))
AGREEING = [
    Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=LISTED),
    Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
]
"""Structural with its drawing list drawn on S-01: every sheet agrees (two sources)."""
AGREEING_RANKS: Ranks = {
    "GENERAL NOTES": ("general_notes", "0.60", "cover_index", "0.10"),
    "PILE LAYOUT PLAN": ("pile_layout", "0.60", "pile_cap_layout", "0.10"),
    "COLUMN SCHEDULE": ("column_schedule", "0.60", "column_layout", "0.10"),
}


def test_a_one_source_sheet_whose_kind_is_jevs_top_still_stays_out_of_the_bulk_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """m0-screens 6.4: "Sheets "with one source" (5) are never in the bulk act"; Jev's kind does
    not make a sheet two-source."""
    jev_ranks(jev_offline, ONE_SOURCE_RANKS)
    read(qs_project, monkeypatch, {ELECTRICAL: ONE_SOURCE})
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    assert {p["number"]: p["kind"] for p in listed} == {
        "E-02": "lighting_layout",
        "E-03": "power_wiring_layout",
    }
    assert [p["agrees"] for p in listed] == [False, False]
    response = confirm(api, qs_project.project_id, [p["id"] for p in listed])
    assert response.status_code == 409, response.content
    assert [p["decision"] for p in proposals(api, qs_project.project_id)] == [None, None]


def test_agreeing_sheets_whose_kind_is_jevs_top_are_confirmed_in_one_bulk_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The ruling: the proposed kind is "a Proposal confirmed in the list or in bulk"; the issue's
    target, "most sheets confirmable in bulk"."""
    jev_ranks(jev_offline, AGREEING_RANKS)
    read(qs_project, monkeypatch, {STRUCTURAL: AGREEING})
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    assert {p["number"]: p["kind"] for p in listed} == {
        "S-01": "general_notes",
        "S-02": "pile_layout",
        "S-03": "column_schedule",
    }
    assert [p["agrees"] for p in listed] == [True, True, True]
    response = confirm(api, qs_project.project_id, [p["id"] for p in listed])
    assert response.status_code == 200, response.content
    after = proposals(api, qs_project.project_id)
    assert [p["decision"] for p in after] == ["confirmed"] * 3
    assert the(after, "S-03")["confirmed_kind"] == "column_schedule"


# (5) "Slab details" among the structural kinds --------------------------------------------------


def test_slab_details_is_a_structural_kind_worded_slab_details() -> None:
    """The ruling: "'Slab details' is added to the structural kinds"; each kind has its code,
    `engine.sheets.kind_<key>`, worded in the catalogue (engine/messages/sheets.py); the catalogue's
    English may say more, as "Slab layout and rebar" does, but starts with the owner's words."""
    conventions = json.loads(CONVENTIONS.read_text(encoding="utf-8"))

    assert "slab_details" in conventions["sheet_kinds"]["structural"]
    assert sheet_codes.KINDS["slab_details"].code == "engine.sheets.kind_slab_details"
    worded = english("engine.sheets.kind_slab_details")
    assert worded is not None
    assert worded.startswith("Slab details"), worded


def test_jev_is_offered_slab_details_for_a_structural_sheet_and_its_top_is_proposed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The issue: "The structural kind list has no slab-reinforcement kind"."""
    slab = Sheet("S-12", "FIRST FLOOR SLAB REINFORCEMENT", ("SLAB REINFORCEMENT", "SECTION 1-1"))
    offered = jev_ranks(jev_offline, {slab.title: ("slab_details", "0.60", "slab_layout", "0.10")})
    read(qs_project, monkeypatch, {STRUCTURAL: [slab]})
    api = api_as(qs_project.member)

    [sheet] = proposals(api, qs_project.project_id)

    assert "slab_details" in offered[slab.title]
    assert sheet["kind"] == "slab_details"
    assert "slab_details" in sheet["jev_pick"]["options"]
