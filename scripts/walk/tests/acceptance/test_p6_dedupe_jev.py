"""T-JEV-DEDUPE acceptance: Jev advises which new walk findings repeat an open walk issue (#258).

The walk's triage dedupes on the exact `<defect_class>/<screen>` key; a group with no exact match may
be put to Jev's `same-issue` (docs/specs/factory/contracts/jev-cli.md 2) with the draft's public title
and the open issues' titles rebuilt from their keys. "Jev advises beside the exact rule; the exact rule
decides, and a missing, late or odd answer is a new issue." Advice is opt-in (`draft --advise`), so no
existing test reaches the network.

The seams (the ticket names them): `scripts.walk.dedupe.advise(text, issues, *, run=...) -> Advice`
(never raises), `Advice(decision, issue, p)`, `dedupe.MAX_ADVISED`, `scripts.walk.issues.draft(...,
advise=None)` and `issues.main(["draft", SHA, "--advise", "--walks-dir", D])`.

No network, no `gh`, no real key: every advisor and runner here is a fake, except the one test that
runs the real `scripts.factory.jev` with no key (it answers `unavailable` offline).
"""

import json
import math
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from _f5_contract import has_planted  # type: ignore[import-not-found, unused-ignore]

SHA = "0123456789abcdef0123456789abcdef01234567"
BODY_LINES = ("Item", "Severity", "Delta", "Walk:")
POSSIBLY = "- Possibly the same as: #9"
PLANTED_KEY = "synthetic-planted-key-zz-0000"


def _closed() -> tuple[list[str], list[str]]:
    from scripts.walk.sanitize import DEFECT_CLASSES, SCREENS

    classes, screens = sorted(DEFECT_CLASSES), sorted(SCREENS)
    assert len(classes) >= 6, "the fixture needs six defect classes"
    assert len(screens) >= 3, "the fixture needs three screens"
    return classes, screens


def _finding(n: int, defect_class: str, screen: str) -> dict[str, Any]:
    return {
        "id": f"planted-zz-{n}",
        "item": "M0-FL5",
        "defect_class": defect_class,
        "screen": screen,
        "delta": 1.5,
        "severity": "OTHER",
        "misleading": False,
    }


def _clean(text: str) -> int:
    return 0


def _title(key: str) -> str:
    defect_class, screen = key.split("/", 1)
    return f"walk: {defect_class} on {screen}"


def _advice(decision: str, issue: int | None, p: float | None) -> Any:
    # Imported when a fake answers, so today's failure is `draft`'s missing argument (TypeError).
    from scripts.walk.dedupe import Advice  # type: ignore[import-not-found, unused-ignore]

    return Advice(decision, issue, p)


def _draft(findings: list[dict[str, Any]], open_issues: list[dict[str, Any]], **advise: Any) -> Any:
    from scripts.walk import issues

    call: Any = issues.draft  # the `advise` argument is the seam this ticket adds
    return call(findings, open_issues, sha=SHA, scan=_clean, **advise)


def _pairs() -> tuple[str, str, str, str]:
    """Four distinct closed pairs: A and B are open issues, C and D are not."""
    classes, screens = _closed()
    return (
        f"{classes[0]}/{screens[0]}",
        f"{classes[1]}/{screens[0]}",
        f"{classes[2]}/{screens[1]}",
        f"{classes[0]}/{screens[1]}",
    )


def _fixture() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    a, b, c, d = _pairs()
    findings = [_finding(n, *key.split("/", 1)) for n, key in ((1, a), (2, c), (3, d))]
    return findings, [{"number": 7, "key": a}, {"number": 9, "key": b}]


def _answers(by_title: dict[str, tuple[str, int | None, float | None]], calls: list[Any]) -> Any:
    def advise(text: str, issues: Any) -> Any:
        calls.append((text, issues))
        decision, issue, p = by_title.get(text, ("new", None, None))
        return _advice(decision, issue, p)

    return advise


