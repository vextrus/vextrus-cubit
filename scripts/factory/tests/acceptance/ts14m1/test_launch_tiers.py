"""Ticket S14-M1, a builder's launch sets its row's model and effort (session 14 factory plan 3 and 8
row 1: "`launch.py` role defaults and `--role`"; acceptance: "launch of a builder sets the role's
model"). The map's two builder rows: "builder, ordinary ticket (committed tests decide, no drawings):
Sonnet 5.5, medium; high if long or multi-module" and "builder, hard (hostile input, drawing reading,
guard, ledger, security wall): Opus 5.5, high". "Set effort explicitly everywhere".

The seam assumed (the plan names `--role`, whose values are already the agent names
builder|acceptance-writer|reviewer|refuter, so the builder's row is a new option beside it):
`--tier ordinary|hard` on `launch cloud` and `launch local`, with `--effort` then optional. The tier
gives the model and the effort when `--model` or `--effort` is not given; a given one wins. A launch
with no `--tier` keeps today's contract (ticket f1's C1 and C17: `--model` defaults to
`claude-opus-5-5`, `--effort` required), so the kill switch "builders go back to Opus medium" needs no
code.

Cloud: real git against a temporary bare origin and main checkout, through f1's seams
`parse_cloud(argv)` and `launch_cloud(req, *, root, claude, scan, govern, snapshot, now)`; the built
command is the argv the `claude` seam receives, and the launch record is read beside it. Local: through
`launch_local(argv, local_run=...)`, the built command is `request.to_argv()`, what reaches
`scripts/factory/local.py`.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest

BRANCH = "s14-x"
TICKET = "x14"
SESSION = "session_01Tiered"
NOW = datetime(2026, 10, 6, 9, 0, 0, tzinfo=UTC)
UTC_NAME = "20261006T090000Z"
SONNET = "claude-sonnet-5-5"
OPUS = "claude-opus-5-5"
IDENTITY = ["-c", "user.name=Writer", "-c", "user.email=writer@example.invalid"]
LOG = (
    "[DEBUG] Selected environment: env_01x (vextrus, anthropic_cloud)\n"
    f"[DEBUG] [teleportToRemote] Git source: github.com/vextrus/vextrus-cubit, revision: {BRANCH}\n"
    f"[DEBUG] Successfully created remote session: {SESSION}\n"
)


def git(cwd: Path, *args: str) -> None:
    done = subprocess.run(
        ["git", *IDENTITY, "-c", "commit.gpgsign=false", "-C", str(cwd), *args],
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"


def commit(main: Path, subject: str) -> None:
    name = f"f{len(list(main.glob('f*.txt')))}.txt"
    (main / name).write_text(subject)
    git(main, "add", "--", name)
    git(main, "commit", "-q", "-m", subject)


@pytest.fixture
def main(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """The main checkout (`<tmp>/main`, as the package's conftest names it) with `BRANCH` on origin,
    an `acceptance:` commit ahead of main; a `claude` on PATH that only answers `--version`."""
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    fake = bin_dir / "claude"
    fake.write_text(f"#!{sys.executable}\nprint('9.9.9 (Claude Code)')\n")
    fake.chmod(0o755)
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    origin = tmp_path / "origin.git"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(origin))
    checkout = tmp_path / "main"
    git(tmp_path, "init", "-q", "-b", "main", str(checkout))
    git(checkout, "remote", "add", "origin", str(origin))
    commit(checkout, "chore: the first commit")
    git(checkout, "push", "-q", "-u", "origin", "main")
    git(checkout, "checkout", "-q", "-b", BRANCH, "main")
    commit(checkout, "acceptance: x14 pins the work")
    git(checkout, "push", "-q", "origin", BRANCH)
    git(checkout, "checkout", "-q", "main")
    monkeypatch.chdir(checkout)
    return checkout


def after(argv: list[str], name: str) -> str | None:
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else None


def launch(main: Path, *extra: str) -> tuple[list[str], dict[str, object]]:
    """Launch a builder of `TICKET` in the cloud; the argv `claude` got and the launch record."""
    from scripts.factory.launch import Reading, ScanResult, launch_cloud, parse_cloud

    prompt = main.parent / "prompt.md"
    prompt.write_text("Build ticket x14.\n")
    records = main.parent / "records"
    calls: list[list[str]] = []

    def claude(argv: list[str]) -> int:
        calls.append(list(argv))
        if len(calls) == 1:
            Path(argv[argv.index("--debug-file") + 1]).write_text(LOG)
        return 0

    request = parse_cloud(
        [
            *("--branch", BRANCH, "--prompt-file", str(prompt), "--ticket", TICKET),
            *("--record-dir", str(records), *extra),
        ]
    )
    outcome = launch_cloud(
        request,
        root=main,
        claude=claude,
        scan=lambda text: ScanResult(clean=True, counts="leakscan: hits=0 scanned=2 corpus=0"),
        govern=lambda: Reading(ok=True, text="disk 40 GB free; memory 9 GB free; usage 31%"),
        snapshot=lambda: '{"agents": []}',
        now=lambda: NOW,
    )
    assert outcome.exit_code == 0, outcome.line
    record: dict[str, object] = json.loads((records / f"{TICKET}-{UTC_NAME}.json").read_text())
    return calls[0], record


def test_an_ordinary_builder_launches_on_sonnet_at_medium(main: Path) -> None:
    argv, record = launch(main, "--tier", "ordinary")
    assert (after(argv, "--model"), after(argv, "--effort")) == (SONNET, "medium"), argv
    assert (record["role"], record["model"], record["effort"]) == ("builder", SONNET, "medium")


def test_a_hard_builder_launches_on_opus_at_high(main: Path) -> None:
    argv, record = launch(main, "--tier", "hard")
    assert (after(argv, "--model"), after(argv, "--effort")) == (OPUS, "high"), argv
    assert (record["role"], record["model"], record["effort"]) == ("builder", OPUS, "high")


def test_a_long_ordinary_builder_given_high_keeps_sonnet_at_high(main: Path) -> None:
    argv, record = launch(main, "--tier", "ordinary", "--effort", "high")
    assert (after(argv, "--model"), after(argv, "--effort")) == (SONNET, "high"), argv
    assert (record["model"], record["effort"]) == (SONNET, "high")


def local_argv(tier: str) -> list[str]:
    """What `launch local --tier <tier>` (no --model, no --effort) hands to the local launcher."""
    from scripts.factory.launch import LocalRequest, launch_local

    handed: list[list[str]] = []

    def local_run(request: LocalRequest) -> int:
        handed.append(request.to_argv())
        return 0

    code = launch_local(
        [
            *("--ticket", TICKET, "--branch", BRANCH, "--name", TICKET, "--prompt-file", "p.md"),
            *("--tier", tier),
        ],
        local_run=local_run,
    )
    assert code == 0
    [argv] = handed
    return argv


def test_a_local_ordinary_builder_is_handed_sonnet_at_medium() -> None:
    argv = local_argv("ordinary")
    assert (after(argv, "--model"), after(argv, "--effort")) == (SONNET, "medium"), argv


def test_a_local_hard_builder_is_handed_opus_at_high() -> None:
    argv = local_argv("hard")
    assert (after(argv, "--model"), after(argv, "--effort")) == (OPUS, "high"), argv
