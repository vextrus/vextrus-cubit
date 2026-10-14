"""S29-F3 beyond the acceptance pins: the review's `revert` tier wired through `review run` (no model, a
PASS by code, only for the exact inverse of one first-parent merge on main), the `run` loop and the
real forge's reading of a commit's runs."""

import ast
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import ci_gate, main_watch
from scripts.tests.acceptance.ts14r1._world import BASE_FILES, World, git, why
from scripts.tests.acceptance.ts29f3._repo import FakeForge, Repo

CODE = "vextrus/rates/table.py"


def landed(world: World, number: int, text: str) -> str:
    """PR `number` (CODE rewritten to `text`) merged into main as a first-parent merge; its sha."""
    world.pr(number, {CODE: text})
    git(world.main, "merge", "-q", "--no-ff", "-m", f"Merge pull request #{number}", f"pr{number}")
    git(world.main, "push", "-q", "origin", "main")
    return git(world.main, "rev-parse", "HEAD")


RED_GH = """#!{python}
import json, os, sys
if sys.argv[1:3] == ["run", "list"]:
    print(json.dumps([{{"databaseId": 1, "workflowName": "ci", "status": "completed",
                       "conclusion": "{conclusion}", "url": "u"}}]))
    sys.exit(0)
os.execv({real!r}, [{real!r}, *sys.argv[1:]])
"""


def logged_culprit(world: World, merge: str, conclusion: str = "failure") -> None:
    """The main watcher's log in the review's checkout names `merge` as its culprit, and the fake
    `gh` answers `run list` with one `ci` run of that conclusion (every other call goes to the
    world's own fake)."""
    main_watch.Log(world.main / main_watch.DEFAULT_LOG).write(
        "culprit", main_watch.short_of(merge), "#12"
    )
    real = world.bin / "gh-world"
    (world.bin / "gh").rename(real)
    script = RED_GH.format(python=sys.executable, conclusion=conclusion, real=str(real))
    (world.bin / "gh").write_text(script)
    (world.bin / "gh").chmod(0o755)


