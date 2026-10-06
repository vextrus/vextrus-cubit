"""S14-C14: the READY gate the workflows' light job runs before any heavy job (issue #466, part A).

The authority: factory-next.md section 8 row 15, "heavy jobs only on READY heads", acceptance check "a
non-READY push starts no heavy workflow"; issue #466 Fix A, "run the heavy workflows only on heads
carrying `Factory-State: READY`". The READY reading is the repo's one trailer rule
(docs/specs/factory/contracts/trailers.md 1, `scripts/factory/trailers.py`, S14-F1).

The seam (named by this ticket's tests, built by the builder):

    GITHUB_EVENT_NAME=<event> python3 -m scripts.factory.ci_gate <sha40>

run from the repository's root in a checkout whose git history holds the commit, with only the standard
library (the light job installs nothing: the tests run it with `python -S`). It prints exactly one
line to stdout, `ready=true` or `ready=false` (so a step appends it to `$GITHUB_OUTPUT`), and exits 0;
anything
else it says goes to stderr. On a `pull_request` run the commit is READY when its message reads READY by
the trailer rule, or when it is a merge of main onto a head that is READY (GitHub's "Update branch" and
`land update` make the head that lands such a merge, and merge_ready needs `ci` green on it). Every other
event (a push to main, a run by hand) runs the heavy jobs whatever the head says. A commit it cannot read
fails the step (exit not 0): the repo's path steps fail closed the same way.

Every commit here is synthetic, made in the test's temporary folder; nothing is read from the network.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
DATE = "2026-10-06T10:00:00Z"
ATTRIBUTION = (
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
    "Claude-Session: https://claude.ai/code/session_01Example\n"
)
REASON = "the acceptance tests for the refusal cannot pass: the spec names no exit code"

Message = Callable[[str], str]


def _env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": os.environ.get("HOME", "/nonexistent"),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_AUTHOR_NAME": "Builder",
        "GIT_AUTHOR_EMAIL": "builder@example.com",
        "GIT_COMMITTER_NAME": "Builder",
        "GIT_COMMITTER_EMAIL": "builder@example.com",
        "GIT_AUTHOR_DATE": DATE,
        "GIT_COMMITTER_DATE": DATE,
        "LC_ALL": "C",
    }
    env.update(extra or {})
    return env


def _git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True, env=_env(), check=False
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"
    return done.stdout.strip()


class Repo:
    """A synthetic repository: `main` with a base commit, and branches made from it."""

    def __init__(self, root: Path) -> None:
        self.root = root
        root.mkdir()
        _git(root, "init", "-q", "-b", "main")
        _git(root, "config", "commit.gpgsign", "false")
        self.count = 0
        self.commit(lambda _tree: "base: the first commit\n")

    def commit(self, message: Message) -> str:
        """A commit of one new file, its message built from the commit's own tree."""
        self.count += 1
        (self.root / f"file-{self.count}.txt").write_text(f"change {self.count}\n")
        _git(self.root, "add", f"file-{self.count}.txt")
        tree = _git(self.root, "write-tree")
        note = self.root.parent / f"message-{self.count}.txt"
        note.write_text(message(tree))
        _git(self.root, "commit", "-q", "--cleanup=verbatim", "-F", str(note))
        return _git(self.root, "rev-parse", "HEAD")

    def branch(self, name: str, start: str = "main") -> None:
        _git(self.root, "switch", "-q", "-c", name, start)

    def switch(self, name: str) -> None:
        _git(self.root, "switch", "-q", name)

    def merge(self, other: str, message: str) -> str:
        """A merge commit of `other` into the current branch (first parent: the current branch)."""
        _git(self.root, "merge", "-q", "--no-ff", "--no-edit", "-m", message, other)
        return _git(self.root, "rev-parse", "HEAD")


def gate(repo: Repo, sha: str, event: str = "pull_request") -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-S", "-m", "scripts.factory.ci_gate", sha],
        cwd=repo.root,
        capture_output=True,
        text=True,
        env=_env({"PYTHONPATH": str(REPO), "GITHUB_EVENT_NAME": event}),
        check=False,
    )


def ready(repo: Repo, sha: str, event: str = "pull_request") -> bool:
    done = gate(repo, sha, event)
    shown = f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"
    assert done.returncode == 0, shown
    assert done.stdout in ("ready=true\n", "ready=false\n"), (
        "stdout must be exactly one line, ready=true or ready=false (it is appended to "
        f"$GITHUB_OUTPUT):\n{shown}"
    )
    return done.stdout == "ready=true\n"


def ready_trailers(tree: str) -> str:
    return f"Factory-State: READY\nFactory-Verify: {tree} ok"


def last_paragraph_ready(tree: str) -> str:
    return f"S99: the widget\n\nThe widget is built.\n\n{ready_trailers(tree)}\n"


