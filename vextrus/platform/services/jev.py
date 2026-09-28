"""Jev, TypeSafe's judgement model: the client, its answer cache, the override log and the fallback
(ticket 15; ADR 0011; ADR 0013; docs/specs/M0.md, "Jev client"; stories 85 and 86).

**`ask(node, facts, question, options)`** answers a closed question with a confidence, or says it is
`Unavailable`. It acts in the tenant `tenancy.current()` names (with none it raises `NoTenant` before
any call or write). It answers from the tenant's cache (JevAnswer) when the same node, facts, question,
options and pinned model were asked before; else it asks TypeSafe and caches the answer in the
caller's transaction. Otherwise it returns `Unavailable` within its deadline: it caches nothing,
raises nothing into its caller, and the QS picks (ADR 0011: "the Takeoff never stops"). A question
the node does not take (an undeclared or missing fact, bad option keys, an undeclared node) is the
caller's mistake: logged as an error and answered `Unavailable(bad_question)`, so a job step still
ends (only `prepare` raises it); drawing text too large to send is `Unavailable`, never cut.

- **The node** is declared once (`NODES`): its facts, its pinned model, the setting holding the
  confidence at which a caller proposes its answer rather than asks, and how a pre-pick names it. M0
  has one, `sheet_type`, from code's facts, all three always given: `title` (the sheet's title),
  `discipline` (its Discipline's key) and `view_titles` (its view titles in reading order, a list or
  text holding a JSON array; `"[]"` when there are none). The question and the options are the
  caller's (the sheet kinds are 13's conventions).
- **Facts go only into the state**, as JSON values; the question and the options' descriptions are
  sent exactly as given (drawing text is data, never an instruction).
- **What comes back is checked** against what was asked: the pinned model, the one question, a
  Choice, an option offered (exactly), a probability for each option offered and no other, each and
  the confidence a number from 0 to 1 (never NaN, Infinity, a string or a float: `Decimal`), the choice
  the most probable, no duplicate key. Anything else is `Unavailable`.
- **The fallback:** a connect and a read timeout, and a deadline for the whole call that every socket
  wait is cut to (a server dripping bytes included); 429, 529 and dropped connections tried again
  after a pause, inside the deadline; 401, 403 and 422 never (a 422 is logged as our fault); any
  other status is `Unavailable`; redirects are never followed, TLS is always verified, the URL is
  https and no proxy is taken from the environment. After `VEXTRUS_JEV_COOL_OFF_AFTER` failures in a
  row the client answers `Unavailable` at once for `VEXTRUS_JEV_COOL_OFF_SECONDS`. It starts no
  thread: a job step's query guard cannot see one (`services.jobs`).
- **The key** is read at call time from the environment variable `VEXTRUS_JEV_KEY_VARIABLE` names,
  and goes only into the request's `Authorization: Bearer` header: never into a setting, a log, an
  exception, a repr or a row. With none, `ask` makes no call.
- **The override log** (`record_override`): each QS change of a Jev proposal, the node's live error
  rate; `tally` reads each node's answers and overrides per model version.
- **`pre_pick`** decides whether an option is picked for the QS (m0-screens 5, 6.7).

Who calls it (usage):

    # 21c, per sheet inside a job step: propose, or raise a `low_confidence` Question; then pre-pick.
    answer = jev.ask_judgement(request)          # 13's JudgementRequest(node="sheet_type", ...)
    if isinstance(answer, jev.Unavailable):
        ...                                      # the QS picks; nothing tells them why (22)
    elif jev.SHEET_TYPE.proposes(answer):
        ...                                      # propose answer.choice, answer.id kept on it
    else:
        kinds = answer.ranked()                  # the Question's kinds, most likely first
    picked = jev.pre_pick(answer, [jev.Source("beam_layout", frozenset({"drawing_list"}), says)])

    # 19a's confirm service, when the QS confirms a kind other than Jev's (a QS's act):
    jev.record_override(answer_id, subject_id=proposal_id, qs_choice="column_layout",
                        project_id=project_id)

    # 23, on about 30 real sheets, below the cache and with no database:
    with jev.Client() as client:
        judged = client.judge("sheet_type", facts, question, options)
"""

import hashlib
import json
import logging
import os
import re
import socket
import ssl
import threading
import time
import uuid
from collections.abc import Callable, Iterable, Iterator, Mapping, Sequence
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from decimal import ROUND_DOWN, ROUND_HALF_EVEN, Decimal
from enum import StrEnum
from itertools import combinations
from types import MappingProxyType, TracebackType
from typing import Any, Literal, Self

import httpcore
import httpx
from django.conf import settings
from django.db.models import Count

from engine.messages import Message, MessageCode
from engine.recognise.types import JudgementRequest
from vextrus.platform.messages import jev as words
from vextrus.platform.models import JEV_KEY, JevAnswer, JevOverride
from vextrus.platform.services import auth, events, tenancy
from vextrus.platform.services.auth import Act, Grant
from vextrus.platform.services.events import NoTenant

