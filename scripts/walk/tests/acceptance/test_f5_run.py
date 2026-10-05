"""f5 acceptance: `scripts/walk/run.py`, the script layer's launcher (docs/specs/factory.md 5 "G1").

"it serves that head from a scratch worktree with its own database (`vextrus_walk_<sha8>`), its own ports
(`VEXTRUS_WEB_PORT`, `VEXTRUS_API_URL`) and both workers." G1's outputs "go to
`.private/work/walks/<sha40>/`". The owner's dev server is on 5410 and the API on 8000 (CLAUDE.md): a
walk never takes them, and never main's database `vextrus`.

Nothing here serves a stack: `plan` and `--print-plan` start nothing (the serving itself is proved by
the builder's real-set smoke, not a test).
"""

import json
import socket
import subprocess
import sys
from pathlib import Path

import pytest
from _f5_contract import ROOT  # type: ignore[import-not-found, unused-ignore]


def _root_with_commit(tmp_path: Path) -> tuple[Path, str]:
    """A throwaway repository with one commit, so the sha is present wherever `run.py` looks."""
    root = tmp_path / "root"
    root.mkdir()

    def git(*args: str) -> str:
        done = subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
        )
        return done.stdout.strip()

    git("init", "-q", "-b", "main")
    git("config", "user.email", "walk-test@example.invalid")
    git("config", "user.name", "walk test")
    git("config", "commit.gpgsign", "false")
    (root / "README.md").write_text("synthetic\n")
    git("add", "--", "README.md")
    git("commit", "-q", "--no-verify", "-m", "one")
    return root, git("rev-parse", "HEAD")


def test_the_plan_has_its_own_database_folder_and_ports(tmp_path: Path) -> None:
    from scripts.walk.run import plan

    root, sha = _root_with_commit(tmp_path)

    walk = plan(sha, root=root, web_port=5511, api_port=8811)

    assert walk.sha == sha
    assert walk.sha8 == sha[:8]
    assert walk.db_name == f"vextrus_walk_{sha[:8]}"
    assert walk.db_name != "vextrus"
    assert walk.out_dir == root / ".private" / "work" / "walks" / sha
    assert walk.worktree == root / ".private" / "work" / "walks" / "_src"
    assert (walk.web_port, walk.api_port) == (5511, 8811)
    assert walk.env["VEXTRUS_DB_NAME"] == walk.db_name
    assert walk.env["VEXTRUS_WEB_PORT"] == "5511"
    assert walk.env["VEXTRUS_API_URL"] == "http://127.0.0.1:8811"


@pytest.mark.parametrize(
    ("web_port", "api_port"),
    [(5410, 8811), (5511, 8000), (5511, 5511)],
    ids=["owner-web-port", "owner-api-port", "equal-ports"],
)
def test_the_plan_refuses_the_owners_ports_and_equal_ports(
    tmp_path: Path, web_port: int, api_port: int
) -> None:
    from scripts.walk.run import plan

    root, sha = _root_with_commit(tmp_path)

    with pytest.raises(ValueError):  # noqa: PT011 (the refusal is the promise, not its wording)
        plan(sha, root=root, web_port=web_port, api_port=api_port)


@pytest.mark.parametrize("bad", ["main", "short", "long"])
def test_the_plan_refuses_anything_but_a_full_sha(tmp_path: Path, bad: str) -> None:
    from scripts.walk.run import plan

    root, sha = _root_with_commit(tmp_path)
    given = {"main": "main", "short": sha[:12], "long": sha + "0"}[bad]

    with pytest.raises(ValueError):  # noqa: PT011 (the refusal is the promise, not its wording)
        plan(given, root=root, web_port=5511, api_port=8811)


def test_pick_ports_gives_two_free_ports_that_are_not_the_owners() -> None:
    from scripts.walk.run import pick_ports

    web, api = pick_ports()

    assert web != api
    assert {web, api}.isdisjoint({5410, 8000})
    for port in (web, api):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", port))


def test_acquire_refuses_a_live_walk_and_replaces_a_stale_one(tmp_path: Path) -> None:
    from scripts.walk.run import AlreadyRunning, acquire

    pidfile = tmp_path / "g1.pid"

    acquire(pidfile, pid=4242, is_alive=lambda pid: False)
    assert int(pidfile.read_text().strip()) == 4242

    with pytest.raises(AlreadyRunning):
        acquire(pidfile, pid=5353, is_alive=lambda pid: pid == 4242)
    assert int(pidfile.read_text().strip()) == 4242

    acquire(pidfile, pid=5353, is_alive=lambda pid: False)
    assert int(pidfile.read_text().strip()) == 5353


def test_print_plan_prints_json_and_starts_nothing(tmp_path: Path) -> None:
    root, sha = _root_with_commit(tmp_path)

    done = subprocess.run(
        [sys.executable, "-m", "scripts.walk.run", sha, "--root", str(root), "--print-plan"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert done.returncode == 0, done.stderr
    shown = json.loads(done.stdout)
    assert shown["sha"] == sha
    assert shown["db_name"] == f"vextrus_walk_{sha[:8]}"
    assert not (root / ".private").exists()

    bad = subprocess.run(
        [sys.executable, "-m", "scripts.walk.run", sha[:12], "--root", str(root), "--print-plan"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert bad.returncode == 2
    assert not (root / ".private").exists()
