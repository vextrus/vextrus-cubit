"""Ticket 21c, the check's switch to the job (docs/plans/M0.md, 21c): "from its merge the job is the
default and the engine paths and the code hash widen to the product job's paths, with a test that the
whole-step job imports no `vextrus` module outside them but settings".

The whole-step job is the read job (`vextrus/takeoff/tasks/read_file.py`, 21a's, running 21b's and
21c's steps) and the export the check takes from it (`vextrus/takeoff/services/export.py`, 21c's; the
sandbox runs `python -m vextrus.takeoff.services.export`, `scripts/real_drawings/sandbox.py`). Every
`vextrus` module either imports, at any depth, is one the engine paths (`.github/engine-paths.txt`,
which the code hash follows) name, but `vextrus/settings/`. Imports are read from the source (as
Python would resolve them), so a module is counted even where Django would load it anyway.
"""

import ast
from collections.abc import Iterator
from pathlib import Path

from tools.lint.engine_paths import matching, read_patterns

REPO = Path(__file__).resolve().parents[5]
ENTRIES = ("vextrus/takeoff/tasks/read_file.py", "vextrus/takeoff/services/export.py")
SETTINGS = "vextrus/settings/"
PRODUCT_JOB = (
    "vextrus/takeoff/tasks/read_file.py",
    "vextrus/takeoff/services/export.py",
    "vextrus/takeoff/services/read_propose/files.py",
    "vextrus/takeoff/services/read_propose/sheets.py",
    "vextrus/takeoff/services/read_propose/proposals.py",
)
"""The product job's own paths (21a's, 21b's and 21c's files, the plan's owners lists)."""


def patterns() -> list[str]:
    return read_patterns((REPO / ".github" / "engine-paths.txt").read_text(encoding="utf-8"))


def _file_of(module: str) -> Path | None:
    base = REPO / Path(*module.split("."))
    for candidate in (base.with_suffix(".py"), base / "__init__.py"):
        if candidate.is_file():
            return candidate
    return None


def _package_of(path: Path) -> list[str]:
    parts = list(path.relative_to(REPO).with_suffix("").parts)
    return parts[:-1]  # a package's own `__init__` and its modules alike


def _type_checking(node: ast.If) -> bool:
    test = node.test
    return (isinstance(test, ast.Name) and test.id == "TYPE_CHECKING") or (
        isinstance(test, ast.Attribute) and test.attr == "TYPE_CHECKING"
    )


def _imports(node: ast.AST) -> Iterator[ast.Import | ast.ImportFrom]:
    """Every import in the tree, at any depth (a function's too), but those only a type checker runs
    (`if TYPE_CHECKING:`; its `else` runs)."""
    if isinstance(node, ast.Import | ast.ImportFrom):
        yield node
        return
    children: list[ast.AST] = list(ast.iter_child_nodes(node))
    if isinstance(node, ast.If) and _type_checking(node):
        children = list(node.orelse)
    for child in children:
        yield from _imports(child)


def _named(path: Path) -> Iterator[str]:
    """The modules a file imports: `import a.b`, `from a.b import c` (c a module when it is one), and
    relative imports resolved from the file's package."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    package = _package_of(path)
    for node in _imports(tree):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
            continue
        if node.level:
            base = package[: len(package) - node.level + 1]
            module = ".".join([*base, *([node.module] if node.module else [])])
        else:
            module = node.module or ""
        yield module
        for alias in node.names:
            yield f"{module}.{alias.name}"


def closure() -> set[Path]:
    """Every `vextrus` file the entries import, at any depth, with each package's `__init__`."""
    seen: set[Path] = set()
    todo = [REPO / entry for entry in ENTRIES]
    while todo:
        path = todo.pop()
        if path in seen:
            continue
        seen.add(path)
        for module in _named(path):
            if not module.startswith("vextrus"):
                continue
            parts = module.split(".")
            for depth in range(1, len(parts) + 1):
                found = _file_of(".".join(parts[:depth]))
                if found is not None and found not in seen:
                    todo.append(found)
    return seen


def test_the_whole_step_jobs_entries_exist() -> None:
    missing = [entry for entry in ENTRIES if not (REPO / entry).is_file()]
    assert missing == []


def test_the_engine_paths_name_the_product_jobs_own_files() -> None:
    assert matching(PRODUCT_JOB, patterns()) == list(PRODUCT_JOB)


def test_the_whole_step_job_imports_no_vextrus_module_outside_the_engine_paths_but_settings() -> None:
    files = sorted(str(p.relative_to(REPO)) for p in closure())
    vextrus = [f for f in files if f.startswith("vextrus/") and not f.startswith(SETTINGS)]
    assert vextrus, "the closure found no vextrus module: the entries are missing"

    outside = sorted(set(vextrus) - set(matching(vextrus, patterns())))

    assert outside == [], f"imported by the whole-step job, but on no engine path: {outside}"
