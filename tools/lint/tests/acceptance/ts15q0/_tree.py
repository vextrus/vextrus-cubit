"""A copy of the repository's Python side for S15-Q0's acceptance tests (no network, no real drawing).

Each test copies the repository (all but `.git`, `.claude`, `.private`, `.venv` and `web/`) into its
temporary folder, plants one thing there (a function over the limits, a dead function, an import
ignore that matches nothing) and runs the gate in the copy, so the real tree is never changed.

The gates' seams (this ticket's; the plan names no command, so its acceptance-writer chose them):

- the Python size and complexity ratchet: `python -m tools.lint.complexity`, run in the repository
  with no argument, over the production code of `engine`, `vextrus`, `scripts` and `tools`; exit 0
  clean, non-zero naming each function over its limit or grown past its committed baseline;
- dead code: `python -m vulture`, with no argument (its paths, whitelist and confidence read from
  `pyproject.toml`'s `[tool.vulture]`); exit 0 clean, non-zero naming each unused function;
- the import contracts: `lint-imports`, beside the interpreter, as CI runs it.
"""

import ast
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
ROOTS = ("engine", "vextrus", "scripts", "tools")
LEFT_OUT = {".git", ".claude", ".private", ".venv", "web", "node_modules"}
CACHES = shutil.ignore_patterns("__pycache__", ".*_cache", "node_modules")
# Paths a size gate may leave out: tests, migrations, fixtures.
NOT_PRODUCTION = {"tests", "migrations", "fixtures", "acceptance"}
WORKFLOWS = ".github/workflows"


def copy_repo(target: Path) -> Path:
    """Copy the repository's Python side into `target` (an empty folder) and return it."""
    for entry in sorted(REPO.iterdir()):
        if entry.name in LEFT_OUT:
            continue
        if entry.is_dir():
            shutil.copytree(entry, target / entry.name, ignore=CACHES, symlinks=True)
        else:
            shutil.copy2(entry, target / entry.name)
    return target


def run(root: Path, *command: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(command), cwd=root, capture_output=True, text=True, check=False)


def output(result: subprocess.CompletedProcess[str]) -> str:
    return (result.stdout + result.stderr).strip()


def plant(root: Path, relative: str, source: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source)


@dataclass(frozen=True)
class Function:
    path: Path
    name: str
    lines: int
    body_line: int  # the 1-based line its body's first statement starts on
    indent: int


def _is_production(path: Path, root: Path) -> bool:
    parts = path.relative_to(root).parts
    if NOT_PRODUCTION.intersection(parts):
        return False
    return not (path.name.startswith("test_") or path.name == "conftest.py")


def _functions(path: Path) -> list[Function]:
    tree = ast.parse(path.read_text(), filename=str(path))
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and node.end_lineno:
            first = node.body[0]
            size = node.end_lineno - node.lineno + 1
            found.append(Function(path, node.name, size, first.lineno, first.col_offset))
    return found


def longest_function(root: Path) -> Function:
    """The longest function (in lines) of the production code under the four roots of `root`."""
    every = [
        function
        for top in ROOTS
        for path in sorted((root / top).rglob("*.py"))
        if _is_production(path, root)
        for function in _functions(path)
    ]
    return max(every, key=lambda function: (function.lines, str(function.path), function.name))


def grow(function: Function, statements: int) -> None:
    """Add `statements` plain assignments at the start of the function's body."""
    lines = function.path.read_text().splitlines(keepends=True)
    pad = " " * function.indent
    added = [f"{pad}_grown_q0_{index} = {index}\n" for index in range(statements)]
    at = function.body_line - 1
    function.path.write_text("".join(lines[:at] + added + lines[at:]))


def workflow_lines(root: Path) -> list[str]:
    """Every line of CI's workflows that is not a comment."""
    return [
        line
        for path in sorted((root / WORKFLOWS).glob("*.yml"))
        for line in path.read_text().splitlines()
        if not line.lstrip().startswith("#")
    ]