logger = logging.getLogger(__name__)

__all__ = [
    "NODES",
    "OVERRIDE",
    "SHEET_TYPE",
    "Answer",
    "Client",
    "Judgement",
    "NoTenant",
    "Node",
    "NodeTally",
    "NotAnOverride",
    "PrePick",
    "Request",
    "Source",
    "Unavailable",
    "Why",
    "ask",
    "ask_judgement",
    "client",
    "jev_source",
    "pre_pick",
    "prepare",
    "record_override",
    "tally",
    "using",
]

type Facts = Mapping[str, str | Sequence[str]]
"""A node's facts by name: text, or for a list fact a list of text (or text holding a JSON array)."""
type Options = Sequence[str] | Mapping[str, str | None]
"""The option keys, in order; or each key with its description (sent as the Choice's criteria)."""
type Clock = Callable[[], float]

_OPTION = re.compile(JEV_KEY)
_BEARER = re.compile(r"[A-Za-z0-9._~+/=-]{1,512}")
"""A key usable in a header: a token (RFC 6750's b64token), so no header can be forged from it."""
_MAX_OPTIONS = 255
"""A Choice's options at most (docs.typesafe.ai/api)."""


# The nodes ------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Node:
    """A Jev node, declared once (ADR 0011: a pinned model, measured on real items by its spot check)."""

    key: str
    facts: tuple[str, ...]
    """The facts it takes, in the order its state lists them. Nothing else is sent."""
    lists: frozenset[str]
    """Those that are lists of text (a JSON array); the rest are text."""
    model: str
    """The pinned model, never an alias that moves (`jev-latest`): thresholds belong to a version."""
    propose_at: str
    """The setting holding the confidence at which a caller proposes the answer rather than asks."""
    source: MessageCode
    """How a pre-pick names this node's answer as a source (never "AI", "TypeSafe" or "Jev")."""

    def proposes(self, answer: Judgement) -> bool:
        """Whether the answer is confident enough to propose (else the caller asks the QS)."""
        if answer.node != self.key:
            raise ValueError(f"an answer of {answer.node} is not {self.key}'s")
        threshold: Decimal = getattr(settings, self.propose_at)
        return answer.confidence >= threshold


SHEET_TYPE = Node(
    key="sheet_type",
    facts=("title", "discipline", "view_titles"),
    lists=frozenset({"view_titles"}),
    model="jev-1.13.0",
    propose_at="VEXTRUS_JEV_SHEET_TYPE_PROPOSE_AT",
    source=words.SHEET_TYPE_SOURCE,
)
"""A sheet's kind, from code's facts: its title, its Discipline (a key) and its view titles. Code
owns storeys (ADR 0011 item 1); the kinds offered are the caller's (13's conventions)."""

NODES: Mapping[str, Node] = MappingProxyType({SHEET_TYPE.key: SHEET_TYPE})


def _node(key: str | Node) -> Node:
    if isinstance(key, Node):
        key = key.key
    found = NODES.get(key) if isinstance(key, str) else None
    if found is None:
        raise ValueError(f"{key!r} is not a declared Jev node")
    return found


# What an answer is ------------------------------------------------------------------------------------


class Why(StrEnum):
    """Why Jev is unavailable: a closed list, for logs and callers. Never shown, never stored."""

    BAD_QUESTION = "bad_question"
    """Not a question the node takes (an undeclared or missing fact, one of the wrong type, option
    keys that are not unique lower-case keys, an undeclared node): the caller's mistake, logged as an
    error; nothing was sent."""
    NO_KEY = "no_key"
    """No usable key in the environment: nothing was sent."""
    COOLING_OFF = "cooling_off"
    """Too many failures in a row just now: nothing was sent."""
    TOO_LARGE = "too_large"
    """The request would pass TypeSafe's limits: nothing was sent, nothing cut."""
    TIMED_OUT = "timed_out"
    """The deadline passed (connecting, waiting or reading)."""
    UNREACHABLE = "unreachable"
    """No connection, or it dropped, after the tries the deadline allowed."""
    BUSY = "busy"
    """429 or 529 after the tries the deadline allowed."""
    KEY_REFUSED = "key_refused"
    """401 or 403: the key was refused."""
    REQUEST_REFUSED = "request_refused"
    """422: our request is wrong (logged as an error)."""
    FAILED = "failed"
    """Any other status, a redirect among them, or an error of the client's own."""
    OVERSIZED = "oversized"
    """The answer was larger than `VEXTRUS_JEV_MAX_RESPONSE_BYTES`."""
    MALFORMED = "malformed"
    """The answer was not an answer to what was asked."""


