"""`python -m scripts.factory.allowlist batch --from <hits file>`: allowlist a batch of leak hits in one
branch and one PR (#461, part A).

Run it from the main checkout. The hits file holds one `<branch>:<file>:<line>` per line (blank lines and
`#` lines skipped): a hit the scanner named on a builder's branch that the orchestrator judged public.
Every line is checked before anything is written; any bad one (malformed, no branch, line zero, a path
outside the tree, a branch neither here nor on origin, a file the branch does not hold, a line with no
hit) refuses the whole batch, naming the line's number in the file, and nothing is pushed.

Then: the scanner's own `allow` hashes the hits' strings into a scratch copy of origin/main's allowlist;
a worktree off origin/main on a new branch `allowlist-<12 hex>` (named by those hashes) gets them
appended to `tools/leakscan/allowlist.txt` (the only file changed, only 64-hex lines added); one
commit; then `scripts.factory.publish`'s steps: the range scan and its stamp, `git push origin
<branch>`, a scanned body and `gh pr create --body-file`. The scanner reads each hit's file as the
branch holds it, from a scratch copy; the committed allowlist beside this tree's scanner is never
written. No matched string is ever printed.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from scripts.factory import publish
from scripts.factory.publish import Refused, git, git_out

ALLOWLIST = "tools/leakscan/allowlist.txt"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
LOCATION = re.compile(r"^([^:\s]+):([^:]+):([0-9]+)$")


@dataclass(frozen=True)
class Hit:
    number: int  # its line in the hits file
    branch: str
    path: str
    line: int
    rev: str = ""


def parse(text: str) -> list[Hit]:
    """The hits file's locations; a malformed one refuses the batch (named by its line number)."""
    hits: list[Hit] = []
    for number, raw in enumerate(text.splitlines(), start=1):
        entry = raw.strip()
        if not entry or entry.startswith("#"):
            continue
        match = LOCATION.fullmatch(entry)
        if match is None:
            raise Refused(f"hits line {number} is not <branch>:<file>:<line>")
        branch, path, line = match[1], match[2], int(match[3])
        if line < 1:
            raise Refused(f"hits line {number}: line numbers start at 1")
        pure = PurePosixPath(path)
        if pure.is_absolute() or ".." in pure.parts or "\\" in path or path != pure.as_posix():
            raise Refused(f"hits line {number}: the file is not a path inside the tree")
        hits.append(Hit(number, branch, path, line))
    if not hits:
        raise Refused("the hits file holds no location")
    return hits


def resolve(root: Path, hit: Hit) -> Hit:
    """The hit with the commit its branch names (here, else origin's); refused when it has none."""
    if not publish.valid_branch(root, hit.branch):
        raise Refused(f"hits line {hit.number}: not a branch name")
    for ref in (f"refs/heads/{hit.branch}", f"refs/remotes/origin/{hit.branch}"):
        rev = git_out(root, "rev-parse", "--verify", "-q", f"{ref}^{{commit}}")
        if rev is not None:
            kind = git_out(root, "cat-file", "-t", f"{rev}:{hit.path}")
            if kind != "blob":
                raise Refused(f"hits line {hit.number}: the branch holds no such file")
            return Hit(hit.number, hit.branch, hit.path, hit.line, rev)
    raise Refused(f"hits line {hit.number}: no such branch here or on origin")


