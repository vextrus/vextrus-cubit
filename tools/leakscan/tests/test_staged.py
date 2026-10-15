"""`staged` (S29-F2b): what `git commit` would add, scanned before the commit by the shift-left hook.

Every corpus string is invented (`_leak.py`); every repository is made in the test's temporary folder.
"""

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from tools.leakscan.tests.acceptance._leak import (
    MARIGOLD,
    ZEBRA,
    Leak,
    assert_no_text,
    commit,
    git,
    hits,
    temp_repo,
)


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def test_a_staged_line_is_a_hit_by_path_and_line_and_no_stamp_is_written(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    (repo / "notes.md").write_text(f"clean\nmade for {ZEBRA}\n")
    git(repo, "add", "notes.md")
    done = leak.run("staged", cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [("notes.md:2", 1)]
    assert leak.stamps() == []
    assert_no_text(done)


def test_only_the_index_is_judged_not_the_working_tree(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    (repo / "clean.md").write_text("clean\n")
    git(repo, "add", "clean.md")
    (repo / "untracked.md").write_text(f"{ZEBRA}\n")
    done = leak.run("staged", cwd=repo)
    assert done.returncode == 0, done.stdout


def test_the_message_file_is_scanned_by_message_line(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    message = leak.tmp / "message"
    message.write_text(f"docs: a note\n\nfor {MARIGOLD}\n")
    done = leak.run("staged", "--message-file", str(message), cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [("message:3", 1)]
    assert_no_text(done)


def test_a_staged_file_name_is_a_hit_by_index(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    (repo / f"{MARIGOLD}.md").write_text("clean\n")
    git(repo, "add", ".")
    done = leak.run("staged", cwd=repo)
    assert done.returncode == 1
    assert ("name:0", 1) in hits(done)
    assert_no_text(done)


def test_git_index_file_is_the_index_judged(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    (repo / "notes.md").write_text(f"{ZEBRA}\n")
    copy = leak.tmp / "index-copy"
    shutil.copyfile(repo / ".git/index", copy)
    env = {**leak.env(), "GIT_INDEX_FILE": str(copy)}
    subprocess.run(["git", "add", "notes.md"], cwd=repo, env=env, check=True)
    assert git(repo, "diff", "--cached", "--name-only") == ""
    done = subprocess.run(
        [sys.executable, "-m", "tools.leakscan", "staged"],
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 1
    assert hits(done) == [("notes.md:1", 1)]


def test_base_moves_what_counts_as_added(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    commit(repo, {"notes.md": f"{ZEBRA}\n"}, "feat: a")
    assert leak.run("staged", cwd=repo).returncode == 0
    done = leak.run("staged", "--base", "HEAD^", cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [("notes.md:1", 1)]


def test_before_the_first_commit_the_base_is_the_empty_tree(leak: Leak) -> None:
    repo = leak.tmp / "fresh"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    (repo / "notes.md").write_text(f"{ZEBRA}\n")
    git(repo, "add", "notes.md")
    done = leak.run("staged", cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [("notes.md:1", 1)]


def test_no_corpus_in_a_cloud_session_is_skipped(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    repo, _ = temp_repo(tmp_path / "work")
    done = leak.run("staged", "--json", cwd=repo, remote=True)
    assert done.returncode == 0
    assert '"status": "skipped"' in done.stdout
