"""Fixtures for a Drawing Set with files, sheets and views (ticket 14), for 14's own tests and the
tickets that build on `drawings` (19a, 20b, 21a to 21c).

- `drawing(kind, marker)`: invented bytes that open as a DWG or a PDF by their first bytes (never a
  real drawing: only a reader test needs one, and it uses `engine/fixtures`).
- `qs_project`: a signed-in QS with a Project of their own Developer; `add(member, project_id, name,
  content)` adds a file through `drawings.services.add_file`, acting as the member.
- `read_dwg(member, file_id, sheets=…)`: a DWG taken to "read" as a read job would, through the
  services: its artefact kept (11's synthetic `Drawing`, stamped with the file's sha256), its reports,
  its sheets (one printed sheet a frame), a view each, a render each, and marked read.
- The fake read job, `read_stub` (on the test queue `vextrus_test_drawings`), runs steps on
  `drawings.services.step_store()` that a test scripts per file and step (`script(...)`): `ok`,
  `fail`, `wait_for_cancel`, `mark_read` (the last step marks the file read in its own transaction).
  `start_worker(...)` runs `jobs.run_worker` in a child that imports this module (09's
  `vextrus.testing.jobs.start_worker` child imports only its own), so the stub is declared there.
"""

import json
import os
import subprocess
import sys
import time
import uuid
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass, replace
from typing import Any

import pytest
from django.conf import settings
from django.db import connections
from pytest_django.plugin import DjangoDbBlocker

from engine.check.bangla_ansi import BanglaAnsi
from engine.read.anchor import DwgAnchor
from engine.read.artefact import ReadArtefact
from engine.read.pdf.types import Lettering, MadeBy, PageReport, PdfReport
from engine.recognise.types import (
    Box,
    CheckOutcome,
    CheckResult,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from engine.render import buffers
from engine.render.fixtures.artefacts import Drawing
from vextrus.drawings import services
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import jobs
from vextrus.projects import services as projects
from vextrus.testing.jobs import database_url
from vextrus.testing.tenancy import Member

TEST_QUEUE = "vextrus_test_drawings"


def drawing(kind: str = "dwg", marker: str = "") -> bytes:
    """Invented bytes that are a DWG or a PDF by their first bytes; `marker` makes them unique."""
    body = f"\n% invented for a test: {marker or uuid.uuid4().hex}\n".encode()
    if kind == "dwg":
        return b"AC1032" + b"\x00" * 122 + body
    return b"%PDF-1.7\n" + body + b"%%EOF\n"


@dataclass(frozen=True)
class QsProject:
    member: Member
    project_id: uuid.UUID


@pytest.fixture
def qs_project(sign_in: Callable[..., Member]) -> QsProject:
    member = sign_in(role="qs")
    with member.acting():
        project = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="A test project")
    return QsProject(member, project.id)


def add(member: Member, project_id: uuid.UUID, name: str, content: bytes) -> services.Added:
    """Add a file as the member, as 21a's upload operation will (its name as the QS's label)."""
    import io

    with member.acting():
        return services.add_file(
            project_id, name=name, content=io.BytesIO(content), actor_name=member.user.name
        )


def pdf_report(
    sha256: str, pages: int, *, lettering: Lettering = Lettering.TEXT, refused: bool = False
) -> PdfReport:
    """A PDF's upload report (12's shape) of `pages` drawn pages; a scan when `refused`."""
    page = PageReport(
        number=1, readable=True, rotate=0, width=1190.0, height=842.0, shx_comments=0, chars=10,
        hidden_chars=0, unmapped_chars=0, mirrored_texts=0, strokes=100, fills=0, images=0,
        picture_share=0.0, mostly_picture=False, layers=(), lettering=lettering, scan=refused,
    )  # fmt: skip
    return PdfReport(
        source_sha256=sha256,
        producer=None,
        creator=None,
        made_by=MadeBy.UNKNOWN,
        pages=tuple(replace(page, number=n) for n in range(1, pages + 1)),
        fonts=(),
        layers=(),
        extras={},
        refused={"code": "engine.pdf_report.refused_scan", "params": {}} if refused else None,
        messages=(),
    )


