"""A fake `gh` 2.45 on PATH for S14-L6, answering for several PRs, and the git worlds tests land from.

`install(root, monkeypatch, prs)` writes an executable `gh` into `root/bin`, puts it first on PATH and
returns a `Fake` that reads the scripted state and the argv log. `prs` maps a PR number to:

- `head`: the PR's current head (40 hex);
- `files`: the paths the PR changes;
- `rollups`: `{head: [payload, ...]}`, the statusCheckRollup payloads GitHub shows for that head, served
  in order on each read of that head's checks (the last one repeats; a head with none scripted has an
  empty rollup). A read is counted per head in `served`;
- `update`: what `PUT .../pulls/<n>/update-branch` does: `{"head": <sha>, "update_ref": [<git dir>,
  <ref>]}` moves the head (202), anything else answers 422 "There are no new commits on the base
  branch.";
- `race_head`: a push that lands on the PR's branch just as the update request arrives: the head becomes
  this sha before the request's `expected_head_sha` is compared, so the request answers 422 "expected
  head sha didn't match current head ref.";
- `logs`: `{job id: text}` for `gh run view --job <id> --log-failed`.

What it answers (`--repo R` / `-R R` ignored), as gh 2.45 does:

- `pr view <n> --json <fields> [-q .<field>]`: `headRefOid`, `files` (`[{"path": ...}]`) and
  `statusCheckRollup` (the PR's current head's next payload; its `headRefOid` is the current head);
- `pr diff <n> --name-only`: the files, one per line;
- `api repos/vextrus/vextrus-cubit/pulls/<n>/files` (GET, `--paginate` too): `[{"filename": ...}]`;
- `api repos/vextrus/vextrus-cubit/commits/<sha>/check-runs` (GET): that head's next payload's CheckRuns
  in the REST shape (`{"total_count", "check_runs": [{"name", "status", "conclusion", "head_sha"}]}`);
- `api --method PUT repos/vextrus/vextrus-cubit/pulls/<n>/update-branch -f expected_head_sha=<sha>`
  (`-X PUT`, `--method=PUT` too): as above; a 422 exits 1 with the body on stdout and `gh: <message>
  (HTTP 422)` on stderr, as `gh api` does;
- `pr update-branch`: exit 1, unknown command (gh 2.45 has none);
- `pr ready`, `pr merge <n> ... --match-head-commit <sha>`: ok and recorded (a merge records the head and
  how many reads of that head's checks had been served by then);
- `run view ... --job <id> --log-failed`: the scripted log; `run rerun <run> --failed`: ok.

Anything else exits 1 ("unscripted").
"""

import itertools
import json
import os
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

FIXTURES = Path(__file__).parents[1] / "p6_land" / "fixtures"
REPOSITORY = "vextrus/vextrus-cubit"
CI_JOB = "111597106799"

