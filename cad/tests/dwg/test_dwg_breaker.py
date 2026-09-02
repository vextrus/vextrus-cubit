"""Breaker acceptance for the DWG lane: what the audit promises on drawings the fixture lacks.

Each test here is a reproduction of a defect found by attacking `vextrus_cad.dwg` with the real
LibreDWG toolchain and with programs written for the purpose (L-CAD-04). The drawings are minted at
test time with `dxf2dwg` from a DXF ezdxf writes, so no binary joins the committed fixtures.
"""

from __future__ import annotations

import shutil
import stat
import subprocess
import sys
from pathlib import Path

import ezdxf
import pytest

from vextrus_cad.dwg import DwgError, Toolchain, convert_dwg

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"
BASIC = FIXTURE_DIR / "basic.dwg"

BUDGET = 60.0


def _program(directory: Path, name: str, body: str) -> str:
    path = directory / name
    path.write_text(body)
    path.chmod(path.stat().st_mode | stat.S_IEXEC)
    return str(path)


def _real_census_json(tmp_path: Path, drawing: Path) -> Path:
    """A `dwgread -O JSON` census of `drawing`, for stubs that replay it."""
    census = tmp_path / "replayed-census.json"
    subprocess.run(
        ["dwgread", "-O", "JSON", "-o", str(census), str(drawing)],
        check=False,
        capture_output=True,
    )
    assert census.stat().st_size > 0, "dwgread wrote no census to replay"
    return census


def _minted_dwg(tmp_path: Path, name: str, draw) -> Path:
    """A DWG minted from a DXF ezdxf writes, the way the committed fixtures were."""
    if shutil.which("dxf2dwg") is None:
        pytest.skip("dxf2dwg is not on PATH; checkup's libredwg probe owns that")
    document = ezdxf.new("R2000", setup=True)
    draw(document.modelspace())
    dxf = tmp_path / f"{name}.dxf"
    document.saveas(str(dxf))
    dwg = tmp_path / f"{name}.dwg"
    subprocess.run(["dxf2dwg", "-y", "-o", str(dwg), str(dxf)], check=False, capture_output=True)
    assert dwg.is_file() and dwg.read_bytes()[:4] == b"AC10", "dxf2dwg minted no DWG"
    return dwg


def _draw_structural(msp) -> None:
    """What a structural sheet actually carries: lines, a dimension, an old-style polyline."""
    msp.add_line((0, 0), (1000, 0))
    msp.add_line((0, 0), (0, 500))
    msp.add_linear_dim(base=(0, -100), p1=(0, 0), p2=(1000, 0)).render()
    msp.add_polyline2d([(0, 0), (100, 100), (200, 0), (300, 100)])
    msp.add_3dface([(0, 0, 0), (10, 0, 0), (10, 10, 0), (0, 10, 0)])
    msp.add_text("BEAM B1", dxfattribs={"height": 25}).set_placement((10, 10))
    msp.add_circle((500, 250), 50)


# --- BLOCKING: the two passes must spell an entity class the same way to be reconciled ---------


def test_a_dimension_and_a_polyline_the_conversion_carried_are_not_refused(tmp_path: Path) -> None:
    """L-CAD-04 reconciles per entity type; the type must be one name on both sides.

    LibreDWG's census spells a linear dimension `DIMENSION_LINEAR`, a 2D polyline `POLYLINE_2D`
    and its vertices `VERTEX_2D`, while the DXF the same toolchain wrote — and ezdxf reads back —
    spells them `DIMENSION` and `POLYLINE` with the vertices absorbed by their owner. A drawing the
    conversion carried in full is then refused on three classes it did not lose.
    """
    source = _minted_dwg(tmp_path, "structural", _draw_structural)
    result = convert_dwg(source, tmp_path / "out")

    model_census = result.census["model"]
    model_geometry = result.geometry["model"]
    assert "DIMENSION" in model_census, f"the census spells the dimension unlike the DXF: {model_census}"
    assert "POLYLINE" in model_census, f"the census spells the polyline unlike the DXF: {model_census}"
    assert not any("VERTEX" in dxftype for dxftype in model_census), (
        f"a vertex its polyline absorbs is tallied as a class of its own: {model_census}"
    )
    assert model_geometry["DIMENSION"] >= 1 and model_geometry["POLYLINE"] >= 1
    assert result.refused == (), [entry.message() for entry in result.refused]


