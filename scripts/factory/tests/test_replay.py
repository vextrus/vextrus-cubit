"""The replay gate's edges: the line window, the score floor, what counts as standing, the refusals."""

import json
from pathlib import Path

import pytest

from scripts.factory.replay import GATE, LINES, Refused, main, measure, recalled

HEAD = "ab" * 20


def finding(
    file: str = "a.py", line: int = 10, score: int = 75, status: str = "CONFIRMED"
) -> dict[str, object]:
    return {"id": "A1", "score": score, "file": file, "line": line, "status": status}


def case(tmp_path: Path, confirmed: list[dict[str, object]], found: list[dict[str, object]]) -> Path:
    folder = tmp_path / "cases" / "pr1"
    folder.mkdir(parents=True)
    (folder / "case.json").write_text(json.dumps({"pr": 1, "head": HEAD, "confirmed": confirmed}))
    (folder / "review.json").write_text(json.dumps({"pr": 1, "head": HEAD, "findings": found}))
    return tmp_path / "cases"


@pytest.mark.parametrize(
    ("shift", "hit"), [(0, True), (LINES, True), (-LINES, True), (LINES + 1, False)]
)
def test_the_line_window_is_inclusive(shift: int, hit: bool) -> None:
    assert recalled({"file": "a.py", "line": 50}, [finding(line=50 + shift)]) is hit


def test_one_review_finding_recalls_every_confirmed_finding_beside_it(tmp_path: Path) -> None:
    confirmed = [{"file": "a.py", "line": 10}, {"file": "a.py", "line": 12}]
    assert measure(case(tmp_path, confirmed, [finding(line=11)]), None)[:2] == (2, 2)


def test_a_finding_below_fifty_or_refuted_recalls_nothing(tmp_path: Path) -> None:
    confirmed = [{"file": "a.py", "line": 10}]
    low = case(tmp_path / "low", confirmed, [finding(score=49)])
    assert measure(low, None)[:2] == (0, 1)
    refuted = case(tmp_path / "refuted", confirmed, [finding(status="REFUTED")])
    assert measure(refuted, None)[:2] == (0, 1)


def test_an_unproven_finding_of_fifty_recalls(tmp_path: Path) -> None:
    confirmed = [{"file": "a.py", "line": 10}]
    assert measure(case(tmp_path, confirmed, [finding(score=50, status="UNPROVEN")]), None)[:2] == (1, 1)


def test_a_review_that_is_not_json_is_refused_in_words(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    cases = case(tmp_path, [{"file": "a.py", "line": 1}], [])
    (cases / "pr1" / "review.json").write_text("{not json")
    assert main(["--cases", str(cases)]) == 2
    assert "not JSON" in capsys.readouterr().err


def test_a_finding_without_a_line_is_refused(tmp_path: Path) -> None:
    cases = case(tmp_path, [{"file": "a.py", "line": 1}], [{"file": "a.py", "score": 80}])
    with pytest.raises(Refused):
        measure(cases, None)


def test_a_confirmed_finding_without_a_line_is_refused(tmp_path: Path) -> None:
    with pytest.raises(Refused):
        measure(case(tmp_path, [{"file": "a.py"}], []), None)


def test_a_case_head_that_is_not_forty_hex_is_refused(tmp_path: Path) -> None:
    cases = case(tmp_path, [{"file": "a.py", "line": 1}], [])
    (cases / "pr1" / "case.json").write_text(json.dumps({"head": "abc", "confirmed": []}))
    with pytest.raises(Refused):
        measure(cases, None)


def test_the_gate_is_ninety() -> None:
    assert GATE == 90.0
