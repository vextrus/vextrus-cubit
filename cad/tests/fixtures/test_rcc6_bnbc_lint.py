"""F-RCC6-BNBC import lint: the golden package (golden.py, golden_check.py and everything they import)
reads the authored model only — never geometry derivation or an emitter (E-fixture §3.6, §3.10-1)."""

from __future__ import annotations

import ast
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
PKG = ROOT / "fixtures" / "gen" / "rcc6_bnbc"
GOLDEN = ["golden.py", "golden_check.py"]
FORBIDDEN = (
    "emit",
    "scene",
    "sheet",
    "derive",
    "dxf",
    "ezdxf",
    "reportlab",
    "PIL",
    "pypdfium2",
    "numpy",
    "rcc6.py",
)
ALLOWED_LOCAL = {"model"}


def imports_of(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names |= {a.name for a in node.names}
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                names |= {f".{a.name}" for a in node.names}
            else:
                names.add(node.module or "")
    return names


@pytest.mark.parametrize("name", GOLDEN)
def test_golden_modules_import_only_the_model_and_stdlib(name: str) -> None:
    names = imports_of(PKG / name)
    local = {n[1:] for n in names if n.startswith(".")}
    assert local <= ALLOWED_LOCAL, local
    for n in names:
        assert not any(f in n for f in FORBIDDEN), n
    # transitively: the model itself imports nothing from the emitters either
    for n in imports_of(PKG / "model.py"):
        assert not n.startswith(".") and not any(f in n for f in FORBIDDEN), n


def test_importing_the_golden_loads_no_emitter_module() -> None:
    sys.path.insert(0, str(ROOT))
    before = set(sys.modules)
    import fixtures.gen.rcc6_bnbc.golden
    import fixtures.gen.rcc6_bnbc.golden_check  # noqa: F401

    loaded = {m for m in set(sys.modules) - before if not m.startswith("fixtures.gen.rcc6_bnbc")}
    bad = {
        m
        for m in loaded
        if any(f in m.lower() for f in ("ezdxf", "reportlab", "pil", "pypdfium", "numpy", "emit"))
    }
    assert not bad, bad
