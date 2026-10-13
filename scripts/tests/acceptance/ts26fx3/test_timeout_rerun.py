"""verify re-runs a web test file that failed only by timing out, alone, with vitest workers capped
(session 26 brief, FX3; ruling `verify.web_timeout = rerun-alone`, the owner's Q-R3, 13 Oct 2026).

The seam: `scripts.verify.main([], run=..., leak=...)` in a scratch clone with a staged `web/` change,
so the plan holds `web-test`. The fake `run` answers `web-test` with vitest's default reporter text (as
`flakes_in` and `root_only_in` read it); a re-run is a `run` call whose argv has a token ending in the
file's path as vitest prints it (`src/.../x.test.tsx`; a `web/`-prefixed token matches too). The
timeout text is vitest 5.0.2's own (`Error: Test timed out in <n>ms.` and the line after it).
"""

import json
import re
import subprocess
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from scripts.verify import Check

PAN = "src/sheet/pan.test.tsx"
GRID = "src/sheet/grid.test.tsx"
STOREYS = "src/takeoff/storeys.test.tsx"
FILES = (PAN, GRID, STOREYS)
NOT_RERUN = "no re-run of the timed-out file alone"
TIMEOUT = (
    "Error: Test timed out in 15000ms.\n"
    "If this is a long-running test, pass a timeout value as the last argument or configure it "
    'globally with "testTimeout".'
)
CAP = re.compile(r"^--max-?[wW]orkers(?:=(\d+%?))?$")
RULE = "⎯" * 24
POINTER = "\u276f"  # vitest's marker before a failed file and a source location
CROSS = "\u00d7"  # vitest's marker before a failed test

# A test's outcome: "pass", "timeout", "assert", or "quoted" (an assertion whose expected text is the
# timeout message).
Tests = dict[str, list[tuple[str, str]]]


def vitest(tests: Tests) -> tuple[int, str]:
    """vitest's default reporter output (ANSI stripped) and exit code for these files' tests."""
    lines = ["", " RUN  v5.0.2 /repo/web", ""]
    failures: list[str] = []
    for path, cases in tests.items():
        failed = [title for title, kind in cases if kind != "pass"]
        counts = f"{len(cases)} test{'s' if len(cases) != 1 else ''}" + (
            f" | {len(failed)} failed" if failed else ""
        )
        mark = POINTER if failed else "✓"
        lines.append(f" {mark} |browser| {path} ({counts}) 15032ms")
        lines += [f"   {CROSS} {title} 15004ms" for title in failed]
        for title, kind in cases:
            if kind == "pass":
                continue
            if kind == "timeout":
                error = TIMEOUT
            elif kind == "quoted":
                error = (
                    "AssertionError: expected 'a' to be 'Test timed out in 15000ms.' "
                    "// Object.is equality"
                )
            else:
                error = "AssertionError: expected 3 to be 4 // Object.is equality"
            failures.append(
                f" FAIL  |browser| {path} > {title}\n{error}\n {POINTER} {path}:12:5\n"
                f"     12|     expect(found).toBe(4)\n       |     ^\n"
            )
    total = sum(len(cases) for cases in tests.values())
    failed_n = sum(1 for cases in tests.values() for _, kind in cases if kind != "pass")
    files_failed = sum(1 for cases in tests.values() if any(kind != "pass" for _, kind in cases))
    if failures:
        lines += ["", f"⎯⎯⎯⎯⎯⎯⎯ Failed Tests {failed_n} ⎯⎯⎯⎯⎯⎯⎯", ""]
        for n, block in enumerate(failures, 1):
            lines += [block, f"{RULE}[{n}/{len(failures)}]⎯", ""]
    passed_files = len(tests) - files_failed
    if files_failed:
        files_line = f" Test Files  {files_failed} failed" + (
            f" | {passed_files} passed" if passed_files else ""
        )
        tests_line = f"      Tests  {failed_n} failed" + (
            f" | {total - failed_n} passed" if total - failed_n else ""
        )
    else:
        files_line = f" Test Files  {len(tests)} passed"
        tests_line = f"      Tests  {total} passed"
    lines += [
        "",
        f"{files_line} ({len(tests)})",
        f"{tests_line} ({total})",
        "   Start at  12:00:00",
        "   Duration  31.20s",
        "",
    ]
    return (1 if files_failed else 0), "\n".join(lines)


@dataclass
class Runs:
    """The fake runner: the first web-test reply, and each file's reply when it is run by name."""

    first: Tests
    alone: dict[str, Tests]
    calls: list[Check] = field(default_factory=list)

    def named(self, check: Check) -> list[str]:
        return [path for path in FILES if any(token.endswith(path) for token in check.argv)]

    def reruns(self) -> list[Check]:
        return [check for check in self.calls if self.named(check)]

    def __call__(self, check: Check) -> tuple[int, str]:
        self.calls.append(check)
        if named := self.named(check):
            merged: Tests = {}
            for path in named:
                merged.update(self.alone.get(path, {path: [("passes", "pass")]}))
            return vitest(merged)
        if check.name == "web-test":
            return vitest(self.first)
        return 0, "ok\n"


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


