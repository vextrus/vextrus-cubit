"""Ticket S14-B1 (issue #454): `python -m scripts.factory.crosspr <branch>`, the cross-PR check.

Authority: issue #454, "Fix": the builder "runs `git merge-tree` plus the changed tests against every
open PR that touches its files, and lists the result in the READY body"; "Acceptance check": "A
fixture where two open PRs' tests break each other: the later builder's READY is refused with both PR
names. A fixture with no overlapping files is accepted with an empty list." The session-14 plan (row
9): "`crosspr.py` (merge-tree and test run against open PRs touching the same files), PR-body lines".

The line format pinned here (the orchestrator's brief: "the READY commit message carries a `Cross-PR:`
line naming the open PRs checked"): on success the last line crosspr prints is exactly

    Cross-PR: #<n> #<m> ok        (the open PRs checked, ascending, one space apart)
    Cross-PR: none ok             (no open PR touches the branch's files)

and on a refusal it exits non-zero and prints no `Cross-PR: ... ok` line. The builder's branch has no PR
of its own here (a local builder never pushes), so "both" are the open PR's `#<n>` and the branch's name.

Fixture (see `_world.py`): main's `calc.py` has `rate()` (2) and `name()` ("calc"), four lines apart, so
a change to one and a change to the other merge cleanly.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from scripts.tests.acceptance.ts14b1._world import BRANCH, CALC, MUTATING, World, show

OK_LINE = re.compile(r"^Cross-PR: (none|#[0-9]+( #[0-9]+)*) ok$")

RATE_3 = CALC.replace("return 2", "return 3")
RATE_4 = CALC.replace("return 2", "return 4")
CALCULATOR = CALC.replace('return "calc"', 'return "calculator"')
WITH_TOTAL = CALCULATOR + "\n\ndef total(n):\n    return n * rate()\n"
WITH_DOUBLE = CALC + "\n\ndef double(n):\n    return 2 * n\n"
NEW_DOCSTRING = CALC.replace("A small module", "A tiny module")

OWN_TEST = "import calc\n\n\ndef test_rate_is_three():\n    assert calc.rate() == 3\n"
OWN_TEST_NAME = OWN_TEST + '\n\ndef test_name_is_calc():\n    assert calc.name() == "calc"\n'
TOTAL_TEST = (
    "import calc\n\n\ndef test_total_of_three_is_six():\n    assert calc.total(3) == 6\n\n\n"
    'def test_name_is_calculator():\n    assert calc.name() == "calculator"\n'
)
CALCULATOR_TEST = (
    'import calc\n\n\ndef test_name_is_calculator():\n    assert calc.name() == "calculator"\n'
)
OTHER = "def other():\n    return 1\n"
OTHER_TEST = "import other\n\n\ndef test_other():\n    assert other.other() == 1\n"
DOUBLE_TEST = "import calc\n\n\ndef test_double():\n    assert calc.double(2) == 4\n"


def output(done: subprocess.CompletedProcess[str]) -> str:
    return f"{done.stdout}\n{done.stderr}"


def last_line(text: str) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    return lines[-1] if lines else ""


def without_repo(argv: list[str]) -> list[str]:
    plain: list[str] = []
    skip = False
    for part in argv:
        if skip:
            skip = False
        elif part in ("--repo", "-R"):
            skip = True
        elif not part.startswith("--repo="):
            plain.append(part)
    return plain


def no_ok_line(text: str) -> bool:
    return not any(OK_LINE.match(line.strip()) for line in text.splitlines())


def test_a_conflict_with_an_open_pr_on_the_same_file_is_refused_naming_both(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(53, "s14-x3", {"calc.py": RATE_4})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST})
    done = world.crosspr()
    assert done.returncode != 0, show(done)
    text = output(done)
    assert "#53" in text, show(done)
    assert BRANCH in text, show(done)
    assert no_ok_line(done.stdout), show(done)


def test_two_branches_whose_tests_break_each_other_are_refused_naming_both(tmp_path: Path) -> None:
    """Each branch passes its own tests alone and the two merge cleanly, but on their union the open
    PR's `total(3) == 6` sees rate 3 and the branch's `name() == "calc"` sees "calculator"."""
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": WITH_TOTAL, "tests/test_x1_total.py": TOTAL_TEST})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST_NAME})
    done = world.crosspr()
    assert done.returncode != 0, show(done)
    text = output(done)
    assert "#51" in text, show(done)
    assert BRANCH in text, show(done)
    assert "test_x1_total.py" in text, show(done)
    assert "test_b9_rate.py" in text, show(done)
    assert no_ok_line(done.stdout), show(done)


def test_a_union_that_breaks_only_the_other_prs_tests_is_refused(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": WITH_TOTAL, "tests/test_x1_total.py": TOTAL_TEST})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST})
    done = world.crosspr()
    assert done.returncode != 0, show(done)
    text = output(done)
    assert "#51" in text, show(done)
    assert BRANCH in text, show(done)
    assert "test_x1_total.py" in text, show(done)
    assert no_ok_line(done.stdout), show(done)


def test_a_union_that_breaks_only_the_branchs_own_tests_is_refused(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": CALCULATOR, "tests/test_x1_name.py": CALCULATOR_TEST})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST_NAME})
    done = world.crosspr()
    assert done.returncode != 0, show(done)
    text = output(done)
    assert "#51" in text, show(done)
    assert BRANCH in text, show(done)
    assert "test_b9_rate.py" in text, show(done)
    assert no_ok_line(done.stdout), show(done)


def test_one_bad_pr_among_good_ones_is_still_refused_naming_it(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": WITH_DOUBLE, "tests/test_x1_double.py": DOUBLE_TEST})
    world.open_pr(53, "s14-x3", {"calc.py": RATE_4})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST})
    done = world.crosspr()
    assert done.returncode != 0, show(done)
    assert "#53" in output(done), show(done)
    assert no_ok_line(done.stdout), show(done)


def test_open_prs_on_disjoint_files_are_accepted_with_an_empty_list(tmp_path: Path) -> None:
    """The issue: "A fixture with no overlapping files is accepted with an empty list." The branch's own
    PR (#50, a pushed head of the same branch, as a cloud builder's would be) is not another PR."""
    world = World(tmp_path)
    world.open_pr(52, "s14-x2", {"other.py": OTHER, "tests/test_x2_other.py": OTHER_TEST})
    world.open_pr(50, BRANCH, {"calc.py": RATE_3})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST})
    done = world.crosspr()
    assert done.returncode == 0, show(done)
    assert last_line(done.stdout) == "Cross-PR: none ok", show(done)


