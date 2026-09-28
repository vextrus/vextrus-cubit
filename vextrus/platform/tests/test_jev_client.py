"""The Jev client below the cache (ticket 15): what comes back is checked against what was asked,
TypeSafe down any way is `Unavailable` within the deadline, and the key goes only into the Bearer
header. Every test runs on a FakeClock: none sleeps or depends on the machine's speed."""

import gzip
import json
import logging
import ssl
from collections.abc import Callable, Iterator
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpcore
import httpx
import pytest
from django.conf import settings
from django.test import override_settings

from vextrus.platform.services import jev
from vextrus.testing.jev import (
    DOWN,
    INVENTED_SHEETS,
    STAND_IN_KINDS,
    STAND_IN_QUESTION,
    WAYS,
    FakeClock,
    Offline,
    Recorded,
    Recording,
    down,
    load_recordings,
    request_hash,
    write_recordings,
)

FACTS: dict[str, Any] = {
    "title": "TYPICAL FLOOR BEAM LAYOUT PLAN",
    "discipline": "structural",
    "view_titles": ["BEAM LAYOUT PLAN"],
}
OPTIONS = ("beam_layout", "floor_plan", "other")
SENTINEL = "sentinel-key-8f14e45fceea167a5a36dedd4bea2543"


def good(**changes: Any) -> dict[str, Any]:
    """A well-formed answer to FACTS over OPTIONS, with `changes` made to the Choice's answer."""
    answer = {
        "type": "choice",
        "choice": "beam_layout",
        "confidence": 0.9,
        "probabilities": {"floor_plan": 0.04, "beam_layout": 0.95, "other": 0.01},
    }
    answer.update(changes)
    return {"model": "jev-1.13.0", "answers": {"sheet_type": answer}, "usage": {"input_tokens": 300}}


