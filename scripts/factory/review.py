"""`python -m scripts.factory.review run <PR> --round n [--exception K --reason T]`: one review round
of a PR head, by code (issues #452, #406, #420; the session-13 close's review research, section 3).

1. **Resolve (code).** `gh pr view` gives the PR's state, its 40-hex head and its checks: nobody types a
   sha. The ledger's own `check_exception` and `check_round` run in this process; a closed PR, a short or
   non-hex head and a head whose `ci` check failed are refused (exit 3) before anything starts.
2. **Merge (code).** `git fetch origin refs/pull/<PR>/head main`; the head merged with `origin/main`
   (`git merge-tree`, no worktree touched). A head that does not merge exits 3, nothing started.
3. **Tier (code).** From the changed paths and lines: allowlist-only (every added line a 64-hex hash
   in `tools/leakscan/allowlist.txt`, nothing removed) and docs-only (`docs/**.md`) get no model and a
   PASS by code (the owner's ruling Q3, 5 Oct 2026); small (under 150 changed lines, no trust-boundary
   path) gets lens B; anything else gets lens A and lens B; a change under `web/src/messages/` adds the
   `ux-critic` words lens.
4. **Slot (code).** Review slot N is claimed by an exclusive `flock` on `.slot<N>.lock`, held until the
   run ends (two concurrent runs never share one). The read-only `.private/work/factory/review/slot<N>`
   and the runnable `.claude/worktrees/rv<N>` both hold the merged head.
5. **Lenses.** Each lens is `claude -p --agent <name> --output-format json --json-schema <REVIEW>
   --allowedTools <exact entries> --permission-mode dontAsk`, prompt on stdin, cwd `rv<N>`,
   `VEXTRUS_DB_NAME=vextrus_rv_slot<N>`; its `structured_output` is read and checked here. No prompt
   names where verdicts are kept. A lens loads no user, project or local settings (`--setting-sources
   ""`): its settings, its guard and its agent come from the review code's own checkout, never from
   the PR head in `rv<N>` (the live probes: `--agents` beats the project's agent file, and the user's
   wide allow rules are gone).
6. **Replay (code).** Each finding of 50 or more with a `repro` has its test file run here, in `rv<N>`
   (tracked files reset to the merged head first): a non-zero exit with `FAILED <test_file>` is
   CONFIRMED. Any other finding of 50 or more is UNPROVEN, which stands (a batched refuter is S14-R2).
7. **Record (code).** The `VERDICT`/`FINDING` lines go to a file and `scripts.ledger record` is called in
   this process: the verdict is decided there and nowhere else, its leak scan runs and it posts the one
   marker comment. One JSON cost line is appended to `.private/work/factory/review-cost.jsonl`, and one
   JSON object (the PR, its head, the verdict) is printed on stdout.

Exit codes (the ledger's): 0 ok, 2 bad input or usage, 3 refused (nothing recorded).
"""

import argparse
import contextlib
import fcntl
import json
import os
import re
import shlex
import subprocess
import sys
from collections.abc import Callable, Iterator, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import IO, Any

from scripts import ledger

REPOSITORY = ledger.REPOSITORY
SHA = re.compile(r"[0-9a-f]{40}")
HASH_LINE = re.compile(r"[0-9a-f]{64}")
ALLOWLIST = "tools/leakscan/allowlist.txt"
MESSAGES = "web/src/messages/"
SMALL_LINES = 150
MAX_SLOTS = 4
LENS_TIMEOUT = 45 * 60
REPLAY_TIMEOUT = 20 * 60
GIT_TIMEOUT = 10 * 60
FAILING = {"FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"}

# A path on a trust boundary is never "small": the guard and the harness, the factory's gates and
# records, CI, the leak scan, and code that walls tenants, authenticates or parses hostile input.
TRUST_BOUNDARY = re.compile(
    r"^(?:\.claude/|\.github/|scripts/|tools/|CLAUDE\.md$)"
    r"|(?:^|/)(?:[^/]*(?:guard|auth|tenant|permission|ledger|parser|reader|leak|secret)[^/]*)(?:/|$)"
    r"|/migrations/",
    re.IGNORECASE,
)

