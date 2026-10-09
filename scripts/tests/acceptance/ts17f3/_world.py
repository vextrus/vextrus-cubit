"""Shared helpers for ticket S17-F3's acceptance tests (not a test file).

The cross-PR check runs in this process, as `scripts.factory.crosspr.main([BRANCH])`, in a ts14b1
`World` (a bare `origin.git`, the builder's `work` clone, the open PRs and a fake `gh` first on PATH):
the current folder is the `work` clone and the environment is the world's (no `GIT_`, `VEXTRUS_`,
`PYTEST_` or `CLAUDE_` variable from outside it).

Every pytest the check starts (a subprocess whose argv has an element named `pytest`, as in
`python -m pytest`) is faked at `subprocess.Popen`: it is recorded (its argv, and the side it ran on) and
answers `1 passed` with exit 0, or exit 1 for a side the test makes red. Every other subprocess (git, the
fake `gh`) runs for real. The side is read from the folder pytest runs in: the builder's branch adds
`b9.txt`, so a tree holding it is the union (main + the PR + the builder) and one without it is the PR's
baseline (main + the PR alone).
"""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import crosspr
from scripts.tests.acceptance.ts14b1._world import BRANCH, CALC, DROPPED_PREFIXES, World

TRUSTED = {"author": {"login": "vextrus"}, "isCrossRepository": False}
MARK = "b9.txt"
TINY = CALC.replace("A small", "A tiny")
RATE_X3 = CALC.replace("return 2", "return 2  # x3")
OWN_CALC = CALC.replace('return "calc"', 'return "calc"  # own')
NAME_TEST = "import calc\n\n\ndef test_name():\n    assert calc.name() == 'calc'\n"
RATE_TEST = "import calc\n\n\ndef test_rate():\n    assert calc.rate() == 2\n"
OWN_FILES = {"calc.py": OWN_CALC, MARK: "own\n"}

REAL_POPEN = subprocess.Popen


@dataclass
class PytestRun:
    argv: list[str]
    side: str  # "baseline" or "union"


@dataclass
class Result:
    code: int
    out: str
    err: str
    runs: list[PytestRun]

    def sides(self) -> list[str]:
        return [run.side for run in self.runs]

    def baselines(self) -> list[PytestRun]:
        return [run for run in self.runs if run.side == "baseline"]


class FakePytest:
    """A finished pytest process: what `Popen` gives back, enough for `communicate`, `run` and `with`."""

    def __init__(self, argv: list[str], code: int, text: bool) -> None:
        self.args = argv
        self.returncode = code
        self.pid = 0
        self.stdin = self.stdout = self.stderr = None
        out = "1 passed in 0.01s\n" if code == 0 else "FAILED tests - assert False\n1 failed in 0.01s\n"
        self._out: str | bytes = out if text else out.encode()
        self._err: str | bytes = "" if text else b""

    def communicate(self, input: Any = None, timeout: float | None = None) -> tuple[Any, Any]:
        return self._out, self._err

    def wait(self, timeout: float | None = None) -> int:
        return self.returncode

    def poll(self) -> int:
        return self.returncode

    def kill(self) -> None:
        return None

    def terminate(self) -> None:
        return None

    def send_signal(self, sig: int) -> None:
        return None

    def __enter__(self) -> FakePytest:
        return self

    def __exit__(self, *exc: object) -> None:
        return None


def is_pytest(argv: object) -> bool:
    parts = argv.split() if isinstance(argv, str) else [str(a) for a in argv]  # type: ignore[attr-defined]
    return any(Path(part).name == "pytest" for part in parts)


def workers(argv: list[str]) -> str | None:
    """The worker count pytest-xdist is given in argv (`-n N`, `-nN`, `--numprocesses[=]N`), or None."""
    for index, part in enumerate(argv):
        if part in ("-n", "--numprocesses") and index + 1 < len(argv):
            return argv[index + 1]
        if part.startswith("--numprocesses="):
            return part.split("=", 1)[1]
        if part.startswith("-n") and len(part) > 2:
            return part[2:]
    return None


def serial(argv: list[str]) -> bool:
    """No parallel workers: no `-n`, `-n 0`, or xdist switched off (`-p no:xdist`)."""
    return workers(argv) in (None, "0") or any("no:xdist" in part for part in argv)


def names(argv: list[str], path: str) -> bool:
    return any(part == path or part.endswith("/" + path) for part in argv)


