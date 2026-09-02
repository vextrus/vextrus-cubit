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
import shutil
import subprocess
import sys
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

#: cad/tests/dwg/test_dwg_convert.py -> the checkout. Nothing this suite runs may write inside it.
REPO_ROOT = Path(__file__).resolve().parents[3]

#: `ingest.py` spells the model layout with this lowercase word; the census must agree (L-CAD-04's
#: "that sheet" is a space of the converted drawing).
MODEL_SPACE = "model"

#: A budget for the suite's *own* subprocess re-derivations — not the lane's.
PROBE_TIMEOUT_SECONDS = 300.0

#: A version in a LibreDWG banner's shape that no LibreDWG release reports. A `tool_version` the
#: lane spells for itself — a literal, or the machine's real banner — cannot hold this.
STUB_VERSION = "41.42.43"


def _assert_tally_shape(tally: dict[str, dict[str, int]], what: str) -> None:
    assert isinstance(tally, dict), f"{what} is not a per-space mapping"
    assert tally, f"{what} is empty — a pass that tallied nothing is not a pass"
    for space, types in tally.items():
        assert isinstance(space, str) and space, f"{what} holds an unnamed space"
        assert isinstance(types, dict), f"{what}[{space!r}] is not a per-type mapping"
        for dxftype, count in types.items():
            assert isinstance(dxftype, str) and dxftype, f"{what}[{space!r}] holds an unnamed class"
            assert isinstance(count, int) and count > 0, f"{what}[{space!r}][{dxftype!r}] is not a tally"


def _write_dwgread_census(source: Path, target: Path) -> None:
    """The census pass run by this suite itself, straight off the toolchain's own JSON."""
    subprocess.run(
        [DEFAULT_TOOLCHAIN.dwgread, "-O", "JSON", "-o", str(target), str(source)],
        capture_output=True,
        check=False,
        timeout=PROBE_TIMEOUT_SECONDS,
    )
    assert target.is_file(), f"dwgread -O JSON wrote no census for {source.name}"


def _dwgread_census_document() -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as scratch:
        target = Path(scratch) / "census.json"
        _write_dwgread_census(SOURCE, target)
        return json.loads(target.read_text(encoding="utf-8", errors="replace"))


def _stub_program(path: Path, *, payload: Path, suffix: str, version: str) -> str:
    """A stand-in for one LibreDWG program, written at test time and executable.

    It answers `--version` with a banner in the real programs' own shape, and otherwise replays a
    prepared payload — a real census, a real converted DXF — wherever its counterpart was asked to
    write. Replaying real work is what makes a stubbed run a real success rather than a mutual
    agreement between the lane and this test's guesses.
    """
    path.write_text(
        _STUB_SOURCE.format(
            python=sys.executable,
            version=version,
            payload=str(payload),
            suffix=suffix,
            forbidden=str(REPO_ROOT),
        ),
        encoding="utf-8",
    )
    path.chmod(0o755)
    return str(path)


_STUB_SOURCE = '''#!{python}
import sys
from pathlib import Path

VERSION = {version!r}
PAYLOAD = {payload!r}
SUFFIX = {suffix!r}
FORBIDDEN = Path({forbidden!r}).resolve()

argv = sys.argv[1:]
if "--version" in argv or "-V" in argv:
    # `dwgread --version` reports "<program> <version>" on stdout, and so does this.
    sys.stdout.write(Path(sys.argv[0]).name + " " + VERSION + "\\n")
    sys.exit(0)

targets = []
for index, argument in enumerate(argv):
    if argument in ("-o", "--file") and index + 1 < len(argv):
        targets.append(Path(argv[index + 1]))
    elif argument.startswith("--file="):
        targets.append(Path(argument.split("=", 1)[1]))
    elif argument.startswith("-o") and len(argument) > 2:
        targets.append(Path(argument[2:]))
for argument in argv:
    if argument.lower().endswith(".dwg"):
        drawing = Path(argument)
        targets.append(drawing.with_suffix(SUFFIX))
        targets.append(Path.cwd() / (drawing.stem + SUFFIX))

body = Path(PAYLOAD).read_bytes()
for target in targets:
    try:
        resolved = target.resolve()
    except OSError:
        continue
    if resolved == FORBIDDEN or FORBIDDEN in resolved.parents:
        continue  # never write inside the checkout
    try:
        resolved.parent.mkdir(parents=True, exist_ok=True)
        resolved.write_bytes(body)
    except OSError:
        pass
sys.stdout.buffer.write(body)
sys.exit(0)
'''


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
    """The default toolchain's identity, as the machine reports it.

    This grades agreement with the machine's own LibreDWG; that the field is *read* from whichever
    toolchain the call was given — rather than known to the lane without asking — is what
    `test_ac3_tool_version_comes_from_the_toolchain_it_was_given` below binds.
    """
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


def test_ac3_tool_version_comes_from_the_toolchain_it_was_given(tmp_path: Path) -> None:
    # A private copy of the drawing: the stubs replay their payload beside whatever they are pointed
    # at, and nothing this test runs may write inside the checkout.
    source = tmp_path / SOURCE.name
    shutil.copyfile(SOURCE, source)

    # Stage the payloads from the real thing — the toolchain's own census, the lane's own converted
    # DXF — so the stubbed run below succeeds for the same reason a real one does.
    golden_dir = tmp_path / "golden"
    golden_dir.mkdir()
    golden = convert_dwg(source, golden_dir)
    census_json = tmp_path / "census.json"
    _write_dwgread_census(source, census_json)

    # The stubs carry their counterparts' names, so the version in their banner is the one thing
    # separating this toolchain from the machine's.
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    toolchain = Toolchain(
        _stub_program(bin_dir / "dwgread", payload=census_json, suffix=".json", version=STUB_VERSION),
        _stub_program(bin_dir / "dwg2dxf", payload=golden.dxf_path, suffix=".dxf", version=STUB_VERSION),
        DEFAULT_TOOLCHAIN.timeout_seconds,
    )

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    result = convert_dwg(source, out_dir, toolchain=toolchain)

    assert result.dxf_path.is_file(), "the stubbed pair replayed complete work; the conversion must succeed"
    assert result.tool == "libredwg", "the tool is the toolchain's family, whichever programs carry it"
    assert STUB_VERSION in result.tool_version, (
        f"tool_version {result.tool_version!r} did not come from the toolchain this call was given, "
        f"whose programs report version {STUB_VERSION} — a version the lane knows without asking the "
        f"programs it was handed is not read from their own --version output"
    )


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
