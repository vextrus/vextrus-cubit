"""The factory's Jev client (ticket f9; the contract: docs/specs/factory/contracts/jev-cli.md).

Jev is a function scripts call, never an agent, a reviewer or a gate: it advises, sorts and routes,
and the guard, `merge_ready`, the ledger and the leak wall still decide. Every outcome that is not an
answer is `Unavailable`, and every caller then runs exactly as it would without Jev.

`ask` is the Python function; the command line has three subcommands, all advisory:

    uv run python -m scripts.factory.jev triage --from <findings.json>
    uv run python -m scripts.factory.jev same-issue --text <text> --issues <issues.json>
    uv run python -m scripts.factory.jev models-check [--pin-file <jev-nodes.md>]

The constants are the product's (`vextrus.settings.jev`); the product's own client is tenant-bound
and is not used here. The key is read from the environment at call time into the request's header
and nowhere else: never logged, printed, cached or put in an error. The cache, the log, the triage
sidecars and the model watch's record live under `VEXTRUS_FACTORY_DIR` (default
`.private/work/factory` in the repository).
"""

import argparse
import contextlib
import hashlib
import json
import os
import re
import sys
import tempfile
import threading
import time
from collections.abc import Callable, Iterator, Mapping
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from pathlib import Path
from typing import Any, NoReturn

import httpx

from vextrus.settings import jev as settings

MAX_CONCURRENT = 10
"""At most this many calls are in flight at once across the process (contract 1)."""
DEFAULT_MODEL = "jev-1.13.0"
ALIASES = frozenset({"jev-latest", "jev-preview"})
"""Model names that stand for whichever version TypeSafe serves; only `models-check` asks them."""
VERSION = re.compile(r"jev-\d+\.\d+\.\d+")

REPO = Path(__file__).resolve().parents[2]
PIN_FILE = REPO / "docs" / "knowledge" / "jev-nodes.md"
FACTORY_VARIABLE = "VEXTRUS_FACTORY_DIR"

USAGE = 64
"""The exit code of a usage error, for every subcommand (contract 2)."""

SEVERITIES = ("low", "medium", "high", "critical")
LEVELS = (
    "low: style, naming or a comment; no behaviour changes",
    (
        "medium: wrong behaviour in an uncommon path, or a missing test for a real path; "
        "no data loss or exposure"
    ),
    "high: wrong output, crash or data loss on a normal path, or a check that can be skipped",
    "critical: a secret or private data exposed, a security wall bypassed, or data destroyed",
)
"""The four severity levels triage asks, in order; the sidecar names them by their first word."""

COMMENT_AT = 0.8
POSSIBLE_AT = 0.3
"""`same-issue`'s thresholds on the best P(same defect) (contract 2)."""

# Seams for tests: called through the module, so a test can replace them.
_now: Callable[[], float] = time.monotonic
_sleep: Callable[[float], None] = time.sleep

_BEARER = re.compile(r"[\x21-\x7e]+")
_HEX40 = re.compile(r"[0-9a-f]{40}")
_DATE = re.compile(r"[0-9A-Za-z:.+\-]{1,64}")
_LABEL = re.compile(r"[^A-Za-z0-9_.:\-]")
_DEEPEST = 8
_LONGEST_NUMBER = 40


class Why(StrEnum):
    """Why Jev did not answer: the contract's closed list (the product's `Why`)."""

    BAD_QUESTION = "bad_question"
    NO_KEY = "no_key"
    COOLING_OFF = "cooling_off"
    TOO_LARGE = "too_large"
    TIMED_OUT = "timed_out"
    UNREACHABLE = "unreachable"
    BUSY = "busy"
    KEY_REFUSED = "key_refused"
    REQUEST_REFUSED = "request_refused"
    FAILED = "failed"
    OVERSIZED = "oversized"
    MALFORMED = "malformed"


_OUTAGES = frozenset(
    {Why.TIMED_OUT, Why.BUSY, Why.FAILED, Why.UNREACHABLE, Why.MALFORMED, Why.OVERSIZED}
)
"""The failures that say TypeSafe is unwell, so count toward the cool-off. A refusal (no key, too
large, a bad question, a refused key or request) says nothing of its health."""


@dataclass(frozen=True)
class Unavailable:
    """Jev did not answer; the caller runs as without Jev. Nothing was cached."""

    why: Why


