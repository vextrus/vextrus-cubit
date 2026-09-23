"""F-ARCH: the generator's self-checks pass on the model as authored; the committed golden, cells and
model regenerate byte for byte; the manifest pins the generator, the structural model it reads and
every output; the drawing reads through the product's own extractor exactly as it was placed; and
every registered trap opens on a live entity of the sheet it names.

The regeneration of the WHOLE corpus (the drawing included) is cad/tests/sanity/test_arch_regenerate.py,
which the cad lane runs only when something it reads has moved (scripts/lib/cad-lane.mjs).
"""

from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path

import ezdxf
import pytest

from vextrus_cad import ingest_dxf

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "fixtures" / "arch"
PACKAGE = ROOT / "fixtures" / "gen" / "arch"
sys.path.insert(0, str(ROOT))

from fixtures.gen.arch import __main__ as gen  # noqa: E402
from fixtures.gen.arch import golden, selfcheck  # noqa: E402
from fixtures.gen.arch import model as M  # noqa: E402


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _json(name: str) -> dict:
    return json.loads((OUT / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def report() -> dict:
    return selfcheck.run()


def test_the_two_paths_agree_and_every_exit_cell_is_filled(report: dict) -> None:
    assert report["two_path_agreement"] is True
    rows = golden.compute(M.build())
    assert report["two_path_detail"].startswith(f"{len(rows)} rows identical")
    assert report["cells"] == "6/6"
    assert report["allocation_checked"] > 0 and report["labels_checked"] > 0


def test_every_framed_floor_carries_exactly_s25s_lintel_program(report: dict) -> None:
    """The cross-fixture check: F-ARCH's 250-wall openings by S-25 size class on every framed floor
    are F-RCC6-BNBC's own L1 / L2 / LS1 counts, read from its build — and the ground floor has none."""
    program = report["s25_program"]
    assert program["GF"] == {}
    for level in M.TYPICAL:
        assert program[level] == {"L1": 10, "L2": 8, "LS1": 6}, level


def test_the_manifest_records_the_selfcheck_it_was_minted_under(report: dict) -> None:
    manifest = _json("manifest.json")
    assert manifest["selfcheck"]["two_path_agreement"] is True
    assert manifest["selfcheck"] == json.loads(json.dumps(report, default=str)), (
        "the committed manifest's selfcheck is not what the selfcheck reports today (regenerate)"
    )


def test_the_committed_golden_regenerates_byte_for_byte(tmp_path: Path) -> None:
    gen.main(tmp_path, stage="golden")
    for name in gen.GOLDEN_FILES:
        assert (tmp_path / name).read_bytes() == (OUT / name).read_bytes(), name


def test_the_manifest_pins_the_generator_the_structure_and_every_output() -> None:
    manifest = _json("manifest.json")
    assert manifest["schema"] == 2 and manifest["discipline"] == "ARCHITECTURAL"
    on_tree = {
        p.relative_to(PACKAGE).as_posix(): _sha(p)
        for p in PACKAGE.rglob("*")
        if p.is_file() and p.suffix in (".py", ".json") and "__pycache__" not in p.parts
    }
    assert manifest["generator"]["modules"] == on_tree, "generator modules moved since the corpus was minted"
    structure = ROOT / manifest["structure"]["path"]
    assert _sha(structure) == manifest["structure"]["sha256"], (
        "F-RCC6-BNBC's model moved: F-ARCH reads its structure and must be regenerated in a baseline: commit"
    )
    committed = {p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file()} - {"manifest.json"}
    assert committed == set(manifest["outputs"]), "the corpus and the manifest disagree on what is in it"
    stale = [n for n, sha in manifest["outputs"].items() if _sha(OUT / n) != sha]
    assert stale == [], f"outputs that are not the bytes the manifest pins: {stale}"


def test_the_golden_is_schema_2_hand_authored_and_carries_the_m4_kinds() -> None:
    doc = _json("takeoff.golden.json")
    assert (
        doc["fixture"] == "F-ARCH" and doc["schema"] == 2 and doc["provenance"] == "HAND_FROM_AUTHORED_SOURCE"
    )
    kinds = Counter(r["kind"] for r in doc["rows"])
    assert {
        "FLOORING",
        "PLASTER",
        "PAINT",
        "WALL_TILE",
        "SKIRTING",
        "BRICKWORK",
        "OPENING_COUNT",
        "OPENING_AREA",
    } == set(kinds)
    for r in doc["rows"]:
        assert {"class", "kind", "level", "quantity", "unit", "formula", "members"} <= set(r)
        assert Decimal(r["quantity"]) >= 0
        if r["class"] == "SURFACE":
            assert r.get("room"), f"a surface row names its room: {r}"


def test_the_drawing_reads_through_the_product_extractor_as_it_was_placed() -> None:
    """L-CAD-09's sanity number: every entity the generator placed, per (space, type), is what the
    product's own ingest recovers — no more, no fewer."""
    artifact = ingest_dxf(OUT / "arch.dxf")
    got = Counter((e["space"], e["type"]) for e in artifact["entities"])
    drawn = _json("sanity.json")["drawn"]["arch.dxf"]
    want = Counter({(space, t): n for space, types in drawn.items() for t, n in types.items()})
    assert got == want, {k: (got[k], want[k]) for k in set(got) | set(want) if got[k] != want[k]}
    assert artifact["insunits"]["unit"] == "mm"
    papers = [layout["name"] for layout in artifact["layouts"] if layout["kind"] == "paper"]
    assert papers == [s["layout_name"] for s in _json("manifest.json")["sheets"]]


def test_every_trap_opens_on_a_live_entity_of_its_sheet() -> None:
    doc = ezdxf.readfile(str(OUT / "arch.dxf"))
    layouts = {s["number"]: s["layout_name"] for s in _json("manifest.json")["sheets"]}
    registry = json.loads((PACKAGE / "traps.json").read_text(encoding="utf-8"))["traps"]
    committed = _json("traps.json")["traps"]
    assert [t["id"] for t in committed] == [t["id"] for t in registry]
    for t in committed:
        e = doc.entitydb.get(t["handle"]) if t["handle"] else None
        assert e is not None, f"{t['id']} has no live handle"
        owner = e.get_layout()
        if owner is not None and owner.name != "Model":
            assert owner.name == layouts[t["sheet"]], t["id"]


def test_the_drawn_label_states_the_nominal_size_its_trap_registers() -> None:
    notation = _json("notation.corpus.json")["strings"]
    nominal = [s for s in notation if s.get("trap") == "T-ROOM-SIZE-NOMINAL"]
    assert len(nominal) == 1 and nominal[0]["text"] == "BED-01\\P18'-0\" x 14'-0\""
    nos = [s for s in notation if s.get("trap") == "T-OPENING-NOS"]
    assert len(nos) == 1 and nos[0]["text"] == "08 NOS"
    placed = sum(1 for o in M.openings("1F") if o["mark"] == "D2")
    assert placed == 9, "T-OPENING-NOS is registered against nine D2 placed per typical floor"