SCRIPT = """#!{python}
import json, re, subprocess, sys
from pathlib import Path

DOCS = "https://docs.github.com/rest/pulls/pulls#update-a-pull-request-branch"
STATE = Path({state!r})
LOG = Path({log!r})


def fail(message):
    sys.stderr.write(message + "\\n")
    sys.exit(1)


def option(args, name):
    if name in args and args.index(name) + 1 < len(args):
        return args[args.index(name) + 1]
    for part in args:
        if part.startswith(name + "="):
            return part.split("=", 1)[1]
    return None


argv = sys.argv[1:]
with LOG.open("a") as log:
    log.write(json.dumps(argv) + "\\n")
state = json.loads(STATE.read_text())
args = []
skip = False
for part in argv:
    if skip:
        skip = False
        continue
    if part in ("--repo", "-R"):
        skip = True
        continue
    if part.startswith("--repo="):
        continue
    args.append(part)


def save():
    STATE.write_text(json.dumps(state))


def show(payload):
    query = option(args, "-q") or option(args, "--jq")
    if query is None:
        print(json.dumps(payload))
    elif query.startswith(".") and query[1:] in payload:
        value = payload[query[1:]]
        print(value if isinstance(value, str) else json.dumps(value))
    else:
        fail("unscripted query: " + query)


def pr_of(number):
    pr = state["prs"].get(str(number))
    if pr is None:
        fail("GraphQL: Could not resolve to a PullRequest with the number of " + str(number) + ".")
    return pr


def next_rollup(pr, head):
    served = pr.setdefault("served", {{}})
    served[head] = served.get(head, 0) + 1
    views = pr.get("rollups", {{}}).get(head) or [[]]
    entries = views[min(served[head], len(views)) - 1]
    save()
    return entries


FIELDS = ("-f", "-F", "--field", "--raw-field")
method = option(args, "--method") or option(args, "-X")
method = method or ("POST" if any(part in FIELDS for part in args) else "GET")

if args[:2] == ["pr", "view"] and len(args) > 2:
    pr = pr_of(args[2])
    fields = [f for f in (option(args, "--json") or "").split(",") if f]
    payload = {{}}
    for field in fields:
        if field == "headRefOid":
            payload[field] = pr["head"]
        elif field == "files":
            payload[field] = [{{"path": p, "additions": 1, "deletions": 0}} for p in pr["files"]]
        elif field == "statusCheckRollup":
            payload[field] = next_rollup(pr, pr["head"])
        elif field == "number":
            payload[field] = int(args[2])
        else:
            fail("unscripted pr view field: " + field)
    show(payload)
    sys.exit(0)
if args[:2] == ["pr", "diff"] and len(args) > 2 and "--name-only" in args:
    sys.stdout.write("".join(p + "\\n" for p in pr_of(args[2])["files"]))
    sys.exit(0)
if args[:2] == ["pr", "ready"]:
    state.setdefault("ready", []).append(args[2])
    save()
    sys.exit(0)
if args[:2] == ["pr", "update-branch"]:
    fail('unknown command "update-branch" for "gh pr"\\n\\nUsage:  gh pr <command> [flags]')
if args[:2] == ["pr", "merge"] and option(args, "--match-head-commit"):
    pr = pr_of(args[2])
    sha = option(args, "--match-head-commit")
    if sha != pr["head"]:
        fail("GraphQL: Head branch was modified. Review and try the merge again. (mergePullRequest)")
    state.setdefault("merged", []).append(
        {{"pr": int(args[2]), "sha": sha, "served": pr.get("served", {{}}).get(sha, 0)}}
    )
    save()
    sys.exit(0)
if args[:2] == ["run", "view"] and "--log-failed" in args:
    job = option(args, "--job")
    for pr in state["prs"].values():
        if job in pr.get("logs", {{}}):
            sys.stdout.write(pr["logs"][job])
            sys.exit(0)
    fail("unscripted log for job " + str(job))
if args[:2] == ["run", "rerun"] and "--failed" in args:
    sys.exit(0)
if args[:1] == ["api"]:
    path = next((p for p in args[1:] if p.lstrip("/").startswith("repos/")), "").lstrip("/")
    files = re.fullmatch(r"repos/vextrus/vextrus-cubit/pulls/([0-9]+)/files(\\?.*)?", path)
    if files and method == "GET":
        print(json.dumps([{{"filename": p, "status": "modified"}} for p in pr_of(files[1])["files"]]))
        sys.exit(0)
    runs = re.fullmatch(r"repos/vextrus/vextrus-cubit/commits/([0-9a-f]{{40}})/check-runs(\\?.*)?", path)
    if runs and method == "GET":
        sha = runs[1]
        owner = next((pr for pr in state["prs"].values() if sha in pr.get("rollups", {{}})), None)
        entries = next_rollup(owner, sha) if owner is not None else []
        check_runs = [
            {{
                "name": e.get("name"),
                "status": str(e.get("status", "")).lower(),
                "conclusion": str(e["conclusion"]).lower() if e.get("conclusion") else None,
                "head_sha": sha,
                "html_url": e.get("detailsUrl"),
            }}
            for e in entries
            if e.get("__typename") == "CheckRun"
        ]
        print(json.dumps({{"total_count": len(check_runs), "check_runs": check_runs}}))
        sys.exit(0)
    update = re.fullmatch(r"repos/vextrus/vextrus-cubit/pulls/([0-9]+)/update-branch", path)
    if update and method == "PUT":
        pr = pr_of(update[1])
        fields = {{}}
        for index, part in enumerate(args[:-1]):
            if part in ("-f", "-F", "--field", "--raw-field") and "=" in args[index + 1]:
                key, value = args[index + 1].split("=", 1)
                fields[key] = value

        def refuse(message):
            save()
            print(json.dumps({{"message": message, "documentation_url": DOCS}}))
            fail("gh: " + message + " (HTTP 422)")

        if pr.get("race_head"):
            pr["head"] = pr.pop("race_head")
        if "expected_head_sha" in fields and fields["expected_head_sha"] != pr["head"]:
            refuse("expected head sha didn't match current head ref.")
        change = pr.get("update")
        if not isinstance(change, dict):
            refuse("There are no new commits on the base branch.")
        pr["head"] = change["head"]
        pr["update"] = None
        if change.get("update_ref"):
            git_dir, ref = change["update_ref"]
            subprocess.run(["git", "--git-dir", git_dir, "update-ref", ref, change["head"]], check=True)
        save()
        url = "https://github.com/vextrus/vextrus-cubit/pull/" + update[1]
        print(json.dumps({{"message": "Updating pull request branch.", "url": url}}))
        sys.exit(0)
fail("unscripted: gh " + " ".join(argv))
"""


