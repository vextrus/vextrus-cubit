"""The local launcher: start one local builder in its own worktree (launch-cli.md 4 and 5).

    python -m scripts.factory.local --ticket T --branch B --effort E --name N --prompt-file F
        [--model M] [--role builder|acceptance-writer] [--budget-minutes MIN] [--dry-run]

PR f1's `python -m scripts.factory.launch local ...` calls `main(argv)` with the same arguments. In
order: the governor (`check local-agent`); `git fetch origin`; `git ls-remote --heads origin B` must
name a sha (a stale local `origin/B` does not count); no live agents row may already carry the name N;
a worktree `<main checkout>/.claude/worktrees/T` on a local branch B tracking `origin/B` at origin's tip
(a local B at another sha is an error, never reset); a carried branch (its tip has no
`.claude/agents/builder.md`) gets `origin/main` merged in as a recorded merge commit, and a conflict
aborts the merge; `uv run manage.py ensure_database` in the worktree; `npm --prefix web ci --no-audit
--no-fund` when the worktree has `web/package-lock.json` and no `web/node_modules`; the ticket's budget
record (`stamp budget`) when `--budget-minutes` is given; then, from the worktree,

    claude --bg --agent <role> --name N --effort E
        --settings <main>/scripts/factory/builder.settings.json
        [--model M] "<prompt>"

with `VEXTRUS_ROLE=builder` and without `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`,
`CLAUDE_CODE_PLUGIN_DIRS` and `CLAUDE_PROJECT_DIR` (so the guard never takes the builder for the main
checkout). `--model` is passed only when given (the agent's definition names its model otherwise; the
record says `claude-opus-5-5`). It never passes `--plugin-dir` and never pushes. The settings path is the
main checkout's (the git common dir's parent), absolute, so a carried branch's own tree cannot lose it.
Last, it reads `claude agents --json --all` and writes the launch record
`$VEXTRUS_FACTORY_DIR/launches/<T>-<utc>.json` (no prompt text) and the agents snapshot beside it.

A conflict, or a failing `ensure_database` or `npm ci`, undoes the launch: the worktree is removed
(never forced) and the branch deleted when this launch created it and it still sits at origin's tip; a
carried branch holding its merge commit is kept, and the line names `git branch -f <b> origin/<b>`.

The ticket id is the worktree's folder and so its database (`vextrus/settings/db.py`): a slug over 32
characters is a usage error, and a slug another linked worktree already has is an `ERROR`.

`--dry-run` runs the checks that change nothing (governor, fetch, ls-remote, the name, the database
name) and prints one
JSON object `{"argv": [...], "cwd": ..., "env_set": ..., "env_dropped": ...}`; it creates nothing.

First stdout line: `OK launched <name> <session_id>`, `REFUSED <code>: <reason>` (exit 2:
`branch-not-on-origin`, `duplicate-name`, `merge-conflict`), `REFUSED governor: <reason>` (exit 3) or
`ERROR <one line>` (exit 1); exit 64 on a usage error.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, NoReturn

from scripts.factory import governor, stamp, status

DEFAULT_MODEL = "claude-opus-5-5"
DROPPED_ENV = (
    "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS",
    "CLAUDE_CODE_PLUGIN_DIRS",
    "CLAUDE_PROJECT_DIR",
)
BUILDER_AGENT = ".claude/agents/builder.md"
COMMAND_TIMEOUT = 300
NPM_TIMEOUT = 900
MAX_SLUG = 32  # `vextrus_` + 32 is db.py's cut at 40: a longer slug would share a database
NPM_CI = ("npm", "--prefix", "web", "ci", "--no-audit", "--no-fund")


class Stop(Exception):
    """Ends the launch: `line` is the first stdout line, `code` the exit code."""

    def __init__(self, code: int, line: str) -> None:
        super().__init__(line)
        self.code = code
        self.line = line


class Parser(argparse.ArgumentParser):
    def error(self, message: str) -> NoReturn:
        self.print_usage(sys.stderr)
        self.exit(64, f"{self.prog}: error: {message}\n")


def database_slug(ticket: str) -> str:
    """The worktree's database is `vextrus_<slug>`: the rule of `vextrus/settings/db.py:44`, which
    `tests/acceptance/p6_local/test_local_launch.py` (A8) pins against this copy."""
    return re.sub(r"[^a-z0-9]+", "_", ticket.lower()).strip("_")


def parse(argv: list[str] | None) -> argparse.Namespace:
    parser = Parser(prog="python -m scripts.factory.local", description=__doc__)
    parser.add_argument("--ticket", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--effort", required=True, choices=["low", "medium", "high", "xhigh", "max"])
    parser.add_argument("--name", required=True)
    parser.add_argument("--prompt-file", required=True, type=Path)
    parser.add_argument("--model")
    parser.add_argument("--role", default="builder", choices=["builder", "acceptance-writer"])
    parser.add_argument("--budget-minutes", type=int)
    parser.add_argument("--owns", action="append", default=[], metavar="PATH")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,80}", args.ticket):
        parser.error(f"--ticket {args.ticket!r} is not a ticket id")
    if not 1 <= len(slug := database_slug(args.ticket)) <= MAX_SLUG:
        parser.error(
            f"--ticket {args.ticket!r} gives the database slug {slug!r}: it must be 1 to {MAX_SLUG}"
            " characters (a longer one would be cut at 40 and share a database)"
        )
    if not re.fullmatch(r"[A-Za-z0-9._/-]{1,200}", args.branch) or args.branch.startswith("-"):
        parser.error(f"--branch {args.branch!r} is not a branch name")
    if args.budget_minutes is not None and args.budget_minutes < 1:
        parser.error("--budget-minutes must be 1 or more")
    return args


def git(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=COMMAND_TIMEOUT,
        check=False,
    )


def must(done: subprocess.CompletedProcess[str], what: str) -> str:
    if done.returncode != 0:
        detail = (done.stderr.strip().splitlines() or ["no output"])[-1]
        raise Stop(1, f"ERROR {what} failed: {detail}")
    return done.stdout.strip()


def child_env() -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if key not in DROPPED_ENV}
    env["VEXTRUS_ROLE"] = "builder"  # an acceptance writer runs under the builder's walls too
    return env


def claude_argv(args: argparse.Namespace, settings: Path, prompt: str) -> list[str]:
    argv = ["claude", "--bg", "--agent", args.role, "--name", args.name, "--effort", args.effort]
    argv += ["--settings", str(settings)]
    if args.model:
        argv += ["--model", args.model]
    return [*argv, prompt]


def live_row(rows: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    return next((row for row in rows if row.get("name") == name and row.get("pid") is not None), None)


def launch(args: argparse.Namespace) -> list[str]:
    """The governor's `admit` (a dry run only `check`s): its pending record holds this launch's
    place in the WIP cap until the launch record is written, and goes whatever ends the launch."""
    given: dict[str, Any] = {
        "owns": getattr(args, "owns", ()),
        "branch": getattr(args, "branch", None),
        "role": getattr(args, "role", None),
    }
    if getattr(args, "dry_run", False):
        return _launch(args, governor.check("local-agent", **given))
    verdict = governor.admit(
        "local-agent",
        hold=os.getpid(),
        ticket=args.ticket,
        budget_minutes=getattr(args, "budget_minutes", None),
        **given,
    )
    try:
        return _launch(args, verdict)
    finally:
        governor.release_hold(args.ticket, os.getpid())


def _launch(args: argparse.Namespace, verdict: governor.Verdict) -> list[str]:
    if not verdict.ok:
        raise Stop(3, f"REFUSED governor: {verdict.reason}")
    main_checkout = status.main_checkout()
    if main_checkout is None:
        raise Stop(1, "ERROR the current directory is not inside a git repository")
    settings = main_checkout / "scripts" / "factory" / "builder.settings.json"
    if not settings.is_file():
        raise Stop(1, f"ERROR {settings} is missing")
    try:
        prompt = args.prompt_file.read_text()
    except OSError as error:
        raise Stop(1, f"ERROR the prompt file is unreadable: {error.strerror}") from error
    if not prompt.strip():
        raise Stop(1, "ERROR the prompt file is empty")

    must(git(main_checkout, "fetch", "-q", "origin"), "git fetch origin")
    listed = must(git(main_checkout, "ls-remote", "--heads", "origin", args.branch), "git ls-remote")
    tip = next(
        (
            line.split("\t")[0]
            for line in listed.splitlines()
            if line.endswith(f"\trefs/heads/{args.branch}")
        ),
        None,
    )
    if tip is None:
        raise Stop(2, f"REFUSED branch-not-on-origin: origin lists no branch {args.branch}")
    rows = governor.read_agents()
    if rows is None:
        raise Stop(1, "ERROR the agents list (claude agents --json --all) is unreadable")
    if (row := live_row(rows, args.name)) is not None:
        raise Stop(2, f"REFUSED duplicate-name: a live session is named {args.name} (pid {row['pid']})")

    worktree = main_checkout / ".claude" / "worktrees" / args.ticket
    if (other := sharing_database(main_checkout, args.ticket)) is not None:
        raise Stop(
            1,
            f"ERROR the database name vextrus_{database_slug(args.ticket)} is also the database of"
            f" worktree {other}",
        )
    argv = claude_argv(args, settings, prompt)
    if args.dry_run:
        plan = {
            "argv": argv,
            "cwd": str(worktree),
            "env_set": {"VEXTRUS_ROLE": "builder"},
            "env_dropped": list(DROPPED_ENV),
            "origin_tip": tip,
            "governor": verdict.as_json(),
        }
        return [json.dumps(plan, indent=1)]

    carried_merge, created = make_worktree(main_checkout, worktree, args.branch, tip)
    try:
        prepare(worktree)
    except Stop as stop:
        cleanup = undo(main_checkout, worktree, args.branch, created, tip)
        raise Stop(stop.code, stop.line + cleanup) from stop
    except (OSError, subprocess.SubprocessError) as error:
        cleanup = undo(main_checkout, worktree, args.branch, created, tip)
        raise Stop(1, f"ERROR {type(error).__name__}: {error}{cleanup}") from error
    if args.budget_minutes is not None:
        stamp.write_budget(args.ticket, args.budget_minutes, worktree)
    version = cli_version()
    started = status.now()
    done = subprocess.run(
        argv,
        cwd=worktree,
        env=child_env(),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=COMMAND_TIMEOUT,
        check=False,
    )
    if done.returncode != 0:
        raise Stop(1, f"ERROR claude --bg exited {done.returncode} (the worktree stays)")
    after = governor.read_agents() or []
    mine = [row for row in after if row.get("name") == args.name]
    row = max(mine, key=lambda r: (r.get("pid") is not None, str(r.get("startedAt"))), default=None)
    session_id = row.get("sessionId") if row is not None else None
    record_path = write_record(
        args, started, verdict, version, session_id, worktree, carried_merge, after
    )
    if not isinstance(session_id, str):
        raise Stop(1, f"ERROR launched, but no agents row is named {args.name}; record: {record_path}")
    return [f"OK launched {args.name} {session_id}", f"record: {record_path}"]


def prepare(worktree: Path) -> None:
    """The worktree's own database, then the web's dependencies when it has a lockfile and none yet."""
    ensure = ["uv", "run", "manage.py", "ensure_database"]
    must(run(ensure, worktree, None, COMMAND_TIMEOUT), "uv run manage.py ensure_database")
    web = worktree / "web"
    if (web / "package-lock.json").is_file() and not (web / "node_modules").is_dir():
        must(run(list(NPM_CI), worktree, child_env(), NPM_TIMEOUT), "npm --prefix web ci")


def run(
    argv: list[str], cwd: Path, env: dict[str, str] | None, timeout: int
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=timeout,
        check=False,
    )


def sharing_database(main_checkout: Path, ticket: str) -> str | None:
    """Another linked worktree whose database name is this ticket's, if any: any but this ticket's own
    `<main>/.claude/worktrees/<ticket>` (the "already exists" case); a same-named one elsewhere too."""
    listed = must(git(main_checkout, "worktree", "list", "--porcelain"), "git worktree list")
    paths = [line[len("worktree ") :] for line in listed.splitlines() if line.startswith("worktree ")]
    mine = f"vextrus_{database_slug(ticket)}"[:40]
    own = (main_checkout / ".claude" / "worktrees" / ticket).resolve()
    for path in paths[1:]:  # the first is the main checkout, whose database is `vextrus`
        if Path(path).resolve() != own and f"vextrus_{database_slug(Path(path).name)}"[:40] == mine:
            return path
    return None


def undo(main_checkout: Path, worktree: Path, branch: str, created: bool, tip: str) -> str:
    """Removes a refused launch's worktree, and its branch when this launch made it at `tip`; returns
    the words to end the error line with."""
    if git(main_checkout, "worktree", "remove", str(worktree)).returncode != 0:
        return f"; the worktree {worktree} could not be removed"
    local = git(main_checkout, "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}")
    if local.returncode != 0:
        return ""
    if created and local.stdout.strip() == tip:
        if git(main_checkout, "branch", "-q", "-d", branch).returncode != 0:
            return f"; the local branch {branch} could not be deleted"
        return ""
    if local.stdout.strip() != tip:
        return f"; to relaunch: git branch -f {branch} origin/{branch}"
    return ""


def make_worktree(main_checkout: Path, worktree: Path, branch: str, tip: str) -> tuple[str | None, bool]:
    """The worktree at origin's tip of `branch`: the merge commit's sha when it was a carried branch,
    and whether this call created the local branch."""
    if worktree.exists():
        raise Stop(1, f"ERROR {worktree} already exists")
    remote_ref = f"refs/remotes/origin/{branch}"
    must(git(main_checkout, "fetch", "-q", "origin", f"+refs/heads/{branch}:{remote_ref}"), "git fetch")
    local = git(main_checkout, "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}")
    created = local.returncode != 0
    if not created:
        if local.stdout.strip() != tip:
            raise Stop(
                1,
                f"ERROR local branch {branch} exists at another sha ({local.stdout.strip()[:12]});"
                f" if it is stale: git branch -f {branch} origin/{branch}"
                " (the launcher never resets it)",
            )
        must(git(main_checkout, "worktree", "add", "-q", str(worktree), branch), "git worktree add")
        must(git(worktree, "branch", "-q", f"--set-upstream-to=origin/{branch}"), "git branch")
    else:
        add = ("worktree", "add", "-q", "--track", "-b", branch, str(worktree), f"origin/{branch}")
        must(git(main_checkout, *add), "git worktree add")
    if git(worktree, "cat-file", "-e", f"HEAD:{BUILDER_AGENT}").returncode == 0:
        return None, created
    merge = git(
        worktree,
        "merge",
        "-q",
        "--no-ff",
        "--no-edit",
        "-m",
        f"Merge origin/main into {branch} (carried branch, before its local launch)",
        "origin/main",
    )
    if merge.returncode != 0:
        git(worktree, "merge", "--abort")
        left = undo(main_checkout, worktree, branch, created, tip)
        raise Stop(2, f"REFUSED merge-conflict: origin/main does not merge cleanly into {branch}{left}")
    return must(git(worktree, "rev-parse", "HEAD"), "git rev-parse"), created


def cli_version() -> str:
    try:
        done = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise Stop(1, "ERROR the claude CLI is missing") from error
    words = done.stdout.split()
    if done.returncode != 0 or not words:
        raise Stop(1, "ERROR claude --version failed")
    return words[0]


def write_record(
    args: argparse.Namespace,
    started: Any,
    verdict: governor.Verdict,
    version: str,
    session_id: Any,
    worktree: Path,
    carried_merge: str | None,
    rows: list[dict[str, Any]],
) -> Path:
    folder = status.factory_dir() / "launches"
    folder.mkdir(parents=True, exist_ok=True)
    stem = f"{args.ticket}-{started.strftime('%Y%m%dT%H%M%SZ')}"
    record = {
        "ticket": args.ticket,
        "branch": args.branch,
        "where": "local",
        "role": args.role,
        "effort": args.effort,
        "model": args.model or DEFAULT_MODEL,
        "budget_minutes": args.budget_minutes,
        "session_id": session_id if isinstance(session_id, str) else None,
        "cli_version": version,
        "started_at": status.utc(started),
        "governor": verdict.as_json(),
        "leak_scan": {"status": "interim", "line": "local: prompt not scanned"},
        "judge": None,
        "stop_sent": False,
        "untestable": None,
        "review": None,
        "name": args.name,
        "worktree": str(worktree),
        "carried_merge_sha": carried_merge,
    }
    if owns := getattr(args, "owns", None):
        record["owns"] = list(owns)
    path = folder / f"{stem}.json"
    with path.open("x") as handle:  # append-only: a record is never overwritten
        handle.write(json.dumps(record, indent=1) + "\n")
    with (folder / f"{stem}.agents.json").open("x") as handle:
        handle.write(json.dumps(rows, indent=1) + "\n")
    return path


def main(argv: list[str] | None = None) -> int:
    args = parse(argv)
    try:
        lines = launch(args)
    except Stop as stop:
        print(stop.line)
        return stop.code
    except (OSError, subprocess.SubprocessError) as error:
        print(f"ERROR {type(error).__name__}: {error}")
        return 1
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
