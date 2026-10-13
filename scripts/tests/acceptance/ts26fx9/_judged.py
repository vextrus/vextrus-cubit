"""S26-FX9's helpers on S26-FX4's world (S14-R1's fakes: `gh`, `claude` and `uv` are scripts, the real
pytest runs each replay; no model, no network).

The defect (PR #771, round 6): a delta review re-ran round 5's kept attack on the fixed head; it failed
only at its own staleness guard (an assertion that a source file still holds the literal expression the
attack replicates), before any check of the defect, and the round recorded it CONFIRMED by replay with
no refuter, so a fixed PR was blocked.
"""

import json
import subprocess
from typing import Any

from scripts.tests.acceptance.ts14r1._world import review_reply, why
from scripts.tests.acceptance.ts26fx4._world import (
    BADGE,
    H1,
    H2,
    PR,
    R1_ATTACK,
    R1_ATTACK_FILE,
    TOTAL,
    DeltaWorld,
    finding,
)

# Round 2's kept attack, in the shape of PR #771's: a guard that the seam it replicates still reads as
# it did, then the check of the defect. On round 2's head the guard holds and the defect check fails.
GUARDED_FILE = "review_attacks/delta/test_r2_total_guarded.py"
GUARD_LITERAL = "export const Total = 0"
GUARD_WORDS = "total.tsx no longer reads as this attack replicates"
DEFECT_WORDS = "the total has no TOTAL_OK"
STALE_SUMMARY = "the total leaves out the line the schedule holds"

# The guard fails inside the test (FAILED by name, as on PR #771).
GUARD_IN_TEST = (
    "from pathlib import Path\n\n\n"
    "def test_attack() -> None:\n"
    f"    total = Path('{TOTAL}').read_text()\n"
    "    # The replica below is the head's expression; a changed total makes this test stale.\n"
    f"    assert '{GUARD_LITERAL}' in total, '{GUARD_WORDS}'\n"
    f"    assert 'TOTAL_OK' in total, '{DEFECT_WORDS}'\n"
)
# The guard fails while pytest collects the file (an error, no test run).
GUARD_AT_COLLECTION = (
    "from pathlib import Path\n\n"
    f"TOTAL = Path('{TOTAL}').read_text()\n"
    f"assert '{GUARD_LITERAL}' in TOTAL, '{GUARD_WORDS}'\n\n\n"
    "def test_attack() -> None:\n"
    f"    assert 'TOTAL_OK' in TOTAL, '{DEFECT_WORDS}'\n"
)

# The fix of the total: TOTAL_OK added, and the line the guard reads rewritten (the guard now fails).
FIXED_REWRITTEN = {TOTAL: "export const Total = 1\nexport const TOTAL_OK = 'THE_FIX_ITSELF'\n"}
# A head that brings round 1's defect back (the badge loses COUNT_OK): round 1's attack fails again
# at the very assertion it failed at on round 1.
REGRESSED = {
    TOTAL: "export const Total = 0\nexport const TOTAL_OK = 'THE_FIX_ITSELF'\n",
    BADGE: H1[BADGE],
}
# The badge's attack, as the replay names it in its claim.
ROUND_ONE_FILE = R1_ATTACK_FILE
ROUND_ONE_SUMMARY = finding(80, BADGE, None)["summary"]
REASON = "the round cap: the fix only"


def guarded_rounds(world: DeltaWorld, attack: str) -> None:
    """PR 12 reviewed twice, each round FIX on a finding its attack confirmed by replay: round 1 at H1
    (the badge lacks COUNT_OK), round 2 at H2 by the guarded attack `attack` (the total lacks
    TOTAL_OK; its guard holds on H2)."""
    world.pr(PR, H1)
    world.lenses(
        review_reply("FIX", [finding(80, BADGE, R1_ATTACK_FILE)]), write={R1_ATTACK_FILE: R1_ATTACK}
    )
    done = world.run(str(PR), "--round", "1")
    assert done.returncode == 0, f"round 1 did not record: {why(done)}"
    world.push(PR, H2)
    found = {**finding(80, TOTAL, GUARDED_FILE), "summary": STALE_SUMMARY}
    world.lenses(review_reply("FIX", [found]), write={GUARDED_FILE: attack})
    done = world.run(str(PR), "--round", "2")
    assert done.returncode == 0, f"round 2 did not record: {why(done)}"
    shown = summary_of(done)
    assert [item["status"] for item in shown["findings"]] == ["CONFIRMED"], shown
    world.lenses(review_reply("PASS"))  # the delta's lens finds nothing; it writes no attack


def delta_round(world: DeltaWorld, number: int = 3) -> subprocess.CompletedProcess[str]:
    """A fix-only delta review, round `number` (the owner's Q-R1)."""
    return world.run(str(PR), "--round", str(number), "--exception", "delta-review", "--reason", REASON)


def summary_of(done: subprocess.CompletedProcess[str]) -> dict[str, Any]:
    """The one JSON object `review run` prints on stdout."""
    lines = [line for line in done.stdout.splitlines() if line.strip()]
    assert lines, f"review printed no summary: {why(done)}"
    shown: dict[str, Any] = json.loads(lines[-1])
    return shown


def on(shown: dict[str, Any], file: str) -> list[dict[str, Any]]:
    """The summary's findings on `file`."""
    return [item for item in shown["findings"] if item["file"] == file]


def refuter_says(verdict: str, file: str = BADGE, summary: str = ROUND_ONE_SUMMARY) -> dict[str, Any]:
    """The batched refuter's answer: `verdict` on the claim at `file`, line 1 (matched by file and
    line, never by an id the code chooses)."""
    return {
        "findings": [
            {
                "file": file,
                "line": 1,
                "score": 80,
                "summary": summary,
                "verdict": verdict,
                "evidence": f"the fixture refuter answers {verdict}",
            }
        ]
    }


def refuter_calls(world: DeltaWorld, since: int) -> list[dict[str, Any]]:
    """The refuter's `claude` calls after the first `since` calls."""
    return [call for call in world.claude_calls()[since:] if call["agent"] == "refuter"]
