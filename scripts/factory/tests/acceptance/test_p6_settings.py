"""Ticket T-SETTINGS, A (session 12 phase 6): the shared browser's `resize_page` is denied, and the
StopFailure hook is registered. docs/specs/factory.md 3.7 (permissions), 3.5 (hooks), 3.13 (the
shared-browser debt).

`CLAUDE.md`: parallel agents share one chrome-devtools browser and emulate per page only; a
`resize_page` call resizes the shared window. The guard never sees an MCP call (its matcher is
`Bash|Edit|Write|NotebookEdit`), so the only route is `permissions.deny`, in the bare form
`mcp__chrome-devtools__resize_page` (a rule with parentheses on an `mcp__` name is skipped at load).
A deny wins over the server-wide allow `mcp__chrome-devtools`, which still serves every other tool.
"""

from __future__ import annotations

import json
import re
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any

import pytest

from tools.lint.hook_paths import GUARD_ENTRY, REQUIRED_DENY

REPO = Path(__file__).resolve().parents[4]
MAIN = REPO / ".claude" / "settings.json"
BUILDER = REPO / "scripts" / "factory" / "builder.settings.json"
FILES = [pytest.param(MAIN, id="settings.json"), pytest.param(BUILDER, id="builder.settings.json")]

SERVER = "mcp__chrome-devtools"
RESIZE = "mcp__chrome-devtools__resize_page"
KEPT_TOOLS = (
    "mcp__chrome-devtools__emulate",
    "mcp__chrome-devtools__navigate_page",
    "mcp__chrome-devtools__take_snapshot",
)
MCP_RULE = re.compile(r"^mcp__[a-z0-9-]+(__[a-z0-9_]+)?$")
STOP_FAILURE_COMMAND = 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/stop-failure.mjs'


def load(path: Path) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads(path.read_text())
    return loaded


def rules(path: Path, kind: str) -> list[str]:
    found: list[str] = load(path).get("permissions", {}).get(kind, [])
    return found


def denies(rule: str, tool: str) -> bool:
    """Whether a deny rule would catch an MCP tool: the tool itself, its server, or a wildcard."""
    if rule == tool or tool.startswith(rule + "__"):
        return True
    return any(mark in rule for mark in "*?[") and fnmatchcase(tool, rule)


# A.1
@pytest.mark.parametrize("path", FILES)
def test_a1_resize_page_is_denied(path: Path) -> None:
    assert RESIZE in rules(path, "deny"), f"{path.name}: {RESIZE} is not in permissions.deny"


# A.2
@pytest.mark.parametrize("path", FILES)
def test_a2_no_deny_rule_touches_another_browser_tool(path: Path) -> None:
    for rule in rules(path, "deny"):
        assert rule not in (SERVER, "mcp__chrome-devtools__emulate", "mcp__*"), (
            f"{path.name}: deny {rule!r} over-denies the browser"
        )
        assert not rule.endswith("__*"), f"{path.name}: deny {rule!r} is a server-wide wildcard"
        for tool in KEPT_TOOLS:
            assert not denies(rule, tool), f"{path.name}: deny {rule!r} catches {tool}"


# A.3
@pytest.mark.parametrize("path", FILES)
def test_a3_every_mcp_rule_is_the_bare_form_the_cli_loads(path: Path) -> None:
    for kind in ("allow", "deny"):
        for rule in rules(path, kind):
            if rule.startswith("mcp__"):
                assert MCP_RULE.match(rule), (
                    f"{path.name}: {kind} {rule!r} is not a bare mcp__ name; the CLI skips it"
                )
    written = [rule for rule in rules(path, "deny") if "resize_page" in rule]
    assert written == [RESIZE], f"{path.name}: the resize_page deny is written {written!r}"
    assert MCP_RULE.match(RESIZE)


def test_a3_the_server_wide_allow_the_deny_carves_out_of_stays() -> None:
    assert SERVER in rules(MAIN, "allow")


# A.4
def test_a4_stop_failure_is_registered_once_for_every_error_type() -> None:
    hooks = load(MAIN)["hooks"]
    assert "StopFailure" in hooks, ".claude/settings.json registers no StopFailure hook"
    groups = hooks["StopFailure"]
    assert isinstance(groups, list), groups
    assert len(groups) == 1, groups
    group = groups[0]
    assert group.get("matcher", "") in ("", "*"), f"matcher {group.get('matcher')!r} drops error types"
    assert len(group["hooks"]) == 1, group["hooks"]
    hook = group["hooks"][0]
    assert set(hook) == {"type", "command", "timeout"}, hook
    assert hook["type"] == "command"
    assert hook["command"] == STOP_FAILURE_COMMAND
    timeout = hook["timeout"]
    assert type(timeout) is int, timeout
    assert 1 <= timeout <= 10, timeout


# A.5
def test_a5_the_guard_entry_and_every_required_deny_are_intact() -> None:
    settings = load(MAIN)
    assert settings["hooks"]["PreToolUse"] == [GUARD_ENTRY]
    deny = settings["permissions"]["deny"]
    missing = [rule for rule in REQUIRED_DENY if rule not in deny]
    assert not missing, f"required denies missing: {missing}"
