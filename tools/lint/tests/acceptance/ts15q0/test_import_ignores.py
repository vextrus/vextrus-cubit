"""S15-Q0: the import contracts alert on a stale ignore (the ticket: "import-linter contracts on real
modules with unmatched-ignore alerting on").

Each case plants, in one contract of a copy of the repository's `.importlinter`, an ignored import
that matches no import in the code, and runs `lint-imports` there as CI does: it fails, naming the
planted ignore. The contracts are read from the configuration as it is, so a contract the builder
adds or drops is judged the same way; the unchanged tree (its tests included, which the ignores name)
keeps every contract.
"""

import configparser
import sys
from pathlib import Path

import pytest

from ._tree import REPO, copy_repo, output, run

LINT_IMPORTS = str(Path(sys.executable).with_name("lint-imports"))
CONFIG = ".importlinter"
PREFIX = "importlinter:contract:"
STALE = "vextrus.platform -> vextrus.planted_q0_nowhere"


def contracts() -> list[str]:
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(REPO / CONFIG)
    return [section.removeprefix(PREFIX) for section in parser.sections() if section.startswith(PREFIX)]


def plant_stale_ignore(root: Path, contract: str) -> None:
    """Add STALE to the contract's ignored imports (its first ignored import, or a new key)."""
    path = root / CONFIG
    lines = path.read_text().splitlines()
    header = lines.index(f"[{PREFIX}{contract}]")
    end = next((at for at in range(header + 1, len(lines)) if lines[at].startswith("[")), len(lines))
    keys = [at for at in range(header + 1, end) if lines[at].split("=")[0].strip() == "ignore_imports"]
    if keys:
        lines.insert(keys[0] + 1, f"    {STALE}")
    else:
        lines[header + 1 : header + 1] = ["ignore_imports =", f"    {STALE}"]
    path.write_text("\n".join(lines) + "\n")


def test_the_unchanged_code_keeps_every_contract(tmp_path: Path) -> None:
    root = copy_repo(tmp_path)

    result = run(root, LINT_IMPORTS, "--no-cache")

    assert result.returncode == 0, output(result)


@pytest.mark.parametrize("contract", contracts())
def test_an_ignore_that_matches_nothing_fails_the_contracts(tmp_path: Path, contract: str) -> None:
    root = copy_repo(tmp_path)
    plant_stale_ignore(root, contract)

    result = run(root, LINT_IMPORTS, "--no-cache")

    said = output(result)
    assert result.returncode != 0, f"lint-imports kept {contract} though its ignore matches nothing"
    assert "planted_q0_nowhere" in said, said
