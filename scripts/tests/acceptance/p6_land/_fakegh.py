"""A fake `gh` on PATH for T-LAND's acceptance tests, and a throwaway git repository with an `origin`.

`install(tmp_path, monkeypatch, state)` writes an executable Python script `gh` into `tmp_path/bin`,
prepends that folder to PATH and returns a `FakeGh` that reads and edits the scripted state and the
argv log. The script answers only what is scripted, as gh 2.45.0 does (`--repo R` / `-R R` ignored):

- `pr view <n> --json headRefOid [-q .headRefOid]`: the PR's current head (`state["head"]`);
- `pr view <n> --json headRefOid,statusCheckRollup [-q .field]`: the next payload of `state["views"]`
  (the last one repeats); a payload's `_then_head` becomes the PR's head once it has been served;
- `mergeable` and `mergeStateStatus` among the `pr view` fields (with either of the above, or alone):
  `state["mergeable"]` (default `MERGEABLE`) and `state["merge_state_status"]` (default `CLEAN`), the
  PR's mergeability as GitHub's GraphQL names it (S17-F7: `CONFLICTING` / `DIRTY` is a conflict);
- `pr ready`: ok;
- `pr update-branch`: exit 1, `unknown command "update-branch" for "gh pr"` (gh 2.45 has no such
  command; the orchestrator's amendment 1, confirmed on the real gh);
- `api --method PUT repos/vextrus/vextrus-cubit/pulls/<n>/update-branch -f expected_head_sha=<sha>`
  (`-X PUT` too), GitHub's REST route: an `expected_head_sha` that is not the PR's head answers 422;
  else `state["update"]` decides: `"conflict"` answers 422 (merge conflict), `{"head": <sha>,
  "update_ref": [<git dir>, <ref>]}` answers 202 and moves the head, and anything else (the default)
  is a head already up to date: 422. A 422 exits 1 with the body on stdout and `gh: <message> (HTTP
  422)` on stderr, as `gh api` does;
- `run view [<run>] --job <job> --log-failed`: `state["logs"][<job>]`;
- `run rerun <run> --failed`: `state["views"]` becomes `state["after_rerun"]`;
- `pr merge <n> ... --match-head-commit <sha>`: ok (recorded);
- `pr checks ... --json ...`: exit 1, `unknown flag: --json` (gh 2.45 has no such flag);
- `state["fail_view"]`: every `pr view` exits 1. Anything else exits 1.
"""

import importlib
import itertools
import json
import os
import stat
import subprocess
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

FIXTURES = Path(__file__).parent / "fixtures"
PR = 12
FAILED_RUN = "37257330803"
FAILED_JOB = "111597106777"
FLAKY_LINE = "FAILED vextrus/x/tests/test_a.py::test_flaky - assert 1 == 2"
FLAKY_ID = "vextrus/x/tests/test_a.py :: test_flaky"

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
    return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else None


argv = sys.argv[1:]
with LOG.open("a") as log:
    log.write(json.dumps(argv) + "\\n")
state = json.loads(STATE.read_text())
args = []
skip = False
for index, part in enumerate(argv):
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


if args[:2] == ["pr", "checks"] and any(a == "--json" or a.startswith("--json=") for a in args):
    fail("unknown flag: --json\\n\\nUsage:  gh pr checks [<number> | <url> | <branch>] [flags]")
if args[:2] == ["pr", "view"]:
    if state.get("fail_view"):
        fail("HTTP 502: Bad Gateway (https://api.github.com/graphql)")
    fields = set((option(args, "--json") or "").split(","))
    known = {{"headRefOid", "statusCheckRollup", "mergeable", "mergeStateStatus"}}
    if not fields <= known:
        fail("unscripted pr view fields: " + ",".join(sorted(fields)))
    payload = {{
        "headRefOid": state["head"],
        "mergeable": state.get("mergeable", "MERGEABLE"),
        "mergeStateStatus": state.get("merge_state_status", "CLEAN"),
    }}
    if "statusCheckRollup" in fields:
        views = state["views"]
        view = dict(views[0])
        if len(views) > 1:
            views.pop(0)
        then = view.pop("_then_head", None)
        if then is not None:
            state["head"] = then
        state["served"] = state.get("served", 0) + 1
        save()
        payload.update(view)
    show({{key: payload[key] for key in fields}})
    sys.exit(0)
if args[:2] == ["pr", "ready"]:
    sys.exit(0)
