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
- every import by a name computed at run time, which fails closed: each call to `import_module`,
  `find_spec`, `__import__` or a lister (`submodules`, `pkgutil.iter_modules`, `walk_packages`), and
  each call to a declared loader (`LOADERS`) or any call given the module's own name, must name its
  module through a recognised form, or the closure raises `ClosureError`. The forms: a literal; a
  module-level constant (a literal bound once in the same module); a loop variable over a constant
  sequence of literals; the own name (`__name__`, `__package__`, `__spec__.name`, `__spec__.parent`,
  and `x.rpartition(".")[0]` or `x.rsplit(".", 1)[0]` of one); a plain variable after a known root;
  and an f-string, `+`, `%`, `.format` or `".".join` of these. A relative name resolves against the
  package given with it. What it loads: the module it names, or, for a lister, a loader or the own
  name passed on, its package whole; with a variable in it, every module it can name (a variable's
  value standing for any name parts). Anything else (a parameter, a table's entry, a method or a
  slice of the own name) raises. A logger's or an error's name loads nothing;
- each followed module's parent packages' `__init__.py`;
- and every file that is not Python in a followed file's own folder or in a folder below it that is no
  package (its data: conventions, schemas, fonts), whose bytes the code reads.

What it cannot see: a file read by a path built from more than its own folder, and what a declared
loader is given by a caller the closure does not reach by name (`getattr(module, "scan")`), and
what `engine.harness.resolve` is given (a stage table's entry, whose written targets it follows).
`scripts/real_drawings/tests/test_closure.py` runs the read job's imports under its settings and
checks every repository file it imports is in the closure.

Tests (a `tests` folder, `test_*.py`) and `conftest.py` are never entries and never followed. A file
that does not parse, an entry not in the tree, or a followed file that cannot be read raises
`ClosureError`: a caller falls back to its widest key, never a narrower one by guess.

Standard library only.
"""

import ast
import re
from collections.abc import Callable, Iterable, Iterator, Sequence
from dataclasses import dataclass
from pathlib import PurePosixPath

LISTERS = frozenset({"submodules", "iter_modules", "walk_packages"})
"""The calls that load a package's modules by listing its folder."""
IMPORTERS = frozenset({"import_module", "__import__", "find_spec"})
"""The calls that import a module by a name given at run time."""
LOADERS: dict[str, tuple[tuple[int | None, str], ...] | None] = {
    "engine.collect.submodules": ((0, "package"),),
    "engine.messages.collect_codes": ((0, "package"),),
    "engine.check.catalogue.scan": ((0, "package"),),
    "engine.check.catalogue.run": ((None, "package"),),
    "engine.harness.resolve": None,
}
"""The functions that import by a name their callers give (by parameter), so each call to one must
give a name a recognised form reads (or leave the parameter's default, read the same way): each
parameter by its position (None: keyword-only) and name. Inside
them nothing is refused. `engine.harness.resolve` (None) imports a stage's target, which the stage
table writes out as `module:function` strings the closure follows as dotted strings; its callers
pass a table's entry, which no form reads."""
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
    """A module name built in a form `_Names.pieces` does not read."""


@dataclass
class _Names:
    """What a file's module names can be built from: its own name and package, its module-level
    string constants (a literal bound once), and the loop variables over a constant sequence."""

    own: str
    package: str
    constants: dict[str, str]
    sequences: dict[str, list[str]]
    loops: dict[str, list[str]]

    def pieces(self, node: ast.AST) -> list[str | None]:
        """A module name's pieces in order: known text, or None for a variable's value. Anything
        but the recognised forms raises `_Unread` (fail closed): a literal; the own name
        (`__name__`, `__package__`, `__spec__.name`, `__spec__.parent`, `x.rpartition(".")[0]` or
        `x.rsplit(".", 1)[0]` of a known name); a module-level constant; a plain variable; and an
        f-string, `+`, `%` or `.format` of strings or a `".".join` of these."""
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return [node.value]
        if isinstance(node, ast.Name):
            if node.id in ("__name__", "__package__"):
                return [self.own if node.id == "__name__" else self.package]
            if node.id in SELF_NAMES:
                raise _Unread
            return [self.constants[node.id]] if node.id in self.constants else [None]
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            if node.value.id == "__spec__" and node.attr in ("name", "parent"):
                return [self.own if node.attr == "name" else self.package]
            raise _Unread
        if isinstance(node, ast.JoinedStr):
            found: list[str | None] = []
            for value in node.values:
                found += self.pieces(value.value if isinstance(value, ast.FormattedValue) else value)
            return found
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            return self.pieces(node.left) + self.pieces(node.right)
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod) and _text(node.left) is not None:
            values = node.right.elts if isinstance(node.right, ast.Tuple) else [node.right]
            return self._fill(re.split(r"%[sr]", str(_text(node.left))), values)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and not node.keywords:
            text = _text(node.func.value)
            if text is not None and node.func.attr == "format":
                return self._fill(re.split(r"\{\}", text), node.args)
            items = node.args[0] if len(node.args) == 1 else None
            if (
                text is not None
                and node.func.attr == "join"
                and isinstance(items, (ast.List, ast.Tuple))
            ):
                joined: list[str | None] = []
                for index, item in enumerate(items.elts):
                    joined += ([text] if index else []) + self.pieces(item)
                return joined
        parent = _parent_of(node) if isinstance(node, ast.Subscript) else None
        if parent is not None:
            whole = self.pieces(parent)
            if None in whole:
                raise _Unread
            return ["".join(str(piece) for piece in whole).rpartition(".")[0]]
        raise _Unread

    def _fill(self, texts: list[str], values: list[ast.expr]) -> list[str | None]:
        """Format texts with one value between each two (`%s`, `{}`); anything else is not read."""
        if len(texts) != len(values) + 1 or any(
            "%" in t.replace("%%", "") or "{" in t or "}" in t for t in texts
        ):
            raise _Unread
        found: list[str | None] = [texts[0]]
        for value, text in zip(values, texts[1:], strict=True):
            found += [*self.pieces(value), text]
        return found