# What a lens may do: read, write its attack test in its own worktree, read git, and run tests.
# Every Bash entry is one exact command prefix, never all of Bash.
ALLOWED_TOOLS = (
    "Read",
    "Grep",
    "Glob",
    "Edit(./**)",
    "Write(./**)",
    "Bash(git diff:*)",
    "Bash(git log:*)",
    "Bash(git show:*)",
    "Bash(git status:*)",
    "Bash(uv run pytest:*)",
)
# Belt and braces: nothing a lens is given allows these, and a denial beats any allow.
LENS_DENY = ("Bash(gh:*)", "Bash(git push:*)", "Bash(git commit:*)", "Bash(sudo:*)", "Bash(curl:*)")
# The review code's own checkout (the main checkout, run as `uv run python -m ...` there): the lens's
# agents and its guard come from here, never from the PR under review.
HARNESS = Path(__file__).resolve().parents[2]

FINDING_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "file": {"type": "string"},
        "line": {"type": "integer", "minimum": 0},
        "summary": {"type": "string", "description": "the failing scenario, in public words"},
        "repro": {
            "type": ["object", "null"],
            "description": (
                "for a finding of 50 or more: the test file you wrote in this worktree that fails "
                "because of the finding (null if you could not write one)"
            ),
            "properties": {
                "test_file": {"type": "string", "description": "relative to the worktree"},
                "command": {"type": "string"},
                "expect_fail": {"type": "boolean"},
            },
            "required": ["test_file", "command", "expect_fail"],
        },
    },
    "required": ["score", "file", "line", "summary", "repro"],
}
REVIEW_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "verdict": {"enum": ["PASS", "FIX", "BLOCK"]},
        "head": {"type": "string", "description": "the full 40-hex sha of the PR head reviewed"},
        "findings": {"type": "array", "items": FINDING_SCHEMA},
        "report": {"type": "string"},
    },
    "required": ["verdict", "head", "findings", "report"],
}


class Refused(Exception):
    """A refusal (exit 3): nothing recorded."""


class BadInput(Exception):
    """Bad input or usage (exit 2)."""


Runner = Callable[..., subprocess.CompletedProcess[str]]


def _run(argv: Sequence[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(argv), capture_output=True, text=True, check=False, **kwargs)


@dataclass(frozen=True)
class Lens:
    label: str
    agent: str
    model: str
    task: str


LENS_A = Lens(
    "lens-a",
    "pr-reviewer",
    "opus",
    "Review it in your six passes. Focus on the trust boundary the PR changes.",
)
LENS_B = Lens(
    "lens-b",
    "pr-reviewer",
    "sonnet",
    "You are the adversary lens: find the failing scenario a user meets with this change and prove it "
    "with a test you write in this worktree. Ignore style; report only what breaks.",
)
WORDS = Lens(
    "words",
    "ux-critic",
    "sonnet",
    f"The words-only design gate on the changed {MESSAGES}** words, against CONTEXT.md.",
)


@dataclass
class Finding:
    id: str
    score: int
    file: str
    line: int
    summary: str
    repro: str | None
    word: str = "-"
    method: str | None = None

    def view(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "score": self.score,
            "file": self.file,
            "line": self.line,
            "summary": self.summary,
            "status": self.word,
            "method": self.method,
        }


@dataclass
class Run:
    """What one run learned, for the summary and the cost line."""

    pr: int
    round_: int
    head: str | None = None
    merged: str | None = None
    tier: str | None = None
    slot: int | None = None
    verdict: str | None = None
    lenses: list[dict[str, Any]] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)

    def cost(self) -> float:
        return round(sum(float(lens.get("total_cost_usd") or 0.0) for lens in self.lenses), 6)


