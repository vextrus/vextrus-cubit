"""Acceptance tests for ticket f9: the factory's Jev client, `scripts/factory/jev.py`.

Authority: `docs/specs/factory/contracts/jev-cli.md` (it wins), ticket f9 section 3 (T1 to T29) and
`docs/specs/factory.md` 2.2 "Jev client" and 3.14. Jev advises; it never decides.

Every test reaches the module through the `jev` fixture, which imports it fresh (so the cool-off
counter, the concurrency limit and any memory start clean) and, while it does not exist, hands the
test a stand-in whose every attribute raises the `ModuleNotFoundError`: each test fails on its own.

No test sleeps or touches the network: the module's `_now` and `_sleep` run on a fake clock, and
every `httpx.Client` made during a test (the module's own included) goes to an `httpx.MockTransport`
whose handler the test sets. The answers come from `fixtures/jev/` (recorded live on invented text
on 4 Oct 2026, or hand-written in the live shape and marked synthetic).
"""

import copy
import hashlib
import importlib
import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
from collections.abc import Callable, Iterator, Mapping
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import httpx
import pytest

from vextrus.settings import jev as jev_settings

MODULE = "scripts.factory.jev"
KEY_VARIABLE = "TYPESAFE_API_KEY"
SENTINEL = "KEYSENTINEL-do-not-print-0451"
MARKER = "INVENTED-MARKER-7f3a"
FINDING_TEXT = "INVENTED-FINDING-TEXT-5d1e"
FIXTURES = Path(__file__).parent / "fixtures" / "jev"
REPO = Path(__file__).resolve().parents[4]
MODELS_URL = "https://api.typesafe.ai/v1/models"
HEAD_SHA = "0123456789abcdef0123456789abcdef01234567"
LEVELS = [
    "low: style, naming or a comment; no behaviour changes",
    (
        "medium: wrong behaviour in an uncommon path, or a missing test for a real path; "
        "no data loss or exposure"
    ),
    "high: wrong output, crash or data loss on a normal path, or a check that can be skipped",
    "critical: a secret or private data exposed, a security wall bypassed, or data destroyed",
]
LOG_LINE = re.compile(
    r"^\S+ task=(?P<task>\S+) model=(?P<model>\S+) status=(?P<status>ok|unavailable:[a-z_]+) "
    r"latency_ms=(?P<latency>\d+) input_tokens=(?P<tokens>\d+) cache=(?P<cache>hit|miss)$"
)
ADVICE_ONLY = re.compile(r"verdict|decision|\bpass\b|PASS|\bFIX\b|BLOCK")


def noul(text: str = "Is this invented sentence about the weather?") -> dict[str, Any]:
    return {"kind": "noul", "text": text}


def recorded(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIXTURES / f"{name}.json").read_text())
    return data


# The seams ---------------------------------------------------------------------------------------


class FakeClock:
    """The module's `_now` and `_sleep`: time moves only when slept or advanced."""

    def __init__(self) -> None:
        self.t = 1000.0
        self.sleeps: list[float] = []

    def now(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.t += seconds

    def advance(self, seconds: float) -> None:
        self.t += seconds


class _Missing:
    """The module while it does not exist: every use raises the import's error."""

    def __init__(self, error: ModuleNotFoundError) -> None:
        self._message = str(error)

    def __getattr__(self, name: str) -> Any:
        raise ModuleNotFoundError(self._message)


def _load() -> Any:
    sys.modules.pop(MODULE, None)
    try:
        return importlib.import_module(MODULE)
    except ModuleNotFoundError as error:
        return _Missing(error)


Responder = Callable[[httpx.Request], httpx.Response]


def _refuse(request: httpx.Request) -> httpx.Response:
    return httpx.Response(599, content=b"no responder set: the test did not expect a request")


class Net:
    """Every request any `httpx.Client` makes during the test, and the test's responder."""

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

    def client(self) -> httpx.Client:
        made = _Routed()
        self._clients.append(made)
        return made

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


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def factory(tmp_path: Path) -> Path:
    """`VEXTRUS_FACTORY_DIR`: not created; the module makes what it needs."""
    return tmp_path / "factory-not-yet-made"


@pytest.fixture
def net(monkeypatch: pytest.MonkeyPatch) -> Iterator[Net]:
    recorder = Net()
    monkeypatch.setattr(_Routed, "route", httpx.MockTransport(recorder))
    monkeypatch.setattr(httpx, "Client", _Routed)
    monkeypatch.setattr("httpx._api.Client", _Routed)
    yield recorder
    recorder.close()


@pytest.fixture
def jev(monkeypatch: pytest.MonkeyPatch, factory: Path, clock: FakeClock, net: Net) -> Iterator[Any]:
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(factory))
    monkeypatch.setenv(KEY_VARIABLE, SENTINEL)
    module = _load()
    if not isinstance(module, _Missing):
        monkeypatch.setattr(module, "_now", clock.now)
        monkeypatch.setattr(module, "_sleep", clock.sleep)
    yield module
    sys.modules.pop(MODULE, None)


# Responders --------------------------------------------------------------------------------------


def _asked(request: httpx.Request) -> dict[str, dict[str, Any]]:
    questions: dict[str, dict[str, Any]] = json.loads(request.content)["questions"]
    return questions


def _reply(body: object, status: int = 200, headers: Mapping[str, str] | None = None) -> httpx.Response:
    text = body if isinstance(body, str) else json.dumps(body)
    text = text.replace('"__NAN__"', "NaN")
    return httpx.Response(
        status, content=text.encode(), headers={"content-type": "application/json", **(headers or {})}
    )


def _synthetic_answer(question: Mapping[str, Any], p: float) -> dict[str, Any]:
    kind = question["type"]
    if kind == "noul":
        return {"type": "noul", "noul": p}
    criteria = question["criteria"]
    if kind == "choice":
        keys = list(criteria)
        probabilities = {key: (1.0 if i == 0 else 0.0) for i, key in enumerate(keys)}
        return {"type": "choice", "choice": keys[0], "confidence": 1.0, "probabilities": probabilities}
    legend = {str(i): text for i, text in enumerate(criteria)}
    probabilities = {str(i): (1.0 if i == 0 else 0.0) for i in range(len(criteria))}
    return {
        "type": "score",
        "score": 0.0,
        "confidence": 1.0,
        "legend": legend,
        "probabilities": probabilities,
    }


def valid(
    *,
    p: float | Callable[[str, Mapping[str, Any]], float] = 0.5,
    model: str = "jev-1.13.0",
    clock: FakeClock | None = None,
    advance: float = 0.0,
) -> Responder:
    """A valid answer to whatever was asked: each noul `p` (or `p(instructions, body)`)."""

    def respond(request: httpx.Request) -> httpx.Response:
        if clock is not None:
            clock.advance(advance)
        body = json.loads(request.content)
        answers = {}
        for qid, question in body["questions"].items():
            value = p(question.get("instructions", ""), body) if callable(p) else p
            answers[qid] = _synthetic_answer(question, value)
        return _reply(
            {"model": model, "answers": answers, "usage": {"input_tokens": 100, "output_tokens": 9}}
        )

    return respond


