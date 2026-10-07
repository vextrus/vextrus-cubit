"""Edge cases of the contract lint beyond the acceptance tests (S17-F5)."""

import json
from pathlib import Path

import pytest

from tools.lint import contract_fixtures as lint
from tools.lint.tests.acceptance.ts17f5.support import LIST, listing, proposal, write, write_schema


def test_a_status_the_operation_does_not_reply_with_fails(tmp_path: Path) -> None:
    schema = write_schema(tmp_path)
    reply = {**listing(proposal()), "status": 500}
    found = lint.problems(schema, [write(tmp_path, "status.json", reply)])
    assert len(found) == 1
    assert "500" in found[0]


def test_a_null_for_a_required_nullable_passes_and_for_a_plain_field_fails(tmp_path: Path) -> None:
    schema = write_schema(tmp_path)
    assert lint.problems(schema, [write(tmp_path, "ok.json", listing(proposal(held_reason=None)))]) == []
    bad = write(tmp_path, "bad.json", listing(proposal(mark=None)))
    assert any("$.body.proposals[0].mark" in line for line in lint.problems(schema, [bad]))


def test_a_reply_missing_its_keys_is_named(tmp_path: Path) -> None:
    schema = write_schema(tmp_path)
    bad = write(tmp_path, "keys.json", {"method": "GET", "path": LIST})
    assert len(lint.problems(schema, [bad])) == 2


def test_no_files_and_no_tracked_fixtures_passes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    schema = write_schema(tmp_path)
    monkeypatch.setattr(lint, "tracked_fixtures", list)
    assert lint.main(["--schema", str(schema)]) == 0
    json.loads(schema.read_text())
