"""The sheet conventions as data: the fields 13's rulings need, and patterns bounded at load.

A conventions file is data a QS confirms in M1 (a Drafting Profile), so a pattern in it is bounded
before any file is read: what cannot be bounded is refused (`ValueError`, which the harness turns into
`ConventionsError` before the run starts), and the text a pattern runs on is capped.
"""

import json
import re
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
        r"^\s*[A-Z]{1,4}\s*[-./]?\s*\d{1,4}[A-Z]?$",
        r"(?i)(?:^|[_\s.-])(R(?:EV)?[\s._-]?\d{1,2})(?=$|[_\s.-])",
        r"(?:[A-Z]{1,3}-)?\d{1,3}(?:/\d{1,2})?",
        r"^(?P<prefix>\D{0,8}?)(?P<running>\d{1,6})(?P<suffix>.{0,8})$",
    ],
)
def test_a_pattern_a_drafting_office_would_write_loads(pattern: str) -> None:
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
