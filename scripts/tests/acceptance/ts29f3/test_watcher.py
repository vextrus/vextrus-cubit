"""S29-F3: the main watcher (docs/plans/factory-s29.md item 3; the owner's rulings Q19 and Q20, 14 Oct
2026: ordinary PRs merge on their own green CI on the "Condition: a main watcher that reverts a red
main's culprit at once").

"When main goes red, find the culprit among the merges since the last green run, open a revert PR at
once and land it by the light path." Exit criterion: "a planted red commit on a throwaway branch is
reverted". Measure: "Main red after a bad merge | 77 min (13 Oct) | 15 min or less, by automatic
revert | the watcher's log".

The seam (named here, built by the ticket): `scripts.factory.main_watch.once(repo=, forge=, log=)` does
one pass on the clone `repo` against its `origin`; the gh calls go through `forge` (`_repo.FakeForge`);
the log path is injectable. `python -m scripts.factory.main_watch once` is the command.

Choices this file pins (the plan does not decide them otherwise):
- the culprit is the EARLIEST red merge among main's first-parent merges after the newest green one;
- a merge with no finished run is waited for: never blamed, and no later red merge is reverted past it
  in the same pass (it may be the culprit itself);
- a single red followed by a green merge is not reverted: main's newest finished run decides;
- every log line opens with a UTC time `YYYY-MM-DDTHH:MM:SSZ` and an event word; the four events the
  measure needs are `red`, `culprit`, `revert-opened` and `landed` (the culprit's lines name its short
  sha); other event words are the builder's.
"""

import importlib
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from scripts.tests.acceptance.ts29f3._repo import FakeForge, Repo, git, short_of

REPO_ROOT = Path(__file__).resolve().parents[4]
LINE = re.compile(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ) (\S+)(.*)$")
OK = {"app/ok.py": "VALUE = 1\n"}
PLANTED = {"app/planted_red.py": "assert False, 'planted red'\n"}


def watcher() -> Any:
    return importlib.import_module("scripts.factory.main_watch")


def once(repo: Repo, forge: FakeForge, log: Path) -> None:
    watcher().once(repo=repo.watch, forge=forge, log=log)


def events(log: Path) -> list[tuple[str, str, str]]:
    """`(time, event, rest)` of each line; every line must be an event line."""
    assert log.exists(), "the watcher wrote no log"
    found = []
    for line in log.read_text().splitlines():
        match = LINE.match(line)
        assert match, f"not an event line with a UTC time: {line!r}"
        found.append((match.group(1), match.group(2), match.group(3)))
    return found


def kinds(log: Path) -> list[str]:
    return [kind for _, kind, _ in events(log)] if log.exists() else []


def planted(repo: Repo) -> tuple[str, str]:
    """Main: root (green), PR 11 (green), PR 12 planting a red file (red). The two merges' shas."""
    good = repo.merge(11, OK)
    bad = repo.merge(12, PLANTED)
    return good, bad


