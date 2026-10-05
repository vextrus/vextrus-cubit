"""Acceptance tests for ticket T-JEV-CLIENT: the factory's Jev client is safe to call often.

Authority: the ticket's section 3 (A1 to A6, B) and `docs/specs/factory/contracts/jev-cli.md`; it
closes #289's five items and adds a cool-off that holds across the factory's short-lived CLI runs.
Seams the ticket fixes: `_Health.admit() -> _Admission | None` (`_Admission.probe: bool`),
`_Health.settle(admission, why)`, `jev._wall` (beside `_now` and `_sleep`) and the file
`$VEXTRUS_FACTORY_DIR/jev-health.json`.

Black box through `ask`, the command line and `VEXTRUS_FACTORY_DIR`, on fakes only: every request goes
to an `httpx.MockTransport`, the resolver is a patched `socket.getaddrinfo`, the key is a sentinel and
every text is invented. A test that needs a call to stall blocks on an `Event` (capped at `CAP` seconds,
so a red run fails rather than hangs) and asserts the order of events, never an elapsed time. The
helpers are copied from `test_factory_jev.py` (never imported across test modules).
"""

import hashlib
import importlib
import json
import re
import socket
import sys
import threading
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest

from vextrus.settings import jev as jev_settings

MODULE = "scripts.factory.jev"
KEY_VARIABLE = "TYPESAFE_API_KEY"
SENTINEL = "KEYSENTINEL-do-not-print-0451"
MARKER = "INVENTED-MARKER-7f3a"
QUESTION_MARKER = "INVENTED-QUESTION-2c9b"
MODELS_URL = "https://api.typesafe.ai/v1/models"
RELEASE_DATE = "2026-09-10T18:38:01.391457+00:00"
CAP = 5.0
"""The longest any stalled fake waits: a red run fails after it rather than hanging."""
STALL_DEADLINE = 0.3
WALL_START = 1_800_000_000.0
PROXIES = ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")
LOG_LINE = re.compile(
    r"^\S+ task=(?P<task>\S+) model=(?P<model>\S+) status=(?P<status>ok|unavailable:[a-z_]+) "
    r"latency_ms=(?P<latency>\d+) input_tokens=(?P<tokens>\d+) cache=(?P<cache>hit|miss)$"
)
PINS = (
    "# Invented pins\n\n| node | model | right / checked |\n|---|---|---|\n"
    "| invented_node | jev-1.13.0 | 1 / 1 |\n"
)


def noul(
    text: str = f"Is this invented sentence about the weather? {QUESTION_MARKER}",
) -> dict[str, Any]:
    return {"kind": "noul", "text": text}


# The seams ---------------------------------------------------------------------------------------


