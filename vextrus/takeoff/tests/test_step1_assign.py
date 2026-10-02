"""#158 beyond its acceptance tests: a Structural view the read gave no step is given the Steps its
sheet's confirmed kind names; `assign` before the sheet is confirmed, and every undo; the refusals the
acceptance tests leave open; `outstanding` for each thing that keeps a Discipline from confirmed; and
the walls of `CoverageStep.confirmation` (migration 0002). Every sheet and title is invented."""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.projects import services as projects
from vextrus.takeoff.models import Confirmation, CoverageStep
from vextrus.takeoff.services import step1 as service
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    NOT_FOUND,
    Sheet,
    confirm,
    coverage,
    english,
    exclude,
    jev_says,
    progress,
    proposals,
    step1,
)
from vextrus.takeoff.tests.acceptance.t158.structural_views import (
    NO_SUBJECT,
    NO_SUBJECT_KIND,
    assign,
    read,
)
from vextrus.takeoff.tests.test_step1_walls import refused
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

UNACCOUNTED = "takeoff.step1.views_unaccounted"


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def undo(api: Any, project_id: uuid.UUID) -> Any:
    return api.post(f"{step1(project_id)}/undo", {})


def read_one(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheet: Sheet = NO_SUBJECT) -> str:
    """Read one Structural sheet whose view names no subject; the sheet's Proposal id."""
    read(qs, monkeypatch, [sheet])
    [proposal] = proposals(api_as(qs.member), qs.project_id)
    sheet_id: str = proposal["id"]
    return sheet_id


def the_view(api: Any, project_id: uuid.UUID) -> str:
    [view] = coverage(api, project_id)["unaccounted_views"]
    view_id: str = view["id"]
    return view_id


def counts(api: Any, project_id: uuid.UUID) -> tuple[int, int, int, dict[str, int]]:
    shown = coverage(api, project_id)
    return shown["assigned"], shown["proposed"], shown["unaccounted"], shown["by_step"]


def structural(api: Any, project_id: uuid.UUID) -> tuple[str, list[dict[str, Any]]]:
    row = progress(api, project_id)["structural"]
    return row["status"], row["outstanding"]


# The sheet's confirmed kind tells the Step ------------------------------------------------------------