# ---------------------------------------------------------------------------------------------- git


def main_checkout() -> Path:
    """The main checkout: the parent of the cwd's git common dir."""
    done = _run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"])
    if done.returncode != 0:
        raise BadInput("run from inside the repository's main checkout")
    return Path(done.stdout.strip()).parent


def git(where: Path, *args: str, env: dict[str, str] | None = None) -> str:
    done = _run(["git", "-C", str(where), *args], timeout=GIT_TIMEOUT, env=env)
    if done.returncode != 0:
        raise Refused(f"git {args[0]} failed: {done.stderr.strip()[-300:]}")
    return done.stdout


@contextlib.contextmanager
def locked(path: Path) -> Iterator[None]:
    """A blocking exclusive lock on `path` (git's fetch, merge and worktree steps run one at a time)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield


def claim_slot(review: Path) -> tuple[int, IO[str]]:
    """The first free slot, claimed by a non-blocking exclusive lock held until the run ends."""
    review.mkdir(parents=True, exist_ok=True)
    for n in range(1, MAX_SLOTS + 1):
        handle = (review / f".slot{n}.lock").open("a")
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            handle.close()
            continue
        return n, handle
    raise Refused(f"all {MAX_SLOTS} review slots are busy: run again when one finishes")


def merged_head(main: Path, pr: int, head: str) -> str:
    """Fetch the PR and main; the head itself when main is its ancestor, else a merge commit."""
    git(
        main,
        "fetch",
        "-q",
        "origin",
        f"refs/pull/{pr}/head",
        "+refs/heads/main:refs/remotes/origin/main",
    )
    if _run(["git", "-C", str(main), "cat-file", "-e", f"{head}^{{commit}}"]).returncode != 0:
        raise Refused("the PR's head was not fetched (it moved?): run again")
    ancestor = _run(["git", "-C", str(main), "merge-base", "--is-ancestor", "origin/main", head])
    if ancestor.returncode == 0:
        return head
    tree = _run(["git", "-C", str(main), "merge-tree", "--write-tree", "origin/main", head])
    if tree.returncode != 0:
        raise Refused("the head does not merge with main: the builder merges main first")
    who = {
        "GIT_AUTHOR_NAME": "vextrus-review",
        "GIT_AUTHOR_EMAIL": "review@vextrus.invalid",
        "GIT_COMMITTER_NAME": "vextrus-review",
        "GIT_COMMITTER_EMAIL": "review@vextrus.invalid",
    }
    message = f"review: PR {pr} head {head} merged with main"
    return git(
        main,
        "commit-tree",
        tree.stdout.split()[0],
        "-p",
        head,
        "-p",
        "origin/main",
        "-m",
        message,
        env={**os.environ, **who},
    ).strip()


def changes(main: Path, head: str) -> tuple[list[tuple[str, int | None, int | None]], list[str]]:
    """The changed files `(path, added, removed)` (None: binary) and the allowlist's added lines."""
    rows = []
    for line in git(main, "diff", "--no-renames", "--numstat", f"origin/main...{head}").splitlines():
        added, removed, path = line.split("\t", 2)
        rows.append(
            (path, int(added) if added != "-" else None, int(removed) if removed != "-" else None)
        )
    patch = git(main, "diff", "--no-renames", "-U0", f"origin/main...{head}", "--", ALLOWLIST)
    added_lines = [
        line[1:] for line in patch.splitlines() if line.startswith("+") and not line.startswith("+++")
    ]
    return rows, added_lines


