"""Where the committed fixture corpus lives, for the suites that read it.

The roster is read off the directory rather than frozen in a list: every `<name>.entitygraph.json`
is a committed artifact owed a `<name>.dxf` beside it, so a pair added later is judged by the same
rules without editing a test.
"""

from __future__ import annotations

from pathlib import Path

#: The `cad/` project root — this file sits at cad/tests/.
CAD_ROOT = Path(__file__).resolve().parent.parent

#: The checkout root, which is what the licence scan walks.
REPO_ROOT = CAD_ROOT.parent

FIXTURE_DIR = CAD_ROOT / "tests" / "fixtures"

ARTIFACT_SUFFIX = ".entitygraph.json"


def artifact_names() -> list[str]:
    """Every committed artifact's name, sorted."""
    return sorted(path.name[: -len(ARTIFACT_SUFFIX)] for path in FIXTURE_DIR.glob(f"*{ARTIFACT_SUFFIX}"))


def drawing_path(name: str) -> Path:
    return FIXTURE_DIR / f"{name}.dxf"


def artifact_path(name: str) -> Path:
    return FIXTURE_DIR / f"{name}{ARTIFACT_SUFFIX}"
