"""The cross-check's codes are collected with the engine's, and each is worded in its catalogue, in the
words a QS reads (docs/design/m0-screens.md 1.1)."""

import re
from pathlib import Path

import pytest

from engine.check.decoders_agree import run
from engine.messages import Message, codes
from engine.read.acadsharp import (
    Dump,
    DumperNotInstalled,
    DumperNotPinned,
    DumperStopped,
    DumpTooLarge,
)
from engine.read.artefact import Entity, Format, ReadArtefact
from engine.read.errors import ReadError

CATALOGUE = Path(__file__).resolve().parents[3] / "web/src/messages/engine/decoders_agree/en.po"
PREFIX = "engine.decoders_agree."
FAILED = ("not_installed", "not_pinned", "stopped", "too_many")

# m0-screens 1.1's "never shown to a QS or an MD", whole, and the four words of this check's own
# machinery; each matched as a word, in any case.
NEVER = (
    "handle", "entity", "entities", "SDF", "DXF", "LibreDWG", "ACadSharp", "ezdxf", "pdf.js",
    "WebGL", "buffer", "artefact", "artifact", "render", "parse", "JSON", "sandbox", "worker", "job",
    "queue", "hash", "sha256", "tenant", "RLS", "API", "null", "undefined", "NaN", "stack trace",
    "error code", "code", "message code", "catalogue key", "UUID", "locale", "cell", "home region",
    "Rod", "model space", "shx", "ttf", "decoder", "dump", "quarantine", "Error:", "Oops", "sorry",
)  # fmt: skip


def worded() -> dict[str, str]:
    text = CATALOGUE.read_text(encoding="utf-8")
    return dict(re.findall(r'^msgid "([^"]+)"\nmsgstr "(.+)"$', text, flags=re.MULTILINE))


def test_every_code_has_its_english_and_no_other() -> None:
    declared = {held.code for held in codes() if held.code.startswith(PREFIX)}

    assert declared == set(worded()) == {PREFIX + name for name in ("disagree", *FAILED)}
    assert all(worded().values())


def test_each_message_uses_only_the_parameters_its_code_declares() -> None:
    # A code may carry more than its words use: the disagreement keeps all five counts for the
    # export and the Question's Trace, and says two of them.
    for held in codes():
        if held.code.startswith(PREFIX):
            used = set(re.findall(r"\{(\w+)[,}]", worded()[held.code]))
            assert used <= set(held.params), held.code
    assert set(re.findall(r"\{(\w+)[,}]", worded()[PREFIX + "disagree"])) == {"items", "layers"}


@pytest.mark.parametrize("word", NEVER)
def test_no_message_names_a_word_a_qs_is_never_shown(word: str) -> None:
    # As a word, after any punctuation too ("romans.shx"), and in its plural ("stack traces").
    pattern = re.compile(rf"(?<!\w){re.escape(word)}(?:s|es)?(?!\w)", re.IGNORECASE)

    assert [code for code, message in worded().items() if pattern.search(message)] == []


@pytest.mark.parametrize(
    "sample",
    ["the font romans.shx", "two stack traces", "3 error codes", "handles", "Oops, sorry!"],
)
def test_the_word_check_catches_what_1_1_names_in_any_form(sample: str) -> None:
    caught = [
        word
        for word in NEVER
        if re.search(rf"(?<!\w){re.escape(word)}(?:s|es)?(?!\w)", sample, re.IGNORECASE)
    ]

    assert caught


def test_no_message_exclaims_or_names_a_path() -> None:
    for code, message in worded().items():
        assert "!" not in message, code
        assert not re.search(r"\w/\w|\\", message), code


def test_only_a_disagreement_holds_a_file_and_a_file_read_once_fails() -> None:
    # The owner's ruling (28 Sep 2026): a file read by one reader shows 4.5's "Failed" row, never
    # "Held"; "Held" is the readers' disagreement, with its Question.
    assert "held" in worded()[PREFIX + "disagree"]
    for name in FAILED:
        message = worded()[PREFIX + name]
        assert "held" not in message.lower(), name
        assert message.startswith("This file was read once, not twice"), name
        assert "mark it for Vextrus" in message, name


def artefact() -> ReadArtefact:
    return ReadArtefact.build(
        source_sha256="0" * 64,
        source_name="KR-STR-R0.dwg",
        format=Format("dwg", "AC1032"),
        reader="libredwg",
        reader_version="0.14",
        layouts=("Model",),
        insunits=4,
        notes=(),
        blocks=(),
        entities=[Entity("8D", "LINE", "S-BEAM", "1F")],
    )


def raised_findings() -> list[Message]:
    """Every finding this check can give: its disagreement, and each failure the stage raises."""
    errors: list[ReadError] = [
        DumperNotInstalled(),
        DumperNotPinned(),
        DumperStopped("acadsharp-dump", "exit 139"),
        DumperStopped("acadsharp-dump", "limit wall"),
        DumpTooLarge(2_000_000),
    ]
    other = Dump("3.8.0", "AC1032", frozenset({0x8E}), {"LINE": 1}, {"S-BEAM": 1})
    fired = run(Path("KR-STR-R0.dwg"), artefact(), second=lambda path: other)
    assert fired.finding is not None
    return [fired.finding, *(error.message for error in errors)]


def test_no_finding_carries_the_programs_name_or_any_text() -> None:
    for finding in raised_findings():
        values = finding["params"].values()
        assert all(isinstance(value, int) for value in values), finding
        assert "acadsharp" not in repr(finding["params"]), finding