def test_open_prs_on_the_same_file_that_merge_and_pass_together_are_listed_ok(
    tmp_path: Path,
) -> None:
    world = World(tmp_path)
    world.open_pr(53, "s14-x3", {"calc.py": NEW_DOCSTRING})
    world.open_pr(52, "s14-x2", {"other.py": OTHER})
    world.open_pr(51, "s14-x1", {"calc.py": WITH_DOUBLE, "tests/test_x1_double.py": DOUBLE_TEST})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST})
    done = world.crosspr()
    assert done.returncode == 0, show(done)
    assert last_line(done.stdout) == "Cross-PR: #51 #53 ok", show(done)


def test_a_refusing_run_pushes_nothing_and_leaves_the_clone_as_it_was(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": WITH_TOTAL, "tests/test_x1_total.py": TOTAL_TEST})
    world.open_pr(53, "s14-x3", {"calc.py": RATE_4})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST_NAME})
    before = world.snapshot()
    done = world.crosspr()
    assert done.returncode != 0, show(done)
    after = world.snapshot()
    for key in before:
        assert after[key] == before[key], f"{key} changed\n{show(done)}"
    assert world.gh_calls(), "crosspr never asked gh for the open PRs"
    for argv in world.gh_calls():
        plain = without_repo(argv)
        assert tuple(plain[:2]) not in MUTATING, argv
        if plain[:1] == ["api"]:
            assert not {"POST", "PUT", "PATCH", "DELETE"} & {p.upper() for p in plain}, argv
            if {"-f", "-F", "--field", "--raw-field", "--input"} & set(plain):
                # gh api sends a POST when fields are given, unless the method is named GET.
                assert {"GET", "--method=GET", "-XGET"} & set(plain), argv


def test_a_passing_run_pushes_nothing_and_leaves_the_clone_as_it_was(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.open_pr(51, "s14-x1", {"calc.py": WITH_DOUBLE, "tests/test_x1_double.py": DOUBLE_TEST})
    world.own({"calc.py": RATE_3, "tests/test_b9_rate.py": OWN_TEST})
    before = world.snapshot()
    done = world.crosspr()
    assert done.returncode == 0, show(done)
    after = world.snapshot()
    for key in before:
        assert after[key] == before[key], f"{key} changed\n{show(done)}"
