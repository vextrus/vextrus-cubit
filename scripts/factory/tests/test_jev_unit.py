"""The builder's own tests for `scripts/factory/jev.py` (ticket f9), beyond the pinned acceptance
tests in `acceptance/test_factory_jev.py`; and L1, the one live call (`-m live`), kept here because
the acceptance path may hold no deselected test."""

import json
import os
import socket
import threading
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path

import httpx
import pytest

from scripts.factory import jev
from vextrus.settings import jev as jev_settings

SENTINEL = "KEYSENTINEL-do-not-print-0451"
MARKER = "INVENTED-MARKER-7f3a"
HEAD_SHA = "0123456789abcdef0123456789abcdef01234567"


@pytest.fixture(autouse=True)
def isolated(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    factory = tmp_path / "factory"
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(factory))
    monkeypatch.setattr(jev, "_health", jev._Health())
    monkeypatch.setattr(jev, "_sleep", lambda seconds: None)
    return factory


def mocked(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def refuse(request: httpx.Request) -> httpx.Response:
    raise AssertionError("no request was expected")


def noul_answer(request: httpx.Request) -> httpx.Response:
    asked = json.loads(request.content)["questions"]
    answers = {qid: {"type": "noul", "noul": 0.5} for qid in asked}
    return httpx.Response(200, json={"model": "jev-1.13.0", "answers": answers})


def test_answers_and_unavailable_show_no_state_or_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)
    question = {"q": {"kind": "noul", "text": "Is the invented sky blue?"}}
    with mocked(noul_answer) as client:
        answers = jev.ask(f"Invented {MARKER}.", question, client=client)
    assert isinstance(answers, jev.Answers)
    assert answers.output_tokens == 0, "usage absent counts as nothing"
    for text in (repr(answers), str(answers), repr(jev.Unavailable(jev.Why.NO_KEY))):
        assert MARKER not in text
        assert SENTINEL not in text
        assert "invented sky" not in text


def test_a_model_that_is_neither_a_version_nor_an_alias_is_a_bad_question(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)
    with mocked(refuse) as client:
        outcome = jev.ask(
            "Invented.", {"q": {"kind": "noul", "text": "Is it?"}}, model="jev", client=client
        )
    assert outcome == jev.Unavailable(jev.Why.BAD_QUESTION)


def test_a_compressed_answer_is_malformed_never_inflated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)

    def gzipped(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"\x1f\x8b", headers={"content-encoding": "gzip"})

    with mocked(gzipped) as client:
        outcome = jev.ask("Invented.", {"q": {"kind": "noul", "text": "Is it?"}}, client=client)
    assert outcome == jev.Unavailable(jev.Why.MALFORMED)


def test_a_duplicate_key_in_the_answer_is_malformed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)
    body = (
        b'{"model":"jev-1.13.0","answers":{"q0":{"type":"noul","noul":0.1},'
        b'"q0":{"type":"noul","noul":0.9}}}'
    )

    def twice(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=body)

    with mocked(twice) as client:
        outcome = jev.ask("Invented.", {"q": {"kind": "noul", "text": "Is it?"}}, client=client)
    assert outcome == jev.Unavailable(jev.Why.MALFORMED)


def test_triage_of_no_findings_makes_no_call_and_no_sidecar(
    isolated: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "none.json"
    source.write_text(json.dumps({"pr": 250, "head_sha": HEAD_SHA, "findings": []}))
    assert jev.main(["triage", "--from", str(source)]) == 0
    assert capsys.readouterr().out.strip() == "triage 250 01234567 0 findings"
    assert not (isolated / "ledger-jev").exists()
    assert not (isolated / "jev.log").exists()


def test_severity_is_the_most_probable_level_the_lower_on_a_tie() -> None:
    assert jev._severity({"0": 0.1, "1": 0.2, "2": 0.6, "3": 0.1}) == "high"
    assert jev._severity({"0": 0.0, "1": 0.5, "2": 0.5, "3": 0.0}) == "medium"


@pytest.mark.parametrize(
    "issues",
    ['{"number": 1}', '[{"number": "1", "title": "Invented"}]', '[{"number": 1, "title": ""}]'],
    ids=["not-a-list", "number-a-string", "empty-title"],
)
def test_same_issue_usage_errors_exit_64(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], issues: str
) -> None:
    path = tmp_path / "issues.json"
    path.write_text(issues)
    assert jev.main(["same-issue", "--text", "Invented defect.", "--issues", str(path)]) == 64
    assert capsys.readouterr().err.strip()


