"""Ticket T-JEV-LAUNCH, section 3 (#260; docs/specs/factory.md J-f: "a warning, never a refusal"):
before a cloud launch, Jev reads the ticket prompt and warns when it looks like it needs real drawings
or another ticket's files. The warning is printed and recorded; it never changes the launch.

The seam is the ticket's: `launch_cloud(..., jev=<callable(state, questions)> | DEFAULT | None)`,
`None` (left out) = no call, `DEFAULT` = `scripts.factory.jev.ask(state, questions, task="launch-warn")`,
which only `launch.main` passes; `launch.JEV_WARN_AT = 0.9`; questions `needs_real_drawings` and
`needs_other_ticket`. Real git against a temporary bare origin and main checkout (the main checkout is
`<tmp_path>/main`, scripts/factory/tests/conftest.py); helpers copied from tf1's test_launch_cloud.py,
not imported. No network, no key, no `gh`.
"""

from __future__ import annotations

import importlib
import json
import os
import subprocess
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from scripts.factory.jev import Answers, Unavailable, Why

# Typed Any: the seam this ticket adds does not exist on the base, and mypy must pass there.
launch: Any = importlib.import_module("scripts.factory.launch")

REPOSITORY = "github.com/vextrus/vextrus-cubit"
BRANCH = "s12-x"
TICKET = "x1"
SESSION = "session_01Cloned"
BUNDLED_SESSION = "session_01Bundled"
NOW = datetime(2026, 10, 5, 8, 30, 0, tzinfo=UTC)
UTC_NAME = "20261005T083000Z"
STOP = "STOP: launched wrongly. Do nothing; push nothing."
PROMPT = "Build ticket x1: PROMPT-BODY-7f3a.\nThe second line of the brief.\n"
PROMPT_WORDS = ("PROMPT-BODY-7f3a", "The second line of the brief")
SNAPSHOT = '{"agents": [{"id": "a1", "state": "idle"}]}'
COUNTS = "leakscan: hits=0 scanned=2 corpus=0123456789ab"
HIT_COUNTS = "leakscan: hits=1 scanned=2 corpus=0123456789ab"
NONCE = "0123456789abcdef0123456789abcdef"
HEAD_SHA = "89abcdef0123456789abcdef0123456789abcdef"
QUESTIONS = ("needs_real_drawings", "needs_other_ticket")
NOT_ASKED = {"status": "not-asked", "warnings": [], "p": {}}
OFF = {"status": "off", "warnings": [], "p": {}}
WARNING = "JEV-DISAGREES"


def cloned(revision: str = BRANCH, session: str | None = SESSION) -> str:
    """The CLI's own debug lines for a launch cloned from GitHub."""
    return (
        "[DEBUG] Selected environment: env_01x (vextrus, anthropic_cloud)\n"
        "[DEBUG] GitHub app is installed on vextrus/vextrus-cubit\n"
        f"[DEBUG] [teleportToRemote] Git source: {REPOSITORY}, revision: {revision}\n"
        + (f"[DEBUG] Successfully created remote session: {session}\n" if session else "")
    )


BUNDLED = (
    "[DEBUG] GitHub app is not installed on vextrus/vextrus-cubit (status is null)\n"
    "[DEBUG] [teleport] phase: bundle-upload\n"
    "[DEBUG] [teleportToRemote] Bundling (reason: github_preflight_failed)\n"
    f"[DEBUG] Successfully created remote session: {BUNDLED_SESSION}\n"
)


# --- the seams -------------------------------------------------------------------------------------


@dataclass
class FakeClaude:
    """The `claude` seam: records each argv; the launch writes `log` to its `--debug-file`."""

    log: str = field(default_factory=cloned)
    calls: list[list[str]] = field(default_factory=list)

    def __call__(self, argv: list[str]) -> int:
        self.calls.append(list(argv))
        if len(self.calls) == 1 and "--debug-file" in argv:
            Path(argv[argv.index("--debug-file") + 1]).write_text(self.log)
        return 0