# 1. A `comment` advice moves a non-exact group to a dedup comment ---------------------------------


def test_a_comment_advice_moves_a_non_exact_group_to_a_dedup_comment() -> None:
    a, _, c, d = _pairs()
    findings, open_issues = _fixture()
    calls: list[Any] = []
    advise = _answers({_title(c): ("comment", 9, 0.9), _title(d): ("new", None, None)}, calls)

    drafts = _draft(findings, open_issues, advise=advise)

    assert [comment["number"] for comment in drafts.comments] == [7, 9]
    assert [comment["key"] for comment in drafts.comments] == [a, c]
    assert [new["title"] for new in drafts.new] == [_title(d)]
    assert len(findings) == len(drafts.new) + len(drafts.comments) + drafts.merged
    assert drafts.comments[1]["findings"] == ["planted-zz-2"]
    assert drafts.comments[1].get("advised") is True
    assert "advised" not in drafts.comments[0]


# 2. `possible` opens a new issue that says so ----------------------------------------------------


def test_a_possible_advice_opens_a_new_issue_that_says_so() -> None:
    _, _, c, d = _pairs()
    findings, open_issues = _fixture()
    plain = _draft(findings, open_issues)
    advise = _answers({_title(c): ("possible", 9, 0.5)}, [])

    drafts = _draft(findings, open_issues, advise=advise)

    assert drafts.comments == plain.comments
    assert [new["title"] for new in drafts.new] == [_title(c), _title(d)]
    advised, unadvised = drafts.new
    lines = advised["body"].splitlines()
    assert lines.count(POSSIBLY) == 1
    for line in lines:
        if line.strip() and line != POSSIBLY and not line.startswith("<!-- walk-key:"):
            assert line.lstrip("-*# ").startswith(BODY_LINES), line
    lines.remove(POSSIBLY)
    today = plain.new[0]["body"].splitlines()
    assert [ln for ln in lines if ln.strip()] == [ln for ln in today if ln.strip()], "one line added"
    assert unadvised == plain.new[1], "a draft with no advice is byte-for-byte today's"
    assert len(findings) == len(drafts.new) + len(drafts.comments) + drafts.merged


# 3. The exact rule decides, and the advisor sees only public closed words ------------------------


def test_the_advisor_sees_only_the_public_titles_and_never_an_exact_match() -> None:
    a, b, c, _ = _pairs()
    classes, screens = _closed()
    findings, open_issues = _fixture()
    findings.append(_finding(4, *a.split("/", 1)))  # a second finding on the exact pair
    open_issues.append({"number": 12, "key": b})  # the same key twice: the lowest number stands
    calls: list[Any] = []

    drafts = _draft(findings, open_issues, advise=_answers({}, calls))

    texts = [text for text, _ in calls]
    assert _title(a) not in texts, "the exact rule decides: never asked about an exact match"
    assert sorted(texts) == sorted([_title(c), _title(f"{classes[0]}/{screens[1]}")])
    for _, seen in calls:
        assert sorted((number, title) for number, title in seen) == [(7, _title(a)), (9, _title(b))]
    assert has_planted(repr(calls)) == []
    assert "planted-zz" not in repr(calls), "finding ids never reach the advisor"
    assert SHA not in repr(calls)
    assert [comment["number"] for comment in drafts.comments] == [7]


def test_without_an_advisor_the_drafts_are_todays() -> None:
    _, _, c, d = _pairs()
    findings, open_issues = _fixture()

    drafts = _draft(findings, open_issues, advise=None)

    assert drafts == _draft(findings, open_issues)
    assert [new["title"] for new in drafts.new] == [_title(c), _title(d)]


