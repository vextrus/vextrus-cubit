"""Ticket 21b on the engine's own readers: the per-sheet steps (docs/plans/M0.md, 21b: "Per-sheet
steps: segmentation and views ..., each file's candidates stamped with its Building as their group,
buffers, Plot registration and F1, recorded through `drawings.services`; each keyed and skipped on
restart") on 13's synthetic set A (`engine/fixtures/dwg/sheet_set_layouts.py`: "3 sheets, by
layout"), saved as a DWG by the repo's writer in the test's folder.

Step names are `drawings`' own: `sheets`, then `sheet_<n>` for each sheet (`drawings.sheet_step`,
"Reading sheet 12 of 38").
"""

import uuid
from pathlib import Path
from typing import Any

import pytest
from procrastinate.job_context import AbortReason

from vextrus.drawings import services as drawings
from vextrus.drawings.models import ReadStep, SheetRevision, View
from vextrus.platform.services import auth, jobs
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add
from vextrus.testing.jobs import run_inline
from vextrus.testing.tenancy import Member

pytestmark = [pytest.mark.django_db, pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]

SHEETS = 3
"""What the finder must read from set A (its fixture's docstring)."""


@pytest.fixture(scope="module")
def set_a(tmp_path_factory: pytest.TempPathFactory) -> bytes:
    from engine.fixtures import dwg

    folder = tmp_path_factory.mktemp("t21b-set-a")
    return dwg.build("sheet_set_layouts", folder, dwg.build_writer(folder)).read_bytes()


@pytest.fixture(scope="module")
def titled(tmp_path_factory: pytest.TempPathFactory) -> bytes:
    """17's synthetic layout sheets with titled views (engine/recognise/tests/acceptance/t17/drawing.py:
    S-201 and S-202, each view a drawing and its title), written to DWG by the repo's writer."""
    from engine.recognise.tests.acceptance.t17 import drawing as t17

    folder = tmp_path_factory.mktemp("t21b-titled")
    return (t17.build_set(folder / "set", folder) / "structural" / "S-layouts.dwg").read_bytes()


@pytest.fixture(scope="module")
def dumper(tmp_path_factory: pytest.TempPathFactory) -> Path:
    from engine.read.acadsharp.tests.build import build_dumper

    return build_dumper(tmp_path_factory.mktemp("t21b-dumper"))


@pytest.fixture
def engine_readers(dumper: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper))


def run_job(member: Member, file_id: uuid.UUID, abort_reason: Any = lambda: None) -> None:
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=abort_reason,
        file_id=file_id,
    )


def kept(member: Member, file_id: uuid.UUID) -> dict[str, ReadStep]:
    with member.acting():
        rows = list(ReadStep.objects.filter(file_id=file_id))
    names = [row.step for row in rows]
    assert len(names) == len(set(names)), f"a step kept twice: {names}"
    return {row.step: row for row in rows}


def printed(member: Member, file_id: uuid.UUID) -> list[drawings.SheetView]:
    with member.acting():
        found = drawings.file(file_id)
        return [s for s in drawings.sheets(found.set_id) if s.file_id == file_id]


def test_each_sheet_has_its_own_kept_step(
    qs_project: QsProject, set_a: bytes, engine_readers: None
) -> None:
    file_id = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id

    run_job(qs_project.member, file_id)

    steps = kept(qs_project.member, file_id)
    assert drawings.SHEETS in steps
    assert {drawings.sheet_step(n) for n in range(1, SHEETS + 1)} <= set(steps)
    assert drawings.sheet_step(SHEETS + 1) not in steps
    with qs_project.member.acting():
        assert drawings.file(file_id).state == drawings.FileState.READ


def test_the_sheets_found_are_recorded_stamped_with_the_files_building(
    qs_project: QsProject, set_a: bytes, engine_readers: None
) -> None:
    file_id = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id

    run_job(qs_project.member, file_id)

    with qs_project.member.acting():
        building = drawings.file(file_id).building_id
    sheets = printed(qs_project.member, file_id)
    assert len(sheets) == SHEETS
    assert {s.building_id for s in sheets} == {building}
    assert sorted(s.ordinal for s in sheets) == list(range(1, SHEETS + 1))


def test_each_sheet_gets_its_views_and_its_render(
    qs_project: QsProject, titled: bytes, engine_readers: None
) -> None:
    """17's sheets: each sheet's views are its drawing's titled views; each sheet has its render."""
    from engine.recognise.tests.acceptance.t17 import drawing as t17

    file_id = add(qs_project.member, qs_project.project_id, "S-layouts.dwg", titled).file.id

    run_job(qs_project.member, file_id)

    sheets = printed(qs_project.member, file_id)
    assert sorted(s.number or "" for s in sheets) == sorted(t17.LAYOUT_SHEETS)
    for sheet in sheets:
        expected = {title for title, _region, _kind in t17.LAYOUT_SHEETS[sheet.number or ""][1]}
        with qs_project.member.acting():
            titles = {view.title for view in drawings.views(sheet.id)}
            assert expected <= titles, f"sheet {sheet.number} is missing views"
            assert drawings.sheet(sheet.id).has_render
            assert drawings.render(sheet.id)


