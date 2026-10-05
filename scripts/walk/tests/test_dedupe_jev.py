"""The builder's tests for Jev's walk dedupe (#258) beyond the pinned acceptance tests (synthetic only).

They pin the choices the ticket leaves to the builder: the thresholds' edges on the way back, the
issues file deleted after the call, no advisor call with no open issue, the bound counting only
advised groups, every advised body still leak-scanned, and the printed count.
"""

import json
import math
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts.walk import dedupe, issues
from scripts.walk.dedupe import Advice

SHA = "0123456789abcdef0123456789abcdef01234567"
ISSUES = [(7, "walk: crash on projects"), (9, "walk: other on projects")]


def _finding(n: int, defect_class: str, screen: str = "projects") -> dict[str, Any]:
    return {
        "id": f"f-{n}",
        "item": "M0-FL5",
        "defect_class": defect_class,
        "screen": screen,
        "delta": None,
        "severity": "OTHER",
        "misleading": False,
    }


@pytest.mark.parametrize(
    ("advice", "kept"),
    [
        (Advice("comment", 9, 1.0), True),
        (Advice("comment", 9, 0.8), True),
        (Advice("possible", 9, 0.79), True),
        (Advice("possible", 9, 0.8), False),  # `possible` is below the comment threshold
        (Advice("comment", 9, -0.1), False),
        (Advice("comment", 9, math.inf), False),
        (Advice("comment", True, 0.9), False),
        (Advice("comment", 9, True), False),
        (Advice("comment", None, 0.9), False),
        (Advice("new", 9, 0.9), False),
    ],
)
def test_checked_keeps_only_an_answer_within_the_thresholds(advice: Advice, kept: bool) -> None:
    assert (dedupe.checked(advice, [7, 9]) == advice) is kept
    if not kept:
        assert dedupe.checked(advice, [7, 9]) == dedupe.NEW


def test_advise_deletes_its_issues_file_and_survives_an_odd_runner() -> None:
    names: list[str] = []

    def run(argv: list[str], *, timeout: float) -> subprocess.CompletedProcess[str]:
        names.append(argv[7])
        assert timeout == dedupe.TIMEOUT
        return subprocess.CompletedProcess(argv, 0, '{"decision":"comment","issue":9,"p":0.9}\n', "")

    assert dedupe.advise("walk: words_wrong on projects", ISSUES, run=run) == Advice("comment", 9, 0.9)
    assert not Path(names[0]).exists()

    def broken(argv: list[str], *, timeout: float) -> Any:
        names.append(argv[7])
        return None  # not a CompletedProcess

    assert dedupe.advise("walk: words_wrong on projects", ISSUES, run=broken) == dedupe.NEW
    assert not Path(names[1]).exists()


def test_draft_never_asks_with_no_open_issue() -> None:
    calls: list[str] = []

    def advise(text: str, titles: Any) -> Advice:
        calls.append(text)
        return Advice("comment", 7, 0.9)

    drafts = issues.draft([_finding(1, "crash")], [], sha=SHA, scan=lambda text: 0, advise=advise)

    assert calls == []
    assert [new["key"] for new in drafts.new] == ["crash/projects"]


def test_every_advised_body_is_leak_scanned_and_a_hit_refuses() -> None:
    findings = [_finding(1, "crash"), _finding(2, "other")]
    open_issues = [{"number": 7, "key": "words_wrong/projects"}]

    def advise(text: str, titles: Any) -> Advice:
        if text.startswith("walk: crash"):
            return Advice("comment", 7, 0.9)
        return Advice("possible", 7, 0.5)

    scanned: list[str] = []

    def scan(text: str) -> int:
        scanned.append(text)
        return 0

    drafts = issues.draft(findings, open_issues, sha=SHA, scan=scan, advise=advise)

    assert [c["key"] for c in drafts.comments] == ["crash/projects"]
    assert drafts.new[0]["possibly"] == 7
    assert any("- Possibly the same as: #7" in text for text in scanned)
    assert drafts.comments[0]["body"] in scanned
    with pytest.raises(issues.Refused, match="the leak scan hit a draft"):
        issues.draft(findings, open_issues, sha=SHA, scan=lambda text: 1, advise=advise)


def test_main_prints_the_advised_count_only_with_the_flag(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    monkeypatch.setattr(issues, "leakscan_text", lambda text: 0)
    monkeypatch.setattr(dedupe, "advise", lambda text, titles: Advice("possible", 9, 0.5))
    for name in ("plain", "advised"):
        folder = tmp_path / name / SHA
        folder.mkdir(parents=True)
        triage = {"items": [], "findings": [_finding(1, "other"), _finding(2, "crash")]}
        (folder / "triage.json").write_text(json.dumps(triage))
        rows = [{"number": 9, "body": "<!-- walk-key: crash/projects -->"}]
        (folder / "open-issues.json").write_text(json.dumps(rows))

    assert issues.main(["draft", SHA, "--walks-dir", str(tmp_path / "plain")]) == 0
    assert capsys.readouterr().out == "issues: 1 new, 1 comments, 0 merged\n"
    assert issues.main(["draft", SHA, "--advise", "--walks-dir", str(tmp_path / "advised")]) == 0
    assert capsys.readouterr().out == "issues: 1 new, 1 comments, 0 merged, 0 advised\n"

    shown = json.loads((tmp_path / "advised" / SHA / "public" / "issue-drafts.json").read_text())
    assert shown["new"][0]["possibly"] == 9
    body = (tmp_path / "advised" / SHA / "public" / "new-1.md").read_text()
    assert "- Possibly the same as: #9\n" in body
