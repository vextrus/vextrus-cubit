"""Two synthetic sets drawn differently, segmented by one code path, each read with its own conventions
file (13's prompt: frame block, title-block layout and sheet count differ). Built at test time through
the real writer and read by the real reader, so these need the toolchain:

    uv run --no-sync pytest -m needs_toolchain engine/recognise/tests/test_synthetic_sets.py

Set A (engine/fixtures/dwg/sheet_set_layouts.py): sheets on layouts, an attributed frame block,
landscape and portrait. Set B (sheet_set_model.py): frames in model space, turned, scaled and
mirrored, a title block of plain text labelled with words only set B's conventions hold, a cover and
a stale layout. Synthetic sets prove mechanics, never a reading.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.export import load_schema, validate
from engine.fixtures import dwg
from engine.read import read
from engine.recognise import register, sheets
from engine.recognise.sheets import LIMITS
from engine.recognise.tests.drawing import DEFAULT
from engine.recognise.types import ExclusionReason, SheetConventions, ValueSource

SET_B_WORDS = {
    "number": ["drg ref"],
    "title": ["subject"],
    "revision_mark": ["rev"],
    "issue_date": ["date"],
}
"""Set B's office labels its title block otherwise: its conventions say so, the code does not."""


def conventions_b() -> SheetConventions:
    data = DEFAULT.to_json()
    data["title_block_fields"] = [
        {"field": name, "words": words, "position": None} for name, words in SET_B_WORDS.items()
    ]
    return SheetConventions.from_json(data)


@pytest.fixture(scope="module")
def sets(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    build = tmp_path_factory.mktemp("sheet-sets-build")
    writer = dwg.build_writer(build)
    found = {}
    for name in ("sheet_set_layouts", "sheet_set_model"):
        folder = tmp_path_factory.mktemp(name)
        (folder / f"{name}.dwg").write_bytes(dwg.build(name, build, writer).read_bytes())
        found[name] = folder
    return found


@pytest.mark.needs_toolchain
def test_set_a_sheets_on_layouts_are_read_from_their_attributes(sets: dict[str, Path]) -> None:
    artefact = read(sets["sheet_set_layouts"] / "sheet_set_layouts.dwg")

    found = sheets.find(artefact, "structural", DEFAULT)

    assert [s.location.layout for s in found] == ["S-101", "S-102", "S-103"]
    values = [
        (
            s.number and s.number.value,
            s.title and s.title.value,
            s.revision_mark and s.revision_mark.value,
        )
        for s in found
    ]
    assert values == [
        ("S-101", "PILE CAP LAYOUT PLAN", "R1"),
        ("S-102", "2ND & 4TH FLOOR BEAM LAYOUT PLAN", "R0"),
        ("S-103", "COLUMN SCHEDULE", "R2"),
    ]
    assert all(
        s.number is not None and s.number.source == ValueSource.TITLE_BLOCK_ATTRIBUTE for s in found
    )
    assert found[1].storeys_as_stated is not None
    assert found[1].storeys_as_stated.value == "2ND & 4TH FLOOR"


@pytest.mark.needs_toolchain
def test_set_b_frames_in_model_space_are_read_with_its_own_conventions(sets: dict[str, Path]) -> None:
    artefact = read(sets["sheet_set_model"] / "sheet_set_model.dwg")

    with_default = sheets.find(artefact, None, DEFAULT)
    found = sheets.find(artefact, None, conventions_b())

    out = {s.exclusion.reason: s for s in found if s.exclusion is not None}
    framed = [s for s in found if s.exclusion is None]
    assert len(framed) == 5
    assert set(out) == {ExclusionReason.BLANK, ExclusionReason.COVER_INDEX}
    assert out[ExclusionReason.BLANK].location.layout == "Layout1"
    assert out[ExclusionReason.BLANK].number is None
    # The cover (a plain rectangle of text) is kept, proposed out, with nothing read from it (#162).
    cover = out[ExclusionReason.COVER_INDEX]
    assert cover.location.box is not None
    assert cover.number is None
    assert cover.title is None
    numbers = sorted(s.number.value for s in framed if s.number)
    assert numbers == ["B-01", "B-02", "B-03", "B-04", "B-05"]
    titles = {s.number.value: s.title.value for s in framed if s.number and s.title}
    assert titles["B-02"] == "TIE BEAM LAYOUT PLAN"
    assert titles["B-04"] == "ROOF BEAM DETAILS"
    assert titles["B-05"] == "STAIR DETAILS"
    by_number = {s.number.value: s for s in framed if s.number}
    assert by_number["B-03"].storeys_as_stated is not None
    assert by_number["B-03"].storeys_as_stated.value == "1ST TO TOP FLOOR"
    b03 = by_number["B-03"].location.box
    assert b03 is not None
    assert b03.x1 - b03.x0 == pytest.approx(48 * 16.54, rel=1e-6)
    assert all(s.number for s in framed)
    # The default does not know set B's labels: the frames are found, their numbers are not read.
    assert sum(1 for s in with_default if s.exclusion is None) == 5
    assert not any(s.number for s in with_default)


@pytest.mark.needs_toolchain
@pytest.mark.parametrize(("name", "sheet_count"), [("sheet_set_layouts", 3), ("sheet_set_model", 7)])
def test_the_harness_segments_each_set_with_its_own_conventions_file(
    sets: dict[str, Path], tmp_path: Path, name: str, sheet_count: int
) -> None:
    folder = tmp_path / "conventions"
    folder.mkdir()
    chosen = DEFAULT if name == "sheet_set_layouts" else conventions_b()
    (folder / "sheet-default.json").write_text(json.dumps(chosen.to_json()))
    out = tmp_path / "out" / "export.json"

    document: Any = harness.run(sets[name], out, conventions=folder)

    (reading,) = document["files"]
    states = {stage: report["state"] for stage, report in reading["stages"].items()}
    for stage in ("read", "sheets", "register", "render_buffers", "rasterise"):
        assert states[stage] == "ok", (stage, reading["stages"][stage])
    assert len(reading["sheets"]) == sheet_count
    assert validate(document, load_schema()) == []
    # review round 3: the finder's report reaches the export, every limit given, none reached
    assert {name: reading["sheet_report"][name] for name in LIMITS} == dict.fromkeys(LIMITS, 0)


@pytest.mark.needs_toolchain
def test_the_register_stage_gets_the_stamped_sheets_and_names_them_back(sets: dict[str, Path]) -> None:
    artefact = read(sets["sheet_set_layouts"] / "sheet_set_layouts.dwg")
    found = sheets.find(artefact, None, DEFAULT)

    assert register.find(artefact, found) == []
