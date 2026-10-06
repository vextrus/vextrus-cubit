"""S14-F2 (factory-next.md section 8, row 3, "Root-only tests: skipif, flaky-root.txt, lint"):
"the lint fails a new unguarded chmod test". A Python test that takes permissions away with chmod
passes as a non-root user and fails as root (cloud containers run as uid 0; issue #450), so a test
that does so must carry the root guard issue #450 names, `skipif(os.geteuid() == 0)`.

Seam (chosen here; no issue names it): `python -m tools.lint.root_only --root DIR`, run from the
repository, reads the test files git tracks under DIR; exit 0 when every such test is guarded,
non-zero naming the file (its path relative to DIR) when one is not. The fixture's chmod calls are
built from parts so this file holds none itself.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
FILE = "pkg/tests/test_perm.py"
CHMOD = "ch" + "mod"
GUARD = (
    '@pytest.mark.skipif(os.geteuid() == 0, reason="root ignores file modes (cloud sessions run as'
    ' root)")\n'
)


def body(call: str, *, guarded: bool) -> str:
    return (
        "import os\n"
        "from pathlib import Path\n\n"
        "import pytest\n\n\n"
        f"{GUARD if guarded else ''}"
        "def test_a_read_only_folder_refuses_writes(tmp_path: Path) -> None:\n"
        '    folder = tmp_path / "folder"\n'
        "    folder.mkdir()\n"
        f"    {call}\n"
        "    with pytest.raises(PermissionError):\n"
        '        (folder / "x").write_text("x")\n'
    )


def tree(tmp_path: Path, text: str) -> Path:
    root = tmp_path / "tree"
    (root / "pkg/tests").mkdir(parents=True)
    (root / FILE).write_text(text)
    subprocess.run(["git", "init", "-q", "-b", "main", str(root)], check=True)
    subprocess.run(["git", "-C", str(root), "add", FILE], check=True)
    return root


def lint(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.root_only", "--root", str(root)],
        cwd=REPO, env={**os.environ, "PYTHONPATH": str(REPO)},
        capture_output=True, text=True, check=False, timeout=300,
    )  # fmt: skip


REMOVING = [
    f"folder.{CHMOD}(0o555)",
    f"os.{CHMOD}(folder, 0o000)",
    f"folder.{CHMOD}(0)",
]


@pytest.mark.parametrize("call", REMOVING, ids=["path-0o555", "os-0o000", "path-0"])
def test_a_new_test_that_removes_permissions_without_the_root_guard_fails_the_lint(
    tmp_path: Path, call: str
) -> None:
    done = lint(tree(tmp_path, body(call, guarded=False)))
    assert done.returncode != 0, done.stdout + done.stderr
    assert FILE in done.stdout + done.stderr


@pytest.mark.parametrize("call", REMOVING, ids=["path-0o555", "os-0o000", "path-0"])
def test_the_same_test_with_the_root_guard_passes_the_lint(tmp_path: Path, call: str) -> None:
    done = lint(tree(tmp_path, body(call, guarded=True)))
    assert done.returncode == 0, done.stdout + done.stderr


def test_a_chmod_that_only_makes_a_file_executable_passes_the_lint(tmp_path: Path) -> None:
    done = lint(tree(tmp_path, body(f"folder.{CHMOD}(0o755)", guarded=False)))
    assert done.returncode == 0, done.stdout + done.stderr


def test_the_repository_passes_the_lint() -> None:
    done = lint(REPO)
    assert done.returncode == 0, done.stdout + done.stderr
