"""The Jev client's sockets (ticket 15): every wait is cut to what is left of the call's deadline, so a
server dripping bytes (each read inside httpx's read timeout) is cut too, and each of a name's
addresses is tried within it."""

import os
import socket
import ssl
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import httpcore
import httpx
import pytest

from vextrus.platform.services import jev
from vextrus.testing.jev import FakeClock


class Inner(httpcore.NetworkStream):
    """A stream noting the timeout each wait was given."""

    def __init__(self) -> None:
        self.waits: list[tuple[str, float | None]] = []

    def read(self, max_bytes: int, timeout: float | None = None) -> bytes:
        self.waits.append(("read", timeout))
        return b"x"

    def write(self, buffer: bytes, timeout: float | None = None) -> None:
        self.waits.append(("write", timeout))

    def close(self) -> None:
        self.waits.append(("close", None))

    def start_tls(
        self,
        ssl_context: ssl.SSLContext,
        server_hostname: str | None = None,
        timeout: float | None = None,
    ) -> httpcore.NetworkStream:
        self.waits.append(("tls", timeout))
        return self

    def get_extra_info(self, info: str) -> Any:
        return f"info:{info}"


@contextmanager
def deadline(clock: Any, seconds: float) -> Iterator[None]:
    token = jev._DEADLINE.set((clock, clock() + seconds))
    try:
        yield
    finally:
        jev._DEADLINE.reset(token)


def test_each_wait_is_cut_to_what_is_left_of_the_deadline() -> None:
    clock = FakeClock()
    inner = Inner()
    stream = jev._Stream(inner)

    with deadline(clock, 6.0):
        stream.read(10, 4.0)
        clock.advance(4.5)
        stream.read(10, 4.0)
        stream.write(b"x", 4.0)
        tls = stream.start_tls(ssl.create_default_context(), "api.typesafe.ai", 2.0)
        stream.read(10, 1.0)
        stream.read(10, None)

    assert inner.waits == [
        ("read", 4.0),
        ("read", 1.5),
        ("write", 1.5),
        ("tls", 1.5),
        ("read", 1.0),
        ("read", 1.5),
    ]
    assert isinstance(tls, jev._Stream)
    assert stream.get_extra_info("ssl_object") == "info:ssl_object"


@pytest.mark.parametrize(
    ("wait", "expired"),
    [
        (lambda s: s.read(10, 4.0), httpcore.ReadTimeout),
        (lambda s: s.write(b"x", 4.0), httpcore.WriteTimeout),
        (lambda s: s.start_tls(ssl.create_default_context(), "h", 2.0), httpcore.ConnectTimeout),
    ],
)
def test_once_the_deadline_has_passed_no_wait_begins(wait: Any, expired: type[Exception]) -> None:
    clock = FakeClock()
    inner = Inner()

    with deadline(clock, 6.0):
        clock.advance(6.0)
        with pytest.raises(expired, match="deadline has passed"):
            wait(jev._Stream(inner))

    assert inner.waits == []


def test_outside_a_call_the_waits_are_as_given() -> None:
    inner = Inner()

    jev._Stream(inner).read(10, 4.0)

    assert inner.waits == [("read", 4.0)]


class Connector:
    """A stand-in for httpcore's sockets: each connect noted, the first `refusals` refused."""

    def __init__(self, clock: FakeClock, refusals: int, takes: float) -> None:
        self.clock = clock
        self.refusals = refusals
        self.takes = takes
        self.connects: list[tuple[str, float | None]] = []

    def connect_tcp(
        self, host: str, port: int, timeout: float | None = None, *rest: Any
    ) -> httpcore.NetworkStream:
        self.connects.append((host, timeout))
        self.clock.advance(self.takes)
        if len(self.connects) <= self.refusals:
            raise httpcore.ConnectError("refused")
        return Inner()


def two_addresses(monkeypatch: pytest.MonkeyPatch) -> None:
    found = [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.1", 443)),
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.2", 443)),
    ]
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: found)