@pytest.mark.parametrize(
    ("kind", "step"),
    [
        ("beam_details", "beams"),
        ("column_schedule", "columns"),
        ("shear_wall_details", "columns"),
        ("pile_cap_details", "foundations"),
        ("slab_layout", "slabs"),
        ("stair_details", "stairs"),
        ("tank_details", "tanks"),
        ("grid_layout", "grid"),
    ],
)
def test_a_view_naming_no_subject_takes_the_step_its_sheets_confirmed_kind_names(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, kind: str, step: str
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert counts(api, qs_project.project_id) == (0, 1, 1, {})  # the title block; the section

    assert confirm(api, qs_project.project_id, [sheet], kind=kind).status_code == 200

    assert counts(api, qs_project.project_id) == (1, 0, 0, {step: 1})
    assert structural(api, qs_project.project_id) == ("confirmed", [])


def test_undoing_the_confirmation_takes_back_the_step_its_kind_gave(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert confirm(api, qs_project.project_id, [sheet], kind="beam_details").status_code == 200

    assert undo(api, qs_project.project_id).status_code == 200

    assert counts(api, qs_project.project_id) == (0, 1, 1, {})
    assert structural(api, qs_project.project_id) == (
        "in_review",
        [
            {"code": "takeoff.step1.sheets_undecided", "params": {"count": 1}},
            {"code": UNACCOUNTED, "params": {"count": 1}},
        ],
    )
    # Confirmed again as another kind: only that kind's step stands.
    assert confirm(api, qs_project.project_id, [sheet], kind="slab_layout").status_code == 200
    assert counts(api, qs_project.project_id) == (1, 0, 0, {"slabs": 1})


def test_a_kind_naming_no_subject_leaves_the_view_unaccounted(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert confirm(api, qs_project.project_id, [sheet], kind=NO_SUBJECT_KIND).status_code == 200
    assert counts(api, qs_project.project_id) == (0, 0, 1, {})
    assert structural(api, qs_project.project_id) == (
        "in_review",
        [{"code": UNACCOUNTED, "params": {"count": 1}}],
    )


# assign: before the sheet is confirmed, and undo ------------------------------------------------------


def test_a_view_put_in_a_step_before_its_sheet_is_confirmed_is_proposed_with_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    view = the_view(api, qs_project.project_id)

    assert assign(api, qs_project.project_id, [view], ["beams"]).status_code == 200
    assert counts(api, qs_project.project_id) == (0, 2, 0, {"beams": 1})

    # Confirmed as a kind naming another Step: the QS's step stands alone.
    assert confirm(api, qs_project.project_id, [sheet], kind="slab_layout").status_code == 200
    assert counts(api, qs_project.project_id) == (1, 0, 0, {"beams": 1})
    assert structural(api, qs_project.project_id) == ("confirmed", [])

    # Undo the confirmation: proposed with the QS's step again.
    assert undo(api, qs_project.project_id).status_code == 200
    assert counts(api, qs_project.project_id) == (0, 2, 0, {"beams": 1})
    # Undo the assign: unaccounted again.
    assert undo(api, qs_project.project_id).status_code == 200
    assert counts(api, qs_project.project_id) == (0, 1, 1, {})


def test_undoing_an_assign_on_a_confirmed_sheet_leaves_the_sheet_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert confirm(api, qs_project.project_id, [sheet], kind=NO_SUBJECT_KIND).status_code == 200
    view = the_view(api, qs_project.project_id)
    act = assign(api, qs_project.project_id, [view], ["beams"])
    assert (act.status_code, act.json()["act"], act.json()["sheets"]) == (200, "assign", 1)

    undone = undo(api, qs_project.project_id)

    assert (undone.status_code, undone.json()["act"]) == (200, "assign")
    assert counts(api, qs_project.project_id) == (0, 0, 1, {})
    [shown] = proposals(api, qs_project.project_id)
    assert shown["decision"] == "confirmed"
    assert structural(api, qs_project.project_id) == (
        "in_review",
        [{"code": UNACCOUNTED, "params": {"count": 1}}],
    )
    # Put in the step again: the step the undone act gave is given by this one.
    assert assign(api, qs_project.project_id, [view], ["beams"]).status_code == 200
    assert counts(api, qs_project.project_id) == (1, 0, 0, {"beams": 1})


def test_undoing_an_assign_keeps_a_view_excluded_since(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert confirm(api, qs_project.project_id, [sheet], kind=NO_SUBJECT_KIND).status_code == 200
    view = the_view(api, qs_project.project_id)
    assert assign(api, qs_project.project_id, [view], ["beams"]).status_code == 200
    assert exclude(api, qs_project.project_id, [view], "for_information").status_code == 200

    # The exclusion is undone first (the last act), then the assign.
    assert undo(api, qs_project.project_id).json()["act"] == "exclude"
    assert counts(api, qs_project.project_id) == (1, 0, 0, {"beams": 1})
    assert undo(api, qs_project.project_id).json()["act"] == "assign"
    assert counts(api, qs_project.project_id) == (0, 0, 1, {})


ACCOUNTED_ONE = {"code": "takeoff.step1.view_accounted", "params": {"count": 1}}


def test_a_view_the_read_proposed_a_step_is_not_put_in_another(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The review's ruling (F3): only a view still unaccounted is put in Steps."""
    beams = Sheet("S-02", "BEAM DETAILS", ("SECTION 1-1",))
    sheet = read_one(qs_project, monkeypatch, beams)
    api = api_as(qs_project.member)
    section = _view_proposals(qs_project)
    for when in ("proposed", "confirmed"):
        refusal = assign(api, qs_project.project_id, section, ["slabs"])
        assert (refusal.status_code, refusal.json()) == (409, ACCOUNTED_ONE), when
        confirm(api, qs_project.project_id, [sheet], kind="beam_details")
    assert counts(api, qs_project.project_id) == (1, 0, 0, {"beams": 1})
    with qs_project.member.acting():
        assert not Confirmation.objects.filter(project_id=qs_project.project_id, act="assign")


def test_a_view_its_sheets_kind_or_an_assign_accounts_for_is_not_put_in_steps_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    view = the_view(api, pid)
    assert assign(api, pid, [view], ["beams"]).status_code == 200
    again = assign(api, pid, [view], ["slabs"])
    assert (again.status_code, again.json()) == (409, ACCOUNTED_ONE)
    assert undo(api, pid).json()["act"] == "assign"
    assert confirm(api, pid, [sheet], kind="slab_layout").status_code == 200
    by_kind = assign(api, pid, [view], ["beams"])
    assert (by_kind.status_code, by_kind.json()) == (409, ACCOUNTED_ONE)
    assert counts(api, pid) == (1, 0, 0, {"slabs": 1})


@pytest.mark.parametrize("again", ["slab_layout", "stair_details", NO_SUBJECT_KIND])
def test_the_qss_step_replaces_the_kinds_however_often_the_sheet_is_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, again: str
) -> None:
    """The review's F2: assign beams, then confirm as a kind naming another Step, then again."""
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    assert assign(api, pid, [the_view(api, pid)], ["beams"]).status_code == 200
    assert confirm(api, pid, [sheet], kind="slab_layout").status_code == 200
    assert counts(api, pid) == (1, 0, 0, {"beams": 1})
    assert confirm(api, pid, [sheet], kind=again).status_code == 200
    assert counts(api, pid) == (1, 0, 0, {"beams": 1})


def test_the_qss_step_replaces_the_kinds_given_first(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """F2 the other way: a kind's step given before the QS's (a step given by an act now refused,
    written as an older act could) stands under it no more."""
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    view = the_view(api, pid)
    assert confirm(api, pid, [sheet], kind="slab_layout").status_code == 200
    with qs_project.member.acting():
        from vextrus.takeoff.models import Coverage

        [row] = Coverage.objects.filter(project_id=pid, proposed_status="unaccounted")
        act = Confirmation.objects.create(
            tenant_id=qs_project.member.developer_id, project_id=pid, step="sheets",
            user_id=qs_project.member.user.id, by_name="QS", kind="single", act="assign",
            proposals=1, before={},
        )  # fmt: skip
        CoverageStep.objects.create(
            tenant_id=row.tenant_id, project_id=pid, coverage=row, step="beams", confirmation=act
        )
    assert view
    assert counts(api, pid) == (1, 0, 0, {"beams": 1})


def _view_proposals(qs: QsProject) -> list[str]:
    """The Proposal ids of the Project's views not proposed out (the section)."""
    from vextrus.takeoff.models import Coverage, Proposal, ProposalSubject

    with qs.member.acting():
        out = set(
            Coverage.objects.filter(project_id=qs.project_id, proposed_status="excluded").values_list(
                "view_id", flat=True
            )
        )
        return [
            str(p.id)
            for p in Proposal.objects.filter(project_id=qs.project_id, subject=ProposalSubject.VIEW)
            if p.subject_id not in out
        ]


# Two QSs, and a sheet confirmed again (the refuter's cases, score 55 and 40) --------------------------


def two_qs(qs: QsProject, sign_in: Callable[..., Member]) -> tuple[Any, Any]:
    return api_as(qs.member), api_as(sign_in(role="qs", developer_id=qs.member.developer_id))


def test_another_qs_may_assign_a_view_only_once_the_first_assign_is_undone(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    a, b = two_qs(qs_project, sign_in)
    pid = qs_project.project_id
    assert confirm(a, pid, [sheet], kind=NO_SUBJECT_KIND).status_code == 200
    view = the_view(a, pid)
    assert assign(a, pid, [view], ["beams"]).status_code == 200
    refused = assign(b, pid, [view], ["beams"])  # accounted for by A's act: F3's ruling
    assert (refused.status_code, refused.json()) == (409, ACCOUNTED_ONE)

    assert undo(a, pid).json()["act"] == "assign"

    assert counts(a, pid) == (0, 0, 1, {})
    assert assign(b, pid, [view], ["beams"]).status_code == 200  # unaccounted again: B may
    assert counts(a, pid) == (1, 0, 0, {"beams": 1})


def test_undoing_a_confirmation_leaves_the_step_another_qs_assigned(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    a, b = two_qs(qs_project, sign_in)
    pid = qs_project.project_id
    view = the_view(a, pid)
    assert assign(b, pid, [view], ["beams"]).status_code == 200
    assert confirm(a, pid, [sheet], kind="slab_layout").status_code == 200
    assert counts(a, pid) == (1, 0, 0, {"beams": 1})

    assert undo(a, pid).json()["act"] == "confirm"

    assert counts(a, pid) == (0, 2, 0, {"beams": 1})  # proposed with B's step


@pytest.mark.parametrize(("again", "shown"), [("slab_layout", (1, 0, 0, {"slabs": 1})),
                                               (NO_SUBJECT_KIND, (0, 0, 1, {}))])  # fmt: skip
def test_a_sheet_confirmed_again_as_another_kind_stands_on_that_kinds_steps(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    again: str,
    shown: tuple[int, int, int, dict[str, int]],
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    assert confirm(api, pid, [sheet], kind="beam_details").status_code == 200

    assert confirm(api, pid, [sheet], kind=again).status_code == 200

    assert counts(api, pid) == shown
    assert undo(api, pid).status_code == 200  # back to beam_details: its step stands again
    assert counts(api, pid) == (1, 0, 0, {"beams": 1})


# Refusals the acceptance tests leave open -------------------------------------------------------------


@pytest.mark.parametrize("steps", [["sheets"], [], ["beams", "Beams"], ["beams", ""]])
def test_step_1_and_keys_of_no_step_are_refused_and_nothing_changes(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, steps: list[str]
) -> None:
    read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    view = the_view(api, qs_project.project_id)

    refusal = assign(api, qs_project.project_id, [view], steps)

    assert (refusal.status_code, refusal.json()) == (
        400,
        {"code": "takeoff.step1.step_unknown", "params": {}},
    )
    assert counts(api, qs_project.project_id) == (0, 1, 1, {})
    with qs_project.member.acting():
        assert not Confirmation.objects.filter(project_id=qs_project.project_id).exists()


def test_naming_no_view_is_refused_with_its_words(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    refusal = assign(api, qs_project.project_id, [], ["beams"])
    assert (refusal.status_code, refusal.json()) == (
        400,
        {"code": "takeoff.step1.no_view_chosen", "params": {}},
    )
    assert english("takeoff.step1.no_view_chosen")


def test_a_sheet_or_another_projects_view_is_not_found_and_nothing_changes(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheet = read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    view = the_view(api, qs_project.project_id)
    with qs_project.member.acting():
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project").id

    for project, ids in (
        (qs_project.project_id, [sheet]),  # a sheet is no view
        (qs_project.project_id, [view, str(uuid.uuid4())]),  # one id of none: nothing done
        (other, [view]),  # our own view, named on another of our Projects
    ):
        refusal = assign(api, project, ids, ["beams"])
        assert (refusal.status_code, refusal.json()) == (404, NOT_FOUND), ids
    assert counts(api, qs_project.project_id) == (0, 1, 1, {})


def test_a_view_proposed_out_is_refused(qs_project: QsProject, monkeypatch: pytest.MonkeyPatch) -> None:
    read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    [title_block] = [p for p in _all_view_proposals(qs_project) if p not in _view_proposals(qs_project)]
    refusal = assign(api, qs_project.project_id, [title_block], ["beams"])
    assert (refusal.status_code, refusal.json()) == (
        409,
        {"code": "takeoff.step1.view_excluded", "params": {}},
    )


def _all_view_proposals(qs: QsProject) -> list[str]:
    from vextrus.takeoff.models import Proposal, ProposalSubject

    with qs.member.acting():
        return [
            str(p.id)
            for p in Proposal.objects.filter(project_id=qs.project_id, subject=ProposalSubject.VIEW)
        ]


# outstanding ------------------------------------------------------------------------------------------


def test_outstanding_names_each_thing_in_m0_screens_5s_order() -> None:
    assert service._outstanding(reading=2, undecided=3, disagree=True, questions=4, unaccounted=5) == [
        {"code": "takeoff.step1.files_reading", "params": {"count": 2}},
        {"code": "takeoff.step1.sheets_undecided", "params": {"count": 3}},
        {"code": "takeoff.step1.lists_disagree", "params": {}},
        {"code": "takeoff.step1.questions_open", "params": {"count": 4}},
        {"code": UNACCOUNTED, "params": {"count": 5}},
    ]
    assert service._outstanding(reading=0, undecided=0, disagree=False, questions=0, unaccounted=0) == []


@pytest.mark.parametrize(
    "code",
    [
        "takeoff.step1.files_reading",
        "takeoff.step1.sheets_undecided",
        "takeoff.step1.lists_disagree",
        "takeoff.step1.questions_open",
        UNACCOUNTED,
        "takeoff.step1.step_unknown",
        "takeoff.step1.view_excluded",
        "takeoff.step1.no_view_chosen",
        "takeoff.step1.view_accounted",
    ],
)
def test_every_new_code_has_its_english(code: str) -> None:
    words = english(code)
    assert words
    if "count" in words:
        assert "{count, plural, one {" in words


# The walls of CoverageStep.confirmation (migration 0002) ----------------------------------------------


def test_the_app_never_deletes_a_step_given_nor_names_another_projects_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read_one(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    view = the_view(api, qs_project.project_id)
    assert assign(api, qs_project.project_id, [view], ["beams"]).status_code == 200
    member = qs_project.member
    with member.acting():
        [given] = CoverageStep.objects.filter(project_id=qs_project.project_id)
        assert "permission denied" in refused("delete from takeoff_coveragestep", [])
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project")
        theirs = Confirmation.objects.create(
            tenant_id=member.developer_id,
            project_id=other.id,
            step="sheets",
            user_id=member.user.id,
            by_name="Someone",
            kind="single",
            act="assign",
            proposals=1,
            before={},
        )
        assert "same_project" in refused(
            "update takeoff_coveragestep set confirmation_id = %s where id = %s",
            [theirs.id, given.id],
        )
