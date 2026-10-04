"""The governor: may this machine and this account take one more unit of work now?

    python -m scripts.factory.governor check <unit> [--json] [--usage-checked "<lines>"]
        [--running N] [--agents N] [--rate R --hours-to-reset H]

Units and their memory cost (spec 2.3): `cloud-session` (none: the cloud VM is not this machine, so
memory, swap and disk are not read), `local-agent` 0.9, `review` (`--agents` x 0.3 + 0.7; default 8
agents), `pytest` 3.3, `web-tests` 9.5, `walk` 5.6, `rd-run` 3.0.

Floors, every local unit: `MemAvailable - cost >= 5.4`; swap used above 2 refuses, above 1 warns;
disk free (`df -k --output=avail /`) under 30 refuses, under 40 warns (the spec names no disk cost per
unit, so it is 0); at most 3 local agents (`claude agents --json --all` rows with a `pid` and a `kind`
other than `interactive`) for `local-agent`. A live `g1.pid` (the G1 walk) refuses `web-tests`,
`pytest` and `walk`; a live `rd.pid` (a real-drawing run) refuses `web-tests` and `rd-run`.

Usage (`cloud-session`, `local-agent`, `review`): only `Current session: N% used` and `Current week (all
models): N% used` are read (any other line, the per-model week lines among them, is ignored). A new
launch is refused at session >= 80 or week >= 85; `review` is never held but prints `DEGRADE
pr-reviewer-only` at session or week >= 90. Cloud sessions are capped: 8 while session < 50 and week
< 70, else 4; with `--rate` (measured % per builder-hour) and `--hours-to-reset`, `min(16, floor((80 -
session) / (rate x hours)))`. `--running N` (sessions running now) is refused at or above the cap.

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
import json
import math
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
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
SESSION_HOLD = 80.0
WEEK_HOLD = 85.0
DEGRADE_AT = 90.0
CAP_HIGH, CAP_LOW, CAP_MAX = 8, 4, 16
REVIEW_DEFAULT_AGENTS = 8

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
    except OSError, subprocess.SubprocessError:
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
    return CAP_HIGH if usage.session < 50 and usage.week < 70 else CAP_LOW


def check(
    unit: str,
    *,
    running: int = 0,
    agents: int | None = None,
    rate: float | None = None,
    hours_to_reset: float | None = None,
    usage_checked: str | None = None,
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


def _check_exclusions(verdict: Verdict) -> None:
    folder = status.factory_dir()
    for name, excluded, what in (
        ("g1.pid", G1_EXCLUDES, "a G1 walk"),
        ("rd.pid", RD_EXCLUDES, "a real-drawing run"),
    ):
        if verdict.unit not in excluded:
            continue
        pid = status.live_pid(folder / name)
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
    args = parser.parse_args(argv)
    if (args.rate is None) != (args.hours_to_reset is None):
        parser.error("--rate and --hours-to-reset go together")
    verdict = check(
        args.unit,
        running=args.running,
        agents=args.agents,
        rate=args.rate,
        hours_to_reset=args.hours_to_reset,
        usage_checked=args.usage_checked,
    )
    if args.json:
        print(json.dumps(verdict.as_json()))
    else:
        print("\n".join(render(verdict)))
    sys.stdout.flush()
    return 0 if verdict.ok else 3


if __name__ == "__main__":
    raise SystemExit(main())