_NOT_COUNTED = frozenset(
    {Why.BAD_QUESTION, Why.NO_KEY, Why.COOLING_OFF, Why.TOO_LARGE, Why.REQUEST_REFUSED}
)
"""Failures that say nothing of TypeSafe's health, so never bring on a cool-off. A 422 among them:
it says one request is wrong, which a cool-off would punish every other, sound question for (60 s
of the QS picking), and it answers at once, so it costs no time to save."""


@dataclass(frozen=True)
class Unavailable:
    """Jev did not answer: the QS picks. Nothing was cached."""

    why: Why


@dataclass(frozen=True)
class Judgement:
    """Jev's answer to one closed question, checked against what was asked."""

    node: str
    model: str
    """The model that answered: the node's pinned one."""
    choice: str
    confidence: Decimal
    probabilities: tuple[tuple[str, Decimal], ...]
    """Every option offered with its probability, in the order offered."""

    def ranked(self) -> tuple[str, ...]:
        """The options, most likely first: "the kinds, most likely first". Among equals the choice
        leads (reading to six places can tie it with another), then the order offered."""
        order = {option: at for at, (option, _p) in enumerate(self.probabilities)}
        ranked = sorted(
            self.probabilities,
            key=lambda pair: (-pair[1], pair[0] != self.choice, order[pair[0]]),
        )
        return tuple(option for option, _p in ranked)

    def probability(self, option: str) -> Decimal:
        return dict(self.probabilities)[option]


@dataclass(frozen=True)
class Answer(Judgement):
    """A Judgement as the tenant's cache holds it: `id` is its JevAnswer row, which an override names."""

    id: uuid.UUID


# The request ----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Request:
    """One question for TypeSafe, checked and encoded; `cache_key` names its answer in the cache."""

    node: Node
    options: tuple[str, ...]
    body: bytes
    cache_key: str

    def __repr__(self) -> str:  # never the facts: they are drawing text
        return f"<jev.Request {self.node.key} {self.cache_key[:12]}>"


def prepare(node: str | Node, facts: Facts, question: str, options: Options) -> Request | Unavailable:
    """The request for a question, or `Unavailable` (too large) when drawing text makes it longer
    than TypeSafe takes. A caller's mistake raises: an undeclared node or fact, a fact of the wrong
    type, an empty question, option keys not unique lower-case keys, fewer than two or more than 255.
    """
    declared = _node(node)
    state = _state(declared, facts)
    if not isinstance(question, str) or not question.strip():
        raise ValueError("a question is text")
    criteria = _criteria(options)
    body = _encode(
        {
            "model": declared.model,
            "state": state,
            "questions": {
                declared.key: {"type": "choice", "instructions": question, "criteria": criteria}
            },
        }
    )
    if len(body) > settings.VEXTRUS_JEV_MAX_REQUEST_BYTES:
        logger.warning("A %s question was not sent: %d bytes is too large", declared.key, len(body))
        return Unavailable(Why.TOO_LARGE)
    identity = {
        "node": declared.key,
        "model": declared.model,
        "facts": state,
        "question": question,
        "options": [[option, description] for option, description in criteria.items()],
    }
    cache_key = hashlib.sha256(_encode(identity, sort_keys=True)).hexdigest()
    return Request(declared, tuple(criteria), body, cache_key)


def _prepared(node: str | Node, facts: Facts, question: str, options: Options) -> Request | Unavailable:
    """`prepare`, with a question the node does not take answered `Unavailable(bad_question)` and
    logged as the caller's mistake: a job step that asks one still ends, and the QS picks."""
    try:
        return prepare(node, facts, question, options)
    except ValueError, TypeError:
        key = node.key if isinstance(node, Node) else node
        logger.exception("A %s question is not one its node takes: the caller's mistake", key)
        return Unavailable(Why.BAD_QUESTION)


def _encode(value: object, *, sort_keys: bool = False) -> bytes:
    """Compact JSON in ASCII: control characters, quotes and lone surrogates escaped, never raw."""
    text = json.dumps(
        value, ensure_ascii=True, separators=(",", ":"), sort_keys=sort_keys, allow_nan=False
    )
    return text.encode("ascii")


def _state(node: Node, facts: Facts) -> dict[str, str | list[str]]:
    if not isinstance(facts, Mapping):
        raise TypeError(f"facts are a mapping by name, not {type(facts).__name__}")
    undeclared = sorted(str(name) for name in facts if name not in node.facts)
    if undeclared:
        raise ValueError(f"{node.key} takes no fact named {', '.join(undeclared)}")
    missing = [name for name in node.facts if name not in facts]
    if missing:
        noun = "fact" if len(missing) == 1 else "facts"
        raise ValueError(f"{node.key} needs the {noun} {', '.join(missing)}")
    state: dict[str, str | list[str]] = {}
    for name in node.facts:
        value = facts[name]
        if name in node.lists:
            state[name] = _texts(value, name)
        elif isinstance(value, str):
            state[name] = value
        else:
            raise TypeError(f"{node.key}'s fact {name} is text, not {type(value).__name__}")
    return state


