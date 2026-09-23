"""Where the committed fixture corpus lives, for the suites that read it.

The roster is read off the directory rather than frozen in a list: every `<name>.entitygraph.json`
is a committed artifact owed exactly one drawing beside it — `<name>.dxf` for the DXF corpus, or
`<name>.pdf` for the vector-PDF lane's (R-TO-002) — so a pair added later is judged by the same
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

#: The drawings a committed artifact may be taken from, one lane each.
DXF_SUFFIX = ".dxf"
PDF_SUFFIX = ".pdf"
SOURCE_SUFFIXES = (DXF_SUFFIX, PDF_SUFFIX)


def all_artifact_names() -> list[str]:
    """Every committed artifact's name, whatever lane took it, sorted."""
    return sorted(path.name[: -len(ARTIFACT_SUFFIX)] for path in FIXTURE_DIR.glob(f"*{ARTIFACT_SUFFIX}"))


def sources_of(name: str) -> list[Path]:
    """The drawings beside one artifact — exactly one, for an honest corpus."""
    return [
        FIXTURE_DIR / f"{name}{suffix}"
        for suffix in SOURCE_SUFFIXES
        if (FIXTURE_DIR / f"{name}{suffix}").is_file()
    ]


def artifact_names() -> list[str]:
    """The DXF corpus: every committed artifact whose drawing is a DXF, sorted."""
    return [name for name in all_artifact_names() if drawing_path(name).is_file()]


def pdf_artifact_names() -> list[str]:
    """The vector-PDF corpus: every committed artifact whose drawing is a PDF, sorted."""
    return [name for name in all_artifact_names() if pdf_path(name).is_file()]


def drawing_path(name: str) -> Path:
    return FIXTURE_DIR / f"{name}{DXF_SUFFIX}"


def pdf_path(name: str) -> Path:
    return FIXTURE_DIR / f"{name}{PDF_SUFFIX}"


def artifact_path(name: str) -> Path:
    return FIXTURE_DIR / f"{name}{ARTIFACT_SUFFIX}"