@dataclass
class Check:
    """Runs the cross-PR check in-process on a world, faking its pytest; `red` lists the sides whose
    pytest exits 1."""

    world: World
    monkeypatch: pytest.MonkeyPatch
    capsys: pytest.CaptureFixture[str]
    red: set[str] = field(default_factory=set)

    def __post_init__(self) -> None:
        for key in list(os.environ):
            if key.startswith(DROPPED_PREFIXES):
                self.monkeypatch.delenv(key)
        for key, value in self.world.env().items():
            if key.startswith("GIT_"):
                self.monkeypatch.setenv(key, value)
        self.monkeypatch.setenv("PATH", f"{self.world.bin}{os.pathsep}{os.environ.get('PATH', '')}")
        self.monkeypatch.setenv("PYTHONDONTWRITEBYTECODE", "1")
        self.monkeypatch.chdir(self.world.work)

    def __call__(self, env: dict[str, str] | None = None) -> Result:
        runs: list[PytestRun] = []

        def popen(*args: Any, **kwargs: Any) -> Any:
            argv = kwargs.get("args", args[0] if args else None)
            if not is_pytest(argv):
                return REAL_POPEN(*args, **kwargs)
            listed = argv.split() if isinstance(argv, str) else [str(a) for a in argv or []]
            cwd = Path(kwargs.get("cwd") or os.getcwd())
            side = "union" if (cwd / MARK).exists() else "baseline"
            runs.append(PytestRun(listed, side))
            text = any(kwargs.get(k) for k in ("text", "universal_newlines", "encoding", "errors"))
            return FakePytest(listed, 1 if side in self.red else 0, text)

        self.capsys.readouterr()
        with self.monkeypatch.context() as patch:
            patch.setattr(subprocess, "Popen", popen)
            for key, value in (env or {}).items():
                patch.setenv(key, value)
            code = crosspr.main([BRANCH])
        said = self.capsys.readouterr()
        return Result(code, said.out, said.err, runs)


def show(result: Result) -> str:
    runs = "\n".join(f"  {run.side}: {' '.join(run.argv)}" for run in result.runs)
    return f"exit {result.code}\n--- stdout\n{result.out}\n--- stderr\n{result.err}\n--- pytest\n{runs}"


def describe(world: World, number: int, **fields: Any) -> None:
    for pr in world.prs:
        if pr["number"] == number:
            pr.update(fields)
    world.state.write_text(json.dumps(world.prs))


def one_pr_world(tmp: Path, extra: dict[str, str] | None = None) -> World:
    """PR #51 (`s14-x1`: calc.py's docstring and its own test) open; the builder changes calc.py's name()
    and adds `b9.txt`."""
    world = World(tmp)
    world.open_pr(51, "s14-x1", {"calc.py": TINY, "tests/test_x1_name.py": NAME_TEST, **(extra or {})})
    describe(world, 51, **TRUSTED)
    world.own(OWN_FILES)
    return world


def two_pr_world(tmp: Path) -> World:
    """#51 as above and #53 (`s14-x3`: calc.py's rate() and its own test), both overlapping."""
    world = World(tmp)
    world.open_pr(51, "s14-x1", {"calc.py": TINY, "tests/test_x1_name.py": NAME_TEST})
    world.open_pr(53, "s14-x3", {"calc.py": RATE_X3, "tests/test_x3_rate.py": RATE_TEST})
    describe(world, 51, **TRUSTED)
    describe(world, 53, **TRUSTED)
    world.own(OWN_FILES)
    return world


def commit(world: World, files: dict[str, str], message: str) -> str:
    world.write(files)
    world.git(world.work, "add", *files)
    world.git(world.work, "commit", "-q", "-m", message)
    return world.git(world.work, "rev-parse", "HEAD")


def new_pr_head(world: World, number: int, files: dict[str, str]) -> str:
    """A new commit on PR #number's branch, pushed to origin (its branch and refs/pull/<n>/head); the
    fake gh then lists the new head. The builder's branch stays checked out."""
    pr = next(pr for pr in world.prs if pr["number"] == number)
    branch = str(pr["headRefName"])
    world.git(world.work, "fetch", "-q", "origin", f"refs/heads/{branch}")
    world.git(world.work, "switch", "-q", "-c", f"tmp-{branch}", "FETCH_HEAD")
    sha = commit(world, files, f"{branch}: a new head")
    world.git(world.work, "switch", "-q", BRANCH)
    world.git(world.work, "branch", "-q", "-D", f"tmp-{branch}")
    world.git(world.work, "push", "-q", "origin", f"{sha}:refs/heads/{branch}")
    world.git(world.work, "push", "-q", "origin", f"{sha}:refs/pull/{number}/head")
    paths = {item["path"] for item in pr["files"]} | set(files)
    pr["headRefOid"] = sha
    pr["files"] = [{"path": p, "additions": 1, "deletions": 0} for p in sorted(paths)]
    pr["changedFiles"] = len(paths)
    world.state.write_text(json.dumps(world.prs))
    return sha


def advance_main(world: World, files: dict[str, str]) -> str:
    """A new commit on main, pushed to origin and fetched; the builder's branch stays checked out."""
    world.git(world.work, "switch", "-q", "main")
    sha = commit(world, files, "main moves")
    world.git(world.work, "push", "-q", "origin", "main")
    world.git(world.work, "switch", "-q", BRANCH)
    world.git(world.work, "fetch", "-q", "origin")
    return sha
