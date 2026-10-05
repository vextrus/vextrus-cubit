"""Unit tests of the local launcher's seams (T-LOCAL): the database slug, the shared-database check and
the undo of a refused launch, each against a fake `git`."""

from __future__ import annotations

import json
import subprocess
from collections.abc import Callable
from fnmatch import fnmatchcase
from pathlib import Path

import pytest

from scripts.factory import local

MAIN = Path("/repo")
TREE = MAIN / ".claude" / "worktrees" / "t901"
TIP = "a" * 40

Answer = tuple[int, str]


class FakeGit:
    """Answers `git` by its arguments' prefix; records every call."""

    def __init__(self, answers: dict[tuple[str, ...], Answer]) -> None:
        self.answers = answers
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
        self.calls.append(args)
        code, out = next(
            (answer for key, answer in self.answers.items() if args[: len(key)] == key), (0, "")
        )
        return subprocess.CompletedProcess(["git", *args], code, out, "fatal: no" if code else "")


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> Callable[[dict[tuple[str, ...], Answer]], FakeGit]:
    def install(answers: dict[tuple[str, ...], Answer]) -> FakeGit:
        git = FakeGit(answers)
        monkeypatch.setattr(local, "git", git)
        return git

    return install


@pytest.mark.parametrize(
    ("ticket", "slug"),
    [("T-1", "t_1"), ("T.1", "t_1"), ("--a..B__", "a_b"), ("._.", ""), ("t901", "t901")],
)
def test_database_slug(ticket: str, slug: str) -> None:
    assert local.database_slug(ticket) == slug


@pytest.mark.parametrize("ticket", ["._.", "x" * 33])
def test_parse_refuses_a_slug_that_is_empty_or_over_32(ticket: str) -> None:
    argv = ["--ticket", ticket, "--branch", "b", "--effort", "high", "--name", "n", "--prompt-file", "p"]
    with pytest.raises(SystemExit) as stop:
        local.parse(argv)
    assert stop.value.code == 64


def worktrees(*paths: str) -> Answer:
    return 0, "\n".join(f"worktree {path}\nHEAD {TIP}\n" for path in paths)


def test_sharing_database_finds_another_folder_with_the_same_slug(fake: Callable[..., FakeGit]) -> None:
    fake({("worktree", "list"): worktrees("/repo", "/repo/.claude/worktrees/t-1")})
    assert local.sharing_database(MAIN, "T.1") == "/repo/.claude/worktrees/t-1"


def test_sharing_database_refuses_a_same_named_worktree_outside_the_worktrees_folder(
    fake: Callable[..., FakeGit],
) -> None:
    fake({("worktree", "list"): worktrees("/repo", "/elsewhere/T.1", "/repo/.claude/worktrees/T.1")})
    assert local.sharing_database(MAIN, "T.1") == "/elsewhere/T.1"


def test_sharing_database_skips_the_main_checkout_and_the_same_folder(
    fake: Callable[..., FakeGit],
) -> None:
    fake({("worktree", "list"): worktrees("/t_1", "/repo/.claude/worktrees/T.1")})
    assert local.sharing_database(MAIN, "T.1") is None


def test_undo_deletes_a_branch_it_created_at_the_tip(fake: Callable[..., FakeGit]) -> None:
    git = fake({("rev-parse",): (0, TIP)})
    assert local.undo(MAIN, TREE, "f-ok", True, TIP) == ""
    assert ("worktree", "remove", str(TREE)) in git.calls
    assert ("branch", "-q", "-d", "f-ok") in git.calls
    assert not any("--force" in call or "-D" in call for call in git.calls)


def test_undo_keeps_a_branch_it_did_not_create(fake: Callable[..., FakeGit]) -> None:
    git = fake({("rev-parse",): (0, TIP)})
    assert local.undo(MAIN, TREE, "f-ok", False, TIP) == ""
    assert not any(call[0] == "branch" for call in git.calls)


def test_undo_keeps_a_moved_branch_and_names_the_way_out(fake: Callable[..., FakeGit]) -> None:
    git = fake({("rev-parse",): (0, "b" * 40)})
    assert local.undo(MAIN, TREE, "f-c", True, TIP) == "; to relaunch: git branch -f f-c origin/f-c"
    assert not any(call[0] == "branch" for call in git.calls)


