"""land's ledger reading, beside the acceptance tests."""

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts.land import Gh, Refused, failed_tests, has_pass, land, order, pending, red, reviewed

HEAD = "0123456789abcdef0123456789abcdef01234567"


def write(store: Path, **fields: object) -> None:
    record = {"pr": 12, "head": HEAD, "round": 1, "verdict": "PASS", "exception": None} | fields
    (store / f"12-{HEAD}.json").write_text(json.dumps(record))


def test_a_round_three_pass_needs_its_exception(tmp_path: Path) -> None:
    write(tmp_path, round=3)
    assert not has_pass(tmp_path, 12, HEAD)
    write(tmp_path, round=3, exception={"kind": "crash", "reason": "x"})
    assert has_pass(tmp_path, 12, HEAD)


def test_a_record_for_another_pr_or_an_unreadable_one_is_no_pass(tmp_path: Path) -> None:
    write(tmp_path, pr=13)
    assert not has_pass(tmp_path, 12, HEAD)
    (tmp_path / f"12-{HEAD}.json").write_text("{")
    assert not has_pass(tmp_path, 12, HEAD)


def test_order_with_nothing_passing_is_empty() -> None:
    assert order([{"number": 1, "engine": True, "pass": False}]) == []


def test_failed_tests_reads_pytest_and_vitest_lines_once_each() -> None:
    log = "\n".join(
        [
            "job\tstep\t2026-10-05T03:09:31Z FAILED vextrus/a/tests/test_x.py::test_one - assert 1",
            "job\tstep\t2026-10-05T03:09:32Z FAILED vextrus/a/tests/test_x.py::test_one - assert 1",
            "FAILED vextrus/a/tests/test_x.py::TestCase::test_two[case-1] - KeyError",
            "FAILED vextrus/a/tests/test_x.py::test_three",
            " FAIL  src/takeoff/acts.test.tsx > acts > says the 16 were confirmed",
            " FAIL  web/src/b.test.tsx > draws it",
            "1 failed, 214 passed",
        ]
    )
    assert failed_tests(log) == [
        "vextrus/a/tests/test_x.py :: test_one",
        "vextrus/a/tests/test_x.py :: TestCase::test_two",
        "vextrus/a/tests/test_x.py :: test_three",
        "web/src/takeoff/acts.test.tsx :: says the 16 were confirmed",
        "web/src/b.test.tsx :: draws it",
    ]
    assert failed_tests("##[error]Process completed with exit code 1.") == []


def test_reviewed_refuses_an_unreadable_record_and_an_empty_ledger(tmp_path: Path) -> None:
    other = "f" * 40
    assert not reviewed(tmp_path / "none", 12, HEAD, repo=tmp_path)
    (tmp_path / f"12-{other}.json").write_text("{")
    assert not reviewed(tmp_path, 12, HEAD, repo=tmp_path)
    write(tmp_path)
    assert reviewed(tmp_path, 12, HEAD, repo=tmp_path), "the exact head's PASS needs no other record"


def test_reviewed_ignores_files_not_named_for_a_head(tmp_path: Path) -> None:
    (tmp_path / "12-notes.json").write_text("{")
    assert not reviewed(tmp_path, 12, HEAD, repo=tmp_path / "no-repo")


class Stuck(Gh):
    """CI that never settles: always pending on the PR's head."""

    def head_sha(self, pr: int) -> str:
        return HEAD

    def rollup(self, pr: int) -> dict[str, Any]:
        return {
            "headRefOid": HEAD,
            "statusCheckRollup": [{"__typename": "CheckRun", "status": "QUEUED"}],
        }


def test_ci_that_never_settles_is_refused_after_the_poll_limit(tmp_path: Path) -> None:
    sleeps: list[float] = []
    with pytest.raises(Refused, match="did not settle"):
        Stuck(tmp_path, sleep=sleeps.append, polls=4).wait_ci(12)
    assert sleeps == [20, 20, 20]


def test_an_unknown_conclusion_is_red_and_pending_contexts_wait() -> None:
    assert red({"__typename": "CheckRun", "conclusion": "STALE"})
    assert not red({"__typename": "CheckRun", "conclusion": "NEUTRAL"})
    assert red({"__typename": "StatusContext", "state": "ERROR"})
    assert pending({"__typename": "StatusContext", "state": "EXPECTED"})
    assert not pending({"__typename": "StatusContext", "state": "SUCCESS"})


def test_merge_refuses_before_ci_was_read(tmp_path: Path) -> None:
    with pytest.raises(Refused, match="CI was not read"):
        Stuck(tmp_path).merge(12)


