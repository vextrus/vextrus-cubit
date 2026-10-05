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
        "> Some words here.",
        '"Some" words here.',
    ],
)
def test_a_common_word_where_a_sentence_may_start_is_never_a_candidate(sentence: str) -> None:
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


# Fix round 1 (PR #373): a name before a known code; a name after a label, an honorific or a bar.


@pytest.mark.parametrize("code", ["3D", "2D", "G1", "M1", "UTF-8", "SHA-256"])
def test_a_name_before_a_known_code_is_kept(code: str) -> None:
    assert texts(f"We checked it against the Thistlewood {code} model.") == ["Thistlewood"]
    assert texts(f"the Thistlewood Granary {code} model.") == ["Thistlewood Granary"]


@pytest.mark.parametrize(
    ("sentence", "expected"),
    [
        ("Client: Haverford", ["Haverford"]),
        ("Owner: Mr. Haverford", ["Haverford"]),
        ("The architect is Mr. Haverford of the firm.", ["Haverford"]),
        ("| Client | Haverford |", ["Haverford"]),
        ("The client is Haverford of the firm.", ["Haverford"]),
        ("Site: Dr. Quillon Rd. east", ["Quillon Rd"]),
    ],
)
def test_a_name_after_a_label_an_honorific_or_a_table_bar_is_kept(
    sentence: str, expected: list[str]
) -> None:
    assert texts(sentence) == expected


@pytest.mark.parametrize("sentence", ["Summary: This moved the check.", "| Note | The check moved |"])
def test_a_common_word_after_a_label_is_still_not_a_name(sentence: str) -> None:
    assert texts(sentence) == []


# Fix round 2 (PR #373): one rule. A capitalised word where a sentence may start (the text's first
# token, or after `.`, `!`, `?`, `:`, a table bar or a list marker) is dropped only when it is a
# common word; any other capitalised word there is a candidate.

HAVERFORD = [
    "Approved by Engr. Haverford of the firm.",
    "Owner: Mst. Haverford",
    "Designed by S. M. Haverford of the firm.",
    "A.K.M. Haverford",
    "Engineer: A. Haverford",
    "Md. Haverford",
    "Ar. Haverford",
    "Prof. Haverford",
]


@pytest.mark.parametrize("sentence", HAVERFORD)
def test_a_name_after_any_honorific_or_initial_is_asked(sentence: str) -> None:
    assert texts(sentence) == ["Haverford"]


def test_a_name_in_a_tables_first_column_is_asked() -> None:
    found = texts("| Haverford | Client |\n| Quillon | Architect |\n")
    assert found == ["Haverford", "Client", "Quillon", "Architect"]  # a later cell is a label's value


@pytest.mark.parametrize("sentence", ["The client signed.", "Approved by the client."])
def test_a_common_word_at_a_sentence_start_is_still_dropped(sentence: str) -> None:
    assert texts(sentence) == []


def test_an_uncommon_word_at_a_sentence_start_is_asked() -> None:
    assert texts("Haverford signed. Quillon too.") == ["Haverford", "Quillon"]


# PR #379 round 1: no list of content words may drop a name where a label's value or a name run stands;
# dotted sheet numbers are codes; names joined by `/` are separate.


def asked(text: str, *names: str) -> bool:
    found = texts(text)
    return all(any(name in candidate for candidate in found) for name in names)


@pytest.mark.parametrize(
    ("sentence", "names"),
    [
        ("Site: North Court", ["North Court"]),
        ("| East Annex | Site |", ["East Annex"]),
        ("CLIENT: COURT", ["COURT"]),
        ("Owner: June", ["June"]),
        ("Sheet A-1.01 shows the slab", ["A-1.01"]),
        ("see S-2.03 and E-1.02", ["S-2.03", "E-1.02"]),
        ("see ST-3.1 and GF-1.10 here", ["ST-3.1", "GF-1.10"]),
        ("Client: Haverford/Quillon", ["Haverford", "Quillon"]),
        ("Haverford\\Quillon Tower", ["Haverford", "Quillon Tower"]),
        ("North Court was measured.", ["North Court"]),
    ],
)
def test_a_name_or_a_sheet_number_in_a_label_or_a_run_is_asked(sentence: str, names: list[str]) -> None:
    assert asked(sentence, *names), texts(sentence)


def test_names_joined_by_a_slash_are_two_candidates() -> None:
    assert texts("Client: Haverford/Quillon") == ["Haverford", "Quillon"]


@pytest.mark.parametrize("token", ["v1.2", "V2.0.1", "1.2.3", "jev-1.13.0", "ruff-0.6.9"])
def test_a_version_is_not_asked(token: str) -> None:
    assert texts(f"see {token} here.") == []


@pytest.mark.parametrize("sentence", ["The client signed.", "It was done. The client signed."])
def test_a_function_word_is_never_asked(sentence: str) -> None:
    assert texts(sentence) == []


# PR #379 round 2: a token holding `/` or `\` is read whole as a code first, then split.


@pytest.mark.parametrize(
    ("sentence", "code"),
    [
        ("sheet S/101", "S/101"),
        ("drawing A/201", "A/201"),
        ("grid C/7", "C/7"),
        ("see TW/ST/12 here.", "TW/ST/12"),
        ("see QX/2026/014 here.", "QX/2026/014"),
        ("see QX\\2026\\014 here.", "QX\\2026\\014"),
    ],
)
def test_a_slash_written_code_is_asked_whole(sentence: str, code: str) -> None:
    assert code in texts(sentence)


def test_names_joined_by_a_slash_are_still_two_candidates_and_no_whole() -> None:
    assert texts("Client: Haverford/Quillon") == ["Haverford", "Quillon"]
