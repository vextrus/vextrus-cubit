"""S14-K1 fix round 1 (PR #510): with the WIP cap gone, the cloud cap of 16 must be enforced on the
launch path itself. `launch.default_govern` passes no `--running`, so the governor counts the running
cloud sessions from the units it already reads: live cloud launch records of any role, and open PRs whose
builder record is cloud and not ended."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from scripts.factory import governor, launch

NOW = "2026-10-06T10:00:00Z"
STARTED = "2026-10-06T09:30:00Z"
HEALTHY = {
    "VEXTRUS_USAGE_FILE": "Current session: 12% used\nCurrent week (all models): 27% used\n",
    "VEXTRUS_AGENTS_FILE": "[]",
    "VEXTRUS_MEMINFO_FILE": "MemAvailable: 20971520 kB\nSwapTotal: 8388608 kB\nSwapFree: 8388608 kB\n",
    "VEXTRUS_DF_FILE": "Avail\n104857600\n",
}


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    for name, text in HEALTHY.items():
        seam = tmp_path / name
        seam.write_text(text)
        monkeypatch.setenv(name, str(seam))
    (tmp_path / "factory" / "launches").mkdir(parents=True)
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(tmp_path / "factory"))
    monkeypatch.setenv("VEXTRUS_NOW", NOW)
    prs(tmp_path, monkeypatch, [])
    return tmp_path


def prs(world: Path, monkeypatch: pytest.MonkeyPatch, rows: list[dict[str, object]]) -> None:
    seam = world / "prs.json"
    seam.write_text(json.dumps(rows))
    monkeypatch.setenv("VEXTRUS_PRS_FILE", str(seam))


def cloud_record(world: Path, name: str, **fields: object) -> None:
    body = {
        "ticket": name,
        "branch": name,
        "where": "cloud",
        "role": "builder",
        "judge": {"ok": True},
        "started_at": STARTED,
        "budget_minutes": 30,
    }
    (world / "factory" / "launches" / f"{name}.json").write_text(json.dumps(body | fields))


def open_pr(number: int, branch: str) -> dict[str, object]:
    return {
        "number": number,
        "headRefName": branch,
        "state": "OPEN",
        "files": [{"path": f"x/{number}.py"}],
    }


def through_the_launcher(world: Path, branch: str = "new", role: str | None = None) -> launch.Reading:
    govern = launch.default_govern(Path.cwd(), None, (), role, branch)
    assert govern is not None
    return govern()


def test_sixteen_live_cloud_builders_refuse_a_launch_on_a_new_branch(world: Path) -> None:
    for n in range(16):
        cloud_record(world, f"b{n:02d}")
    reading = through_the_launcher(world)
    assert not reading.ok
    assert "16 cloud sessions running, the cap is 16" in reading.text


def test_fifteen_live_cloud_builders_allow_one_more(world: Path) -> None:
    for n in range(15):
        cloud_record(world, f"b{n:02d}")
    assert through_the_launcher(world).ok


def test_any_role_counts_and_a_reviewer_is_refused_at_the_cap(world: Path) -> None:
    for n in range(8):
        cloud_record(world, f"b{n:02d}")
    for n in range(4):
        cloud_record(world, f"w{n}", role="acceptance-writer")
    for n in range(4):
        cloud_record(world, f"r{n}", role="reviewer", review=100 + n)
    assert "16 cloud sessions running" in through_the_launcher(world, role="reviewer").text


def test_local_records_and_unjudged_cloud_records_are_no_cloud_session(world: Path) -> None:
    for n in range(10):
        cloud_record(world, f"l{n}", where="local")
    for n in range(10):
        cloud_record(world, f"j{n}", judge={"ok": False})
    for n in range(10):
        cloud_record(world, f"s{n}", stop_sent=True)
    assert through_the_launcher(world).ok


def test_open_prs_whose_builders_have_ended_do_not_count(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # sixteen open PRs: none has a live cloud builder record (stopped, aged out, or never recorded)
    rows = [open_pr(n, f"p{n:02d}") for n in range(16)]
    prs(world, monkeypatch, rows)
    for n in range(4):
        cloud_record(world, f"p{n:02d}", stop_sent=True)
    for n in range(4, 8):
        cloud_record(world, f"p{n:02d}", started_at="2026-10-01T08:00:00Z")  # aged out
    assert through_the_launcher(world).ok


def test_a_merged_pr_releases_its_builder_but_an_open_one_keeps_it(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    rows = [open_pr(n, f"p{n:02d}") for n in range(8)]
    rows += [
        {
            "number": 100 + n,
            "headRefName": f"m{n:02d}",
            "state": "MERGED",
            "files": [],
            "mergedAt": "2026-10-06T09:45:00Z",
        }
        for n in range(8)
    ]
    prs(world, monkeypatch, rows)
    for n in range(8):
        cloud_record(world, f"p{n:02d}")
        cloud_record(world, f"m{n:02d}")
    verdict = governor.check("cloud-session", branch="new")
    assert verdict.readings["cloud_running"] == 8, verdict.readings
    assert verdict.ok


def test_a_fix_round_on_a_branch_replaces_its_predecessor(world: Path) -> None:
    for n in range(15):
        cloud_record(world, f"b{n:02d}")
    cloud_record(world, "fix", branch="b00", started_at="2026-10-06T09:50:00Z")
    verdict = governor.check("cloud-session", branch="new")
    assert verdict.readings["cloud_running"] == 15
    assert governor.check("cloud-session", branch="b00").readings["cloud_running"] == 14


def test_an_explicit_running_still_applies(world: Path) -> None:
    assert not governor.check("cloud-session", running=16).ok
    assert governor.check("cloud-session", running=15).ok


def test_a_pending_cloud_launch_counts_while_its_launcher_lives(world: Path) -> None:
    for n in range(15):
        cloud_record(world, f"b{n:02d}")
    assert governor.admit("cloud-session", hold=os.getpid(), ticket="a", branch="na").ok
    refused = governor.admit("cloud-session", hold=os.getpid(), ticket="b", branch="nb")
    assert not refused.ok
    assert "16 cloud sessions running, the cap is 16" in (refused.reason or "")
