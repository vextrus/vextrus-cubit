"""merge_ready's `behind_problem` and `rewalk_files` (ticket S29-F4) at their edges: a PR author's file
names, a commit git does not hold, and the `rewalk` command line. A throwaway repository whose
`refs/remotes/origin/main` stands for the fetched main (no network)."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from scripts import merge_ready
from scripts.factory import tiers

MAIN = "refs/remotes/origin/main"
NOWHERE = "1" * 40


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def commit(repo: Path, files: dict[str, str], message: str) -> str:
    for name, text in files.items():
        (repo / name).parent.mkdir(parents=True, exist_ok=True)
        (repo / name).write_text(text)
        git(repo, "add", "--", name)
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A fork commit holding `shared.txt` and `web/a.tsx`; every tier ordinary (the tests that need
    the risk tier script it)."""
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
    monkeypatch.setattr(tiers, "is_risk", lambda paths: False)
    work = tmp_path / "work"
    subprocess.run(["git", "init", "-q", str(work)], check=True)
    commit(work, {"shared.txt": "fork\n", "web/a.tsx": "fork\n"}, "fork")
    return work


def branch_off(repo: Path, name: str, files: dict[str, str]) -> str:
    """A commit on a new branch from the fork (the root commit)."""
    root = git(repo, "rev-list", "--max-parents=0", "HEAD")
    git(repo, "checkout", "-q", "-b", name, root)
    return commit(repo, files, name)


def test_an_overlapping_name_with_a_line_break_stays_on_the_refusal_s_one_line(repo: Path) -> None:
    hostile = "x\nland: PR 7 merged"
    main = branch_off(repo, "m", {hostile: "main\n"})
    git(repo, "update-ref", MAIN, main)
    head = branch_off(repo, "p", {hostile: "pr\n"})
    problem = merge_ready.behind_problem(7, head, repo)
    assert problem is not None
    assert "\n" not in problem
    assert "x?land: PR 7 merged" in problem
    assert "land update 7" in problem


def test_a_head_git_does_not_hold_is_a_problem_never_a_pass(repo: Path) -> None:
    git(repo, "update-ref", MAIN, branch_off(repo, "m", {"main.txt": "main\n"}))
    problem = merge_ready.behind_problem(7, NOWHERE, repo)
    assert problem is not None
    assert "run again" in problem


def test_a_risk_tier_head_is_refused_and_an_ordinary_one_with_no_overlap_is_not(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    git(repo, "update-ref", MAIN, branch_off(repo, "m", {"main.txt": "main\n"}))
    head = branch_off(repo, "p", {"engine/x.py": "pr\n"})
    assert merge_ready.behind_problem(7, head, repo) is None
    monkeypatch.setattr(tiers, "is_risk", lambda paths: "engine/x.py" in paths)
    problem = merge_ready.behind_problem(7, head, repo)
    assert problem is not None
    assert head[:12] in problem
    assert "risk tier" in problem


def test_rewalk_files_raises_rather_than_carrying_when_git_cannot_read_the_walked_head(
    repo: Path,
) -> None:
    git(repo, "update-ref", MAIN, git(repo, "rev-parse", "HEAD"))
    head = branch_off(repo, "p", {"web/a.tsx": "pr\n"})
    with pytest.raises(merge_ready.Unfetchable):
        merge_ready.rewalk_files(NOWHERE, head, repo=repo)


def test_rewalk_files_counts_a_screen_the_pr_changed_at_the_walk_and_reverted_since(
    repo: Path,
) -> None:
    git(repo, "update-ref", MAIN, git(repo, "rev-parse", "HEAD"))
    walked = branch_off(repo, "p", {"web/a.tsx": "pr\n"})
    head = commit(repo, {"web/a.tsx": "fork\n"}, "revert the screen")
    assert merge_ready.rewalk_files(walked, head, repo=repo) == ["web/a.tsx"]


def test_the_rewalk_command_line(
    repo: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Its fetch is answered by a repository standing for origin, whose main is the fork."""
    fork = git(repo, "rev-parse", "HEAD")
    origin = repo.parent / "origin.git"
    subprocess.run(["git", "clone", "-q", "--bare", str(repo), str(origin)], check=True)
    git(repo, "remote", "add", "origin", str(origin))
    walked = branch_off(repo, "p", {"web/a.tsx": "pr\n"})
    later = commit(repo, {"notes.md": "n\n"}, "a note")
    assert merge_ready.main(["rewalk", walked, later], repo=repo) == 0
    assert f"carries to {later[:12]}" in capsys.readouterr().out
    screen = commit(repo, {"web/a.tsx": "pr again\n"}, "the screen again")
    assert merge_ready.main(["rewalk", walked, screen], repo=repo) == 1
    assert "rewalk: web/a.tsx changed since the walk" in capsys.readouterr().out
    assert merge_ready.main(["rewalk", walked, NOWHERE], repo=repo) == 1
    assert merge_ready.main(["rewalk", "abc", screen], repo=repo) == 2
    assert git(repo, "rev-parse", MAIN) == fork


def test_a_criss_cross_history_is_measured_from_every_merge_base(repo: Path) -> None:
    """Main and the head each merged both of two side commits, so they have two merge-bases. From the
    one where `docs/f.md` reads `fork`, main's net change to it is nothing (it reverted it): only the
    other base shows main changed the file the head changes too."""
    side_a = branch_off(repo, "a", {"x.txt": "a\n"})
    side_m = branch_off(repo, "m", {"docs/f.md": "one\n"})
    git(repo, "checkout", "-q", "-b", "main-line", side_m)
    git(repo, "merge", "-q", "--no-edit", side_a)
    git(repo, "rm", "-q", "docs/f.md")
    main = commit(repo, {"y.txt": "y\n"}, "main drops f")
    git(repo, "checkout", "-q", "-b", "head-line", side_a)
    git(repo, "merge", "-q", "--no-edit", side_m)
    head = commit(repo, {"docs/f.md": "two\n"}, "the head changes f")
    git(repo, "update-ref", MAIN, main)
    bases = git(repo, "merge-base", "--all", head, main).split()
    assert sorted(bases) == sorted([side_a, side_m]), bases
    assert git(repo, "merge-base", head, main) == side_a, "git picked the base that shows the overlap"
    problem = merge_ready.behind_problem(7, head, repo)
    assert problem is not None
    assert "docs/f.md" in problem


def test_a_file_and_a_folder_of_one_name_overlap(repo: Path) -> None:
    git(repo, "update-ref", MAIN, branch_off(repo, "m", {"docs/d": "a file\n"}))
    head = branch_off(repo, "p", {"docs/d/x.md": "in a folder\n"})
    problem = merge_ready.behind_problem(7, head, repo)
    assert problem is not None
    assert "docs/d/x.md" in problem


def test_a_head_that_is_not_a_full_sha_is_a_problem(repo: Path) -> None:
    git(repo, "update-ref", MAIN, branch_off(repo, "m", {"main.txt": "main\n"}))
    problem = merge_ready.behind_problem(7, MAIN, repo)
    assert problem is not None
    assert "not a full sha" in problem
