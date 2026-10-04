"""A small JSON Schema reader for f0's contracts (no dependency): the keywords those files use, enough to
say whether a record the builder writes is shaped as the contract says."""

import json
import re
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
CONTRACTS = REPO / "docs/specs/factory/contracts"


def contract(name: str) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads((CONTRACTS / name).read_text())
    return loaded


def _type_ok(value: object, kind: str) -> bool:
    match kind:
        case "object":
            return isinstance(value, dict)
        case "array":
            return isinstance(value, list)
        case "string":
            return isinstance(value, str)
        case "integer":
            return isinstance(value, int) and not isinstance(value, bool)
        case "boolean":
            return isinstance(value, bool)
        case "null":
            return value is None
    raise AssertionError(f"the schema reader does not know type {kind}")


def errors(value: object, schema: dict[str, Any], at: str = "$") -> list[str]:
    """Why `value` does not meet `schema`; empty when it does."""
    found: list[str] = []
    if "type" in schema and not _type_ok(value, schema["type"]):
        return [f"{at}: not {schema['type']}"]
    if "const" in schema and value != schema["const"]:
        found.append(f"{at}: not {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        found.append(f"{at}: not one of {schema['enum']}")
    if isinstance(value, str):
        if "pattern" in schema and not re.search(schema["pattern"], value):
            found.append(f"{at}: does not match {schema['pattern']}")
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", len(value)):
            found.append(f"{at}: wrong length")
    if isinstance(value, int) and not isinstance(value, bool):
        low, high = schema.get("minimum", value), schema.get("maximum", value)
        if not low <= value <= high:
            found.append(f"{at}: out of range")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                found.append(f"{at}: missing {key}")
        properties = schema.get("properties", {})
        for key, item in value.items():
            if key in properties:
                found += errors(item, properties[key], f"{at}.{key}")
            elif schema.get("additionalProperties") is False:
                found.append(f"{at}: extra key {key}")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0) or len(value) > schema.get("maxItems", len(value)):
            found.append(f"{at}: wrong number of items")
        if "items" in schema:
            for i, item in enumerate(value):
                found += errors(item, schema["items"], f"{at}[{i}]")
    if "oneOf" in schema:
        passing = [option for option in schema["oneOf"] if not errors(value, option, at)]
        if len(passing) != 1:
            found.append(f"{at}: meets {len(passing)} of oneOf, not 1")
    for part in schema.get("allOf", []):
        found += errors(value, part, at)
    if "if" in schema and not errors(value, schema["if"], at) and "then" in schema:
        found += errors(value, schema["then"], at)
    return found