class Answers(Mapping[str, dict[str, Any]]):
    """Question name to its validated answer: a noul `{"p"}`; a choice `{"choice", "probabilities",
    "confidence"}`; a score `{"score", "legend", "probabilities", "confidence"}`. Also the model the
    response named, the tokens it counted and how long the call took."""

    def __init__(
        self,
        answers: Mapping[str, dict[str, Any]],
        *,
        model: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: int,
    ) -> None:
        self._answers = dict(answers)
        self.model = model
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.latency_ms = latency_ms

    def __getitem__(self, name: str) -> dict[str, Any]:
        return self._answers[name]

    def __iter__(self) -> Iterator[str]:
        return iter(self._answers)

    def __len__(self) -> int:
        return len(self._answers)

    def __repr__(self) -> str:
        return f"<Answers {sorted(self._answers)} model={self.model} latency_ms={self.latency_ms}>"


# Where things are kept ----------------------------------------------------------------------------


def factory_dir() -> Path:
    named = os.environ.get(FACTORY_VARIABLE, "").strip()
    return Path(named) if named else REPO / ".private" / "work" / "factory"


def _utc() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _write_atomically(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=".", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="ascii") as file:
            file.write(text)
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


_log_lock = threading.Lock()


def _log(task: str, model: object, outcome: Answers | Unavailable, latency_ms: int, hit: bool) -> None:
    """One line per `ask` in `jev.log`: ids and numbers only, never the state, a question or the key."""
    if isinstance(outcome, Answers):
        shown, status, tokens = outcome.model, "ok", 0 if hit else outcome.input_tokens
    else:
        shown = model if isinstance(model, str) else "unknown"
        status, tokens = f"unavailable:{outcome.why.value}", 0
    line = (
        f"{_utc()} task={_label(task)} model={_label(shown)} status={status} "
        f"latency_ms={latency_ms} input_tokens={tokens} cache={'hit' if hit else 'miss'}\n"
    )
    path = factory_dir() / "jev.log"
    try:
        with _log_lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="ascii") as file:
                file.write(line)
    except OSError:
        pass  # the log is a record, never a reason to fail a call


def _label(value: str) -> str:
    return _LABEL.sub("_", value)[:64] or "unknown"


# The cool-off and the concurrency limit ------------------------------------------------------------


