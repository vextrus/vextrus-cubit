"""S29-F4 (docs/plans/factory-s29.md item 4; the owner's rulings Q19 and Q20, 14 Oct 2026): the lander
refuses a head behind main only "for risk-tier PRs or when the PR's files overlap anything merged since
its CI ran (`git diff --name-only`)"; "ordinary PRs with no overlap merge on their own green CI".

Overlap: the PR's files (`git diff --name-only <merge-base> <head>`) meet the files changed on main
since the commit its CI ran on, its head's merge-base with the fetched main (`git diff --name-only
<merge-base> origin/main`). The refusal is one `land: refused: PR <n>` line naming each overlapping
file and `land update`; nothing is merged. A conflicting PR is still refused; a head that contains
main's tip lands as before, whatever its tier.

Seams: `scripts.land.land(pr, gh, *, ledger_dir, flaky, ready, repo)` with the real
`scripts.land.Gh(repo, *, sleep, polls)` against `_world.py`'s hub and stub gh; `ready` (merge_ready)
is injected as passing, so a refusal is the lander's own. The tier is S29-F7's
`scripts.factory.tiers.is_risk`, scripted by `_world.risk`. Not pinned: the refusal's other words.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts import land
from scripts.tests.acceptance.ts29f4 import _world as w

PR, OTHER = 41, 42
ORDINARY = "pkg/ordinary.py"
RISKY = "engine/reader.py"
BEHIND_REFUSED = "refused for being behind main though nothing overlaps"
OVERLAP_LANDED = "a head behind main whose files overlap main's was merged"


def land_all(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
    shas: dict[str, str],
    numbers: list[int],
    *,
    conflicting: tuple[int, ...] = (),
) -> tuple[list[int], list[str], list[str]]:
    """Land each PR in order through one `Gh` (each reviewed, CI green); their codes, the `land:`
    lines and the PR numbers merged."""
    w.risk(monkeypatch)
    work = w.enter_land(
        tmp_path, {n: shas[str(n)] for n in numbers}, monkeypatch, conflicting=conflicting
    )
    ledger = tmp_path / "ledger"
    for number in numbers:
        w.record(ledger, number, shas[str(number)])
    gh = land.Gh(work, sleep=lambda _: None, polls=4)
    capfd.readouterr()
    codes = [
        land.land(number, gh, ledger_dir=ledger, flaky=set(), ready=lambda _: 0, repo=work)
        for number in numbers
    ]
    out, err = capfd.readouterr()
    assert "Traceback" not in err, err
    lines = [line for line in out.splitlines() if line.startswith("land:")]
    return codes, lines, [call[2] for call in w.merges(tmp_path)]


def test_an_ordinary_pr_behind_main_with_no_overlap_lands_on_its_own_green_ci(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    shas = w.hub_world(tmp_path, [{"main-only.txt": "new"}], {PR: ("fork", {ORDINARY: "new"})})
    codes, lines, merged = land_all(tmp_path, monkeypatch, capfd, shas, [PR])
    assert codes == [0], f"{BEHIND_REFUSED}: {lines}"
    assert merged == [str(PR)], f"{BEHIND_REFUSED}: {lines}"
    assert lines == [f"land: PR {PR} merged"], lines


def test_an_ordinary_pr_behind_main_that_overlaps_is_refused_naming_the_file_and_land_update(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    """Main changed `pkg/shared.py` (its top) after the fork; the PR changes it too (its bottom): no
    conflict, but the PR's CI never ran with main's change."""
    shas = w.hub_world(
        tmp_path,
        [{w.SHARED: "top"}, {"main-only.txt": "new"}],
        {PR: ("fork", {w.SHARED: "bottom", ORDINARY: "new"})},
    )
    codes, lines, merged = land_all(tmp_path, monkeypatch, capfd, shas, [PR])
    assert merged == [], f"{OVERLAP_LANDED}: {lines}"
    assert codes == [3], lines
    assert len(lines) == 1, lines
    assert lines[0].startswith(f"land: refused: PR {PR}"), lines
    assert w.SHARED in lines[0], f"the refusal does not name the overlapping file: {lines[0]}"
    assert "land update" in lines[0], f"the refusal does not name `land update`: {lines[0]}"
    assert ORDINARY not in lines[0], f"the refusal names a file that does not overlap: {lines[0]}"
    assert "main-only.txt" not in lines[0], f"the refusal names a file that does not overlap: {lines[0]}"


def test_a_risk_tier_pr_behind_main_is_refused_though_nothing_overlaps(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    shas = w.hub_world(tmp_path, [{"main-only.txt": "new"}], {PR: ("fork", {RISKY: "new"})})
    codes, lines, merged = land_all(tmp_path, monkeypatch, capfd, shas, [PR])
    assert merged == [], f"a risk-tier head behind main was merged: {lines}"
    assert codes == [3], lines
    assert len(lines) == 1, lines
    assert lines[0].startswith(f"land: refused: PR {PR}"), lines
    assert "land update" in lines[0], f"the refusal does not name `land update`: {lines[0]}"


def test_a_conflicting_pr_is_still_refused_and_not_merged(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    """Main and the PR rewrite the same line; GitHub reports it CONFLICTING / DIRTY."""
    shas = w.hub_world(tmp_path, [{w.SHARED: "top"}], {PR: ("fork", {w.SHARED: "top"})})
    codes, lines, merged = land_all(tmp_path, monkeypatch, capfd, shas, [PR], conflicting=(PR,))
    assert merged == [], f"a conflicting PR was merged: {lines}"
    assert codes == [3], lines
    assert len(lines) == 1, lines
    assert lines[0].startswith(f"land: refused: PR {PR}"), lines


def test_a_risk_tier_head_that_contains_main_s_tip_still_lands(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    shas = w.hub_world(tmp_path, [{w.SHARED: "top"}], {PR: ("tip", {RISKY: "new", w.SHARED: "bottom"})})
    codes, lines, merged = land_all(tmp_path, monkeypatch, capfd, shas, [PR])
    assert codes == [0], lines
    assert merged == [str(PR)], lines
    assert lines == [f"land: PR {PR} merged"], lines


def test_two_ordinary_prs_with_disjoint_files_land_one_after_the_other(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    """Both cut from main's tip, CI green: the first lands and main moves on to its merge; the second,
    now behind main, shares no file with it and lands on its own green CI."""
    shas = w.hub_world(
        tmp_path, [], {PR: ("tip", {"pkg/first.py": "new"}), OTHER: ("tip", {"pkg/second.py": "new"})}
    )
    codes, lines, merged = land_all(tmp_path, monkeypatch, capfd, shas, [PR, OTHER])
    assert codes == [0, 0], f"{BEHIND_REFUSED}: {lines}"
    assert merged == [str(PR), str(OTHER)], f"{BEHIND_REFUSED}: {lines}"


def test_after_the_first_pr_lands_a_second_touching_the_same_file_is_refused_naming_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    """Both cut from main's tip; the first changes `pkg/shared.py`'s top, the second its bottom (no
    conflict). Once the first lands, the second's CI never ran with the first's change."""
    shas = w.hub_world(
        tmp_path, [], {PR: ("tip", {w.SHARED: "top"}), OTHER: ("tip", {w.SHARED: "bottom"})}
    )
    codes, lines, merged = land_all(tmp_path, monkeypatch, capfd, shas, [PR, OTHER])
    assert merged == [str(PR)], f"{OVERLAP_LANDED} (merged: {merged}): {lines}"
    assert codes == [0, 3], lines
    refusals = [line for line in lines if line.startswith(f"land: refused: PR {OTHER}")]
    assert len(refusals) == 1, lines
    assert w.SHARED in refusals[0], f"the refusal does not name the overlapping file: {refusals[0]}"
    assert "land update" in refusals[0], f"the refusal does not name `land update`: {refusals[0]}"
