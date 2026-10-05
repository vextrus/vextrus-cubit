"""Ticket f2, B4: `scripts/git-hooks/pre-push` (spec 5 item 10; leakscan-cli.md 6).

The hook runs `python -m tools.leakscan range <remote-sha-or-merge-base>..<local-sha> --ref <ref>
--no-stamp` for each pushed ref, "the push is refused" on a hit, and fails closed with no corpus. It
finds the scanner through its own location, not the pushing repository. Real pushes to a local bare
remote; no network. Today the hook does not exist.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

from ._leak import MARIGOLD, REPO, ZEBRA, Leak, assert_no_text, commit, git, git_env, temp_repo

HOOKS = REPO / "scripts/git-hooks"
HOOK = HOOKS / "pre-push"
ZEROS = "0" * 40
HIT_LINE = re.compile(r"^HIT \S+ \d+$", re.MULTILINE)


def _env(leak: Leak) -> dict[str, str]:
    env = leak.env()
    env.pop("PYTHONPATH", None)  # the hook must find tools.leakscan by its own path
    return env


def _pushing_repo(leak: Leak) -> tuple[Path, Path]:
    remote = leak.tmp / "remote.git"
    subprocess.run(["git", "init", "-q", "--bare", str(remote)], check=True, env=_env(leak))
    repo, _ = temp_repo(leak.tmp / "work")
    git(repo, "remote", "add", "origin", str(remote))
    git(repo, "push", "-q", "origin", "main")
    git(repo, "fetch", "-q", "origin")
    git(repo, "config", "core.hooksPath", str(HOOKS))
    git(repo, "checkout", "-q", "-b", "feature")
    return repo, remote


def _push(leak: Leak, repo: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "push", "origin", "feature"],
        cwd=repo,
        env=_env(leak),
        capture_output=True,
        text=True,
        check=False,
    )


def _remote_has(remote: Path, branch: str) -> bool:
    done = subprocess.run(
        ["git", "--git-dir", str(remote), "rev-parse", "--verify", "-q", f"refs/heads/{branch}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return done.returncode == 0


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def test_the_hook_is_an_executable_file() -> None:
    assert HOOK.is_file()
    assert HOOK.stat().st_mode & 0o111


def test_a_clean_push_succeeds_and_writes_no_stamp(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    done = _push(leak, repo)
    assert done.returncode == 0, done.stderr
    assert _remote_has(remote, "feature")
    assert leak.stamps() == []


def test_a_push_adding_a_string_is_refused_with_location_and_count_only(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": f"clean\n{ZEBRA}\n"}, "feat: clean message")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert not _remote_has(remote, "feature")
    output = done.stdout + done.stderr
    assert re.search(r"^(?:remote: )?HIT b\.txt:2 1$", output, re.MULTILINE), "no file:line hit line"
    assert_no_text(done)


def test_a_push_whose_message_holds_a_string_is_refused(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, f"feat: clean subject\n\n{MARIGOLD}")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert not _remote_has(remote, "feature")
    assert HIT_LINE.search(done.stdout + done.stderr)
    assert_no_text(done)


def test_a_push_whose_file_name_holds_a_string_is_refused(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {f"plans/{MARIGOLD}.txt": "clean\n"}, "feat: clean message")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert not _remote_has(remote, "feature")
    assert_no_text(done)


def test_with_no_corpus_the_hook_fails_closed(tmp_path: Path) -> None:
    leak = Leak(tmp_path)  # never built
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert not _remote_has(remote, "feature")


def _run_hook(leak: Leak, repo: Path, remote: Path, stdin: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(HOOK), "origin", str(remote)],
        cwd=repo,
        env=_env(leak),
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
    )


def test_the_hook_reads_gits_lines_for_a_new_branch_and_a_delete(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    clean = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    new_branch = f"refs/heads/feature {clean} refs/heads/feature {ZEROS}\n"
    assert _run_hook(leak, repo, remote, new_branch).returncode == 0
    main = git(repo, "rev-parse", "origin/main")
    delete = f"(delete) {ZEROS} refs/heads/old {main}\n"
    assert _run_hook(leak, repo, remote, delete).returncode == 0
    dirty = commit(repo, {"c.txt": f"{ZEBRA}\n"}, "feat: then a leak")
    done = _run_hook(leak, repo, remote, f"refs/heads/feature {dirty} refs/heads/feature {ZEROS}\n")
    assert done.returncode != 0
    assert_no_text(done)
    assert leak.stamps() == []


# --------------------------------------------------------------------------------------------------
# Ticket T-LEAK-HOOK (#306): the base is the merge-base with origin/main for every pushed ref, so a merge
# of main is not rescanned and nothing unpublished is skipped; and the hook works from a linked worktree,
# running the main checkout's scanner on the main checkout's corpus, failing closed with a plain line.

NO_MERGE_BASE = "no merge-base with origin/main; refusing (fetch origin first)"
CLOUD_SKIP = "skipped (cloud session: no corpus)"
STUB_MARKER = "stub-python3-was-run"
PLACED_HIT = re.compile(r"^(?:remote: )?HIT b\.txt:2 1$", re.MULTILINE)


def _publish_main(repo: Path, files: dict[str, str], message: str) -> str:
    """A commit on main, published to the remote's main without the hook, then fetched."""
    git(repo, "checkout", "-q", "main")
    sha = commit(repo, files, message)
    git(repo, "push", "-q", "--no-verify", "origin", "main")
    git(repo, "fetch", "-q", "origin")
    git(repo, "checkout", "-q", "feature")
    return sha