if args[:2] == ["pr", "update-branch"]:
    fail('unknown command "update-branch" for "gh pr"\\n\\nUsage:  gh pr <command> [flags]')
method = option(args, "--method") or option(args, "-X")
for part in args:
    if part.startswith("--method="):
        method = part.split("=", 1)[1]
path = next((part for part in args[1:] if "/pulls/" in part), "").lstrip("/")
if args[:1] == ["api"] and method == "PUT" and path.endswith("/update-branch"):
    if not re.fullmatch(r"repos/vextrus/vextrus-cubit/pulls/[0-9]+/update-branch", path):
        fail("gh: Not Found (HTTP 404)")
    fields = {{}}
    for index, part in enumerate(args[:-1]):
        if part in ("-f", "-F", "--field", "--raw-field") and "=" in args[index + 1]:
            key, value = args[index + 1].split("=", 1)
            fields[key] = value


    def refuse(message):
        print(json.dumps({{"message": message, "documentation_url": DOCS}}))
        fail("gh: " + message + " (HTTP 422)")


    update = state.get("update", "up to date")
    if "expected_head_sha" in fields and fields["expected_head_sha"] != state["head"]:
        refuse("expected head sha didn't match current head ref.")
    if update == "conflict":
        refuse("merge conflict between base and head")
    if not isinstance(update, dict):
        refuse("There are no new commits on the base branch.")
    state["head"] = update["head"]
    state["update"] = "up to date"
    if update.get("update_ref"):
        git_dir, ref = update["update_ref"]
        subprocess.run(["git", "--git-dir", git_dir, "update-ref", ref, update["head"]], check=True)
    save()
    pull = path.removeprefix("repos/").removesuffix("/update-branch").replace("/pulls/", "/pull/")
    url = "https://github.com/" + pull
    print(json.dumps({{"message": "Updating pull request branch.", "url": url}}))
    sys.exit(0)
job = option(args, "--job")
if args[:2] == ["run", "view"] and "--log-failed" in args and job in state.get("logs", {{}}):
    sys.stdout.write(state["logs"][job])
    sys.exit(0)
if args[:2] == ["run", "rerun"] and "--failed" in args:
    if "after_rerun" in state:
        state["views"] = state.pop("after_rerun")
        save()
    sys.exit(0)
if args[:2] == ["pr", "merge"] and option(args, "--match-head-commit"):
    sys.exit(0)
