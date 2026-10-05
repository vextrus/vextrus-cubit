"""Unit tests of the governor's work-in-flight rules (S14-W1) that the acceptance tests do not reach:
globs, a builder's recorded `owns` holding an area, the PR list's shape, and the `--owns` wiring."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.factory import governor, launch, local

HEALTHY = {
    "VEXTRUS_MEMINFO_FILE": "MemAvailable: 20971520 kB\nSwapTotal: 8388608 kB\nSwapFree: 8388608 kB\n",
    "VEXTRUS_DF_FILE": "Avail\n104857600\n",
    "VEXTRUS_USAGE_FILE": "Current session: 12% used\nCurrent week (all models): 27% used\n",
    "VEXTRUS_AGENTS_FILE": "[]",
}


CLOUD = ["--branch", "b", "--prompt-file", "p", "--ticket", "T1", "--effort", "high"]
LOCAL = ["--ticket", "T1", "--branch", "b", "--effort", "high", "--name", "n", "--prompt-file", "p"]


def pr(number: int, branch: str, *paths: str, state: str = "OPEN") -> dict[str, object]:
    return {
        "number": number,
        "headRefName": branch,
        "state": state,
        "files": [{"path": p, "additions": 1, "deletions": 0} for p in paths],
    }


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    for name, text in HEALTHY.items():
        seam = tmp_path / name
        seam.write_text(text)
        monkeypatch.setenv(name, str(seam))
    factory = tmp_path / "factory"
    (factory / "launches").mkdir(parents=True)
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(factory))
    monkeypatch.setattr(
        governor, "HOT_FILES", tmp_path / "hot.json"
    )  # the tests' own list, not the committed one
    (tmp_path / "hot.json").write_text(json.dumps({"areas": {"web-en": ["web/src/*en.po"]}}))
    return tmp_path


def prs(world: Path, monkeypatch: pytest.MonkeyPatch, rows: list[dict[str, object]] | str) -> None:
    seam = world / "prs.json"
    seam.write_text(rows if isinstance(rows, str) else json.dumps(rows))
    monkeypatch.setenv("VEXTRUS_PRS_FILE", str(seam))


def record(world: Path, name: str, **fields: object) -> None:
    body = {"ticket": name, "branch": name, "where": "local", "role": "builder", "judge": None}
    (world / "factory" / "launches" / f"{name}-20261006T080000Z.json").write_text(
        json.dumps(body | fields)
    )


def test_a_glob_entry_covers_the_files_it_matches(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    prs(
        world,
        monkeypatch,
        [pr(1, "a", "web/src/ui/locales/en.po"), pr(2, "b", "web/src/app/locales/en.po")],
    )
    verdict = governor.check("cloud-session", owns=["web/src/takeoff/locales/en.po"])
    assert not verdict.ok
    assert "hot-file area web-en" in (verdict.reason or "")
    assert "PR 1" in (verdict.reason or "")
    assert "PR 2" in (verdict.reason or "")


def test_builders_that_recorded_owned_files_hold_the_area(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [pr(1, "a", "web/src/ui/locales/en.po")])
    record(world, "b", owns=["web/src/app/locales/en.po"])
    verdict = governor.check("local-agent", owns=["web/src/takeoff/locales/en.po"])
    assert not verdict.ok
    assert "builder b" in (verdict.reason or "")


def test_a_builder_with_an_open_pr_counts_once_under_the_cap(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [pr(n, f"t{n}", f"x/{n}.py") for n in range(1, 6)])
    for n in range(1, 6):
        record(world, f"t{n}")
    verdict = governor.check("cloud-session")
    assert not verdict.ok
    assert verdict.readings["wip"] == 5
    assert "WIP" in (verdict.reason or "")


def test_a_stopped_builder_and_an_agents_snapshot_are_not_in_flight(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [])
    record(world, "a", stop_sent=True)
    (world / "factory" / "launches" / "a-20261006T080000Z.agents.json").write_text("[]")
    assert governor.check("cloud-session").readings["wip"] == 0


def test_an_unreadable_record_refuses(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    prs(world, monkeypatch, [])
    (world / "factory" / "launches" / "bad.json").write_text("{")
    assert not governor.check("cloud-session").ok


def test_with_no_files_named_an_unreadable_pr_list_only_loses_the_pr_count(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, "gh: HTTP 502")
    assert governor.check("cloud-session").ok
    assert not governor.check("cloud-session", owns=["a.py"]).ok


def test_a_pr_row_without_files_is_an_unreadable_list() -> None:
    assert governor.parse_prs('[{"number": 1, "headRefName": "a", "state": "OPEN"}]') is None
    assert governor.parse_prs("[]") == []


def test_an_unreadable_hot_file_list_refuses_a_launch_that_names_files(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [])
    (world / "hot.json").write_text("{")
    assert not governor.check("cloud-session", owns=["a.py"]).ok
    assert governor.check("cloud-session").ok


def test_the_launcher_passes_the_owned_files_on(tmp_path: Path) -> None:
    request = launch.parse_cloud([*CLOUD, "--owns", "a/b.py", "--owns", "c.py"])
    assert request.owns == ("a/b.py", "c.py")
    root = tmp_path
    (root / "scripts" / "factory").mkdir(parents=True)
    (root / "scripts" / "factory" / "governor.py").write_text("")
    assert launch.default_govern(root, None, request.owns) is not None
    parsed = launch.parse_local([*LOCAL, "--owns", "a/b.py"])
    assert parsed.owns == ("a/b.py",)
    assert parsed.to_argv()[-2:] == ["--owns", "a/b.py"]
    assert local.parse(parsed.to_argv()).owns == ["a/b.py"]


@pytest.mark.parametrize("bad", ["/etc/passwd", "../x", "a/../b", ""])
def test_an_owned_path_must_be_repo_relative(bad: str) -> None:
    with pytest.raises(SystemExit):
        launch.parse_cloud([*CLOUD, "--owns", bad])