def tier(rows: list[tuple[str, int | None, int | None]], allowlist_added: list[str]) -> str:
    paths = [path for path, _, _ in rows]
    if not rows:
        raise Refused("the PR changes nothing against main")
    if (
        paths == [ALLOWLIST]
        and rows[0][2] == 0
        and allowlist_added
        and all(HASH_LINE.fullmatch(line) for line in allowlist_added)
    ):
        return "allowlist-only"
    if all(path.startswith("docs/") and path.endswith(".md") for path in paths):
        return "docs-only"
    lines = sum((a or 0) + (r or 0) for _, a, r in rows)
    binary = any(a is None or r is None for _, a, r in rows)
    if lines < SMALL_LINES and not binary and not any(TRUST_BOUNDARY.search(path) for path in paths):
        return "small"
    return "normal"


def prepare(main: Path, path: Path, sha: str, *, clean: bool) -> None:
    """`path` is a detached worktree of this repository at `sha` (made, or reused and reset)."""
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        git(main, "worktree", "prune")
        git(main, "worktree", "add", "-q", "--detach", str(path), sha)
    else:
        common = _run(
            ["git", "-C", str(path), "rev-parse", "--path-format=absolute", "--git-common-dir"]
        )
        mine = git(main, "rev-parse", "--path-format=absolute", "--git-common-dir").strip()
        if common.returncode != 0 or common.stdout.strip() != mine or (path / ".git").is_dir():
            raise Refused(f"{path.name} exists and is not a worktree of this repository")
        git(path, "checkout", "-q", "--detach", "-f", sha)
        if clean:
            git(path, "clean", "-fdq")
    if git(path, "rev-parse", "HEAD").strip() != sha:
        raise Refused(f"{path.name} is not at the merged head")


# ---------------------------------------------------------------------------------------------- gh


def gh_json(*args: str) -> Any:
    done = _run(["gh", *args, "--repo", REPOSITORY], timeout=120)
    if done.returncode != 0:
        raise Refused(f"gh {' '.join(args[:2])} failed: {done.stderr.strip()[-300:]}")
    try:
        return json.loads(done.stdout)
    except ValueError as error:
        raise Refused(f"gh {' '.join(args[:2])} printed no JSON") from error


def pr_view(pr: int) -> dict[str, Any]:
    fields = "number,state,headRefOid,statusCheckRollup"
    view = gh_json("pr", "view", str(pr), "--json", fields)
    if not isinstance(view, dict):
        raise Refused("gh pr view printed no object")
    return view


def red_ci(rollup: Any) -> list[str]:
    """The failed `ci` checks (a check named `ci`, or any check of the `ci` workflow)."""
    if not isinstance(rollup, list):
        raise Refused("the PR's checks could not be read")
    red = []
    for check in rollup:
        if not isinstance(check, dict):
            raise Refused("the PR's checks could not be read")
        name = str(check.get("name") or check.get("context") or "")
        outcome = str(check.get("conclusion") or check.get("state") or "").upper()
        if (name == "ci" or check.get("workflowName") == "ci") and outcome in FAILING:
            red.append(name)
    return red


def resolve(pr: int) -> str:
    """The PR's head, refused unless the PR is open, the head is 40-hex and its `ci` is not red."""
    view = pr_view(pr)
    if view.get("number") not in (None, pr):
        raise Refused("gh answered for another PR")
    if str(view.get("state", "")).upper() != "OPEN":
        raise Refused(f"PR {pr} is {str(view.get('state', 'unknown')).lower()}, not open")
    head = view.get("headRefOid")
    if not isinstance(head, str) or not SHA.fullmatch(head):
        raise Refused("the PR's head is not a full 40-hex sha")
    if red := red_ci(view.get("statusCheckRollup")):
        raise Refused(f"the head's CI is red ({', '.join(sorted(set(red)))}): fix it before review")
    return head


# ---------------------------------------------------------------------------------------------- lenses


