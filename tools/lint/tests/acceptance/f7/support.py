"""Shared by f7's acceptance tests: the repository's root, a throwaway git repository, the lint's CLI.

The CLI pinned (ticket f7 §3): `python -m tools.lint.docs_paths [--root DIR]`, the default root the
repository's; exit 0 when clean, 1 with one line per problem on stdout:
`<repo-relative file>:<line>: <what>`.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]

# The five law lines (factory spec §3.1), in the spec's words.
LAWS = [
    "Account A runs the orchestrator and every builder.",
    "Builders start, and cloud builders are messaged, only through `scripts.factory.launch`.",
    "Time comes from `date -u`, never from memory.",
    "Never wait with `pgrep -f` or `ps | grep`; use Monitor on a log.",
    "No 'walk now' to the owner without a passing G1 verdict on main's current product code.",
]

QUOTES = re.compile("['\"\u2018\u2019\u201c\u201d]")


def normalise(text: str) -> str:
    """Quotes deleted (straight and curly) and whitespace collapsed, so a wrapped or re-quoted line
    still matches."""
    return " ".join(QUOTES.sub("", text).split())


def clean_env() -> dict[str, str]:
    """The environment without git's own variables: a hook's GIT_DIR cannot point the lint elsewhere."""
    return {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}


def make_repo(root: Path, files: dict[str, str]) -> Path:
    """A `git init` repository at `root` holding `files` (path -> text), each one `git add`ed."""
    root.mkdir(parents=True, exist_ok=True)
    git(root, "init", "-q")
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    if files:
        git(root, "add", "--", *files)
    return root


def git(root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=root, env=clean_env(), check=True, capture_output=True)


def lint(root: Path | None = None) -> subprocess.CompletedProcess[str]:
    """The lint's CLI, run from the repository's root; on `root` when given, else on its default root."""
    args = [sys.executable, "-m", "tools.lint.docs_paths"]
    if root is not None:
        args += ["--root", str(root)]
    return subprocess.run(
        args, cwd=REPO, env=clean_env(), capture_output=True, text=True, timeout=300, check=False
    )


def report(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\nstdout:\n{done.stdout}\nstderr:\n{done.stderr}"