fail("unscripted: gh " + " ".join(argv))
"""


def lander() -> ModuleType:
    """`scripts.land`, read when a test runs: the seams this ticket adds (`Gh(repo, *, sleep, polls)`,
    `land(..., repo=)`, `reviewed`) do not exist before the builder's commit, and the tests must
    type-check on the branch before then."""
    return importlib.import_module("scripts.land")


class FakeGh:
    def __init__(self, root: Path) -> None:
        self.state_path = root / "gh-state.json"
        self.log_path = root / "gh-argv.log"

    @property
    def state(self) -> dict[str, Any]:
        loaded: dict[str, Any] = json.loads(self.state_path.read_text())
        return loaded

    def script(self, **state: Any) -> None:
        self.state_path.write_text(json.dumps(state))

    def calls(self) -> list[list[str]]:
        """Every argv the fake was given, oldest first, with `--repo R` / `-R R` taken out."""
        if not self.log_path.is_file():
            return []
        found = []
        for line in self.log_path.read_text().splitlines():
            argv: list[str] = json.loads(line)
            plain: list[str] = []
            skip = False
            for part in argv:
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
        """Every request to bring main into the PR: `gh pr update-branch` (gh 2.45 has none) or the
        REST route through `gh api`."""
        return self.called("pr", "update-branch") + [
            argv for argv in self.called("api") if any(p.endswith("/update-branch") for p in argv)
        ]


def update_request(argv: list[str], head: str) -> bool:
    """`argv` is `api --method PUT repos/vextrus/vextrus-cubit/pulls/12/update-branch -f
    expected_head_sha=<head>` (flags in any order; `-X PUT` and `--method=PUT` too)."""
    pairs = list(itertools.pairwise(argv))
    return (
        argv[:1] == ["api"]
        and (("--method", "PUT") in pairs or ("-X", "PUT") in pairs or "--method=PUT" in argv)
        and any(p.lstrip("/") == f"repos/vextrus/vextrus-cubit/pulls/{PR}/update-branch" for p in argv)
        and ("-f", f"expected_head_sha={head}") in pairs
    )


def install(root: Path, monkeypatch: pytest.MonkeyPatch, **state: Any) -> FakeGh:
    fake = FakeGh(root)
    fake.script(**state)
    folder = root / "bin"
    folder.mkdir(exist_ok=True)
    gh = folder / "gh"
    gh.write_text(
        SCRIPT.format(python=sys.executable, state=str(fake.state_path), log=str(fake.log_path))
    )
    gh.chmod(gh.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setenv("PATH", f"{folder}{os.pathsep}{os.environ.get('PATH', '')}")
    return fake


def rollup(name: str, head: str, **failed: Any) -> dict[str, Any]:
    """A fixture payload for this head; `failed` edits the `python (rest)` CheckRun."""
    payload: dict[str, Any] = json.loads((FIXTURES / f"rollup_{name}.json").read_text())
    payload["headRefOid"] = head
    for entry in payload["statusCheckRollup"]:
        if entry.get("name") == "python (rest)":
            entry.update(failed)
    return payload


def failed_log(*lines: str) -> str:
    """A `gh run view --log-failed` output: each line prefixed by the job, the step and a time."""
    body = [
        "============================= test session starts ==============================",
        "=========================== short test summary info ============================",
        *lines,
        "========================= 1 failed, 214 passed in 41.20s =========================",
        "##[error]Process completed with exit code 1.",
    ]
    return "".join(
        f"python (rest)\tRun pytest\t2026-10-05T03:09:3{i % 10}.1234567Z {line}\n"
        for i, line in enumerate(body)
    )


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def commit(repo: Path, name: str, text: str, message: str) -> str:
    (repo / name).write_text(text)
    git(repo, "add", name)
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


def new_repo(path: Path) -> Path:
    path.mkdir(parents=True)
    git(path, "init", "-q", "-b", "main")
    git(path, "config", "user.email", "writer@example.com")
    git(path, "config", "user.name", "writer")
    git(path, "config", "commit.gpgsign", "false")
    return path


class PrRepo:
    """A working clone on `main` whose `origin` holds `main` and `refs/pull/12/head`.

    `reviewed` is the PR's head the ledger PASS is for. With `behind`, main has moved on since the PR's
    branch was cut, and `merged` is the clean merge of main into it (what `gh pr update-branch` makes),
    kept in the clone and in origin under `refs/staging/12`; without, `merged` is None and origin/main is
    already in the PR's head."""

    def __init__(self, root: Path, *, behind: bool) -> None:
        self.origin = root / "origin.git"
        subprocess.run(
            ["git", "init", "-q", "--bare", "-b", "main", str(self.origin)],
            check=True,
            capture_output=True,
        )
        self.work = new_repo(root / "work")
        git(self.work, "remote", "add", "origin", str(self.origin))
        commit(self.work, "README", "base\n", "base")
        git(self.work, "push", "-q", "origin", "main")
        git(self.work, "switch", "-q", "-c", "pr12")
        self.reviewed = commit(self.work, "pr.txt", "the change\n", "the PR's change")
        git(self.work, "push", "-q", "origin", "HEAD:refs/pull/12/head")
        git(self.work, "switch", "-q", "main")
        self.merged: str | None = None
        if behind:
            commit(self.work, "main.txt", "main moved on\n", "main moves on")
            git(self.work, "push", "-q", "origin", "main")
            git(self.work, "switch", "-q", "pr12")
            git(self.work, "merge", "-q", "--no-ff", "--no-edit", "main")
            self.merged = git(self.work, "rev-parse", "HEAD")
            git(self.work, "push", "-q", "origin", "HEAD:refs/staging/12")
            git(self.work, "switch", "-q", "main")
        git(self.work, "fetch", "-q", "origin")


def record(
    store: Path, head: str, *, verdict: str = "PASS", comment_id: int = 100, **fields: Any
) -> None:
    """A ledger record in `scripts.ledger`'s shape (the one `tf4/test_land.py`'s `passed` writes)."""
    body: dict[str, Any] = {
        "schema_version": 1,
        "pr": PR,
        "head": head,
        "round": 1,
        "verdict": verdict,
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
        "comment_id": comment_id,
        "exception": None,
        "source": "review-pr",
        "recorded_at": "2026-10-05T10:00:00Z",
    } | fields
    store.mkdir(parents=True, exist_ok=True)
    (store / f"{PR}-{head}.json").write_text(json.dumps(body))
