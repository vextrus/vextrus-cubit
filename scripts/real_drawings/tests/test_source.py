"""A head's tree cannot write outside the scratch checkout (the review of PR #58).

Git's own checkout refuses a `..` path component, but the check reads trees through `ls-tree` and
`cat-file`, which do not: a tree built with `git mktree` can hold an entry named `..`.
"""

import subprocess
from pathlib import Path

import pytest

from scripts.real_drawings.source import Blob, Refused, engine_files, write_checkout


def git(repo: Path, *args: str, stdin: bytes | None = None) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], input=stdin, capture_output=True, check=True)
    return done.stdout.decode().strip()


def commit_with_entry(repo: Path, name: str) -> str:
    """A commit whose tree is `engine/<name>`, a regular file, built without a working tree."""
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    blob = git(repo, "hash-object", "-w", "--stdin", stdin=b"written by a crafted tree\n")
    inner = git(repo, "mktree", stdin=f"100644 blob {blob}\t{name}\n".encode())
    outer = git(repo, "mktree", stdin=f"040000 tree {inner}\tengine\n".encode())
    env_args = ["-c", "user.name=t", "-c", "user.email=t@example.invalid"]
    return git(repo, *env_args, "commit-tree", outer, "-m", "crafted")


@pytest.mark.parametrize("name", ["..", "."])
def test_a_tree_entry_named_dot_or_dot_dot_is_refused(tmp_path: Path, name: str) -> None:
    commit = commit_with_entry(tmp_path / "repo", name)

    with pytest.raises(Refused, match="not a plain path"):
        engine_files(tmp_path / "repo", commit, "engine/**\n")


def test_a_plain_engine_file_is_kept(tmp_path: Path) -> None:
    commit = commit_with_entry(tmp_path / "repo", "reader.py")

    assert [f.path for f in engine_files(tmp_path / "repo", commit, "engine/**\n")] == [
        "engine/reader.py"
    ]


def test_writing_outside_the_checkout_is_refused_even_past_the_listing(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    oid = git(repo, "hash-object", "-w", "--stdin", stdin=b"x\n")
    outside = tmp_path / "outside.txt"

    with pytest.raises(Refused, match="outside the checkout"):
        write_checkout(repo, [Blob("100644", oid, "engine/../../outside.txt")], tmp_path / "src")

    assert not outside.exists()
