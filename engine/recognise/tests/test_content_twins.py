"""S19-B7's content twins: the per-sheet layer histogram the sheet finder fills (13) and the rule
conflicts reads it by (19b), at their seams: `sheets.find` on hand-built artefacts, `compare` on
hand-made candidates with stand-in readers. Invented layers, titles and numbers; mechanics only.
"""

import math
from collections.abc import Callable, Mapping, Sequence
from dataclasses import replace

import pytest

from engine.geometry.placement import chain, chain_transform
from engine.read.anchor import DwgAnchor
from engine.recognise import conflicts
from engine.recognise.conflicts import TWIN, Recognisers, compare
from engine.recognise.sheets import find
from engine.recognise.tests.candidates import sheet
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.tests.stand_ins import stand_ins
from engine.recognise.tests.test_sheets import _main, _viewport
from engine.recognise.types import (
    Conflict,
    Continuation,
    SheetCandidate,
    SheetLocation,
)

# The histogram ----------------------------------------------------------------------------------


def framed(d: Sheets, block: str, at: tuple[float, float], number: str) -> None:
    insert = d.insert(block, (at[0], at[1], 0.0), layer="ZQ-FRAME")
    x, y, _ = chain_transform(chain(d.artefact(), [insert])).apply(value_at(2))
    d.text(number, (x, y, 0.0), kind="MTEXT", height=5.0, layer="ZQ-TEXT")


def test_a_model_sheet_counts_its_top_level_entities_by_layer_where_their_anchor_lies() -> None:
    d = Sheets()
    block = frame_block(d)
    framed(d, block, (0.0, 0.0), "EL-01")
    framed(d, block, (2000.0, 0.0), "EL-02")
    for k in range(3):
        d.line((100.0 + k, 100.0), (5000.0, 100.0), layer="ZQ-LAMP")  # starts inside EL-01
    d.entity("CIRCLE", {"center": [2100.0, 50.0, 0.0], "radius": 900.0}, layer="ZQ-FAN")
    d.text("NOTE", (2200.0, 60.0, 0.0), layer="ZQ-TEXT")
    d.line((1500.0, 100.0), (1600.0, 100.0), layer="ZQ-LAMP")  # between the frames
    d.line((math.inf, 0.0), (0.0, 0.0), layer="ZQ-LAMP")  # no finite anchor
    inner = d.block("INNER", (0.0, 0.0, 0.0))
    d.line((0.0, 0.0), (1.0, 1.0), layer="ZQ-INSIDE", owner=inner)
    d.insert(inner, (2300.0, 70.0, 0.0), layer="ZQ-SYMBOL")  # counted once, on its own layer

    found = {s.number.value: s for s in find(d.artefact(), None, DEFAULT) if s.number is not None}

    assert found["EL-01"].layers == (("ZQ-FRAME", 1), ("ZQ-LAMP", 3), ("ZQ-TEXT", 1))
    assert found["EL-02"].layers == (
        ("ZQ-FAN", 1),
        ("ZQ-FRAME", 1),
        ("ZQ-SYMBOL", 1),
        ("ZQ-TEXT", 2),
    )


def test_a_layouts_sheet_has_no_histogram() -> None:
    """A layout's sheet shows model space through its viewports: not read for content (`()`)."""
    d = Sheets()
    for i in range(5):
        d.line((10 * i, 0), (10 * i, 100), layer="ZQ-WALL")
    tab = d.layout("A-01")
    _main(d, tab)
    _viewport(d, tab, (20.0, 50.0), 2)
    d.insert(frame_block(d), (0, 0, 0), owner=tab)
    d.text("A-01", value_at(2), owner=tab)

    [found] = find(d.artefact(), None, DEFAULT)

    assert found.location.layout == "A-01"
    assert found.layers == ()