def brief(run: Run, lens: Lens, rv: Path, slot: Path) -> str:
    """The lens's prompt (stdin). It names the PR, the heads, the worktree and the slot, and nothing
    about where verdicts are kept."""
    assert run.head is not None
    assert run.merged is not None
    assert run.slot is not None
    merged = (
        "the head itself (main is its ancestor)"
        if run.merged == run.head
        else f"{run.merged} (the head merged with main)"
    )
    return "\n".join(
        [
            f"PR {run.pr}, head {run.head}, review round {run.round_}.",
            f"Your working directory {rv} holds {merged};",
            f"a read-only copy of the same commit is at {slot} (read it, never run code there).",
            f"Tests here use VEXTRUS_DB_NAME=vextrus_rv_slot{run.slot}.",
            f"The PR's change: git diff origin/main...{run.head}. Authority: the ticket in the PR body.",
            "Run only the PR's changed test files and your own attack tests, each with",
            "`uv run pytest -rf <files>`. Never push, commit or post anything. Public words only.",
            lens.task,
            "For each finding scored 50 or more, write a failing test under this worktree that proves",
            "it and give it as `repro` (test_file relative to this worktree, the command, expect_fail",
            "true); repro null if you could not. Your answer is the JSON the schema asks for; its",
            f"`head` is {run.head}.",
        ]
    )


def agent_definition(name: str) -> dict[str, str]:
    """The agent from the review code's own checkout (`.claude/agents/<name>.md`), never the PR's: a
    lens runs in `rv<N>`, where the PR's head could rewrite its own reviewer."""
    try:
        text = (HARNESS / ".claude" / "agents" / f"{name}.md").read_text()
    except OSError as error:
        raise Refused(f"the agent {name} cannot be read") from error
    found = re.fullmatch(r"---\n(.*?)\n---\n(.*)", text, re.DOTALL)
    if found is None:
        raise Refused(f"the agent {name} has no frontmatter")
    if "ledger" in text.lower():
        raise Refused(f"the agent {name} names the review record: a lens is never told of it")
    description = re.search(r"^description:\s*(.+)$", found[1], re.MULTILINE)
    return {"description": description[1].strip() if description else name, "prompt": found[2].strip()}


def lens_settings(main: Path) -> dict[str, Any]:
    """The lens's only settings (`--setting-sources ""` drops the user's, the project's and the local
    ones, whose allow rules are wide and whose project copy in `rv<N>` is the PR's): the guard from the
    review code's own checkout, the harness's Read denials (secrets), and no edit under `.private/`."""
    guard = HARNESS / ".claude" / "hooks" / "guard.mjs"
    try:
        harness = json.loads((HARNESS / ".claude" / "settings.json").read_text())
        reads = [rule for rule in harness["permissions"]["deny"] if rule.startswith("Read(")]
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise Refused("the harness settings cannot be read") from error
    if not guard.is_file():
        raise Refused("the guard is missing: no lens runs without it")
    hook = {"type": "command", "command": f"node {shlex.quote(str(guard))}", "timeout": 10}
    return {
        "permissions": {
            "allow": [],
            "deny": [*reads, *LENS_DENY, f"Edit(/{main}/.private/**)"],
        },
        "hooks": {"PreToolUse": [{"matcher": "Bash|Edit|Write|NotebookEdit", "hooks": [hook]}]},
    }


def lens_command(lens: Lens, main: Path) -> list[str]:
    return [
        "claude",
        "-p",
        "--setting-sources",
        "",
        "--settings",
        json.dumps(lens_settings(main), separators=(",", ":")),
        "--agents",
        json.dumps({lens.agent: agent_definition(lens.agent)}, separators=(",", ":")),
        "--agent",
        lens.agent,
        "--model",
        lens.model,
        "--effort",
        "high",
        "--output-format",
        "json",
        "--json-schema",
        json.dumps(REVIEW_SCHEMA, separators=(",", ":")),
        "--allowedTools",
        ",".join(ALLOWED_TOOLS),
        "--permission-mode",
        "dontAsk",
        "--no-session-persistence",
    ]


def lens_env(slot: int) -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if key != "CLAUDE_PROJECT_DIR"}
    env["VEXTRUS_DB_NAME"] = f"vextrus_rv_slot{slot}"
    return env


