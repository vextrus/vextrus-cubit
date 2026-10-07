"""The export from the database (tickets 21c and 21d): the real-drawing check's reading of a Drawing Set
through the product's own job, written through `engine/export.py` (docs/plans/M0.md, 21c; the check's
default since 21d, the owner's ruling of 30 Sep 2026 once this export filled what the harness's did;
the check's sandbox, `scripts/real_drawings/sandbox.py`, runs it):

    python -m vextrus.takeoff.services.export --set <folder> --out <export.json> --database <socket>
        [--run-id ID] [--commit SHA] [--code-hash HASH]

Against the throwaway PostgreSQL 18 cluster the sandbox starts (its superuser `vextrus`, trust on a
Unix socket only), it makes the two roles as `scripts/owner/db-roles.sql` does, migrates, syncs the
Library, and makes one invented Developer and Project. It adds each of the set's drawing files as the
upload does (`takeoff.tasks.read_file.add`; the files the harness's own listing of the set finds), runs
the job worker until no job is left, and writes the export from what the job recorded, read back
through `drawings.services` (files, sheets, views). It acts for the system, with no Membership, so
its scope is the whole tenant (`drawings.services._access`), as the seed's.

`export(...)` is that last part alone. **Every measure the harness's export gives, this one gives
from what the job kept** (`drawings.services.kept`, the artefact, the renders), stage by stage as
the harness names them (`engine.harness.STAGES`): a file's entity counts and read format from its
kept artefact's summary; the second reader's agreement, the font report, the Bangla-ANSI Check and
a PDF's report from the reports the job kept; the sheet finder's report from the `sheets` step's
result (less the sheets the job leaves out for unreadable writing, which the harness keeps), and
the view finder's from the sheet steps' (each sheet's cut, summed: the finder's bounds are the
file's); each sheet's render buffers from its kept render. What the job keeps only in part is read
again, from the job's own inputs, with the call the job makes: the register (the job keeps each
list's numbers and titles, not the rows' places) with 13's register over the kept artefact and the
job's sheets, as `read_propose.proposals` reads it. What the job does not run yet, 18's Plot and its
render F1 (`read_propose.sheets`: "not run here yet"), and the set's Conflicts, Continuations and
Checks (the job raises them as Questions), are the harness's own set stages
(`engine.harness.read_set`), run over the job's readings: the PDFs' pages from 12's `page_text` on
the set's files. What is not kept at all is said as absent: see `GAPS`.
"""

import argparse
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
import uuid
from collections.abc import Callable, Mapping, Sequence
from dataclasses import replace
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # the models load only once `main` has set Django up
    from engine.export import FileReading, ProcessReport, StageReport
    from engine.recognise.types import SheetCandidate, ViewCandidate
    from vextrus.drawings.services import FileView, SheetView, ViewView

GAPS = (
    "process: the job's own read seconds, CPU seconds and peak memory per file are not kept (zero)",
    "rasterise: the job keeps each sheet's render buffers and never rasterises them (skipped)",
)
"""What the job's export cannot say, which the harness's did; none of it is a measure the check
counts (the run-to-run diff shows read time and peak memory, never counts them)."""

