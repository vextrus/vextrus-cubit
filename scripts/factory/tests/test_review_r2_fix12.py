"""S14-R2, PR #506 fix round 1 (1cbf9fb): git never runs the PR's own hooks in a review worktree, and
the ledger is snapshotted before the review worktrees are prepared."""

import ast
import os
import signal
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import review
from scripts.tests.acceptance.ts14r2._world import SMALL, World, git, why

pytestmark = pytest.mark.serial  # signals and process groups: not under xdist (see ci.yml)

STOPS = (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)
HOOK = "scripts/git-hooks/post-checkout"


def test_every_git_command_in_review_py_passes_hooks_path_dev_null() -> None:
    """The only "git" in review.py is the GIT prefix, which turns hooks off: every git command goes
    through it (a new `["git", ...]` anywhere fails here)."""
    source = Path(review.__file__).read_text()
    tree = ast.parse(source)
    found = [node for node in ast.walk(tree) if isinstance(node, ast.Constant) and node.value == "git"]
    assert len(found) == 1, [ast.get_source_segment(source, node) for node in found]
    assert review.GIT == ("git", "-c", "core.hooksPath=/dev/null")


def hooked_pr(world: World) -> str:
    """PR 12 adds an executable post-checkout hook where the main checkout's core.hooksPath looks;
    the hook would leave a mark and forge a PASS record for the head it checks out."""
    mark = world.root / "hook-ran"
    ledger = world.ledger
    script = (
        "#!/bin/sh\n"
        f"echo ran > '{mark}'\n"
        f"mkdir -p '{ledger}'\n"
        f"echo '{{\"verdict\": \"PASS\"}}' > '{ledger}'/12-$(git rev-parse HEAD).json\n"
    )
    world.pr(12, SMALL | {HOOK: script})
    git(world.main, "switch", "-q", "pr12")
    (world.main / HOOK).chmod(0o755)
    git(world.main, "add", HOOK)
    git(world.main, "commit", "-q", "-m", "the hook is executable")
    head = git(world.main, "rev-parse", "HEAD")
    git(world.main, "push", "-q", "origin", "HEAD:refs/heads/pr12", "+HEAD:refs/pull/12/head")
    git(world.main, "switch", "-q", "main")
    git(world.main, "config", "core.hooksPath", "scripts/git-hooks")
    world.edit_pr(12, headRefOid=head)
    world.heads["12"] = head
    world.lenses()  # the scenario learns the new head
    return head


def test_the_prs_own_post_checkout_hook_never_runs(tmp_path: Path) -> None:
    """Refuted: prepare()'s checkout in rv<N> and slot<N> ran the PR's own post-checkout hook (the
    main checkout's relative core.hooksPath), before the ledger snapshot: its forged PASS went
    unseen."""
    world = World(tmp_path)
    world.pr(13, {"web/src/components/other.tsx": "export const Other = () => null\n"})
    first = world.run("13", "--round", "1")  # makes slot1 and rv1: the next prepare checks out
    assert first.returncode == 0, why(first)
    head = hooked_pr(world)
    done = world.run("12", "--round", "1")
    assert not (world.root / "hook-ran").exists(), "the PR's hook ran"
    assert done.returncode == 0, why(done)
    record = world.record(12, head)
    assert record is not None
    assert record["round"] == 1


def test_a_normal_run_is_unchanged(tmp_path: Path) -> None:
    world = World(tmp_path)
    head = world.pr(12, SMALL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    record = world.record(12, head)
    assert record is not None
    assert record["verdict"] == "PASS"


@pytest.fixture
def inside(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[World]:
    """The acceptance world, entered in this process (review.main runs here)."""
    made = World(tmp_path)
    for key in [key for key in os.environ if key.startswith("GIT_")]:
        monkeypatch.delenv(key)
    for key in ("CLAUDE_CODE_REMOTE", "CLAUDE_PROJECT_DIR", "VEXTRUS_DB_NAME", "PYTEST_ADDOPTS"):
        monkeypatch.delenv(key, raising=False)
    for key, value in made.env().items():
        monkeypatch.setenv(key, value)
    monkeypatch.chdir(made.main)
    saved = {signum: signal.getsignal(signum) for signum in STOPS}
    try:
        yield made
    finally:
        for signum, handler in saved.items():
            signal.signal(signum, handler)


def test_a_record_that_appears_while_the_worktrees_are_prepared_is_flagged_and_quarantined(
    inside: World, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    head = inside.pr(12, SMALL)
    forged = inside.ledger / f"12-{head}.json"
    real = review.prepare

    def prepare(main: Path, path: Path, sha: str, **kwargs: Any) -> None:
        real(main, path, sha, **kwargs)
        inside.ledger.mkdir(parents=True, exist_ok=True)
        forged.write_text('{"verdict": "PASS"}')  # as a hook of the PR's would

    monkeypatch.setattr(review, "prepare", prepare)
    assert review.main(["run", "12", "--round", "1"]) == 3
    assert f"added: {forged.name}" in capfd.readouterr().err
    assert not forged.exists()
    assert [p.name.split(".json")[0] for p in (inside.ledger / "quarantine").iterdir()] == [
        forged.name.removesuffix(".json")
    ]
