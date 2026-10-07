"""No Step 1 act reads a stored anchors column (S15-A1, review round 1 of #564): undoing an exclusion
put back an earlier confirmation, and its views' Coverage re-read the sheet with its anchors. Every
act path here is taken over HTTP on T-W319's invented Project (`tw319.cost`), each statement checked;
and the module's own reads are checked at the source, so a new one cannot read them unseen."""

import ast
import inspect
import uuid

import pytest

from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1
from vextrus.testing.drawings import QsProject

from .acceptance.ts15a1.acts import OverHttp, captured, selecting_anchors
from .acceptance.tw319.cost import ACTED_ON, SMALL, CostProject, project_of

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def assert_no_anchors(project: CostProject, act: str, run: object) -> None:
    with captured() as seen:
        assert callable(run)
        run()
    loading = selecting_anchors(seen)
    assert seen
    assert loading == [], f"{act}: {len(loading)} statements select the anchors: {loading[0][:160]}"


def test_confirm_exclude_and_undo_of_the_exclusion_select_no_anchors(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    way = OverHttp(project)
    sheet = [project.proposal_of[ACTED_ON]]

    assert_no_anchors(project, "confirm", lambda: way.confirm(sheet))
    assert_no_anchors(project, "exclude the confirmed sheet", lambda: way.exclude(sheet))
    assert_no_anchors(project, "undo the exclusion", way.undo)

    with project.member.acting():
        back = drawings.sheet(project.sheet_of[ACTED_ON])
    assert back.decision == "confirmed"  # the earlier confirmation is put back


def a_view_proposal(project: CostProject) -> uuid.UUID:
    """The acted-on sheet's plan as a Proposal of its own (a view the QS may leave out alone)."""
    with project.member.acting():
        [plan] = [v for v in drawings.views(project.sheet_of[ACTED_ON]) if v.kind == "plan"]
        return step1.propose_view(project.project_id, plan)


def test_a_view_left_out_on_its_own_and_its_undo_select_no_anchors(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    way = OverHttp(project)
    view = a_view_proposal(project)

    assert_no_anchors(project, "exclude a view", lambda: way.exclude([view]))
    assert_no_anchors(project, "undo the view's exclusion", way.undo)


def _calls(tree: ast.AST, name: str) -> list[ast.Call]:
    """Every call of `drawings.<name>(...)` in the tree."""
    return [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == name
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "drawings"
    ]


def _anchors_off(call: ast.Call) -> bool:
    return any(
        k.arg == "anchors" and isinstance(k.value, ast.Constant) and k.value.value is False
        for k in call.keywords
    )


def test_every_sheet_read_and_decision_in_step1_leaves_the_anchors_unread() -> None:
    tree = ast.parse(inspect.getsource(step1))
    reads = _calls(tree, "sheet")
    assert len(reads) == 1, "read one sheet through step1._sheet, never drawings.sheet directly"
    for name in ("sheet", "sheets", "views_of_set", "confirm_sheet", "exclude"):
        for call in _calls(tree, name):
            assert _anchors_off(call), f"step1.py:{call.lineno} drawings.{name} reads the anchors"