def test_a_failure_line_that_cannot_be_read_is_never_a_listed_flake() -> None:
    log = "\n".join(
        [
            "\x1b[31m FAIL \x1b[39m src/takeoff/acts.test.tsx > acts > says it",
            " FAIL  src/x.test.tsx [ src/x.test.tsx ]",
            "Unhandled Rejection",
            "ERROR vextrus/a/tests/test_x.py - ImportError",
        ]
    )
    found = failed_tests(log)
    assert found[0] == "web/src/takeoff/acts.test.tsx :: says it", "colour codes are stripped"
    assert len(found) == 4
    assert all(test.startswith("unread: ") for test in found[1:])


def test_main_is_pulled_only_where_main_is_checked_out(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q", "-b", "feature", str(tmp_path)], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(tmp_path),
            "-c",
            "user.email=a@b",
            "-c",
            "user.name=a",
            "commit",
            "-q",
            "--allow-empty",
            "-m",
            "x",
        ],
        check=True,
    )
    with pytest.raises(Refused, match="not main"):
        Gh(tmp_path).pull_main()


class Merged:
    """A PR that merges, then main cannot be pulled here."""

    def head_sha(self, pr: int) -> str:
        return HEAD

    def mark_ready(self, pr: int) -> None: ...
    def update_branch(self, pr: int) -> None: ...
    def wait_ci(self, pr: int) -> list[str]:
        return []

    def rerun_failed(self, pr: int) -> None: ...
    def merge(self, pr: int) -> None: ...
    def pull_main(self) -> None:
        raise Refused("this checkout is on 'feature', not main")


def test_a_merged_pr_whose_pull_fails_is_reported_merged(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path)
    assert land(12, Merged(), ledger_dir=tmp_path, flaky=set(), ready=lambda _: 0) == 0
    assert "PR 12 merged, but main was not pulled" in capsys.readouterr().out


def test_vitest_5_failure_lines_with_a_project_name_their_test() -> None:
    log = "\n".join(
        [
            "2026-10-05T03:09:31.1234567Z  FAIL  |node| src/a.test.ts > Viewer > title",
            "2026-10-05T03:09:32.1234567Z  FAIL   browser (chromium)  src/b.test.tsx > Plot > cycles",
        ]
    )
    assert failed_tests(log) == ["web/src/a.test.ts :: title", "web/src/b.test.tsx :: cycles"]


RUN = "https://github.com/vextrus/vextrus-cubit/actions/runs/37257330803/job/"


def check(name: str, workflow: str, job: str, conclusion: str = "FAILURE") -> dict[str, Any]:
    return {
        "__typename": "CheckRun",
        "name": name,
        "workflowName": workflow,
        "status": "COMPLETED",
        "conclusion": conclusion,
        "completedAt": "2026-10-05T03:09:40Z",
        "detailsUrl": RUN + job,
    }


class Rollup(Gh):
    """A settled rollup on HEAD; job logs by job id."""

    def __init__(self, entries: list[dict[str, Any]], logs: dict[str, str]) -> None:
        super().__init__(Path("."), sleep=lambda _: None, polls=2)
        self.entries, self.logs = entries, logs

    def head_sha(self, pr: int) -> str:
        return HEAD

    def rollup(self, pr: int) -> dict[str, Any]:
        return {"headRefOid": HEAD, "statusCheckRollup": self.entries}

    def job_log(self, run: str, job: str) -> str:
        return self.logs.get(job, "##[error]Process completed with exit code 1.")


FLAKE = "FAILED vextrus/x/tests/test_a.py::test_flaky - assert 1 == 2"


def test_the_ci_aggregate_red_beside_a_failed_shard_follows_the_shard() -> None:
    entries = [
        check("python (rest)", "ci", "1"),
        check("ci", "ci", "2"),
        check("web", "web", "3", "SUCCESS"),
    ]
    assert Rollup(entries, {"1": FLAKE}).wait_ci(12) == ["vextrus/x/tests/test_a.py :: test_flaky"]


def test_an_aggregate_red_on_its_own_or_beside_an_unread_job_is_named() -> None:
    alone = [check("ci", "ci", "2")]
    assert Rollup(alone, {}).wait_ci(12) == ["check: ci / ci"]
    unread = [check("python (rest)", "ci", "1"), check("ci", "ci", "2")]
    assert Rollup(unread, {}).wait_ci(12) == ["check: ci / python (rest)"]


class Update(Gh):
    """update_branch against scripted answers: the head moves after `moves` reads."""

    def __init__(self, tmp_path: Path, answer: subprocess.CalledProcessError | None) -> None:
        super().__init__(tmp_path, sleep=lambda _: None, polls=3)
        self.answer, self.reads = answer, 0
        self.argv: list[list[str]] = []

    def fetch(self, pr: int) -> None: ...
    def _git(self, *args: str) -> int:
        return 1  # main is not in the head

    def head_sha(self, pr: int) -> str:
        self.reads += 1
        return HEAD if self.reads == 1 else "e" * 40

    def _run(self, *argv: str) -> str:
        self.argv.append(list(argv))
        if self.answer is not None:
            raise self.answer
        return "{}"


