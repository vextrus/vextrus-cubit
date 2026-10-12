"""ADR 0039: no layer name or label text is a literal in the column family's code; an office's layers
and label patterns are its Drafting Profile's (`families.column.layers`, `.label_patterns`).

A narrow scan of the package's own source (its tests aside): no string literal that is a layer-like
name for a column (upper case, holding COL, CLM or COLUMN, e.g. "S-COL") and none that is a column mark
or a size as a plan writes them ("C1", "250x500"). Docstrings are prose and are not scanned.
"""

import ast
import re
from pathlib import Path

from engine.families.column import size
from engine.families.column.manifest import MANIFEST

PACKAGE = Path(__file__).resolve().parents[1]
LAYER_LIKE = re.compile(r"[A-Z0-9 _.\-|$]*(?:COL|CLM|COLUMN)[A-Z0-9 _.\-|$]*")
MARK_LIKE = re.compile(r"[A-Za-z]{1,3}-?\d{1,3}[A-Za-z]?")
KNOWN = {
    *MANIFEST.rule_codes,
    MANIFEST.ifc_predefined_type,
    *(code for _, code in MANIFEST.classification),
    "m2",
    "m3",
}
"""The family's own codes and SI units, which no drawing writes."""


def _sources() -> list[Path]:
    return sorted(p for p in PACKAGE.rglob("*.py") if "tests" not in p.relative_to(PACKAGE).parts)


def _literals(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    skip: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
                skip.add(id(body[0].value))
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant):
            skip.add(id(node.value))  # an attribute's docstring
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in skip
    ]


def test_the_package_holds_its_reader_and_measure() -> None:
    names = {p.relative_to(PACKAGE).as_posix() for p in _sources()}

    assert {"__init__.py", "manifest.py", "recognise.py", "geometry.py", "measure.py"} <= names


def test_no_layer_name_mark_or_size_is_a_literal_in_the_family_code() -> None:
    found = {
        f"{path.name}: {text!r}"
        for path in _sources()
        for text in _literals(path)
        if text not in KNOWN
        and (
            LAYER_LIKE.fullmatch(text.strip())
            or MARK_LIKE.fullmatch(text.strip())
            or size.parse(text) is not None
        )
    }

    assert not found, sorted(found)
