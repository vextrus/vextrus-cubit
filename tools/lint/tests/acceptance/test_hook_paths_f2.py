"""Ticket f2, C1: the guard's registration is pinned (spec 3.5: "`tools/lint/hook_paths.py` asserts the
PreToolUse entry equals the expected literal (matcher `Bash|Edit|Write|NotebookEdit`, command,
timeout), the deny list holds every secret rule, and every hook command file exists"; spec 3.7 rows
1-2 for the rules).

`python -m tools.lint.hook_paths --settings <file> --root <dir>`: exit 0 when all holds, else exit 1
with one line per problem. Today the module does not exist.
"""

import copy
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[4]

GUARD_COMMAND = 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard.mjs'
EXISTING_DENY = [
    "Read(//home/riz/vextrus-cad/**)",
    "Edit(//home/riz/vextrus-cad/**)",
    "Read(//home/vxkeys/**)",
]
SECRET_FILES = [
    "~/.pgpass",
    "~/.bashrc",
    "~/.bash_profile",
    "~/.profile",
    "~/.zshrc",
    "~/.claude/.credentials.json",
    "~/.config/gh/**",
]
SECRET_DENY = [f"Read({path})" for path in SECRET_FILES] + [f"Edit({path})" for path in SECRET_FILES]
RECORD_DENY = [
    "Edit(//home/riz/vextrus-cubit/.private/work/leakscan/ok/**)",
    "Edit(//home/riz/vextrus-cubit/.private/work/factory/ledger/**)",
]
NEW_DENY = SECRET_DENY + RECORD_DENY
assert len(SECRET_DENY) == 14
assert len(NEW_DENY) == 16

GOOD: dict[str, Any] = {
    "permissions": {
        "allow": ["Bash(sync)", "Bash(git push:*)"],
        "deny": EXISTING_DENY + NEW_DENY,
    },
    "hooks": {
        "SessionStart": [
            {
                "matcher": "startup|resume|clear|compact",
                "hooks": [
                    {
                        "type": "command",
                        "command": 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/state.mjs',
                        "timeout": 20,
                    }
                ],
            }
        ],
        "PreToolUse": [
            {
                "matcher": "Bash|Edit|Write|NotebookEdit",
                "hooks": [{"type": "command", "command": GUARD_COMMAND, "timeout": 10}],
            }
        ],
        "PostToolUse": [
            {
                "matcher": "Bash",
                "hooks": [
                    {
                        "type": "command",
                        "command": 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/after-bash.mjs',
                        "timeout": 40,
                    }
                ],
            }
        ],
    },
}
HOOK_FILES = [".claude/hooks/guard.mjs", ".claude/hooks/state.mjs", ".claude/hooks/after-bash.mjs"]


def _root(tmp_path: Path, missing: str | None = None) -> Path:
    root = tmp_path / "root"
    for name in HOOK_FILES:
        if name != missing:
            (root / name).parent.mkdir(parents=True, exist_ok=True)
            (root / name).write_text("// a stand-in\n")
    root.mkdir(exist_ok=True)
    return root


def _lint(tmp_path: Path, settings: dict[str, Any], root: Path) -> subprocess.CompletedProcess[str]:
    file = tmp_path / "settings.json"
    file.write_text(json.dumps(settings, indent=2))
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.hook_paths", "--settings", str(file), "--root", str(root)],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )


def _pre_tool_use(settings: dict[str, Any]) -> dict[str, Any]:
    entry: dict[str, Any] = settings["hooks"]["PreToolUse"][0]
    return entry


def test_the_expected_settings_pass(tmp_path: Path) -> None:
    done = _lint(tmp_path, GOOD, _root(tmp_path))
    assert done.returncode == 0, done.stdout + done.stderr


def test_the_repos_own_settings_pass() -> None:
    done = subprocess.run(
        [sys.executable, "-m", "tools.lint.hook_paths"],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stdout + done.stderr


def _assert_refused(done: subprocess.CompletedProcess[str], *names: str) -> None:
    # The lint runs at all: the expected settings on a complete root pass (else a missing
    # module would "refuse" too).
    tmp = Path(done.args[done.args.index("--settings") + 1]).parent / "baseline"
    tmp.mkdir(exist_ok=True)
    baseline = _lint(tmp, GOOD, _root(tmp))
    assert baseline.returncode == 0, baseline.stdout + baseline.stderr
    assert done.returncode == 1, done.stdout + done.stderr
    output = done.stdout + done.stderr
    assert output.strip(), "a refusal names its problem"
    for name in names:
        assert name in output


def test_a_changed_matcher_is_refused(tmp_path: Path) -> None:
    settings = copy.deepcopy(GOOD)
    _pre_tool_use(settings)["matcher"] = "Bash"
    _assert_refused(_lint(tmp_path, settings, _root(tmp_path)))


def test_a_mistyped_command_is_refused(tmp_path: Path) -> None:
    settings = copy.deepcopy(GOOD)
    _pre_tool_use(settings)["hooks"][0]["command"] = (
        'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/guards.mjs'
    )
    _assert_refused(_lint(tmp_path, settings, _root(tmp_path)))


def test_a_changed_timeout_is_refused(tmp_path: Path) -> None:
    settings = copy.deepcopy(GOOD)
    _pre_tool_use(settings)["hooks"][0]["timeout"] = 60
    _assert_refused(_lint(tmp_path, settings, _root(tmp_path)))


def test_a_second_pre_tool_use_entry_is_refused(tmp_path: Path) -> None:
    settings = copy.deepcopy(GOOD)
    settings["hooks"]["PreToolUse"].append(
        {"matcher": "Bash", "hooks": [{"type": "command", "command": GUARD_COMMAND, "timeout": 10}]}
    )
    _assert_refused(_lint(tmp_path, settings, _root(tmp_path)))


@pytest.mark.parametrize("rule", NEW_DENY)
def test_each_new_deny_rule_removed_is_refused_by_name(tmp_path: Path, rule: str) -> None:
    settings = copy.deepcopy(GOOD)
    settings["permissions"]["deny"].remove(rule)
    _assert_refused(_lint(tmp_path, settings, _root(tmp_path)), rule)


@pytest.mark.parametrize("missing", HOOK_FILES)
def test_a_missing_hook_command_file_is_refused_by_name(tmp_path: Path, missing: str) -> None:
    _assert_refused(_lint(tmp_path, GOOD, _root(tmp_path, missing=missing)), missing)


def test_an_allow_rule_reading_a_secret_is_refused(tmp_path: Path) -> None:
    settings = copy.deepcopy(GOOD)
    settings["permissions"]["allow"].append("Read(~/.pgpass)")
    _assert_refused(_lint(tmp_path, settings, _root(tmp_path)), "Read(~/.pgpass)")


def test_other_events_hooks_are_accepted_when_their_files_exist(tmp_path: Path) -> None:
    settings = copy.deepcopy(GOOD)
    settings["hooks"]["UserPromptSubmit"] = [
        {
            "hooks": [
                {
                    "type": "command",
                    "command": 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/clock.mjs',
                    "timeout": 5,
                }
            ]
        }
    ]
    root = _root(tmp_path)
    (root / ".claude/hooks/clock.mjs").write_text("// a stand-in\n")
    assert _lint(tmp_path, settings, root).returncode == 0
    (root / ".claude/hooks/clock.mjs").unlink()
    _assert_refused(_lint(tmp_path, settings, root), ".claude/hooks/clock.mjs")
