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
- every name built at run time (an f-string, a `+`, a `%` or `.format` of strings, a `".".join`)
  whose root is written out (`f"vextrus.{name}.library"`), as each module of the tree it can name, one
  name part per unknown piece;
- in every module, not only an `__init__.py`: a name built on the module's own name (`__name__`,
  `__package__`, `__spec__.name`, `__spec__.parent`, `x.rpartition(".")[0]` of one), or a relative
  name given to `import_module`, `find_spec` or `__import__` with its package, loads the package
  before the first unknown piece whole, at any depth (a lazy `__getattr__`'s
  `import_module(f"{__name__}.{name}")`, `submodules(__package__)`, `collect_codes(__name__)`); a
  name built on the module's own name in any other form, or a relative one against no known package,
  raises `ClosureError` (fail closed). A logger's or an error's name (`getLogger(__name__)`,
  `AttributeError(f"{__name__} ...")`) and a comparison (`__name__ == "__main__"`) load nothing;
- a package found by listing its folder (`engine.collect.submodules`, `pkgutil`): a file that calls
  `submodules`, `iter_modules` or `walk_packages` loads every module of each package a string in it
  names, and of its own package when the call is given its own name, `__file__` or `__path__`;
- each followed module's parent packages' `__init__.py`;
- and every file that is not Python in a followed file's own folder or in a folder below it that is no
  package (its data: conventions, schemas, fonts), whose bytes the code reads.

What it cannot see: a module imported by a name held in a variable that is not built on the module's
own name (`import_module(name)`, `f"{package}.{name}"` with `package` a parameter) and that no string,
built name or listing above names; and a file read by a path built from more than its own folder.

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
IMPORTERS = frozenset({"import_module", "__import__", "find_spec"})
"""The calls that import a module by a name given at run time."""
SELF_NAMES = frozenset({"__name__", "__package__", "__spec__"})
"""The module's own name, from which a sibling's can be built."""

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
        patterns, packages = _dynamic(name, source)
        for pattern in patterns:
            for module in filter(pattern.fullmatch, modules):
                todo += _files_of(module, files)
        for package in packages:
            todo += _package_files(package, files)
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


def _package_files(package: str, files: set[str]) -> list[str]:
    """Every module of a package, at any depth (a module named as a package is itself)."""
    folder = package.replace(".", "/")
    if f"{folder}/__init__.py" not in files:
        return [f"{folder}.py"] if f"{folder}.py" in files else []
    return [f for f in files if f.startswith(f"{folder}/") and f.endswith(".py")]


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


class _Unread(Exception):
    """A name built from the module's own name in a form `_pieces` does not read."""


def _pieces(node: ast.AST, own: str, package: str) -> list[str | None]:
    """A string expression's pieces in order: each known text, or None for a value not known from the
    source. The module's own name is known (`__name__`, `__package__`, `__spec__.name` and
    `.parent`); a form that builds on it but is not one of these raises `_Unread`."""
    if isinstance(node, ast.Constant):
        return [node.value] if isinstance(node.value, str) else [None]
    if isinstance(node, ast.Name):
        if node.id in ("__name__", "__package__"):
            return [own if node.id == "__name__" else package]
        return _unknown(node)
    if (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "__spec__"
    ):
        if node.attr in ("name", "parent"):
            return [own if node.attr == "name" else package]
        raise _Unread
    if isinstance(node, ast.JoinedStr):
        found: list[str | None] = []
        for value in node.values:
            inner = value.value if isinstance(value, ast.FormattedValue) else value
            found += _pieces(inner, own, package)
        return found
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return _pieces(node.left, own, package) + _pieces(node.right, own, package)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod) and _text(node.left) is not None:
        values = node.right.elts if isinstance(node.right, ast.Tuple) else [node.right]
        return _fill(re.split(r"%[sr]", str(_text(node.left))), values, own, package, node)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        text = _text(node.func.value)
        if text is not None and node.func.attr == "format" and not node.keywords:
            texts = re.split(r"\{\}", text)
            return _fill(texts, node.args, own, package, node)
        if text is not None and node.func.attr == "join" and len(node.args) == 1:
            items = node.args[0]
            if isinstance(items, (ast.List, ast.Tuple)) and items.elts:
                joined: list[str | None] = []
                for index, item in enumerate(items.elts):
                    joined += ([text] if index else []) + _pieces(item, own, package)
                return joined
    parent = _parent_of(node) if isinstance(node, ast.Subscript) else None
    if parent is not None:
        whole = _pieces(parent, own, package)
        if None in whole:
            return _unknown(node)
        return ["".join(str(piece) for piece in whole).rpartition(".")[0]]
    return _unknown(node)


