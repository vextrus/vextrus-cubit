"""Ticket S15-A4 (gh #545; walk #324's number_wrong, #442; f-11, #322): the server is the one source of
every Step 1 count, so Step 1's header, its Discipline rows and each file's Sheets found agree.

The rule (the orchestrator's ruling, 6 Oct 2026, one source of truth with no history): N found counts
every sheet that is not a blank layout, numbered or not, decided or not. A cover with no number is a
sheet found; a layout the read proposed out as `blank` never is (m0-screens 4.5: a layout tab that shows
nothing is "never counted as a sheet (no phantom sheets)"). So confirming, excluding or confirming back
in never changes N (m0-screens 6.3: "Excluded sheets stay in the count with their reason").

The one contract this file names (the plan names none): `GET .../takeoff/step1/progress` answers
`count: {found, confirmed, excluded}`, the toolbar's Count ("Confirmed n / N, k excluded"; m0-screens
4.7, 6.1), so the web shows it and derives no count of its own.

Synthetic only: invented sheets drawn by `t21c`'s writer, read by the read job with invented readers.
"""

import uuid
from collections.abc import Sequence
from typing import Any

import pytest

from engine.geometry.placement import chain, chain_transform
from engine.read import ReadArtefact
from engine.recognise import sheets
from engine.recognise.tests.drawing import H, W, frame_block, rectangle, value_at
from vextrus.takeoff.tests.acceptance.t21c import step1_whole
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    LABELS,
    SCALE,
    Sheet,
    confirm,
    exclude,
    files_path,
    got,
    jev_says,
    proposals,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

STR = "QX-STR-R4.dwg"
ARC = "QX-ARC-R4.dwg"
DRAWN = {
    STR: [Sheet("S-41", "RAFT FOUNDATION PLAN"), Sheet("S-42", "SHEAR WALL SCHEDULE")],
    ARC: [
        Sheet("A-71", "GROUND FLOOR PLAN"),
        Sheet("A-72", "TYPICAL FLOOR PLAN"),
        Sheet("A-73", "ROOF PLAN"),
    ],
}
"""Each file's numbered sheets; after them each file holds a cover with no number and a blank layout."""
N = {STR: 3, ARC: 4}
"""Each file's sheets found: its numbered sheets and its cover, not its blank layout."""
NOTES = ("GENERAL NOTES", "1. ALL LEVELS ARE IN METRES", "2. READ WITH THE SCHEDULES")
COUNT_LINES = {
    "drawings.reports.sheets_found",
    "drawings.reports.sheets_found_drawn",
    "drawings.reports.sheets_found_layouts",
}


def _template_tab(d: step1_whole._Invented) -> None:
    """A layout tab holding a title block with no value over notes, its one viewport showing nothing
    of model space: a stale template, which the read proposes out as `blank` (m0-screens 4.5)."""
    tab = d.layout("Layout1")
    d.entity(
        "VIEWPORT",
        {"center": [420.0, 297.0, 0.0], "width": 900.0, "height": 650.0, "id": 1,
         "view_center_point": [-9_000_000.0, -9_000_000.0, 0.0], "view_height": 650.0},
        owner=tab,
    )  # fmt: skip
    d.insert(frame_block(d, labels=("SHEET TITLE", "SCALE", "SHEET NO", "DATE")), (0, 0, 0), owner=tab)
    for i in range(sheets.MIN_PAPER_CONTENT + 5):
        d.text(f"NOTE {i + 1}", (40, 400 - 12 * i, 0), owner=tab)


