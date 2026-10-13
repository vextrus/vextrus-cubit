"""verify fails when only CI's slowed-fake pass fails, and re-runs a file of it that only timed out
alone, still slowed (S26-FX11; the orchestrator's ruling, 13 Oct 2026: "S26-FX3's lone re-run of
timed-out files applies to it too").

The re-run is not in the plan (it is in `main`'s settling of a failed check), so it is pinned at FX3's
seam: `scripts.verify.main([], run=..., leak=...)` in a scratch clone with a staged `web/` change and a
copy of the repository's web.yml. The fake `run` tells the passes apart by env alone: the whole-suite
`npm --prefix web test` without `VITE_FAKE_API_LATENCY_MS` is the plain pass, with it the slowed pass; a
call whose argv has a token ending in a test file's path is a re-run of that file. Its replies are
vitest 5.0.2's default reporter text (as `timed_out_files` reads it).
"""

import json
import re
import shutil
import subprocess
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts26fx11.webyml import KEY, WEB_YML, ci_latency
from scripts.verify import Check

WEB_TEST = ("npm", "--prefix", "web", "test")
PAN = "src/sheet/pan.test.tsx"
GRID = "src/sheet/grid.test.tsx"
FILES = (PAN, GRID)
TIMEOUT = (
    "Error: Test timed out in 15000ms.\n"
    "If this is a long-running test, pass a timeout value as the last argument or configure it "
    'globally with "testTimeout".'
)
POINTER = chr(0x276F)  # vitest's marker before a failed file
CROSS = chr(0xD7)  # vitest's marker before a failed test
RULE = "⎯" * 24

Tests = dict[str, list[tuple[str, str]]]
ALL_PASS: Tests = {PAN: [("pans on a drag", "pass")], GRID: [("draws the grid", "pass")]}


def vitest(tests: Tests) -> tuple[int, str]:
    """vitest's default reporter output (ANSI stripped) and exit code: each test "pass", "timeout"
    or "assert"."""
    lines = ["", " RUN  v5.0.2 /repo/web", ""]
    failures: list[str] = []
    for path, cases in tests.items():
        failed = [title for title, kind in cases if kind != "pass"]
        counts = f"{len(cases)} tests" + (f" | {len(failed)} failed" if failed else "")
        lines.append(f" {POINTER if failed else '✓'} |browser| {path} ({counts}) 15032ms")
        lines += [f"   {CROSS} {title} 15004ms" for title in failed]
        for title, kind in cases:
            if kind == "pass":
                continue
            error = TIMEOUT if kind == "timeout" else "AssertionError: expected 3 to be 4"
            failures.append(
                f" FAIL  |browser| {path} > {title}\n{error}\n {POINTER} {path}:12:5\n"
                f"     12|     expect(found).toBe(4)\n       |     ^\n"
            )
    total = sum(len(cases) for cases in tests.values())
    failed_n = len(failures)
    files_failed = sum(1 for cases in tests.values() if any(kind != "pass" for _, kind in cases))
    if failures:
        lines += ["", f"⎯⎯⎯ Failed Tests {failed_n} ⎯⎯⎯", ""]
        for n, block in enumerate(failures, 1):
            lines += [block, f"{RULE}[{n}/{failed_n}]⎯", ""]
    if files_failed:
        rest = len(tests) - files_failed
        files_line = f" Test Files  {files_failed} failed" + (f" | {rest} passed" if rest else "")
        tests_line = f"      Tests  {failed_n} failed" + (
            f" | {total - failed_n} passed" if total - failed_n else ""
        )
    else:
        files_line = f" Test Files  {len(tests)} passed"
        tests_line = f"      Tests  {total} passed"
    lines += ["", f"{files_line} ({len(tests)})", f"{tests_line} ({total})", "   Duration  31.20s", ""]
    return (1 if files_failed else 0), "\n".join(lines)


