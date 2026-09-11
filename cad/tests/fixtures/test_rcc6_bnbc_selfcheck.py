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


def test_selfcheck_passes_and_covers_the_36_cells() -> None:
    report = selfcheck.run()
    assert report["cells"] == "36/36"
    assert report["rows_per_kind"]["REBAR"] > 0


def test_committed_golden_regenerates_byte_for_byte(tmp_path: Path) -> None:
    gen.main(tmp_path)
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
    manifest = json.loads((OUT / "manifest.json").read_text())
    assert manifest["schema"] == 2
    for name, digest in manifest["generator"]["modules"].items():
        assert (
            hashlib.sha256((ROOT / "fixtures" / "gen" / "rcc6_bnbc" / name).read_bytes()).hexdigest()
            == digest
        ), name
    for name, digest in manifest["outputs"].items():
        assert hashlib.sha256((OUT / name).read_bytes()).hexdigest() == digest, name


def test_golden_schema_2_rows_keep_the_schema_1_reader_shape() -> None:
    golden = json.loads((OUT / "takeoff.golden.json").read_text())
    assert golden["schema"] == 2 and golden["provenance"] == "HAND_FROM_AUTHORED_SOURCE"
    for row in golden["rows"]:
        assert {"class", "kind", "level", "quantity", "unit", "formula"} <= set(row)
        if row["kind"] == "REBAR":
            assert row["component"] in ("NET", "LAP") and row["diameter_mm"] in (8, 10, 12, 16, 20, 25)
