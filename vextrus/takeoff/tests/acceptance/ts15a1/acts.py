"""S15-A1's acts and readers (its tests import them by name): each Step 1 act the QS takes, run over
HTTP (as the screen takes it) or through the step1 service alone, on T-W319's invented Project
(`tw319.cost`); and what one act's SQL statements read and write.

"A read of the set" is one statement that selects a row for every Sheet of the Drawing Set: from
drawings' Sheet tables (the Sheets) or its View table (the Views). A statement on one Sheet, or on
the Sheets an act names, is not one. A statement whose row count the driver does not give is counted
as a read of the set (it cannot be shown to be less).
"""

import re
import uuid
from collections import Counter
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Protocol

from django.db import connection

from engine.messages import conflicts as conflict_codes
from vextrus.takeoff.library import SHEETS
from vextrus.takeoff.models import StepProgress
from vextrus.takeoff.services import step1
from vextrus.takeoff.tests.acceptance.tw319.cost import (
    ACTED_ON,
    CostProject,
    kinds_of,
    low_confidence,
    missing_number,
    posted,
    ready_api,
)
from vextrus.testing.auth import Api

QS_NAME = "A trial QS"
TYPED = "S-900"
"""A number no invented sheet has (the typed-number answer)."""
GIVEN_LIST = "S-001 to S-006"
"""A typed range of the structural Sheets (the drawing-list act)."""

# Captured statements -------------------------------------------------------------------------------

_NOT_COUNTED = ("SAVEPOINT", "RELEASE SAVEPOINT", "ROLLBACK TO SAVEPOINT", "SET ")
_SET_TABLES = {
    "drawings_sheet": "Sheets",
    "drawings_sheetrevision": "Sheets",
    "drawings_view": "Views",
}
_FROM = re.compile(r'\bFROM\s+"(?P<table>\w+)"', re.IGNORECASE)
_SELECT = re.compile(r"^\s*SELECT\b(?P<columns>.*?)\bFROM\b", re.IGNORECASE | re.DOTALL)
_PROGRESS_WRITE = re.compile(r'^\s*(?:INSERT\s+INTO|UPDATE)\s+"takeoff_stepprogress"', re.IGNORECASE)


@dataclass(frozen=True)
class Statement:
    sql: str
    rows: int
    """The driver's row count after it ran (-1: not given)."""


@contextmanager
def captured() -> Iterator[list[Statement]]:
    """Every SQL statement run on the default connection inside the block (savepoints and SETs not
    kept), with its row count."""
    seen: list[Statement] = []

    def keep(execute: Callable[..., Any], sql: str, params: Any, many: bool, context: Any) -> Any:
        done = execute(sql, params, many, context)
        if not sql.lstrip().upper().startswith(_NOT_COUNTED):
            seen.append(Statement(sql, getattr(context["cursor"], "rowcount", -1)))
        return done

    with connection.execute_wrapper(keep):
        yield seen


def set_reads(seen: list[Statement], sheets: int) -> dict[str, int]:
    """How many statements read the set's Sheets and its Views (see the module's words)."""
    found: Counter[str] = Counter({"Sheets": 0, "Views": 0})
    for statement in seen:
        if _SELECT.match(statement.sql) is None:
            continue
        table = _FROM.search(statement.sql)
        what = _SET_TABLES.get(table.group("table")) if table else None
        if what is not None and (statement.rows < 0 or statement.rows >= sheets):
            found[what] += 1
    return dict(found)


def progress_writes(seen: list[Statement]) -> int:
    """How many statements write Step 1's progress rows."""
    return sum(1 for s in seen if _PROGRESS_WRITE.match(s.sql))


def selecting_anchors(seen: list[Statement]) -> list[str]:
    """The statements that select a stored anchors column (only drawings' Sheet and View rows have
    one: vextrus/drawings/models.py)."""
    found = []
    for statement in seen:
        columns = _SELECT.match(statement.sql)
        if columns is not None and '"anchors"' in columns.group("columns"):
            found.append(statement.sql)
    return found


def progress_rows(project: CostProject) -> dict[str, tuple[int, int | None, int, str]]:
    """Step 1's stored progress rows: each Discipline's (n, N, open Questions, status)."""
    with project.member.acting():
        return {
            row.discipline: (row.placed, row.total, row.open_questions, row.status)
            for row in StepProgress.objects.filter(
                project_id=project.project_id, step=SHEETS, building_id=None
            )
        }


def progress_counted(project: CostProject) -> dict[str, tuple[int, int | None, int, str]]:
    """The same, as `step1.progress` counts it now."""
    with project.member.acting():
        rows = step1.progress(project.project_id).disciplines
    return {r.discipline or "": (r.confirmed, r.total, r.open_questions, r.status) for r in rows}


# The two ways to act -------------------------------------------------------------------------------


class Way(Protocol):
    """One way to take Step 1's acts on a Project: each call runs the act and checks it was done."""

    def confirm(self, proposals: list[uuid.UUID]) -> None: ...
    def exclude(self, proposals: list[uuid.UUID]) -> None: ...
    def undo(self) -> None: ...
    def answer(self, question: uuid.UUID, option: str, text: str = "") -> None: ...
    def set_list(self, discipline: str, text: str) -> None: ...


