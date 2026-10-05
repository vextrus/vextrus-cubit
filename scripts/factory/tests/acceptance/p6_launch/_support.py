"""Ticket T-LAUNCH's shared world: real git on a temporary bare origin and main checkout (the main
checkout is `<tmp_path>/main`, scripts/factory/tests/conftest.py), a fake `claude` and a fake `git`
placed first on PATH, and the `claude` seam. Copied in spirit from tf1's `world`, not imported."""

from __future__ import annotations

import importlib
import json
import os
import shutil
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

REPOSITORY = "github.com/vextrus/vextrus-cubit"
BRANCH = "s12-x"
TICKET = "x1"
SESSION = "session_01Cloned"
NOW = datetime(2026, 10, 5, 3, 30, 0, tzinfo=UTC)
UTC_NAME = "20261005T033000Z"
STOP = "STOP: launched wrongly. Do nothing; push nothing."
PROMPT = "Build ticket x1: PROMPT-BODY-7f3a.\nThe second line of the brief.\n"
SNAPSHOT = '{"agents": []}'
RECORD_KEYS = {
    "ticket",
    "branch",
    "where",
    "role",
    "effort",
    "model",
    "budget_minutes",
    "session_id",
    "cli_version",
    "started_at",
    "governor",
    "leak_scan",
    "judge",
    "stop_sent",
    "untestable",
    "review",
    "jev",
}
REAL_GIT = shutil.which("git") or "/usr/bin/git"
IDENTITY = ["-c", "user.name=W", "-c", "user.email=w@example.invalid", "-c", "commit.gpgsign=false"]


def cloned(revision: str = BRANCH, session: str | None = SESSION) -> str:
    """The CLI's own debug lines for a launch cloned from GitHub."""
    return (
        "[DEBUG] Selected environment: env_01x (vextrus, anthropic_cloud)\n"
        f"[DEBUG] [teleportToRemote] Git source: {REPOSITORY}, revision: {revision}\n"
        + (f"[DEBUG] Successfully created remote session: {session}\n" if session else "")
    )


# A `claude` that records every argv it is run with (one JSON line each, `--version` included),
# answers `--version` and `-p`, and writes $FAKE_CLAUDE_LOG's text to its `--debug-file`.
FAKE_CLAUDE = """\
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
with open(os.environ["FAKE_CLAUDE_CALLS"], "a", encoding="utf-8") as out:
    out.write(json.dumps(args) + "\\n")
if args[:1] == ["--version"]:
    print("9.9.9 (Claude Code)")
    sys.exit(0)
if "-p" in args:
    print(json.dumps({"ok": True}))
    sys.exit(0)
if "--debug-file" in args:
    text = Path(os.environ["FAKE_CLAUDE_LOG"]).read_text()
    Path(args[args.index("--debug-file") + 1]).write_text(text)
"""

# A `git` that runs the real one, except the subcommand named by $FAKE_GIT_SUB: that one exits 1
# ($FAKE_GIT_MODE=fail) or hangs ($FAKE_GIT_MODE=hang) until the launcher's time limit kills it.
FAKE_GIT = """\
import os, sys, time
args = sys.argv[1:]
i = 0
while i < len(args) and args[i] in ("-C", "-c"):
    i += 2
sub = args[i] if i < len(args) else ""
if sub and sub == os.environ.get("FAKE_GIT_SUB"):
    if os.environ.get("FAKE_GIT_MODE") == "hang":
        time.sleep(600)
    sys.stderr.write("fatal: unable to access 'origin': the fake git failed\\n")
    sys.exit(1)
os.execv(os.environ["REAL_GIT"], ["git", *args])
"""


