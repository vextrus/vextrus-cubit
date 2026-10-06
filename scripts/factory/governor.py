"""The governor: may this machine and this account take one more unit of work now?

    python -m scripts.factory.governor check <unit> [--json] [--usage-checked "<lines>"]
        [--running N] [--agents N] [--rate R --hours-to-reset H] [--owns PATH ...]
        [--role R] [--branch B]

Units and their memory cost (spec 2.3): `cloud-session` (none: the cloud VM is not this machine, so
memory, swap and disk are not read), `local-agent` 0.9, `review` (`--agents` x 0.3 + 0.7; default 8
agents), `pytest` 3.3, `web-tests` 9.5, `walk` 5.6, `rd-run` 3.0.

Floors, every local unit: `MemAvailable - cost >= 5.4`; swap used above 2 refuses, above 1 warns;
disk free (`df -k --output=avail /`) under 30 refuses, under 40 warns (the spec names no disk cost per
unit, so it is 0); at most 3 local agents (`claude agents --json --all` rows with a `pid` and a `kind`
other than `interactive`) for `local-agent`. A live `g1.pid` (the G1 walk) refuses `web-tests`,
`pytest` and `walk`; a live `rd.pid` (a real-drawing run) refuses `web-tests` and `rd-run`; a pidfile
that names no pid counts as live.

Usage (`cloud-session`, `local-agent`, `review`): only `Current session: N% used` and `Current week (all
models): N% used` are read (any other line, the per-model week lines among them, is ignored). A new
launch is refused only at a used-up limit, session or week >= 100; `review` is never held but prints
`DEGRADE pr-reviewer-only` at session or week >= 100. The owner's ruling (5 Oct 2026): "don't make those
threshold of week 85% or session 80%, make them 100% both and I'll take actions whatever needed for
usage tokens expansion". Cloud sessions are capped at 8 whatever the usage; with `--rate` (measured %
per builder-hour) and `--hours-to-reset`, `min(16, floor((100 - session) / (rate x hours)))`.
`--running N` (sessions running now) is refused at or above the cap.

Work in flight (`cloud-session` and `local-agent`, S14-W1): at most 5 builders in flight, counted as the
open PRs plus the launched builders (`$VEXTRUS_FACTORY_DIR/launches/*.json`: a cloud record whose judge
is ok, or a local one; never an acceptance-writer, reviewer or refuter record, one whose STOP was sent,
one that started before the creation of its branch's latest merged or closed PR when the branch has none
open (a relaunch on a branch after its PR closed counts; a PR row with no `createdAt` releases every
record on its branch), or one past its `started_at` plus `budget_minutes` (120 when absent) plus a
60-minute grace that is no longer running: a local record whose agent name is not live in `claude
agents`, or a cloud one past the longer of 4 x its budget and 6 hours; the reading `aged_out` names
each); a builder and its open PR count once (joined on the branch). `--role reviewer|refuter` takes no
new work and skips these checks; `--branch B` marks a launch on a branch that already holds a unit (an
open PR or a builder) as no new work: it meets neither the cap nor its own unit. With `--owns PATH`
(repeatable: the files the ticket owns; a path ending in `/` is a folder and covers every file under
it): at most 2 open PRs or builders in any hot-file area the owned files touch
(`scripts/factory/hot-files.json`, committed: `{"areas": {"<area>": ["<repo path, folder ending in /, or
fnmatch glob>", ...]}}`), and no owned file may be one an open PR changes (the refusal names that PR).
Open PRs are the stdout of `gh pr list --state all --json number,headRefName,state,createdAt,files`
(`VEXTRUS_PRS_FILE` stands in for it). An unreadable record or hot-file list refuses, and so does an
unreadable PR list when files are named; with none named, the reading says so and the cap counts the
records alone. A builder's record names its `owns` when the launch gave them.

Units of size: every GB here is a GiB (1024^3 bytes), as `/proc/meminfo` and `df -k` count KiB and as
status.schema.json reports them.

It fails closed: an unreadable `/proc/meminfo`, `df` output, usage text or agents list refuses the unit
(the usage refusal prints the raw lines it read). `--usage-checked "<lines>"` (the orchestrator's own
reading of `/usage`) stands in for an unreadable usage reading and must itself parse.

Readings come from files first (the tests' seams): `VEXTRUS_MEMINFO_FILE`, `VEXTRUS_DF_FILE`,
`VEXTRUS_USAGE_FILE` (the stdout of `claude -p "/usage" --output-format json`, or plain text),
`VEXTRUS_AGENTS_FILE`; `VEXTRUS_FACTORY_DIR` holds the pidfiles.

Output: `WARN ...` and `DEGRADE ...` lines, then `OK <unit>` or `REFUSED <unit>: <reason>`; `--json`
prints one JSON object instead (unit, ok, reason, warnings, session_pct, week_pct, cap, degrade,
usage_checked, readings). Exit 0 ok, 3 refused, 2 usage error.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import math
import os
import re
import subprocess
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from scripts.factory import status

KIB_PER_GB = 1024 * 1024
MEM_FLOOR_GB = 5.4
SWAP_REFUSE_GB = 2.0
SWAP_WARN_GB = 1.0
DISK_REFUSE_GB = 30.0
DISK_WARN_GB = 40.0
MAX_LOCAL_AGENTS = 3
SESSION_HOLD = 100.0
WEEK_HOLD = 100.0
DEGRADE_AT = 100.0
CAP_HIGH, CAP_MAX = 8, 16
REVIEW_DEFAULT_AGENTS = 8
WIP_CAP = 5
AREA_CAP = 2
WORK_UNITS = ("cloud-session", "local-agent")
HOT_FILES = Path(__file__).with_name("hot-files.json")
PR_LIST_LIMIT = "500"
NOT_BUILDER_ROLES = ("acceptance-writer", "reviewer", "refuter")
NO_NEW_WORK_ROLES = ("reviewer", "refuter")
DEFAULT_BUDGET_MINUTES = 120
GRACE_MINUTES = 60
CLOUD_OVERRUN_FACTOR = 4
CLOUD_MIN_HOURS = 6
START_ERRORS = (KeyError, TypeError, ValueError)

COSTS_GB = {"local-agent": 0.9, "pytest": 3.3, "web-tests": 9.5, "walk": 5.6, "rd-run": 3.0}
UNITS = ("cloud-session", "local-agent", "review", "pytest", "web-tests", "walk", "rd-run")
USAGE_UNITS = ("cloud-session", "local-agent", "review")
G1_EXCLUDES = ("web-tests", "pytest", "walk")
RD_EXCLUDES = ("web-tests", "rd-run")

SESSION_RE = re.compile(r"^\s*Current session:\s*(\d+(?:\.\d+)?)\s*% used\b")
WEEK_RE = re.compile(r"^\s*Current week \(all models\):\s*(\d+(?:\.\d+)?)\s*% used\b")

COMMAND_TIMEOUT = 120


# --- readings
@dataclass(frozen=True)
class Memory:
    available_gb: float
    swap_used_gb: float


@dataclass(frozen=True)
class Usage:
    session: float
    week: float


@dataclass
class UsageReading:
    usage: Usage | None
    raw_lines: list[str] = field(default_factory=list)


def _run(argv: list[str]) -> str | None:
    """A reading command's stdout, or None when it cannot run or fails."""
    try:
        done = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=COMMAND_TIMEOUT,
            check=False,
        )
    except status.RUN_ERRORS:
        return None
    return done.stdout if done.returncode == 0 else None