class _Health:
    """Failures in a row across the process; after `VEXTRUS_JEV_COOL_OFF_AFTER` of them, every call is
    `cooling_off` for `VEXTRUS_JEV_COOL_OFF_SECONDS`, then one call tries again."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._failures = 0
        self._until: float | None = None

    def cooling(self) -> bool:
        with self._lock:
            return self._until is not None and _now() < self._until

    def failed(self, why: Why) -> None:
        if why not in _OUTAGES:
            return
        with self._lock:
            self._failures += 1
            if self._failures >= settings.VEXTRUS_JEV_COOL_OFF_AFTER:
                self._until = _now() + settings.VEXTRUS_JEV_COOL_OFF_SECONDS

    def succeeded(self) -> None:
        with self._lock:
            self._failures, self._until = 0, None


_health = _Health()
_slots = threading.BoundedSemaphore(MAX_CONCURRENT)


# Questions out, answers in ------------------------------------------------------------------------


def _texts(value: object, least: int, most: int) -> bool:
    return (
        isinstance(value, (list, tuple))
        and least <= len(value) <= most
        and all(isinstance(text, str) and text.strip() for text in value)
    )


def _wire_question(question: object) -> dict[str, Any] | None:
    """A contract question in the API's wire shape (`kind` -> `type`, `text` -> `instructions`,
    `options` or `levels` -> `criteria`); None when the client cannot send it."""
    if not isinstance(question, Mapping):
        return None
    kind, text = question.get("kind"), question.get("text")
    if not isinstance(text, str) or not text.strip():
        return None
    sent: dict[str, Any] = {"type": kind, "instructions": text}
    if kind == "noul":
        if set(question) - {"kind", "text", "criteria"}:
            return None
        if "criteria" in question:
            criteria = question["criteria"]
            if not (
                isinstance(criteria, Mapping)
                and set(criteria) == {"true", "false"}
                and all(isinstance(v, str) and v.strip() for v in criteria.values())
            ):
                return None
            sent["criteria"] = {"true": criteria["true"], "false": criteria["false"]}
    elif kind == "choice":
        options = question.get("options")
        if set(question) != {"kind", "text", "options"} or not (
            isinstance(options, Mapping)
            and 2 <= len(options) <= 255
            and all(isinstance(k, str) and k and isinstance(v, str) for k, v in options.items())
        ):
            return None
        sent["criteria"] = dict(options)
    elif kind == "score":
        levels = question.get("levels")
        if set(question) != {"kind", "text", "levels"} or not isinstance(levels, (list, tuple)):
            return None
        if not _texts(levels, 2, 10):
            return None
        sent["criteria"] = list(levels)
    else:
        return None
    return sent


def _encode(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode("ascii")


@dataclass(frozen=True)
class _Call:
    model: str
    names: tuple[str, ...]
    wire: dict[str, dict[str, Any]]
    body: bytes
    digest: str

    def __repr__(self) -> str:  # never the state
        return f"<_Call {self.model} {len(self.names)} questions>"


def _prepare(state: object, questions: object, model: object) -> _Call | Unavailable:
    if not isinstance(model, str) or not (model in ALIASES or VERSION.fullmatch(model)):
        return Unavailable(Why.BAD_QUESTION)
    if (
        not isinstance(state, (str, Mapping, list))
        or not isinstance(questions, Mapping)
        or not questions
    ):
        return Unavailable(Why.BAD_QUESTION)
    names: list[str] = []
    wire: dict[str, dict[str, Any]] = {}
    for index, (name, question) in enumerate(questions.items()):
        sent = _wire_question(question)
        if not isinstance(name, str) or sent is None:
            return Unavailable(Why.BAD_QUESTION)
        names.append(name)
        wire[f"q{index}"] = sent
    try:
        canonical = json.dumps(
            {"state": state, "questions": questions, "model": model},
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
        )
        body = _encode({"model": model, "state": state, "questions": wire})
    except TypeError, ValueError:
        return Unavailable(Why.BAD_QUESTION)
    if len(body) > settings.VEXTRUS_JEV_MAX_REQUEST_BYTES:
        return Unavailable(Why.TOO_LARGE)  # refused whole, never cut
    digest = hashlib.sha256(canonical.encode("ascii")).hexdigest()
    return _Call(model, tuple(names), wire, body, digest)


class _Refused(ValueError):
    pass


def _refuse_constant(name: str) -> Any:
    raise _Refused(f"{name} is not a number JSON allows")


def _decimal(text: str) -> Decimal:
    if len(text) > _LONGEST_NUMBER:
        raise _Refused("a number too long")
    try:
        return Decimal(text)
    except ArithmeticError:
        raise _Refused("a number out of range") from None


def _integer(text: str) -> int:
    if len(text) > _LONGEST_NUMBER:
        raise _Refused("a number too long")
    return int(text)


def _no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    found: dict[str, Any] = {}
    for key, value in pairs:
        if key in found:
            raise _Refused("a key appears twice")
        found[key] = value
    return found


def _nests_deeper_than(text: str, most: int) -> bool:
    depth = 0
    quoted = escaped = False
    for char in text:
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char in "[{":
            depth += 1
            if depth > most:
                return True
        elif char in "]}":
            depth -= 1
    return False


def _strict_json(text: str) -> Any:
    """JSON with no NaN or Infinity, no duplicate key, no overlong number and no deep nesting; every
    fraction a `Decimal`. Anything else raises `ValueError` (as the product's client reads)."""
    if _nests_deeper_than(text, _DEEPEST):
        raise _Refused("nested too deep")
    return json.loads(
        text,
        parse_float=_decimal,
        parse_int=_integer,
        parse_constant=_refuse_constant,
        object_pairs_hook=_no_duplicates,
    )


def _real(value: object) -> float | None:
    """A finite number (an int or a Decimal, never a bool or a string) as a float."""
    if type(value) is int or (type(value) is Decimal and value.is_finite()):
        return float(value)
    return None


def _unit(value: object) -> float | None:
    number = _real(value)
    return abs(number) if number is not None and 0 <= number <= 1 else None


def _units(value: object, keys: set[str]) -> dict[str, float] | None:
    if not isinstance(value, dict) or set(value) != keys:
        return None
    read = {key: _unit(p) for key, p in value.items()}
    return None if any(p is None for p in read.values()) else read  # type: ignore[return-value]


def _answer(answer: object, question: Mapping[str, Any]) -> dict[str, Any] | None:
    """The answer to one wire question in the client's shape; None when it does not answer it."""
    kind = question["type"]
    if not isinstance(answer, dict) or answer.get("type") != kind:
        return None
    if kind == "noul":
        p = _unit(answer.get("noul"))
        return None if p is None else {"p": p}
    confidence = _unit(answer.get("confidence"))
    if confidence is None:
        return None
    if kind == "choice":
        options = set(question["criteria"])
        choice = answer.get("choice")
        probabilities = _units(answer.get("probabilities"), options)
        if not isinstance(choice, str) or choice not in options or probabilities is None:
            return None
        return {"choice": choice, "probabilities": probabilities, "confidence": confidence}
    count = len(question["criteria"])
    indexes = {str(i) for i in range(count)}
    legend = answer.get("legend")
    probabilities = _units(answer.get("probabilities"), indexes)
    score = _real(answer.get("score"))
    if (
        not isinstance(legend, dict)
        or set(legend) != indexes
        or not all(isinstance(text, str) for text in legend.values())
        or probabilities is None
        or score is None
        or not 0 <= score <= count - 1
    ):
        return None
    return {
        "score": score,
        "legend": dict(legend),
        "probabilities": probabilities,
        "confidence": confidence,
    }


def _wire_answer(kind: str, answer: Mapping[str, Any]) -> dict[str, Any]:
    if kind == "noul":
        return {"type": "noul", "noul": answer["p"]}
    return {"type": kind, **answer}


def _validated(data: object, call: _Call) -> tuple[dict[str, dict[str, Any]], str, int, int] | None:
    """The answers by question name, the model, input and output tokens; None unless `data` answers
    exactly what `call` asked."""
    if not isinstance(data, dict):
        return None
    seen = data.get("model")
    if not isinstance(seen, str):
        return None
    if (call.model in ALIASES and not VERSION.fullmatch(seen)) or (
        call.model not in ALIASES and seen != call.model
    ):
        return None
    answers, usage = data.get("answers"), data.get("usage", {})
    if not isinstance(answers, dict) or set(answers) != set(call.wire) or not isinstance(usage, dict):
        return None
    tokens = (usage.get("input_tokens", 0), usage.get("output_tokens", 0))
    if any(type(n) is not int or n < 0 for n in tokens):
        return None
    named: dict[str, dict[str, Any]] = {}
    for (wire_id, question), name in zip(call.wire.items(), call.names, strict=True):
        read = _answer(answers[wire_id], question)
        if read is None:
            return None
        named[name] = read
    return named, seen, tokens[0], tokens[1]


def _record(call: _Call, answers: Answers) -> str:
    """What the cache keeps: the validated response in the API's shape (no state, no key)."""
    wire_answers = {
        wire_id: _wire_answer(question["type"], answers[name])
        for (wire_id, question), name in zip(call.wire.items(), call.names, strict=True)
    }
    usage = {"input_tokens": answers.input_tokens, "output_tokens": answers.output_tokens}
    return json.dumps({"model": answers.model, "answers": wire_answers, "usage": usage}, allow_nan=False)


def _from_cache(path: Path, call: _Call) -> Answers | None:
    """A cached answer, read as strictly as a fresh one; anything unreadable is a miss."""
    try:
        validated = _validated(_strict_json(path.read_text(encoding="ascii")), call)
    except OSError, ValueError, UnicodeDecodeError, RecursionError:
        return None
    if validated is None:
        return None
    named, model, input_tokens, output_tokens = validated
    return Answers(
        named, model=model, input_tokens=input_tokens, output_tokens=output_tokens, latency_ms=0
    )


# The network --------------------------------------------------------------------------------------


def _key() -> str | None:
    value = os.environ.get(settings.VEXTRUS_JEV_KEY_VARIABLE, "").strip()
    return value if _BEARER.fullmatch(value) else None


def _url(path: str | None = None) -> httpx.URL | None:
    """TypeSafe's endpoint (or another path on its host), read at call time; None unless https."""
    try:
        url = httpx.URL(settings.VEXTRUS_JEV_URL)
    except httpx.InvalidURL:
        return None
    if url.scheme != "https" or not url.host:
        return None
    return url if path is None else url.copy_with(path=path, query=None)


def _timeout(left: float) -> httpx.Timeout:
    connect = min(settings.VEXTRUS_JEV_CONNECT_SECONDS, left)
    read = min(settings.VEXTRUS_JEV_READ_SECONDS, left)
    return httpx.Timeout(connect=connect, read=read, write=read, pool=connect)


def _retry_after(value: str | None) -> float:
    if value is None or not value.strip().isdecimal():
        return 0.0
    return float(value.strip())


def _read(response: httpx.Response, deadline: float) -> bytes | Why:
    """The body within the response cap and the deadline (bytes counted, not the header believed)."""
    if response.headers.get("content-encoding", "identity").strip().lower() != "identity":
        return Why.MALFORMED
    cap = settings.VEXTRUS_JEV_MAX_RESPONSE_BYTES
    length = response.headers.get("content-length", "0").strip()
    if not length.isdecimal():
        return Why.MALFORMED
    if int(length) > cap:
        return Why.OVERSIZED
    body = bytearray()
    for chunk in response.iter_bytes():
        body += chunk
        if len(body) > cap:
            return Why.OVERSIZED
        if _now() > deadline:
            return Why.TIMED_OUT
    return bytes(body)


def _send(
    http: httpx.Client, method: str, url: httpx.URL, key: str, deadline: float, body: bytes | None
) -> bytes | Why:
    """The answer's body, trying again after 429, 529 or a dropped connection while the deadline
    allows (pauses from `VEXTRUS_JEV_BACKOFF_SECONDS`, doubling to the maximum); else why not. No
    error's text is kept: an error may carry the request's headers."""
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Accept-Encoding": "identity",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    pause = settings.VEXTRUS_JEV_BACKOFF_SECONDS
    while True:
        left = deadline - _now()
        if left <= 0:
            return Why.TIMED_OUT
        wait_at_least = 0.0
        try:
            with http.stream(
                method, url, content=body, headers=headers, timeout=_timeout(left)
            ) as response:
                code = response.status_code
                if code == 200:
                    return _read(response, deadline)
                if code in (429, 529):
                    why = Why.BUSY
                    wait_at_least = _retry_after(response.headers.get("retry-after"))
                elif code in (401, 403):
                    return Why.KEY_REFUSED
                elif 400 <= code < 500:
                    return Why.REQUEST_REFUSED
                else:
                    return Why.FAILED
        except httpx.TimeoutException:
            return Why.TIMED_OUT
        except httpx.ConnectError, httpx.ReadError, httpx.WriteError, httpx.RemoteProtocolError:
            why = Why.UNREACHABLE
        except httpx.HTTPError:
            return Why.FAILED
        wait = max(pause, wait_at_least)
        if _now() + wait >= deadline:
            return why  # a longer wait than the deadline leaves is not waited
        _sleep(wait)
        pause = min(pause * 2, settings.VEXTRUS_JEV_BACKOFF_MAX_SECONDS)


def _exchange(
    client: httpx.Client | None, method: str, url: httpx.URL, key: str, body: bytes | None
) -> tuple[bytes | Why, float]:
    """One call inside the concurrency limit and the deadline: the body (or why not) and the seconds
    it took. Closes the client it opens; never raises."""
    owned: httpx.Client | None = None
    start = _now()
    try:
        with _slots:
            start = _now()
            http = client
            if http is None:
                owned = http = httpx.Client(follow_redirects=False)
            outcome = _send(http, method, url, key, start + settings.VEXTRUS_JEV_DEADLINE_SECONDS, body)
    except Exception:  # nothing TypeSafe sends may raise into the caller
        outcome = Why.FAILED
    finally:
        if owned is not None:
            owned.close()
    return outcome, _now() - start


def _ask(
    state: object, questions: object, model: object, client: httpx.Client | None, cache: bool
) -> tuple[Answers | Unavailable, bool]:
    call = _prepare(state, questions, model)
    if isinstance(call, Unavailable):
        return call, False
    url = _url()
    if url is None:
        return Unavailable(Why.FAILED), False
    path = factory_dir() / "jev-cache" / f"{call.digest}.json"
    if cache:
        cached = _from_cache(path, call)
        if cached is not None:
            return cached, True
    key = _key()
    if key is None:
        return Unavailable(Why.NO_KEY), False
    if _health.cooling():
        return Unavailable(Why.COOLING_OFF), False
    body, took = _exchange(client, "POST", url, key, call.body)
    validated: tuple[dict[str, dict[str, Any]], str, int, int] | None = None
    if not isinstance(body, Why):
        try:
            validated = _validated(_strict_json(body.decode("utf-8")), call)
        except ValueError, UnicodeDecodeError, RecursionError:
            validated = None
        if validated is None:
            body = Why.MALFORMED
    if isinstance(body, Why) or validated is None:
        why = body if isinstance(body, Why) else Why.MALFORMED
        _health.failed(why)
        return Unavailable(why), False
    _health.succeeded()
    named, seen, input_tokens, output_tokens = validated
    answers = Answers(
        named,
        model=seen,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=round(took * 1000),
    )
    if cache:
        with contextlib.suppress(OSError):  # the cache saves a call; losing it costs one
            _write_atomically(path, _record(call, answers))
    return answers, False


def ask(
    state: object,
    questions: object,
    *,
    model: str = DEFAULT_MODEL,
    task: str = "ask",
    client: httpx.Client | None = None,
    cache: bool = True,
) -> Answers | Unavailable:
    """Ask Jev `questions` (name to a contract question) over `state`; `Unavailable` within the
    deadline when it does not answer, never an exception.

    A cache hit returns without a key and without a call; `cache=False` asks afresh (the model
    watch). `task` labels the log line; `client` is an optional `httpx.Client` (the module opens and
    closes its own otherwise)."""
    start = _now()
    try:
        outcome, hit = _ask(state, questions, model, client, cache)
    except Exception:
        outcome, hit = Unavailable(Why.FAILED), False
    latency = (
        outcome.latency_ms
        if isinstance(outcome, Answers) and not hit
        else round((_now() - start) * 1000)
    )
    _log(task, model, outcome, max(latency, 0), hit)
    return outcome


# The command line ---------------------------------------------------------------------------------


class _UsageError(Exception):
    pass


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> NoReturn:
        self.print_usage(sys.stderr)
        sys.stderr.write(f"{self.prog}: {message}\n")
        raise SystemExit(USAGE)


def _read_json(path: str, what: str) -> Any:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except OSError:
        raise _UsageError(f"{what}: cannot read the file") from None
    except ValueError:
        raise _UsageError(f"{what}: not JSON") from None


def _integer_field(value: object) -> bool:
    return type(value) is int


def _findings(source: str) -> tuple[int, str, list[dict[str, Any]]]:
    data = _read_json(source, "--from")
    if not isinstance(data, dict):
        raise _UsageError("--from: not a JSON object")
    pr, head_sha, findings = data.get("pr"), data.get("head_sha"), data.get("findings")
    if not _integer_field(pr):
        raise _UsageError("--from: pr is not an integer")
    if not isinstance(head_sha, str) or not _HEX40.fullmatch(head_sha):
        raise _UsageError("--from: head_sha is not 40 lower-case hex characters")
    if not isinstance(findings, list):
        raise _UsageError("--from: findings is not a list")
    for index, finding in enumerate(findings):
        if not (
            isinstance(finding, dict)
            and _integer_field(finding.get("score"))
            and isinstance(finding.get("file"), str)
            and _integer_field(finding.get("line"))
            and isinstance(finding.get("summary"), str)
        ):
            raise _UsageError(f"--from: finding {index} lacks score, file, line or summary")
    return pr, head_sha, findings  # type: ignore[return-value]


def _severity(probabilities: Mapping[str, float]) -> str:
    best = max(range(len(SEVERITIES)), key=lambda i: (probabilities[str(i)], -i))
    return SEVERITIES[best]


def triage(source: str) -> int:
    """J-b, in shadow: P(real) and severity per finding, one call per file, to the sidecar beside
    the refuter's verdict. Advice only: it never drops a finding and never decides."""
    pr, head_sha, findings = _findings(source)
    if not findings:
        print(f"triage {pr} {head_sha[:8]} 0 findings")
        return 0
    state = {
        "about": "Review findings on one pull request's diff; each question names a finding by index.",
        "findings": [
            {
                "index": i,
                "file": f["file"],
                "line": f["line"],
                "score": f["score"],
                "summary": f["summary"],
            }
            for i, f in enumerate(findings)
        ],
    }
    questions: dict[str, dict[str, Any]] = {}
    for i in range(len(findings)):
        questions[f"real_{i}"] = {
            "kind": "noul",
            "text": f"Is finding {i} real: a true defect in the code it names?",
        }
        questions[f"severity_{i}"] = {
            "kind": "score",
            "text": f"How severe is finding {i}, if it is real?",
            "levels": list(LEVELS),
        }
    answered = ask(state, questions, task="triage")
    if isinstance(answered, Unavailable):
        print(f"unavailable {answered.why.value}")
        return 0
    sidecar = {
        "schema_version": 1,
        "pr": pr,
        "head_sha": head_sha,
        "model": answered.model,
        "written_at": _utc(),
        "findings": [
            {
                "index": i,
                "p_real": answered[f"real_{i}"]["p"],
                "severity": _severity(answered[f"severity_{i}"]["probabilities"]),
            }
            for i in range(len(findings))
        ],
    }
    path = factory_dir() / "ledger-jev" / f"{pr}-{head_sha}.json"
    _write_atomically(path, json.dumps(sidecar, allow_nan=False) + "\n")
    print(f"triage {pr} {head_sha[:8]} {len(findings)} findings")
    return 0


def _same_question(title: str) -> dict[str, str]:
    return {"kind": "noul", "text": f"Is the defect described the same defect as: {title}"}


def _chunks(text: str, titles: list[str]) -> list[list[int]] | None:
    """The issue indexes split so each request stays within the limit; None when one title alone
    does not fit (the list is then refused whole, never cut)."""
    limit = settings.VEXTRUS_JEV_MAX_REQUEST_BYTES
    try:
        base = len(_encode({"model": DEFAULT_MODEL, "state": text, "questions": {}}))
    except ValueError:
        return None
    chunks: list[list[int]] = []
    current: list[int] = []
    size = base
    for index, title in enumerate(titles):
        question = _encode(_wire_question(_same_question(title)))
        cost = len(_encode(f"q{len(current)}")) + 1 + len(question) + (1 if current else 0)
        if current and size + cost > limit:
            chunks.append(current)
            current, size = [], base
            cost = len(_encode("q0")) + 1 + len(question)
        if size + cost > limit:
            return None
        current.append(index)
        size += cost
    if current:
        chunks.append(current)
    return chunks


def _issues(path: str) -> list[tuple[int, str]]:
    data = _read_json(path, "--issues")
    if not isinstance(data, list):
        raise _UsageError("--issues: not a JSON list")
    issues: list[tuple[int, str]] = []
    for index, entry in enumerate(data):
        if not (
            isinstance(entry, dict)
            and _integer_field(entry.get("number"))
            and isinstance(entry.get("title"), str)
            and entry["title"].strip()
        ):
            raise _UsageError(f"--issues: entry {index} lacks a number or a title")
        issues.append((entry["number"], entry["title"]))
    return issues


def same_issue(text: str, issues_path: str) -> int:
    """J-d: whether a defect is one of the open issues, by one noul per issue title. `Unavailable`
    prints `new` with `"jev": "unavailable"`, so the caller opens a new issue as without Jev."""
    issues = _issues(issues_path)
    unavailable = {"decision": "new", "issue": None, "p": None, "jev": "unavailable"}
    if not issues:
        print(json.dumps({"decision": "new", "issue": None, "p": None, "jev": "ok"}))
        return 0
    chunks = _chunks(text, [title for _, title in issues])
    if chunks is None:
        print(json.dumps(unavailable))
        return 0

    def asked(chunk: list[int]) -> Answers | Unavailable:
        questions = {f"issue_{i}": _same_question(issues[i][1]) for i in chunk}
        return ask(text, questions, task="same-issue")

    with ThreadPoolExecutor(max_workers=min(MAX_CONCURRENT, len(chunks))) as pool:
        outcomes = list(pool.map(asked, chunks))
    best: tuple[float, int] | None = None
    for chunk, outcome in zip(chunks, outcomes, strict=True):
        if isinstance(outcome, Unavailable):
            print(json.dumps(unavailable))
            return 0
        for i in chunk:
            p = float(outcome[f"issue_{i}"]["p"])
            if best is None or p > best[0]:
                best = (p, i)
    assert best is not None
    p, index = best
    decision = "comment" if p >= COMMENT_AT else "possible" if p >= POSSIBLE_AT else "new"
    issue = issues[index][0] if decision != "new" else None
    print(json.dumps({"decision": decision, "issue": issue, "p": p, "jev": "ok"}))
    return 0


def read_pins(path: Path) -> set[str]:
    """Every `jev-<n>.<n>.<n>` in the `model` column of the Markdown tables in `path`."""
    pins: set[str] = set()
    column: int | None = None
    in_table = False
    for line in path.read_text(encoding="utf-8").splitlines():
        row = line.strip()
        if not row.startswith("|"):
            in_table, column = False, None
            continue
        cells = [cell.strip().strip("`") for cell in row.strip("|").split("|")]
        if not in_table:
            in_table = True
            column = cells.index("model") if "model" in cells else None
            continue
        if column is not None and column < len(cells):
            pins.update(VERSION.findall(cells[column]))
    return pins


_WATCH_STATE = "Invented text: the sky is blue on a clear day."
_WATCH_QUESTION = {"kind": "noul", "text": "Is this sentence about the weather or the sky?"}
_LOGGED = re.compile(r"^(?P<ts>\S+) task=\S+ model=(?P<model>\S+) status=ok ")


def _release_date(key: str | None) -> str | Why:
    """`jev-latest`'s release date from `GET /v1/models` (the list names only aliases)."""
    url = _url("/v1/models")
    if url is None:
        return Why.FAILED
    if key is None:
        return Why.NO_KEY
    body, _took = _exchange(None, "GET", url, key, None)
    if isinstance(body, Why):
        return body
    try:
        data = _strict_json(body.decode("utf-8"))
    except ValueError, UnicodeDecodeError, RecursionError:
        return Why.MALFORMED
    models = data.get("models") if isinstance(data, dict) else None
    if not isinstance(models, list):
        return Why.MALFORMED
    for entry in models:
        if isinstance(entry, dict) and entry.get("name") == "jev-latest":
            date = entry.get("release_date")
            if isinstance(date, str) and _DATE.fullmatch(date):
                return date
    return Why.MALFORMED


def _stored(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="ascii"))
    except OSError, ValueError, UnicodeDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _logged_versions(since: str | None) -> set[str]:
    """The versions that answered factory calls logged at or after `since` (all, when None)."""
    seen: set[str] = set()
    try:
        lines = (factory_dir() / "jev.log").read_text(encoding="ascii", errors="replace").splitlines()
    except OSError:
        return seen
    for line in lines:
        match = _LOGGED.match(line)
        if match and VERSION.fullmatch(match["model"]) and (since is None or match["ts"] >= since):
            seen.add(match["model"])
    return seen


