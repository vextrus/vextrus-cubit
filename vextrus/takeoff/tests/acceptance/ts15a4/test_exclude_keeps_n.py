"""Ticket S15-A4, f-11 (gh #322, walk misleading_display on takeoff.step1): excluding a sheet, or
confirming it back in, never changes its Discipline's N found. m0-screens 6.3: "Excluded sheets stay in
the count with their reason"; the exclusion toast says it "stays in the count".

The walk saw an unnumbered sheet (a cover) leave N when excluded and come back when confirmed back in:
the server counted a cover proposed out with no number only while it stood confirmed. With
`test_one_count.py`'s pins (a cover is not counted until the QS confirms it in, and one excluded while
undecided counts nowhere), the rule both files hold is: a cover the QS has confirmed in is a sheet found,
and stays one when excluded and when confirmed back in. The header's Count and the files' Sheets found
follow it (the ticket: header, rows and per-file Sheets found agree).

Synthetic only: `test_one_count`'s invented files, read by the read job with invented readers.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import confirm, exclude, the
from vextrus.takeoff.tests.acceptance.ts15a4.test_one_count import ARC, STR, Read, read

pytestmark = pytest.mark.django_db

__all__ = ["read"]  # the fixture, used by name


def found(read: Read, discipline: str) -> int:
    """The Discipline's N found, as the server's progress row sends it."""
    rows = {row["discipline"]: row for row in read.progress()["disciplines"]}
    n: int = rows[discipline]["found"]
    return n


def test_excluding_a_cover_the_qs_confirmed_in_keeps_its_discipline_s_n_found(read: Read) -> None:
    cover = read.covers()[STR]
    assert confirm(read.api, read.project_id, [cover["id"]]).status_code == 200
    assert found(read, "structural") == 3
    assert exclude(read.api, read.project_id, [cover["id"]], "cover_index").status_code == 200
    n = found(read, "structural")
    assert n == 3, f"excluding the cover took it out of the count: Structural N found {n}"


def test_confirming_the_excluded_cover_back_in_keeps_its_discipline_s_n_found(read: Read) -> None:
    cover = read.covers()[STR]
    assert confirm(read.api, read.project_id, [cover["id"]]).status_code == 200
    assert exclude(read.api, read.project_id, [cover["id"]], "cover_index").status_code == 200
    before = found(read, "structural")
    assert confirm(read.api, read.project_id, [cover["id"]]).status_code == 200
    n = found(read, "structural")
    assert n == before == 3, (
        f"excluding the cover took it out of the count: Structural N found {before}, then {n}"
    )


def test_the_excluded_cover_stays_in_the_header_and_its_file_as_excluded(read: Read) -> None:
    cover = read.covers()[STR]
    assert confirm(read.api, read.project_id, [cover["id"]]).status_code == 200
    assert exclude(read.api, read.project_id, [cover["id"]], "cover_index").status_code == 200
    count = read.count()
    assert count == {"found": 6, "confirmed": 0, "excluded": 1}, (
        f"excluding the cover took it out of the count: {count}"
    )
    assert read.sheets_found() == {STR: 3, ARC: 3}


def test_excluding_and_confirming_back_a_numbered_sheet_keeps_n_found(read: Read) -> None:
    sheet = the(read.proposals(), "A-72")
    seen = [found(read, "architectural")]
    assert exclude(read.api, read.project_id, [sheet["id"]], "superseded").status_code == 200
    seen.append(found(read, "architectural"))
    assert confirm(read.api, read.project_id, [sheet["id"]]).status_code == 200
    seen.append(found(read, "architectural"))
    assert seen == [3, 3, 3]
    assert read.count() == {"found": 5, "confirmed": 1, "excluded": 0}