def with_a_cover(sha256: str, name: str, sheets_drawn: Sequence[Sheet]) -> ReadArtefact:
    """The invented sheets side by side, each a framed A1 at 1:50 with its number and title; after
    them a frame-sized rectangle of notes with a titled view and no title block (a cover the read
    proposes out, with no number); and a blank template layout tab."""
    d = step1_whole._Invented(name, sha256)
    block = frame_block(d, labels=LABELS)
    s = SCALE
    for n, sheet in enumerate(sheets_drawn):
        insert = d.insert(block, (n * 100_000.0, 0.0, 0.0), scale=(s, s, s))
        placed = chain_transform(chain(d.artefact(), [insert]))
        for cell, text in {0: sheet.title, 2: sheet.number}.items():
            if text:
                x, y, _ = placed.apply(value_at(cell))
                d.text(text, (x, y, 0.0), height=5.0 * s)
    ox = len(sheets_drawn) * 100_000.0
    d.entity("LWPOLYLINE", rectangle(ox, 0.0, ox + W * s, H * s))
    for i, line in enumerate(NOTES):
        d.text(line, (ox + 40 * s, (500 - 20 * i) * s, 0.0), height=5.0 * s)
    x0, y0, x1, y1 = step1_whole.BOTTOM_RIGHT
    step1_whole._grid(d, (ox + x0 * s, y0 * s, ox + x1 * s, y1 * s))
    d.text("KEY PLAN", (ox + x0 * s, (y0 - 12) * s, 0.0), height=6.0 * s)
    _template_tab(d)
    return d.artefact()


