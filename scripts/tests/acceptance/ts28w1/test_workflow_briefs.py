"""S28-W1: `/real-set-walk`'s briefs under the new bar, and its repeat mode for walk #2.

The ticket: "A repeat mode for walk #2: the critics walk walk #1's items, its findings' reproduction
steps and the fixes merged since, not a fresh exploration"; reproduction steps are "kept in the walk's
private folder under .private/, never in an issue"; "Triage step 1 changes with it: today 'an item is
FAIL if either says FAIL'".

The workflow (`.claude/workflows/real-set-walk.js`) is run under node with its globals stood in (`args`,
`agent`, `parallel`, `phase`, `log`): each `agent(...)` call's brief is recorded, and each is answered by
its schema's shape (the served URLs, an empty walk, zero triage counts, a PASS verdict; null for any
other). Nothing is walked and no file is read. Pinned names: repeat mode is asked for as
`<sha40> --repeat <prior sha40>` (the skill passes its arguments as one string), a walk's private folder
is `.private/work/walks/<sha40>/`, its reproduction steps `repro/` there, and the fixes merged since are
the range `<prior>..<sha>`.
"""

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[4]
WORKFLOW = ROOT / ".claude" / "workflows" / "real-set-walk.js"
SHA = "89abcdef0123456789abcdef0123456789abcdef"
PRIOR = "0123456789abcdef0123456789abcdef01234567"

HARNESS = r"""
import { pathToFileURL } from 'node:url'
const calls = []
const answer = (schema) => {
  const required = (schema && schema.required) || []
  const web = 'http://127.0.0.1:5511'
  if (required.includes('exists')) return { exists: true, web, api: 'http://127.0.0.1:8811' }
  if (required.includes('items') && required.includes('findings')) return { items: [], findings: [] }
  if (required.includes('issues_drafted')) {
    const counts = { findings: 0, issues_drafted: 0, dedup_comments: 0, merged: 0 }
    return { ...counts, refused: false, not_walked: [] }
  }
  if (required.includes('verdict_exit')) {
    return { leak_hits: 0, verdict_exit: 0, result: 'PASS', public_rescan_hits: 0 }
  }
  return null
}
globalThis.args = process.argv[3]
globalThis.phase = () => {}
globalThis.log = () => {}
globalThis.parallel = async (thunks) => Promise.all(thunks.map((thunk) => thunk()))
globalThis.agent = async (prompt, options = {}) => {
  const schema = options.schema || {}
  calls.push({ prompt: String(prompt), label: options.label || '', required: schema.required || [] })
  return answer(schema)
}
let error = null
try {
  await import(pathToFileURL(process.argv[2]).href)
} catch (thrown) {
  error = String(thrown && thrown.message ? thrown.message : thrown)
}
process.stdout.write(JSON.stringify({ calls, error }))
"""


def _run(tmp_path: Path, arguments: str) -> dict[str, Any]:
    harness = tmp_path / "harness.mjs"
    harness.write_text(HARNESS)
    done = subprocess.run(
        ["node", str(harness), str(WORKFLOW), arguments],
        capture_output=True,
        text=True,
        check=False,
        cwd=tmp_path,
    )
    assert done.returncode == 0, done.stderr[-2000:]
    ran: dict[str, Any] = json.loads(done.stdout)
    return ran


def _walkers(ran: dict[str, Any]) -> list[str]:
    """The briefs of every stage that walks the served product (it returns items and findings)."""
    return [
        c["prompt"] for c in ran["calls"] if "items" in c["required"] and "findings" in c["required"]
    ]


def _triage(ran: dict[str, Any]) -> list[str]:
    return [c["prompt"] for c in ran["calls"] if "issues_drafted" in c["required"]]


@pytest.fixture
def repeat(tmp_path: Path) -> dict[str, Any]:
    ran = _run(tmp_path, f"{SHA} --repeat {PRIOR}")
    assert ran["error"] is None, f"the workflow refused a repeat walk: {ran['error']}"
    assert _walkers(ran), "the repeat walk briefed no critic"
    return ran


def test_a_repeat_walk_briefs_every_critic_with_the_prior_walk_s_folder(repeat: dict[str, Any]) -> None:
    for brief in _walkers(repeat):
        assert f".private/work/walks/{PRIOR}/" in brief, brief[:200]


def test_a_repeat_walk_briefs_every_critic_with_the_prior_findings_reproduction_steps(
    repeat: dict[str, Any],
) -> None:
    for brief in _walkers(repeat):
        assert f".private/work/walks/{PRIOR}/repro/" in brief, brief[:200]


def test_a_repeat_walk_briefs_every_critic_with_the_fixes_merged_since(repeat: dict[str, Any]) -> None:
    for brief in _walkers(repeat):
        assert f"{PRIOR}..{SHA}" in brief, brief[:200]


def test_a_repeat_walk_s_triage_reads_the_prior_walk(repeat: dict[str, Any]) -> None:
    # Triage tells a new finding from walk #1's by the prior walk's record.
    briefs = _triage(repeat)
    assert briefs, "the repeat walk ran no triage"
    assert all(f".private/work/walks/{PRIOR}/" in brief for brief in briefs)


def test_a_repeat_walk_judges_its_own_head(repeat: dict[str, Any]) -> None:
    # Same place as a fresh walk: the verdict of walk #2 is written under its own head's folder.
    briefs = [c["prompt"] for c in repeat["calls"] if "verdict_exit" in c["required"]]
    assert briefs, "the repeat walk wrote no verdict"
    assert all(f"scripts.walk.verdict {SHA}" in brief for brief in briefs)


def test_a_repeat_walk_refuses_a_prior_that_is_not_a_full_sha(tmp_path: Path) -> None:
    ran = _run(tmp_path, f"{SHA} --repeat ../../{PRIOR[:12]}")

    assert ran["error"] is not None
    assert ran["calls"] == []


def test_a_fresh_walk_names_no_prior_walk(tmp_path: Path) -> None:
    ran = _run(tmp_path, SHA)

    assert ran["error"] is None, ran["error"]
    assert _walkers(ran)
    assert all(PRIOR not in c["prompt"] and "--repeat" not in c["prompt"] for c in ran["calls"])


def test_triage_keeps_reproduction_steps_in_the_walk_s_private_folder(tmp_path: Path) -> None:
    ran = _run(tmp_path, SHA)

    briefs = _triage(ran)
    assert briefs
    assert all(f".private/work/walks/{SHA}/repro/" in brief for brief in briefs), (
        "triage keeps no reproduction steps in the walk's private folder"
    )


def test_triage_no_longer_fails_an_item_because_either_critic_said_fail() -> None:
    assert "an item is FAIL if either says FAIL" not in WORKFLOW.read_text(), (
        "triage still fails an item when either critic says FAIL"
    )
