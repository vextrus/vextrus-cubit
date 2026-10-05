"""Ticket 24g, R1 "Subjects": "the scorer holds the engine's 14 subject words as a fixed table (a
committed test fails if it differs from `engine/recognise/conventions/view-default.json`)".

Amended for T-W316 (the owner's rulings of 5 Oct 2026, session 13: site works go to the Site & MEP
Step; presentation plans are proposed to leave out): the engine's words are now 16, the 14 and
`site_works` and `presentation`, and the scorer's table follows them.

The scorer stays standard-library only and imports nothing from the project, so the table is a copy;
these tests compare the copy with the engine's conventions, both ways: every engine word maps to itself,
and the one table the scorer holds has exactly the engine's words, no more.
"""

import importlib
from collections.abc import Iterable
from pathlib import Path
from types import ModuleType

import pytest

from tools.scorer.tests.acceptance.t24s.runs import Place, export_view, key_view

from .sets import engine_subjects, one_sheet, shown, total


def _folded(word: str) -> str:
    return " ".join(word.replace("_", " ").casefold().split())


# The engine's subject words: 24g's 14, then T-W316's two.
SIXTEEN = {
    "pile_cap",
    "pile",
    "foundation",
    "column",
    "shear_wall",
    "retaining_wall",
    "beam",
    "slab",
    "stair",
    "tank",
    "grid",
    "fixture",
    "toilet",
    "opening",
    "site_works",
    "presentation",
}


def test_the_engine_has_sixteen_subject_words_the_fourteen_and_site_works_and_presentation() -> None:
    words = engine_subjects()
    assert len(words) == 16
    assert set(words) == SIXTEEN


def test_every_engine_subject_word_written_with_spaces_is_right_against_the_export(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    words = engine_subjects()
    place = Place(tmp_path)
    boxes = [[10.0 + 150.0 * i, 10.0, 110.0 + 150.0 * i, 110.0] for i in range(len(words))]
    one_sheet(
        place,
        [
            key_view(box, f"View {i}", subject=word.replace("_", " "))
            for i, (box, word) in enumerate(zip(boxes, words, strict=True))
        ],
        [
            export_view(box, f"View {i}", subject=word)
            for i, (box, word) in enumerate(zip(boxes, words, strict=True))
        ],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "view subjects", len(words), len(words)), output
    assert "outside the vocabulary: 0" in output or "outside the vocabulary" not in output


def _word_tables(module: ModuleType) -> list[set[str]]:
    """Every module-level collection of text in the scorer holding the words "column" and "pile cap"
    (in either spelling): the subject table, whatever the builder names it."""
    tables = []
    for value in vars(module).values():
        if isinstance(value, dict):
            items: Iterable[object] = value.keys()
        elif isinstance(value, (list, tuple, set, frozenset)):
            items = value
        else:
            continue
        texts = [item for item in items if isinstance(item, str)]
        if not texts or len(texts) != len(list(items)):
            continue
        folded = {_folded(text) for text in texts}
        if {"column", "pile cap"} <= folded:
            tables.append(folded)
    return tables


def test_the_scorers_subject_table_is_exactly_the_engines_words() -> None:
    module = importlib.import_module("tools.scorer.score")
    tables = _word_tables(module)
    assert len(tables) == 1, f"expected one subject table in the scorer, found {len(tables)}"
    assert tables[0] == {_folded(word) for word in engine_subjects()}