def git(cwd: Path, *args: str) -> str:
    import subprocess

    done = subprocess.run(
        [REAL_GIT, *IDENTITY, "-C", str(cwd), *args], capture_output=True, text=True, check=False
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"
    return done.stdout


@dataclass
class FakeClaude:
    """The `claude` seam: records each argv; the launch writes `log` to its `--debug-file`."""

    log: str = field(default_factory=cloned)
    code: int = 0
    calls: list[list[str]] = field(default_factory=list)

    def __call__(self, argv: list[str]) -> int:
        self.calls.append(list(argv))
        if len(self.calls) == 1 and "--debug-file" in argv:
            Path(argv[argv.index("--debug-file") + 1]).write_text(self.log)
            return self.code
        return 0


@dataclass
class World:
    tmp: Path
    origin: Path
    main: Path
    prompt: Path
    home: Path
    calls_file: Path
    monkeypatch: pytest.MonkeyPatch

    def commit(self, subject: str) -> None:
        name = f"f{len(list(self.main.glob('f*.txt')))}.txt"
        (self.main / name).write_text(subject)
        git(self.main, "add", "--", name)
        git(self.main, "commit", "-q", "-m", subject)

    def push_branch(self, branch: str, *, acceptance: bool) -> None:
        git(self.main, "checkout", "-q", "-b", branch, "main")
        self.commit("feat: some work")
        if acceptance:
            self.commit("acceptance: x1 pins the work")
        git(self.main, "push", "-q", "origin", branch)
        git(self.main, "checkout", "-q", "main")

    @property
    def records(self) -> Path:
        return self.tmp / "records"

    def argv(self, *extra: str, branch: str = BRANCH) -> list[str]:
        return [
            "--branch",
            branch,
            "--prompt-file",
            str(self.prompt),
            "--ticket",
            TICKET,
            "--effort",
            "medium",
            "--record-dir",
            str(self.records),
            *extra,
        ]

    def record_files(self) -> list[Path]:
        if not self.records.exists():
            return []
        return sorted(p for p in self.records.glob("*.json") if not p.name.endswith(".agents.json"))

    def only_record(self) -> dict[str, object]:
        files = self.record_files()
        assert len(files) == 1, [p.name for p in files]
        loaded: dict[str, object] = json.loads(files[0].read_text())
        return loaded

    def claude_calls(self) -> list[list[str]]:
        if not self.calls_file.exists():
            return []
        return [json.loads(line) for line in self.calls_file.read_text().splitlines() if line]

    def fake_git(self, sub: str, mode: str = "fail") -> None:
        """From now on `git <sub>` fails (or hangs); every other git command is the real one."""
        self.monkeypatch.setenv("FAKE_GIT_SUB", sub)
        self.monkeypatch.setenv("FAKE_GIT_MODE", mode)


def _executable(path: Path, body: str) -> None:
    path.write_text(f"#!{sys.executable}\n{body}")
    path.chmod(0o755)


def make_world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    home = tmp_path / "home"
    (home / ".claude").mkdir(parents=True)
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)
    monkeypatch.delenv("FAKE_GIT_SUB", raising=False)
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _executable(bin_dir / "claude", FAKE_CLAUDE)
    _executable(bin_dir / "git", FAKE_GIT)
    calls = tmp_path / "claude-calls.jsonl"
    launch_log = tmp_path / "launch-log.txt"
    launch_log.write_text(cloned())
    monkeypatch.setenv("FAKE_CLAUDE_CALLS", str(calls))
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(launch_log))
    monkeypatch.setenv("REAL_GIT", REAL_GIT)
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")

    origin = tmp_path / "origin.git"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(origin))
    main = tmp_path / "main"
    git(tmp_path, "init", "-q", "-b", "main", str(main))
    git(main, "remote", "add", "origin", str(origin))
    prompt = tmp_path / "prompt.md"
    prompt.write_text(PROMPT)
    made = World(tmp_path, origin, main, prompt, home, calls, monkeypatch)
    made.commit("chore: the first commit")
    git(main, "push", "-q", "-u", "origin", "main")
    made.push_branch(BRANCH, acceptance=True)
    monkeypatch.chdir(main)
    return made


def ok_govern() -> object:
    from scripts.factory.launch import Reading

    return Reading(ok=True, text="disk 40 GB free; memory 9 GB free; usage 31%")


def clean_scan(prompt: str) -> object:
    from scripts.factory.launch import ScanResult

    return ScanResult(clean=True, counts="leakscan: hits=0 scanned=2 corpus=0123456789ab")


def cloud(
    world: World,
    capsys: pytest.CaptureFixture[str],
    claude: Callable[[list[str]], int],
    *extra: str,
    branch: str = BRANCH,
    root: Path | None = None,
    request: object | None = None,
    now: datetime = NOW,
    **seams: object,
) -> tuple[int, list[str]]:
    """One `launch_cloud` through the seams: (exit code, printed lines, `Outcome.line` first)."""
    launch: Any = importlib.import_module("scripts.factory.launch")

    capsys.readouterr()
    outcome = launch.launch_cloud(
        request or launch.parse_cloud(world.argv(*extra, branch=branch)),
        root=root or world.main,
        claude=claude,
        scan=clean_scan,
        govern=ok_govern,
        snapshot=lambda: SNAPSHOT,
        now=lambda: now,
        **seams,
    )
    lines = capsys.readouterr().out.splitlines()
    if not lines or lines[0] != outcome.line:
        lines = [outcome.line, *lines]
    return outcome.exit_code, lines
