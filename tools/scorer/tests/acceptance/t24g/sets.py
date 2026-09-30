"""Shared pieces of ticket 24g's acceptance tests (session 07's ruling R1, "the scorer's contract
corrections"). Invented keys and exports only, built with ticket 24s's `runs` helpers.
"""

import json
import re
from pathlib import Path

import pytest

from scripts.real_drawings.tests import exports
from tools.scorer.tests.acceptance.t24s.runs import JSON, Place, export_sheet, key_sheet

REPO = Path(__file__).resolve().parents[5]
CONVENTIONS = REPO / "engine" / "recognise" / "conventions" / "view-default.json"


def total(output: str, name: str, n: int, of: int) -> bool:
    """True when a line names `name` and gives `n / N` (the scorer's way of writing a total)."""
    return (
        re.search(rf"(?im)^.*\b{re.escape(name)}\b.*(?<![\d/])\b{n} / {of}\b(?![\d/])", output)
        is not None
    )


def engine_subjects() -> list[str]:
    """The engine's subject words, as `view-default.json` holds them (its `subject_words` keys)."""
    words: list[str] = list(json.loads(CONVENTIONS.read_text())["subject_words"])
    return words


def one_sheet(place: Place, key_views: list[JSON], export_views: list[JSON]) -> None:
    """One layout sheet whose six fields match; only its views differ."""
    place.write_keys([key_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", key_views)])
    place.write_run([export_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", export_views)])


def shown(capfd: pytest.CaptureFixture[str]) -> str:
    output = capfd.readouterr()
    return output.out + output.err


def unsubjected_view(box: list[float], title: str, kind: str = "plan") -> JSON:
    """An export view whose subject is null (the engine found none of its words)."""
    view: JSON = exports.view(box, title=title, kind=kind, subject=None)
    return view
