"""Ticket #159 (M0 fix B4): a General Discipline for general-notes files.

The owner's ruling (session 07): "Add a General Discipline (Recommended)": a General Discipline in the
Market's library, whose sheets are Step 2's notes, with sheet numbers scoped per Discipline.

The issue's acceptance:
- "A file with its own 01-08 series and no drawing list gets the General Discipline."
- "No same-number Question across Disciplines (numbers are scoped per Discipline)."
- "A Discipline chosen while the file is reading is kept, or refused with words."

The General Discipline is found by its English name, "General", in the Market's Disciplines (`GET
.../drawings/disciplines`, Library data); its key is whatever the library row names it, never
asserted here. Step 2 is `takeoff.library.STEPS[1]` (ADR 0007's second Takeoff Step). Everything is
invented and drawn by ticket 21c's fixtures (no toolchain, no real drawing).
"""

import uuid
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.platform.services import tenancy
from vextrus.takeoff import library as takeoff_library
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    a_file,
    confirm,
    coverage,
    english,
    got,
    jev_says,
    open_questions,
    progress,
    proposals,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
NOTES_FILE = "KR-SET2-R0.dwg"
"""A file whose name names no Discipline (no Market prefix or word in it)."""
STEP_2 = takeoff_library.STEPS[1].key
"""Step 2 (ADR 0007): General Notes and Specification."""

