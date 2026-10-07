"""S17-F2: "cheap checks concurrent" (`docs/handoff/session-17-prompt.md`, F2); the brief: "Cheap checks
(lints, scans) run concurrently rather than one after another"; `verify-ci-speed.md` §2 item 10: "run
the cheap checks concurrently with pytest". Concurrency loses nothing: every planned check is still
recorded with its own exit code and its own output, a failure still fails verify, and the web checks
keep the order the cloud needs (`scripts/verify.py`: the schema exported and the types generated before
typecheck, which runs `tsr generate`, before `npm test`).

Seam: `scripts.verify.main(argv, *, run, leak)` (ticket f4) with `run(check) -> (exit code, output)`
called once per check (from any thread), on a scratch clone; the record contract
`docs/specs/factory/contracts/verify-record.schema.json`. The cheap checks are the Python lints verify
plans today: `ruff`, `ruff-format`, `mypy`, `lint-imports`.

The scripted runner blocks a check until another one has started. The wait is bounded only so that a
verify running them one after another fails rather than hangs; a concurrent verify never reaches it.
"""

import json
import subprocess
import threading
from itertools import pairwise
from pathlib import Path
from typing import Any

import pytest

from scripts.verify import Check, main, plan_with_notes

CHEAP = ("ruff", "ruff-format", "mypy", "lint-imports")
WEB_ORDER = ("openapi-export", "api-types", "typecheck", "web-test")
CHANGED = ["scripts/factory/thing.py", "web/src/thing.ts"]
DEADLOCK_GUARD_SECONDS = 20.0


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("VEXTRUS_VERIFY_WORKERS", "CLAUDE_CODE_REMOTE", "PYTEST_ADDOPTS"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def clone(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A clone with `origin/main` at its first commit and a Python and a web file staged."""
    root = tmp_path / "clone"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    (root / "README.md").write_text("x\n")
    git(root, "add", "README.md")
    git(root, "commit", "-q", "-m", "init")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    for name in CHANGED:
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text("x = 1\n")
        git(root, "add", name)
    monkeypatch.chdir(root)
    return root


class Runner:
    """Records each check's start and end in one sequence; `hold` makes the named checks wait until a
    check named in `until` has started (once a wait gives up, no later one waits)."""

    def __init__(self, hold: tuple[str, ...] = (), until: tuple[str, ...] = (), need: int = 1) -> None:
        self.lock = threading.Lock()
        self.events: list[tuple[str, str]] = []
        self.hold, self.until, self.need = hold, until, need
        self.started_until = 0
        self.ready = threading.Event()
        self.gave_up = threading.Event()
        self.waited: dict[str, bool] = {}
        self.codes: dict[str, int] = {}

    def __call__(self, check: Check) -> tuple[int, str]:
        with self.lock:
            self.events.append(("start", check.name))
            if check.name in self.until:
                self.started_until += 1
                if self.started_until >= self.need:
                    self.ready.set()
        if check.name in self.hold and not self.gave_up.is_set():
            met = self.ready.wait(DEADLOCK_GUARD_SECONDS)
            if not met:
                self.gave_up.set()
            with self.lock:
                self.waited[check.name] = met
        with self.lock:
            self.events.append(("end", check.name))
        return self.codes.get(check.name, 0), f"output of {check.name}\n"

    def index(self, kind: str, name: str) -> int:
        return self.events.index((kind, name))


def verify(runner: Runner) -> int:
    return main([], run=runner, leak=lambda root, tree: (False, []))


def record_of(root: Path) -> dict[str, Any]:
    tree = git(root, "write-tree")
    common = Path(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    loaded: dict[str, Any] = json.loads((common / "vextrus" / f"verify-{tree}.json").read_text())
    return loaded


def pytest_names(root: Path) -> list[str]:
    checks, _ = plan_with_notes(CHANGED, have=lambda tool: False, root=root)
    return [check.name for check in checks if "pytest" in check.argv[:5]]


def test_the_cheap_checks_start_while_pytest_is_still_running(clone: Path) -> None:
    names = tuple(pytest_names(clone))
    assert names, "verify plans a pytest run"
    runner = Runner(hold=names, until=CHEAP)
    assert verify(runner) == 0
    assert all(runner.waited.get(name) for name in names[:1]), (
        f"the cheap checks ran one after another, after pytest: {runner.events}"
    )


def test_two_cheap_checks_are_in_flight_at_once(clone: Path) -> None:
    runner = Runner(hold=CHEAP, until=CHEAP, need=2)
    assert verify(runner) == 0
    first = next(name for kind, name in runner.events if kind == "start" and name in CHEAP)
    assert runner.waited.get(first), f"the cheap checks ran one after another: {runner.events}"


def test_the_web_checks_keep_their_order(clone: Path) -> None:
    """Guard: concurrency must not start the types before the schema, nor the tests before them."""
    runner = Runner()
    assert verify(runner) == 0
    for before, after in pairwise(WEB_ORDER):
        assert runner.index("end", before) < runner.index("start", after), (
            f"{after} starts after {before} ends: {runner.events}"
        )


def test_a_failing_cheap_check_still_fails_verify_and_every_check_keeps_its_own_output(
    clone: Path,
) -> None:
    """Guard: a failure in a concurrent check is recorded and fails the run; no output goes to another
    check's file; every planned check is recorded once."""
    runner = Runner()
    runner.codes["mypy"] = 1
    assert verify(runner) == 1
    record = record_of(clone)
    assert record["ok"] is False
    planned, _ = plan_with_notes(CHANGED, have=lambda tool: False, root=clone)
    names = [entry["name"] for entry in record["checks"]]
    assert sorted(names) == sorted([*(check.name for check in planned), "crosspr"]), names
    assert len(set(names)) == len(names), f"each check's output file is its own: {names}"
    for entry in record["checks"]:
        assert entry["exit_code"] == (1 if entry["name"] == "mypy" else 0), entry
        text = (clone / entry["output_file"]).read_text()
        assert text.startswith(f"output of {entry['name']}\n"), (entry["name"], text)
