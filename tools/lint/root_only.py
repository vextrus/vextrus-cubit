"""The root-only lint (S14-F2; issues #450, #397). A Python test that takes permissions away with
chmod (an owner without read or write, e.g. 0o555, 0o000, 0) passes as an ordinary user and fails as
root, because root ignores file modes (cloud sessions run as uid 0). Such a test must carry
`@pytest.mark.skipif(os.geteuid() == 0, ...)` (on the test, its class, or a module `pytestmark`), or be
listed in `.github/flaky-root.txt` (`<repo path> :: <test title>`), which `scripts.verify` records as
root-only. A chmod that keeps the owner's read and write (0o755, 0o600) passes.

A test under an acceptance path (`tests/acceptance/`, `web/**/acceptance/`) must be listed, never
skipped: as root the acceptance plugin (`tools.lint.acceptance_pytest`) fails a skipped acceptance test
with no FAILED line, so a skipif there breaks the run and only the listing rescues it. The skipif does
not satisfy the lint in those files.

The mode is worked out when it is a constant: an int literal, `stat.S_*` names, and `|`, `&`, `^`, `+`,
`-`, `<<`, `>>`, `~` over them; `subprocess` calls to the `chmod` program (an argument list or a shell
string) too, with an octal or a symbolic mode. A chmod in a test file whose mode cannot be worked out is
flagged (fail closed): guard or list the test, or write the mode as a constant. So is any `subprocess.*`,
`os.system` or `os.popen` command that is not a plain literal but mentions `chmod` (an f-string, a list
joined with `+`, `shutil.which("chmod")`).

    python -m tools.lint.root_only [--root DIR]

Reads the test files (`test_*.py`, `*_test.py`, `tests/**`, `conftest.py`) that git tracks under DIR;
prints `<path relative to DIR>:<line>: ...` for each unguarded call; exit 1 when any, else 0.
"""

import argparse
import ast
import operator
import re
import shlex
import stat
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from tools.lint.acceptance import is_acceptance

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


BINARY: dict[type[ast.operator], Callable[[int, int], int]] = {
    ast.BitOr: operator.or_,
    ast.BitAnd: operator.and_,
    ast.BitXor: operator.xor,
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.LShift: operator.lshift,
    ast.RShift: operator.rshift,
}
UNARY: dict[type[ast.unaryop], Callable[[int], int]] = {
    ast.Invert: operator.invert,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}
SUBPROCESS = {"run", "call", "check_call", "check_output", "Popen", "system", "popen"}
CHMOD_WORD = re.compile(r"\bchmod\b")
CLAUSE = re.compile(r"^([ugoa]*)([-+=])([rwxXst]*|[ugo])$")


def constant_mode(node: ast.expr) -> int | None:
    """An int built from int literals, `stat.S_*` names and the operators above, else None."""
    if isinstance(node, ast.Constant):
        return node.value if isinstance(node.value, int) and not isinstance(node.value, bool) else None
    if isinstance(node, ast.Attribute | ast.Name):
        name = node.attr if isinstance(node, ast.Attribute) else node.id
        value = getattr(stat, name, None) if name.startswith("S_") else None
        return value if isinstance(value, int) else None
    if isinstance(node, ast.UnaryOp) and type(node.op) in UNARY:
        operand = constant_mode(node.operand)
        return None if operand is None else UNARY[type(node.op)](operand)
    if isinstance(node, ast.BinOp) and type(node.op) in BINARY:
        left, right = constant_mode(node.left), constant_mode(node.right)
        if left is None or right is None:
            return None
        if isinstance(node.op, ast.LShift | ast.RShift) and not 0 <= right <= 64:
            return None
        return BINARY[type(node.op)](left, right)
    return None


def keeps_owner_rw(mode: int) -> bool:
    return mode & OWNER_RW == OWNER_RW


def symbolic_removes(text: str) -> bool | None:
    """Whether a symbolic chmod mode (`a-rwx`, `u=x`, `go-r,u-w`) takes the owner's read or write away;
    None when it is not one this reads."""
    removes = False
    for clause in text.split(","):
        found = CLAUSE.match(clause)
        if not found:
            return None
        who, op, perms = found.groups()
        if who and "u" not in who and "a" not in who:
            continue
        if (op == "-" and ("r" in perms or "w" in perms)) or (
            op == "=" and not ("r" in perms and "w" in perms)
        ):
            removes = True
    return removes


