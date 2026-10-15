"""S27-L825 (issue #825), narrowed by S29-F4 (the owner's rulings Q19 and Q20, 14 Oct 2026): the lander
refuses a head behind main only for a risk-tier PR or one whose files overlap main's since its CI ran
(`ts29f4/test_land_overlap.py`); an ordinary PR with no overlap, as each here, lands on its own green
CI. The history below is #825's.

Session 26: the lander merged D4 (#771) on a head whose CI ran before D7 (#805) merged; each passed
alone, together they broke main. The orchestrator's rule (14 Oct 2026): the head must contain main's
current tip (`git merge-base --is-ancestor origin/main <head>`), always, no path heuristics; a stale
head is refused naming `land update <PR>` as the way forward, and no merge is asked for. This is
stricter than main's ruleset (which since the owner's 7 Oct 2026 ruling does not require a branch to
be up to date); S17-F7's "lands as it stands" tests for a head behind main are withdrawn with it.

Seams (existing): `scripts.land.land(pr, gh, *, ledger_dir, flaky, ready, repo)` and
`scripts.land.Gh(repo, *, sleep, polls)`. `ready` (merge_ready) is injected as passing, so a refusal
here is the lander's own. Single PR: p6_land's fake gh 2.45 and `PrRepo` (a PR of one non-document
file, `pr.txt`). Several PRs: `_world.py`, whose fake `gh pr merge` moves the hub's main as GitHub
does; `main`'s loop lands each PR in order through `land()`, so the test calls it once per PR with one
`Gh`. Not pinned: whether a PR of documents alone is exempt; the refusal's words beyond `land update`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts import land
from scripts.tests.acceptance.p6_land._fakegh import PR, PrRepo, install, record, rollup
from scripts.tests.acceptance.ts27l825 import _world as w
from scripts.tests.acceptance.ts29f4._world import risk

BEHIND_REFUSED = "refused for being behind main though nothing overlaps"
FIRST, SECOND = 21, 22


def land_one(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str], *, behind: bool
) -> tuple[int, list[str], PrRepo, list[list[str]]]:
    """Land PR 12, reviewed and CI green on its head; `behind`: main moved on after its branch was cut
    and GitHub reports it MERGEABLE / CLEAN (no conflict)."""
    risk(monkeypatch)
    repo = PrRepo(tmp_path, behind=behind)
    record(tmp_path / "ledger", repo.reviewed)
    fake = install(tmp_path, monkeypatch, head=repo.reviewed, views=[rollup("green", repo.reviewed)])
    monkeypatch.chdir(repo.work)
    capfd.readouterr()
    code: int = land.land(
        PR,
        land.Gh(repo.work, sleep=lambda _: None, polls=4),
        ledger_dir=tmp_path / "ledger",
        flaky=set(),
        ready=lambda _: 0,
        repo=repo.work,
    )
    out, err = capfd.readouterr()
    assert "Traceback" not in err, err
    lines = [line for line in out.splitlines() if line.startswith("land:")]
    return code, lines, repo, fake.called("pr", "merge")


def test_an_ordinary_head_behind_main_with_no_overlap_lands(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    code, lines, _repo, _merged = land_one(tmp_path, monkeypatch, capfd, behind=True)
    assert code == 0, f"{BEHIND_REFUSED}: {lines}"
    assert lines == [f"land: PR {PR} merged"], f"{BEHIND_REFUSED}: {lines}"


def test_an_ordinary_head_behind_main_with_no_overlap_is_merged_as_it_stands(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    _code, lines, repo, merged = land_one(tmp_path, monkeypatch, capfd, behind=True)
    assert merged == [["pr", "merge", str(PR), "--merge", "--match-head-commit", repo.reviewed]], (
        f"{BEHIND_REFUSED}: {lines}"
    )


def test_a_head_that_contains_main_s_tip_still_lands(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    code, lines, repo, merged = land_one(tmp_path, monkeypatch, capfd, behind=False)
    assert code == 0, lines
    assert merged == [["pr", "merge", str(PR), "--merge", "--match-head-commit", repo.reviewed]]
    assert lines == [f"land: PR {PR} merged"], lines


def test_after_the_first_pr_merges_the_second_now_behind_main_with_no_overlap_lands_too(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    """Two reviewed PRs, both cut from main's tip and CI green: the first lands and main moves on to
    its merge, so the second's head no longer contains main's tip; they share no file."""
    risk(monkeypatch)
    with monkeypatch.context() as patch:
        for key, value in w.git_env(tmp_path).items():
            patch.setenv(key, value)
        shas = w.build_hub(
            tmp_path,
            {FIRST: ("pkg/first.py", "tip"), SECOND: ("pkg/second.py", "tip")},
            main_moves=False,
        )
    work = w.enter(
        tmp_path, tmp_path / "hub.git", {FIRST: shas[str(FIRST)], SECOND: shas[str(SECOND)]}, monkeypatch
    )
    ledger = tmp_path / "ledger"
    for number in (FIRST, SECOND):
        w.record(ledger, number, shas[str(number)])
    gh = land.Gh(work, sleep=lambda _: None, polls=4)
    capfd.readouterr()
    codes = [
        land.land(number, gh, ledger_dir=ledger, flaky=set(), ready=lambda _: 0, repo=work)
        for number in (FIRST, SECOND)
    ]
    out, err = capfd.readouterr()
    assert "Traceback" not in err, err
    merged = [call[2] for call in w.merges(tmp_path)]
    assert codes == [0, 0], f"{BEHIND_REFUSED}: {codes}: {out}"
    assert merged == [str(FIRST), str(SECOND)], f"{BEHIND_REFUSED} (merged: {merged}): {out}"
