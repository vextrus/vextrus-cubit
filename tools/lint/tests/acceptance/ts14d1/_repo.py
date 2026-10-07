"""Shared by S14-D1's acceptance tests: the repository's root and its committed files.

Every test reads committed files only; nothing here writes to the tree.
"""

import os
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
ADR_DIR = REPO / "docs/adr"


def read(relative: str) -> str:
    path = REPO / relative
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def flat(text: str) -> str:
    """Whitespace collapsed, so a hard-wrapped line still matches."""
    return " ".join(text.split())


def tracked() -> set[str]:
    """The files git tracks (`git ls-files --cached`), without git's own variables in the environment."""
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    done = subprocess.run(
        ["git", "ls-files", "--cached", "-z"],
        cwd=REPO,
        env=env,
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    return {name for name in done.stdout.split("\0") if name}


def adr_files(number: str) -> list[Path]:
    return sorted(ADR_DIR.glob(f"{number}-*.md"))


def paragraphs(text: str) -> list[str]:
    """The text's blank-line separated paragraphs, each flattened."""
    return [flat(block) for block in re.split(r"\n\s*\n", text) if block.strip()]