def replaying(
    name: str,
    *,
    model: str | None = None,
    clock: FakeClock | None = None,
    advance: float = 0.0,
    mutate: Callable[[dict[str, Any], list[str]], None] | None = None,
) -> Responder:
    """A recorded response, its answers given to the request's own question ids: by type, in the
    order the request asks them (question names are the client's, and are not sent)."""
    response = recorded(name)["response"]

    def respond(request: httpx.Request) -> httpx.Response:
        if clock is not None:
            clock.advance(advance)
        pools: dict[str, list[dict[str, Any]]] = {}
        for answer in response["answers"].values():
            pools.setdefault(answer["type"], []).append(answer)
        used: dict[str, int] = {}
        answers = {}
        for qid, question in _asked(request).items():
            pool = pools.get(question["type"], [{"type": question["type"]}])
            index = used.get(question["type"], 0)
            used[question["type"]] = index + 1
            answers[qid] = copy.deepcopy(pool[index % len(pool)])
        body = {**copy.deepcopy(response), "answers": answers}
        if model is not None:
            body["model"] = model
        if mutate is not None:
            mutate(body, list(answers))
        return _reply(body)

    return respond


def status(code: int, headers: Mapping[str, str] | None = None) -> Responder:
    def respond(request: httpx.Request) -> httpx.Response:
        return _reply({"error": "invented"}, code, headers)

    return respond


def in_turn(*responders: Responder) -> Responder:
    """The n-th request gets the n-th responder; the last one repeats."""
    calls = [0]

    def respond(request: httpx.Request) -> httpx.Response:
        index = min(calls[0], len(responders) - 1)
        calls[0] += 1
        return responders[index](request)

    return respond


