"""The sheet list is one pass (T-W319 section 3, case 9): `drawings.sheets(set_id)` costs the same
statements on 20 sheets and on 220 (item 1: "A query chain per Sheet in the Sheet list"), each sheet
it lists is what `drawings.sheet(sheet_id)` returns for it (the single-sheet read is the reference),
and the default still gives the anchors the read job and the export read.

The fixture is T-W319's recipe, built here (no import from another module's acceptance folder):
three DWG files of `size // 3` printed sheets each, three views a sheet. Every literal is invented.
"""

import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any

import pytest
from django.db import connection

from engine.check.bangla_ansi import BanglaAnsi
from engine.read.anchor import DwgAnchor
from engine.recognise.types import Box, CheckOutcome, CheckResult, ViewCandidate, ViewKind
from vextrus.drawings import services as drawings
from vextrus.projects import services as projects
from vextrus.testing.drawings import (
    QsProject,
    add,
    artefact_for,
    drawing,
    frame,
    read_dwg,
    sheet_candidate,
)

pytestmark = pytest.mark.django_db

SMALL = 20
LARGE = 220
FILES = (("KR-STR-R0.dwg", "S"), ("KR-ARC-R0.dwg", "A"), ("KR-ELE-R0.dwg", "E"))


def _views(i: int, anchors: tuple[DwgAnchor, ...] = ()) -> list[ViewCandidate]:
    box = frame(i)
    return [
        ViewCandidate(box=Box(box.x0 + 150, 0, box.x1, 30), kind=ViewKind.TITLE_BLOCK),
        ViewCandidate(
            box=Box(box.x0 + 10, 40, box.x0 + 100, 140),
            kind=ViewKind.PLAN,
            title=f"Mock plan {i}",
            anchors=anchors,
        ),
        ViewCandidate(
            box=Box(box.x0 + 110, 40, box.x0 + 200, 140), kind=ViewKind.DETAIL, title=f"Mock detail {i}"
        ),
    ]


def set_of(qs_project: QsProject, size: int) -> tuple[uuid.UUID, uuid.UUID]:
    """A new Project and its Drawing Set of `size // 3` printed sheets in each of three DWG files."""
    member = qs_project.member
    with member.acting():
        project_id = projects.create(code=f"V-{uuid.uuid4().hex[:6]}", name="A mock list project").id
    for name, prefix in FILES:
        numbers = [f"{prefix}-{n:03d}" for n in range(1, size // 3 + 1)]
        file_id = add(member, project_id, name, drawing(marker=f"{project_id}-{name}")).file.id
        read_dwg(member, file_id, numbers, titles=[f"Mock sheet {n}" for n in numbers])
    with member.acting():
        drawing_set = drawings.set_of(project_id)
        assert drawing_set is not None
        for sheet in drawings.sheets(drawing_set.id):
            drawings.record_views(sheet.id, _views(sheet.ordinal - 1))
    return project_id, drawing_set.id


@contextmanager
def counted() -> Iterator[list[str]]:
    seen: list[str] = []

    def keep(execute: Callable[..., Any], sql: str, params: Any, many: bool, context: Any) -> Any:
        if not sql.lstrip().upper().startswith(("SAVEPOINT", "RELEASE SAVEPOINT", "SET ")):
            seen.append(sql)
        return execute(sql, params, many, context)

    with connection.execute_wrapper(keep):
        yield seen


def test_the_sheet_list_costs_the_same_on_20_sheets_and_on_220(qs_project: QsProject) -> None:
    counts = {}
    for size in (SMALL, LARGE):
        _project_id, set_id = set_of(qs_project, size)
        with qs_project.member.acting(), counted() as seen:
            listed = drawings.sheets(set_id)
        assert len(listed) == size // 3 * 3
        counts[size] = len(seen)

    assert counts[LARGE] == counts[SMALL], counts


def test_each_listed_sheet_is_what_the_single_sheet_read_returns(qs_project: QsProject) -> None:
    project_id, set_id = set_of(qs_project, SMALL)
    # A PDF still queued for one Discipline: its sheets have a reason of their own (not yet read).
    add(qs_project.member, project_id, "KR-ARC-R0.pdf", drawing("pdf"))
    with qs_project.member.acting():
        listed = drawings.sheets(set_id)
        alone = [drawings.sheet(s.id) for s in listed]

    assert listed == alone
    assert all(s.plot.none is not None for s in listed)
    assert len({s.plot.none["code"] for s in listed if s.plot.none}) >= 2


def test_the_default_list_and_views_keep_the_stored_anchors(qs_project: QsProject) -> None:
    member = qs_project.member
    name = "KR-STR-R0.dwg"
    found = add(member, qs_project.project_id, name, drawing(marker="anchored")).file
    on_sheet = DwgAnchor(found.sha256, "synthetic", "1", "model/7", (), "2A1")
    on_view = DwgAnchor(found.sha256, "synthetic", "1", "model/7", ("3B0",), "3B4")
    with member.acting():
        services_read(found.id, found.sha256, name, found.group, on_sheet, on_view)
        drawing_set = drawings.set_of(qs_project.project_id)
        assert drawing_set is not None
        [listed] = drawings.sheets(drawing_set.id)
        views = drawings.views(listed.id)

    [plan] = [v for v in views if v.kind == ViewKind.PLAN]
    assert [stored(a) for a in listed.anchors] == [on_sheet.to_json()]
    assert [stored(a) for a in plan.anchors] == [on_view.to_json()]


def stored(anchor: drawings.StoredAnchor) -> dict[str, Any]:
    """A stored anchor as its DwgAnchor wrote it: its detail and its two columns."""
    return {
        **anchor.detail,
        "source_sha256": anchor.source_sha256,
        "reader_version": anchor.reader_version,
    }


def services_read(
    file_id: uuid.UUID, sha256: str, name: str, group: str, on_sheet: DwgAnchor, on_view: DwgAnchor
) -> None:
    """One anchored printed sheet taken to "read" through the services, as `read_dwg` does."""
    drawings.store_artefact(file_id, artefact_for(sha256, name, 1))
    drawings.record_reports(
        file_id,
        cross_check=CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED),
        bangla_ansi=BanglaAnsi(()),
    )
    [printed] = drawings.record_sheets(
        file_id, [sheet_candidate(0, group, number="S-031", title="Mock sheet", anchors=(on_sheet,))]
    )
    drawings.record_views(printed.id, _views(0, (on_view,)))
    drawings.mark_read(file_id)
