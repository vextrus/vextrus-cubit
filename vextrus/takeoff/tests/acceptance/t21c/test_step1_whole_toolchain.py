"""Ticket 21c, "the whole-Step-1 API test on a synthetic DWG" (docs/plans/M0.md, 21c), with the
engine's own readers: invented layout sheets drawn with ezdxf (17's synthetic frame and views,
`engine/recognise/tests/acceptance/t17/drawing.py`) and written to DWG by the repo's writer
(`engine/fixtures/dwg`) in the test's folder, uploaded through the API, read by the product's read
job, then proposed, asked, confirmed and counted to the end of Step 1. Needs the toolchain; the same
steps on hand-built artefacts, with no toolchain, are `test_step1_whole.py` and its neighbours.

The structural file: S-201 (four views; its "SECTION A-A" has no subject, so no step reads it: one
view unaccounted), S-202 R0 and S-202 R1 (one number twice), S-203 (a title with `%%C`; three pile
cap views). The electrical file: E-01 (a lighting plan and the legend).
"""

import uuid
from pathlib import Path
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.jobs import run_inline
from vextrus.testing.tenancy import Member

from .step1_whole import (
    answer,
    confirm,
    coverage,
    exclude,
    jev_says,
    keys,
    no_raw_code,
    of_number,
    open_questions,
    progress,
    proposals,
    upload,
    uploaded,
)

pytestmark = [pytest.mark.django_db, pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]

STRUCTURAL = "KR-STR-R0.dwg"
ELECTRICAL = "KR-ELE-R0.dwg"


def _write(doc: Any, folder: Path, writer: Path, name: str) -> bytes:
    from engine.fixtures import dwg
    from engine.recognise.tests.acceptance.t17 import drawing as t17

    dxf = folder / f"{name}.dxf"
    out = folder / f"{name}.dwg"
    doc.saveas(dxf)
    dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(out), t17.VERSION], 120)
    return out.read_bytes()


def _layout(doc: Any, name: str, number: str, title: tuple[str, str], rev: str,
            views: tuple[tuple[str, tuple[float, float, float, float], str], ...]) -> None:  # fmt: skip
    from engine.recognise.tests.acceptance.t17 import drawing as t17

    layout = doc.layouts.new(name)
    attributes = t17._attributes(number, title) | {"REV": rev}
    layout.add_blockref("BORDER-L", (0, 0)).add_auto_attribs(attributes)
    middle = (t17.PAPER[0] / 2, t17.PAPER[1] / 2)
    layout.add_viewport(center=middle, size=t17.PAPER, view_center_point=middle,
                        view_height=t17.PAPER[1])  # fmt: skip
    for view_title, region, kind in views:
        t17._view(layout, view_title, region, kind, (0.0, 0.0), 1.0)


def _new() -> Any:
    from engine.fixtures.dwg import new_drawing
    from engine.recognise.tests.acceptance.t17 import drawing as t17

    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    t17._frame(doc.blocks.new("BORDER-L", base_point=(0, 0)))
    return doc


@pytest.fixture(scope="module")
def dwgs(tmp_path_factory: pytest.TempPathFactory) -> dict[str, bytes]:
    from engine.fixtures import dwg
    from engine.recognise.tests.acceptance.t17 import drawing as t17

    folder = tmp_path_factory.mktemp("t21c-dwgs")
    writer = dwg.build_writer(folder / "writer")
    structural = _new()
    for number, (title, views) in t17.LAYOUT_SHEETS.items():
        _layout(structural, number, number, title, "R0", views)
    s202_title, s202_views = t17.LAYOUT_SHEETS["S-202"]
    _layout(structural, "S-202 R1", "S-202", s202_title, "R1", s202_views)
    _layout(structural, "S-203", "S-203", ("PILE CAP %%C600", "LAYOUT PLAN"), "R0",
            (("PILE CAP LAYOUT PLAN", t17.TOP_LEFT, "plan"),
             ("PILE CAP SECTION", t17.TOP_RIGHT, "section"),
             ("PILE CAP SCHEDULE", t17.BOTTOM_LEFT, "schedule")))  # fmt: skip
    electrical = _new()
    _layout(electrical, "E-01", "E-01", ("LIGHTING", "LAYOUT PLAN"), "R0", (
        ("GROUND FLOOR LIGHTING LAYOUT PLAN", t17.TOP_LEFT, "plan"),
        ("ELECTRICAL LEGEND", t17.TOP_RIGHT, "legend"),
    ))  # fmt: skip
    return {
        STRUCTURAL: _write(structural, folder, writer, "structural"),
        ELECTRICAL: _write(electrical, folder, writer, "electrical"),
    }


@pytest.fixture(scope="module")
def dumper(tmp_path_factory: pytest.TempPathFactory) -> Path:
    from engine.read.acadsharp.tests.build import build_dumper

    return build_dumper(tmp_path_factory.mktemp("t21c-dumper"))


@pytest.fixture(autouse=True)
def engine_readers(dumper: Path, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper))
    jev_says(jev_offline, "0.97")


