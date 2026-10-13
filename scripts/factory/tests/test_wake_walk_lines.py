"""S26-FX2, review round 1 of PR #794: the exact closing lines `scripts/walk/run.py`'s Events writes
(`WALK - <sha8> done PASS`, `done FAIL`, `error`) wake the factory mod's orchestrator, read by the
mod's own wake.js under node; its `started` and `check` lines do not wake alone."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from scripts.walk import run

REPO = Path(__file__).resolve().parents[3]
WAKE = REPO / "tools/mod/vextrus-factory/hooks/wake.js"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not on PATH")


def submitted(log: str) -> list[str] | None:
    """wake.js's `advance` on `log` from an empty cursor: the lines it would submit, or None."""
    script = (
        f"import({json.dumps(WAKE.as_uri())}).then(({{ advance }}) => {{"
        " const text = require('fs').readFileSync(0, 'utf8');"
        " const r = advance({ cursor: { at: '', hashes: [] } }, text, Date.now(), false);"
        " process.stdout.write(JSON.stringify(r.lines)) })"
    )
    out = subprocess.run(
        ["node", "-e", script], input=log, capture_output=True, text=True, check=True, timeout=60
    )
    lines: list[str] | None = json.loads(out.stdout)
    return lines


@pytest.mark.parametrize("closing", ["done PASS", "done FAIL", "error"])
def test_the_walk_scripts_closing_line_wakes(tmp_path: Path, closing: str) -> None:
    events = run.Events(tmp_path, "4596e870")
    events("started")
    events("check c1 PASS")
    log = (tmp_path / ".private/work/factory/events.log").read_text()
    assert submitted(log) is None, "a walk's started and check lines do not wake alone"
    events(closing)
    log = (tmp_path / ".private/work/factory/events.log").read_text()
    lines = submitted(log)
    assert lines is not None, f"the walk's closing line {closing!r} wakes"
    assert lines[-1].endswith(f" WALK - 4596e870 {closing}"), lines
