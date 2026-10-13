"""`review self` (S25-F1, the owner's Q14): a builder's own review before READY.

Runs review.py's two lenses (A and B) on `git diff main...HEAD` in the worktree it is run from. It has
no ledger, posts nothing, runs no refuter and makes no review worktree: the findings go to the builder's
terminal, and the builder fixes what is real. Advisory: a clean run is not a PASS in the ledger.

    uv run python -m scripts.factory.review_self [--base <ref>]

`--base` names the ref the branch is compared with (default `origin/main`, fetched first, else `main`),
so a fix round can review its own diff (`--base <the previous round's head>`).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from scripts.factory import lens_pytest, review
from scripts.factory.review import BadInput, Lens, Refused

OK, BAD, REFUSED = 0, 2, 3
SLOT = 0  # review self's own database (vextrus_rv_slot0); review.py's slots start at 1
SELF_LENSES = (review.LENS_A, review.LENS_B)


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


def base_ref(where: Path, wanted: str | None) -> str:
    if not wanted:  # best effort: the refs below still answer when the network does not
        review._run([*review.GIT, "-C", str(where), "fetch", "-q", "origin", "main"], timeout=120)
    candidates = [wanted] if wanted else ["origin/main", "main"]
    for ref in candidates:
        done = review._run(
            [*review.GIT, "-C", str(where), "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"]
        )
        if done.returncode == 0:
            return ref
    raise Refused(f"no base to compare with ({', '.join(candidates)} not found)")


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
            "For each finding scored 50 or more, write a failing test that proves it, only under",
            f"review_attacks/{lens.label}/ in this worktree (the builder deletes it after reading);",
            "give it as `repro` (test_file relative to this worktree, the command, expect_fail true);",
            "repro null if you could not. Your answer is the JSON the schema asks for;",
            f"its `head` is {head}.",
        ]
    )


def one_lens(lens: Lens, prompt: str, head: str, where: Path, keep: Path, main: Path) -> dict[str, Any]:
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
    with tempfile.TemporaryDirectory(prefix="review-self-") as scratch:
        keep = Path(scratch)
        diff, log = keep / "change.diff", keep / "commits.txt"
        diff.write_text(
            review.git(where, "diff", f"{base}...HEAD") + uncommitted(where), errors="surrogateescape"
        )
        log.write_text(
            review.git(where, "log", "--format=%h %s", f"{base}..HEAD"), errors="surrogateescape"
        )
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


def main(argv: list[str] | None = None) -> int:
    try:
        return run(parse(sys.argv[1:] if argv is None else argv))
    except BadInput as error:
        print(f"review self: {error}", file=sys.stderr)
        return BAD
    except Refused as error:
        print(f"review self: refused: {error}", file=sys.stderr)
        return REFUSED


if __name__ == "__main__":
    sys.exit(main())