class Script:
    """A transport answering each request with the next of `answers` (the last one again after)."""

    def __init__(
        self, *answers: httpx.Response | Exception | Callable[[httpx.Request], httpx.Response]
    ) -> None:
        self.answers = list(answers)
        self.requests: list[httpx.Request] = []
        self.transport = httpx.MockTransport(self._answer)

    def _answer(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        answer = self.answers[min(len(self.requests), len(self.answers)) - 1]
        if isinstance(answer, Exception):
            raise answer
        if callable(answer):
            return answer(request)
        return answer


def client(
    script: Script, clock: FakeClock | None = None, key: Callable[[], str | None] = lambda: SENTINEL
) -> jev.Client:
    clock = clock or FakeClock()
    return jev.Client(transport=script.transport, clock=clock, sleep=clock.sleep, key=key)


def judge(made: jev.Client, facts: jev.Facts = FACTS) -> jev.Judgement | jev.Unavailable:
    return made.judge("sheet_type", facts, STAND_IN_QUESTION, OPTIONS)


def ok(body: Any) -> httpx.Response:
    return httpx.Response(200, json=body)


# An answer, read whole ------------------------------------------------------------------------------


def test_a_recorded_answer_is_read_whole_every_number_a_decimal(jev_offline: Offline) -> None:
    answer = jev_offline.client.judge(
        "sheet_type", INVENTED_SHEETS[4], STAND_IN_QUESTION, STAND_IN_KINDS
    )

    assert isinstance(answer, jev.Judgement)
    assert (answer.node, answer.model, answer.choice) == ("sheet_type", "jev-1.13.0", "services_layout")
    assert answer.confidence == Decimal("0.91")
    assert [option for option, _p in answer.probabilities] == list(STAND_IN_KINDS)
    assert all(type(p) is Decimal for _o, p in answer.probabilities)
    assert type(answer.confidence) is Decimal
    assert answer.ranked()[:2] == ("services_layout", "other")
    assert answer.probability("other") == Decimal("0.07")


def test_ranked_puts_the_most_likely_first_and_ties_in_the_order_offered() -> None:
    made = client(Script(ok(good(probabilities={"floor_plan": 0.3, "beam_layout": 0.4, "other": 0.3}))))

    answer = judge(made)

    assert isinstance(answer, jev.Judgement)
    assert answer.ranked() == ("beam_layout", "floor_plan", "other")


def test_the_request_goes_as_json_to_the_endpoint_asking_for_no_compression() -> None:
    script = Script(ok(good()))

    judge(client(script))

    [sent] = script.requests
    assert (sent.method, str(sent.url)) == ("POST", settings.VEXTRUS_JEV_URL)
    assert sent.headers["content-type"] == "application/json"
    assert sent.headers["accept-encoding"] == "identity"
    assert json.loads(sent.content)["questions"]["sheet_type"]["criteria"] == dict.fromkeys(OPTIONS)


# An answer outside the offer is Unavailable ----------------------------------------------------------

OUTSIDE = {
    "an option not offered": good(choice="column_layout"),
    "an option in another case": good(choice="Beam_layout"),
    "an option padded": good(choice=" beam_layout"),
    "an option padded after": good(choice="beam_layout "),
    "a foreign probability": good(
        probabilities={"floor_plan": 0.04, "beam_layout": 0.95, "other": 0.0, "slab": 0.01}
    ),
    "a probability missing": good(probabilities={"beam_layout": 0.95, "other": 0.05}),
    "a probability over 1": good(probabilities={"floor_plan": 0.0, "beam_layout": 1.2, "other": 0.0}),
    "a probability under 0": good(
        probabilities={"floor_plan": -0.1, "beam_layout": 0.95, "other": 0.15}
    ),
    "a probability as a string": good(
        probabilities={"floor_plan": "0.04", "beam_layout": 0.95, "other": 0.01}
    ),
    "a probability as a bool": good(
        probabilities={"floor_plan": False, "beam_layout": True, "other": 0}
    ),
    "a probability null": good(probabilities={"floor_plan": None, "beam_layout": 0.95, "other": 0.05}),
    "probabilities as a list": good(probabilities=[0.04, 0.95, 0.01]),
    "a confidence over 1": good(confidence=1.5),
    "a confidence under 0": good(confidence=-0.01),
    "a confidence as a string": good(confidence="0.9"),
    "a confidence as a bool": good(confidence=True),
    "a confidence null": good(confidence=None),
    "a confidence past 1 with an exponent": good(confidence=1.0e6),
    "no confidence": {
        "model": "jev-1.13.0",
        "answers": {
            "sheet_type": {
                "type": "choice",
                "choice": "beam_layout",
                "probabilities": {"floor_plan": 0, "beam_layout": 1, "other": 0},
            }
        },
    },
    "a choice not the most probable": good(choice="other"),
    "a choice not text": good(choice=["beam_layout"]),
    "another type": good(type="score"),
    "a noul": {"model": "jev-1.13.0", "answers": {"sheet_type": {"type": "noul", "noul": 0.9}}},
    "another model": {**good(), "model": "jev-1.14.0"},
    "the moving alias": {**good(), "model": "jev-latest"},
    "no model": {"answers": good()["answers"]},
    "an unasked question": {
        **good(),
        "answers": {**good()["answers"], "storey": good()["answers"]["sheet_type"]},
    },
    "the answer under another id": {**good(), "answers": {"kind": good()["answers"]["sheet_type"]}},
    "no answers": {"model": "jev-1.13.0", "answers": {}},
    "answers as a list": {"model": "jev-1.13.0", "answers": [good()["answers"]["sheet_type"]]},
    "a list": [good()],
}


@pytest.mark.parametrize("body", OUTSIDE.values(), ids=OUTSIDE.keys())
def test_an_answer_outside_the_offer_is_malformed(body: Any) -> None:
    assert judge(client(Script(ok(body)))) == jev.Unavailable(jev.Why.MALFORMED)


CHOICE = '"type":"choice","choice":"beam_layout"'
PROBABILITIES = '"probabilities":{"floor_plan":0,"beam_layout":1,"other":0}'


def raw(answer: str, *, answers: str = '"sheet_type":{}') -> bytes:
    """An answer written as TypeSafe's text, so Python's `json` sees exactly these characters."""
    return ('{"model":"jev-1.13.0","answers":{' + answers.format("{" + answer + "}") + "}}").encode()


RAW = {
    "NaN confidence": raw(f'{CHOICE},"confidence":NaN,{PROBABILITIES}'),
    "Infinity confidence": raw(f'{CHOICE},"confidence":Infinity,{PROBABILITIES}'),
    "-Infinity probability": raw(
        f'{CHOICE},"confidence":1,"probabilities":{{"floor_plan":-Infinity,"beam_layout":1,"other":0}}'
    ),
    "a huge exponent": raw(f'{CHOICE},"confidence":1e400,{PROBABILITIES}'),
    "a duplicate choice": raw(
        f'"type":"choice","choice":"other",{CHOICE[16:]},"confidence":1,{PROBABILITIES}'
    ),
    "a duplicate probability": raw(
        f'{CHOICE},"confidence":1,"probabilities":{{"floor_plan":0,"beam_layout":1,"other":0,"beam_layout":0}}'
    ),
    "a duplicate question": raw(
        f'{CHOICE},"confidence":1,{PROBABILITIES}',
        answers='"sheet_type":{{"type":"noul"}},"sheet_type":{}',
    ),
    "not JSON": b"<html>Service temporarily unavailable</html>",
    "not UTF-8": b'{"model":"jev-1.13.0","x":"\xff\xfe"}',
    "empty": b"",
    "cut short": raw(f'{CHOICE},"confidence":1,{PROBABILITIES}')[:60],
}


def test_the_text_the_raw_cases_are_written_in_is_taken_when_well_formed() -> None:
    body = raw(f'{CHOICE},"confidence":1,{PROBABILITIES}')

    answer = judge(client(Script(httpx.Response(200, content=body))))

    assert isinstance(answer, jev.Judgement)
    assert answer.choice == "beam_layout"
    assert json.loads(raw(f'"type":"choice","choice":"other",{CHOICE[16:]}'))  # the duplicate's text
    assert CHOICE[16:] == '"choice":"beam_layout"'


@pytest.mark.parametrize("body", RAW.values(), ids=RAW.keys())
def test_an_answer_python_s_json_would_take_is_malformed(body: bytes) -> None:
    assert judge(client(Script(httpx.Response(200, content=body)))) == jev.Unavailable(jev.Why.MALFORMED)


def test_whole_numbers_are_taken_for_a_confidence_and_probabilities() -> None:
    answer = judge(
        client(
            Script(ok(good(confidence=1, probabilities={"floor_plan": 0, "beam_layout": 1, "other": 0})))
        )
    )

    assert isinstance(answer, jev.Judgement)
    assert (answer.confidence, answer.probability("beam_layout")) == (Decimal(1), Decimal(1))


# Statuses, retries and the deadline -------------------------------------------------------------------


@pytest.mark.parametrize(("status", "why"), [(401, jev.Why.KEY_REFUSED), (403, jev.Why.KEY_REFUSED)])
def test_a_refused_key_is_never_tried_again(status: int, why: jev.Why) -> None:
    script = Script(httpx.Response(status), ok(good()))
    clock = FakeClock()

    assert judge(client(script, clock)) == jev.Unavailable(why)
    assert (len(script.requests), clock.slept) == (1, [])


def test_an_invalid_request_is_never_tried_again_and_is_logged_as_ours_without_its_echo(
    caplog: pytest.LogCaptureFixture,
) -> None:
    echo = {"detail": [{"type": "missing", "input": {"state": FACTS}}]}
    script = Script(httpx.Response(422, json=echo), ok(good()))

    with caplog.at_level(logging.DEBUG):
        assert judge(client(script)) == jev.Unavailable(jev.Why.REQUEST_REFUSED)

    assert len(script.requests) == 1
    [error] = [record for record in caplog.records if record.levelno == logging.ERROR]
    assert "422" in error.getMessage()
    assert "Vextrus built it wrong" in error.getMessage()
    assert FACTS["title"] not in caplog.text


@pytest.mark.parametrize("status", [500, 502, 503, 504, 400, 404, 418, 202, 204])
def test_any_other_status_is_failed_and_never_tried_again(status: int) -> None:
    script = Script(httpx.Response(status, json=good()), ok(good()))

    assert judge(client(script)) == jev.Unavailable(jev.Why.FAILED)
    assert len(script.requests) == 1


@pytest.mark.parametrize("status", [301, 302, 303, 307, 308])
def test_a_redirect_is_never_followed(status: int) -> None:
    elsewhere = "https://collector.example/v1/systemone"
    script = Script(httpx.Response(status, headers={"Location": elsewhere}), ok(good()))

    assert judge(client(script)) == jev.Unavailable(jev.Why.FAILED)
    assert [str(request.url) for request in script.requests] == [settings.VEXTRUS_JEV_URL]


@pytest.mark.parametrize("status", [429, 529])
def test_a_busy_typesafe_is_tried_again_after_a_pause(status: int) -> None:
    clock = FakeClock()
    script = Script(httpx.Response(status), httpx.Response(status), ok(good()))

    answer = judge(client(script, clock))

    assert isinstance(answer, jev.Judgement)
    assert (len(script.requests), clock.slept) == (3, [0.5, 1.0])


def test_a_busy_typesafe_is_tried_only_within_the_deadline() -> None:
    clock = FakeClock()
    start = clock.now
    script = Script(httpx.Response(529))

    assert judge(client(script, clock)) == jev.Unavailable(jev.Why.BUSY)
    assert clock.slept == [0.5, 1.0, 2.0, 2.0]
    assert clock.now - start <= settings.VEXTRUS_JEV_DEADLINE_SECONDS


def test_retry_after_is_waited_when_the_deadline_allows_and_never_less_than_the_pause() -> None:
    clock = FakeClock()
    script = Script(
        httpx.Response(429, headers={"Retry-After": "3"}),
        httpx.Response(429, headers={"Retry-After": "0"}),
        ok(good()),
    )

    assert isinstance(judge(client(script, clock)), jev.Judgement)
    assert clock.slept == [3.0, 1.0]


@pytest.mark.parametrize("after", ["30", "6", "Wed, 21 Oct 2026 07:28:00 GMT"])
def test_a_retry_after_past_the_deadline_is_not_waited_for(after: str) -> None:
    clock = FakeClock()
    script = Script(httpx.Response(429, headers={"Retry-After": after}), ok(good()))
    answer = judge(client(script, clock))

    if after.isdecimal():
        assert answer == jev.Unavailable(jev.Why.BUSY)
        assert (len(script.requests), clock.slept) == (1, [])
    else:  # a date is not waited for: the pause is the back-off's
        assert isinstance(answer, jev.Judgement)
        assert clock.slept == [0.5]


@pytest.mark.parametrize(
    "dropped",
    [
        httpx.RemoteProtocolError("Server disconnected without sending a response."),
        httpx.ConnectError("[Errno 111] Connection refused"),
        httpx.ReadError("[Errno 104] Connection reset by peer"),
        httpx.WriteError("[Errno 32] Broken pipe"),
    ],
)
def test_a_dropped_connection_is_tried_again(dropped: Exception) -> None:
    clock = FakeClock()
    script = Script(dropped, ok(good()))

    assert isinstance(judge(client(script, clock)), jev.Judgement)
    assert (len(script.requests), clock.slept) == (2, [0.5])


def test_a_connection_that_keeps_dropping_is_unreachable_within_the_deadline() -> None:
    clock = FakeClock()
    start = clock.now

    assert judge(client(Script(httpx.ConnectError("refused")), clock)) == jev.Unavailable(
        jev.Why.UNREACHABLE
    )
    assert clock.now - start <= settings.VEXTRUS_JEV_DEADLINE_SECONDS


@pytest.mark.parametrize(
    "timeout",
    [
        httpx.ReadTimeout("timed out"),
        httpx.ConnectTimeout("timed out"),
        httpx.WriteTimeout("timed out"),
        httpx.PoolTimeout("timed out"),
    ],
)
def test_a_timeout_is_timed_out_and_never_tried_again(timeout: Exception) -> None:
    script = Script(timeout, ok(good()))

    assert judge(client(script)) == jev.Unavailable(jev.Why.TIMED_OUT)
    assert len(script.requests) == 1


@pytest.mark.parametrize(
    "error", [httpx.UnsupportedProtocol("no"), httpx.LocalProtocolError("no"), httpx.ProxyError("no")]
)
def test_any_other_transport_error_is_failed(error: Exception) -> None:
    assert judge(client(Script(error))) == jev.Unavailable(jev.Why.FAILED)


def test_an_error_of_the_client_s_own_is_failed_never_raised(caplog: pytest.LogCaptureFixture) -> None:
    script = Script(RuntimeError("a bug below the client"))

    assert judge(client(script)) == jev.Unavailable(jev.Why.FAILED)
    assert "a bug below the client" in caplog.text


def test_each_try_s_timeouts_are_cut_to_what_is_left_of_the_deadline() -> None:
    clock = FakeClock()

    def slow_529(request: httpx.Request) -> httpx.Response:
        clock.advance(5.0)
        return httpx.Response(529)

    script = Script(slow_529, ok(good()))

    answer = judge(client(script, clock))

    first, second = (request.extensions["timeout"] for request in script.requests)
    assert first == {"connect": 2.0, "read": 4.0, "write": 4.0, "pool": 2.0}
    assert all(0 < seconds <= 0.5 for seconds in second.values())
    assert isinstance(answer, jev.Judgement)


def test_an_answer_dripping_past_the_deadline_is_cut(jev_offline: Offline) -> None:
    clock = jev_offline.clock
    start = clock.now
    made = jev.Client(
        transport=down("drip", clock), clock=clock, sleep=clock.sleep, key=lambda: SENTINEL
    )

    assert judge(made) == jev.Unavailable(jev.Why.TIMED_OUT)
    assert clock.now - start <= settings.VEXTRUS_JEV_DEADLINE_SECONDS + 1.0  # the chunk under way


def test_an_answer_arriving_after_the_deadline_is_not_taken() -> None:
    clock = FakeClock()

    def late(request: httpx.Request) -> httpx.Response:
        clock.advance(settings.VEXTRUS_JEV_DEADLINE_SECONDS + 0.1)
        return ok(good())

    assert judge(client(Script(late), clock)) == jev.Unavailable(jev.Why.TIMED_OUT)


# Oversized ------------------------------------------------------------------------------------------


class Body(httpx.SyncByteStream):
    """A body sent in chunks with whatever headers a test gives; notes whether it was read."""

    def __init__(self, *chunks: bytes) -> None:
        self.chunks = chunks
        self.read = False

    def __iter__(self) -> Iterator[bytes]:
        self.read = True
        yield from self.chunks


CAP = 65_536


@pytest.mark.parametrize(
    ("headers", "chunks"),
    [
        ({"Content-Length": str(CAP + 1)}, [b" " * (CAP + 1)]),
        ({"Content-Length": "300"}, [b" " * CAP, b" "]),
        ({}, [b" " * 40_000, b" " * 40_000]),
        ({}, [b" "] * (CAP + 1)),
    ],
    ids=["honest length", "a length that lies small", "no length", "many small chunks"],
)
def test_a_body_over_the_cap_is_oversized_whatever_its_length_says(
    headers: dict[str, str], chunks: list[bytes]
) -> None:
    assert settings.VEXTRUS_JEV_MAX_RESPONSE_BYTES == CAP
    script = Script(httpx.Response(200, headers=headers, stream=Body(*chunks)))

    assert judge(client(script)) == jev.Unavailable(jev.Why.OVERSIZED)


def test_a_length_past_the_cap_is_oversized_before_a_byte_is_read() -> None:
    body = Body(b"{}")

    answer = judge(
        client(Script(httpx.Response(200, headers={"Content-Length": "999999999999"}, stream=body)))
    )

    assert answer == jev.Unavailable(jev.Why.OVERSIZED)
    assert not body.read


@pytest.mark.parametrize("length", ["abc", "-1", "1e3", "12, 12"])
def test_a_length_that_is_not_a_number_is_malformed(length: str) -> None:
    script = Script(httpx.Response(200, headers={"Content-Length": length}, stream=Body(b"{}")))

    assert judge(client(script)) == jev.Unavailable(jev.Why.MALFORMED)


def test_gzip_that_inflates_past_the_cap_is_never_inflated() -> None:
    bomb = gzip.compress(b" " * (CAP * 64))  # 4 MiB of spaces in about 4 KB
    body = Body(bomb)
    script = Script(httpx.Response(200, headers={"Content-Encoding": "gzip"}, stream=body))

    assert len(bomb) < CAP
    assert judge(client(script)) == jev.Unavailable(jev.Why.MALFORMED)
    assert not body.read


@pytest.mark.parametrize("encoding", ["gzip", "deflate", "br", "zstd", "identity, gzip"])
def test_any_encoding_but_identity_is_refused_even_a_good_answer(encoding: str) -> None:
    script = Script(
        httpx.Response(
            200,
            headers={"Content-Encoding": encoding},
            stream=Body(gzip.compress(json.dumps(good()).encode())),
        )
    )

    assert judge(client(script)) == jev.Unavailable(jev.Why.MALFORMED)


def test_identity_named_is_taken() -> None:
    content = json.dumps(good()).encode()
    script = Script(
        httpx.Response(
            200,
            headers={"Content-Encoding": "identity", "Content-Length": str(len(content))},
            stream=Body(content),
        )
    )

    assert isinstance(judge(client(script)), jev.Judgement)


# The cool-off ---------------------------------------------------------------------------------------


def test_after_three_failures_in_a_row_it_answers_at_once_then_tries_again_after_the_cool_off() -> None:
    clock = FakeClock()
    script = Script(
        httpx.Response(500), httpx.Response(500), httpx.Response(500), httpx.Response(500), ok(good())
    )
    made = client(script, clock)

    assert [judge(made) for _ in range(3)] == [jev.Unavailable(jev.Why.FAILED)] * 3
    assert judge(made) == jev.Unavailable(jev.Why.COOLING_OFF)
    assert len(script.requests) == 3

    clock.advance(settings.VEXTRUS_JEV_COOL_OFF_SECONDS)
    assert judge(made) == jev.Unavailable(jev.Why.FAILED)  # one try: still down
    assert judge(made) == jev.Unavailable(jev.Why.COOLING_OFF)  # so at once again
    assert len(script.requests) == 4

    clock.advance(settings.VEXTRUS_JEV_COOL_OFF_SECONDS)
    assert isinstance(judge(made), jev.Judgement)  # back
    assert isinstance(judge(made), jev.Judgement)
    assert len(script.requests) == 6


def test_a_success_ends_the_run_of_failures() -> None:
    script = Script(
        httpx.Response(500),
        httpx.Response(500),
        ok(good()),
        httpx.Response(500),
        httpx.Response(500),
        ok(good()),
    )
    made = client(script)

    outcomes = [judge(made) for _ in range(6)]

    assert jev.Unavailable(jev.Why.COOLING_OFF) not in outcomes
    assert len(script.requests) == 6


def test_an_outage_costs_sixty_sheets_seconds_not_minutes() -> None:
    clock = FakeClock()
    start = clock.now
    made = jev.Client(
        transport=down("timeout", clock), clock=clock, sleep=clock.sleep, key=lambda: SENTINEL
    )

    outcomes = [judge(made, {**FACTS, "title": f"SHEET {n}"}) for n in range(60)]

    assert outcomes.count(jev.Unavailable(jev.Why.TIMED_OUT)) == 3
    assert outcomes.count(jev.Unavailable(jev.Why.COOLING_OFF)) == 57
    assert clock.now - start <= 3 * settings.VEXTRUS_JEV_DEADLINE_SECONDS


@pytest.mark.parametrize("key", [lambda: None, lambda: "   "])
def test_what_says_nothing_of_typesafe_never_brings_a_cool_off(key: Callable[[], str | None]) -> None:
    refused = Script(httpx.Response(422))
    made = client(refused)
    without_key = client(Script(ok(good())), key=key)
    too_large = {**FACTS, "title": "A" * 40_000}

    for _ in range(5):
        assert judge(made) == jev.Unavailable(jev.Why.REQUEST_REFUSED)
        assert judge(without_key) == jev.Unavailable(jev.Why.NO_KEY)
        assert judge(made, too_large) == jev.Unavailable(jev.Why.TOO_LARGE)

    assert len(refused.requests) == 5


# The key --------------------------------------------------------------------------------------------


def test_with_no_key_nothing_is_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(settings.VEXTRUS_JEV_KEY_VARIABLE, raising=False)
    script = Script(ok(good()))
    clock = FakeClock()

    assert judge(
        jev.Client(transport=script.transport, clock=clock, sleep=clock.sleep)
    ) == jev.Unavailable(jev.Why.NO_KEY)
    assert script.requests == []


def test_a_real_key_goes_as_bearer_read_from_the_environment_at_call_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    script = Script(ok(good()))
    clock = FakeClock()
    made = jev.Client(transport=script.transport, clock=clock, sleep=clock.sleep)
    monkeypatch.setenv(settings.VEXTRUS_JEV_KEY_VARIABLE, f"  {SENTINEL}\n")

    assert isinstance(judge(made), jev.Judgement)
    monkeypatch.setenv(settings.VEXTRUS_JEV_KEY_VARIABLE, "second-key")
    assert isinstance(judge(made), jev.Judgement)
    monkeypatch.delenv(settings.VEXTRUS_JEV_KEY_VARIABLE)
    assert judge(made) == jev.Unavailable(jev.Why.NO_KEY)

    first, second = script.requests
    assert first.headers["authorization"] == f"Bearer {SENTINEL}"
    assert second.headers["authorization"] == "Bearer second-key"
    assert SENTINEL.encode() not in first.content
    assert SENTINEL not in str(first.url)
    assert [name for name, value in first.headers.items() if SENTINEL in value] == ["authorization"]


@pytest.mark.parametrize(
    "key", [f"{SENTINEL}\r\nX-Forged: 1", f"{SENTINEL} two", f"{SENTINEL}é", "x" * 513]
)
def test_a_key_that_is_not_a_token_is_never_sent(key: str, caplog: pytest.LogCaptureFixture) -> None:
    script = Script(ok(good()))

    with caplog.at_level(logging.DEBUG):
        assert judge(client(script, key=lambda: key)) == jev.Unavailable(jev.Why.NO_KEY)

    assert script.requests == []
    assert SENTINEL not in caplog.text


def test_the_key_is_in_no_log_exception_repr_or_recording(
    caplog: pytest.LogCaptureFixture, tmp_path: Path
) -> None:
    clock = FakeClock()
    seen: list[str] = []
    with caplog.at_level(logging.DEBUG):
        for way in WAYS:
            made = jev.Client(
                transport=down(way, clock), clock=clock, sleep=clock.sleep, key=lambda: SENTINEL
            )
            outcome = judge(made)
            assert outcome == jev.Unavailable(DOWN[way])
            seen += [repr(made), repr(outcome), str(outcome)]
            clock.advance(settings.VEXTRUS_JEV_COOL_OFF_SECONDS)
        broken = client(Script(RuntimeError("a bug")))
        seen += [repr(broken), repr(judge(broken))]
        recording = Recording(Script(ok(good())).transport)
        with jev.Client(
            transport=recording, clock=clock, sleep=clock.sleep, key=lambda: SENTINEL
        ) as made:
            answer = judge(made)
        seen += [repr(answer), repr(jev.prepare("sheet_type", FACTS, STAND_IN_QUESTION, OPTIONS))]
    write_recordings(recording.exchanges, tmp_path / "recordings.json")

    assert SENTINEL not in caplog.text
    assert not any(SENTINEL in text for text in seen)
    assert SENTINEL not in (tmp_path / "recordings.json").read_text()
    assert SENTINEL not in json.dumps(recording.exchanges)


def test_the_committed_recordings_hold_bodies_only() -> None:
    recordings = load_recordings()

    assert len(recordings) == len(INVENTED_SHEETS)
    assert all(set(recording) == {"request", "response"} for recording in recordings)
    assert all(set(recording["request"]) == {"model", "state", "questions"} for recording in recordings)
    text = json.dumps(recordings).lower()
    assert "bearer" not in text
    assert "authorization" not in text


# TLS, the URL, proxies ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url", ["http://api.typesafe.ai/v1/systemone", "ftp://api.typesafe.ai/", "api.typesafe.ai/v1"]
)
def test_the_url_must_be_https(url: str) -> None:
    with override_settings(VEXTRUS_JEV_URL=url), pytest.raises(ValueError, match="https only"):
        jev.Client(transport=Script(ok(good())).transport)


