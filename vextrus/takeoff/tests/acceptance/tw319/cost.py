"""T-W319's fixture and counter (its tests import them by name): a Project of `sheets` printed sheets
in three DWG files, three views each, proposed and covered as the read job leaves them (through the
services, as `vextrus.testing.takeoff` does for three), and the SQL statements a call runs.

Every name, number and title here is invented. Only the sheet count differs between `SMALL` and
`LARGE`: the same three Disciplines, the same three views per sheet, the same acted-on sheet
(`S-001`) and one unnumbered structural sheet at both sizes. So a statement count that differs
between them is a statement paid per sheet the act does not name.
"""

import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

from django.db import connection

from engine.recognise.sheets import default_conventions
from engine.recognise.types import Box, ViewCandidate, ViewKind
from vextrus.drawings import services as drawings
from vextrus.projects import services as projects
from vextrus.takeoff.messages import proposals as proposal_words
from vextrus.takeoff.messages import step1 as step1_words
from vextrus.takeoff.services import step1
from vextrus.testing.auth import Api, api_as
from vextrus.testing.drawings import QsProject, add, drawing, frame, read_dwg
from vextrus.testing.tenancy import Member

SMALL = 20
LARGE = 220

FILES = (("KR-STR-R0.dwg", "S"), ("KR-ARC-R0.dwg", "A"), ("KR-ELE-R0.dwg", "E"))
ACTED_ON = "S-001"
UNNUMBERED_TITLE = "Untagged trial sheet"


@dataclass(frozen=True)
class CostProject:
    """A Project of `size` printed sheets (`size // 3` a file), its sheets and Proposals by number."""

    member: Member
    project_id: uuid.UUID
    size: int
    sheet_of: dict[str | None, uuid.UUID]
    """Each printed sheet's id by its number (the unnumbered one under None)."""
    proposal_of: dict[str | None, uuid.UUID]
    """Each printed sheet's Proposal's id by its number (the unnumbered one under None)."""

    @property
    def path(self) -> str:
        return f"/api/projects/{self.project_id}/takeoff/step1"


def _views(i: int) -> list[ViewCandidate]:
    """A title block, a plan and a detail inside frame `i`, invented titles."""
    box = frame(i)
    return [
        ViewCandidate(box=Box(box.x0 + 150, 0, box.x1, 30), kind=ViewKind.TITLE_BLOCK),
        ViewCandidate(
            box=Box(box.x0 + 10, 40, box.x0 + 100, 140), kind=ViewKind.PLAN, title=f"Trial plan {i}"
        ),
        ViewCandidate(
            box=Box(box.x0 + 110, 40, box.x0 + 200, 140),
            kind=ViewKind.DETAIL,
            title=f"Trial detail {i}",
        ),
    ]


def project_of(qs_project: QsProject, sheets: int) -> CostProject:
    """A new Project of the QS's Developer with `sheets // 3` printed sheets in each of three DWG
    files (S-001.., A-001.., E-001..; the structural file's last sheet has no number), each with three
    views, proposed and its Coverage written."""
    member = qs_project.member
    each = sheets // 3
    with member.acting():
        project_id = projects.create(code=f"W-{uuid.uuid4().hex[:6]}", name="A trial cost project").id
    for name, prefix in FILES:
        numbers: list[str | None] = [f"{prefix}-{n:03d}" for n in range(1, each + 1)]
        if prefix == "S":
            numbers[-1] = None
        file_id = add(member, project_id, name, drawing(marker=f"{project_id}-{name}")).file.id
        titles = [UNNUMBERED_TITLE if n is None else f"Trial sheet {n}" for n in numbers]
        read_dwg(member, file_id, numbers, titles=titles)
    with member.acting():
        drawing_set = drawings.set_of(project_id)
        assert drawing_set is not None
        listed = drawings.sheets(drawing_set.id)
        for sheet in listed:  # its frame is its place in its file (`read_dwg`)
            drawings.record_views(sheet.id, _views(sheet.ordinal - 1))
        proposal_of = {s.number: step1.propose_sheet(s.id) for s in listed}
        for sheet in listed:
            step1.record_coverage(sheet.id)
    assert len(listed) == 3 * each, len(listed)
    return CostProject(member, project_id, sheets, {s.number: s.id for s in listed}, proposal_of)


def kinds_of(discipline: str = "structural") -> tuple[str, str]:
    """Two kinds of the Discipline, by 13's conventions (no literal kind named here)."""
    first, second, *_ = default_conventions().sheet_kinds[discipline]
    return first, second


def low_confidence(
    project: CostProject, number: str = ACTED_ON, discipline: str = "structural"
) -> uuid.UUID:
    """A `low_confidence` Question on the sheet, raised as the read job raises it (`proposals.py`):
    Jev unsure between two kinds of its Discipline, the Question holding its Proposal."""
    kinds = kinds_of(discipline)
    with project.member.acting():
        return step1.raise_question(
            project.project_id,
            "low_confidence",
            proposal_words.WHICH_KIND(sheet=number, named="number"),
            subject_id=project.sheet_of[number],
            discipline=discipline,
            options=[{"key": k, "picked": False} for k in (*kinds, "keep_open")],
            blocks=[project.proposal_of[number]],
        )


def missing_number(project: CostProject) -> uuid.UUID:
    """The unnumbered structural sheet's `missing` Question, raised as the read job raises it."""
    with project.member.acting():
        return step1.raise_question(
            project.project_id,
            "missing",
            step1_words.NO_NUMBER(),
            subject_id=project.sheet_of[None],
            discipline="structural",
            options=[{"key": k, "picked": False} for k in ("no_number", "type_number", "keep_open")],
            blocks=[project.proposal_of[None]],
        )


# The counter --------------------------------------------------------------------------------------

_NOT_COUNTED = ("SAVEPOINT", "RELEASE SAVEPOINT", "ROLLBACK TO SAVEPOINT", "SET ")


@contextmanager
def captured() -> Iterator[list[str]]:
    """Every SQL statement run on the default connection inside the block, but savepoints and SETs."""
    seen: list[str] = []

    def keep(execute: Callable[..., Any], sql: str, params: Any, many: bool, context: Any) -> Any:
        if not sql.lstrip().upper().startswith(_NOT_COUNTED):
            seen.append(sql)
        return execute(sql, params, many, context)

    with connection.execute_wrapper(keep):
        yield seen


def queries(call: Callable[[], Any]) -> int:
    """How many statements `call()` runs (see `captured`)."""
    with captured() as seen:
        call()
    return len(seen)


def ready_api(project: CostProject) -> Api:
    """The QS on the API, its CSRF token and session already fetched (so no count pays for them)."""
    api = api_as(project.member)
    api.csrf_token()
    assert api.get(f"{project.path}/progress").status_code == 200
    return api


def posted(api: Api, path: str, body: dict[str, Any]) -> Callable[[], Any]:
    """A POST that must answer 200, as a call `queries` counts."""

    def call() -> Any:
        response = api.post(path, body)
        assert response.status_code == 200, response.content
        return response

    return call
