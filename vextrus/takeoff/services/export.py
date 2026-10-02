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
import sys
import time
import uuid
from collections.abc import Iterable, Mapping, Sequence
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # the models load only once `main` has set Django up
    from engine.export import FileReading, StageReport
    from engine.recognise.types import SheetCandidate, ViewCandidate
    from vextrus.drawings.services import FileView, SheetView, ViewView

GAPS = (
    "process: the job's own read seconds, CPU seconds and peak memory per file are not kept (zero)",
    "rasterise: the job keeps each sheet's render buffers and never rasterises them (skipped)",
    "papers: the views stage's paper per sheet is not kept (null)",
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
    parser.add_argument("--set", type=Path, required=True, help="the Drawing Set's folder")
    parser.add_argument("--out", type=Path, required=True, help="where the export is written")
    parser.add_argument("--database", required=True, help="the cluster's Unix socket directory")
    parser.add_argument("--run-id")
    parser.add_argument("--commit")
    parser.add_argument("--code-hash")
    args = parser.parse_args(argv)
    started, clock = datetime.now(UTC), time.monotonic()
    _bootstrap(args.database)
    _configure(args.database, args.out.parent / f"storage-{uuid.uuid4().hex}")

    from django.conf import settings
    from django.core.management import call_command

    from engine.harness import drawing_files
    from vextrus.platform.services import jobs

    call_command("migrate", verbosity=0)
    call_command("sync_library", verbosity=0)
    developer, project = _project()
    folder = args.set.resolve()
    paths = {path: _sha256(folder / path) for path in drawing_files(folder)}
    _add(developer, project, folder, paths)
    for queue in (settings.VEXTRUS_CAD_QUEUE, settings.VEXTRUS_DEFAULT_QUEUE):
        jobs.run_worker([queue], wait=False)
    if read_held_anyway(developer, project):
        for queue in (settings.VEXTRUS_CAD_QUEUE, settings.VEXTRUS_DEFAULT_QUEUE):
            jobs.run_worker([queue], wait=False)
    document = export(
        developer,
        project,
        paths,
        folder=folder,
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


def _add(developer: uuid.UUID, project: uuid.UUID, folder: Path, paths: Iterable[str]) -> None:
    """Each file added as the upload adds it, its read job queued; a file refused is left out (and
    so not in the export's files), and said on stderr by its code."""
    from django.db import transaction

    from vextrus.platform.services import auth, tenancy
    from vextrus.takeoff.tasks import read_file

    for path in paths:
        with (
            transaction.atomic(),
            tenancy.acting_in(developer),
            (folder / path).open("rb") as content,
        ):
            try:
                read_file.add(project, name=Path(path).name, content=content, actor_name=ACTOR)
            except auth.Refused as refused:
                print(f"export: a file was not added: {refused}", file=sys.stderr)


def read_held_anyway(developer: uuid.UUID, project: uuid.UUID) -> int:
    """Each held file (its two readers disagree) answered "read anyway", as a QS answers its
    `file_misread` Question (`step1`'s answer: `drawings.answer_held`, then the job queued again,
    `read_file.read_again`): the harness reads a file whatever its readers say, so the check reads it
    too, and its export still says the readers disagree. How many were answered."""
    from django.db import transaction

    from vextrus.drawings import services as drawings
    from vextrus.platform.services import tenancy
    from vextrus.takeoff.tasks import read_file

    with transaction.atomic(), tenancy.acting_in(developer):
        found = drawings.set_of(project)
        held = [
            view.id
            for view in ([] if found is None else drawings.files(found.id))
            if view.state == drawings.FileState.HELD
        ]
        for file_id in held:
            drawings.answer_held(file_id, drawings.HeldAnswer.READ_ANYWAY)
            read_file.read_again(file_id)
    return len(held)


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
    # A held file answered "read anyway" (`read_held_anyway`) stays held, its sheets read and kept.
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
        ViewCandidate,
        ViewKind,
    )

    reason = view.proposed_exclusion
    return ViewCandidate(
        box=Box(*(float(v) for v in view.box)),
        kind=ViewKind(view.kind),
        title=view.title or None,
        not_to_scale=view.not_to_scale,
        stated_scale=view.stated_scale or None,
        storeys_as_stated=view.storeys_as_stated or None,
        storeys=tuple(view.storeys),
        storeys_meaning=None if view.storeys_meaning is None else StoreysMeaning(view.storeys_meaning),
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
