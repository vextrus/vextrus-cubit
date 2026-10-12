"""S16-L: `apply` is the sole writer, versions are append-only, `snapshot` and `figures_hash`
(M1.md C7; docs/data-model.md §3.3: ModelVersion, ElementState)."""

import uuid

import pytest

from vextrus.live_model.tests.acceptance.ts16l.model import building_of, column, live, tables
from vextrus.testing.drawings import QsProject


@pytest.mark.django_db
def test_apply_creates_the_next_model_version_and_its_element_states(qs_project: QsProject) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        first = live.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        second = live.apply(
            building, uuid.uuid4(), [column(grid_ref="C/2", mark="C3")], cause="confirmation"
        )
        assert second.seq == first.seq + 1
        assert list(
            tables.ModelVersion.objects.filter(building_id=building)
            .order_by("seq")
            .values_list("seq", flat=True)
        ) == [
            first.seq,
            second.seq,
        ]
        opened = tables.ElementState.objects.filter(valid_from_seq=second.seq, valid_to_seq=None)
        assert [s.mark for s in opened] == ["C3"]


@pytest.mark.django_db
def test_a_changed_fact_closes_the_old_state_and_opens_a_new_one(qs_project: QsProject) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        first = live.apply(building, uuid.uuid4(), [column("0.254")], cause="confirmation")
        old = tables.ElementState.objects.get(valid_from_seq=first.seq)
        second = live.apply(building, uuid.uuid4(), [column("0.305")], cause="confirmation")
        states = list(
            tables.ElementState.objects.filter(element_id=old.element_id).order_by("valid_from_seq")
        )
        assert len(states) == 2
        assert states[0].pk == old.pk
        assert states[0].attrs["vx.column.section_b"] == "0.254"  # never updated in place
        assert states[0].valid_to_seq == second.seq
        assert states[1].attrs["vx.column.section_b"] == "0.305"
        assert (states[1].valid_from_seq, states[1].valid_to_seq) == (second.seq, None)


@pytest.mark.django_db
def test_snapshot_returns_the_states_valid_at_a_seq(qs_project: QsProject) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        first = live.apply(building, uuid.uuid4(), [column("0.254")], cause="confirmation")
        second = live.apply(building, uuid.uuid4(), [column("0.305")], cause="confirmation")
        then = live.snapshot(building, first.seq)
        now = live.snapshot(building, second.seq)
        latest = live.snapshot(building)
    assert [s.attrs["vx.column.section_b"] for s in then.states] == ["0.254"]
    assert [s.attrs["vx.column.section_b"] for s in now.states] == ["0.305"]
    assert [s.attrs["vx.column.section_b"] for s in latest.states] == ["0.305"]


@pytest.mark.django_db
def test_figures_hash_is_stable_for_the_same_figures_and_changes_with_a_figure(
    qs_project: QsProject,
) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        first = live.apply(building, uuid.uuid4(), [column("0.254")], cause="confirmation")
        same = live.apply(building, uuid.uuid4(), [column("0.254")], cause="confirmation")
        changed = live.apply(building, uuid.uuid4(), [column("0.305")], cause="confirmation")
        h1 = live.figures_hash(building, first.seq)
        assert h1 == live.figures_hash(building, first.seq)
        assert live.figures_hash(building, same.seq) == h1
        assert live.figures_hash(building, changed.seq) != h1
        assert tables.ModelVersion.objects.get(
            building_id=building, seq=changed.seq
        ).figures_hash == live.figures_hash(building, changed.seq)


@pytest.mark.django_db
def test_figures_hash_is_written_as_sha256(qs_project: QsProject) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        version = live.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        assert live.figures_hash(building, version.seq).startswith("sha256:")
