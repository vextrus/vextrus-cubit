"""The AGPL ban, enforced on the Python runtime (L-CAD-04).

"PDF via pypdfium2 (permissive); AGPL PDF libraries (PyMuPDF/fitz, mutool,
`@vivliostyle/cli`) are banned in shipped code and a licence test enforces it on both
runtimes." The node half of the same ban lives in `scripts/lib/licences.mjs`.

The check reads *manifest* text — `pyproject.toml` and `uv.lock` — and nothing else. A
dependency is what the lock says is installed; scanning source would report this file for
naming what it forbids, and would still miss a transitive dependency nobody imports by
name.
"""

from __future__ import annotations

import re

#: The banned distributions, by the name a manifest would spell them with.
BANNED = ("pymupdf", "fitz", "mutool")

#: Distribution names are made of these; a match bounded by anything else is a substring.
_NAME_CHARACTERS = "0-9a-z._-"


def _mentions(text: str, name: str) -> bool:
    pattern = re.compile(rf"(?<![{_NAME_CHARACTERS}]){re.escape(name)}(?![{_NAME_CHARACTERS}])")
    return pattern.search(text.lower()) is not None


def banned_licence_findings(pyproject_text: str, lock_text: str) -> list[str]:
    """Every banned distribution named by the two manifests, as readable findings.

    An empty list is the whole of "clean": the caller does not have to know which files
    were read, only that nothing AGPL is declared or locked.
    """
    findings: list[str] = []
    for where, text in (("cad/pyproject.toml", pyproject_text), ("cad/uv.lock", lock_text)):
        for name in BANNED:
            if _mentions(text, name):
                findings.append(
                    f"{where} names {name}, which is AGPL and banned in shipped code "
                    f"(L-CAD-04); PDF is read with pypdfium2"
                )
    return findings
