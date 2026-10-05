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
- every import written inside a string (`python -c "from a.b import c"`, a child process's code);
- every f-string whose root is written out (`f"vextrus.{name}.library"`, a module found by a computed
  name), as each module of the tree it can name, one name part per `{}` (`{__name__}` the file's own);
- a package found by listing its folder (`engine.collect.submodules`, `pkgutil`): a file that calls a
  function with `__name__` (or `__package__`) loads every module of its own package, and a file that
  calls `submodules`, `iter_modules` or `walk_packages` every module of each package a string in it
  names (each direct module and subpackage, which are then followed);
- each followed module's parent packages' `__init__.py`;
- and every file that is not Python in a followed file's own folder or in a folder below it that is no
  package (its data: conventions, schemas, fonts), whose bytes the code reads.

What it cannot see: a module imported by a name held in a variable (`import_module(name)`) that no
string or f-string above names, and a file read by a path built from more than its own folder.

Tests (a `tests` folder, `test_*.py`) and `conftest.py` are never entries and never followed. A file
that does not parse, an entry not in the tree, or a followed file that cannot be read raises
`ClosureError`: a caller falls back to its widest key, never a narrower one by guess.

Standard library only.
"""

import ast
import re
from collections.abc import Callable, Iterable, Iterator, Sequence
from pathlib import PurePosixPath

LISTERS = frozenset({"submodules", "iter_modules", "walk_packages"})
"""The calls that load a package's modules by listing its folder."""
SEGMENT = r"[A-Za-z_][A-Za-z0-9_]*"
DOTTED = re.compile(r"\A[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+(?::[A-Za-z_][\w.]*)?\Z")
"""A string naming a module: `a.b` or `a.b.c:attr`."""
CODE_IMPORT = re.compile(
    r"(?<![\w.])(?:from\s+([A-Za-z_][\w.]*)\s+import\s+([\w\s,()]+)|import\s+([A-Za-z_][\w.]*))"
)
"""An import written inside a string: code another interpreter runs (`python -c "from a import b"`)."""


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
    modules = _modules(files)
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
        source = _source(read, name)
        for module in _named(name, source):
            todo += _files_of(module, files)
        for pattern in _patterns(name, source):
            for module in filter(pattern.fullmatch, modules):
                todo += _files_of(module, files)
        for package in _listed(name, source):
            todo += _package_files(package.replace(".", "/"), folders)
        todo += _data(str(PurePosixPath(name).parent), folders)
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


def _modules(files: set[str]) -> dict[str, str]:
    """Every Python module of the tree by its dotted name, and its file."""
    found = {}
    for name in files:
        path = PurePosixPath(name)
        if path.suffix != ".py" or is_test(name):
            continue
        parts = path.parent.parts if path.name == "__init__.py" else path.with_suffix("").parts
        if parts and all(re.fullmatch(SEGMENT, part) for part in parts):
            found[".".join(parts)] = name
    return found


def _data(folder: str, folders: dict[str, list[str]]) -> list[str]:
    """The files that are not Python in a folder and in every folder below it that is no package (nor
    a `tests` folder, nor below one)."""
    found = [name for name in folders.get(folder, ()) if not name.endswith(".py")]
    top = PurePosixPath(folder)
    for below in folders:
        path = PurePosixPath(below)
        if path == top or top not in path.parents:
            continue
        chain = [
            top.joinpath(*path.relative_to(top).parts[: i + 1])
            for i in range(len(path.parts) - len(top.parts))
        ]
        if any(
            step.name == "tests" or f"{step}/__init__.py" in folders.get(str(step), ()) for step in chain
        ):
            continue
        found += [name for name in folders[below] if not name.endswith(".py")]
    return found


def _package_files(folder: str, folders: dict[str, list[str]]) -> list[str]:
    """A package's modules found by listing its folder: its direct modules and subpackages."""
    if f"{folder}/__init__.py" not in folders.get(folder, ()):
        return []
    found = [name for name in folders[folder] if name.endswith(".py")]
    for below, names in folders.items():
        init = f"{below}/__init__.py"
        if str(PurePosixPath(below).parent) == folder and init in names:
            found.append(init)
    return found


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


def _module_name(name: str) -> str:
    path = PurePosixPath(name)
    parts = path.parent.parts if path.name == "__init__.py" else path.with_suffix("").parts
    return ".".join(parts)


def _patterns(name: str, tree: ast.Module) -> Iterator[re.Pattern[str]]:
    """The module names an f-string with a written-out root can be: one name part per `{}`."""
    own = re.escape(_module_name(name))
    for node in _walk(tree):
        if not isinstance(node, ast.JoinedStr) or not node.values:
            continue
        first = node.values[0]
        if not (isinstance(first, ast.Constant) and re.match(SEGMENT, str(first.value))):
            continue  # the root is not written out: any module could be meant
        pieces = []
        for value in node.values:
            if isinstance(value, ast.FormattedValue):
                named = value.value
                dunder = isinstance(named, ast.Name) and named.id in ("__name__", "__package__")
                pieces.append(own if dunder else SEGMENT)
                continue
            text = str(value.value) if isinstance(value, ast.Constant) else "?"
            head, colon, _attr = text.partition(":")
            if not re.fullmatch(r"[A-Za-z0-9_.]*", head):
                pieces = []  # not a module's name
                break
            pieces.append(re.escape(head))
            if colon:
                break  # an attribute follows
        if len(pieces) > 1 and r"\." in "".join(pieces):
            yield re.compile("".join(pieces))


def _listed(name: str, tree: ast.Module) -> Iterator[str]:
    """The packages a file loads by listing their folders (see the module): its own, when a package's
    `__init__.py` calls a function with `__name__`; each one a string names, when it calls a lister."""
    calls = [node for node in _walk(tree) if isinstance(node, ast.Call)]
    if PurePosixPath(name).name == "__init__.py":
        for call in calls:
            arguments = [*call.args, *(keyword.value for keyword in call.keywords)]
            if _callee(call) != "getLogger" and any(
                isinstance(a, ast.Name) and a.id in ("__name__", "__package__") for a in arguments
            ):
                yield _module_name(name)
    if any(_callee(call) in LISTERS for call in calls):
        for node in _walk(tree):
            if (
                isinstance(node, ast.Constant)
                and isinstance(node.value, str)
                and (DOTTED.match(node.value) or re.fullmatch(SEGMENT, node.value))
            ):
                yield node.value.split(":", 1)[0]


def _imports_in_text(text: str) -> Iterator[str]:
    """The modules the imports written in a string name (a prose word after "import" names none)."""
    for match in CODE_IMPORT.finditer(text):
        module, names, plain = match.groups()
        if plain:
            yield plain
            continue
        yield module
        yield from (f"{module}.{name}" for name in re.findall(r"[A-Za-z_]\w*", names))


def _callee(call: ast.Call) -> str:
    function = call.func
    if isinstance(function, ast.Name):
        return function.id
    return function.attr if isinstance(function, ast.Attribute) else ""


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
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            if DOTTED.match(node.value):
                yield node.value.split(":", 1)[0]
            yield from _imports_in_text(node.value)