def test_models_check_without_a_readable_pin_table_exits_64(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert jev.main(["models-check", "--pin-file", str(tmp_path / "absent.md")]) == 64
    empty = tmp_path / "empty.md"
    empty.write_text("| node | threshold |\n|---|---|\n| sheet_type | jev-9.9.9 |\n")
    assert jev.main(["models-check", "--pin-file", str(empty)]) == 64
    assert capsys.readouterr().out == ""


def test_pins_come_only_from_a_tables_model_column(tmp_path: Path) -> None:
    path = tmp_path / "pins.md"
    path.write_text(
        "Prose naming jev-0.0.1.\n\n"
        "| node | model | note |\n|---|---|---|\n| a | `jev-1.13.0` | was jev-1.12.0 |\n"
        "| b | jev-2.0.0 | |\n\n"
        "| threshold | model-ish |\n|---|---|\n| 0.9 | jev-3.0.0 |\n"
    )
    assert jev.read_pins(path) == {"jev-1.13.0", "jev-2.0.0"}


# Fix round 1 (F1): the deadline holds while the status line, the headers and the body arrive -------


@contextmanager
def dripping_server(head: bytes, drip: bytes) -> Iterator[int]:
    """A local HTTP server that reads the request, sends `head`, then `drip` every 50 ms for at most
    3 s (so a client without the deadline ends in about 3 s rather than never). Its port."""
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen(1)
    stop = threading.Event()

    def serve() -> None:
        try:
            connection, _address = listener.accept()
        except OSError:
            return
        with connection:
            connection.recv(65_536)
            connection.sendall(head)
            ends = time.monotonic() + 3.0
            while not stop.is_set() and time.monotonic() < ends:
                try:
                    connection.sendall(drip)
                except OSError:
                    return
                stop.wait(0.05)

    server = threading.Thread(target=serve, daemon=True)
    server.start()
    try:
        yield listener.getsockname()[1]
    finally:
        stop.set()
        listener.close()
        server.join(timeout=5)


@pytest.mark.parametrize(
    ("head", "drip"),
    [
        (b"HTTP/1.1 200 OK\r\n", b"X-Invented-Drip: x\r\n"),
        (b"HTTP/1.1 200 OK\r\nContent-Length: 60000\r\n\r\n", b" "),
    ],
    ids=["header-drip", "body-drip"],
)
def test_a_server_dripping_headers_or_body_is_cut_at_the_deadline(
    monkeypatch: pytest.MonkeyPatch, head: bytes, drip: bytes
) -> None:
    for name in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        monkeypatch.delenv(name, raising=False)
    deadline = 0.5
    monkeypatch.setattr(jev_settings, "VEXTRUS_JEV_DEADLINE_SECONDS", deadline)
    with dripping_server(head, drip) as port:
        start = time.monotonic()
        outcome, took = jev._exchange(
            None, "GET", httpx.URL(f"http://127.0.0.1:{port}/"), "invented-key", None
        )
        elapsed = time.monotonic() - start
    # Each line or byte comes within 50 ms, far inside the 4 s read timeout: only the deadline ends
    # it. The margin is loose so no machine's speed matters; without the deadline it takes 3 s.
    assert outcome == jev.Why.TIMED_OUT
    assert elapsed < deadline + 1.0
    assert took <= elapsed


def test_outside_a_call_a_streams_waits_are_as_given() -> None:
    assert jev._left(4.0, TimeoutError) == 4.0


# Fix round 1 (F2): the same questions in another order never get each other's answers ------------


def test_the_same_questions_in_two_orders_each_get_their_own_answers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)
    wet = {"kind": "noul", "text": "Is the invented towel wet?"}
    green = {"kind": "noul", "text": "Is the invented leaf green?"}
    by_text = {wet["text"]: 0.97, green["text"]: 0.12}
    sent: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        asked = json.loads(request.content)["questions"]
        answers = {
            qid: {"type": "noul", "noul": by_text[question["instructions"]]}
            for qid, question in asked.items()
        }
        return httpx.Response(200, json={"model": "jev-1.13.0", "answers": answers})

    state = "Invented state for two orders."
    with mocked(respond) as client:
        first = jev.ask(state, {"wet": wet, "green": green}, client=client)
        second = jev.ask(state, {"green": green, "wet": wet}, client=client)
        third = jev.ask(state, {"green": green, "wet": wet}, client=client)
    for answers in (first, second, third):
        assert isinstance(answers, jev.Answers)
        assert answers["wet"]["p"] == pytest.approx(0.97)
        assert answers["green"]["p"] == pytest.approx(0.12)
    assert len(sent) == 2, "the other order is a miss; the same order again is a hit"


# Below 50, fixed too: after the cool-off one probe goes, the others still cool off ----------------


def test_after_the_cool_off_one_probe_goes_while_the_others_wait(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = [1000.0]
    monkeypatch.setattr(jev, "_now", lambda: now[0])
    health = jev._Health()
    for _ in range(3):
        assert health.admit()
        health.settle(jev.Why.FAILED)
    assert not health.admit()
    now[0] += 60.0
    assert health.admit(), "the probe"
    assert not health.admit(), "another caller while the probe is out"
    health.settle(jev.Why.FAILED)
    assert not health.admit(), "the probe failed: cooling off again"
    now[0] += 60.0
    assert health.admit()
    health.settle(None)
    assert health.admit(), "an answer ends the cool-off"
    assert health.admit()


@pytest.mark.live
def test_l1_one_live_call_on_invented_text(isolated: Path) -> None:
    """L1: one real `ask` against `jev-1.13.0`; needs the key and the network (`-m live`)."""
    if not os.environ.get("TYPESAFE_API_KEY", "").strip():
        pytest.skip("no TYPESAFE_API_KEY in the environment")
    answers = jev.ask(
        "Invented text: the kettle on the stove is whistling.",
        {"q": {"kind": "noul", "text": "Is the water in the kettle likely boiling?"}},
        task="live-check",
        cache=False,
    )
    assert isinstance(answers, jev.Answers), answers
    assert answers.model == "jev-1.13.0"
    assert 0 <= answers["q"]["p"] <= 1
