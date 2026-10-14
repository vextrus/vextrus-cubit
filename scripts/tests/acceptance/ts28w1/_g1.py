"""S28-W1's scripted G1 path, on synthetic data only (`_f5_contract`'s G1 fixtures; no drawing).

The agent layer's scripted path is `triage.json` (written by triage) -> `python -m scripts.walk.issues
draft` -> `issues record` (findings.json) -> `python -m scripts.walk.verdict`. The tests drive that whole
path, so the new item rule may live in `record` or in the verdict, as the builder chooses.

Reproduction steps of a misleading finding are kept in the walk's private folder as
`<walks-dir>/<sha40>/repro/<finding id>.md` (the seam S28-W1 names; never in an issue).
"""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.walk import issues, verdict
from scripts.walk.tests.acceptance._f5_contract import WALKED_ITEMS, g1_expect, g1_snapshot, g1_walk

SHA = "0123456789abcdef0123456789abcdef01234567"
STARTED = "2026-10-05T01:00:00Z"
FINISHED = "2026-10-05T02:00:00Z"
REPRO_SENTINEL = "synthetic reproduction step RQ7 open the planted screen"
"""A sentence only a reproduction file holds: it must never reach an issue draft or the verdict."""


def finding(
    n: int, item: str, *, severity: str = "OTHER", misleading: bool = False, **change: Any
) -> dict[str, Any]:
    """A triaged finding, exactly sanitize.py's ALLOWED_KEYS."""
    return {
        "id": f"f-{n}",
        "item": item,
        "defect_class": "access_wrong",
        "screen": "drawing-set",
        "delta": None,
        "severity": severity,
        "misleading": misleading,
        **change,
    }


def triaged(status: dict[str, str], findings: list[dict[str, Any]]) -> dict[str, Any]:
    """triage.json: every walked item (PASS unless `status` says otherwise) and the findings."""
    return {
        "items": [{"item": item, "status": status.get(item, "PASS")} for item in WALKED_ITEMS],
        "findings": findings,
    }


def lay_out(walks: Path, expect_dir: Path, sha: str = SHA, started: str = STARTED) -> Path:
    folder = walks / sha
    folder.mkdir(parents=True)
    expect_dir.mkdir(exist_ok=True)
    (expect_dir / "set-a.json").write_text(json.dumps(g1_expect()))
    (folder / "walk.json").write_text(json.dumps(g1_walk(sha, started)))
    (folder / "snapshot.json").write_text(json.dumps(g1_snapshot(sha, started)))
    return folder


def write_repro(folder: Path, finding_id: str) -> Path:
    path = folder / "repro" / f"{finding_id}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"1. Sign in as the QS.\n2. {REPRO_SENTINEL}.\n3. Read the shown count.\n")
    return path


def run_chain(
    monkeypatch: pytest.MonkeyPatch,
    walks: Path,
    expect_dir: Path,
    layer: dict[str, Any],
    *,
    sha: str = SHA,
    finished: str = FINISHED,
) -> list[int]:
    """triage.json -> issues draft -> issues record (every new draft gets an issue) -> verdict.

    Returns the exit codes of the steps run (it stops at the first non-zero one)."""
    folder = walks / sha
    (folder / "triage.json").write_text(json.dumps(layer))
    (folder / "open-issues.json").write_text("[]")
    monkeypatch.setattr(issues, "leakscan_text", lambda text: 0)
    monkeypatch.setattr(verdict, "utc_now", lambda: finished)
    codes = [issues.main(["draft", sha, "--walks-dir", str(walks)])]
    if codes[-1] != 0:
        return codes
    drafted = json.loads((folder / "public" / "issue-drafts.json").read_text())
    created = [f"{new['n']}={800 + new['n']}" for new in drafted["new"]]
    record = ["record", sha, "--walks-dir", str(walks)]
    for pair in created:
        record += ["--created", pair]
    codes.append(issues.main(record))
    if codes[-1] != 0:
        return codes
    argv = [sha, "--leak-hits", "0", "--walks-dir", str(walks), "--expect-dir", str(expect_dir)]
    codes.append(verdict.main(argv))
    return codes


def judged(folder: Path) -> dict[str, Any]:
    written: dict[str, Any] = json.loads((folder / "verdict.json").read_text())
    return written


def item_status(written: dict[str, Any], item: str) -> str:
    statuses = [i["status"] for i in written["agent_layer"]["items"] if i["item"] == item]
    assert len(statuses) == 1, f"{item} is listed {len(statuses)} times"
    return str(statuses[0])
