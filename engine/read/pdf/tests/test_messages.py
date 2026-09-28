"""The report's codes are collected with the engine's, and each is worded in its English catalogue."""

import re
from pathlib import Path

from engine.messages import codes

CATALOGUE = Path(__file__).resolve().parents[4] / "web/src/messages/engine/pdf_report/en.po"
PREFIX = "engine.pdf_report."


def worded() -> dict[str, str]:
    text = CATALOGUE.read_text(encoding="utf-8")
    return dict(re.findall(r'^msgid "([^"]+)"\nmsgstr "(.+)"$', text, flags=re.MULTILINE))


def test_every_report_code_has_its_english_and_no_other() -> None:
    declared = {held.code for held in codes() if held.code.startswith(PREFIX)}

    assert declared == set(worded())
    assert all(worded().values())


def test_each_message_names_the_parameters_its_code_takes() -> None:
    words = worded()
    for held in codes():
        if held.code.startswith(PREFIX):
            used = set(re.findall(r"\{(\w+)[,}]", words[held.code]))
            assert used == set(held.params), held.code


def test_shx_appears_only_in_the_setting_to_ask_for() -> None:
    # m0-screens 1.1: "SHX" appears only inside the name of the AutoCAD setting the report asks for.
    for code, message in worded().items():
        assert "SHX" not in message.replace("PDFSHX", ""), code
