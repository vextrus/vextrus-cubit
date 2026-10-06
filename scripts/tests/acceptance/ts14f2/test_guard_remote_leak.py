"""S14-F2 (issue #397): "guard.test.mjs's 'merging passes' case fails when the suite runs inside a
cloud session: CLAUDE_CODE_REMOTE=true leaks from the session's environment into the guard under
test ... The test should clear CLAUDE_CODE_REMOTE (or set it explicitly) for every case that is not
about the cloud." Pinned by behaviour: `node --test .claude/hooks/guard.test.mjs` gives the same
outcome with `CLAUDE_CODE_REMOTE=true` in its environment as without it, and both pass.
"""

import os
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
GUARD_TEST = ".claude/hooks/guard.test.mjs"


def run_guard_test(remote: str | None) -> tuple[int, str, str]:
    env = {key: value for key, value in os.environ.items() if key != "CLAUDE_CODE_REMOTE"}
    if remote is not None:
        env["CLAUDE_CODE_REMOTE"] = remote
    done = subprocess.run(
        ["node", "--test", GUARD_TEST],
        cwd=REPO, env=env, capture_output=True, text=True, check=False, timeout=600,
    )  # fmt: skip
    output = done.stdout + done.stderr
    counts = " ".join(re.findall(r"^\S+ (?:tests|pass|fail) \d+$", output, re.M))
    return done.returncode, counts, output


def test_the_guard_test_passes_with_claude_code_remote_set_as_in_a_cloud_session() -> None:
    code, _counts, output = run_guard_test("true")
    assert code == 0, output[-3000:]


def test_the_guard_test_has_the_same_outcome_with_and_without_claude_code_remote() -> None:
    without = run_guard_test(None)
    with_remote = run_guard_test("true")
    assert without[1], without[2][-3000:]
    assert (with_remote[0], with_remote[1]) == (without[0], without[1]), with_remote[2][-3000:]
