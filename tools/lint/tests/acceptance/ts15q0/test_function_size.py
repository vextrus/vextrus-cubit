"""S15-Q0: the Python size and complexity ratchet (the ticket: "a complexity and size ratchet with a
committed baseline (a new over-limit function fails CI; existing ones may only shrink)"; Python over
engine, vextrus, scripts and tools).

The seam is `python -m tools.lint.complexity` (see `_tree.py`). Each case plants code in a copy of the
repository and reads only the command's exit code and whether its output names the function; the
limits and the baseline's form are the builder's. The planted functions are far past any limit a gate
would set (300 plain statements; 30 branches in 32 lines), and the grown one is the longest function
in today's production code, which a baseline holds.
"""

import sys
from pathlib import Path

import pytest

from ._tree import REPO, ROOTS, copy_repo, grow, longest_function, output, plant, run, workflow_lines

MODULE = "tools.lint.complexity"


def ratchet(root: Path) -> tuple[int, str]:
    result = run(root, sys.executable, "-m", MODULE)
    return result.returncode, output(result)


def long_function(name: str) -> str:
    body = "".join(f"    total += {index}\n" for index in range(300))
    return f"def {name}() -> int:\n    total = 0\n{body}    return total\n"


def branchy_function(name: str) -> str:
    branches = "".join(f"    if n == {index}: return {index}\n" for index in range(30))
    return f"def {name}(n: int) -> int:\n{branches}    return -1\n"


def test_the_unchanged_code_passes_the_ratchet(tmp_path: Path) -> None:
    root = copy_repo(tmp_path)

    code, said = ratchet(root)

    assert code == 0, said


@pytest.mark.parametrize("top", ROOTS)
def test_a_new_function_longer_than_the_limit_fails_naming_it(tmp_path: Path, top: str) -> None:
    root = copy_repo(tmp_path)
    name = f"planted_q0_long_{top}"
    plant(root, f"{top}/planted_q0_long.py", long_function(name))

    code, said = ratchet(root)

    assert code != 0, f"{said} (the ratchet passed a new 302-line function in {top})"
    assert name in said, f"{said} (the ratchet did not name {name})"


@pytest.mark.parametrize("top", ROOTS)
def test_a_new_function_more_complex_than_the_limit_fails_naming_it(tmp_path: Path, top: str) -> None:
    root = copy_repo(tmp_path)
    name = f"planted_q0_branchy_{top}"
    plant(root, f"{top}/planted_q0_branchy.py", branchy_function(name))

    code, said = ratchet(root)

    assert code != 0, f"{said} (the ratchet passed a new function of 30 branches in {top})"
    assert name in said, f"{said} (the ratchet did not name {name})"


def test_a_new_small_function_passes(tmp_path: Path) -> None:
    root = copy_repo(tmp_path)
    plant(root, "engine/planted_q0_small.py", "def planted_q0_small(n: int) -> int:\n    return n + 1\n")

    code, said = ratchet(root)

    assert code == 0, said


def test_the_longest_function_today_may_only_shrink(tmp_path: Path) -> None:
    root = copy_repo(tmp_path)
    function = longest_function(root)
    grow(function, 20)

    code, said = ratchet(root)

    where = f"{function.path.relative_to(root)} {function.name}, {function.lines} lines"
    assert code != 0, f"{said} (the ratchet passed {where} grown by 20 statements)"
    assert function.name in said, f"{said} (the ratchet did not name {function.name})"


def test_ci_runs_the_ratchet() -> None:
    steps = [line for line in workflow_lines(REPO) if MODULE in line]

    assert steps, f"no CI workflow step runs {MODULE}"