# A DWG taken to "read", through the services ----------------------------------------------------


def artefact_for(sha256: str, name: str, frames: int, *, layouts: Sequence[str] = ()) -> ReadArtefact:
    """11's synthetic drawing with `frames` sheet frames laid out in the drawing (210 x 148 each,
    side by side), stamped with the file's sha256 (a kept artefact must be its file's)."""
    d = Drawing()
    for i in range(frames):
        x = i * 300.0
        square = [[x, 0, 0, 0, 0], [x + 210, 0, 0, 0, 0], [x + 210, 148, 0, 0, 0], [x, 148, 0, 0, 0]]
        d.entity("LWPOLYLINE", {"points": square, "flags": 1, "lineweight": 50}, layer="FRAME")
        d.text(f"S-{i + 1:02d}", (x + 180, 10, 0), height=3)
    made = d.artefact()
    s = made.summary
    return ReadArtefact.build(
        source_sha256=sha256,
        source_name=name,
        format=s.format,
        reader=s.reader,
        reader_version=s.reader_version,
        layouts=list(s.layouts) + list(layouts),
        insunits=s.insunits,
        notes=list(s.notes),
        blocks=made.blocks.values(),
        entities=made.entities.values(),
    )


def frame(i: int) -> Box:
    return Box(i * 300.0, 0.0, i * 300.0 + 210.0, 148.0)


def sheet_candidate(
    i: int,
    group: str,
    *,
    number: str | None = None,
    title: str | None = None,
    discipline: str | None = None,
    revision_mark: str | None = None,
    issue_date: str | None = None,
    anchors: tuple[DwgAnchor, ...] = (),
) -> SheetCandidate:
    def sourced(value: str | None) -> Sourced | None:
        return None if value is None else Sourced(value, ValueSource.TITLE_BLOCK_TEXT)

    return SheetCandidate(
        location=SheetLocation(box=frame(i)),
        number=sourced(number),
        title=sourced(title),
        discipline=None if discipline is None else Sourced(discipline, ValueSource.FILE),
        revision_mark=sourced(revision_mark),
        issue_date=sourced(issue_date),
        anchors=anchors,
        group=group,
    )


def read_dwg(
    member: Member,
    file_id: uuid.UUID,
    numbers: Sequence[str | None],
    *,
    titles: Sequence[str] | None = None,
    issue_dates: Sequence[str | None] | None = None,
    mark_read: bool = True,
) -> list[services.SheetView]:
    """Take a DWG through the services as a read job would: artefact, reports, sheets (one frame
    each, numbered as given), a title-block view each, a render each; read unless told not."""
    with member.acting():
        found = services.file(file_id)
        artefact = artefact_for(found.sha256, found.name, len(numbers))
        services.store_artefact(file_id, artefact)
        services.record_reports(
            file_id,
            cross_check=CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED),
            bangla_ansi=BanglaAnsi(()),
        )
        candidates = [
            sheet_candidate(
                i,
                found.group,
                number=number,
                title=(titles[i] if titles else f"Sheet {i + 1}"),
                issue_date=(issue_dates[i] or None) if issue_dates else None,
            )
            for i, number in enumerate(numbers)
        ]
        printed = services.record_sheets(file_id, candidates)
        for i, sheet in enumerate(printed):
            box = frame(i)
            services.record_views(
                sheet.id,
                [ViewCandidate(box=Box(box.x0 + 150, 0, box.x1, 30), kind=ViewKind.TITLE_BLOCK)],
            )
            built = buffers.build(artefact, SheetCandidate(SheetLocation(box=box)))
            services.record_render(sheet.id, built)
        if mark_read:
            services.mark_read(file_id)
        return printed


# The fake read job, on drawings' own StepStore ----------------------------------------------------


