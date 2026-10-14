"""M1-00, the contract freeze: "the Library-count fix: Library-count tests filter to their own module"
(docs/plans/M1.md, M1-00; A21's lesson 3, "Library-count tests filter to their own module; fixed once on
main by M1-00"). In session 16 a module that added Library rows broke another module's tests that
counted what `sync_library` wrote.

The class, pinned: every test under `vextrus/` that counts what `sync_library` writes (it calls
`library.sync()` or the `sync_library` command) still passes when another module has Library rows of
its own. Here `rates` is given a `library.sync` (as M1-14 will add one) that finds its rows already
written; the tests are run in their own pytest with it.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
COUNTS = re.compile(r"\blibrary\.sync\(\)|call_command\(\s*\"sync_library\"")

PLUGIN = '''\
import pytest


@pytest.fixture(autouse=True)
def another_module_has_library_rows(monkeypatch):
    """`rates` has Library rows of its own, already written: its sync writes none again."""
    monkeypatch.setattr("vextrus.rates.library.sync", lambda libraries, using: 0, raising=False)
'''


def library_count_tests() -> list[str]:
    found = []
    for path in sorted((ROOT / "vextrus").rglob("test_*.py")):
        if HERE in path.parents:
            continue
        if COUNTS.search(path.read_text(encoding="utf-8")):
            found.append(path.relative_to(ROOT).as_posix())
    return found


def test_there_are_library_count_tests_to_hold() -> None:
    assert "vextrus/drawings/tests/test_drawings_library.py" in library_count_tests()


def test_a_modules_library_counts_hold_when_another_module_has_library_rows(tmp_path: Path) -> None:
    (tmp_path / "another_module_rows.py").write_text(PLUGIN, encoding="utf-8")
    environment = {**os.environ, "PYTHONPATH": os.pathsep.join([str(tmp_path), str(ROOT)])}

    done = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "another_module_rows",
            "-p",
            "no:cacheprovider",
            "-q",
            "-rf",
            *library_count_tests(),
        ],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    failed = [line for line in done.stdout.splitlines() if line.startswith(("FAILED", "ERROR"))]
    assert done.returncode == 0, (
        "a Library-count test fails when another module has Library rows: " + "; ".join(failed),
        done.stdout[-2000:],
    )
