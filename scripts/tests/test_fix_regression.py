"""The `fix-regression` exception (the owner, 5 Oct 2026: "Allow a fix-regression round"): a third
review is allowed when every finding left at round 2 was introduced by fix round 1. The ledger
records it, and the record it writes is the one `merge_ready` accepts: the ledger's own `main` writes
it, `merge_ready`'s own `record_problems` reads it."""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts import merge_ready
from scripts.ledger import main

H = "3f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
SEAMS: dict[str, Any] = {"scan": lambda text: 0, "post": lambda pr, body: 7}


@pytest.fixture(autouse=True)
def local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def test_a_third_round_may_start_under_fix_regression(tmp_path: Path) -> None:
    reason = ["--reason", "round 2's only finding came from fix round 1's index restore"]
    argv = ["check", "12", "--round", "3", "--exception", "fix-regression", *reason]

    assert main(argv, ledger_dir=tmp_path) == 0
    assert (
        main(["check", "12", "--round", "3", "--exception", "deadline", *reason], ledger_dir=tmp_path)
        == 3
    )


def test_the_ledgers_fix_regression_record_is_one_merge_ready_accepts(tmp_path: Path) -> None:
    final = tmp_path / "final.txt"
    final.write_text(f"VERDICT: PASS at {H}\nVERDICT: PASS at {H}\n")
    argv = ["record", "12", "--round", "3", "--head", H, "--from", str(final)]
    exception = ["--exception", "fix-regression", "--reason", "a regression fix round 1 introduced"]

    assert main([*argv, *exception], ledger_dir=tmp_path, **SEAMS) == 0

    (written,) = tmp_path.glob("12-*.json")
    record = json.loads(written.read_text())
    assert record["exception"] == {
        "kind": "fix-regression",
        "reason": "a regression fix round 1 introduced",
    }
    assert merge_ready.record_problems(record, 12, H) == []
