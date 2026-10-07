"""PR #477 review round 1: two launches at once must not both pass a hot-file area's cap (S14-K1: the
PR-count WIP cap is gone; the area cap of 3 is what two racing launches could both slip past).
The governor's `admit` checks and writes a pending record under one `flock`; the pending record counts
at once, while its launcher's pid lives, and both launchers remove it when their launch ends, failed or
not."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import governor, launch, local, status
from scripts.factory.launch import Reading, ScanResult, launch_cloud
from scripts.factory.tests.test_launch_round1 import BRANCH, Fake, log, main, request

__all__ = ["main"]  # the main checkout fixture, imported for the launcher's tests

HEALTHY = {
    "VEXTRUS_MEMINFO_FILE": "MemAvailable: 20971520 kB\nSwapTotal: 8388608 kB\nSwapFree: 8388608 kB\n",
    "VEXTRUS_DF_FILE": "Avail\n104857600\n",
    "VEXTRUS_USAGE_FILE": "Current session: 12% used\nCurrent week (all models): 27% used\n",
    "VEXTRUS_AGENTS_FILE": "[]",
}
FOUR = [
    {"number": n, "headRefName": f"t{n}", "state": "OPEN", "files": [{"path": f"x/{n}.py"}]}
    for n in range(1, 5)
]


@pytest.fixture
def factory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    for name, text in HEALTHY.items():
        seam = tmp_path / name
        seam.write_text(text)
        monkeypatch.setenv(name, str(seam))
    (tmp_path / "prs.json").write_text(json.dumps(FOUR))
    monkeypatch.setenv("VEXTRUS_PRS_FILE", str(tmp_path / "prs.json"))
    folder = tmp_path / "factory"
    (folder / "launches").mkdir(parents=True)
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(folder))
    return folder


@pytest.fixture
def area(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """The area `x` holds PR 1 and PR 2; a launch owning `x/9.py` would be the third."""
    hot = tmp_path / "hot.json"
    hot.write_text(json.dumps({"areas": {"x": ["x/1.py", "x/2.py", "x/9.py"]}}))
    monkeypatch.setattr(governor, "HOT_FILES", hot)


def wip() -> int:
    return int(governor.check("cloud-session").readings["wip"])


def test_two_launches_at_once_with_two_in_an_area_exactly_one_passes(
    factory: Path, monkeypatch: pytest.MonkeyPatch, area: None
) -> None:
    # Both read the PR list together and slowly (a real `gh` call takes seconds), so without the
    # lock both would read two in the area and pass.
    barrier = threading.Barrier(2)
    reading = governor.read_prs

    def slow_prs() -> list[dict[str, Any]] | None:
        rows = reading()
        threading.Event().wait(0.5)
        return rows

    monkeypatch.setattr(governor, "read_prs", slow_prs)
    verdicts: dict[str, governor.Verdict] = {}

    def launch_one(ticket: str) -> None:
        barrier.wait()
        verdicts[ticket] = governor.admit(
            "cloud-session",
            hold=os.getpid(),
            ticket=ticket,
            branch=f"new-{ticket}",
            owns=["x/9.py"],
        )

    threads = [threading.Thread(target=launch_one, args=(t,)) for t in ("a", "b")]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    passed = [t for t, v in verdicts.items() if v.ok]
    refused = [v for v in verdicts.values() if not v.ok]
    assert len(passed) == 1, {t: v.reason for t, v in verdicts.items()}
    assert "hot-file area x: 3 open PRs or builders already hold it" in (refused[0].reason or "")
    assert f"builder new-{passed[0]}" in (refused[0].reason or "")
    assert wip() == 5  # the pending record counts at once


def test_the_pending_record_holds_the_hot_file_area(
    factory: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    hot = tmp_path / "hot.json"
    hot.write_text(json.dumps({"areas": {"step1": ["vextrus/s.py"]}}))
    monkeypatch.setattr(governor, "HOT_FILES", hot)
    (tmp_path / "prs.json").write_text(json.dumps([]))
    for ticket in ("a", "b", "c"):
        verdict = governor.admit(
            "cloud-session", hold=os.getpid(), ticket=ticket, branch=ticket, owns=["vextrus/s.py"]
        )
        assert verdict.ok, verdict.reason
    fourth = governor.check("cloud-session", owns=["vextrus/s.py"], branch="d")
    assert "hot-file area step1" in (fourth.reason or "")


def test_a_pending_record_counts_only_while_its_launcher_lives(factory: Path) -> None:
    assert governor.admit("cloud-session", hold=os.getpid(), ticket="a", branch="na").ok
    assert wip() == 5
    governor.release_hold("a", os.getpid())
    assert wip() == 4
    dead = subprocess.run([sys.executable, "-c", "import os; print(os.getpid())"], capture_output=True)
    pid = int(dead.stdout)
    assert governor.admit("cloud-session", hold=pid, ticket="b", branch="nb").ok
    assert (factory / "pending" / f"b-{pid}.json").is_file()
    assert wip() == 4  # its launcher is gone: it ages out


@pytest.mark.parametrize("role", ["reviewer", "refuter", "acceptance-writer"])
def test_a_launch_whose_record_would_not_count_writes_no_pending_record(
    factory: Path, role: str
) -> None:
    governor.admit("cloud-session", hold=os.getpid(), ticket="a", branch="na", role=role)
    assert not (factory / "pending").exists() or not list((factory / "pending").iterdir())


def test_the_cli_admits_with_hold_and_ticket(factory: Path) -> None:
    said = subprocess.run(
        [
            *(sys.executable, "-m", "scripts.factory.governor", "check", "cloud-session"),
            *("--hold", str(os.getpid()), "--ticket", "a", "--branch", "na", "--budget-minutes", "30"),
        ],
        capture_output=True,
        text=True,
        check=False,
        env=os.environ,
    )
    assert said.stdout.strip() == "OK cloud-session", said.stdout + said.stderr
    record = json.loads((factory / "pending" / f"a-{os.getpid()}.json").read_text())
    assert record["branch"] == "na"
    assert record["budget_minutes"] == 30
    assert wip() == 5
    second = governor.main(["check", "cloud-session", "--running", "16", "--hold", "1", "--ticket", "b"])
    assert second == 3
    with pytest.raises(SystemExit):
        governor.main(["check", "cloud-session", "--hold", "1"])


def test_the_launcher_admits_through_the_governor(tmp_path: Path) -> None:
    root = tmp_path
    (root / "scripts" / "factory").mkdir(parents=True)
    (root / "scripts" / "factory" / "governor.py").write_text(
        "import sys\nprint(' '.join(sys.argv[1:]))\n"
    )
    govern = launch.default_govern(root, None, (), None, "t1", hold=("T1", 4242, 30))
    assert govern is not None
    assert "--hold 4242 --ticket T1 --budget-minutes 30" in govern().text


def admitting() -> Reading:
    verdict = governor.admit("cloud-session", hold=os.getpid(), ticket="z1", branch=BRANCH)
    return Reading(verdict.ok, verdict.reason or "OK cloud-session")


def cloud(tmp_path: Path, main: Path, fake: Fake, factory: Path) -> launch.Outcome:
    return launch_cloud(
        request(tmp_path, record_dir=factory / "launches"),
        root=main,
        claude=fake,
        scan=lambda _: ScanResult(True, "hits=0"),
        govern=admitting,
        snapshot=lambda: "{}",
        now=lambda: datetime(2026, 10, 5, 1, 2, 3, tzinfo=UTC),
    )


def test_a_failed_cloud_launch_leaves_no_counted_record(
    tmp_path: Path, main: Path, factory: Path
) -> None:
    outcome = cloud(tmp_path, main, Fake(text=log(session=None)), factory)
    assert outcome.exit_code != 0
    assert not list((factory / "pending").glob("*.json"))
    assert wip() == 4


def test_a_cloud_launch_that_raises_leaves_no_pending_record(
    tmp_path: Path, main: Path, factory: Path
) -> None:
    def broken(argv: list[str]) -> int:
        assert list((factory / "pending").glob("*.json")), "admitted: pending while it runs"
        raise RuntimeError("the runner broke")

    with pytest.raises(RuntimeError):
        cloud(tmp_path, main, broken, factory)  # type: ignore[arg-type]
    assert not list((factory / "pending").glob("*.json"))
    assert wip() == 4


def test_a_good_cloud_launch_hands_its_place_to_its_launch_record(
    tmp_path: Path, main: Path, factory: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-05T01:10:00Z")  # the record's start, 8 min ago
    assert cloud(tmp_path, main, Fake(), factory).exit_code == 0
    assert not list((factory / "pending").glob("*.json"))
    verdict = governor.check("cloud-session")
    assert verdict.readings["wip"] == 5
    assert any(f"builder {BRANCH}" in line for line in verdict.readings["counted"])


def test_a_failed_local_launch_leaves_no_pending_record(
    factory: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    seen: list[int] = []

    def no_checkout() -> None:
        seen.append(wip())  # admitted: its pending record counts while it runs

    monkeypatch.setattr(status, "main_checkout", no_checkout)
    prompt = tmp_path / "p.md"
    prompt.write_text("brief\n")
    argv = ["--ticket", "L1", "--branch", "lb", "--effort", "high", "--name", "n"]
    assert local.main([*argv, "--prompt-file", str(prompt)]) == 1
    assert seen == [5]
    assert not list((factory / "pending").glob("*.json"))
    assert wip() == 4
