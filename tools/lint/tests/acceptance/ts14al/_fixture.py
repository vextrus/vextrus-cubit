"""Fixture repositories for S14-AL's acceptance tests (no network, no real drawing).

Each is a temporary git repository: `main` holds a tiny package `fixturepkg` (two layers, `high` above
`low`, in its own `.importlinter`), its own `pyproject.toml` (pytest and strict mypy) and, when a test
asks, a ruling register `docs/rulings.md`. Each ticket is a branch from `main` with one `acceptance:`
commit adding `fixturepkg/low/tests/acceptance/<folder>/test_storeys.py`, the module under test
(`fixturepkg.low.storeys`) not built.

The declarations the lint reads (this ticket's seam, chosen by its acceptance-writer; the plan and
#458 name no form), each on its own line anywhere in an `acceptance:` commit's message, like the counts
(`docs/specs/factory/contracts/trailers.md` 3):

- `red-for: <path> <reason>`: the stated reason. `<path>` is an acceptance file as in the commit;
  every test of that file red on the base must fail with a line containing `<reason>` (one line may be
  given per reason). An acceptance file with no `red-for:` line has no stated reason.
- `pin: <key> = <value>`: a value the tests pin. Two open tickets pinning one key to different values
  contradict each other.

The ruling register is `docs/rulings.md` as it is at the base: a line `ruling: <key> = <value>`
records an owner ruling (any other text around it is free). A pin of the key to another value
contradicts it.

The lint is run as `python -m tools.lint.acceptance_lint <base> <branch>...` in the repository: exit 0
clean, 1 with each problem printed.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
MODULE = "tools.lint.acceptance_lint"

BASE_FILES = {
    "pyproject.toml": '[tool.pytest.ini_options]\npythonpath = ["."]\n\n[tool.mypy]\nstrict = true\n',
    ".importlinter": (
        "[importlinter]\nroot_packages =\n    fixturepkg\n\n"
        "[importlinter:contract:layers]\nname = high above low\ntype = layers\n"
        "layers =\n    fixturepkg.high\n    fixturepkg.low\n"
    ),
    "fixturepkg/__init__.py": "",
    "fixturepkg/high/__init__.py": "",
    "fixturepkg/high/api.py": "def plan() -> int:\n    return 1\n",
    "fixturepkg/low/__init__.py": "",
    "fixturepkg/low/units.py": "def one() -> int:\n    return 1\n",
    "fixturepkg/low/tests/__init__.py": "",
    "fixturepkg/low/tests/acceptance/__init__.py": "",
}

MISSING = "ModuleNotFoundError: No module named 'fixturepkg.low.storeys'"

# The well-formed test, its import of the module under test at the top: red on main at collection.
TOP_IMPORT = '''"""A fixture ticket: the storey count."""

from fixturepkg.low.storeys import count_storeys  # type: ignore[import-not-found, unused-ignore]
from fixturepkg.low.units import one


def test_counts_three_storeys() -> None:
    assert count_storeys(3) == 3 * one()
'''

# The well-formed test, the module under test imported inside the test: red on main when it runs.
INNER_IMPORT = '''"""A fixture ticket: the storey count."""

from pathlib import Path

from fixturepkg.low.units import one


def test_counts_three_storeys(tmp_path: Path) -> None:
    assert tmp_path.is_dir()
    from fixturepkg.low.storeys import count_storeys  # type: ignore[import-not-found, unused-ignore]

    assert count_storeys(3) == 3 * one()
'''


def changed(text: str, old: str, new: str) -> str:
    """`text` with `old` replaced by `new`, which must change it."""
    assert old in text, old
    return text.replace(old, new, 1)


def git(root: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def make_repo(tmp_path: Path, rulings: str | None = None) -> Path:
    """A repository whose `main` holds the fixture package (and the ruling register, if given)."""
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    files = dict(BASE_FILES)
    if rulings is not None:
        files["docs/rulings.md"] = rulings
    write(root, files)
    git(root, "commit", "-q", "-m", "the fixture package")
    return root


def write(root: Path, files: dict[str, str]) -> None:
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        git(root, "add", "--", name)


def file_of(folder: str) -> str:
    return f"fixturepkg/low/tests/acceptance/{folder}/test_storeys.py"


def ticket(
    root: Path,
    branch: str,
    folder: str,
    *,
    test: str = TOP_IMPORT,
    reasons: tuple[str, ...] = (MISSING,),
    pins: tuple[str, ...] = ("storeys.count = 3",),
) -> None:
    """A ticket's branch from `main` with one `acceptance:` commit; `main` checked out after."""
    git(root, "checkout", "-q", "-b", branch, "main")
    path = file_of(folder)
    write(root, {f"fixturepkg/low/tests/acceptance/{folder}/__init__.py": "", path: test})
    lines = [f"red-for: {path} {reason}" for reason in reasons] + [f"pin: {pin}" for pin in pins]
    message = (
        f"acceptance: {branch} pins the storey count\n\n"
        + "".join(f"{line}\n" for line in lines)
        + "\nred-on-main: 1 failed\ngreen-on-throwaway: 1 passed\n"
    )
    (root.parent / f"message-{branch}.txt").write_text(message)
    git(root, "commit", "-q", "-F", str(root.parent / f"message-{branch}.txt"))
    git(root, "checkout", "-q", "main")


def lint(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    """The lint, run in the fixture repository with this checkout's interpreter and tools."""
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("PYTEST_") and key not in {"DJANGO_SETTINGS_MODULE", "PYTHONPATH"}
    }
    env["PYTHONPATH"] = str(REPO)
    return subprocess.run(
        [sys.executable, "-m", MODULE, *args],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def said(done: subprocess.CompletedProcess[str]) -> str:
    return done.stdout + done.stderr
