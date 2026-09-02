"""The `fixtures` dependency group stays out of the app (D-04).

`uv run --group fixtures` syncs the group into the shared cad/.venv and a later plain `uv run` does
not remove it, so an accidental `import reportlab` in vextrus_cad would pass every local run and
only fail on a clean machine. This scan reads the app's sources instead of trusting the venv: no
module under src/vextrus_cad may import a distribution that only the `fixtures` group provides.
"""

from __future__ import annotations

import ast
import tomllib
from pathlib import Path

import pytest

CAD_ROOT = Path(__file__).resolve().parents[2]
PYPROJECT = CAD_ROOT / "pyproject.toml"
PACKAGE = CAD_ROOT / "src" / "vextrus_cad"

#: Import names of the distributions the group may pin (a distribution's module is not always its
#: own name: pillow is imported as PIL).
MODULE_OF = {"reportlab": "reportlab", "pillow": "PIL", "pypdfium2": "pypdfium2"}


def requirement_name(entry: str) -> str:
    head = entry.split(";")[0]
    for stop in "=<>!~[ ":
        head = head.split(stop)[0]
    return head.strip().lower().replace("_", "-")


def fixtures_only_modules() -> set[str]:
    manifest = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    shipped = {requirement_name(e) for e in manifest["project"].get("dependencies", [])}
    group = manifest["dependency-groups"]["fixtures"]
    names = {requirement_name(e) for e in group if isinstance(e, str)} - shipped
    unknown = names - MODULE_OF.keys()
    assert not unknown, f"the fixtures group pins a distribution this scan cannot map: {sorted(unknown)}"
    return {MODULE_OF[name] for name in names}


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
    assert fixtures_only_modules() == {"reportlab", "PIL", "pypdfium2"}


@pytest.mark.parametrize("module", sorted(PACKAGE.rglob("*.py")), ids=lambda p: str(p.relative_to(PACKAGE)))
def test_app_module_imports_nothing_from_the_fixtures_group(module: Path) -> None:
    leaked = imported_roots(module) & fixtures_only_modules()
    assert not leaked, f"{module.relative_to(CAD_ROOT)} imports the fixtures-only {sorted(leaked)}"


def test_scan_sees_a_planted_import(tmp_path: Path) -> None:
    planted = tmp_path / "leak.py"
    planted.write_text("from reportlab.pdfgen import canvas\nimport PIL.Image\n", encoding="utf-8")
    assert imported_roots(planted) & fixtures_only_modules() == {"reportlab", "PIL"}