def _unknown(node: ast.AST) -> list[str | None]:
    if _refers_to_self(node):
        raise _Unread
    return [None]


def _text(node: ast.AST) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def _fill(
    texts: list[str], values: list[ast.expr], own: str, package: str, node: ast.AST
) -> list[str | None]:
    """Format texts with one value between each two (`%s`, `{}`); anything else is not read."""
    if len(texts) != len(values) + 1 or any(
        "%" in t.replace("%%", "") or "{" in t or "}" in t for t in texts
    ):
        return _unknown(node)
    found: list[str | None] = [texts[0]]
    for value, text in zip(values, texts[1:], strict=True):
        found += [*_pieces(value, own, package), text]
    return found


def _parent_of(node: ast.Subscript) -> ast.expr | None:
    """`x.rpartition(".")[0]` or `x.rsplit(".", 1)[0]`: x, whose parent package it names."""
    call = node.value
    if not (
        isinstance(node.slice, ast.Constant)
        and node.slice.value == 0
        and isinstance(call, ast.Call)
        and isinstance(call.func, ast.Attribute)
        and not call.keywords
    ):
        return None
    given = [a.value if isinstance(a, ast.Constant) else None for a in call.args]
    wanted: dict[str, list[object]] = {"rpartition": ["."], "rsplit": [".", 1]}
    return call.func.value if given == wanted.get(call.func.attr) else None


def _refers_to_self(node: ast.AST) -> bool:
    return any(isinstance(n, ast.Name) and n.id in SELF_NAMES for n in ast.walk(node))


def _is_self(node: ast.AST) -> bool:
    return (isinstance(node, ast.Name) and node.id in SELF_NAMES) or (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "__spec__"
    )


BUILT = (ast.JoinedStr, ast.BinOp, ast.Subscript, ast.Call, ast.Name, ast.Attribute)


