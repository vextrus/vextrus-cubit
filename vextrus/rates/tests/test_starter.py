"""The starter data's own rules (ticket S16-RT): the finish line "every starter price cites its page,
and an empty price never prices 0", held on the data itself so a later edit that breaks it fails here."""

import re
from decimal import Decimal

from vextrus.rates import starter

PAGE = re.compile(r"\bp\. (?:\d+|x) / PDF \d+")


def test_every_starter_price_cites_a_printed_page_and_a_pdf_page() -> None:
    uncited = [row.code for row in starter.RESOURCES if not PAGE.search(row.source_ref)]
    assert uncited == []


def test_no_starter_price_is_a_silent_zero() -> None:
    zero = [row.code for row in starter.RESOURCES if row.price is not None and row.price <= 0]
    assert zero == [], "a price that is not known is empty (None), never 0"


def test_resource_codes_are_unique() -> None:
    codes = [row.code for row in starter.RESOURCES]
    assert len(codes) == len(set(codes))


def test_every_analysis_line_names_a_starter_resource_and_cites_a_page() -> None:
    known = {row.code for row in starter.RESOURCES}
    for analysis in starter.ANALYSES:
        assert analysis.lines, analysis.item_code
        for line in analysis.lines:
            assert line.resource in known, (analysis.item_code, line.resource)
            assert line.qty > 0
            assert PAGE.search(line.source_ref), (analysis.item_code, line.resource)


def test_item_codes_are_unique_and_the_slice_s_three_column_items_are_there() -> None:
    codes = [analysis.item_code for analysis in starter.ANALYSES]
    assert len(codes) == len(set(codes))
    assert {"RCC-COL-1:1.5:3", "FW-COL", "REBAR-500W"} <= set(codes)


def test_the_concrete_relations_are_pwd_s_for_1_5_3() -> None:
    """21.8 bags, 40.9 cft sand and 81.8 cft chips per 100 cft (qs-defaults §2.3 row 1)."""
    [analysis] = [a for a in starter.ANALYSES if a.item_code == "RCC-COL-1:1.5:3"]
    per_100 = {line.resource: line.qty * 100 for line in analysis.lines}
    assert per_100 == {
        "cement_opc": Decimal("21.8"),
        "sand_sylhet": Decimal("40.9"),
        "stone_chips": Decimal("81.8"),
    }