def program_mode_removes(words: list[str]) -> bool | None:
    """For the words `chmod [options] MODE FILE...`: True when MODE removes the owner's read or write,
    False when it keeps them, None when the mode cannot be worked out."""
    rest = [word for word in words[1:] if not word.startswith("-") or word == "-"]
    if not rest:
        return None
    mode = rest[0]
    if mode.isdigit() and all(c in "01234567" for c in mode):
        return not keeps_owner_rw(int(mode, 8) & 0o777)
    return symbolic_removes(mode)


def command_words(node: ast.expr) -> list[str] | None:
    """The words of a command given as a plain string literal or a list or tuple whose first element is
    a string literal (a non-literal element reads as `?`); None for any other shape."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        try:
            return shlex.split(node.value)
        except ValueError:
            return None
    if isinstance(node, ast.List | ast.Tuple) and node.elts:
        head = node.elts[0]
        if isinstance(head, ast.Constant) and isinstance(head.value, str):
            return [
                e.value if isinstance(e, ast.Constant) and isinstance(e.value, str) else "?"
                for e in node.elts
            ]
    return None


def mentions_chmod(node: ast.expr) -> bool:
    """Whether a string constant anywhere in the expression holds the word `chmod` (an f-string part, a
    list element, `shutil.which("chmod")`, an operand of `+`)."""
    return any(
        isinstance(sub, ast.Constant) and isinstance(sub.value, str) and CHMOD_WORD.search(sub.value)
        for sub in ast.walk(node)
    )


def subprocess_chmod(call: ast.Call) -> bool | None:
    """None when the call is not a subprocess, `os.system` or `os.popen` call that runs `chmod`; else
    whether it removes the owner's read or write. A command given as a plain literal is read; any other
    command that mentions `chmod` anywhere (a shell string built with an f-string, a list joined with
    `+`, `shutil.which("chmod")` as the program) counts as removing, because its mode is not seen."""
    func = call.func
    name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
    if name not in SUBPROCESS:
        return None
    given = [kw.value for kw in call.keywords if kw.arg == "args"]
    first = given[0] if given else (call.args[0] if call.args else None)
    if first is None:
        return None
    words = command_words(first)
    if words and Path(words[0]).name == "chmod":
        return program_mode_removes(words) is not False
    return True if mentions_chmod(first) else None


def removes_permissions(call: ast.Call) -> bool:
    """A chmod whose mode lacks the owner's read or write bit, or whose mode cannot be worked out (the
    lint fails closed); also a subprocess call to the `chmod` program."""
    via_program = subprocess_chmod(call)
    if via_program is not None:
        return via_program
    func = call.func
    name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
    if name not in CHMODS:
        return False
    # `os.chmod(path, mode)`, `chmod(path, mode)`: the mode is second; `path.chmod(mode)`: first.
    module_call = isinstance(func, ast.Name) or (
        isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "os"
    )
    index = 1 if module_call else 0
    keyword = [kw.value for kw in call.keywords if kw.arg == "mode"]
    arg = keyword[0] if keyword else (call.args[index] if len(call.args) > index else None)
    mode = None if arg is None else constant_mode(arg)
    if mode is None and arg is not None and adds_to_existing(arg):
        return False
    return mode is None or not keeps_owner_rw(mode)


def adds_to_existing(node: ast.expr) -> bool:
    """`path.stat().st_mode | stat.S_IXUSR`: an existing file's mode with bits ORed in only adds."""
    return (
        isinstance(node, ast.BinOp)
        and isinstance(node.op, ast.BitOr)
        and any(isinstance(sub, ast.Attribute) and sub.attr == "st_mode" for sub in ast.walk(node))
    )


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
    acceptance = is_acceptance(path)
    if module_guarded(tree) and not acceptance:
        return []
    found: list[str] = []

    def visit(node: ast.AST, guarded: bool, function: str) -> None:
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            guarded = guarded or (not acceptance and any(is_root_guard(d) for d in node.decorator_list))
            if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and not function:
                function = node.name
        if (
            isinstance(node, ast.Call)
            and removes_permissions(node)
            and not guarded
            and not any(where == path and title == function for where, title in allowed)
        ):
            found.append(
                f"{path}:{node.lineno}: a chmod that removes permissions (or whose mode cannot be "
                f"worked out) in an acceptance test: list `{path} :: <test name>` in {LISTED}; a "
                f"skipif root fails the acceptance plugin as root"
                if acceptance
                else f"{path}:{node.lineno}: a chmod that removes permissions (or whose mode cannot be "
                f"worked out) without `@pytest.mark.skipif(os.geteuid() == 0, ...)` (root ignores file "
                f"modes); guard the test or list it in {LISTED}"
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
