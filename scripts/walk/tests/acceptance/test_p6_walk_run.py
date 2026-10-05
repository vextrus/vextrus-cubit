"""T-WALK-1 acceptance: playwright dies with its process group, and every walk drops its database.

The ticket (session 12 phase 6, closes #300 and #298): "Playwright is not killed by process group ...
node and chromium live on holding the web and API ports for the next walk", and "Walk databases are
never dropped. Each `vextrus_walk_<sha8>` holds data derived from real drawings in the local Postgres."
`run.drop_database(walk, log)` (the ticket pins the name) drops `vextrus_walk_<sha8>` once, after the
hold and the stack stop, connected to `postgres`, and refuses every other name.

Nothing here serves a stack or touches a database: `npx` and `psql` are stubs first on PATH, and every
other step is patched. The Plan is built by hand from a synthetic sha (no git, no clock).
"""

import ast
import contextlib
import dataclasses
import inspect
import json
import os
import re
import signal
import stat
import textwrap
import threading
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

SHA = "0123456789abcdef0123456789abcdef01234567"
DB = f"vextrus_walk_{SHA[:8]}"


def _plan(root: Path, *, smoke: bool = False) -> Any:
    from scripts.walk import run

    work = root / ".private" / "work"
    walk = run.Plan(
        sha=SHA,
        sha8=SHA[:8],
        db_name=DB,
        out_dir=work / ("walks-smoke" if smoke else "walks") / SHA,
        worktree=work / "walks" / "_src",
        web_port=5511,
        api_port=8811,
        env={
            "VEXTRUS_DB_NAME": DB,
            "VEXTRUS_WEB_PORT": "5511",
            "VEXTRUS_API_URL": "http://127.0.0.1:8811",
        },
    )
    (walk.out_dir / "logs").mkdir(parents=True)
    return walk


def _stub(bin_dir: Path, name: str, body: str) -> None:
    bin_dir.mkdir(parents=True, exist_ok=True)
    path = bin_dir / name
    path.write_text("#!/bin/sh\n" + textwrap.dedent(body))
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _on_path(monkeypatch: pytest.MonkeyPatch, bin_dir: Path) -> None:
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}")


def _gone(pid: int) -> bool:
    """No such process, or a zombie (a reparented zombie is not alive)."""
    try:
        text = Path(f"/proc/{pid}/stat").read_text()
    except OSError:
        return True
    return text.rsplit(")", 1)[1].split()[0] == "Z"


def _skip_steps(monkeypatch: pytest.MonkeyPatch, run: Any) -> None:
    for name in ("prepare_checkout", "prepare_database", "serve", "write_sign_in"):
        monkeypatch.setattr(run, name, lambda *args, **kwargs: None)


# T4 -----------------------------------------------------------------------------------------------

NPX = """\
sleep 120 &
echo $$ > "$P6_STUB_DIR/npx.pid.tmp" && mv "$P6_STUB_DIR/npx.pid.tmp" "$P6_STUB_DIR/npx.pid"
echo $! > "$P6_STUB_DIR/child.pid.tmp" && mv "$P6_STUB_DIR/child.pid.tmp" "$P6_STUB_DIR/child.pid"
wait
"""


