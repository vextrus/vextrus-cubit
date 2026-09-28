"""The export's schema check, outside the sandbox: the subset of JSON Schema the command validates, and
a schema that uses anything else refused rather than half-checked."""

from typing import Any

import pytest

from scripts.real_drawings.schema import SchemaError, problems

SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "An invented export",
    "type": "object",
    "required": ["files"],
    "additionalProperties": False,
    "properties": {
        "run_id": {"type": "string", "pattern": "^[a-z]+$"},
        "files": {"type": "array", "minItems": 1, "items": {"$ref": "#/$defs/file"}},
    },
    "$defs": {
        "file": {
            "type": "object",
            "required": ["sha256", "format"],
            "properties": {
                "sha256": {"type": "string", "minLength": 64, "maxLength": 64},
                "format": {"enum": ["dwg", "pdf"]},
                "decoders_agree": {"type": ["boolean", "null"]},
                "peak_rss": {"type": "integer", "minimum": 0},
                "render_f1": {"anyOf": [{"type": "null"}, {"type": "number", "maximum": 1}]},
                "entity_counts": {"type": "object", "additionalProperties": {"type": "integer"}},
            },
        }
    },
}
GOOD = {"run_id": "abc", "files": [{"sha256": "a" * 64, "format": "dwg", "entity_counts": {"LINE": 3}}]}


def test_a_conforming_export_has_no_problems() -> None:
    assert problems(GOOD, SCHEMA) == []


@pytest.mark.parametrize(
    ("change", "where"),
    [
        ({"extra": 1}, "$"),
        ({"run_id": "ABC"}, "$.run_id"),
        ({"files": []}, "$.files"),
        ({"files": [{"sha256": "a" * 64}]}, "$.files[0]"),
        ({"files": [{"sha256": "a", "format": "dwg"}]}, "$.files[0].sha256"),
        ({"files": [{"sha256": "a" * 64, "format": "dxf"}]}, "$.files[0].format"),
        ({"files": [{"sha256": "a" * 64, "format": "dwg", "peak_rss": -1}]}, "$.files[0].peak_rss"),
        ({"files": [{"sha256": "a" * 64, "format": "dwg", "peak_rss": 1.5}]}, "$.files[0].peak_rss"),
        ({"files": [{"sha256": "a" * 64, "format": "dwg", "peak_rss": True}]}, "$.files[0].peak_rss"),
        (
            {"files": [{"sha256": "a" * 64, "format": "dwg", "decoders_agree": 1}]},
            "$.files[0].decoders_agree",
        ),
        ({"files": [{"sha256": "a" * 64, "format": "dwg", "render_f1": 2}]}, "$.files[0].render_f1"),
        (
            {"files": [{"sha256": "a" * 64, "format": "dwg", "entity_counts": {"LINE": "3"}}]},
            "$.files[0].entity_counts.LINE",
        ),
    ],
)
def test_each_breach_is_named_by_where_it_is(change: dict[str, Any], where: str) -> None:
    found = problems(GOOD | change, SCHEMA)

    assert found
    assert found[0].startswith(f"{where}: ")


def test_a_schema_using_a_keyword_the_check_does_not_validate_is_refused() -> None:
    schema = SCHEMA | {"if": {"required": ["run_id"]}, "then": {"required": ["files"]}}

    with pytest.raises(SchemaError, match="if"):
        problems(GOOD, schema)


def test_a_reference_outside_the_schema_is_refused() -> None:
    schema = SCHEMA | {"properties": {"files": {"$ref": "https://example.com/other.json"}}}

    with pytest.raises(SchemaError, match=r"other\.json"):
        problems(GOOD, schema)