def _texts(value: object, name: str) -> list[str]:
    """A list fact: a list of text, or text holding one as a JSON array (a JudgementRequest's facts
    are text)."""
    if isinstance(value, str):
        try:
            value = _strict_json(value)
        except ValueError:
            raise ValueError(f"the fact {name} is a JSON array of text") from None
    if isinstance(value, list | tuple) and all(isinstance(item, str) for item in value):
        return list(value)
    raise TypeError(f"the fact {name} is a list of text")


def _criteria(options: Options) -> dict[str, str | None]:
    if isinstance(options, Mapping):
        pairs = list(options.items())
    elif isinstance(options, str) or not isinstance(options, Sequence):
        raise TypeError("options are a sequence of keys, or a mapping of key to description")
    else:
        pairs = [(option, None) for option in options]
    keys = [key for key, _description in pairs]
    for key in keys:
        if not isinstance(key, str) or not _OPTION.fullmatch(key):
            raise ValueError(f"option {key!r} is not a lower-case key of at most 64 characters")
    if len(set(keys)) != len(keys):
        raise ValueError("options are unique")
    if not 2 <= len(keys) <= _MAX_OPTIONS:
        raise ValueError(f"a question offers 2 to {_MAX_OPTIONS} options, not {len(keys)}")
    for key, description in pairs:
        if description is not None and not isinstance(description, str):
            raise TypeError(f"option {key}'s description is text")
    return dict(pairs)


# Reading an answer ------------------------------------------------------------------------------------


_LONGEST_NUMBER = 40
"""The most characters a number in an answer may take (TypeSafe writes two decimal places)."""
_DEEPEST = 8
"""The deepest an answer may nest (a Choice's probabilities are four deep); deeper is refused before
parsing, since Python's decoder recurses and could exhaust the stack."""
_PLACES = Decimal("0.000001")
"""Probabilities are read to six decimal places, so none is stored at any length."""
_CONFIDENCE_PLACES = Decimal("0.0001")
"""A confidence is read once, to the four places JevAnswer keeps, rounding down: never up across a
threshold, and the same whether it came from TypeSafe or the cache."""


class _Refused(ValueError):
    pass


def _refuse_constant(name: str) -> Any:
    raise _Refused(f"{name} is not a number JSON allows")


def _decimal(text: str) -> Decimal:
    if len(text) > _LONGEST_NUMBER:
        raise _Refused("a number too long")
    try:
        return Decimal(text)
    except ArithmeticError:  # an exponent past Decimal's range
        raise _Refused("a number out of range") from None


def _integer(text: str) -> int:
    if len(text) > _LONGEST_NUMBER:
        raise _Refused("a number too long")
    return int(text)


def _no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    found: dict[str, Any] = {}
    for key, value in pairs:
        if key in found:
            raise _Refused(f"{key!r} appears twice")
        found[key] = value
    return found


def _nests_deeper_than(text: str, most: int) -> bool:
    """Whether JSON text opens more than `most` arrays or objects within one another."""
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
    """JSON with no NaN or Infinity (Python's `json` takes both), no duplicate key, no number longer
    than 40 characters or past Decimal's range, no nesting deeper than 8, and every number with a
    fraction a `Decimal`, never a float. Anything else raises `ValueError`."""
    if _nests_deeper_than(text, _DEEPEST):
        raise _Refused("nested too deep")
    return json.loads(
        text,
        parse_float=_decimal,
        parse_int=_integer,
        parse_constant=_refuse_constant,
        object_pairs_hook=_no_duplicates,
    )


def _unit(value: object) -> Decimal | None:
    """A number from 0 to 1 as a Decimal, as written (-0 as 0); None for anything else (a bool, a
    string)."""
    if type(value) is int or type(value) is Decimal:
        number = Decimal(value)
        if number.is_finite() and 0 <= number <= 1:
            return number.copy_abs()
    return None


def _six_places(number: Decimal) -> Decimal:
    return number.quantize(_PLACES, ROUND_HALF_EVEN)


