"""Train C's join of S21-C1 and S21-C2: a stale copy (C2's fold) is found with the set's Questions
before Step 1's write lock (C1's `proposals.find_questions`), and the keep step under the lock reads
what may have moved meanwhile (whether the conflict's Question is still open). The invented sets are
C2's. Every number, title and storey word is invented.

    uv run pytest vextrus/takeoff/tests/test_stale_fold_found_ahead.py
"""

from typing import Any

import pytest
from django.utils import timezone

from vextrus.takeoff.models import Question, QuestionStatus
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import proposals, storey_questions
from vextrus.takeoff.tests.acceptance.w318.storey_set import CODE, Plan, ask, record, redraw
from vextrus.takeoff.tests.test_stale_title_fold import SAME_TITLE, last_findings, of, pair
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db


def _counted(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    calls: list[int] = []
    real = storey_questions.stale_copies

    def counted(*args: Any, **kwargs: Any) -> Any:
        calls.append(1)
        return real(*args, **kwargs)

    monkeypatch.setattr(storey_questions, "stale_copies", counted)
    return calls


def test_the_stale_copy_is_found_before_the_lock_and_kept_under_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, stale = record(qs_project.member, qs_project.project_id, "KZ-ARC-R0.dwg", pair())
    calls = _counted(monkeypatch)
    with qs_project.member.acting():
        found = proposals.find_questions(qs_project.project_id)
        assert found is not None
        assert calls == [1]
        [(index, keys)] = found.stale.items()
        assert found.inputs.sheet_ids[index] == stale
        assert len(keys) == 1
        step1.lock_writes(qs_project.project_id)
        proposals.set_questions(qs_project.project_id, found=found)

    assert calls == [1]  # kept: not found again under the lock
    [conflict] = of(qs_project, SAME_TITLE)
    assert of(qs_project, CODE) == []
    [finding] = last_findings(qs_project)
    assert str(finding.question_id) == conflict["id"]


def test_a_conflict_answered_after_the_find_is_read_under_the_lock(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The find is kept (the set did not move), but its conflict's Question was answered meanwhile
    (by hand: no answer of Step 1's leaves a held sheet undecided): the stale copy is asked by the
    Discipline's storey-titles Question, as a find under the lock would ask it."""
    _, stale = record(qs_project.member, qs_project.project_id, "KZ-ARC-R0.dwg", pair())
    ask(qs_project.member, qs_project.project_id)
    [conflict] = of(qs_project, SAME_TITLE)
    redraw(qs_project.member, stale, 1, [Plan(("floor_4",), title="PANEL KZ-5")])
    calls = _counted(monkeypatch)
    with qs_project.member.acting():
        found = proposals.find_questions(qs_project.project_id)
        Question.objects.filter(id=conflict["id"]).update(
            status=QuestionStatus.ANSWERED,
            answer={"option": "keep_all", "by": "test"},
            answered_at=timezone.now(),
        )
        step1.lock_writes(qs_project.project_id)
        proposals.set_questions(qs_project.project_id, found=found)

    assert calls == [1]
    [asked] = [q for q in of(qs_project, CODE) if q["status"] == "open"]
    assert (asked["params"]["sheet"], asked["params"]["count"]) == ("A-62", 1)
    [finding] = last_findings(qs_project)
    assert str(finding.question_id) == asked["id"]
