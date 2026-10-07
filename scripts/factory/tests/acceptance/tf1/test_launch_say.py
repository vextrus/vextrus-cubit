"""Ticket f1, section 3 D: `python -m scripts.factory.launch say <session> --file F` leak-scans the
text, prefixes `[elapsed n/m min]`, sends it with `claude -p ... --cloud <session> --output-format
json < /dev/null` and reads `{ok}` (docs/specs/factory/contracts/launch-cli.md 1 and 3; the
ticket's 4.2).

The seam is the ticket's `say(session_id, text, *, elapsed, scan, send)`, `send` returning
`(exit code, stdout)`. Its result's first line is `Outcome.line` when it returns an Outcome, else the
first printed line; its code is `Outcome.exit_code`, or the int it returns.
Usage errors (exit 64) go through `main`, run in a folder with no `scripts/factory/stamp.py` (the
writer's ruling: the stamp is looked for in the current directory, the main checkout, as
`default_scan(root)` looks for the leak scan), so no elapsed time can be had but `--elapsed`.
"""

from __future__ import annotations

import json
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from scripts.factory.launch import ScanResult

SESSION = "session_01Abc"
TEXT = "Round 1: three findings, MESSAGE-BODY-41c9."


def clean_scan(text: str) -> ScanResult:
    from scripts.factory.launch import ScanResult

    return ScanResult(clean=True, counts="leakscan: hits=0 scanned=1 corpus=0123456789ab")


def hit_scan(text: str) -> ScanResult:
    from scripts.factory.launch import ScanResult

    return ScanResult(clean=False, counts="leakscan: hits=1 scanned=1 corpus=0123456789ab")


class Sender:
    def __init__(self, reply: str = '{"ok": true, "session_id": "session_01Abc"}') -> None:
        self.reply = reply
        self.calls: list[list[str]] = []

    def __call__(self, argv: list[str]) -> tuple[int, str]:
        self.calls.append(list(argv))
        return 0, self.reply


def said(
    capsys: pytest.CaptureFixture[str],
    *,
    send: Callable[[list[str]], tuple[int, str]] | None,
    scan: Callable[[str], ScanResult] = clean_scan,
    session: str = SESSION,
) -> tuple[int, str, str]:
    """(exit code, first line, everything printed)."""
    from scripts.factory.launch import say

    if send is None:
        result: object = say(session, TEXT, elapsed="25/60", scan=scan)
    else:
        result = say(session, TEXT, elapsed="25/60", scan=scan, send=send)
    printed = capsys.readouterr()
    lines = printed.out.splitlines()
    code = result if isinstance(result, int) else getattr(result, "exit_code", None)
    first = getattr(result, "line", None) if not isinstance(result, int) else None
    assert isinstance(code, int)
    first_line = first if isinstance(first, str) else (lines[0] if lines else "")
    return code, first_line, printed.out + printed.err


def main_code(argv: list[str]) -> int:
    from scripts.factory.launch import main

    try:
        return main(argv)
    except SystemExit as stopped:
        return stopped.code if isinstance(stopped.code, int) else 1


@pytest.fixture
def no_process(monkeypatch: pytest.MonkeyPatch) -> list[list[str]]:
    """Every `subprocess.run` the launcher makes, none of them run."""
    calls: list[list[str]] = []

    def fake(argv: list[str], *args: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append(list(argv))
        return subprocess.CompletedProcess(argv, 0, '{"ok": true}', "")

    monkeypatch.setattr(subprocess, "run", fake)
    return calls


def test_d1_the_default_sender_runs_the_exact_message_command_with_stdin_closed(
    capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[tuple[list[str], dict[str, object]]] = []

    def fake(argv: list[str], *args: object, **kwargs: object) -> subprocess.CompletedProcess[object]:
        calls.append((list(argv), kwargs))
        reply = '{"ok": true, "session_id": "session_01Abc"}'
        as_text = bool(kwargs.get("text") or kwargs.get("encoding") or kwargs.get("universal_newlines"))
        return subprocess.CompletedProcess(
            argv, 0, reply if as_text else reply.encode(), "" if as_text else b""
        )

    monkeypatch.setattr(subprocess, "run", fake)
    code, _, _ = said(capsys, send=None)
    assert code == 0
    sent = [(argv, kwargs) for argv, kwargs in calls if argv[:2] == ["claude", "-p"]]
    assert len(sent) == 1
    argv, kwargs = sent[0]
    assert argv == [
        "claude",
        "-p",
        f"[elapsed 25/60 min] {TEXT}",
        "--cloud",
        SESSION,
        "--output-format",
        "json",
    ]
    assert kwargs.get("stdin") == subprocess.DEVNULL


def test_d2_no_elapsed_time_or_a_malformed_one_is_a_usage_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, no_process: list[list[str]]
) -> None:
    monkeypatch.chdir(tmp_path)
    message = tmp_path / "message.md"
    message.write_text(TEXT)
    assert main_code(["say", SESSION, "--file", str(message), "--ticket", "x1"]) == 64
    for elapsed in ("25", "25-60", "a/60", "25/60/5", "25/"):
        assert main_code(["say", SESSION, "--file", str(message), "--elapsed", elapsed]) == 64, elapsed
    assert [argv for argv in no_process if argv[:2] == ["claude", "-p"]] == []


def test_d3_a_leak_in_the_message_refuses_and_never_prints_it(
    capsys: pytest.CaptureFixture[str],
) -> None:
    send = Sender()
    code, first, printed = said(capsys, send=send, scan=hit_scan)
    assert code == 2
    assert first.startswith("REFUSED prompt-leak: ")
    assert send.calls == []
    assert "MESSAGE-BODY-41c9" not in printed


def test_d4_a_malformed_session_id_is_a_usage_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, no_process: list[list[str]]
) -> None:
    monkeypatch.chdir(tmp_path)
    message = tmp_path / "message.md"
    message.write_text(TEXT)
    for session in ("session-01Abc", "01Abc", "session_", "session_01 Abc", "session_01Abc;id"):
        argv = ["say", session, "--file", str(message), "--elapsed", "25/60"]
        assert main_code(argv) == 64, session
    assert [argv for argv in no_process if argv[:2] == ["claude", "-p"]] == []


def test_d5_a_reply_that_is_not_ok_is_a_refused_send(capsys: pytest.CaptureFixture[str]) -> None:
    for reply in ('{"ok": false, "error": "session archived"}', "not json at all"):
        code, first, _ = said(capsys, send=Sender(reply))
        assert code == 2, reply
        assert first.startswith("REFUSED send-failed: "), first


def test_d6_an_ok_reply_prints_ok_sent_and_the_session(capsys: pytest.CaptureFixture[str]) -> None:
    send = Sender(json.dumps({"ok": True, "session_id": SESSION}))
    code, first, _ = said(capsys, send=send)
    assert code == 0
    assert first == f"OK sent {SESSION}"
    assert len(send.calls) == 1
