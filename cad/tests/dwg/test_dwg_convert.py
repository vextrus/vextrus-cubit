"""AC-1 and AC-3 — two reconciled passes over a real DWG, in an isolated subprocess (L-CAD-04).

Everything here is observed through the names the increment spec fixes: `convert_dwg`, the
`DwgConversion` it returns, and the two named pass functions (`census_of`, `geometry_tally`) run
again by this suite over the same drawing. Re-deriving both tallies independently is what makes
"removing either pass is not a lawful outcome" checkable: a result whose `census` did not come from
`dwgread -O JSON`, or whose `geometry` did not come from reading the converted DXF, cannot match.

Fixture: `fixtures/basic.dwg` is a model-space-only DWG (`AC1015`) minted offline with LibreDWG's
own `dxf2dwg`. Its census holds LINE x2, LWPOLYLINE, CIRCLE, ARC and TEXT in the model space,
alongside the `BLOCK`/`ENDBLK` records that delimit each block header rather than drawing anything.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import pytest

from vextrus_cad import ingest_dxf, parse_entity_graph
from vextrus_cad.dwg import (
    DEFAULT_TOOLCHAIN,
    DwgConversion,
    DwgError,
    Toolchain,
    census_of,
    convert_dwg,
    geometry_tally,
)

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"
SOURCE = FIXTURE_DIR / "basic.dwg"

#: `ingest.py` spells the model layout with this lowercase word; the census must agree (L-CAD-04's
#: "that sheet" is a space of the converted drawing).
MODEL_SPACE = "model"

#: A budget for the suite's *own* subprocess re-derivations — not the lane's.
PROBE_TIMEOUT_SECONDS = 300.0


def _assert_tally_shape(tally: dict[str, dict[str, int]], what: str) -> None:
    assert isinstance(tally, dict), f"{what} is not a per-space mapping"
    assert tally, f"{what} is empty — a pass that tallied nothing is not a pass"
    for space, types in tally.items():
        assert isinstance(space, str) and space, f"{what} holds an unnamed space"
        assert isinstance(types, dict), f"{what}[{space!r}] is not a per-type mapping"
        for dxftype, count in types.items():
            assert isinstance(dxftype, str) and dxftype, f"{what}[{space!r}] holds an unnamed class"
            assert isinstance(count, int) and count > 0, f"{what}[{space!r}][{dxftype!r}] is not a tally"


def _dwgread_census_document() -> dict[str, Any]:
    """The census pass run again by this suite, straight off the toolchain's own JSON."""
    with tempfile.TemporaryDirectory() as scratch:
        target = Path(scratch) / "census.json"
        subprocess.run(
            [DEFAULT_TOOLCHAIN.dwgread, "-O", "JSON", "-o", str(target), str(SOURCE)],
            capture_output=True,
            check=False,
            timeout=PROBE_TIMEOUT_SECONDS,
        )
        assert target.is_file(), "dwgread -O JSON wrote no census for the committed fixture"
        return json.loads(target.read_text(encoding="utf-8", errors="replace"))


def test_ac1_the_committed_fixture_is_a_real_dwg() -> None:
    assert SOURCE.is_file(), f"{SOURCE} is missing — AC-1's committed drawing"
    assert SOURCE.read_bytes()[:4] == b"AC10", "the fixture does not open with a DWG version marker"


def test_ac1_two_passes_reconciled_over_a_real_dwg(tmp_path: Path) -> None:
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    result = convert_dwg(SOURCE, out_dir)

    assert isinstance(result, DwgConversion)
    assert result.dxf_path == out_dir / f"{SOURCE.stem}.dxf"
    assert result.dxf_path.is_file(), "the converted DXF is the one thing the lane leaves behind"

    _assert_tally_shape(result.census, "DwgConversion.census")
    _assert_tally_shape(result.geometry, "DwgConversion.geometry")
    assert MODEL_SPACE in result.census, f"the model space is spelled {MODEL_SPACE!r}"
    assert MODEL_SPACE in result.geometry, f"the model space is spelled {MODEL_SPACE!r}"

    assert tuple(result.refused) == (), f"the fixture reconciles cleanly; refused={result.refused}"


def test_ac1_each_tally_is_populated_from_its_own_pass(tmp_path: Path) -> None:
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    result = convert_dwg(SOURCE, out_dir)

    # The census half: this suite runs `dwgread -O JSON` itself and tallies it with the lane's own
    # named function. A `census` that was in truth read off the DXF cannot survive this.
    assert census_of(_dwgread_census_document()) == result.census

    # The geometry half: the same shape read back out of the converted DXF.
    assert geometry_tally(result.dxf_path) == result.geometry


def test_ac1_the_converted_dxf_ingests_into_an_entity_graph(tmp_path: Path) -> None:
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    result = convert_dwg(SOURCE, out_dir)

    document = ingest_dxf(result.dxf_path)
    graph = parse_entity_graph(document)
    assert graph is not None


def test_ac3_leaves_only_the_converted_dxf_and_no_scratch(tmp_path: Path, monkeypatch: Any) -> None:
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    scratch_root = tmp_path / "tmproot"
    scratch_root.mkdir()
    # Every temp directory this process makes now lands here, so "does not survive the call" is a
    # thing the test can see rather than a thing it trusts.
    monkeypatch.setattr(tempfile, "tempdir", str(scratch_root))
    monkeypatch.setenv("TMPDIR", str(scratch_root))

    before = Path.cwd()
    result = convert_dwg(SOURCE, out_dir)

    assert Path.cwd() == before, "the lane changed the process's working directory"
    assert sorted(path.name for path in out_dir.iterdir()) == [f"{SOURCE.stem}.dxf"]
    assert result.dxf_path.parent == out_dir
    assert list(scratch_root.iterdir()) == [], "the per-invocation scratch directory outlived the call"


def test_ac3_records_the_toolchains_own_identity(tmp_path: Path) -> None:
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    result = convert_dwg(SOURCE, out_dir)

    assert result.tool == "libredwg"

    reported = subprocess.run(
        [DEFAULT_TOOLCHAIN.dwgread, "--version"],
        capture_output=True,
        text=True,
        check=False,
        timeout=PROBE_TIMEOUT_SECONDS,
    )
    banner = f"{reported.stdout}\n{reported.stderr}"
    assert result.tool_version, "DwgConversion.tool_version is empty"
    assert result.tool_version in banner, (
        f"tool_version {result.tool_version!r} is not in the toolchain's own --version output: {banner!r}"
    )
    machine_version = re.search(r"\d+\.\d+(?:\.\d+)*", banner)
    assert machine_version is not None, f"the toolchain reports no version at all: {banner!r}"
    assert machine_version.group(0) in result.tool_version


@pytest.mark.parametrize("program", ["dwgread", "dwg2dxf"])
def test_ac3_a_missing_program_refuses_loudly(tmp_path: Path, program: str) -> None:
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    missing = f"vextrus-absent-{program}"
    fields = {
        "dwgread": DEFAULT_TOOLCHAIN.dwgread,
        "dwg2dxf": DEFAULT_TOOLCHAIN.dwg2dxf,
        "timeout_seconds": DEFAULT_TOOLCHAIN.timeout_seconds,
    }
    fields[program] = missing

    with pytest.raises(DwgError) as raised:
        convert_dwg(SOURCE, out_dir, toolchain=Toolchain(**fields))

    message = str(raised.value)
    assert SOURCE.name in message, f"the refusal does not name the drawing: {message!r}"
    assert missing in message, f"the refusal does not name the missing program: {message!r}"
    assert list(out_dir.iterdir()) == [], "a refused conversion left a partial artifact behind"
