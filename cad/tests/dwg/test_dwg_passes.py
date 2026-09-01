"""A pass is judged by what it wrote, wherever it wrote it (L-CAD-04).

L-CAD-04 refuses the exit code as a success signal, which leaves the artifact a pass produced as
the only evidence it worked — so the lane has to find that artifact under the conventions the
LibreDWG programs actually have. `dwgread -O JSON` writes to the file it is given and prints the
document when it is not; a converter may write where it was asked, beside the drawing it read, or
into the directory it was started in. Each convention is driven here through the `Toolchain` seam
with a program written for the purpose, so none of it needs a pathological drawing.
"""

from __future__ import annotations

import json
import stat
import sys
from pathlib import Path

import pytest

from vextrus_cad.dwg import DwgError, Toolchain, convert_dwg

#: A census one LINE in the model space, in the shape `dwgread -O JSON` writes.
CENSUS = {
    "OBJECTS": [
        {"object": "BLOCK_HEADER", "handle": [0, 1, 1], "name": "*Model_Space"},
        {"object": "LAYOUT", "handle": [0, 1, 2], "block_header": [3, 1, 1], "layout_name": "Model"},
        {"entity": "LINE", "handle": [0, 1, 10], "entmode": 2},
    ]
}

#: The one drawing these programs pretend to read; nothing here parses it.
_DRAWING_BYTES = b"AC1015 stubbed"

#: A budget large enough that a stub's own start-up is never mistaken for a hung pass.
STUB_TIMEOUT_SECONDS = 120.0

_CENSUS_TO_FILE = f"open(out, 'w').write({json.dumps(json.dumps(CENSUS))})"
_CENSUS_TO_STDOUT = f"sys.stdout.write({json.dumps(json.dumps(CENSUS))})"

_DWGREAD = """
import sys
argv = sys.argv[1:]
if "--version" in argv:
    sys.stdout.write("stub-dwgread 1.2.3\\n")
    raise SystemExit(0)
out = argv[argv.index("-o") + 1]
{body}
raise SystemExit({exit_code})
"""

_DWG2DXF = """
import os, sys
import ezdxf
argv = sys.argv[1:]
out = argv[argv.index("-o") + 1]
drawing = ezdxf.new()
drawing.modelspace().add_line((0, 0), (1, 0))
drawing.saveas({where})
raise SystemExit({exit_code})
"""

#: Where a converter writes: as asked, beside the drawing it read, or into its own directory.
_WHERE = {
    "as asked": "out",
    "beside the drawing": "os.path.splitext(argv[-1])[0] + '.dxf'",
    "in its own directory": "'named-by-the-converter.dxf'",
}


def _program(directory: Path, name: str, source: str) -> str:
    path = directory / name
    path.write_text(f"#!{sys.executable}\n{source}", encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IEXEC)
    return str(path)


def _stubbed(tmp_path: Path, *, census: str, where: str, exit_code: int) -> tuple[Path, Path, Toolchain]:
    programs = tmp_path / "bin"
    programs.mkdir()
    drawing = tmp_path / "stubbed.dwg"
    drawing.write_bytes(_DRAWING_BYTES)
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    toolchain = Toolchain(
        dwgread=_program(programs, "dwgread", _DWGREAD.format(body=census, exit_code=exit_code)),
        dwg2dxf=_program(programs, "dwg2dxf", _DWG2DXF.format(where=where, exit_code=exit_code)),
        timeout_seconds=STUB_TIMEOUT_SECONDS,
    )
    return drawing, out_dir, toolchain


@pytest.mark.parametrize("where", sorted(_WHERE), ids=sorted(_WHERE))
def test_a_conversion_is_found_wherever_the_converter_wrote_it(tmp_path: Path, where: str) -> None:
    drawing, out_dir, toolchain = _stubbed(
        tmp_path, census=_CENSUS_TO_FILE, where=_WHERE[where], exit_code=0
    )

    result = convert_dwg(drawing, out_dir, toolchain=toolchain)

    assert result.geometry == {"model": {"LINE": 1}}
    assert result.refused == ()
    # Wherever it was written, the lane leaves it under the one name it promises, in out_dir alone.
    assert result.dxf_path == out_dir / "stubbed.dxf"
    assert sorted(path.name for path in out_dir.iterdir()) == ["stubbed.dxf"]


def test_a_census_printed_rather_than_written_is_still_a_census(tmp_path: Path) -> None:
    drawing, out_dir, toolchain = _stubbed(
        tmp_path, census=_CENSUS_TO_STDOUT, where=_WHERE["as asked"], exit_code=0
    )

    result = convert_dwg(drawing, out_dir, toolchain=toolchain)

    assert result.census == {"model": {"LINE": 1}}


def test_a_census_that_is_neither_written_nor_printed_refuses_the_drawing(tmp_path: Path) -> None:
    drawing, out_dir, toolchain = _stubbed(
        tmp_path, census="pass", where=_WHERE["as asked"], exit_code=0
    )

    with pytest.raises(DwgError) as raised:
        convert_dwg(drawing, out_dir, toolchain=toolchain)

    assert drawing.name in str(raised.value)
    assert list(out_dir.iterdir()) == [], "a refused conversion left a partial artifact behind"


def test_a_nonzero_exit_is_not_read_as_failure(tmp_path: Path) -> None:
    drawing, out_dir, toolchain = _stubbed(
        tmp_path, census=_CENSUS_TO_FILE, where=_WHERE["as asked"], exit_code=3
    )

    result = convert_dwg(drawing, out_dir, toolchain=toolchain)

    assert result.dxf_path.is_file()
    assert result.refused == ()
    assert result.tool_version == "stub-dwgread 1.2.3"
