"""Ticket f2, B4: `scripts/git-hooks/pre-push` (spec 5 item 10; leakscan-cli.md 6).

The hook runs `python -m tools.leakscan range <remote-sha-or-merge-base>..<local-sha> --ref <ref>
--no-stamp` for each pushed ref, "the push is refused" on a hit, and fails closed with no corpus. It
finds the scanner through its own location, not the pushing repository. Real pushes to a local bare
remote; no network. Today the hook does not exist.
"""

import re
import subprocess
from pathlib import Path

import pytest

from ._leak import MARIGOLD, REPO, ZEBRA, Leak, assert_no_text, commit, git, temp_repo

HOOKS = REPO / "scripts/git-hooks"
HOOK = HOOKS / "pre-push"
ZEROS = "0" * 40
HIT_LINE = re.compile(r"^HIT \S+ \d+$", re.MULTILINE)


def _env(leak: Leak) -> dict[str, str]:
    env = leak.env()
    env.pop("PYTHONPATH", None)  # the hook must find tools.leakscan by its own path
    return env


def _pushing_repo(leak: Leak) -> tuple[Path, Path]:
    remote = leak.tmp / "remote.git"
    subprocess.run(["git", "init", "-q", "--bare", str(remote)], check=True, env=_env(leak))
    repo, _ = temp_repo(leak.tmp / "work")
    git(repo, "remote", "add", "origin", str(remote))
    git(repo, "push", "-q", "origin", "main")
    git(repo, "fetch", "-q", "origin")
    git(repo, "config", "core.hooksPath", str(HOOKS))
    git(repo, "checkout", "-q", "-b", "feature")
    return repo, remote


def _push(leak: Leak, repo: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "push", "origin", "feature"],
        cwd=repo,
        env=_env(leak),
        capture_output=True,
        text=True,
        check=False,
    )


def _remote_has(remote: Path, branch: str) -> bool:
    done = subprocess.run(
        ["git", "--git-dir", str(remote), "rev-parse", "--verify", "-q", f"refs/heads/{branch}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return done.returncode == 0


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def test_the_hook_is_an_executable_file() -> None:
    assert HOOK.is_file()
    assert HOOK.stat().st_mode & 0o111


def test_a_clean_push_succeeds_and_writes_no_stamp(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    done = _push(leak, repo)
    assert done.returncode == 0, done.stderr
    assert _remote_has(remote, "feature")
    assert leak.stamps() == []


def test_a_push_adding_a_string_is_refused_with_location_and_count_only(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": f"clean\n{ZEBRA}\n"}, "feat: clean message")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert not _remote_has(remote, "feature")
    output = done.stdout + done.stderr
    assert re.search(r"^(?:remote: )?HIT b\.txt:2 1$", output, re.MULTILINE), "no file:line hit line"
    assert_no_text(done)


def test_a_push_whose_message_holds_a_string_is_refused(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, f"feat: clean subject\n\n{MARIGOLD}")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert not _remote_has(remote, "feature")
    assert HIT_LINE.search(done.stdout + done.stderr)
    assert_no_text(done)


def test_a_push_whose_file_name_holds_a_string_is_refused(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {f"plans/{MARIGOLD}.txt": "clean\n"}, "feat: clean message")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert not _remote_has(remote, "feature")
    assert_no_text(done)


def test_with_no_corpus_the_hook_fails_closed(tmp_path: Path) -> None:
    leak = Leak(tmp_path)  # never built
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert not _remote_has(remote, "feature")


def _run_hook(leak: Leak, repo: Path, remote: Path, stdin: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(HOOK), "origin", str(remote)],
        cwd=repo,
        env=_env(leak),
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
    )


def test_the_hook_reads_gits_lines_for_a_new_branch_and_a_delete(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    clean = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    new_branch = f"refs/heads/feature {clean} refs/heads/feature {ZEROS}\n"
    assert _run_hook(leak, repo, remote, new_branch).returncode == 0
    main = git(repo, "rev-parse", "origin/main")
    delete = f"(delete) {ZEROS} refs/heads/old {main}\n"
    assert _run_hook(leak, repo, remote, delete).returncode == 0
    dirty = commit(repo, {"c.txt": f"{ZEBRA}\n"}, "feat: then a leak")
    done = _run_hook(leak, repo, remote, f"refs/heads/feature {dirty} refs/heads/feature {ZEROS}\n")
    assert done.returncode != 0
    assert_no_text(done)
    assert leak.stamps() == []
