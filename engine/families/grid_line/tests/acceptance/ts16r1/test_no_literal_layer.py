"""Ticket S16-R1: "no literal layer or label in code (ADR 0039)"; C4/C6: "No literal layer name or label
text in family code"; the grid's layers and bubble blocks are the Drafting Profile's `grid` part
(`{"layers": [...], "bubble_blocks": [...]}`), confirmed by the QS, never held in code.

A narrow scan of the family's own source (every `.py` under `engine/families/grid_line/` but its
tests): no string literal that is a layer- or block-like name for a grid (upper case, holding GRID,
GRD, AXIS or AXES, e.g. "S-GRID", "GRID", "C-AXIS"), and none of the fixture's invented layer names.
Docstrings are prose and are not scanned.
"""

import ast
import re
from pathlib import Path

from . import drawing

PACKAGE = Path(__file__).resolve().parents[3]
LAYER_LIKE = re.compile(r"[A-Z0-9 _.\-|$]*(?:GRID|GRD|AXIS|AXES)[A-Z0-9 _.\-|$]*")


def _sources() -> list[Path]:
    return sorted(p for p in PACKAGE.rglob("*.py") if "tests" not in p.relative_to(PACKAGE).parts)


def _docstrings(tree: ast.AST) -> set[int]:
    found: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
                found.add(id(body[0].value))
    return found


def _literals(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    skip = _docstrings(tree)
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in skip
    ]


def test_the_family_package_has_its_recogniser() -> None:
    names = {p.relative_to(PACKAGE).as_posix() for p in _sources()}

    assert {"__init__.py", "manifest.py", "recognise.py", "frame.py"} <= names, sorted(names)


def test_no_grid_layer_or_block_name_is_a_literal_in_the_family_code() -> None:
    assert _sources(), "engine/families/grid_line holds no source"
    found = {
        f"{path.relative_to(PACKAGE).as_posix()}: {text!r}"
        for path in _sources()
        for text in _literals(path)
        if LAYER_LIKE.fullmatch(text.strip()) or text in drawing.INVENTED_LAYERS
    }

    assert not found, sorted(found)
