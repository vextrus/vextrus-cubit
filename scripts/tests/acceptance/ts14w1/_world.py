"""The world of ticket S14-W1's acceptance tests: a governor copied into a scratch repository.

Each test copies this tree's `scripts/` package (its tests left out) into `tmp_path/tree`, makes that
a git repository with one commit, writes the test's own hot-file list over the committed one at
`scripts/factory/hot-files.json`, and runs `python -m scripts.factory.governor check <unit> --owns
<path> ...` there as a subprocess (cwd and PYTHONPATH the scratch tree). So the governor reads the
hot-file list of its own tree, whatever way it finds it.

The seams (the governor's own `VEXTRUS_*` convention, scripts/factory/governor.py's docstring):
- `VEXTRUS_FACTORY_DIR`: the run folder; its `launches/<ticket>-<utc>.json` are the builder registry,
  the launch records of launch-cli.md 5 (`ticket`, `branch`, `where`, `role`, `judge`, `stop_sent`,
  `started_at`), written by `scripts.factory.launch` (cloud) and `scripts.factory.local` (local);
- `VEXTRUS_PRS_FILE`: the open-PR source, the stdout of `gh pr list --state all --json
  number,headRefName,state,files` (the watcher's seam name, with `files` added: a list of
  `{"path", "additions", "deletions"}` as gh gives it). Rows of every state are given, so only the
  `OPEN` ones may count;
- `VEXTRUS_MEMINFO_FILE`, `VEXTRUS_DF_FILE`, `VEXTRUS_USAGE_FILE`, `VEXTRUS_AGENTS_FILE`, `VEXTRUS_NOW`:
  the machine and usage readings, always healthy here so only the new rules can refuse.
`gh` and `claude` stubs first on PATH fail, so a governor that ignored a seam reads nothing.

The hot-file list's format (pinned here): JSON `{"areas": {"<area name>": ["<repo path or fnmatch
glob>", ...]}}`. The fixtures use exact paths only.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-06T10:00:00Z"
STARTED = "2026-10-06T08:00:00Z"
KB_PER_GB = 1024 * 1024
DROPPED = {"CLAUDE_PROJECT_DIR", "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS", "CLAUDE_CODE_PLUGIN_DIRS"}

USAGE = json.dumps(
    {
        "type": "result",
        "subtype": "success",
        "is_error": False,
        "result": "Current session: 12% used\nCurrent week (all models): 27% used\n",
        "session_id": "00000000-0000-4000-8000-000000000000",
    }
)
MEMINFO = (
    f"MemTotal:       {27 * KB_PER_GB} kB\n"
    f"MemAvailable:   {20 * KB_PER_GB} kB\n"
    f"SwapTotal:      {8 * KB_PER_GB} kB\n"
    f"SwapFree:       {8 * KB_PER_GB - 209715} kB\n"
)
DF = f"Avail\n{100 * KB_PER_GB}\n"


def launch_record(
    ticket: str,
    branch: str,
    *,
    where: str = "cloud",
    role: str = "builder",
    ok: bool = True,
) -> dict[str, Any]:
    """A launch record (launch-cli.md 5) as launch.py writes it (cloud) or local.py (local)."""
    judge: dict[str, Any] | None
    if where == "local":
        judge = None
    else:
        judge = {"ok": ok, "code": "ok" if ok else "governor", "reason": "judged"}
    return {
        "ticket": ticket,
        "branch": branch,
        "where": where,
        "role": role,
        "effort": "high",
        "model": "claude-opus-5-5",
        "budget_minutes": 90,
        "session_id": f"session_{ticket}" if ok else None,
        "cli_version": "2.9.0",
        "started_at": STARTED,
        "governor": {"source": "governor", "reading": "OK cloud-session"},
        "leak_scan": {"status": "clean", "line": "0 hits"},
        "judge": judge,
        "stop_sent": False,
        "untestable": None,
        "review": None,
    }


def pr(number: int, branch: str, *paths: str, state: str = "OPEN") -> dict[str, Any]:
    """One row of `gh pr list --state all --json number,headRefName,state,files`."""
    return {
        "number": number,
        "headRefName": branch,
        "state": state,
        "files": [{"path": path, "additions": 3, "deletions": 1} for path in paths],
    }


def _copy_scripts(tree: Path) -> None:
    def ignore(folder: str, names: list[str]) -> set[str]:
        return {name for name in names if name in ("tests", "__pycache__", ".pytest_cache")}

    shutil.copytree(REPO / "scripts", tree / "scripts", ignore=ignore)


def _git(tree: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-c", "user.name=acceptance", "-c", "user.email=acceptance@example.invalid", *args],
        cwd=tree,
        check=True,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )


class World:
    """A scratch tree holding this repository's governor, with fixture readings behind its seams."""

    def __init__(self, tmp: Path, hot_areas: dict[str, list[str]] | None = None) -> None:
        self.tmp = tmp
        self.tree = tmp / "tree"
        self.tree.mkdir()
        _copy_scripts(self.tree)
        self.write_hot_files({} if hot_areas is None else hot_areas)
        _git(self.tree, "init", "-q")
        _git(self.tree, "add", "scripts")
        _git(self.tree, "commit", "-q", "-m", "scratch tree")
        self.factory = tmp / "factory"
        (self.factory / "launches").mkdir(parents=True)
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        for name in ("gh", "claude"):
            stub = self.stubs / name
            stub.write_text(f"#!{sys.executable}\nimport sys\nsys.exit(1)\n")
            stub.chmod(0o755)
        self.seams = {name: tmp / name for name in ("meminfo", "df", "usage", "agents", "prs")}
        self.seams["meminfo"].write_text(MEMINFO)
        self.seams["df"].write_text(DF)
        self.seams["usage"].write_text(USAGE)
        self.seams["agents"].write_text("[]")
        self.open_prs([])

    def write_hot_files(self, areas: dict[str, list[str]]) -> None:
        path = self.tree / "scripts" / "factory" / "hot-files.json"
        path.write_text(json.dumps({"areas": areas}, indent=2) + "\n")

    def open_prs(self, rows: list[dict[str, Any]]) -> None:
        self.seams["prs"].write_text(json.dumps(rows))

    def launched(self, *records: dict[str, Any]) -> None:
        for index, record in enumerate(records):
            name = f"{record['ticket']}-20261006T08{index:02d}00Z.json"
            (self.factory / "launches" / name).write_text(json.dumps(record, indent=2) + "\n")

    def env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_") and k not in DROPPED}
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(self.tree),
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_NOW=NOW,
            VEXTRUS_MEMINFO_FILE=str(self.seams["meminfo"]),
            VEXTRUS_DF_FILE=str(self.seams["df"]),
            VEXTRUS_USAGE_FILE=str(self.seams["usage"]),
            VEXTRUS_AGENTS_FILE=str(self.seams["agents"]),
            VEXTRUS_PRS_FILE=str(self.seams["prs"]),
        )
        return env

    def check(self, unit: str, *owns: str) -> subprocess.CompletedProcess[str]:
        argv = [sys.executable, "-m", "scripts.factory.governor", "check", unit]
        for path in owns:
            argv += ["--owns", path]
        return subprocess.run(
            argv,
            cwd=self.tree,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def assert_ok(done: subprocess.CompletedProcess[str], unit: str) -> None:
    assert done.returncode == 0, show(done)
    assert f"OK {unit}" in done.stdout.splitlines(), show(done)


def refusal(done: subprocess.CompletedProcess[str], unit: str) -> str:
    """The `REFUSED <unit>: <reason>` line of a refused check (exit 3)."""
    assert done.returncode == 3, show(done)
    lines = [line for line in done.stdout.splitlines() if line.startswith(f"REFUSED {unit}: ")]
    assert lines, show(done)
    return lines[0]


def names_pr(line: str, number: int) -> bool:
    return re.search(rf"(?<!\d){number}(?!\d)", line) is not None