OWNER = "vextrus"
APP = "vextrus_app"
DATABASE = "vextrus"
DEVELOPER = "The real-drawing check"
ACTOR = "The real-drawing check"
PROJECT = ("RDC-01", "The real-drawing check's set")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m vextrus.takeoff.services.export")
    parser.add_argument("--set", type=Path, help="the Drawing Set's folder")
    parser.add_argument("--out", type=Path, help="where the export is written")
    parser.add_argument("--database", required=True, help="the cluster's Unix socket directory")
    parser.add_argument("--run-id")
    parser.add_argument("--commit")
    parser.add_argument("--code-hash")
    parser.add_argument(
        "--file-timeout",
        type=float,
        default=None,
        help="how long one file's reading may take (the harness's FILE_TIMEOUT by default)",
    )
    parser.add_argument("--worker", type=Path, help=argparse.SUPPRESS)  # a file's child: its storage
    args = parser.parse_args(argv)
    if args.worker is not None:
        return _work(args.database, args.worker)
    if args.set is None or args.out is None:
        parser.error("--set and --out are needed")
    started, clock = datetime.now(UTC), time.monotonic()
    storage = args.out.parent / f"storage-{uuid.uuid4().hex}"
    _bootstrap(args.database)
    _configure(args.database, storage)

    from django.core.management import call_command

    from engine.harness import FILE_TIMEOUT, drawing_files

    call_command("migrate", verbosity=0)
    call_command("sync_library", verbosity=0)
    developer, project = _project()
    folder = args.set.resolve()
    paths = {path: _sha256(folder / path) for path in drawing_files(folder)}
    timeout = FILE_TIMEOUT if args.file_timeout is None else args.file_timeout
    child = [sys.executable, "-m", __spec__.name if __spec__ else "vextrus.takeoff.services.export"]
    argv_of = lambda: [*child, "--database", args.database, "--worker", str(storage)]  # noqa: E731
    processes = read_each(developer, project, folder, paths, timeout=timeout, worker=argv_of)
    document = export(
        developer,
        project,
        paths,
        folder=folder,
        processes=processes,
        run={
            "id": args.run_id or str(uuid.uuid7()),
            "commit": args.commit,
            "code_hash": args.code_hash,
            "started_at": started.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "seconds": time.monotonic() - clock,
        },
    )
    _write(args.out, document)
    return 0


def _work(socket: str, storage: Path) -> int:
    """A file's child: the job workers until no job is left, the CAD queue's under its own cap (21d:
    in its own process, so the cap never bounds the export's set stages, and a file that runs past its
    time is killed with it, never the run)."""
    _configure(socket, storage)
    from django.conf import settings

    from vextrus.platform.services import jobs

    for queue in (settings.VEXTRUS_CAD_QUEUE, settings.VEXTRUS_DEFAULT_QUEUE):
        jobs.run_worker([queue], wait=False)
    return 0


def read_each(
    developer: uuid.UUID,
    project: uuid.UUID,
    folder: Path,
    paths: Mapping[str, str],
    *,
    timeout: float,
    worker: Callable[[], list[str]],
) -> dict[uuid.UUID, ProcessReport]:
    """Each file added and read by the job in a child process of its own (`worker()`'s command), one
    at a time, as the harness reads each file in its own process (21d): a child that runs past
    `timeout` is killed with its process group, and its file ends failed (`engine.read.limit_reached
    {wall}`), its job cancelled, its process `timed_out`; a child that fails leaves its file as the job
    left it, its process `failed`. Nothing one file does stops the run. Then each held file is read
    anyway (`read_anyway`), answered and its job queued only just before its own child, so each child
    reads that one file under its own timeout. Each added file's process, by its id."""
    from engine.export import ProcessReport, ProcessStatus

    reports: dict[uuid.UUID, ProcessReport] = {}

    def run(file_id: uuid.UUID) -> None:
        started = time.monotonic()
        child = subprocess.Popen(worker(), stdin=subprocess.DEVNULL, start_new_session=True)
        try:
            code = child.wait(timeout=timeout)
            status = ProcessStatus.OK if code == 0 else ProcessStatus.FAILED
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            code = child.wait()
            status = ProcessStatus.TIMED_OUT
            _timed_out(developer, file_id)
        seconds = time.monotonic() - started + (reports[file_id].seconds if file_id in reports else 0.0)
        reports[file_id] = ProcessReport(
            status,
            None if status is ProcessStatus.TIMED_OUT or code < 0 else code,
            -code if code < 0 and status is not ProcessStatus.TIMED_OUT else None,
            seconds,
            0.0,
            0,
        )

    for path in paths:
        file_id = _add(developer, project, folder, path)
        if file_id is not None:
            run(file_id)
    for file_id in held_files(developer, project):
        read_anyway(developer, file_id)  # answered and queued just before its own child, alone
        run(file_id)
    return reports


