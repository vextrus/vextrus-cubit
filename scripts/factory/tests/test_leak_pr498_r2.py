"""PR #498 review round 2: the gates (the launcher's prompt scan, publish) always run the real scanner,
whatever `VEXTRUS_LEAKSCAN_CMD` says (the watcher's read-only seam alone); a merge file name holding a
newline cannot shift the name-to-hit mapping onto a corpus-named file.

Built on ticket S14-P7's acceptance world (`scripts/tests/acceptance/ts14p7/_world.py`, imported, never
changed): a temporary origin, an invented corpus, a fake `gh`.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.factory import launch
from scripts.factory.tests.test_leak_pr498 import NAMED, attributed, merge_adding
from scripts.tests.acceptance.ts14p7._world import (
    BRAMBLE,
    REPO,
    World,
    assert_no_text,
    commit_ready,
    hit_file,
    show,
    stub,
)


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
    return made


def clean_scanner(world: World) -> Path:
    """A scanner that calls everything clean and every stamp valid: what the seam must never pick."""
    return stub(
        world.tmp / "always-clean",
        "args = sys.argv[1:]\n"
        "if args[:1] == ['verify-stamp']:\n"
        "    print('leakscan: stamp valid'); sys.exit(0)\n"
        "summary = {'hits': 0, 'scanned': 1, 'corpus': '0' * 12, 'status': 'clean', 'reason': None}\n"
        "report = {'hits': [], 'summary': summary}\n"
        "print(json.dumps(report) if '--json' in args else 'leakscan: hits=0')\n",
    )


@pytest.mark.parametrize("seam", ["true", "clean-stub"])
def test_publish_runs_the_real_scanner_whatever_the_seam_names(world: World, seam: str) -> None:
    commit_ready(world, "s99-g1", {"docs/plan.md": hit_file(3)})
    world.to_main("s99-g1")
    before = world.origin_refs()
    env = world.env()
    env["VEXTRUS_LEAKSCAN_CMD"] = "true" if seam == "true" else str(clean_scanner(world))

    done = subprocess.run(
        [sys.executable, "-m", "scripts.factory.publish", "s99-g1"],
        cwd=world.main,
        env=env,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=600,
        check=False,
    )

    assert_no_text(done.stdout, done.stderr)
    assert done.returncode != 0, show(done)
    assert "docs/plan.md:3" in done.stderr, f"not the real scanner's refusal:\n{show(done)}"
    assert world.origin_refs() == before
    assert world.gh_writes() == []


def test_the_launchers_prompt_scan_runs_the_real_scanner_whatever_the_seam_names(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    for key, value in world.leak.env().items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_CMD", "true")
    monkeypatch.setenv("PYTHONPATH", str(REPO))
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)
    sent: list[list[str]] = []

    def send(argv: list[str]) -> tuple[int, str]:
        sent.append(argv)
        return 0, json.dumps({"ok": True})

    scan = launch.default_scan(REPO)  # this tree's scanner, as `say` runs it from the main checkout
    assert scan is not None
    assert scan(f"the yard is {BRAMBLE} today").clean is False
    done = launch.say(
        "session_01G1", f"the yard is {BRAMBLE} today", elapsed="1/60", scan=scan, send=send
    )

    assert done.exit_code != 0
    assert sent == [], "a prompt holding a corpus string was sent"


def test_a_merge_name_holding_a_newline_never_shifts_a_corpus_name_into_print(world: World) -> None:
    # "docs/0\n..." sorts before the corpus-named file in the merge's name list, so a newline in it
    # would shift that file's row.
    merge = merge_adding(world, "s99-n3", {"docs/0\nb.md": "a clean line\n", NAMED: hit_file(2)})

    found = attributed(world, merge)

    assert found is not None
    assert_no_text(json.dumps(found))
    names = [where for sha, where, _ in found if sha == merge]
    assert names
    assert all(where.startswith(("name:", "unknown:")) for where in names), names
