"""S29-F3: the revert's light path (docs/plans/factory-s29.md item 3: "open a revert PR at once and land
it by the light path"; ADR 0043's no-model tiers, decided by code the way allowlist-only and docs-only
are in `scripts/factory/review.py`).

The seam (named here, built by the ticket): `scripts.factory.main_watch.light_tier(repo, head, base=)`
answers the tier `"revert"` (no model) when the head's change against `base` is exactly the inverse of
one first-parent merge on `base`, and None otherwise; the review wires it in. Decided by the diff,
never by a title, a message or a branch name: a PR that claims to revert but carries anything else is
NOT light.
"""

import importlib
from pathlib import Path
from typing import Any

from scripts.tests.acceptance.ts29f3._repo import Repo, git


def light_tier(repo: Repo, head: str) -> Any:
    module: Any = importlib.import_module("scripts.factory.main_watch")
    git(repo.watch, "fetch", "-q", "origin")
    return module.light_tier(repo.watch, head, base="origin/main")


def cut(repo: Repo, name: str) -> None:
    git(repo.watch, "fetch", "-q", "origin")
    git(repo.watch, "checkout", "-q", "-B", name, "origin/main")


def head(repo: Repo) -> str:
    return git(repo.watch, "rev-parse", "HEAD")


def history(repo: Repo) -> tuple[str, str]:
    first = repo.merge(71, {"app/a.py": "A = 1\n"})
    second = repo.merge(72, {"app/b.py": "B = 1\n", "README.md": "# fixture\n\nPR 72's line.\n"})
    return first, second


def test_a_branch_reverting_exactly_one_merge_on_main_is_the_revert_tier(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    _, second = history(repo)
    cut(repo, "revert/one")
    git(repo.watch, "revert", "--no-edit", "-m", "1", second)
    assert light_tier(repo, head(repo)) == "revert"


def test_an_older_merge_reverted_alone_is_the_revert_tier(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    first, _ = history(repo)
    cut(repo, "revert/older")
    git(repo.watch, "revert", "--no-edit", "-m", "1", first)
    assert light_tier(repo, head(repo)) == "revert"


def test_a_revert_carrying_one_more_change_is_not_light(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    _, second = history(repo)
    cut(repo, "revert/plus")
    git(repo.watch, "revert", "--no-edit", "-m", "1", second)
    (repo.watch / "app" / "extra.py").write_text("import os\n")
    git(repo.watch, "add", "app/extra.py")
    git(repo.watch, "commit", "-q", "-m", "tidy")
    assert light_tier(repo, head(repo)) is None


def test_a_revert_amended_with_a_changed_line_is_not_light(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    _, second = history(repo)
    cut(repo, "revert/amended")
    git(repo.watch, "revert", "--no-edit", "-m", "1", second)
    (repo.watch / "app" / "a.py").write_text("A = 2\n")
    git(repo.watch, "add", "app/a.py")
    git(repo.watch, "commit", "-q", "--amend", "--no-edit")
    # app/a.py came from PR 71, which this branch does not revert.
    assert light_tier(repo, head(repo)) is None


def test_a_change_whose_message_claims_a_revert_is_not_light(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    _, second = history(repo)
    cut(repo, "revert/claimed")
    (repo.watch / "app" / "c.py").write_text("C = 1\n")
    git(repo.watch, "add", "app/c.py")
    message = f'Revert "Merge pull request #72 from vextrus/pr72"\n\nThis reverts commit {second}.\n'
    git(repo.watch, "commit", "-q", "-m", message)
    assert light_tier(repo, head(repo)) is None


def test_a_branch_reverting_two_merges_is_not_light(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    first, second = history(repo)
    cut(repo, "revert/two")
    git(repo.watch, "revert", "--no-edit", "-m", "1", second)
    git(repo.watch, "revert", "--no-edit", "-m", "1", first)
    assert light_tier(repo, head(repo)) is None


def test_a_branch_that_changes_nothing_is_not_light(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    history(repo)
    cut(repo, "revert/empty")
    git(repo.watch, "commit", "-q", "--allow-empty", "-m", "Revert nothing")
    assert light_tier(repo, head(repo)) is None


def test_a_revert_of_a_merge_inside_a_landed_pr_is_not_light(tmp_path: Path) -> None:
    """Only main's first-parent merges count: reverting part of a landed PR (a merge on its branch) is
    a change like any other."""
    repo = Repo(tmp_path)
    history(repo)
    dev = repo.dev
    git(dev, "fetch", "-q", "origin")
    git(dev, "checkout", "-q", "-B", "feat", "origin/main")
    git(dev, "checkout", "-q", "-b", "sub")
    (dev / "app" / "x.py").write_text("X = 1\n")
    git(dev, "add", "app/x.py")
    git(dev, "commit", "-q", "-m", "x")
    git(dev, "checkout", "-q", "feat")
    git(dev, "merge", "-q", "--no-ff", "-m", "Merge branch 'sub' into feat", "sub")
    inner = git(dev, "rev-parse", "HEAD")
    (dev / "app" / "y.py").write_text("Y = 1\n")
    git(dev, "add", "app/y.py")
    git(dev, "commit", "-q", "-m", "y")
    git(dev, "checkout", "-q", "-B", "main", "origin/main")
    git(dev, "merge", "-q", "--no-ff", "-m", "Merge pull request #73 from vextrus/feat", "feat")
    git(dev, "push", "-q", "origin", "main")
    cut(repo, "revert/inner")
    git(repo.watch, "revert", "--no-edit", "-m", "1", inner)
    assert light_tier(repo, head(repo)) is None
