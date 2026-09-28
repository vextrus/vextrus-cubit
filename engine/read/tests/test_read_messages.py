"""The reader's codes are collected with the engine's, and each is worded in its English catalogue."""

import re
from pathlib import Path

from engine.messages import codes

CATALOGUE = Path(__file__).resolve().parents[3] / "web/src/messages/engine/read/en.po"


def test_every_reader_code_has_its_english_and_no_other() -> None:
    declared = {held.code for held in codes() if held.code.startswith("engine.read.")}
    text = CATALOGUE.read_text(encoding="utf-8")
    worded = dict(re.findall(r'^msgid "([^"]+)"\nmsgstr "(.+)"$', text, flags=re.MULTILINE))

    assert declared == set(worded)
    assert all(worded.values())


def test_each_message_names_the_parameters_its_code_takes() -> None:
    text = CATALOGUE.read_text(encoding="utf-8")
    worded = dict(re.findall(r'^msgid "([^"]+)"\nmsgstr "(.+)"$', text, flags=re.MULTILINE))

    for held in codes():
        if held.code.startswith("engine.read."):
            used = set(re.findall(r"\{(\w+)[,}]", worded[held.code]))
            assert used == set(held.params), held.code
