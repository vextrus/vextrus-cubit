"""S27-L825 (issue #825), narrowed by S29-F4 (the owner's rulings Q19 and Q20, 14 Oct 2026):
`merge_ready` once refused every head that did not contain main's tip; now it refuses a head behind main
only for a risk-tier PR or one whose files overlap main's since its CI ran
(`ts29f4/test_merge_ready_overlap.py`). The stale PR here is ordinary and overlaps nothing, so it may
be merged on its own green CI.

Driven through `scripts.merge_ready.main([<PR>], get=..., ledger_dir=, repo=, scan=, issue_open=,
head_ready=)` with the real `fetch_review` (it fetches the pull ref and main from `origin`), in a fresh
clone of a hub with S21-MR's stub gh (`ts21mr/_world.py`: GraphQL answers the PR, the ledger PASS and
its marker comment agree, both gates and `ci` green). Main moved on after the fork: the stale PR is cut
from the fork, the fresh one from main's tip; each adds one non-document file. Main's tip is the one
git fetched, not the base GitHub reports (which may name an older main). Not pinned: whether a PR of
documents alone is exempt; the refusal's other words.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from scripts import merge_ready
from scripts.tests.acceptance.ts21mr import _world as mr
from scripts.tests.acceptance.ts27l825 import _world as w
from scripts.tests.acceptance.ts29f4._world import risk

STALE, FRESH = 31, 32
FILES = {STALE: "pkg/stale.py", FRESH: "pkg/fresh.py"}
BEHIND_REFUSED = "refused for being behind main though nothing overlaps"


@pytest.fixture(scope="module")
def hub(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict[str, str]]:
    root = tmp_path_factory.mktemp("hub")
    with pytest.MonkeyPatch.context() as patch:
        for key, value in w.git_env(root).items():
            patch.setenv(key, value)
        shas = w.build_hub(
            root, {STALE: (FILES[STALE], "fork"), FRESH: (FILES[FRESH], "tip")}, main_moves=True
        )
    return root / "hub.git", shas


def judge(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    pr: int,
    *,
    base: str = "tip",
) -> tuple[int, str, str]:
    """merge_ready on `pr`; GitHub reports `shas[base]` as the PR's base."""
    path, shas = hub
    risk(monkeypatch)
    head = shas[str(pr)]
    gh_answer = mr.answer(head, shas[base], [FILES[pr]], [f"pr {pr} change"])
    gh_answer["data"]["repository"]["pullRequest"]["headRefName"] = f"s27-pr{pr}"
    mr.enter(tmp_path, path, gh_answer, monkeypatch)
    seams: dict[str, Any] = {
        "ledger_dir": mr.ledger(tmp_path, pr, head),
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
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, STALE)
    assert code == 0, f"{BEHIND_REFUSED}: {out}"
    assert f"merge-ready: PR {STALE} may be merged" in out, out


def test_it_may_be_merged_when_github_reports_an_older_main_as_its_base(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, STALE, base="fork")
    assert code == 0, f"{BEHIND_REFUSED}: {out}"
    assert f"merge-ready: PR {STALE} may be merged" in out, out


def test_a_head_that_contains_main_s_tip_may_be_merged(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, FRESH)
    assert code == 0, out
    assert f"merge-ready: PR {FRESH} may be merged" in out, out