@pytest.mark.parametrize(
    "layers",
    [(("ZQ-A", 0),), (("ZQ-A", True),), (("ZQ-A", 2), ("ZQ-A", 3)), (("ZQ-A", 2.0),), [("ZQ-A", 1)]],
    ids=["zero", "bool", "twice", "float", "list"],
)
def test_a_histogram_counts_each_layer_once_by_a_positive_integer(layers: object) -> None:
    with pytest.raises((TypeError, ValueError)):
        SheetCandidate(SheetLocation(layout="L"), layers=layers)  # type: ignore[arg-type]


# The rule ----------------------------------------------------------------------------------------

FILE_A = DwgAnchor("a" * 64, "synthetic", "1", "Model", (), "1A")
FILE_B = DwgAnchor("b" * 64, "synthetic", "1", "Model", (), "1B")
BASE = {"ZQ-GRID": 20, "ZQ-WALL": 30, "ZQ-LAMP": 40, "ZQ-SWITCH": 20}
FITTINGS = {**BASE, "ZQ-FAN": 15, "ZQ-OUTLET": 25}
TRUNKING = {**BASE, "ZQ-TRUNK": 30}
TITLE = "LUMINAIRE ARRANGEMENT FOR 2ND FLOOR"


def drawn(
    number: str,
    title: str,
    layers: Mapping[str, int],
    anchor: DwgAnchor | None = FILE_A,
    group: str = "set",
) -> SheetCandidate:
    made = sheet(number, title, discipline="electrical", group=group)
    return replace(
        made,
        layers=tuple(sorted(layers.items())),
        anchors=() if anchor is None else (anchor,),
    )


def tweaked(layers: Mapping[str, int], layer: str, count: int) -> dict[str, int]:
    return {**layers, layer: count}


def grid(
    pair: tuple[Mapping[str, int], Mapping[str, int]] = (FITTINGS, TRUNKING),
    twin_titles: tuple[str, str] = ("LUMINAIRE ARRANGEMENT FOR 1ST FLOOR", "TRUNKING FOR 1ST FLOOR"),
    **kwargs: object,
) -> list[SheetCandidate]:
    """E-01 twins E-03 and E-02 twins E-04 (E-03 and E-04 the consecutive pair of one title)."""
    return [
        drawn("E-01", twin_titles[0], tweaked(pair[0], "ZQ-LAMP", 38)),
        drawn("E-02", twin_titles[1], tweaked(pair[1], "ZQ-LAMP", 38)),
        drawn("E-03", TITLE, pair[0], **kwargs),  # type: ignore[arg-type]
        drawn("E-04", TITLE, pair[1], **kwargs),  # type: ignore[arg-type]
    ]


def stated(table: Mapping[str, Sequence[str]]) -> Callable[[str], Sequence[str]]:
    return lambda text: table.get(text, ())


STATED = {
    "LUMINAIRE ARRANGEMENT FOR 1ST FLOOR": ("1ST FLOOR",),
    "TRUNKING FOR 1ST FLOOR": ("1ST FLOOR",),
    "LUMINAIRE ARRANGEMENT FOR 3RD FLOOR": ("3RD FLOOR",),
    "LUMINAIRE ARRANGEMENT FOR ROOF": ("ROOF",),
    "LUMINAIRE ARRANGEMENT FOR PODIUM": ("PODIUM",),
    TITLE: ("2ND FLOOR",),
}
READERS = replace(stand_ins(), stated=stated(STATED))


def run(sheets: Sequence[SheetCandidate], readers: Recognisers = READERS) -> list[object]:
    return list(compare(sheets, [()] * len(sheets), conventions=DEFAULT, recognisers=readers))


def numbers(item: object) -> list[str]:
    named = item.candidates if isinstance(item, Conflict) else item.sheets  # type: ignore[attr-defined]
    return [s.number.value for s in named if isinstance(s, SheetCandidate) and s.number is not None]


