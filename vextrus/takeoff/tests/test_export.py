"""The job's export (21c's `takeoff/services/export.py`): what the read job recorded, written through
`engine/export.py`, on invented sheets (`test_read_sheet.py`'s readers; no toolchain)."""

import dataclasses
import uuid
from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.messages import decoders_agree as agree_codes
from engine.read import ReadError
from engine.recognise import views
from engine.recognise.types import CheckOutcome, CheckResult
from vextrus.drawings import services as drawings
from vextrus.platform.services import auth
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

    assert export.read_held_anyway(qs_project.member.developer_id, qs_project.project_id) == 1
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
