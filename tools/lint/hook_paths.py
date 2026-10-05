"""The guard's registration is pinned (docs/specs/factory.md 3.5, 3.7; PR f2).

A missing or mistyped hook path silently disables a gate, so this lint asserts, of the settings:
- the PreToolUse event has exactly one entry, equal to the expected literal: matcher
  `Bash|Edit|Write|NotebookEdit`, one command hook `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard.mjs`,
  timeout 10;
- `permissions.deny` holds every secret-file rule (Read and Edit of seven files) and the two record rules
  (the leak stamps and the ledger), and the three earlier denies;
- no `permissions.allow` rule reads or edits a secret file;
- every hook command of every event names a file that exists under the root.

Run: `python -m tools.lint.hook_paths [--settings <file>] [--root <dir>]` (defaults: this repository's).
One line per problem; exit 1 when there is any. Standard library only.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
_UNREADABLE = (OSError, ValueError)
GUARD_ENTRY: dict[str, Any] = {
    "matcher": "Bash|Edit|Write|NotebookEdit",
    "hooks": [
        {
            "type": "command",
            "command": 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard.mjs',
            "timeout": 10,
        }
    ],
}
SECRET_FILES = (
    "~/.pgpass",
    "~/.bashrc",
    "~/.bash_profile",
    "~/.profile",
    "~/.zshrc",
    "~/.claude/.credentials.json",
    "~/.config/gh/**",
)
SECRET_DENY = tuple(f"Read({path})" for path in SECRET_FILES) + tuple(
    f"Edit({path})" for path in SECRET_FILES
)
RECORD_DENY = (
    "Edit(//home/riz/vextrus-cubit/.private/work/leakscan/ok/**)",
    "Edit(//home/riz/vextrus-cubit/.private/work/factory/ledger/**)",
)
EARLIER_DENY = (
    "Read(//home/riz/vextrus-cad/**)",
    "Edit(//home/riz/vextrus-cad/**)",
    "Read(//home/vxkeys/**)",
)
REQUIRED_DENY = EARLIER_DENY + SECRET_DENY + RECORD_DENY
_SECRET_NAMES = re.compile(
    r"\.pgpass|\.bashrc|\.bash_profile|\.profile|\.zshrc|\.credentials\.json|\.config/gh"
)
_PROJECT_PATH = re.compile(r'"?\$CLAUDE_PROJECT_DIR"?/?(\S+?\.(?:mjs|js|cjs|sh|py))\b')


def _hook_files(command: str) -> list[str]:
    """The repository files a hook command runs (paths after `$CLAUDE_PROJECT_DIR`)."""
    return [match.lstrip("/").strip('"') for match in _PROJECT_PATH.findall(command)]


def problems(settings: dict[str, Any], root: Path) -> list[str]:
    found: list[str] = []
    hooks = settings.get("hooks")
    if not isinstance(hooks, dict):
        return ["settings: no hooks block"]
    entries = hooks.get("PreToolUse")
    if not isinstance(entries, list) or len(entries) != 1:
        found.append(
            "PreToolUse: expected exactly one entry (the guard), "
            f"found {len(entries) if isinstance(entries, list) else 0}"
        )
    elif entries[0] != GUARD_ENTRY:
        found.append(
            "PreToolUse: the guard's entry differs from the expected literal "
            f"(matcher {GUARD_ENTRY['matcher']!r}, "
            f"command {GUARD_ENTRY['hooks'][0]['command']!r}, timeout 10)"
        )
    for event, groups in hooks.items():
        for group in groups if isinstance(groups, list) else []:
            for hook in group.get("hooks", []) if isinstance(group, dict) else []:
                command = hook.get("command", "") if isinstance(hook, dict) else ""
                for name in _hook_files(command if isinstance(command, str) else ""):
                    if not (root / name).is_file():
                        found.append(f"{event}: the hook file {name} does not exist")
    permissions = settings.get("permissions")
    permissions = permissions if isinstance(permissions, dict) else {}
    deny_value = permissions.get("deny")
    deny: list[Any] = deny_value if isinstance(deny_value, list) else []
    for rule in REQUIRED_DENY:
        if rule not in deny:
            found.append(f"permissions.deny: missing {rule}")
    allow_value = permissions.get("allow")
    allow: list[Any] = allow_value if isinstance(allow_value, list) else []
    for rule in allow:
        if isinstance(rule, str) and _SECRET_NAMES.search(rule):
            found.append(f"permissions.allow: {rule} reaches a secret file")
    return found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m tools.lint.hook_paths", description=__doc__.splitlines()[0]
    )
    parser.add_argument("--settings", type=Path, default=ROOT / ".claude/settings.json")
    parser.add_argument("--root", type=Path, default=ROOT)
    options = parser.parse_args(argv)
    try:
        settings = json.loads(options.settings.read_text(encoding="utf-8"))
    except _UNREADABLE:
        print(f"{options.settings}: cannot read the settings as JSON")
        return 1
    found = problems(settings if isinstance(settings, dict) else {}, options.root)
    for line in found:
        print(line)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
