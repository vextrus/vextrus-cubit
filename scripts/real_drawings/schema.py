"""The export's schema check (the M0 plan, the real-drawing check, step 4), in the standard library only.

The command runs outside the sandbox on the owner's Python, with nothing installed, so it validates a
declared subset of JSON Schema (2020-12): `type`, `enum`, `const`, `properties`, `required`,
`additionalProperties`, `items`, `minItems`, `maxItems`, `minLength`, `maxLength`, `pattern`,
`minimum`, `maximum`, `anyOf`, `oneOf` and local `$ref`s into `$defs`; `title`, `description`,
`$comment`, `$schema`, `$id`, `default`, `examples` and `format` are read as notes. A schema that uses
any other keyword is refused, so nothing in `engine/export.schema.json` goes unchecked unnoticed.
"""

import re
from collections.abc import Mapping
from typing import Any

CHECKED = {
    "type",
    "enum",
    "const",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "pattern",
    "minimum",
    "maximum",
    "anyOf",
    "oneOf",
    "$ref",
    "$defs",
}
NOTES = {"title", "description", "$comment", "$schema", "$id", "default", "examples", "format"}
TYPES = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "boolean": lambda v: isinstance(v, bool),
    "null": lambda v: v is None,
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, int | float) and not isinstance(v, bool),
}


class SchemaError(Exception):
    """The schema uses what this check cannot validate."""


def problems(value: Any, schema: Mapping[str, Any]) -> list[str]:
    """Every breach, as `<where>: <what>`; an empty list when the value conforms."""
    found: list[str] = []
    _check(value, schema, schema, "$", found)
    return found


def _check(value: Any, schema: Any, root: Mapping[str, Any], where: str, found: list[str]) -> None:
    if schema is True:
        return
    if schema is False:
        found.append(f"{where}: not allowed")
        return
    unknown = set(schema) - CHECKED - NOTES
    if unknown:
        raise SchemaError(f"the schema uses {sorted(unknown)}, which this check does not validate")
    if "$ref" in schema:
        _check(value, _resolve(schema["$ref"], root), root, where, found)
    if "type" in schema:
        allowed = [schema["type"]] if isinstance(schema["type"], str) else schema["type"]
        if not any(TYPES[t](value) for t in allowed):
            found.append(f"{where}: {type(value).__name__} is not {' or '.join(allowed)}")
            return
    if "enum" in schema and value not in schema["enum"]:
        found.append(f"{where}: not one of the allowed values")
    if "const" in schema and value != schema["const"]:
        found.append(f"{where}: not the required value")
    for key in ("anyOf", "oneOf"):
        if key in schema:
            passing = sum(not _alone(value, s, root, where) for s in schema[key])
            if passing == 0 or (key == "oneOf" and passing > 1):
                found.append(f"{where}: matches {passing} of {key}'s choices")
    if isinstance(value, dict):
        _object(value, schema, root, where, found)
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0) or len(value) > schema.get("maxItems", len(value)):
            found.append(f"{where}: {len(value)} items is outside the allowed count")
        if "items" in schema:
            for i, item in enumerate(value):
                _check(item, schema["items"], root, f"{where}[{i}]", found)
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", len(value)):
            found.append(f"{where}: a string of {len(value)} characters is outside the allowed length")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            found.append(f"{where}: does not match the pattern")
    if TYPES["number"](value):
        if "minimum" in schema and value < schema["minimum"]:
            found.append(f"{where}: below the minimum")
        if "maximum" in schema and value > schema["maximum"]:
            found.append(f"{where}: above the maximum")


def _object(
    value: dict[str, Any],
    schema: Mapping[str, Any],
    root: Mapping[str, Any],
    where: str,
    found: list[str],
) -> None:
    for name in schema.get("required", []):
        if name not in value:
            found.append(f"{where}: {name} is missing")
    properties = schema.get("properties", {})
    for name, item in value.items():
        if name in properties:
            _check(item, properties[name], root, f"{where}.{name}", found)
        elif "additionalProperties" in schema:
            if schema["additionalProperties"] is False:
                found.append(f"{where}: {name} is not allowed")
            else:
                _check(item, schema["additionalProperties"], root, f"{where}.{name}", found)


def _alone(value: Any, schema: Any, root: Mapping[str, Any], where: str) -> list[str]:
    found: list[str] = []
    _check(value, schema, root, where, found)
    return found


def _resolve(ref: str, root: Mapping[str, Any]) -> Any:
    if not ref.startswith("#/"):
        raise SchemaError(f"the schema refers outside itself: {ref}")
    target: Any = root
    for part in ref[2:].split("/"):
        target = target[part.replace("~1", "/").replace("~0", "~")]
    return target