def _text(node: ast.AST) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


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


def _constants(tree: ast.Module) -> tuple[dict[str, str], dict[str, list[str]]]:
    """The module-level names bound once, and only there, to a string literal or to a tuple or list
    of string literals."""
    stored: dict[str, int] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)):
            stored[node.id] = stored.get(node.id, 0) + 1
    strings, sequences = {}, {}
    for statement in tree.body:
        target, value = None, None
        if isinstance(statement, ast.Assign) and len(statement.targets) == 1:
            target, value = statement.targets[0], statement.value
        elif isinstance(statement, ast.AnnAssign) and statement.value is not None:
            target, value = statement.target, statement.value
        if value is None or not (isinstance(target, ast.Name) and stored.get(target.id) == 1):
            continue
        if _text(value) is not None:
            strings[target.id] = str(_text(value))
        elif isinstance(value, (ast.Tuple, ast.List)) and all(_text(v) is not None for v in value.elts):
            sequences[target.id] = [str(_text(v)) for v in value.elts]
    return strings, sequences


def _loops(tree: ast.Module, sequences: dict[str, list[str]]) -> dict[str, list[str]]:
    """The loop variables (a `for` or a comprehension's) over a constant sequence of string literals,
    each with the values it takes; only a name the module binds nowhere else."""
    stored: dict[str, int] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)):
            stored[node.id] = stored.get(node.id, 0) + 1
    found: dict[str, list[str]] = {}
    bound: dict[str, int] = {}
    for node in ast.walk(tree):
        if not (isinstance(node, (ast.For, ast.comprehension)) and isinstance(node.target, ast.Name)):
            continue
        values = sequences.get(node.iter.id) if isinstance(node.iter, ast.Name) else None
        if isinstance(node.iter, (ast.Tuple, ast.List)) and all(
            _text(v) is not None for v in node.iter.elts
        ):
            values = [str(_text(v)) for v in node.iter.elts]
        if values is not None:
            found.setdefault(node.target.id, []).extend(values)
            bound[node.target.id] = bound.get(node.target.id, 0) + 1
    return {key: values for key, values in found.items() if bound[key] == stored.get(key)}