def run_lens(lens: Lens, prompt: str, rv: Path, slot: int, keep: Path, main: Path) -> dict[str, Any]:
    """One lens process; its result object (the A0 probe's shape), kept under `keep`."""
    command = lens_command(lens, main)
    try:
        done = _run(command, cwd=rv, env=lens_env(slot), input=prompt, timeout=LENS_TIMEOUT)
    except subprocess.TimeoutExpired as error:
        raise Refused(f"{lens.label} ran past {LENS_TIMEOUT // 60} minutes") from error
    keep.parent.mkdir(parents=True, exist_ok=True)
    keep.write_text(done.stdout)
    try:
        result = json.loads(done.stdout)
    except ValueError as error:
        raise Refused(f"{lens.label} printed no JSON result (exit {done.returncode})") from error
    if done.returncode != 0 or not isinstance(result, dict) or result.get("is_error"):
        raise Refused(f"{lens.label} failed (exit {done.returncode})")
    return result


def _int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def read_review(lens: Lens, result: dict[str, Any], head: str) -> dict[str, Any]:
    """The lens's `structured_output`, checked against the REVIEW schema and the PR's head."""
    out = result.get("structured_output")
    if not isinstance(out, dict) or out.get("verdict") not in ("PASS", "FIX", "BLOCK"):
        raise Refused(f"{lens.label} gave no answer in the review schema: run the round again")
    if out.get("head") != head:
        raise Refused(f"{lens.label} reviewed another head than {head}: nothing recorded")
    findings = out.get("findings")
    if not isinstance(findings, list):
        raise Refused(f"{lens.label}'s findings are not a list")
    for item in findings:
        repro = item.get("repro") if isinstance(item, dict) else None
        if not (
            isinstance(item, dict)
            and _int(item.get("score"))
            and 0 <= item["score"] <= 100
            and isinstance(item.get("file"), str)
            and _int(item.get("line"))
            and isinstance(item.get("summary"), str)
            and (repro is None or (isinstance(repro, dict) and isinstance(repro.get("test_file"), str)))
        ):
            raise Refused(f"{lens.label} gave a finding outside the review schema")
    return out


def replay_target(rv: Path, test_file: str) -> str | None:
    """The repro's test file as a safe relative path inside `rv`, or None."""
    pure = PurePosixPath(test_file)
    if (
        not test_file
        or pure.is_absolute()
        or ".." in pure.parts
        or test_file.startswith("-")
        or pure.suffix != ".py"
        or any(char in test_file for char in "\n\r\0:")
    ):
        return None
    path = (rv / pure).resolve()
    if not path.is_relative_to(rv.resolve()) or not path.is_file():
        return None
    return str(pure)


def replay(rv: Path, slot: int, test_file: str) -> bool:
    """Run the test file in `rv` (never the lens's own command): True when it fails by name."""
    try:
        done = _run(
            ["uv", "run", "pytest", "-rf", test_file], cwd=rv, env=lens_env(slot), timeout=REPLAY_TIMEOUT
        )
    except subprocess.TimeoutExpired:
        return False
    named = re.compile(rf"^FAILED {re.escape(test_file)}(?:::|\s|$)", re.MULTILINE)
    return done.returncode != 0 and named.search(done.stdout) is not None


# ---------------------------------------------------------------------------------------------- the run


def parse(argv: list[str]) -> argparse.Namespace:
    class _Parser(argparse.ArgumentParser):
        def error(self, message: str) -> Any:
            raise BadInput(message)

    top = _Parser(prog="python -m scripts.factory.review", add_help=False)
    commands = top.add_subparsers(dest="command", required=True, parser_class=_Parser)
    run = commands.add_parser("run", add_help=False)
    run.add_argument("pr")
    run.add_argument("--round", type=int, required=True)
    run.add_argument("--exception")
    run.add_argument("--reason")
    args = top.parse_args(argv)
    if not re.fullmatch(r"[1-9][0-9]{0,6}", args.pr):
        raise BadInput("the PR is its number (the head is read from the PR, never typed)")
    args.pr = int(args.pr)
    return args


