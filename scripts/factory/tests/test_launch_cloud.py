"""The cloud launch's judge: a bundled session is never taken for a cloned one (sessions 05 and 06).
The six judge tests moved from scripts/tests/test_cloud_launch.py (ticket f1; their cloned log
now carries the `Selected environment` line real logs have, PR #286 round 1); the rest
pin the launcher's small pieces. The whole command is pinned by tests/acceptance/tf1/."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.factory import jev, launch
from scripts.factory.jev import Answers, Unavailable, Why
from scripts.factory.launch import (
    JEV_QUESTIONS,
    LocalRequest,
    _Proving,
    _read_review,
    jev_reading,
    judge,
    preamble,
)

REPO = "github.com/vextrus/vextrus-cubit"

# Shapes of the CLI's own debug lines, as read on 29 Sep 2026 (timestamps dropped).
BUNDLED = """
[DEBUG] Checking GitHub app installation for vextrus/vextrus-cubit
[DEBUG] GitHub app is not installed on vextrus/vextrus-cubit (status is null)
[DEBUG] [teleport] phase: bundle-upload
[DEBUG] [teleportToRemote] Bundling (reason: github_preflight_failed)
[DEBUG] Successfully created remote session: session_01Bundled
"""


def cloned(revision: str, repo: str = REPO, created: bool = True) -> str:
    return (
        "[DEBUG] GitHub app is installed on vextrus/vextrus-cubit\n"
        "[DEBUG] Selected environment: env_01x (vextrus, anthropic_cloud)\n"
        f"[DEBUG] [teleportToRemote] Git source: {repo}, revision: {revision}\n"
        + ("[DEBUG] Successfully created remote session: session_01Cloned\n" if created else "")
    )


def test_a_bundled_launch_is_refused_and_names_its_session_for_deletion() -> None:
    v = judge(BUNDLED, repository=REPO, branch="19a-takeoff-step1")
    assert not v.ok
    assert "bundled" in v.reason
    assert "github_preflight_failed" in v.reason
    assert v.session == "session_01Bundled"


def test_a_launch_cloned_at_the_tickets_branch_passes() -> None:
    v = judge(cloned("19a-takeoff-step1"), repository=REPO, branch="19a-takeoff-step1")
    assert v.ok
    assert v.session == "session_01Cloned"


def test_a_launch_cloned_at_main_instead_of_the_ticket_branch_is_refused() -> None:
    v = judge(cloned("main"), repository=REPO, branch="19a-takeoff-step1")
    assert not v.ok
    assert "main" in v.reason


def test_a_launch_of_another_repository_is_refused() -> None:
    assert not judge(cloned("x", repo="github.com/vextrus/vextrus"), repository=REPO, branch="x").ok


def test_a_log_with_no_git_source_is_refused_rather_than_trusted() -> None:
    log = "[DEBUG] Successfully created remote session: session_01X\n"
    assert not judge(log, repository=REPO, branch="x").ok


def test_a_clone_with_no_session_created_is_refused() -> None:
    assert not judge(cloned("x", created=False), repository=REPO, branch="x").ok


# --- the pieces ------------------------------------------------------------------------------------


def test_each_refusal_carries_its_contract_code() -> None:
    assert judge(BUNDLED, repository=REPO, branch="x").code == "bundled"
    assert judge(cloned("main"), repository=REPO, branch="x").code == "wrong-revision"
    assert (
        judge(cloned("x", repo="github.com/a/b"), repository=REPO, branch="x").code == "wrong-repository"
    )
    assert judge("", repository=REPO, branch="x").code == "no-git-source"
    assert judge(cloned("x", created=False), repository=REPO, branch="x").code == "no-session"


def test_the_preamble_names_the_remote_and_the_branch() -> None:
    text = preamble("s12-x", REPO)
    assert "git remote get-url origin" in text
    assert "`s12-x`" in text
    assert REPO in text


def test_a_review_file_must_hold_exactly_its_three_fields(tmp_path: Path) -> None:
    path = tmp_path / "review.json"
    good = {"pr": 3, "head_sha": "a" * 40, "nonce": "b" * 32}
    path.write_text(json.dumps(good))
    review = _read_review(path)
    assert review is not None
    assert review.branch == "review/3-bbbbbbbb"
    for bad in ({**good, "pr": True}, {**good, "head_sha": "A" * 40}, {**good, "extra": 1}):
        path.write_text(json.dumps(bad))
        assert _read_review(path) is None, bad
    assert _read_review(tmp_path / "missing.json") is None


def test_an_unproven_cli_is_one_launch_at_a_time_and_an_ok_proves_it(tmp_path: Path) -> None:
    first, second = _Proving(tmp_path, "9.9.9"), _Proving(tmp_path, "9.9.9")
    assert not first.proven()
    assert first.acquire()
    assert not second.acquire()
    first.release(ok=False)
    assert not first.proven()
    assert second.acquire()
    second.release(ok=True)
    assert _Proving(tmp_path, "9.9.9").proven()


def test_the_local_request_hands_on_only_the_options_given() -> None:
    request = LocalRequest("f2", "s12-f2", "high", "f2", Path("p.md"))
    assert request.to_argv() == [
        "--ticket",
        "f2",
        "--branch",
        "s12-f2",
        "--effort",
        "high",
        "--name",
        "f2",
        "--prompt-file",
        "p.md",
    ]


def test_a_log_with_no_selected_environment_is_refused_by_default() -> None:
    log = cloned("x").replace("[DEBUG] Selected environment: env_01x (vextrus, anthropic_cloud)\n", "")
    verdict = judge(log, repository=REPO, branch="x")
    assert (verdict.ok, verdict.code) == (False, "wrong-environment")


def test_jev_reading_warns_at_the_line_and_names_every_outage() -> None:
    def answering(p: float) -> Answers:
        return Answers(
            {name: {"p": p} for name in JEV_QUESTIONS},
            model="jev",
            input_tokens=1,
            output_tokens=1,
            latency_ms=1,
        )

    def broken(state: str, questions: object) -> Answers:
        raise ValueError(state)

    both = ["needs-real-drawings", "needs-other-ticket"]
    assert jev_reading("t", lambda s, q: answering(0.9))["warnings"] == both
    assert jev_reading("t", lambda s, q: answering(0.8999))["warnings"] == []
    down = jev_reading("t", lambda s, q: Unavailable(Why.NO_KEY))
    assert down == {"status": "unavailable", "why": "no_key", "warnings": [], "p": {}}
    assert jev_reading("t", broken) == {
        "status": "unavailable",
        "why": "failed",
        "warnings": [],
        "p": {},
    }


# A `claude` on PATH for `main`'s default runner: `--version`, `agents`, and a launch that writes
# $FAKE_CLAUDE_LOG's text to its `--debug-file`.
FAKE_CLI = """\
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
if args[:1] == ["--version"]:
    print("9.9.9 (Claude Code)")
