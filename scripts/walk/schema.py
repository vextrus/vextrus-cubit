"""A small JSON Schema checker for the walk contracts (standard library only; f5 adds no dependency).

It knows exactly the keywords `docs/specs/factory/contracts/walk-verdict.schema.json` and
`web/e2e/real/*.schema.json` use and refuses a schema with any other, so a later contract change cannot
pass unchecked:

    problems = errors(value, schema)   # [] when `value` conforms
"""

import json
import re
from functools import cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
VERDICT_SCHEMA = ROOT / "docs" / "specs" / "factory" / "contracts" / "walk-verdict.schema.json"
WALK_SCHEMA = ROOT / "web" / "e2e" / "real" / "walk.schema.json"

KNOWN = frozenset(
    {
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
        "maximum",
        "required",
        "properties",
        "additionalProperties",
        "patternProperties",
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
)


class SchemaUnknown(ValueError):
    """The schema uses a keyword this checker does not know."""


@cache
def verdict_schema() -> dict[str, Any]:
    schema: dict[str, Any] = json.loads(VERDICT_SCHEMA.read_text(encoding="utf-8"))
    return schema


@cache
def walk_schema() -> dict[str, Any]:
    schema: dict[str, Any] = json.loads(WALK_SCHEMA.read_text(encoding="utf-8"))
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
    raise SchemaUnknown(f"unknown JSON type {name}")


def _same(a: Any, b: Any) -> bool:
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if _type_ok(a, "number") and _type_ok(b, "number"):
        return bool(a == b)
    return type(a) is type(b) and a == b


def errors(
    value: Any, schema: dict[str, Any] | bool, root: dict[str, Any] | None = None, at: str = "$"
) -> list[str]:
    """Every way `value` breaks `schema` (empty when it conforms). Paths only, never values."""
    root = schema if root is None and isinstance(schema, dict) else root
    if schema is True:
        return []
    if schema is False:
        return [f"{at}: not allowed"]
    if not isinstance(schema, dict) or root is None:
        raise SchemaUnknown("a schema is not an object")
    if unknown := set(schema) - KNOWN:
        raise SchemaUnknown(f"unknown keywords {sorted(unknown)}")
    found: list[str] = []
    if "$ref" in schema:
        ref = schema["$ref"]
        if not isinstance(ref, str) or not ref.startswith("#/$defs/"):
            raise SchemaUnknown("only local $defs references are known")
        found += errors(value, root["$defs"][ref.removeprefix("#/$defs/")], root, at)
    if "type" in schema:
        names = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_type_ok(value, name) for name in names):
            return [*found, f"{at}: wrong type"]
    if "const" in schema and not _same(value, schema["const"]):
        found.append(f"{at}: not the constant")
    if "enum" in schema and not any(_same(value, option) for option in schema["enum"]):
        found.append(f"{at}: not in the enum")
    if isinstance(value, str):
        if "pattern" in schema and not re.search(schema["pattern"], value):
            found.append(f"{at}: does not match its pattern")
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", len(value)):
            found.append(f"{at}: wrong length")
    if _type_ok(value, "number"):
        if "minimum" in schema and value < schema["minimum"]:
            found.append(f"{at}: below its minimum")
        if "maximum" in schema and value > schema["maximum"]:
            found.append(f"{at}: above its maximum")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                found.append(f"{at}: missing {key}")
        properties = schema.get("properties", {})
        patterns = schema.get("patternProperties", {})
        for key, item in value.items():
            where = f"{at}.<key>"
            if "propertyNames" in schema:
                found += errors(key, schema["propertyNames"], root, where)
            matched = False
            if key in properties:
                matched = True
                found += errors(item, properties[key], root, where)
            for pattern, sub in patterns.items():
                if re.search(pattern, key):
                    matched = True
                    found += errors(item, sub, root, where)
            if not matched and "additionalProperties" in schema:
                found += errors(item, schema["additionalProperties"], root, where)
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            found.append(f"{at}: too few items")
        if schema.get("uniqueItems"):
            seen = {json.dumps(v, sort_keys=True) for v in value}
            if len(seen) != len(value):
                found.append(f"{at}: items not unique")
        if "items" in schema:
            for index, item in enumerate(value):
                found += errors(item, schema["items"], root, f"{at}[{index}]")
    if "oneOf" in schema:
        passing = sum(1 for option in schema["oneOf"] if not errors(value, option, root, at))
        if passing != 1:
            found.append(f"{at}: matches {passing} of oneOf")
    if "if" in schema:
        if not errors(value, schema["if"], root, at):
            found += errors(value, schema.get("then", True), root, at)
        else:
            found += errors(value, schema.get("else", True), root, at)
    return found


def verdict_errors(value: Any) -> list[str]:
    """Every way `value` breaks walk-verdict.schema.json."""
    return errors(value, verdict_schema())


def walk_errors(value: Any) -> list[str]:
    """Every way `value` breaks web/e2e/real/walk.schema.json."""
    return errors(value, walk_schema())