def test_the_network_transport_verifies_tls_takes_no_proxy_and_cuts_every_wait(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.invalid:3128")
    monkeypatch.setenv("ALL_PROXY", "http://proxy.invalid:3128")
    monkeypatch.setenv("SSL_CERT_FILE", "/nonexistent/ca.pem")

    transport = jev._Transport()
    made = jev.Client(transport=transport)

    pool = transport._pool
    assert isinstance(pool, httpcore.ConnectionPool)
    tls = pool._ssl_context
    assert tls is not None
    assert (tls.verify_mode, tls.check_hostname) == (ssl.CERT_REQUIRED, True)
    assert isinstance(pool._network_backend, jev._Sockets)
    assert made._http._mounts == {}  # no proxy from the environment
    assert made._http.follow_redirects is False
    made.close()


# Offline by default ---------------------------------------------------------------------------------


def test_the_owner_s_key_is_not_in_an_unmarked_test_s_environment() -> None:
    import os

    assert settings.VEXTRUS_JEV_KEY_VARIABLE not in os.environ


def test_an_unrecorded_request_fails_the_test_naming_its_hash(jev_offline: Offline) -> None:
    facts = {"title": "A SHEET NOBODY RECORDED"}
    request = jev.prepare("sheet_type", facts, STAND_IN_QUESTION, STAND_IN_KINDS)
    assert isinstance(request, jev.Request)

    with pytest.raises(pytest.fail.Exception, match=request_hash(request.body)):
        jev_offline.client.judge("sheet_type", facts, STAND_IN_QUESTION, STAND_IN_KINDS)


def test_a_client_a_test_makes_answers_from_the_recordings(monkeypatch: pytest.MonkeyPatch) -> None:
    made = jev.Client(key=lambda: "test-key")

    assert isinstance(made._http._transport, Recorded)
    answer = made.judge("sheet_type", INVENTED_SHEETS[0], STAND_IN_QUESTION, STAND_IN_KINDS)
    assert isinstance(answer, jev.Judgement)
    assert answer.choice == "beam_layout"


def test_the_recordings_are_typesafe_s_answers_as_the_client_reads_them() -> None:
    for recording in load_recordings():
        request = recording["request"]
        [(node, question)] = request["questions"].items()
        made = jev.Client(transport=Recorded([recording]), key=lambda: "test-key")
        answer = made.judge(node, request["state"], question["instructions"], question["criteria"])
        assert isinstance(answer, jev.Judgement), answer
        assert answer.choice == recording["response"]["answers"][node]["choice"]