elif args[:1] == ["agents"]:
    print(json.dumps({"agents": []}))
elif "--debug-file" in args:
    text = Path(os.environ["FAKE_CLAUDE_LOG"]).read_text()
    Path(args[args.index("--debug-file") + 1]).write_text(text)
"""


def _stats(paths: tuple[Path, ...]) -> list[tuple[int, int] | None]:
    """Size and mtime of each path, None when absent; never a walk (the real folder is huge)."""
    return [(p.stat().st_size, p.stat().st_mtime_ns) if p.exists() else None for p in paths]


def test_main_cloud_reaches_the_tests_jev_and_writes_nothing_outside_tmp_path(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    main_checkout: Path,
    no_jev_key: list[tuple[object, object]],
) -> None:
    """`launch.main` passes the real seam; under these tests it reaches conftest's fake, and neither
    Jev's log and cache nor the launch record lands in the checkout's own factory folder."""
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")

    def git(cwd: Path, *args: str) -> None:
        who = ["-c", "user.name=W", "-c", "user.email=w@example.invalid", "-c", "commit.gpgsign=false"]
        subprocess.run(["git", *who, "-C", str(cwd), *args], check=True, capture_output=True)

    origin = tmp_path / "origin.git"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(origin))
    git(tmp_path, "init", "-q", "-b", "main", str(main_checkout))
    git(main_checkout, "remote", "add", "origin", str(origin))
    git(main_checkout, "commit", "-q", "--allow-empty", "-m", "first")
    git(main_checkout, "push", "-q", "origin", "main")
    git(main_checkout, "checkout", "-q", "-b", "s12-z")
    git(main_checkout, "commit", "-q", "--allow-empty", "-m", "acceptance: z pins it")
    git(main_checkout, "push", "-q", "origin", "s12-z")
    git(main_checkout, "checkout", "-q", "main")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "claude").write_text(f"#!{sys.executable}\n{FAKE_CLI}")
    (bin_dir / "claude").chmod(0o755)
    (tmp_path / "launch-log.txt").write_text(cloned("s12-z"))
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(tmp_path / "launch-log.txt"))
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.chdir(main_checkout)
    prompt = tmp_path / "prompt.md"
    prompt.write_text("the brief\n")

    # What `jev.ask` writes in the real checkout: its log, and a cache file (adding one changes the
    # cache folder's own mtime, read without listing it).
    checkout = Path(__file__).resolve().parents[3] / ".private" / "work" / "factory"
    touched = (checkout / "jev.log", checkout / "jev-cache")
    before = _stats(touched)
    code = launch.main(
        [
            "cloud",
            *("--branch", "s12-z", "--prompt-file", str(prompt), "--ticket", "z1"),
            *("--effort", "medium", "--record-dir", str(tmp_path / "records")),
            *("--preflight", "df ok", "--prompt-scanned", "lits2: 0 literals"),
        ]
    )
    assert code == 0
    assert no_jev_key == [("the brief\n", JEV_QUESTIONS)]
    assert jev.factory_dir().is_relative_to(tmp_path)
    assert _stats(touched) == before
    (record,) = (tmp_path / "records").glob("z1-*Z.json")
    assert json.loads(record.read_text())["jev"]["why"] == "no_key"
