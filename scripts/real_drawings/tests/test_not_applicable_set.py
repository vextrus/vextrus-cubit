"""The "not applicable" decision uses the code hash's set (ticket 21c, fix round 1: an adversary's
finding, score 45): a PR changing only what the check's checkout carries beside the engine paths (the
job's settings) was called "not applicable" by real-drawings-na.yml, so never measured."""

import io
import re
import sys
from pathlib import Path

import pytest

from scripts.real_drawings import source
from tools.lint import engine_paths

REPO = Path(__file__).resolve().parents[3]
WORKFLOW = (REPO / ".github" / "workflows" / "real-drawings-na.yml").read_text(encoding="utf-8")


def test_the_checkouts_extra_paths_are_one_file_the_workflow_reads_too() -> None:
    assert source.CHECKOUT_ALSO_FILE == REPO / ".github" / "checkout-also.txt"
    assert "vextrus/settings/**" in source.CHECKOUT_ALSO
    assert re.search(r"^\s+\.github/checkout-also\.txt$", WORKFLOW, re.MULTILINE), "not checked out"
    [engine] = re.findall(r"^\s*engine=\$\(touches (.*)\)$", WORKFLOW, re.MULTILINE)
    assert engine.split() == [
        "--patterns",
        ".github/engine-paths.txt",
        "--patterns",
        ".github/checkout-also.txt",
    ]


def test_a_settings_only_change_touches_the_check_and_a_backend_only_one_does_not(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    changed = "vextrus/settings/job.py\nvextrus/boq/models.py\nweb/src/main.tsx\n"
    monkeypatch.setattr(sys, "stdin", io.StringIO(changed))
    monkeypatch.chdir(REPO)

    engine_paths.main(
        ["--patterns", ".github/engine-paths.txt", "--patterns", ".github/checkout-also.txt"]
    )

    assert capsys.readouterr().out.split() == ["vextrus/settings/job.py"]
