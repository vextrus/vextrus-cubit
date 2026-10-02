"""The job's export (21c's `takeoff/services/export.py`): what the read job recorded, written through
`engine/export.py`, on invented sheets (`test_read_sheet.py`'s readers; no toolchain)."""

from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.recognise import views
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import export
from vextrus.takeoff.services.read_propose import sheets as read_propose_sheets
from vextrus.takeoff.tests.test_read_sheet import FRAMES, added, run_job
from vextrus.testing.drawings import QsProject


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