def answers(drawings: float, other: float) -> Answers:
    return Answers(
        {"needs_real_drawings": {"p": drawings}, "needs_other_ticket": {"p": other}},
        model="jev-1.13.0",
        input_tokens=1,
        output_tokens=1,
        latency_ms=1,
    )


@dataclass
class FakeJev:
    """The `jev` seam: answers `reply` (or raises it) and records each `(state, questions)`."""

    reply: Answers | Unavailable | Exception
    calls: list[tuple[object, object]] = field(default_factory=list)

    def __call__(self, state: object, questions: object) -> Answers | Unavailable:
        self.calls.append((state, questions))
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def clean_scan(prompt: str) -> Any:
    return launch.ScanResult(clean=True, counts=COUNTS)


def hit_scan(prompt: str) -> Any:
    return launch.ScanResult(clean=False, counts=HIT_COUNTS)


def ok_govern() -> Any:
    return launch.Reading(ok=True, text="disk 40 GB free; memory 9 GB free; usage 31%")


@dataclass
class Run:
    code: int
    lines: list[str]
    err: str

    @property
    def out(self) -> str:
        return "\n".join(self.lines)


def run_cloud(
    argv: list[str],
    capsys: pytest.CaptureFixture[str],
    *,
    root: Path,
    claude: FakeClaude,
    scan: Callable[[str], Any] = clean_scan,
    **seams: object,
) -> Run:
    """One `launch_cloud` through the seams; `jev` is passed only when the test gives it."""
    capsys.readouterr()
    outcome = launch.launch_cloud(
        launch.parse_cloud(argv),
        root=root,
        claude=claude,
        scan=scan,
        govern=ok_govern,
        snapshot=lambda: SNAPSHOT,
        now=lambda: NOW,
        **seams,
    )
    printed = capsys.readouterr()
    lines = printed.out.splitlines()
    if not lines or lines[0] != outcome.line:
        lines = [outcome.line, *lines]
    return Run(outcome.exit_code, lines, printed.err)


# --- the repositories ------------------------------------------------------------------------------

IDENTITY = [
    "-c",
    "user.name=Writer",
    "-c",
    "user.email=writer@example.invalid",
    "-c",
    "commit.gpgsign=false",
]

# A `claude` on PATH for `main`'s default runner: answers `--version`, `agents` and `-p`, and writes
# $FAKE_CLAUDE_LOG's text to its `--debug-file`, so no real CLI is ever reached.
FAKE_CLAUDE = """\
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
if args[:1] == ["--version"]:
    print("9.9.9 (Claude Code)")
    sys.exit(0)
if args[:1] == ["agents"]:
    print(json.dumps({"agents": []}))
    sys.exit(0)
if "-p" in args:
    print(json.dumps({"ok": True}))
    sys.exit(0)
if "--debug-file" in args:
    text = Path(os.environ["FAKE_CLAUDE_LOG"]).read_text()
    Path(args[args.index("--debug-file") + 1]).write_text(text)
"""


def git(cwd: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", *IDENTITY, "-C", str(cwd), *args], capture_output=True, text=True, check=False
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"
    return done.stdout


@dataclass
class World:
    tmp: Path
    origin: Path
    main: Path
    prompt: Path

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

    def records(self, name: str = "records") -> Path:
        return self.tmp / name

    def argv(self, *extra: str, branch: str = BRANCH, records: str = "records") -> list[str]:
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
            str(self.records(records)),
            *extra,
        ]

    def record(self, records: str = "records") -> dict[str, Any]:
        loaded: dict[str, Any] = json.loads(
            (self.records(records) / f"{TICKET}-{UTC_NAME}.json").read_text()
        )
        return loaded

    def written(self, records: str = "records") -> str:
        """Every file the run wrote under its record folder, as one text."""
        folder = self.records(records)
        files = sorted(p for p in folder.rglob("*") if p.is_file()) if folder.exists() else []
        return "\n".join(p.read_text(errors="replace") for p in files)


