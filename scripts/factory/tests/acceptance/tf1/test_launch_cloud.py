"""Ticket f1, section 3 C: `python -m scripts.factory.launch cloud` refuses a launch that cannot be
trusted, runs exactly the proven argv, judges the CLI's debug log, sends STOP to a session it refuses
and writes the launch record (docs/specs/factory/contracts/launch-cli.md 1, 2 and 5; the ticket's 4.2).

Real git against a temporary bare origin, a temporary main checkout and a linked worktree. The CLI,
the leak scan, the governor, the agents snapshot and the clock are the seams of the ticket's 4.2:
`launch_cloud(req, *, root, claude, scan, govern, snapshot, now) -> Outcome(exit_code, line, session)`.

Pinned here beyond the ticket's words (the writer's choices, said in the report):
- `parse_cloud(argv) -> CloudRequest`, the twin of the ticket's `parse_local`: the `cloud`
  subcommand's arguments without the word `cloud`. A usage error is exit 64, raised as
  `SystemExit(64)` by the parser or returned as `Outcome(64, ...)` by `launch_cloud`; either passes.
- The run's printed lines are `launch_cloud`'s: the first line may be printed or only returned as
  `Outcome.line`, but `DELETE <id>` and `record: <path>` are printed by `launch_cloud` itself (the
  Outcome carries no record path).
- The `claude` seam carries only the launch and the STOP; `claude --version` is read some other way.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from scripts.factory.launch import Reading, ScanResult

REPOSITORY = "github.com/vextrus/vextrus-cubit"
BRANCH = "s12-x"
TICKET = "x1"
SESSION = "session_01Cloned"
BUNDLED_SESSION = "session_01Bundled"
NOW = datetime(2026, 10, 4, 21, 30, 0, tzinfo=UTC)
UTC_NAME = "20261004T213000Z"
STOP = "STOP: launched wrongly. Do nothing; push nothing."
PROMPT = "Build ticket x1: PROMPT-BODY-7f3a.\nThe second line of the brief.\n"
SNAPSHOT = '{"agents": [{"id": "a1", "state": "idle"}]}'
COUNTS = "leakscan: hits=0 scanned=2 corpus=0123456789ab"
HIT_COUNTS = "leakscan: hits=1 scanned=2 corpus=0123456789ab"
NONCE = "0123456789abcdef0123456789abcdef"
HEAD_SHA = "89abcdef0123456789abcdef0123456789abcdef"
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
}


def cloned(revision: str = BRANCH, repository: str = REPOSITORY, session: str | None = SESSION) -> str:
    """The CLI's debug lines for a launch cloned from GitHub (read 29 Sep; environment line 4 Oct)."""
    return (
        "[DEBUG] Selected environment: env_01x (vextrus, anthropic_cloud)\n"
        "[DEBUG] GitHub app is installed on vextrus/vextrus-cubit\n"
        f"[DEBUG] [teleportToRemote] Git source: {repository}, revision: {revision}\n"
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


def clean_scan(prompt: str) -> ScanResult:
    from scripts.factory.launch import ScanResult

    return ScanResult(clean=True, counts=COUNTS)


def hit_scan(prompt: str) -> ScanResult:
    from scripts.factory.launch import ScanResult

    return ScanResult(clean=False, counts=HIT_COUNTS)


def ok_govern() -> Reading:
    from scripts.factory.launch import Reading

    return Reading(ok=True, text="disk 40 GB free; memory 9 GB free; usage 31%")


@dataclass
class Run:
    code: int
    lines: list[str]
    err: str

    @property
    def out(self) -> str:
        return "\n".join(self.lines)


Scan = Callable[[str], "ScanResult"]
Govern = Callable[[], "Reading"]


def run_cloud(
    argv: list[str],
    capsys: pytest.CaptureFixture[str],
    *,
    root: Path,
    claude: FakeClaude,
    scan: Scan | None = clean_scan,
    govern: Govern | None = ok_govern,
) -> Run:
    from scripts.factory.launch import launch_cloud, parse_cloud

    try:
        request = parse_cloud(argv)
    except SystemExit as stopped:
        printed = capsys.readouterr()
        return Run(
            stopped.code if isinstance(stopped.code, int) else 1, printed.out.splitlines(), printed.err
        )
    outcome = launch_cloud(
        request,
        root=root,
        claude=claude,
        scan=scan,
        govern=govern,
        snapshot=lambda: SNAPSHOT,
        now=lambda: NOW,
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

    def record(self, records: str = "records") -> dict[str, object]:
        loaded: dict[str, object] = json.loads(
            (self.records(records) / f"{TICKET}-{UTC_NAME}.json").read_text()
        )
        return loaded


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    # A `claude` on PATH that answers `--version` and nothing else, so no real CLI is ever reached.
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    fake = bin_dir / "claude"
    fake.write_text(f"#!{sys.executable}\nimport sys\nprint('9.9.9 (Claude Code)')\n")
    fake.chmod(0o755)
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


def launch_argv(call: list[str]) -> dict[str, str]:
    return {"log": call[2], "model": call[4], "effort": call[6], "branch": call[8], "prompt": call[10]}


# --- C1 to C18 -------------------------------------------------------------------------------------


def test_c1_runs_exactly_the_proven_argv(world: World, capsys: pytest.CaptureFixture[str]) -> None:
    claude = FakeClaude()
    done = run_cloud(world.argv(), capsys, root=world.main, claude=claude)
    assert done.code == 0, done.out
    call = claude.calls[0]
    assert len(call) == 11
    assert [call[0], call[1], call[3], call[5], call[7], call[9]] == [
        "claude",
        "--debug-file",
        "--model",
        "--effort",
        "--on-branch",
        "--cloud",
    ]
    assert launch_argv(call)["model"] == "claude-opus-5-5"
    assert launch_argv(call)["effort"] == "medium"
    assert launch_argv(call)["branch"] == BRANCH

    claude = FakeClaude()
    argv = world.argv("--model", "claude-sonnet-5-5", records="other")
    argv[argv.index("medium")] = "high"
    done = run_cloud(argv, capsys, root=world.main, claude=claude)
    assert done.code == 0, done.out
    assert launch_argv(claude.calls[0])["model"] == "claude-sonnet-5-5"
    assert launch_argv(claude.calls[0])["effort"] == "high"


def test_c2_the_prompt_starts_with_the_origin_and_branch_check_and_ends_with_the_file(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude()
    assert run_cloud(world.argv(), capsys, root=world.main, claude=claude).code == 0
    prompt = launch_argv(claude.calls[0])["prompt"]
    assert prompt.endswith(PROMPT)
    preamble = prompt.removesuffix(PROMPT)
    assert "git remote get-url origin" in preamble
    assert BRANCH in preamble
    assert "stop without pushing" in preamble.lower() or "push nothing" in preamble.lower()


def test_c3_the_default_runner_hands_the_prompt_to_the_cli_byte_for_byte(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.factory.launch import default_claude

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    fake = bin_dir / "claude"
    fake.write_text(
        f"#!{sys.executable}\n"
        "import json, os, sys\n"
        "argv = [os.fsencode(a).decode('utf-8') for a in sys.argv[1:]]\n"
        "with open(os.environ['FAKE_CLAUDE_ARGV'], 'w', encoding='utf-8') as out:\n"
        "    json.dump(argv, out)\n"
    )
    fake.chmod(0o755)
    record = tmp_path / "argv.json"
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("FAKE_CLAUDE_ARGV", str(record))
    monkeypatch.setenv("SHELL", "/bin/sh")
    monkeypatch.chdir(tmp_path)
    prompt = 'It\'s "quoted" $(touch pwned) `touch pwned2` $HOME\nline two: café\n'

    default_claude(["claude", "--debug-file", str(tmp_path / "x.log"), "--cloud", prompt])

    assert json.loads(record.read_text(encoding="utf-8"))[-1] == prompt
    assert not (tmp_path / "pwned").exists()
    assert not (tmp_path / "pwned2").exists()


def test_c4_a_linked_worktree_is_refused_before_anything_runs(
    world: World, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = world.tmp / "wt"
    git(world.main, "worktree", "add", "-q", "-b", "wt-branch", str(tree))
    monkeypatch.chdir(tree)
    claude = FakeClaude()
    done = run_cloud(world.argv(), capsys, root=tree, claude=claude)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED not-main-checkout: ")
    assert claude.calls == []


def test_c5_a_stale_local_ref_does_not_stand_for_the_branch_on_origin(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    git(world.main, "update-ref", "refs/remotes/origin/s12-gone", "HEAD")
    claude = FakeClaude()
    done = run_cloud(world.argv(branch="s12-gone"), capsys, root=world.main, claude=claude)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED branch-not-on-origin: ")
    assert claude.calls == []


def test_c6_a_branch_that_only_ends_another_refs_name_is_not_on_origin(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    world.push_branch("other/s12-y", acceptance=True)
    assert "refs/heads/other/s12-y" in git(world.main, "ls-remote", "--heads", "origin", "s12-y")
    claude = FakeClaude()
    done = run_cloud(world.argv(branch="s12-y"), capsys, root=world.main, claude=claude)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED branch-not-on-origin: ")
    assert claude.calls == []


def test_c7_a_builder_branch_without_an_acceptance_commit_is_refused(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    world.push_branch("s12-bare", acceptance=False)
    claude = FakeClaude()
    done = run_cloud(world.argv(branch="s12-bare"), capsys, root=world.main, claude=claude)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED no-acceptance-commit: ")
    assert claude.calls == []

    git(world.main, "checkout", "-q", "s12-bare")
    world.commit("acceptance: x1 pins it")
    git(world.main, "push", "-q", "origin", "s12-bare")
    git(world.main, "checkout", "-q", "main")
    claude = FakeClaude(log=cloned("s12-bare"))
    done = run_cloud(
        world.argv(branch="s12-bare", records="after"), capsys, root=world.main, claude=claude
    )
    assert done.code == 0, done.out
    assert len(claude.calls) == 1


def test_c8_untestable_and_the_three_other_roles_need_no_acceptance_commit(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    world.push_branch("s12-bare", acceptance=False)
    why = "the CI matrix runs only on GitHub"
    claude = FakeClaude(log=cloned("s12-bare"))
    argv = world.argv("--untestable", why, branch="s12-bare", records="untestable")
    assert run_cloud(argv, capsys, root=world.main, claude=claude).code == 0
    assert world.record("untestable")["untestable"] == why

    for role in ("acceptance-writer", "reviewer", "refuter"):
        claude = FakeClaude(log=cloned("s12-bare"))
        argv = world.argv("--role", role, branch="s12-bare", records=role)
        done = run_cloud(argv, capsys, root=world.main, claude=claude)
        assert done.code == 0, (role, done.out)
        assert world.record(role)["role"] == role


def test_c9_a_malformed_branch_is_a_usage_error_before_any_process(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    # Not a git checkout: a check run before the argument's shape would refuse with exit 2 instead.
    monkeypatch.chdir(tmp_path)
    prompt = tmp_path / "prompt.md"
    prompt.write_text(PROMPT)
    for branch in ("-x", "a b", "a\x01b"):
        argv = [
            "--branch=" + branch,
            "--prompt-file",
            str(prompt),
            "--ticket",
            TICKET,
            "--effort",
            "medium",
        ]
        claude = FakeClaude()
        done = run_cloud(
            [*argv, "--record-dir", str(tmp_path / "r")], capsys, root=tmp_path, claude=claude
        )
        assert done.code == 64, repr(branch)
        assert claude.calls == []


def test_c10_a_leak_in_the_prompt_refuses_and_never_prints_the_prompt(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude()
    done = run_cloud(world.argv(), capsys, root=world.main, claude=claude, scan=hit_scan)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED prompt-leak: ")
    assert HIT_COUNTS in done.out
    assert claude.calls == []
    assert "PROMPT-BODY-7f3a" not in done.out + done.err
    for written in world.records().rglob("*") if world.records().exists() else []:
        assert "PROMPT-BODY-7f3a" not in written.read_text(errors="replace")


def test_c11_no_scanner_needs_the_interim_count_line(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude()
    done = run_cloud(world.argv(), capsys, root=world.main, claude=claude, scan=None)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED leakscan-unavailable: ")
    assert claude.calls == []

    line = "lits2: 0 literals in 214 lines"
    argv = world.argv("--prompt-scanned", line, records="interim")
    assert run_cloud(argv, capsys, root=world.main, claude=FakeClaude(), scan=None).code == 0
    assert world.record("interim")["leak_scan"] == {"status": "interim", "line": line}

    assert run_cloud(world.argv(records="clean"), capsys, root=world.main, claude=FakeClaude()).code == 0
    scanned = world.record("clean")["leak_scan"]
    assert isinstance(scanned, dict)
    assert scanned["status"] == "clean"


def test_c12_no_governor_needs_a_preflight_and_a_governor_refusal_is_exit_3(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    from scripts.factory.launch import Reading

    claude = FakeClaude()
    done = run_cloud(world.argv(), capsys, root=world.main, claude=claude, govern=None)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED no-preflight: ")
    assert claude.calls == []

    scanned: list[str] = []

    def watched_scan(prompt: str) -> ScanResult:
        scanned.append(prompt)
        return clean_scan(prompt)

    def refusing() -> Reading:
        return Reading(ok=False, text="disk 3 GB free, under 8")

    done = run_cloud(
        world.argv(), capsys, root=world.main, claude=claude, govern=refusing, scan=watched_scan
    )
    assert done.code == 3
    assert done.lines[0] == "REFUSED governor: disk 3 GB free, under 8"
    assert claude.calls == []
    assert scanned == [], "a refusal runs nothing after it"

    lines = "df: 41G avail; free: 9.1Gi; /usage: 31% of the week"
    argv = world.argv("--preflight", lines, records="preflight")
    assert run_cloud(argv, capsys, root=world.main, claude=FakeClaude(), govern=None).code == 0
    assert lines in json.dumps(world.record("preflight")["governor"])


def _stub(root: Path, name: str, body: str) -> None:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body)


def test_c13_the_default_scan_and_governor_run_this_trees_own_tools(tmp_path: Path) -> None:
    from scripts.factory.launch import default_govern, default_scan

    assert default_scan(tmp_path) is None
    assert default_govern(tmp_path) is None

    _stub(tmp_path, "tools/__init__.py", "")
    _stub(tmp_path, "tools/leakscan/__init__.py", "")
    _stub(
        tmp_path,
        "tools/leakscan/__main__.py",
        "import sys\n"
        "assert sys.argv[1:] == ['text', '--stdin'], sys.argv\n"
        "hit = 'LEAK' in sys.stdin.read()\n"
        "print(f'leakscan: hits={int(hit)} scanned=1 corpus=0123456789ab')\n"
        "sys.exit(1 if hit else 0)\n",
    )
    scan = default_scan(tmp_path)
    assert scan is not None
    assert scan("a clean prompt\n").clean
    assert not scan("a prompt with a LEAK in it\n").clean

    _stub(tmp_path, "scripts/__init__.py", "")
    _stub(tmp_path, "scripts/factory/__init__.py", "")
    _stub(
        tmp_path,
        "scripts/factory/governor.py",
        "import pathlib, sys\n"
        "assert sys.argv[1:3] == ['check', 'cloud-session'], sys.argv\n"
        "mode = pathlib.Path('mode.txt').read_text().strip()\n"
        "if mode == 'crash':\n"
        "    raise RuntimeError('broken')\n"
        "print('reading: disk 40 GB free' if mode == '0' else 'over the weekly budget')\n"
        "sys.exit(int(mode))\n",
    )
    govern = default_govern(tmp_path)
    assert govern is not None
    (tmp_path / "mode.txt").write_text("0")
    reading = govern()
    assert reading.ok
    assert "reading: disk 40 GB free" in reading.text
    (tmp_path / "mode.txt").write_text("3")
    reading = govern()
    assert not reading.ok
    assert "over the weekly budget" in reading.text
    for mode in ("5", "crash"):
        (tmp_path / "mode.txt").write_text(mode)
        assert not govern().ok, mode


def test_c14_a_bundled_launch_is_refused_stopped_and_listed_for_deletion(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude(log=BUNDLED)
    done = run_cloud(world.argv(), capsys, root=world.main, claude=claude)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED bundled: ")
    assert done.lines[0].endswith(f" {BUNDLED_SESSION}")
    assert f"DELETE {BUNDLED_SESSION}" in done.lines
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
    assert BUNDLED_SESSION in (world.records() / "to-delete.txt").read_text().split()
    record = world.record()
    assert record["stop_sent"] is True
    assert record["session_id"] == BUNDLED_SESSION
    assert record["judge"] == {"ok": False, "code": "bundled", "reason": record_reason(record)}


def record_reason(record: dict[str, object]) -> object:
    judged = record["judge"]
    assert isinstance(judged, dict)
    return judged.get("reason")


def test_c15_another_revision_another_repository_or_no_source_is_refused_and_an_ok_log_passes(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    cases = {
        "wrong-revision": cloned("main"),
        "wrong-repository": cloned(repository="github.com/vextrus/vextrus"),
        "no-git-source": f"[DEBUG] Successfully created remote session: {SESSION}\n",
    }
    for code, log in cases.items():
        claude = FakeClaude(log=log)
        done = run_cloud(world.argv(records=code), capsys, root=world.main, claude=claude)
        assert done.code == 2, code
        assert done.lines[0].startswith(f"REFUSED {code}: "), done.lines[0]
        assert done.lines[0].endswith(f" {SESSION}")
        assert f"DELETE {SESSION}" in done.lines
        assert claude.calls[1:] == [
            ["claude", "-p", STOP, "--cloud", SESSION, "--output-format", "json"]
        ]
        assert SESSION in (world.records(code) / "to-delete.txt").read_text().split()
        assert world.record(code)["stop_sent"] is True

    claude = FakeClaude()
    done = run_cloud(world.argv(records="ok"), capsys, root=world.main, claude=claude)
    assert done.code == 0
    assert done.lines[0].startswith("OK ")
    assert done.lines[0].endswith(f" {SESSION}")
    assert len(claude.calls) == 1
    assert not any(line.startswith("DELETE") for line in done.lines)
    to_delete = world.records("ok") / "to-delete.txt"
    assert not to_delete.exists() or SESSION not in to_delete.read_text()


def test_c16_a_refusal_with_no_session_sends_no_stop(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude(log=cloned(session=None))
    done = run_cloud(world.argv(), capsys, root=world.main, claude=claude)
    assert done.code == 2
    assert done.lines[0].startswith("REFUSED no-session: ")
    assert len(claude.calls) == 1
    assert not any(line.startswith("DELETE") for line in done.lines)
    assert world.record()["stop_sent"] is False


def test_c17_the_launch_record_has_exactly_the_contracts_keys_and_never_the_prompt(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    claude = FakeClaude()
    done = run_cloud(world.argv("--budget-minutes", "60"), capsys, root=world.main, claude=claude)
    assert done.code == 0, done.out
    path = world.records() / f"{TICKET}-{UTC_NAME}.json"
    assert done.lines[-1].startswith("record: ")
    assert Path(done.lines[-1].removeprefix("record: ")).resolve() == path.resolve()
    text = path.read_text()
    assert "PROMPT-BODY-7f3a" not in text
    record = world.record()
    assert set(record) == RECORD_KEYS
    assert record["where"] == "cloud"
    assert record["ticket"] == TICKET
    assert record["branch"] == BRANCH
    assert record["role"] == "builder"
    assert record["effort"] == "medium"
    assert record["model"] == "claude-opus-5-5"
    assert record["budget_minutes"] == 60
    assert record["session_id"] == SESSION
    assert record["stop_sent"] is False
    assert record["untestable"] is None
    assert record["review"] is None
    judged = record["judge"]
    assert isinstance(judged, dict)
    assert set(judged) == {"ok", "code", "reason"}
    assert judged["ok"] is True
    leak = record["leak_scan"]
    assert isinstance(leak, dict)
    assert set(leak) == {"status", "line"}
    agents = world.records() / f"{TICKET}-{UTC_NAME}.agents.json"
    assert json.loads(agents.read_text()) == json.loads(SNAPSHOT)


def test_c18_a_review_launch_records_the_review_and_never_prints_the_nonce(
    world: World, capsys: pytest.CaptureFixture[str]
) -> None:
    review_branch = f"review/12-{NONCE[:8]}"
    world.push_branch(review_branch, acceptance=False)
    review = world.tmp / "review.json"
    review.write_text(json.dumps({"pr": 12, "head_sha": HEAD_SHA, "nonce": NONCE}))
    claude = FakeClaude(log=cloned(review_branch))
    argv = world.argv("--role", "reviewer", "--review-file", str(review), branch=review_branch)
    done = run_cloud(argv, capsys, root=world.main, claude=claude)
    assert done.code == 0, done.out
    assert NONCE not in done.out + done.err
    assert world.record()["review"] == {
        "pr": 12,
        "head_sha": HEAD_SHA,
        "nonce": NONCE,
        "branch": review_branch,
    }

    builder = world.argv("--review-file", str(review), branch=review_branch, records="builder")
    assert run_cloud(builder, capsys, root=world.main, claude=FakeClaude()).code == 64
    malformed = world.tmp / "malformed.json"
    malformed.write_text(json.dumps({"pr": 12, "head_sha": HEAD_SHA, "nonce": NONCE[:-1]}))
    argv = world.argv(
        "--role", "reviewer", "--review-file", str(malformed), branch=review_branch, records="bad"
    )
    claude = FakeClaude()
    assert run_cloud(argv, capsys, root=world.main, claude=claude).code == 64
    assert claude.calls == []
