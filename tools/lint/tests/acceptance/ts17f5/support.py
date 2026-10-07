"""A synthetic OpenAPI 3.1 schema in the shape Django Ninja exports (`manage.py export_openapi_schema`):
objects with no `additionalProperties` (closed: the API sends no other field), an Optional field as
`anyOf: [<schema>, {"type": "null"}]` and still required, an enum as a component (`$ref`) or inline, a
dict as `additionalProperties: <schema>` or `true`. Everything here is invented.

The fixture form the lint reads (the seam this ticket fixes): a JSON file holding one API reply, or a
list of them, each `{"method": ..., "path": ..., "status": ..., "body": ...}`. `path` is a concrete
address (a query string allowed) matched against the schema's path templates; `body` is checked
against that operation's `application/json` reply for `status`. A problem names the file, the JSON
path from the file's root (`$.body.proposals[0].state`, `$[1].body...`) and the word.
"""

import importlib
import json
import re
from pathlib import Path
from types import ModuleType
from typing import Any

MODULE = "tools.lint.contract_fixtures"
PROJECT = "0b7f3c52-5d0e-4a8e-9a43-1f2e3d4c5b6a"
PROPOSAL = "6d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6"


def lint() -> ModuleType:
    """The lint under test, imported when a test runs so each test fails alone until it exists."""
    return importlib.import_module(MODULE)


def ref(name: str) -> dict[str, str]:
    return {"$ref": f"#/components/schemas/{name}"}


def nullable(schema: dict[str, Any]) -> dict[str, Any]:
    return {"anyOf": [schema, {"type": "null"}]}


def reply(schema: dict[str, Any], description: str = "OK") -> dict[str, Any]:
    return {"description": description, "content": {"application/json": {"schema": schema}}}


SCHEMA: dict[str, Any] = {
    "openapi": "3.1.0",
    "info": {"title": "Vextrus", "version": "1.0.0"},
    "paths": {
        "/api/projects/{project_id}/proposals": {
            "get": {
                "operationId": "proposals_list",
                "parameters": [
                    {"in": "path", "name": "project_id", "required": True, "schema": {"type": "string"}}
                ],
                "responses": {
                    "200": reply(ref("ProposalListOut")),
                    "404": reply(ref("Refusal"), "Not Found"),
                },
            }
        }
    },
    "components": {
        "schemas": {
            "ProposalState": {
                "enum": ["proposed", "held", "confirmed", "excluded", "superseded"],
                "type": "string",
            },
            "StoreyOut": {
                "properties": {
                    "name": {"title": "Name", "type": "string"},
                    "kind": {"enum": ["floor", "roof", "basement"], "title": "Kind", "type": "string"},
                },
                "required": ["name", "kind"],
                "title": "StoreyOut",
                "type": "object",
            },
            "ProposalOut": {
                "properties": {
                    "id": {"format": "uuid", "title": "Id", "type": "string"},
                    "mark": {"title": "Mark", "type": "string"},
                    "state": ref("ProposalState"),
                    "held_reason": {**nullable({"type": "string"}), "title": "Held Reason"},
                    "storey": nullable(ref("StoreyOut")),
                    "jev_pick": {
                        **nullable({"additionalProperties": True, "type": "object"}),
                        "title": "Jev Pick",
                    },
                },
                "required": ["id", "mark", "state", "held_reason"],
                "title": "ProposalOut",
                "type": "object",
            },
            "ProposalListOut": {
                "properties": {
                    "proposals": {"items": ref("ProposalOut"), "title": "Proposals", "type": "array"},
                    "counts": {
                        "additionalProperties": {"type": "integer"},
                        "title": "Counts",
                        "type": "object",
                    },
                },
                "required": ["proposals", "counts"],
                "title": "ProposalListOut",
                "type": "object",
            },
            "MessageCode": {
                "type": "string",
                "description": "A code the machine sends with named parameters; the web words it.",
                "enum": ["takeoff.proposals.not_found", "takeoff.proposals.superseded"],
            },
            "Refusal": {
                "properties": {
                    "code": ref("MessageCode"),
                    "params": {
                        "additionalProperties": {"anyOf": [{"type": "string"}, {"type": "integer"}]},
                        "title": "Params",
                        "type": "object",
                    },
                },
                "required": ["code", "params"],
                "title": "Refusal",
                "type": "object",
            },
        }
    },
}


def proposal(**changes: Any) -> dict[str, Any]:
    """A proposal as the API sends it, with `changes` laid over it (a value of `...` drops the key)."""
    found: dict[str, Any] = {
        "id": PROPOSAL,
        "mark": "C1",
        "state": "proposed",
        "held_reason": None,
        "storey": {"name": "Ground", "kind": "floor"},
        "jev_pick": None,
    }
    for key, value in changes.items():
        if value is ...:
            found.pop(key, None)
        else:
            found[key] = value
    return found


LIST = f"/api/projects/{PROJECT}/proposals"


def listing(*proposals: dict[str, Any], path: str = LIST) -> dict[str, Any]:
    """A 200 reply of the proposals list."""
    body = {"proposals": list(proposals), "counts": {"proposed": len(proposals)}}
    return {"method": "GET", "path": path, "status": 200, "body": body}


def write_schema(folder: Path) -> Path:
    path = folder / "openapi.json"
    path.write_text(json.dumps(SCHEMA, indent=1))
    return path


def write(folder: Path, name: str, content: Any) -> Path:
    path = folder / name
    path.write_text(json.dumps(content, indent=1))
    return path


def line_naming(text: str, file: str, where: str, word: str) -> str | None:
    """The first line of `text` naming the file, the JSON path `where` and the word (the word standing
    alone: `proposal` is not found inside `proposals`)."""
    alone = re.compile(rf"(?<![\w.-]){re.escape(word)}(?![\w-])")
    for line in text.splitlines():
        if file in line and where in line and alone.search(line):
            return line
    return None