@pytest.fixture(autouse=True)
def no_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """A cloud VM carries the key: no test here may reach the real Jev."""
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    fake = bin_dir / "claude"
    fake.write_text(f"#!{sys.executable}\n{FAKE_CLAUDE}")
    fake.chmod(0o755)
    launch_log = tmp_path / "launch-log.txt"
    launch_log.write_text(cloned())
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(launch_log))
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")

    origin = tmp_path / "origin.git"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(origin))
    main = tmp_path / "main"
    git(tmp_path, "init", "-q", "-b", "main", str(main))
    git(main, "remote", "add", "origin", str(origin))
    prompt = tmp_path / "prompt.md"
    prompt.write_text(PROMPT)
    made = World(tmp_path, origin, main, prompt)
    made.commit("chore: the first commit")
    git(main, "push", "-q", "-u", "origin", "main")
    made.push_branch(BRANCH, acceptance=True)
    monkeypatch.chdir(main)
    return made


def without_log(call: list[str]) -> list[str]:
    """A launch argv less its `--debug-file` path (each run's record folder differs)."""
    return [*call[:2], *call[3:]]


def warning_lines(run: Run) -> list[str]:
    return [line for line in run.lines if line.startswith(WARNING)]


# --- 1 to 7 ----------------------------------------------------------------------------------------


