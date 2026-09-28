"""Every sheet kind the default conventions hold has its code and its English, and nothing else is
worded (13's catalogue, web/src/messages/engine/sheets/en.po)."""

import re
from pathlib import Path

from engine.messages import codes as engine_codes
from engine.messages import sheets as words
from engine.recognise.tests.drawing import DEFAULT

CATALOGUE = (
    Path(__file__).resolve().parents[3] / "web" / "src" / "messages" / "engine" / "sheets" / "en.po"
)


def _catalogue() -> dict[str, str]:
    text = CATALOGUE.read_text(encoding="utf-8")
    return dict(re.findall(r'^msgid "([^"]+)"\nmsgstr "(.*)"$', text, re.MULTILINE))


def test_every_kind_of_the_default_has_its_code() -> None:
    kinds = {k for d in DEFAULT.discipline_keys() for k in DEFAULT.kinds(d)}

    assert kinds == set(words.KINDS)
    assert all(words.KINDS[k].code == f"engine.sheets.kind_{k}" for k in kinds)


def test_every_code_has_english_and_no_catalogue_entry_lacks_a_code() -> None:
    declared = {c.code for c in engine_codes() if c.code.startswith("engine.sheets.")}
    catalogue = _catalogue()

    assert set(catalogue) == declared
    assert all(value and value[0].isupper() for value in catalogue.values())


def test_no_two_kinds_are_worded_alike() -> None:
    worded = list(_catalogue().values())

    assert len(worded) == len(set(worded))