def _dynamic(name: str, tree: ast.Module) -> tuple[list[re.Pattern[str]], list[str]]:
    """The modules a file loads by a name built at run time, as patterns over module names, and the
    packages it loads whole (see the module); `ClosureError` for a name built from its own name that
    no recognised form reads."""
    own, package = _module_name(name), ".".join(_package(name))
    patterns: list[re.Pattern[str]] = []
    packages: list[str] = []
    listing = False

    def take(node: ast.AST) -> bool:
        """Reads one built name; True when `node` was one (its parts are not visited again)."""
        if isinstance(node, ast.Call) and _callee(node) not in ("format", "join"):
            return False
        if isinstance(node, (ast.Name, ast.Attribute)) and not _is_self(node):
            return False
        if isinstance(node, ast.BinOp) and not isinstance(node.op, (ast.Add, ast.Mod)):
            return False
        if isinstance(node, ast.Subscript) and _parent_of(node) is None:
            return False
        if isinstance(node, ast.Name) and node.id == "__spec__":
            return True  # the spec itself, a test or a reload of this module: no sibling's name
        selfish = _refers_to_self(node)
        try:
            pieces = [piece for piece in _pieces(node, own, package) if piece != ""]
        except _Unread:
            line = getattr(node, "lineno", "?")
            raise ClosureError(
                f"{name}:{line} builds a module name from its own name in a form the closure does"
                " not read"
            ) from None
        add(pieces, selfish, getattr(node, "lineno", "?"))
        return True

    def add(pieces: list[str | None], wide: bool, line: object) -> None:
        """A name's pieces as what it loads. `wide` (built on the module's own name, or relative):
        the package before the first unknown piece, whole; else each module it can name, one name
        part per unknown piece."""
        if not pieces:
            return
        cut = next((i for i, piece in enumerate(pieces) if piece is None), len(pieces))
        known = "".join(str(piece) for piece in pieces[:cut])
        if cut == len(pieces):
            if wide:
                packages.append(known.rstrip("."))
            elif re.fullmatch(r"[A-Za-z_][\w.]*", known):
                patterns.append(re.compile(re.escape(known)))
            return
        if wide:
            whole = known[:-1] if known.endswith(".") else known.rpartition(".")[0]
            if not re.fullmatch(r"[A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)*", whole):
                raise ClosureError(f"{name}:{line} builds a module name whose root is not known")
            packages.append(whole)
        elif re.match(SEGMENT, known):
            text = "".join(re.escape(p) if p is not None else SEGMENT for p in pieces)
            patterns.append(re.compile(text.split(":", 1)[0]))

    def relative(call: ast.Call) -> None:
        """`import_module(".x", package)` and `__import__(name, ..., level)`: against the package."""
        callee = _callee(call)
        target = call.args[0] if call.args else _keyword(call, "name")
        if target is None:
            return
        if callee == "__import__":
            level = call.args[4] if len(call.args) > 4 else _keyword(call, "level")
            if level is None or (isinstance(level, ast.Constant) and level.value == 0):
                return
            if not (isinstance(level, ast.Constant) and isinstance(level.value, int)):
                raise ClosureError(f"{name}:{call.lineno} imports at a level not known")
            dots, base = "." * level.value, package
        else:
            dots, base = "", ""
            where = call.args[1] if len(call.args) > 1 else _keyword(call, "package")
            if where is not None:
                try:
                    known = _pieces(where, own, package)
                except _Unread:
                    known = [None]
                base = "".join(str(p) for p in known) if None not in known else ""
        try:
            pieces = [p for p in [dots, *_pieces(target, own, package)] if p != ""]
        except _Unread:
            return  # take() refuses it
        head = pieces[0] if pieces else None
        if not (isinstance(head, str) and head.startswith(".")):
            return
        level_count = len(head) - len(head.lstrip("."))
        if not base:
            raise ClosureError(f"{name}:{call.lineno} imports a relative name against no known package")
        parts = base.split(".")
        root = ".".join(parts[: len(parts) - level_count + 1])
        rest = head[level_count:]
        add([root, f".{rest}", *pieces[1:]], True, call.lineno)

    def visit(node: ast.AST) -> None:
        nonlocal listing
        if isinstance(node, ast.If) and _type_checking(node):
            for statement in node.orelse:
                visit(statement)
            return
        if isinstance(node, ast.Call):
            callee = _callee(node)
            if callee == "getLogger" or callee.endswith(("Error", "Exception", "Warning")):
                return  # a logger's or an error's name loads nothing
            if callee in LISTERS:
                listing = True
                own_folder = ("__file__", "__path__", *SELF_NAMES)
                arguments = [*node.args, *(k.value for k in node.keywords)]
                if any(
                    isinstance(n, ast.Name) and n.id in own_folder
                    for a in arguments
                    for n in ast.walk(a)
                ):
                    packages.append(package)
            if callee in IMPORTERS:
                relative(node)
        if isinstance(node, ast.Compare):
            for side in (node.left, *node.comparators):
                if not _is_self(side):
                    visit(side)
            return
        if isinstance(node, BUILT) and take(node):
            return
        for child in ast.iter_child_nodes(node):
            visit(child)

    visit(tree)  # the module itself, whose statements are its children
    if listing:
        packages += [
            node.value.split(":", 1)[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and (DOTTED.match(node.value) or re.fullmatch(SEGMENT, node.value))
        ]
    return patterns, packages


def _keyword(call: ast.Call, key: str) -> ast.expr | None:
    return next((k.value for k in call.keywords if k.arg == key), None)


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
