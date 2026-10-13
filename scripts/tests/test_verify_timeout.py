"""`timed_out_files` reads vitest's default reporter text for a run that failed only by timing out."""

from scripts.verify import timed_out_files

TIMEOUT = "Error: Test timed out in 15000ms."


def run(*blocks: str, failed: int | None = None) -> str:
    n = len(blocks) if failed is None else failed
    return "\n".join(["", *blocks, "", f"      Tests  {n} failed | 3 passed (4)", ""])


def test_both_projects_name_their_file() -> None:
    out = run(
        f" FAIL  |browser (chromium)| src/a.test.tsx > a > slow\n{TIMEOUT}\nIf this is long.",
        f" FAIL  |node| src/b.node.test.ts > fast\n{TIMEOUT}",
        f" FAIL  |browser (chromium)| src/a.test.tsx > a > slower\n{TIMEOUT}",
    )
    assert timed_out_files(1, out) == ["src/a.test.tsx", "src/b.node.test.ts"]


def test_an_assertion_among_the_timeouts_stands() -> None:
    out = run(
        f" FAIL  |node| src/a.test.tsx > x\n{TIMEOUT}",
        " FAIL  |node| src/b.test.tsx > y\nAssertionError: no",
    )
    assert timed_out_files(1, out) is None


def test_a_hook_timeout_stands() -> None:
    out = run(" FAIL  |node| src/a.test.tsx > x\nError: Hook timed out in 10000ms.")
    assert timed_out_files(1, out) is None


def test_a_failed_count_beyond_the_fail_lines_stands() -> None:
    out = run(f" FAIL  |node| src/a.test.tsx > x\n{TIMEOUT}", failed=2)
    assert timed_out_files(1, out) is None


def test_unhandled_errors_stand() -> None:
    out = run(f" FAIL  |node| src/a.test.tsx > x\n{TIMEOUT}") + "\n Errors  1 error\n"
    assert timed_out_files(1, out) is None


def test_no_summary_or_another_exit_code_stands() -> None:
    assert timed_out_files(1, f" FAIL  |node| src/a.test.tsx > x\n{TIMEOUT}") is None
    assert timed_out_files(2, run(f" FAIL  |node| src/a.test.tsx > x\n{TIMEOUT}")) is None
