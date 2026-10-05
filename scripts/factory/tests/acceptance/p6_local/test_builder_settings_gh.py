"""Ticket T-LOCAL, section 3 B: a local builder cannot write GitHub (spec 3.7: local builders never
write GitHub). `scripts/factory/builder.settings.json` is passed to every local builder; its
`permissions.deny` must match every `gh` write verb, keep every read open, and keep the settings
ticket's (PR #346) `mcp__chrome-devtools__resize_page` rule and B1-B3 of `test_settings_files.py`.

`matches()` is copied from `test_settings_files.py` (never imported across test modules): a
`Bash(<pattern>)` rule matches a command by `fnmatch`, with or without its trailing ` *`.
"""

from __future__ import annotations

import json
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[5]
BUILDER = REPO / "scripts" / "factory" / "builder.settings.json"

WRITES = [
    "gh pr close 5",
    "gh pr ready 5",
    "gh pr reopen 5",
    "gh pr update-branch 5",
    "gh pr lock 5",
    "gh pr unlock 5",
    "gh issue close 5",
    "gh issue reopen 5",
    "gh issue delete 5",
    "gh issue lock 5",
    "gh issue unlock 5",
    "gh issue pin 5",
    "gh issue unpin 5",
    "gh issue transfer 5 x/y",
    "gh workflow run ci.yml",
    "gh workflow enable ci.yml",
    "gh workflow disable ci.yml",
    "gh run rerun 9",
    "gh run cancel 9",
    "gh run delete 9",
    "gh label create x",
    "gh label edit x",
    "gh label delete x",
    "gh release create v1",
    "gh release delete v1",
    "gh repo edit",
    "gh repo delete x",
    "gh repo create x",
    "gh repo rename y",
    "gh repo archive x",
    "gh secret set X",
    "gh variable set X",
    "gh cache delete 1",
    # The originals (WRITE_DENIES of test_settings_files.py), as commands.
    "git push origin HEAD",
    "gh api repos/o/r/pulls",
    "gh pr create --fill",
    "gh pr edit 5",
    "gh pr comment 5",
    "gh pr review 5",
    "gh pr merge 5",
    "gh issue create",
    "gh issue edit 5",
    "gh issue comment 5",
]
READS = [
    "gh pr view 5",
    "gh pr list",
    "gh pr checks 5",
    "gh pr diff 5",
    "gh pr checkout 5",
    "gh issue view 5",
    "gh issue list",
    "gh run view 9",
    "gh run list",
    "gh run watch 9",
    "gh workflow list",
    "gh workflow view ci.yml",
    "gh label list",
    "gh release list",
    "gh repo view",
    "gh repo clone x/y",
    "gh ruleset list",
    "gh ruleset check",  # a read: gh has no ruleset write verb
]
PLUGINS = {"vextrus-factory@inline": False, "cc-plugin-you-should-know@builtin": False}


def load(path: Path) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads(path.read_text())
    return loaded


def matches(rule: str, command: str) -> bool:
    """Whether a `Bash(<pattern>)` permission rule matches a command (`*` matches anything)."""
    if not (rule.startswith("Bash(") and rule.endswith(")")):
        return False
    pattern = rule[len("Bash(") : -1]
    return fnmatchcase(command, pattern) or fnmatchcase(command, pattern.removesuffix(" *"))


def deny() -> list[str]:
    rules: list[str] = load(BUILDER)["permissions"]["deny"]
    return rules


# B1
@pytest.mark.parametrize("command", WRITES)
def test_b1_every_github_write_verb_matches_a_deny_rule(command: str) -> None:
    assert any(matches(rule, command) for rule in deny()), f"no deny rule matches {command!r}"


# B2
@pytest.mark.parametrize("command", READS)
def test_b2_github_reads_match_no_deny_rule(command: str) -> None:
    hits = [rule for rule in deny() if matches(rule, command)]
    assert hits == [], f"{command!r} is denied by {hits}"


# B3
def test_b3_the_settings_tickets_rule_and_the_shape_survive() -> None:
    settings = load(BUILDER)
    assert "mcp__chrome-devtools__resize_page" in settings["permissions"]["deny"]
    assert settings["enabledPlugins"] == PLUGINS
    for key in ("hooks", "statusLine", "permissionMode"):
        assert key not in settings, key
    assert "defaultMode" not in settings["permissions"]
