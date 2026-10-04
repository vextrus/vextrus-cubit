"""The review ledger's edges the acceptance tests leave open: a failed post writes nothing, a round
already recorded cannot be recorded again lower, and the default leak scan fails closed."""

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.ledger import main

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
H2 = "2f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"


@pytest.fixture(autouse=True)
def local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def source(tmp_path: Path, *rows: str) -> Path:
    path = tmp_path / "final.txt"
    path.write_text("".join(f"{row}\n" for row in rows))
    return path


def record(tmp_path: Path, store: Path, head: str, round_: int, **seams: Any) -> int:
    given = source(tmp_path, f"VERDICT: PASS at {head}")
    argv = ["record", "12", "--round", str(round_), "--head", head, "--from", str(given)]
    options: dict[str, Any] = {"scan": lambda text: 0, "post": lambda pr, body: 5, "ledger_dir": store}
    return main(argv, **(options | seams))


def boom(pr: int, body: str) -> int:
    raise OSError("gh failed")


@pytest.mark.parametrize("post", [lambda pr, body: 0, boom], ids=["no-id", "raises"])
def test_a_failed_post_writes_nothing(tmp_path: Path, post: Any) -> None:
    store = tmp_path / "ledger"
    assert record(tmp_path, store, H, 1, post=post) == 3
    assert not store.exists() or list(store.iterdir()) == []


def test_a_new_head_cannot_be_recorded_at_a_lower_round(tmp_path: Path) -> None:
    store = tmp_path / "ledger"
    assert record(tmp_path, store, H, 2) == 0
    assert record(tmp_path, store, H2, 1) == 3
    assert record(tmp_path, store, H2, 2) == 3


def test_crlf_lines_decide_like_lf(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    given = tmp_path / "final.txt"
    given.write_bytes(f"VERDICT: PASS at {H}\r\nFINDING a 10 -\r\n".encode())
    assert main(["decide", "--from", str(given), "--head", H], ledger_dir=tmp_path) == 0
    assert json.loads(capsys.readouterr().out)["verdict"] == "PASS"


@pytest.mark.parametrize(
    "argv",
    [
        ["check", "12", "--round", "1", "--exception", "crash"],
        ["check", "0", "--round", "1"],
        ["decide", "--from", "x", "--head", "main"],
        ["bogus"],
        [],
    ],
)
def test_usage_errors_exit_2(tmp_path: Path, argv: list[str]) -> None:
    assert main(argv, ledger_dir=tmp_path) == 2


def test_a_multi_line_reason_is_refused(tmp_path: Path) -> None:
    given = source(tmp_path, f"VERDICT: PASS at {H}")
    argv = ["record", "12", "--round", "3", "--head", H, "--from", str(given)]
    argv += ["--exception", "crash", "--reason", "one\ntwo"]
    assert main(argv, scan=lambda text: 0, post=lambda pr, body: 5, ledger_dir=tmp_path) == 3
    assert list(tmp_path.glob("12-*.json")) == []


@pytest.mark.parametrize(
    ("code", "stdout"),
    [
        (2, "leakscan: cannot-scan no-corpus\n"),
        (0, "nothing parsable\n"),
        (1, "leakscan: hits=0 scanned=1 corpus=0123456789ab\n"),
        (64, ""),
    ],
)
def test_the_default_leak_scan_fails_closed(
    monkeypatch: pytest.MonkeyPatch, code: int, stdout: str
) -> None:
    def fake(*args: Any, **kwargs: Any) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args[0], code, stdout, "")

    monkeypatch.setattr(subprocess, "run", fake)
    with pytest.raises(RuntimeError):
        ledger.leak_scan("text")


def test_the_default_leak_scan_reads_the_hit_count(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake(*args: Any, **kwargs: Any) -> subprocess.CompletedProcess[str]:
        out = "HIT stdin:1 2\nleakscan: hits=2 scanned=1 corpus=0123456789ab\n"
        return subprocess.CompletedProcess(args[0], 1, out, "")

    monkeypatch.setattr(subprocess, "run", fake)
    assert ledger.leak_scan("text") == 2
