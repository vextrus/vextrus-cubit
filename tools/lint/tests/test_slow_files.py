"""The slow-file report's reading of a JUnit test case (ticket f1)."""

import json
from pathlib import Path
from xml.etree.ElementTree import Element

from tools.lint.slow_files import file_of, main


def test_a_case_names_its_file_by_file_or_by_classname() -> None:
    assert file_of(Element("testcase", {"file": "a/test_b.py", "classname": "x.y"})) == "a/test_b.py"
    assert (
        file_of(Element("testcase", {"classname": "no.such.tests.test_q"})) == "no/such/tests/test_q.py"
    )
    in_class = Element("testcase", {"classname": "no.such.tests.test_q.TestThing"})
    assert file_of(in_class) == "no/such/tests/test_q.py"


def test_a_real_file_is_found_through_a_class_name() -> None:
    case = Element("testcase", {"classname": "tools.lint.tests.test_slow_files.TestX"})
    assert file_of(case) == "tools/lint/tests/test_slow_files.py"


def test_write_timings_writes_every_file_not_just_the_slowest(tmp_path: Path) -> None:
    report = tmp_path / "junit.xml"
    cases = "".join(f'<testcase file="a/test_{n}.py" time="{n}.5"/>' for n in range(30))
    report.write_text(f"<testsuites><testsuite>{cases}</testsuite></testsuites>")
    out = tmp_path / "timings.json"
    assert main(["--write-timings", str(out), str(report)]) == 0
    written = json.loads(out.read_text())
    assert written["version"] == 1
    assert len(written["files"]) == 30
    assert written["files"]["a/test_3.py"] == 3.5
