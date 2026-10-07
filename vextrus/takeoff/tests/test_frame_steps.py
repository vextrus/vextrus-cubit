"""Steps 3, 4 and 6's service at its seams (ticket S16-T2): what each act hands `live_model.apply`,
the primitives built from a snapshot (a column's volume is b x d x h), the read job queued by path,
view placements and the refusals."""

import sys
import types
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

import pytest

from vextrus.live_model import services as live_model_services
from vextrus.platform.services import tenancy
from vextrus.takeoff.models import (
    Confirmation,
    Coverage,
    CoverageStatus,
    Proposal,
    ProposalStatus,
    ProposalSubject,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def url(project_id: uuid.UUID, path: str) -> str:
    return f"/api/projects/{project_id}/takeoff/{path}"


@dataclass(frozen=True)
class Ref:
    seq: int
    figures_changed: bool


@dataclass
class Applied:
    calls: list[tuple[Any, ...]] = field(default_factory=list)

    def __call__(self, building_id: Any, confirmation_id: Any, changes: Any, *, cause: str) -> Ref:
        self.calls.append((building_id, confirmation_id, list(changes), cause))
        return Ref(seq=len(self.calls), figures_changed=bool(changes))


@pytest.fixture
def applied(monkeypatch: pytest.MonkeyPatch) -> Applied:
    stand_in = Applied()
    monkeypatch.setattr(live_model_services, "apply", stand_in, raising=False)
    return stand_in


def seed(
    member: Member, project_id: uuid.UUID, step: str, family: str, values: list[dict[str, Any]]
) -> list[uuid.UUID]:
    with member.acting():
        tenant = tenancy.current_tenant_id()
        assert tenant is not None
        made = [
            Proposal(
                tenant_id=tenant,
                project_id=project_id,
                step=step,
                subject=ProposalSubject.ELEMENT,
                subject_id=uuid.uuid4(),
                family_key=family,
                candidate_key=f"{family}|{i}|{uuid.uuid4().hex[:6]}",
                values=v,
            )
            for i, v in enumerate(values)
        ]
        Proposal.objects.bulk_create(made)
    return [p.id for p in made]


def column(mark: str = "C1", b: str = "254", d: str = "508") -> dict[str, Any]:
    return {"mark": mark, "section_b": b, "section_d": d, "at": "B/2", "storey": "Ground floor"}


def post(member: Member, project_id: uuid.UUID, body: dict[str, Any]) -> Any:
    return api_as(member).post(url(project_id, "confirmations"), body)


def test_confirm_hands_apply_only_the_confirmed_columns_in_metres(
    qs_project: QsProject, applied: Applied
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    chosen, left = seed(member, project_id, "columns", "column", [column("C1"), column("C2")])

    response = post(
        member, project_id, {"act": "confirm", "step": "columns", "proposal_ids": [str(chosen)]}
    )

    assert response.status_code == 200
    [(_, _, changes, cause)] = applied.calls
    assert cause == "confirmation"
    [change] = changes
    assert (change.family, change.mark, change.grid_ref) == ("column", "C1", "B/2")
    assert change.identity_key == "column|B/2|ground_floor"
    assert change.attrs == {"vx.column.section_b": "0.254", "vx.column.section_d": "0.508"}
    with member.acting():
        assert Proposal.objects.get(id=left).status == ProposalStatus.OPEN
        confirmation = Confirmation.objects.get(id=response.json()["confirmation_id"])
    assert (confirmation.act, confirmation.model_version_seq) == ("confirm", 1)


def test_excluding_an_unconfirmed_proposal_reaches_the_model_with_no_change(
    qs_project: QsProject, applied: Applied
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [only] = seed(member, project_id, "columns", "column", [column()])

    response = post(
        member,
        project_id,
        {"act": "exclude", "step": "columns", "proposal_ids": [str(only)], "reason": "not_a_column"},
    )

    assert response.status_code == 200
    assert [changes for _, _, changes, _ in applied.calls] == [[]]


def test_an_edit_of_an_unconfirmed_column_keeps_it_out_of_the_model(
    qs_project: QsProject, applied: Applied
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [only] = seed(member, project_id, "columns", "column", [{"mark": "C1"}])

    response = post(
        member,
        project_id,
        {
            "act": "edit",
            "step": "columns",
            "proposal_ids": [str(only)],
            "values": {"section_b": "10", "section_d": "20", "unit": "in"},
        },
    )
    assert response.status_code == 200
    assert applied.calls[0][2] == []

    post(member, project_id, {"act": "confirm", "step": "columns", "proposal_ids": [str(only)]})
    [change] = applied.calls[1][2]
    assert change.attrs == {"vx.column.section_b": "0.254", "vx.column.section_d": "0.508"}


def test_unconfirm_withdraws_the_element_and_counts_it_out_of_n(
    qs_project: QsProject, applied: Applied
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [only] = seed(member, project_id, "columns", "column", [column()])
    post(member, project_id, {"act": "confirm", "step": "columns", "proposal_ids": [str(only)]})

    response = post(
        member, project_id, {"act": "unconfirm", "step": "columns", "proposal_ids": [str(only)]}
    )

    assert response.status_code == 200
    [change] = applied.calls[1][2]
    assert (change.identity_key, change.attrs) == ("column|B/2|ground_floor", {})
    [row] = [r for r in api_as(member).get(url(project_id, "steps")).json() if r["step"] == "columns"]
    assert (row["n"], row["N"], row["status"]) == (0, 1, "in_review")


def test_a_group_key_chooses_the_groups_proposals(qs_project: QsProject, applied: Applied) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    seed(member, project_id, "columns", "column", [column("C1"), column("C1"), column("C2")])
    groups = api_as(member).get(url(project_id, "steps/columns/proposals?group=mark")).json()["groups"]
    assert [g["key"] for g in groups] == ["mark:C1", "mark:C2"]

    response = post(member, project_id, {"act": "confirm", "step": "columns", "group_key": "mark:C1"})

    assert response.status_code == 200
    # The group's two Proposals name one Element (the same mark on one grid point and storey, read on
    # two views): one change, as `apply` refuses an identity named twice.
    assert len(applied.calls[0][2]) == 1


@pytest.mark.parametrize(
    ("body", "code"),
    [
        ({"act": "approve", "step": "columns"}, "takeoff.frame.act_unknown"),
        ({"act": "confirm", "step": "beams"}, "takeoff.frame.step_unknown"),
        ({"act": "confirm", "step": "columns"}, "takeoff.frame.nothing_chosen"),
        (
            {"act": "edit", "step": "columns", "values": {"section_b": "254", "section_d": "508"}},
            "takeoff.frame.size_needed",
        ),
        (
            {
                "act": "edit",
                "step": "columns",
                "values": {"section_b": "x", "section_d": "1", "unit": "mm"},
            },
            "takeoff.frame.not_a_number",
        ),
    ],
)
def test_a_bad_act_is_refused_with_400_and_nothing_applied(
    qs_project: QsProject, applied: Applied, body: dict[str, Any], code: str
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [only] = seed(member, project_id, "columns", "column", [column()])
    if body["act"] == "edit":
        body = {**body, "proposal_ids": [str(only)]}

    response = post(member, project_id, body)

    assert (response.status_code, response.json()["code"]) == (400, code)
    assert applied.calls == []


def test_a_proposal_of_another_step_is_the_one_404(qs_project: QsProject, applied: Applied) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [storey] = seed(member, project_id, "storeys", "storey", [{"name": "Ground floor", "order": 0}])

    response = post(
        member, project_id, {"act": "confirm", "step": "columns", "proposal_ids": [str(storey)]}
    )

    assert (response.status_code, response.json()["code"]) == (404, "platform.auth.not_found")
    assert applied.calls == []


def test_a_view_put_on_storeys_is_listed_and_an_unknown_storey_refused(qs_project: QsProject) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    ground, first = seed(
        member,
        project_id,
        "storeys",
        "storey",
        [{"name": "Ground floor", "order": 0, "level_m": "0"}, {"name": "First floor", "order": 1}],
    )
    view = covered_view(member, project_id)
    qs = api_as(member)

    placed = qs.send("put", url(project_id, f"view-placements/{view}"), {"storey_ids": [str(first)]})
    refused = qs.send(
        "put", url(project_id, f"view-placements/{view}"), {"storey_ids": [str(uuid.uuid4())]}
    )
    typed = qs.send(
        "put",
        url(project_id, "storeys/levels"),
        {"levels": [{"storey_id": str(first), "level_m": "3.0480"}]},
    )

    assert placed.status_code == 200
    assert placed.json()["view_placements"] == [
        {"view_id": str(view), "sheet_number": "", "storeys": [str(first)]}
    ]
    assert (refused.status_code, refused.json()["code"]) == (400, "takeoff.frame.storey_unknown")
    rows = {s["id"]: s for s in typed.json()["storeys"]}
    assert rows[str(ground)]["height_m"] == "3.048"
    assert (rows[str(first)]["level_m"], rows[str(first)]["level_basis"]) == ("3.048", "typed")
    assert rows[str(ground)]["level_basis"] == "default"


def test_a_level_that_is_not_a_number_is_refused(qs_project: QsProject) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [ground] = seed(member, project_id, "storeys", "storey", [{"name": "Ground floor", "order": 0}])

    response = api_as(member).send(
        "put",
        url(project_id, "storeys/levels"),
        {"levels": [{"storey_id": str(ground), "level_m": "three"}]},
    )

    assert (response.status_code, response.json()["code"]) == (400, "takeoff.frame.not_a_number")


def test_read_queues_the_frame_read_job_by_its_path(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    queued: list[dict[str, Any]] = []
    job = types.SimpleNamespace(defer=lambda **ids: queued.append(ids))
    monkeypatch.setitem(
        sys.modules, "vextrus.takeoff.tasks.frame_read", types.SimpleNamespace(read_frame=job)
    )

    response = api_as(qs_project.member).post(url(qs_project.project_id, "steps/columns/read"), {})

    assert response.status_code == 202
    assert response.json() == {"step": "columns", "enqueued": True}
    assert len(queued) == 1


def covered_view(member: Member, project_id: uuid.UUID) -> uuid.UUID:
    """A view of the Project, as Step 1 accounts for it (its Coverage row)."""
    view = uuid.uuid4()
    with member.acting():
        tenant = tenancy.current_tenant_id()
        assert tenant is not None
        Coverage.objects.create(
            tenant_id=tenant,
            project_id=project_id,
            view_id=view,
            sheet_revision_id=uuid.uuid4(),
            proposed_status=CoverageStatus.ASSIGNED,
            status=CoverageStatus.ASSIGNED,
        )
    return view


def test_a_view_not_of_the_project_is_the_one_404_and_nothing_is_written(
    qs_project: QsProject,
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [ground] = seed(member, project_id, "storeys", "storey", [{"name": "Ground floor", "order": 0}])

    response = api_as(member).send(
        "put", url(project_id, f"view-placements/{uuid.uuid4()}"), {"storey_ids": [str(ground)]}
    )

    assert (response.status_code, response.json()["code"]) == (404, "platform.auth.not_found")
    with member.acting():
        assert Proposal.objects.filter(project_id=project_id).count() == 1


def test_primitives_from_the_snapshot_give_a_column_b_by_d_by_its_storey_height(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    storey = uuid.uuid4()
    element = uuid.uuid4()
    snapshot = types.SimpleNamespace(
        storeys=[
            {"id": storey, "name": "Ground floor", "order": 0, "height_m": "2.921", "level_m": "0"}
        ],
        elements=[
            {
                "element_id": element,
                "family": "column",
                "mark": "C2",
                "storey_id": storey,
                "attrs": {"vx.column.section_b": "0.254", "vx.column.section_d": "0.508"},
                "grid_ref": "B/2",
                "held_by_question_id": None,
            }
        ],
    )
    monkeypatch.delattr(live_model_services, "primitives", raising=False)
    monkeypatch.setattr(
        live_model_services, "snapshot", lambda building_id, seq=None: snapshot, raising=False
    )

    response = api_as(qs_project.member).get(url(qs_project.project_id, "model/primitives"))

    assert response.status_code == 200
    [row] = response.json()
    assert (row["element_id"], row["family"], row["state"]) == (str(element), "column", "confirmed")
    [prism] = row["primitives"]
    xs = sorted({Decimal(p[0]) for p in prism["polygon"]})
    ys = sorted({Decimal(p[1]) for p in prism["polygon"]})
    volume = (xs[1] - xs[0]) * (ys[1] - ys[0]) * (Decimal(prism["z1"]) - Decimal(prism["z0"]))
    assert volume.quantize(Decimal("0.000001")) == Decimal("0.376902")


def test_primitives_show_an_open_proposals_candidate_geometry_as_a_proposal(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    monkeypatch.setattr(live_model_services, "primitives", lambda building_id, seq: [], raising=False)
    [only] = seed(member, project_id, "columns", "column", [column()])
    with member.acting():
        Proposal.objects.filter(id=only).update(
            candidate_geometry={
                "kind": "prism",
                "polygon": [["0", "0"], ["0.254", "0"], ["0.254", "0.508"], ["0", "0.508"]],
                "z0": "0",
                "z1": "2.921",
            }
        )

    rows = api_as(member).get(url(project_id, "model/primitives")).json()

    assert [(r["element_id"], r["state"]) for r in rows] == [(str(only), "proposal")]
