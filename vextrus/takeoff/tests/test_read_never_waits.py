"""#227: Step 1's acts never wait on a read job. The acceptance tests (`acceptance/treadlock`) pin
confirm, exclude and answer; here the same harness runs undo (the orchestrator's ruling), and
`step1.progress_at_end`, which keeps a read job's progress write to the moment before it commits.

    uv run pytest -rf vextrus/takeoff/tests/test_read_never_waits.py
"""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from django.db import transaction

from engine.read import pdf as pdf_reader
from vextrus.takeoff.models import StepProgress
from vextrus.takeoff.services import step1 as step1_services
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    confirm,
    jev_says,
    of_number,
    proposals,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.takeoff.tests.acceptance.treadlock.test_acts_never_wait_on_a_read import (
    SECOND_PLOT,
    SHEETS,
    Parked,
    act_while_the_later_file_reads,
    counted_progress,
    kept_progress,
    read_first_and_plot,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, drawing
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "owner"])


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    """Jev answers every sheet's kind surely, as in the acceptance tests."""
    jev_says(jev_offline, "0.97")


@pytest.fixture
def parked(monkeypatch: pytest.MonkeyPatch) -> Iterator[Parked]:
    """The Plot's page reading, parked on demand (the acceptance tests' `Parked`)."""
    plot_reading = Parked()
    monkeypatch.setattr(pdf_reader, "page_text", plot_reading)
    yield plot_reading
    plot_reading.released.set()


def _later_plot(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    """Both DWGs and the first Plot read; a second Plot uploaded, not yet read."""
    later_dwg = read_first_and_plot(qs, monkeypatch)
    run_job(qs.member, later_dwg, monkeypatch, readers(SHEETS))
    content = drawing("pdf", f"{SECOND_PLOT} {uuid.uuid4()}")
    return uploaded(qs.member, qs.project_id, SECOND_PLOT, content)


def _later_dwg(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    return read_first_and_plot(qs, monkeypatch)


LATER = {"dwg": _later_dwg, "pdf": _later_plot}


@pytest.mark.parametrize("later_file", list(LATER))
def test_undo_on_step_1_completes_while_a_later_file_is_matched_to_the_plot(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked, later_file: str
) -> None:
    """The QS confirmed S-01, then a later file is read; mid-way through its Plot's matching, the QS
    undoes the confirmation: it is answered and taken back without waiting on the job, and Step 1's
    kept progress counts it once the job ends."""
    later = LATER[later_file](qs_project, monkeypatch)
    api = api_as(qs_project.member)
    project_id = qs_project.project_id
    [s01] = of_number(proposals(api, project_id), "S-01")
    assert confirm(api, project_id, [s01["id"]]).status_code == 200

    overlap = act_while_the_later_file_reads(
        qs_project, later, monkeypatch, parked, lambda: api.post(f"{step1(project_id)}/undo", {})
    )

    assert not overlap.waited_on_the_job, "the undo waited on the read job's transaction"
    assert overlap.response.status_code == 200, overlap.response.content
    assert the(proposals(api, project_id), "S-01")["decision"] in (None, "", "proposed")
    member = qs_project.member
    assert kept_progress(member, project_id) == counted_progress(member, project_id)
    assert kept_progress(member, project_id)["structural"][1] == 0


def _kept(project_id: uuid.UUID) -> dict[str, Any]:
    rows = StepProgress.objects.filter(project_id=project_id, step="sheets", building_id=None)
    return {r.discipline: (r.placed, r.total, r.updated_at) for r in rows}


def test_progress_at_end_writes_the_rows_once_as_the_block_ends(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    """Inside the block, recording progress writes nothing (so the rows are not held while the
    block works); as it ends, they are written once, as counted then."""
    read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    written: list[uuid.UUID] = []
    real = StepProgress.objects.update_or_create

    def counted(*args: Any, **kwargs: Any) -> Any:
        written.append(kwargs["project_id"])
        return real(*args, **kwargs)

    monkeypatch.setattr(StepProgress.objects, "update_or_create", counted)
    with qs_project.member.acting(), transaction.atomic():
        before = _kept(project_id)
        with step1_services.progress_at_end():
            step1_services.record_progress(project_id)
            step1_services.record_progress(project_id)
            assert not written, "a progress row was written inside the block"
            assert _kept(project_id) == before
        rows = len(step1_services.progress(project_id).disciplines)
        assert written == [project_id] * rows


def test_progress_at_end_writes_nothing_when_its_block_raises(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    with qs_project.member.acting():
        before = _kept(project_id)

        def failing_step() -> None:
            with transaction.atomic(), step1_services.progress_at_end():
                step1_services.record_progress(project_id)
                raise RuntimeError("the step failed")

        with pytest.raises(RuntimeError, match="the step failed"):
            failing_step()
        assert _kept(project_id) == before
        # And outside a block, it writes at once again.
        with transaction.atomic():
            step1_services.record_progress(project_id)
        assert _kept(project_id) != before