def test_a_pr_reverting_the_watchers_culprit_gets_no_model_and_a_pass(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    merge = landed(world, 12, "RATES: dict[str, int] = {'a': 1}\n")
    logged_culprit(world, merge)
    head = world.pr(13, {CODE: BASE_FILES[CODE]})
    done = world.run("13", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.claude_calls() == []
    record = world.record(13, head)
    assert record is not None, "no ledger record for the revert head"
    assert record["verdict"] == "PASS"


def test_a_revert_carrying_another_line_gets_its_lenses(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    logged_culprit(world, landed(world, 12, "RATES: dict[str, int] = {'a': 1}\n"))
    world.pr(13, {CODE: BASE_FILES[CODE] + "EXTRA = 1\n"})
    done = world.run("13", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.lens_calls(), "a revert carrying another change was passed without a lens"


def test_a_revert_of_a_merge_the_watcher_never_blamed_gets_its_lenses(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    """Reverting any old merge (a wall's, say) by hand is light by the tree, never passed by code."""
    world = World(tmp_path_factory.mktemp("world"))
    landed(world, 12, "RATES: dict[str, int] = {'a': 1}\n")
    world.pr(13, {CODE: BASE_FILES[CODE]})
    done = world.run("13", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.lens_calls(), "a revert of a merge no watcher blamed was passed without a lens"


def test_a_forged_culprit_line_for_a_merge_main_ran_green_gets_its_lenses(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    logged_culprit(world, landed(world, 12, "RATES: dict[str, int] = {'a': 1}\n"), "success")
    world.pr(13, {CODE: BASE_FILES[CODE]})
    done = world.run("13", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.lens_calls(), "a revert of a merge gh reads green was passed by code"


def test_a_revert_of_the_watchers_revert_is_not_passed_by_code(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    bad = repo.merge(12, {"app/bad.py": "BAD = 1\n"})
    git(repo.watch, "fetch", "-q", "origin")
    git(repo.watch, "checkout", "-q", "-B", "revert/x", "origin/main")
    git(repo.watch, "revert", "--no-edit", "-m", "1", bad)
    git(repo.watch, "push", "-q", "origin", "revert/x")
    reverting = repo.land(13, "revert/x")
    log = tmp_path / "w.log"
    main_watch.Log(log).write("culprit", main_watch.short_of(reverting), "#13")
    git(repo.watch, "fetch", "-q", "origin")
    git(repo.watch, "checkout", "-q", "-B", "again", "origin/main")
    git(repo.watch, "revert", "--no-edit", "-m", "1", reverting)
    head = git(repo.watch, "rev-parse", "HEAD")
    assert main_watch.light_tier(repo.watch, head) == "revert"
    forge = FakeForge({reverting: "failure"})
    assert not main_watch.watcher_revert(repo.watch, head, "origin/main", log, forge)


def test_a_change_with_no_merge_to_revert_is_not_light(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, {CODE: "RATES: dict[str, int] = {'b': 2}\n"})
    assert main_watch.light_tier(world.main, head, base="origin/main") is None


def test_an_unknown_ref_is_not_light(tmp_path: Path) -> None:
    assert main_watch.light_tier(tmp_path, "nope", base="origin/main") is None


def test_the_loop_runs_once_per_interval_and_logs_a_failed_pass(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    passes: list[Path] = []
    slept: list[float] = []

    def failing(*, repo: Path, forge: Any, log: Path) -> None:
        passes.append(repo)
        raise main_watch.GitError("git fetch: no network")

    def sleep(seconds: float) -> None:
        slept.append(seconds)
        if len(slept) == 3:
            raise KeyboardInterrupt

    monkeypatch.setattr(main_watch, "once", failing)
    with pytest.raises(KeyboardInterrupt):
        main_watch.run(
            repo=tmp_path, forge=main_watch.Gh(), log=tmp_path / "w.log", interval=90, sleep=sleep
        )
    assert len(passes) == 3
    assert slept == [90, 90, 90]
    lines = (tmp_path / "w.log").read_text().splitlines()
    assert lines
    assert all(" error " in line for line in lines)


def test_a_too_short_interval_is_refused() -> None:
    with pytest.raises(SystemExit):
        main_watch.main(["run", "--interval", "1"])


def gh_with(runs: list[dict[str, str]], monkeypatch: pytest.MonkeyPatch) -> main_watch.Gh:
    forge = main_watch.Gh()

    def fake(*args: str) -> str:
        assert args[:2] == ("run", "list"), args
        return json.dumps(runs)

    monkeypatch.setattr(forge, "_gh", fake)
    return forge


def run_row(workflow: str, status: str, conclusion: str, url: str = "u") -> dict[str, str]:
    return {"workflowName": workflow, "status": status, "conclusion": conclusion, "url": url}


@pytest.mark.parametrize(
    ("runs", "expected"),
    [
        ([run_row("ci", "completed", "success"), run_row("web", "completed", "success")], "success"),
        ([run_row("ci", "completed", "success"), run_row("web", "in_progress", "")], None),
        ([run_row("ci", "completed", "failure"), run_row("web", "in_progress", "")], "failure"),
        ([run_row("ci", "completed", "cancelled")], None),
        ([run_row("e2e", "completed", "failure"), run_row("ci", "completed", "success")], "success"),
        ([], None),
    ],
)
def test_the_real_forge_reads_a_commits_runs(
    runs: list[dict[str, str]], expected: str | None, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert gh_with(runs, monkeypatch).conclusion("a" * 40) == expected


def test_a_cancelled_run_is_rerun_once_and_waited_for(monkeypatch: pytest.MonkeyPatch) -> None:
    forge = main_watch.Gh()
    calls: list[tuple[str, ...]] = []
    row = {**run_row("ci", "completed", "cancelled"), "databaseId": 4242}

    def fake(*args: str) -> str:
        calls.append(args)
        return json.dumps([row]) if args[:2] == ("run", "list") else ""

    monkeypatch.setattr(forge, "_gh", fake)
    assert forge.conclusion("a" * 40) is None
    forge.forget()
    assert forge.conclusion("a" * 40) is None
    assert [c[:3] for c in calls if c[:2] == ("run", "rerun")] == [("run", "rerun", "4242")]


def test_the_red_runs_url_is_named(monkeypatch: pytest.MonkeyPatch) -> None:
    runs = [
        run_row("ci", "completed", "success", "green"),
        run_row("web", "completed", "failure", "red"),
    ]
    assert gh_with(runs, monkeypatch).run_url("a" * 40) == "red"


def test_the_f5_hook_runs_once_when_a_revert_lands(tmp_path: Path) -> None:
    origin, clone = tmp_path / "origin.git", tmp_path / "clone"
    subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(origin)], check=True)
    subprocess.run(["git", "clone", "-q", str(origin), str(clone)], check=True)
    for key, value in (("user.email", "w@example.invalid"), ("user.name", "w")):
        git(clone, "config", key, value)
    git(clone, "commit", "-q", "--allow-empty", "-m", "root")
    bad = git(clone, "rev-parse", "HEAD")
    git(clone, "commit", "-q", "--allow-empty", "-m", f"Revert\n\nThis reverts commit {bad}.")
    git(clone, "push", "-q", "origin", "HEAD:main")
    main_watch.fetch(clone)
    log = main_watch.Log(tmp_path / "w.log")
    log.write("revert-opened", main_watch.short_of(bad), "#900")
    calls: list[str] = []
    main_watch.landed(clone, log, lambda _repo, sha: calls.append(sha))
    main_watch.landed(clone, main_watch.Log(tmp_path / "w.log"), lambda _repo, sha: calls.append(sha))
    assert calls == [bad]


class FailingOnce(FakeForge):
    """A forge whose first `open_pr` fails the way `gh pr create` does."""

    def __init__(self, runs: dict[str, str | None]) -> None:
        super().__init__(runs)
        self.failed = False

    def open_pr(self, *, head: str, base: str, title: str, body: str) -> int:
        if not self.failed:
            self.failed = True
            raise subprocess.CalledProcessError(1, ["gh", "pr", "create"])
        return super().open_pr(head=head, base=base, title=title, body=body)


def test_a_failed_pr_open_is_logged_and_retried_without_a_second_branch(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    good = repo.merge(11, {"app/ok.py": "OK = 1\n"})
    bad = repo.merge(12, {"app/bad.py": "BAD = 1\n"})
    forge = FailingOnce({repo.root_sha: "success", good: "success", bad: "failure"})
    log = tmp_path / "w.log"
    main_watch.once(repo=repo.watch, forge=forge, log=log)
    assert forge.opened == []
    assert " error " in log.read_text()
    main_watch.once(repo=repo.watch, forge=forge, log=log)
    assert len(forge.opened) == 1
    assert len(repo.revert_branches()) == 1
    main_watch.once(repo=repo.watch, forge=forge, log=log)
    assert len(forge.opened) == 1


def test_no_green_run_in_the_walk_blames_nothing(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    bad = repo.merge(12, {"app/bad.py": "BAD = 1\n"})
    forge = FakeForge({repo.root_sha: "failure", bad: "failure"})
    log = tmp_path / "w.log"
    main_watch.once(repo=repo.watch, forge=forge, log=log)
    assert forge.opened == []
    assert " no-green " in log.read_text()


def revert_of(repo: Repo, files: dict[str, str | None]) -> str:
    """A head on the watcher's clone: main's tip with the merge of `files` reverted."""
    merge = repo.merge(81, files)
    git(repo.watch, "fetch", "-q", "origin")
    git(repo.watch, "checkout", "-q", "-B", "r", "origin/main")
    git(repo.watch, "revert", "--no-edit", "-m", "1", merge)
    return git(repo.watch, "rev-parse", "HEAD")


def test_a_revert_of_a_merge_of_non_ascii_paths_is_light(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    head = revert_of(repo, {"docs/café.md": "# café\n"})
    assert main_watch.light_tier(repo.watch, head) == "revert"


def test_a_change_too_wide_for_one_command_line_is_still_judged(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo = Repo(tmp_path)
    head = revert_of(repo, {f"app/m{i}.py": f"M = {i}\n" for i in range(3)})
    monkeypatch.setattr(main_watch, "PATHS", 2)
    assert main_watch.light_tier(repo.watch, head) == "revert"


def test_a_git_that_cannot_run_is_not_light(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    repo = Repo(tmp_path)
    head = revert_of(repo, {"app/a.py": "A = 1\n"})

    def too_long(*_: Any, **__: Any) -> str:
        raise OSError(7, "Argument list too long")

    monkeypatch.setattr(main_watch, "git", too_long)
    assert main_watch.light_tier(repo.watch, head) is None


def test_main_still_red_after_the_revert_landed_is_said_and_nothing_more_reverted(
    tmp_path: Path,
) -> None:
    repo = Repo(tmp_path)
    bad = repo.merge(12, {"app/bad.py": "BAD = 1\n"})
    also = repo.merge(13, {"app/also.py": "ALSO = 1\n"})
    forge = FakeForge({repo.root_sha: "success", bad: "failure", also: "failure"})
    log = tmp_path / "w.log"
    main_watch.once(repo=repo.watch, forge=forge, log=log)
    assert len(forge.opened) == 1
    landing = repo.land(forge.opened[0]["number"], forge.opened[0]["head"])
    forge.runs[landing] = "failure"
    main_watch.once(repo=repo.watch, forge=forge, log=log)
    main_watch.once(repo=repo.watch, forge=forge, log=log)
    assert len(forge.opened) == 1, "a merge that only inherited the culprit's red was reverted"
    text = log.read_text()
    assert text.count(" still-red ") == 1
    assert text.count(" landed ") == 1


def test_the_watchers_revert_reads_ready_in_ci_with_no_trailer(tmp_path: Path) -> None:
    """CI's gate (and so merge_ready's check e) runs the heavy jobs on the watcher's revert: it carries
    no Factory trailer, since nobody ran verify on it, and CI's result decides it."""
    repo = Repo(tmp_path)
    good = repo.merge(11, {"app/ok.py": "OK = 1\n"})
    bad = repo.merge(12, {"app/bad.py": "BAD = 1\n"})
    forge = FakeForge({repo.root_sha: "success", good: "success", bad: "failure"})
    main_watch.once(repo=repo.watch, forge=forge, log=tmp_path / "w.log")
    git(repo.watch, "fetch", "-q", "origin")
    head = git(repo.watch, "rev-parse", f"refs/remotes/origin/{forge.opened[0]['head']}")
    assert ci_gate.ready_commit(head, cwd=repo.watch, reverts=True) == head
    # publish's reading stays the trailer's: no verify ran on this tree.
    assert ci_gate.ready_commit(head, cwd=repo.watch) is None
    assert ci_gate.ready_commit(head, cwd=repo.watch, clean_merges=True) is None


def test_ci_and_merge_ready_read_the_watchers_revert(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo = Repo(tmp_path)
    head = revert_of(repo, {"app/a.py": "A = 1\n"})
    monkeypatch.chdir(repo.watch)
    assert ci_gate.is_ready(head)


def test_a_revert_carrying_more_does_not_read_ready_in_ci(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    head = revert_of(repo, {"app/a.py": "A = 1\n"})
    (repo.watch / "extra.py").write_text("X = 1\n")
    git(repo.watch, "add", "extra.py")
    git(repo.watch, "commit", "-q", "--amend", "--no-edit")
    head = git(repo.watch, "rev-parse", "HEAD")
    assert ci_gate.ready_commit(head, cwd=repo.watch, reverts=True) is None


@pytest.mark.parametrize("module", ["ci_gate.py", "main_watch.py", "trailers.py", "__init__.py"])
def test_the_ci_gates_imports_read_on_the_runners_python3(module: str) -> None:
    """CI's `changes` job runs `python3 -m scripts.factory.ci_gate` on the runner's own python3 (3.12 on
    ubuntu-24.04), so nothing ci_gate imports may use newer syntax."""
    source = (Path(__file__).resolve().parents[1] / module).read_text()
    ast.parse(source, feature_version=(3, 12))
