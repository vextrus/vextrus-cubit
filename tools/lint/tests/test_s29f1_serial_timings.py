"""S29-F1 fix round: the timing plan must cover serial files, the one kind `balance` counts in full.
CI's serial steps write their own JUnit report; `balance` fails a serial file with no timing."""

import json
import re
from pathlib import Path

from tools.lint.ci_shards import balance_problems

ROOT = Path(__file__).resolve().parents[3]


def _world(tmp_path: Path, timings: dict[str, float]) -> Path:
    (tmp_path / ".github").mkdir()
    (tmp_path / ".github" / "ci-shards.json").write_text(json.dumps({"shards": [{"name": "alpha"}]}))
    (tmp_path / ".github" / "ci-timings.json").write_text(json.dumps({"version": 1, "files": timings}))
    (tmp_path / "pyproject.toml").write_text('[tool.pytest.ini_options]\ntestpaths = ["pkg"]\n')
    tests = tmp_path / "pkg" / "tests"
    tests.mkdir(parents=True)
    (tests / "test_slow_serial.py").write_text("import pytest\npytestmark = pytest.mark.serial\n")
    (tests / "test_plain.py").write_text("def test_a(): ...\n")
    return tmp_path


def test_balance_fails_a_serial_file_the_plan_does_not_name(tmp_path: Path) -> None:
    world = _world(tmp_path, {"pkg/tests/test_plain.py": 1.0})
    found = balance_problems(world)
    assert any("test_slow_serial.py" in line and "no timing" in line for line in found), found


def test_balance_accepts_a_plan_naming_the_serial_file_and_ignores_unmarked_gaps(tmp_path: Path) -> None:
    world = _world(tmp_path, {"pkg/tests/test_slow_serial.py": 5.0})
    assert balance_problems(world) == []


def test_every_serial_step_of_ci_writes_its_own_junit_report_and_the_slow_report_reads_it() -> None:
    text = (ROOT / ".github/workflows/ci.yml").read_text()
    serial = [line for line in text.splitlines() if re.search(r"pytest\b.*-m \"serial\b", line)]
    assert serial, "ci.yml has serial steps"
    names = []
    for line in serial:
        found = re.findall(r"--junitxml=(\S+)", line)
        assert len(found) == 1, f"a serial step without its own JUnit report: {line.strip()[:80]}"
        names.append(found[0])
    assert len(set(names)) == len(names)
    assert all(n.startswith("junit-serial-") for n in names)
    slow = [line for line in text.splitlines() if "tools.lint.slow_files" in line]
    assert slow
    assert all("junit-*.xml" in line for line in slow), slow
