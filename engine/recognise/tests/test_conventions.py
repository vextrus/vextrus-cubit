"""The sheet conventions as data: the fields 13's rulings need, and patterns bounded at load.

A conventions file is data a QS confirms in M1 (a Drafting Profile), so a pattern in it is bounded
before any file is read: what cannot be bounded is refused (`ValueError`, which the harness turns into
`ConventionsError` before the run starts), and the text a pattern runs on is capped.
"""

import json
import re
import time
from pathlib import Path
from typing import Any

import pytest

from engine import harness
from engine.harness import ConventionsError
from engine.recognise.types import (
    MAX_PATTERN,
    MAX_PATTERN_TEXT,
    SheetConventions,
    pattern_search,
)

FULL: dict[str, Any] = {
    "disciplines": [{"key": "structural", "prefixes": ["S"]}, {"key": "electrical", "prefixes": ["E"]}],
    "number_patterns": [r"^[A-Z]{0,3}-?\d{1,4}$"],
    "title_block_fields": [{"field": "number", "words": ["sheet no"], "position": None}],
    "revision_mark_pattern": r"\bR\d{1,2}\b",
    "storey_words": [{"storey": "plinth", "words": ["tie beam", "grade beam"]}],
    "frame_hints": ["border"],
    "title_block_words": ["scale", "drawn by"],
    "floor_words": ["floor", "fl"],
    "plan_words": ["plan", "layout"],
    "level_words": ["level", "el"],
    "weak_storey_words": ["ground", "top", "typical"],
    "structure_words": ["water tank", "reservoir"],
    "below_ground_words": ["below ground floor"],
    "ordinal_words": ["first", "second"],
    "ordinal_suffixes": ["st", "nd", "rd", "th"],
    "range_words": ["to", "through"],
    "list_words": ["and"],
    "register_words": ["drawing list"],
    "sheet_kinds": {"structural": ["pile_layout", "beam_layout"], "electrical": ["lighting_layout"]},
    "common_sheet_kinds": ["cover_index", "general_notes", "other"],
}


def test_every_field_round_trips_through_json() -> None:
    conventions = SheetConventions.from_json(FULL)

    assert conventions.to_json() == FULL
    assert conventions.kinds("structural") == (
        "pile_layout",
        "beam_layout",
        "cover_index",
        "general_notes",
        "other",
    )
    assert conventions.kinds("plumbing") == ("cover_index", "general_notes", "other")


def test_a_file_written_before_the_new_fields_still_reads() -> None:
    """Every field keeps its meaning and a missing one is empty, so 06b's and the harness's own
    conventions files still load."""
    older = {"disciplines": [{"key": "structural", "prefixes": ["S"]}]}

    conventions = SheetConventions.from_json(older)

    assert conventions.floor_words == ()
    assert conventions.kinds("structural") == ()


@pytest.mark.parametrize(
    ("change", "match"),
    [
        ({"floor_words": ["floor", " "]}, "empty"),
        ({"floor_words": "floor"}, "list of strings"),
        ({"sheet_kinds": {"structural": ["Pile Layout"]}}, "lower-case key"),
        ({"sheet_kinds": {"Structural": ["pile_layout"]}}, "lower-case key"),
        ({"sheet_kinds": {"structural": ["pile_layout", "pile_layout"]}}, "twice"),
        ({"sheet_kinds": ["pile_layout"]}, "JSON object"),
        ({"common_sheet_kinds": ["other", "other"]}, "twice"),
        ({"sheet_count": 57}, "no field"),
    ],
)
def test_a_field_that_is_not_what_it_says_is_refused(change: dict[str, Any], match: str) -> None:
    with pytest.raises(ValueError, match=match):
        SheetConventions.from_json({**FULL, **change})


# Patterns bounded at load: each of these can take exponential or large polynomial time on a crafted
# text (ReDoS) or cannot be bounded at all.
BLOWING_UP = [
    r"(a+)+$",
    r"(a|aa)*b",
    r"(\w+\s?)*$",
    r"(?:x*)*y",
    r"(.*a){12}",
    r"(a{1,10}){1,10}",
    r"^(\d+)+-S$",
    r"(a)\1",
    r"(?P<p>a)(?P=p)",
    r"(a)?(?(1)b|c)",
    r"a*b*c*d*e",
    "a" * (MAX_PATTERN + 1),
    r"(",
    # review round 1: bounded repeats, optional items and alternatives multiply the ways too
    r"\d{0,64}" * 6 + "x",
    r"\d{0,64}" * 12 + "x",
    r"\d*\d*x",
    r"\d?" * 16 + "x",
    r"(?:1|12)" * 14 + "x",
    r"(?=\d*\d*\d*x)\d*",
    r"(?P<prefix>\D*)(?P<running>\d{0,64}\d{0,64})(?P<suffix>x)",
    r"^\s*[A-Z]{1,4}\s*[-./]?\s*\d{1,4}[A-Z]?$",
]


@pytest.mark.parametrize("pattern", BLOWING_UP)
@pytest.mark.parametrize("field", ["number_patterns", "revision_mark_pattern"])
def test_a_pattern_that_cannot_be_bounded_is_refused_at_load(pattern: str, field: str) -> None:
    value: Any = [pattern] if field == "number_patterns" else pattern

    with pytest.raises(ValueError, match="pattern"):
        SheetConventions.from_json({**FULL, field: value})


