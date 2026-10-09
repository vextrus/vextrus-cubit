"""Ticket T-W332's acceptance, the engine part: a Sheet's title may come from its one drawing View, so
the sources a Sheet's words carry gain "view_title" (the ticket's section 3 A; #332).

Through the seams `engine.recognise.types.ValueSource` and `engine.export.load_schema()`, never the
views module's insides (S15-E4 splits it). Re-submitted as S15-E6 (#537). Every title here is invented.

    uv run pytest engine/recognise/tests/acceptance/w332
"""

from engine.export import load_schema
from engine.recognise.types import (
    Box,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
)


def test_a_title_read_from_a_view_has_its_own_source() -> None:
    assert ValueSource("view_title").name == "VIEW_TITLE"
    assert str(ValueSource["VIEW_TITLE"]) == "view_title"

    sheet = SheetCandidate(
        SheetLocation(box=Box(0.0, 0.0, 840.0, 594.0)),
        number=Sourced("ST-21", ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced("CANOPY SLAB DETAIL", ValueSource["VIEW_TITLE"]),
    )

    assert sheet.title == Sourced("CANOPY SLAB DETAIL", ValueSource("view_title"))


def test_the_export_schema_lists_the_view_title_source() -> None:
    sourced = load_schema()["$defs"]["sourced"]["anyOf"][1]["properties"]["source"]["enum"]

    assert "view_title" in sourced
    assert sourced == [str(s) for s in ValueSource]
