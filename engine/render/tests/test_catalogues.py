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


# The design gate's words (28 Sep 2026), exactly as ruled.
RULED = {
    "engine.font_report.height_defaulted": (
        "{count, plural, one {# text stores no size Vextrus can find, so Vextrus draws it at AutoCAD's"
        " standard size. It may look larger or smaller than in AutoCAD.} other {# texts store no size"
        " Vextrus can find, so Vextrus draws them at AutoCAD's standard size. They may look larger or"
        " smaller than in AutoCAD.}}"
    ),
    "engine.font_report.glyphs_missing": (
        "{count, plural, one {# text has letters or symbols Vextrus has no font for.} other {# texts"
        " have letters or symbols Vextrus has no font for.}} In As read each shows as an empty box;"
        " the text itself is kept in full. In AutoCAD and on the Plot they show as drawn."
    ),
}


@pytest.mark.parametrize("code", sorted(RULED))
def test_the_ruled_words_are_the_catalogues(code: str) -> None:
    assert _catalogue("font_report")[code] == RULED[code]