def _judgement(body: bytes, request: Request) -> Judgement | None:
    """TypeSafe's answer, if it answers exactly what `request` asked; else None."""
    try:
        data = _strict_json(body.decode("utf-8"))
    except ValueError:  # UnicodeDecodeError and JSONDecodeError among them
        return None
    node = request.node
    if not isinstance(data, dict) or data.get("model") != node.model:
        return None
    answers = data.get("answers")
    if not isinstance(answers, dict) or set(answers) != {node.key}:
        return None
    answer = answers[node.key]
    if not isinstance(answer, dict) or answer.get("type") != "choice":
        return None
    choice, confidence, given = (
        answer.get("choice"),
        _unit(answer.get("confidence")),
        answer.get("probabilities"),
    )
    if not isinstance(choice, str) or choice not in request.options or confidence is None:
        return None
    if not isinstance(given, dict) or set(given) != set(request.options):
        return None
    probabilities = tuple((option, _unit(given[option])) for option in request.options)
    checked = tuple((option, p) for option, p in probabilities if p is not None)
    # The choice is the most probable as written, before rounding can tie it with another.
    if len(checked) != len(probabilities) or dict(checked)[choice] != max(p for _o, p in checked):
        return None
    read = tuple((option, _six_places(p)) for option, p in checked)
    confidence = confidence.quantize(_CONFIDENCE_PLACES, ROUND_DOWN)
    return Judgement(node.key, node.model, choice, confidence, read)


# The sockets: every wait cut to the call's deadline ---------------------------------------------------

_DEADLINE: ContextVar[tuple[Clock, float] | None] = ContextVar("vextrus_jev_deadline", default=None)
"""The call in progress in this thread: its clock and the time it must end by."""


def _left(timeout: float | None, expired: type[Exception]) -> float | None:
    """`timeout` cut to what is left of the call's deadline; `expired` when nothing is."""
    call = _DEADLINE.get()
    if call is None:
        return timeout
    clock, deadline = call
    left = deadline - clock()
    if left <= 0:
        raise expired("the call's deadline has passed")
    return left if timeout is None else min(timeout, left)


class _Stream(httpcore.NetworkStream):
    """httpcore's own socket stream, each wait cut to the call's deadline.

    httpx times each read on its own, so without this a server sending a byte just inside the read
    timeout, again and again, would hold the call (and the job step's transaction) for ever."""

    def __init__(self, inner: httpcore.NetworkStream) -> None:
        self._inner = inner

    def read(self, max_bytes: int, timeout: float | None = None) -> bytes:
        return self._inner.read(max_bytes, _left(timeout, httpcore.ReadTimeout))

    def write(self, buffer: bytes, timeout: float | None = None) -> None:
        self._inner.write(buffer, _left(timeout, httpcore.WriteTimeout))

    def close(self) -> None:
        self._inner.close()

    def start_tls(
        self,
        ssl_context: ssl.SSLContext,
        server_hostname: str | None = None,
        timeout: float | None = None,
    ) -> httpcore.NetworkStream:
        wait = _left(timeout, httpcore.ConnectTimeout)
        return _Stream(self._inner.start_tls(ssl_context, server_hostname, wait))

    def get_extra_info(self, info: str) -> Any:
        return self._inner.get_extra_info(info)


class _Sockets(httpcore.NetworkBackend):
    """httpcore's sockets (`SyncBackend`), connecting to each address in turn within the deadline.

    `socket.create_connection` gives each address the whole timeout (TypeSafe's name has two), so each
    address is connected to here, with what is left. Name resolution is the system resolver's: it
    cannot be cut without a thread."""

    def __init__(self) -> None:
        self._sockets = httpcore.SyncBackend()

    def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Iterable[Any] | None = None,
    ) -> httpcore.NetworkStream:
        try:
            found = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except OSError as failed:
            raise httpcore.ConnectError(f"cannot resolve {host}") from failed
        failure: Exception = httpcore.ConnectError(f"{host} has no address")
        for *_kind, address in found:
            wait = _left(timeout, httpcore.ConnectTimeout)
            try:
                stream = self._sockets.connect_tcp(
                    str(address[0]), port, wait, local_address, list(socket_options or ())
                )
            except httpcore.ConnectError as failed:
                failure = failed
                continue
            return _Stream(stream)
        raise failure

    def connect_unix_socket(
        self, path: str, timeout: float | None = None, socket_options: Iterable[Any] | None = None
    ) -> httpcore.NetworkStream:
        raise httpcore.ConnectError("TypeSafe is reached over TCP only")

    def sleep(self, seconds: float) -> None:
        raise RuntimeError("the Jev client's pool never waits")  # it is made with retries=0


class _Transport(httpx.HTTPTransport):
    """httpx's transport over httpcore's pool on `_Sockets`: TLS verified against certifi's roots
    (never `SSL_CERT_FILE`), no proxy, no retry of its own. httpx takes no network backend, so the
    pool it makes is replaced by one that does (httpx 0.28.1, pinned; a test holds this)."""

    def __init__(self) -> None:
        tls = httpx.create_ssl_context(verify=True, trust_env=False)
        super().__init__(verify=tls, trust_env=False, retries=0)
        self._pool = httpcore.ConnectionPool(
            ssl_context=tls,
            max_connections=4,
            keepalive_expiry=5.0,
            http1=True,
            http2=False,
            retries=0,
            network_backend=_Sockets(),
        )


def _network() -> httpx.BaseTransport:
    """The transport to TypeSafe (the tests' fixture puts the recordings in its place)."""
    return _Transport()