@dataclass
class Runs:
    """The fake runner: the plain pass's reply, the slowed pass's, and each file's reply alone."""

    plain: Tests
    slowed: Tests
    alone: dict[str, Tests] = field(default_factory=dict)
    calls: list[Check] = field(default_factory=list)

    def named(self, check: Check) -> list[str]:
        return [path for path in FILES if any(token.endswith(path) for token in check.argv)]

    def reruns(self) -> list[Check]:
        return [check for check in self.calls if self.named(check)]

    def slowed_passes(self) -> list[Check]:
        return [c for c in self.calls if c.argv == WEB_TEST and KEY in c.env]

    def __call__(self, check: Check) -> tuple[int, str]:
        self.calls.append(check)
        if named := self.named(check):
            merged: Tests = {}
            for path in named:
                merged.update(self.alone.get(path, {path: [("passes", "pass")]}))
            return vitest(merged)
        if check.argv == WEB_TEST:
            return vitest(self.slowed if KEY in check.env else self.plain)
        return 0, "ok\n"


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


@pytest.fixture
def clone(tmp_path: Path) -> Path:
    root = tmp_path / "clone"
    (root / ".github/workflows").mkdir(parents=True)
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    (root / ".github/flaky.txt").write_text("# none\n")
    (root / ".github/flaky-root.txt").write_text("# none\n")
    shutil.copyfile(WEB_YML, root / ".github/workflows/web.yml")
    (root / "README.md").write_text("x\n")
    git(
        root,
        "add",
        ".github/flaky.txt",
        ".github/flaky-root.txt",
        ".github/workflows/web.yml",
        "README.md",
    )
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


def slowed_timeout_only() -> Runs:
    return Runs(
        plain=ALL_PASS,
        slowed={PAN: [("pans on a drag", "timeout")], GRID: [("draws the grid", "pass")]},
        alone={PAN: {PAN: [("pans on a drag", "pass")]}},
    )


def test_a_test_that_fails_only_slowed_fails_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = Runs(
        plain=ALL_PASS,
        slowed={PAN: [("pans on a drag", "assert")], GRID: [("draws the grid", "pass")]},
    )
    verdict = verify(clone, runs, capsys, monkeypatch)
    assert runs.slowed_passes(), "verify ran no slowed web pass"
    assert verdict.code == 1, verdict.out
    assert "Factory-Verify:" not in verdict.out
    assert verdict.ok is False


def test_a_slowed_file_that_only_timed_out_is_rerun_alone_and_passes(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = slowed_timeout_only()
    verdict = verify(clone, runs, capsys, monkeypatch)
    assert runs.slowed_passes(), "verify ran no slowed web pass"
    assert [runs.named(c) for c in runs.reruns()] == [[PAN]], [c.argv for c in runs.reruns()]
    tree = git(clone, "write-tree")
    assert verdict.code == 0, verdict.out
    assert verdict.out.strip().splitlines()[-1] == f"Factory-Verify: {tree} ok", verdict.out


def test_the_slowed_rerun_is_still_slowed_and_caps_workers(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = slowed_timeout_only()
    verify(clone, runs, capsys, monkeypatch)
    assert runs.reruns(), "no re-run of the slowed pass's timed-out file alone"
    for check in runs.reruns():
        assert check.env.get(KEY) == ci_latency(), check.env
        assert any(re.fullmatch(r"--max-?[wW]orkers=1", token) for token in check.argv), check.argv


def test_a_slowed_file_that_times_out_alone_too_fails_verify(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = slowed_timeout_only()
    runs.alone = {PAN: {PAN: [("pans on a drag", "timeout")]}}
    verdict = verify(clone, runs, capsys, monkeypatch)
    assert runs.slowed_passes(), "verify ran no slowed web pass"
    assert runs.reruns(), "no re-run of the slowed pass's timed-out file alone"
    assert verdict.code == 1, verdict.out
    assert verdict.ok is False
