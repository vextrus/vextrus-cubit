"""Ticket S21-C1's own tests, beyond its acceptance tests (ts21c1): the set's Questions found before
Step 1's write lock (`proposals.find_questions`) and kept under it (`set_questions(found=...)`).

- The lists a read job will record are found as `step1.record_read_list` keeps them (the latest per
  sheet and Discipline, each number once, its first title): otherwise every real read would find
  the set again under the lock, the defect back without a test failing on correctness.
- A find the set moved away from (a list read since) is never kept: its Questions are found again.
- A find the set still holds is kept: the recognisers run once, not again under the lock."""

import pytest

from engine.messages import register_check as list_codes
from engine.recognise import conflicts as conflict_finder
from vextrus.drawings import services as drawings
from vextrus.takeoff.models import Question, QuestionStatus
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import proposals
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg

pytestmark = pytest.mark.django_db


def _read_set(qs: QsProject, numbers: list[str]) -> dict[str | None, drawings.SheetView]:
    dwg = add(qs.member, qs.project_id, "S21C1-STR.dwg", drawing()).file
    read_dwg(qs.member, dwg.id, numbers, titles=[f"COLUMN LAYOUT {n}" for n in numbers])
    with qs.member.acting():
        drawing_set = drawings.set_of(qs.project_id)
        assert drawing_set is not None
        sheets = {s.number: s for s in drawings.sheets(drawing_set.id)}
        for s in sheets.values():
            step1.propose_sheet(s.id)
    return sheets


def _not_found(qs: QsProject) -> list[str]:
    """The numbers the register Check found listed and in no file, as open Questions."""
    with qs.member.acting():
        return sorted(
            str(q.params["number"])
            for q in Question.objects.filter(
                project_id=qs.project_id,
                status=QuestionStatus.OPEN,
                message_code=list_codes.NOT_FOUND.code,
            )
        )


def test_the_lists_found_ahead_are_those_the_read_job_records(qs_project: QsProject) -> None:
    sheets = _read_set(qs_project, ["S-01", "S-02", "S-03"])
    first, second = sheets["S-01"].id, sheets["S-02"].id
    with qs_project.member.acting():
        step1.record_read_list(first, "structural", [("S-01", "OLD"), ("S-09", "GONE")])
        lists_read = [
            # The same sheet and Discipline again: the latest kept, in the first one's place.
            (first, "structural", [("S-01", "PILE"), ("S-02", ""), ("S-01", "AGAIN"), ("S-03", "X")]),
            (second, "structural", [("S-04", "ROOF")]),
        ]
        ahead = proposals.find_questions(qs_project.project_id, lists_read=lists_read)
        for sheet_id, discipline, rows in lists_read:
            step1.record_read_list(sheet_id, discipline, rows)
        after = proposals.find_questions(qs_project.project_id)

    assert ahead is not None and after is not None
    numbers = [(e.number, e.title) for e in ahead.inputs.register]
    assert numbers == [("S-01", "PILE"), ("S-02", None), ("S-03", "X"), ("S-04", "ROOF")]
    assert ahead.inputs == after.inputs


def test_a_find_the_set_moved_away_from_is_found_again(qs_project: QsProject) -> None:
    sheets = _read_set(qs_project, ["S-01", "S-02", "S-03"])
    with qs_project.member.acting():
        stale = proposals.find_questions(qs_project.project_id)
        # The set moves after the find: a list read on S-01 names a sheet in no file.
        step1.record_read_list(
            sheets["S-01"].id, "structural", [("S-01", ""), ("S-02", ""), ("S-03", ""), ("S-07", "")]
        )
        step1.lock_writes(qs_project.project_id)
        proposals.set_questions(qs_project.project_id, found=stale)

    assert _not_found(qs_project) == ["S-07"]


def test_a_find_the_set_still_holds_is_kept_without_comparing_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    _read_set(qs_project, ["S-01", "S-01", "S-02"])
    calls: list[int] = []
    real = conflict_finder.compare

    def counted(*args: object, **kwargs: object) -> object:
        calls.append(1)
        return real(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(conflict_finder, "compare", counted)
    with qs_project.member.acting():
        found = proposals.find_questions(qs_project.project_id)
        step1.lock_writes(qs_project.project_id)
        asked = proposals.set_questions(qs_project.project_id, found=found)

    assert len(calls) == 1
    assert asked >= 1  # S-01 twice: a same-number Question, from the find kept