def models_api(*, model: str = "jev-1.13.0", release_date: str | None = None) -> Responder:
    """`models-check`'s two requests: the noul call and `GET /v1/models`."""
    listed = recorded("models-list")["response"]
    if release_date is not None:
        listed = copy.deepcopy(listed)
        for entry in listed["models"]:
            if entry["name"] == "jev-latest":
                entry["release_date"] = release_date
    call = replaying("models-check", model=model)

    def respond(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            assert str(request.url) == MODELS_URL
            return _reply(listed)
        return call(request)

    return respond


# Helpers on the module's outcomes ---------------------------------------------------------------


def why(outcome: Any) -> str:
    value = outcome.why
    return str(getattr(value, "value", value))


def is_unavailable(jev: Any, outcome: Any, reason: str | None = None) -> bool:
    return isinstance(outcome, jev.Unavailable) and (reason is None or why(outcome) == reason)


def number(value: Any) -> float:
    assert not isinstance(value, bool)
    return float(value)


def keyed(mapping: Mapping[Any, Any]) -> dict[str, float]:
    return {str(key): number(value) for key, value in mapping.items()}


def cache_name(state: object, questions: object, model: str = "jev-1.13.0") -> str:
    canonical = json.dumps(
        {"state": state, "questions": questions, "model": model},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return hashlib.sha256(canonical.encode("ascii")).hexdigest() + ".json"


def log_lines(factory: Path) -> list[str]:
    path = factory / "jev.log"
    return path.read_text().splitlines() if path.exists() else []


def run(jev: Any, argv: list[str]) -> Any:
    """`main(argv)`'s exit code, whether returned or raised."""
    try:
        return jev.main(argv)
    except SystemExit as stop:
        return stop.code


def every_file(root: Path) -> set[str]:
    if not root.exists():
        return set()
    return {str(p.relative_to(root)) for p in root.rglob("*") if p.is_file()}


def findings_file(tmp_path: Path, findings: list[dict[str, Any]], **overrides: Any) -> Path:
    path = tmp_path / "in" / "findings.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"pr": 250, "head_sha": HEAD_SHA, "findings": findings, **overrides}))
    return path


def three_findings() -> list[dict[str, Any]]:
    return [
        {
            "score": 80,
            "file": "invented/totals.py",
            "line": 41,
            "summary": f"{FINDING_TEXT} discount added twice",
        },
        {"score": 12, "file": "invented/names.py", "line": 7, "summary": f"{FINDING_TEXT} a typo"},
        {
            "score": 95,
            "file": "invented/keys.py",
            "line": 3,
            "summary": f"{FINDING_TEXT} a key printed",
        },
    ]


# T1 to T3: no key, the size limit, the request ---------------------------------------------------


@pytest.mark.parametrize("value", [None, "", "   "], ids=["unset", "empty", "whitespace"])
def test_t1_no_key_is_unavailable_with_no_call(
    jev: Any, net: Net, monkeypatch: pytest.MonkeyPatch, value: str | None
) -> None:
    if value is None:
        monkeypatch.delenv(KEY_VARIABLE, raising=False)
    else:
        monkeypatch.setenv(KEY_VARIABLE, value)
    net.respond = valid()
    outcome = jev.ask("Invented text.", {"q": noul()}, client=net.client())
    assert is_unavailable(jev, outcome, "no_key")
    assert net.requests == []


def test_t2_a_body_at_the_limit_is_sent_whole_and_one_byte_more_is_refused(jev: Any, net: Net) -> None:
    limit = jev_settings.VEXTRUS_JEV_MAX_REQUEST_BYTES
    net.respond = valid()
    questions = {"q": noul()}
    probe = "x" * 100
    assert isinstance(jev.ask(probe, questions, client=net.client()), jev.Answers)
    first = net.posts[0].content
    assert first == json.dumps(
        json.loads(first), separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode("ascii"), "the body is compact ASCII JSON"
    size = len(probe) + limit - len(first)

    exact = "y" * size
    assert isinstance(jev.ask(exact, questions, client=net.client()), jev.Answers)
    sent = net.posts[-1].content
    assert len(sent) == limit
    assert json.loads(sent)["state"] == exact, "nothing cut"

    sent_before = len(net.requests)
    over = "z" * (size + 1)
    for _ in range(3):
        assert is_unavailable(jev, jev.ask(over, questions, client=net.client()), "too_large")
    assert len(net.requests) == sent_before, "an over-limit body is never sent"
    # Three refusals in a row did not start a cool-off: the next sound call is made.
    assert isinstance(jev.ask("Invented text after.", questions, client=net.client()), jev.Answers)
    assert len(net.requests) == sent_before + 1


def test_t3_the_request_is_one_https_post_with_the_key_in_the_header_only(jev: Any, net: Net) -> None:
    net.respond = valid()
    state = f"Invented state {MARKER}."
    assert isinstance(jev.ask(state, {"q": noul()}, client=net.client()), jev.Answers)
    assert len(net.requests) == 1
    request = net.requests[0]
    assert request.method == "POST"
    assert str(request.url) == jev_settings.VEXTRUS_JEV_URL
    assert request.url.scheme == "https"
    assert request.headers["authorization"] == f"Bearer {SENTINEL}"
    body = json.loads(request.content)
    assert body["model"] == "jev-1.13.0"
    assert body["state"] == state
    assert isinstance(body["questions"], dict)
    assert SENTINEL not in request.content.decode()


def test_t3_a_url_that_is_not_https_is_refused(
    monkeypatch: pytest.MonkeyPatch, jev: Any, net: Net
) -> None:
    monkeypatch.setattr(jev_settings, "VEXTRUS_JEV_URL", "http://api.typesafe.ai/v1/systemone")
    module = _load()  # whether the module reads the URL at import or at call time
    if not isinstance(module, _Missing):
        clock = FakeClock()
        monkeypatch.setattr(module, "_now", clock.now)
        monkeypatch.setattr(module, "_sleep", clock.sleep)
    net.respond = valid()
    outcome = module.ask("Invented text.", {"q": noul()}, client=net.client())
    assert isinstance(outcome, module.Unavailable)
    assert net.requests == []


# T4 to T6: retries, the deadline, refusals -------------------------------------------------------


@pytest.mark.parametrize("first", ["429", "529", "dropped"])
def test_t4_a_busy_answer_or_a_dropped_connection_is_tried_again(
    jev: Any, net: Net, clock: FakeClock, first: str
) -> None:
    def dropped(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("invented: connection dropped", request=request)

    failing = dropped if first == "dropped" else status(int(first))
    net.respond = in_turn(failing, valid(p=0.7))
    outcome = jev.ask("Invented text.", {"q": noul()}, client=net.client())
    assert isinstance(outcome, jev.Answers)
    assert number(outcome["q"]["p"]) == pytest.approx(0.7)
    assert len(net.requests) == 2
    assert clock.sleeps[0] == pytest.approx(jev_settings.VEXTRUS_JEV_BACKOFF_SECONDS)
    assert clock.sleeps[0] == pytest.approx(0.5)


@pytest.mark.parametrize("retry_after", [None, "30"], ids=["no-retry-after", "retry-after-30"])
def test_t5_always_busy_ends_within_the_deadline(
    jev: Any, net: Net, clock: FakeClock, retry_after: str | None
) -> None:
    headers = {"retry-after": retry_after} if retry_after else None
    net.respond = status(429, headers)
    start = clock.t
    outcome = jev.ask("Invented text.", {"q": noul()}, client=net.client())
    assert isinstance(outcome, jev.Unavailable)
    assert why(outcome) in {"timed_out", "busy"}
    deadline = jev_settings.VEXTRUS_JEV_DEADLINE_SECONDS
    assert clock.t - start <= deadline
    assert sum(clock.sleeps) <= deadline
    assert all(pause <= jev_settings.VEXTRUS_JEV_BACKOFF_MAX_SECONDS for pause in clock.sleeps)
    if retry_after is None:
        assert len(net.requests) >= 3, "retried while the deadline allowed"
        assert clock.sleeps[:3] == pytest.approx([0.5, 1.0, 2.0])


@pytest.mark.parametrize(("code", "reason"), [(401, "key_refused"), (422, "request_refused")])
def test_t6_a_refused_key_or_request_is_not_tried_again(
    jev: Any, net: Net, code: int, reason: str
) -> None:
    net.respond = status(code)
    outcome = jev.ask("Invented text.", {"q": noul()}, client=net.client())
    assert is_unavailable(jev, outcome, reason)
    assert len(net.requests) == 1


def test_t6_a_server_error_is_failed(jev: Any, net: Net) -> None:
    net.respond = status(500)
    assert is_unavailable(jev, jev.ask("Invented text.", {"q": noul()}, client=net.client()), "failed")


# T7, T8, T29: shapes -----------------------------------------------------------------------------

NOUL_SCORE_QUESTIONS = {
    "real": noul("Is this review finding real: a true defect in the code?"),
    "severity": {"kind": "score", "text": "How severe is this finding?", "levels": LEVELS},
}
CHOICE_QUESTIONS = {
    "pick": {
        "kind": "choice",
        "text": "Which kind of failure is this?",
        "options": {"a": "a missing dependency", "b": "a failing assertion in a test"},
    }
}


def _of(body: dict[str, Any], kind: str) -> dict[str, Any]:
    answer: dict[str, Any] = next(a for a in body["answers"].values() if a["type"] == kind)
    return answer


def _set_noul(value: object) -> Callable[[dict[str, Any], list[str]], None]:
    def mutate(body: dict[str, Any], ids: list[str]) -> None:
        _of(body, "noul")["noul"] = value

    return mutate


def _drop_one(body: dict[str, Any], ids: list[str]) -> None:
    del body["answers"][ids[0]]


def _add_one(body: dict[str, Any], ids: list[str]) -> None:
    body["answers"]["zz_extra"] = copy.deepcopy(body["answers"][ids[0]])


def _wrong_type(body: dict[str, Any], ids: list[str]) -> None:
    _of(body, "noul")["type"] = "choice"


def _choice(field: str, value: object) -> Callable[[dict[str, Any], list[str]], None]:
    def mutate(body: dict[str, Any], ids: list[str]) -> None:
        _of(body, "choice")[field] = value

    return mutate


def _score_keys(body: dict[str, Any], ids: list[str]) -> None:
    _of(body, "score")["probabilities"] = {"0": 0.0, "1": 0.11, "2": 0.89, "7": 0.0}


MALFORMED: dict[str, tuple[str, dict[str, Any], Responder]] = {
    "not-json": ("noul-score", NOUL_SCORE_QUESTIONS, lambda r: _reply("this is not json")),
    "not-an-object": ("noul-score", NOUL_SCORE_QUESTIONS, lambda r: _reply("[1, 2]")),
    "model-mismatch": ("noul-score", NOUL_SCORE_QUESTIONS, replaying("noul-score", model="jev-1.12.0")),
    "missing-id": ("noul-score", NOUL_SCORE_QUESTIONS, replaying("noul-score", mutate=_drop_one)),
    "extra-id": ("noul-score", NOUL_SCORE_QUESTIONS, replaying("noul-score", mutate=_add_one)),
    "wrong-type": ("noul-score", NOUL_SCORE_QUESTIONS, replaying("noul-score", mutate=_wrong_type)),
    "noul-1.2": ("noul-score", NOUL_SCORE_QUESTIONS, replaying("noul-score", mutate=_set_noul(1.2))),
    "noul--0.1": ("noul-score", NOUL_SCORE_QUESTIONS, replaying("noul-score", mutate=_set_noul(-0.1))),
    "noul-nan": (
        "noul-score",
        NOUL_SCORE_QUESTIONS,
        replaying("noul-score", mutate=_set_noul("__NAN__")),
    ),
    "noul-true": ("noul-score", NOUL_SCORE_QUESTIONS, replaying("noul-score", mutate=_set_noul(True))),
    "noul-string": (
        "noul-score",
        NOUL_SCORE_QUESTIONS,
        replaying("noul-score", mutate=_set_noul("0.5")),
    ),
    "choice-not-an-option": (
        "choice",
        CHOICE_QUESTIONS,
        replaying("choice", mutate=_choice("choice", "z")),
    ),
    "choice-probability-keys": (
        "choice",
        CHOICE_QUESTIONS,
        replaying("choice", mutate=_choice("probabilities", {"a": 1.0, "c": 0.0})),
    ),
    "choice-probability-range": (
        "choice",
        CHOICE_QUESTIONS,
        replaying("choice", mutate=_choice("probabilities", {"a": 1.5, "b": 0.0})),
    ),
    "score-probability-keys": (
        "noul-score",
        NOUL_SCORE_QUESTIONS,
        replaying("noul-score", mutate=_score_keys),
    ),
}


@pytest.mark.parametrize("case", list(MALFORMED))
def test_t7_an_answer_that_does_not_answer_the_question_is_malformed(
    jev: Any, net: Net, case: str
) -> None:
    _name, questions, responder = MALFORMED[case]
    net.respond = responder
    outcome = jev.ask(f"Invented text for {case}.", questions, client=net.client())
    assert is_unavailable(jev, outcome, "malformed")


def test_t7_an_answer_over_the_maximum_is_oversized(jev: Any, net: Net) -> None:
    def padded(body: dict[str, Any], ids: list[str]) -> None:
        body["padding"] = "p" * (jev_settings.VEXTRUS_JEV_MAX_RESPONSE_BYTES + 10)

    net.respond = replaying("noul-score", mutate=padded)
    outcome = jev.ask("Invented text.", NOUL_SCORE_QUESTIONS, client=net.client())
    assert is_unavailable(jev, outcome, "oversized")


def test_t8_a_noul_and_a_score_are_read_as_recorded(jev: Any, net: Net, clock: FakeClock) -> None:
    net.respond = replaying("noul-score", clock=clock, advance=0.321)
    answers = jev.ask("Invented finding.", NOUL_SCORE_QUESTIONS, client=net.client())
    assert isinstance(answers, jev.Answers)
    as_object: object = answers
    assert isinstance(as_object, Mapping)
    assert set(answers) == {"real", "severity"}
    assert set(answers["real"]) == {"p"}
    assert number(answers["real"]["p"]) == pytest.approx(0.25)
    severity = answers["severity"]
    assert set(severity) == {"score", "legend", "probabilities", "confidence"}
    assert number(severity["score"]) == pytest.approx(1.88)
    assert number(severity["confidence"]) == pytest.approx(0.88)
    assert {str(k): v for k, v in severity["legend"].items()} == {
        str(i): text for i, text in enumerate(LEVELS)
    }
    assert keyed(severity["probabilities"]) == pytest.approx({"0": 0.0, "1": 0.11, "2": 0.89, "3": 0.0})
    assert answers.model == "jev-1.13.0"
    assert answers.input_tokens == 458
    assert answers.output_tokens == 35
    assert answers.latency_ms == pytest.approx(321, abs=1)


def test_t8_a_choice_is_read_as_recorded(jev: Any, net: Net) -> None:
    net.respond = replaying("choice")
    answers = jev.ask("Invented build log.", CHOICE_QUESTIONS, client=net.client())
    assert isinstance(answers, jev.Answers)
    pick = answers["pick"]
    assert set(pick) == {"choice", "probabilities", "confidence"}
    assert pick["choice"] == "a"
    assert number(pick["confidence"]) == pytest.approx(1.0)
    assert keyed(pick["probabilities"]) == pytest.approx({"a": 1.0, "b": 0.0})
    assert answers.input_tokens == 338


def test_t8_three_questions_in_one_call_are_read_as_recorded(jev: Any, net: Net) -> None:
    questions = {
        "named": noul("Does the finding name a file and a line?"),
        "part": {
            "kind": "choice",
            "text": "Which part of the code does the finding concern?",
            "options": {"a": "arithmetic on money", "b": "user interface text", "c": "network access"},
        },
        "severity": {"kind": "score", "text": "How severe is this finding?", "levels": LEVELS},
    }
    net.respond = replaying("three-questions")
    answers = jev.ask("Invented finding.", questions, client=net.client())
    assert isinstance(answers, jev.Answers)
    assert len(net.requests) == 1
    assert number(answers["named"]["p"]) == pytest.approx(0.8)
    assert answers["part"]["choice"] == "a"
    assert keyed(answers["part"]["probabilities"]) == pytest.approx({"a": 1.0, "b": 0.0, "c": 0.0})
    assert number(answers["severity"]["score"]) == pytest.approx(1.86)
    assert answers.input_tokens == 525


def test_t29_contract_questions_go_out_in_the_apis_wire_shape_without_their_names(
    jev: Any, net: Net
) -> None:
    questions = {
        "zz_name_marker_alpha": {"kind": "noul", "text": "Is the invented sentence a question?"},
        "zz_name_marker_beta": {
            "kind": "choice",
            "text": "Which invented colour?",
            "options": {"red": "the colour red", "blue": "the colour blue"},
        },
        "zz_name_marker_gamma": {
            "kind": "score",
            "text": "How loud is the invented sound?",
            "levels": ["silent", "quiet", "loud"],
        },
        "zz_name_marker_delta": {
            "kind": "noul",
            "text": "Is the invented door open?",
            "criteria": {"true": "the door is open", "false": "the door is shut"},
        },
    }
    net.respond = valid()
    answers = jev.ask("Invented text.", questions, client=net.client())
    assert isinstance(answers, jev.Answers)
    assert set(answers) == set(questions)
    raw = net.posts[0].content.decode()
    assert "zz_name_marker" not in raw, "question names are not sent"
    sent = sorted(json.dumps(q, sort_keys=True) for q in _asked(net.posts[0]).values())
    expected = [
        {"type": "noul", "instructions": "Is the invented sentence a question?"},
        {
            "type": "choice",
            "instructions": "Which invented colour?",
            "criteria": {"red": "the colour red", "blue": "the colour blue"},
        },
        {
            "type": "score",
            "instructions": "How loud is the invented sound?",
            "criteria": ["silent", "quiet", "loud"],
        },
        {
            "type": "noul",
            "instructions": "Is the invented door open?",
            "criteria": {"true": "the door is open", "false": "the door is shut"},
        },
    ]
    assert sent == sorted(json.dumps(q, sort_keys=True) for q in expected)


@pytest.mark.parametrize(
    "questions",
    [
        {"q": {"kind": "rank", "text": "Rank these?"}},
        [{"kind": "noul", "text": "Is it?"}],
        "Is it?",
        {"q": {"kind": "choice", "text": "Which?", "options": {"only": "the one option"}}},
        {"q": {"kind": "score", "text": "How much?", "levels": ["only"]}},
        {"q": {"kind": "score", "text": "How much?", "levels": [f"level {i}" for i in range(11)]}},
    ],
    ids=["unknown-kind", "a-list", "a-string", "one-option", "one-level", "eleven-levels"],
)
def test_t29_a_question_the_client_cannot_send_is_a_bad_question(
    jev: Any, net: Net, questions: object
) -> None:
    net.respond = valid()
    outcome = jev.ask("Invented text.", questions, client=net.client())
    assert is_unavailable(jev, outcome, "bad_question")
    assert net.requests == []


# T9 to T12: cool-off, cache, log, the key --------------------------------------------------------


def test_t9_three_outages_in_a_row_cool_off_for_60_seconds(jev: Any, net: Net, clock: FakeClock) -> None:
    net.respond = status(500)
    for i in range(3):
        assert is_unavailable(
            jev, jev.ask(f"Invented {i}.", {"q": noul()}, client=net.client()), "failed"
        )
    sent = len(net.requests)
    outcome = jev.ask("Invented 3.", {"q": noul()}, client=net.client())
    assert is_unavailable(jev, outcome, "cooling_off")
    assert len(net.requests) == sent, "no request while cooling off"
    clock.advance(60.0)
    net.respond = valid()
    assert isinstance(jev.ask("Invented 4.", {"q": noul()}, client=net.client()), jev.Answers)
    assert len(net.requests) == sent + 1


def test_t9_a_success_resets_the_count(jev: Any, net: Net) -> None:
    net.respond = in_turn(status(500), status(500), valid(), status(500), status(500), valid())
    outcomes = [jev.ask(f"Invented {i}.", {"q": noul()}, client=net.client()) for i in range(6)]
    assert [isinstance(o, jev.Answers) for o in outcomes] == [False, False, True, False, False, True]
    assert len(net.requests) == 6


def test_t9_no_key_never_starts_a_cool_off(jev: Any, net: Net, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(KEY_VARIABLE)
    net.respond = valid()
    for i in range(4):
        assert is_unavailable(
            jev, jev.ask(f"Invented {i}.", {"q": noul()}, client=net.client()), "no_key"
        )
    monkeypatch.setenv(KEY_VARIABLE, SENTINEL)
    assert isinstance(jev.ask("Invented after.", {"q": noul()}, client=net.client()), jev.Answers)
    assert len(net.requests) == 1


@pytest.mark.parametrize("code", [401, 422])
def test_t9_a_refused_key_or_request_never_starts_a_cool_off(jev: Any, net: Net, code: int) -> None:
    net.respond = status(code)
    for i in range(4):
        assert isinstance(jev.ask(f"Invented {i}.", {"q": noul()}, client=net.client()), jev.Unavailable)
    assert len(net.requests) == 4, "each refusal was a request, none a cool-off"
    net.respond = valid()
    assert isinstance(jev.ask("Invented after.", {"q": noul()}, client=net.client()), jev.Answers)


def test_t10_an_identical_call_is_answered_from_the_cache(jev: Any, net: Net, factory: Path) -> None:
    net.respond = valid(p=0.42)
    state = f"Invented state {MARKER}."
    questions = {"q": noul()}
    first = jev.ask(state, questions, client=net.client())
    assert isinstance(first, jev.Answers)
    again = jev.ask(state, questions, client=net.client())
    assert isinstance(again, jev.Answers)
    assert len(net.requests) == 1
    assert dict(again) == dict(first)
    assert again.model == first.model

    cached = factory / "jev-cache" / cache_name(state, questions)
    assert cached.is_file(), "the file is named by the pinned sha256"
    text = cached.read_text()
    assert MARKER not in text
    assert SENTINEL not in text

    jev.ask(state, questions, model="jev-latest", client=net.client())
    jev.ask(state, {"q": noul("Another invented question?")}, client=net.client())
    jev.ask(f"Another invented state {MARKER}.", questions, client=net.client())
    assert len(net.requests) == 4, "a changed model, question or state is a miss"


def test_t10_a_recorded_cache_file_is_replayed_with_no_key_and_no_call(
    jev: Any, net: Net, factory: Path, monkeypatch: pytest.MonkeyPatch, clock: FakeClock
) -> None:
    net.respond = replaying("noul-score")
    state = "Invented finding for the replay."
    first = jev.ask(state, NOUL_SCORE_QUESTIONS, client=net.client())
    assert isinstance(first, jev.Answers)
    cached = factory / "jev-cache" / cache_name(state, NOUL_SCORE_QUESTIONS)
    recording = cached.read_bytes()
    cached.unlink()

    fresh = _load()  # nothing kept in memory
    monkeypatch.setattr(fresh, "_now", clock.now)
    monkeypatch.setattr(fresh, "_sleep", clock.sleep)
    cached.write_bytes(recording)
    monkeypatch.delenv(KEY_VARIABLE)
    sent = len(net.requests)
    replayed = fresh.ask(state, NOUL_SCORE_QUESTIONS, client=net.client())
    assert isinstance(replayed, fresh.Answers)
    assert len(net.requests) == sent
    assert dict(replayed) == dict(first)
    assert replayed.model == "jev-1.13.0"


def test_t10_a_corrupt_cache_file_is_asked_again(jev: Any, net: Net, factory: Path) -> None:
    net.respond = valid(p=0.61)
    state, questions = "Invented state for a corrupt file.", {"q": noul()}
    cached = factory / "jev-cache" / cache_name(state, questions)
    cached.parent.mkdir(parents=True)
    cached.write_text("{corrupt")
    answers = jev.ask(state, questions, client=net.client())
    assert isinstance(answers, jev.Answers)
    assert number(answers["q"]["p"]) == pytest.approx(0.61)
    assert len(net.requests) == 1


def test_t10_unavailable_is_never_cached(
    jev: Any, net: Net, factory: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    net.respond = status(500)
    questions = {"q": noul()}
    assert isinstance(jev.ask("Invented A.", questions, client=net.client()), jev.Unavailable)
    monkeypatch.delenv(KEY_VARIABLE)
    assert isinstance(jev.ask("Invented B.", questions, client=net.client()), jev.Unavailable)
    assert not (factory / "jev-cache" / cache_name("Invented A.", questions)).exists()
    assert not (factory / "jev-cache" / cache_name("Invented B.", questions)).exists()
    monkeypatch.setenv(KEY_VARIABLE, SENTINEL)
    net.respond = valid()
    assert isinstance(jev.ask("Invented A.", questions, client=net.client()), jev.Answers)


def test_t11_one_log_line_per_ask_in_the_contracts_form(
    jev: Any, net: Net, factory: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert not factory.exists()
    net.respond = replaying("noul-score")
    question_text = "Is this invented review finding real?"
    questions = {
        "real": noul(question_text),
        "severity": {"kind": "score", "text": "How severe?", "levels": LEVELS},
    }
    state = f"Invented finding {MARKER}."
    jev.ask(state, questions, task="triage", client=net.client())
    jev.ask(state, questions, task="triage", client=net.client())
    monkeypatch.delenv(KEY_VARIABLE)
    jev.ask(f"Other {MARKER}.", questions, client=net.client())

    lines = log_lines(factory)
    assert len(lines) == 3
    parsed = [LOG_LINE.match(line) for line in lines]
    assert all(parsed), lines
    first, hit, no_key = (match.groupdict() for match in parsed if match)
    assert first == {**first, "task": "triage", "model": "jev-1.13.0", "status": "ok", "cache": "miss"}
    assert first["tokens"] == "458"
    assert hit["cache"] == "hit"
    assert hit["status"] == "ok"
    assert no_key["status"] == "unavailable:no_key"
    assert no_key["task"] == "ask"
    assert no_key["model"] == "jev-1.13.0"
    text = (factory / "jev.log").read_text()
    for secret in (MARKER, question_text, SENTINEL):
        assert secret not in text


def test_t12_the_key_never_leaks_even_from_an_error_that_carries_it(
    jev: Any,
    net: Net,
    factory: Path,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)

    def leaky(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(
            f"invented failure; headers: authorization={request.headers['authorization']}",
            request=request,
        )

    net.respond = leaky
    outcome = jev.ask("Invented text.", {"q": noul()}, client=net.client())
    assert isinstance(outcome, jev.Unavailable)
    texts = [repr(outcome), str(outcome)]

    issues = tmp_path / "issues.json"
    issues.write_text(json.dumps([{"number": 7, "title": "Invented issue title"}]))
    pins = tmp_path / "pins.md"
    pins.write_text("| node | model |\n|---|---|\n| sheet_type | jev-1.13.0 |\n")
    for argv in (
        ["triage", "--from", str(findings_file(tmp_path, three_findings()))],
        ["same-issue", "--text", "Invented defect text.", "--issues", str(issues)],
        ["models-check", "--pin-file", str(pins)],
    ):
        run(jev, argv)
    captured = capsys.readouterr()
    texts += [captured.out, captured.err, caplog.text]
    texts += [p.read_text(errors="replace") for p in factory.rglob("*") if p.is_file()]
    assert len(net.requests) >= 4, "every subcommand reached the transport"
    for text in texts:
        assert SENTINEL not in text


# T13 to T18: triage ------------------------------------------------------------------------------


def _sidecar(factory: Path) -> Path:
    return factory / "ledger-jev" / f"250-{HEAD_SHA}.json"


def test_t13_triage_writes_p_real_and_severity_per_finding_to_the_sidecar(
    jev: Any, net: Net, factory: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    net.respond = replaying("triage-3-findings")
    code = run(jev, ["triage", "--from", str(findings_file(tmp_path, three_findings()))])
    out = capsys.readouterr().out
    assert code == 0
    assert out.strip() == "triage 250 01234567 3 findings"

    assert len(net.posts) == 1, "one call per file"
    asked = list(_asked(net.posts[0]).values())
    assert len(asked) == 6, "two questions per finding"
    assert sorted(q["type"] for q in asked) == ["noul"] * 3 + ["score"] * 3
    for question in asked:
        if question["type"] == "score":
            assert question["criteria"] == LEVELS

    sidecar = json.loads(_sidecar(factory).read_text())
    assert set(sidecar) == {"schema_version", "pr", "head_sha", "model", "written_at", "findings"}
    assert sidecar["schema_version"] == 1
    assert sidecar["pr"] == 250
    assert sidecar["head_sha"] == HEAD_SHA
    assert sidecar["model"] == "jev-1.13.0"
    assert isinstance(sidecar["written_at"], str)
    assert [set(f) for f in sidecar["findings"]] == [{"index", "p_real", "severity"}] * 3
    assert [f["index"] for f in sidecar["findings"]] == [0, 1, 2]
    assert [f["p_real"] for f in sidecar["findings"]] == pytest.approx([0.93, 0.01, 0.55])
    assert [f["severity"] for f in sidecar["findings"]] == ["high", "low", "critical"]
    for text in (_sidecar(factory).read_text(), "\n".join(log_lines(factory)), out):
        assert FINDING_TEXT not in text
        assert "invented/" not in text


def test_t14_triage_never_drops_a_finding_and_refuses_an_over_limit_file_whole(
    jev: Any, net: Net, factory: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    net.respond = replaying("triage-3-findings")
    long_findings = three_findings()
    long_findings[1]["summary"] = "w" * (jev_settings.VEXTRUS_JEV_MAX_REQUEST_BYTES + 1)
    code = run(jev, ["triage", "--from", str(findings_file(tmp_path, long_findings))])
    assert code == 0
    assert capsys.readouterr().out.strip() == "unavailable too_large"
    assert net.requests == [], "nothing cut, nothing sent"
    assert not _sidecar(factory).exists()

    assert run(jev, ["triage", "--from", str(findings_file(tmp_path, three_findings()))]) == 0
    entries = json.loads(_sidecar(factory).read_text())["findings"]
    assert [e["index"] for e in entries] == [0, 1, 2]
    assert entries[1]["p_real"] == pytest.approx(0.01), "a finding Jev doubts is still there"


@pytest.mark.parametrize("way", ["no_key", "failed"])
def test_t15_triage_with_jev_unavailable_writes_no_sidecar(
    jev: Any,
    net: Net,
    factory: Path,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    way: str,
) -> None:
    if way == "no_key":
        monkeypatch.delenv(KEY_VARIABLE)
    net.respond = status(500)
    code = run(jev, ["triage", "--from", str(findings_file(tmp_path, three_findings()))])
    out = capsys.readouterr().out
    assert code == 0
    assert out.strip() == f"unavailable {way}"
    assert not (factory / "ledger-jev").exists() or every_file(factory / "ledger-jev") == set()
    assert not ADVICE_ONLY.search(out)


def test_t15_triage_output_is_advice_only(
    jev: Any, net: Net, factory: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    net.respond = replaying("triage-3-findings")
    assert run(jev, ["triage", "--from", str(findings_file(tmp_path, three_findings()))]) == 0
    for text in (capsys.readouterr().out, _sidecar(factory).read_text()):
        assert not ADVICE_ONLY.search(text), text


def test_t16_triage_writes_only_the_sidecar(jev: Any, net: Net, factory: Path, tmp_path: Path) -> None:
    ledger = factory / "ledger" / f"250-{HEAD_SHA}.json"
    ledger.parent.mkdir(parents=True)
    ledger.write_bytes(b'{"invented": "the ledger record, untouched"}\n')
    source = findings_file(tmp_path, three_findings())
    ledger_bytes, source_bytes = ledger.read_bytes(), source.read_bytes()
    before_factory, before_in = every_file(factory), every_file(source.parent)

    net.respond = replaying("triage-3-findings")
    assert run(jev, ["triage", "--from", str(source)]) == 0
    assert ledger.read_bytes() == ledger_bytes
    assert source.read_bytes() == source_bytes
    assert every_file(source.parent) == before_in
    created = {
        name
        for name in every_file(factory) - before_factory
        if not name.startswith("jev-cache/") and name != "jev.log"
    }
    assert created == {f"ledger-jev/250-{HEAD_SHA}.json"}


def test_t17_at_most_ten_calls_are_in_flight_at_once(
    jev: Any, net: Net, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(jev, "_now", time.monotonic)
    gate = threading.Condition()
    flight = {"now": 0, "most": 0, "done": 0}
    total = 25
    answer_for = valid(p=lambda text, body: int(body["state"].split()[-1]) / 100)

    def respond(request: httpx.Request) -> httpx.Response:
        with gate:
            flight["now"] += 1
            flight["most"] = max(flight["most"], flight["now"])
            gate.notify_all()
            # Held until an eleventh caller is let in, or every caller has arrived, or a moment
            # passes: a limit above ten shows as more than ten in flight.
            gate.wait_for(lambda: flight["now"] > 10 or flight["now"] + flight["done"] >= total, 0.2)
            flight["now"] -= 1
            flight["done"] += 1
            gate.notify_all()
        return answer_for(request)

    net.respond = respond

    def call(i: int) -> Any:
        return jev.ask(f"Invented caller {i}", {"q": noul()})

    with ThreadPoolExecutor(max_workers=total) as pool:
        outcomes = list(pool.map(call, range(total)))
    assert jev.MAX_CONCURRENT == 10
    assert 1 < flight["most"] <= 10
    for i, outcome in enumerate(outcomes):
        assert isinstance(outcome, jev.Answers)
        assert number(outcome["q"]["p"]) == pytest.approx(i / 100)


def _bad_files(tmp_path: Path) -> dict[str, list[str]]:
    folder = tmp_path / "bad"
    folder.mkdir()

    def write(name: str, content: str) -> str:
        (folder / name).write_text(content)
        return str(folder / name)

    finding = three_findings()[0]
    cases = {
        "no-from": ["triage"],
        "unreadable": ["triage", "--from", str(folder / "absent.json")],
        "not-json": ["triage", "--from", write("not.json", "{not json")],
        "findings-not-a-list": [
            "triage",
            "--from",
            write("dict.json", json.dumps({"pr": 250, "head_sha": HEAD_SHA, "findings": {}})),
        ],
        "pr-not-an-int": [
            "triage",
            "--from",
            write("pr.json", json.dumps({"pr": "250", "head_sha": HEAD_SHA, "findings": [finding]})),
        ],
        "head-sha-not-40-hex": [
            "triage",
            "--from",
            write("sha.json", json.dumps({"pr": 250, "head_sha": "abc123", "findings": [finding]})),
        ],
    }
    for field in ("score", "file", "line", "summary"):
        partial = {k: v for k, v in finding.items() if k != field}
        body = json.dumps({"pr": 250, "head_sha": HEAD_SHA, "findings": [partial]})
        cases[f"finding-without-{field}"] = ["triage", "--from", write(f"no-{field}.json", body)]
    return cases


T18_CASES = [
    "no-from",
    "unreadable",
    "not-json",
    "findings-not-a-list",
    "pr-not-an-int",
    "head-sha-not-40-hex",
    "finding-without-score",
    "finding-without-file",
    "finding-without-line",
    "finding-without-summary",
]


@pytest.mark.parametrize("case", T18_CASES)
def test_t18_a_triage_usage_error_exits_64_with_no_call(
    jev: Any,
    net: Net,
    factory: Path,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    case: str,
) -> None:
    argv = _bad_files(tmp_path)[case]
    net.respond = replaying("triage-3-findings")
    code = run(jev, argv)
    captured = capsys.readouterr()
    assert code == 64
    assert captured.err.strip(), "a message on stderr"
    assert net.requests == []
    assert every_file(factory / "ledger-jev") == set()


# T19 to T21: same-issue --------------------------------------------------------------------------


def _issues_file(tmp_path: Path, issues: list[dict[str, Any]]) -> Path:
    path = tmp_path / "issues.json"
    path.write_text(json.dumps(issues))
    return path


def _by_title(table: Mapping[str, float]) -> Callable[[str, Mapping[str, Any]], float]:
    def p(instructions: str, body: Mapping[str, Any]) -> float:
        found = [value for title, value in table.items() if title in instructions]
        assert len(found) == 1, f"one issue title per question: {instructions!r}"
        return found[0]

    return p


def _same_issue(jev: Any, capsys: pytest.CaptureFixture[str], text: str, issues: Path) -> dict[str, Any]:
    code = run(jev, ["same-issue", "--text", text, "--issues", str(issues)])
    out = capsys.readouterr().out
    assert code == 0
    lines = out.strip().splitlines()
    assert len(lines) == 1, out
    result: dict[str, Any] = json.loads(lines[0])
    assert set(result) == {"decision", "issue", "p", "jev"}
    return result


def test_t19_same_issue_comments_on_the_recorded_duplicate(
    jev: Any, net: Net, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    fixture = recorded("same-issue")
    titles = [entry["title"] for entry in fixture["titles"]]
    ps = [answer["noul"] for answer in fixture["response"]["answers"].values()]
    issues = [{"number": 101 + i, "title": title} for i, title in enumerate(titles)]
    net.respond = valid(p=_by_title(dict(zip(titles, ps, strict=True))))
    result = _same_issue(jev, capsys, fixture["request"]["state"], _issues_file(tmp_path, issues))
    assert len(net.posts) == 1, "one request"
    asked = list(_asked(net.posts[0]).values())
    assert [q["type"] for q in asked] == ["noul"] * len(titles)
    best = max(range(len(ps)), key=lambda i: ps[i])
    assert result == {
        "decision": "comment",
        "issue": 101 + best,
        "p": pytest.approx(ps[best]),
        "jev": "ok",
    }


@pytest.mark.parametrize(
    ("best", "decision"),
    [(0.8, "comment"), (0.79, "possible"), (0.3, "possible"), (0.29, "new")],
)
def test_t19_same_issue_thresholds(
    jev: Any,
    net: Net,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    best: float,
    decision: str,
) -> None:
    issues = [
        {"number": 11, "title": "Invented title alpha"},
        {"number": 12, "title": "Invented title beta"},
    ]
    net.respond = valid(p=_by_title({"Invented title alpha": 0.1, "Invented title beta": best}))
    result = _same_issue(jev, capsys, "Invented defect.", _issues_file(tmp_path, issues))
    assert result["decision"] == decision
    assert result["jev"] == "ok"
    if decision != "new":
        assert result["issue"] == 12
        assert result["p"] == pytest.approx(best)


def test_t19_same_issue_with_no_issues_is_new(
    jev: Any, net: Net, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    net.respond = valid()
    result = _same_issue(jev, capsys, "Invented defect.", _issues_file(tmp_path, []))
    assert result["decision"] == "new"
    assert result["issue"] is None


@pytest.mark.parametrize("way", ["no_key", "server_error"])
def test_t20_same_issue_unavailable_is_new(
    jev: Any,
    net: Net,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    way: str,
) -> None:
    if way == "no_key":
        monkeypatch.delenv(KEY_VARIABLE)
    net.respond = status(500)
    issues = [{"number": 11, "title": "Invented title alpha"}]
    result = _same_issue(jev, capsys, "Invented defect.", _issues_file(tmp_path, issues))
    assert result == {"decision": "new", "issue": None, "p": None, "jev": "unavailable"}


def test_t21_an_over_limit_issue_list_is_chunked_or_refused_never_cut(
    jev: Any, net: Net, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    count, target = 600, 377
    issues = [
        {"number": 1000 + i, "title": f"Invented issue T{i:04d} about the quote form saving twice"}
        for i in range(count)
    ]

    def p(instructions: str, body: Mapping[str, Any]) -> float:
        found = re.findall(r"T(\d{4})", instructions)
        assert len(found) == 1
        return 0.91 if int(found[0]) == target else 0.05

    net.respond = valid(p=p)
    result = _same_issue(jev, capsys, "Invented defect.", _issues_file(tmp_path, issues))
    if not net.requests:  # cut for budget: refused whole
        assert result == {"decision": "new", "issue": None, "p": None, "jev": "unavailable"}
        return
    limit = jev_settings.VEXTRUS_JEV_MAX_REQUEST_BYTES
    asked: list[str] = []
    for request in net.posts:
        assert len(request.content) <= limit
        for question in _asked(request).values():
            asked += re.findall(r"T(\d{4})", question["instructions"])
    assert sorted(asked) == [f"{i:04d}" for i in range(count)], "every issue asked exactly once"
    assert result == {
        "decision": "comment",
        "issue": 1000 + target,
        "p": pytest.approx(0.91),
        "jev": "ok",
    }


# T22 to T27: models-check ------------------------------------------------------------------------

LISTED_DATE = "2026-09-10T18:38:01.391457+00:00"


@pytest.fixture
def pins(tmp_path: Path) -> Path:
    path = tmp_path / "jev-nodes.md"
    path.write_text(
        "# Invented pins\n\n| node | model | right / checked |\n|---|---|---|\n"
        "| sheet_type | jev-1.13.0 | 26 / 32 |\n"
    )
    return path


def _check(jev: Any, capsys: pytest.CaptureFixture[str], *argv: str) -> tuple[Any, list[str]]:
    code = run(jev, ["models-check", *argv])
    return code, capsys.readouterr().out.strip().splitlines()


def test_t22_models_check_reports_the_pinned_version(
    jev: Any, net: Net, factory: Path, pins: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    net.respond = models_api()
    code, lines = _check(jev, capsys, "--pin-file", str(pins))
    assert lines == ["jev-model ok jev-1.13.0"]
    assert code == 0
    assert len(net.posts) == 1
    body = json.loads(net.posts[0].content)
    assert body["model"] == "jev-latest"
    assert [q["type"] for q in body["questions"].values()] == ["noul"]
    assert [str(r.url) for r in net.requests if r.method == "GET"] == [MODELS_URL]
    assert (factory / "jev-models.json").is_file()
    assert LISTED_DATE in (factory / "jev-models.json").read_text()


def test_t23_a_moved_version_is_the_one_alarm_line_and_exit_1(
    jev: Any, net: Net, pins: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    net.respond = models_api(model="jev-1.14.0")
    code, lines = _check(jev, capsys, "--pin-file", str(pins))
    assert lines == ["JEV-MODEL-MOVED jev-1.13.0 -> jev-1.14.0"]
    assert code == 1


def test_t23_every_run_asks_afresh_rather_than_from_the_cache(
    jev: Any, net: Net, pins: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    net.respond = models_api()
    assert _check(jev, capsys, "--pin-file", str(pins)) == (0, ["jev-model ok jev-1.13.0"])
    net.respond = models_api(model="jev-1.14.0")
    assert _check(jev, capsys, "--pin-file", str(pins)) == (
        1,
        ["JEV-MODEL-MOVED jev-1.13.0 -> jev-1.14.0"],
    )
    assert len(net.posts) == 2


def test_t24_a_changed_release_date_is_an_alarm_then_recorded(
    jev: Any, net: Net, pins: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    moved = "2026-10-01T09:00:00+00:00"
    net.respond = models_api()
    assert _check(jev, capsys, "--pin-file", str(pins)) == (0, ["jev-model ok jev-1.13.0"])
    net.respond = models_api(release_date=moved)
    assert _check(jev, capsys, "--pin-file", str(pins)) == (
        1,
        [f"JEV-MODEL-MOVED release-date {LISTED_DATE} -> {moved}"],
    )
    assert _check(jev, capsys, "--pin-file", str(pins)) == (0, ["jev-model ok jev-1.13.0"])


def test_t25_a_factory_call_answered_by_another_version_is_an_alarm(
    jev: Any, net: Net, pins: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A call logged after the last check (in the same second included) is read."""
    net.respond = models_api()
    assert _check(jev, capsys, "--pin-file", str(pins)) == (0, ["jev-model ok jev-1.13.0"])
    net.respond = valid(model="jev-1.14.0")
    answered = jev.ask(
        "Invented text.", {"q": noul()}, model="jev-latest", task="triage", client=net.client()
    )
    assert isinstance(answered, jev.Answers), "an alias accepts any version"
    assert answered.model == "jev-1.14.0"
    net.respond = models_api()
    assert _check(jev, capsys, "--pin-file", str(pins)) == (
        1,
        ["JEV-MODEL-MOVED jev-1.13.0 -> jev-1.14.0"],
    )


@pytest.mark.parametrize("way", ["no_key", "failed"])
def test_t26_models_check_unavailable_exits_2_and_changes_nothing(
    jev: Any,
    net: Net,
    factory: Path,
    pins: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    way: str,
) -> None:
    net.respond = models_api()
    assert _check(jev, capsys, "--pin-file", str(pins)) == (0, ["jev-model ok jev-1.13.0"])
    stored = (factory / "jev-models.json").read_bytes()
    if way == "no_key":
        monkeypatch.delenv(KEY_VARIABLE)
    net.respond = status(500)
    assert _check(jev, capsys, "--pin-file", str(pins)) == (2, [f"unavailable {way}"])
    assert (factory / "jev-models.json").read_bytes() == stored


@pytest.mark.parametrize(
    ("seen", "expected"),
    [
        ("jev-1.13.0", (0, ["jev-model ok jev-1.13.0"])),
        ("jev-1.14.0", (1, ["JEV-MODEL-MOVED jev-1.13.0 -> jev-1.14.0"])),
    ],
)
def test_t27_the_pins_are_read_from_the_committed_nodes_table_from_any_cwd(
    jev: Any,
    net: Net,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    seen: str,
    expected: tuple[int, list[str]],
) -> None:
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    monkeypatch.chdir(elsewhere)
    net.respond = models_api(model=seen)
    assert _check(jev, capsys) == expected


# T28: the command line by subprocess -------------------------------------------------------------


def test_t28_the_command_line_runs_from_any_cwd_with_no_key_and_no_network(tmp_path: Path) -> None:
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    env = {
        **os.environ,
        KEY_VARIABLE: "",
        "VEXTRUS_FACTORY_DIR": str(tmp_path / "factory"),
        "PYTHONPATH": str(REPO),
        "HTTPS_PROXY": "http://127.0.0.1:9",
        "HTTP_PROXY": "http://127.0.0.1:9",
    }

    def cli(*argv: str) -> tuple[subprocess.CompletedProcess[str], float]:
        start = time.monotonic()
        done = subprocess.run(
            [sys.executable, "-m", MODULE, *argv],
            cwd=elsewhere,
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        return done, time.monotonic() - start

    helped, _ = cli("--help")
    assert helped.returncode == 0, helped.stderr
    for name in ("triage", "same-issue", "models-check"):
        assert name in helped.stdout

    triaged, took = cli("triage", "--from", str(findings_file(tmp_path, three_findings())))
    assert (triaged.returncode, triaged.stdout.strip()) == (0, "unavailable no_key"), triaged.stderr
    assert took < 2.0
    assert not (tmp_path / "factory" / "ledger-jev").exists() or not any(
        (tmp_path / "factory" / "ledger-jev").iterdir()
    )

    for unknown in ("frobnicate", "ask"):
        refused, _ = cli(unknown)
        assert refused.returncode == 64, (unknown, refused.stdout, refused.stderr)
