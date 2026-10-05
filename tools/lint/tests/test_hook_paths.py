"""The guard's registration and the deny rules, pinned against the repository's own settings (3.5).

f6 owns the settings' `hooks` block: its PR runs this test, so a changed guard entry or a missing deny
rule fails CI. The acceptance test (tests/acceptance/test_hook_paths_f2.py) holds every refusal on
fixtures.
"""

import json
from pathlib import Path

from tools.lint import hook_paths

ROOT = Path(__file__).resolve().parents[3]


def _settings() -> dict[str, object]:
    settings: dict[str, object] = json.loads((ROOT / ".claude/settings.json").read_text())
    return settings


def test_the_repos_settings_have_no_problem() -> None:
    assert hook_paths.problems(_settings(), ROOT) == []


def test_the_pinned_guard_entry_is_registered_once() -> None:
    hooks = _settings()["hooks"]
    assert isinstance(hooks, dict)
    assert hooks["PreToolUse"] == [hook_paths.GUARD_ENTRY]


def test_a_matcher_without_the_file_tools_is_a_problem() -> None:
    settings = _settings()
    hooks = settings["hooks"]
    assert isinstance(hooks, dict)
    hooks["PreToolUse"] = [{**hook_paths.GUARD_ENTRY, "matcher": "Bash"}]
    assert any(line.startswith("PreToolUse:") for line in hook_paths.problems(settings, ROOT))


def test_every_required_deny_rule_is_present() -> None:
    permissions = _settings()["permissions"]
    assert isinstance(permissions, dict)
    assert set(hook_paths.REQUIRED_DENY) <= set(permissions["deny"])
    assert len(hook_paths.SECRET_DENY) == 14