def models_check(pin_file: Path) -> int:
    """J-c, the model watch: exit 0 `jev-model ok <version>`, 1 `JEV-MODEL-MOVED ...`, 2
    `unavailable <why>` (no alarm either way)."""
    try:
        pins = read_pins(pin_file)
    except OSError, UnicodeDecodeError:
        raise _UsageError("--pin-file: cannot read the file") from None
    if not pins:
        raise _UsageError("--pin-file: no jev-<n>.<n>.<n> in a table's model column")
    answered = ask(
        _WATCH_STATE, {"weather": _WATCH_QUESTION}, model="jev-latest", task="models-check", cache=False
    )
    if isinstance(answered, Unavailable):
        print(f"unavailable {answered.why.value}")
        return 2
    released = _release_date(_key())
    if isinstance(released, Why):
        print(f"unavailable {released.value}")
        return 2
    record = factory_dir() / "jev-models.json"
    stored = _stored(record)
    pinned = max(pins)
    old_date, since = stored.get("release_date"), stored.get("checked_at")
    checked_at = _utc()
    alarm: str | None = None
    if answered.model not in pins:
        alarm = f"JEV-MODEL-MOVED {pinned} -> {answered.model}"
    elif isinstance(old_date, str) and old_date != released:
        alarm = f"JEV-MODEL-MOVED release-date {old_date} -> {released}"
    else:
        moved = _logged_versions(since if isinstance(since, str) else None) - pins
        if moved:
            alarm = f"JEV-MODEL-MOVED {pinned} -> {min(moved)}"
    print(alarm or f"jev-model ok {answered.model}", flush=True)
    state = {
        "schema_version": 1,
        "model": answered.model,
        "release_date": released,
        "checked_at": checked_at,
    }
    _write_atomically(record, json.dumps(state) + "\n")
    return 1 if alarm else 0


