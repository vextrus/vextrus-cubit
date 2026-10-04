"""#230's design gate, must 3: Coverage's "Views by the step" names a Structural or Architectural view's
own Part as Step 2's Notes, so the API must not count a view under both Step 2 and that Part (the
seed's legend: step `general_notes`, Part `structural`, shown twice as "2 Notes")."""

import uuid

import pytest

from vextrus.takeoff.models import Confirmation, Coverage, CoverageStep
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import coverage, jev_says
from vextrus.takeoff.tests.test_step1_assign import read_one
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def the_view_as(qs: QsProject, part: str, steps: tuple[str, ...]) -> None:
    """The sheet's one unaccounted view, assigned to `steps` by the QS's act, with its Part `part`."""
    pid: uuid.UUID = qs.project_id
    with qs.member.acting():
        [row] = Coverage.objects.filter(project_id=pid, proposed_status="unaccounted")
        row.status = "assigned"
        row.part_key = part
        row.save(update_fields=["status", "part_key"])
        act = Confirmation.objects.create(
            tenant_id=qs.member.developer_id, project_id=pid, step="sheets",
            user_id=qs.member.user.id, by_name="QS", kind="single", act="assign",
            proposals=1, before={},
        )  # fmt: skip
        for step in steps:
            CoverageStep.objects.create(
                tenant_id=row.tenant_id, project_id=pid, coverage=row, step=step, confirmation=act
            )


@pytest.mark.parametrize("part", ["structural", "architectural"])
def test_a_view_in_step_2_is_not_counted_again_under_its_structural_or_architectural_part(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, part: str
) -> None:
    read_one(qs_project, monkeypatch)
    the_view_as(qs_project, part, ("general_notes",))
    assert coverage(api_as(qs_project.member), qs_project.project_id)["by_step"] == {"general_notes": 1}


def test_a_view_in_other_steps_still_counts_under_its_part(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The Part still counts where Step 2 does not: a legend put in Beams feeds Step 2 by its Part."""
    read_one(qs_project, monkeypatch)
    the_view_as(qs_project, "structural", ("beams",))
    assert coverage(api_as(qs_project.member), qs_project.project_id)["by_step"] == {
        "beams": 1,
        "structural": 1,
    }


def test_an_mep_part_counts_beside_the_steps(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A toilet detail counts under the walls and the Plumbing and sanitary Part (the API's own rule)."""
    read_one(qs_project, monkeypatch)
    the_view_as(qs_project, "plumbing", ("general_notes", "walls"))
    assert coverage(api_as(qs_project.member), qs_project.project_id)["by_step"] == {
        "general_notes": 1,
        "walls": 1,
        "plumbing": 1,
    }
