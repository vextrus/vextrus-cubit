"""`python -m engine.read.pdf <file>`: the local step's one command."""

import json
from collections.abc import Callable
from pathlib import Path

import pytest

from engine.read.pdf.__main__ import main


def test_it_prints_the_report_and_a_line_per_page(
    pdf_fixture: Callable[..., Path], capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([str(pdf_fixture("plot")), "--text"]) == 0

    lines = capsys.readouterr().out.splitlines()
    assert json.loads(lines[0]) == {"code": "engine.pdf_report.made_by_autocad", "params": {}}
    assert json.loads(lines[5])["pages"] == 3
    assert lines[6].startswith("page 1: turned 0,")
    assert "'S-101'" in lines[7]


def test_a_pdf_it_cannot_read_prints_its_finding(
    pdf_fixture: Callable[..., Path], capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([str(pdf_fixture("damaged", kind="locked"))]) == 1

    assert json.loads(capsys.readouterr().out) == {
        "refused": {"code": "engine.pdf_report.locked", "params": {}}
    }
