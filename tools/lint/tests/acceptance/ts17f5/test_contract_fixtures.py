"""Ticket S17-F5, the contract lint (docs/handoff/session-17-prompt.md, "F5 the contract lint": "web
fixtures and acceptance JSON validated against the exported OpenAPI schema; a state word or field the
API does not send fails"). Session 16 found about 16 integration defects from fixtures with field
names and state words the API never sends ("proposed" vs "proposal"); session 12's debt is "fakes
validated against OpenAPI" (docs/knowledge/lessons.md).

Seam: `tools.lint.contract_fixtures.problems(schema, files) -> list[str]` (one line per problem, each
naming the file, the JSON path and the word; empty when every file conforms) and
`tools.lint.contract_fixtures.main(["--schema", <openapi.json>, <file>...]) -> int` (0 when every
file conforms, 1 when any does not, each problem printed on its own line). The fixture form and the
schema are in `support.py`.
"""

from pathlib import Path

import pytest

from .support import PROJECT, line_naming, lint, listing, proposal, write, write_schema

type Capture = pytest.CaptureFixture[str]


def run(capsys: Capture, schema: Path, *files: Path) -> tuple[int, str]:
    code = lint().main(["--schema", str(schema), *map(str, files)])
    out = capsys.readouterr()
    return code, out.out + out.err


def test_a_conforming_fixture_passes(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    good = write(
        tmp_path,
        "good.json",
        [
            listing(
                proposal(),
                proposal(state="held", held_reason="two marks on one column", storey=None),
                proposal(storey=..., jev_pick={"sheet": "S-03", "score": 3}),
            ),
            listing(proposal(state="confirmed"), path=f"/api/projects/{PROJECT}/proposals?group=mark"),
            {
                "method": "GET",
                "path": f"/api/projects/{PROJECT}/proposals",
                "status": 404,
                "body": {"code": "takeoff.proposals.not_found", "params": {"mark": "C1", "count": 2}},
            },
        ],
    )
    assert lint().problems(schema, [good]) == []
    code, text = run(capsys, schema, good)
    assert code == 0, text


def test_a_field_the_api_does_not_send_fails(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    bad = write(tmp_path, "unknown-field.json", listing(proposal(colour="red")))
    found = "\n".join(lint().problems(schema, [bad]))
    assert line_naming(found, bad.name, "$.body.proposals[0]", "colour"), found
    code, text = run(capsys, schema, bad)
    assert code == 1, text
    assert line_naming(text, bad.name, "$.body.proposals[0]", "colour"), text


def test_a_field_unknown_inside_a_nullable_object_fails(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    storey = {"name": "Ground", "kind": "floor", "height_mm": 3000}
    bad = write(tmp_path, "nested-field.json", listing(proposal(storey=storey)))
    code, text = run(capsys, schema, bad)
    assert code == 1, text
    assert line_naming(text, bad.name, "$.body.proposals[0].storey", "height_mm"), text


def test_a_state_word_the_api_does_not_send_fails(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    bad = write(tmp_path, "state-word.json", listing(proposal(state="proposal")))
    found = "\n".join(lint().problems(schema, [bad]))
    assert line_naming(found, bad.name, "$.body.proposals[0].state", "proposal"), found
    code, text = run(capsys, schema, bad)
    assert code == 1, text
    assert line_naming(text, bad.name, "$.body.proposals[0].state", "proposal"), text


def test_an_enum_word_inside_a_nullable_object_fails(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    storey = {"name": "Ground", "kind": "level"}
    bad = write(tmp_path, "nested-word.json", listing(proposal(storey=storey)))
    code, text = run(capsys, schema, bad)
    assert code == 1, text
    assert line_naming(text, bad.name, "$.body.proposals[0].storey.kind", "level"), text


def test_a_refusal_code_the_api_does_not_send_fails(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    refusal = {
        "method": "GET",
        "path": f"/api/projects/{PROJECT}/proposals",
        "status": 404,
        "body": {"code": "takeoff.proposal.missing", "params": {}},
    }
    bad = write(tmp_path, "refusal-code.json", refusal)
    code, text = run(capsys, schema, bad)
    assert code == 1, text
    assert line_naming(text, bad.name, "$.body.code", "takeoff.proposal.missing"), text


def test_a_missing_required_field_fails(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    bad = write(tmp_path, "missing.json", listing(proposal(held_reason=...)))
    found = "\n".join(lint().problems(schema, [bad]))
    assert line_naming(found, bad.name, "$.body.proposals[0]", "held_reason"), found
    code, text = run(capsys, schema, bad)
    assert code == 1, text
    assert line_naming(text, bad.name, "$.body.proposals[0]", "held_reason"), text


def test_an_address_the_api_does_not_answer_fails(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    address = f"/api/projects/{PROJECT}/proposal"
    bad = write(tmp_path, "address.json", listing(proposal(), path=address))
    code, text = run(capsys, schema, bad)
    assert code == 1, text
    assert line_naming(text, bad.name, "$", address), text


def test_a_reply_in_a_list_is_named_by_its_index(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    bad = write(tmp_path, "replies.json", [listing(proposal()), listing(proposal(colour="red"))])
    code, text = run(capsys, schema, bad)
    assert code == 1, text
    assert line_naming(text, bad.name, "$[1].body.proposals[0]", "colour"), text


def test_every_problem_is_named_not_only_the_first(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    first = write(
        tmp_path,
        "first.json",
        listing(proposal(colour="red"), proposal(mark="C2", state="proposal")),
    )
    good = write(tmp_path, "good.json", listing(proposal()))
    second = write(tmp_path, "second.json", listing(proposal(held_reason=...)))
    code, text = run(capsys, schema, first, good, second)
    assert code == 1, text
    assert line_naming(text, first.name, "$.body.proposals[0]", "colour"), text
    assert line_naming(text, first.name, "$.body.proposals[1].state", "proposal"), text
    assert line_naming(text, second.name, "$.body.proposals[0]", "held_reason"), text
    assert "good.json" not in text, text


def test_a_file_that_is_not_json_fails_and_is_named(tmp_path: Path, capsys: Capture) -> None:
    schema = write_schema(tmp_path)
    broken = tmp_path / "broken.json"
    broken.write_text('{"method": "GET", "path": ')
    code, text = run(capsys, schema, broken)
    assert code != 0, text
    assert "broken.json" in text, text
