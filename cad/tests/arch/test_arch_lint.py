"""F-ARCH import lint and independence: the golden's two paths read the authored model only — never
an emitter, never the drawing — and path 2 never reads what path 1 authored for it (a room's clear
polygon, an opening's allocation to rooms, a wall's end rules): with those replaced by poison it must
still reproduce path 1 row for row (AM-01, L-QTY-06)."""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
PKG = ROOT / "fixtures" / "gen" / "arch"
GOLDEN = ["golden.py", "golden_check.py"]
FORBIDDEN = ("emit", "sheets", "dxf", "ezdxf", "reportlab", "PIL", "pypdfium2", "numpy", "validate")
STDLIB = {"__future__", "decimal", "typing", "math", "functools", "collections"}


def imports_of(path: Path) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names |= {a.name for a in node.names}
        elif isinstance(node, ast.ImportFrom):
            names |= {f".{a.name}" for a in node.names} if node.level else {node.module or ""}
    return names


@pytest.mark.parametrize("name", GOLDEN)
def test_the_golden_paths_import_only_the_model_and_the_standard_library(name: str) -> None:
    names = imports_of(PKG / name)
    assert {n[1:] for n in names if n.startswith(".")} <= {"model"}, names
    assert {n for n in names if not n.startswith(".")} <= STDLIB, names
    for n in imports_of(PKG / "model.py"):
        assert not any(f in n for f in FORBIDDEN), f"model.py imports {n}"


def test_importing_the_golden_loads_no_emitter() -> None:
    sys.path.insert(0, str(ROOT))
    before = set(sys.modules)
    import fixtures.gen.arch.golden
    import fixtures.gen.arch.golden_check  # noqa: F401

    loaded = {m for m in set(sys.modules) - before if not m.startswith("fixtures.gen.")}
    assert not {
        m for m in loaded if any(f in m.lower() for f in ("ezdxf", "reportlab", "pil", "numpy", "emit"))
    }


#: What path 1 authored that path 2 must re-derive rather than read (the level's own room list,
#: `lv["rooms"]`, is the labels and ids path 2 names its faces by, and is allowed).
AUTHORED_FOR_PATH_1 = {
    r'\["polygon"\]|\.get\("polygon"': "a room's clear polygon",
    r'\bo\["rooms"\]|\bop\["rooms"\]|\.get\("rooms"': "an opening's rooms",
    r'\["stops"\]': "a wall's end rules",
    r'\["arc"\]|\.get\("arc"': "the verandah's analytic spec",
    r'\["box_size"\]|\["stated"\]': "a label's size",
}


def test_path_2_never_names_what_path_1_authored() -> None:
    src = (PKG / "golden_check.py").read_text(encoding="utf-8")
    for pattern, what in AUTHORED_FOR_PATH_1.items():
        assert not re.search(pattern, src), f"golden_check reads {what}"


def test_path_2_reproduces_path_1_with_the_authored_answers_poisoned() -> None:
    sys.path.insert(0, str(ROOT))
    from fixtures.gen.arch import golden, golden_check, model

    world = model.build()
    rows = golden.compute(world)
    path1 = {
        (r["class"], r["kind"], r["level"], r.get("component"), r.get("room") or r.get("mark")): r["quantity"]
        for r in rows
    }
    poison = object()
    for lv in world["levels"].values():
        for r in lv["rooms"]:
            for key in ("polygon", "arc"):
                if key in r:
                    r[key] = poison
        for o in lv["openings"]:
            o["rooms"] = poison
        for w in lv["walls"]:
            w["stops"] = poison
    assert golden_check.compute(world) == path1