def _timed_out(developer: uuid.UUID, file_id: uuid.UUID) -> None:
    """A file whose child ran past its time: its job cancelled (so no later worker picks it up) and
    the file failed with the wall limit, as the reader's own wall limit fails it."""
    from django.db import transaction

    from engine.messages import read as read_codes
    from vextrus.drawings import services as drawings
    from vextrus.platform.services import jobs, tenancy

    with transaction.atomic(), tenancy.acting_in(developer):
        view = drawings.file(file_id)
        if view.read_job_id is not None:
            # Its killed worker left it doing: it is asked to abort and left so, never run again
            # (no later child runs a job left doing; the throwaway cluster ends with the run).
            jobs.cancel(view.read_job_id)
        drawings.mark_failed(file_id, read_codes.LIMIT_REACHED(limit="wall"))


# The throwaway cluster -------------------------------------------------------------------------------


def _bootstrap(socket: str) -> None:
    """The roles and the database, as `scripts/owner/db-roles.sql` makes them, as the superuser."""
    import psycopg

    with psycopg.connect(host=socket, user=OWNER, dbname="postgres", autocommit=True) as connection:
        found = connection.execute("select 1 from pg_roles where rolname = %s", (APP,)).fetchone()
        if found is None:
            connection.execute(
                f"create role {APP} login nocreatedb nosuperuser nocreaterole noreplication nobypassrls"
            )
        made = connection.execute("select 1 from pg_database where datname = %s", (DATABASE,))
        if made.fetchone() is None:
            connection.execute(f"create database {DATABASE} owner {OWNER}")


def _configure(socket: str, storage: Path) -> None:
    """Django's settings on the cluster's socket (a URL cannot name one) and a writable storage."""
    os.environ["DJANGO_SETTINGS_MODULE"] = "vextrus.settings.job"
    os.environ["DATABASE_URL"] = f"postgresql://{APP}@127.0.0.1:5432/{DATABASE}"
    os.environ["DATABASE_OWNER_URL"] = f"postgresql://{OWNER}@127.0.0.1:5432/{DATABASE}"
    os.environ["VEXTRUS_STORAGE_ROOT"] = str(storage)
    storage.mkdir(parents=True, exist_ok=True)

    import django
    from django.conf import settings

    for database in settings.DATABASES.values():
        database["HOST"] = socket
    django.setup()


def _project() -> tuple[uuid.UUID, uuid.UUID]:
    """One invented Developer on the Bangladesh Market and one Project, as the seed makes them."""
    from django.db import transaction

    from vextrus.platform.services import markets, tenancy
    from vextrus.projects import services as projects

    with transaction.atomic():
        with tenancy.acting_in(None):
            developer = tenancy.create_developer(DEVELOPER, markets.by_code("BD").id)
        with tenancy.acting_in(developer):
            code, name = PROJECT
            project = projects.create(code=code, name=name).id
    return developer, project


def _add(developer: uuid.UUID, project: uuid.UUID, folder: Path, path: str) -> uuid.UUID | None:
    """The file added as the upload adds it, its read job queued: its id; a file refused is left out
    (and so not in the export's files), and said on stderr by its code."""
    from django.db import transaction

    from vextrus.platform.services import auth, tenancy
    from vextrus.takeoff.tasks import read_file

    with (
        transaction.atomic(),
        tenancy.acting_in(developer),
        (folder / path).open("rb") as content,
    ):
        try:
            added = read_file.add(project, name=Path(path).name, content=content, actor_name=ACTOR)
        except auth.Refused as refused:
            print(f"export: a file was not added: {refused}", file=sys.stderr)
            return None
    return added.file.id


