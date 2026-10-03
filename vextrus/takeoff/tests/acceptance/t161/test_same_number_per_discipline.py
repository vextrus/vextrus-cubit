"""Ticket #161 (M0 fix W5): same-number conflicts per Discipline, retired on re-read.

The issue's acceptance:
- "Prefixes kept in the comparison."
- "An unassigned file is not compared across Disciplines."
- "Re-reading a file retires superseded Questions (one open Question per number)."
- "A confirmed sheet is never grouped with another file's sheet."
- "A Question's words count the sheets it lists."

W5, as walked: "The unassigned general-notes file's sheets were compared with three other Disciplines'
sheets with the letter prefix dropped ('4 sheets are numbered 04'). Each later read added a new set
while the old stayed open (3 Questions for one number ...). Each Question lists 2 sheets while saying
4. Confirmed Structural sheets then show three times each as 'Question ..., 2 copies', merged with the
other file's sheets."

A Question's grouping is the Proposals it holds (`proposals` in `GET {step1}/questions`); its words
are its code with `params` (`engine.conflicts.same_number`: `number`, `copies`). Everything is invented
and drawn by ticket 21c's fixtures (no toolchain, no real drawing). The file with no Discipline is
named so no Discipline's word or prefix is in its name; whether ticket #159 gives it the General
Discipline or it stays unassigned, the promises below hold alike (neither is another Discipline's).
"""

