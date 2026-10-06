"""S15-R3b (issue #521): the replay gate is rerun against a committed expected-findings file. S14-R3
measured it "on 12 session-13 PR heads (#346, #348, #356, #371, #392, #400, #402, #472, #478, #482, #485,
#486)" against "the confirmed findings of the old review"; wanted: "Rerun the replay, twice to measure
variance", which needs those heads and findings in the repository, not in a private folder.

The file (named here): `scripts/factory/replay_expected.json`, in the shape
`python -m scripts.factory.replay --expected <file>` reads (`{"cases": [{"pr", "head", "confirmed":
[{"file", "line", "summary"}, ...]}, ...]}`). Its findings are the old process's, not ground truth
(#521); the file holds PR numbers, shas, repository paths, line numbers and summaries of public PRs.
"""

import json
import re
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
EXPECTED = REPO / "scripts" / "factory" / "replay_expected.json"
SESSION_13_HEADS = {346, 348, 356, 371, 392, 400, 402, 472, 478, 482, 485, 486}
HEX40 = re.compile(r"[0-9a-f]{40}")


def cases() -> list[dict[str, Any]]:
    assert EXPECTED.is_file(), "no committed expected-findings file scripts/factory/replay_expected.json"
    loaded = json.loads(EXPECTED.read_text())
    assert isinstance(loaded, dict), "the expected-findings file is not a JSON object"
    found = loaded.get("cases")
    assert isinstance(found, list), "the expected-findings file has no 'cases' list"
    return found


def test_it_holds_the_twelve_session_13_heads_issue_521_names() -> None:
    prs = {entry.get("pr") for entry in cases()}
    assert prs >= SESSION_13_HEADS, f"missing PRs: {sorted(SESSION_13_HEADS - prs)}"


def test_every_case_names_its_pr_and_its_full_head() -> None:
    for entry in cases():
        assert isinstance(entry.get("pr"), int), entry.get("pr")
        head = entry.get("head")
        assert isinstance(head, str), entry.get("pr")
        assert HEX40.fullmatch(head), f"PR {entry.get('pr')}: head {head!r} is not 40 hex"


def test_every_case_holds_a_confirmed_finding_with_its_file_and_line() -> None:
    for entry in cases():
        confirmed = entry.get("confirmed")
        assert isinstance(confirmed, list), entry.get("pr")
        assert confirmed, f"PR {entry.get('pr')} holds no confirmed finding"
        for found in confirmed:
            assert isinstance(found.get("file"), str), found
            assert found["file"], found
            assert not found["file"].startswith("/"), found
            line = found.get("line")
            assert isinstance(line, int), found
            assert not isinstance(line, bool), found
            assert line >= 0, found
