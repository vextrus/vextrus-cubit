"""Ticket S15-A4, f-11 (gh #322, walk misleading_display on takeoff.step1): excluding a sheet, or
confirming it back in, never changes its Discipline's N found. m0-screens 6.3: "Excluded sheets stay in
the count with their reason"; the exclusion toast says it "stays in the count".

The walk saw an unnumbered sheet (a cover) leave N when excluded and come back when confirmed back in.
The rule (the orchestrator's ruling, 6 Oct 2026, no history): N found counts every sheet that is not a
blank layout, numbered or not, decided or not; the header's Count and the files' Sheets found follow it.

Synthetic only: `test_one_count`'s invented files, read by the read job with invented readers.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import confirm, exclude, the
from vextrus.takeoff.tests.acceptance.ts15a4.test_one_count import ARC, STR, Read, counted, files, read

pytestmark = pytest.mark.django_db

__all__ = ["read"]  # the fixture, used by name


def through(read: Read, discipline: str, acts: list[tuple[str, str]]) -> list[int]:
    """The Discipline's N found before and after each act, each `(act, proposal id)`."""
    seen = [read.found(discipline)]
    for act, proposal in acts:
        done = (
            confirm(read.api, read.project_id, [proposal])
            if act == "confirm"
            else exclude(read.api, read.project_id, [proposal], act)
        )
        assert done.status_code == 200, done.content
        seen.append(read.found(discipline))
    return seen


def test_excluding_a_cover_and_confirming_it_back_in_keeps_its_discipline_s_n_found(read: Read) -> None:
    cover = read.covers()[STR]["id"]
    seen = through(read, "structural", [("cover_index", cover), ("confirm", cover)])
    assert seen == [3, 3, 3], (
        f"Structural N found is not the one rule's before and after each act: {seen}"
    )


def test_confirming_a_cover_in_then_excluding_it_keeps_its_discipline_s_n_found(read: Read) -> None:
    cover = read.covers()[ARC]["id"]
    seen = through(
        read, "architectural", [("confirm", cover), ("cover_index", cover), ("confirm", cover)]
    )
    assert seen == [4, 4, 4, 4], (
        f"Architectural N found is not the one rule's before and after each act: {seen}"
    )


def test_excluding_and_confirming_back_a_numbered_sheet_keeps_n_found(read: Read) -> None:
    sheet = the(read.proposals(), "A-72")["id"]
    seen = through(read, "architectural", [("superseded", sheet), ("confirm", sheet)])
    assert seen == [4, 4, 4], (
        f"Architectural N found is not the one rule's before and after each act: {seen}"
    )
    counted(read, {"found": 7, "confirmed": 1, "excluded": 0})


def test_the_excluded_cover_stays_in_the_header_and_its_file_as_excluded(read: Read) -> None:
    cover = read.covers()[STR]["id"]
    assert exclude(read.api, read.project_id, [cover], "cover_index").status_code == 200
    counted(read, {"found": 7, "confirmed": 0, "excluded": 1})
    files(read)
