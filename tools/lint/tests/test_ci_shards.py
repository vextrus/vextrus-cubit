"""The CI shard check's pieces (ticket f1): ownership, the glob rule on older Pythons, the node-test
argument forms and fail-closed reading. The whole-file behaviour is pinned by the acceptance tests
under `tests/acceptance/tf1/`."""

import json
from pathlib import Path

import pytest

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


SIGNAL_FORMS = [  # built in pieces: this file is itself scanned
    "os." + "kill" + "pg(1, 15)",
    "os." + "kill(os.getpid(), 1)",
    "signal." + "signal(signal.SIGTERM, handler)",
    "signal." + "raise_signal(15)",
    "signal." + "pthread_sigmask(0, [])",
    "signal." + "sigpending()",
    "proc.send_" + "signal(15)",
    "os.getpg" + "id(0)",
    "subprocess.Popen(c, start_" + "new_session=True)",
]


def make_serial_world(tmp_path: Path, form: str) -> Path:
    (tmp_path / "pyproject.toml").write_text('[tool.pytest.ini_options]\ntestpaths = ["pkg"]\n')
    (tmp_path / ".github").mkdir()
    (tmp_path / ".github" / "ci-shards.json").write_text(
        json.dumps({"shards": [{"name": "alpha", "paths": [], "ignore": []}]})
    )
    tests = tmp_path / "pkg" / "tests"
    (tests / "acceptance").mkdir(parents=True)
    (tests / "test_bare.py").write_text(form + "\n")
    (tests / "acceptance" / "test_pinned.py").write_text(form + "\n")
    return tests


@pytest.mark.parametrize("form", SIGNAL_FORMS)
def test_an_unmarked_test_in_any_signal_form_is_a_problem(tmp_path: Path, form: str) -> None:
    from tools.lint.ci_shards import serial_problems

    make_serial_world(tmp_path, form)
    found = serial_problems(tmp_path, "")
    assert len(found) == 1, found
    assert "pkg/tests/test_bare.py" in found[0]


MARKS = [
    "pytestmark = pytest.mark.serial",
    "pytestmark = [pytest.mark.slow, pytest.mark.serial]",
    "@pytest.mark.serial\ndef test_x(): ...",
]


def python_job(condition: str, run: str) -> str:
    """A ci.yml with a python job holding one step."""
    return (
        "jobs:\n  python:\n    steps:\n      - name: serial\n"
        f"        if: {condition}\n        run: {run}\n  other:\n    steps: []\n"
    )


SERIAL_LINE = 'uv run pytest -m "serial and not live" pkg/tests/test_marked.py'


@pytest.mark.parametrize("mark", MARKS)
def test_a_marked_file_must_be_an_argument_of_a_serial_run_of_ci(tmp_path: Path, mark: str) -> None:
    from tools.lint.ci_shards import serial_problems

    tests = make_serial_world(tmp_path, "pass")
    (tests / "test_marked.py").write_text(mark + "\n" + SIGNAL_FORMS[1] + "\n")
    assert serial_problems(tmp_path, python_job("matrix.shard == 'alpha'", SERIAL_LINE)) == []
    for unrun in (
        "jobs:\n",
        "# " + SERIAL_LINE,  # named only in a comment
        python_job(
            "matrix.shard == 'alpha'", 'uv run pytest -n 4 -m "not serial" pkg/tests/test_marked.py'
        ),
        # f1: a line that carries workers is never a serial run, whatever its -m says
        python_job("matrix.shard == 'alpha'", SERIAL_LINE + " -n 4"),
        python_job("matrix.shard == 'alpha'", SERIAL_LINE + " -n4"),
        python_job("matrix.shard == 'alpha'", SERIAL_LINE + " --numprocesses=4"),
        python_job("matrix.shard == 'alpha'", SERIAL_LINE + " -d"),
        # f2: the step's if: must hold on a shard the matrix has, and the step must be in the python job
        python_job("matrix.shard == 'renamed'", SERIAL_LINE),
        python_job("false", SERIAL_LINE),
        python_job("matrix.shard == 'alpha'", SERIAL_LINE).replace("python:", "lint:"),
    ):
        found = serial_problems(tmp_path, unrun)
        assert len(found) == 1, (unrun, found)
        assert "test_marked.py" in found[0]
    held = python_job("matrix.shard != 'x' && !(matrix.shard == 'y')", SERIAL_LINE)
    assert serial_problems(tmp_path, held) == []
