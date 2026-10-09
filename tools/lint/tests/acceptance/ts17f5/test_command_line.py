"""Ticket S17-F5: `python -m tools.lint.contract_fixtures --schema <openapi.json> <file>...` as CI's
step and verify run it, from any folder: exit 0 when every fixture conforms, 1 when one does not, the
problem printed naming the file, the JSON path and the word.
"""

import os
import subprocess
import sys
from pathlib import Path

from .support import MODULE, line_naming, listing, proposal, write, write_schema

ROOT = Path(__file__).resolve().parents[5]


def command(folder: Path, *args: str) -> tuple[int, str]:
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    done = subprocess.run(
        [sys.executable, "-m", MODULE, *args], cwd=folder, env=env, capture_output=True, text=True
    )
    return done.returncode, done.stdout + done.stderr


def test_the_command_passes_a_conforming_fixture(tmp_path: Path) -> None:
    write_schema(tmp_path)
    write(tmp_path, "good.json", listing(proposal()))
    code, text = command(tmp_path, "--schema", "openapi.json", "good.json")
    assert code == 0, f"{MODULE}: {text}"


def test_the_command_fails_a_state_word_naming_file_path_and_word(tmp_path: Path) -> None:
    write_schema(tmp_path)
    write(tmp_path, "state-word.json", listing(proposal(state="proposal")))
    code, text = command(tmp_path, "--schema", "openapi.json", "state-word.json")
    assert code == 1, f"{MODULE}: {text}"
    where = "$.body.proposals[0].state"
    assert line_naming(text, "state-word.json", where, "proposal"), f"{MODULE}: {text}"
