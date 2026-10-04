"""Ticket f3, 3.1: the governor (`python -m scripts.factory.governor check <unit>`), spec 2.2 "Preflight"
and 2.3.

Black-box: each test runs the module as a subprocess with `PYTHONPATH=<repo root>` and drives it only
through the ticket's seams: `VEXTRUS_MEMINFO_FILE` (a `/proc/meminfo` copy), `VEXTRUS_DF_FILE` (the
stdout of `df -k --output=avail /`), `VEXTRUS_USAGE_FILE` (the stdout of `claude -p "/usage"
--output-format json`, or its plain text), `VEXTRUS_AGENTS_FILE` (the stdout of `claude agents --json
--all`), `VEXTRUS_FACTORY_DIR` (the run folder holding `g1.pid` and `rd.pid`) and `VEXTRUS_NOW`. A
`claude` stub first on `PATH` records any call and fails, so a governor that ignored a seam would show
it.

Output: stdout `OK <unit>` or `REFUSED <unit>: <reason>`, `WARN ...` and `DEGRADE pr-reviewer-only`
lines; exit 0, 3 refused, 2 usage error; `--json` prints one JSON object instead.

Sizes: the fixtures write `/proc/meminfo` in kB and `df` in 1K blocks as whole GiB. Every boundary here
holds whether the builder reads "GB" as 1024^3 or 10^9 bytes (the ticket's 14 GB and 8 GB examples did
not, so they became 13 GB and 7 GB, 1 GB or more from the floor either way).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-04T21:08:00Z"
KB_PER_GB = 1024 * 1024
DROPPED = {"CLAUDE_PROJECT_DIR", "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS", "CLAUDE_CODE_PLUGIN_DIRS"}

SESSION_LINE = "Current session: {s}% used · resets Oct 5, 12:59am (Asia/Dhaka)"
WEEK_LINE = "Current week (all models): {w}% used · resets Oct 9, 2:59pm (Asia/Dhaka)"
FABLE_LINE = "Current week (Fable): 0% used · resets Oct 9, 2:59pm (Asia/Dhaka)"
LOCAL_UNITS = ["local-agent", "review", "pytest", "web-tests", "walk", "rd-run"]


def usage_text(session: int, week: int) -> str:
    return "\n".join([SESSION_LINE.format(s=session), WEEK_LINE.format(w=week), FABLE_LINE]) + "\n"


def usage_json(session: int, week: int) -> str:
    """The shape of `claude -p "/usage" --output-format json`: the text is in `.result`."""
    return json.dumps(
        {
            "type": "result",
            "subtype": "success",
            "is_error": False,
            "result": usage_text(session, week),
            "session_id": "00000000-0000-4000-8000-000000000000",
        }
    )


def meminfo(avail_gb: float, swap_used_gb: float = 0.2, swap_total_gb: float = 8.0) -> str:
    def kb(gb: float) -> int:
        return int(gb * KB_PER_GB)

    return (
        f"MemTotal:       {kb(27)} kB\n"
        f"MemFree:        {kb(1)} kB\n"
        f"MemAvailable:   {kb(avail_gb)} kB\n"
        "Buffers:          204800 kB\n"
        "Cached:          4194304 kB\n"
        f"SwapTotal:      {kb(swap_total_gb)} kB\n"
        f"SwapFree:       {kb(swap_total_gb - swap_used_gb)} kB\n"
    )


def df(avail_gb: float) -> str:
    return f"    Avail\n{int(avail_gb * KB_PER_GB)}\n"


def agent_row(name: str, state: str, *, pid: int | None, kind: str = "background") -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": name[:8],
        "cwd": "/work/" + name,
        "kind": kind,
        "startedAt": "2026-10-04T20:00:00Z",
        "sessionId": str(uuid.uuid5(uuid.NAMESPACE_URL, name)),
        "name": name,
        "state": state,
    }
    if pid is not None:
        row["pid"] = pid
    return row


class Governor:
    """The governor's world: fixture files behind the seams and a `claude` stub that must never run."""

    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.factory = tmp / "factory"
        self.factory.mkdir()
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.claude_log = tmp / "claude-calls.log"
        stub = self.stubs / "claude"
        stub.write_text(
            f"#!{sys.executable}\nimport sys\n"
            f"open({str(self.claude_log)!r}, 'a').write(repr(sys.argv[1:]) + '\\n')\nsys.exit(1)\n"
        )
        stub.chmod(0o755)
        self._mem, self._swap = 20.0, 0.2
        self.files = {name: tmp / name for name in ("meminfo", "df", "usage", "agents")}
        self.set(mem=20, swap=0.2, disk=100, usage=usage_json(12, 27), agents=[])

    def set(
        self,
        *,
        mem: float | None = None,
        swap: float | None = None,
        disk: float | None = None,
        usage: str | None = None,
        agents: list[dict[str, Any]] | None = None,
        meminfo_text: str | None = None,
        df_text: str | None = None,
    ) -> None:
        if mem is not None or swap is not None:
            self._mem = mem if mem is not None else self._mem
            self._swap = swap if swap is not None else self._swap
            self.files["meminfo"].write_text(meminfo(self._mem, self._swap))
        if meminfo_text is not None:
            self.files["meminfo"].write_text(meminfo_text)
        if disk is not None:
            self.files["df"].write_text(df(disk))
        if df_text is not None:
            self.files["df"].write_text(df_text)
        if usage is not None:
            self.files["usage"].write_text(usage)
        if agents is not None:
            self.files["agents"].write_text(json.dumps(agents))

    def env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_") and k not in DROPPED}
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_NOW=NOW,
            VEXTRUS_MEMINFO_FILE=str(self.files["meminfo"]),
            VEXTRUS_DF_FILE=str(self.files["df"]),
            VEXTRUS_USAGE_FILE=str(self.files["usage"]),
            VEXTRUS_AGENTS_FILE=str(self.files["agents"]),
        )
        return env

    def check(self, unit: str, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.governor", "check", unit, *args],
            cwd=self.tmp,
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


def assert_refused(done: subprocess.CompletedProcess[str], unit: str, *words: str) -> None:
    assert done.returncode == 3, show(done)
    lines = [line for line in done.stdout.splitlines() if line.startswith(f"REFUSED {unit}: ")]
    assert lines, show(done)
    for word in words:
        assert word in done.stdout.lower(), f"the reason should name {word!r}\n{show(done)}"


def warn_lines(done: subprocess.CompletedProcess[str]) -> list[str]:
    return [line for line in done.stdout.splitlines() if line.startswith("WARN")]


@pytest.fixture
def gov(tmp_path: Path) -> Governor:
    return Governor(tmp_path)


def dead_pid() -> int:
    finished = subprocess.Popen(["true"])
    finished.wait()
    return finished.pid


# G1
def test_g1_the_memory_floor_counts_each_units_cost(gov: Governor) -> None:
    gov.set(mem=16)
    assert_ok(gov.check("web-tests"), "web-tests")

    gov.set(mem=13)
    assert_refused(gov.check("web-tests"), "web-tests", "mem")
    assert_ok(gov.check("pytest"), "pytest")

    gov.set(mem=7)
    for unit in ("pytest", "walk", "rd-run"):
        assert_refused(gov.check(unit), unit, "mem")

    gov.set(mem=10)
    assert_ok(gov.check("review", "--agents", "8"), "review")
    gov.set(mem=7)
    assert_refused(gov.check("review", "--agents", "8"), "review", "mem")
    assert not gov.claude_log.exists(), "the governor ran `claude` although every reading had a seam"


# G2
def test_g2_swap_refuses_above_2_gb_and_warns_above_1_gb(gov: Governor) -> None:
    gov.set(mem=20, swap=2.5)
    assert_refused(gov.check("pytest"), "pytest", "swap")

    gov.set(swap=1.5)
    done = gov.check("pytest")
    assert_ok(done, "pytest")
    assert any("swap" in line.lower() for line in warn_lines(done)), show(done)

    gov.set(swap=0.2)
    done = gov.check("pytest")
    assert_ok(done, "pytest")
    assert warn_lines(done) == [], show(done)


# G3
def test_g3_disk_refuses_under_30_gb_after_the_unit_and_warns_under_40(gov: Governor) -> None:
    gov.set(disk=25)
    assert_refused(gov.check("local-agent"), "local-agent", "disk")

    gov.set(disk=35)
    done = gov.check("local-agent")
    assert_ok(done, "local-agent")
    assert any("disk" in line.lower() for line in warn_lines(done)), show(done)

    gov.set(disk=60)
    done = gov.check("local-agent")
    assert_ok(done, "local-agent")
    assert warn_lines(done) == [], show(done)


# G4
@pytest.mark.parametrize("unit", ["cloud-session", "local-agent"])
def test_g4_usage_holds_new_launches_at_80_session_or_85_week(gov: Governor, unit: str) -> None:
    gov.set(usage=usage_json(85, 27))
    assert_refused(gov.check(unit), unit, "session")
    gov.set(usage=usage_json(12, 90))
    assert_refused(gov.check(unit), unit, "week")
    gov.set(usage=usage_json(12, 27))
    assert_ok(gov.check(unit), unit)


def test_g4_the_cloud_cap_starts_at_8_when_usage_is_low_else_4(gov: Governor) -> None:
    for session, week in ((55, 20), (20, 75)):
        gov.set(usage=usage_json(session, week))
        assert_refused(gov.check("cloud-session", "--running", "4"), "cloud-session")
        assert_ok(gov.check("cloud-session", "--running", "3"), "cloud-session")

    gov.set(usage=usage_json(12, 27))
    assert_refused(gov.check("cloud-session", "--running", "8"), "cloud-session")
    assert_ok(gov.check("cloud-session", "--running", "7"), "cloud-session")


# G5
UNREADABLE = {
    "empty": "",
    "unknown": "Current session: unknown\n" + WEEK_LINE.format(w=27) + "\n",
    "session-only": SESSION_LINE.format(s=12) + "\n",
    "fable-week-only": SESSION_LINE.format(s=12) + "\n" + FABLE_LINE + "\n",
}


@pytest.mark.parametrize("unit", ["cloud-session", "local-agent", "review"])
@pytest.mark.parametrize("case", sorted(UNREADABLE))
def test_g5_unreadable_usage_fails_closed_and_prints_the_raw_lines(
    gov: Governor, unit: str, case: str
) -> None:
    text = UNREADABLE[case]
    gov.set(usage=text)
    args = ("--agents", "2") if unit == "review" else ()
    done = gov.check(unit, *args)
    assert_refused(done, unit)
    for line in text.splitlines():
        assert line in done.stdout, f"the raw line {line!r} was not printed\n{show(done)}"


# G6
def test_g6_usage_checked_lines_replace_an_unreadable_reading_and_are_recorded(gov: Governor) -> None:
    gov.set(usage="")
    checked = SESSION_LINE.format(s=12) + "\n" + WEEK_LINE.format(w=27)
    done = gov.check("cloud-session", "--usage-checked", checked, "--json")
    assert done.returncode == 0, show(done)
    reading = json.loads(done.stdout)
    assert reading["ok"] is True
    assert reading["usage_checked"] is True

    done = gov.check("cloud-session", "--usage-checked", "all fine, trust me")
    assert_refused(done, "cloud-session")


# G7
@pytest.mark.parametrize("unit", LOCAL_UNITS)
@pytest.mark.parametrize(
    ("which", "text"),
    [
        ("meminfo", ""),
        ("meminfo", "MemTotal: lots\nMemAvailable: plenty kB\n"),
        ("df", ""),
        ("df", "df: /: No such file or directory\n"),
    ],
)
def test_g7_an_unreadable_meminfo_or_df_refuses_every_local_unit(
    gov: Governor, unit: str, which: str, text: str
) -> None:
    gov.set(mem=64, disk=500)
    if which == "meminfo":
        gov.set(meminfo_text=text)
    else:
        gov.set(df_text=text)
    args = ("--agents", "2") if unit == "review" else ()
    assert_refused(gov.check(unit, *args), unit)


# G8
def test_g8_at_most_three_local_agents_counting_rows_with_a_pid_that_are_not_interactive(
    gov: Governor,
) -> None:
    three = [agent_row(f"builder-{i}", "working", pid=4100 + i) for i in range(3)]
    gov.set(agents=three)
    assert_refused(gov.check("local-agent"), "local-agent")

    mixed = [
        agent_row("alive-1", "working", pid=4201),
        agent_row("alive-2", "blocked", pid=4202),
        *(agent_row(f"done-{i}", "done", pid=None) for i in range(5)),
        agent_row("the-orchestrator", "working", pid=4300, kind="interactive"),
    ]
    gov.set(agents=mixed)
    assert_ok(gov.check("local-agent"), "local-agent")


# G9
def test_g9_a_live_g1_walk_or_real_drawing_run_excludes_the_units_it_would_starve(gov: Governor) -> None:
    gov.set(mem=64, disk=500)
    live, dead = str(os.getpid()), str(dead_pid())
    g1, rd = gov.factory / "g1.pid", gov.factory / "rd.pid"

    for pidfile in (g1, rd):
        pidfile.write_text(live + "\n")
        assert_refused(gov.check("web-tests"), "web-tests")
        pidfile.write_text(dead + "\n")
        assert_ok(gov.check("web-tests"), "web-tests")
        pidfile.unlink()

    g1.write_text(live + "\n")
    assert_refused(gov.check("pytest"), "pytest")
    assert_refused(gov.check("walk"), "walk")
    g1.unlink()

    rd.write_text(live + "\n")
    assert_refused(gov.check("rd-run"), "rd-run")
    rd.write_text(dead + "\n")
    assert_ok(gov.check("rd-run"), "rd-run")


# G10 (tier 2 inside f3, cut 4)
def test_g10_the_ramp_caps_cloud_sessions_from_the_measured_rate(gov: Governor) -> None:
    gov.set(usage=usage_json(20, 27))
    ramp = ("--rate", "1.5", "--hours-to-reset", "3")
    done = gov.check("cloud-session", "--running", "12", *ramp, "--json")
    assert done.returncode == 0, show(done)
    assert json.loads(done.stdout)["cap"] == 13  # floor((80 - 20) / (1.5 * 3))
    assert_refused(gov.check("cloud-session", "--running", "13", *ramp), "cloud-session")

    slow = ("--rate", "0.1", "--hours-to-reset", "3")
    done = gov.check("cloud-session", "--running", "15", *slow, "--json")
    assert done.returncode == 0, show(done)
    assert json.loads(done.stdout)["cap"] == 16
    assert_refused(gov.check("cloud-session", "--running", "16", *slow), "cloud-session")


# G11
def test_g11_review_degrades_to_pr_reviewer_only_at_90_percent(gov: Governor) -> None:
    gov.set(usage=usage_json(92, 27))
    done = gov.check("review", "--agents", "8")
    assert done.returncode == 0, show(done)
    assert "DEGRADE pr-reviewer-only" in done.stdout.splitlines(), show(done)

    gov.set(usage=usage_json(40, 27))
    done = gov.check("review", "--agents", "8")
    assert_ok(done, "review")
    assert "DEGRADE" not in done.stdout, show(done)

    gov.set(usage="Current session: ?\n")
    assert_refused(gov.check("review", "--agents", "8"), "review")


# G12
def test_g12_json_carries_the_reading_the_launch_record_embeds(gov: Governor) -> None:
    done = gov.check("cloud-session", "--json")
    assert done.returncode == 0, show(done)
    reading = json.loads(done.stdout)
    assert {"unit", "ok", "reason", "warnings", "session_pct", "week_pct", "cap"} <= set(reading)
    assert reading["unit"] == "cloud-session"
    assert reading["session_pct"] == 12
    assert reading["week_pct"] == 27

    gov.set(mem=13)
    done = gov.check("web-tests", "--json")
    assert done.returncode == 3, show(done)
    refused = json.loads(done.stdout)
    assert refused["ok"] is False
    assert refused["reason"]

    usage_error = gov.check("no-such-unit")
    assert usage_error.returncode == 2, show(usage_error)
