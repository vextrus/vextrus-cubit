"""The corpora's own census under EntityGraph v3: which texts are turned, and the traps v3 arms.

Beside the DXF sanity suites on purpose: each reads its drawing through the corpus's memo under the
same name (`dxf-artifact:rcc6-bnbc.dxf`, `dxf-artifact`), so on whichever worker these land beside
them the drawing is ingested once, not once more (V-VERIFY).

F-RCC6-BNBC writes 110 of its TEXT marks up the sheet — the vertical beams of S-13, S-14 and S-15,
the GB marks of S-08, TG1 and one paper text — and one level at 180° (`D77`, "EL +3.353"). Every
MTEXT and ATTRIB is square. F-RCC6 is square throughout. A census that moves is a drawing that moved
or an extractor that reads rotation differently, and either is a declared change.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from vextrus_cad import ENTITYGRAPH_VERSION, ingest_dxf

BNBC_DXF = "rcc6-bnbc.dxf"
RCC6_DXF = "rcc6.dxf"

#: T-TEXT-ROTATED's two handles: TG1's mark on S-13, up the sheet, and the level turned half round.
TG1_MARK = "DXF_HANDLE:D75"
LEVEL_AT_180 = "DXF_HANDLE:D77"

#: T-BLOCK-NESTED: the PC3 detail, three deep, the bar mirrored and the cage scaled (2, 1).
PC3_DETAIL = "DXF_HANDLE:68F"

#: T-LAYER-FROZEN's layer, and T-DIM-OVERRIDE's and T-DIM-SUFFIX's dimensions.
FROZEN_LAYER = "OLD-SCHEME-REV0"
DIM_OVERRIDE = "DXF_HANDLE:926"
DIM_SUFFIX = "DXF_HANDLE:846"


def _bnbc(bnbc_corpus) -> dict[str, Any]:
    # The same memo name test_rcc6_bnbc_dxf_sanity.py reads the drawing under.
    return bnbc_corpus.once(f"dxf-artifact:{BNBC_DXF}", lambda: ingest_dxf(bnbc_corpus.require(BNBC_DXF)))


def _rcc6(corpus) -> dict[str, Any]:
    # The same memo name test_rcc6_dxf_sanity.py reads the drawing under.
    return corpus.once("dxf-artifact", lambda: ingest_dxf(corpus.require(RCC6_DXF)))


def _census(artifact: dict[str, Any]) -> Counter[tuple[str, str, float]]:
    """(kind, type, rotation) over every text-bearing record the artifact carries."""
    census: Counter[tuple[str, str, float]] = Counter()
    for kind in ("entities", "derived"):
        for record in artifact[kind]:
            if "text" in record:
                census[(kind, record["type"], record["rotation"])] += 1
    for record in artifact["block_attributes"]:
        census[("block_attributes", "ATTRIB", record["rotation"])] += 1
    return census


def test_bnbc_writes_110_marks_up_the_sheet_and_one_level_half_round(bnbc_corpus) -> None:
    artifact = _bnbc(bnbc_corpus)
    assert artifact["entitygraph_version"] == ENTITYGRAPH_VERSION

    turned = {
        record["key"]: (record["type"], record["rotation"], record["text"])
        for record in artifact["entities"]
        if "text" in record and record["rotation"] != 0.0
    }
    up = [key for key, (_, rotation, _) in turned.items() if rotation == 90.0]
    # 110 since Rev C (fixtures/gen/rcc6_bnbc/DECISIONS.md W-44): Rev B's 88 kept, key for key, and 22
    # added — S-08's marks on the grade-beam spans Rev B left unmarked, 21 of them on the spans that run
    # up the sheet (GB1 x6, GB3 x12, GB4 x2, GB5), and the seventh LB1 on the roof layout (K6).
    assert len(up) == 110, f"F-RCC6-BNBC writes 110 TEXT marks at 90°, not {len(up)}"
    assert all(turned[key][0] == "TEXT" for key in up)
    assert {key: value for key, value in turned.items() if value[1] != 90.0} == {
        LEVEL_AT_180: ("TEXT", 180.0, "EL +3.353"),
    }
    assert TG1_MARK in up, "TG1's mark on S-13 runs up the sheet (T-TEXT-ROTATED)"

    census = _census(artifact)
    square_or_not = {(kind, dxftype) for kind, dxftype, rotation in census if rotation != 0.0}
    assert square_or_not <= {("entities", "TEXT"), ("derived", "TEXT")}, (
        f"only TEXT turns on F-RCC6-BNBC; every MTEXT and ATTRIB is square: {sorted(census.items())}"
    )
    # Rev C (DECISIONS.md W-44, W-49) adds and removes nothing square but these: five grid bubbles on the
    # stair roof's grid (2, 3, 4, C, D: 344 -> 349), and the measurement MTEXT of the 27 dimensions Rev C
    # draws (152 against Rev B's 125: 150 -> 177).
    assert census[("block_attributes", "ATTRIB", 0.0)] == 349
    assert census[("entities", "MTEXT", 0.0)] + census[("derived", "MTEXT", 0.0)] == 177


def test_orientation_changes_neither_the_string_nor_its_anchor(bnbc_corpus) -> None:
    """T-TEXT-ROTATED's expectation, now that the turn is carried: the string and the anchor are
    the ones v2 read, and the turn rides beside them."""
    records = {record["key"]: record for record in _bnbc(bnbc_corpus)["entities"]}
    mark = records[TG1_MARK]
    assert mark["rotation"] == 90.0
    assert mark["text"].strip() != "" and len(mark["points"]) == 1
    assert (mark["halign"], mark["valign"]) == (1, 2), "the beam marks are written MIDDLE_CENTER"
    assert mark["align_point"] == mark["points"][0], "this generator writes the insert at the alignment point"


def test_rcc6_is_square_throughout(corpus) -> None:
    census = _census(_rcc6(corpus))
    assert census, "F-RCC6 carries text"
    turned = {key: count for key, count in census.items() if key[2] != 0.0}
    assert turned == {}, f"F-RCC6 writes every text square: {turned}"
    assert census[("entities", "TEXT", 0.0)] == 389
    assert census[("entities", "MTEXT", 0.0)] + census[("derived", "MTEXT", 0.0)] == 35


def test_the_nested_pc3_detail_is_placed_with_its_whole_transform(bnbc_corpus) -> None:
    """T-BLOCK-NESTED: the bar's mark, mirrored then scaled then moved, stands where the world sees it
    — v2 read its explode's OCS insert raw and put it on the far side of the y axis, a stray."""
    artifact = _bnbc(bnbc_corpus)
    detail = next(record for record in artifact["entities"] if record["key"] == PC3_DETAIL)
    assert detail["block"]["name"] == "PC3_DETAIL"
    assert detail["block"]["at"] == [800000.0, -203895.4]
    assert (detail["block"]["rotation"], detail["block"]["mirrored"]) == (0.0, False)
    assert detail["block"]["definition_sha256"] is not None

    (mark,) = [
        paint for paint in artifact["derived"] if paint["src"] == PC3_DETAIL and paint.get("text") == "PC3-bx"
    ]
    # (620, 300) in the bar, mirrored in x, scaled (2, 1), moved to the detail's insert.
    assert mark["points"] == [[800000.0 - 1240.0, -203895.4 + 300.0]]
    assert mark["rotation"] == 180.0, "a square mark mirrored in x runs right to left"


def test_the_frozen_layer_and_the_stated_dimension_text_are_carried(bnbc_corpus) -> None:
    """T-LAYER-FROZEN and T-DIM-OVERRIDE / T-DIM-SUFFIX now have their evidence in the artifact:
    carried, not yet applied — what a frozen layer or an override means is a stage over it."""
    artifact = _bnbc(bnbc_corpus)
    frozen = [layer["name"] for layer in artifact["layers"] if layer["frozen"]]
    assert frozen == [FROZEN_LAYER]

    records = {record["key"]: record for record in artifact["entities"]}
    assert records[DIM_OVERRIDE]["override"] == "14'-2\""
    assert records[DIM_SUFFIX]["override"] == '<>"'
