"""The recordings are TypeSafe's own answers (ticket 15). Marked `live`: they run only when asked
(`-m live`), with the owner's development key from the environment and nowhere else (ADR 0013), on
invented sheets only, never drawing text.

`VEXTRUS_JEV_RECORD=1` writes the recordings again from what TypeSafe answers now.
"""

import json
import os

import pytest

from vextrus.platform.services import jev
from vextrus.testing.jev import (
    INVENTED_SHEETS,
    STAND_IN_KINDS,
    STAND_IN_QUESTION,
    Recording,
    live_key,
    load_recordings,
    request_hash,
    write_recordings,
)

pytestmark = pytest.mark.live


@pytest.fixture(autouse=True)
def the_owner_s_key() -> None:
    if live_key() is None:
        pytest.fail("a live test needs the owner's development key in the environment (ADR 0013)")


def test_typesafe_answers_each_invented_sheet_as_recorded() -> None:
    recording = Recording(jev._network())
    with jev.Client(transport=recording) as live:
        judged = [
            live.judge(jev.SHEET_TYPE, facts, STAND_IN_QUESTION, STAND_IN_KINDS)
            for facts in INVENTED_SHEETS
        ]

    assert all(isinstance(answer, jev.Judgement) for answer in judged), judged
    assert len(recording.exchanges) == len(INVENTED_SHEETS)
    if os.environ.get("VEXTRUS_JEV_RECORD") == "1":
        write_recordings(recording.exchanges)
    recorded = {
        request_hash(json.dumps(r["request"]).encode()): r["response"] for r in load_recordings()
    }
    for exchange, answer in zip(recording.exchanges, judged, strict=True):
        was = recorded[request_hash(json.dumps(exchange["request"]).encode())]
        assert isinstance(answer, jev.Judgement)
        assert (was["model"], was["answers"]["sheet_type"]["choice"]) == (answer.model, answer.choice)


def test_typesafe_refuses_a_wrong_key() -> None:
    with jev.Client(key=lambda: "not-a-typesafe-key") as live:
        answer = live.judge(jev.SHEET_TYPE, INVENTED_SHEETS[0], STAND_IN_QUESTION, STAND_IN_KINDS)

    assert answer == jev.Unavailable(jev.Why.KEY_REFUSED)