def scanner_allow(allowlist: Path, *locations: str) -> bool:
    """The scanner's own `allow` on absolute `<file>:<line>` locations, writing `allowlist` (its seam);
    True when a hit was found, False only on the scanner's own "no hit" refusal (a scanner that did not
    run is an error, never a "no hit")."""
    env = {**publish.scanner_env(), "VEXTRUS_LEAKSCAN_ALLOWLIST": str(allowlist)}
    try:
        done = subprocess.run(
            [*publish.leakscan_argv(), "allow", *locations],
            cwd=publish.TREE,
            env=env,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=publish.SCAN_TIMEOUT,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Refused(f"the leak scan's allow did not run ({type(error).__name__})") from None
    if done.returncode == 0:
        return True
    if done.returncode == 1 and "allow refused: no hit" in done.stderr:
        return False
    raise Refused(f"the leak scan's allow failed (exit {done.returncode})")


def hashes(path: Path) -> set[str]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return set()
    return {line.strip() for line in lines if HEX64.fullmatch(line.strip())}


def batch(root: Path, hits_file: Path) -> int:
    try:
        text = hits_file.read_text(encoding="utf-8")
    except OSError, UnicodeDecodeError:
        raise Refused("the hits file cannot be read") from None
    hits = parse(text)
    main = publish.fetch_main(root)
    for branch in sorted({hit.branch for hit in hits}):
        if publish.valid_branch(root, branch):
            git(root, "fetch", "-q", "origin", f"+refs/heads/{branch}:refs/remotes/origin/{branch}")
    hits = [resolve(root, hit) for hit in hits]

    with tempfile.TemporaryDirectory(prefix="allowlist-", dir=root / ".private" / "work") as scratch:
        place = Path(scratch)
        # Each hit's file as its branch holds it, under a folder per branch commit.
        copies = place / "copies"
        base = place / "base.txt"
        current = git_out(root, "show", f"{main}:{ALLOWLIST}")
        base.write_text("" if current is None else f"{current}\n", encoding="utf-8")
        locations: list[str] = []
        for hit in hits:
            target = copies / hit.rev / hit.path
            target.parent.mkdir(parents=True, exist_ok=True)
            blob = subprocess.run(
                ["git", "cat-file", "blob", f"{hit.rev}:{hit.path}"],
                cwd=root,
                capture_output=True,
                stdin=subprocess.DEVNULL,
                timeout=publish.GIT_TIMEOUT,
                check=False,
            )
            if blob.returncode != 0:
                raise Refused(f"hits line {hit.number}: the file cannot be read from its branch")
            target.write_bytes(blob.stdout)
            location = f"{target}:{hit.line}"
            # Every line must hold a hit main's allowlist does not already hold: checked on its own,
            # against a throwaway copy of that allowlist.
            check = place / f"check-{hit.number}.txt"
            check.write_text(base.read_text(encoding="utf-8"), encoding="utf-8")
            if not scanner_allow(check, location) or not hashes(check) - hashes(base):
                raise Refused(f"hits line {hit.number}: the scanner finds no new hit on that line")
            locations.append(location)

        trial = place / "trial.txt"
        trial.write_text(base.read_text(encoding="utf-8"), encoding="utf-8")
        if not scanner_allow(trial, *locations):
            raise Refused("the scanner finds no hit on the batch's lines")
        added = sorted(hashes(trial) - hashes(base))
        if not added:
            raise Refused("every hit's string is already allowlisted: nothing to do")
        branch = "allowlist-" + hashlib.sha256("".join(added).encode()).hexdigest()[:12]
        if git_out(root, "ls-remote", "--heads", "origin", branch):
            raise Refused(f"{branch} is already on origin: nothing is pushed")

        tree = place / "worktree"
        if git(root, "worktree", "add", "-q", "--detach", str(tree), main).returncode != 0:
            raise Refused("git worktree add failed")
        try:
            return finish(root, tree, added, hits, branch, main)
        finally:
            git(root, "worktree", "remove", "--force", str(tree))


def finish(root: Path, tree: Path, added: list[str], hits: list[Hit], branch: str, main: str) -> int:
    # The hashes the scanner's `allow` computed, appended: every existing line keeps its place (the
    # scanner's own rewrite sorts the file and drops any line that is not a hash).
    allowlist = tree / ALLOWLIST
    allowlist.parent.mkdir(parents=True, exist_ok=True)
    before = allowlist.read_text(encoding="utf-8") if allowlist.exists() else ""
    if before and not before.endswith("\n"):
        before += "\n"
    allowlist.write_text(before + "".join(f"{value}\n" for value in added), encoding="utf-8")
    count = len(added)
    if git(tree, "checkout", "-q", "-b", branch).returncode != 0:
        raise Refused("git checkout -b failed")
    if git(tree, "add", "--", ALLOWLIST).returncode != 0:
        raise Refused("git add failed")
    names = ", ".join(sorted({hit.branch for hit in hits}))
    message = (
        f"leakscan: allowlist {count} hashes from {len(hits)} judged hits\n\n"
        f"The orchestrator judged these hits public. Their branches: {names}.\n"
        f"Only `{ALLOWLIST}` changes, by {count} added sha256 lines, "
        "hashed by `tools.leakscan allow`.\n"
    )
    if git(tree, "commit", "-q", "-m", message).returncode != 0:
        raise Refused("git commit failed")
    head = git_out(tree, "rev-parse", "HEAD") or ""
    changed = (git_out(root, "diff", "--name-only", main, head) or "").splitlines()
    if changed != [ALLOWLIST]:
        raise Refused("the batch commit changes more than the allowlist: nothing is pushed")
    publish.range_scan(root, main, head, branch)
    publish.push(root, branch)
    print(f"allowlist: pushed {branch} at {head[:8]} ({count} hashes)")
    title, body = publish.pr_body(message, head)
    path = publish.body_file(root, branch, head, body)
    publish.scan_body(root, path)
    url = publish.create_pr(branch, title, path)
    print(f"allowlist: opened {url}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.allowlist", allow_abbrev=False)
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("batch", allow_abbrev=False)
    run.add_argument("--from", dest="hits", type=Path, required=True)
    options = parser.parse_args(argv)
    root = Path.cwd()
    try:
        (root / ".private" / "work").mkdir(parents=True, exist_ok=True)
        return batch(root, options.hits)
    except Refused as refusal:
        print(f"allowlist: refused: {refusal}: nothing is pushed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
