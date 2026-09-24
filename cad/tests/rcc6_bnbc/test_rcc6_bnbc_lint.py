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


DERIVED_KEYS = (
    "clear",
    "area",
    "col_deduct",
    "beam_soffit",
    "beam_ends",
    "h",
    "t_top",
    "perim",
    "extents",
    "end_dirs",
    "sloped",
    "run",
    "rise_total",
    "cx",
    "cy",
    "sx",
    "sy",
    "slope",
    "curved_cut",
    "free_edge",
    "arc_len",
    # R0 (W-29, W-30, W-31): the foundation junctions the model resolves on each pile cap
    "pile_heads",
    "recess",
    "recess_faces",
    "blinding_piles",
)
#: Fields the model derives on a slab's hole (R0 W-24: the reveal the SOG edge exposes at a hole).
DERIVED_HOLE_KEYS = ("reveal_mm2",)
DERIVED_BY_CLASS = {
    "COLUMN": ("b", "d"),
    "BEAM": ("length",),
    "TIE_BEAM": ("length",),
    "LINTEL": ("length",),
    "SHEAR_WALL": ("length",),
    "WALL": ("length",),
}


def test_golden_check_never_names_a_derived_field() -> None:
    import re

    src = (PKG / "golden_check.py").read_text(encoding="utf-8")
    for key in DERIVED_KEYS:  # member-dict reads: m[...], w[...], bm[...], p[...], q[...], host[...], fl[...]
        pattern = r"\b(m|w|bm|p|q|host|fl)(\[\"KEY\"\]|\.get\(\"KEY\")".replace("KEY", key)
        assert not re.search(pattern, src), key
    for key in DERIVED_HOLE_KEYS:  # hole-dict reads, and the key named at all
        assert f'"{key}"' not in src, key


def test_golden_check_derives_its_own_geometry_from_raw_inputs_only() -> None:
    """Every derived field is replaced by a poison object; path 2 must still reproduce path 1."""
    sys.path.insert(0, str(ROOT))
    from fixtures.gen.rcc6_bnbc import golden, golden_check, model

    world = model.build()
    rows, _ = golden.compute(world)
    poison = object()
    poisoned = set()
    for m in world["members"]:
        for key in DERIVED_KEYS + DERIVED_BY_CLASS.get(m["class"], ()):
            if key in m:
                m[key] = poison
                poisoned.add(key)
        for h in m.get("holes", []):
            for key in DERIVED_HOLE_KEYS:
                if key in h:
                    h[key] = poison
                    poisoned.add(key)
    # every R0 junction field is really on the world, so its poison is really laid
    assert {"pile_heads", "recess", "recess_faces", "blinding_piles", "reveal_mm2"} <= poisoned, poisoned
    path2 = golden_check.compute(world)
    path1 = {
        (
            r["class"],
            r["kind"],
            r["level"],
            r.get("grade", ""),
            r.get("diameter_mm", 0),
            r.get("component", ""),
        ): r["quantity"]
        for r in rows
    }
    assert path2 == path1


def test_golden_check_refuses_a_column_tie_count_its_own_zones_do_not_give() -> None:
    """R0 GC-1..GC-4 (W-28): path 2 re-derives every column's tie count from its own joint depth and
    zones, so a count the model authored any other way is refused by name — never summed in."""
    sys.path.insert(0, str(ROOT))
    from fixtures.gen.rcc6_bnbc import golden_check, model

    world = model.build()
    golden_check.compute(world)  # as built, the two agree
    tie = next(
        b for b in world["bars"] if b["member"] == "COL:A1@GF" and b["role"] == "TIE"
    )
    tie["n"] += 1
    with pytest.raises(AssertionError, match="COL:A1@GF"):
        golden_check.compute(world)