class FakeClock:
    """A clock that moves only when slept or advanced (the module's `_now`, `_sleep` or `_wall`)."""

    def __init__(self, start: float = 1000.0) -> None:
        self.t = start

    def now(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        self.t += seconds

    def advance(self, seconds: float) -> None:
        self.t += seconds


def _load() -> Any:
    """The module imported afresh: a new process's memory (no cool-off, no probe, no slots)."""
    sys.modules.pop(MODULE, None)
    return importlib.import_module(MODULE)


def fresh(monkeypatch: pytest.MonkeyPatch, clock: FakeClock, wall: FakeClock) -> Any:
    """A fresh module (another CLI run) on its own monotonic clock and the shared wall clock."""
    module = _load()
    monkeypatch.setattr(module, "_now", clock.now)
    monkeypatch.setattr(module, "_sleep", clock.sleep)
    monkeypatch.setattr(module, "_wall", wall.now, raising=False)
    return module


Responder = Callable[[httpx.Request], httpx.Response]


def _refuse(request: httpx.Request) -> httpx.Response:
    return httpx.Response(599, content=b"no responder set: the test did not expect a request")


class Net:
    """Every request any `httpx.Client` makes during the test (the module's own included)."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.respond: Responder = _refuse
        self._lock = threading.Lock()
        self._clients: list[httpx.Client] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        request.read()
        with self._lock:
            self.requests.append(request)
        return self.respond(request)

    @property
    def posts(self) -> list[httpx.Request]:
        return [r for r in self.requests if r.method == "POST"]

    def close(self) -> None:
        for made in self._clients:
            made.close()


class _Routed(httpx.Client):
    """`httpx.Client`, with whatever transport it is given replaced by the test's."""

    route: httpx.BaseTransport | None = None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.pop("mounts", None)
        kwargs["transport"] = _Routed.route
        super().__init__(*args, **kwargs)


class Server:
    """A counting fake TypeSafe reached through clients passed to `ask`."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.respond: Responder = _refuse
        self._clients: list[httpx.Client] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        request.read()
        self.requests.append(request)
        return self.respond(request)

    def client(self) -> httpx.Client:
        made = httpx.Client(transport=httpx.MockTransport(self))
        self._clients.append(made)
        return made

    def close(self) -> None:
        for made in self._clients:
            made.close()


@pytest.fixture
def factory(tmp_path: Path) -> Path:
    """`VEXTRUS_FACTORY_DIR`: not created; the module makes what it needs."""
    return tmp_path / "factory-not-yet-made"


@pytest.fixture
def isolated(monkeypatch: pytest.MonkeyPatch, factory: Path) -> Iterator[None]:
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(factory))
    monkeypatch.setenv(KEY_VARIABLE, SENTINEL)
    yield
    sys.modules.pop(MODULE, None)


@pytest.fixture
def jev(isolated: None, monkeypatch: pytest.MonkeyPatch) -> Any:
    """A fresh module on the real monotonic clock; it never sleeps."""
    module = _load()
    monkeypatch.setattr(module, "_sleep", lambda seconds: None)
    return module


@pytest.fixture
def net(monkeypatch: pytest.MonkeyPatch) -> Iterator[Net]:
    recorder = Net()
    monkeypatch.setattr(_Routed, "route", httpx.MockTransport(recorder))
    monkeypatch.setattr(httpx, "Client", _Routed)
    monkeypatch.setattr("httpx._api.Client", _Routed)
    yield recorder
    recorder.close()


@pytest.fixture
def server() -> Iterator[Server]:
    made = Server()
    yield made
    made.close()


# Responders and readings -------------------------------------------------------------------------


def _reply(body: object, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status, content=json.dumps(body).encode(), headers={"content-type": "application/json"}
    )


def valid(*, p: float = 0.5, model: str = "jev-1.13.0") -> Responder:
    """A valid answer to whatever nouls were asked, each `p`."""

    def respond(request: httpx.Request) -> httpx.Response:
        asked = json.loads(request.content)["questions"]
        answers = {qid: {"type": "noul", "noul": p} for qid in asked}
        return _reply(
            {"model": model, "answers": answers, "usage": {"input_tokens": 100, "output_tokens": 9}}
        )

    return respond


def status(code: int) -> Responder:
    def respond(request: httpx.Request) -> httpx.Response:
        return _reply({"error": "invented"}, code)

    return respond


def models_api(model: str) -> Responder:
    """`models-check`'s two requests: the noul call (answered by `model`) and `GET /v1/models`."""
    answer = valid(model=model)

    def respond(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            assert str(request.url) == MODELS_URL
            return _reply({"models": [{"name": "jev-latest", "release_date": RELEASE_DATE}]})
        return answer(request)

    return respond


def why(outcome: Any) -> str:
    value = outcome.why
    return str(getattr(value, "value", value))


def is_unavailable(jev: Any, outcome: Any, reason: str | None = None) -> bool:
    return isinstance(outcome, jev.Unavailable) and (reason is None or why(outcome) == reason)


def cache_name(state: object, questions: object, model: str = "jev-1.13.0") -> str:
    canonical = json.dumps(
        {"state": state, "questions": questions, "model": model},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return hashlib.sha256(canonical.encode("ascii")).hexdigest() + ".json"


def statuses(factory: Path) -> list[str]:
    """The `status=` of every line in `jev.log`, in order."""
    path = factory / "jev.log"
    lines = path.read_text().splitlines() if path.exists() else []
    found = []
    for line in lines:
        match = LOG_LINE.match(line)
        assert match is not None, f"a log line out of the contract's shape: {line!r}"
        found.append(match["status"])
    return found


def run(jev: Any, argv: list[str]) -> Any:
    """`main(argv)`'s exit code, whether returned or raised."""
    try:
        return jev.main(argv)
    except SystemExit as stop:
        return stop.code


def p_of(outcome: Any, name: str) -> float:
    value = outcome[name]["p"]
    assert not isinstance(value, bool)
    return float(value)


# A1: one probe at a time -------------------------------------------------------------------------


def test_a1_a_call_admitted_before_the_trip_never_lets_a_second_probe_go(
    jev: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#289 item 1: a call admitted before the breaker tripped, ending while the probe is out, does
    not free the probe's place; only the probe's own end does."""
    clock = FakeClock()
    monkeypatch.setattr(jev, "_now", clock.now)
    monkeypatch.setattr(jev, "_wall", FakeClock(WALL_START).now, raising=False)
    health = jev._Health()
    before = health.admit()
    assert before, "admitted while healthy"
    for _ in range(jev_settings.VEXTRUS_JEV_COOL_OFF_AFTER):
        failing = health.admit()
        assert failing
        health.settle(failing, jev.Why.FAILED)
    assert health.admit() is None, "cooling off"
    clock.advance(jev_settings.VEXTRUS_JEV_COOL_OFF_SECONDS)
    probe = health.admit()
    assert probe, "after the cool-off one call tries again"
    assert probe.probe is True
    assert before.probe is False
    health.settle(before, jev.Why.REQUEST_REFUSED)  # a refusal says nothing of TypeSafe's health
    assert health.admit() is None, "the probe is still out: no second probe"
    health.settle(probe, None)
    after = health.admit()
    assert after, "the probe answered: calls go again"
    assert after.probe is False


# A2: models-check keeps its exit code when the record cannot be written --------------------------


@pytest.mark.parametrize(
    ("served", "code", "line"),
    [
        ("jev-1.99.0", 1, "JEV-MODEL-MOVED jev-1.13.0 -> jev-1.99.0"),
        ("jev-1.13.0", 0, "jev-model ok jev-1.13.0"),
    ],
    ids=["moved", "ok"],
)
def test_a2_models_check_keeps_its_line_and_exit_code_when_the_record_cannot_be_written(
    jev: Any,
    net: Net,
    factory: Path,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    served: str,
    code: int,
    line: str,
) -> None:
    """#289 item 2: the watcher reads exit 2 as 'no alarm', so an alarm printed is exit 1 whatever
    happens to the record afterwards, and an ok is one line and exit 0."""
    (factory / "jev-models.json").mkdir(parents=True)  # the record cannot be written
    pins = tmp_path / "jev-nodes.md"
    pins.write_text(PINS)
    net.respond = models_api(served)
    exit_code = run(jev, ["models-check", "--pin-file", str(pins)])
    out, err = capsys.readouterr()
    assert out.splitlines() == [line]
    assert exit_code == code
    assert "Traceback" not in out + err
    assert "unavailable failed" not in out + err
    assert len(net.posts) == 1, "the watch asked"


# A3: a passed client is held to the whole-call deadline ------------------------------------------


def test_a3_a_passed_client_is_held_to_the_whole_call_deadline(
    jev: Any, factory: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#289 item 3: `ask(..., client=...)` ends within the deadline even when the client's server
    stalls inside one read; the answer that comes later is not waited for."""
    monkeypatch.setattr(jev_settings, "VEXTRUS_JEV_DEADLINE_SECONDS", STALL_DEADLINE)
    release, done = threading.Event(), threading.Event()
    answer = valid()

    def stalled(request: httpx.Request) -> httpx.Response:
        release.wait(CAP)
        response = answer(request)
        done.set()
        return response

    stalled_client = httpx.Client(transport=httpx.MockTransport(stalled))
    try:
        outcome = jev.ask(f"Invented stalled state {MARKER}.", {"q": noul()}, client=stalled_client)
        answered_first = done.is_set()
    finally:
        release.set()
    assert not answered_first, "ask returned only after the stalled server had answered"
    assert is_unavailable(jev, outcome, "timed_out")
    assert statuses(factory)[-1] == "unavailable:timed_out"
    assert done.wait(CAP)
    stalled_client.close()

    with httpx.Client(transport=httpx.MockTransport(valid(p=0.25))) as prompt:
        answered = jev.ask("Invented prompt state.", {"q": noul()}, client=prompt)
    assert isinstance(answered, jev.Answers), "a prompt client still answers"
    assert p_of(answered, "q") == pytest.approx(0.25)


# A4: name resolution is cut to the deadline ------------------------------------------------------


def test_a4_a_stalled_resolver_is_cut_to_the_deadline(jev: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """#289 item 4: the module's own client resolves TypeSafe's name within the call's deadline; a
    resolver that stalls costs the deadline, not the resolver's own time."""
    for name in PROXIES:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(jev_settings, "VEXTRUS_JEV_DEADLINE_SECONDS", STALL_DEADLINE)
    release, done = threading.Event(), threading.Event()
    resolved: list[str] = []

    def stalled_resolver(host: Any, port: Any, *args: Any, **kwargs: Any) -> Any:
        resolved.append(str(host))
        release.wait(CAP)
        done.set()
        raise OSError("invented: the resolver gave up")

    monkeypatch.setattr(socket, "getaddrinfo", stalled_resolver)
    try:
        outcome = jev.ask("Invented state for a stalled resolver.", {"q": noul()})
        resolved_first = done.is_set()
    finally:
        release.set()
    assert not resolved_first, "ask returned only after the stalled resolver had"
    assert isinstance(outcome, jev.Unavailable)
    assert done.wait(CAP)
    assert resolved, "the module's own client asked the resolver"


# A5: two question orders each keep their answers -------------------------------------------------


def test_a5_the_same_questions_in_two_orders_each_keep_their_own_cached_answers(
    jev: Any, factory: Path
) -> None:
    """#289 item 5: switching between two orders of the same questions costs one call per order,
    not one per switch; each order is answered from its own file."""
    wet = noul(f"Is the invented towel wet? {QUESTION_MARKER}")
    green = noul("Is the invented leaf green?")
    state = f"Invented state for two orders {MARKER}."
    first_order = {"wet": wet, "green": green}
    sorted_order = {"green": green, "wet": wet}
    sent: list[httpx.Request] = []
    per_request = [(0.97, 0.12), (0.81, 0.23)]

    def respond(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        p_wet, p_green = per_request[min(len(sent), len(per_request)) - 1]
        by_text = {wet["text"]: p_wet, green["text"]: p_green}
        asked = json.loads(request.content)["questions"]
        answers = {
            qid: {"type": "noul", "noul": by_text[question["instructions"]]}
            for qid, question in asked.items()
        }
        return _reply({"model": "jev-1.13.0", "answers": answers})

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        outcomes = [
            jev.ask(state, order, client=client)
            for order in (first_order, sorted_order, first_order, sorted_order)
        ]
        assert len(sent) == 2, "A, B, A, B: one call per order, then hits"
        for index, (p_wet, p_green) in enumerate(per_request * 2):
            outcome = outcomes[index]
            assert isinstance(outcome, jev.Answers)
            assert p_of(outcome, "wet") == pytest.approx(p_wet)
            assert p_of(outcome, "green") == pytest.approx(p_green)

        pinned = cache_name(state, sorted_order)
        assert pinned == cache_name(state, first_order), "the pinned digest sorts the questions"
        cache = factory / "jev-cache"
        files = sorted(path.name for path in cache.iterdir())
        assert len(files) == 2, files
        assert pinned in files
        for name in files:
            text = (cache / name).read_text()
            assert MARKER not in text, "no state in a cache file"
            assert SENTINEL not in text, "no key in a cache file"

        (cache / pinned).unlink()
        assert isinstance(jev.ask(state, sorted_order, client=client), jev.Answers)
        assert len(sent) == 3, "the pinned name is the sorted order's file"
        assert isinstance(jev.ask(state, first_order, client=client), jev.Answers)
        assert len(sent) == 3, "the other order's file is its own"


# A6: the cool-off holds across processes ---------------------------------------------------------


def _health_numbers(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    assert isinstance(data, dict)
    for value in data.values():
        assert value is None or type(value) in (int, float), f"numbers only: {value!r}"
    return data


def test_a6_three_outages_cool_off_the_next_process_too(
    isolated: None, monkeypatch: pytest.MonkeyPatch, factory: Path, server: Server
) -> None:
    """The owner's ask that Jev be called often: with TypeSafe down, the next short-lived CLI run
    answers `cooling_off` at once instead of paying the deadline again; one probe after the cool-off,
    and an answer clears the record."""
    cool_off = jev_settings.VEXTRUS_JEV_COOL_OFF_SECONDS
    wall = FakeClock(WALL_START)
    question = {"q": noul()}
    first = fresh(monkeypatch, FakeClock(1000.0), wall)
    server.respond = status(500)
    for i in range(jev_settings.VEXTRUS_JEV_COOL_OFF_AFTER):
        outcome = first.ask(f"Invented outage {i} {MARKER}.", question, client=server.client())
        assert is_unavailable(first, outcome, "failed")
    sent = len(server.requests)

    next_clock = FakeClock(50.0)  # another process: its own monotonic clock
    second = fresh(monkeypatch, next_clock, wall)
    server.respond = valid()
    outcome = second.ask(f"Invented next run {MARKER}.", question, client=server.client())
    assert len(server.requests) == sent, "no request while another run's cool-off holds"
    assert is_unavailable(second, outcome, "cooling_off")
    assert statuses(factory)[-1] == "unavailable:cooling_off"

    health = factory / "jev-health.json"
    assert health.is_file()
    text = health.read_text()
    for secret in (MARKER, QUESTION_MARKER, SENTINEL):
        assert secret not in text, "no state, question or key in the health file"
    _health_numbers(health)

    wall.advance(cool_off + 1)
    next_clock.advance(cool_off + 1)
    probe = second.ask(f"Invented probe {MARKER}.", question, client=server.client())
    assert isinstance(probe, second.Answers)
    assert len(server.requests) == sent + 1, "one probe went"
    assert not health.exists(), "an answer deletes the health file"

    third = fresh(monkeypatch, FakeClock(7.0), wall)
    assert isinstance(third.ask("Invented third run.", question, client=server.client()), third.Answers)
    assert len(server.requests) == sent + 2, "the next run asks normally"


@pytest.mark.parametrize(
    ("elapsed", "cools_off"),
    [(-1.0, True), (1.0, False)],
    ids=["within-the-cool-off", "past-the-cool-off"],
)
def test_a6_failures_older_than_the_cool_off_expire(
    isolated: None,
    monkeypatch: pytest.MonkeyPatch,
    factory: Path,
    server: Server,
    elapsed: float,
    cools_off: bool,
) -> None:
    """Two failures, then one more in a fresh run: the third counts with the two only while they are
    younger than `VEXTRUS_JEV_COOL_OFF_SECONDS` by the wall clock."""
    wall = FakeClock(WALL_START)
    question = {"q": noul()}
    server.respond = status(500)
    first = fresh(monkeypatch, FakeClock(1000.0), wall)
    for i in range(2):
        assert is_unavailable(
            first, first.ask(f"Invented early {i}.", question, client=server.client()), "failed"
        )
    assert (factory / "jev-health.json").is_file(), "the failures are recorded for the next run"

    wall.advance(jev_settings.VEXTRUS_JEV_COOL_OFF_SECONDS + elapsed)
    second = fresh(monkeypatch, FakeClock(50.0), wall)
    assert is_unavailable(
        second, second.ask("Invented late.", question, client=server.client()), "failed"
    )
    sent = len(server.requests)
    outcome = second.ask("Invented after.", question, client=server.client())
    if cools_off:
        assert is_unavailable(second, outcome, "cooling_off")
        assert len(server.requests) == sent
    else:
        assert is_unavailable(second, outcome, "failed"), "old failures expired: not cooling off"
        assert len(server.requests) == sent + 1


@pytest.mark.parametrize(
    "corrupt",
    [
        b"{corrupt",
        b"[]",
        b'{"failures": "3", "last_failure_wall": "x", "until_wall": "y"}',
        b"\xff\xfe\x00",
    ],
    ids=["not-json", "a-list", "strings", "not-text"],
)
def test_a6_a_corrupt_health_file_is_ignored_then_replaced(
    isolated: None,
    monkeypatch: pytest.MonkeyPatch,
    factory: Path,
    server: Server,
    corrupt: bytes,
) -> None:
    """A health file the client cannot read never stops a call; the next outages record afresh."""
    wall = FakeClock(WALL_START)
    question = {"q": noul()}
    health = factory / "jev-health.json"
    health.parent.mkdir(parents=True)
    health.write_bytes(corrupt)

    first = fresh(monkeypatch, FakeClock(1000.0), wall)
    server.respond = valid()
    assert isinstance(first.ask("Invented despite.", question, client=server.client()), first.Answers)
    assert len(server.requests) == 1, "the ask went out"

    server.respond = status(500)
    for i in range(jev_settings.VEXTRUS_JEV_COOL_OFF_AFTER):
        first.ask(f"Invented outage {i}.", question, client=server.client())
    sent = len(server.requests)
    second = fresh(monkeypatch, FakeClock(50.0), wall)
    outcome = second.ask("Invented next run.", question, client=server.client())
    assert is_unavailable(second, outcome, "cooling_off"), "the corrupt file was replaced"
    assert len(server.requests) == sent


def test_a6_no_key_and_a_bad_question_write_no_health_file(
    isolated: None, monkeypatch: pytest.MonkeyPatch, factory: Path, server: Server
) -> None:
    """A refusal before any request says nothing of TypeSafe's health: it never writes the record."""
    wall = FakeClock(WALL_START)
    module = fresh(monkeypatch, FakeClock(1000.0), wall)
    health = factory / "jev-health.json"
    bad = {"q": {"kind": "invented-kind", "text": "Invented?"}}

    def refusals() -> None:
        assert is_unavailable(
            module, module.ask("Invented.", bad, client=server.client()), "bad_question"
        )
        monkeypatch.delenv(KEY_VARIABLE)
        assert is_unavailable(
            module, module.ask("Invented no key.", {"q": noul()}, client=server.client()), "no_key"
        )
        monkeypatch.setenv(KEY_VARIABLE, SENTINEL)

    server.respond = valid()
    refusals()
    assert not health.exists()

    server.respond = status(500)
    for i in range(2):
        module.ask(f"Invented outage {i}.", {"q": noul()}, client=server.client())
    assert health.is_file(), "an outage is recorded"
    recorded = health.read_bytes()
    refusals()
    assert health.read_bytes() == recorded
    assert len(server.requests) == 2, "no refusal made a request"


# B: green today, a regression pin (counts toward green only) -------------------------------------


@pytest.mark.parametrize("code", [500, 422])
def test_b_an_unavailable_is_never_cached(jev: Any, factory: Path, server: Server, code: int) -> None:
    server.respond = status(code)
    state, question = "Invented state never cached.", {"q": noul()}
    assert isinstance(jev.ask(state, question, client=server.client()), jev.Unavailable)
    cache = factory / "jev-cache"
    assert not cache.exists() or not any(cache.iterdir())
    server.respond = valid(p=0.7)
    answered = jev.ask(state, question, client=server.client())
    assert isinstance(answered, jev.Answers)
    assert p_of(answered, "q") == pytest.approx(0.7)
