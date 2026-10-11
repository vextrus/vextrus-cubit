"""S21-MR: `merge_ready` judges a PR of any size on all of it.

GitHub refuses `gh pr diff` over 20000 lines (HTTP 406 too_large) and the GraphQL caps the files at 100
and the commits at 250, so the review gate reads the PR from git: after fetching `refs/pull/<PR>/head`
and the base, diff = `git diff <baseRefOid>...<headRefOid>`, files = the names of that range (all of
them), messages = every commit of `<base>..<head>`; the head checked is still GraphQL's headRefOid; a
fetch failure is a refusal naming it, never a crash. Driven through `fetch_review(<PR>)` and
`main([<PR>])` in a throwaway clone with a stub `gh` (see `_world.py`)."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts import merge_ready
from scripts.tests.acceptance.ts21mr import _world as w


@pytest.fixture(scope="module")
def hub(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict[str, str]]:
    root = tmp_path_factory.mktemp("hub")
    with pytest.MonkeyPatch.context() as patch:
        for key, value in w.git_env(root).items():
            patch.setenv(key, value)
        shas = w.build_hub(root)
    return root / "hub.git", shas


def world(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    *,
    head: str | None = None,
) -> dict[str, str]:
    """Enter a fresh clone; GraphQL reports `head` (default: the PR's head) and main's tip as base."""
    path, shas = hub
    reported = shas["head"] if head is None else head
    w.enter(tmp_path, path, w.answer(reported, shas["base"], w.PR_FILES, w.pr_messages()), monkeypatch)
    return shas


def run_main(tmp_path: Path, head: str, *, pr: int = w.PR, **seams: Any) -> int:
    defaults: dict[str, Any] = {
        "ledger_dir": w.ledger(tmp_path, pr, head),
        "repo": Path.cwd(),
        "scan": lambda kind, text: 0,
        "issue_open": lambda number: True,
        "head_ready": lambda sha: True,
    }
    return merge_ready.main([str(pr)], get=lambda number: w.statuses(head), **(defaults | seams))


def three_dot(base: str, head: str, *args: str) -> str:
    return subprocess.run(
        ["git", "-c", "core.quotePath=false", "diff", *args, f"{base}...{head}"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def test_a_pr_over_the_gh_diff_limit_has_its_whole_diff_read_from_git(
    tmp_path: Path, hub: tuple[Path, dict[str, str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    shas = world(tmp_path, hub, monkeypatch)
    facts = merge_ready.fetch_review(w.PR)
    added = [
        row for row in facts["diff"].splitlines() if row.startswith("+") and not row.startswith("+++")
    ]
    assert len(added) == len(w.PR_FILES) * w.LINES  # 21000 added lines, every one of them
    for path in w.PR_FILES:
        assert f"+line 1 of {path}" in facts["diff"]
    assert f"+x = '{w.DIFF_SENTINEL}'" in facts["diff"]
    assert added == [
        row
        for row in three_dot(shas["base"], shas["head"]).splitlines()
        if row.startswith("+") and not row.startswith("+++")
    ]


def test_the_diff_and_files_are_the_three_dot_range_so_mains_later_change_is_not_the_prs(
    tmp_path: Path, hub: tuple[Path, dict[str, str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    world(tmp_path, hub, monkeypatch)
    facts = merge_ready.fetch_review(w.PR)
    assert w.MAIN_ONLY not in facts["diff"]
    assert w.MAIN_ONLY not in facts["files"]


def test_every_file_is_listed_past_the_graphqls_hundred_by_its_name_as_written(
    tmp_path: Path, hub: tuple[Path, dict[str, str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    world(tmp_path, hub, monkeypatch)
    facts = merge_ready.fetch_review(w.PR)
    assert sorted(facts["files"]) == sorted(w.PR_FILES)
    assert w.FILE_150 in facts["files"]
    assert w.SPACED in facts["files"]


def test_every_commit_message_is_read_past_the_graphqls_last_250(
    tmp_path: Path, hub: tuple[Path, dict[str, str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    world(tmp_path, hub, monkeypatch)
    facts = merge_ready.fetch_review(w.PR)
    assert len(facts["messages"]) == w.PR_COMMITS
    assert any(w.FIRST_MESSAGE in message for message in facts["messages"])
    assert not any(w.MAIN_ONLY_MESSAGE in message for message in facts["messages"])


def test_the_head_checked_is_graphqls_head_not_a_newer_tip_of_the_pull_ref(
    tmp_path: Path, hub: tuple[Path, dict[str, str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    path, shas = hub
    subprocess.run(
        [
            "git",
            "-C",
            shas["dev"],
            "push",
            "-q",
            "-f",
            str(path),
            f"{shas['late']}:refs/pull/{w.PR}/head",
        ],
        check=True,
    )
    try:
        world(tmp_path, hub, monkeypatch)
        facts = merge_ready.fetch_review(w.PR)
    finally:
        subprocess.run(
            [
                "git",
                "-C",
                shas["dev"],
                "push",
                "-q",
                "-f",
                str(path),
                f"{shas['head']}:refs/pull/{w.PR}/head",
            ],
            check=True,
        )
    assert facts["head"] == shas["head"]
    assert facts["base"] == shas["base"]
    assert w.LATE not in facts["files"]
    assert w.LATE not in facts["diff"]


def test_a_leak_in_the_150th_files_added_line_is_found(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    shas = world(tmp_path, hub, monkeypatch)
    code = run_main(tmp_path, shas["head"], scan=lambda kind, text: text.count(w.DIFF_SENTINEL))
    out = capsys.readouterr().out
    assert code == 1
    assert "merge-ready: leak scan: 1 hit(s) in the PR's diff" in out


def test_a_leak_in_the_150th_files_name_is_found(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    shas = world(tmp_path, hub, monkeypatch)
    code = run_main(
        tmp_path,
        shas["head"],
        scan=lambda kind, text: text.count(w.NAME_SENTINEL) if kind == "files" else 0,
    )
    out = capsys.readouterr().out
    assert code == 1
    assert "merge-ready: leak scan: 1 hit(s) in the PR's files" in out


def test_a_leak_in_the_first_of_260_commit_messages_is_found(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    shas = world(tmp_path, hub, monkeypatch)
    code = run_main(
        tmp_path,
        shas["head"],
        scan=lambda kind, text: text.count("message-sentinel-beyond-the-last-250"),
    )
    out = capsys.readouterr().out
    assert code == 1
    assert "merge-ready: leak scan: 1 hit(s) in the PR's messages" in out


def test_a_code_file_past_the_hundredth_still_needs_a_ready_head(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """The first 100 files are documents; the code comes after them, so a capped list would skip (e)."""
    shas = world(tmp_path, hub, monkeypatch)
    code = run_main(tmp_path, shas["head"], head_ready=lambda sha: False)
    out = capsys.readouterr().out
    assert code == 1
    assert "is not Factory-State: READY" in out


def test_the_whole_big_pr_may_merge_when_it_is_clean(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    shas = world(tmp_path, hub, monkeypatch)
    code = run_main(tmp_path, shas["head"])
    out = capsys.readouterr().out
    assert code == 0, out
    assert f"merge-ready: PR {w.PR} may be merged" in out


def test_a_pull_ref_that_cannot_be_fetched_is_a_refusal_naming_the_fetch(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """PR 8 has no `refs/pull/8/head` on the hub: the fetch fails; main refuses and does not raise."""
    shas = world(tmp_path, hub, monkeypatch)
    code = run_main(tmp_path, shas["head"], pr=8)
    out = capsys.readouterr().out
    assert code == 1
    assert any(
        line.startswith("merge-ready: ") and "fetch" in line.lower() for line in out.splitlines()
    ), out


def test_a_graphql_head_git_cannot_read_is_a_refusal_not_a_crash(
    tmp_path: Path,
    hub: tuple[Path, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A head force-pushed away: GraphQL names a commit the fetched refs do not hold."""
    gone = "0123456789abcdef0123456789abcdef01234567"
    world(tmp_path, hub, monkeypatch, head=gone)
    code = run_main(tmp_path, gone)
    out = capsys.readouterr().out
    assert code == 1
    assert "may be merged" not in out
    assert any(line.startswith("merge-ready: ") for line in out.splitlines())
