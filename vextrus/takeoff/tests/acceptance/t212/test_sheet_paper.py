"""Ticket 212: the product's read job's export keeps each sheet's paper (#212: "keep the paper in the
sheet step's result and export it per printed sheet; drop the GAPS line. Committed checks: the job
export's paper equals the harness's on a synthetic set").

Two synthetic sets, built at test time by the repo's writer (`engine/fixtures/dwg`: ezdxf, then
ACadSharp) in the test's own folder: frames in model space (`sheet_set_model`) and sheets on layouts
(`sheet_set_layouts`). Each is read twice, by the harness (`engine.harness.run`) and by the product's
job (the real readers, `read_file` inline) with the job's export (`export.export`); a sheet joins its
fellow by its layout name, else by its frame box. They need the toolchain:

    uv run --no-sync pytest -m needs_toolchain vextrus/takeoff/tests/acceptance/t212
"""

import hashlib
import math
from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.fixtures import dwg
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import export
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add
from vextrus.testing.jobs import run_inline

RUN = {
    "id": "t212",
    "commit": None,
    "code_hash": None,
    "started_at": "2026-10-04T00:00:00Z",
    "seconds": 1.0,
}
MODEL = "sheet_set_model"
LAYOUTS = "sheet_set_layouts"


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    """Each set's folder, holding its one DWG."""
    scratch = tmp_path_factory.mktemp("t212-build")
    writer = dwg.build_writer(scratch)
    found = {}
    for name in (MODEL, LAYOUTS):
        folder = tmp_path_factory.mktemp(name)
        (folder / f"{name}.dwg").write_bytes(dwg.build(name, scratch, writer).read_bytes())
        found[name] = folder
    return found


@pytest.fixture(scope="module")
def dumper(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """The pinned ACadSharp dumper, built here: CI's image has none at the readers' default path."""
    from engine.read.acadsharp.tests.build import build_dumper

    return build_dumper(tmp_path_factory.mktemp("t212-dumper"))


@pytest.fixture
def engine_readers(dumper: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Both reads (the harness's file processes and the job's readers) use the built dumper."""
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper))


def harness_sheets(folder: Path, out: Path) -> list[dict[str, Any]]:
    document: Any = harness.run(folder, out)
    (file,) = document["files"]
    return list(file["sheets"])


def job_sheets(qs: QsProject, folder: Path, name: str) -> list[dict[str, Any]]:
    data = (folder / f"{name}.dwg").read_bytes()
    file_id = add(qs.member, qs.project_id, f"{name}.dwg", data).file.id
    run_inline(
        read_file.read_file,
        tenant_id=qs.member.developer_id,
        user_id=qs.member.user.pk,
        abort_reason=lambda: None,
        file_id=file_id,
    )
    with qs.member.acting():
        sha256 = drawings.file(file_id).sha256
    assert sha256 == hashlib.sha256(data).hexdigest()
    document: Any = export.export(
        qs.member.developer_id, qs.project_id, {f"{name}.dwg": sha256}, folder=folder, run=RUN
    )
    (file,) = document["files"]
    return list(file["sheets"])


def _same_box(a: list[float] | None, b: list[float] | None) -> bool:
    return (
        a is not None
        and b is not None
        and all(math.isclose(x, y, abs_tol=1e-6) for x, y in zip(a, b, strict=True))
    )


def fellow(sheet: dict[str, Any], among: list[dict[str, Any]]) -> dict[str, Any]:
    """The harness's sheet at the job sheet's place: by layout name, else by frame box."""
    where = sheet["location"]
    if where["layout"] is not None:
        found = [s for s in among if s["location"]["layout"] == where["layout"]]
    else:
        found = [
            s
            for s in among
            if s["location"]["layout"] is None and _same_box(s["location"]["box"], where["box"])
        ]
    assert len(found) == 1, f"the harness read no sheet, or several, at {where}"
    return found[0]


@pytest.mark.needs_toolchain
@pytest.mark.django_db
@pytest.mark.usefixtures("engine_readers")
def test_every_model_space_sheet_in_the_jobs_export_has_the_paper_the_harness_gives(
    qs_project: QsProject, built: dict[str, Path], tmp_path: Path
) -> None:
    by_harness = harness_sheets(built[MODEL], tmp_path / "harness.json")
    by_job = job_sheets(qs_project, built[MODEL], MODEL)

    in_model_space = [s for s in by_job if s["location"]["layout"] is None]
    assert in_model_space, "the job read no sheet in model space from the model-space set"
    for sheet in in_model_space:
        assert sheet["paper"] is not None, f"no paper for the sheet at {sheet['location']}"
        assert sheet["paper"] == fellow(sheet, by_harness)["paper"]


@pytest.mark.needs_toolchain
@pytest.mark.django_db
@pytest.mark.usefixtures("engine_readers")
def test_every_layout_sheet_in_the_jobs_export_has_its_own_paper_as_the_harness_gives(
    qs_project: QsProject, built: dict[str, Path], tmp_path: Path
) -> None:
    by_harness = harness_sheets(built[LAYOUTS], tmp_path / "harness.json")
    by_job = job_sheets(qs_project, built[LAYOUTS], LAYOUTS)

    on_layouts = [s for s in by_job if s["location"]["layout"] is not None]
    assert on_layouts, "the job read no layout sheet from the layouts set"
    for sheet in on_layouts:
        assert sheet["paper"] == fellow(sheet, by_harness)["paper"]
        assert sheet["paper"] is not None, f"no paper for layout {sheet['location']['layout']}"


def test_the_jobs_export_no_longer_names_papers_among_what_it_cannot_say() -> None:
    assert [gap for gap in export.GAPS if "paper" in gap.lower()] == []