def read(member: Member, project_id: uuid.UUID, name: str, content: bytes) -> uuid.UUID:
    from vextrus.takeoff.tasks import read_file

    file_id = uploaded(member, project_id, name, content)
    run_inline(read_file.read_file, tenant_id=member.developer_id, user_id=member.user.pk,
               file_id=file_id)  # fmt: skip
    return file_id


def read_structural(qs: QsProject, dwgs: dict[str, bytes]) -> Any:
    read(qs.member, qs.project_id, STRUCTURAL, dwgs[STRUCTURAL])
    return api_as(qs.member)


def test_a_synthetic_dwg_uploaded_and_read_by_the_job_is_proposed_sheet_by_sheet(
    qs_project: QsProject, dwgs: dict[str, bytes]
) -> None:
    api = read_structural(qs_project, dwgs)

    listed = proposals(api, qs_project.project_id)

    assert sorted(p["number"] for p in listed) == ["S-201", "S-202", "S-202", "S-203"]
    assert all(p["discipline"] == "structural" and p["id"] != p["sheet_id"] for p in listed)


def test_every_view_is_counted_and_the_one_no_step_reads_is_named_unaccounted(
    qs_project: QsProject, dwgs: dict[str, bytes]
) -> None:
    api = read_structural(qs_project, dwgs)
    [s201] = of_number(proposals(api, qs_project.project_id), "S-201")

    shown = coverage(api, qs_project.project_id)

    # S-201 4, each S-202 3, S-203 3.
    assert (shown["views"], shown["proposed"], shown["unaccounted"]) == (13, 12, 1)
    [lone] = shown["unaccounted_views"]
    assert lone["sheet_id"] == s201["sheet_id"]


def test_the_number_drawn_twice_is_one_conflict_holding_both_copies(
    qs_project: QsProject, dwgs: dict[str, bytes]
) -> None:
    api = read_structural(qs_project, dwgs)
    copies = of_number(proposals(api, qs_project.project_id), "S-202")

    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert q["code"] == conflict_codes.SAME_NUMBER.code
    assert sorted(q["proposals"]) == sorted(p["id"] for p in copies)
    assert sorted(p["revision_mark"] for p in copies) == ["R0", "R1"]


def test_the_whole_step_ends_confirmed_with_no_view_proposed_or_unaccounted(
    qs_project: QsProject, dwgs: dict[str, bytes]
) -> None:
    api = read_structural(qs_project, dwgs)
    [q] = open_questions(api, qs_project.project_id, "conflict")
    assert answer(api, qs_project.project_id, q["id"], keys(q)[0]).status_code == 200
    [lone] = coverage(api, qs_project.project_id)["unaccounted_views"]
    left_out = exclude(api, qs_project.project_id, [lone["id"]], "other", "part of the title block")
    assert left_out.status_code == 200, left_out.content
    undecided = [p["id"] for p in proposals(api, qs_project.project_id) if p["decision"] is None]

    bulk = confirm(api, qs_project.project_id, undecided)

    assert bulk.status_code == 200, bulk.content
    shown = coverage(api, qs_project.project_id)
    assert (shown["proposed"], shown["unaccounted"]) == (0, 0)
    assert shown["by_reason"].get("other") == 1
    assert open_questions(api, qs_project.project_id) == []
    assert progress(api, qs_project.project_id)["structural"]["status"] == "confirmed"


def test_an_electrical_dwg_opens_only_its_own_step_1_its_views_assigned_to_its_part(
    qs_project: QsProject, dwgs: dict[str, bytes]
) -> None:
    api = read_structural(qs_project, dwgs)
    structural = {p["id"] for p in proposals(api, qs_project.project_id)}

    read(qs_project.member, qs_project.project_id, ELECTRICAL, dwgs[ELECTRICAL])

    listed = proposals(api, qs_project.project_id)
    [e01] = [p for p in listed if p["id"] not in structural]
    assert (e01["number"], e01["discipline"]) == ("E-01", "electrical")
    assert confirm(api, qs_project.project_id, [e01["id"]]).status_code == 200
    assert coverage(api, qs_project.project_id)["by_step"].get("electrical") == 2
    rows = progress(api, qs_project.project_id)
    assert rows["electrical"]["status"] == "confirmed"
    assert rows["structural"]["status"] == "in_review"


def test_no_title_read_from_the_dwg_holds_a_raw_code(
    qs_project: QsProject, dwgs: dict[str, bytes]
) -> None:
    api = read_structural(qs_project, dwgs)
    listed = proposals(api, qs_project.project_id)

    assert of_number(listed, "S-203")
    assert all(p["id"] != p["sheet_id"] for p in listed)  # the job's Proposals
    assert no_raw_code([p["title"] for p in listed])
    assert no_raw_code(open_questions(api, qs_project.project_id))


def test_uploading_the_same_dwg_again_changes_nothing(
    qs_project: QsProject, dwgs: dict[str, bytes]
) -> None:
    api = read_structural(qs_project, dwgs)
    before = proposals(api, qs_project.project_id)
    assert before
    assert all(p["id"] != p["sheet_id"] for p in before)

    again = upload(qs_project.member, qs_project.project_id, STRUCTURAL, dwgs[STRUCTURAL])

    assert again.status_code == 200, again.content
    assert again.json()["outcome"] == "already_here"
    assert proposals(api, qs_project.project_id) == before