# --- MINOR: the drawing's own copy in a pass's room is never that pass's artifact ----------------


def test_the_drawings_own_copy_is_not_read_as_the_conversion(tmp_path: Path) -> None:
    """A converter that wrote nothing refuses the drawing, whatever the drawing was named.

    Each pass reads a copy of the drawing placed in its room; when the drawing's name already
    carries the suffix the pass is asked for, that copy is found by the room search and admitted as
    the converter's work — so a pass that exited having written nothing reads as a conversion.
    """
    given = tmp_path / "given.dxf"
    document = ezdxf.new("R2000", setup=True)
    document.modelspace().add_line((0, 0), (1, 1))
    document.saveas(str(given))
    census = _real_census_json(tmp_path, BASIC)
    replays = _program(
        tmp_path,
        "census.py",
        f"#!{sys.executable}\nimport sys\nfrom pathlib import Path\n"
        "argv = sys.argv[1:]\n"
        f"Path(argv[argv.index('-o') + 1]).write_bytes(Path({str(census)!r}).read_bytes())\n",
    )
    writes_nothing = _program(tmp_path, "converter.py", f"#!{sys.executable}\nraise SystemExit(0)\n")

    with pytest.raises(DwgError, match=r"given\.dxf"):
        convert_dwg(given, tmp_path / "out", toolchain=Toolchain(replays, writes_nothing, BUDGET))
    assert not (tmp_path / "out").exists() or list((tmp_path / "out").iterdir()) == []


# --- MINOR: a readable DXF the pass wrote is its work even when a junk file sorts before it ----


def test_a_readable_dxf_in_the_room_converts_the_drawing_whatever_else_lies_there(tmp_path: Path) -> None:
    """The artifact is the evidence (L-CAD-04); a room holding one is a pass that converted."""
    converter = _program(
        tmp_path,
        "two-files.py",
        f"#!{sys.executable}\nimport subprocess, sys\nfrom pathlib import Path\n"
        "drawing = sys.argv[-1]\n"
        "subprocess.run(['dwg2dxf', '-m', '-o', 'zz-named-by-the-program.dxf', drawing], check=False)\n"
        "Path('aa-scratch.dxf').write_text('not a drawing')\n",
    )
    result = convert_dwg(BASIC, tmp_path / "out", toolchain=Toolchain("dwgread", converter, BUDGET))
    assert result.refused == ()
    assert result.dxf_path.is_file() and result.geometry["model"]["LINE"] >= 1


# --- MINOR: `dxf_path` names a file, or the drawing is refused ----------------------------------


def test_a_directory_at_the_dxf_name_refuses_rather_than_returning_it(tmp_path: Path) -> None:
    """`convert_dwg` writes `<out_dir>/<stem>.dxf`; a name it cannot write is a refusal by name.

    With a directory already at that name the DXF is moved inside it and `dxf_path` names the
    directory — which `ingest_dxf` cannot read and which is not what the caller was promised.
    """
    out_dir = tmp_path / "out"
    (out_dir / "basic.dxf").mkdir(parents=True)
    try:
        result = convert_dwg(BASIC, out_dir)
    except DwgError as error:
        assert "basic.dwg" in str(error)
        return
    assert result.dxf_path.is_file(), f"dxf_path names a directory: {result.dxf_path}"


# --- MINOR: a greeting is a greeting whatever punctuation it carries ------------------------------


@pytest.mark.parametrize("greeting", ["[INFO] reading the drawing", "Reading {drawing} ..."])
def test_a_census_after_a_bracketed_greeting_is_still_the_census(tmp_path: Path, greeting: str) -> None:
    """A census the program chattered before is the pass's work (settled: 'after a greeting')."""
    census = _real_census_json(tmp_path, BASIC)
    talker = _program(
        tmp_path,
        "talker.py",
        f"#!{sys.executable}\nimport sys\nfrom pathlib import Path\n"
        f"sys.stdout.write({greeting!r} + '\\n' + Path({str(census)!r}).read_text())\n",
    )
    result = convert_dwg(BASIC, tmp_path / "out", toolchain=Toolchain(talker, "dwg2dxf", BUDGET))
    assert result.census["model"]["LINE"] >= 1
    assert result.refused == ()
