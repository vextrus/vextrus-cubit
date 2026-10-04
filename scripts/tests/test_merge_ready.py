"""merge-ready (ADR 0041): the orchestrator merges only when both gates were posted by the App (or main's
not-applicable workflow) and every check passed."""

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from scripts.merge_ready import main, problems

HEAD = "0123456789abcdef0123456789abcdef01234567"


def status(
    context: str, login: str = "vextrus-status", state: str = "SUCCESS", text: str = ""
) -> dict[str, Any]:
    return {"context": context, "state": state, "description": text, "creator": {"login": login}}


def check(name: str, conclusion: str | None = "SUCCESS", state: str = "COMPLETED") -> dict[str, Any]:
    return {"name": name, "status": state, "conclusion": conclusion}


def pull(
    contexts: list[dict[str, Any]], runs: list[dict[str, Any]] | None = None, state: str = "OPEN"
) -> dict[str, Any]:
    runs = [check("ci"), check("python"), check("check-sandbox", "SKIPPED")] if runs is None else runs
    return {
        "state": state,
        "headRefOid": HEAD,
        "commits": {
            "nodes": [
                {
                    "commit": {
                        "oid": HEAD,
                        "status": {"contexts": contexts},
                        "checkSuites": {
                            "nodes": [{"checkRuns": {"nodes": []}}, {"checkRuns": {"nodes": runs}}]
                        },
                    }
                }
            ]
        },
    }


READY = pull([status("real-drawings"), status("design-gate")])
MARKER = f"<!-- vextrus-review round=1 head={HEAD} verdict=PASS findings=0 -->"


def reviewed(ledger: Path, *, recorded: bool = True) -> dict[str, Any]:
    """`main`'s review-gate seams for PR 105 at HEAD: a ledger PASS (unless not recorded)."""
    ledger.mkdir(exist_ok=True)
    if recorded:
        record = {
            "schema_version": 1,
            "pr": 105,
            "head": HEAD,
            "round": 1,
            "verdict": "PASS",
            "counts": dict.fromkeys(
                ("reviewers", "findings", "findings_ge_50", "confirmed", "refuted", "unproven"), 0
            )
            | {"reviewers": 2, "unrefuted_ge_50": 0},
            "decision_input_sha256": "ab" * 32,
            "comment_id": 7,
            "exception": None,
            "source": "review-pr",
            "recorded_at": "2026-10-05T10:00:00Z",
        }
        (ledger / f"105-{HEAD}.json").write_text(json.dumps(record))
    facts = {
        "pr": 105,
        "head": HEAD,
        "base": "f" * 40,
        "title": "t",
        "body": "Not verified: nothing.\n",
        "branch": "b",
        "comments": [{"id": 7, "body": MARKER}],
        "files": ["a.py"],
        "diff": "+x\n",
        "messages": ["m"],
    }
    return {
        "facts": lambda pr: copy.deepcopy(facts),
        "ledger_dir": ledger,
        "repo": ledger,
        "scan": lambda kind, text: 0,
        "issue_open": lambda number: True,
    }


def test_both_gates_by_the_app_and_green_checks_are_ready(tmp_path: Path) -> None:
    assert problems(READY) == []
    assert main(["105"], get=lambda pr: READY, **reviewed(tmp_path / "ledger")) == 0


def test_green_checks_with_no_ledger_pass_are_not_ready(tmp_path: Path) -> None:
    gate = reviewed(tmp_path / "ledger", recorded=False)
    assert main(["105"], get=lambda pr: READY, **gate) == 1


def test_not_applicable_from_mains_workflow_is_ready() -> None:
    na = "Not applicable: this PR changes no engine path"
    assert (
        problems(pull([status("real-drawings", "github-actions", text=na), status("design-gate")])) == []
    )


@pytest.mark.parametrize("login", ["riz", "someone-else", "github-actions", ""])
def test_a_gate_posted_by_anyone_else_is_refused(login: str) -> None:
    [problem] = problems(
        pull([status("real-drawings"), status("design-gate", login, text="passed 1-11")])
    )
    assert problem.startswith("design-gate: posted by")


def test_a_missing_or_failed_gate_is_refused() -> None:
    assert problems(pull([status("design-gate")])) == ["real-drawings: not posted"]
    failed = pull([status("real-drawings", state="FAILURE"), status("design-gate")])
    assert problems(failed) == ["real-drawings: failure"]


def test_a_failed_pending_or_missing_check_is_refused() -> None:
    gates = [status("real-drawings"), status("design-gate")]
    assert problems(pull(gates, [check("ci"), check("python", "FAILURE")])) == ["check python: failure"]
    assert problems(pull(gates, [check("ci"), check("web", None, "IN_PROGRESS")])) == [
        "check web: in_progress"
    ]
    assert problems(pull(gates, [check("python")])) == ["ci: not succeeded"]


def test_statuses_of_an_older_head_or_a_closed_pr_are_refused(tmp_path: Path) -> None:
    stale = copy.deepcopy(READY)
    stale["headRefOid"] = "f" * 40
    assert problems(stale) == ["the statuses read are not the head's: run again"]
    assert problems(pull([], state="MERGED")) == ["the PR is merged, not open"]
    assert main(["x"], get=lambda pr: READY) == 2
    assert main(["105"], get=lambda pr: pull([]), **reviewed(tmp_path / "ledger")) == 1


