"""The long text LibreDWG mis-spells is healed before any reader sees it (L-CAD-04, L-CAD-09).

LibreDWG 0.13's `dwg2dxf` writes a string past its 255-column buffer as two lines with no code
between them, and spells a long MTEXT's chunks with the group-1 tail first. The first refuses a
real structural sheet over one general note (`Invalid group code "x;(t/b)\\H1x;.}"` on a 22,000
entity drawing); the second hands the note back with its opening moved to the end. The pure tests
pin the healer's judgement on bytes it is given; the breaker tests mint a DWG with the real
toolchain and prove the conversion the lane hands on is one a reader admits and a census agrees
with. Nothing here writes inside the checkout.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import ezdxf
import pytest

from vextrus_cad.dwg import (
    WRAP_COLUMN,
    convert_dwg,
    heal_wrapped_text,
    rejoin_wrapped_text,
)
from vextrus_cad.ingest import ingest_dxf
from vextrus_cad.resync import resync_tag_stream

#: Where LibreDWG breaks a line: the column this suite spells its wraps at.
LIBREDWG_COLUMN = 255

#: A real structural working drawing kept beside the product rather than in it — a consultant's
#: sheet set, not a fixture, held in the checkout's ignored .private/reference/ (L-CAD-09: it never
#: enters the repository). When it is on this machine the lane is proven against it; when it is
#: not, the minted breaker below stands for it.
REFERENCE_DRAWING = (
    Path(__file__).resolve().parents[3]
    / ".private/reference/edison/Structural Working Drawing_Edison Lavinia_Final.dwg"
)


def _stream(*tags: tuple[int, str], ending: bytes = b"\r\n") -> bytes:
    """An ASCII tag stream spelled the way LibreDWG spells one: right-aligned codes, CRLF."""
    return b"".join(f"{code:3d}".encode() + ending + value.encode() + ending for code, value in tags)


def _wrapped(text: str, column: int = LIBREDWG_COLUMN) -> str:
    """A value as LibreDWG writes one that outran its buffer: broken every `column` characters."""
    return "\r\n".join(text[at : at + column] for at in range(0, len(text), column))


LONG = "".join(f"NOTE {index:03d}: 12mm dia bars at 150 c/c top and bottom. " for index in range(14))

HEAD = ((0, "SECTION"), (2, "ENTITIES"), (0, "MTEXT"), (5, "2F"), (8, "NOTES"), (10, "0.0"), (20, "0.0"))
TAIL = ((7, "Standard"), (0, "ENDSEC"), (0, "EOF"))


# --- pure: what the healer does to bytes ------------------------------------------------------------


def test_a_wrapped_value_is_rejoined_and_counted() -> None:
    text = LONG[: LIBREDWG_COLUMN + 40]
    broken = _stream(*HEAD, (1, _wrapped(text)), *TAIL)
    lawful = _stream(*HEAD, (1, text), *TAIL)
    out = rejoin_wrapped_text(broken)
    assert out.repaired == lawful
    assert out.rejoined == 1 and out.reordered == 0
    assert out.line == 2 * len(HEAD) + 3, "the continuation stands on the line after the value"


def test_a_value_that_wrapped_twice_is_rejoined_twice() -> None:
    text = LONG[: 2 * LIBREDWG_COLUMN + 40]
    out = rejoin_wrapped_text(_stream(*HEAD, (1, _wrapped(text)), *TAIL))
    assert out.rejoined == 2
    assert out.repaired == _stream(*HEAD, (1, text), *TAIL)


def test_a_short_value_before_a_stray_line_is_the_resyncs_business() -> None:
    """A stray after a short value is a different fault; healing it would eat the stray's text."""
    stray = _stream(*HEAD, (1, "short note")) + b"Embedded Object\r\n" + _stream(*TAIL)
    out = rejoin_wrapped_text(stray)
    assert out.repaired is stray and out.healed == 0
    assert resync_tag_stream(stray).dropped == 1, "the resync still sees the stray this pass left"


