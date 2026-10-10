"""S19-B7: a copied title block over a different drawing, told apart by what is drawn (the owner,
session 20: "Keep it in M0"; the content-twin rule, R3b of the session-19 analysis of stale-title
pairs).

Two consecutive sheets of one title, today a Continuation, are apart, and their title is the one-title
conflict (`same_title`), when:
- each has a near twin elsewhere in its file: another sheet whose weighted layer overlap with it is
  0.9 or more (entities per layer inside the sheet's frame: the sum of the lesser counts over the sum
  of the greater; `drawing.overlap`);
- the two twins' title stems differ (a title's stem: its words without the storeys and member marks
  it states, so one drawing type over several floors or mark ranges is one stem); and
- each sheet is closer to its twin than to its partner.

Through the harness (engine/harness.py) on invented electrical and structural files in model space,
written by the repo's writer (drawing.py); the export's `continuations` and `conflicts` are read. Every
title and layer here is made up. The guards hold on main today and must still hold after the build:
a true continuation whose sheets share little and twin nothing; per-floor or per-mark-range details
whose sheets twin each other under one stem (the raw-title trap); a pair where only one sheet has a
twin; a pair closer to each other than to their twins; and twins found only in another file.

    uv run pytest -m needs_toolchain engine/recognise/tests/acceptance/ts19b7
"""

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.recognise.tests.acceptance.ts19b7.drawing import Layers, Sheet, build_set, changed, overlap

pytestmark = pytest.mark.needs_toolchain

TWIN = 0.9
"""A near twin's least weighted layer overlap."""

BACKDROP: Layers = {"ZQ-GRID": 20, "ZQ-WALL": 30}
FITTINGS: Layers = {**BACKDROP, "ZQ-LAMP": 40, "ZQ-SWITCH": 20, "ZQ-FAN": 15, "ZQ-OUTLET": 25}
"""A fittings plan's content."""
TRUNKING: Layers = {**BACKDROP, "ZQ-LAMP": 40, "ZQ-SWITCH": 20, "ZQ-TRUNK": 30}
"""The same plan with its trunking drawn and its fans and outlets left off."""

LUMINAIRE = "LUMINAIRE ARRANGEMENT"
WITH_TRUNKING = "LUMINAIRE ARRANGEMENT WITH TRUNKING"
FLOORS = (
    "FOR 11TH TO 12TH STOREY",
    "FOR 13TH TO 14TH STOREY",
    "FOR 15TH TO 16TH STOREY",
)


