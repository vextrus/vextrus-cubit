"""The job's export (21c's `takeoff/services/export.py`): what the read job recorded, written through
`engine/export.py`, on invented sheets (`test_read_sheet.py`'s readers; no toolchain)."""

from typing import Any

import pytest

from vextrus.drawings import services as drawings
from vextrus.takeoff.services import export
from vextrus.takeoff.tests.test_read_sheet import FRAMES, added, run_job
from vextrus.testing.drawings import QsProject

RUN = {
    "id": "invented-run",
    "commit": None,
    "code_hash": None,
    "started_at": "2026-09-29T00:00:00Z",
    "seconds": 1.5,
}


def exported(qs: QsProject, paths: dict[str, str]) -> dict[str, Any]:
    return export.export(qs.member.developer_id, qs.project_id, paths, run=RUN)


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
        assert [v["title"] for v in sheet["views"]] == ["GROUND FLOOR BEAM LAYOUT PLAN"]
    assert set(document["stages"]) == set(export.STAGES)
    assert document["run"]["id"] == "invented-run"


@pytest.mark.django_db
def test_a_file_whose_job_has_not_run_is_exported_as_not_read(qs_project: QsProject) -> None:
    file_id = added(qs_project)
    with qs_project.member.acting():
        sha256 = drawings.file(file_id).sha256

    [file] = exported(qs_project, {"a.dwg": sha256})["files"]

    assert file["stages"]["read"]["state"] == "skipped"
    assert file["sheets"] == []