def test_the_planted_red_merge_is_reverted_by_a_revert_branch(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    good, bad = planted(repo)
    forge = FakeForge({repo.root_sha: "success", good: "success", bad: "failure"})
    main_before = repo.origin_main()
    once(repo, forge, tmp_path / "main-watch.log")
    branches = repo.revert_branches()
    assert len(branches) == 1, f"revert branches on origin: {branches}"
    branch = branches[0]
    assert short_of(branch, bad), f"{branch} is not revert/<short sha> of the red merge {bad}"
    assert git(repo.origin, "rev-parse", f"{branch}^") == main_before, (
        "the revert is not cut from main's tip"
    )
    assert repo.diff_names(main_before, branch) == ["D\tapp/planted_red.py"], (
        "the revert changes more than the culprit"
    )
    assert "app/ok.py" in repo.files_at(branch)
    message = git(repo.origin, "log", "-1", "--format=%B", branch)
    assert bad in message, "the revert commit does not name the merge it reverts"


def test_the_revert_pr_is_opened_against_main_once(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    good, bad = planted(repo)
    forge = FakeForge({repo.root_sha: "success", good: "success", bad: "failure"})
    once(repo, forge, tmp_path / "main-watch.log")
    assert len(forge.opened) == 1, forge.opened
    pr = forge.opened[0]
    assert pr["base"] == "main"
    assert short_of(pr["head"], bad), pr["head"]
    assert pr["head"] in repo.revert_branches()


def test_the_pr_body_names_the_culprit_pr_and_the_red_run(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    good, bad = planted(repo)
    forge = FakeForge({repo.root_sha: "success", good: "success", bad: "failure"})
    once(repo, forge, tmp_path / "main-watch.log")
    assert forge.opened, "no revert PR was opened"
    body = forge.opened[0]["body"]
    assert re.search(r"#12\b", body), f"the body does not name the culprit PR #12: {body!r}"
    assert forge.run_url(bad) in body, f"the body does not name the red run: {body!r}"
    assert not re.search(r"#11\b", body), "the body names the green PR #11"


def test_main_is_never_pushed_to(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    good, bad = planted(repo)
    forge = FakeForge({repo.root_sha: "success", good: "success", bad: "failure"})
    main_before = repo.origin_main()
    once(repo, forge, tmp_path / "main-watch.log")
    assert forge.opened, "no revert PR was opened"
    assert repo.origin_main() == main_before, "the watcher moved origin's main"


def test_the_culprit_is_the_earliest_red_merge_since_the_last_green(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    flaky = repo.merge(21, {"app/a.py": "A = 1\n"})
    green = repo.merge(22, {"app/b.py": "B = 1\n"})
    culprit = repo.merge(23, {"app/c.py": "C = 1\n"})
    later = repo.merge(24, {"app/d.py": "D = 1\n"})
    forge = FakeForge(
        {
            repo.root_sha: "success",
            flaky: "failure",
            green: "success",
            culprit: "failure",
            later: "failure",
        }
    )
    once(repo, forge, tmp_path / "main-watch.log")
    assert len(forge.opened) == 1, forge.opened
    branch = forge.opened[0]["head"]
    assert short_of(branch, culprit), f"{branch} does not revert PR 23's merge {culprit}"
    assert repo.diff_names(later, branch) == ["D\tapp/c.py"], "the revert is not exactly PR 23's merge"


def test_a_single_red_followed_by_a_green_merge_is_not_reverted(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    flaky = repo.merge(31, {"app/a.py": "A = 1\n"})
    green = repo.merge(32, {"app/b.py": "B = 1\n"})
    forge = FakeForge({repo.root_sha: "success", flaky: "failure", green: "success"})
    once(repo, forge, tmp_path / "main-watch.log")
    assert forge.opened == []
    assert repo.revert_branches() == []
    assert "culprit" not in kinds(tmp_path / "main-watch.log")


def test_a_merge_with_no_finished_run_is_never_blamed(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    running = repo.merge(41, {"app/a.py": "A = 1\n"})
    forge = FakeForge({repo.root_sha: "success", running: None})
    once(repo, forge, tmp_path / "main-watch.log")
    assert forge.opened == []
    assert repo.revert_branches() == []
    assert "culprit" not in kinds(tmp_path / "main-watch.log")


def test_an_unfinished_merge_before_a_red_one_is_waited_for(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    running = repo.merge(51, {"app/a.py": "A = 1\n"})
    red = repo.merge(52, {"app/b.py": "B = 1\n"})
    log = tmp_path / "main-watch.log"
    forge = FakeForge({repo.root_sha: "success", running: None, red: "failure"})
    once(repo, forge, log)
    assert forge.opened == [], (
        "a red merge was reverted past an earlier merge whose run had not finished"
    )
    forge.runs[running] = "success"
    once(repo, forge, log)
    assert len(forge.opened) == 1, forge.opened
    assert short_of(forge.opened[0]["head"], red), forge.opened[0]["head"]


def test_a_later_unfinished_merge_does_not_hold_back_the_revert(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    red = repo.merge(61, {"app/a.py": "A = 1\n"})
    running = repo.merge(62, {"app/b.py": "B = 1\n"})
    forge = FakeForge({repo.root_sha: "success", red: "failure", running: None})
    once(repo, forge, tmp_path / "main-watch.log")
    assert len(forge.opened) == 1, forge.opened
    assert short_of(forge.opened[0]["head"], red), forge.opened[0]["head"]


def test_a_culprit_already_reverted_is_not_reverted_twice(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    good, bad = planted(repo)
    log = tmp_path / "main-watch.log"
    forge = FakeForge({repo.root_sha: "success", good: "success", bad: "failure"})
    once(repo, forge, log)
    once(repo, forge, log)
    assert len(forge.opened) == 1, forge.opened
    assert len(repo.revert_branches()) == 1, repo.revert_branches()
    assert kinds(log).count("revert-opened") == 1, kinds(log)


def test_each_event_is_one_line_with_a_utc_time(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    good, bad = planted(repo)
    log = tmp_path / "logs" / "main-watch.log"
    forge = FakeForge({repo.root_sha: "success", good: "success", bad: "failure"})
    once(repo, forge, log)
    found = events(log)
    order = [kind for _, kind, _ in found]
    for kind in ("red", "culprit", "revert-opened"):
        assert order.count(kind) == 1, f"{kind!r} logged {order.count(kind)} times: {order}"
    assert order.index("red") < order.index("culprit") < order.index("revert-opened"), order
    short = forge.opened[0]["head"].removeprefix("revert/")
    for _, kind, rest in found:
        if kind in ("culprit", "revert-opened"):
            assert short in rest, f"the {kind} line does not name the culprit {short}: {rest!r}"
    times = [time for time, _, _ in found]
    assert times == sorted(times), "the log's times go backwards"


def test_landed_is_logged_when_the_revert_is_on_main(tmp_path: Path) -> None:
    repo = Repo(tmp_path)
    good, bad = planted(repo)
    log = tmp_path / "main-watch.log"
    forge = FakeForge({repo.root_sha: "success", good: "success", bad: "failure"})
    once(repo, forge, log)
    assert forge.opened, "no revert PR was opened"
    pr = forge.opened[0]
    landed = repo.land(pr["number"], pr["head"])
    forge.runs[landed] = None
    once(repo, forge, log)
    assert "app/planted_red.py" not in repo.files_at("refs/heads/main")
    assert kinds(log).count("landed") == 1, kinds(log)
    assert len(forge.opened) == 1, "the landed revert was opened again"
    forge.runs[landed] = "success"
    once(repo, forge, log)
    assert kinds(log).count("landed") == 1, kinds(log)
    assert len(forge.opened) == 1, forge.opened


def test_the_watcher_has_a_once_command() -> None:
    done = subprocess.run(
        [sys.executable, "-m", "scripts.factory.main_watch", "once", "--help"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stderr
