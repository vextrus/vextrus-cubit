"""T-XDIST (issue #248): two collections of the suite give the same node ids, or xdist refuses to start
("Different tests were collected between gw0 and gw1")."""

import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]


def node_ids() -> set[str]:
    environ = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("PYTEST_XDIST_") and key != "PYTEST_ADDOPTS"
    }
    done = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "-p", "no:cacheprovider"],
        cwd=REPO,
        env=environ,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stdout[-4000:] + done.stderr[-4000:]
    return {line for line in done.stdout.splitlines() if "::" in line}


def test_two_collections_of_the_suite_give_the_same_node_ids() -> None:
    first, second = node_ids(), node_ids()

    changed = sorted(first ^ second)
    assert not changed, "node ids that change between collections:\n" + "\n".join(
        repr(nodeid[:160]) for nodeid in changed
    )
    assert len(first) > 1000, len(first)