def held_files(developer: uuid.UUID, project: uuid.UUID) -> list[uuid.UUID]:
    """The set's held files (their two readers disagree), in the set's order."""
    from django.db import transaction

    from vextrus.drawings import services as drawings
    from vextrus.platform.services import tenancy

    with transaction.atomic(), tenancy.acting_in(developer):
        found = drawings.set_of(project)
        return [
            view.id
            for view in ([] if found is None else drawings.files(found.id))
            if view.state == drawings.FileState.HELD
        ]


def read_anyway(developer: uuid.UUID, file_id: uuid.UUID) -> None:
    """One held file answered "read anyway", as a QS answers its `file_misread` Question (`step1`'s
    answer: `drawings.answer_held`, then its job queued again, `read_file.read_again`): the harness reads
    a file whatever its readers say, so the check reads it too, and its export still says the readers
    disagree. One file at a time: a child runs every job queued, so only this file's may be."""
    from django.db import transaction

    from vextrus.drawings import services as drawings
    from vextrus.platform.services import tenancy
    from vextrus.takeoff.tasks import read_file

    with transaction.atomic(), tenancy.acting_in(developer):
        drawings.answer_held(file_id, drawings.HeldAnswer.READ_ANYWAY)
        read_file.read_again(file_id)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def _write(out: Path, document: Mapping[str, object]) -> None:
    text = json.dumps(document, ensure_ascii=False, indent=1, allow_nan=False) + "\n"
    partial = out.with_name(out.name + ".part")
    handle = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(handle, "w", encoding="utf-8") as stream:
        stream.write(text)
    partial.replace(out)


# The export --------------------------------------------------------------------------------------------


def export(
    developer: uuid.UUID,
    project: uuid.UUID,
    paths: Mapping[str, str],
    *,
    folder: Path,
    run: Mapping[str, object],
    processes: Mapping[uuid.UUID, ProcessReport] | None = None,
) -> dict[str, object]:
    """The export of what the job recorded for the Project's set: `paths` are the set's files (path
    to sha256) under `folder`, in order, each joined to the file added from it by its content; a path
    no file was added from is left out. Written through `engine.export.build`, the set stages run
    by the harness's own `read_set` over the job's readings (see the module)."""
    from django.db import transaction

    from engine import harness
    from engine.export import RunInfo, build
    from vextrus.drawings import services as drawings
    from vextrus.platform.services import tenancy
    from vextrus.takeoff.services.read_propose import sheets as job_sheets

    targets = {stage.name: stage.target for stage in harness.STAGES}
    built = {name: harness.resolve(target)[0] is not None for name, target in targets.items()}
    with transaction.atomic(), tenancy.acting_in(developer):
        found = drawings.set_of(project)
        added = {} if found is None else {view.sha256: view for view in drawings.files(found.id)}
        printed = [] if found is None else drawings.sheets(found.id)
        joined = [(path, view) for path, sha256 in paths.items() if (view := added.get(sha256))]
        dwgs = [view for _, view in joined if view.format == "dwg"]
        sheet_conventions = job_sheets.conventions(dwgs[0].id)[0] if dwgs else None
        readings = [
            _reading(
                folder,
                path,
                view,
                [sheet for sheet in printed if sheet.file_id == view.id],
                targets,
            )
            for path, view in joined
        ]
    # Each file's own process (`read_each`), where the job read it in one: its time and how it ended.
    readings = [
        replace(reading, process=(processes or {}).get(view.id, reading.process))
        for reading, (_, view) in zip(readings, joined, strict=True)
    ]
    outcome = harness.read_set(readings, targets, built, sheet_conventions, folder)
    info = RunInfo(
        id=str(run["id"]),
        commit=None if run.get("commit") is None else str(run["commit"]),
        code_hash=None if run.get("code_hash") is None else str(run["code_hash"]),
        started_at=str(run["started_at"]),
        seconds=float(str(run["seconds"])),
        stages={
            stage.name: (JOB_STAGES.get(stage.name, stage.target), stage.ticket, built[stage.name])
            for stage in harness.STAGES
        },
    )
    return dict(build(info, readings, outcome))