def ledger_call(argv: list[str], ledger_dir: Path) -> int:
    """`scripts.ledger` in this process; its words go to stderr (stdout is the one summary)."""
    with contextlib.redirect_stdout(sys.stderr):
        return ledger.main(argv, ledger_dir=ledger_dir)


def record(
    run: Run, args: argparse.Namespace, ledger_dir: Path, verdicts: list[str], decisions: Path
) -> None:
    """Write the decision lines and have the ledger decide and record them."""
    assert run.head is not None
    lines = [f"VERDICT: {verdict} at {run.head}" for verdict in verdicts]
    lines += [f"FINDING {item.id} {item.score} {item.word}" for item in run.findings]
    decisions.mkdir(parents=True, exist_ok=True)
    source = decisions / f"{run.pr}-{run.head[:12]}-r{run.round_}.txt"
    source.write_text("".join(f"{line}\n" for line in lines))
    exception = [] if args.exception is None else ["--exception", args.exception]
    reason = [] if args.reason is None else ["--reason", args.reason]
    argv = ["record", str(run.pr), "--round", str(run.round_), "--head", run.head, "--from", str(source)]
    code = ledger_call([*argv, *exception, *reason], ledger_dir)
    if code == ledger.BAD:
        raise BadInput("the ledger refused the decision input")
    if code != ledger.OK:
        raise Refused("the ledger refused the record")
    loaded = json.loads((ledger_dir / f"{run.pr}-{run.head}.json").read_text())
    run.verdict = str(loaded["verdict"])


def review(run: Run, args: argparse.Namespace, main: Path) -> None:
    factory = main / ".private" / "work" / "factory"
    review_dir = factory / "review"
    ledger_dir = factory / "ledger"
    ledger.check_exception(run.round_, args.exception, args.reason)
    ledger.check_round(ledger_dir, run.pr, run.round_, args.exception)
    run.head = resolve(run.pr)
    with locked(review_dir / ".git.lock"):
        run.merged = merged_head(main, run.pr, run.head)
        rows, allowlist_added = changes(main, run.head)
    run.tier = tier(rows, allowlist_added)
    if run.tier in ("allowlist-only", "docs-only"):
        record(run, args, ledger_dir, ["PASS"], factory / "verdicts")
        return
    lenses = [LENS_B] if run.tier == "small" else [LENS_A, LENS_B]
    if any(path.startswith(MESSAGES) for path, _, _ in rows):
        lenses.append(WORDS)
    run.slot, claim = claim_slot(review_dir)
    with claim:
        slot = review_dir / f"slot{run.slot}"
        rv = main / ".claude" / "worktrees" / f"rv{run.slot}"
        with locked(review_dir / ".git.lock"):
            prepare(main, slot, run.merged, clean=True)
            prepare(main, rv, run.merged, clean=True)
        reviews = lenses_in(run, lenses, rv, slot, main)
        for number, out in enumerate(reviews, start=1):
            for index, item in enumerate(out["findings"], start=1):
                repro = item.get("repro")
                run.findings.append(
                    Finding(
                        f"l{number}-f{index}",
                        item["score"],
                        item["file"],
                        item["line"],
                        item["summary"],
                        repro.get("test_file") if isinstance(repro, dict) else None,
                    )
                )
        confirm(run, rv)
        if resolve(run.pr) != run.head:
            raise Refused("the PR's head moved during the review: review the new head")
        record(run, args, ledger_dir, [out["verdict"] for out in reviews], factory / "verdicts")


