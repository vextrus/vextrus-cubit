"""S24-L1 on the cloud path: `ledger.py fetch-verdict` records a cloud lens's verdict file through the
same bar as `decide` (BLOCK when the lens says BLOCK; else FIX while a finding that could block stands;
else PASS), so a cloud lens's FIX with no finding that could block is recorded PASS.

The origin, the launch record and the verdict file are tf4's (test_ledger_fetch_verdict.py), reused as
they are: the PR's head adds `app.py` (a strict path) and nothing lax."""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.tf4.test_ledger_fetch_verdict import (
    VERDICT_PATH,
    Origin,
    fetch,
    verdict_file,
)


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def finding(score: int) -> dict[str, Any]:
    return {"score": score, "file": "app.py", "line": 1, "summary": "x is never read"}


@pytest.mark.parametrize(
    ("said", "findings", "recorded"),
    [
        ("FIX", [], "PASS"),
        ("FIX", [finding(40)], "PASS"),
        ("PASS", [finding(40)], "PASS"),
        ("BLOCK", [], "BLOCK"),
        ("FIX", [finding(80)], "FIX"),
    ],
    ids=["fix-no-findings", "fix-a-40", "pass-a-40", "block-no-findings", "fix-an-80"],
)
def test_a_cloud_lens_verdict_is_recorded_as_the_bar_reads_it(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    said: str,
    findings: list[dict[str, Any]],
    recorded: str,
) -> None:
    origin = Origin(tmp_path)
    origin.review_branch({VERDICT_PATH: verdict_file(origin.head, verdict=said, findings=findings)})
    code, store = fetch(origin, tmp_path, monkeypatch)
    assert code == 0
    got = json.loads((store / f"12-{origin.head}.json").read_text())["verdict"]
    assert got == recorded, f"the lens's {said} overrode the bar: {got}"


def test_a_cloud_lens_pass_with_its_own_unrefuted_80_is_still_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The refusal stays: a PASS is never recorded while a finding that could block has no refuter's
    verdict (a cloud lens's findings come with none)."""
    origin = Origin(tmp_path)
    claimed = verdict_file(origin.head, verdict="PASS", findings=[finding(80)])
    origin.review_branch({VERDICT_PATH: claimed})
    code, store = fetch(origin, tmp_path, monkeypatch)
    assert code == 3
    assert not (store / f"12-{origin.head}.json").exists()
