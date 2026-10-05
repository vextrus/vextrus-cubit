"""Shared pieces of f5's acceptance tests (not a test file): the repository root, the contract
`docs/specs/factory/contracts/walk-verdict.schema.json` and a small JSON Schema checker for it.

The repository has no JSON Schema library and f5 adds no dependency, so this checks the keywords the
contract uses (type, enum, const, pattern, lengths, minimum, required, properties,
additionalProperties, propertyNames, items, minItems, uniqueItems, $ref, oneOf, if/then/else) and
fails on any keyword it does not know, so a later contract change cannot pass unchecked.

Every value here is synthetic: no drawing text, no real Sheet title, no count from a real set.
"""

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[4]
CONTRACTS = ROOT / "docs" / "specs" / "factory" / "contracts"
VERDICT_SCHEMA = CONTRACTS / "walk-verdict.schema.json"

# The twelve walked finish-line items (the contract: M0-FL1 to M0-FL11 and M0-FL13; FL12 is dropped).
WALKED_ITEMS = tuple(f"M0-FL{n}" for n in (*range(1, 12), 13))

# Planted strings: invented, never drawing text. A sanitizer must never echo one.
PLANTED_TITLE = "SYNTHETIC-TITLE-ZZ"
PLANTED_FILE = "synthetic-planted-file-qq.dwg"
PLANTED_QUESTION = "Is the synthetic planted beam QQ9 continuous?"
PLANTED_DISCIPLINE = "Plan 3 (north)"
PLANTED_NOTE = "synthetic planted note XYZZY"
PLANTED_PATH = ".private/reference/synthetic-planted-evidence-qq.png"
PLANTED = (
    PLANTED_TITLE,
    PLANTED_FILE,
    PLANTED_QUESTION,
    PLANTED_DISCIPLINE,
    PLANTED_NOTE,
    PLANTED_PATH,
)

_KNOWN = {
    "$schema",
    "$id",
    "$defs",
    "title",
    "description",
    "type",
    "enum",
    "const",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "required",
    "properties",
    "additionalProperties",
    "propertyNames",
    "items",
    "minItems",
    "uniqueItems",
    "$ref",
    "oneOf",
    "if",
    "then",
    "else",
}


def verdict_schema() -> dict[str, Any]:
    schema: dict[str, Any] = json.loads(VERDICT_SCHEMA.read_text())
    return schema


def _type_ok(value: Any, name: str) -> bool:
    match name:
        case "object":
            return isinstance(value, dict)
        case "array":
            return isinstance(value, list)
        case "string":
            return isinstance(value, str)
        case "integer":
            return isinstance(value, int) and not isinstance(value, bool)
        case "number":
            return isinstance(value, int | float) and not isinstance(value, bool)
        case "boolean":
            return isinstance(value, bool)
        case "null":
            return value is None
    raise AssertionError(f"unknown JSON type {name}")


def _same(a: Any, b: Any) -> bool:
    return bool(type(a) is type(b) or (_type_ok(a, "number") and _type_ok(b, "number"))) and a == b


def errors(value: Any, schema: dict[str, Any] | bool, root: dict[str, Any], at: str = "$") -> list[str]:
    """Every way `value` breaks `schema` (empty when it conforms)."""
    if schema is True:
        return []
    if schema is False:
        return [f"{at}: not allowed"]
    assert isinstance(schema, dict)
    unknown = set(schema) - _KNOWN
    assert not unknown, f"the checker does not know {sorted(unknown)}"
    found: list[str] = []
    if "$ref" in schema:
        ref = schema["$ref"]
        assert ref.startswith("#/$defs/"), ref
        found += errors(value, root["$defs"][ref.removeprefix("#/$defs/")], root, at)
    if "type" in schema:
        names = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_type_ok(value, name) for name in names):
            return [*found, f"{at}: not of type {names}"]
    if "const" in schema and not _same(value, schema["const"]):
        found.append(f"{at}: not {schema['const']!r}")
    if "enum" in schema and not any(_same(value, option) for option in schema["enum"]):
        found.append(f"{at}: not one of {schema['enum']}")
    if isinstance(value, str):
        if "pattern" in schema and not re.search(schema["pattern"], value):
            found.append(f"{at}: does not match {schema['pattern']}")
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", len(value)):
            found.append(f"{at}: wrong length")
    if _type_ok(value, "number") and "minimum" in schema and value < schema["minimum"]:
        found.append(f"{at}: below {schema['minimum']}")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                found.append(f"{at}: missing {key}")
        properties = schema.get("properties", {})
        for key, item in value.items():
            if "propertyNames" in schema:
                found += errors(key, schema["propertyNames"], root, f"{at}.<{key}>")
            if key in properties:
                found += errors(item, properties[key], root, f"{at}.{key}")
            elif "additionalProperties" in schema:
                found += errors(item, schema["additionalProperties"], root, f"{at}.{key}")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            found.append(f"{at}: fewer than {schema['minItems']} items")
        if schema.get("uniqueItems") and len({json.dumps(v, sort_keys=True) for v in value}) != len(
            value
        ):
            found.append(f"{at}: items not unique")
        if "items" in schema:
            for index, item in enumerate(value):
                found += errors(item, schema["items"], root, f"{at}[{index}]")
    if "oneOf" in schema:
        passing = sum(1 for option in schema["oneOf"] if not errors(value, option, root, at))
        if passing != 1:
            found.append(f"{at}: matches {passing} of oneOf, not exactly 1")
    if "if" in schema:
        if not errors(value, schema["if"], root, at):
            found += errors(value, schema.get("then", True), root, at)
        else:
            found += errors(value, schema.get("else", True), root, at)
    return found


def assert_valid_verdict(verdict: Any) -> None:
    """The verdict conforms to the contract, and its counts hold the contract's invariant."""
    schema = verdict_schema()
    problems = errors(verdict, schema, schema)
    assert not problems, problems
    layer = verdict["agent_layer"]
    findings = layer["findings"]
    assert len(findings) == layer["issues_drafted"] + layer["dedup_comments"]
    assert layer["blocks"] == sum(1 for f in findings if f["severity"] == "BLOCKS")
    assert layer["misleading"] == sum(1 for f in findings if f["misleading"] is True)


def has_planted(value: Any) -> list[str]:
    """The planted strings found anywhere in a JSON-able value or text."""
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return [planted for planted in PLANTED if planted in text or planted.lower() in text.lower()]
