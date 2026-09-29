"""scripts/owner/keys-custody.sh, which the owner runs as root: what a test can check without raising
privilege (its syntax, its installed copy's list against the runner's, and that it moves and removes by
name, never copies or deletes recursively)."""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

from scripts.real_drawings import runner

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "owner" / "keys-custody.sh"


def test_the_script_parses() -> None:
    done = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stderr


@pytest.mark.skipif(shutil.which("shellcheck") is None, reason="no shellcheck here")
def test_shellcheck_finds_nothing() -> None:
    done = subprocess.run(["shellcheck", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stdout


def test_it_installs_exactly_the_files_the_runner_checks_against_mains() -> None:
    block = re.search(r"(?s)^RUNNER_FILES=\((.*?)^\)", SCRIPT.read_text(), re.M)
    assert block is not None
    assert tuple(block.group(1).split()) == runner.FILES


def test_it_moves_keys_and_removes_drafts_by_name_never_copying_or_deleting_recursively() -> None:
    text = SCRIPT.read_text()
    assert 'mv -- "$DRAFTS/$set.json" "$KEY_DIR/$set.json"' in text
    copies = [line for line in text.splitlines() if re.search(r"\b(cp|install|cat|ln)\b", line)]
    assert not [line for line in copies if "DRAFTS" in line or "KEY_DIR" in line], copies
    assert not re.search(r"\brm\s+-[a-zA-Z]*[rR]", text)
    assert 'rm -f -- "$file"' in text


def test_it_installs_main_s_committed_files_never_the_working_trees() -> None:
    text = SCRIPT.read_text()
    assert "from_main tools/scorer/score.py" in text
    assert 'from_main "$file"' in text
    assert not re.search(r"\$ROOT/(tools|scripts)/", text)


def test_its_paths_are_the_runners_and_the_scorers() -> None:
    text = SCRIPT.read_text()
    for path in (runner.RUNNER, runner.INSTALLED, runner.SPOOL, runner.HOME, runner.BIN, runner.SCORER):
        name = str(path).rsplit("/", 1)[-1]
        assert name in text, path
    assert f"RUN_USER={runner.RUNNER_USER}" in text
