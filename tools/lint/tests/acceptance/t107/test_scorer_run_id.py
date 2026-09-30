"""Ticket 107 (issue #107, finding 2): the scorer's password-free rule takes one run id, never an option.

A run id is a letter or digit, then letters, digits and hyphens (`^[0-9A-Za-z][0-9A-Za-z-]*$`, the
issue's fix). Pinned in both places the pattern is enforced: the guard (`.claude/hooks/guard.mjs`, in the
orchestrator's session, the main checkout) and the sudoers rule `scripts/owner/autonomy-setup.sh`
installs (the owner re-runs that script for the installed rule to change).
"""

import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
GUARD = REPO / ".claude/hooks/guard.mjs"
SETUP = REPO / "scripts/owner/autonomy-setup.sh"
MAIN = "/home/riz/vextrus-cubit"
SCORER = "sudo -n -u vxkeys /usr/local/bin/vx-score"

RUN_IDS = ["20260929T101500Z-0123456789ab-beef", "run-1", "a", "7"]
NOT_RUN_IDS = ["--help", "--key", "-x", "-", "-1", "--", "-run-1"]
EXTRA_ARGUMENTS = ["--key x", "run-1 --key", "run-1 run-2", "run-1 -x", "--help run-1"]


def guard_refuses(command: str) -> str | None:
    """The rule the guard refuses `command` by in the orchestrator's session, or None."""
    node = shutil.which("node")
    assert node, "node is needed to run the guard"
    done = subprocess.run(
        [node, str(GUARD)],
        input=json.dumps({"tool_name": "Bash", "tool_input": {"command": command}}),
        capture_output=True,
        text=True,
        env={**os.environ, "CLAUDE_PROJECT_DIR": MAIN},
        check=False,
    )
    assert done.returncode == 0, done.stderr
    if not done.stdout.strip():
        return None
    reason: str = json.loads(done.stdout)["hookSpecificOutput"]["permissionDecisionReason"]
    return reason.split(":")[0]


@pytest.mark.parametrize("run_id", RUN_IDS)
def test_the_guard_lets_the_scorer_run_on_a_run_id(run_id: str) -> None:
    assert guard_refuses(f"{SCORER} {run_id}") is None


@pytest.mark.parametrize("argument", NOT_RUN_IDS)
def test_the_guard_refuses_the_scorer_on_an_argument_beginning_with_a_hyphen(argument: str) -> None:
    assert guard_refuses(f"{SCORER} {argument}") == "PRIVILEGE_RAISED"


@pytest.mark.parametrize("arguments", EXTRA_ARGUMENTS)
def test_the_guard_refuses_the_scorer_with_more_than_one_argument(arguments: str) -> None:
    assert guard_refuses(f"{SCORER} {arguments}") == "PRIVILEGE_RAISED"


def sudoers_scorer_pattern() -> re.Pattern[str]:
    """The regular expression the installed sudoers rule matches the scorer's arguments against."""
    rules = [
        line
        for line in SETUP.read_text().splitlines()
        if "NOPASSWD:" in line and not line.lstrip().startswith("#")
    ]
    assert len(rules) == 1, rules
    found = re.search(r"\$SCORER\s+(\^\S*)$", rules[0])
    assert found, f"the scorer's rule carries no anchored argument pattern: {rules[0]}"
    return re.compile(found[1].replace("\\$", "$"))


@pytest.mark.parametrize("run_id", RUN_IDS)
def test_the_sudoers_rule_matches_a_run_id(run_id: str) -> None:
    assert sudoers_scorer_pattern().search(run_id)


@pytest.mark.parametrize("arguments", NOT_RUN_IDS + EXTRA_ARGUMENTS)
def test_the_sudoers_rule_refuses_an_option_or_extra_arguments(arguments: str) -> None:
    # sudo matches the rule's pattern against the command's arguments joined by single spaces.
    assert not sudoers_scorer_pattern().search(arguments)