def test_todays_drafts_hold_exactly_the_closed_lines() -> None:
    """Green today: the no-advice output this ticket must not change, written out in full."""
    a, _, c, d = _pairs()
    findings, open_issues = _fixture()

    drafts = _draft(findings, open_issues)

    def body(key: str) -> str:
        lines = ["- Item: M0-FL5", "- Severity: OTHER", "- Delta: 1.5", f"- Walk: {SHA}", ""]
        return "\n".join([*lines, f"<!-- walk-key: {key} -->", ""])

    assert drafts.comments == [{"key": a, "number": 7, "body": body(a), "findings": ["planted-zz-1"]}]
    assert drafts.new == [
        {"key": c, "title": _title(c), "body": body(c), "findings": ["planted-zz-2"]},
        {"key": d, "title": _title(d), "body": body(d), "findings": ["planted-zz-3"]},
    ]
    assert drafts.merged == 0


# 4. A bad advisor never changes the result -------------------------------------------------------


def _raises(text: str, issues: Any) -> Any:
    raise RuntimeError("the advisor broke")


BAD: dict[str, Any] = {
    "raises": None,
    "comment-on-a-number-not-open": ("comment", 42, 0.9),
    "comment-with-p-2": ("comment", 9, 2.0),
    "comment-with-p-nan": ("comment", 9, math.nan),
    "not-an-advice": "comment",
}


@pytest.mark.parametrize("case", list(BAD))
def test_a_bad_advisor_never_changes_the_result(case: str) -> None:
    findings, open_issues = _fixture()
    plain = _draft(findings, open_issues)
    calls: list[str] = []

    def advise(text: str, issues: Any) -> Any:
        calls.append(text)
        answer = BAD[case]
        if answer is None:
            return _raises(text, issues)
        if isinstance(answer, str):
            return {"decision": answer, "issue": 9, "p": 0.9}  # the right words, not an Advice
        return _advice(*answer)

    drafts = _draft(findings, open_issues, advise=advise)

    assert calls, "the advisor was asked"
    assert drafts == plain, "a new issue per non-exact group, as without advice"


# 5. `dedupe.advise` over its runner --------------------------------------------------------------


ISSUES = [(7, "walk: crash on projects"), (9, "walk: other on projects")]
TEXT = "walk: words_wrong on projects"

NEW = ("new", None, None)


def _said(decision: str, issue: int | None, p: float | None, jev: str = "ok") -> str:
    return json.dumps({"decision": decision, "issue": issue, "p": p, "jev": jev})


ANSWERS: dict[str, tuple[Any, tuple[str, int | None, float | None]]] = {
    "comment": ((0, _said("comment", 9, 0.87)), ("comment", 9, 0.87)),
    "comment-at-0.8": ((0, _said("comment", 7, 0.8)), ("comment", 7, 0.8)),
    "possible": ((0, _said("possible", 9, 0.5)), ("possible", 9, 0.5)),
    "possible-at-0.3": ((0, _said("possible", 7, 0.3)), ("possible", 7, 0.3)),
    "new": ((0, _said("new", None, 0.1)), NEW),
    "unavailable": ((0, _said("new", None, None, "unavailable")), NEW),
    "exit-1": ((1, _said("comment", 9, 0.9)), NEW),
    "exit-64": ((64, ""), NEW),
    "not-json": ((0, "unavailable no_key"), NEW),
    "not-an-object": ((0, f"[{_said('comment', 9, 0.9)}]"), NEW),
    "unknown-word": ((0, _said("merge", 9, 0.9)), NEW),
    "comment-not-listed": ((0, _said("comment", 8, 0.9)), NEW),
    "possible-not-listed": ((0, _said("possible", 8, 0.5)), NEW),
    "comment-below-0.8": ((0, _said("comment", 9, 0.79)), NEW),
    "possible-below-0.3": ((0, _said("possible", 9, 0.29)), NEW),
    "timeout": ((subprocess.TimeoutExpired(["jev"], 60), ""), NEW),
    "oserror": ((OSError("no python"), ""), NEW),
}


