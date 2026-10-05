"""The root-only lint's reading of a chmod mode and of acceptance files (S14-F2 fix round 1). Calls are
built from parts so this file holds no chmod of its own."""

import ast

import pytest

from tools.lint.root_only import constant_mode, problems_in, removes_permissions

CHMOD = "ch" + "mod"


def flagged(call: str) -> bool:
    return removes_permissions(ast.parse(call, mode="eval").body)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "call",
    [
        f"path.{CHMOD}(stat.S_IRUSR | stat.S_IXUSR)",
        f"path.{CHMOD}(stat.S_IXUSR)",
        f"path.{CHMOD}(0o777 & ~0o222)",
        f"os.{CHMOD}(path, 0o777 & ~(stat.S_IWUSR | stat.S_IRUSR))",
        f"path.{CHMOD}(mode=0o000)",
        f"path.{CHMOD}(some_mode)",
        f"os.{CHMOD}(path, compute())",
        f"subprocess.run(['{CHMOD}', '000', str(path)])",
        f"subprocess.run(['/bin/{CHMOD}', '-R', 'a-rwx', str(path)], check=True)",
        f"subprocess.check_call(('{CHMOD}', 'u-w', p))",
        f"subprocess.run(['{CHMOD}', mode, p])",
        f"subprocess.run('{CHMOD} 555 somewhere', shell=True)",
    ],
)
def test_a_mode_that_removes_or_cannot_be_read_is_flagged(call: str) -> None:
    assert flagged(call)


@pytest.mark.parametrize(
    "call",
    [
        f"path.{CHMOD}(0o755)",
        f"path.{CHMOD}(stat.S_IRUSR | stat.S_IWUSR)",
        f"path.{CHMOD}(0o777 & ~0o022)",
        f"path.{CHMOD}(path.stat().st_mode | stat.S_IXUSR)",
        f"subprocess.run(['{CHMOD}', '600', str(path)])",
        f"subprocess.run(['{CHMOD}', 'g-w', str(path)])",
        f"subprocess.run(['{CHMOD}', '+x', str(path)])",
        "subprocess.run(['ls', '-l'])",
    ],
)
def test_a_mode_that_keeps_the_owners_read_and_write_passes(call: str) -> None:
    assert not flagged(call)


def test_constant_modes_are_worked_out() -> None:
    def value(text: str) -> int | None:
        return constant_mode(ast.parse(text, mode="eval").body)

    assert value("stat.S_IRUSR | stat.S_IXUSR") == 0o500
    assert value("0o777 & ~0o222") == 0o555
    assert value("S_IRWXU") == 0o700
    assert value("1 << 99999") is None
    assert value("mode") is None


def body(call: str) -> str:
    return f"def test_x(tmp_path):\n    {call}\n"


def test_an_unreadable_mode_in_a_test_file_fails_the_lint() -> None:
    assert problems_in("pkg/tests/test_a.py", body(f"p.{CHMOD}(mode_from_somewhere)"), [])


def test_a_subprocess_chmod_in_a_test_file_fails_the_lint() -> None:
    assert problems_in("pkg/tests/test_a.py", body(f"subprocess.run(['{CHMOD}', '000', p])"), [])


def test_a_listing_names_the_test_exactly() -> None:
    text = "def test_a_and_more(tmp_path):\n    " + f"p.{CHMOD}(0)\n"
    assert problems_in("pkg/tests/test_a.py", text, [("pkg/tests/test_a.py", "test_a")])
    assert not problems_in("pkg/tests/test_a.py", text, [("pkg/tests/test_a.py", "test_a_and_more")])


GUARDED = (
    "import os\nimport pytest\n\n"
    '@pytest.mark.skipif(os.geteuid() == 0, reason="root")\n'
    f"def test_x(tmp_path):\n    p.{CHMOD}(0)\n"
)
ACCEPTANCE = "pkg/tests/acceptance/t1/test_a.py"


def test_a_root_skipif_does_not_satisfy_the_lint_in_an_acceptance_file() -> None:
    """As root the acceptance plugin fails a skipped acceptance test, so only the listing rescues it."""
    [problem] = problems_in(ACCEPTANCE, GUARDED, [])
    assert "flaky-root.txt" in problem
    assert problems_in("pkg/tests/test_a.py", GUARDED, []) == []


def test_a_module_level_root_skipif_does_not_satisfy_the_lint_in_an_acceptance_file() -> None:
    text = (
        "import os\nimport pytest\n\n"
        'pytestmark = pytest.mark.skipif(os.geteuid() == 0, reason="root")\n\n'
        f"def test_x(tmp_path):\n    p.{CHMOD}(0)\n"
    )
    assert problems_in(ACCEPTANCE, text, [])
    assert problems_in("pkg/tests/test_a.py", text, []) == []


def test_a_listed_acceptance_test_passes_the_lint() -> None:
    assert problems_in(ACCEPTANCE, GUARDED, [(ACCEPTANCE, "test_x")]) == []
