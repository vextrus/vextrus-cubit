"""`python -m scripts.factory.publish <branch>`: scan, stamp, push and open the PR, in one call (#457).

Run it from the main checkout. In order, each step refusing (non-zero, nothing pushed, no PR) when it
fails:
1. an open PR for the branch already: it names that PR and changes nothing (exit 0);
2. the head is the branch's `refs/heads/<branch>` here (a local builder's), else origin's tip (a cloud
   builder's); its tip must read READY (trailers.md 1);
3. `tools.leakscan range <merge-base>..<head> --ref <branch>` scans every commit of the range, not only
   the tip, and writes the head's stamp; a hit is refused naming each `file:line` (the scanner's
   locations, never its text), and a head left without a valid stamp (no corpus) is refused;
4. `git push origin <branch>` pushes exactly that head, alone (a head only on origin is already there);
5. the body is the READY commit's message after its subject, without its `Factory-` and attribution
   trailers, plus a footer; `tools.leakscan file` scans it (and stamps its sha256), then `gh pr create
   --body-file` opens one PR.

Stamps and the corpus are written only by `tools.leakscan`; this module never prints a matched string.
`VEXTRUS_LEAKSCAN_CMD` names another scanner command line (a test seam, as the watcher's).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from scripts.factory import leakwhere
from scripts.factory.trailers import read as read_trailers

TREE = Path(__file__).resolve().parents[2]  # the tree holding this module and its scanner
GIT_TIMEOUT = 300
SCAN_TIMEOUT = 600
GH_TIMEOUT = 120
TITLE_LIMIT = 72
SHA40 = re.compile(r"^[0-9a-f]{40}$")
ATTRIBUTION = re.compile(r"^(?:co-authored-by|claude-session|signed-off-by)\s*:", re.IGNORECASE)
FACTORY = re.compile(r"^\s*factory[-_ ]", re.IGNORECASE)
FOOTER = "Published by `scripts.factory.publish` from {sha}, its range leak-scanned."


class Refused(Exception):
    """A step that cannot go on: its words are fixed text, locations and counts, never scanned text."""


@dataclass(frozen=True)
class Scan:
    clean: bool
    hits: list[tuple[str, int]]
    line: str


def git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdin=subprocess.DEVNULL,
        timeout=GIT_TIMEOUT,
        check=False,
    )


def git_out(root: Path, *args: str) -> str | None:
    done = git(root, *args)
    return done.stdout.strip() if done.returncode == 0 else None


def leakscan_argv() -> list[str]:
    """The real scanner, always: publish's range, stamp and body scans are gates, so no environment
    variable chooses them (`VEXTRUS_LEAKSCAN_CMD` is the watcher's read-only seam alone)."""
    return [sys.executable, "-m", "tools.leakscan"]


def scanner_env() -> dict[str, str]:
    """The environment for a scanner run: `tools.leakscan` resolves from this tree whatever the
    current folder (the project is not installed, so `python -m` finds it only on the path)."""
    paths = [str(TREE), *filter(None, os.environ.get("PYTHONPATH", "").split(os.pathsep))]
    return {**os.environ, "PYTHONPATH": os.pathsep.join(paths)}


def leakscan(root: Path, *args: str) -> Scan:
    """One scanner run with `--json`: its hits (locations and counts) and its summary line."""
    try:
        done = subprocess.run(
            [*leakscan_argv(), *args, "--json"],
            cwd=root,
            env=scanner_env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=SCAN_TIMEOUT,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Refused(f"the leak scan did not run ({type(error).__name__})") from None
    try:
        report = json.loads(done.stdout.strip().splitlines()[-1])
        summary = report["summary"]
        hits = [(str(h["where"]), int(h["n"])) for h in report["hits"]]
    except IndexError, ValueError, KeyError, TypeError:
        raise Refused(f"the leak scan's report is unreadable (exit {done.returncode})") from None
    status = summary.get("status")
    if status == "cannot-scan":
        raise Refused(f"the leak scan cannot scan ({summary.get('reason')})")
    if status == "skipped":
        raise Refused("the leak scan skipped: no corpus here, so nothing is published unscanned")
    line = f"hits={summary.get('hits')} scanned={summary.get('scanned')} corpus={summary.get('corpus')}"
    return Scan(done.returncode == 0 and status == "clean" and not hits, hits, line)


def stamp_valid(root: Path, name: str) -> bool:
    """The scanner's own verdict on the stamp `ok/<name>` (leakscan-cli.md 4)."""
    try:
        done = subprocess.run(
            [*leakscan_argv(), "verify-stamp", name],
            cwd=root,
            env=scanner_env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=SCAN_TIMEOUT,
            check=False,
        )
    except OSError, subprocess.TimeoutExpired:
        return False
    return done.returncode == 0 and "stamp valid" in done.stdout


def hit_names(scan: Scan, attributed: list[leakwhere.Hit] | None) -> list[str]:
    """Each hit as `<sha12> <where> (<n>)`, its commit and that commit's own location (the allowlist
    batch's `<branch>:<file>:<line> <commit>`); the ref name's hit, and every hit when the commits could
    not be read, as `<where> (<n>)`."""
    if not attributed:
        return [f"{where} ({n})" for where, n in scan.hits]
    named = [f"{sha[:12]} {where} ({n})" for sha, where, n in attributed]
    return named + [f"{where} ({n})" for where, n in scan.hits if where == "ref"]


def refuse_hits(scan: Scan, what: str, attributed: list[leakwhere.Hit] | None = None) -> None:
    if not scan.clean:
        named = hit_names(scan, attributed)
        places = ", ".join(named[:20]) or "no location given"
        more = f" and {len(named) - 20} more" if len(named) > 20 else ""
        raise Refused(f"{what} has leak hits at {places}{more}: nothing is pushed")


def is_ancestor(root: Path, ancestor: str, tip: str) -> bool:
    return git(root, "merge-base", "--is-ancestor", ancestor, tip).returncode == 0


def range_scan(root: Path, base: str, head: str, ref: str) -> None:
    """Scan `base..head` (every commit), require its stamp; refuse on a hit or a missing stamp."""
    scan = leakscan(root, "range", f"{base}..{head}", "--ref", ref)
    if not scan.clean:
        attributed = leakwhere.commit_hits(root, leakscan_argv(), base, head, scanner_env())
        refuse_hits(scan, "the range", attributed)
    if not stamp_valid(root, head):
        raise Refused("the scanned head has no valid leak stamp: nothing is pushed")
    print(f"publish: range {base[:8]}..{head[:8]} clean ({scan.line})")


def scan_body(root: Path, path: Path) -> None:
    """Scan a PR body file (the scanner stamps its sha256); refuse unless its stamp is valid."""
    scan = leakscan(root, "file", str(path))
    refuse_hits(scan, "the PR body")
    if not stamp_valid(root, hashlib.sha256(path.read_bytes()).hexdigest()):
        raise Refused("the PR body has no valid leak stamp: no PR is opened")


def gh(*args: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["gh", *args],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=GH_TIMEOUT,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Refused(f"gh did not run ({type(error).__name__})") from None


def open_pr(branch: str) -> dict[str, object] | None:
    """The branch's open PR, or None; refused when gh cannot say."""
    done = gh("pr", "list", "--head", branch, "--state", "open", "--json", "number,url,headRefOid")
    if done.returncode != 0:
        raise Refused(f"gh pr list failed (exit {done.returncode})")
    try:
        found = json.loads(done.stdout)
    except ValueError:
        raise Refused("gh pr list's reply is not JSON") from None
    if not isinstance(found, list):
        raise Refused("gh pr list's reply is not a list")
    rows = [row for row in found if isinstance(row, dict) and isinstance(row.get("number"), int)]
    return rows[0] if rows else None


def create_pr(branch: str, title: str, body: Path) -> str:
    done = gh(
        "pr", "create", "--title", title, "--body-file", str(body), "--base", "main", "--head", branch
    )
    if done.returncode != 0:
        raise Refused(f"gh pr create failed (exit {done.returncode})")
    lines = done.stdout.strip().splitlines()
    return lines[-1] if lines else "(no URL printed)"


def ready_problem(root: Path, head: str) -> str | None:
    """The guard's READY push gate (`readyProblem` in `.claude/hooks/guard.mjs`): a head whose trailers
    gate it as READY needs a green verify record for its tree at
    `<git-common-dir>/vextrus/verify-<tree>.json` (schema 1, that tree, checks non-empty, every
    `exit_code` 0). None when the head may be pushed; a head that is not gated (the allowlist batch's
    commit carries no Factory trailer) needs none, as the guard says."""
    message = git_out(root, "log", "-1", "--format=%B", head) or ""
    tree = git_out(root, "rev-parse", "--verify", "-q", f"{head}^{{tree}}")
    common = git_out(root, "rev-parse", "--git-common-dir")
    if tree is None or common is None:
        return "the pushed tree or the git folder cannot be read"
    if not read_trailers(message, tree).gated:
        return None
    path = (root / common).resolve() / "vextrus" / f"verify-{tree}.json"
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except OSError, ValueError:
        return f"no readable verify record for tree {tree}"
    checks = record.get("checks") if isinstance(record, dict) else None
    if (
        not isinstance(record, dict)
        or record.get("schema_version") != 1
        or record.get("tree") != tree
        or not isinstance(checks, list)
        or not checks
    ):
        return f"the verify record for tree {tree} is malformed or names another tree"
    if not all(isinstance(check, dict) and check.get("exit_code") == 0 for check in checks):
        return f"a check in the verify record for tree {tree} did not pass"
    return None


def push(root: Path, branch: str, head: str) -> None:
    """`git push origin <branch>` of exactly `head`, after the guard's READY gate (`ready_problem`)."""
    if git_out(root, "rev-parse", "--verify", "-q", f"refs/heads/{branch}") != head:
        raise Refused("the branch moved during the scan: nothing is pushed")
    problem = ready_problem(root, head)
    if problem is not None:
        raise Refused(f"{problem}: run scripts.verify on that tree; nothing is pushed")
    done = git(root, "push", "origin", branch)
    if done.returncode != 0:
        raise Refused(f"git push failed (exit {done.returncode})")


def fetch_main(root: Path) -> str:
    if git(root, "fetch", "-q", "origin", "main").returncode != 0:
        raise Refused("git fetch origin main failed")
    main = git_out(root, "rev-parse", "--verify", "-q", "refs/remotes/origin/main^{commit}")
    if main is None:
        raise Refused("no origin/main after the fetch")
    return main


def valid_branch(root: Path, branch: str) -> bool:
    return (
        branch not in ("main", "HEAD")
        and not branch.startswith("-")
        and git(root, "check-ref-format", "--branch", branch).returncode == 0
    )


def pr_body(message: str, sha: str) -> tuple[str, str]:
    """(title, body): the subject; the rest without factory and attribution trailers, plus a footer."""
    lines = message.replace("\r", "").split("\n")
    title = lines[0].strip()[:TITLE_LIMIT] if lines else ""
    kept = [line for line in lines[1:] if not FACTORY.match(line) and not ATTRIBUTION.match(line)]
    body = re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip("\n")
    return title, f"{body}\n\n{FOOTER.format(sha=sha)}\n"


def body_file(root: Path, branch: str, sha: str, body: str) -> Path:
    folder = root / ".private" / "work" / "publish"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{branch.replace('/', '-')}-{sha[:12]}.md"
    path.write_text(body, encoding="utf-8")
    return path


def publish(root: Path, branch: str) -> int:
    if not valid_branch(root, branch):
        raise Refused("not a branch name publish takes")
    main = fetch_main(root)
    found = open_pr(branch)
    if found is not None:
        # The PR's number and URL only: the branch name is printed only after its range scan.
        print(
            f"publish: the branch has open PR #{found['number']} ({found.get('url')}): nothing changed"
        )
        return 0
    tracking = f"refs/remotes/origin/{branch}"
    if git(root, "fetch", "-q", "origin", f"+refs/heads/{branch}:{tracking}").returncode:
        git(root, "update-ref", "-d", tracking)  # not on origin (a local builder's branch)
    local = git_out(root, "rev-parse", "--verify", "-q", f"refs/heads/{branch}^{{commit}}")
    remote = git_out(root, "rev-parse", "--verify", "-q", f"refs/remotes/origin/{branch}^{{commit}}")
    head = local or remote
    if head is None:
        raise Refused(f"no branch {branch} here or on origin")
    message = git_out(root, "log", "-1", "--format=%B", head) or ""
    tree = git_out(root, "rev-parse", f"{head}^{{tree}}") or ""
    outcome = read_trailers(message, tree).outcome
    if outcome != "READY":
        raise Refused(f"the head {head[:8]} is not READY ({outcome or 'no Factory-State'})")
    base = git_out(root, "merge-base", main, head)
    if base is None:
        raise Refused("the head shares no history with origin/main")
    range_scan(root, base, head, branch)
    if local is not None and local != remote:
        push(root, branch, head)
        print(f"publish: pushed {branch} at {head[:8]}")
    else:
        print(f"publish: {branch} at {head[:8]} is already on origin")
    title, body = pr_body(message, head)
    path = body_file(root, branch, head, body)
    scan_body(root, path)
    url = create_pr(branch, title, path)
    print(f"publish: opened {url}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.publish", allow_abbrev=False)
    parser.add_argument("branch")
    options = parser.parse_args(argv)
    try:
        return publish(Path.cwd(), options.branch)
    except Refused as refusal:
        print(f"publish: refused: {refusal}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
