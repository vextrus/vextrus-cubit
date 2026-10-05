"""PR #356's review round 1 (T-LEAK-HOOK): the pre-push hook refuses every tag, by name or by sha.

`git push origin <sha>:refs/tags/v1` hands the hook the raw sha as its local ref, so a check on the local
name alone let a tag through, its message unscanned. Real pushes to a local bare remote; no network.
"""

import subprocess
from pathlib import Path

import pytest

from tools.leakscan.tests.acceptance._leak import REPO, Leak, commit, git, temp_repo

HOOKS = REPO / "scripts/git-hooks"
TAG_REFUSAL = "pre-push: tags are not pushed"


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def _repo(leak: Leak) -> tuple[Path, Path]:
    remote = leak.tmp / "remote.git"
    git(leak.tmp, "init", "-q", "--bare", str(remote))
    repo, _ = temp_repo(leak.tmp / "work")
    git(repo, "remote", "add", "origin", str(remote))
    git(repo, "push", "-q", "origin", "main")
    git(repo, "fetch", "-q", "origin")
    git(repo, "config", "core.hooksPath", str(HOOKS))
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    git(repo, "tag", "-a", "v1", "-m", "a clean tag message")
    return repo, remote


def _push(leak: Leak, repo: Path, refspec: str) -> subprocess.CompletedProcess[str]:
    env = leak.env()
    env.pop("PYTHONPATH", None)
    return subprocess.run(
        ["git", "push", "origin", refspec],
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _remote_has(remote: Path, ref: str) -> bool:
    done = subprocess.run(
        ["git", "--git-dir", str(remote), "rev-parse", "--verify", "-q", ref],
        capture_output=True,
        text=True,
        check=False,
    )
    return done.returncode == 0


@pytest.mark.parametrize(
    ("source", "target"),
    [
        ("v1", "refs/tags/v1"),  # an annotated tag by name
        ("tag-sha", "refs/tags/v1"),  # an annotated tag by its sha
        ("tag-sha", "refs/heads/tagged"),  # an annotated tag's sha to a branch name
        ("HEAD", "refs/tags/v2"),  # a commit's sha to a tag name
    ],
)
def test_every_tag_push_is_refused_by_the_hook(leak: Leak, source: str, target: str) -> None:
    repo, remote = _repo(leak)
    spec = {
        "v1": "refs/tags/v1",
        "tag-sha": git(repo, "rev-parse", "v1"),  # the tag object, not its commit
        "HEAD": git(repo, "rev-parse", "HEAD"),
    }[source]
    done = _push(leak, repo, f"{spec}:{target}")
    assert done.returncode != 0
    assert TAG_REFUSAL in done.stderr, done.stderr
    assert not _remote_has(remote, target)


def test_a_branch_push_beside_the_tag_still_passes(leak: Leak) -> None:
    repo, remote = _repo(leak)
    done = _push(leak, repo, "HEAD:refs/heads/feature")
    assert done.returncode == 0, done.stderr
    assert _remote_has(remote, "refs/heads/feature")
