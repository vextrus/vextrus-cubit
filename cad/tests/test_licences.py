"""The AGPL ban, enforced on the python runtime (L-CAD-04).

"PDF via pypdfium2 (permissive); AGPL PDF libraries (PyMuPDF/fitz, mutool,
`@vivliostyle/cli`) are banned in shipped code and a licence test enforces it on both
runtimes." This is the python half; `tests/toolchain/licences.test.ts` is the node half.

Two claims, and the second keeps the first honest: the lane's manifests are clean, and the
checker can tell — a checker that answered "clean" for every input would satisfy the first
over any tree at all.

The checker reads manifest text only, never source, which is why this file may spell the
banned names at all.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from cubit_cad.licences import BANNED, banned_licence_findings

CAD = Path(__file__).parent.parent

CLEAN_PYPROJECT = '[project]\nname = "cubit-cad"\ndependencies = ["ezdxf==1.4.4"]\n'
CLEAN_LOCK = '[[package]]\nname = "ezdxf"\nversion = "1.4.4"\n'


def test_the_lane_declares_and_locks_nothing_banned() -> None:
    findings = banned_licence_findings(
        (CAD / "pyproject.toml").read_text(encoding="utf-8"),
        (CAD / "uv.lock").read_text(encoding="utf-8"),
    )
    assert findings == [], "\n".join(findings)


def test_the_ban_names_what_l_cad_04_names() -> None:
    assert set(BANNED) == {"pymupdf", "fitz", "mutool"}


@pytest.mark.parametrize("name", BANNED)
def test_a_banned_distribution_pinned_in_pyproject_is_reported(name: str) -> None:
    pyproject = f'[project]\ndependencies = ["{name}==1.0.0"]\n'
    findings = banned_licence_findings(pyproject, CLEAN_LOCK)
    assert len(findings) == 1, findings
    assert "pyproject.toml" in findings[0]
    assert name in findings[0]


@pytest.mark.parametrize("name", BANNED)
def test_a_banned_distribution_only_the_lock_knows_is_reported(name: str) -> None:
    """The transitive copy is the one that ships, and the one a source scan never sees."""
    lock = f'[[package]]\nname = "{name}"\nversion = "1.24.0"\n'
    findings = banned_licence_findings(CLEAN_PYPROJECT, lock)
    assert len(findings) == 1, findings
    assert "uv.lock" in findings[0]


def test_the_name_is_matched_whatever_case_the_manifest_writes_it_in() -> None:
    """PyMuPDF is spelled four ways in the wild; the ban is on the distribution, not a string."""
    pyproject = '[project]\ndependencies = ["PyMuPDF==1.24.0"]\n'
    assert len(banned_licence_findings(pyproject, CLEAN_LOCK)) == 1


def test_a_distribution_that_merely_contains_a_banned_name_is_not_reported() -> None:
    pyproject = '[project]\ndependencies = ["fitzgerald==1.0", "mutoolkit==2.0"]\n'
    assert banned_licence_findings(pyproject, CLEAN_LOCK) == []


def test_a_clean_manifest_pair_is_clean() -> None:
    assert banned_licence_findings(CLEAN_PYPROJECT, CLEAN_LOCK) == []
