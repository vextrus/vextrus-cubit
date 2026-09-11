"""The open a converter's output survives, and what a drawing carries that no geometry stands for.

Every fixture here is written by the test itself, minimal and readable, because what is being graded
is a REFUSAL or a NOTE and not a drawing: a twenty-line file with one mis-paired tag says the thing
a two-million-line export says, and says it where a reader can see it (L-CAD-04, L-CAD-09).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from vextrus_cad import report
from vextrus_cad.ingest import IngestError, ingest_dxf
from vextrus_cad.report import Report
from vextrus_cad.resync import resync_tag_stream

MINIMAL = """0
SECTION
2
ENTITIES
0
LINE
5
100
8
0
10
0.0
20
0.0
11
10.0
21
0.0
0
ENDSEC
0
EOF
"""


def _write(tmp_path: Path, text: str, name: str = "probe.dxf") -> Path:
    path = tmp_path / name
    path.write_text(text)
    return path


def test_a_sound_minimal_drawing_opens_with_no_notes(tmp_path: Path) -> None:
    notes = Report()
    ingest_dxf(_write(tmp_path, MINIMAL), notes)
    assert report.RESYNCED_TAG_STREAM not in notes.codes()


def test_a_mis_paired_tag_line_is_resynced_once_and_the_count_travels(tmp_path: Path) -> None:
    """LibreDWG's `--as r2000` output carries a line where a group code belongs; the resync drops
    lines until the code/value rhythm resumes, and says how many — a repair nobody is told about is
    a silent edit of somebody's drawing."""
    broken = MINIMAL.replace("0\nLINE\n", "0\nLINE\nLWPOLYLINE\n", 1)
    notes = Report()
    ingest_dxf(_write(tmp_path, broken), notes)
    resynced = [note for note in notes.sorted_notes() if note.code == report.RESYNCED_TAG_STREAM]
    assert resynced, "a repaired tag stream is reported, never repaired in silence"
    assert resynced[0].count >= 1
    assert "lines dropped" in resynced[0].detail


def test_bytes_that_are_no_drawing_refuse_by_name_and_carry_the_line(tmp_path: Path) -> None:
    path = tmp_path / "rubbish.dxf"
    path.write_bytes(bytes(range(256)) * 8)
    with pytest.raises(IngestError) as raised:
        ingest_dxf(path)
    assert raised.value.code == report.DXF_UNREADABLE
    assert str(raised.value).startswith(report.DXF_UNREADABLE)


def test_a_file_the_filesystem_cannot_answer_is_ours_and_says_so(tmp_path: Path) -> None:
    with pytest.raises(IngestError) as raised:
        ingest_dxf(tmp_path / "no-such-file.dxf")
    assert raised.value.code == report.SOURCE_NOT_READABLE


def test_a_handle_minted_twice_refuses_rather_than_naming_two_entities_with_one_key(
    tmp_path: Path,
) -> None:
    """`source_key` would mint one key for both, the loader keeps whichever it read last, and
    everything downstream reads the artifact and nothing else (L-CAD-02)."""
    second = "0\nLINE\n5\n100\n8\n0\n10\n0.0\n20\n1.0\n11\n5.0\n21\n1.0\n0\nENDSEC\n"
    twice = MINIMAL.replace("0\nENDSEC\n", second, 1)
    with pytest.raises(IngestError) as raised:
        ingest_dxf(_write(tmp_path, twice))
    assert raised.value.code == report.HANDLES_NOT_UNIQUE
    assert "100" in str(raised.value)


def test_the_resync_is_allowed_once_and_not_until_it_works() -> None:
    """A resync that has to run twice is not repairing a stray line, it is guessing at a file."""
    repair = resync_tag_stream(MINIMAL.encode("utf-8"))
    assert repair.dropped == 0, "a sound stream is not 'repaired'"


class _Style:
    def __init__(self, font: str) -> None:
        self.dxf = type("D", (), {"font": font})()


class _Entity:
    def __init__(self, dxftype: str, embedded: bool = False) -> None:
        self._dxftype = dxftype
        self.has_embedded_object = embedded

    def dxftype(self) -> str:
        return self._dxftype


class _Doc:
    def __init__(self, entities: list[_Entity], fonts: list[str]) -> None:
        self.blocks: list[object] = []
        self.styles = [_Style(font) for font in fonts]
        self.layouts = [entities]


@pytest.mark.parametrize(
    ("dxftype", "code"),
    [
        ("MULTILEADER", report.MULTILEADER_NOT_EXPLODED),
        ("MLEADER", report.MULTILEADER_NOT_EXPLODED),
        ("ACAD_PROXY_ENTITY", report.PROXY_ENTITY),
        ("OLE2FRAME", report.OLE2FRAME),
        ("IMAGE", report.IMAGE_REFERENCE),
        ("WIPEOUT", report.WIPEOUT),
    ],
)
def test_what_the_drawing_carries_and_the_artifact_does_not_draw_is_named(dxftype: str, code: str) -> None:
    notes = Report()
    report.survey(_Doc([_Entity(dxftype)], []), notes)
    assert code in notes.codes(), f"a {dxftype} must be counted, never silently dropped"


def test_an_unresolved_shx_font_and_an_embedded_object_are_each_named() -> None:
    notes = Report()
    report.survey(_Doc([_Entity("MTEXT", embedded=True)], ["romans.shx"]), notes)
    assert report.SHX_FONT_UNRESOLVED in notes.codes()
    assert report.EMBEDDED_OBJECT in notes.codes()


def test_the_curve_tolerance_is_a_millimetre_length_on_every_drawing() -> None:
    """0.01 mm is 0.01 mm whether the file is drawn in millimetres, inches or feet — the bare 0.01
    it replaced was 0.01 mm on one and 3 mm on another (L-MEA-01)."""
    notes = Report()
    assert report.flatten_tolerance(4, notes) == pytest.approx(0.01)
    assert report.flatten_tolerance(1, notes) * 25.4 == pytest.approx(0.01)
    assert report.flatten_tolerance(2, notes) * 304.8 == pytest.approx(0.01)
    assert notes.codes() == [], "a drawing that states its unit needs no note"


def test_a_drawing_that_states_no_unit_says_so_rather_than_pretending_to_millimetres() -> None:
    notes = Report()
    report.flatten_tolerance(0, notes)
    assert report.CURVE_TOLERANCE_NOT_IN_MM in notes.codes()