import uuid
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
    jev_says,
    open_questions,
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
STRUCTURAL_B = "KR-STR-B-R0.dwg"
STRUCTURAL_C = "KR-STR-C-R0.dwg"
ARCHITECTURAL = "KR-ARC-R0.dwg"
ELECTRICAL = "KR-ELE-R0.dwg"
NO_DISCIPLINE = "KR-SET2-R0.dwg"
"""A file whose name names no Discipline (no Market prefix or word in it): its bare numbers carry
none either."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def same_number(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    """The open `same_number` Questions."""
    return [
        q
        for q in open_questions(api, project_id, "conflict")
        if q["code"] == conflict_codes.SAME_NUMBER.code
    ]


def by_id(api: Any, project_id: uuid.UUID) -> dict[str, dict[str, Any]]:
    return {str(p["id"]): p for p in proposals(api, project_id)}


def held(question: dict[str, Any], listed: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return [listed[str(i)] for i in question["proposals"]]


def ids_of(listed: dict[str, dict[str, Any]], number: str, file_name: str) -> list[str]:
    return sorted(i for i, p in listed.items() if p["number"] == number and p["file_name"] == file_name)


# Prefixes kept -----------------------------------------------------------------------------------


def test_s_04_and_a_04_are_never_held_by_one_same_number_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "Prefixes kept in the comparison": W5's "4 sheets are numbered 04" joined S-04 and A-04
    through a bare 04 with the letter prefix dropped."""
    read(qs_project, monkeypatch, STRUCTURAL, [Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",))])
    read(
        qs_project,
        monkeypatch,
        ARCHITECTURAL,
        [Sheet("A-04", "GROUND FLOOR PLAN", ("GROUND FLOOR PLAN",))],
    )
    read(qs_project, monkeypatch, NO_DISCIPLINE, [Sheet("04", "SITE NOTES", ("SITE NOTES",))])
    api = api_as(qs_project.member)
    listed = by_id(api, qs_project.project_id)
    s04 = ids_of(listed, "S-04", STRUCTURAL)
    a04 = ids_of(listed, "A-04", ARCHITECTURAL)
    assert len(s04) == len(a04) == 1

    together = [
        q
        for q in open_questions(api, qs_project.project_id, "conflict")
        if {*s04, *a04} <= {str(i) for i in q["proposals"]}
    ]

    assert together == []


# An unassigned file is not compared across Disciplines ------------------------------------------


def test_a_file_with_no_discipline_numbered_like_a_structural_sheet_raises_no_same_number_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "An unassigned file is not compared across Disciplines." (This reverses 21c's
    `test_a_sheet_with_no_discipline_numbered_like_a_disciplines_sheet_raises_a_conflict`, #102's
    "compare Discipline-less sheets against every Discipline's numbers".)"""
    read(qs_project, monkeypatch, STRUCTURAL, [
        Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ])  # fmt: skip
    read(qs_project, monkeypatch, NO_DISCIPLINE, [Sheet("01", "SITE NOTES", ("SITE NOTES",))])
    api = api_as(qs_project.member)
    ones = [p for p in proposals(api, qs_project.project_id) if p["number"] == "01"]
    assert len(ones) == 2
    [unassigned] = [p for p in ones if p["file_name"] == NO_DISCIPLINE]
    assert unassigned["discipline"] != "structural"

    assert same_number(api, qs_project.project_id) == []


def test_no_open_conflict_question_holds_sheets_of_two_disciplines(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """W5's set in small: a file with no Discipline, its bare 04 beside Structural's, Architectural's
    and Electrical's 04. A Question holds sheets of one Discipline (no Discipline counting as its
    own)."""
    read(qs_project, monkeypatch, STRUCTURAL, [Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",))])
    read(qs_project, monkeypatch, NO_DISCIPLINE, [Sheet("04", "SITE NOTES", ("SITE NOTES",))])
    read(
        qs_project,
        monkeypatch,
        ARCHITECTURAL,
        [Sheet("A-04", "GROUND FLOOR PLAN", ("GROUND FLOOR PLAN",))],
    )
    read(
        qs_project,
        monkeypatch,
        ELECTRICAL,
        [Sheet("E-04", "LIGHTING LAYOUT PLAN", ("LIGHTING LAYOUT PLAN",))],
    )
    api = api_as(qs_project.member)
    listed = by_id(api, qs_project.project_id)

    mixed = [
        (q["params"], sorted({p["discipline"] or "" for p in held(q, listed)}))
        for q in open_questions(api, qs_project.project_id, "conflict")
        if len({p["discipline"] for p in held(q, listed)}) > 1
    ]

    assert mixed == []


# Re-reading retires superseded Questions --------------------------------------------------------


def test_after_two_reads_one_number_has_one_open_question_holding_every_copy(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "Re-reading a file retires superseded Questions (one open Question per number)": W5's "Each
    later read added a new set while the old stayed open (3 Questions for one number)". A second
    Structural file brings a third S-04: the Question asked of two copies is superseded by the one
    of three."""
    read(qs_project, monkeypatch, STRUCTURAL, [
        Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R0", date="02.08.2026"),
        Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R1", date="14.08.2026"),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    assert len(same_number(api, qs_project.project_id)) == 1

    read(qs_project, monkeypatch, STRUCTURAL_B, [
        Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R2", date="30.08.2026"),
    ])  # fmt: skip

    listed = by_id(api, qs_project.project_id)
    copies = sorted(i for i, p in listed.items() if p["number"] == "S-04")
    assert len(copies) == 3
    [q] = same_number(api, qs_project.project_id)
    assert sorted(str(i) for i in q["proposals"]) == copies


def test_a_later_read_of_another_file_leaves_one_open_question_per_number(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Three reads, three copies of S-04 arriving one file at a time: never more than one open
    Question for the number."""
    for name, rev in ((STRUCTURAL, "R0"), (STRUCTURAL_B, "R1"), (STRUCTURAL_C, "R2")):
        read(qs_project, monkeypatch, name, [
            Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev=rev),
            Sheet(f"S-1{rev[-1]}", f"BEAM SCHEDULE {rev}", (f"BEAM SCHEDULE {rev}",)),
        ])  # fmt: skip
    api = api_as(qs_project.member)

    numbers = [q["params"]["number"] for q in same_number(api, qs_project.project_id)]

    assert numbers == ["S-04"]


# A confirmed sheet is never grouped with another file's sheet ----------------------------------


def test_a_confirmed_sheet_is_held_by_no_open_question_with_another_files_sheet(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "A confirmed sheet is never grouped with another file's sheet": W5's "Confirmed Structural
    sheets then show three times each as 'Question ..., 2 copies', merged with the other file's
    sheets (the API still has them confirmed)"."""
    read(qs_project, monkeypatch, STRUCTURAL, [
        Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
        Sheet("03", "BEAM SCHEDULE", ("BEAM SCHEDULE",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    structural = [p["id"] for p in proposals(api, qs_project.project_id)]
    # m0-screens 6.4 (ruled at #166): one-source sheets are confirmed one by one, never in bulk.
    for one in structural:
        response = confirm(api, qs_project.project_id, [one])
        assert response.status_code == 200, response.content

    read(qs_project, monkeypatch, NO_DISCIPLINE, [
        Sheet(f"{n:02d}", f"SITE NOTES {n}", ("SITE NOTES",)) for n in (1, 2, 3)
    ])  # fmt: skip
    read(qs_project, monkeypatch, ARCHITECTURAL, [
        Sheet("A-01", "GROUND FLOOR PLAN", ("GROUND FLOOR PLAN",)),
        Sheet("A-02", "FIRST FLOOR PLAN", ("FIRST FLOOR PLAN",)),
    ])  # fmt: skip
    listed = by_id(api, qs_project.project_id)
    assert all(listed[str(i)]["decision"] == "confirmed" for i in structural)

    grouped = [
        (q["code"], q["params"])
        for q in open_questions(api, qs_project.project_id)
        if any(p["decision"] == "confirmed" for p in held(q, listed))
        and len({p["file_name"] for p in held(q, listed)}) > 1
    ]

    assert grouped == []


# A Question's words count the sheets it lists ---------------------------------------------------


def test_a_same_number_questions_words_count_the_sheets_it_lists(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "A Question's words count the sheets it lists": W5's "Each Question lists 2 sheets while
    saying 4". Of W5's set in small (two Structural S-04s, a file with no Discipline's bare 04,
    Architectural's and Electrical's 04s) the one Question is Structural's: "Two sheets are numbered
    S-04" (`copies` 2), listing its two copies."""
    read(qs_project, monkeypatch, STRUCTURAL, [
        Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R0", date="02.08.2026"),
        Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R1", date="14.08.2026"),
    ])  # fmt: skip
    read(qs_project, monkeypatch, NO_DISCIPLINE, [Sheet("04", "SITE NOTES", ("SITE NOTES",))])
    read(
        qs_project,
        monkeypatch,
        ARCHITECTURAL,
        [Sheet("A-04", "GROUND FLOOR PLAN", ("GROUND FLOOR PLAN",))],
    )
    read(
        qs_project,
        monkeypatch,
        ELECTRICAL,
        [Sheet("E-04", "LIGHTING LAYOUT PLAN", ("LIGHTING LAYOUT PLAN",))],
    )
    api = api_as(qs_project.member)
    listed = by_id(api, qs_project.project_id)

    worded = [
        (q["params"]["number"], q["params"]["copies"], len(q["proposals"]))
        for q in same_number(api, qs_project.project_id)
    ]

    assert worded == [("S-04", 2, 2)]
    [q] = same_number(api, qs_project.project_id)
    assert sorted(str(i) for i in q["proposals"]) == ids_of(listed, "S-04", STRUCTURAL)
