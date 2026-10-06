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


def record(world: Path, ticket: str, **fields: object) -> None:
    body = {"ticket": ticket, "branch": ticket, "where": "local", "role": "builder", "judge": None}
    (world / "factory" / "launches" / f"{ticket}-20261006T080000Z.json").write_text(
        json.dumps(body | fields)
    )


def test_a_glob_entry_covers_the_files_it_matches(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    prs(
        world,
        monkeypatch,
        [
            pr(1, "a", "web/src/ui/locales/en.po"),
            pr(2, "b", "web/src/app/locales/en.po"),
            pr(3, "c", "web/src/members/locales/en.po"),
        ],
    )
    verdict = governor.check("cloud-session", owns=["web/src/takeoff/locales/en.po"])
    assert not verdict.ok
    assert "hot-file area web-en" in (verdict.reason or "")
    assert "PR 1" in (verdict.reason or "")
    assert "PR 2" in (verdict.reason or "")
    assert "PR 3" in (verdict.reason or "")


def test_builders_that_recorded_owned_files_hold_the_area(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [pr(1, "a", "web/src/ui/locales/en.po")])
    record(world, "b", owns=["web/src/app/locales/en.po"])
    record(world, "c", owns=["web/src/members/locales/en.po"])
    verdict = governor.check("local-agent", owns=["web/src/takeoff/locales/en.po"])
    assert not verdict.ok
    assert "builder b" in (verdict.reason or "")


def test_a_builder_with_an_open_pr_counts_once_and_no_count_refuses(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [pr(n, f"t{n}", f"x/{n}.py") for n in range(1, 6)])
    for n in range(1, 6):
        record(world, f"t{n}")
    verdict = governor.check("cloud-session")
    assert verdict.ok, verdict.reason  # S14-K1: no count of PRs or builders refuses a launch
    assert verdict.readings["wip"] == 5


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


def test_an_unreadable_pr_list_refuses_named_files_and_releases_no_record(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, "gh: HTTP 502")
    for n in range(1, 5):
        record(world, f"t{n}")
    assert governor.check("cloud-session").ok
    assert not governor.check("cloud-session", owns=["a.py"]).ok
    assert governor.check("cloud-session", role="reviewer", owns=["a.py"]).ok
    record(world, "t5")  # its PR may have merged; unread, it still counts
    assert governor.check("cloud-session").readings["wip"] == 5


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


# --- fix round 1 (review of PR #469)
def test_closed_prs_release_their_builders(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    prs(world, monkeypatch, [pr(n, f"t{n}", f"x/{n}.py", state="CLOSED") for n in range(1, 8)])
    for n in range(1, 8):
        record(world, f"t{n}")
    assert governor.check("cloud-session").readings["wip"] == 0


def test_a_branch_with_a_closed_and_an_open_pr_still_counts(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [pr(1, "a", "x.py", state="CLOSED"), pr(2, "a", "x.py")])
    record(world, "a")
    assert governor.check("cloud-session").readings["wip"] == 1


@pytest.mark.parametrize("role", ["acceptance-writer", "reviewer", "refuter"])
def test_records_of_other_roles_are_not_builders_in_flight(
    world: Path, monkeypatch: pytest.MonkeyPatch, role: str
) -> None:
    prs(world, monkeypatch, [])
    for n in range(1, 8):
        record(world, f"t{n}", role=role)
    assert governor.check("cloud-session").readings["wip"] == 0


def test_an_old_cloud_record_with_no_pr_ages_out(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-06T10:00:00Z")
    prs(world, monkeypatch, [])
    record(
        world,
        "old",
        where="cloud",
        judge={"ok": True},
        started_at="2026-10-01T08:00:00Z",
        budget_minutes=90,
    )
    record(world, "fresh", started_at="2026-10-06T08:00:00Z", budget_minutes=90)
    record(world, "unstamped")
    verdict = governor.check("cloud-session")
    assert verdict.readings["wip"] == 2
    assert "builder old" in verdict.readings["aged_out"][0]


def test_a_cloud_builder_past_budget_and_grace_with_no_pr_still_counts(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # s13-w324 ran 40 minutes of budget for 4 h 18 min before its PR opened
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-06T10:00:00Z")
    prs(world, monkeypatch, [])
    cloud = {"where": "cloud", "judge": {"ok": True}, "budget_minutes": 40}
    record(world, "c", started_at="2026-10-06T05:42:00Z", **cloud)  # 4 h 18 min in
    record(world, "d", started_at="2026-10-06T02:00:00Z", **cloud)  # 8 h in: past the 6 h floor
    verdict = governor.check("cloud-session")
    assert verdict.readings["wip"] == 1
    assert "builder d" in verdict.readings["aged_out"][0]


def test_a_local_builder_ages_out_only_when_its_agent_is_gone(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-06T10:00:00Z")
    prs(world, monkeypatch, [])
    late = {"started_at": "2026-10-06T05:42:00Z", "budget_minutes": 40}
    record(world, "alive", name="agent-alive", **late)
    record(world, "gone", name="agent-gone", **late)
    record(world, "young", name="agent-young", started_at="2026-10-06T09:30:00Z", budget_minutes=40)
    agents = world / "agents.json"
    agents.write_text(json.dumps([{"name": "agent-alive", "pid": 7, "kind": "background"}]))
    monkeypatch.setenv("VEXTRUS_AGENTS_FILE", str(agents))
    verdict = governor.check("cloud-session")
    assert verdict.readings["wip"] == 2  # alive, and young (inside its budget: never asked)
    assert "no agent named agent-gone" in verdict.readings["aged_out"][0]
    agents.write_text("not json")  # unreadable: nothing ages out
    assert governor.check("cloud-session").readings["wip"] == 3


def fill_the_cap(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    prs(world, monkeypatch, [pr(n, f"t{n}", f"x/{n}.py") for n in range(1, 6)])


@pytest.mark.parametrize("role", ["reviewer", "refuter"])
def test_a_reviewer_or_refuter_launch_is_refused_by_neither_cap_nor_area(
    world: Path, monkeypatch: pytest.MonkeyPatch, role: str
) -> None:
    fill_the_cap(world, monkeypatch)
    assert not governor.check("cloud-session", branch="new", owns=["x/1.py"]).ok
    assert governor.check("cloud-session", role=role, branch="t1").ok
    assert governor.check("cloud-session", role=role, branch="new", owns=["x/1.py"]).ok


def test_a_launch_on_a_branch_that_already_holds_a_unit_is_not_new_work(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fill_the_cap(world, monkeypatch)
    assert governor.check("cloud-session", branch="t1").ok
    # its own open PR's files and area do not refuse its relaunch
    assert governor.check("cloud-session", branch="t1", owns=["x/1.py"]).ok
    refused = governor.check("cloud-session", branch="t9", owns=["x/1.py"])
    assert not refused.ok
    assert "PR 1" in (refused.reason or "")


def test_a_builder_record_alone_holds_its_branch_unit_and_no_count_refuses(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [])
    for n in range(1, 6):
        record(world, f"t{n}")
    assert governor.check("cloud-session", branch="t9").ok
    assert governor.check("cloud-session", branch="t3").readings["wip"] == 5


def test_the_launcher_passes_role_and_branch_to_the_governor(tmp_path: Path) -> None:
    root = tmp_path
    (root / "scripts" / "factory").mkdir(parents=True)
    (root / "scripts" / "factory" / "governor.py").write_text(
        "import sys\nprint(' '.join(sys.argv[1:]))\n"
    )
    govern = launch.default_govern(root, None, (), "reviewer", "t1")
    assert govern is not None
    said = govern().text
    assert "--role reviewer" in said
    assert "--branch t1" in said


def test_a_folder_path_covers_the_files_under_it(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    prs(world, monkeypatch, [pr(1, "a", "vextrus/takeoff/services/step1.py")])
    refused = governor.check("cloud-session", owns=["vextrus/takeoff/"])
    assert not refused.ok
    assert "PR 1" in (refused.reason or "")
    assert governor.check("cloud-session", owns=["vextrus/takeoffer/"]).ok


def test_a_folder_path_touches_the_areas_under_it(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (world / "hot.json").write_text(
        json.dumps({"areas": {"step1": ["vextrus/takeoff/services/step1.py"], "docs": ["docs/x.md/"]}})
    )
    prs(
        world,
        monkeypatch,
        [
            pr(1, "a", "vextrus/takeoff/services/step1.py"),
            pr(2, "b", "vextrus/takeoff/services/step1.py"),
            pr(3, "c", "vextrus/takeoff/services/step1.py"),
        ],
    )
    refused = governor.check("cloud-session", owns=["vextrus/other.py", "vextrus/takeoff/"])
    assert "hot-file area step1" in (refused.reason or "")


def test_an_area_entry_ending_in_a_slash_covers_the_files_under_it(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (world / "hot.json").write_text(json.dumps({"areas": {"takeoff": ["vextrus/takeoff/"]}}))
    prs(world, monkeypatch, [pr(n, f"t{n}", f"vextrus/takeoff/{n}.py") for n in range(1, 4)])
    refused = governor.check("cloud-session", owns=["vextrus/takeoff/c.py"])
    assert "hot-file area takeoff" in (refused.reason or "")


def test_the_committed_catalogue_areas_are_separate() -> None:
    areas = json.loads(governor.HOT_FILES.with_name("hot-files.json").read_text())["areas"]
    catalogues = [name for name, entries in areas.items() if any(e.endswith("en.po") for e in entries)]
    assert len(catalogues) >= 2
    for name in catalogues:
        assert not any("*" in entry for entry in areas[name]), name
    shared = [set(areas[a]) & set(areas[b]) for a in catalogues for b in catalogues if a < b]
    assert not any(shared)


def test_two_prs_on_unrelated_catalogues_do_not_refuse_a_third(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(governor, "HOT_FILES", Path(governor.__file__).with_name("hot-files.json"))
    prs(
        world,
        monkeypatch,
        [pr(1, "a", "web/src/ui/locales/en.po"), pr(2, "b", "web/src/members/locales/en.po")],
    )
    assert governor.check("cloud-session", owns=["web/src/takeoff/locales/en.po"]).ok


def test_a_closed_pr_older_than_the_record_leaves_the_record_counted(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # session 13 relaunched builders on branches whose PR had closed at the review cap
    closed = pr(7, "t160", "x.py", state="CLOSED") | {"createdAt": "2026-10-02T08:00:00Z"}
    prs(world, monkeypatch, [closed])
    record(world, "t160", started_at="2026-10-05T08:00:00Z", budget_minutes=90)  # relaunched after
    record(world, "t161", started_at="2026-10-01T08:00:00Z", budget_minutes=90)  # before: released
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-05T09:00:00Z")
    merged = pr(8, "t161", "y.py", state="MERGED") | {"createdAt": "2026-10-02T08:00:00Z"}
    others = [pr(n, f"o{n}", f"o/{n}.py") for n in range(11, 15)]
    prs(world, monkeypatch, [closed, merged, *others])
    verdict = governor.check("cloud-session")
    assert verdict.readings["wip"] == 5  # four open PRs and t160, not t161
    assert verdict.ok, verdict.reason
    counted = " ".join(verdict.readings["counted"])
    assert "builder t160" in counted
    assert "builder t161" not in counted


def test_a_pr_row_without_created_at_still_releases_every_record(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [pr(7, "t160", "x.py", state="CLOSED")])
    record(world, "t160", started_at="2026-10-05T08:00:00Z")
    assert governor.check("cloud-session").readings["wip"] == 0


def test_a_relaunched_builder_and_an_open_pr_hold_the_area_against_a_third(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (world / "hot.json").write_text(
        json.dumps({"areas": {"step1": ["vextrus/takeoff/services/step1.py"]}})
    )
    step1 = "vextrus/takeoff/services/step1.py"
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-05T09:00:00Z")
    prs(
        world,
        monkeypatch,
        [
            pr(1, "other", step1),
            pr(3, "another", step1),
            pr(2, "t160", step1, state="CLOSED") | {"createdAt": "2026-10-02T08:00:00Z"},
        ],
    )
    record(world, "t160", owns=[step1], started_at="2026-10-05T08:00:00Z", budget_minutes=90)
    refused = governor.check("cloud-session", owns=[step1], branch="third")
    assert not refused.ok
    assert "hot-file area step1" in (refused.reason or "")
    assert "builder t160" in (refused.reason or "")


def test_parse_prs_takes_rows_with_and_without_created_at() -> None:
    row = '{"number": 1, "headRefName": "a", "state": "OPEN", "files": []%s}'
    assert governor.parse_prs("[" + row % "" + "]") is not None
    assert governor.parse_prs("[" + row % ', "createdAt": "2026-10-02T08:00:00Z"' + "]") is not None


# --- the release rule, settled (re-submission after PR #469): one table, every case a row
NOW = "2026-10-06T10:00:00Z"
START = "2026-10-06T09:00:00Z"  # the record's start, inside its 90 min budget at NOW
BEFORE, AFTER = "2026-10-06T08:00:00Z", "2026-10-06T09:30:00Z"


def ended(number: int, state: str, **times: str) -> dict[str, object]:
    return pr(number, "t", "x.py", state=state) | times


RELEASE_CASES = {
    "no PR on the branch: counts": ([], 1),
    # round 3's 75/75: a fix-round launch on an open PR, which then merged
    "merged after the record started: released": (
        [ended(1, "MERGED", createdAt=BEFORE, closedAt=AFTER, mergedAt=AFTER)],
        0,
    ),
    "closed after the record started: released": (
        [ended(1, "CLOSED", createdAt=BEFORE, closedAt=AFTER)],
        0,
    ),
    # round 2's 70/65: a builder relaunched after its PR closed at the review cap
    "closed before the record started: counts": (
        [ended(1, "CLOSED", createdAt=BEFORE, closedAt=BEFORE)],
        1,
    ),
    "merged before the record started: counts": (
        [ended(1, "MERGED", createdAt=BEFORE, closedAt=BEFORE, mergedAt=BEFORE)],
        1,
    ),
    "the latest end decides: released": (
        [
            ended(1, "CLOSED", createdAt=BEFORE, closedAt=BEFORE),
            ended(2, "MERGED", createdAt=START, closedAt=AFTER, mergedAt=AFTER),
        ],
        0,
    ),
    "no end read, created before the start: counts (createdAt)": (
        [ended(1, "MERGED", createdAt=BEFORE)],
        1,
    ),
    "no end read, created after the start: released (createdAt)": (
        [ended(1, "MERGED", createdAt=AFTER)],
        0,
    ),
    "no time read at all: released": ([ended(1, "CLOSED")], 0),
    # the refuter's A: a row with no time does not outrank a later PR that has one
    "an untimed row and a PR closed before the start: counts": (
        [ended(1, "CLOSED"), ended(2, "CLOSED", createdAt=BEFORE, closedAt=BEFORE)],
        1,
    ),
    "a PR closed before the start and an untimed row: counts": (
        [ended(2, "CLOSED", createdAt=BEFORE, closedAt=BEFORE), ended(1, "CLOSED")],
        1,
    ),
    # the refuter's B: a fork's PR whose branch has the builder's name releases nothing
    "a fork's PR closed after the start: counts": (
        [ended(1, "CLOSED", createdAt=AFTER, closedAt=AFTER) | {"isCrossRepository": True}],
        1,
    ),
    "an open PR on the branch: counted once, as the PR": (
        [ended(1, "CLOSED", createdAt=BEFORE, closedAt=AFTER), pr(2, "t", "x.py")],
        1,
    ),
}


@pytest.mark.parametrize(("rows", "wip"), RELEASE_CASES.values(), ids=list(RELEASE_CASES))
def test_a_merged_or_closed_pr_releases_only_the_records_that_started_before_it_ended(
    world: Path, monkeypatch: pytest.MonkeyPatch, rows: list[dict[str, object]], wip: int
) -> None:
    monkeypatch.setenv("VEXTRUS_NOW", NOW)
    prs(world, monkeypatch, rows)
    record(world, "t", started_at=START, budget_minutes=90)
    verdict = governor.check("cloud-session")
    assert verdict.readings["wip"] == wip, verdict.readings


def test_round_three_s14_w1_fix_launch_is_released_when_its_pr_closes_and_its_relaunch_counts(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # PR 469 opened 23:06:59; the fix-round launch started 23:21:16; the PR closed at the cap after it
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-06T00:30:00Z")
    closed = pr(469, "s14-w1", "scripts/factory/governor.py", state="CLOSED") | {
        "createdAt": "2026-10-05T23:06:59Z",
        "closedAt": "2026-10-06T00:15:00Z",
    }
    prs(world, monkeypatch, [closed])
    (world / "factory" / "launches" / "s14-w1-fix.json").write_text(
        json.dumps(
            {"ticket": "S14-W1", "branch": "s14-w1", "where": "cloud", "role": "builder"}
            | {"judge": {"ok": True}, "started_at": "2026-10-05T23:21:16Z", "budget_minutes": 30}
        )
    )
    assert governor.check("cloud-session").readings["wip"] == 0
    (world / "factory" / "launches" / "s14-w1-again.json").write_text(
        json.dumps(
            {"ticket": "S14-W1", "branch": "s14-w1", "where": "cloud", "role": "builder"}
            | {"judge": {"ok": True}, "started_at": "2026-10-06T00:24:00Z", "budget_minutes": 60}
        )
    )
    verdict = governor.check("cloud-session")
    assert verdict.readings["wip"] == 1
    assert "after PR 469 ended" in verdict.readings["counted"][0]


LATE = {"started_at": "2026-10-06T05:42:00Z", "budget_minutes": 40}  # past budget and grace at NOW
AGENT_CASES = {
    "a live row: counts": ([{"name": "n", "pid": 7, "state": "working", "status": "busy"}], 1),
    "a live idle row: counts": ([{"name": "n", "pid": 7, "state": "done", "status": "idle"}], 1),
    # round 3's 50: a done session is alive and waiting on its next message (the runbook)
    "a done row with no pid: counts": ([{"name": "n", "pid": None, "state": "done"}], 1),
    "a row of an unknown state with no pid: counts": ([{"name": "n", "state": "working"}], 1),
    "a stopped row with no pid: ages out": ([{"name": "n", "pid": None, "state": "stopped"}], 0),
    "a failed row with no pid: ages out": ([{"name": "n", "state": "failed"}], 0),
    "a stopped row and a live one of the name: counts": (
        [{"name": "n", "state": "stopped"}, {"name": "n", "pid": 9, "state": "working"}],
        1,
    ),
    "no row of the name: ages out": ([{"name": "other", "pid": 7, "state": "working"}], 0),
    "an unreadable list: counts": ("not json", 1),
}


@pytest.mark.parametrize(("rows", "wip"), AGENT_CASES.values(), ids=list(AGENT_CASES))
def test_a_local_builder_past_its_budget_counts_until_its_agent_has_ended(
    world: Path, monkeypatch: pytest.MonkeyPatch, rows: list[dict[str, object]] | str, wip: int
) -> None:
    monkeypatch.setenv("VEXTRUS_NOW", NOW)
    prs(world, monkeypatch, [])
    record(world, "t", name="n", **LATE)
    agents = world / "agents.json"
    agents.write_text(rows if isinstance(rows, str) else json.dumps(rows))
    monkeypatch.setenv("VEXTRUS_AGENTS_FILE", str(agents))
    verdict = governor.check("cloud-session")
    assert verdict.readings["wip"] == wip, verdict.readings


def test_a_local_builder_inside_its_budget_counts_with_no_agent_row(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_NOW", NOW)
    prs(world, monkeypatch, [])
    record(world, "t", name="n", started_at=START, budget_minutes=90)
    assert governor.check("cloud-session").readings["wip"] == 1


def test_an_acceptance_writer_launch_is_new_work_the_areas_refuse(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prs(world, monkeypatch, [pr(n, f"t{n}", f"web/src/{n}en.po") for n in range(1, 4)])
    owned = ["web/src/9en.po"]
    refused = governor.check("local-agent", role="acceptance-writer", branch="new", owns=owned)
    assert not refused.ok
    assert "hot-file area web-en" in (refused.reason or "")


def test_a_launch_on_a_branch_whose_records_were_released_is_new_work(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_NOW", NOW)
    others = [pr(n, f"o{n}", f"web/src/{n}en.po") for n in range(1, 4)]
    merged = ended(9, "MERGED", createdAt=BEFORE, closedAt=AFTER, mergedAt=AFTER)
    prs(world, monkeypatch, [*others, merged])
    record(world, "t", started_at=START, budget_minutes=90)
    assert not governor.check("cloud-session", branch="t", owns=["web/src/9en.po"]).ok


def test_the_reading_says_why_each_counted_unit_counts(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_NOW", NOW)
    prs(world, monkeypatch, [pr(1, "open", "x.py")])
    record(world, "t", started_at=START, budget_minutes=90)
    counted = governor.check("cloud-session").readings["counted"]
    assert counted[0] == "PR 1: open"
    assert counted[1].startswith("builder t: no merged or closed PR on its branch; 60 min in")


def test_the_pr_query_reads_when_each_pr_ended(monkeypatch: pytest.MonkeyPatch) -> None:
    said: list[list[str]] = []
    monkeypatch.delenv("VEXTRUS_PRS_FILE", raising=False)

    def run(argv: list[str]) -> str:
        said.append(argv)
        return "[]"

    monkeypatch.setattr(governor, "_run", run)
    governor.prs_text()
    fields = said[0][said[0].index("--json") + 1].split(",")
    assert {"createdAt", "closedAt", "mergedAt", "files", "state", "headRefName"} <= set(fields)
    assert "isCrossRepository" in fields


def test_a_forks_open_pr_is_no_work_in_flight(world: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    rows = [pr(n, f"t{n}", f"x/{n}.py") | {"isCrossRepository": True} for n in range(1, 6)]
    prs(world, monkeypatch, rows)
    verdict = governor.check("cloud-session", owns=["x/1.py"])
    assert verdict.ok, verdict.reason
    assert verdict.readings["wip"] == 0


def test_a_relaunchs_owned_files_join_its_branch_unit_in_the_areas(
    world: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # the refuter's E: the second live record on a branch owns a hot file the first did not
    monkeypatch.setenv("VEXTRUS_NOW", NOW)
    prs(
        world,
        monkeypatch,
        [pr(1, "a", "web/src/ui/locales/en.po"), pr(2, "b", "web/src/members/locales/en.po")],
    )
    body = {"ticket": "t", "branch": "t", "where": "local", "role": "builder", "judge": None}
    launches = world / "factory" / "launches"
    first = body | {"started_at": START, "budget_minutes": 90, "owns": ["x.py"]}
    again = body | {"started_at": AFTER, "budget_minutes": 90, "owns": ["web/src/app/locales/en.po"]}
    (launches / "t-1.json").write_text(json.dumps(first))
    (launches / "t-2.json").write_text(json.dumps(again))
    verdict = governor.check("cloud-session", owns=["web/src/takeoff/locales/en.po"], branch="new")
    assert verdict.readings["wip"] == 3
    assert not verdict.ok
    assert "hot-file area web-en" in (verdict.reason or "")