def refusal(stderr: str) -> subprocess.CalledProcessError:
    return subprocess.CalledProcessError(1, ["gh", "api"], output="", stderr=stderr)


def test_update_branch_puts_to_the_rest_api_with_the_expected_head(tmp_path: Path) -> None:
    gh = Update(tmp_path, None)
    gh.update_branch(12)
    assert gh.argv == [
        [
            "gh",
            "api",
            "--method",
            "PUT",
            "repos/vextrus/vextrus-cubit/pulls/12/update-branch",
            "-f",
            f"expected_head_sha={HEAD}",
        ]
    ]
    assert gh.reads == 2, "it waits for the new head"


def test_update_branch_names_a_conflict_only_when_github_says_so(tmp_path: Path) -> None:
    Update(
        tmp_path, refusal("gh: There are no new commits on the base branch. (HTTP 422)")
    ).update_branch(12)
    with pytest.raises(Refused, match=r"conflicts with main.*builder"):
        Update(tmp_path, refusal("gh: merge conflict between base and head (HTTP 422)")).update_branch(
            12
        )
    with pytest.raises(Refused) as refused:
        Update(
            tmp_path, refusal("gh: expected head sha didn't match current head ref. (HTTP 422)")
        ).update_branch(12)
    assert "conflict" not in str(refused.value)
    assert "expected head sha" in str(refused.value)


class Logs(Gh):
    """`gh run view --log-failed` and the REST job log, scripted."""

    def __init__(self, failed: str, whole: str) -> None:
        super().__init__(Path("."))
        self.failed, self.whole = failed, whole
        self.argv: list[list[str]] = []

    def _run(self, *argv: str) -> str:
        self.argv.append(list(argv))
        return self.failed if argv[:2] == ("gh", "run") else self.whole


def test_an_empty_log_failed_falls_back_to_the_job_s_whole_log() -> None:
    gh = Logs("", " FAIL  |node| src/a.test.ts > Viewer > title\n")
    assert failed_tests(gh.job_log("1", "2")) == ["web/src/a.test.ts :: title"]
    assert gh.argv[-1] == ["gh", "api", "repos/vextrus/vextrus-cubit/actions/jobs/2/logs"]
    named = Logs(FLAKE, "")
    assert failed_tests(named.job_log("1", "2")) == ["vextrus/x/tests/test_a.py :: test_flaky"]
    assert len(named.argv) == 1, "a log that names its tests needs no second read"


def run_git(cwd: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", "-c", "user.email=a@b", "-c", "user.name=a", "-c", "commit.gpgsign=false", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=True,
    )
    return done.stdout.strip()


def behind_origin(root: Path) -> tuple[Path, str]:
    """A checkout on main one commit behind its origin's main; returns it and origin's main."""
    origin, repo, other = root / "origin.git", root / "repo", root / "other"
    run_git(root, "init", "-q", "--bare", "-b", "main", str(origin))
    run_git(root, "clone", "-q", str(origin), str(repo))
    run_git(repo, "commit", "-q", "--allow-empty", "-m", "base")
    run_git(repo, "push", "-q", "origin", "main")
    run_git(root, "clone", "-q", str(origin), str(other))
    run_git(other, "commit", "-q", "--allow-empty", "-m", "merged")
    run_git(other, "push", "-q", "origin", "main")
    return repo, run_git(other, "rev-parse", "HEAD")


def test_pull_main_retries_a_fetch_another_process_raced_for_origin_main(tmp_path: Path) -> None:
    """Another fetch holds `refs/remotes/origin/main` as ours runs ("cannot lock ref"): ours is tried
    again 2 s later instead of leaving main behind."""
    repo, ahead = behind_origin(tmp_path)
    lock = repo / ".git" / "refs" / "remotes" / "origin" / "main.lock"
    lock.write_text("")
    sleeps: list[float] = []

    def other_fetch_done(seconds: float) -> None:
        sleeps.append(seconds)
        lock.unlink(missing_ok=True)

    Gh(repo, sleep=other_fetch_done).pull_main()
    assert sleeps == [2]
    assert run_git(repo, "rev-parse", "HEAD") == ahead


def test_pull_main_raises_after_three_failed_fetches(tmp_path: Path) -> None:
    repo, _ = behind_origin(tmp_path)
    before = run_git(repo, "rev-parse", "HEAD")
    (repo / ".git" / "refs" / "remotes" / "origin" / "main.lock").write_text("")
    sleeps: list[float] = []
    with pytest.raises(subprocess.CalledProcessError):
        Gh(repo, sleep=sleeps.append).pull_main()
    assert sleeps == [2, 2]
    assert run_git(repo, "rev-parse", "HEAD") == before