def parted(found: Sequence[object]) -> bool:
    """Whether E-03/E-04 is the one-title conflict (else it is a Continuation: one or the other)."""
    titles = [numbers(c) for c in found if isinstance(c, Conflict) and c.kind == "same_title"]
    runs = [numbers(c) for c in found if isinstance(c, Continuation)]
    assert (["E-03", "E-04"] in titles) != (["E-03", "E-04"] in runs), (titles, runs)
    return ["E-03", "E-04"] in titles


def test_a_pair_whose_sheets_twin_sheets_of_two_stems_parts() -> None:
    assert parted(run(grid()))


def test_twins_of_one_stem_over_two_floors_keep_the_pair() -> None:
    """The stem leaves out the storeys stated (the stand-in's) and the conventions' floor words."""
    titles = ("LUMINAIRE ARRANGEMENT FOR 1ST FLOOR", "LUMINAIRE ARRANGEMENT FOR 3RD FLOOR")
    assert not parted(run(grid(twin_titles=titles)))


def test_the_storeys_a_title_states_leave_its_stem() -> None:
    """Storeys named by words outside the conventions' floor words leave the stem only through the
    `stated` reader: with it the twins are one stem, without it (a stand-in states none) two."""
    titles = ("LUMINAIRE ARRANGEMENT FOR ROOF", "LUMINAIRE ARRANGEMENT FOR PODIUM")
    assert not parted(run(grid(twin_titles=titles)))
    assert parted(run(grid(twin_titles=titles), readers=stand_ins()))


def test_twins_of_one_stem_over_two_member_ranges_keep_the_pair() -> None:
    titles = ("BEAM B1-B6 DETAILS", "BEAM B7-B12 DETAILS")
    assert not parted(run(grid(twin_titles=titles)))


def test_a_sheet_with_no_file_or_no_histogram_has_no_twin() -> None:
    assert not parted(run(grid(anchor=None)))
    bare = grid()
    bare[3] = replace(bare[3], layers=())
    assert not parted(run(bare))


def test_twins_are_looked_for_in_the_sheets_own_file_and_group() -> None:
    other_file = grid()
    other_file[1] = replace(other_file[1], anchors=(FILE_B,))
    assert not parted(run(other_file))
    other_group = grid()
    other_group[1] = replace(other_group[1], group="tower-b")
    assert not parted(run(other_group))


def test_an_untitled_sheet_is_no_twin() -> None:
    untitled = grid()
    untitled[1] = replace(untitled[1], title=None)
    assert not parted(run(untitled))


def test_the_twin_threshold_is_inclusive_at_its_edge() -> None:
    """E-02 overlaps E-04 by exactly `TWIN` (90 of 100 entities on one layer): a near twin."""
    pair: tuple[dict[str, int], dict[str, int]] = ({"ZQ-X": 100}, {"ZQ-Y": 100})
    sheets = grid(pair=pair)
    sheets[0] = replace(sheets[0], layers=(("ZQ-X", 90),))
    sheets[1] = replace(sheets[1], layers=(("ZQ-Y", 90),))
    assert TWIN == 0.9
    assert parted(run(sheets))
    sheets[1] = replace(sheets[1], layers=(("ZQ-Y", 89),))
    assert not parted(run(sheets))


def test_a_twin_shared_by_both_sheets_keeps_the_pair() -> None:
    """A twin of E-03 under E-04's twin's stem: the stems of the two sheets' near twins meet."""
    sheets = [*grid(), drawn("E-05", "TRUNKING FOR 1ST FLOOR", tweaked(FITTINGS, "ZQ-LAMP", 39))]
    assert not parted(run(sheets))


def test_past_the_reads_bound_the_rule_sits_out(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(conflicts, "MAX_TWIN_READS", 1)
    assert not parted(run(grid()))


def test_a_stated_reader_returning_one_string_is_refused() -> None:
    readers = replace(READERS, stated=lambda text: "1ST FLOOR")
    with pytest.raises(TypeError):
        run(grid(), readers=readers)
