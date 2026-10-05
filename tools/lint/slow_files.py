"""The slow-file report (the factory spec 3.9; ticket f1, tier 2). Reads each CI shard's JUnit report
and prints the 20 slowest test files, their tests' times summed, slowest first, as `<seconds>
<file>`. A file over 180 s is a GitHub warning; a file over 600 s fails the step (one file that slow
would hold a whole shard). A missing or malformed report is a printed problem and exit 1: it fails
closed. Standard library only.

    python -m tools.lint.slow_files <junit.xml>...
"""

import sys
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree

TOP = 20
WARN_SECONDS = 180.0
FAIL_SECONDS = 600.0


def file_of(case: ElementTree.Element) -> str:
    """The test file a `<testcase>` belongs to: its `file=` (xunit1), else read from `classname`
    (pytest's default, `pkg.mod.tests.test_x` or `pkg.mod.tests.test_x.TestClass`)."""
    if named := case.get("file"):
        return named
    parts = (case.get("classname") or "").split(".")
    for end in range(len(parts), 0, -1):
        candidate = "/".join(parts[:end]) + ".py"
        if Path(candidate).is_file():
            return candidate
    while len(parts) > 1 and parts[-1][:1].isupper():
        parts.pop()
    return "/".join(parts) + ".py"


def times(paths: list[str]) -> tuple[dict[str, float], list[str]]:
    totals: dict[str, float] = defaultdict(float)
    problems: list[str] = []
    for path in paths:
        try:
            tree = ElementTree.parse(path)
        except (OSError, ElementTree.ParseError) as error:
            problems.append(f"{path}: not a readable JUnit report ({error})")
            continue
        for case in tree.iter("testcase"):
            try:
                totals[file_of(case)] += float(case.get("time") or 0)
            except ValueError:
                problems.append(f"{path}: a testcase with a time that is not a number")
    return dict(totals), problems


def main(argv: list[str] | None = None) -> int:
    paths = sys.argv[1:] if argv is None else argv
    if not paths:
        print("usage: python -m tools.lint.slow_files <junit.xml>...", file=sys.stderr)
        return 2
    totals, problems = times(paths)
    for problem in problems:
        print(problem)
    slowest = sorted(totals.items(), key=lambda item: (-item[1], item[0]))
    for file, seconds in slowest[:TOP]:
        print(f"{seconds:.2f} {file}")
    failed = False
    for file, seconds in slowest:
        if seconds > FAIL_SECONDS:
            failed = True
            print(f"::error file={file}::{seconds:.0f} s in one test file (limit {FAIL_SECONDS:.0f} s)")
        elif seconds > WARN_SECONDS:
            print(f"::warning file={file}::{seconds:.0f} s in one test file (over {WARN_SECONDS:.0f} s)")
    return 1 if failed or problems else 0


if __name__ == "__main__":
    sys.exit(main())
