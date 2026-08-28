"""The Python half of the AGPL PDF-library ban (L-CAD-04).

PDF is read by pypdfium2 (permissive); the AGPL PDF stack — PyMuPDF/fitz and mutool — is banned
from shipped code, and a licence test enforces it on both runtimes. `tests/cad/licence.test.ts` is
the node half and scans package.json and pnpm-lock.yaml the same way.

The ban is enforced three ways, because a name can enter through any of them: the manifest's
declared requirements, the resolved lockfile (a transitive edge ships too) and the shipped source
itself. The scanner is proved non-vacuous against a planted name, so a suite that stopped detecting
anything would say so rather than pass quietly.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

import pytest

from corpus import CAD_ROOT

#: The AGPL PDF stack, as import names and as distribution names. `fitz` is PyMuPDF's import name;
#: `mutool` is the MuPDF command-line tool a subprocess could reach for.
BANNED: tuple[str, ...] = ("pymupdf", "fitz", "mutool", "mupdf")

MANIFEST = CAD_ROOT / "pyproject.toml"
LOCKFILE = CAD_ROOT / "uv.lock"
SOURCE_ROOT = CAD_ROOT / "src"


def normalise(name: str) -> str:
    """PEP 503: `PyMuPDF`, `py_mupdf` and `py.mupdf` are one distribution name."""
    return re.sub(r"[-_.]+", "-", name.strip().lower())


BANNED_DISTRIBUTIONS = frozenset(normalise(name) for name in BANNED)


def names_banned(text: str) -> list[str]:
    """Which banned libraries this text names, as whole words."""
    return [name for name in BANNED if re.search(rf"\b{name}\b", text, re.IGNORECASE) is not None]


def requirement_name(requirement: str) -> str:
    """The distribution name at the head of a PEP 508 requirement string."""
    match = re.match(r"^[A-Za-z0-9._-]+", requirement.strip())
    return match.group(0) if match is not None else ""


def declared_requirements() -> list[str]:
    """Every requirement the manifest declares, from whichever table holds it."""
    manifest = tomllib.loads(MANIFEST.read_text(encoding="utf-8"))
    project = manifest.get("project", {})

    arrays: list[list[str]] = [project.get("dependencies", [])]
    arrays.extend(project.get("optional-dependencies", {}).values())
    arrays.extend(manifest.get("dependency-groups", {}).values())
    arrays.append(manifest.get("tool", {}).get("uv", {}).get("dev-dependencies", []))

    return [requirement_name(entry) for array in arrays for entry in array if isinstance(entry, str)]


def locked_distributions() -> list[str]:
    """Every distribution the lockfile resolves — the transitive half of the ban."""
    lock = tomllib.loads(LOCKFILE.read_text(encoding="utf-8"))
    return [normalise(str(package.get("name", ""))) for package in lock.get("package", [])]


def shipped_modules() -> list[Path]:
    return sorted(SOURCE_ROOT.rglob("*.py"))


def test_the_manifest_declares_no_agpl_pdf_library() -> None:
    declared = declared_requirements()
    assert declared, "the manifest declares no requirements at all — ezdxf alone is one"
    offenders = [name for name in declared if normalise(name) in BANNED_DISTRIBUTIONS]
    assert offenders == [], f"cad/pyproject.toml declares {offenders}, which L-CAD-04 bans"


def test_the_lockfile_resolves_no_agpl_pdf_library() -> None:
    resolved = locked_distributions()
    assert resolved, "the lockfile resolves nothing — it cannot have been read"
    offenders = [name for name in resolved if name in BANNED_DISTRIBUTIONS]
    assert offenders == [], f"cad/uv.lock resolves {offenders}, which L-CAD-04 bans"


def test_no_shipped_module_names_an_agpl_pdf_library() -> None:
    modules = shipped_modules()
    assert modules, f"{SOURCE_ROOT} holds no Python module to scan"
    offenders = {
        str(module.relative_to(CAD_ROOT)): names_banned(module.read_text(encoding="utf-8"))
        for module in modules
    }
    named = {path: found for path, found in offenders.items() if found}
    assert named == {}, f"a shipped module names an AGPL PDF library: {named}"


@pytest.mark.parametrize("planted", BANNED)
def test_the_scan_detects_a_planted_name(planted: str) -> None:
    # A ban nothing can trip is not a ban: prove the scanner refuses each name it claims to.
    assert names_banned(f"import {planted}") == [planted]
    assert normalise(planted.upper()) in BANNED_DISTRIBUTIONS