def test_a_number_never_wraps() -> None:
    """Only a string can outrun a buffer; a numeric code's value is never given a continuation."""
    stream = _stream(*HEAD, (70, "7" * LIBREDWG_COLUMN)) + b"not a code\r\n" + _stream(*TAIL)
    assert rejoin_wrapped_text(stream).healed == 0


def test_a_stream_in_rhythm_and_a_binary_dxf_come_back_untouched() -> None:
    lawful = _stream(*HEAD, (1, "a short note"), *TAIL)
    assert rejoin_wrapped_text(lawful).repaired is lawful
    binary = b"AutoCAD Binary DXF\r\n\x1a\x00" + b"\x00" * 300
    assert rejoin_wrapped_text(binary).repaired is binary


def test_a_rotated_mtext_run_is_given_the_references_order() -> None:
    """LibreDWG: tail first under 1, chunks after under 3. The reference: 3s first, the tail last."""
    first, second, third = LONG[:LIBREDWG_COLUMN], LONG[LIBREDWG_COLUMN : 2 * LIBREDWG_COLUMN], LONG[510:]
    rotated = _stream(*HEAD, (1, first), (3, second), (3, third), *TAIL)
    lawful = _stream(*HEAD, (3, first), (3, second), (1, third), *TAIL)
    out = rejoin_wrapped_text(rotated)
    assert out.repaired == lawful
    assert out.reordered == 1 and out.rejoined == 0
    assert out.line == 2 * len(HEAD) + 1, "the run is named at its group-1 code line"


def test_a_rotated_run_whose_last_chunk_also_wrapped_is_healed_both_ways() -> None:
    first, second, third = LONG[:LIBREDWG_COLUMN], LONG[LIBREDWG_COLUMN : 2 * LIBREDWG_COLUMN], LONG[510:]
    both = _stream(*HEAD, (1, first), (3, _wrapped(second + third)), *TAIL)
    out = rejoin_wrapped_text(both)
    assert (out.rejoined, out.reordered) == (1, 1)
    assert out.repaired == _stream(*HEAD, (3, first), (1, second + third), *TAIL)


def test_a_dimensions_text_and_style_are_never_rotated() -> None:
    """A DIMENSION's 1 (its text) before its 3 (its style) is the reference's own order."""
    dimension = ((0, "DIMENSION"), (5, "30"), (1, "X" * LIBREDWG_COLUMN), (3, "ISO-25"), (0, "EOF"))
    assert rejoin_wrapped_text(_stream(*dimension)).healed == 0


def test_a_short_mtext_tail_before_a_3_is_left_alone() -> None:
    """Only a group-1 chunk that fills the column was chunked by the converter."""
    assert rejoin_wrapped_text(_stream(*HEAD, (1, "short"), (3, "chunk"), *TAIL)).healed == 0


def test_the_column_is_the_references_own_chunk_length() -> None:
    assert WRAP_COLUMN == 250 <= LIBREDWG_COLUMN


# --- the file: healed in place, or not touched ------------------------------------------------------


def test_a_converted_dxf_is_healed_in_place_and_a_lawful_one_is_not_touched(tmp_path: Path) -> None:
    text = LONG[: LIBREDWG_COLUMN + 40]
    broken = tmp_path / "broken.dxf"
    broken.write_bytes(_stream(*HEAD, (1, _wrapped(text)), *TAIL))
    assert heal_wrapped_text(broken).rejoined == 1
    assert broken.read_bytes() == _stream(*HEAD, (1, text), *TAIL)
    assert not [name for name in os.listdir(tmp_path) if name.startswith(".")], "no staging file remains"

    lawful = tmp_path / "lawful.dxf"
    lawful.write_bytes(_stream(*HEAD, (1, "a short note"), *TAIL))
    before = lawful.stat().st_mtime_ns
    assert heal_wrapped_text(lawful).healed == 0
    assert lawful.stat().st_mtime_ns == before, "a file with nothing to heal is not rewritten"


# --- breaker: the real toolchain, a minted drawing ----------------------------------------------