def test_a_sheet_with_no_pdf_in_the_set_says_why_it_has_no_plot(
    qs_project: QsProject, set_a: bytes, engine_readers: None
) -> None:
    """Plot registration ran and found no PDF for the Discipline: m0-screens 4.6's "no PDF", no page."""
    file_id = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id

    run_job(qs_project.member, file_id)

    for sheet in printed(qs_project.member, file_id):
        assert sheet.plot.page is None
        assert sheet.plot.none is not None
        assert sheet.plot.render_f1 is None


def test_reading_the_file_again_keeps_every_sheet_as_it_was(
    qs_project: QsProject, set_a: bytes, engine_readers: None
) -> None:
    file_id = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id
    run_job(qs_project.member, file_id)
    steps = {name: row.id for name, row in kept(qs_project.member, file_id).items()}
    sheets = {s.id for s in printed(qs_project.member, file_id)}
    with qs_project.member.acting():
        views = {v.id for s in sheets for v in drawings.views(s)}

    run_job(qs_project.member, file_id)

    assert {name: row.id for name, row in kept(qs_project.member, file_id).items()} == steps
    assert {s.id for s in printed(qs_project.member, file_id)} == sheets
    with qs_project.member.acting():
        assert {v.id for s in sheets for v in drawings.views(s)} == views


class KeptSheetSteps:
    """How many `sheet_<n>` steps this test has seen end (09's `Steps.run` returning): a count the
    test owns, so the stop check reads no database (09 refuses a query outside a step)."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.count = 0
        original = jobs.Steps.run

        def counted(steps: jobs.Steps, name: str, *args: Any, **kwargs: Any) -> Any:
            result = original(steps, name, *args, **kwargs)
            if name.startswith("sheet_"):
                self.count += 1
            return result

        monkeypatch.setattr(jobs.Steps, "run", counted)


def rows_of_file(member: Member, file_id: uuid.UUID) -> tuple[set[uuid.UUID], set[uuid.UUID]]:
    """The file's printed sheets and their views, as its tenant sees them, read or still reading."""
    with member.acting():
        sheets = set(SheetRevision.objects.filter(source_file_id=file_id).values_list("id", flat=True))
        views = set(View.objects.filter(sheet_revision_id__in=sheets).values_list("id", flat=True))
    return sheets, views


def test_a_stop_after_the_first_sheet_resumes_at_the_second(
    qs_project: QsProject, set_a: bytes, engine_readers: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The worker stops once sheet 1 is kept; the next try skips every kept step (nothing kept before
    the stop is written again) and reads the rest."""
    file_id = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id
    member = qs_project.member
    seen = KeptSheetSteps(monkeypatch)

    def stop_once_sheet_1_is_kept() -> AbortReason | None:
        return AbortReason.SHUTDOWN if seen.count >= 1 else None

    with pytest.raises(jobs.Stopped):
        run_job(member, file_id, abort_reason=stop_once_sheet_1_is_kept)
    before = kept(member, file_id)
    assert drawings.sheet_step(1) in before
    assert drawings.sheet_step(2) not in before
    sheets, views = rows_of_file(member, file_id)
    with member.acting():
        assert drawings.file(file_id).state != drawings.FileState.READ

    run_job(member, file_id)

    after = kept(member, file_id)
    assert {name: after[name].id for name in before} == {name: row.id for name, row in before.items()}
    assert {drawings.sheet_step(n) for n in range(1, SHEETS + 1)} <= set(after)
    sheets_after, views_after = rows_of_file(member, file_id)
    assert sheets_after == sheets
    assert views <= views_after
    with member.acting():
        assert drawings.file(file_id).state == drawings.FileState.READ


def test_what_the_sheet_steps_write_is_the_files_tenants_alone(
    qs_project: QsProject, set_a: bytes, engine_readers: None, sign_in: Any
) -> None:
    file_id = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id
    run_job(qs_project.member, file_id)
    sheets = printed(qs_project.member, file_id)
    other = sign_in(role="qs")

    assert all(
        row.tenant_id == qs_project.member.developer_id
        for row in kept(qs_project.member, file_id).values()
    )
    with other.acting():
        assert not ReadStep.objects.filter(file_id=file_id).exists()
    for sheet in sheets:
        with other.acting(), pytest.raises(auth.NotFound):
            drawings.sheet(sheet.id)
