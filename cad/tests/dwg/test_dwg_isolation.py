"""AC-3 — LibreDWG is reached as an isolated subprocess and nothing else (L-CAD-04).

The ban is judged over the parsed syntax of every module in the package, never over its text: a
scan that greps for the word `ctypes` would refuse a comment explaining why there is none, and
would miss `importlib.import_module("ctypes")` entirely.
"""

from __future__ import annotations

import ast
from pathlib import Path

#: cad/tests/dwg/ -> cad/
CAD_ROOT = Path(__file__).resolve().parent.parent.parent
PACKAGE_DIR = CAD_ROOT / "src" / "vextrus_cad" / "dwg"

#: A LibreDWG Python binding, and the two ways a shared library gets loaded in-process. L-CAD-04
#: admits the toolchain "in an isolated subprocess only".
BANNED_ROOTS = frozenset({"ctypes", "_ctypes", "cffi", "libredwg", "LibreDWG"})


def _modules() -> list[Path]:
    return sorted(PACKAGE_DIR.rglob("*.py"))


def _root_of(dotted: str | None) -> str | None:
    return dotted.split(".")[0] if dotted else None


def test_ac3_the_lane_is_a_package_with_modules_to_scan() -> None:
    assert PACKAGE_DIR.is_dir(), f"{PACKAGE_DIR} is missing — the DWG lane does not exist yet"
    assert (PACKAGE_DIR / "__init__.py").is_file(), "the lane re-exports its surface from __init__.py"
    assert _modules(), f"{PACKAGE_DIR} holds no module, so this scan would grade nothing"


def test_ac3_no_module_binds_libredwg_in_process() -> None:
    offenders: list[str] = []
    for module in _modules():
        tree = ast.parse(module.read_text(encoding="utf-8"), filename=str(module))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if _root_of(alias.name) in BANNED_ROOTS:
                        offenders.append(f"{module.name}:{node.lineno} imports {alias.name}")
            elif isinstance(node, ast.ImportFrom) and _root_of(node.module) in BANNED_ROOTS:
                offenders.append(f"{module.name}:{node.lineno} imports from {node.module}")
            elif isinstance(node, ast.Call):
                # `__import__("ctypes")` / `importlib.import_module("cffi")` are the same load.
                for argument in node.args:
                    if isinstance(argument, ast.Constant) and _root_of(
                        argument.value if isinstance(argument.value, str) else None
                    ) in BANNED_ROOTS:
                        offenders.append(f"{module.name}:{node.lineno} loads {argument.value}")

    assert offenders == [], "L-CAD-04 admits LibreDWG in an isolated subprocess only"


#: The two modules whose names a spawn is reached through; their aliases are resolved per module.
SPAWN_MODULES = frozenset({"os", "subprocess"})

#: Shelled-out spawns by definition: each routes its command through `/bin/sh -c` and carries no
#: `shell=` keyword to be caught.
SHELL_SPAWNS = frozenset({"os.system", "os.popen", "subprocess.getoutput", "subprocess.getstatusoutput"})

#: subprocess entry points whose ninth positional argument is Popen's `shell` slot.
POPEN_LIKE = frozenset({"Popen", "run", "call", "check_call", "check_output"})
POPEN_SHELL_SLOT = 8


def _spawn_aliases(tree: ast.AST) -> dict[str, str]:
    """`import subprocess as sp` / `from os import popen as p` -> local name -> dotted origin."""
    aliases: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in SPAWN_MODULES:
                    aliases[alias.asname or alias.name] = alias.name
        elif isinstance(node, ast.ImportFrom) and node.module in SPAWN_MODULES:
            for alias in node.names:
                aliases[alias.asname or alias.name] = f"{node.module}.{alias.name}"
    return aliases


def _callee_of(node: ast.Call, aliases: dict[str, str]) -> str:
    """The dotted name a call resolves to, with module and member aliases folded back to their origin."""
    dotted = ast.unparse(node.func)
    root, _, rest = dotted.partition(".")
    origin = aliases.get(root)
    if origin is None:
        return dotted
    return f"{origin}.{rest}" if rest else origin


def test_ac3_no_subprocess_is_spawned_through_a_shell() -> None:
    offenders: list[str] = []
    for module in _modules():
        tree = ast.parse(module.read_text(encoding="utf-8"), filename=str(module))
        aliases = _spawn_aliases(tree)
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module in SPAWN_MODULES:
                for alias in node.names:
                    if f"{node.module}.{alias.name}" in SHELL_SPAWNS:
                        offenders.append(
                            f"{module.name}:{node.lineno} imports {alias.name} from {node.module}"
                        )
                continue
            if not isinstance(node, ast.Call):
                continue
            callee = _callee_of(node, aliases)
            if callee in SHELL_SPAWNS:
                offenders.append(f"{module.name}:{node.lineno} spawns through a shell via {callee}")
            head, _, member = callee.rpartition(".")
            if head == "subprocess" and member in POPEN_LIKE and len(node.args) > POPEN_SHELL_SLOT:
                slot = node.args[POPEN_SHELL_SLOT]
                if not (isinstance(slot, ast.Constant) and slot.value is False):
                    offenders.append(
                        f"{module.name}:{node.lineno} passes shell positionally as {ast.unparse(slot)}"
                    )
            for keyword in node.keywords:
                if keyword.arg == "shell" and not (
                    isinstance(keyword.value, ast.Constant) and keyword.value.value is False
                ):
                    offenders.append(f"{module.name}:{node.lineno} passes shell={ast.unparse(keyword.value)}")

    assert offenders == [], "a shelled-out subprocess is not an isolated one"