def test_1_a_disagreement_is_printed_and_recorded_and_the_launch_is_unchanged(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    plain = FakeClaude()
    done = run_cloud(world.argv(records="plain"), capsys, root=world.main, claude=plain, jev=None)
    assert done.code == 0, done.out

    claude = FakeClaude()
    jev = FakeJev(answers(0.97, 0.2))
    done = run_cloud(world.argv(), capsys, root=world.main, claude=claude, jev=jev)
    assert done.code == 0, done.out
    assert done.lines[0].startswith("OK "), done.lines
    assert done.lines[-1].startswith("record: "), done.lines
    warned = [i for i, line in enumerate(done.lines) if line.startswith(WARNING)]
    assert len(warned) == 1, done.lines
    line = done.lines[warned[0]]
    assert 0 < warned[0] < len(done.lines) - 1, done.lines
    assert line.startswith(f"{WARNING} needs-real-drawings"), line
    assert "0.97" in line, line
    assert world.record()["jev"] == {
        "status": "ok",
        "warnings": ["needs-real-drawings"],
        "p": {"needs_real_drawings": 0.97, "needs_other_ticket": 0.2},
    }
    assert len(jev.calls) == 1
    assert len(claude.calls) == 1
    assert without_log(claude.calls[0]) == without_log(plain.calls[0])


def test_2_below_the_line_nothing_is_warned_and_the_line_itself_warns(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    assert launch.JEV_WARN_AT == 0.9

    done = run_cloud(
        world.argv(records="below"),
        capsys,
        root=world.main,
        claude=FakeClaude(),
        jev=FakeJev(answers(0.89, 0.89)),
    )
    assert done.code == 0, done.out
    assert warning_lines(done) == []
    assert world.record("below")["jev"]["warnings"] == []

    done = run_cloud(
        world.argv(records="at"),
        capsys,
        root=world.main,
        claude=FakeClaude(),
        jev=FakeJev(answers(0.89, 0.9)),
    )
    assert done.code == 0, done.out
    assert [line.split()[:2] for line in warning_lines(done)] == [[WARNING, "needs-other-ticket"]]
    assert world.record("at")["jev"]["warnings"] == ["needs-other-ticket"]

    done = run_cloud(
        world.argv(records="both"),
        capsys,
        root=world.main,
        claude=FakeClaude(),
        jev=FakeJev(answers(0.91, 0.99)),
    )
    assert done.code == 0, done.out
    assert [line.split()[:2] for line in warning_lines(done)] == [
        [WARNING, "needs-real-drawings"],
        [WARNING, "needs-other-ticket"],
    ]
    assert world.record("both")["jev"]["warnings"] == ["needs-real-drawings", "needs-other-ticket"]


def test_3_unavailable_or_a_failing_jev_is_recorded_and_changes_nothing(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    replies: dict[str, Answers | Unavailable | Exception] = {
        "no_key": Unavailable(Why.NO_KEY),
        "timed_out": Unavailable(Why.TIMED_OUT),
        "failed": RuntimeError("the Jev seam broke"),
    }
    launches = []
    for why, reply in replies.items():
        claude = FakeClaude()
        done = run_cloud(
            world.argv(records=why), capsys, root=world.main, claude=claude, jev=FakeJev(reply)
        )
        assert done.code == 0, (why, done.out)
        assert done.lines[0].startswith("OK "), (why, done.lines)
        assert warning_lines(done) == [], why
        assert world.record(why)["jev"] == {
            "status": "unavailable",
            "why": why,
            "warnings": [],
            "p": {},
        }
        assert len(claude.calls) == 1, why
        launches.append(without_log(claude.calls[0]))

    claude = FakeClaude()
    done = run_cloud(world.argv(records="off"), capsys, root=world.main, claude=claude, jev=None)
    assert done.code == 0, done.out
    assert warning_lines(done) == []
    assert world.record("off")["jev"] == OFF
    assert len(claude.calls) == 1
    assert all(argv == without_log(claude.calls[0]) for argv in launches)


def test_4_a_refusal_after_the_call_keeps_its_code_and_carries_the_reading(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude(log=BUNDLED)
    jev = FakeJev(answers(0.95, 0.1))
    done = run_cloud(world.argv(), capsys, root=world.main, claude=claude, jev=jev)
    assert done.code == 2, done.out
    assert done.lines[0].startswith("REFUSED bundled: "), done.lines
    assert len(jev.calls) == 1
    assert len(claude.calls) == 2
    assert claude.calls[1] == [
        "claude",
        "-p",
        STOP,
        "--cloud",
        BUNDLED_SESSION,
        "--output-format",
        "json",
    ]
    record = world.record()
    assert record["stop_sent"] is True
    assert record["judge"]["code"] == "bundled"
    assert record["jev"] == {
        "status": "ok",
        "warnings": ["needs-real-drawings"],
        "p": {"needs_real_drawings": 0.95, "needs_other_ticket": 0.1},
    }


def test_4_a_refusal_before_the_call_never_asks_jev(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    jev = FakeJev(answers(0.95, 0.95))
    claude = FakeClaude()
    done = run_cloud(
        world.argv(records="leak"), capsys, root=world.main, claude=claude, scan=hit_scan, jev=jev
    )
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED prompt-leak: "), done.lines
    assert world.record("leak")["jev"] == NOT_ASKED

    world.push_branch("s12-bare", acceptance=False)
    done = run_cloud(
        world.argv(branch="s12-bare", records="bare"),
        capsys,
        root=world.main,
        claude=claude,
        jev=jev,
    )
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED no-acceptance-commit: "), done.lines
    assert world.record("bare")["jev"] == NOT_ASKED
    assert jev.calls == []
    assert claude.calls == []
    assert warning_lines(done) == []


def test_5_jev_is_sent_the_prompt_file_alone_and_two_noul_questions(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    jev = FakeJev(answers(0.1, 0.1))
    done = run_cloud(world.argv(), capsys, root=world.main, claude=FakeClaude(), jev=jev)
    assert done.code == 0, done.out
    assert len(jev.calls) == 1
    state, questions = jev.calls[0]
    assert state == PROMPT
    assert isinstance(questions, dict)
    assert list(questions) == list(QUESTIONS)
    for name, question in questions.items():
        assert isinstance(question, dict), name
        assert set(question) == {"kind", "text"}, name
        assert question["kind"] == "noul", name
        assert isinstance(question["text"], str), name
        assert question["text"].strip(), name


def test_5_a_review_launch_never_asks_jev_and_never_shows_the_nonce(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    review_branch = f"review/12-{NONCE[:8]}"
    world.push_branch(review_branch, acceptance=False)
    review = world.tmp / "review.json"
    review.write_text(json.dumps({"pr": 12, "head_sha": HEAD_SHA, "nonce": NONCE}))
    world.prompt.write_text(f"Review PR 12 at {HEAD_SHA}; your nonce is {NONCE}.\n{PROMPT}")
    for role in ("reviewer", "refuter"):
        jev = FakeJev(answers(0.97, 0.97))
        argv = world.argv(
            "--role", role, "--review-file", str(review), branch=review_branch, records=role
        )
        done = run_cloud(
            argv, capsys, root=world.main, claude=FakeClaude(log=cloned(review_branch)), jev=jev
        )
        assert done.code == 0, (role, done.out)
        assert jev.calls == [], role
        recorded = world.record(role)["jev"]
        assert recorded == NOT_ASKED, role
        assert NONCE not in json.dumps(recorded), role
        assert NONCE not in done.out + done.err, role
        assert warning_lines(done) == [], role


def test_6_jev_comes_after_a_clean_leak_scan_and_the_prompt_is_never_shown(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    jev = FakeJev(answers(0.97, 0.97))
    done = run_cloud(
        world.argv(records="hit"), capsys, root=world.main, claude=FakeClaude(), scan=hit_scan, jev=jev
    )
    assert done.code == 2
    assert jev.calls == []

    for name, reply in (
        ("ok", answers(0.97, 0.97)),
        ("down", Unavailable(Why.TIMED_OUT)),
        ("raised", RuntimeError(PROMPT)),
    ):
        jev = FakeJev(reply)
        done = run_cloud(world.argv(records=name), capsys, root=world.main, claude=FakeClaude(), jev=jev)
        assert done.code == 0, (name, done.out)
        assert len(jev.calls) == 1, name
        shown = done.out + done.err + world.written(name)
        for words in PROMPT_WORDS:
            assert words not in shown, (name, words)
        state = jev.calls[0][0]
        assert isinstance(state, str)
        for state_line in state.splitlines():
            assert state_line not in shown, (name, state_line)


def test_7_main_wires_the_real_ask_and_launch_cloud_alone_never_calls_it(
    world: World, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    jev_module: Any = importlib.import_module("scripts.factory.jev")
    asked: list[dict[str, Any]] = []

    def spy(state: object, questions: object, **options: Any) -> Answers | Unavailable:
        asked.append({"state": state, "questions": questions, **options})
        return answers(0.1, 0.1)

    monkeypatch.setattr(jev_module, "ask", spy)

    done = run_cloud(world.argv(records="direct"), capsys, root=world.main, claude=FakeClaude())
    assert done.code == 0, done.out
    assert asked == []
    assert world.record("direct")["jev"] == OFF

    capsys.readouterr()
    argv = world.argv(
        "--preflight",
        "df: 41G avail; free: 9.1Gi",
        "--prompt-scanned",
        "lits2: 0 literals",
        records="via-main",
    )
    try:
        code = launch.main(["cloud", *argv])
    except SystemExit as stopped:
        code = stopped.code if isinstance(stopped.code, int) else 1
    lines = capsys.readouterr().out.splitlines()
    assert code == 0, lines
    assert lines[0].startswith("OK "), lines
    assert len(asked) == 1, asked
    assert asked[0]["task"] == "launch-warn"
    assert asked[0]["state"] == PROMPT
    # `main` runs on the real clock: its one record is read by shape, not by the fixed name.
    files = [p for p in world.records("via-main").glob(f"{TICKET}-*.json") if ".agents." not in p.name]
    assert len(files) == 1, files
    assert json.loads(files[0].read_text())["jev"]["status"] == "ok"