def t_w317(trailers: str) -> str:
    """The shape of PR #443's READY commit (T-W317, session 13), synthetic words: a subject, headed
    sections and list items, the factory block, a blank line, then the attribution block."""
    return (
        "W999: build the widget dumper from its pinned source plus one repair, pinned by hash\n"
        "\n"
        "Closes #999. The dumper now compiles the widget library from source with one repair applied.\n"
        "\n"
        "## Not verified\n"
        "- The owner's root run of the toolchain script with this pin (not run: it needs root).\n"
        "\n"
        "## Verify\n"
        "- `uv run python -m scripts.verify`: pytest 0, ruff 0, ruff-format 0, mypy 0, lint-imports 0.\n"
        "\n"
        "## Cut\n"
        "None.\n"
        "\n"
        f"{trailers}\n"
        "\n"
        f"{ATTRIBUTION}"
    )


def plain(_tree: str) -> str:
    return "wip: more of the widget\n\nNo trailer here.\n"


@pytest.fixture
def repo(tmp_path: Path) -> Repo:
    made = Repo(tmp_path / "repo")
    made.branch("s99-widget")
    return made


def test_a_head_whose_last_paragraph_reads_ready_runs_the_heavy_jobs(repo: Repo) -> None:
    assert ready(repo, repo.commit(last_paragraph_ready)) is True


def test_a_ready_head_in_the_t_w317_shape_runs_the_heavy_jobs(repo: Repo) -> None:
    assert ready(repo, repo.commit(lambda tree: t_w317(ready_trailers(tree)))) is True


def test_a_head_with_no_factory_trailer_runs_no_heavy_job(repo: Repo) -> None:
    assert ready(repo, repo.commit(plain)) is False


def test_a_blocked_head_runs_no_heavy_job(repo: Repo) -> None:
    sha = repo.commit(lambda _tree: t_w317(f"Factory-State: BLOCKED\nFactory-Reason: {REASON}"))
    assert ready(repo, sha) is False


def test_ready_without_its_verify_line_runs_no_heavy_job(repo: Repo) -> None:
    assert ready(repo, repo.commit(lambda _tree: t_w317("Factory-State: READY"))) is False


def test_a_verify_line_naming_another_tree_runs_no_heavy_job(repo: Repo) -> None:
    sha = repo.commit(lambda _tree: t_w317(ready_trailers("0123456789abcdef" * 2 + "01234567")))
    assert ready(repo, sha) is False


def test_ready_outside_the_read_paragraph_runs_no_heavy_job(repo: Repo) -> None:
    def outside(tree: str) -> str:
        return (
            "W998: the widget\n\nBody.\n\n"
            f"{ready_trailers(tree)}\n\n"
            "A closing note in prose, after the trailers.\n\n"
            f"{ATTRIBUTION}"
        )

    assert ready(repo, repo.commit(outside)) is False


def test_only_the_head_is_read_so_a_push_after_a_ready_commit_runs_no_heavy_job(repo: Repo) -> None:
    repo.commit(last_paragraph_ready)
    assert ready(repo, repo.commit(plain)) is False


def _main_with_a_landed_ready_pr(repo: Repo, number: int) -> None:
    """main moves on by a merged PR whose own head was READY (as every landed PR's is)."""
    current = _git(repo.root, "branch", "--show-current")
    repo.branch(f"other-{number}", "main")
    repo.commit(last_paragraph_ready)
    repo.switch("main")
    repo.merge(f"other-{number}", f"Merge pull request #{number} from vextrus/other-{number}")
    repo.switch(current)


def test_a_merge_of_main_onto_a_ready_head_runs_the_heavy_jobs(repo: Repo) -> None:
    repo.commit(last_paragraph_ready)
    _main_with_a_landed_ready_pr(repo, 501)
    update = repo.merge("main", "Merge branch 'main' into s99-widget")
    assert ready(repo, update) is True


def test_a_second_merge_of_main_onto_that_merge_still_runs_the_heavy_jobs(repo: Repo) -> None:
    repo.commit(last_paragraph_ready)
    _main_with_a_landed_ready_pr(repo, 502)
    repo.merge("main", "Merge branch 'main' into s99-widget")
    _main_with_a_landed_ready_pr(repo, 503)
    again = repo.merge("main", "Merge branch 'main' into s99-widget")
    assert ready(repo, again) is True


def test_a_merge_of_main_onto_a_head_that_is_not_ready_runs_no_heavy_job(repo: Repo) -> None:
    """main's own tip is a merge of a READY head, so a reading that takes any READY parent is wrong."""
    repo.commit(plain)
    _main_with_a_landed_ready_pr(repo, 504)
    update = repo.merge("main", "Merge branch 'main' into s99-widget")
    assert ready(repo, update) is False


def test_a_push_to_main_runs_the_heavy_jobs_whatever_its_head_says(repo: Repo) -> None:
    assert ready(repo, repo.commit(plain), event="push") is True


def test_a_run_by_hand_runs_the_heavy_jobs_whatever_its_head_says(repo: Repo) -> None:
    assert ready(repo, repo.commit(plain), event="workflow_dispatch") is True


def test_a_commit_the_gate_cannot_read_fails_the_step(repo: Repo) -> None:
    assert ready(repo, repo.commit(plain)) is False  # the gate reads this repository's commits
    done = gate(repo, "f" * 40)
    assert done.returncode != 0, f"exit 0 on an unknown commit; stdout {done.stdout!r}"
    assert "ready=true" not in done.stdout
