"""13's sheet-type request through Jev's client (review round 1 of ticket 13): the facts
`sheets.judgement` builds are the ones the `sheet_type` node takes, so with TypeSafe down the answer is
the down reason and the QS picks; it is never `bad_question`, the caller's mistake that would keep Jev
from ever being asked. Invented sheets only."""

import uuid
from collections.abc import Callable

import pytest

from engine.recognise import sheets
from engine.recognise.types import SheetCandidate, SheetLocation, Sourced, ValueSource
from vextrus.platform.services import jev, tenancy
from vextrus.testing.jev import DOWN

STRUCTURAL = Sourced("structural", ValueSource.FILE)
TITLE = Sourced("BEAM LAYOUT", ValueSource.TITLE_BLOCK_TEXT)
NUMBER = Sourced("S-07", ValueSource.TITLE_BLOCK_TEXT)

REQUESTS = {
    "a title and a number": (SheetCandidate(SheetLocation(layout="L"), NUMBER, TITLE, STRUCTURAL), ()),
    "a title and view titles": (
        SheetCandidate(SheetLocation(layout="L"), title=TITLE, discipline=STRUCTURAL),
        ("BEAM LAYOUT PLAN", 'SECTION "A"'),
    ),
    "view titles only": (
        SheetCandidate(SheetLocation(layout="L"), number=NUMBER, discipline=STRUCTURAL),
        ("BEAM LAYOUT PLAN",),
    ),
}


@pytest.mark.django_db
@pytest.mark.parametrize("way", ["no_connection", "timeout"])
@pytest.mark.parametrize("case", list(REQUESTS))
def test_13s_request_meets_the_node_so_typesafe_down_is_the_answer(
    case: str,
    way: str,
    make_developer: Callable[..., uuid.UUID],
    jev_down: Callable[[str], None],
) -> None:
    sheet, view_titles = REQUESTS[case]
    request = sheets.judgement(sheet, view_titles)
    assert request is not None
    jev_down(way)

    with tenancy.acting_in(make_developer()):
        answer = jev.ask_judgement(request)

    assert answer == jev.Unavailable(DOWN[way])
    assert answer != jev.Unavailable(jev.Why.BAD_QUESTION)
