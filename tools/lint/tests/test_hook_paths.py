"""The guard's and the shift-left checks' registration and the deny rules, pinned against the
repository's own settings (3.5).

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


def test_the_pinned_guard_entry_comes_first_then_the_shift_left_checks() -> None:
    hooks = _settings()["hooks"]
    assert isinstance(hooks, dict)
    assert hooks["PreToolUse"] == [hook_paths.GUARD_ENTRY, hook_paths.SHIFT_LEFT_ENTRY]


def test_the_guard_alone_is_no_problem() -> None:
    settings = _settings()
    hooks = settings["hooks"]
    assert isinstance(hooks, dict)
    hooks["PreToolUse"] = [hook_paths.GUARD_ENTRY]
    assert hook_paths.problems(settings, ROOT) == []


def test_a_second_entry_other_than_the_shift_left_checks_is_a_problem() -> None:
    settings = _settings()
    hooks = settings["hooks"]
    assert isinstance(hooks, dict)
    shift_left = hook_paths.SHIFT_LEFT_ENTRY
    for second in (
        {**shift_left, "matcher": "Bash|Edit"},
        {**shift_left, "hooks": [{**shift_left["hooks"][0], "timeout": 5}]},
        hook_paths.GUARD_ENTRY,
    ):
        hooks["PreToolUse"] = [hook_paths.GUARD_ENTRY, second]
        assert any(line.startswith("PreToolUse:") for line in hook_paths.problems(settings, ROOT))


def test_the_shift_left_checks_before_the_guard_or_a_third_entry_is_a_problem() -> None:
    settings = _settings()
    hooks = settings["hooks"]
    assert isinstance(hooks, dict)
    guard, shift_left = hook_paths.GUARD_ENTRY, hook_paths.SHIFT_LEFT_ENTRY
    for entries in ([shift_left, guard], [guard, shift_left, shift_left], [shift_left]):
        hooks["PreToolUse"] = entries
        assert any(line.startswith("PreToolUse:") for line in hook_paths.problems(settings, ROOT))


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