def test_a_terminated_walk_kills_playwright_by_its_process_group(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import run

    stub_dir = tmp_path / "stub"
    _stub(stub_dir / "bin", "npx", NPX)
    _on_path(monkeypatch, stub_dir / "bin")
    monkeypatch.setenv("P6_STUB_DIR", str(stub_dir))
    _skip_steps(monkeypatch, run)
    monkeypatch.setattr(run, "drop_database", lambda *args, **kwargs: None, raising=False)
    root = tmp_path / "root"
    walk = _plan(root)
    seen: dict[str, int] = {}
    finished = threading.Event()

    def terminate() -> None:
        """SIGTERM to this process once the stub's pids are written (as the orchestrator's stop)."""
        npx_file, child_file = stub_dir / "npx.pid", stub_dir / "child.pid"
        for _ in range(3000):
            if finished.is_set():
                return
            if npx_file.exists() and child_file.exists():
                seen["npx"] = int(npx_file.read_text())
                seen["child"] = int(child_file.read_text())
                seen["child_group"] = os.getpgid(seen["child"])
                os.kill(os.getpid(), signal.SIGTERM)
                return
            time.sleep(0.01)

    # A SIGTERM that arrives after run() restored the handlers must not end the test run.
    previous = signal.signal(signal.SIGTERM, lambda signum, frame: None)
    timer = threading.Thread(target=terminate)
    try:
        timer.start()
        code = run.run(root, walk, sets={"set-a": []}, smoke=False, hold_minutes=0)
        finished.set()
        timer.join(timeout=10)

        assert code == 2
        assert {"npx", "child", "child_group"} <= set(seen), "the stub never started"
        assert seen["child_group"] != os.getpgid(0), "playwright ran in the walk's own group"
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and not all(_gone(seen[k]) for k in ("npx", "child")):
            time.sleep(0.05)
        assert _gone(seen["child"]), "playwright's child outlived the walk"
        assert _gone(seen["npx"]), "playwright outlived the walk"
    finally:
        finished.set()
        signal.signal(signal.SIGTERM, previous)
        for key in ("child", "npx"):
            if key in seen:
                with contextlib.suppress(ProcessLookupError, PermissionError):
                    os.kill(seen[key], signal.SIGKILL)


# T5 -----------------------------------------------------------------------------------------------

PSQL = """\
line="psql"
for arg in "$@"; do line="$line $arg"; done
printf '%s\\n' "$line" >> "$P6_LOG"
exit "${P6_PSQL_EXIT:-0}"
"""

TO_POSTGRES = re.compile(r"(?:\s-d\s*|\s--dbname[=\s]|dbname=)postgres(?:\s|$)")
TO_WALK_DB = re.compile(r"(?:\s-d\s*|\s--dbname[=\s]|dbname=)vextrus_walk_")


class Ledger:
    """The ordered log the patched hold, the patched stop and the psql stub write to."""

    def __init__(self, path: Path) -> None:
        self.path = path
        path.touch()

    def note(self, what: str) -> None:
        with self.path.open("a") as log:
            log.write(what + "\n")

    def lines(self) -> list[str]:
        return self.path.read_text().splitlines()

    def psql(self) -> list[str]:
        return [line for line in self.lines() if line.startswith("psql")]


def _ledger(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, run: Any) -> Ledger:
    ledger = Ledger(tmp_path / "ledger.txt")
    _stub(tmp_path / "bin", "psql", PSQL)
    _on_path(monkeypatch, tmp_path / "bin")
    monkeypatch.setenv("P6_LOG", str(ledger.path))
    monkeypatch.delenv("P6_PSQL_EXIT", raising=False)
    monkeypatch.setattr(run, "hold", lambda *args, **kwargs: ledger.note("hold"))
    monkeypatch.setattr(run.Stack, "stop", lambda self: ledger.note("stop"))
    _skip_steps(monkeypatch, run)

    def walked(root: Path, walk: Any, *args: Any, **kwargs: Any) -> int:
        record = {"schema": 1, "sha": walk.sha, "sets": {}}
        (walk.out_dir / "walk.json").write_text(json.dumps(record))
        return 0

    monkeypatch.setattr(run, "walk_spec", walked)
    monkeypatch.setattr(run, "judge_checks", lambda *args, **kwargs: True)
    return ledger


def _assert_one_drop(line: str) -> None:
    assert "DROP DATABASE" in line, line
    assert DB in line, line
    assert TO_POSTGRES.search(line), f"the drop does not connect to postgres: {line}"
    assert not TO_WALK_DB.search(line), f"the drop connects to the database it drops: {line}"


@pytest.mark.parametrize("smoke", [False, True], ids=["walk", "smoke"])
def test_a_walk_drops_its_database_once_after_the_hold_and_the_stop(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, smoke: bool
) -> None:
    from scripts.walk import run

    ledger = _ledger(tmp_path, monkeypatch, run)
    root = tmp_path / "root"
    sets: dict[str, list[str]] = {"smoke": []} if smoke else {"set-a": []}

    code = run.run(root, _plan(root, smoke=smoke), sets=sets, smoke=smoke, hold_minutes=0)

    assert code == 0
    lines = ledger.lines()
    assert len(ledger.psql()) == 1, f"the database is dropped {len(ledger.psql())} times: {lines}"
    assert lines[:-1] == ([] if smoke else ["hold"]) + ["stop"], lines
    _assert_one_drop(lines[-1])


def test_the_drop_runs_only_once_prepare_database_was_entered(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import run

    ledger = _ledger(tmp_path, monkeypatch, run)

    def fails(*args: Any, **kwargs: Any) -> None:
        raise run.WalkError("synthetic step failure")

    monkeypatch.setattr(run, "prepare_checkout", fails)
    early_root = tmp_path / "early"
    assert run.run(early_root, _plan(early_root), sets={"set-a": []}, smoke=False, hold_minutes=0) == 2
    assert ledger.psql() == [], "a walk that never made its database dropped one"

    monkeypatch.setattr(run, "prepare_checkout", lambda *args, **kwargs: None)
    monkeypatch.setattr(run, "prepare_database", fails)
    late_root = tmp_path / "late"
    assert run.run(late_root, _plan(late_root), sets={"set-a": []}, smoke=False, hold_minutes=0) == 2
    drops = ledger.psql()
    assert len(drops) == 1, f"a walk whose database step began dropped {len(drops)} times"
    _assert_one_drop(drops[0])


@pytest.mark.parametrize("passed", [True, False], ids=["pass", "fail"])
def test_a_failed_drop_is_an_event_and_never_the_walks_code(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, passed: bool
) -> None:
    from scripts.walk import run

    ledger = _ledger(tmp_path, monkeypatch, run)
    monkeypatch.setenv("P6_PSQL_EXIT", "3")
    monkeypatch.setattr(run, "judge_checks", lambda *args, **kwargs: passed)
    root = tmp_path / "root"

    code = run.run(root, _plan(root), sets={"set-a": []}, smoke=False, hold_minutes=0)

    assert code == (0 if passed else 1)
    assert len(ledger.psql()) == 1, "the drop was not tried"
    events = (root / ".private" / "work" / "factory" / "events.log").read_text()
    assert "drop failed" in events, events


# T6 -----------------------------------------------------------------------------------------------


def _drop_database(run: Any) -> Callable[..., Any]:
    drop: Callable[..., Any] | None = getattr(run, "drop_database", None)
    assert callable(drop), "run.drop_database(walk, log) is not built"
    return drop


@pytest.mark.parametrize(
    "name",
    [
        "vextrus",
        "postgres",
        "other_walk_abcd1234",
        "vextrus_walk_",
        'vextrus_walk_a"b',
        "vextrus_walk_abcd123",
        "vextrus_walk_abcd12345",
        "vextrus_walk_abcd123g",
        "vextrus_walk_abcd1234\n",
    ],
    ids=[
        "owner-db",
        "postgres",
        "foreign",
        "bare-prefix",
        "quote",
        "7-hex",
        "9-hex",
        "not-hex",
        "newline",
    ],
)
def test_the_drop_refuses_any_name_but_a_walks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str
) -> None:
    from scripts.walk import run

    ledger = _ledger(tmp_path, monkeypatch, run)
    drop = _drop_database(run)
    walk = dataclasses.replace(_plan(tmp_path / "root"), db_name=name)

    with pytest.raises(run.WalkError):
        drop(walk, tmp_path / "drop.txt")
    assert ledger.psql() == [], "psql ran for a name that is not a walk's"


def test_the_drop_accepts_a_walks_name(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from scripts.walk import run

    ledger = _ledger(tmp_path, monkeypatch, run)
    drop = _drop_database(run)

    drop(_plan(tmp_path / "root"), tmp_path / "drop.txt")

    assert len(ledger.psql()) == 1
    _assert_one_drop(ledger.psql()[0])


# T7 -----------------------------------------------------------------------------------------------


def test_walk_spec_never_shells_a_group_less_playwright() -> None:
    from scripts.walk import run

    source = inspect.getsource(run.walk_spec)
    flat = re.sub(r"\s+", "", source)
    assert 'subprocess.run(["npx"' not in flat, "walk_spec runs playwright in the walk's own group"

    called = {
        node.func.id
        for node in ast.walk(ast.parse(textwrap.dedent(source)))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    helpers = [
        inspect.getsource(value)
        for name in sorted(called)
        if inspect.isfunction(value := getattr(run, name, None)) and value.__module__ == run.__name__
    ]
    grouped = [
        text
        for text in (source, *helpers)
        if "start_new_session=True" in re.sub(r"\s+", "", text) or "killpg" in text
    ]
    assert grouped, "walk_spec neither starts playwright in its own session nor calls a helper that does"
