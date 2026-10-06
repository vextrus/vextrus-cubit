"""`python -m scripts.merge_ready <PR>`: may the orchestrator merge this PR now? (ADR 0041)

The ruleset requires `real-drawings` and `design-gate` but does not pin who posts them, and the
orchestrator's token could post a status. So before any merge this reads the PR head's statuses and check
runs through GraphQL and passes only when:

- `real-drawings` and `design-gate` are both success, each posted by the owner's GitHub App
  (`vextrus-status`), or by main's not-applicable workflow (`github-actions`, "Not applicable: …");
- no other status context is anything but success, whoever posted it;
- the `ci` check run succeeded, and no check run failed, was cancelled or timed out, or is still running.

Beside them, the review gate (docs/specs/factory.md 2.2 "Gate to merge"; `review_problems`) refuses:

- (a) no local ledger record (`.private/work/factory/ledger/<PR>-<head>.json`, `scripts/ledger.py`) for
  the head says PASS, or the newest review marker comment on the PR is not the ledger's (a forged or
  newer marker). A newer head than the reviewed one passes only if every commit since it is a merge of
  main whose own resolution (`git diff-tree --cc`) is empty: a resolved conflict is unreviewed code;
- (b) a round-3 record with no exception;
- (c) an item under a `## Cut`, `## Not done` or `## Deferred` heading of the body that links no open
  issue;
- (e) a head that `scripts/factory/ci_gate.py` reads not READY (no `Factory-State: READY` with this
  tree's `Factory-Verify`, and not a merge of main onto such a head): CI skips the heavy jobs on it, so
  a green `ci` there proves nothing ran;
- (d) a leak-scan hit (or no leak scan) on the PR's added lines, commit messages, file names, branch
  name, title, body or comments. A problem names the part and the count, never the text.

It prints each finding and exits 0 (ready) or 1 (not ready). It reads; it never posts or merges.
"""

import json
import re
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from scripts.factory import ci_gate
from scripts.ledger import default_ledger_dir

REPOSITORY = ("vextrus", "vextrus-cubit")
GATES = ("real-drawings", "design-gate")
APP = "vextrus-status"
ACTIONS = "github-actions"
NOT_APPLICABLE = "Not applicable:"
DONE_WELL = {"SUCCESS", "SKIPPED", "NEUTRAL"}
QUERY = """
query($owner: String!, $name: String!, $pr: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      state
      headRefOid
      commits(last: 1) { nodes { commit {
        oid
        status { contexts { context state description creator { login } } }
        checkSuites(first: 50) { nodes { checkRuns(first: 100) { nodes { name status conclusion } } } }
      } } }
    }
  }
}
"""

Fetch = Callable[[int], dict[str, Any]]
Scan = Callable[[str, str], int]
IssueOpen = Callable[[int], bool]

MARKER = re.compile(
    r"<!-- vextrus-review round=(\d+) head=([0-9a-f]{40}) verdict=(PASS|FIX|BLOCK) findings=(\d+) -->"
)
SHA = re.compile(r"[0-9a-f]{40}")
KINDS = ("diff", "messages", "files", "branch", "title", "body", "comments")
HEADING = re.compile(r"^ {0,3}#{1,6}[ \t]+(.*?)[ \t#]*$")
# A section starts at a heading whose first word is Cut or Deferred, or whose first two are Not done
# ("## Cut", "## Cut items", "## Cut: tier 2"); it ends at the next heading.
GATED = re.compile(r"(cut|deferred|not[ \t]+done)\b", re.IGNORECASE)
NOTHING = re.compile(r"^(?:[-*+][ \t]+)?(?:none|nothing)\.?$", re.IGNORECASE)
LIST_ITEM = re.compile(r"^ {0,6}(?:[-*+]|\d+[.)])[ \t]+")
ISSUE_LINK = re.compile(
    r"(?<![\w/&])#([0-9]+)\b|https://github\.com/vextrus/vextrus-cubit/issues/([0-9]+)\b"
)
REVIEW_QUERY = """
query($owner: String!, $name: String!, $pr: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      headRefOid headRefName baseRefOid baseRefName title body
      comments(last: 100) { nodes { databaseId body } }
      files(first: 100) { nodes { path } }
      commits(last: 250) { nodes { commit { message } } }
    }
  }
}
"""
COUNT_KEYS = ("reviewers", "findings", "findings_ge_50", "confirmed", "refuted", "unproven")