NOTES_SERIES = [Sheet(f"{n:02d}", f"GENERAL NOTES {n}", ("GENERAL NOTES",)) for n in range(1, 9)]
"""The file's own series, 01 to 08, bare numbers, general notes only, and no drawing list."""
STRUCTURAL_01_02 = [
    Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def disciplines(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    listed: list[dict[str, Any]] = got(api, f"/api/projects/{project_id}/drawings/disciplines")
    return listed


def general_key(api: Any, project_id: uuid.UUID) -> str:
    """The General Discipline's key, as the Market's library names it (found by its English name)."""
    named = [d["key"] for d in disciplines(api, project_id) if d["labels"].get("en") == "General"]
    assert len(named) == 1, (
        f"the Market's Disciplines hold no one General: {disciplines(api, project_id)}"
    )
    return str(named[0])


def conflicts_of_same_number(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    return [
        q
        for q in open_questions(api, project_id, "conflict")
        if q["code"] == conflict_codes.SAME_NUMBER.code
    ]


# The Market's library ----------------------------------------------------------------------------


def test_the_markets_disciplines_offer_general(qs_project: QsProject) -> None:
    """The owner's ruling: "a General Discipline in the Market's library"; the file's Discipline
    select lists it, and a Question asking which Discipline a sheet is offers it."""
    api = api_as(qs_project.member)

    key = general_key(api, qs_project.project_id)

    assert key


# A file with its own 01-08 series ---------------------------------------------------------------


def test_a_file_with_its_own_01_to_08_series_and_no_drawing_list_gets_the_general_discipline(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = read(qs_project, monkeypatch, NOTES_FILE, NOTES_SERIES)
    api = api_as(qs_project.member)
    general = general_key(api, qs_project.project_id)

    shown = a_file(api, qs_project.project_id, file_id)
    listed = proposals(api, qs_project.project_id)

    assert shown["discipline"] == general
    assert sorted(p["number"] for p in listed) == [f"{n:02d}" for n in range(1, 9)]
    assert all(p["discipline"] == general for p in listed)
    assert open_questions(api, qs_project.project_id, "missing_discipline") == []


def test_a_general_file_beside_structural_is_listed_under_general_not_another_discipline(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """B4: its sheets were "shown as 'Another Discipline' and missing from the sheets summary"."""
    read(qs_project, monkeypatch, STRUCTURAL, STRUCTURAL_01_02)
    read(qs_project, monkeypatch, NOTES_FILE, NOTES_SERIES)
    api = api_as(qs_project.member)
    general = general_key(api, qs_project.project_id)

    rows = progress(api, qs_project.project_id)

    assert None not in rows
    assert {"structural", general} <= set(rows)


# Numbers scoped per Discipline -------------------------------------------------------------------


def test_general_01_beside_structural_01_raises_no_same_number_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "No same-number Question across Disciplines (numbers are scoped per Discipline)"."""
    read(qs_project, monkeypatch, STRUCTURAL, STRUCTURAL_01_02)
    read(qs_project, monkeypatch, NOTES_FILE, NOTES_SERIES)
    api = api_as(qs_project.member)
    general = general_key(api, qs_project.project_id)
    ones = [p for p in proposals(api, qs_project.project_id) if p["number"] == "01"]
    assert sorted(p["discipline"] for p in ones) == sorted(["structural", general])

    assert conflicts_of_same_number(api, qs_project.project_id) == []
    assert open_questions(api, qs_project.project_id, "missing_discipline") == []


def test_a_same_number_within_one_discipline_still_raises_its_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scoping is per Discipline, not away: two Structural sheets numbered 01 are still asked, and
    the General 01 is not among the copies."""
    twice = [
        Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R1", date="14.09.2026"),
        Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R0", date="02.08.2026"),
        Sheet("02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ]
    read(qs_project, monkeypatch, STRUCTURAL, twice)
    read(qs_project, monkeypatch, NOTES_FILE, NOTES_SERIES)
    api = api_as(qs_project.member)
    structural_ones = [
        p["id"]
        for p in proposals(api, qs_project.project_id)
        if p["number"] == "01" and p["discipline"] == "structural"
    ]
    assert len(structural_ones) == 2

    [q] = conflicts_of_same_number(api, qs_project.project_id)

    assert q["discipline"] == "structural"
    assert sorted(q["proposals"]) == sorted(structural_ones)


# Step 2's notes ---------------------------------------------------------------------------------


def test_the_general_disciplines_sheets_are_step_2s_notes(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The owner's ruling: "whose sheets are Step 2's notes"; confirmed, its Step 1 is confirmed."""
    read(qs_project, monkeypatch, NOTES_FILE, NOTES_SERIES)
    api = api_as(qs_project.member)
    general = general_key(api, qs_project.project_id)
    listed = [p["id"] for p in proposals(api, qs_project.project_id) if p["discipline"] == general]
    assert len(listed) == 8

    response = confirm(api, qs_project.project_id, listed)

    assert response.status_code == 200, response.content
    shown = coverage(api, qs_project.project_id)
    assert shown["by_step"] == {STEP_2: 8}
    assert shown["unaccounted"] == 0
    assert progress(api, qs_project.project_id)[general]["status"] == "confirmed"


# A Discipline chosen while the file is reading ---------------------------------------------------


def test_a_discipline_chosen_while_the_file_is_reading_is_kept_or_refused_with_words(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """B4: "A Discipline chosen while the file was still reading was lost with no message."
    Acceptance: "kept, or refused with words". The QS chooses General while the file's reader runs
    (beside a read Structural file whose 01 and 02 its own series shares)."""
    read(qs_project, monkeypatch, STRUCTURAL, STRUCTURAL_01_02)
    api = api_as(qs_project.member)
    general = general_key(api, qs_project.project_id)
    file_id = uploaded(qs_project.member, qs_project.project_id, "KR-SET3-R0.dwg")
    given = readers({"KR-SET3-R0.dwg": NOTES_SERIES})
    chosen: list[Any] = []

    def reading_while_the_qs_chooses(path: Any, name: str) -> Any:
        # The QS's requests, beside the job (each leaves the job's tenancy as it found it).
        with tenancy.acting_in(qs_project.member.developer_id, user_id=qs_project.member.user.pk):
            assert a_file(api, qs_project.project_id, file_id)["state"] in ("waiting", "reading")
            chosen.append(
                api.send(
                    "put",
                    f"/api/projects/{qs_project.project_id}/drawings/files/{file_id}/discipline",
                    {"discipline": general},
                )
            )
        return given.dwg(path, name)

    run_job(
        qs_project.member,
        file_id,
        monkeypatch,
        files.Readers(
            dwg=reading_while_the_qs_chooses,
            second=given.second,
            fonts=given.fonts,
            bangla_ansi=given.bangla_ansi,
            pdf=given.pdf,
        ),
    )

    [response] = chosen
    shown = a_file(api, qs_project.project_id, file_id)
    if response.status_code == 200:
        # Kept: the file and every sheet it brought are General after the read.
        assert shown["discipline"] == general
        mine = [p for p in proposals(api, qs_project.project_id) if p["file_name"] == "KR-SET3-R0.dwg"]
        assert len(mine) == 8
        assert all(p["discipline"] == general for p in mine)
    else:
        # Refused, with a worded code, never silently.
        assert response.status_code in (400, 409), response.content
        code = response.json()["code"]
        assert english(code), f"the refusal {code!r} has no English in web/src/messages"