JOB_STAGES = {
    "read": "vextrus.takeoff.services.read_propose.files:read",
    "decoders_agree": "vextrus.takeoff.services.read_propose.files:read",
    "font_report": "vextrus.takeoff.services.read_propose.files:read",
    "bangla_ansi": "vextrus.takeoff.services.read_propose.files:read",
    "pdf_report": "vextrus.takeoff.services.read_propose.files:read",
    "sheets": "vextrus.takeoff.services.read_propose.sheets:read",
    "views": "vextrus.takeoff.services.read_propose.sheets:read",
    "render_buffers": "vextrus.takeoff.services.read_propose.sheets:read",
}
"""The stages the job runs, by the product job's function that runs each; the others are named by the
engine function this export runs over the job's readings (see the module)."""


def _reading(
    folder: Path,
    path: str,
    view: FileView,
    printed: Sequence[SheetView],
    targets: Mapping[str, str],
) -> FileReading:
    """One file's FileReading from what its job kept (see the module)."""
    from engine import harness
    from engine.export import StageReport, StageState, to_json
    from engine.recognise import views as view_finder
    from engine.render.buffers import BufferError, SheetBuffers
    from vextrus.drawings import services as drawings
    from vextrus.platform.services import auth
    from vextrus.takeoff.services.read_propose import sheets as job_sheets

    state = view.state
    read = state in (drawings.FileState.READ, drawings.FileState.HELD)
    failed = state in (
        drawings.FileState.FAILED,
        drawings.FileState.UNREADABLE,
        drawings.FileState.CANCELLED,
    )
    error = None if view.finding is None else str(view.finding["code"])
    kept = drawings.kept(view.id)
    stages = harness.Stages(targets, progress=None)
    reports = stages.reports
    found: dict[str, Any] = {}
    not_kept = f"the job kept none: the file is {state}"

    def from_kept(name: str, value: dict[str, Any] | None) -> dict[str, int] | None:
        if value is None:
            reports[name] = StageReport(StageState.SKIPPED, error=not_kept)
            return None
        reports[name] = StageReport(StageState.OK, calls=1)
        counts = harness.counts_of(value)
        if counts is None:
            stages.fail(name, "its kept report has no counts (names to counts)")
        return counts

    if view.format == "pdf":
        found["pdf_report"] = from_kept("pdf_report", kept.upload_report)
        if page_text := stages.open("page_text"):
            ok, pages = stages.call("page_text", page_text, folder / path)
            if ok and not isinstance(pages, list | tuple):
                stages.fail("page_text", f"it returned {type(pages).__name__}, not a list of pages")
            elif ok:
                found["page_count"], found["pages"] = len(pages), list(pages)
        return _file(path, view, found, reports)

    artefact = None
    if read or failed:
        try:
            artefact = drawings.artefact(view.id)  # a file that failed after its first reader kept one
        except auth.NotFound:
            artefact = None
    if read or artefact is not None or state == drawings.FileState.REFUSED:
        reports["read"] = StageReport(StageState.OK, calls=1)
        if read and artefact is None:
            stages.fail("read", "the job kept no artefact")
    elif failed:
        reports["read"] = StageReport(
            StageState.FAILED, calls=1, failed_calls=1, error=error or str(state)
        )
    else:
        reports["read"] = StageReport(StageState.SKIPPED, error=f"the file's job did not end: {state}")
    if artefact is not None:
        summary = to_json(artefact.summary)
        if isinstance(summary, dict):
            found["read_format"] = summary.get("format")
            found["entity_counts"] = harness.counts_of(summary.get("entity_counts"))
    cross_check = kept.cross_check
    reports["decoders_agree"] = StageReport(
        StageState.SKIPPED if cross_check is None else StageState.OK,
        calls=int(cross_check is not None),
        error=not_kept if cross_check is None else None,
    )
    if cross_check is None and artefact is not None and failed:  # the second reader's step failed
        reports["decoders_agree"] = StageReport(
            StageState.FAILED, calls=1, failed_calls=1, error=error or str(state)
        )
    found["decoders_agree"] = None if cross_check is None else harness.agree_of(cross_check)
    found["font_report"] = from_kept("font_report", kept.font_report)
    found["bangla_ansi"] = from_kept("bangla_ansi", kept.bangla_ansi)

    finder = kept.steps.get(drawings.SHEETS)
    # A held file answered "read anyway" (`read_anyway`) stays held, its sheets read and kept.
    if not read or finder is None:
        for name in ("sheets", "register", "views", "render_buffers"):
            reports[name] = StageReport(StageState.SKIPPED, error=f"the file is {state}")
    else:
        # In the order the finder found them (the step's, by ordinal), as the harness lists them: a
        # Conflict's evidence names its sheets in that order.
        found_at = {str(entry["id"]): n for n, entry in enumerate(finder["sheets"])}
        printed = sorted(printed, key=lambda sheet: found_at.get(str(sheet.id), len(found_at)))
        sheets = [_sheet(sheet, view.group) for sheet in printed]
        found["sheets"] = sheets
        found["views"] = [[_view(v) for v in drawings.views(sheet.id)] for sheet in printed]
        # The paper the sheet's step kept (#212); none where a step was kept before it was (that
        # file is not read again).
        at = [found_at.get(str(sheet.id)) for sheet in printed]
        steps = [None if n is None else kept.steps.get(drawings.sheet_step(n + 1)) for n in at]
        found["papers"] = [
            job_sheets.paper_of(step.get("paper") if isinstance(step, dict) else None) for step in steps
        ]
        reports["sheets"] = StageReport(StageState.OK, calls=1)
        report = dict(finder.get("sheet_report") or {})
        report.pop(job_sheets.UNREADABLE_TEXT, None)
        found["sheet_report"] = harness.counts_of(report)
        reports["views"] = StageReport(StageState.OK, calls=len(printed))
        limits = view_finder.LIMITS
        cut = [kept.steps.get(drawings.sheet_step(n + 1)) or {} for n in range(len(finder["sheets"]))]
        found["view_report"] = (
            {
                limit: sum(_cut(step, job_sheets.VIEW_LIMIT.format(limit)) for step in cut)
                for limit in limits
            }
            if printed
            else None
        )
        if find_register := stages.open("register", None if artefact is not None else "read"):
            conventions = job_sheets.conventions(view.id)[0]
            ok, entries = stages.call(
                "register", partial(find_register, conventions=conventions), artefact, sheets
            )
            found["register"] = list(entries) if ok else []
        buffers: list[SheetBuffers | None] = []
        for sheet in printed:
            try:
                buffers.append(SheetBuffers.from_bytes(drawings.render(sheet.id)))
            except auth.NotFound, BufferError:  # none kept, or not a sheet's buffers: not built
                buffers.append(None)
        reports["render_buffers"] = StageReport(StageState.OK, calls=len(printed))
        missing = buffers.count(None)
        if missing:
            reports["render_buffers"] = StageReport(
                StageState.FAILED,
                calls=len(printed),
                failed_calls=missing,
                error=f"the job kept no render for {missing} of the file's sheets",
            )
        found["buffers"] = buffers
    reports["rasterise"] = StageReport(
        StageState.SKIPPED, error="the job keeps render buffers and never rasterises them"
    )
    return _file(path, view, found, reports)


