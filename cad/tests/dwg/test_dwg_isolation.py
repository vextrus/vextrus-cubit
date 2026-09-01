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


def test_ac3_no_subprocess_is_spawned_through_a_shell() -> None:
    offenders: list[str] = []
    for module in _modules():
        tree = ast.parse(module.read_text(encoding="utf-8"), filename=str(module))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            for keyword in node.keywords:
                if keyword.arg == "shell" and not (
                    isinstance(keyword.value, ast.Constant) and keyword.value.value is False
                ):
                    offenders.append(f"{module.name}:{node.lineno} passes shell={ast.unparse(keyword.value)}")

    assert offenders == [], "a shelled-out subprocess is not an isolated one"