def _minted_long_note(tmp_path: Path) -> Path:
    """A DWG holding one MTEXT longer than LibreDWG's buffer, minted with LibreDWG's own dxf2dwg.

    ezdxf spells the note as group-3 chunks, which dxf2dwg's importer drops; so the DXF it is
    minted from spells the whole note under one group 1, the way a DWG stores it.
    """
    if shutil.which("dxf2dwg") is None:
        pytest.skip("dxf2dwg is not on PATH; checkup's libredwg probe owns that")
    document = ezdxf.new("R2000", setup=True)
    space = document.modelspace()
    space.add_line((0, 0), (1000, 0))
    space.add_mtext(LONG, dxfattribs={"char_height": 25}).set_location((10, 10))
    dxf = tmp_path / "long-note.dxf"
    document.saveas(str(dxf))
    lines = dxf.read_text(encoding="utf-8").split("\n")
    collapsed: list[str] = []
    chunks = ""
    index = 0
    while index + 1 < len(lines):
        code, value = lines[index].strip(), lines[index + 1]
        if code == "3":
            chunks += value
        else:
            collapsed += [lines[index], chunks + value if code == "1" else value]
            chunks = "" if code == "1" else chunks
        index += 2
    dxf.write_text("\n".join(collapsed + lines[index:]), encoding="utf-8")
    dwg = tmp_path / "long-note.dwg"
    subprocess.run(["dxf2dwg", "-y", "-o", str(dwg), str(dxf)], check=False, capture_output=True)
    assert dwg.is_file() and dwg.read_bytes()[:4] == b"AC10", "dxf2dwg minted no DWG"
    return dwg


def _census_text(tmp_path: Path, dwg: Path) -> str:
    """What LibreDWG itself says the drawing's one MTEXT holds — the reading the DXF must match."""
    census = tmp_path / "census.json"
    subprocess.run(["dwgread", "-O", "JSON", "-o", str(census), str(dwg)], check=False, capture_output=True)
    document = json.loads(census.read_text(encoding="utf-8", errors="replace"))
    texts = [entry["text"] for entry in document["OBJECTS"] if entry.get("entity") == "MTEXT"]
    assert len(texts) == 1, texts
    return texts[0]


def test_a_long_note_survives_the_conversion_whole_and_in_order(tmp_path: Path) -> None:
    """The conversion the lane hands on is read by `readfile`, and says what the DWG says."""
    dwg = _minted_long_note(tmp_path)
    result = convert_dwg(dwg, tmp_path / "out")
    assert result.refused == (), [entry.message() for entry in result.refused]
    document = ezdxf.readfile(str(result.dxf_path))
    (mtext,) = document.modelspace().query("MTEXT")
    expected = _census_text(tmp_path, dwg)
    assert len(expected) > 2 * WRAP_COLUMN, "the minted note is not long enough to be chunked"
    assert mtext.text == expected
    assert result.rejoined_lines + result.reordered_texts >= 1, (
        "this toolchain spelled the note lawfully; the breaker no longer breaks"
    )


def test_the_healed_conversion_ingests_with_every_entity(tmp_path: Path) -> None:
    dwg = _minted_long_note(tmp_path)
    result = convert_dwg(dwg, tmp_path / "out")
    artifact = ingest_dxf(result.dxf_path)
    kinds = sorted(entity["type"] for entity in artifact["entities"])
    assert kinds == ["LINE", "MTEXT"], kinds


# --- the reference drawing, when this machine has it ------------------------------------------


@pytest.mark.skipif(not REFERENCE_DRAWING.is_file(), reason="the reference sheet set is not on this machine")
def test_the_reference_structural_drawing_converts_and_ingests(tmp_path: Path) -> None:
    """22,000 entities and 100-odd layers, once refused over 13 wrapped lines of general notes."""
    result = convert_dwg(REFERENCE_DRAWING, tmp_path / "out")
    assert result.rejoined_lines >= 1, "the reference drawing no longer wraps; move this proof"
    document = ezdxf.readfile(str(result.dxf_path))
    assert len(document.modelspace()) >= 22_000
    assert len(document.layers) >= 100
    artifact = ingest_dxf(result.dxf_path)
    assert len(artifact["entities"]) >= 21_000