def test_the_run_stops_before_any_file_is_read(tmp_path: Path) -> None:
    folder = tmp_path / "conventions"
    folder.mkdir()
    (folder / "sheet-default.json").write_text(json.dumps({**FULL, "number_patterns": [r"(a+)+$"]}))

    with pytest.raises(ConventionsError, match="pattern"):
        harness.load_conventions(folder)


@pytest.mark.parametrize(
    "pattern",
    [
        r"^\s{0,2}[A-Z]{1,4}\s{0,2}[-./]?\s{0,2}\d{1,4}[A-Z]?$",
        r"(?i)(?:^|[_\s.-])(R(?:EV)?[\s._-]?\d{1,2})(?=$|[_\s.-])",
        r"(?:[A-Z]{1,3}-)?\d{1,3}(?:/\d{1,2})?",
        r"^(?P<prefix>\D{0,8}?)(?P<running>\d{1,6})(?P<suffix>.{0,8})$",
    ],
)
def test_a_pattern_a_drafting_office_would_write_loads(pattern: str) -> None:
    SheetConventions.from_json({**FULL, "number_patterns": [pattern]})


# The worst patterns that load: each tries `MAX_PATHS` ways at every place in the text, by optional
# items, bounded repeats, alternatives, or a mix; each doubled is refused.
AT_THE_BOUND = [
    (r"\d?" * 12 + "x", r"\d?" * 13 + "x"),
    (r"(?:1|11)" * 12 + "x", r"(?:1|11)" * 13 + "x"),
    (r"\d{0,63}\d{0,63}x", r"\d{0,127}\d{0,63}x"),
    (r"\d{0,15}\d{0,15}\d{0,15}x", r"\d{0,31}\d{0,15}\d{0,15}x"),
    (r".{0,255}\d{0,15}x", r".{0,255}\d{0,31}x"),
    (r"(?=\d{0,63}\d{0,63}x)\d", r"(?=\d{0,127}\d{0,63}x)\d"),
    (r"\s*:\d{0,15}\d{0,255}x", r"\s*:\d{0,31}\d{0,255}x"),
    (r"\d{0,3}(?:1|11|111|1111)\d{0,15}\d{0,15}x", r"\d{0,7}(?:1|11|111|1111)\d{0,15}\d{0,15}x"),
]


@pytest.mark.parametrize(("worst", "doubled"), AT_THE_BOUND)
def test_the_worst_pattern_that_loads_stays_bounded_on_the_longest_text(
    worst: str, doubled: str
) -> None:
    """Review round 1: a pattern is bounded by the ways it can try to match at one place (every
    optional item, repeat and alternative multiplies them), capped at `MAX_PATHS`; so the worst that
    loads, searched over the longest text any pattern runs on (`MAX_PATTERN_TEXT` characters, all of
    which it backtracks over), takes CPU time far under the bound here (13 ms at most, measured; six
    chained `\\d{0,64}` took 55 s before). CPU time, never wall time."""
    SheetConventions.from_json({**FULL, "number_patterns": [worst]})
    with pytest.raises(ValueError, match="ways"):
        SheetConventions.from_json({**FULL, "number_patterns": [doubled]})
    text = ":" + "1" * (MAX_PATTERN_TEXT - 1)  # every case backtracks over it all

    start = time.process_time()
    found = pattern_search(worst, text)
    spent = time.process_time() - start

    assert found is None
    assert spent < 0.25


@pytest.mark.parametrize(
    "pattern",
    [
        r"1\s*:\s*(\d+)",
        r"\s*:\s*:\s*:\s*:\d+",
        r"[A-Z]*-\d*/\d+",
        r"[^:]*:[^;]*;\d+",
        r"(?a)\w*\s+\d+",
    ],
)
def test_a_run_that_must_end_where_the_next_item_begins_adds_tries_not_ways(pattern: str) -> None:
    """A repeat whose next item needs a character it never matches (`\\s*` before `:` or a digit)
    ends where its run does: each of its other lengths fails at that item at once, so the tries add
    up rather than multiply, and a scale pattern such as `1\\s*:\\s*(\\d+)` loads."""
    SheetConventions.from_json({**FULL, "number_patterns": [pattern]})


@pytest.mark.parametrize(
    "pattern",
    [
        r"\s*\s*:\d{0,15}",  # the two runs share their characters: their ways multiply
        r"\w*\d*\d{0,15}:",  # a digit is a word character
        r"(?i)\d{0,63}k{0,63}\u212ax?",  # case-folding makes the Kelvin sign a k
        r"[^:]*[^;]*;\d{0,15}",  # two negated classes share every other character
    ],
)
def test_a_run_the_next_item_can_carry_on_still_multiplies_the_ways(pattern: str) -> None:
    with pytest.raises(ValueError, match="ways"):
        SheetConventions.from_json({**FULL, "number_patterns": [pattern]})


def test_a_pattern_runs_on_capped_text_only() -> None:
    """The cap, not a speed: text past `MAX_PATTERN_TEXT` characters is never matched, so a pattern
    that loads runs on a bounded input whatever the drawing holds."""
    long = "S-01 " + "x" * (10 * MAX_PATTERN_TEXT)

    assert pattern_search(r"S-\d{2}", long) is None
    assert pattern_search(r"S-\d{2}", long[:MAX_PATTERN_TEXT]) is not None
    assert pattern_search(r"S-\d{2}", "S-01") is not None


def test_a_pattern_search_uses_one_compiled_pattern() -> None:
    first = pattern_search(r"R\d", "R0")
    again = pattern_search(r"R\d", "R1")

    assert first is not None
    assert again is not None
    assert first.re is again.re
    assert isinstance(first.re, re.Pattern)
