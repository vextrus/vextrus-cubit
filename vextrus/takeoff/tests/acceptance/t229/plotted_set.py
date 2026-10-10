"""A set of one or more DWGs with no drawing list, every sheet's Plot page kept, as
`test_plot_and_local_gaps` builds it, and a second file of a Discipline read after the first.

Each DWG's sheets are read through `read_dwg` (number and title from the title block), each kept page
through `drawings.record_plot` (the seam the read job's Plot matching keeps a page through), its title
block reading the sheet's own number and title, and the Questions asked as the read job asks them
after each file (`read_propose.proposals.set_questions`).
"""

from typing import Any

from engine.check import register as register_check
from engine.read.anchor import PdfAnchor
from engine.read.pdf.types import Page, TextItem, TextSource
from engine.recognise.types import PlotMatch
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import plot, proposals
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.tenancy import Member

A1 = (2384.0, 1684.0)
"""An A1 page, landscape, in points."""

TITLES = {"S": "COLUMN LAYOUT", "A": "FLOOR PLAN"}


def _page(pdf_sha256: str, page: int, number: str, title: str) -> Page:
    """A PDF page whose title block reads `number` and `title`, as `engine.read.pdf` returns it."""

    def item(text: str, i: int, size: float) -> TextItem:
        box = (2000.0, 100.0 + 60.0 * i, 2300.0, 140.0 + 60.0 * i)
        anchor = PdfAnchor(pdf_sha256, "vextrus-pdf", "1", page, i, box)
        return TextItem(text, TextSource.TEXT, anchor, size, 0.0, False, "Arial")

    return Page(
        source_sha256=pdf_sha256,
        number=page,
        width=A1[0],
        height=A1[1],
        rotate=0,
        crop=(0.0, 0.0, A1[0], A1[1]),
        scan=False,
        items=(item(number, 0, 40.0), item(title, 1, 20.0)),
    )


class PlottedSet:
    def __init__(self, qs_project: QsProject) -> None:
        self.member: Member = qs_project.member
        self.project_id = qs_project.project_id
        self.proposal: dict[str, Any] = {}

    def read(self, dwg_name: str, numbers: list[str]) -> None:
        """Add `dwg_name` and its PDF, read the DWG's sheets, keep each sheet's matching Plot page,
        then ask the set's Questions, as the read job does once the file is read."""
        dwg = add(self.member, self.project_id, dwg_name, drawing()).file
        pdf_name = dwg_name.removesuffix(".dwg") + ".pdf"
        pdf = add(self.member, self.project_id, pdf_name, drawing("pdf")).file
        titles = [f"{TITLES[n[0]]} {n}" for n in numbers]
        read_dwg(self.member, dwg.id, numbers, titles=titles)
        with self.member.acting():
            drawing_set = drawings.set_of(self.project_id)
            assert drawing_set is not None
            sheets = {s.number: s for s in drawings.sheets(drawing_set.id) if s.number in numbers}
            for page, number in enumerate(numbers, start=1):
                sheet = sheets[number]
                self.proposal[number] = step1.propose_sheet(sheet.id)
                step1.record_coverage(sheet.id)
                shown = _page(pdf.sha256, page, number, sheet.title)
                drawings.record_plot(sheet.id, PlotMatch(shown, sheet=plot.candidate(sheet)))
            proposals.set_questions(self.project_id, trigger_file=dwg.id)

    def ask(self) -> None:
        with self.member.acting():
            proposals.set_questions(self.project_id)

    def agrees(self) -> dict[str | None, bool]:
        return {p["number"]: p["agrees"] for p in self.proposals()}

    def proposals(self) -> list[dict[str, Any]]:
        path = f"/api/projects/{self.project_id}/takeoff/step1/proposals"
        found: list[dict[str, Any]] = api_as(self.member).get(path).json()["proposals"]
        return found

    def questions(self) -> list[dict[str, Any]]:
        path = f"/api/projects/{self.project_id}/takeoff/step1/questions"
        found: list[dict[str, Any]] = api_as(self.member).get(path).json()["questions"]
        return found

    def gap_questions(self) -> list[dict[str, Any]]:
        """The open register Check Questions (with no drawing list, only the numbering's gaps)."""
        return [
            q
            for q in self.questions()
            if q["check_code"] == register_check.CODE and q["status"] == "open"
        ]

    def the_gap_question(self) -> dict[str, Any]:
        asked = self.gap_questions()
        assert len(asked) == 1, f"not one gap Question: {len(asked)}"
        return asked[0]

    def answer(self, question_id: str, option: str) -> Any:
        path = f"/api/projects/{self.project_id}/takeoff/step1/questions/{question_id}/answer"
        return api_as(self.member).post(path, {"option": option})

    def confirm(self, numbers: list[str]) -> Any:
        path = f"/api/projects/{self.project_id}/takeoff/step1/confirm"
        return api_as(self.member).post(path, {"proposals": [str(self.proposal[n]) for n in numbers]})

    def undo(self) -> Any:
        return api_as(self.member).post(f"/api/projects/{self.project_id}/takeoff/step1/undo", {})


def strings(value: object) -> set[str]:
    """Every string a Question's params hold, however nested."""
    if isinstance(value, str):
        return {value}
    if isinstance(value, dict):
        return set().union(*(strings(v) for v in value.values())) if value else set()
    if isinstance(value, list | tuple):
        return set().union(*(strings(v) for v in value)) if value else set()
    return set()
