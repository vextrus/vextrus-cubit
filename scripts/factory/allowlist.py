"""`python -m scripts.factory.allowlist batch --from <hits file>`: allowlist a batch of leak hits in one
branch and one PR (#461, part A).

Run it from the main checkout. The hits file holds one `<branch>:<file>:<line> [<commit>]` per line
(blank lines and `#` lines skipped): a hit the scanner named on a builder's branch that the orchestrator
judged public, and optionally the commit publish named with it. The line is read in the commit whose
own added text the scanner matched there (each commit scanned alone), never at the branch's tip. Every
line is checked before anything is written; any bad one (malformed, no branch, line zero, a path outside
the tree, a branch neither here nor on origin, a commit given that adds no hit there, no commit or
several adding a hit there, a line with no new hit) refuses the whole batch,
naming the line's number in the file, and nothing is pushed.

Then: the scanner's own `allow` hashes the hits' strings into a scratch copy of origin/main's allowlist;
a worktree off origin/main on a new branch `allowlist-<12 hex>` (named by those hashes) gets them
appended to `tools/leakscan/allowlist.txt` (the only file changed, only 64-hex lines added); one
commit; then `scripts.factory.publish`'s steps: the range scan and its stamp, `git push origin
<branch>`, a scanned body and `gh pr create --body-file`. The scanner reads each hit's file as the
branch holds it, from a scratch copy; the committed allowlist beside this tree's scanner is never
written. No matched string is ever printed.

A rerun finishes what a failed run began (`finish`): the batch's commit already on origin, or on the
local branch, is reused when it adds exactly these hashes to the allowlist and nothing else and its
parent is the current origin/main (else it is built again on main, under a new name when origin holds
the stale one); a head origin holds is not pushed again; a PR is opened only when none is open.
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

from scripts.factory import leakwhere, publish
from scripts.factory.publish import Refused, git, git_out

ALLOWLIST = "tools/leakscan/allowlist.txt"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
LOCATION = re.compile(r"^([^:\s]+):([^:]+):([0-9]+)(?: ([0-9a-f]{7,40}))?$")


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
            raise Refused(f"hits line {number} is not <branch>:<file>:<line> [<commit>]")
        branch, path, line, rev = match[1], match[2], int(match[3]), match[4] or ""
        if line < 1:
            raise Refused(f"hits line {number}: line numbers start at 1")
        pure = PurePosixPath(path)
        if pure.is_absolute() or ".." in pure.parts or "\\" in path or path != pure.as_posix():
            raise Refused(f"hits line {number}: the file is not a path inside the tree")
        hits.append(Hit(number, branch, path, line, rev))
    if not hits:
        raise Refused("the hits file holds no location")
    return hits


def resolve(root: Path, hit: Hit, main: str, scanned: dict[tuple[str, str], list[leakwhere.Hit]]) -> Hit:
    """The hit with the commit whose own added text the scanner matched there: the range scan numbers a
    line within the commit that added it, so the line is read from `<that commit>:<path>`, never from
    the branch's tip. The commits are the scanner's own reading of each commit of
    `<merge-base>..<branch>` (`leakwhere.commit_hits`, once per branch in `scanned`): a commit given on
    the hits line must be one of them with a hit at that place; without one, exactly one must."""
    if not publish.valid_branch(root, hit.branch):
        raise Refused(f"hits line {hit.number}: not a branch name")
    tip = None
    for ref in (f"refs/heads/{hit.branch}", f"refs/remotes/origin/{hit.branch}"):
        tip = git_out(root, "rev-parse", "--verify", "-q", f"{ref}^{{commit}}")
        if tip is not None:
            break
    if tip is None:
        raise Refused(f"hits line {hit.number}: no such branch here or on origin")
    base = git_out(root, "merge-base", main, tip)
    if base is None:
        raise Refused(f"hits line {hit.number}: the branch shares no history with origin/main")
    if (base, tip) not in scanned:
        attributed = leakwhere.commit_hits(
            root, publish.leakscan_argv(), base, tip, publish.scanner_env()
        )
        if attributed is None:
            raise Refused(f"hits line {hit.number}: the branch's commits cannot be scanned")
        scanned[(base, tip)] = attributed
    where = f"{hit.path}:{hit.line}"
    found = sorted({sha for sha, at, _ in scanned[(base, tip)] if at == where})
    if hit.rev:
        rev = git_out(root, "rev-parse", "--verify", "-q", f"{hit.rev}^{{commit}}")
        inside = rev is not None and not publish.is_ancestor(root, rev, base)
        if not inside or not publish.is_ancestor(root, rev or "", tip):
            raise Refused(f"hits line {hit.number}: that commit is not in the branch's range")
        if rev not in found:
            raise Refused(f"hits line {hit.number}: that commit adds no hit there")
        found = [rev or ""]
    if not found:
        raise Refused(f"hits line {hit.number}: no commit of the branch adds a hit there")
    if len(found) > 1:
        named = ", ".join(sha[:12] for sha in found)
        raise Refused(f"hits line {hit.number}: several commits add that line ({named}): give one")
    if git_out(root, "cat-file", "-t", f"{found[0]}:{hit.path}") != "blob":
        raise Refused(f"hits line {hit.number}: the commit holds no such file")
    return Hit(hit.number, hit.branch, hit.path, hit.line, found[0])


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
    scanned: dict[tuple[str, str], list[leakwhere.Hit]] = {}
    hits = [resolve(root, hit, main, scanned) for hit in hits]

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
        return finish(root, place, added, hits, branch, main)


def same_batch(root: Path, main: str, head: str | None, added: list[str]) -> bool:
    """True when `head` is this batch's commit: from its merge base with main it changes only the
    allowlist, by exactly `added` as new lines and nothing removed (main may have moved since)."""
    if head is None:
        return False
    base = git_out(root, "merge-base", main, head)
    if base is None or git_out(root, "rev-list", "--count", f"{base}..{head}") != "1":
        return False
    if (git_out(root, "diff", "--name-only", base, head) or "").splitlines() != [ALLOWLIST]:
        return False
    diff = git_out(root, "diff", "--unified=0", base, head, "--", ALLOWLIST) or ""
    body = [line for line in diff.splitlines() if line[:1] in "+-" and line[:3] not in ("+++", "---")]
    return not [x for x in body if x.startswith("-")] and sorted(x[1:] for x in body) == sorted(added)


def on_main(root: Path, main: str, head: str) -> bool:
    """True when `head`'s one parent is the current origin/main: only such a batch commit is reused."""
    return git_out(root, "rev-parse", f"{head}^@") == main