def _aliases(name: str, tree: ast.Module) -> dict[str, str]:
    """What each name a file binds by an import or a `def` stands for, as a dotted name."""
    package = _package(name)
    found = {
        node.name: f"{_module_name(name)}.{node.name}"
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
    }
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found[alias.asname or alias.name.split(".")[0]] = (
                    alias.name if alias.asname else alias.name.split(".")[0]
                )
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level:
                parts = package[: len(package) - node.level + 1]
                base = ".".join([*parts, *([node.module] if node.module else [])])
            for alias in node.names:
                found[alias.asname or alias.name] = f"{base}.{alias.name}"
    return found


def _function_value(call: ast.Call) -> ast.AST:
    """What a method is called on (`"."` in `".".join(...)`), or the call itself."""
    return call.func.value if isinstance(call.func, ast.Attribute) else call


def _dotted(call: ast.Call, aliases: dict[str, str]) -> str:
    function = call.func
    if isinstance(function, ast.Name):
        return aliases.get(function.id, function.id)
    if isinstance(function, ast.Attribute) and isinstance(function.value, ast.Name):
        return f"{aliases.get(function.value.id, function.value.id)}.{function.attr}"
    return ""


def _dynamic(name: str, tree: ast.Module) -> tuple[list[re.Pattern[str]], list[str]]:
    """The modules a file loads by a name computed at run time (see the module), as patterns over
    module names and as packages loaded whole; `ClosureError` for any such name no recognised form
    reads."""
    strings, sequences = _constants(tree)
    names = _Names(
        _module_name(name), ".".join(_package(name)), strings, sequences, _loops(tree, sequences)
    )
    aliases = _aliases(name, tree)
    patterns: list[re.Pattern[str]] = []
    packages: list[str] = []

    def refuse(node: ast.AST, why: str) -> ClosureError:
        return ClosureError(f"{name}:{getattr(node, 'lineno', '?')} {why}, so the closure is not known")

    def loads(node: ast.AST, *, whole: bool, base: str = "", dots: str = "") -> None:
        r"""What a module name loads: the module, or with `whole` its package entire; one with a
        variable's value in it, every module it can name (`[\w.]+` per value)."""
        if isinstance(node, ast.Name) and node.id in names.loops:
            for value in names.loops[node.id]:
                patterns.append(re.compile(re.escape(value)))
            return
        if isinstance(node, ast.Name) and node.id in names.sequences:
            raise refuse(node, "names a module by a whole sequence")
        try:
            pieces = [p for p in [dots, *names.pieces(node)] if p != ""]
        except _Unread:
            raise refuse(node, "computes a module name in a form the closure does not read") from None
        head = pieces[0] if pieces else None
        if isinstance(head, str) and head.startswith("."):
            if not base:
                raise refuse(node, "imports a relative name against no known package")
            level = len(head) - len(head.lstrip("."))
            parts = base.split(".")
            pieces = [".".join(parts[: len(parts) - level + 1]), f".{head[level:]}", *pieces[1:]]
        if not pieces or not isinstance(pieces[0], str) or not re.match(SEGMENT, pieces[0]):
            raise refuse(node, "computes a module name whose root is not known")
        if None not in pieces:
            text = "".join(str(p) for p in pieces).rstrip(".")
            if whole:
                packages.append(text)
            else:
                patterns.append(re.compile(re.escape(text)))
            return
        patterns.append(
            re.compile("".join(re.escape(p) if p is not None else r"[A-Za-z0-9_.]+" for p in pieces))
        )

    def package_of(node: ast.AST | None) -> str:
        """The package a relative name is resolved against, or "" when none is given."""
        if node is None:
            return ""
        try:
            known = names.pieces(node)
        except _Unread:
            raise refuse(node, "gives a package the closure does not read") from None
        if None in known:
            raise refuse(node, "imports a relative name against no known package")
        return "".join(str(p) for p in known)

    def importer(call: ast.Call, callee: str) -> None:
        """A call that imports, or lists, by a name given at run time: resolved, or refused."""
        if callee in ("iter_modules", "walk_packages"):
            given = [*call.args, *(k.value for k in call.keywords)]
            if not any(
                isinstance(n, ast.Name) and n.id in ("__path__", "__file__")
                for a in given
                for n in ast.walk(a)
            ):
                raise refuse(call, f"lists folders by {callee} the closure cannot name")
            packages.append(names.package)
            return
        target = (
            call.args[0]
            if call.args
            else _keyword(call, "package" if callee == "submodules" else "name")
        )
        if target is None:
            raise refuse(call, f"calls {callee} with no name")
        if callee == "submodules":
            loads(target, whole=True)
        elif callee == "__import__":
            level = call.args[4] if len(call.args) > 4 else _keyword(call, "level")
            if level is not None and not (
                isinstance(level, ast.Constant) and isinstance(level.value, int)
            ):
                raise refuse(call, "imports at a level not known")
            count = (
                level.value if isinstance(level, ast.Constant) and isinstance(level.value, int) else 0
            )
            loads(target, whole=False, base=names.package if count else "", dots="." * count)
        else:
            where = call.args[1] if len(call.args) > 1 else _keyword(call, "package")
            loads(target, whole=False, base=package_of(where))

    def loader(call: ast.Call, parameters: tuple[tuple[int | None, str], ...]) -> None:
        """A call to a declared loader: each parameter it is given must be read."""
        if any(isinstance(a, ast.Starred) for a in call.args) or any(
            k.arg is None for k in call.keywords
        ):
            raise refuse(call, "gives a loader its names by unpacking")
        for position, parameter in parameters:
            positional = position is not None and len(call.args) > position
            given = call.args[position] if positional else _keyword(call, parameter)  # type: ignore[index]
            if given is not None:
                loads(given, whole=True)

    def visit(node: ast.AST, inside: str) -> None:
        if isinstance(node, ast.If) and _type_checking(node):
            for statement in node.orelse:
                visit(statement, inside)
            return
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            dotted = f"{names.own}.{node.name}"
            if LOADERS.get(dotted):
                defaults = {
                    **{
                        a.arg: d
                        for a, d in zip(node.args.kwonlyargs, node.args.kw_defaults, strict=True)
                        if d
                    },
                    **dict(
                        zip(
                            [a.arg for a in node.args.args][::-1], node.args.defaults[::-1], strict=False
                        )
                    ),
                }
                for _position, parameter in LOADERS[dotted] or ():
                    if parameter in defaults:
                        loads(defaults[parameter], whole=True)
            inside = dotted if dotted in LOADERS else inside
        if isinstance(node, ast.Call) and not inside:
            callee = _callee(node)
            dotted = _dotted(node, aliases)
            if callee == "getLogger" or callee.endswith(("Error", "Exception", "Warning")):
                return  # a logger's or an error's name loads nothing
            if callee in IMPORTERS or callee in LISTERS:
                importer(node, callee)
            elif dotted in LOADERS:
                if LOADERS[dotted] is not None:
                    loader(node, LOADERS[dotted] or ())
            elif not (callee in ("format", "join") and _text(_function_value(node)) is not None):
                for given in [*node.args, *(k.value for k in node.keywords)]:
                    if _refers_to_self(given):
                        own_name(given)
        for child in ast.iter_child_nodes(node):
            visit(child, inside)

    def own_name(node: ast.AST) -> None:
        """An argument built on the module's own name, given to any other call: read, or refused."""
        if isinstance(node, ast.Name) and node.id == "__spec__":
            return  # the spec itself is no name
        try:
            pieces = [p for p in names.pieces(node) if p != ""]
        except _Unread:
            raise refuse(node, "passes its own name on in a form the closure does not read") from None
        if None not in pieces:
            text = "".join(str(p) for p in pieces)
            if re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*", text):
                packages.append(text)
            return
        loads(node, whole=True)

    visit(tree, "")
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
