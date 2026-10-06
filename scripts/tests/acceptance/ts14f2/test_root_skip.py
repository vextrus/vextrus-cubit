"""S14-F2 (issue #450): `vextrus/tests/test_failures_log.py`'s read-only check assumes a non-root user;
cloud containers run as uid 0, where a chmod'd folder stays writable. Fix: "Mark `test_failures_log`
`skipif(os.geteuid() == 0)`". Acceptance (factory-next.md section 8, row 3): "`test_failures_log`
skipped as root".

Seam: `os.geteuid`. A child pytest loads a plugin (written in the test's temporary folder) that
replaces `os.geteuid` before collection, so the test file sees the uid this test chooses. The child's
JUnit report gives each test's outcome.
"""

import os
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree

REPO = Path(__file__).resolve().parents[4]
TARGET = "vextrus/tests/test_failures_log.py"
READ_ONLY = "test_a_log_that_cannot_be_written_is_said_once_and_every_test_still_runs"


def run_as(uid: int, tmp_path: Path) -> tuple[int, ElementTree.Element, str]:
    plugins = tmp_path / "plugins"
    plugins.mkdir()
    (plugins / "ts14f2_euid.py").write_text(f"import os\n\nos.geteuid = lambda: {uid}\n")
    report = tmp_path / "report.xml"
    env = {**os.environ, "PYTHONPATH": os.pathsep.join([str(plugins), str(REPO)])}
    done = subprocess.run(
        [
            sys.executable, "-m", "pytest", "-p", "ts14f2_euid", "-p", "no:cacheprovider",
            "-rs", f"--junitxml={report}", TARGET,
        ],
        cwd=REPO, env=env, capture_output=True, text=True, check=False, timeout=600,
    )  # fmt: skip
    return done.returncode, ElementTree.parse(report).getroot(), done.stdout + done.stderr


def case(root: ElementTree.Element, name: str) -> ElementTree.Element:
    [found] = [item for item in root.iter("testcase") if item.get("name") == name]
    return found


def test_as_root_the_read_only_checkout_test_is_skipped_with_a_reason_naming_root(
    tmp_path: Path,
) -> None:
    _code, root, output = run_as(0, tmp_path)
    skipped = case(root, READ_ONLY).find("skipped")
    assert skipped is not None, output
    reason = (skipped.get("message") or "") + (skipped.text or "")
    assert "root" in reason.lower(), reason


def test_as_root_nothing_in_the_failures_log_tests_fails(tmp_path: Path) -> None:
    code, root, output = run_as(0, tmp_path)
    broken = [
        item.get("name")
        for item in root.iter("testcase")
        if item.find("failure") is not None or item.find("error") is not None
    ]
    assert broken == [], output
    assert code == 0, output


def test_as_a_non_root_user_the_read_only_checkout_test_still_runs(tmp_path: Path) -> None:
    _code, root, output = run_as(1000, tmp_path)
    assert case(root, READ_ONLY).find("skipped") is None, output
