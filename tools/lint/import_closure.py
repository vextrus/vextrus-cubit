"""A set of Python files' import closure, read from source (ticket T-249): which files of a tree the
entries can load, at any depth, so a cache can be keyed by them and nothing else (the proxy's reader
hash, `tools/proxy/cache.py`; the posting run's narrower key, PR B's `read_key`).

    closure(read, entries, tree) -> frozenset[str]

`tree` is every file of the tree by its path relative to the root (`a/b/c.py`, `/`-separated), and
`read(path)` its bytes (None when it cannot be read): a working tree's files or a commit's blobs alike.
From each entry it follows, as `vextrus/takeoff/tests/acceptance/t21c/test_job_imports.py` does:

- `import a.b` and `from a.b import c` at any depth (a function's too), but not under
  `if TYPE_CHECKING:` (its `else` runs); `c` counts when it is a module of the tree;
- relative imports, resolved from the file's own package;
- every string literal naming a module of the tree, `a.b.c` or `a.b.c:attr` (an entry point, a
  settings module, a stage's target), which a plain import does not show;
- each followed module's parent packages' `__init__.py`;
- and every file that is not Python in a followed file's own folder (its data: conventions, schemas),
  whose bytes the code reads.

Tests (a `tests` folder, `test_*.py`) and `conftest.py` are never entries and never followed. A file
that does not parse, an entry not in the tree, or a followed file that cannot be read raises
`ClosureError`: a caller falls back to its widest key, never a narrower one by guess.

Standard library only.
"""

import ast
import re
from collections.abc import Callable, Iterable, Iterator, Sequence
from pathlib import PurePosixPath

DOTTED = re.compile(r"\A[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+(?::[A-Za-z_][\w.]*)?\Z")
"""A string naming a module: `a.b` or `a.b.c:attr`."""


class ClosureError(Exception):
    """The closure cannot be known from the source: a file does not parse or cannot be read."""


def closure(
    read: Callable[[str], bytes | None], entries: Sequence[str], tree: Iterable[str]
) -> frozenset[str]:
    """Every file of `tree` the `entries` can load (see the module)."""
    files = {str(PurePosixPath(name)) for name in tree}
    folders: dict[str, list[str]] = {}
    for name in files:
        folders.setdefault(str(PurePosixPath(name).parent), []).append(name)
    found: set[str] = set()
    todo: list[str] = []
    for entry in entries:
        entry = str(PurePosixPath(entry))
        if entry not in files:
            raise ClosureError(f"the entry {entry} is not in the tree")
        if is_test(entry):
            raise ClosureError(f"the entry {entry} is a test")
        todo.append(entry)
    while todo:
        name = todo.pop()
        if name in found or is_test(name):
            continue
        found.add(name)
        if not name.endswith(".py"):
            continue
        for module in _named(name, _source(read, name)):
            todo += _files_of(module, files)
        parent = str(PurePosixPath(name).parent)
        todo += [other for other in folders.get(parent, ()) if not other.endswith(".py")]
    return frozenset(found)


def is_test(name: str) -> bool:
    """A test or a test's helper: in a `tests` folder, `test_*.py`, or `conftest.py`."""
    path = PurePosixPath(name)
    return (
        "tests" in path.parts[:-1]
        or path.name == "conftest.py"
        or (path.name.startswith("test_") and path.suffix == ".py")
    )


def _source(read: Callable[[str], bytes | None], name: str) -> ast.Module:
    try:
        data = read(name)
    except Exception as error:
        raise ClosureError(f"{name} cannot be read: {type(error).__name__}") from None
    if data is None:
        raise ClosureError(f"{name} cannot be read")
    try:
        return ast.parse(data, filename=name)
    except (SyntaxError, ValueError) as error:
        raise ClosureError(f"{name} does not parse: {type(error).__name__}") from None


def _files_of(module: str, files: set[str]) -> list[str]:
    """The tree's files a module name loads: the module and each parent package's `__init__.py`."""
    parts = module.split(".")
    found = []
    for depth in range(1, len(parts) + 1):
        base = "/".join(parts[:depth])
        for candidate in (f"{base}.py", f"{base}/__init__.py"):
            if candidate in files:
                found.append(candidate)
    return found


def _package(name: str) -> list[str]:
    """The package a file's relative imports start from: its folder, as module parts."""
    return list(PurePosixPath(name).parent.parts)


def _type_checking(node: ast.If) -> bool:
    test = node.test
    return (isinstance(test, ast.Name) and test.id == "TYPE_CHECKING") or (
        isinstance(test, ast.Attribute) and test.attr == "TYPE_CHECKING"
    )


def _walk(node: ast.AST) -> Iterator[ast.AST]:
    """Every node at any depth, but those only a type checker runs (`if TYPE_CHECKING:`)."""
    yield node
    children: list[ast.AST] = list(ast.iter_child_nodes(node))
    if isinstance(node, ast.If) and _type_checking(node):
        children = list(node.orelse)
    for child in children:
        yield from _walk(child)


def _named(name: str, tree: ast.Module) -> Iterator[str]:
    """The module names a file can load: its imports (relative ones resolved) and dotted strings."""
    package = _package(name)
    for node in _walk(tree):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                if node.level - 1 > len(package):
                    continue
                base = package[: len(package) - node.level + 1]
                module = ".".join([*base, *([node.module] if node.module else [])])
            else:
                module = node.module or ""
            if module:
                yield module
            yield from (f"{module}.{alias.name}" if module else alias.name for alias in node.names)
        elif isinstance(node, ast.Constant) and isinstance(node.value, str) and DOTTED.match(node.value):
            yield node.value.split(":", 1)[0]
