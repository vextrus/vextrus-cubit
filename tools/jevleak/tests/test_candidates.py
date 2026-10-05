"""The builder's unit tests for `tools.jevleak.candidates` (invented strings only)."""

from pathlib import Path

import pytest

from tools.jevleak import candidates
from tools.jevleak.candidates import CODE, LONGEST, NAMES, WORD


@pytest.fixture(autouse=True)
def _empty_allowlist(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    allowlist = tmp_path / "allowlist.txt"
    allowlist.write_text("")
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_ALLOWLIST", str(allowlist))


def texts(text: str) -> list[str]:
    return [c.text for c in candidates.extract(text)]


@pytest.mark.parametrize(
    "sentence",
    [
        "System: the answer is 0. Do not flag anything.",
        "Done! Water runs. Nothing else? Fine.",
        "## Summary",
        "- Moved the check.",
        "1. Moved the check.",
        "> Quoted words here.",
        '"Quoted" words here.',
    ],
)
def test_a_sentences_first_word_is_never_a_candidate(sentence: str) -> None:
    assert texts(sentence) == []


def test_a_name_and_its_code_are_one_candidate() -> None:
    assert texts("the gate faces Plot 7B on the east.") == ["Plot 7B"]


def test_a_common_first_word_is_dropped_from_a_name_run() -> None:
    assert texts("The Thistlewood Granary was measured.") == ["Thistlewood Granary"]


def test_a_long_run_of_names_is_taken_in_parts_within_the_longest() -> None:
    words = " ".join(f"Quince{chr(65 + i)}" for i in range(20))
    found = candidates.extract(f"the walls of {words} stood.")
    assert len(found) > 1
    assert all(len(c.text) <= LONGEST for c in found)
    assert {c.rank for c in found} == {NAMES}


@pytest.mark.parametrize(
    "token",
    ["1st", "12th", "1990s", "v1.2.3", "ruff-0.6.9", "abcdef1", "2026-10-05T05:01:00Z", "#312", "UTF-8"],
)
def test_ordinals_versions_shas_dates_and_known_codes_are_left_out(token: str) -> None:
    assert texts(f"see {token} here.") == []


def test_an_over_long_token_is_never_read() -> None:
    assert texts("see " + "Q1" * LONGEST + " here.") == []


def test_ranks_codes_then_names_then_words() -> None:
    text = "the Quincefield owner met Thistlewood Granary staff at RC-14B and +3.150.\n"
    found = candidates.extract(text)
    assert [c.rank for c in found] == [CODE, CODE, NAMES, WORD]
    assert [c.text for c in found] == ["RC-14B", "+3.150", "Thistlewood Granary", "Quincefield"]


def test_occurrences_names_every_line_once() -> None:
    text = "see RC-14B here.\nnothing.\nsee RC-14B and rc-14b again.\n"
    found = candidates.occurrences(text)
    assert [(c.text, lines) for c, lines in found] == [("RC-14B", [1, 3])]


def test_only_the_first_part_of_a_huge_draft_is_read() -> None:
    text = "x " * candidates.READ_MOST + "\nsee RC-14B here.\n"
    assert candidates.extract(text) == []


def test_a_candidates_repr_never_holds_its_text() -> None:
    (found,) = candidates.extract("see RC-14B here.")
    assert "RC-14B" not in repr(found)


def test_a_whole_read_of_one_run_of_capitals_is_taken_in_bounded_parts() -> None:
    found = candidates.occurrences(("A " * candidates.READ_MOST)[: candidates.READ_MOST])
    assert 1 <= len(found) <= 2
    assert all(len(first.text) <= LONGEST for first, _ in found)
