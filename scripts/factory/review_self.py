"""`review self` (S25-F1, the owner's Q14): a builder's own review before READY.

Runs review.py's two lenses (A and B) on `git diff main...HEAD` in the worktree it is run from. It has
no ledger, posts nothing, runs no refuter and makes no review worktree: the findings go to the builder's
terminal, and the builder fixes what is real. Advisory: a clean run is not a PASS in the ledger.

    uv run python -m scripts.factory.review_self [--base <ref>]

`--base` names the ref the branch is compared with (default `origin/main`, fetched first, else `main`),
so a fix round can review its own diff (`--base <the previous round's head>`). A fix round that merged
main reviews only the fix: the diff runs from the previous head merged with the main it merged (the
delta review's computation, review.write_delta), so main's own commits reach neither lens.

Ctrl-C (or SIGTERM or SIGHUP) kills both lenses and ends the run at once, exit 128 + the signal.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from typing import Any

from scripts.factory import lens_pytest, review
from scripts.factory.review import BadInput, Lens, Refused

OK, BAD, REFUSED = 0, 2, 3
SLOT = 0  # review self's own database (vextrus_rv_slot0); review.py's slots start at 1
# Read-only grants (no Edit, Write or NotebookEdit): review self runs in the builder's own worktree,
# before the READY commit, where a lens that rewrote a file would lose the builder's uncommitted work.
SELF_LENSES = tuple(replace(lens, writes=False) for lens in (review.LENS_A, review.LENS_B))
FETCH_TIMEOUT = "VEXTRUS_REVIEW_SELF_FETCH_TIMEOUT"  # seconds; default 60
STOPPED = threading.Event()  # a stop signal came: no lens may start after it


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> Any:
        raise BadInput(message)


def parse(argv: list[str]) -> argparse.Namespace:
    parser = _Parser(prog="python -m scripts.factory.review_self", add_help=False)
    parser.add_argument("--base")
    args = parser.parse_args(argv)
    if args.base is not None and (not args.base or args.base.startswith("-")):
        raise BadInput("--base is a git ref")
    return args


def worktree() -> Path:
    return Path(review.git(Path.cwd(), "rev-parse", "--show-toplevel").strip())


def fetch_main(where: Path) -> None:
    """Best effort: the refs here still answer when the network does not."""
    try:
        review._run(
            [*review.GIT, "-C", str(where), "fetch", "-q", "origin", "main"],
            timeout=int(os.environ.get(FETCH_TIMEOUT) or 60),
        )
    except subprocess.TimeoutExpired:
        print("review self: the fetch of origin/main timed out; using the refs here", file=sys.stderr)


def first_commit(where: Path, candidates: list[str]) -> str:
    for ref in candidates:
        done = review._run(
            [*review.GIT, "-C", str(where), "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"]
        )
        if done.returncode == 0:
            return ref
    raise Refused(f"no base to compare with ({', '.join(candidates)} not found)")


def base_ref(where: Path, wanted: str | None) -> str:
    fetch_main(where)
    return first_commit(where, [wanted] if wanted else ["origin/main", "main"])


def fix_start(where: Path, base: str, main_ref: str) -> str | None:
    """Where a fix round's own diff starts when `base` is the previous round's head and the round merged
    main: the previous head merged with the newest main commit the head holds (`merge-base HEAD main`,
    so a main fetched after the merge cannot show as removed), the delta review's computation
    (review.write_delta). None when `base` is not an ancestor of HEAD (then the plain three-dot diff is
    right) or does not merge cleanly with that main (then the previous head itself: more than the fix,
    never less)."""
    if review._run(
        [*review.GIT, "-C", str(where), "merge-base", "--is-ancestor", base, "HEAD"]
    ).returncode:
        return None
    fork = review._run([*review.GIT, "-C", str(where), "merge-base", "HEAD", main_ref])
    if fork.returncode or not fork.stdout.split():
        return base
    tree = review._run(
        [*review.GIT, "-C", str(where), "merge-tree", "--write-tree", fork.stdout.split()[0], base]
    )
    return tree.stdout.split()[0] if tree.returncode == 0 and tree.stdout.split() else base


def branch_change(where: Path, base: str, main_ref: str) -> tuple[str, str]:
    """The diff and the commit list of the change under review: `base...HEAD`, or for a fix round
    (`base` an ancestor of HEAD) the fix alone, the main it merged left out."""
    start = fix_start(where, base, main_ref)
    if start is None:
        diff = review.git(where, "diff", f"{base}...HEAD")
        log = review.git(where, "log", "--format=%h %s", f"{base}..HEAD")
        return diff, log
    fork = review._run([*review.GIT, "-C", str(where), "merge-base", "HEAD", main_ref])
    held = fork.stdout.split()[:1] if fork.returncode == 0 else []
    diff = review.git(where, "diff", "--no-renames", start, "HEAD")
    log = review.git(where, "log", "--format=%h %s", "HEAD", "--not", base, *held)
    return diff, log


def uncommitted(where: Path) -> str:
    """Staged and unstaged changes to tracked files, then every untracked file (not ignored), as diffs:
    review self runs before the READY commit, so the work may not be committed yet."""
    parts = [review.git(where, "diff", "HEAD")]
    names = review.git(where, "ls-files", "--others", "--exclude-standard", "-z").split("\0")
    for name in filter(None, names):
        done = review._run(
            [*review.GIT, "-C", str(where), "diff", "--no-index", "--", "/dev/null", name]
        )
        parts.append(done.stdout)  # exit 1 means "differs", as it must
    return "".join(parts)


def brief(lens: Lens, head: str, base: str, where: Path, diff: Path, log: Path) -> str:
    marked = ", ".join(sorted(lens_pytest.declared_markers()))
    return "\n".join(
        [
            f"A builder's own review before READY: head {head}, compared with {base}",
            f"(`git diff {base}...HEAD`).",
            f"Your working directory {where} is the builder's worktree, at the head.",
            f"The change under review (read it; the branch's side, then any uncommitted work): {diff}",
            f"and its commits: {log}. Authority: the ticket the builder was given.",
            f"Tests here use VEXTRUS_DB_NAME=vextrus_rv_slot{SLOT}.",
            "Run only the changed test files and your own attack tests, with exactly",
            f"`{review.LENS_TEST} [options] <test files>`. Its options,",
            f"and no others: {lens_pytest.options_text()}.",
            f"The repo's pytest addopts deselect tests marked {marked}: when a file you run",
            "carries such a mark, add `-m <that mark>`, or nothing runs (exit 5); never select `live`.",
            "Never push, commit or post anything. Public words only.",
            lens.task,
            "You cannot write or edit any file (the builder's uncommitted work is in this worktree):",
            "prove a finding by reading and by running the changed tests, and give `repro` null.",
            "Your answer is the JSON the schema asks for;",
            f"its `head` is {head}.",
        ]
    )


def one_lens(lens: Lens, prompt: str, head: str, where: Path, keep: Path, main: Path) -> dict[str, Any]:
    if STOPPED.is_set():  # the signal came while this lens was being set up
        raise review.Stopped(signal.SIGINT)
    result = review.run_lens(lens, prompt, where, SLOT, keep / f"{lens.label}.json", main)
    return review.read_review(lens, result, head)


def show(lens: Lens, out: dict[str, Any]) -> None:
    findings = sorted(out["findings"], key=lambda item: -item["score"])
    print(f"{lens.label} ({lens.model}): {out['verdict']}, {len(findings)} finding(s)")
    for item in findings:
        print(f"  [{item['score']}] {item['file']}:{item['line']} {item['summary']}")
        repro = item.get("repro")
        if repro:
            print(f"      attack test: {json.dumps(repro)}")
    if out.get("report"):
        print(f"  {out['report']}")


def drop_git_config_env() -> None:
    """`lens_env` drops every secret-looking variable, which takes the numbered key variables of git's
    environment config but leaves its count and values, and git then fails in the lens (a cloud session
    sets all three kinds). Drop the whole family."""
    for name in [name for name in os.environ if name.startswith("GIT_CONFIG_")]:
        del os.environ[name]


def run(args: argparse.Namespace) -> int:
    drop_git_config_env()
    where = worktree()
    main = review.main_checkout()
    head = review.git(where, "rev-parse", "HEAD").strip()
    base = base_ref(where, args.base)
    main_ref = first_commit(where, ["origin/main", "main"])
    with tempfile.TemporaryDirectory(prefix="review-self-") as scratch:
        keep = Path(scratch)
        diff, log = keep / "change.diff", keep / "commits.txt"
        text, commits = (
            branch_change(where, base, main_ref)
            if args.base
            else (
                review.git(where, "diff", f"{base}...HEAD"),
                review.git(where, "log", "--format=%h %s", f"{base}..HEAD"),
            )
        )
        diff.write_text(text + uncommitted(where), errors="surrogateescape")
        log.write_text(commits, errors="surrogateescape")
        prompts = [brief(lens, head, base, where, diff, log) for lens in SELF_LENSES]
        with ThreadPoolExecutor(max_workers=len(SELF_LENSES)) as pool:
            futures = [
                pool.submit(one_lens, lens, prompt, head, where, keep, main)
                for lens, prompt in zip(SELF_LENSES, prompts, strict=True)
            ]
            outcomes: list[dict[str, Any] | Exception] = []
            for future in futures:
                try:
                    outcomes.append(future.result())
                except (Refused, BadInput) as error:
                    outcomes.append(error)
    failed = False
    for lens, outcome in zip(SELF_LENSES, outcomes, strict=True):
        if isinstance(outcome, Exception):
            failed = True
            print(f"{lens.label}: refused: {outcome}", file=sys.stderr)
        else:
            show(lens, outcome)
    return REFUSED if failed else OK


def stop(signum: int, frame: object) -> None:
    """Ctrl-C, SIGTERM or SIGHUP: no lens starts after it, every running lens group is killed (the
    lenses are in their own sessions, so they never see the signal), and the run ends."""
    STOPPED.set()
    review.stop_everything(signum, frame)


def install_stop_handlers() -> None:
    if threading.current_thread() is threading.main_thread():
        for signum in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
            signal.signal(signum, stop)


def main(argv: list[str] | None = None) -> int:
    try:
        install_stop_handlers()
        return run(parse(sys.argv[1:] if argv is None else argv))
    except review.Stopped as error:
        print(f"review self: {error}", file=sys.stderr)
        return 128 + error.signum
    except BadInput as error:
        print(f"review self: {error}", file=sys.stderr)
        return BAD
    except Refused as error:
        print(f"review self: refused: {error}", file=sys.stderr)
        return REFUSED


if __name__ == "__main__":
    sys.exit(main())