def _seam(variable: str) -> str | None:
    """The text of the file a `VEXTRUS_*_FILE` seam names ('' when unreadable); None when unset."""
    path = os.environ.get(variable)
    if not path:
        return None
    try:
        return Path(path).read_text()
    except OSError:
        return ""


def meminfo_text() -> str:
    seam = _seam("VEXTRUS_MEMINFO_FILE")
    if seam is not None:
        return seam
    try:
        return Path("/proc/meminfo").read_text()
    except OSError:
        return ""


def df_text() -> str:
    seam = _seam("VEXTRUS_DF_FILE")
    if seam is not None:
        return seam
    return _run(["df", "-k", "--output=avail", "/"]) or ""


def usage_text() -> str:
    seam = _seam("VEXTRUS_USAGE_FILE")
    if seam is not None:
        return seam
    return _run(["claude", "-p", "/usage", "--output-format", "json"]) or ""


def agents_text() -> str:
    seam = _seam("VEXTRUS_AGENTS_FILE")
    if seam is not None:
        return seam
    return _run(["claude", "agents", "--json", "--all"]) or ""


def parse_meminfo(text: str) -> Memory | None:
    fields: dict[str, int] = {}
    for line in text.splitlines():
        match = re.fullmatch(r"\s*(\w+):\s*(\d+)\s*kB\s*", line)
        if match:
            fields[match.group(1)] = int(match.group(2))
    if not {"MemAvailable", "SwapTotal", "SwapFree"} <= set(fields):
        return None
    swap_used = max(0, fields["SwapTotal"] - fields["SwapFree"])
    return Memory(fields["MemAvailable"] / KIB_PER_GB, swap_used / KIB_PER_GB)