class OverHttp:
    """As the screen takes them: the QS's POSTs to Step 1's API, each answered 200."""

    def __init__(self, project: CostProject, api: Api | None = None) -> None:
        self.project = project
        self.api = api if api is not None else ready_api(project)

    def _post(self, tail: str, body: dict[str, Any]) -> None:
        posted(self.api, f"{self.project.path}/{tail}", body)()

    def confirm(self, proposals: list[uuid.UUID]) -> None:
        self._post("confirm", {"proposals": [str(p) for p in proposals]})

    def exclude(self, proposals: list[uuid.UUID]) -> None:
        self._post("exclude", {"proposals": [str(p) for p in proposals], "reason": "duplicate"})

    def undo(self) -> None:
        self._post("undo", {})

    def answer(self, question: uuid.UUID, option: str, text: str = "") -> None:
        self._post(f"questions/{question}/answer", {"option": option, "text": text})

    def set_list(self, discipline: str, text: str) -> None:
        self._post("drawing-list", {"discipline": discipline, "text": text})


class ThroughTheService:
    """The same acts through `step1`'s functions alone, as the QS acting (no HTTP route around
    them)."""

    def __init__(self, project: CostProject) -> None:
        self.project = project

    def confirm(self, proposals: list[uuid.UUID]) -> None:
        with self.project.member.acting():
            step1.confirm(self.project.project_id, proposals, actor_name=QS_NAME)

    def exclude(self, proposals: list[uuid.UUID]) -> None:
        with self.project.member.acting():
            step1.exclude(self.project.project_id, proposals, "duplicate", actor_name=QS_NAME)

    def undo(self) -> None:
        with self.project.member.acting():
            step1.undo(self.project.project_id)

    def answer(self, question: uuid.UUID, option: str, text: str = "") -> None:
        with self.project.member.acting():
            step1.answer(self.project.project_id, question, option, text, actor_name=QS_NAME)

    def set_list(self, discipline: str, text: str) -> None:
        with self.project.member.acting():
            step1.set_list(self.project.project_id, discipline, text, actor_name=QS_NAME)


# The acts ------------------------------------------------------------------------------------------


def stale_conflict(project: CostProject) -> uuid.UUID:
    """A `same_title` conflict Question holding S-002 and S-003 that the set no longer has (their
    titles differ): the next conflict check retires it."""
    held = [project.proposal_of["S-002"], project.proposal_of["S-003"]]
    with project.member.acting():
        return step1.raise_question(
            project.project_id,
            "conflict",
            conflict_codes.SAME_TITLE(title="Trial sheet S-002", sheets=2),
            subject_id=project.sheet_of["S-002"],
            discipline="structural",
            options=[{"key": k, "picked": False} for k in ("keep_all", "keep_open")],
            blocks=held,
        )


@dataclass(frozen=True)
class Act:
    """One of the QS's Step 1 acts: what is set up before it (not measured), then the act."""

    name: str
    before: Callable[[CostProject, Way], Any]
    act: Callable[[CostProject, Way, Any], None]


def _nothing(project: CostProject, way: Way) -> None:
    return None


def _confirmed(project: CostProject, way: Way) -> None:
    way.confirm([project.proposal_of[ACTED_ON]])


def _excluded(project: CostProject, way: Way) -> None:
    way.exclude([project.proposal_of[ACTED_ON]])


ACTS = (
    Act("confirm a Sheet", _nothing, lambda p, w, _: w.confirm([p.proposal_of[ACTED_ON]])),
    Act("exclude a Sheet", _nothing, lambda p, w, _: w.exclude([p.proposal_of[ACTED_ON]])),
    Act("undo a confirm", _confirmed, lambda p, w, _: w.undo()),
    Act("undo an exclude", _excluded, lambda p, w, _: w.undo()),
    Act(
        "confirm a Sheet a stale conflict holds",
        lambda p, w: stale_conflict(p),
        lambda p, w, _: w.confirm([p.proposal_of["S-002"]]),
    ),
    Act(
        "answer a kind",
        lambda p, w: low_confidence(p),
        lambda p, w, question: w.answer(question, kinds_of()[0]),
    ),
    Act(
        "keep a Question open",
        lambda p, w: low_confidence(p),
        lambda p, w, question: w.answer(question, "keep_open"),
    ),
    Act(
        "type a number",
        lambda p, w: missing_number(p),
        lambda p, w, question: w.answer(question, "type_number", TYPED),
    ),
    Act("give a drawing list", _nothing, lambda p, w, _: w.set_list("structural", GIVEN_LIST)),
)
ACT_NAMES = [a.name for a in ACTS]


def measured(project: CostProject, way: Way, act: Act) -> list[Statement]:
    """The act's statements (its set-up run first, not measured)."""
    state = act.before(project, way)
    with captured() as seen:
        act.act(project, way, state)
    return seen
