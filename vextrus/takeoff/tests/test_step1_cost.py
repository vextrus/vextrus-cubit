"""Step 1's acts read only the sheets they name (T-W319): `_chosen` reads the named sheets and their
Proposals alone and refuses as before, `undo` of a bulk act puts every sheet back, and the Question
an answer returns is the one `questions()` lists. Every name and number is invented."""

import uuid
from collections.abc import Callable, Sequence
from typing import Any

import pytest
from django.db import connection

from vextrus.drawings import services as drawings
from vextrus.platform.services import auth
from vextrus.takeoff.messages import step1 as said
from vextrus.takeoff.services import step1
from vextrus.testing.drawings import add, drawing, read_dwg
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def _statements(call: Callable[[], object]) -> list[str]:
    seen: list[str] = []

    def keep(execute: Callable[..., Any], sql: str, params: Any, many: bool, context: Any) -> Any:
        seen.append(sql)
        return execute(sql, params, many, context)

    with connection.execute_wrapper(keep):
        call()
    return seen


def _more_sheets(project: Step1Project, numbers: list[str]) -> None:
    found = add(project.member, project.project_id, "MK-STR-R4.dwg", drawing(marker="more")).file
    read_dwg(project.member, found.id, numbers)
    with project.member.acting():
        drawing_set = drawings.set_of(project.project_id)
        assert drawing_set is not None
        for sheet in drawings.sheets(drawing_set.id):
            if sheet.number in numbers:
                step1.propose_sheet(sheet.id)
                step1.record_coverage(sheet.id)


def test_chosen_reads_the_named_sheets_alone_and_in_the_order_named(
    step1_project: Step1Project,
) -> None:
    project = step1_project
    with project.member.acting():
        named = [project.proposals[2], project.sheets[0]]  # a Proposal's id, then a sheet's
        before = len(_statements(lambda: step1._chosen(project.project_id, named)))
        chosen = step1._chosen(project.project_id, named)
    _more_sheets(project, [f"S-{n:02d}" for n in range(40, 52)])
    with project.member.acting():
        after = len(_statements(lambda: step1._chosen(project.project_id, named)))

    assert [(s.id, p.id if p else None) for s, p in chosen] == [
        (project.sheets[2], project.proposals[2]),
        (project.sheets[0], project.proposals[0]),
    ]
    assert after == before


def test_chosen_refuses_what_it_always_refused(step1_project: Step1Project) -> None:
    project = step1_project
    with project.member.acting():
        nothing: list[Sequence[object]] = [[], (), "not a list"]
        for ids in nothing:
            with pytest.raises(auth.Refused) as refused:
                step1._chosen(project.project_id, ids)
            assert refused.value.message["code"] == said.NOTHING_CHOSEN.code
        for ids in ([uuid.uuid4()], ["not-an-id"], [project.proposals[0], uuid.uuid4()]):
            with pytest.raises(auth.NotFound):
                step1._chosen(project.project_id, ids)
        # A Project not in scope: nothing of it is found.
        with pytest.raises(auth.NotFound):
            step1._chosen(uuid.uuid4(), [project.proposals[0]])


def test_undo_of_a_bulk_act_puts_every_sheet_back(step1_project: Step1Project) -> None:
    project = step1_project
    with project.member.acting():
        step1.set_list(project.project_id, "structural", "S-01 to S-03", actor_name="A mock QS")
        step1.confirm(project.project_id, list(project.proposals), actor_name="A mock QS")
        decided = {p.sheet_id: p.decision for p in step1.proposals(project.project_id)}
        step1.undo(project.project_id)
        undone = {p.sheet_id: p.decision for p in step1.proposals(project.project_id)}

    assert set(decided.values()) == {"confirmed"}
    assert set(undone.values()) == {None}
    assert set(undone) == set(project.sheets)


def test_the_answered_question_is_the_one_questions_lists(step1_project: Step1Project) -> None:
    project = step1_project
    with project.member.acting():
        asked = [
            step1.raise_question(
                project.project_id,
                "missing",
                said.NO_NUMBER(),
                subject_id=sheet_id,
                discipline="structural",
                options=[{"key": k, "picked": False} for k in ("no_number", "keep_open")],
                blocks=[proposal_id],
            )
            for sheet_id, proposal_id in zip(project.sheets, project.proposals, strict=True)
        ]
        step1.answer(project.project_id, asked[1], "keep_open", actor_name="A mock QS")
        listed = {q.id: q for q in step1.questions(project.project_id)}
        alone = {q: step1._question_view(project.project_id, q) for q in asked}

    assert alone == {q: listed[q] for q in asked}
    assert [alone[q].raised for q in asked] == sorted(alone[q].raised or 0 for q in asked)