def origin_tip(root: Path, branch: str) -> str | None:
    """`branch`'s commit on origin (fetched into its tracking ref), or None when origin has none."""
    tracking = f"refs/remotes/origin/{branch}"
    if git(root, "fetch", "-q", "origin", f"+refs/heads/{branch}:{tracking}").returncode != 0:
        git(root, "update-ref", "-d", tracking)  # not on origin
    return git_out(root, "rev-parse", "--verify", "-q", f"{tracking}^{{commit}}")


def build(root: Path, place: Path, added: list[str], main: str, message: str) -> str:
    """This batch's commit on main, made in a scratch worktree (removed after): the hashes the scanner's
    `allow` computed, appended, so every existing line keeps its place (the scanner's own rewrite sorts
    the file and drops any line that is not a hash)."""
    tree = place / "worktree"
    if git(root, "worktree", "add", "-q", "--detach", str(tree), main).returncode != 0:
        raise Refused("git worktree add failed")
    try:
        allowlist = tree / ALLOWLIST
        allowlist.parent.mkdir(parents=True, exist_ok=True)
        before = allowlist.read_text(encoding="utf-8") if allowlist.exists() else ""
        if before and not before.endswith("\n"):
            before += "\n"
        allowlist.write_text(before + "".join(f"{value}\n" for value in added), encoding="utf-8")
        if git(tree, "add", "--", ALLOWLIST).returncode != 0:
            raise Refused("git add failed")
        if git(tree, "commit", "-q", "-m", message).returncode != 0:
            raise Refused("git commit failed")
        return git_out(tree, "rev-parse", "HEAD") or ""
    finally:
        git(root, "worktree", "remove", "--force", str(tree))


def finish(root: Path, place: Path, added: list[str], hits: list[Hit], branch: str, main: str) -> int:
    """Resumable: every step looks first at what an earlier run left. A commit is reused only when it
    is this batch's and its parent is the current origin/main: origin's first (no push), else the
    local branch's; otherwise a stale local branch is dropped by name and the batch built again on main.
    A branch on origin built on an older main is never reused: the batch is built again under
    `<name>-<main's short sha>`. The range is scanned; a head origin lacks is pushed; a PR is opened
    only when none is open. A branch on origin on the current main with other changes is refused."""
    count = len(added)
    names = ", ".join(sorted({hit.branch for hit in hits}))
    message = (
        f"leakscan: allowlist {count} hashes from {len(hits)} judged hits\n\n"
        f"The orchestrator judged these hits public. Their branches: {names}.\n"
        f"Only `{ALLOWLIST}` changes, by {count} added sha256 lines, "
        "hashed by `tools.leakscan allow`.\n"
    )
    remote = origin_tip(root, branch)
    if remote is not None and not on_main(root, main, remote):
        # Built on an older main: never reused (its PR could conflict with main). The batch is built
        # again on the current main, under the name of the batch and main's short sha.
        branch = f"{branch}-{main[:12]}"
        remote = origin_tip(root, branch)
        if remote is not None and not on_main(root, main, remote):
            raise Refused(f"{branch} is on origin on another base")
    if remote is not None and not same_batch(root, main, remote, added):
        raise Refused(f"{branch} is on origin with other changes")
    local = git_out(root, "rev-parse", "--verify", "-q", f"refs/heads/{branch}^{{commit}}")
    if remote is not None:
        head = remote
    elif local is not None and same_batch(root, main, local, added) and on_main(root, main, local):
        head = local
    else:
        if local is not None and git(root, "branch", "-D", branch).returncode != 0:
            raise Refused("git branch -D failed")  # a stale local branch: dropped by name, rebuilt
        head = build(root, place, added, main, message)
    if git(root, "update-ref", f"refs/heads/{branch}", head).returncode != 0:
        raise Refused("git update-ref failed")
    publish.range_scan(root, main, head, branch)
    if remote != head:
        # The same push as publish's, READY gate included: this commit carries no Factory trailer, so
        # the gate (the guard's) asks no verify record of it.
        publish.push(root, branch, head)
        print(f"allowlist: pushed {branch} at {head[:8]} ({count} hashes)")
    else:
        print(f"allowlist: {branch} at {head[:8]} is already on origin")
    found = publish.open_pr(branch)
    if found is not None:
        print(f"allowlist: the branch has open PR #{found['number']} ({found.get('url')})")
        return 0
    title, body = publish.pr_body(git_out(root, "log", "-1", "--format=%B", head) or message, head)
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
