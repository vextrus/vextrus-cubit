"""S16-T1's own checks of the frame read, past its acceptance tests: a re-run keeps what the QS
decided, a family's failure Question follows the family's later runs, a family's own Questions are
asked once, and a value is never a float."""

import dataclasses
import types
from decimal import Decimal
from typing import Any

import pytest

from vextrus.takeoff.models import Proposal, ProposalStatus, ProposalTrace, Question, QuestionStatus
from vextrus.takeoff.services import frame_read
from vextrus.takeoff.tests.acceptance.ts16t1.frame import (
    FAMILY_FAILED,
    Frame,
    fake_family,
    structural_frame,
    use_families,
)

__all__ = ["structural_frame"]


def _run(f: Frame) -> frame_read.FrameReadResult:
    with f.member.acting():
        return frame_read.run(f.building_id)


def _columns(f: Frame) -> list[Proposal]:
    with f.member.acting():
        return list(Proposal.objects.filter(project_id=f.project_id, family_key="column"))


def _failed(f: Frame) -> list[Question]:
    with f.member.acting():
        return list(Question.objects.filter(project_id=f.project_id, message_code=FAMILY_FAILED))


def test_a_rerun_keeps_a_decided_proposal_as_decided(
    structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("column", "columns"))
    _run(f)
    first = _columns(f)[0]
    with f.member.acting():
        Proposal.objects.filter(id=first.id).update(
            status=ProposalStatus.CONFIRMED, values={**first.values, "section_b": "300"}
        )

    _run(f)

    again = next(p for p in _columns(f) if p.id == first.id)
    assert again.status == ProposalStatus.CONFIRMED
    assert again.values["section_b"] == "300"


def test_the_mark_and_where_it_stands_are_kept_with_the_values(
    structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("column", "columns"))

    _run(f)

    for p in _columns(f):
        assert p.values["mark"] == "C1"
        assert p.values["at"] == {"grid": ["B", "2"], "offset": ["0", "0"]}
        assert p.values["section_b"] == {"value": "254", "unit": "mm", "text": '10"X20"'}
        assert p.confidence == Decimal("0.9")


def test_each_trace_names_the_sheet_and_view_it_was_read_on(
    structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("column", "columns"))

    _run(f)

    written = _columns(f)
    with f.member.acting():
        traces = list(ProposalTrace.objects.filter(proposal_id__in=[p.id for p in written]))
    assert traces
    for t in traces:
        assert t.anchor["view_id"] in f.confirmed_views
        assert t.anchor["sheet_id"]
        assert t.anchor["kind"] == "dwg"


def test_a_failure_is_withdrawn_once_the_family_reads_and_asked_again_when_it_fails(
    structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("column", "columns", raises=True))
    _run(f)
    use_families(monkeypatch, fake_family("column", "columns"))

    _run(f)

    [asked] = _failed(f)
    assert asked.status == QuestionStatus.WITHDRAWN
    assert _columns(f)

    use_families(monkeypatch, fake_family("column", "columns", raises=True))
    _run(f)

    [again] = _failed(f)
    assert again.id == asked.id
    assert again.status == QuestionStatus.OPEN


def test_a_family_s_own_question_is_asked_once(
    structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    fake = fake_family("column", "columns")
    recognise = fake.module.recognise

    def asking(*args: Any) -> Any:
        found = recognise(*args)
        raised = types.SimpleNamespace(
            code="engine.column.size_not_read", params={"mark": "C2"}, candidate_key="column:x:C2"
        )
        return types.SimpleNamespace(**{**vars(found), "questions": (raised,)})

    fake.module.recognise = asking  # type: ignore[attr-defined]
    use_families(monkeypatch, fake)

    result = _run(f)
    _run(f)

    assert result.questions == 1
    with f.member.acting():
        asked = list(
            Question.objects.filter(project_id=f.project_id, message_code="engine.column.size_not_read")
        )
    assert len(asked) == 1
    assert asked[0].params == {"mark": "C2"}
    assert asked[0].step == "columns"
    assert asked[0].building_id == f.building_id


def test_a_value_is_json_with_its_decimals_as_strings_never_floats() -> None:
    held = types.SimpleNamespace(value=Decimal("2.9210"), unit="m", text="9'-7\"")

    assert frame_read._json(held) == {"value": "2.9210", "unit": "m", "text": "9'-7\""}
    assert frame_read._json(Decimal("6E+3")) == "6000"
    assert frame_read._json(0.1) == "0.1"
    assert frame_read._json({"a": (Decimal("1"),)}) == {"a": ["1"]}


def _anchored_elsewhere(fake: Any) -> None:
    """The fake family's candidates read again with other anchors (another reader version's)."""
    recognise = fake.module.recognise

    def moved(*args: Any) -> Any:
        found = recognise(*args)
        candidates = tuple(
            types.SimpleNamespace(
                **{
                    **vars(c),
                    "anchors": {
                        fact: dataclasses.replace(a, handle="FFF") for fact, a in c.anchors.items()
                    },
                }
            )
            for c in found.candidates
        )
        return types.SimpleNamespace(**{**vars(found), "candidates": candidates})

    fake.module.recognise = moved


def _traces_of(f: Frame, proposal: Proposal) -> list[ProposalTrace]:
    with f.member.acting():
        return list(ProposalTrace.objects.filter(proposal_id=proposal.id))


def test_a_rerun_with_other_anchors_leaves_a_decided_proposal_s_traces_and_adds_to_an_open_one_s(
    structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("column", "columns"))
    _run(f)
    decided, still_open = _columns(f)[:2]
    with f.member.acting():
        Proposal.objects.filter(id=decided.id).update(status=ProposalStatus.CONFIRMED)
    before = {(t.fact, t.anchor["handle"]) for t in _traces_of(f, decided)}
    open_before = {(t.fact, t.anchor["handle"]) for t in _traces_of(f, still_open)}
    moved = fake_family("column", "columns")
    _anchored_elsewhere(moved)
    use_families(monkeypatch, moved)

    _run(f)

    assert {(t.fact, t.anchor["handle"]) for t in _traces_of(f, decided)} == before
    assert {(t.fact, t.anchor["handle"]) for t in _traces_of(f, still_open)} == open_before | {
        ("section_b", "FFF"),
        ("section_d", "FFF"),
    }


def test_a_proposal_is_keyed_within_its_building(
    structural_frame: Frame, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = structural_frame
    use_families(monkeypatch, fake_family("column", "columns"))

    _run(f)

    assert all(p.candidate_key.startswith(f"{f.building_id}:column:") for p in _columns(f))
