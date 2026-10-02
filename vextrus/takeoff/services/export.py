"""The export from the database (ticket 21c): the real-drawing check's reading of a Drawing Set through
the product's own job, written through `engine/export.py` (docs/plans/M0.md, 21c; the check's sandbox,
`scripts/real_drawings/sandbox.py`, runs it in `--job` mode, an option with `--no-post`: the harness
stays the check's default until this export fills what `GAPS` names, the owner's ruling of 30 Sep 2026):

    python -m vextrus.takeoff.services.export --set <folder> --out <export.json> --database <socket>
        [--run-id ID] [--commit SHA] [--code-hash HASH]

Against the throwaway PostgreSQL 18 cluster the sandbox starts (its superuser `vextrus`, trust on a
Unix socket only), it makes the two roles as `scripts/owner/db-roles.sql` does, migrates, syncs the
Library, and makes one invented Developer and Project. It adds each of the set's drawing files as the
upload does (`takeoff.tasks.read_file.add`; the files the harness's own listing of the set finds), runs
the job worker until no job is left, and writes the export from what the job recorded, read back
through `drawings.services` (files, sheets, views). It acts for the system, with no Membership, so
its scope is the whole tenant (`drawings.services._access`), as the seed's.

`export(...)` is that last part alone. What the database does not hold is written as the export's
schema lets it be absent (null, or an empty list), never guessed: see `GAPS`.
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
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # the models load only once `main` has set Django up
    from engine.export import FileReading
    from engine.recognise.types import SheetCandidate, ViewCandidate
    from vextrus.drawings.services import FileView, SheetView, ViewView

GAPS = (
    "process: the job's own read seconds, CPU seconds and peak memory per file are not kept (zero)",
    "stages: only read, sheets and views are reported per file, from the file's state",
    "entity_counts, font_report, pdf_report, bangla_ansi, sheet_report, view_report: null",
    "read_format, conventions_applied, pages: null",
    "register, render_f1, plot, conflicts, continuations, checks, set_stages: empty",
)
"""What the job's export cannot say yet, which the harness's did."""

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
    document = export(
        developer,
        project,
        paths,
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
    run: Mapping[str, object],
) -> dict[str, object]:
    """The export of what the job recorded for the Project's set: `paths` are the set's files (path
    to sha256), in order, each joined to the file added from it by its content; a path no file was
    added from is left out. Written through `engine.export.build`."""
    from django.db import transaction

    from engine.export import RunInfo, SetOutcome, build
    from vextrus.drawings import services as drawings
    from vextrus.platform.services import tenancy

    with transaction.atomic(), tenancy.acting_in(developer):
        found = drawings.set_of(project)
        added = {} if found is None else {view.sha256: view for view in drawings.files(found.id)}
        printed = [] if found is None else drawings.sheets(found.id)
        readings = [
            _reading(path, view, [sheet for sheet in printed if sheet.file_id == view.id])
            for path, sha256 in paths.items()
            if (view := added.get(sha256)) is not None
        ]
    info = RunInfo(
        id=str(run["id"]),
        commit=None if run.get("commit") is None else str(run["commit"]),
        code_hash=None if run.get("code_hash") is None else str(run["code_hash"]),
        started_at=str(run["started_at"]),
        seconds=float(str(run["seconds"])),
        stages={name: (target, "21c", True) for name, target in STAGES.items()},
    )
    return dict(build(info, readings, SetOutcome(stages={})))


STAGES = {
    "read": "vextrus.takeoff.services.read_propose.files:read",
    "sheets": "vextrus.takeoff.services.read_propose.sheets:read",
    "views": "vextrus.takeoff.services.read_propose.sheets:read",
}
"""The stages the job's export reports, by the product job's function that runs each."""


def _reading(path: str, view: FileView, printed: Sequence[SheetView]) -> FileReading:
    """One file's FileReading from its FileView and printed sheets."""
    from engine.export import FileReading, ProcessReport, ProcessStatus, StageReport, StageState
    from vextrus.drawings import services as drawings

    state = view.state
    read = state in (drawings.FileState.READ, drawings.FileState.HELD)
    failed = state in (
        drawings.FileState.FAILED,
        drawings.FileState.UNREADABLE,
        drawings.FileState.CANCELLED,
    )
    error = None if view.finding is None else str(view.finding["code"])
    if read or state == drawings.FileState.REFUSED:
        first = StageReport(StageState.OK, calls=1)
    elif failed:
        first = StageReport(StageState.FAILED, calls=1, failed_calls=1, error=error or str(state))
    else:
        first = StageReport(StageState.SKIPPED, error=f"the file's job did not end: {state}")
    stages = {"read": first}
    sheets: list[SheetCandidate] = []
    views: list[list[ViewCandidate]] = []
    if view.format == "dwg":
        for name in ("sheets", "views"):
            stages[name] = (
                StageReport(StageState.OK, calls=len(printed))
                if state == drawings.FileState.READ
                else StageReport(StageState.SKIPPED, error=f"the file is {state}")
            )
        for sheet in printed:
            sheets.append(_sheet(sheet, view.group))
            views.append([_view(v) for v in drawings.views(sheet.id)])
    return FileReading(
        path=path,
        sha256=view.sha256,
        format=view.format,
        discipline_default=view.discipline,
        group=view.group,
        conventions_applied=None,
        process=ProcessReport(ProcessStatus.OK, 0, None, 0.0, 0.0, 0),
        stages=stages,
        decoders_agree=(None if view.format != "dwg" or not read else state == drawings.FileState.READ),
        sheets=sheets,
        views=views,
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
