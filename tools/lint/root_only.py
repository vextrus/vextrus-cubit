"""The root-only lint (S14-F2; issues #450, #397). A Python test that takes permissions away with
chmod (an owner without read or write, e.g. 0o555, 0o000, 0) passes as an ordinary user and fails as
root, because root ignores file modes (cloud sessions run as uid 0). Such a test must carry
`@pytest.mark.skipif(os.geteuid() == 0, ...)` (on the test, its class, or a module `pytestmark`), or be
listed in `.github/flaky-root.txt` (`<repo path> :: <test title>`), which `scripts.verify` records as
root-only. A chmod that keeps the owner's read and write (0o755, 0o600) passes.

    python -m tools.lint.root_only [--root DIR]

Reads the test files (`test_*.py`, `*_test.py`, `tests/**`, `conftest.py`) that git tracks under DIR;
prints `<path relative to DIR>:<line>: ...` for each unguarded call; exit 1 when any, else 0.
"""

import argparse
import ast
import subprocess
import sys
from pathlib import Path

CHMODS = {"chmod", "fchmod", "lchmod"}
OWNER_RW = 0o600
LISTED = ".github/flaky-root.txt"


def tracked_tests(root: Path) -> list[str]:
    done = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--", "*.py"],
        capture_output=True,
        text=True,
        check=True,
    )
    return [
        path
        for path in done.stdout.split("\0")
        if path
        and ("tests/" in f"/{path}" or Path(path).name.startswith("test_") or path.endswith("_test.py"))
    ]


def listed(root: Path) -> list[tuple[str, str]]:
    path = root / LISTED
    if not path.is_file():
        return []
    entries = []
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and " :: " in line:
            where, title = (part.strip() for part in line.split(" :: ", 1))
            entries.append((where, title))
    return entries


def removes_permissions(call: ast.Call) -> bool:
    """A chmod whose literal mode lacks the owner's read or write bit."""
    func = call.func
    name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
    if name not in CHMODS:
        return False
    for arg in [*call.args, *(kw.value for kw in call.keywords if kw.arg == "mode")]:
        if isinstance(arg, ast.Constant) and isinstance(arg.value, int):
            return arg.value & OWNER_RW != OWNER_RW
    return False


def is_root_guard(node: ast.expr) -> bool:
    """`pytest.mark.skipif(os.geteuid() == 0, ...)`: a skipif whose condition calls geteuid."""
    if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)):
        return False
    if node.func.attr != "skipif" or not node.args:
        return False
    return any(
        isinstance(sub, ast.Call) and getattr(sub.func, "attr", "") == "geteuid"
        for sub in ast.walk(node.args[0])
    )


def module_guarded(tree: ast.Module) -> bool:
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            getattr(t, "id", "") == "pytestmark" for t in node.targets
        ):
            values = node.value.elts if isinstance(node.value, ast.List | ast.Tuple) else [node.value]
            if any(is_root_guard(v) for v in values):
                return True
    return False


def problems_in(path: str, text: str, allowed: list[tuple[str, str]]) -> list[str]:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []
    if module_guarded(tree):
        return []
    found: list[str] = []

    def visit(node: ast.AST, guarded: bool, function: str) -> None:
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            guarded = guarded or any(is_root_guard(d) for d in node.decorator_list)
            if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and not function:
                function = node.name
        if (
            isinstance(node, ast.Call)
            and removes_permissions(node)
            and not guarded
            and not any(where == path and title in function for where, title in allowed if title)
        ):
            found.append(
                f"{path}:{node.lineno}: a chmod that removes permissions without "
                f"`@pytest.mark.skipif(os.geteuid() == 0, ...)` (root ignores file modes); "
                f"guard the test or list it in {LISTED}"
            )
        for child in ast.iter_child_nodes(node):
            visit(child, guarded, function)

    visit(tree, False, "")
    return found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m tools.lint.root_only")
    parser.add_argument("--root", default=".")
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    root = Path(args.root)
    allowed = listed(root)
    problems: list[str] = []
    for path in tracked_tests(root):
        file = root / path
        if file.is_file():
            problems += problems_in(path, file.read_text(encoding="utf-8", errors="replace"), allowed)
    for problem in problems:
        print(problem)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
