"""S16-T1: the frame read job. "Finish: idempotent re-run; values in drawing units with verbatim text;
a failed family writes a Question, never silence." Fixtures and the names chosen: `frame.py`."""

import importlib
import json
import uuid
from types import ModuleType
from typing import Any

import pytest

from vextrus.platform.services import auth
from vextrus.takeoff.models import Proposal, ProposalTrace, Question
from vextrus.testing.drawings import QsProject
from vextrus.testing.jobs import run_inline
from vextrus.testing.tenancy import Member

from .frame import (
    FAMILY_FAILED,
    GRID_TEXT,
    SIZE_TEXT,
    Frame,
    fake_family,
    make_frame,
    structural_frame,
    use_families,
)

__all__ = ["structural_frame"]


def _proposals(member: Member, project_id: uuid.UUID) -> list[Proposal]:
    with member.acting():
        return list(Proposal.objects.filter(project_id=project_id).exclude(family_key=""))


def _traces(member: Member, proposal_ids: list[uuid.UUID]) -> list[ProposalTrace]:
    with member.acting():
        return list(ProposalTrace.objects.filter(proposal_id__in=proposal_ids))


def _failed(member: Member, project_id: uuid.UUID) -> list[Question]:
    with member.acting():
        return list(Question.objects.filter(project_id=project_id, message_code=FAMILY_FAILED))


@pytest.fixture
def frame_read() -> ModuleType:
    """The service under test (imported by name, so the file collects before it is built)."""
    return importlib.import_module("vextrus.takeoff.services.frame_read")


def _run(f: Frame) -> Any:
    with f.member.acting():
        return importlib.import_module("vextrus.takeoff.services.frame_read").run(f.building_id)