@pytest.mark.parametrize("case", list(ANSWERS))
def test_advise_reads_only_a_well_formed_answer_within_the_thresholds(
    case: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import dedupe  # type: ignore[attr-defined, unused-ignore]

    monkeypatch.setenv("TYPESAFE_API_KEY", PLANTED_KEY)
    (outcome, stdout), (decision, issue, p) = ANSWERS[case]
    seen: list[tuple[list[str], Any]] = []

    def run(argv: list[str], *, timeout: float) -> subprocess.CompletedProcess[str]:
        assert argv[6] == "--issues"
        seen.append((list(argv), json.loads(Path(argv[7]).read_text(encoding="utf-8"))))
        if isinstance(outcome, BaseException):
            raise outcome
        return subprocess.CompletedProcess(argv, outcome, stdout, "")

    advice = dedupe.advise(TEXT, ISSUES, run=run)

    assert isinstance(advice, dedupe.Advice)
    assert (advice.decision, advice.issue, advice.p) == (decision, issue, p)
    ((argv, written),) = seen
    assert argv[:6] == [sys.executable, "-m", "scripts.factory.jev", "same-issue", "--text", TEXT]
    assert len(argv) == 8
    assert written == [{"number": 7, "title": ISSUES[0][1]}, {"number": 9, "title": ISSUES[1][1]}]
    assert PLANTED_KEY not in " ".join(argv), "no key travels in argv"
    assert "TYPESAFE_API_KEY" not in " ".join(argv)


def test_advise_with_no_open_issue_is_new_without_a_call() -> None:
    from scripts.walk import dedupe  # type: ignore[attr-defined, unused-ignore]

    calls: list[Any] = []

    def run(argv: list[str], *, timeout: float) -> subprocess.CompletedProcess[str]:
        calls.append(argv)
        return subprocess.CompletedProcess(argv, 0, '{"decision":"comment","issue":9,"p":0.9}', "")

    advice = dedupe.advise(TEXT, [], run=run)

    assert (advice.decision, advice.issue, advice.p) == ("new", None, None)
    assert calls == []


# 6. `main draft --advise` end to end with a fake -------------------------------------------------


def _triage_folder(walks: Path) -> Path:
    from scripts.walk.sanitize import ITEMS

    folder = walks / SHA
    findings = [
        {
            "id": f"f-{n}",
            "item": "M0-FL5",
            "defect_class": cls,
            "screen": "takeoff.step1",
            "delta": None,
            "severity": "OTHER",
            "misleading": False,
        }
        for n, cls in ((1, "other"), (2, "other"), (3, "crash"))
    ]
    folder.mkdir(parents=True)
    triage = {"items": [{"item": i, "status": "PASS"} for i in ITEMS], "findings": findings}
    (folder / "triage.json").write_text(json.dumps(triage))
    open_issues = [
        {"number": 9, "body": "- Walk: x\n<!-- walk-key: crash/takeoff.step1 -->"},
        {"number": 12, "body": "- Walk: x\n<!-- walk-key: words_wrong/takeoff.step1 -->"},
    ]
    (folder / "open-issues.json").write_text(json.dumps(open_issues))
    return folder


def _offline(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from scripts.walk import issues

    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(tmp_path / "factory"))
    monkeypatch.setattr(issues, "leakscan_text", lambda text: 0)


def _read(folder: Path) -> dict[str, Any]:
    public = folder / "public"
    return {
        "drafts": json.loads((folder / "drafts.json").read_text()),
        "public": {f.name: f.read_text() for f in sorted(public.iterdir())},
    }


def test_main_draft_with_advise_records_the_advised_comment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import issues

    _offline(monkeypatch, tmp_path)
    calls: list[Any] = []
    advise = _answers({"walk: other on takeoff.step1": ("comment", 12, 0.9)}, calls)
    monkeypatch.setattr("scripts.walk.dedupe.advise", advise)
    folder = _triage_folder(tmp_path / "advised")

    assert issues.main(["draft", SHA, "--advise", "--walks-dir", str(tmp_path / "advised")]) == 0

    shown = json.loads((folder / "public" / "issue-drafts.json").read_text())
    assert shown["new"] == []
    by_number = {comment["number"]: comment for comment in shown["comments"]}
    assert set(by_number) == {9, 12}
    assert by_number[12]["advised"] is True
    assert "advised" not in by_number[9], "an exact comment carries no such key"
    record = json.loads((folder / "drafts.json").read_text())
    findings_of = {comment["number"]: comment["findings"] for comment in record["comments"]}
    assert findings_of == {9: ["f-3"], 12: ["f-1", "f-2"]}
    assert [text for text, _ in calls] == ["walk: other on takeoff.step1"]

    assert issues.main(["record", SHA, "--walks-dir", str(tmp_path / "advised")]) == 0

    layer = json.loads((folder / "findings.json").read_text())
    by_id = {f["id"]: (f["issue"], f["dedup_comment_on"]) for f in layer["findings"]}
    assert by_id == {"f-1": (None, 12), "f-2": (None, 12), "f-3": (None, 9)}

    _triage_folder(tmp_path / "plain")
    assert issues.main(["draft", SHA, "--walks-dir", str(tmp_path / "plain")]) == 0
    assert len(calls) == 1, "without --advise the advisor is never called"


def test_main_draft_without_advise_is_the_exact_rule_alone(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Green today: no flag, no advisor; the sibling open issue does not change the drafts."""
    from scripts.walk import issues

    _offline(monkeypatch, tmp_path)
    folder = _triage_folder(tmp_path)

    assert issues.main(["draft", SHA, "--walks-dir", str(tmp_path)]) == 0

    shown = json.loads((folder / "public" / "issue-drafts.json").read_text())
    assert [new["title"] for new in shown["new"]] == ["walk: other on takeoff.step1"]
    assert [comment["number"] for comment in shown["comments"]] == [9]
    assert "advised" not in json.dumps(shown)
    assert "possibly" not in json.dumps(shown)


# 7. No key, no Jev: every non-exact finding is a new issue ----------------------------------------


def test_with_no_key_advise_gives_the_same_drafts_as_without(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import issues

    _offline(monkeypatch, tmp_path)
    plain, advised = _triage_folder(tmp_path / "plain"), _triage_folder(tmp_path / "advised")

    assert issues.main(["draft", SHA, "--walks-dir", str(tmp_path / "plain")]) == 0
    assert issues.main(["draft", SHA, "--advise", "--walks-dir", str(tmp_path / "advised")]) == 0

    assert _read(advised) == _read(plain)
    assert [new["findings"] for new in _read(advised)["drafts"]["new"]] == [["f-1", "f-2"]]


# 8. A bounded number of calls ---------------------------------------------------------------------


def test_the_advisor_is_asked_about_at_most_max_advised_groups() -> None:
    classes, screens = _closed()
    keys = [f"{cls}/{screen}" for cls in classes[:5] for screen in screens[:3]]
    findings = [_finding(n, *key.split("/", 1)) for n, key in enumerate(keys, start=1)]
    open_issues = [{"number": 7, "key": f"{classes[5]}/{screens[0]}"}]
    calls: list[str] = []

    def advise(text: str, issues: Any) -> Any:
        calls.append(text)
        return _advice("comment", 7, 0.9)

    drafts = _draft(findings, open_issues, advise=advise)

    from scripts.walk import dedupe  # type: ignore[attr-defined, unused-ignore]

    limit = dedupe.MAX_ADVISED
    assert isinstance(limit, int)
    assert 1 <= limit < len(keys), "the bound bites on fifteen groups"
    assert len(calls) == limit
    assert len(drafts.comments) == limit
    assert len(drafts.new) == len(keys) - limit
    assert len(findings) == len(drafts.new) + len(drafts.comments) + drafts.merged