class Fake:
    def __init__(self, root: Path) -> None:
        self.state_path = root / "gh-state.json"
        self.log_path = root / "gh-argv.log"

    @property
    def state(self) -> dict[str, Any]:
        loaded: dict[str, Any] = json.loads(self.state_path.read_text())
        return loaded

    def pr(self, number: int) -> dict[str, Any]:
        found: dict[str, Any] = self.state["prs"][str(number)]
        return found

    def served(self, number: int, head: str) -> int:
        count: int = self.pr(number).get("served", {}).get(head, 0)
        return count

    def merged(self) -> list[dict[str, Any]]:
        done: list[dict[str, Any]] = self.state.get("merged", [])
        return done

    def calls(self) -> list[list[str]]:
        """Every argv the fake was given, oldest first, with `--repo R` / `-R R` taken out."""
        if not self.log_path.is_file():
            return []
        found = []
        for line in self.log_path.read_text().splitlines():
            plain: list[str] = []
            skip = False
            for part in json.loads(line):
                if skip:
                    skip = False
                elif part in ("--repo", "-R"):
                    skip = True
                elif not part.startswith("--repo="):
                    plain.append(part)
            found.append(plain)
        return found

    def called(self, *prefix: str) -> list[list[str]]:
        return [argv for argv in self.calls() if argv[: len(prefix)] == list(prefix)]

    def updates(self) -> list[list[str]]:
        """Every request to bring main into a PR: `gh pr update-branch` or the REST route (`gh api`)."""
        return self.called("pr", "update-branch") + [
            argv for argv in self.called("api") if any(p.endswith("/update-branch") for p in argv)
        ]

    def writes(self) -> list[list[str]]:
        """Every call that changes something on GitHub: a merge, a ready mark, a rerun, an edit, a
        comment, an update request, or any `gh api` call with a method other than GET."""
        found = []
        for argv in self.calls():
            pairs = list(itertools.pairwise(argv))
            method = next(
                (b for a, b in pairs if a in ("--method", "-X")),
                next((p.split("=", 1)[1] for p in argv if p.startswith("--method=")), "GET"),
            )
            if method == "GET" and any(p in ("-f", "-F", "--field", "--raw-field") for p in argv):
                method = "POST"  # gh api's default once a field is given
            if (
                (argv[:1] == ["api"] and method.upper() != "GET")
                or argv[:2] in (["pr", "merge"], ["pr", "ready"], ["pr", "edit"], ["pr", "comment"])
                or argv[:2] in (["run", "rerun"], ["pr", "update-branch"], ["pr", "close"])
            ):
                found.append(argv)
        return found


def update_request(argv: list[str], pr: int, head: str) -> bool:
    """`argv` is `api --method PUT repos/vextrus/vextrus-cubit/pulls/<pr>/update-branch -f
    expected_head_sha=<head>` (flags in any order; `-X PUT` and `--method=PUT` too; `-F` too)."""
    pairs = list(itertools.pairwise(argv))
    return (
        argv[:1] == ["api"]
        and (("--method", "PUT") in pairs or ("-X", "PUT") in pairs or "--method=PUT" in argv)
        and any(p.lstrip("/") == f"repos/{REPOSITORY}/pulls/{pr}/update-branch" for p in argv)
        and (
            ("-f", f"expected_head_sha={head}") in pairs
            or ("-F", f"expected_head_sha={head}") in pairs
            or ("--raw-field", f"expected_head_sha={head}") in pairs
            or ("--field", f"expected_head_sha={head}") in pairs
        )
    )