def test_the_default_leak_scan_maps_each_hit_to_its_part(monkeypatch: pytest.MonkeyPatch) -> None:
    import subprocess

    from scripts.merge_ready import PrScan

    out = (
        "HIT web/src/a.ts:3 1\nHIT commit:0123456789ab:2 1\nHIT name:0 1\nHIT pr:105:branch 1\n"
        "HIT pr:105:title 1\nHIT pr:105:body:4 2\nHIT pr:105:comment:77:1 1\n"
        "leakscan: hits=8 scanned=40 corpus=0123456789ab\n"
    )

    def fake(*args: Any, **kwargs: Any) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args[0], 1, out, "")

    monkeypatch.setattr(subprocess, "run", fake)
    scan = PrScan(105)
    hits = {kind: scan(kind, "") for kind in ("diff", "messages", "files", "branch", "title")}
    assert hits == dict.fromkeys(("diff", "messages", "files", "branch", "title"), 1)
    assert (scan("body", ""), scan("comments", "")) == (2, 1)


@pytest.mark.parametrize(
    ("code", "out"),
    [
        (2, "leakscan: cannot-scan gh-failed\n"),
        (0, "HIT pr:105:title 1\nleakscan: hits=0 scanned=1 corpus=0123456789ab\n"),
        (1, "HIT pr:105:mystery 1\nleakscan: hits=1 scanned=1 corpus=0123456789ab\n"),
    ],
    ids=["cannot-scan", "count-mismatch", "unknown-part"],
)
def test_the_default_leak_scan_fails_closed(
    monkeypatch: pytest.MonkeyPatch, code: int, out: str
) -> None:
    import subprocess

    from scripts.merge_ready import PrScan

    def fake(*args: Any, **kwargs: Any) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args[0], code, out, "")

    monkeypatch.setattr(subprocess, "run", fake)
    with pytest.raises(RuntimeError):
        PrScan(105)("title", "")


def test_a_fix_on_a_later_clean_merge_outranks_an_older_pass(tmp_path: Path) -> None:
    import subprocess

    from scripts.merge_ready import review_problems

    def git(*args: str) -> str:
        done = subprocess.run(["git", "-C", str(tmp_path), *args], capture_output=True, text=True)
        return done.stdout.strip()

    def commit(name: str, text: str) -> str:
        (tmp_path / name).write_text(text)
        git("add", name)
        git("commit", "-q", "-m", name)
        return git("rev-parse", "HEAD")

    git("init", "-q", "-b", "main")
    for key, value in (
        ("user.email", "t@example.invalid"),
        ("user.name", "t"),
        ("commit.gpgsign", "false"),
    ):
        git("config", key, value)
    commit("a.txt", "a\n")
    git("checkout", "-q", "-b", "ticket")
    h0 = commit("b.txt", "b\n")
    heads = [h0]
    for name in ("c.txt", "d.txt"):
        git("checkout", "-q", "main")
        base = commit(name, "main\n")
        git("checkout", "-q", "ticket")
        git("merge", "-q", "--no-edit", "main")
        heads.append(git("rev-parse", "HEAD"))
    ledger = tmp_path / ".ledger"
    reviewed(ledger, recorded=False)
    for head, verdict, comment in ((h0, "PASS", 7), (heads[1], "FIX", 8)):
        record = {
            "schema_version": 1,
            "pr": 105,
            "head": head,
            "round": 1 if verdict == "PASS" else 2,
            "verdict": verdict,
            "counts": dict.fromkeys(
                ("reviewers", "findings", "findings_ge_50", "confirmed", "refuted", "unproven"), 1
            )
            | {"unrefuted_ge_50": 0},
            "decision_input_sha256": "ab" * 32,
            "comment_id": comment,
            "exception": None,
            "source": "review-pr",
            "recorded_at": "2026-10-05T10:00:00Z",
        }
        (ledger / f"105-{head}.json").write_text(json.dumps(record))
    marker = f"<!-- vextrus-review round=1 head={h0} verdict=PASS findings=0 -->"
    facts = {
        "pr": 105,
        "head": heads[2],
        "base": base,
        "title": "t",
        "body": "",
        "branch": "b",
        "comments": [{"id": 7, "body": marker}],
        "files": [],
        "diff": "",
        "messages": [],
    }
    found = review_problems(
        facts, ledger_dir=ledger, repo=tmp_path, scan=lambda k, t: 0, issue_open=lambda n: True
    )
    assert any("FIX" in problem for problem in found)


