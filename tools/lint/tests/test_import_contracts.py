"""The import contracts hold: a wrong import, planted in a copy of the code, breaks `lint-imports`.

Each case copies `vextrus/` and `engine/` into a temporary folder, plants one import the module map
forbids (docs/architecture.md), and runs the repository's `.importlinter` there.
"""

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
LINT_IMPORTS = Path(sys.executable).with_name("lint-imports")


def copy_code(target: Path) -> None:
    for package in ("vextrus", "engine"):
        shutil.copytree(
            REPO / package, target / package, ignore=shutil.ignore_patterns("__pycache__", "tests")
        )
    shutil.copy(REPO / ".importlinter", target / ".importlinter")


def lint_imports(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(LINT_IMPORTS), "--no-cache"], cwd=root, capture_output=True, text=True, check=False
    )


def test_the_unchanged_code_keeps_every_contract(tmp_path: Path) -> None:
    copy_code(tmp_path)

    result = lint_imports(tmp_path)

    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize(
    ("importer", "line", "contract"),
    [
        (
            "vextrus/platform/services/__init__.py",
            "import vextrus.takeoff.services",
            "The modules import only lower layers",
        ),
        (
            "vextrus/takeoff/services/__init__.py",
            "import vextrus.rates.services",
            "The modules import only lower layers",
        ),
        (
            "engine/read/__init__.py",
            "import django.db",
            "The engine imports no Django",
        ),
        (
            "engine/recognise/__init__.py",
            "import vextrus.platform.services",
            "The engine imports no Django",
        ),
        (
            "vextrus/projects/services/__init__.py",
            "import vextrus.platform.models",
            "Private models: only platform",
        ),
    ],
)
def test_a_wrong_import_breaks_its_contract(
    tmp_path: Path, importer: str, line: str, contract: str
) -> None:
    copy_code(tmp_path)
    path = tmp_path / importer
    path.write_text(path.read_text() + f"\n{line}\n")

    result = lint_imports(tmp_path)

    assert result.returncode != 0
    broken = [row for row in result.stdout.splitlines() if "BROKEN" in row or contract in row]
    assert any(contract in row for row in broken), result.stdout
    assert "Contracts: 13 kept, 1 broken." in result.stdout
