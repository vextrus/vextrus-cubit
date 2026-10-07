"""S17-F6, the review bar: the ledger records it and `scripts.merge_ready` agrees.

The owner's ruling (7 Oct 2026, session 17): yes to "Raise review's blocking bar to 75, keeping 50-74
blocking only on strict paths (security walls, migrations, money, readers), filing the rest as issues".
The brief: "`scripts/merge_ready` applies the same bar."

Each test records a review through `python -m scripts.ledger record` (the decision input of
test_bar.py, with the finding's file as the FINDING line's fifth field) and asks the review gate,
`scripts.merge_ready.review_problems` (tf4's seam), whether the PR may merge: a PR whose only standing
finding scores 50-74 off the strict paths may (it is filed, not fixed); one at 75, or at 50 on a strict
path, may not. A PASS whose 50-74 finding off the strict paths no refuter judged is recorded (the refuter
runs on a sample)."""

import json
from pathlib import Path
from typing import Any

import pytest

PR = 12
H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
BASE = "0123456789abcdef0123456789abcdef01234567"
COMMENT_ID = 4242


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


class Poster:
    def __init__(self) -> None:
        self.bodies: list[str] = []

    def __call__(self, pr: int, body: str) -> int:
        self.bodies.append(body)
        return COMMENT_ID


def clean(text: str) -> int:
    return 0


def recorded(tmp_path: Path, finding: str) -> tuple[dict[str, Any], str, Path]:
    """Record one round whose reviewer said PASS and found `finding`: the record, the marker posted
    and the ledger folder. Fails when the ledger refuses the record."""
    from scripts.ledger import main

    ledger_dir = tmp_path / "ledger"
    source = tmp_path / "final.txt"
    source.write_text(f"VERDICT: PASS at {H}\n{finding}\n")
    poster = Poster()
    code = main(
        ["record", str(PR), "--round", "1", "--head", H, "--from", str(source)],
        scan=clean,
        post=poster,
        ledger_dir=ledger_dir,
    )
    assert code == 0, f"the ledger did not record {finding!r} (exit {code})"
    [body] = poster.bodies
    record: dict[str, Any] = json.loads((ledger_dir / f"{PR}-{H}.json").read_text())
    return record, body, ledger_dir


def gate(tmp_path: Path, ledger_dir: Path, marker: str) -> list[str]:
    from scripts.merge_ready import review_problems

    facts = {
        "pr": PR,
        "head": H,
        "base": BASE,
        "title": "s17-f6: the review bar",
        "body": "Verify: pytest 0.\n",
        "branch": "s17-f6",
        "comments": [{"id": 50, "body": "a plain comment"}, {"id": COMMENT_ID, "body": marker}],
        "files": ["scripts/ledger.py"],
        "diff": "+the bar\n",
        "messages": ["s17-f6: the bar"],
    }
    return review_problems(
        facts,
        ledger_dir=ledger_dir,
        repo=tmp_path,
        scan=lambda kind, text: 0,
        issue_open=lambda number: True,
    )


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN", "-"])
def test_a_pr_whose_only_standing_finding_is_74_off_a_strict_path_may_merge(
    tmp_path: Path, word: str
) -> None:
    record, marker, ledger_dir = recorded(tmp_path, f"FINDING f1 74 {word} web/src/components/badge.tsx")
    assert record["verdict"] == "PASS"
    assert gate(tmp_path, ledger_dir, marker) == []


def test_a_pr_with_a_standing_75_may_not_merge(tmp_path: Path) -> None:
    record, marker, ledger_dir = recorded(
        tmp_path, "FINDING f1 75 CONFIRMED web/src/components/badge.tsx"
    )
    assert record["verdict"] == "FIX"
    found = gate(tmp_path, ledger_dir, marker)
    assert any("FIX" in problem for problem in found), found


@pytest.mark.parametrize(
    "path",
    ["vextrus/platform/migrations/0003_row_level_security.py", "vextrus/boq/services/pricing.py"],
)
def test_a_pr_with_a_standing_50_on_a_strict_path_may_not_merge(tmp_path: Path, path: str) -> None:
    record, marker, ledger_dir = recorded(tmp_path, f"FINDING f1 50 UNPROVEN {path}")
    assert record["verdict"] == "FIX"
    found = gate(tmp_path, ledger_dir, marker)
    assert any("FIX" in problem for problem in found), found


def test_a_pr_with_a_49_on_a_strict_path_may_merge(tmp_path: Path) -> None:
    record, marker, ledger_dir = recorded(
        tmp_path, "FINDING f1 49 CONFIRMED engine/read/libredwg/reader.py"
    )
    assert record["verdict"] == "PASS"
    assert gate(tmp_path, ledger_dir, marker) == []