@pytest.fixture
def clone(tmp_path: Path) -> Path:
    root = tmp_path / "clone"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    (root / ".github").mkdir()
    (root / ".github/flaky.txt").write_text("# none\n")
    (root / ".github/flaky-root.txt").write_text("# none\n")
    (root / "README.md").write_text("x\n")
    git(root, "add", ".github/flaky.txt", ".github/flaky-root.txt", "README.md")
    git(root, "commit", "-q", "-m", "init")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    (root / "web/src/sheet").mkdir(parents=True)
    (root / "web/src/sheet/pan.test.tsx").write_text("// changed\n")
    git(root, "add", "web/src/sheet/pan.test.tsx")
    return root


@dataclass
class Verdict:
    code: int
    out: str
    ok: object


def verify(
    root: Path, runs: Runs, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> Verdict:
    from scripts.verify import main

    monkeypatch.chdir(root)
    run: Callable[[Check], tuple[int, str]] = runs
    code = main([], run=run, leak=lambda _root, _tree: (False, []))
    out = capsys.readouterr().out
    tree = git(root, "write-tree")
    common = Path(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    record = json.loads((common / "vextrus" / f"verify-{tree}.json").read_text())
    return Verdict(code, out, record["ok"])


def passed(verdict: Verdict, root: Path) -> None:
    tree = git(root, "write-tree")
    assert verdict.code == 0, verdict.out
    assert verdict.out.strip().splitlines()[-1] == f"Factory-Verify: {tree} ok", verdict.out
    assert verdict.ok is True


def failed(verdict: Verdict) -> None:
    assert verdict.code == 1, verdict.out
    assert "Factory-Verify:" not in verdict.out
    assert verdict.ok is False


def timed_out_only() -> Runs:
    first: Tests = {
        PAN: [("pans on a drag", "pass"), ("loads the sheet", "timeout")],
        GRID: [("draws the grid", "pass")],
    }
    return Runs(
        first=first, alone={PAN: {PAN: [("pans on a drag", "pass"), ("loads the sheet", "pass")]}}
    )


# The re-run: red on main (verify re-runs nothing).


def test_a_file_that_only_timed_out_and_passes_alone_passes_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = timed_out_only()
    verdict = verify(clone, runs, capsys, monkeypatch)
    assert runs.reruns(), NOT_RERUN
    passed(verdict, clone)


def test_the_rerun_names_the_timed_out_file_alone(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = timed_out_only()
    verify(clone, runs, capsys, monkeypatch)
    assert runs.reruns(), NOT_RERUN
    assert [runs.named(check) for check in runs.reruns()] == [[PAN]], [
        check.argv for check in runs.reruns()
    ]


def test_the_rerun_caps_vitest_workers(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = timed_out_only()
    verify(clone, runs, capsys, monkeypatch)
    assert runs.reruns(), NOT_RERUN
    for check in runs.reruns():
        argv = list(check.argv)
        caps = [
            (match[1] if match[1] is not None else (argv[i + 1] if i + 1 < len(argv) else ""))
            for i, token in enumerate(argv)
            if (match := CAP.match(token))
        ]
        assert caps, f"the re-run sets no --maxWorkers: {argv}"
        assert all(re.fullmatch(r"[1-9]\d*%?", cap) for cap in caps), argv


def test_two_files_that_only_timed_out_are_each_rerun_alone(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    first: Tests = {
        PAN: [("loads the sheet", "timeout")],
        GRID: [("draws the grid", "timeout"), ("labels the grid", "pass")],
        STOREYS: [("lists the storeys", "pass")],
    }
    runs = Runs(first=first, alone={})
    verdict = verify(clone, runs, capsys, monkeypatch)
    assert runs.reruns(), NOT_RERUN
    named = sorted(tuple(runs.named(check)) for check in runs.reruns())
    assert named == [(GRID,), (PAN,)], [check.argv for check in runs.reruns()]
    passed(verdict, clone)


def test_a_file_that_times_out_again_alone_fails_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = timed_out_only()
    runs.alone = {PAN: {PAN: [("pans on a drag", "pass"), ("loads the sheet", "timeout")]}}
    verdict = verify(clone, runs, capsys, monkeypatch)
    assert runs.reruns(), NOT_RERUN
    failed(verdict)


# A real failure still fails verify, whatever a re-run would say (every re-run here passes).


def test_an_assertion_failure_fails_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    first: Tests = {PAN: [("pans on a drag", "assert")], GRID: [("draws the grid", "pass")]}
    failed(verify(clone, Runs(first=first, alone={}), capsys, monkeypatch))


def test_a_timeout_beside_an_assertion_in_another_file_fails_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    first: Tests = {
        PAN: [("loads the sheet", "timeout")],
        GRID: [("draws the grid", "assert")],
    }
    failed(verify(clone, Runs(first=first, alone={}), capsys, monkeypatch))


def test_a_timeout_beside_an_assertion_in_the_same_file_fails_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    first: Tests = {PAN: [("loads the sheet", "timeout"), ("pans on a drag", "assert")]}
    failed(verify(clone, Runs(first=first, alone={}), capsys, monkeypatch))


def test_an_assertion_quoting_the_timeout_message_fails_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    first: Tests = {PAN: [("names the storey", "quoted")], GRID: [("draws the grid", "pass")]}
    failed(verify(clone, Runs(first=first, alone={}), capsys, monkeypatch))
