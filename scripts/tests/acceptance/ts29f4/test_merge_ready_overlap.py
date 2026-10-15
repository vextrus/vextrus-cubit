"""S29-F4 (docs/plans/factory-s29.md item 4; the owner's rulings Q19 and Q20, 14 Oct 2026): `merge_ready`
refuses a head behind main only "for risk-tier PRs or when the PR's files overlap anything merged since
its CI ran (`git diff --name-only`)"; an ordinary PR with no overlap "merge[s] on [its] own green CI".

Overlap: the PR's files meet the files changed on main since its head's merge-base with main as git
fetched it (`git diff --name-only <merge-base> origin/main`), never since the base GitHub reports
(which may name a later main than the PR was cut from). The refusal is a `merge-ready:` line naming
each overlapping file and `land update`. The other checks (statuses, ledger PASS, READY, leak scan)
are untouched.

Driven through `scripts.merge_ready.main([<PR>], get=..., ledger_dir=, repo=, scan=, issue_open=,
head_ready=)` with the real `fetch_review`, in a fresh clone of `_world.py`'s hub, with S21-MR's stub
gh (`ts21mr/_world.py`: GraphQL answers the PR, the ledger PASS and its marker comment agree, both
gates and `ci` green). Main moved on twice after the fork: `main1` changed `pkg/shared.py` (its top),
`main2` added `main-only.txt`. The tier is S29-F7's `scripts.factory.tiers.is_risk`, scripted by
`_world.risk`. Not pinned: the refusal's other words.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from scripts import merge_ready
from scripts.tests.acceptance.ts21mr import _world as mr
from scripts.tests.acceptance.ts29f4 import _world as w

ORDINARY, OVERLAPS, RISKY, FRESH_RISKY = 51, 52, 53, 54
EDITS: dict[int, tuple[str, dict[str, str]]] = {
    ORDINARY: ("fork", {"pkg/ordinary.py": "new"}),
    OVERLAPS: ("fork", {w.SHARED: "bottom", "pkg/ordinary.py": "new"}),
    RISKY: ("fork", {"engine/reader.py": "new"}),
    FRESH_RISKY: ("tip", {"engine/reader.py": "new"}),
}
BEHIND_REFUSED = "refused for being behind main though nothing overlaps"


@pytest.fixture(scope="module")
def hub(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict[str, str]]:
    root = tmp_path_factory.mktemp("hub")
    shas = w.hub_world(root, [{w.SHARED: "top"}, {"main-only.txt": "new"}], EDITS)
    return root / "hub.git", shas


def judge(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    pr: int,
    *,
    base: str = "tip",
    reviewed: bool = True,
) -> tuple[int, str, str]:
    """merge_ready on `pr`; GitHub reports `shas[base]` as the PR's base; `reviewed`: a ledger PASS."""
    path, shas = hub
    w.risk(monkeypatch)
    head = shas[str(pr)]
    gh_answer = mr.answer(head, shas[base], sorted(EDITS[pr][1]), [f"pr {pr} change"])
    gh_answer["data"]["repository"]["pullRequest"]["headRefName"] = f"s29-pr{pr}"
    mr.enter(tmp_path, path, gh_answer, monkeypatch)
    ledger = mr.ledger(tmp_path, pr, head) if reviewed else tmp_path / "no-ledger"
    seams: dict[str, Any] = {
        "ledger_dir": ledger,
        "repo": Path.cwd(),
        "scan": lambda kind, text: 0,
        "issue_open": lambda number: True,
        "head_ready": lambda sha: True,
    }
    capsys.readouterr()
    code = merge_ready.main([str(pr)], get=lambda number: mr.statuses(head), **seams)
    return code, capsys.readouterr().out, head


def test_an_ordinary_head_behind_main_with_no_overlap_may_be_merged(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, ORDINARY)
    assert code == 0, f"{BEHIND_REFUSED}: {out}"
    assert f"merge-ready: PR {ORDINARY} may be merged" in out, out


def test_an_ordinary_head_behind_main_that_overlaps_is_refused_naming_the_file_and_land_update(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, OVERLAPS)
    assert code == 1, f"merge_ready passed a head whose files overlap main's: {out}"
    named = [
        line
        for line in out.splitlines()
        if line.startswith("merge-ready: ") and w.SHARED in line and "land update" in line
    ]
    assert named, f"no `merge-ready:` line names the overlapping {w.SHARED} and `land update`: {out}"
    assert not [line for line in named if "pkg/ordinary.py" in line or "main-only.txt" in line], (
        f"the refusal names a file that does not overlap: {named}"
    )


def test_the_overlap_is_measured_from_the_merge_base_not_the_base_github_reports(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """GitHub reports `main1` (already holding main's change to `pkg/shared.py`) as the base; the PR
    was cut from the fork, so its CI never ran with that change."""
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, OVERLAPS, base="main1")
    assert code == 1, f"merge_ready passed a head whose files overlap main's: {out}"
    assert any(w.SHARED in line and "land update" in line for line in out.splitlines()), out


def test_a_risk_tier_head_behind_main_is_refused_naming_land_update(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, head = judge(tmp_path, hub, monkeypatch, capsys, RISKY)
    assert code == 1, f"merge_ready passed a risk-tier head behind main: {out}"
    named = [
        line
        for line in out.splitlines()
        if line.startswith("merge-ready: ") and head[:12] in line and "land update" in line
    ]
    assert named, f"no `merge-ready:` line names the head {head[:12]} and `land update`: {out}"


def test_a_risk_tier_head_that_contains_main_s_tip_may_be_merged(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, FRESH_RISKY)
    assert code == 0, out
    assert f"merge-ready: PR {FRESH_RISKY} may be merged" in out, out


def test_an_ordinary_head_behind_main_with_no_ledger_pass_is_still_refused(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, ORDINARY, reviewed=False)
    assert code == 1, f"merge_ready passed a head no ledger PASS covers: {out}"
    assert "may be merged" not in out, out