# The client -------------------------------------------------------------------------------------------


def _key_from_environment() -> str | None:
    """The key, read now from the variable `VEXTRUS_JEV_KEY_VARIABLE` names (never from a setting)."""
    value = os.environ.get(settings.VEXTRUS_JEV_KEY_VARIABLE, "").strip()
    return value or None


def _timeout(left: float) -> httpx.Timeout:
    connect = min(settings.VEXTRUS_JEV_CONNECT_SECONDS, left)
    read = min(settings.VEXTRUS_JEV_READ_SECONDS, left)
    return httpx.Timeout(connect=connect, read=read, write=read, pool=connect)


def _retry_after(value: str | None) -> float:
    """A Retry-After in seconds (its date form is not waited for); 0 when there is none."""
    if value is None or not value.strip().isdecimal():
        return 0.0
    return float(value.strip())


class Client:
    """TypeSafe's Jev over HTTPS, below the cache: no database and no tenant (23 runs it on real
    sheets locally). `ask` uses one per process, `client()`, so the cool-off holds across a job.

    `transport`, `clock`, `sleep` and `key` are seams for tests; in use they are the network,
    `time.monotonic`, `time.sleep` and the environment."""

    def __init__(
        self,
        *,
        transport: httpx.BaseTransport | None = None,
        clock: Clock = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        key: Callable[[], str | None] = _key_from_environment,
    ) -> None:
        url = httpx.URL(settings.VEXTRUS_JEV_URL)
        if url.scheme != "https":
            raise ValueError("TypeSafe is reached over https only")
        self._url = url
        self._clock = clock
        self._sleep = sleep
        self._key = key
        self._http = httpx.Client(
            transport=transport or _network(), follow_redirects=False, trust_env=False
        )
        self._lock = threading.Lock()
        self._failures = 0
        self._cool_until: float | None = None

    def __repr__(self) -> str:
        return f"<jev.Client {self._url}>"

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self, kind: type[BaseException] | None, error: BaseException | None, trace: TracebackType | None
    ) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def judge(
        self, node: str | Node, facts: Facts, question: str, options: Options
    ) -> Judgement | Unavailable:
        """Ask TypeSafe (never the cache); `Unavailable` within the deadline when it does not answer,
        and `Unavailable(bad_question)` for a question the node does not take."""
        request = _prepared(node, facts, question, options)
        if isinstance(request, Unavailable):
            return request
        return self.send(request)

    def send(self, request: Request) -> Judgement | Unavailable:
        key = self._key()
        if key is None or not _BEARER.fullmatch(key):
            return self._failed(request, Why.NO_KEY)
        if self._cooling_off():
            return Unavailable(Why.COOLING_OFF)
        deadline = self._clock() + settings.VEXTRUS_JEV_DEADLINE_SECONDS
        token = _DEADLINE.set((self._clock, deadline))
        outcome: Judgement | Why
        try:
            body = self._post(request, key, deadline)
            outcome = body if isinstance(body, Why) else (_judgement(body, request) or Why.MALFORMED)
        except Exception:  # nothing TypeSafe sends may raise into the caller, its answer included
            logger.exception("The Jev client failed on a %s question", request.node.key)
            outcome = Why.FAILED
        finally:
            _DEADLINE.reset(token)
        if isinstance(outcome, Why):
            return self._failed(request, outcome)
        with self._lock:
            self._failures, self._cool_until = 0, None
        return outcome

    def _post(self, request: Request, key: str, deadline: float) -> bytes | Why:
        """The answer's body, trying again after 429, 529 or a dropped connection while the deadline
        allows; else why not."""
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        }
        pause = settings.VEXTRUS_JEV_BACKOFF_SECONDS
        while True:
            left = deadline - self._clock()
            if left <= 0:
                return Why.TIMED_OUT
            wait_at_least = 0.0
            try:
                with self._http.stream(
                    "POST", self._url, content=request.body, headers=headers, timeout=_timeout(left)
                ) as response:
                    status = response.status_code
                    if status == 200:
                        return self._read(response, deadline)
                    if status in (429, 529):
                        why = Why.BUSY
                        wait_at_least = _retry_after(response.headers.get("retry-after"))
                    elif status in (401, 403):
                        return Why.KEY_REFUSED
                    elif status == 422:
                        logger.error(
                            "TypeSafe refused a %s question as invalid (422): Vextrus built it wrong",
                            request.node.key,
                        )
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
            if self._clock() + wait >= deadline:
                return why
            self._sleep(wait)
            pause = min(pause * 2, settings.VEXTRUS_JEV_BACKOFF_MAX_SECONDS)

    def _read(self, response: httpx.Response, deadline: float) -> bytes | Why:
        """The body, uncompressed as asked, within the cap and the deadline (Content-Length is only a
        hint: the bytes are counted)."""
        if response.headers.get("content-encoding", "identity").strip().lower() != "identity":
            return Why.MALFORMED  # asked for identity: nothing is ever inflated
        cap = settings.VEXTRUS_JEV_MAX_RESPONSE_BYTES
        length = response.headers.get("content-length", "0").strip()
        if not length.isdecimal():
            return Why.MALFORMED
        if int(length) > cap:
            return Why.OVERSIZED
        body = bytearray()
        # Identity-encoded (checked above), so these are the bytes as sent, counted as they come.
        for chunk in response.iter_bytes():
            body += chunk
            if len(body) > cap:
                return Why.OVERSIZED
            if self._clock() > deadline:
                return Why.TIMED_OUT
        return bytes(body)

    def _cooling_off(self) -> bool:
        with self._lock:
            return self._cool_until is not None and self._clock() < self._cool_until

    def _failed(self, request: Request, why: Why) -> Unavailable:
        logger.warning("Jev is unavailable for a %s question: %s", request.node.key, why.value)
        if why in _NOT_COUNTED:
            return Unavailable(why)
        with self._lock:
            self._failures += 1
            if self._failures >= settings.VEXTRUS_JEV_COOL_OFF_AFTER:
                self._cool_until = self._clock() + settings.VEXTRUS_JEV_COOL_OFF_SECONDS
                logger.warning(
                    "Jev failed %d times in a row: answering unavailable for %s s",
                    self._failures,
                    settings.VEXTRUS_JEV_COOL_OFF_SECONDS,
                )
        return Unavailable(why)