def test_each_candidate_on_a_confirmed_view_is_one_proposal_with_its_traces(
    frame_read: ModuleType, structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    grid, column = fake_family("grid_line", "grid"), fake_family("column", "columns")
    use_families(monkeypatch, grid, column)

    result = _run(f)

    written = _proposals(f.member, f.project_id)
    read = grid.given() | column.given()
    assert f.confirmed_views <= read
    # One candidate per view given, per family.
    by_family = {k: [p for p in written if p.family_key == k] for k in ("grid_line", "column")}
    assert len(by_family["grid_line"]) == len(grid.given())
    assert len(by_family["column"]) == len(column.given())
    assert {p.step for p in by_family["grid_line"]} == {"grid"}
    assert {p.step for p in by_family["column"]} == {"columns"}
    assert {p.values["axis"] for p in by_family["grid_line"]} == {"x"}
    assert result.proposals == len(written)
    assert result.questions == 0
    traces = _traces(f.member, [p.id for p in written])
    facts: dict[uuid.UUID, set[str]] = {}
    for t in traces:
        facts.setdefault(t.proposal_id, set()).add(t.fact)
    for p in by_family["grid_line"]:
        assert facts.get(p.id) == {"offset"}
    for p in by_family["column"]:
        assert facts.get(p.id) == {"section_b", "section_d"}


def test_values_are_kept_in_drawing_units_with_their_verbatim_text(
    frame_read: ModuleType, structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("grid_line", "grid"), fake_family("column", "columns"))

    _run(f)

    written = _proposals(f.member, f.project_id)
    columns = [p for p in written if p.family_key == "column"]
    grids = [p for p in written if p.family_key == "grid_line"]
    assert columns
    assert grids
    for p in columns:
        text = json.dumps(p.values)
        assert '"254"' in text
        assert '"508"' in text
        assert "0.254" not in text
        assert "0.508" not in text
        assert json.dumps(SIZE_TEXT) in text  # the size label verbatim
    for p in grids:
        text = json.dumps(p.values)
        assert json.dumps(GRID_TEXT) in text
        assert "6.0" not in text
        assert "6000.0" not in text


def test_no_view_of_a_sheet_not_confirmed_at_step_1_is_read(
    frame_read: ModuleType, structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    grid, column = fake_family("grid_line", "grid"), fake_family("column", "columns")
    use_families(monkeypatch, grid, column)

    _run(f)

    assert not (grid.given() | column.given()) & f.unconfirmed_views
    for p in _proposals(f.member, f.project_id):
        assert not any(v in p.candidate_key for v in f.unconfirmed_views)


def test_a_building_with_no_view_confirmed_gets_no_proposal(
    frame_read: ModuleType, qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = make_frame(qs_project.member, qs_project.project_id, confirm=False)
    grid = fake_family("grid_line", "grid")
    use_families(monkeypatch, grid)

    result = _run(f)

    assert grid.given() == set()
    assert _proposals(f.member, f.project_id) == []
    assert result.proposals == 0


def test_a_second_run_writes_no_duplicate(
    frame_read: ModuleType, structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("grid_line", "grid"), fake_family("column", "columns"))

    _run(f)
    first = _proposals(f.member, f.project_id)
    first_traces = _traces(f.member, [p.id for p in first])
    _run(f)
    second = _proposals(f.member, f.project_id)

    assert first
    assert sorted(p.candidate_key for p in second) == sorted(p.candidate_key for p in first)
    assert len({(p.step, p.candidate_key) for p in second}) == len(second)
    assert len(_traces(f.member, [p.id for p in second])) == len(first_traces)


def test_a_family_that_raises_writes_a_question_and_the_others_still_write(
    frame_read: ModuleType, structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    grid = fake_family("grid_line", "grid")
    column = fake_family("column", "columns", raises=True)
    use_families(monkeypatch, column, grid)  # the failing one first: the next still runs

    result = _run(f)

    asked = _failed(f.member, f.project_id)
    assert len(asked) == 1
    assert asked[0].params["family"] == "column"
    assert asked[0].building_id == f.building_id
    assert asked[0].status == "open"
    assert result.questions == 1
    written = _proposals(f.member, f.project_id)
    assert {p.family_key for p in written} == {"grid_line"}
    assert len(written) == len(grid.given()) > 0


def test_a_second_run_of_a_failing_family_asks_once(
    frame_read: ModuleType, structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("column", "columns", raises=True))

    _run(f)
    _run(f)

    assert len(_failed(f.member, f.project_id)) == 1


def test_another_tenant_sees_nothing_the_frame_read_wrote(
    frame_read: ModuleType,
    structural_frame: Frame,
    sign_in: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    f = structural_frame
    use_families(
        monkeypatch,
        fake_family("grid_line", "grid"),
        fake_family("column", "columns", raises=True),
    )
    other: Member = sign_in(role="qs")  # type: ignore[operator]

    _run(f)

    with f.member.acting():
        ours = list(Proposal.objects.filter(project_id=f.project_id).exclude(family_key=""))
        asked = list(Question.objects.filter(project_id=f.project_id, message_code=FAMILY_FAILED))
    assert ours
    assert asked
    assert {p.tenant_id for p in ours} == {f.member.developer_id}
    assert {q.tenant_id for q in asked} == {f.member.developer_id}
    with other.acting():
        assert not Proposal.objects.filter(project_id=f.project_id).exists()
        assert not ProposalTrace.objects.filter(project_id=f.project_id).exists()
        assert not Question.objects.filter(message_code=FAMILY_FAILED).exists()


def test_a_tenant_cannot_run_the_frame_read_on_another_tenants_building(
    frame_read: ModuleType,
    structural_frame: Frame,
    sign_in: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    f = structural_frame
    grid = fake_family("grid_line", "grid")
    use_families(monkeypatch, grid)
    other: Member = sign_in(role="qs")  # type: ignore[operator]

    with other.acting(), pytest.raises(auth.NotFound):
        frame_read.run(f.building_id)

    assert grid.given() == set()
    assert _proposals(f.member, f.project_id) == []


def test_the_read_frame_task_runs_the_frame_read(
    frame_read: ModuleType, structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    grid = fake_family("grid_line", "grid")
    use_families(monkeypatch, grid)

    task = importlib.import_module("vextrus.takeoff.tasks.frame_read")
    run_inline(
        task.read_frame,
        tenant_id=f.member.developer_id,
        user_id=f.member.user.pk,
        building_id=f.building_id,
    )

    written = _proposals(f.member, f.project_id)
    assert written
    assert {p.family_key for p in written} == {"grid_line"}
    assert f.confirmed_views <= grid.given()