def test_each_address_is_tried_with_what_is_left(monkeypatch: pytest.MonkeyPatch) -> None:
    two_addresses(monkeypatch)
    clock = FakeClock()
    sockets = jev._Sockets()
    connector = Connector(clock, refusals=1, takes=1.5)
    monkeypatch.setattr(sockets, "_sockets", connector)

    with deadline(clock, 3.0):
        stream = sockets.connect_tcp("api.typesafe.ai", 443, timeout=2.0)

    assert connector.connects == [("192.0.2.1", 2.0), ("192.0.2.2", 1.5)]
    assert isinstance(stream, jev._Stream)


def test_no_address_is_tried_once_the_deadline_has_passed(monkeypatch: pytest.MonkeyPatch) -> None:
    two_addresses(monkeypatch)
    clock = FakeClock()
    sockets = jev._Sockets()
    connector = Connector(clock, refusals=1, takes=3.0)
    monkeypatch.setattr(sockets, "_sockets", connector)

    with deadline(clock, 3.0), pytest.raises(httpcore.ConnectTimeout):
        sockets.connect_tcp("api.typesafe.ai", 443, timeout=2.0)

    assert len(connector.connects) == 1


def test_when_every_address_refuses_the_last_refusal_is_raised(monkeypatch: pytest.MonkeyPatch) -> None:
    two_addresses(monkeypatch)
    sockets = jev._Sockets()
    connector = Connector(FakeClock(), refusals=2, takes=0.0)
    monkeypatch.setattr(sockets, "_sockets", connector)

    with pytest.raises(httpcore.ConnectError, match="refused"):
        sockets.connect_tcp("api.typesafe.ai", 443, timeout=2.0)


def test_a_name_that_does_not_resolve_is_a_connect_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fails(*args: Any, **kwargs: Any) -> Any:
        raise socket.gaierror(-2, "Name or service not known")

    monkeypatch.setattr(socket, "getaddrinfo", fails)

    with pytest.raises(httpcore.ConnectError, match="cannot resolve"):
        jev._Sockets().connect_tcp("api.typesafe.invalid", 443, timeout=2.0)


# On real sockets (127.0.0.1): a server that drips a byte at a time -------------------------------------


@contextmanager
def dripping_server() -> Iterator[int]:
    """A local HTTP server that sends its headers, then its body one byte every 20 ms, for ever
    (until the client goes). Its port."""
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen(1)
    stop = threading.Event()

    def serve() -> None:
        connection, _address = listener.accept()
        with connection:
            connection.recv(65_536)
            connection.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 100000\r\n\r\n")
            while not stop.is_set():
                try:
                    connection.sendall(b" ")
                except OSError:
                    return
                stop.wait(0.02)

    server = threading.Thread(target=serve, daemon=True)
    server.start()
    try:
        yield listener.getsockname()[1]
    finally:
        stop.set()
        listener.close()
        server.join(timeout=5)


def test_a_real_socket_dripping_bytes_is_cut_at_the_deadline_though_each_read_is_quick() -> None:
    with dripping_server() as port, httpx.Client(transport=jev._Transport()) as http:
        threads_before = threads()
        token = jev._DEADLINE.set((time.monotonic, time.monotonic() + 0.3))
        start = time.monotonic()
        try:
            with (
                pytest.raises(httpx.ReadTimeout),
                http.stream("GET", f"http://127.0.0.1:{port}/", timeout=httpx.Timeout(4.0)) as response,
            ):
                for _chunk in response.iter_raw():
                    pass
        finally:
            jev._DEADLINE.reset(token)
        took = time.monotonic() - start
        threads_after = threads()

    # Each byte comes within 20 ms, far inside the 4 s read timeout: only the deadline ends it (the
    # whole body would take 2,000 s). The bound is loose so no machine's speed matters.
    assert took < 4.0
    assert threads_after == threads_before  # the client started none (the server's is the test's)


def threads() -> int:
    """This process's threads, as the kernel counts them (a pool's idle threads included)."""
    return len(os.listdir("/proc/self/task"))