def grid(layers: Mapping[str, Layers], titles: Mapping[str, tuple[str, str]]) -> list[Sheet]:
    """An electrical file's 3 x 2 grid, numbered down the columns: EL-01 (column 0, row 1), EL-02
    (column 0, row 2), EL-03 (column 1, row 1) ... EL-06."""
    return [
        Sheet(number, titles[number], column=(n - 1) // 2, row=1 + (n - 1) % 2, layers=layers[number])
        for n in range(1, 7)
        for number in [f"EL-{n:02d}"]
    ]


def stems(copied: tuple[str, str] | None = None) -> dict[str, tuple[str, str]]:
    """Row 1 the fittings stem, row 2 the trunking stem, one floor group per column; EL-04 carries
    EL-03's title exactly (or `copied` on both EL-03 and EL-04)."""
    titles = {
        "EL-01": (LUMINAIRE, FLOORS[0]),
        "EL-02": (WITH_TRUNKING, FLOORS[0]),
        "EL-03": (LUMINAIRE, FLOORS[1]),
        "EL-04": (LUMINAIRE, FLOORS[1]),
        "EL-05": (LUMINAIRE, FLOORS[2]),
        "EL-06": (WITH_TRUNKING, FLOORS[2]),
    }
    if copied is not None:
        titles["EL-03"] = titles["EL-04"] = copied
    return titles


ROWS: dict[str, Layers] = {
    "EL-01": changed(FITTINGS, ZQ_LAMP=37),
    "EL-02": changed(TRUNKING, ZQ_LAMP=38),
    "EL-03": FITTINGS,
    "EL-04": TRUNKING,
    "EL-05": changed(FITTINGS, ZQ_SWITCH=18),
    "EL-06": changed(TRUNKING, ZQ_TRUNK=27),
}
"""EL-03's content twins EL-01 and EL-05 (the fittings row); EL-04's twins EL-02 and EL-06 (the
trunking row); EL-03 and EL-04 share only the backdrop, lamps and switches."""


def read(tmp_path: Path, files: Mapping[str, Sequence[Sheet]]) -> dict[str, Any]:
    folder = build_set(tmp_path / "set", _mkdir(tmp_path / "build"), files)
    document: dict[str, Any] = harness.run(folder, tmp_path / "out" / "export.json")
    assert document["set_stages"]["conflicts"]["state"] == "ok", document["set_stages"]["conflicts"]
    return document


def _mkdir(path: Path) -> Path:
    path.mkdir(parents=True)
    return path


def number_of(document: dict[str, Any], ref: dict[str, int]) -> str:
    sheet = document["files"][ref["file"]]["sheets"][ref["sheet"]]
    assert sheet["number"] is not None, sheet
    number: str = sheet["number"]["value"]
    return number


def continuations(document: dict[str, Any]) -> list[list[str]]:
    return [[number_of(document, r) for r in c["sheets"]] for c in document["continuations"]]


def same_titles(document: dict[str, Any]) -> list[list[str]]:
    return [
        [number_of(document, r) for r in c["candidates"]]
        for c in document["conflicts"]
        if c["kind"] == "same_title"
    ]


def title_of(document: dict[str, Any], number: str) -> str:
    for reading in document["files"]:
        for sheet in reading["sheets"]:
            if sheet["number"] is not None and sheet["number"]["value"] == number:
                title: str = sheet["title"]["value"]
                return title
    raise AssertionError(f"no sheet {number} in the export")


def test_the_fixture_is_what_the_rule_reads() -> None:
    """The content the files draw, by the rule's measure: each of the pair twins its own row, and the
    pair shares far less."""
    assert overlap(ROWS["EL-03"], ROWS["EL-01"]) >= 0.95
    assert overlap(ROWS["EL-04"], ROWS["EL-02"]) >= 0.95
    assert overlap(ROWS["EL-03"], ROWS["EL-04"]) < 0.65


# The pair apart -----------------------------------------------------------------------------------


def test_a_copied_title_block_over_the_next_rows_drawing_is_the_one_title_conflict(
    tmp_path: Path,
) -> None:
    """EL-04 carries EL-03's title exactly, but draws what the trunking row draws: EL-03 twins the
    fittings sheets, EL-04 the trunking sheets, their stems differ, and each is closer to its twin
    than to the other. The pair is no Continuation; its title is `same_title` on {EL-03, EL-04}."""
    document = read(tmp_path, {"electrical/EL-grid": grid(ROWS, stems())})

    assert ["EL-03", "EL-04"] not in continuations(document)
    assert same_titles(document) == [["EL-03", "EL-04"]]
    [conflict] = [c for c in document["conflicts"] if c["kind"] == "same_title"]
    assert conflict["evidence"] == {"title": title_of(document, "EL-03"), "sheets": 2}


def test_the_pair_is_apart_when_the_title_copied_is_the_other_rows(tmp_path: Path) -> None:
    """The rule is the same whichever sheet's title was copied: both carry the trunking stem's title
    while EL-03 draws the fittings row's content."""
    copied = (WITH_TRUNKING, FLOORS[1])
    document = read(tmp_path, {"electrical/EL-grid": grid(ROWS, stems(copied))})

    assert ["EL-03", "EL-04"] not in continuations(document)
    assert same_titles(document) == [["EL-03", "EL-04"]]


# Guards: what stays a Continuation ----------------------------------------------------------------


def test_a_true_continuation_sharing_little_and_twinning_nothing_stays_one(tmp_path: Path) -> None:
    """A schedule over two sheets: the second draws mostly what the first does not (overlap far below
    the twins' 0.9, as true continuations do), and neither has a twin in the file."""
    first: Layers = {"ZQ-TABLE": 60, "ZQ-ROWTEXT": 40}
    second: Layers = {"ZQ-TABLE": 10, "ZQ-SINGLELINE": 70}
    assert overlap(first, second) < 0.1
    schedule = ("SWITCHBOARD", "SCHEDULE")
    sheets = [
        Sheet("EL-01", (LUMINAIRE, FLOORS[0]), 0, 1, FITTINGS),
        Sheet("EL-02", (WITH_TRUNKING, FLOORS[0]), 0, 2, TRUNKING),
        Sheet("EL-07", schedule, 1, 1, first),
        Sheet("EL-08", schedule, 1, 2, second),
    ]
    document = read(tmp_path, {"electrical/EL-schedules": sheets})

    assert continuations(document) == [["EL-07", "EL-08"]]
    assert same_titles(document) == []


BARS: Layers = {"ZQ-BAR": 60, "ZQ-OUTLINE": 30, "ZQ-DIM": 20}
"""A beam elevation sheet's content."""
SECTIONS: Layers = {"ZQ-BAR": 20, "ZQ-SECTION": 50, "ZQ-TABLE": 40}
"""A beam sections and schedule sheet's content."""


def beam_sheets(titles: Sequence[tuple[str, str]]) -> list[Sheet]:
    """S-10 to S-15, two per title group, elevations then sections: S-10's nearest twin is S-12, S-11's
    is S-15 (each identical), so the twins' raw titles differ while their stems are one."""
    contents = [
        BARS,
        SECTIONS,
        BARS,
        changed(SECTIONS, ZQ_SECTION=45),
        changed(BARS, ZQ_BAR=54),
        SECTIONS,
    ]
    return [
        Sheet(f"S-{10 + n}", titles[n], column=n // 2, row=1 + n % 2, layers=contents[n])
        for n in range(6)
    ]


PER_FLOOR = [(f"{floor} FLOOR BEAM", "DETAILS") for floor in ("2ND", "2ND", "3RD", "3RD", "4TH", "4TH")]
PER_MARKS = [("BEAM", f"B{1 + 6 * n}-B{6 + 6 * n} DETAILS") for n in range(6)]


@pytest.mark.parametrize(
    ("titles", "expected"),
    [
        (PER_FLOOR, [["S-10", "S-11"], ["S-12", "S-13"], ["S-14", "S-15"]]),
        (PER_MARKS, [["S-10", "S-11", "S-12", "S-13", "S-14", "S-15"]]),
    ],
    ids=["per-floor", "per-mark-range"],
)
def test_details_that_twin_across_floors_or_mark_ranges_under_one_stem_stay_continuations(
    tmp_path: Path, titles: Sequence[tuple[str, str]], expected: list[list[str]]
) -> None:
    """The raw-title trap: each sheet of a pair twins a sheet of another floor or mark range, and the
    two twins' raw titles differ, but their stem is one ("beam details"): stems, not raw titles."""
    sheets = beam_sheets(titles)
    assert overlap(sheets[0].layers, sheets[2].layers) == 1.0
    assert overlap(sheets[1].layers, sheets[5].layers) == 1.0
    assert overlap(sheets[0].layers, sheets[1].layers) < 0.15
    document = read(tmp_path, {"structural/S-beams": sheets})

    assert continuations(document) == expected
    assert same_titles(document) == []


def test_a_pair_where_only_one_sheet_has_a_near_twin_stays_a_continuation(tmp_path: Path) -> None:
    """EL-03 twins EL-01; EL-04's nearest sheet, EL-02 (the trunking stem), overlaps it by only 0.8:
    no near twin, so the pair stays one."""
    rows = dict(ROWS)
    rows["EL-02"] = {**TRUNKING, "ZQ-CABLETRAY": 35}
    rows["EL-05"] = {"ZQ-RISER": 50, "ZQ-PANEL": 30}
    rows["EL-06"] = {"ZQ-RISER": 20, "ZQ-EARTH": 45}
    assert overlap(rows["EL-04"], rows["EL-02"]) == pytest.approx(0.8)
    assert all(overlap(rows["EL-04"], rows[n]) < 0.85 for n in rows if n != "EL-04")
    document = read(tmp_path, {"electrical/EL-grid": grid(rows, stems())})

    assert continuations(document) == [["EL-03", "EL-04"]]
    assert same_titles(document) == []


def test_a_pair_closer_to_each_other_than_to_their_twins_stays_a_continuation(
    tmp_path: Path,
) -> None:
    """Each of the pair has a near twin (0.92) under a different stem, but the two are nearer still to
    each other (0.95): one drawing over two sheets."""
    pair_one = {**FITTINGS, "ZQ-MARKER-A": 4}
    pair_two = {**FITTINGS, "ZQ-MARKER-B": 4}
    rows = dict(ROWS)
    rows["EL-03"], rows["EL-04"] = pair_one, pair_two
    rows["EL-01"] = changed(pair_one, ZQ_LAMP=28)
    rows["EL-02"] = changed(pair_two, ZQ_LAMP=28)
    rows["EL-05"] = {"ZQ-RISER": 50, "ZQ-PANEL": 30}
    rows["EL-06"] = {"ZQ-RISER": 20, "ZQ-EARTH": 45}
    assert overlap(pair_one, rows["EL-01"]) >= TWIN
    assert overlap(pair_two, rows["EL-02"]) >= TWIN
    assert overlap(pair_one, pair_two) > max(
        overlap(pair_one, rows["EL-01"]), overlap(pair_two, rows["EL-02"])
    )
    document = read(tmp_path, {"electrical/EL-grid": grid(rows, stems())})

    assert continuations(document) == [["EL-03", "EL-04"]]
    assert same_titles(document) == []


def test_twins_only_in_another_file_do_not_part_the_pair(tmp_path: Path) -> None:
    """A near twin is looked for in the sheet's own file: EL-04's trunking twins lie in a second file
    of the set, so the pair stays one."""
    sheets = grid(ROWS, stems())
    by_number = {s.number: s for s in sheets}
    files = {
        "electrical/EL-grid": [by_number[n] for n in ("EL-01", "EL-03", "EL-04", "EL-05")],
        "electrical/EL-trunking": [by_number[n] for n in ("EL-02", "EL-06")],
    }
    document = read(tmp_path, files)

    assert continuations(document) == [["EL-03", "EL-04"]]
    assert same_titles(document) == []