def parse_df(text: str) -> float | None:
    """`df -k --output=avail <path>`: a header line `Avail` and one number of KiB."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) != 2 or lines[0] != "Avail" or not lines[1].isdigit():
        return None
    return int(lines[1]) / KIB_PER_GB


def usage_lines(text: str) -> list[str]:
    """The `/usage` text's lines: `.result` of the CLI's JSON, else the plain text."""
    body = text
    try:
        loaded = json.loads(text)
    except ValueError:
        loaded = None
    if isinstance(loaded, dict) and isinstance(loaded.get("result"), str):
        body = loaded["result"]
    return body.splitlines()


def parse_usage(text: str) -> UsageReading:
    lines = usage_lines(text)
    session = week = None
    for line in lines:
        if (match := SESSION_RE.match(line)) and session is None:
            session = float(match.group(1))
        elif (match := WEEK_RE.match(line)) and week is None:
            week = float(match.group(1))
    if session is None or week is None or session > 100 or week > 100:
        return UsageReading(None, lines)
    return UsageReading(Usage(session, week), lines)


def parse_agents(text: str) -> list[dict[str, Any]] | None:
    try:
        loaded = json.loads(text)
    except ValueError:
        return None
    if not isinstance(loaded, list) or not all(isinstance(row, dict) for row in loaded):
        return None
    return loaded


def prs_text() -> str:
    seam = _seam("VEXTRUS_PRS_FILE")
    if seam is not None:
        return seam
    return (
        _run(
            [
                "gh",
                "pr",
                "list",
                "--state",
                "all",
                "--limit",
                PR_LIST_LIMIT,
                "--json",
                "number,headRefName,state,createdAt,files",
            ]
        )
        or ""
    )


def parse_prs(text: str) -> list[dict[str, Any]] | None:
    """The `gh pr list` rows, or None unless every row has a number, a branch, a state and file paths."""
    try:
        loaded = json.loads(text)
    except ValueError:
        return None
    if not isinstance(loaded, list):
        return None
    for row in loaded:
        if not (
            isinstance(row, dict)
            and isinstance(row.get("number"), int)
            and isinstance(row.get("headRefName"), str)
            and isinstance(row.get("state"), str)
            and isinstance(row.get("files"), list)
            and all(isinstance(f, dict) and isinstance(f.get("path"), str) for f in row["files"])
        ):
            return None
    return loaded


def read_prs() -> list[dict[str, Any]] | None:
    return parse_prs(prs_text())


def read_builders() -> list[dict[str, Any]] | None:
    """The launched builders: cloud records whose judge is ok and local ones, never an
    acceptance-writer, a reviewer or a refuter. None when a record is unreadable (it may be a
    builder: fail closed)."""
    builders: list[dict[str, Any]] = []
    for path in sorted((status.factory_dir() / "launches").glob("*.json")):
        if path.name.endswith(".agents.json"):
            continue
        try:
            record = json.loads(path.read_text())
        except status.RECORD_ERRORS:
            return None
        if not isinstance(record, dict) or not isinstance(record.get("branch"), str):
            return None
        if record.get("role", "builder") in NOT_BUILDER_ROLES or record.get("review") is not None:
            continue
        if record.get("stop_sent") is True:
            continue
        judge = record.get("judge")
        if record.get("where") == "local" or (isinstance(judge, dict) and judge.get("ok") is True):
            builders.append(record)
    return builders


def aged_out(record: dict[str, Any], live_agents: Callable[[], set[str] | None]) -> str | None:
    """Why a record is no builder in flight (the sign is named), or None while it counts.

    Inside its budget plus a 60-minute grace a record always counts. After that a local builder (its
    record names its agent) ages out when the agents snapshot is readable and holds no live agent of
    that name; any other builder (a cloud one) ages out after the longer of 4 x its budget and 6 hours,
    since builders overrun and the cloud has no snapshot to ask. A record with no readable start counts
    (fail closed)."""
    try:
        started = status.parse_utc(record["started_at"])
    except START_ERRORS:
        return None
    budget = record.get("budget_minutes")
    if not isinstance(budget, int) or isinstance(budget, bool) or budget <= 0:
        budget = DEFAULT_BUDGET_MINUTES
    elapsed = status.now() - started
    if elapsed <= timedelta(minutes=budget + GRACE_MINUTES):
        return None
    name = record.get("name")
    if record.get("where") == "local" and isinstance(name, str):
        live = live_agents()
        if live is not None and name not in live:
            return f"no live agent named {name}"
        return None
    limit = max(CLOUD_OVERRUN_FACTOR * budget, CLOUD_MIN_HOURS * 60)
    if elapsed > timedelta(minutes=limit):
        return f"over {limit} minutes with no PR"
    return None


def read_hot_areas() -> dict[str, list[str]] | None:
    try:
        areas = json.loads(HOT_FILES.read_text())["areas"]
    except status.RECORD_ERRORS:
        return None
    if not isinstance(areas, dict) or not all(
        isinstance(paths, list) and all(isinstance(entry, str) for entry in paths)
        for paths in areas.values()
    ):
        return None
    return areas


def touches(path: str, entries: list[str]) -> bool:
    """Whether a repo path is one of `entries`, matches one (fnmatch) or lies under one that ends in
    `/`; a `path` ending in `/` is a folder, and touches an entry that lies under it."""
    for entry in entries:
        if path == entry or fnmatch.fnmatchcase(path, entry):
            return True
        if entry.endswith("/") and path.startswith(entry):
            return True
        if path.endswith("/") and entry.startswith(path):
            return True
    return False


def in_area(path: str, entries: list[str]) -> bool:
    return touches(path, entries)


def read_memory() -> Memory | None:
    return parse_meminfo(meminfo_text())


def read_disk_gb() -> float | None:
    return parse_df(df_text())


def read_usage() -> UsageReading:
    return parse_usage(usage_text())


def read_agents() -> list[dict[str, Any]] | None:
    return parse_agents(agents_text())


def live_local_agents(rows: list[dict[str, Any]]) -> int:
    return sum(1 for row in rows if row.get("pid") is not None and row.get("kind") != "interactive")


# --- the check
@dataclass
class Verdict:
    unit: str
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    raw_usage: list[str] = field(default_factory=list)
    session_pct: float | None = None
    week_pct: float | None = None
    cap: int | None = None
    degrade: bool = False
    usage_checked: bool = False
    readings: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.reasons

    @property
    def reason(self) -> str | None:
        return "; ".join(self.reasons) if self.reasons else None

    def as_json(self) -> dict[str, Any]:
        record: dict[str, Any] = {
            "unit": self.unit,
            "ok": self.ok,
            "reason": self.reason,
            "warnings": self.warnings,
            "session_pct": _number(self.session_pct),
            "week_pct": _number(self.week_pct),
            "cap": self.cap,
            "degrade": self.degrade,
            "usage_checked": self.usage_checked,
            "readings": self.readings,
        }
        if not self.ok and self.raw_usage:
            record["usage_raw"] = self.raw_usage
        return record


def _number(value: float | None) -> float | int | None:
    if value is None:
        return None
    return int(value) if value == int(value) else value


def cloud_cap(usage: Usage, rate: float | None, hours: float | None) -> int:
    if rate is not None and hours is not None and rate > 0 and hours > 0:
        return max(0, min(CAP_MAX, math.floor((SESSION_HOLD - usage.session) / (rate * hours))))
    return CAP_HIGH


def check(
    unit: str,
    *,
    running: int = 0,
    agents: int | None = None,
    rate: float | None = None,
    hours_to_reset: float | None = None,
    usage_checked: str | None = None,
    owns: tuple[str, ...] | list[str] = (),
    role: str | None = None,
    branch: str | None = None,
) -> Verdict:
    verdict = Verdict(unit)
    if unit != "cloud-session":
        _check_machine(verdict, agents)
    if unit in USAGE_UNITS:
        _check_usage(verdict, running, rate, hours_to_reset, usage_checked)
    if unit == "local-agent":
        rows = read_agents()
        if rows is None:
            verdict.reasons.append("the agents list (claude agents --json --all) is unreadable")
        else:
            count = live_local_agents(rows)
            verdict.readings["local_agents"] = count
            if count >= MAX_LOCAL_AGENTS:
                verdict.reasons.append(f"{count} local agents running, the most is {MAX_LOCAL_AGENTS}")
    if unit in WORK_UNITS:
        _check_work(verdict, list(owns), role, branch)
    _check_exclusions(verdict)
    return verdict


def unit_cost_gb(unit: str, agents: int | None) -> float:
    if unit == "review":
        return (agents if agents is not None else REVIEW_DEFAULT_AGENTS) * 0.3 + 0.7
    return COSTS_GB.get(unit, 0.0)


def _check_machine(verdict: Verdict, agents: int | None) -> None:
    cost = unit_cost_gb(verdict.unit, agents)
    memory = read_memory()
    if memory is None:
        verdict.reasons.append("memory and swap unreadable (/proc/meminfo)")
    else:
        verdict.readings |= {
            "mem_available_gb": round(memory.available_gb, 1),
            "swap_used_gb": round(memory.swap_used_gb, 1),
        }
        after = memory.available_gb - cost
        if after < MEM_FLOOR_GB:
            verdict.reasons.append(
                f"memory: {memory.available_gb:.1f} GB available - {cost:.1f} GB for {verdict.unit}"
                f" = {after:.1f} GB, under the {MEM_FLOOR_GB} GB floor"
            )
        if memory.swap_used_gb > SWAP_REFUSE_GB:
            verdict.reasons.append(
                f"swap: {memory.swap_used_gb:.1f} GB used, over {SWAP_REFUSE_GB:.0f} GB"
            )
        elif memory.swap_used_gb > SWAP_WARN_GB:
            verdict.warnings.append(
                f"swap {memory.swap_used_gb:.1f} GB used, over {SWAP_WARN_GB:.0f} GB"
            )
    disk = read_disk_gb()
    if disk is None:
        verdict.reasons.append("disk free space unreadable (df -k --output=avail /)")
        return
    verdict.readings["disk_free_gb"] = round(disk, 1)
    if disk < DISK_REFUSE_GB:
        verdict.reasons.append(f"disk: {disk:.1f} GB free, under {DISK_REFUSE_GB:.0f} GB")
    elif disk < DISK_WARN_GB:
        verdict.warnings.append(f"disk {disk:.1f} GB free, under {DISK_WARN_GB:.0f} GB")


def _check_usage(
    verdict: Verdict,
    running: int,
    rate: float | None,
    hours: float | None,
    usage_checked: str | None,
) -> None:
    reading = read_usage()
    if reading.usage is None and usage_checked is not None:
        checked = parse_usage(usage_checked)
        if checked.usage is not None:
            verdict.usage_checked = True
        reading = UsageReading(checked.usage, reading.raw_lines + checked.raw_lines)
    if reading.usage is None:
        verdict.reasons.append("usage unreadable (the raw /usage lines follow)")
        verdict.raw_usage = reading.raw_lines
        return
    usage = reading.usage
    verdict.session_pct, verdict.week_pct = usage.session, usage.week
    if verdict.unit == "review":
        if usage.session >= DEGRADE_AT or usage.week >= DEGRADE_AT:
            verdict.degrade = True
        return
    if usage.session >= SESSION_HOLD:
        verdict.reasons.append(f"session usage {usage.session:g}% is at or over {SESSION_HOLD:g}%")
    if usage.week >= WEEK_HOLD:
        verdict.reasons.append(f"week usage {usage.week:g}% is at or over {WEEK_HOLD:g}%")
    if verdict.unit == "cloud-session":
        verdict.cap = cloud_cap(usage, rate, hours)
        if running >= verdict.cap:
            verdict.reasons.append(f"{running} cloud sessions running, the cap is {verdict.cap}")


def _released(prs: list[dict[str, Any]], open_branches: set[str]) -> dict[str, datetime | None]:
    """For each branch with no open PR and a merged or closed one: the creation time of its latest such
    PR, a record that started before it belongs to that PR and is released. None releases every record
    (a PR with no readable `createdAt`: the rule before `createdAt` was read)."""
    released: dict[str, datetime | None] = {}
    for row in prs:
        name = row["headRefName"]
        if row["state"] not in ("MERGED", "CLOSED") or name in open_branches:
            continue
        try:
            created: datetime | None = status.parse_utc(row["createdAt"])
        except START_ERRORS:
            created = None
        if name in released and released[name] is None:
            continue
        previous = released.get(name)
        released[name] = None if created is None else max(created, previous or created)
    return released


def _is_released(record: dict[str, Any], released: dict[str, datetime | None]) -> bool:
    if record["branch"] not in released:
        return False
    cutoff = released[record["branch"]]
    if cutoff is None:
        return True
    try:
        return status.parse_utc(record["started_at"]) < cutoff
    except START_ERRORS:
        return False


def _live_agents() -> Callable[[], set[str] | None]:
    """The names of the live agents, read once and only if asked; None when the list is unreadable."""
    cache: list[set[str] | None] = []

    def live() -> set[str] | None:
        if not cache:
            rows = read_agents()
            cache.append(
                None
                if rows is None
                else {str(row.get("name")) for row in rows if row.get("pid") is not None}
            )
        return cache[0]

    return live


def _check_work(
    verdict: Verdict, owns: list[str], role: str | None = None, branch: str | None = None
) -> None:
    """The WIP cap, the hot-file areas and the open PRs' files (S14-W1). A reviewer or refuter takes no
    new work; a launch on a branch that already holds a unit (an open PR or a builder) is not new
    work, so it meets neither the cap nor the PR or builder it would collide with: itself."""
    if role in NO_NEW_WORK_ROLES:
        return
    prs = read_prs()
    builders = read_builders()
    if builders is None:
        verdict.reasons.append("a launch record is unreadable")
        return
    if prs is None:
        if owns:
            verdict.reasons.append("the open PR list (gh pr list --state all) is unreadable")
            return
        # A launch that names no files keeps today's checks: only the cap sees less.
        verdict.readings["open_prs"] = "unreadable: WIP counts launch records only"
        prs = []
    open_prs = [row for row in prs if row["state"] == "OPEN"]
    open_branches = {row["headRefName"] for row in open_prs}
    released = _released(prs, open_branches)
    live_agents = _live_agents()
    aged: list[str] = []
    # One entry per unit of work: an open PR, or a launched builder with no open PR yet.
    units: list[dict[str, Any]] = [
        {
            "label": f"PR {row['number']}",
            "branch": row["headRefName"],
            "files": [f["path"] for f in row["files"]],
        }
        for row in open_prs
    ]
    counted = set(open_branches)
    for record in builders:
        name = record["branch"]
        if name in counted or _is_released(record, released):
            continue
        if (why := aged_out(record, live_agents)) is not None:
            aged.append(f"builder {name}: {why}")
            continue
        counted.add(name)
        owned = record.get("owns")
        units.append(
            {
                "label": f"builder {name}",
                "branch": name,
                "files": [p for p in owned if isinstance(p, str)] if isinstance(owned, list) else [],
            }
        )
    verdict.readings["wip"] = len(units)
    if aged:
        verdict.readings["aged_out"] = aged
    held = branch is not None and branch in counted
    if len(units) >= WIP_CAP and not held:
        names = ", ".join(unit["label"] for unit in units)
        verdict.reasons.append(f"WIP: {len(units)} builders in flight, the cap is {WIP_CAP} ({names})")
    if not owns:
        return
    others = [unit for unit in units if unit["branch"] != branch]
    holders = [
        row["number"]
        for row in open_prs
        if row["headRefName"] != branch
        and any(touches(path, owns) for path in (f["path"] for f in row["files"]))
    ]
    if holders:
        verdict.reasons.append(
            "an open PR changes files this launch owns: "
            + ", ".join(f"PR {number}" for number in holders)
        )
    areas = read_hot_areas()
    if areas is None:
        verdict.reasons.append("the hot-file list (scripts/factory/hot-files.json) is unreadable")
        return
    for area, entries in areas.items():
        if not any(touches(path, entries) for path in owns):
            continue
        busy = [unit["label"] for unit in others if any(touches(p, entries) for p in unit["files"])]
        if len(busy) >= AREA_CAP:
            verdict.reasons.append(
                f"hot-file area {area}: {len(busy)} open PRs or builders already hold it,"
                f" the most is {AREA_CAP} ({', '.join(busy)})"
            )


def _check_exclusions(verdict: Verdict) -> None:
    folder = status.factory_dir()
    for name, excluded, what in (
        ("g1.pid", G1_EXCLUDES, "a G1 walk"),
        ("rd.pid", RD_EXCLUDES, "a real-drawing run"),
    ):
        if verdict.unit not in excluded:
            continue
        path = folder / name
        if path.exists() and status.read_pidfile(path) is None:  # fail closed: unreadable is live
            verdict.reasons.append(f"{name} exists but names no pid; {what} may be running")
            continue
        pid = status.live_pid(path)
        if pid is not None:
            verdict.reasons.append(f"{what} is running ({name} names live pid {pid})")


def render(verdict: Verdict) -> list[str]:
    lines = [f"WARN {warning}" for warning in verdict.warnings]
    if verdict.degrade:
        lines.append("DEGRADE pr-reviewer-only")
    if verdict.ok:
        lines.append(f"OK {verdict.unit}")
    else:
        lines.append(f"REFUSED {verdict.unit}: {verdict.reason}")
        lines += [f"  {line}" for line in verdict.raw_usage]
    return lines


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.governor", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    one = sub.add_parser("check")
    one.add_argument("unit", choices=UNITS)
    one.add_argument("--json", action="store_true")
    one.add_argument("--usage-checked")
    one.add_argument("--running", type=int, default=0)
    one.add_argument("--agents", type=int)
    one.add_argument("--rate", type=float)
    one.add_argument("--hours-to-reset", type=float)
    one.add_argument("--owns", action="append", default=[], metavar="PATH")
    one.add_argument("--role")
    one.add_argument("--branch")
    args = parser.parse_args(argv)
    for option in ("running", "agents", "rate", "hours_to_reset"):
        value = getattr(args, option)
        if value is not None and value < 0:
            parser.error(f"--{option.replace('_', '-')} cannot be negative")
    if (args.rate is None) != (args.hours_to_reset is None):
        parser.error("--rate and --hours-to-reset go together")
    verdict = check(
        args.unit,
        running=args.running,
        agents=args.agents,
        rate=args.rate,
        hours_to_reset=args.hours_to_reset,
        usage_checked=args.usage_checked,
        owns=args.owns,
        role=args.role,
        branch=args.branch,
    )
    if args.json:
        print(json.dumps(verdict.as_json()))
    else:
        print("\n".join(render(verdict)))
    sys.stdout.flush()
    return 0 if verdict.ok else 3


if __name__ == "__main__":
    raise SystemExit(main())
