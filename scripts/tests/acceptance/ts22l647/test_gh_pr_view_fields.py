"""S22-647: no code under scripts/ or tools/ asks `gh pr view --json` for a field gh does not know.

Real gh exits 1 on an unknown field ("Unknown JSON field"), and gh has no `baseRefOid`: asking for it
refused every PR in the lander (PR #655's review) as it did in tools/leakscan (S21-MR). The stubs answer
whatever they are asked, so this scan is the class check: every Python source under scripts/ and tools/
is parsed, and each call or argv list holding "pr", "view" and then "--json" with a field list it can
read (a string, a name bound to one or to a tuple of strings, or `",".join(<such a name>)`) must name
only fields of gh's own list (tools/leakscan/tests/test_pr_view_fields.py's GH_PR_VIEW_FIELDS)."""

from __future__ import annotations

import ast
from collections.abc import Iterator
from pathlib import Path

from tools.leakscan.tests.test_pr_view_fields import GH_PR_VIEW_FIELDS

ROOT = Path(__file__).resolve().parents[4]
SKIP = {"__pycache__", ".venv", "node_modules", ".private"}


def sources() -> Iterator[Path]:
    for folder in ("scripts", "tools"):
        for path in sorted((ROOT / folder).rglob("*.py")):
            if not SKIP & set(path.relative_to(ROOT).parts):
                yield path


def _bindings(tree: ast.AST) -> dict[str, list[ast.expr]]:
    bound: dict[str, list[ast.expr]] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    bound.setdefault(target.id, []).append(node.value)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value:
            bound.setdefault(node.target.id, []).append(node.value)
    return bound


def _fields(node: ast.expr, bound: dict[str, list[ast.expr]], depth: int = 0) -> list[str] | None:
    """The field names a `--json` argument names, or None when it cannot be read statically."""
    if depth > 4:
        return None
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return [field.strip() for field in node.value.split(",") if field.strip()]
    if isinstance(node, ast.Tuple | ast.List | ast.Set):
        names = [e.value for e in node.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)]
        return names if len(names) == len(node.elts) else None
    if isinstance(node, ast.Call) and node.args and len(node.args) == 1:
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr == "join":
            return _fields(node.args[0], bound, depth + 1)
        if isinstance(func, ast.Name) and func.id in ("frozenset", "set", "tuple", "list"):
            return _fields(node.args[0], bound, depth + 1)
    if isinstance(node, ast.Name) and node.id in bound:
        found: list[str] = []
        for value in bound[node.id]:
            fields = _fields(value, bound, depth + 1)
            if fields is None:
                return None
            found += fields
        return found
    return None


def _sequences(tree: ast.AST) -> Iterator[tuple[int, list[ast.expr]]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            yield node.lineno, list(node.args)
        elif isinstance(node, ast.List | ast.Tuple):
            yield node.lineno, list(node.elts)


def _text(node: ast.expr) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def unknown_fields(path: Path, root: Path = ROOT) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    bound = _bindings(tree)
    found: list[str] = []
    for line, items in _sequences(tree):
        texts = [_text(item) for item in items]
        starts = [i for i in range(len(texts) - 1) if texts[i : i + 2] == ["pr", "view"]]
        if not starts:
            continue
        for i in range(starts[0] + 2, len(items)):
            fields: list[str] | None = None
            text = texts[i] or ""
            if text == "--json" and i + 1 < len(items):
                fields = _fields(items[i + 1], bound)
            elif text.startswith("--json="):
                fields = _fields(ast.Constant(text.removeprefix("--json=")), bound)
            for field in fields or []:
                if field not in GH_PR_VIEW_FIELDS:
                    found.append(f"{path.relative_to(root)}:{line}: gh pr view --json {field}")
    return found


def test_no_source_asks_gh_pr_view_for_a_field_gh_does_not_know() -> None:
    found = [hit for path in sources() for hit in unknown_fields(path)]
    assert found == [], "gh pr view has no such JSON field:\n" + "\n".join(found)


def test_the_scan_reads_the_shapes_the_lander_and_leakscan_use(tmp_path: Path) -> None:
    """The scan itself: a field outside gh's list is found in each shape, a known one is not."""
    sample = tmp_path / "sample.py"
    sample.write_text(
        "FIELDS = ('number', 'baseRefOid')\n"
        "run('gh', 'pr', 'view', '7', '--repo', R, '--json', 'headRefOid,baseRefOid')\n"
        "gh('pr', 'view', str(n), '--json', ','.join(FIELDS))\n"
        "argv = ['gh', 'pr', 'view', '7', '--json=headRefOid,mergedAtSha']\n"
        "ok = ['gh', 'pr', 'view', '7', '--json', 'headRefOid,baseRefName,files']\n"
    )
    found = unknown_fields(sample, tmp_path)
    assert found == [
        "sample.py:2: gh pr view --json baseRefOid",
        "sample.py:3: gh pr view --json baseRefOid",
        "sample.py:4: gh pr view --json mergedAtSha",
    ]