def script(file_id: uuid.UUID, **actions: str) -> None:
    """What each step of the stub does for this file (`ok` if unscripted), written by the owner."""
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(
            "create table if not exists vextrus_testing.drawings_script"
            " (file_id uuid, step text, action text, primary key (file_id, step))"
        )
        cursor.execute(f"grant select on vextrus_testing.drawings_script to {settings.VEXTRUS_APP_ROLE}")
        for step, action in actions.items():
            cursor.execute(
                "insert into vextrus_testing.drawings_script values (%s, %s, %s)"
                " on conflict (file_id, step) do update set action = excluded.action",
                [file_id, step, action],
            )


def _action(file_id: uuid.UUID, step: str) -> str:
    with connections["default"].cursor() as cursor:
        cursor.execute("select to_regclass('vextrus_testing.drawings_script') is not null")
        (exists,) = cursor.fetchone() or (False,)
        if not exists:
            return "ok"
        cursor.execute(
            "select action from vextrus_testing.drawings_script where file_id = %s and step = %s",
            [file_id, step],
        )
        row = cursor.fetchone()
    return row[0] if row else "ok"


STUB_STEPS = (services.OPENING, services.READING, services.SECOND_READER, services.FINISHING)


def _body(run: jobs.Run, file_id: uuid.UUID, step: str) -> Callable[[], jobs.StepResult]:
    def body() -> jobs.StepResult:
        action = _action(file_id, step)
        if action == "fail":
            raise RuntimeError("the step failed, as scripted")
        if action == "wait_for_cancel":
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                run.check_cancelled()
                time.sleep(0.05)
            raise RuntimeError("the step waited a minute for a cancel that never came")
        if action.startswith("sleep:"):
            time.sleep(float(action.split(":", 1)[1]))
        if step == services.FINISHING:
            services.mark_read(file_id)
        return {"step": step}

    return body


@jobs.job(queue=TEST_QUEUE)
def read_stub(run: jobs.Run, *, file_id: uuid.UUID) -> None:
    """A read job's shape with no reader: its steps, the last marking the file read."""
    steps = run.steps(services.step_store(), subject_id=file_id, total=len(STUB_STEPS))
    for step in STUB_STEPS:
        steps.run(step, _body(run, file_id, step), inputs={"file": file_id})


_WORKER = """
import json, sys
import django
django.setup()
from django.conf import settings
for name, value in json.loads(sys.argv[1]).items():
    setattr(settings, name, value)
import vextrus.testing.drawings
from vextrus.platform.services import jobs
jobs.run_worker(json.loads(sys.argv[2]), wait=sys.argv[3] == "wait")
"""


def start_worker(
    queues: Sequence[str] = (TEST_QUEUE,),
    *,
    wait: bool = False,
    overrides: dict[str, object] | None = None,
) -> subprocess.Popen[str]:
    """`jobs.run_worker(queues)` in a child process on the test database, as vextrus_app, with this
    module (and so `read_stub`) imported."""
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "vextrus.settings.test",
        "DATABASE_URL": database_url("default"),
        "DATABASE_OWNER_URL": database_url(OWNER_ALIAS),
        "VEXTRUS_TEST_STORAGE_ROOT": str(settings.VEXTRUS_STORAGE_ROOT),
    }
    return subprocess.Popen(
        [
            sys.executable,
            "-c",
            _WORKER,
            json.dumps(overrides or {}),
            json.dumps(list(queues)),
            "wait" if wait else "no-wait",
        ],
        cwd=settings.BASE_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


@pytest.fixture
def empty_drawings_queue(job_tables: None, django_db_blocker: DjangoDbBlocker) -> Iterator[None]:
    """No job waits on the stub's queue (the test database outlives a run)."""

    def empty() -> None:
        with django_db_blocker.unblock(), connections[OWNER_ALIAS].cursor() as cursor:
            cursor.execute("delete from procrastinate_jobs where queue_name = %s", [TEST_QUEUE])

    empty()
    yield
    empty()


def owner_rows(sql: str, params: Sequence[Any] = ()) -> list[tuple[Any, ...]]:
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(sql, list(params))
        return list(cursor.fetchall())
