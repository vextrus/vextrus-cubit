"""11's codes each have English in their catalogue, and every "how close" answer its own branch."""

import re
from pathlib import Path

import pytest

from engine.messages import bangla_ansi, font_report
from engine.messages import codes as engine_codes
from engine.render.fonts import FontReport, HowClose

WEB = Path(__file__).resolve().parents[3] / "web" / "src" / "messages" / "engine"


def _catalogue(name: str) -> dict[str, str]:
    text = (WEB / name / "en.po").read_text(encoding="utf-8")
    return dict(re.findall(r'^msgid "([^"]+)"\nmsgstr "(.*)"$', text, re.MULTILINE))


@pytest.mark.parametrize("module", [font_report, bangla_ansi])
def test_every_code_has_english_and_no_catalogue_entry_lacks_a_code(module: object) -> None:
    name = module.__name__.rsplit(".", 1)[-1]  # type: ignore[attr-defined]
    declared = {c.code for c in engine_codes() if c.code.startswith(f"engine.{name}.")}
    words = _catalogue(name)
    assert set(words) == declared
    assert all(words.values())


def test_every_how_close_answer_has_its_own_words() -> None:
    how_close = _catalogue("font_report")["engine.font_report.how_close"]
    for answer in HowClose:
        assert re.search(rf"(^|[ ,]){answer} \{{", how_close), answer


def test_a_drawing_that_names_no_font_says_nothing() -> None:
    assert FontReport((), 0, 0, 0).messages() == []
