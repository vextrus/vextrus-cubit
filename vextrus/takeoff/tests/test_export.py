"""The job's export (21c's `takeoff/services/export.py`): what the read job recorded, written through
`engine/export.py`, on invented sheets (`test_read_sheet.py`'s readers; no toolchain)."""

import dataclasses
import hashlib
import sys
import time
import uuid
from pathlib import Path
from typing import Any, cast

import pytest
from django.db import transaction

from engine import harness
from engine.messages import decoders_agree as agree_codes
from engine.read import ReadError
from engine.recognise import views
from engine.recognise.types import CheckOutcome, CheckResult
from vextrus.drawings import services as drawings
from vextrus.platform.services import auth, jobs, tenancy
from vextrus.takeoff.services import export
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.services.read_propose import sheets as read_propose_sheets
from vextrus.takeoff.tasks import read_file
from vextrus.takeoff.tests.test_read_file import DISAGREE
from vextrus.takeoff.tests.test_read_sheet import FRAMES, added, readers, run_job
from vextrus.testing.drawings import QsProject, add, drawing
from vextrus.testing.jobs import run_inline


@pytest.fixture(autouse=True)
def typesafe_down(jev_down: Any) -> None:
    """The job asks Jev each sheet's kind (21c): TypeSafe down here, as in the check's sandbox."""
    jev_down("timeout")


RUN = {
    "id": "invented-run",
    "commit": None,
    "code_hash": None,
    "started_at": "2026-09-29T00:00:00Z",
    "seconds": 1.5,
}


def exported(
    qs: QsProject, paths: dict[str, str], folder: Path = Path("/nonexistent")
) -> dict[str, Any]:
    return export.export(qs.member.developer_id, qs.project_id, paths, folder=folder, run=RUN)


