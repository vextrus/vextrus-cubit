"""The harness runs this ticket's two stages by the names the contract fixes, and its export holds.

Marked `needs_bwrap`: the harness reads each file in a child process of its own, where the test-only
`VEXTRUS_SANDBOX=off` is refused, so the reader runs in bubblewrap as it does in the check.
"""

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.export import SCHEMA_PATH, validate

pytestmark = pytest.mark.needs_bwrap


def test_the_harness_reads_a_pdf_set_and_its_export_is_valid(
    pdf_fixture: Callable[..., Path], tmp_path: Path
) -> None:
    drawings = tmp_path / "set"
    drawings.mkdir()
    (drawings / "S-plot.pdf").write_bytes(pdf_fixture("plot").read_bytes())
    (drawings / "scan.pdf").write_bytes(pdf_fixture("scan").read_bytes())

    document = harness.run(drawings, tmp_path / "export.json")

    validate(document, json.loads(SCHEMA_PATH.read_text(encoding="utf-8")))
    exported: Any = document
    files = {f["name"]: f for f in exported["files"]}
    plot, scan = files["S-plot.pdf"], files["scan.pdf"]
    for file in (plot, scan):
        assert {n: s["state"] for n, s in file["stages"].items()} == {
            "pdf_report": "ok",
            "page_text": "ok",
        }
    assert plot["pages"] == 3
    assert {k: plot["pdf_report"][k] for k in ("pages", "shx_comments", "rotated_pages", "refused")} == {
        "pages": 3,
        "shx_comments": 3,
        "rotated_pages": 1,
        "refused": 0,
    }
    assert (scan["pdf_report"]["refused"], scan["pdf_report"]["scan_pages"]) == (1, 1)