def lenses_in(run: Run, lenses: list[Lens], rv: Path, slot: Path, main: Path) -> list[dict[str, Any]]:
    """Every lens, in parallel; each result's cost is kept even when another lens fails."""
    assert run.head is not None
    assert run.slot is not None
    n, head = run.slot, run.head
    out = main / ".private" / "work" / "factory" / "review" / "out"

    def one(lens: Lens) -> dict[str, Any]:
        keep = out / f"{run.pr}-{head[:12]}-r{run.round_}-{lens.label}.json"
        result = run_lens(lens, brief(run, lens, rv, slot), rv, n, keep, main)
        run.lenses.append(
            {
                "label": lens.label,
                "agent": lens.agent,
                "model": lens.model,
                "total_cost_usd": result.get("total_cost_usd"),
                "duration_ms": result.get("duration_ms"),
                "usage": result.get("usage"),
            }
        )
        return read_review(lens, result, head)

    with ThreadPoolExecutor(max_workers=len(lenses)) as pool:
        futures = [pool.submit(one, lens) for lens in lenses]
        errors = [future.exception() for future in futures]
    for error in errors:
        if error is not None:
            raise error
    return [future.result() for future in futures]


def confirm(run: Run, rv: Path) -> None:
    """Replay each finding of 50 or more by its test; what no test confirms stands as UNPROVEN."""
    assert run.merged is not None
    assert run.slot is not None
    serious = [item for item in run.findings if item.score >= 50]
    if any(item.repro for item in serious):
        git(rv, "reset", "-q", "--hard", run.merged)  # the lens's edits to tracked files are undone
    for item in serious:
        target = replay_target(rv, item.repro) if item.repro else None
        if target is not None and replay(rv, run.slot, target):
            item.word, item.method = "CONFIRMED", "replay"
        else:
            item.word, item.method = "UNPROVEN", None


def fix_message(run: Run) -> str:
    standing = sorted(
        (item for item in run.findings if item.word != "REFUTED" and item.score >= 50),
        key=lambda item: (-item.score, item.id),
    )
    if not standing:
        return ""
    lines = [f"Fix round for PR {run.pr} at {run.head}:"]
    lines += [f"- {item.file}:{item.line} ({item.score}): {item.summary}" for item in standing]
    return "\n".join(lines)


def summary(run: Run, code: int, why: str | None) -> dict[str, Any]:
    return {
        "pr": run.pr,
        "head": run.head,
        "merged": run.merged,
        "round": run.round_,
        "tier": run.tier,
        "slot": run.slot,
        "verdict": run.verdict,
        "exit": code,
        "refused": why,
        "findings": [item.view() for item in sorted(run.findings, key=lambda i: (-i.score, i.id))],
        "fix_message": fix_message(run),
        "lenses": run.lenses,
        "total_cost_usd": run.cost(),
    }


def append_cost(main: Path, line: dict[str, Any]) -> None:
    path = main / ".private" / "work" / "factory" / "review-cost.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as out:
        fcntl.flock(out, fcntl.LOCK_EX)
        out.write(json.dumps(line, separators=(",", ":")) + "\n")


def main(argv: list[str] | None = None) -> int:
    run = Run(pr=0, round_=0)
    code, why = ledger.OK, None
    try:
        args = parse(sys.argv[1:] if argv is None else argv)
        run.pr, run.round_ = args.pr, args.round
        home = main_checkout()
        try:
            review(run, args, home)
        finally:
            if run.tier is not None:  # the run got past its checks: every such run leaves a cost line
                line = summary(run, code, why)
                line["at"] = ledger.utc_now()
                append_cost(home, line)
    except (BadInput, ledger.BadInput) as error:
        code, why = ledger.BAD, str(error)
    except (Refused, ledger.Refused) as error:
        code, why = ledger.REFUSED, str(error)
    if why is not None:
        print(f"review: {'refused: ' if code == ledger.REFUSED else ''}{why}", file=sys.stderr)
    print(json.dumps(summary(run, code, why)))
    return code


if __name__ == "__main__":
    sys.exit(main())
