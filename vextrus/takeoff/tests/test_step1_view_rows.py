"""`step1.propose_views` (S22-LOCKHOLD): every view's Proposal, Traces, Coverage row and Coverage Steps
written together, in a fixed few statements whatever the number of views, the same rows as the
per-view writes, idempotent, and refused for a sheet or a view of another Project. Invented sheets
(19a's `step1_project`); a view's steps varied with `dataclasses.replace`."""

import uuid
from dataclasses import replace
from typing import Any

import pytest
from django.db import connection

from vextrus.drawings import services as drawings
from vextrus.platform.services import auth
from vextrus.projects.services import projects
from vextrus.takeoff import models
from vextrus.takeoff.services import step1
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def _first(project: Step1Project) -> tuple[drawings.SheetView, drawings.ViewView]:
    sheet = drawings.sheet(project.sheets[0], anchors=False)
    [view] = drawings.views(sheet.id)
    return sheet, view


def _statements(call: Any) -> int:
    seen: list[str] = []

    def keep(execute: Any, sql: str, params: Any, many: bool, context: Any) -> Any:
        seen.append(sql)
        return execute(sql, params, many, context)

    with connection.execute_wrapper(keep):
        call()
    return len(seen)


def test_a_json_anchor_matches_as_jsonb_does() -> None:
    assert step1._same({"x": 1, "y": [1, "a"]}) == step1._same({"y": [1.0, "a"], "x": 1.0})
    assert step1._same({"x": True}) != step1._same({"x": 1})
    assert step1._same({"x": None}) != step1._same({"x": 0})
    assert step1._same({"x": "1"}) != step1._same({"x": 1})
    assert step1._same([1, 2]) != step1._same([2, 1])


def test_a_trace_already_written_is_kept_once(step1_project: Step1Project) -> None:
    project = step1_project
    with project.member.acting():
        sheet, view = _first(project)
        step1.propose_view(project.project_id, view, traces=[("place", {"x": 1, "y": 2})])
        for _ in range(2):
            step1.propose_views(
                project.project_id,
                [(sheet, [view])],
                lambda _v: [("place", {"y": 2.0, "x": 1.0}), ("place", {"x": True, "y": 2})],
            )
        rows = models.ProposalTrace.objects.filter(
            project_id=project.project_id, proposal__candidate_key=f"view:{view.id}"
        )
        assert sorted(repr(sorted(t.anchor.items())) for t in rows) == [
            repr([("x", 1), ("y", 2)]),
            repr([("x", True), ("y", 2)]),
        ]


def test_coverage_and_its_steps_are_upserted_in_place(step1_project: Step1Project) -> None:
    project = step1_project
    with project.member.acting():
        sheet, view = _first(project)
        given = replace(view, steps=("columns", "beams", "columns"), part=None)
        step1.propose_views(project.project_id, [(sheet, [given])], lambda _v: ())
        [row] = models.Coverage.objects.filter(project_id=project.project_id, view_id=view.id)
        assert (row.proposed_status, row.status, row.sheet_revision_id) == (
            "assigned",
            "assigned",
            sheet.id,
        )
        steps: set[tuple[Any, ...]] = set(
            models.CoverageStep.objects.filter(coverage=row).values_list("id", "step", "confirmation")
        )
        assert {(s, c) for _i, s, c in steps} == {("columns", None), ("beams", None)}

        out = replace(given, proposed_exclusion="duplicate")
        step1.propose_views(project.project_id, [(sheet, [out])], lambda _v: ())
        [again] = models.Coverage.objects.filter(project_id=project.project_id, view_id=view.id)
        assert again.id == row.id
        assert (again.proposed_status, again.reason) == ("excluded", "duplicate")
        assert (
            set(
                models.CoverageStep.objects.filter(coverage=row).values_list(
                    "id", "step", "confirmation"
                )
            )
            == steps
        )
        [proposal] = models.Proposal.objects.filter(
            project_id=project.project_id, candidate_key=f"view:{view.id}"
        )
        assert proposal.values["exclusion"] == "duplicate"
        assert proposal.values["steps"] == ["columns", "beams", "columns"]


def test_the_statements_do_not_grow_with_the_views(step1_project: Step1Project) -> None:
    project = step1_project
    with project.member.acting():
        sheet, view = _first(project)

        def many(n: int) -> list[drawings.ViewView]:
            return [replace(view, id=uuid.uuid4(), steps=("columns",)) for _ in range(n)]

        def traces(v: drawings.ViewView) -> list[tuple[str, dict[str, Any]]]:
            return [("place", {"view": str(v.id)}), ("title", {"view": str(v.id)})]

        one = _statements(lambda: step1.propose_views(project.project_id, [(sheet, many(1))], traces))
        forty = _statements(lambda: step1.propose_views(project.project_id, [(sheet, many(40))], traces))
        assert forty == one, (one, forty)
        assert models.Coverage.objects.filter(project_id=project.project_id).count() == 3 + 41


def test_a_sheet_or_view_of_another_project_is_refused(step1_project: Step1Project) -> None:
    project = step1_project
    with project.member.acting():
        sheet, view = _first(project)
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project").id
        with pytest.raises(auth.NotFound):
            step1.propose_views(other, [(sheet, [view])], lambda _v: ())
        with pytest.raises(auth.NotFound):
            step1.propose_views(uuid.uuid4(), [(sheet, [view])], lambda _v: ())
        stray = replace(view, sheet_revision_id=project.sheets[1])
        with pytest.raises(auth.NotFound):
            step1.propose_views(project.project_id, [(sheet, [stray])], lambda _v: ())
        assert not models.Proposal.objects.filter(project_id=other).exists()
