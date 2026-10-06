"""S15-E5 (#549): a View's home comes from the conventions, not from the code. ADR 0039: conventions
are data, "visible and correctable, not hidden rules in the reader"; `engine/recognise/__init__.py`:
"Conventions are data ... never a literal in code". Today the views code holds its routing as
literals (a Discipline's key in `STEP_DISCIPLINES`, each Step's key in `STRUCTURAL_STEPS`,
`ARCHITECTURAL_STEPS`, `GENERAL_NOTES` and `PLUMBING_PART`, and `discipline == "structural"`), so a
Drafting Profile cannot give a View another home; the ticket gives the views' routing (#549, "Owns:
views/routing") its homes from data.

The seam is the code behind `engine.recognise.views` as callers import it, a module or a package of
any parts (S15-E4 splits it): no string constant in it is a routed Step's key (the Library's, from
`vextrus/takeoff/library.py`) or a Discipline's key (the sheet conventions' Disciplines). Docstrings
and comments may name them; a key only in the conventions' JSON is data.
"""

import ast
from pathlib import Path

from engine.recognise import sheets, views

ROUTED_STEPS = frozenset(
    {
        "general_notes",
        "grid",
        "foundations",
        "columns",
        "beams",
        "slabs",
        "stairs",
        "tanks",
        "walls",
        "rooms",
        "roof",
        "site_mep",
    }
)
"""The Library's Step keys a View is proposed to (Steps 2 and 4 to 14; Step 1 is the Sheets
themselves and Step 3 the storeys, no View's home)."""


def code() -> dict[Path, ast.Module]:
    """Every source file of `engine.recognise.views`: its one file, or each file of its package."""
    if hasattr(views, "__path__"):
        files = sorted(p for folder in views.__path__ for p in Path(folder).rglob("*.py"))
    else:
        assert views.__file__ is not None
        files = [Path(views.__file__)]
    return {path: ast.parse(path.read_text(encoding="utf-8")) for path in files}


def written(keys: frozenset[str]) -> list[str]:
    """Each string constant of the views code that is one of `keys`, as `file:line 'key'`, docstrings
    left out."""
    found = []
    for path, tree in code().items():
        docstrings = {
            id(node.body[0].value)
            for node in ast.walk(tree)
            if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
            and node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
        }
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Constant)
                and isinstance(node.value, str)
                and node.value in keys
                and id(node) not in docstrings
            ):
                found.append(f"{path.name}:{node.lineno} {node.value!r}")
    return found


def test_the_views_code_writes_no_steps_key() -> None:
    found = written(ROUTED_STEPS)

    assert found == [], f"Step keys written in the views code: {found}"


def test_the_views_code_writes_no_disciplines_key() -> None:
    disciplines = frozenset(sheets.default_conventions().sheet_kinds)
    assert {"structural", "architectural", "plumbing"} <= disciplines

    found = written(disciplines)

    assert found == [], f"Discipline keys written in the views code: {found}"
