"""The `fixtures` dependency group stays out of the app (D-04).

`uv run --group fixtures` syncs the group into the shared cad/.venv and a later plain `uv run` does
not remove it, so an accidental `import reportlab` in vextrus_cad would pass every local run and
only fail on a clean machine. This scan reads the app's sources instead of trusting the venv: no
module under src/vextrus_cad may import a distribution resident only because of the `fixtures`
group — the group's own pins and everything they pull in transitively (closed over cad/uv.lock),
minus whatever the shipped dependencies pull in on their own.
"""

from __future__ import annotations

import ast
import tomllib
from pathlib import Path

import pytest

CAD_ROOT = Path(__file__).resolve().parents[2]
PYPROJECT = CAD_ROOT / "pyproject.toml"
LOCK = CAD_ROOT / "uv.lock"
PACKAGE = CAD_ROOT / "src" / "vextrus_cad"

#: Import names that differ from the distribution's own name beyond the `-` → `_` rule (pillow is
#: imported as PIL). Anything else maps by that rule, or by the venv's top_level.txt when present.
MODULE_OF = {"pillow": "PIL"}


def requirement_name(entry: str) -> str:
    head = entry.split(";")[0]
    for stop in "=<>!~[ ":
        head = head.split(stop)[0]
    return head.strip().lower().replace("_", "-")


def locked_edges() -> dict[str, set[str]]:
    lock = tomllib.loads(LOCK.read_text(encoding="utf-8"))
    return {
        requirement_name(p["name"]): {requirement_name(d["name"]) for d in p.get("dependencies", [])}
        for p in lock["package"]
    }


def closure(roots: set[str], edges: dict[str, set[str]]) -> set[str]:
    seen: set[str] = set()
    todo = list(roots)
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        todo.extend(edges.get(name, set()))
    return seen


def import_names(distribution: str) -> set[str]:
    if distribution in MODULE_OF:
        return {MODULE_OF[distribution]}
    stem = distribution.replace("-", "_")
    for info in CAD_ROOT.glob(f".venv/lib/python*/site-packages/{stem}-*.dist-info/top_level.txt"):
        lines = info.read_text(encoding="utf-8").splitlines()
        return {line.strip().split(".")[0] for line in lines if line.strip()}
    return {stem}


def fixtures_only_distributions() -> set[str]:
    manifest = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    edges = locked_edges()
    shipped = closure({requirement_name(e) for e in manifest["project"].get("dependencies", [])}, edges)
    group = manifest["dependency-groups"]["fixtures"]
    pinned = {requirement_name(e) for e in group if isinstance(e, str)}
    return closure(pinned, edges) - shipped


def fixtures_only_modules() -> set[str]:
    modules: set[str] = set()
    for distribution in fixtures_only_distributions():
        modules |= import_names(distribution)
    return modules


def imported_roots(module: Path) -> set[str]:
    tree = ast.parse(module.read_text(encoding="utf-8"), filename=str(module))
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots.add(node.module.split(".")[0])
    return roots


def test_fixtures_group_is_declared_apart_from_the_app() -> None:
    manifest = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    shipped = {requirement_name(e) for e in manifest["project"].get("dependencies", [])}
    group = manifest["dependency-groups"]["fixtures"]
    pinned = {requirement_name(e) for e in group if isinstance(e, str)}
    assert pinned, "the fixtures group pins nothing"
    assert "reportlab" in pinned, "D-04's vector writer is provided by the fixtures group"
    assert not pinned & shipped, f"pinned by both the app and the fixtures group: {sorted(pinned & shipped)}"
    assert "reportlab" in fixtures_only_distributions()


def test_the_app_package_has_modules_to_scan() -> None:
    assert PACKAGE.is_dir(), f"{PACKAGE} is missing — the leak scan below would grade nothing"
    assert list(PACKAGE.rglob("*.py")), f"{PACKAGE} holds no module, so the leak scan would grade nothing"


@pytest.mark.parametrize("module", sorted(PACKAGE.rglob("*.py")), ids=lambda p: str(p.relative_to(PACKAGE)))
def test_app_module_imports_nothing_from_the_fixtures_group(module: Path) -> None:
    leaked = imported_roots(module) & fixtures_only_modules()
    assert not leaked, f"{module.relative_to(CAD_ROOT)} imports the fixtures-only {sorted(leaked)}"


def test_scan_sees_a_planted_import_of_every_fixtures_only_module(tmp_path: Path) -> None:
    fixtures_only = fixtures_only_modules()
    assert {"reportlab", "PIL"} <= fixtures_only
    planted = tmp_path / "leak.py"
    planted.write_text("".join(f"import {name}\n" for name in sorted(fixtures_only)), encoding="utf-8")
    assert imported_roots(planted) & fixtures_only == fixtures_only
