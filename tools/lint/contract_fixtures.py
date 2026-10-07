"""The contract lint (S17-F5; session 12's debt, session 16's 16 integration defects). An API reply
kept as a fixture (a web mock, an acceptance reply) is checked against the OpenAPI schema the API
exports, so a field or state word the API never sends fails here, not in an integration.

A fixture file holds one reply `{"method", "path", "status", "body"}` or a list of them. `path` is a real
address (a query string allowed), matched against the schema's `{param}` templates; `body` is checked
against that operation's `application/json` reply for `status`. Objects are closed unless the schema says
otherwise (Django Ninja exports no `additionalProperties`); an Optional field is `anyOf: [X, null]`
and is still required. A problem line names the file, the JSON path from the file's root and the word.

    python -m tools.lint.contract_fixtures --schema <openapi.json> [FILE ...]

With no FILE, the git-tracked `*.contract.json` files. Exit 1 when any problem, else 0.
"""

import argparse
import json
import re
import subprocess
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

SUFFIX = ".contract.json"
JSON_TYPE = "application/json"
REPLY_KEYS = ("method", "path", "status", "body")
TYPES = {
    "string": lambda v: isinstance(v, str),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, int | float) and not isinstance(v, bool),
    "boolean": lambda v: isinstance(v, bool),
    "null": lambda v: v is None,
    "array": lambda v: isinstance(v, list),
    "object": lambda v: isinstance(v, dict),
}


def show(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)[:80]


class Schema:
    def __init__(self, document: dict[str, Any]) -> None:
        self.document = document

    def resolve(self, schema: Any, seen: tuple[str, ...] = ()) -> Any:
        while isinstance(schema, dict) and "$ref" in schema:
            ref = schema["$ref"]
            if ref in seen or not isinstance(ref, str) or not ref.startswith("#/"):
                return {}
            seen += (ref,)
            node: Any = self.document
            for part in ref[2:].split("/"):
                node = node.get(part, {}) if isinstance(node, dict) else {}
            schema = node
        return schema

    def check(self, schema: Any, value: Any, where: str) -> list[str]:
        """The problems of `value` against `schema`, each `<where>: <what>`."""
        schema = self.resolve(schema)
        if not isinstance(schema, dict) or not schema:
            return []
        found: list[str] = []
        for key in ("anyOf", "oneOf"):
            if key in schema:
                found += self.check_options(schema[key], value, where)
        for part in schema.get("allOf", []):
            found += self.check(part, value, where)
        if "const" in schema and value != schema["const"]:
            found.append(f"{where}: word {show(value)} is not {show(schema['const'])}")
        if "enum" in schema and value not in schema["enum"]:
            found.append(f"{where}: word {show(value)} is not one the API sends {show(schema['enum'])}")
        elif "enum" not in schema:
            found += self.check_type(schema, value, where)
        return found

    def check_options(self, options: list[Any], value: Any, where: str) -> list[str]:
        attempts = [self.check(option, value, where) for option in options]
        if any(not attempt for attempt in attempts):
            return []
        # Name the inner problem of the closest option, not "matches no option".
        return min(attempts, key=len)

    def check_type(self, schema: dict[str, Any], value: Any, where: str) -> list[str]:
        kind = schema.get("type")
        if kind is None:
            kind = "object" if "properties" in schema else "array" if "items" in schema else None
        kinds = [kind] if isinstance(kind, str) else list(kind or [])
        if schema.get("nullable") and value is None:
            return []
        if kinds and not any(TYPES.get(k, lambda v: True)(value) for k in kinds):
            return [f"{where}: value {show(value)} is not {' or '.join(kinds)}"]
        if isinstance(value, dict):
            return self.check_object(schema, value, where)
        if isinstance(value, list) and "items" in schema:
            return [
                problem
                for index, item in enumerate(value)
                for problem in self.check(schema["items"], item, f"{where}[{index}]")
            ]
        return []

    def check_object(self, schema: dict[str, Any], value: dict[str, Any], where: str) -> list[str]:
        properties = schema.get("properties", {})
        extra = schema.get("additionalProperties", "properties" not in schema)
        found = [
            f'{where}: required field "{name}" is missing'
            for name in schema.get("required", [])
            if name not in value
        ]
        for name, item in value.items():
            if name in properties:
                found += self.check(properties[name], item, f"{where}.{name}")
            elif extra is True:
                continue
            elif extra is False:
                found.append(f'{where}: field "{name}" is not one the API sends')
            else:
                found += self.check(extra, item, f"{where}.{name}")
        return found

    def operation(self, method: str, path: str) -> dict[str, Any] | None:
        """The operation answering this real address: the template with the most literal segments.
        Routes are exact: a leading `/` is required; only the query and fragment are dropped."""
        address = path.split("?", 1)[0].split("#", 1)[0].split("/")
        if not path.startswith("/"):
            return None
        best: tuple[int, dict[str, Any]] | None = None
        for template, item in self.document.get("paths", {}).items():
            parts = template.split("/")
            found = item.get(method.lower()) if isinstance(item, dict) else None
            if len(parts) != len(address) or not isinstance(found, dict):
                continue
            literals = 0
            for part, actual in zip(parts, address, strict=True):
                if re.fullmatch(r"\{[^}]+\}", part):
                    if not actual:
                        break
                elif part == actual:
                    literals += 1
                else:
                    break
            else:
                if best is None or literals > best[0]:
                    best = (literals, found)
        return None if best is None else best[1]


