"""The CI shard check's pieces (ticket f1): ownership, the glob rule on older Pythons, the node-test
argument forms and fail-closed reading. The whole-file behaviour is pinned by the acceptance tests
under `tests/acceptance/tf1/`."""

import json
from pathlib import Path

from tools.lint.ci_shards import Malformed, Shard, full_match, load, node_patterns, problems


def test_a_shard_owns_paths_under_it_and_not_under_its_ignores() -> None:
    shard = Shard("x", ("vextrus/takeoff",), ("vextrus/takeoff/tests/acceptance",))
    assert shard.owns("vextrus/takeoff/tests/test_a.py")
    assert not shard.owns("vextrus/takeoff/tests/acceptance/t1/test_a.py")
    assert not shard.owns("vextrus/takeoffs/tests/test_a.py")
    assert Shard("rest", (), ("vextrus/takeoff",)).owns("engine/tests/test_e.py")


def test_full_match_follows_the_double_star_rule() -> None:
    assert full_match(".claude/hooks/guard.test.mjs", ".claude/hooks/**/*.test.mjs")
    assert full_match("scripts/factory/a/b.test.mjs", "scripts/factory/**/*.test.mjs")
    assert not full_match("scripts/other/b.test.mjs", "scripts/factory/**/*.test.mjs")


def test_node_arguments_must_be_quoted_globs() -> None:
    patterns, found = node_patterns("run: node --test '.claude/**/*.test.mjs' a/b.test.mjs\n")
    assert patterns == [".claude/**/*.test.mjs", "a/b.test.mjs"]
    assert found == []
    assert node_patterns("run: node --test .claude/**/*.test.mjs\n")[1]
    assert node_patterns("run: node --test .claude/hooks\n")[1]
    assert node_patterns("run: echo\n")[1], "no node --test step"


def test_a_malformed_shard_file_fails_closed(tmp_path: Path) -> None:
    (tmp_path / ".github").mkdir()
    shards = tmp_path / ".github" / "ci-shards.json"
    for text in ("{", "[]", json.dumps({"shards": [{"paths": []}]})):
        shards.write_text(text)
        try:
            load(tmp_path)
        except Malformed:
            continue
        raise AssertionError(text)
    twice = [{"name": "a", "paths": []}, {"name": "a", "paths": []}]
    shards.write_text(json.dumps({"shards": twice}))
    assert any("two shards" in line for line in problems(tmp_path))
    assert any("ci.yml" in line for line in problems(tmp_path)), "a missing ci.yml is a problem"
