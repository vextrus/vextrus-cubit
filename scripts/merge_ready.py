"""`python -m scripts.merge_ready <PR>`: may the orchestrator merge this PR now? (ADR 0041)

The ruleset requires `real-drawings` and `design-gate` but does not pin who posts them, and the
orchestrator's token could post a status. So before any merge this reads the PR head's statuses and check
runs through GraphQL and passes only when:

- `real-drawings` and `design-gate` are both success, each posted by the owner's GitHub App
  (`vextrus-status`), or by main's not-applicable workflow (`github-actions`, "Not applicable: …");
- no other status context is anything but success, whoever posted it;
- the `ci` check run succeeded, and no check run failed, was cancelled or timed out, or is still running.

It prints each finding and exits 0 (ready) or 1 (not ready). It reads; it never posts or merges.
"""

import json
import subprocess
import sys
from collections.abc import Callable
from typing import Any

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


def main(argv: list[str] | None = None, get: Fetch = fetch) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1 or not args[0].isdigit():
        print("usage: python -m scripts.merge_ready <PR number>", file=sys.stderr)
        return 2
    found = problems(get(int(args[0])))
    for problem in found:
        print(f"merge-ready: {problem}")
    if not found:
        print(f"merge-ready: PR {args[0]} may be merged")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