_default: Client | None = None
_default_lock = threading.Lock()


def client() -> Client:
    """The process's client, which `ask` uses (made at first use)."""
    global _default
    with _default_lock:
        if _default is None:
            _default = Client()
        return _default


@contextmanager
def using(replacement: Client) -> Iterator[Client]:
    """Every `ask` in the block uses `replacement` (the tests' recordings; a local run's client)."""
    global _default
    with _default_lock:
        before, _default = _default, replacement
    try:
        yield replacement
    finally:
        with _default_lock:
            _default = before


# Asking, through the tenant's cache ------------------------------------------------------------------


def ask(node: str | Node, facts: Facts, question: str, options: Options) -> Answer | Unavailable:
    """Jev's answer from the acting tenant's cache or from TypeSafe; else `Unavailable`, with nothing
    cached, a question the node does not take among its reasons (`bad_question`, logged as the
    caller's mistake). Raises `NoTenant` outside a tenant, before any call or write."""
    tenant_id = _acting_tenant()
    request = _prepared(node, facts, question, options)
    if isinstance(request, Unavailable):
        return request
    cached = _cached(tenant_id, request.cache_key)
    if cached is not None:
        return cached
    judged = client().send(request)
    if isinstance(judged, Unavailable):
        return judged
    # A step asking the same question at once may have written it first: its answer stands.
    JevAnswer.objects.bulk_create(
        [
            JevAnswer(
                tenant_id=tenant_id,
                cache_key=request.cache_key,
                node=judged.node,
                model_version=judged.model,
                options=list(request.options),
                choice=judged.choice,
                confidence=judged.confidence,
                probabilities={option: format(p.normalize(), "f") for option, p in judged.probabilities},
            )
        ],
        ignore_conflicts=True,
    )
    written = _cached(tenant_id, request.cache_key)
    if written is None:
        raise RuntimeError("the answer written could not be read back")
    return written


def ask_judgement(request: JudgementRequest) -> Answer | Unavailable:
    """`ask` for the engine's JudgementRequest (13 emits one per sheet)."""
    return ask(request.node, request.facts, request.question, request.options)


def _acting_tenant() -> uuid.UUID:
    tenant_id = tenancy.current().tenant_id
    if tenant_id is None or events.acting_tenant_id() != tenant_id:
        raise NoTenant("Jev was asked outside any tenant")
    return tenant_id


def _cached(tenant_id: uuid.UUID, cache_key: str) -> Answer | None:
    row = JevAnswer.objects.filter(tenant_id=tenant_id, cache_key=cache_key).first()
    if row is None:
        return None
    probabilities = tuple((option, Decimal(row.probabilities[option])) for option in row.options)
    return Answer(row.node, row.model_version, row.choice, row.confidence, probabilities, row.id)


# The override log --------------------------------------------------------------------------------------

OVERRIDE = Act("platform.override_jev", Grant.CHANGE)
"""Logging a QS's change of a Jev proposal: the QS's and the Vextrus Engineer's act."""


class NotAnOverride(ValueError):
    """The QS's choice is no override: an option the answer did not offer (`not_offered`) or Jev's own
    (`jev_s_own`). The confirm service offers only the answer's options and logs only a change."""

    def __init__(self, reason: Literal["not_offered", "jev_s_own"]) -> None:
        super().__init__(reason)
        self.reason = reason


