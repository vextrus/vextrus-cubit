"""merge_ready's `fetch_review` reads the PR's diff, files and messages from git (ticket S21-MR): the
exact form of what it reads, in a throwaway hub and clone with a stub `gh` (no network)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts import merge_ready

STUB = """import os, sys
if sys.argv[1:3] == ["api", "graphql"]:
    sys.stdout.write(open(os.environ["MRG_ANSWER"]).read())
    sys.exit(0)
sys.exit(1)
"""


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """A hub with main and refs/pull/1/head: the PR renames `old.py`, adds `new.py` in a commit with a
    two-paragraph message, and merges main once; `work` (a clone) is the current directory."""
    config = tmp_path / "gitconfig"
    config.write_text("[init]\n\tdefaultBranch = main\n")
    for key, value in {
        "GIT_CONFIG_GLOBAL": str(config),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_AUTHOR_NAME": "t",
        "GIT_AUTHOR_EMAIL": "t@example.com",
        "GIT_COMMITTER_NAME": "t",
        "GIT_COMMITTER_EMAIL": "t@example.com",
    }.items():
        monkeypatch.setenv(key, value)
    hub, dev = tmp_path / "hub.git", tmp_path / "dev"
    subprocess.run(["git", "init", "-q", "--bare", str(hub)], check=True)
    subprocess.run(["git", "init", "-q", str(dev)], check=True)
    (dev / "old.py").write_text("a = 1\nb = 2\nc = 3\n")
    git(dev, "add", "old.py")
    git(dev, "commit", "-q", "-m", "fork")
    git(dev, "checkout", "-q", "-b", "pr")
    git(dev, "mv", "old.py", "moved.py")
    (dev / "new.py").write_text("x = 1\n")
    git(dev, "add", "new.py")
    git(dev, "commit", "-q", "-m", "first line\n\nsecond paragraph\nthird line")
    git(dev, "checkout", "-q", "main")
    (dev / "main.txt").write_text("main\n")
    git(dev, "add", "main.txt")
    git(dev, "commit", "-q", "-m", "main moves")
    git(dev, "checkout", "-q", "pr")
    git(dev, "merge", "-q", "--no-edit", "-m", "merge main", "main")
    git(dev, "checkout", "-q", "main")
    (dev / "later.txt").write_text("later\n")
    git(dev, "add", "later.txt")
    git(dev, "commit", "-q", "-m", "main moves again")
    head, base = git(dev, "rev-parse", "pr"), git(dev, "rev-parse", "main")
    git(dev, "push", "-q", str(hub), "main:refs/heads/main", "pr:refs/pull/1/head")
    work = tmp_path / "work"
    subprocess.run(["git", "clone", "-q", str(hub), str(work)], check=True)
    answer = {
        "data": {
            "repository": {
                "pullRequest": {
                    "headRefOid": head,
                    "headRefName": "pr",
                    "baseRefOid": base,
                    "baseRefName": "main",
                    "title": "t",
                    "body": "",
                    "comments": {"nodes": []},
                }
            }
        }
    }
    (tmp_path / "answer.json").write_text(json.dumps(answer))
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "gh").write_text(f"#!{sys.executable}\n{STUB}")
    (bin_dir / "gh").chmod(0o755)
    monkeypatch.setenv("MRG_ANSWER", str(tmp_path / "answer.json"))
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.chdir(work)
    return {"head": head, "base": base, "answer": str(tmp_path / "answer.json"), "work": str(work)}


def test_each_message_is_whole_and_the_merge_of_main_is_one_of_them(world: dict[str, str]) -> None:
    facts = merge_ready.fetch_review(1)
    assert facts["messages"] == ["merge main", "first line\n\nsecond paragraph\nthird line"]


def test_a_rename_lists_both_names_and_mains_own_files_are_not_the_prs(world: dict[str, str]) -> None:
    facts = merge_ready.fetch_review(1)
    assert sorted(facts["files"]) == ["moved.py", "new.py", "old.py"]
    assert "-a = 1" in facts["diff"]
    assert "+a = 1" in facts["diff"]
    assert "main.txt" not in facts["diff"]
    assert "later.txt" not in facts["diff"]


def test_the_diff_ignores_the_clones_diff_config_from_a_subdirectory(world: dict[str, str]) -> None:
    git(Path(world["work"]), "config", "diff.external", "false")
    git(Path(world["work"]), "config", "color.diff", "always")
    git(Path(world["work"]), "config", "diff.relative", "true")
    (Path(world["work"]) / "sub").mkdir()
    os.chdir(Path(world["work"]) / "sub")
    facts = merge_ready.fetch_review(1)
    assert "+x = 1" in facts["diff"]
    assert "\x1b[" not in facts["diff"]
    assert sorted(facts["files"]) == ["moved.py", "new.py", "old.py"]


def test_a_base_git_does_not_hold_is_unfetchable_naming_the_base(world: dict[str, str]) -> None:
    answer = json.loads(Path(world["answer"]).read_text())
    answer["data"]["repository"]["pullRequest"]["baseRefOid"] = "f" * 40
    Path(world["answer"]).write_text(json.dumps(answer))
    with pytest.raises(merge_ready.Unfetchable, match="base ffffffffffff"):
        merge_ready.fetch_review(1)


def test_an_unfetchable_pr_prints_the_status_problems_too(
    world: dict[str, str], capsys: pytest.CaptureFixture[str]
) -> None:
    def facts(pr: int) -> dict[str, str]:
        raise merge_ready.Unfetchable("cannot fetch refs/pull/1/head")

    closed = {"state": "CLOSED", "headRefOid": world["head"]}
    assert merge_ready.main(["1"], get=lambda pr: closed, facts=facts) == 1
    out = capsys.readouterr().out.splitlines()
    assert out == [
        "merge-ready: the PR is closed, not open",
        "merge-ready: cannot fetch refs/pull/1/head",
    ]


def test_bytes_that_are_not_utf8_are_read_not_a_crash(world: dict[str, str], tmp_path: Path) -> None:
    """A latin-1 file and a raw latin-1 message in the PR (refuter, S21-MR): replaced and read."""
    dev = tmp_path / "dev"
    git(dev, "checkout", "-q", "pr")
    (dev / "latin.txt").write_bytes("café x\n".encode("latin-1"))
    (tmp_path / "message").write_bytes("café message\n".encode("latin-1"))
    git(dev, "add", "latin.txt")
    git(dev, "commit", "-q", "-F", str(tmp_path / "message"))
    head = git(dev, "rev-parse", "HEAD")
    git(dev, "push", "-q", str(tmp_path / "hub.git"), "pr:refs/pull/1/head")
    answer = json.loads(Path(world["answer"]).read_text())
    answer["data"]["repository"]["pullRequest"]["headRefOid"] = head
    Path(world["answer"]).write_text(json.dumps(answer))
    facts = merge_ready.fetch_review(1)
    assert "+caf� x" in facts["diff"]
    assert "latin.txt" in facts["files"]
    assert facts["messages"][0] in ("caf� message", "café message")  # git may re-encode it


@pytest.mark.parametrize(
    ("answer", "code"),
    [("", 1), ("{}", 0), ('{"data": {"repository": {"pullRequest": null}}}', 0)],
    ids=["gh-fails", "no-data", "no-pull-request"],
)
def test_a_github_answer_that_cannot_be_read_is_unfetchable(
    world: dict[str, str], answer: str, code: int, tmp_path: Path
) -> None:
    """`gh api graphql` failing or answering no pull request is a refusal (refuter, S21-MR)."""
    Path(world["answer"]).write_text(answer)
    if code:
        (tmp_path / "bin" / "gh").write_text(f"#!{sys.executable}\nimport sys\nsys.exit({code})\n")
    with pytest.raises(merge_ready.Unfetchable, match="PR 1"):
        merge_ready.fetch_review(1)
