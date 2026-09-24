"""F-RCC6-BNBC: the generator's self-checks pass, the committed golden regenerates byte for byte, and
the manifest pins the generator modules that minted it (E-fixture §3.9-3.10)."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "fixtures" / "rcc6-bnbc"
sys.path.insert(0, str(ROOT))

from fixtures.gen.rcc6_bnbc import __main__ as gen  # noqa: E402
from fixtures.gen.rcc6_bnbc import selfcheck  # noqa: E402


def test_selfcheck_passes_and_covers_the_40_cells() -> None:
    report = selfcheck.run()
    assert report["cells"] == "40/40"
    assert report["rows_per_kind"]["REBAR"] > 0


def test_committed_golden_regenerates_byte_for_byte(tmp_path: Path) -> None:
    gen.main(tmp_path, stage="golden")
    for name in (
        "takeoff.golden.json",
        "bbs.golden.json",
        "cells.json",
        "traps.json",
        "site.json",
        "model.json",
    ):
        assert (tmp_path / name).read_bytes() == (OUT / name).read_bytes(), name


def test_manifest_pins_the_generator_and_its_outputs() -> None:
    """Every module the manifest names is the module on the tree, and every output it names is the
    file in the corpus — a corpus that drifted from its generator fails here, by name."""
    manifest = json.loads((OUT / "manifest.json").read_text())
    assert manifest["schema"] == 2
    package = ROOT / "fixtures" / "gen" / "rcc6_bnbc"
    moved = [
        name
        for name, digest in manifest["generator"]["modules"].items()
        if not (package / name).is_file()
        or hashlib.sha256((package / name).read_bytes()).hexdigest() != digest
    ]
    assert moved == [], f"generator modules that are not what minted the corpus: {moved}"
    on_tree = {
        path.relative_to(package).as_posix()
        for path in package.rglob("*")
        if path.is_file() and path.suffix in (".py", ".json") and "__pycache__" not in path.parts
    }
    assert on_tree == set(manifest["generator"]["modules"]), (
        f"the manifest does not pin every generator module — missing "
        f"{sorted(on_tree - set(manifest['generator']['modules']))}"
    )
    stale = [
        name
        for name, digest in manifest["outputs"].items()
        if not (OUT / name).is_file() or hashlib.sha256((OUT / name).read_bytes()).hexdigest() != digest
    ]
    assert stale == [], f"outputs that are not the bytes the manifest pins: {stale}"
    # The manifest is written last and cannot hash itself, so it names every file but its own.
    committed = {
        path.relative_to(OUT).as_posix() for path in OUT.rglob("*") if path.is_file()
    } - {"manifest.json"}
    assert committed == set(manifest["outputs"]), (
        f"the corpus and the manifest disagree — unlisted {sorted(committed - set(manifest['outputs']))}, "
        f"listed but absent {sorted(set(manifest['outputs']) - committed)}"
    )


def test_manifest_records_the_sheets_and_what_each_variant_lost() -> None:
    manifest = json.loads((OUT / "manifest.json").read_text())
    numbers = [sheet["number"] for sheet in manifest["sheets"]]
    assert numbers == sorted(numbers) and numbers[0] == "S-00"
    for sheet in manifest["sheets"]:
        assert sheet["size"] in ("A1", "A2", "A3")
        assert sheet["views"] or sheet["size"] == "A3" or sheet["scales"] == "N.T.S."
    assert manifest["pdf"]["rcc6-bnbc.shx.pdf"]["text_objects"] == 0
    assert "NO_TEXT_LAYER" in manifest["pdf"]["rcc6-bnbc.shx.pdf"]["losses"]
    assert "BENGALI_TEXT_DXF_ONLY" in manifest["pdf"]["rcc6-bnbc.pdf"]["losses"]
    for variant in ("r1", "r2", "r2pdf", "r3", "r4"):
        assert manifest["raster"][variant]["dpi"] >= 72


def test_golden_schema_2_rows_keep_the_schema_1_reader_shape() -> None:
    golden = json.loads((OUT / "takeoff.golden.json").read_text())
    assert golden["schema"] == 2 and golden["provenance"] == "HAND_FROM_AUTHORED_SOURCE"
    for row in golden["rows"]:
        assert {"class", "kind", "level", "quantity", "unit", "formula"} <= set(row)
        if row["kind"] == "REBAR":
            assert row["component"] in ("NET", "LAP") and row["diameter_mm"] in (8, 10, 12, 16, 20, 25)


def test_a_figure_below_zero_is_spelled_as_its_magnitude_after_a_minus() -> None:
    """R0 W-20: check 5 reads a printed level through `ft_in`, so a level below zero must spell as
    the drawing writes it — E.G.L (-1'-6") is -457.2 mm, never -152.4."""
    from fixtures.gen.rcc6_bnbc.emit.scene import ft_in
    from fixtures.gen.rcc6_bnbc.validate.facts import spellings

    assert ft_in(-457.2) == "-1'-6\""
    assert ft_in(-152.4) == "-0'-6\""
    assert ft_in(-1524.0) == "-5'-0\""
    assert ft_in(457.2) == "1'-6\""
    assert "-1'-6\"" in spellings("-457.2")
    assert "-1'-6\"" not in spellings("-152.4")
