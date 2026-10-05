"""Step 1's acts in the event log (T-W323), at the service seam: each event's payload, who of a
Developer's members reads it (`invitations.visible_events`), a views-only exclusion, and the event
written before the act's `record_progress` (so the progress lock stays the transaction's last
statement). The sheets are `vextrus/testing/takeoff.py`'s; the rest is invented."""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.db.models import QuerySet

from vextrus.drawings import services as drawings
from vextrus.platform.services import invitations, tenancy
from vextrus.takeoff.services import step1
from vextrus.testing.takeoff import Step1Project
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def step1_acts() -> QuerySet[Any]:
    """The Step 1 act events the acting member may see (an unscoped QS: all the Developer's)."""
    viewer = tenancy.current_membership()
    assert viewer is not None
    found = invitations.visible_events(viewer).filter(kind__startswith="takeoff.step1.")
    return found.order_by("occurred_at", "id")


def step1_events(member: Member) -> list[Any]:
    with member.acting():
        return list(step1_acts())


def test_a_confirm_s_event_names_its_act_actor_and_project(step1_project: Step1Project) -> None:
    qs, project = step1_project.member, step1_project.project_id
    with qs.acting():
        made = step1.confirm(project, [step1_project.proposals[1]], actor_name=qs.user.name)

    [event] = step1_events(qs)

    assert (event.kind, event.payload) == ("takeoff.step1.confirmed", {"sheets": 1})
    assert (event.subject_type, event.subject_id) == ("confirmation", made.confirmation_id)
    assert (event.actor_user_id, event.project_id, event.building_id) == (qs.user.pk, project, None)
    assert event.tenant_id == qs.developer_id


def test_an_exclusion_with_a_view_of_another_sheet_counts_both(step1_project: Step1Project) -> None:
    qs, project = step1_project.member, step1_project.project_id
    with qs.acting():
        [view] = drawings.views(step1_project.sheets[2])
        view_id = step1.propose_view(project, view)
        step1.exclude(project, [step1_project.proposals[0], view_id], "blank", actor_name=qs.user.name)

    [event] = step1_events(qs)

    assert (event.kind, event.payload) == ("takeoff.step1.left_out", {"sheets": 1, "views": 1})


def test_a_member_of_other_projects_reads_no_step_1_act(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    qs, project = step1_project.member, step1_project.project_id
    with qs.acting():
        step1.set_list(project, "structural", "S-01 to S-03", actor_name=qs.user.name)
    elsewhere = sign_in(role="qs", developer_id=qs.developer_id, projects=[uuid.uuid4()])
    here = sign_in(role="qs", developer_id=qs.developer_id, projects=[project])

    def seen(member: Member) -> list[str]:
        with member.acting():
            return list(step1_acts().values_list("kind", flat=True))

    assert seen(elsewhere) == []
    assert seen(here) == ["takeoff.step1.list_changed"]


def test_the_event_is_written_before_the_act_s_progress(
    step1_project: Step1Project, monkeypatch: pytest.MonkeyPatch
) -> None:
    qs, project = step1_project.member, step1_project.project_id
    written_then: list[int] = []
    recorded = step1.record_progress

    def counting(project_id: uuid.UUID) -> None:
        written_then.append(step1_acts().count())
        recorded(project_id)

    monkeypatch.setattr(step1, "record_progress", counting)
    with qs.acting():
        step1.confirm(project, [step1_project.proposals[0]], actor_name=qs.user.name)
        step1.undo(project)

    assert written_then == [1, 2]