class Git:
    """A tmp repo: main, and the PR's branch whose reviewed head R has a ledger PASS (comment 7)."""

    def __init__(self, root: Path) -> None:
        import subprocess

        self.root, self.run = root, subprocess.run
        root.mkdir()
        self("init", "-q", "-b", "main")
        for key, value in (("user.email", "t@example.invalid"), ("user.name", "t")):
            self("config", key, value)
        self("config", "commit.gpgsign", "false")
        self.commit({"sec.py": "check=False\n", "f.py": "base\n"})
        self("checkout", "-q", "-b", "pr")
        self.early = self.commit({"f.py": "evil()\n"})
        self.reviewed = self.commit({"f.py": "good()\n"})
        self("checkout", "-q", "main")
        self.base = self.commit({"sec.py": "check=True\n"})
        self("checkout", "-q", "pr")

    def __call__(self, *args: str, check: bool = True) -> str:
        done = self.run(["git", "-C", str(self.root), *args], capture_output=True, text=True)
        assert done.returncode == 0 or not check, done.stderr
        return done.stdout.strip()

    def commit(self, files: dict[str, str]) -> str:
        for name, text in files.items():
            (self.root / name).write_text(text)
            self("add", name)
        self("commit", "-q", "-m", "change")
        return self("rev-parse", "HEAD")

    def problems(self, head: str, ledger: Path) -> list[str]:
        from scripts.merge_ready import review_problems

        record = json.loads(next(ledger.glob("105-*.json")).read_text()) | {"head": self.reviewed}
        for path in ledger.glob("105-*.json"):
            path.unlink()
        (ledger / f"105-{self.reviewed}.json").write_text(json.dumps(record))
        marker = f"<!-- vextrus-review round=1 head={self.reviewed} verdict=PASS findings=0 -->"
        facts = {
            "pr": 105,
            "head": head,
            "base": self.base,
            "title": "t",
            "body": "",
            "branch": "pr",
            "comments": [{"id": 7, "body": marker}],
            "files": [],
            "diff": "",
            "messages": [],
        }
        return review_problems(
            facts, ledger_dir=ledger, repo=self.root, scan=lambda k, t: 0, issue_open=lambda n: True
        )


def test_only_a_clean_two_parent_merge_of_main_extends_a_pass(tmp_path: Path) -> None:
    """The refuter's attacks on gate (a): an octopus merge bringing back a pre-review commit, a merge
    keeping our side (`-s ours`) and a hand-resolved conflict all show nothing under `diff-tree --cc`."""
    repo = Git(tmp_path / "repo")
    ledger = tmp_path / "ledger"
    reviewed(ledger)
    repo("merge", "-q", "--no-edit", "main")
    assert repo.problems(repo("rev-parse", "HEAD"), ledger) == []

    repo("reset", "-q", "--hard", repo.reviewed)
    repo("merge", "-q", "--no-edit", "-s", "ours", "main")
    [problem] = repo.problems(repo("rev-parse", "HEAD"), ledger)
    assert "re-review the resolution" in problem

    repo("reset", "-q", "--hard", repo.reviewed)
    tree = repo("rev-parse", f"{repo.early}^{{tree}}")
    octopus = repo(
        "commit-tree", tree, "-p", repo.reviewed, "-p", repo.base, "-p", repo.early, "-m", "m"
    )
    [problem] = repo.problems(octopus, ledger)
    assert "not a merge of main" in problem

    repo("checkout", "-q", "main")
    repo.base = repo.commit({"f.py": "main's\n"})
    repo("checkout", "-q", "pr")
    repo("merge", "-q", "--no-edit", "main", check=False)
    (repo.root / "f.py").write_text("good()\n")
    repo("add", "f.py")
    repo("commit", "-q", "--no-edit")
    [problem] = repo.problems(repo("rev-parse", "HEAD"), ledger)
    assert "re-review the resolution" in problem


@pytest.mark.parametrize(
    ("answer", "open_"),
    [
        ({"state": "OPEN", "url": "https://github.com/vextrus/vextrus-cubit/issues/7"}, True),
        ({"state": "OPEN", "url": "https://github.com/vextrus/vextrus-cubit/pull/7"}, False),
        ({"state": "CLOSED", "url": "https://github.com/vextrus/vextrus-cubit/issues/7"}, False),
        ({"state": "OPEN"}, False),
    ],
    ids=["open-issue", "open-pull-request", "closed-issue", "no-url"],
)
def test_only_an_open_issue_not_a_pull_request_counts(
    monkeypatch: pytest.MonkeyPatch, answer: dict[str, str], open_: bool
) -> None:
    """`gh issue view` answers OPEN for a pull request's number too (review F2)."""
    import subprocess

    from scripts.merge_ready import issue_is_open

    def fake(*args: Any, **kwargs: Any) -> subprocess.CompletedProcess[str]:
        assert "state,url" in args[0]
        return subprocess.CompletedProcess(args[0], 0, json.dumps(answer), "")

    monkeypatch.setattr(subprocess, "run", fake)
    assert issue_is_open(7) is open_


@pytest.mark.parametrize(
    ("heading", "gated"),
    [
        ("## Cut items", True),
        ("## Cut: tier 2", True),
        ("### Not  done yet", True),
        ("## Cutting", False),
    ],
)
def test_a_gated_heading_is_matched_by_its_first_word(heading: str, gated: bool) -> None:
    from scripts.merge_ready import cut_problems

    assert bool(cut_problems(f"{heading}\n- the land script\n", lambda n: True)) is gated