def _cut(step: Mapping[str, Any], key: str) -> int:
    """What a sheet step's `view_report` says one view limit cut on its sheet (0 when it says none)."""
    report = step.get("view_report")
    return int(report.get(key, 0)) if isinstance(report, dict) else 0


def _file(
    path: str, view: FileView, found: Mapping[str, Any], reports: Mapping[str, StageReport]
) -> FileReading:
    from engine import harness
    from engine.export import FileReading, ProcessReport, ProcessStatus

    return FileReading(
        path=path,
        sha256=view.sha256,
        format=view.format,
        discipline_default=view.discipline,
        group=view.group,
        conventions_applied=None,
        process=ProcessReport(ProcessStatus.OK, 0, None, 0.0, 0.0, 0),
        stages={name: reports[name] for name in harness.FILE_STAGES[view.format]},
        read_format=found.get("read_format"),
        decoders_agree=found.get("decoders_agree"),
        entity_counts=found.get("entity_counts"),
        font_report=found.get("font_report"),
        pdf_report=found.get("pdf_report"),
        bangla_ansi=found.get("bangla_ansi"),
        sheet_report=found.get("sheet_report"),
        view_report=found.get("view_report"),
        sheets=found.get("sheets", []),
        views=found.get("views", []),
        register=found.get("register", []),
        page_count=found.get("page_count"),
        pages=found.get("pages", []),
        buffers=found.get("buffers", []),
        papers=found.get("papers", []),
    )


