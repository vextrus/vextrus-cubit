"""Acceptance tests for ticket T-MOD (session 12 phase 6), section 3 A: the mod runtime's files are
git-ignored, and nothing the mod ships is.

Written by the acceptance-writer before the build; the builder never changes this file. On load the
Claude Code mod runtime writes `tsconfig.json` at the mod's root and `.claude-plugin/types/`; neither
may dirty the checkout. `git check-ignore --no-index` asks the ignore rules alone (a tracked path is
judged by its patterns too), and works on paths that do not exist, as in CI.

    uv run pytest -rf tools/mod/vextrus-factory/tests/acceptance/test_p6_mod_runtime_files.py
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
MOD = "tools/mod/vextrus-factory"
RUNTIME_TYPES = f"{MOD}/.claude-plugin/types/"
SHIPPED = [
    f"{MOD}/types/index.d.ts",
    f"{MOD}/.claude-plugin/plugin.json",
    f"{MOD}/hooks/hooks.json",
    f"{MOD}/hooks/register.js",
    f"{MOD}/hooks/text.js",
    f"{MOD}/tests/robust.test.ts",
]


def _ignored(path: str) -> bool:
    """True when the repository's ignore rules ignore `path` (exit 0), False when not (exit 1)."""
    done = subprocess.run(
        ["git", "-C", str(ROOT), "check-ignore", "-q", "--no-index", path],
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode in (0, 1), f"git check-ignore {path}: {done.returncode} {done.stderr}"
    return done.returncode == 0


def test_a1_the_runtime_tsconfig_at_the_mod_root_is_ignored() -> None:
    assert _ignored(f"{MOD}/tsconfig.json"), f"{MOD}/tsconfig.json is git-ignored"


def test_a2_the_runtime_types_folder_stays_ignored() -> None:
    for path in (f"{RUNTIME_TYPES}tsconfig.json", f"{RUNTIME_TYPES}claude-code/index.d.ts"):
        assert _ignored(path), f"{path} is git-ignored"


def test_a3_nothing_the_mod_ships_is_ignored() -> None:
    wrongly = [path for path in SHIPPED if _ignored(path)]
    assert wrongly == [], f"the ignore rules are over-broad, they ignore: {wrongly}"


def test_a3_no_runtime_file_is_tracked() -> None:
    done = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "-z", "--", MOD],
        capture_output=True,
        text=True,
        check=True,
    )
    tracked = [name for name in done.stdout.split("\0") if name]
    assert f"{MOD}/hooks/register.js" in tracked, "git ls-files lists the mod"
    runtime = [
        name for name in tracked if name == f"{MOD}/tsconfig.json" or name.startswith(RUNTIME_TYPES)
    ]
    assert runtime == [], f"runtime files are tracked: {runtime}"