def test_undo_leaves_the_branch_when_the_worktree_cannot_be_removed(
    fake: Callable[..., FakeGit],
) -> None:
    git = fake({("worktree", "remove"): (1, "")})
    assert "could not be removed" in local.undo(MAIN, TREE, "f-ok", True, TIP)
    assert git.calls == [("worktree", "remove", str(TREE))]


def test_undo_says_when_the_branch_cannot_be_deleted(fake: Callable[..., FakeGit]) -> None:
    fake({("rev-parse",): (0, TIP), ("branch",): (1, "")})
    assert local.undo(MAIN, TREE, "f-ok", True, TIP) == "; the local branch f-ok could not be deleted"


# The builder's settings deny every gh command that writes or publishes (fix round 1); reads stay open.
# `matches()` is the acceptance test's rule (test_builder_settings_gh.py), restated.
SETTINGS = Path(__file__).resolve().parents[1] / "builder.settings.json"
GH_WRITES = [
    *(
        f"gh {group} x"
        for group in ("gist list", "gist create f", "alias set a b", "extension install o/r")
    ),
    *(
        f"gh {group} x"
        for group in ("project create", "ssh-key add k", "gpg-key add k", "codespace ssh")
    ),
    *(f"gh {group} x" for group in ("secret list", "variable list", "auth login", "auth token")),
    "gh config set editor vim",
    # gh's built-in aliases of write verbs
    "gh issue new",
    "gh pr new",
    "gh release new v1",
    "gh repo new x",
    "gh cs create",
    "gh ext install o/r",
    "gh extensions install o/r",
    "gh label create x",
    "gh label clone o/r",
    "gh label delete x",
    "gh label edit x",
    "gh release create v1",
    "gh release edit v1",
    "gh release upload v1 f",
    "gh release delete-asset v1 f",
    "gh workflow run ci.yml",
    "gh workflow enable ci.yml",
    "gh workflow disable ci.yml",
    "gh cache delete 1",
    "gh run rerun 9",
    "gh run cancel 9",
    "gh run delete 9",
    *(f"gh repo {verb} x" for verb in ("fork", "sync", "deploy-key", "autolink", "create", "delete")),
    *(f"gh repo {verb} x" for verb in ("edit", "rename", "archive", "unarchive", "set-default")),
    *(f"gh issue {verb} 5" for verb in ("develop", "transfer", "pin", "unpin", "lock", "unlock")),
    *(f"gh issue {verb} 5" for verb in ("delete", "reopen", "edit", "create", "comment", "close")),
    *(f"gh pr {verb} 5" for verb in ("create", "edit", "comment", "review", "merge", "close", "ready")),
    *(f"gh pr {verb} 5" for verb in ("reopen", "update-branch", "lock", "unlock", "revert")),
    *(f"gh api repos/o/r/labels {flag} x" for flag in ("-X", "--method", "-f", "-F", "--field")),
    *(f"gh api repos/o/r/labels {flag} x" for flag in ("--raw-field", "--input")),
]
GH_READS = [
    *(f"gh pr {verb} 5" for verb in ("view", "list", "diff", "checks", "status")),
    *(f"gh issue {verb}" for verb in ("view 5", "list", "status")),
    *(f"gh run {verb}" for verb in ("view 9", "list", "watch 9")),
    "gh repo view",
    "gh label list",
    "gh release list",
    "gh workflow list",
    "gh ruleset list",
    "gh ruleset check",
]


def matches(rule: str, command: str) -> bool:
    if not (rule.startswith("Bash(") and rule.endswith(")")):
        return False
    pattern = rule[len("Bash(") : -1]
    return fnmatchcase(command, pattern) or fnmatchcase(command, pattern.removesuffix(" *"))


def deny_rules() -> list[str]:
    rules: list[str] = json.loads(SETTINGS.read_text())["permissions"]["deny"]
    return rules


@pytest.mark.parametrize("command", GH_WRITES)
def test_every_gh_write_is_denied(command: str) -> None:
    assert any(matches(rule, command) for rule in deny_rules()), command


@pytest.mark.parametrize("command", GH_READS)
def test_gh_reads_stay_open(command: str) -> None:
    assert [rule for rule in deny_rules() if matches(rule, command)] == []
