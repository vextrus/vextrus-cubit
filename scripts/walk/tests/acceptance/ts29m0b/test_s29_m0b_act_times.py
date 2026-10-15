"""Ticket S29-M0b, part 2 in the walk: walk.json carries, per act kind, the request time and the
server's work and lock wait, as numbers only.

G1 walk #1 of 9101c005 failed `act_p95_during_read` (undo p95 1,159 ms against 1,000 on the Edison set)
and could not tell the server's work from queueing: each act's record holds only `ms`, from the key to
the answer. The Step 1 act routes now answer with `Server-Timing: app;dur=<ms>, lock;dur=<ms>`
(vextrus/takeoff/tests/acceptance/ts29m0b); the walk reads it.

Promises pinned:

1. **Each set of walk.json may carry `act_times`**, keyed by act kind (confirm, undo, exclude,
   answer), each kind holding `ms` (the request, key to answer, as the acts' `ms`), `app_ms` (the
   server's `app` duration) and `lock_ms` (its `lock` duration), each `{p50, p95, max, count}`:
   numbers, `count` an integer. A walk.json without it still validates (a guard).
2. **Numbers only** (walk.json is "raw numbers only"): a time written as text, a key beside the four,
   or a kind not an act is refused.
3. **The walk reads the header**: `web/e2e/real/act-timer.ts` reads `server-timing` and
   `web/e2e/real/walk.spec.ts` writes `act_times` (read as text: the Playwright spec needs the served
   stack and a real read, as T-WALK-4's static test reads it).

    uv run pytest -rf scripts/walk/tests/acceptance/ts29m0b
"""

import copy
from pathlib import Path
from typing import Any

from scripts.walk.schema import walk_errors

ROOT = Path(__file__).resolve().parents[5]
SHA = "0123456789abcdef0123456789abcdef01234567"
KINDS = ("confirm", "undo", "exclude", "answer")


def _stats(p50: float, p95: float, top: float, count: int) -> dict[str, Any]:
    return {"p50": p50, "p95": p95, "max": top, "count": count}


def _act_times() -> dict[str, Any]:
    return {
        kind: {
            "ms": _stats(654, 1159.5, 1370, 13),
            "app_ms": _stats(92.7, 140, 180.25, 13),
            "lock_ms": _stats(0, 800, 1100, 13),
        }
        for kind in KINDS
    }


def _walk(act_times: dict[str, Any] | None) -> dict[str, Any]:
    the_set: dict[str, Any] = {
        "files": [{"id": 1, "state": "done", "read_seconds": 3}],
        "acts": [{"kind": kind, "ms": 50, "read_running": True, "status": 200} for kind in KINDS],
        "questions": {"structural": {"low_confidence": 1}},
        "burden": {
            "structural": {
                "sheets": 4,
                "one_source": 0,
                "bulk_confirmable": 4,
                "continuation_questions": 0,
                "false_continuation_questions": None,
            }
        },
    }
    if act_times is not None:
        the_set["act_times"] = act_times
    return {
        "schema": 1,
        "sha": SHA,
        "started_at": "2026-10-14T15:54:52Z",
        "urls": {"web": "http://127.0.0.1:5511", "api": "http://127.0.0.1:8811"},
        "sets": {"set-a": the_set},
    }


def test_walk_json_carries_each_act_kinds_request_app_and_lock_times() -> None:
    record = _walk(_act_times())
    assert walk_errors(record) == [], f"act_times refused: {walk_errors(record)}"


def test_a_walk_json_without_act_times_still_validates() -> None:
    assert walk_errors(_walk(None)) == []


def test_a_time_written_as_text_is_refused() -> None:
    assert walk_errors(_walk(_act_times())) == [], "act_times refused"
    bad = _act_times()
    bad["undo"]["app_ms"]["p95"] = "1159 ms"
    assert walk_errors(_walk(bad)) != [], "a time written as text passed"


def test_a_count_that_is_not_a_whole_number_is_refused() -> None:
    assert walk_errors(_walk(_act_times())) == [], "act_times refused"
    bad = _act_times()
    bad["confirm"]["ms"]["count"] = 12.5
    assert walk_errors(_walk(bad)) != [], "a fractional count passed"


def test_a_key_beside_the_four_numbers_is_refused() -> None:
    assert walk_errors(_walk(_act_times())) == [], "act_times refused"
    bad = copy.deepcopy(_act_times())
    bad["exclude"]["lock_ms"]["note"] = "waited on a read"
    assert walk_errors(_walk(bad)) != [], "a free-text key in act_times passed"


def test_a_kind_that_is_not_an_act_is_refused() -> None:
    assert walk_errors(_walk(_act_times())) == [], "act_times refused"
    bad = _act_times()
    bad["upload"] = bad["confirm"]
    assert walk_errors(_walk(bad)) != [], "a kind outside the four acts passed"


def test_the_walk_reads_the_server_timing_header_and_writes_act_times() -> None:
    timer = (ROOT / "web" / "e2e" / "real" / "act-timer.ts").read_text()
    spec = (ROOT / "web" / "e2e" / "real" / "walk.spec.ts").read_text()

    assert "server-timing" in timer.lower(), "act-timer.ts never reads the Server-Timing header"
    assert "act_times" in spec, "walk.spec.ts never writes act_times"