def install(root: Path, monkeypatch: pytest.MonkeyPatch, prs: dict[int, dict[str, Any]]) -> Fake:
    fake = Fake(root)
    fake.state_path.write_text(json.dumps({"prs": {str(n): pr for n, pr in prs.items()}}))
    folder = root / "bin"
    folder.mkdir(exist_ok=True)
    gh = folder / "gh"
    gh.write_text(
        SCRIPT.format(python=sys.executable, state=str(fake.state_path), log=str(fake.log_path))
    )
    gh.chmod(gh.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setenv("PATH", f"{folder}{os.pathsep}{os.environ.get('PATH', '')}")
    return fake


def green() -> list[dict[str, Any]]:
    """The recorded green rollup's entries (T-LAND's fixture), every check SUCCESS, `ci` among them."""
    payload: dict[str, Any] = json.loads((FIXTURES / "rollup_green.json").read_text())
    entries: list[dict[str, Any]] = payload["statusCheckRollup"]
    return entries


def is_ci(entry: dict[str, Any]) -> bool:
    """The required `ci` check run: the aggregate job `ci` of the `ci` workflow."""
    return entry.get("__typename") == "CheckRun" and entry.get("name") == "ci"


def without_ci() -> list[dict[str, Any]]:
    """Every other check of the green rollup done and green, but the `ci` check run not yet created."""
    return [entry for entry in green() if not is_ci(entry)]


def with_ci(**ci: Any) -> list[dict[str, Any]]:
    """The green rollup with its `ci` check run edited (`conclusion=`, `status=` ...)."""
    entries = green()
    for entry in entries:
        if is_ci(entry):
            entry.update(ci)
    return entries


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def commit(repo: Path, files: dict[str, str], message: str) -> str:
    for name, text in files.items():
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        git(repo, "add", name)
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


class World:
    """A working clone on `main` whose bare `origin` holds `main` and one `refs/pull/<n>/head` per PR,
    each PR one commit on the base touching its files; `.github/engine-paths.txt` lists `engine/**`
    (the repository's engine globs, cut to the one these PRs touch)."""

    def __init__(self, root: Path) -> None:
        self.origin = root / "origin.git"
        subprocess.run(
            ["git", "init", "-q", "--bare", "-b", "main", str(self.origin)],
            check=True,
            capture_output=True,
        )
        self.work = root / "work"
        self.work.mkdir()
        git(self.work, "init", "-q", "-b", "main")
        git(self.work, "config", "user.email", "writer@example.com")
        git(self.work, "config", "user.name", "writer")
        git(self.work, "config", "commit.gpgsign", "false")
        git(self.work, "remote", "add", "origin", str(self.origin))
        self.base = commit(
            self.work,
            {"README": "base\n", ".github/engine-paths.txt": "engine/**\n"},
            "base",
        )
        git(self.work, "push", "-q", "origin", "main")
        self.heads: dict[int, str] = {}

    def pr(self, number: int, files: list[str]) -> str:
        git(self.work, "switch", "-q", "-c", f"pr{number}", self.base)
        head = commit(self.work, dict.fromkeys(files, f"PR {number}\n"), f"PR {number}")
        git(self.work, "push", "-q", "origin", f"HEAD:refs/pull/{number}/head")
        git(self.work, "switch", "-q", "main")
        self.heads[number] = head
        return head

    def main_moves_on(self) -> None:
        """Main gets a commit no PR holds."""
        commit(self.work, {"main.txt": "main moved on\n"}, "main moves on")
        git(self.work, "push", "-q", "origin", "main")
        git(self.work, "fetch", "-q", "origin")

    def merged(self, number: int) -> str:
        """The clean merge of main into the PR's head (what update-branch makes), kept in origin under
        `refs/staging/<n>` until the fake moves `refs/pull/<n>/head` to it."""
        git(self.work, "switch", "-q", f"pr{number}")
        git(self.work, "merge", "-q", "--no-ff", "--no-edit", "main")
        merged = git(self.work, "rev-parse", "HEAD")
        git(self.work, "push", "-q", "origin", f"HEAD:refs/staging/{number}")
        git(self.work, "switch", "-q", "main")
        return merged

    def ledger(self) -> Path:
        """Where `scripts.ledger.default_ledger_dir()` puts the ledger for this clone."""
        return self.work / ".private" / "work" / "factory" / "ledger"


def passed(store: Path, pr: int, head: str) -> None:
    """A ledger PASS for exactly this head, in `scripts.ledger`'s shape."""
    body: dict[str, Any] = {
        "schema_version": 1,
        "pr": pr,
        "head": head,
        "round": 1,
        "verdict": "PASS",
        "counts": {
            "reviewers": 2,
            "findings": 0,
            "findings_ge_50": 0,
            "confirmed": 0,
            "refuted": 0,
            "unproven": 0,
            "unrefuted_ge_50": 0,
        },
        "decision_input_sha256": "ab" * 32,
        "comment_id": 100 + pr,
        "exception": None,
        "source": "review-pr",
        "recorded_at": "2026-10-05T10:00:00Z",
    }
    store.mkdir(parents=True, exist_ok=True)
    (store / f"{pr}-{head}.json").write_text(json.dumps(body))