def _parser() -> _Parser:
    parser = _Parser(
        prog="python -m scripts.factory.jev",
        description="The factory's Jev client: advice only; every gate decides without it.",
    )
    commands = parser.add_subparsers(
        dest="command", required=True, metavar="{triage,same-issue,models-check}"
    )
    triaging = commands.add_parser("triage", help="P(real) and severity per review finding, in shadow")
    triaging.add_argument("--from", dest="source", required=True, help="{pr, head_sha, findings} JSON")
    same = commands.add_parser("same-issue", help="whether a defect is one of the open issues")
    same.add_argument("--text", required=True, help="the defect, in public words")
    same.add_argument("--issues", required=True, help="[{number, title}] JSON of the open issues")
    watch = commands.add_parser("models-check", help="the daily Jev model watch")
    watch.add_argument("--pin-file", type=Path, default=PIN_FILE, help="the pinned versions' table")
    return parser


def main(argv: list[str] | None = None) -> int:
    try:
        arguments = _parser().parse_args(argv)
    except SystemExit as stop:
        return stop.code if isinstance(stop.code, int) else USAGE
    try:
        if arguments.command == "triage":
            return triage(arguments.source)
        if arguments.command == "same-issue":
            return same_issue(arguments.text, arguments.issues)
        try:
            return models_check(arguments.pin_file)
        except _UsageError:
            raise
        except Exception:
            print("unavailable failed")
            return 2
    except _UsageError as error:
        sys.stderr.write(f"python -m scripts.factory.jev: {error}\n")
        return USAGE
    except Exception:
        sys.stderr.write("python -m scripts.factory.jev: an unexpected error in the client\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