class Read:
    def __init__(self, qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(step1_whole, "artefact", with_a_cover)
        self.project_id = qs.project_id
        self.files: dict[str, uuid.UUID] = {}
        for name in DRAWN:
            self.files[name] = uploaded(qs.member, qs.project_id, name)
            run_job(qs.member, self.files[name], monkeypatch, readers(DRAWN))
        self.api = api_as(qs.member)

    def proposals(self) -> list[dict[str, Any]]:
        return proposals(self.api, self.project_id)

    def _unnumbered(self, blank: bool) -> dict[str, dict[str, Any]]:
        listed = [
            p
            for p in self.proposals()
            if not p["number"] and (p["proposed_exclusion"] == "blank") == blank
        ]
        by_file = {p["file_id"]: p for p in listed}
        assert len(listed) == len(by_file) == 2, listed
        return {name: by_file[str(file_id)] for name, file_id in self.files.items()}

    def covers(self) -> dict[str, dict[str, Any]]:
        """Each file's cover: its Proposal with no number, proposed out, not as blank."""
        found = self._unnumbered(blank=False)
        assert all(p["proposed_exclusion"] for p in found.values()), found
        return found

    def blanks(self) -> dict[str, dict[str, Any]]:
        """Each file's blank layout: its Proposal proposed out as `blank`."""
        return self._unnumbered(blank=True)

    def progress(self) -> dict[str, Any]:
        found: dict[str, Any] = got(self.api, f"{step1(self.project_id)}/progress")
        return found

    def count(self) -> dict[str, int]:
        """The header's Count, as the server sends it."""
        reply = self.progress()
        assert "count" in reply, f"the progress reply carries no header count: {sorted(reply)}"
        return {key: reply["count"][key] for key in ("found", "confirmed", "excluded")}

    def found(self, discipline: str) -> int:
        """The Discipline's N found, as the server's progress row sends it."""
        rows = {row["discipline"]: row for row in self.progress()["disciplines"]}
        n: int = rows[discipline]["found"]
        return n

    def sheets_found(self) -> dict[str, int | None]:
        """Each file's Sheets found, as the Drawing Set's rows show it."""
        rows = got(self.api, files_path(self.project_id))["files"]
        return {row["name"]: row["sheets_found"] for row in rows}

    def report_count(self, name: str) -> int:
        """The number in the file report's "N sheets found" line."""
        report = got(self.api, f"{files_path(self.project_id)}/{self.files[name]}/report")
        lines = [line for line in report["sheets"] if line["code"] in COUNT_LINES]
        assert len(lines) == 1, report["sheets"]
        sheets_said: int = lines[0]["params"]["sheets"]
        return sheets_said


@pytest.fixture
def read(qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline) -> Read:
    jev_says(jev_offline, "0.97")
    done = Read(qs_project, monkeypatch)
    # 5 numbered sheets, 2 covers and 2 blank layouts: every one is listed.
    assert len(done.proposals()) == 9
    return done


def counted(read: Read, expected: dict[str, int]) -> None:
    got_ = read.count()
    assert got_ == expected, f"the header's Count is not the one rule's: {got_}"


def files(read: Read) -> None:
    found = read.sheets_found()
    assert found == N, f"a file's Sheets found is not the one rule's: {found}"


def test_the_progress_reply_carries_the_header_count_of_every_sheet_but_the_blank_layouts(
    read: Read,
) -> None:
    counted(read, {"found": 7, "confirmed": 0, "excluded": 0})


def test_an_undecided_cover_with_no_number_is_a_sheet_found(read: Read) -> None:
    n = read.found("structural")
    assert n == 3, f"the cover is not counted: Structural N found {n}"


def test_the_header_count_is_the_discipline_rows_added_up(read: Read) -> None:
    rows = read.progress()["disciplines"]
    assert read.count()["found"] == sum(row["found"] for row in rows) == 7


def test_each_file_s_sheets_found_leaves_out_only_its_blank_layout(read: Read) -> None:
    files(read)


def test_the_files_sheets_found_add_up_to_the_header_count(read: Read) -> None:
    found = read.sheets_found()
    assert sum(n or 0 for n in found.values()) == read.count()["found"]


def test_the_drawing_set_summary_counts_the_same_sheets_read(read: Read) -> None:
    summary = got(read.api, files_path(read.project_id))["summary"]
    assert summary["code"] == "drawings.files.summary"
    assert summary["params"]["sheets"] == read.count()["found"] == 7


def test_a_file_report_says_the_sheets_found_its_row_shows(read: Read) -> None:
    said = {name: read.report_count(name) for name in DRAWN}
    assert said == N, f"a file report's sheets found is not the one rule's: {said}"


def test_confirming_a_cover_in_does_not_change_n(read: Read) -> None:
    cover = read.covers()[STR]
    assert confirm(read.api, read.project_id, [cover["id"]]).status_code == 200
    counted(read, {"found": 7, "confirmed": 1, "excluded": 0})
    files(read)


def test_an_excluded_numbered_sheet_stays_in_n_and_counts_as_excluded(read: Read) -> None:
    sheet = the(read.proposals(), "S-42")
    assert exclude(read.api, read.project_id, [sheet["id"]], "superseded").status_code == 200
    counted(read, {"found": 7, "confirmed": 0, "excluded": 1})
    files(read)


def test_an_excluded_cover_stays_in_n_and_counts_as_excluded(read: Read) -> None:
    cover = read.covers()[ARC]
    assert exclude(read.api, read.project_id, [cover["id"]], "cover_index").status_code == 200
    counted(read, {"found": 7, "confirmed": 0, "excluded": 1})
    files(read)
    said = read.report_count(ARC)
    assert said == N[ARC], f"a file report's sheets found is not the one rule's: {said}"


def test_a_blank_layout_is_counted_nowhere_whatever_the_qs_decides(read: Read) -> None:
    blanks = read.blanks()
    assert confirm(read.api, read.project_id, [blanks[STR]["id"]]).status_code == 200
    assert exclude(read.api, read.project_id, [blanks[ARC]["id"]], "blank").status_code == 200
    counted(read, {"found": 7, "confirmed": 0, "excluded": 0})
    files(read)


def test_confirmed_counts_confirmed_sheets_only(read: Read) -> None:
    listed = read.proposals()
    for number in ("S-41", "A-71", "A-72"):  # one at a time: a bulk act refuses sheets of one source
        assert confirm(read.api, read.project_id, [the(listed, number)["id"]]).status_code == 200
    assert (
        exclude(read.api, read.project_id, [the(listed, "A-73")["id"]], "duplicate").status_code == 200
    )
    counted(read, {"found": 7, "confirmed": 3, "excluded": 1})