def fetch(pr: int) -> dict[str, Any]:
    """The PR from GitHub, through `gh api graphql` (reads only)."""
    owner, name = REPOSITORY
    fields = ["-f", f"query={QUERY}", "-F", f"pr={pr}", "-f", f"owner={owner}", "-f", f"name={name}"]
    done = subprocess.run(
        ["gh", "api", "graphql", *fields],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(done.stdout)["data"]["repository"]["pullRequest"]  # type: ignore[no-any-return]


def problems(pull: dict[str, Any]) -> list[str]:
    """Why this PR may not be merged now; empty when it may."""
    if pull["state"] != "OPEN":
        return [f"the PR is {pull['state'].lower()}, not open"]
    (node,) = pull["commits"]["nodes"]
    commit = node["commit"]
    if commit["oid"] != pull["headRefOid"]:
        return ["the statuses read are not the head's: run again"]
    found = []
    contexts = {c["context"]: c for c in (commit.get("status") or {}).get("contexts", [])}
    for gate in GATES:
        status = contexts.get(gate)
        if status is None:
            found.append(f"{gate}: not posted")
            continue
        creator = (status.get("creator") or {}).get("login", "")
        description = status.get("description") or ""
        by_app = creator == APP
        not_applicable = creator == ACTIONS and description.startswith(NOT_APPLICABLE)
        if not (by_app or not_applicable):
            found.append(
                f"{gate}: posted by {creator or 'no one'}, not the App {APP} or the not-applicable "
                "workflow: do not merge; say so to the owner"
            )
        elif status["state"] != "SUCCESS":
            found.append(f"{gate}: {status['state'].lower()}")
    for name, status in contexts.items():
        if name not in GATES and status["state"] != "SUCCESS":
            found.append(f"status {name}: {status['state'].lower()}")
    runs = [run for suite in commit["checkSuites"]["nodes"] for run in suite["checkRuns"]["nodes"]]
    if not any(run["name"] == "ci" and run["conclusion"] == "SUCCESS" for run in runs):
        found.append("ci: not succeeded")
    for run in runs:
        if run["status"] != "COMPLETED":
            found.append(f"check {run['name']}: {run['status'].lower()}")
        elif run["conclusion"] not in DONE_WELL:
            found.append(f"check {run['name']}: {str(run['conclusion']).lower()}")
    return found


def fetch_review(pr: int) -> dict[str, Any]:
    """What the review gate reads of the PR, through `gh` (reads only), and its head fetched locally."""
    owner, name = REPOSITORY
    fields = [
        "-f",
        f"query={REVIEW_QUERY}",
        "-F",
        f"pr={pr}",
        "-f",
        f"owner={owner}",
        "-f",
        f"name={name}",
    ]
    done = subprocess.run(["gh", "api", "graphql", *fields], capture_output=True, text=True, check=True)
    pull = json.loads(done.stdout)["data"]["repository"]["pullRequest"]
    diff = subprocess.run(
        ["gh", "pr", "diff", str(pr), "--repo", "/".join(REPOSITORY)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    subprocess.run(
        ["git", "fetch", "-q", "origin", f"refs/pull/{pr}/head", "refs/heads/main"],
        capture_output=True,
        check=True,
    )
    return {
        "pr": pr,
        "head": pull["headRefOid"],
        "base": pull["baseRefOid"],
        "base_branch": pull["baseRefName"],
        "title": pull["title"],
        "body": pull["body"] or "",
        "branch": pull["headRefName"],
        "comments": [
            {"id": node["databaseId"], "body": node["body"] or ""} for node in pull["comments"]["nodes"]
        ],
        "files": [node["path"] for node in pull["files"]["nodes"]],
        "diff": diff,
        "messages": [node["commit"]["message"] for node in pull["commits"]["nodes"]],
    }


class PrScan:
    """The default leak scan: `python -m tools.leakscan pr <PR>` once (contracts/leakscan-cli.md 2),
    its `HIT <where> <n>` lines summed per part. Raises when it cannot scan (fail closed)."""

    def __init__(self, pr: int) -> None:
        self.pr = pr
        self.hits: dict[str, int] | None = None

    def __call__(self, kind: str, text: str) -> int:
        if self.hits is None:
            self.hits = self.run()
        return self.hits[kind]

    def run(self) -> dict[str, int]:
        done = subprocess.run(
            [sys.executable, "-m", "tools.leakscan", "pr", str(self.pr)],
            capture_output=True,
            text=True,
            check=False,
        )
        lines = done.stdout.strip().splitlines()
        summary = re.fullmatch(r"leakscan: hits=([0-9]+) .*", lines[-1]) if lines else None
        if done.returncode not in (0, 1) or summary is None:
            raise RuntimeError("leak scan unavailable")
        hits = dict.fromkeys(KINDS, 0)
        for line in lines[:-1]:
            found = re.fullmatch(r"HIT (\S+) ([0-9]+)", line)
            if found is None:
                raise RuntimeError("leak scan output unreadable")
            hits[self.kind(found[1])] += int(found[2])
        if sum(hits.values()) != int(summary[1]) or (done.returncode == 1) != (int(summary[1]) > 0):
            raise RuntimeError("leak scan output unreadable")
        return hits

    def kind(self, where: str) -> str:
        part = f"pr:{self.pr}:"
        if where.startswith("commit:"):
            return "messages"
        if where.startswith("name:"):
            return "files"
        if where.startswith(part):
            named = where.removeprefix(part).split(":", 1)[0]
            parts = {"branch": "branch", "title": "title", "body": "body", "comment": "comments"}
            if named not in parts:
                raise RuntimeError("leak scan output unreadable")
            return parts[named]
        return "diff"


def issue_is_open(number: int) -> bool:
    """An open issue of this repository: `gh issue view` also answers OPEN for a pull request's number,
    so its URL must be an issue's."""
    done = subprocess.run(
        ["gh", "issue", "view", str(number), "--repo", "/".join(REPOSITORY), "--json", "state,url"],
        capture_output=True,
        text=True,
        check=True,
    )
    answer = json.loads(done.stdout)
    url = f"https://github.com/{'/'.join(REPOSITORY)}/issues/{number}"
    return bool(answer.get("state") == "OPEN" and answer.get("url") == url)


def scan_problems(facts: dict[str, Any], scan: Scan) -> list[str]:
    parts = {
        "diff": facts["diff"],
        "messages": "\n".join(facts["messages"]),
        "files": "\n".join(facts["files"]),
        "branch": facts["branch"],
        "title": facts["title"],
        "body": facts["body"],
        "comments": "\n".join(comment["body"] for comment in facts["comments"]),
    }
    found = []
    unavailable = False
    for kind in KINDS:
        try:
            hits = scan(kind, parts[kind])
        except Exception:
            unavailable = True
            continue
        if hits:
            found.append(f"leak scan: {hits} hit(s) in the PR's {kind}: remove them (never quote them)")
    if unavailable:
        found.append("leak scan unavailable: the PR cannot be scanned, so it may not merge")
    return found


def cut_problems(body: str, issue_open: IssueOpen) -> list[str]:
    """(c) Each item under a Cut, Not done or Deferred heading links an open issue of this repository."""
    found = []
    section: str | None = None
    item = 0
    nothing = False
    for line in body.splitlines():
        if heading := HEADING.match(line):
            gated = GATED.match(heading[1].strip())
            section, item = (" ".join(gated[1].lower().split()), 0) if gated else (None, 0)
            nothing = False
            continue
        if section is None or not line.strip():
            continue
        if NOTHING.match(line.strip()):
            nothing = True  # "None.": prose after it is not a cut item, a list item still is
            continue
        if nothing and not LIST_ITEM.match(line):
            continue
        item += 1
        numbers = {int(a or b) for a, b in ISSUE_LINK.findall(line)}
        where = f"'{section}' item {item}"
        if not numbers:
            found.append(f"{where} links no issue: file one and link it (#<n>)")
            continue
        try:
            if not any(issue_open(number) for number in sorted(numbers)):
                found.append(f"{where} links no open issue")
        except Exception:
            found.append(f"{where}: its issue's state cannot be read")
    return found


def record_problems(record: Any, pr: int, head: str) -> list[str]:
    """Why a ledger record is not shaped as `contracts/ledger-record.schema.json` says."""
    keys = {
        "schema_version",
        "pr",
        "head",
        "round",
        "verdict",
        "counts",
        "decision_input_sha256",
        "comment_id",
        "exception",
        "source",
        "recorded_at",
    }
    if not isinstance(record, dict) or set(record) != keys:
        return ["is not shaped as the contract says (its keys)"]
    counts = record["counts"]
    exception = record["exception"]
    checks = {
        "schema_version": record["schema_version"] == 1,
        "pr": record["pr"] == pr and _integer(record["pr"]),
        "head": record["head"] == head,
        "round": _integer(record["round"]) and 1 <= record["round"] <= 3,
        "verdict": record["verdict"] in ("PASS", "FIX", "BLOCK"),
        "counts": isinstance(counts, dict)
        and set(counts) == {*COUNT_KEYS, "unrefuted_ge_50"}
        and all(_integer(value) and value >= 0 for value in counts.values()),
        "decision_input_sha256": isinstance(record["decision_input_sha256"], str)
        and re.fullmatch(r"[0-9a-f]{64}", record["decision_input_sha256"]) is not None,
        "comment_id": _integer(record["comment_id"]) and record["comment_id"] >= 1,
        "exception": exception is None
        or (
            isinstance(exception, dict)
            and set(exception) == {"kind", "reason"}
            and exception["kind"] in ("security75", "crash", "false-statement", "fix-regression")
            and isinstance(exception["reason"], str)
            and 1 <= len(exception["reason"]) <= 300
        ),
        "source": record["source"] in ("review-pr", "fetch-verdict"),
        "recorded_at": isinstance(record["recorded_at"], str)
        and re.fullmatch(
            r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z", record["recorded_at"]
        )
        is not None,
    }
    return [f"has a bad {key}" for key, ok in checks.items() if not ok]


def _integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=False)


def merges_since(repo: Path, reviewed: str, head: str, base: str) -> str | None:
    """None when every commit from the reviewed head to this head is a clean merge of main; else why not.

    Each commit must have exactly two parents: one the reviewed head (or a merge already checked), the
    other an ancestor of main; and its tree must be the one `git merge-tree` makes from those two with no
    conflict. So an octopus merge, a merge naming an older commit of the PR, a merge that keeps one side
    (`-s ours`) and a hand-resolved conflict are all unreviewed code (`git diff-tree --cc` misses the
    last three when the result copies a parent's file whole)."""
    if _git(repo, "merge-base", "--is-ancestor", reviewed, head).returncode != 0:
        return "the reviewed head is not an ancestor of the PR's head"
    listed = _git(
        repo, "rev-list", "--topo-order", "--reverse", "--parents", head, "--not", reviewed, base
    )
    if listed.returncode != 0:
        return "the commits since the reviewed head cannot be read"
    checked = {reviewed}
    for row in listed.stdout.splitlines():
        commit, *parents = row.split()
        ours = [parent for parent in parents if parent in checked]
        theirs = [parent for parent in parents if parent not in checked]
        if len(parents) != 2 or len(ours) != 1 or len(theirs) != 1:
            return f"commit {commit[:12]} since the reviewed head is not a merge of main: review it"
        if _git(repo, "merge-base", "--is-ancestor", theirs[0], base).returncode != 0:
            return f"merge {commit[:12]} since the reviewed head does not merge main: review it"
        clean = _git(repo, "merge-tree", "--write-tree", "--no-messages", ours[0], theirs[0])
        tree = _git(repo, "rev-parse", f"{commit}^{{tree}}")
        if clean.returncode != 0:
            return f"merge {commit[:12]} resolved a conflict by hand: re-review the resolution"
        if tree.returncode != 0 or clean.stdout.split()[:1] != tree.stdout.split():
            return (
                f"merge {commit[:12]} differs from the clean merge of its parents: re-review the "
                "resolution"
            )
        checked.add(commit)
    return None if head in checked else "the PR's head is not reached by the merges checked: review it"


def ledger_problems(facts: dict[str, Any], ledger_dir: Path, repo: Path) -> list[str]:
    """(a) and (b): a ledger PASS for this head (or one before only clean merges of main), whose comment
    is the newest review marker on the PR, and no round 3 without an exception."""
    pr, head, base = facts["pr"], facts["head"], facts["base"]
    if not SHA.fullmatch(head):
        return ["the PR's head is not a full sha"]
    broken: list[str] = []
    stale: list[str] = []
    eligible: list[dict[str, Any]] = []
    for path in sorted(ledger_dir.glob(f"{pr}-*.json")) if ledger_dir.is_dir() else []:
        reviewed = path.stem.removeprefix(f"{pr}-")
        if not SHA.fullmatch(reviewed):
            continue
        try:
            record = json.loads(path.read_text())
        except OSError, ValueError:
            broken.append(f"the ledger record {path.name} cannot be read")
            continue
        if wrong := record_problems(record, pr, reviewed):
            broken.extend(f"the ledger record {path.name} {problem}" for problem in wrong)
            continue
        if reviewed != head and (why := merges_since(repo, reviewed, head, base)) is not None:
            if record["verdict"] == "PASS":
                stale.append(f"the ledger's PASS is for {reviewed[:12]}, not the head: {why}")
            continue
        eligible.append(record)
    # The newest record that covers this head decides: a FIX on a later clean merge outranks an
    # older PASS. A record that cannot be read refuses outright (fail closed).
    if broken:
        return broken
    chosen = max(eligible, key=lambda record: int(record["comment_id"]), default=None)
    if chosen is None:
        return stale or [f"no ledger record for head {head[:12]}: review it (/review-pr) and record it"]
    found = []
    if chosen["verdict"] != "PASS":
        found.append(f"the ledger says {chosen['verdict']} for {chosen['head'][:12]}, not PASS")
    if chosen["round"] == 3 and chosen["exception"] is None:
        found.append("the ledger's record is round 3 with no exception: two fix rounds at most")
    markers = [c for c in facts["comments"] if MARKER.search(c["body"] or "")]
    newest = max(markers, key=lambda comment: int(comment["id"]), default=None)
    if newest is None:
        found.append("the ledger's marker comment is not on the PR")
    elif int(newest["id"]) != chosen["comment_id"]:
        found.append(
            f"the newest review marker (comment {newest['id']}) is not the ledger's "
            f"(comment {chosen['comment_id']}): a marker the ledger did not post is ignored; re-review"
        )
    elif (marked := MARKER.search(newest["body"])) is not None and marked[3] != chosen["verdict"]:
        found.append("the ledger's marker comment does not carry the ledger's verdict")
    return found


def review_problems(
    facts: dict[str, Any],
    *,
    ledger_dir: Path,
    repo: Path,
    scan: Scan,
    issue_open: IssueOpen,
) -> list[str]:
    """Why the review gate refuses this PR (a) to (d); empty when it may merge."""
    return [
        *ledger_problems(facts, ledger_dir, repo),
        *cut_problems(facts["body"] or "", issue_open),
        *scan_problems(facts, scan),
    ]


def ready_problems(head: str, head_ready: Callable[[str], bool]) -> list[str]:
    """(e): the head reads READY by CI's own rule, else the heavy jobs were skipped on it."""
    try:
        ready = head_ready(head)
    except ci_gate.Unreadable as error:
        return [f"the head's READY trailer cannot be read: {error}"]
    if ready:
        return []
    return [
        (
            f"the head {head[:12]} is not Factory-State: READY (nor a merge of main onto one): CI "
            "skipped its heavy jobs; it needs a READY head"
        )
    ]


def main(
    argv: list[str] | None = None,
    get: Fetch = fetch,
    *,
    facts: Fetch = fetch_review,
    ledger_dir: Path | None = None,
    repo: Path | None = None,
    scan: Scan | None = None,
    issue_open: IssueOpen = issue_is_open,
    head_ready: Callable[[str], bool] | None = None,
) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1 or not args[0].isdigit():
        print("usage: python -m scripts.merge_ready <PR number>", file=sys.stderr)
        return 2
    pr = int(args[0])
    pull = get(pr)
    found = problems(pull)
    review = facts(pr)
    if review["head"] != pull["headRefOid"]:
        found.append("the head moved while reading the PR: run again")
    if review.get("base_branch", "main") != "main":
        found.append(f"the PR's base is {review['base_branch']}, not main")
    # The real head was fetched by `fetch_review`, so git can read it; facts a caller injects name no
    # commit git holds, so the READY reading runs on them only when the caller supplies it.
    if head_ready is None and facts is fetch_review:
        head_ready = ci_gate.is_ready
    if head_ready is not None:
        found += ready_problems(review["head"], head_ready)
    found += review_problems(
        review,
        ledger_dir=default_ledger_dir() if ledger_dir is None else ledger_dir,
        repo=Path.cwd() if repo is None else repo,
        scan=PrScan(pr) if scan is None else scan,
        issue_open=issue_open,
    )
    for problem in found:
        print(f"merge-ready: {problem}")
    if not found:
        print(f"merge-ready: PR {args[0]} may be merged")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
