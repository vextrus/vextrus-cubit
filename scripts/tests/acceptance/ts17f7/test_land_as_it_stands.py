"""S17-F7: the lander stops updating branches (the owner's ruling, 7 Oct 2026, session 17: main's ruleset
no longer requires a branch to be up to date before merging; main's own CI runs after each merge).

`python -m scripts.land <PR>` merges the PR's head as it stands, CI green and gates posted on that head,
with no request to bring main in (`PUT .../pulls/<n>/update-branch`). A PR GitHub reports as
conflicting (`mergeable` CONFLICTING, `mergeStateStatus` DIRTY) is refused with one plain line naming
`land update`, and neither updated (an update cannot resolve a conflict) nor merged. Only the explicit
`land update <PR>` still brings main in, with one request.

Seams (existing): `scripts.land.land(pr, gh, *, ledger_dir, flaky, ready, repo)`,
`scripts.land.Gh(repo, *, sleep, polls)`, `scripts.land.main(["update", "<PR>"])`. GitHub is the fake
gh 2.45 of `p6_land/_fakegh.py` on PATH: it answers `gh pr view <n> --json` with `mergeable` and
`mergeStateStatus` among the fields (GitHub's GraphQL names, as gh prints them), so the lander reads the
conflict there; git is a throwaway clone whose `origin` holds `main` and `refs/pull/12/head`.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from scripts import land
from scripts.tests.acceptance.p6_land._fakegh import (
    PR,
    FakeGh,
    PrRepo,
    install,
    record,
    rollup,
    update_request,
)


@dataclass
class Run:
    code: int
    fake: FakeGh
    repo: PrRepo
    out: str
    err: str

    def lines(self) -> list[str]:
        return [line for line in self.out.splitlines() if line.startswith("land:")]


Fixtures = tuple[Path, pytest.MonkeyPatch, pytest.CaptureFixture[str]]


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]) -> Fixtures:
    return tmp_path, monkeypatch, capfd


def landing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
    *,
    conflicting: bool = False,
) -> Run:
    """Land PR 12: reviewed (a ledger PASS for its head) and CI green on that head, one commit behind
    main (main moved on after the branch was cut). Clean, GitHub reports it MERGEABLE / CLEAN and would
    accept a request to bring main in, moving the head to the merge; `conflicting`, GitHub reports it
    CONFLICTING / DIRTY and answers such a request 422 (merge conflict between base and head)."""
    repo = PrRepo(tmp_path, behind=True)
    assert repo.merged is not None
    record(tmp_path / "ledger", repo.reviewed)
    state: dict[str, Any] = {
        "update": {"head": repo.merged, "update_ref": [str(repo.origin), f"refs/pull/{PR}/head"]},
        "mergeable": "MERGEABLE",
        "merge_state_status": "CLEAN",
    }
    if conflicting:
        state |= {"update": "conflict", "mergeable": "CONFLICTING", "merge_state_status": "DIRTY"}
    fake = install(
        tmp_path, monkeypatch, head=repo.reviewed, views=[rollup("green", repo.reviewed)], **state
    )
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
    return Run(code, fake, repo, out, err)


def test_a_clean_pr_behind_main_lands_with_no_request_to_bring_main_in(env: Fixtures) -> None:
    done = landing(*env)
    assert done.fake.updates() == [], "the lander asked GitHub to bring main in"


def test_a_clean_pr_behind_main_is_merged_on_the_head_it_stands_on(env: Fixtures) -> None:
    done = landing(*env)
    assert done.code == 0, "not landed as it stands: " + done.out + done.err
    assert done.lines() == [f"land: PR {PR} merged"], done.out
    assert done.fake.called("pr", "merge") == [
        ["pr", "merge", str(PR), "--merge", "--match-head-commit", done.repo.reviewed]
    ]
    assert done.fake.state["head"] == done.repo.reviewed, "the PR's head moved"


def test_a_conflicting_pr_is_refused_naming_land_update(env: Fixtures) -> None:
    done = landing(*env, conflicting=True)
    assert done.code == 3, done.out + done.err
    assert "Traceback" not in done.err
    assert len(done.lines()) == 1, done.out
    line = done.lines()[0]
    assert line.startswith(f"land: refused: PR {PR}"), line
    assert "land update" in line, "the refusal does not name `land update`: " + line


def test_a_conflicting_pr_gets_no_request_to_bring_main_in(env: Fixtures) -> None:
    done = landing(*env, conflicting=True)
    assert done.fake.updates() == [], "the lander asked GitHub to bring main in"


def test_a_conflicting_pr_is_not_merged(env: Fixtures) -> None:
    done = landing(*env, conflicting=True)
    assert done.code == 3, done.out + done.err
    assert not done.fake.called("pr", "merge")


def test_land_update_still_asks_github_once_to_bring_main_in(env: Fixtures) -> None:
    tmp_path, monkeypatch, capfd = env
    repo = PrRepo(tmp_path, behind=True)
    assert repo.merged is not None
    fake = install(
        tmp_path,
        monkeypatch,
        head=repo.reviewed,
        update={"head": repo.merged, "update_ref": [str(repo.origin), f"refs/pull/{PR}/head"]},
        views=[rollup("green", repo.merged)],
    )
    monkeypatch.chdir(repo.work)

    class Fast(land.Gh):
        def __init__(self, *args: Any, **options: Any) -> None:
            options["sleep"] = lambda _: None
            super().__init__(*args, **options)

    monkeypatch.setattr(land, "Gh", Fast)
    capfd.readouterr()
    code: int = land.main(["update", str(PR)])
    out, err = capfd.readouterr()
    assert code == 0, out + err
    assert [update_request(argv, repo.reviewed) for argv in fake.updates()] == [True], fake.updates()
    assert fake.state["head"] == repo.merged, "main was not brought into the PR's branch"
    assert not fake.called("pr", "merge")