def record_override(
    answer_id: uuid.UUID, *, subject_id: uuid.UUID, qs_choice: str, project_id: uuid.UUID
) -> uuid.UUID:
    """Log that the QS chose `qs_choice` over Jev's answer for `subject_id` (a Proposal) in the
    Project; its id. The node, model and Jev's choice are the answer's; the user is the acting one.

    Refused as `auth.require` refuses (signed out, no current Membership, a Project outside the
    scope, a role that may not change: a Guest or the MD); an answer not the tenant's is not found.

    `project_id` must be the subject's own Project, which the caller resolves from the Proposal
    (platform cannot read `takeoff`), never one a request names: the scope is checked against it."""
    membership = auth.require(OVERRIDE, project_id)
    if membership is None:
        raise auth.NoDeveloper
    answer = JevAnswer.objects.filter(tenant_id=membership.tenant_id, id=answer_id).first()
    if answer is None:
        raise auth.NotFound
    if qs_choice == answer.choice:
        raise NotAnOverride("jev_s_own")
    if not isinstance(qs_choice, str) or qs_choice not in answer.options:
        raise NotAnOverride("not_offered")
    override = JevOverride.objects.create(
        tenant_id=membership.tenant_id,
        answer_id=answer.id,
        node=answer.node,
        model_version=answer.model_version,
        subject_id=subject_id,
        jev_choice=answer.choice,
        qs_choice=qs_choice,
        user_id=membership.user_id,
    )
    return override.id


@dataclass(frozen=True)
class NodeTally:
    """One node's answers and overrides under one model: its live error rate's counts."""

    node: str
    model_version: str
    answers: int
    """Answers cached."""
    overrides: int
    """QS changes logged (a Proposal changed twice counts twice)."""
    answers_overridden: int
    """Answers with at least one override."""


def tally() -> tuple[NodeTally, ...]:
    """Each node's answers and overrides per model version, in the acting tenant."""
    tenant_id = _acting_tenant()
    answers = {
        (row["node"], row["model_version"]): row["n"]
        for row in JevAnswer.objects.filter(tenant_id=tenant_id)
        .values("node", "model_version")
        .annotate(n=Count("id"))
    }
    overrides = {
        (row["node"], row["model_version"]): (row["n"], row["answers"])
        for row in JevOverride.objects.filter(tenant_id=tenant_id)
        .values("node", "model_version")
        .annotate(n=Count("id"), answers=Count("answer", distinct=True))
    }
    return tuple(
        NodeTally(node, model, answers.get((node, model), 0), *overrides.get((node, model), (0, 0)))
        for node, model in sorted(set(answers) | set(overrides))
    )


# Pre-picking -------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Source:
    """One source naming an option (m0-screens 5's list: the title block, the drawing list, the Plot's
    page, the file's Discipline, the number's prefix, the revision mark, the file name's mark).

    `read_from` names what it was read from: a node's facts (`title`, `view_titles`) or anything else
    (`drawing_list`). Pass one Source per independent source: a title-block attribute and the text in
    that title block are one (m0-screens 5)."""

    option: str
    read_from: frozenset[str]
    says: Message
    """How the card names it, after "Picked for you:"."""

    def __post_init__(self) -> None:
        if not isinstance(self.read_from, frozenset) or not self.read_from:
            raise ValueError("a source names what it was read from")


@dataclass(frozen=True)
class PrePick:
    option: str
    sources: tuple[Source, ...]
    """The sources that agree, Jev's last when it is one."""


def jev_source(answer: Judgement) -> Source:
    """Jev's answer as a source: read from every fact its node takes."""
    node = NODES[answer.node]
    return Source(answer.choice, frozenset(node.facts), node.source())


def pre_pick(answer: Judgement | Unavailable, sources: Sequence[Source]) -> PrePick | None:
    """The option picked for the QS, or None: the QS picks from nothing pre-picked.

    Our reading of m0-screens 5 and 6.7 (ruling 2, "pre-pick only when two independent sources
    agree"):
    - two sources read from nothing in common must name one option;
    - Jev's answer counts as one source at any confidence;
    - beside Jev's answer, a source read from any fact its node takes (the title it read) never
      counts: it is dropped, neither agreeing nor dissenting. The sheet-type node takes the
      Discipline too, so a source read from the file's Discipline is dropped beside it;
    - with Jev unavailable, the others decide;
    - any counted source naming another option means no pick.
    """
    counted = list(sources)
    if isinstance(answer, Judgement):
        jev = jev_source(answer)
        counted = [source for source in counted if not source.read_from & jev.read_from] + [jev]
    if len({source.option for source in counted}) != 1:
        return None
    if not any(not a.read_from & b.read_from for a, b in combinations(counted, 2)):
        return None
    return PrePick(counted[0].option, tuple(counted))
