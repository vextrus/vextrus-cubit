"""The slow-file report's reading of a JUnit test case (ticket f1)."""

from xml.etree.ElementTree import Element

from tools.lint.slow_files import file_of


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
