"""Ticket f3, 3.6: the two `--settings` files, spec 3.5 (the Status line row) and 3.7 (local builders'
pushes and plugins).

`scripts/factory/builder.settings.json` is passed to every local builder (`claude --bg ... --settings
<abs>`): it denies pushes and GitHub writes, keeps reads, and turns the orchestrator-only plugins off.
`scripts/factory/orchestrator.settings.json` is passed by `orchestrator.sh` and holds only the status
line (f8's `statusline.mjs`, by absolute path, refreshed every 15 s).
"""

from __future__ import annotations

import json
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
BUILDER = REPO / "scripts" / "factory" / "builder.settings.json"
ORCHESTRATOR = REPO / "scripts" / "factory" / "orchestrator.settings.json"

WRITE_DENIES = [
    "Bash(git push *)",
    "Bash(gh api *)",
    *(f"Bash(gh pr {verb} *)" for verb in ("create", "edit", "comment", "review", "merge")),
    *(f"Bash(gh issue {verb} *)" for verb in ("create", "edit", "comment")),
]
READS = [
    "gh pr view 250",
    "gh pr list",
    "gh pr checks 250",
    "gh issue view 12",
    "gh issue list",
    "git fetch origin",
    "git log -1",
]


def load(path: Path) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads(path.read_text())
    return loaded


def matches(rule: str, command: str) -> bool:
    """Whether a `Bash(<pattern>)` permission rule matches a command (`*` matches anything)."""
    if not (rule.startswith("Bash(") and rule.endswith(")")):
        return False
    pattern = rule[len("Bash(") : -1]
    return fnmatchcase(command, pattern) or fnmatchcase(command, pattern.removesuffix(" *"))


# B1
def test_b1_the_builder_settings_deny_pushes_and_every_github_write_verb() -> None:
    deny = load(BUILDER)["permissions"]["deny"]
    for rule in WRITE_DENIES:
        assert rule in deny, f"{rule} is not denied"


# B2
def test_b2_the_builder_settings_keep_reads_and_add_no_hooks_status_line_or_mode() -> None:
    settings = load(BUILDER)
    permissions = settings["permissions"]
    for command in READS:
        assert not any(matches(rule, command) for rule in permissions["deny"]), (
            f"a deny matches {command!r}"
        )
    for rule in permissions.get("allow", []):
        assert "push" not in rule
        assert "merge" not in rule
    for key in ("hooks", "statusLine", "permissionMode"):
        assert key not in settings
    assert "defaultMode" not in permissions


# B3
def test_b3_the_builder_settings_turn_the_orchestrators_plugins_off() -> None:
    plugins = load(BUILDER)["enabledPlugins"]
    assert plugins["vextrus-factory@inline"] is False
    assert plugins["cc-plugin-you-should-know@builtin"] is False


# B4
def test_b4_the_orchestrator_settings_hold_only_the_status_line() -> None:
    settings = load(ORCHESTRATOR)
    assert list(settings) == ["statusLine"]
    line = settings["statusLine"]
    assert line["type"] == "command"
    assert line["refreshInterval"] == 15
    words = [word.strip("'\"") for word in line["command"].split()]
    paths = [word for word in words if word.endswith("scripts/factory/statusline.mjs")]
    assert paths, line["command"]
    assert all(path.startswith("/") for path in paths), (
        "the status line script is not named by an absolute path"
    )
