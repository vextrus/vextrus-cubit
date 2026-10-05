"""Ticket T-Q16, T-249's B case 9 restricted to this ticket's modules: the runner the key user installs
(`scripts/owner/keys-custody.sh`'s `RUNNER_FILES`) and the files the runner checks against main's
(`scripts.real_drawings.runner.FILES`) stay one list, and both carry `tools/lint/import_closure.py`,
which `source.read_key` imports: without it the installed command could not start."""

import re
from pathlib import Path

from scripts.real_drawings import runner

REPO = Path(__file__).resolve().parents[5]
CUSTODY = REPO / "scripts" / "owner" / "keys-custody.sh"
CLOSURE = "tools/lint/import_closure.py"


def installed() -> tuple[str, ...]:
    block = re.search(r"(?s)^RUNNER_FILES=\((.*?)^\)", CUSTODY.read_text(encoding="utf-8"), re.M)
    assert block is not None
    return tuple(block.group(1).split())


def test_the_runner_checks_the_import_closure_against_mains() -> None:
    assert CLOSURE in runner.FILES


def test_the_custody_script_installs_the_import_closure() -> None:
    assert CLOSURE in installed()


def test_the_installed_list_and_the_runners_list_stay_one_list() -> None:
    assert installed() == runner.FILES
