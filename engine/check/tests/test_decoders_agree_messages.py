"""The cross-check's codes are collected with the engine's, and each is worded in its catalogue."""

import re
from pathlib import Path

from engine.messages import codes

CATALOGUE = Path(__file__).resolve().parents[3] / "web/src/messages/engine/decoders_agree/en.po"
PREFIX = "engine.decoders_agree."


def worded() -> dict[str, str]:
    text = CATALOGUE.read_text(encoding="utf-8")
    return dict(re.findall(r'^msgid "([^"]+)"\nmsgstr "(.+)"$', text, flags=re.MULTILINE))


def test_every_code_has_its_english_and_no_other() -> None:
    declared = {held.code for held in codes() if held.code.startswith(PREFIX)}

    assert (
        declared
        == set(worded())
        == {
            "engine.decoders_agree.disagree",
            "engine.decoders_agree.not_installed",
            "engine.decoders_agree.not_pinned",
            "engine.decoders_agree.too_many",
        }
    )
    assert all(worded().values())


def test_each_message_names_the_parameters_its_code_takes() -> None:
    for held in codes():
        if held.code.startswith(PREFIX):
            used = set(re.findall(r"\{(\w+)[,}]", worded()[held.code]))
            assert used == set(held.params), held.code


def test_no_message_names_a_word_a_qs_is_never_shown() -> None:
    # docs/design/m0-screens.md 1.1's list, those a reader's message might reach for.
    never = ("handle", "entity", "dxf", "libredwg", "acadsharp", "sandbox", "hash", "sha256", "json")
    for code, message in worded().items():
        assert not [word for word in never if word in message.lower()], code