def _sheet(sheet: SheetView, group: str) -> SheetCandidate:
    from engine.recognise.types import (
        Box,
        Exclusion,
        ExclusionReason,
        SheetCandidate,
        SheetLocation,
        Sourced,
        ValueSource,
    )

    place = sheet.location
    box = place.get("box")
    values = {
        "number": sheet.number,
        "title": sheet.title,
        "discipline": sheet.discipline,
        "revision_mark": sheet.revision_mark,
        "issue_date": sheet.issue_date,
        "storeys_as_stated": sheet.storeys_as_stated,
    }
    sourced = {
        name: Sourced(value, ValueSource(sheet.sources[name]))
        for name, value in values.items()
        if value and name in sheet.sources
    }
    reason = sheet.proposed_exclusion
    return SheetCandidate(
        location=SheetLocation(
            layout=place.get("layout"),
            box=None if box is None else Box(*(float(v) for v in box)),
        ),
        exclusion=None
        if reason is None
        else Exclusion(
            ExclusionReason(reason),
            sheet.proposed_exclusion_text if reason == ExclusionReason.OTHER else None,
        ),
        anchors=tuple(a.anchor() for a in sheet.anchors),
        group=group,
        **sourced,
    )


def _view(view: ViewView) -> ViewCandidate:
    from engine.recognise.types import (
        Box,
        Exclusion,
        ExclusionReason,
        Layer,
        StoreysMeaning,
        StoreysSource,
        ViewCandidate,
        ViewKind,
    )

    reason = view.proposed_exclusion
    sources = {str(s) for s in StoreysSource}
    return ViewCandidate(
        box=Box(*(float(v) for v in view.box)),
        kind=ViewKind(view.kind),
        title=view.title or None,
        not_to_scale=view.not_to_scale,
        stated_scale=view.stated_scale or None,
        storeys_as_stated=view.storeys_as_stated or None,
        storeys=tuple(view.storeys),
        storeys_meaning=None if view.storeys_meaning is None else StoreysMeaning(view.storeys_meaning),
        # Where they were read, kept: a part plan's (`title_line`) sits out of same_storey (S15-E3).
        storeys_source=StoreysSource(view.storeys_source)
        if view.storeys and view.storeys_source in sources
        else None,
        subject=view.subject,
        layer=None if view.layer is None else Layer(view.layer),
        steps=tuple(view.steps),
        part=view.part,
        exclusion=None
        if reason is None
        else Exclusion(
            ExclusionReason(reason),
            view.proposed_exclusion_text if reason == ExclusionReason.OTHER else None,
        ),
        anchors=tuple(a.anchor() for a in view.anchors),
    )


if __name__ == "__main__":
    sys.exit(main())
