"""S27-L825 (issue #825): `merge_ready`, the last check before any merge, refuses a PR head that does
not contain main's tip, naming the head and `land update` (the orchestrator's rule, 14 Oct 2026: `git
merge-base --is-ancestor origin/main <head>` fails; always, no path heuristics).

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

STALE, FRESH = 31, 32
FILES = {STALE: "pkg/stale.py", FRESH: "pkg/fresh.py"}
PASSED_STALE = "merge_ready passed a head that does not contain main's tip"


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


def test_a_head_that_does_not_contain_main_s_tip_is_refused_naming_it_and_land_update(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, head = judge(tmp_path, hub, monkeypatch, capsys, STALE)
    assert code == 1, f"{PASSED_STALE}: {out}"
    named = [
        line
        for line in out.splitlines()
        if line.startswith("merge-ready: ") and head[:12] in line and "land update" in line
    ]
    assert named, f"no `merge-ready:` line names the head {head[:12]} and `land update`: {out}"


def test_a_stale_head_is_refused_even_when_github_reports_an_older_main_as_its_base(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, STALE, base="fork")
    assert code == 1, f"{PASSED_STALE}: {out}"
    assert "land update" in out, out


def test_a_head_that_contains_main_s_tip_may_be_merged(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    code, out, _head = judge(tmp_path, hub, monkeypatch, capsys, FRESH)
    assert code == 0, out
    assert f"merge-ready: PR {FRESH} may be merged" in out, out
