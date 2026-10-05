"""T-LAND 3: `reviewed` accepts a ledger PASS for an older head when every later commit is a clean merge
of main, exactly as `scripts.merge_ready.merges_since` decides, and lets a newer covering FIX outrank it.

Seam (fixed by the ticket): `scripts.land.reviewed(ledger_dir, pr, head, *, repo, base="origin/main")`.
"""

import subprocess
from pathlib import Path

from scripts.merge_ready import merges_since
from scripts.tests.acceptance.p6_land._fakegh import PR, commit, git, lander, new_repo, record


class Branch:
    """A repo whose branch `pr12` holds the reviewed commit, cut from `main` before main moved on."""

    def __init__(self, tmp_path: Path, *, conflicting: bool = False) -> None:
        self.repo = new_repo(tmp_path / "repo")
        self.ledger = tmp_path / "ledger"
        commit(self.repo, "shared.txt", "one\n", "base")
        git(self.repo, "switch", "-q", "-c", "pr12")
        self.reviewed = commit(
            self.repo, "shared.txt" if conflicting else "pr.txt", "the PR's\n", "the PR's change"
        )
        git(self.repo, "switch", "-q", "main")
        commit(self.repo, "shared.txt" if conflicting else "main.txt", "main's\n", "main moves on")
        git(self.repo, "update-ref", "refs/remotes/origin/main", "main")
        git(self.repo, "switch", "-q", "pr12")
        record(self.ledger, self.reviewed)

    def merge_main(self) -> str:
        git(self.repo, "merge", "-q", "--no-ff", "--no-edit", "origin/main")
        return git(self.repo, "rev-parse", "HEAD")

    def covered(self, head: str) -> bool:
        found: bool = lander().reviewed(self.ledger, PR, head, repo=self.repo)
        return found

    def merge_ready_accepts(self, head: str) -> bool:
        return merges_since(self.repo, self.reviewed, head, "origin/main") is None


def test_a_head_moved_only_by_a_clean_merge_of_main_is_covered(tmp_path: Path) -> None:
    branch = Branch(tmp_path)
    head = branch.merge_main()
    assert branch.covered(head) is True
    assert branch.covered(head) == branch.merge_ready_accepts(head)


def test_an_ordinary_commit_after_the_pass_is_not_covered(tmp_path: Path) -> None:
    branch = Branch(tmp_path)
    head = commit(branch.repo, "later.txt", "unreviewed\n", "an unreviewed change")
    assert branch.covered(head) is False
    assert branch.covered(head) == branch.merge_ready_accepts(head)


def test_a_merge_resolved_by_hand_is_not_covered(tmp_path: Path) -> None:
    branch = Branch(tmp_path, conflicting=True)
    clash = subprocess_merge(branch.repo)
    assert clash != 0, "the fixture's merge must conflict"
    (branch.repo / "shared.txt").write_text("resolved by hand\n")
    git(branch.repo, "add", "shared.txt")
    git(branch.repo, "commit", "-q", "--no-edit")
    head = git(branch.repo, "rev-parse", "HEAD")
    assert branch.covered(head) is False
    assert branch.covered(head) == branch.merge_ready_accepts(head)


def test_a_newer_fix_covering_the_head_outranks_the_older_pass(tmp_path: Path) -> None:
    branch = Branch(tmp_path)
    head = branch.merge_main()
    record(branch.ledger, head, verdict="FIX", comment_id=200)
    assert branch.covered(head) is False


def test_the_exact_head_s_pass_needs_no_git(tmp_path: Path) -> None:
    reviewed = lander().reviewed
    head = "c" * 40
    record(tmp_path / "ledger", head)
    assert reviewed(tmp_path / "ledger", PR, head, repo=tmp_path / "no-such-repo") is True


def test_a_round_three_pass_with_no_exception_is_not_reviewed(tmp_path: Path) -> None:
    reviewed = lander().reviewed
    head = "c" * 40
    record(tmp_path / "ledger", head, round=3)
    assert reviewed(tmp_path / "ledger", PR, head, repo=tmp_path / "no-such-repo") is False


def subprocess_merge(repo: Path) -> int:
    done = subprocess.run(
        ["git", "-C", str(repo), "merge", "-q", "--no-ff", "--no-edit", "origin/main"],
        capture_output=True,
        check=False,
    )
    return done.returncode