def _remote_sha(remote: Path, branch: str) -> str:
    done = subprocess.run(
        ["git", "--git-dir", str(remote), "rev-parse", "--verify", "-q", f"refs/heads/{branch}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return done.stdout.strip()


def test_a_merge_of_main_is_not_rescanned(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert _push(leak, repo).returncode == 0
    _publish_main(repo, {"m.txt": f"{ZEBRA}\n"}, "main: an already public commit")
    git(repo, "merge", "-q", "--no-ff", "--no-edit", "origin/main")
    merged = git(repo, "rev-parse", "HEAD")
    done = _push(leak, repo)
    assert done.returncode == 0, done.stderr
    assert _remote_sha(remote, "feature") == merged


def test_an_unpublished_leak_still_refuses_after_a_merge_of_main(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert _push(leak, repo).returncode == 0
    before = _remote_sha(remote, "feature")
    _publish_main(repo, {"m.txt": f"{ZEBRA}\n"}, "main: an already public commit")
    commit(repo, {"c.txt": f"clean\n{MARIGOLD}\n"}, "feat: an unpublished line")
    git(repo, "merge", "-q", "--no-ff", "--no-edit", "origin/main")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert _remote_sha(remote, "feature") == before
    assert re.search(r"^(?:remote: )?HIT c\.txt:2 1$", done.stderr, re.MULTILINE), done.stderr
    assert_no_text(done)


def test_a_leak_on_the_remote_branch_but_not_on_main_is_rescanned(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": f"{ZEBRA}\n"}, "feat: pushed past the hook")
    git(repo, "push", "-q", "--no-verify", "origin", "feature")
    before = _remote_sha(remote, "feature")
    commit(repo, {"c.txt": "clean\n"}, "feat: clean")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert _remote_sha(remote, "feature") == before
    assert HIT_LINE.search(done.stderr), done.stderr
    assert_no_text(done)


def test_a_leak_only_in_published_main_never_merged_is_not_scanned(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    _publish_main(repo, {"m.txt": f"{ZEBRA}\n"}, "main: an already public commit")
    commit(repo, {"b.txt": "clean\n"}, "feat: clean, off the old main")
    done = _push(leak, repo)
    assert done.returncode == 0, done.stderr
    assert _remote_has(remote, "feature")


def test_an_existing_branch_with_no_origin_main_is_refused(leak: Leak) -> None:
    repo, remote = _pushing_repo(leak)
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert _push(leak, repo).returncode == 0
    before = _remote_sha(remote, "feature")
    git(repo, "update-ref", "-d", "refs/remotes/origin/main")
    commit(repo, {"c.txt": "clean\n"}, "feat: clean again")
    done = _push(leak, repo)
    assert done.returncode != 0
    assert _remote_sha(remote, "feature") == before
    assert NO_MERGE_BASE in done.stderr


# The worktree group: a temporary "main checkout" holding the hook and the scanner (committed), its hooks
# path the relative `scripts/git-hooks`, a `.venv/bin/python` and its corpus in its private work folder;
# the push comes from a linked worktree with no VEXTRUS_* variable and a stub `python3` first on PATH.


class Checkout:
    def __init__(self, leak: Leak) -> None:
        self.leak = leak
        self.remote = leak.tmp / "origin.git"
        self.main = leak.tmp / "main"
        self.tree = leak.tmp / "worktree"
        self.stubs = leak.tmp / "stubs"
        self.home = self.main / ".private" / "work" / "leakscan"

    def env(self, **extra: str) -> dict[str, str]:
        env = {name: value for name, value in git_env().items() if not name.startswith("VEXTRUS_")}
        env.pop("PYTHONPATH", None)
        env["PATH"] = f"{self.stubs}{os.pathsep}{env['PATH']}"
        env.update(extra)
        return env

    def push(self, **extra: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", "push", "origin", "feature"],
            cwd=self.tree,
            env=self.env(**extra),
            capture_output=True,
            text=True,
            check=False,
        )


def _executable(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    path.chmod(0o755)


@pytest.fixture
def checkout(tmp_path: Path) -> Checkout:
    leak = Leak(tmp_path)
    made = Checkout(leak)
    main = made.main
    subprocess.run(["git", "init", "-q", "--bare", str(made.remote)], check=True, env=git_env())
    main.mkdir()
    git(main, "init", "-q", "-b", "main")
    _executable(main / "scripts/git-hooks/pre-push", HOOK.read_text())
    (main / "tools/leakscan").mkdir(parents=True)
    (main / "tools/__init__.py").write_bytes((REPO / "tools/__init__.py").read_bytes())
    for source in sorted((REPO / "tools/leakscan").iterdir()):
        if source.is_file():
            (main / "tools/leakscan" / source.name).write_bytes(source.read_bytes())
    (main / "README.md").write_text("a clean main checkout\n")
    git(main, "add", "--", "scripts", "tools", "README.md")
    git(main, "commit", "-q", "-m", "base: the hook and the scanner")
    git(main, "remote", "add", "origin", str(made.remote))
    git(main, "push", "-q", "origin", "main")
    git(main, "fetch", "-q", "origin")
    git(main, "config", "core.hooksPath", "scripts/git-hooks")
    _executable(main / ".venv/bin/python", f'#!/bin/sh\nexec "{sys.executable}" "$@"\n')
    # The corpus: the invented literals and more than CORPUS_FLOOR others, built through the seam (the
    # push itself runs with no seam, so the floor applies).
    invented = [f"Invented Orchard Parcel {n:03d} Lane" for n in range(120)]
    (leak.sources / "more.txt").write_text("\n".join(invented) + "\n")
    leak.home = made.home
    leak.build()
    assert (made.home / "corpus").is_file()
    _executable(made.stubs / "python3", f"#!/bin/sh\necho {STUB_MARKER} >&2\nexit 97\n")
    git(main, "worktree", "add", "-q", str(made.tree), "-b", "feature")
    return made


def test_a_clean_push_from_a_worktree_succeeds(checkout: Checkout) -> None:
    commit(checkout.tree, {"b.txt": "clean\n"}, "feat: clean")
    done = checkout.push()
    assert done.returncode == 0, done.stderr
    assert _remote_has(checkout.remote, "feature")
    assert checkout.leak.stamps() == []
    assert STUB_MARKER not in done.stdout + done.stderr


def test_a_leak_pushed_from_a_worktree_refuses_on_the_main_checkouts_corpus(
    checkout: Checkout,
) -> None:
    commit(checkout.tree, {"b.txt": f"clean\n{ZEBRA}\n"}, "feat: clean message")
    done = checkout.push()
    assert done.returncode != 0
    assert not _remote_has(checkout.remote, "feature")
    assert PLACED_HIT.search(done.stderr), done.stderr
    assert_no_text(done)


def test_the_branchs_own_scanner_is_not_trusted(checkout: Checkout) -> None:
    tree = checkout.tree
    commit(tree, {"tools/leakscan/cli.py": "import sys\n\nsys.exit(0)\n"}, "feat: a scanner that passes")
    commit(tree, {"b.txt": f"clean\n{ZEBRA}\n"}, "feat: clean message")
    done = checkout.push()
    assert done.returncode != 0
    assert not _remote_has(checkout.remote, "feature")
    assert PLACED_HIT.search(done.stderr), done.stderr
    assert_no_text(done)


@pytest.mark.parametrize("broken", ["no-scanner", "python-fails", "no-corpus", "not-a-checkout"])
def test_a_broken_main_checkout_fails_closed_with_a_plain_line(checkout: Checkout, broken: str) -> None:
    commit(checkout.tree, {"b.txt": "clean\n"}, "feat: clean")
    extra: dict[str, str] = {}
    if broken == "no-scanner":
        (checkout.main / "tools/leakscan").rename(checkout.main / "tools/moved-away")
    elif broken == "python-fails":
        _executable(checkout.main / ".venv/bin/python", "#!/bin/sh\nexit 7\n")
    elif broken == "no-corpus":
        (checkout.home / "corpus").unlink()
        assert (checkout.main / ".private").is_dir()
    else:
        elsewhere = checkout.leak.tmp / "not-a-checkout"
        elsewhere.mkdir()
        extra["VEXTRUS_MAIN_CHECKOUT"] = str(elsewhere)
    done = checkout.push(**extra)
    assert done.returncode != 0
    assert not _remote_has(checkout.remote, "feature")
    assert "Traceback" not in done.stdout + done.stderr
    assert_no_text(done)
    plain = [line for line in done.stderr.splitlines() if line.startswith("pre-push:")]
    assert any("main checkout" in line for line in plain), done.stderr


def test_the_cloud_skip_still_works_from_a_worktree(checkout: Checkout) -> None:
    commit(checkout.tree, {"b.txt": "clean\n"}, "feat: clean")
    (checkout.main / ".private").rename(checkout.leak.tmp / "private-moved-away")
    done = checkout.push(CLAUDE_CODE_REMOTE="true")
    assert done.returncode == 0, done.stderr
    assert _remote_has(checkout.remote, "feature")
    assert CLOUD_SKIP in done.stderr
