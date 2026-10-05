"""Ticket f1, section 3 B (tier 2): `python -m tools.lint.slow_files <junit.xml>...` reads each CI
shard's JUnit report and names the slowest test files (docs/specs/factory.md 3.9, "Slow-file report").

Driven through its command line only, as CI's step runs it. JUnit fixtures are invented: pytest's
default (xunit2) report names a test by `classname` only (`vextrus.mod.tests.test_x`), the xunit1
form adds `file=`; both must be read.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
LINE = re.compile(r"^(\d+(?:\.\d+)?) (\S+)$")


def case(file: str, seconds: float, *, by_file: bool, name: str = "test_it") -> str:
    module = file.removesuffix(".py").replace("/", ".")
    where = f' file="{file}"' if by_file else ""
    return f'<testcase classname="{module}" name="{name}"{where} time="{seconds}" />'


def report(*cases: str) -> str:
    body = "\n".join(cases)
    head = '<?xml version="1.0" encoding="utf-8"?>\n<testsuites><testsuite name="pytest">'
    return f"{head}\n{body}\n</testsuite></testsuites>\n"


def run(*paths: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.slow_files", *map(str, paths)],
        cwd=ROOT,
        env={**os.environ, "PYTHONPATH": str(ROOT)},
        capture_output=True,
        text=True,
        check=False,
    )


def listed(stdout: str) -> list[tuple[float, str]]:
    return [
        (float(m.group(1)), m.group(2))
        for line in stdout.splitlines()
        if (m := LINE.match(line.strip()))
    ]


def test_b1_prints_the_20_slowest_files_summed_per_file_slowest_first(tmp_path: Path) -> None:
    # 25 files; file k takes k + 0.5 seconds in all, split over two tests for the odd ones.
    cases = []
    want: dict[str, float] = {}
    for k in range(1, 26):
        file = f"vextrus/mod{k}/tests/test_m{k}.py"
        total = k + 0.5
        want[file] = total
        if k % 2:
            cases += [case(file, 1.25, by_file=k % 3 == 0, name="test_a")]
            cases += [case(file, total - 1.25, by_file=k % 3 == 0, name="test_b")]
        else:
            cases += [case(file, total, by_file=k % 4 == 0)]
    junit = tmp_path / "junit-rest.xml"
    junit.write_text(report(*cases))

    done = run(junit)
    assert done.returncode == 0, done.stdout + done.stderr
    expected = sorted(want.items(), key=lambda item: -item[1])[:20]
    got = listed(done.stdout)
    assert [file for _, file in got] == [file for file, _ in expected]
    for (seconds, file), (_, total) in zip(got, expected, strict=True):
        assert abs(seconds - total) < 0.01, file


def test_b2_a_file_over_180_seconds_is_a_github_warning_and_still_exit_0(tmp_path: Path) -> None:
    slow = "vextrus/seed/tests/test_slow.py"
    junit = tmp_path / "junit.xml"
    junit.write_text(report(case(slow, 120, by_file=True, name="test_a"), case(slow, 65, by_file=True)))

    done = run(junit)
    assert done.returncode == 0, done.stdout + done.stderr
    assert any(line.startswith(f"::warning file={slow}::") for line in done.stdout.splitlines())

    quick = tmp_path / "quick.xml"
    quick.write_text(report(case(slow, 179, by_file=False)))
    assert not any(line.startswith("::warning") for line in run(quick).stdout.splitlines())


def test_b3_a_file_over_600_seconds_fails_the_step(tmp_path: Path) -> None:
    slow = "vextrus/takeoff/tests/test_slowest.py"
    over = tmp_path / "over.xml"
    over.write_text(
        report(case(slow, 400, by_file=False, name="test_a"), case(slow, 201, by_file=False))
    )
    under = tmp_path / "under.xml"
    under.write_text(
        report(case(slow, 400, by_file=False, name="test_a"), case(slow, 190, by_file=False))
    )

    assert run(over).returncode == 1
    assert run(under).returncode == 0


def test_b4_shards_reports_are_merged_and_a_missing_or_malformed_one_fails_closed(
    tmp_path: Path,
) -> None:
    one = tmp_path / "junit-one.xml"
    one.write_text(
        report(
            case("vextrus/a/tests/test_a.py", 30, by_file=True),
            case("engine/b/tests/test_b.py", 5, by_file=False),
        )
    )
    two = tmp_path / "junit-two.xml"
    two.write_text(
        report(
            case("vextrus/a/tests/test_a.py", 12, by_file=False),
            case("tools/c/tests/test_c.py", 20, by_file=True),
        )
    )

    done = run(one, two)
    assert done.returncode == 0, done.stdout + done.stderr
    got = listed(done.stdout)
    assert [file for _, file in got] == [
        "vextrus/a/tests/test_a.py",
        "tools/c/tests/test_c.py",
        "engine/b/tests/test_b.py",
    ]
    assert abs(got[0][0] - 42) < 0.01

    broken = tmp_path / "junit-broken.xml"
    broken.write_text("<testsuites><testsuite><testcase classname=")
    for bad in ([one, tmp_path / "junit-missing.xml"], [one, broken]):
        failed = run(*bad)
        assert failed.returncode == 1, bad
        assert (failed.stdout + failed.stderr).strip(), "a printed problem"
        assert "Traceback" not in failed.stdout + failed.stderr