def reply_problems(schema: Schema, reply: Any, where: str) -> list[str]:
    if not isinstance(reply, dict):
        return [f"{where}: a reply is an object with {', '.join(REPLY_KEYS)}"]
    found = [f'{where}: reply lacks "{key}"' for key in REPLY_KEYS if key not in reply]
    if found:
        return found
    method, path, status = str(reply["method"]), str(reply["path"]), str(reply["status"])
    operation = schema.operation(method, path)
    if operation is None:
        return [f'{where}: the API has no operation answering {method.upper()} "{path}"']
    responses = operation.get("responses", {})
    response = responses.get(status, responses.get("default"))
    if response is None:
        return [f'{where}: {method.upper()} "{path}" has no reply for status {status}']
    content = schema.resolve(response).get("content", {})
    if JSON_TYPE not in content:
        return (
            [] if reply["body"] in (None, "") else [f"{where}.body: status {status} sends no JSON body"]
        )
    return schema.check(content[JSON_TYPE].get("schema", {}), reply["body"], f"{where}.body")


def problems(schema: Path, files: Iterable[Path | str]) -> list[str]:
    """One line per problem in these fixture files, each `<file>: <JSON path>: <what> <word>`."""
    document = Schema(json.loads(Path(schema).read_text()))
    found: list[str] = []
    for file in map(Path, files):
        try:
            content = json.loads(file.read_text())
        except (OSError, ValueError) as error:
            found.append(f"{file}: $: not readable JSON ({error})")
            continue
        replies = (
            [(f"$[{index}]", item) for index, item in enumerate(content)]
            if isinstance(content, list)
            else [("$", content)]
        )
        for where, reply in replies:
            found += [f"{file}: {line}" for line in reply_problems(document, reply, where)]
    return found


def tracked_fixtures() -> list[str]:
    done = subprocess.run(["git", "ls-files", f"*{SUFFIX}"], capture_output=True, text=True, check=False)
    return done.stdout.split()


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0] if __doc__ else None)
    parser.add_argument("--schema", required=True, type=Path, help="the exported openapi.json")
    parser.add_argument("files", nargs="*", help=f"fixture files (default: tracked *{SUFFIX})")
    args = parser.parse_args(argv)
    found = problems(args.schema, args.files or tracked_fixtures())
    for line in found:
        print(line)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