@pytest.mark.django_db
def test_a_read_files_sheets_and_views_are_exported_as_the_job_recorded_them(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    with qs_project.member.acting():
        sha256 = drawings.file(file_id).sha256

    document = exported(qs_project, {"structural/KR-STR-R0.dwg": sha256, "other.dwg": "0" * 64})

    [file] = document["files"]  # a path no file was added from is left out
    assert (file["path"], file["name"], file["sha256"]) == (
        "structural/KR-STR-R0.dwg",
        "KR-STR-R0.dwg",
        sha256,
    )
    assert file["stages"]["read"]["state"] == "ok"
    assert file["process"]["status"] == "ok"
    assert file["decoders_agree"] is True
    assert len(file["sheets"]) == FRAMES
    for sheet in file["sheets"]:
        assert sheet["discipline"]["value"] == "structural"
        # A title block is a view too once the engine emits it (loop-views): not counted here.
        drawn = [v for v in sheet["views"] if v["kind"] != "title_block"]
        assert [v["title"] for v in drawn] == ["GROUND FLOOR BEAM LAYOUT PLAN"]
    assert set(document["stages"]) == {stage.name for stage in harness.STAGES}
    assert document["run"]["id"] == "invented-run"


@pytest.mark.django_db
def test_a_file_whose_job_has_not_run_is_exported_as_not_read(qs_project: QsProject) -> None:
    file_id = added(qs_project)
    with qs_project.member.acting():
        sha256 = drawings.file(file_id).sha256

    [file] = exported(qs_project, {"a.dwg": sha256})["files"]

    assert file["stages"]["read"]["state"] == "skipped"
    assert file["sheets"] == []


@pytest.mark.django_db
def test_the_export_fills_every_measure_the_harness_gives_from_what_the_job_kept(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    with qs_project.member.acting():
        sha256 = drawings.file(file_id).sha256

    document = exported(qs_project, {"KR-STR-R0.dwg": sha256})

    [file] = document["files"]
    with qs_project.member.acting():
        summary = drawings.artefact(file_id).summary
    assert file["entity_counts"] == dict(summary.entity_counts)  # the kept artefact's
    assert file["read_format"] == {"kind": "dwg", "version": "AC1032"}
    assert file["decoders_agree"] is True
    assert file["font_report"]["texts"] == 13  # the kept font report's counts
    assert set(file["bangla_ansi"]) == {"by_font", "by_pattern", "fonts", "texts"}
    assert file["sheet_report"]["frame"] == FRAMES  # the `sheets` step's, as the finder counted
    assert read_propose_sheets.UNREADABLE_TEXT not in file["sheet_report"]  # the job's own count
    assert file["view_report"] == dict.fromkeys(views.LIMITS, 0)
    stages = {name: report["state"] for name, report in file["stages"].items()}
    assert stages == dict.fromkeys(harness.FILE_STAGES["dwg"], "ok") | {"rasterise": "skipped"}
    # The set stages, the harness's own, over the job's readings: none skipped for want of input.
    assert {name: report["state"] for name, report in document["set_stages"].items()} == dict.fromkeys(
        harness.SET_STAGES, "ok"
    )
    assert document["checks"], "the Check catalogue ran over the job's sheets and views"
    assert [len(c["sheets"]) for c in document["continuations"]] == [FRAMES]


@pytest.mark.django_db
def test_a_sheet_the_job_kept_no_render_for_fails_the_render_stage(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """As the harness's stage fails on a sheet it cannot build (the job keeps none for a sheet whose
    paper it cannot draw, or once the file's render time is spent): the export goes on, and render
    F1, which needs every sheet's buffers, is skipped for the set."""
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    with qs_project.member.acting():
        sha256 = drawings.file(file_id).sha256
        first = drawings.sheets(drawings.file(file_id).set_id)[0].id
    kept = drawings.render

    def render(sheet_id: uuid.UUID) -> bytes:
        if sheet_id == first:
            raise auth.NotFound
        return kept(sheet_id)

    monkeypatch.setattr(drawings, "render", render)

    document = exported(qs_project, {"KR-STR-R0.dwg": sha256})

    [file] = document["files"]
    report = file["stages"]["render_buffers"]
    assert (report["state"], report["calls"], report["failed_calls"]) == ("failed", FRAMES, 1)
    assert document["set_stages"]["render_f1"]["state"] == "skipped"
    assert document["set_stages"]["conflicts"]["state"] == "ok"


def _read(qs: QsProject, file_id: uuid.UUID, second: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    use = dataclasses.replace(readers(), second=second)
    monkeypatch.setattr(files, "READERS", use)
    run_inline(
        read_file.read_file,
        tenant_id=qs.member.developer_id,
        user_id=qs.member.user.pk,
        abort_reason=lambda: None,
        file_id=file_id,
    )


@pytest.mark.django_db
def test_a_held_file_is_read_anyway_so_the_set_stages_run_on_every_file(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The refuter's case (21d): one held DWG skipped every set stage for the whole set, while the
    harness reads a file whatever its readers say. The check answers "read anyway", as a QS would."""
    good = add(qs_project.member, qs_project.project_id, "S-GOOD.dwg", drawing("dwg")).file.id
    held = add(qs_project.member, qs_project.project_id, "S-HELD.dwg", drawing("dwg")).file.id
    agree = CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED)
    fired = CheckResult(code="decoders_agree", outcome=CheckOutcome.FIRED, finding=DISAGREE)
    _read(qs_project, good, lambda path, artefact: agree, monkeypatch)
    _read(qs_project, held, lambda path, artefact: fired, monkeypatch)

    assert export.held_files(qs_project.member.developer_id, qs_project.project_id) == [held]
    export.read_anyway(qs_project.member.developer_id, held)
    _read(qs_project, held, lambda path, artefact: fired, monkeypatch)  # the job queued again

    with qs_project.member.acting():
        paths = {
            name: drawings.file(i).sha256 for name, i in (("S-GOOD.dwg", good), ("S-HELD.dwg", held))
        }
        assert drawings.file(held).state == drawings.FileState.HELD  # held, its sheets read anyway
    document = exported(qs_project, paths)
    by_path = {f["path"]: f for f in document["files"]}
    assert by_path["S-HELD.dwg"]["decoders_agree"] is False  # the export still says they disagree
    assert len(by_path["S-HELD.dwg"]["sheets"]) == FRAMES
    assert by_path["S-HELD.dwg"]["stages"]["sheets"]["state"] == "ok"
    states = {name: report["state"] for name, report in document["set_stages"].items()}
    assert states == dict.fromkeys(harness.SET_STAGES, "ok")


@pytest.mark.django_db
def test_a_file_that_failed_after_its_first_reader_keeps_its_entity_counts(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """As the harness reads it: the read stage ok, the second reader's stage failed."""
    file_id = added(qs_project)

    def broken(path: Any, artefact: Any) -> CheckResult:
        raise ReadError(agree_codes.NOT_INSTALLED())

    with pytest.raises(files.FileNotRead):
        _read(qs_project, file_id, broken, monkeypatch)
    with qs_project.member.acting():
        sha256 = drawings.file(file_id).sha256
        assert drawings.file(file_id).state == drawings.FileState.FAILED

    [file] = exported(qs_project, {"a.dwg": sha256})["files"]

    assert file["stages"]["read"]["state"] == "ok"
    assert file["entity_counts"]
    assert file["stages"]["decoders_agree"]["state"] == "failed"
    assert file["stages"]["sheets"]["state"] == "skipped"


@pytest.mark.django_db
def test_a_files_sheets_are_exported_in_the_order_the_finder_found_them(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """As the harness lists them, whatever order the sheet list gives (21d: a Conflict's evidence
    named its two sheets the other way round on a real set)."""
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    with qs_project.member.acting():
        sha256 = drawings.file(file_id).sha256
        found = drawings.kept(file_id).steps[drawings.SHEETS]["sheets"]
        located = {str(s.id): s.location for s in drawings.sheets(drawings.file(file_id).set_id)}
    listed = drawings.sheets
    monkeypatch.setattr(drawings, "sheets", lambda set_id: list(reversed(listed(set_id))))

    [file] = exported(qs_project, {"KR-STR-R0.dwg": sha256})["files"]

    in_found_order = [[float(v) for v in located[str(entry["id"])]["box"]] for entry in found]
    assert [sheet["location"]["box"] for sheet in file["sheets"]] == in_found_order


@pytest.mark.django_db
def test_a_file_whose_reading_hangs_fails_alone_and_the_run_goes_on(
    qs_project: QsProject, tmp_path: Path
) -> None:
    """The review's attack (21d): the job read every file in the export's own process with no bound,
    so one hanging step held the run for the sandbox's six hours. Each file is read in a child of its
    own (`read_each`), under the harness's file timeout: the hanging one is killed, its file failed
    with the wall limit and its process `timed_out`; the next file is read as before."""
    (tmp_path / "a-hangs.dwg").write_bytes(drawing("dwg"))
    (tmp_path / "b-reads.dwg").write_bytes(drawing("dwg"))
    paths = {name: _sha(tmp_path / name) for name in ("a-hangs.dwg", "b-reads.dwg")}
    children = iter(
        [
            [sys.executable, "-c", "import time; time.sleep(60)"],  # a step that never ends
            [sys.executable, "-c", "pass"],
        ]
    )
    started = time.monotonic()

    processes = export.read_each(
        qs_project.member.developer_id,
        qs_project.project_id,
        tmp_path,
        paths,
        timeout=1.0,
        worker=lambda: next(children),
    )

    assert time.monotonic() - started < 20
    with qs_project.member.acting():
        found = drawings.set_of(qs_project.project_id)
        assert found is not None
        by_name = {view.name: view for view in drawings.files(found.id)}
    hung, other = by_name["a-hangs.dwg"], by_name["b-reads.dwg"]
    assert hung.state == drawings.FileState.FAILED
    assert hung.finding is not None
    assert hung.finding["params"] == {"limit": "wall"}
    assert processes[hung.id].status == "timed_out"
    assert processes[other.id].status == "ok"
    assert other.state != drawings.FileState.FAILED
    document = export.export(
        qs_project.member.developer_id,
        qs_project.project_id,
        paths,
        folder=tmp_path,
        run=RUN,
        processes=processes,
    )
    files = {f["path"]: f for f in cast(list[dict[str, Any]], document["files"])}
    assert files["a-hangs.dwg"]["process"]["status"] == "timed_out"
    assert files["a-hangs.dwg"]["stages"]["read"]["state"] == "failed"
    assert files["b-reads.dwg"]["process"]["status"] == "ok"


@pytest.mark.django_db
def test_each_held_file_is_read_anyway_in_its_own_child_under_its_own_timeout(
    qs_project: QsProject, tmp_path: Path
) -> None:
    """Fix round 2's attack (21d): every held file was answered and queued at once, so the first held
    file's child (which runs every job queued) read them all under one timeout: one reported
    timed_out though its reading ended, the other ok in its stead. Each is now answered just before its
    own child: the second's child hangs, and it alone is timed out and its job cancelled."""
    developer = qs_project.member.developer_id
    for name in ("a-held.dwg", "b-held.dwg"):
        (tmp_path / name).write_bytes(drawing("dwg") + name.encode())
    paths = {name: _sha(tmp_path / name) for name in ("a-held.dwg", "b-held.dwg")}
    calls: list[str] = []

    def by_name() -> dict[str, drawings.FileView]:
        with tenancy.acting_in(developer):
            found = drawings.set_of(qs_project.project_id)
            assert found is not None
            return {view.name: view for view in drawings.files(found.id)}

    def worker() -> list[str]:
        files = by_name()
        calls.append(",".join(sorted(f"{n}:{v.state}" for n, v in files.items())))
        if len(calls) <= 2:  # the first pass: each file's readers disagree, so it is held
            [newest] = [v for v in files.values() if v.state != drawings.FileState.HELD]
            with transaction.atomic(), tenancy.acting_in(developer):
                drawings.quarantine(newest.id, DISAGREE)
            return [sys.executable, "-c", "pass"]
        if len(calls) == 3:  # a-held's child: b-held is not answered yet, its job not queued again
            assert files["b-held.dwg"].read_job_id == first_jobs["b-held.dwg"]
            return [sys.executable, "-c", "pass"]
        return [sys.executable, "-c", "import time; time.sleep(60)"]  # b-held's child hangs

    first_jobs: dict[str, int | None] = {}
    real_add = export._add

    def add(*args: Any) -> uuid.UUID | None:
        added = real_add(*args)
        first_jobs.update({n: v.read_job_id for n, v in by_name().items()})
        return added

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(export, "_add", add)
        processes = export.read_each(
            developer, qs_project.project_id, tmp_path, paths, timeout=1.0, worker=worker
        )

    files = by_name()
    a, b = files["a-held.dwg"], files["b-held.dwg"]
    assert len(calls) == 4
    assert processes[a.id].status == "ok"
    assert processes[b.id].status == "timed_out"
    # A held file read anyway is shown by its job's state until its read ends (#165), the file still
    # held beneath: b-held's job cancelled, a-held's queued again (unread: a fake child).
    assert b.state == drawings.FileState.CANCELLED
    assert a.state == drawings.FileState.WAITING
    assert a.read_job_id != first_jobs["a-held.dwg"]
    assert b.read_job_id is not None
    assert a.read_job_id is not None
    with tenancy.acting_in(developer):
        stopped = jobs.state(b.read_job_id)
        queued = jobs.state(a.read_job_id)
    assert stopped is not None
    assert stopped.status in ("cancelled", "stopping")
    assert queued is not None
    assert queued.status == "waiting"  # a-held's: never cancelled


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
