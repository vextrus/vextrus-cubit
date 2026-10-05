"""`python -m scripts.land <PR> [<PR> ...]`: land reviewed PRs in order (docs/specs/factory.md 2.2
"Land").

For each PR, engine PRs with a ledger PASS first, then the rest by number (a PR with no PASS is left
out): it refuses (exit 3) unless the local review ledger has a PASS for the PR's head, then marks the PR
ready, brings main in (`gh pr update-branch`), waits for CI, reruns the failed jobs **once** and only
when every failed test is listed in `.github/flaky.txt`, runs `merge_ready`, merges and pulls main. It
never raises privilege and never runs a shell. Exit codes: 0 landed, 2 usage, 3 refused.
"""

import json
import subprocess
import sys
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any, Protocol

from scripts.ledger import default_ledger_dir
from tools.lint.engine_paths import matching, read_patterns

REPOSITORY = "vextrus/vextrus-cubit"
FLAKY = Path(".github/flaky.txt")
ENGINE_PATHS = Path(".github/engine-paths.txt")


class GitHub(Protocol):
    def head_sha(self, pr: int) -> str: ...
    def mark_ready(self, pr: int) -> None: ...
    def update_branch(self, pr: int) -> None: ...
    def wait_ci(self, pr: int) -> list[str]: ...
    def rerun_failed(self, pr: int) -> None: ...
    def merge(self, pr: int) -> None: ...
    def pull_main(self) -> None: ...


def has_pass(ledger_dir: Path, pr: int, head: str) -> bool:
    """The ledger holds a PASS for exactly this head (round 3 only with its exception)."""
    try:
        record = json.loads((ledger_dir / f"{pr}-{head}.json").read_text())
    except OSError, ValueError:
        return False
    return (
        isinstance(record, dict)
        and record.get("pr") == pr
        and record.get("head") == head
        and record.get("verdict") == "PASS"
        and (record.get("round") != 3 or record.get("exception") is not None)
    )


def land(pr: int, gh: GitHub, *, ledger_dir: Path, flaky: set[str], ready: Callable[[int], int]) -> int:
    head = gh.head_sha(pr)
    if not has_pass(ledger_dir, pr, head):
        print(f"land: refused: PR {pr} has no ledger PASS for its head {head[:12]}: review it first")
        return 3
    gh.mark_ready(pr)
    gh.update_branch(pr)
    failed = gh.wait_ci(pr)
    if failed:
        if not set(failed) <= flaky:
            print(
                f"land: refused: PR {pr}: {len(set(failed) - flaky)} failed test(s) not listed as flaky"
            )
            return 3
        gh.rerun_failed(pr)
        if again := gh.wait_ci(pr):
            print(f"land: refused: PR {pr}: still red after its one rerun ({len(again)} failed)")
            return 3
    if ready(pr) != 0:
        print(f"land: refused: merge_ready refuses PR {pr}")
        return 3
    gh.merge(pr)
    gh.pull_main()
    print(f"land: PR {pr} merged")
    return 0


def order(prs: Iterable[dict[str, Any]]) -> list[int]:
    """Engine PRs with a PASS first, then the rest with a PASS, each by number."""
    passing = [pr for pr in prs if pr["pass"]]
    return [pr["number"] for pr in sorted(passing, key=lambda pr: (not pr["engine"], pr["number"]))]


def flaky_list(path: Path = FLAKY) -> set[str]:
    if not path.is_file():
        return set()
    lines = (line.strip() for line in path.read_text().splitlines())
    return {line for line in lines if line and not line.startswith("#")}


class Gh:
    """The real calls, through `gh` and `git` (no shell, no privilege)."""

    def _run(self, *argv: str) -> str:
        done = subprocess.run(list(argv), capture_output=True, text=True, check=True)
        return done.stdout

    def head_sha(self, pr: int) -> str:
        return self._run(
            "gh",
            "pr",
            "view",
            str(pr),
            "--repo",
            REPOSITORY,
            "--json",
            "headRefOid",
            "-q",
            ".headRefOid",
        ).strip()

    def files(self, pr: int) -> list[str]:
        return self._run("gh", "pr", "diff", str(pr), "--repo", REPOSITORY, "--name-only").split()

    def mark_ready(self, pr: int) -> None:
        subprocess.run(["gh", "pr", "ready", str(pr), "--repo", REPOSITORY], check=False)

    def update_branch(self, pr: int) -> None:
        self._run("gh", "pr", "update-branch", str(pr), "--repo", REPOSITORY)

    def wait_ci(self, pr: int) -> list[str]:
        """The failed checks, by name: a check is not a test id, so it never matches the flaky list
        (mapping a CI failure to its tests is verify's, not this script's): a red CI is refused."""
        subprocess.run(
            ["gh", "pr", "checks", str(pr), "--repo", REPOSITORY, "--watch"],
            capture_output=True,
            check=False,
        )
        checks = json.loads(
            self._run("gh", "pr", "checks", str(pr), "--repo", REPOSITORY, "--json", "name,bucket")
        )
        return [f"check: {check['name']}" for check in checks if check["bucket"] in ("fail", "cancel")]

    def rerun_failed(self, pr: int) -> None:
        raise RuntimeError("a rerun needs the failed tests' ids, which this script does not read")

    def merge(self, pr: int) -> None:
        head = self.head_sha(pr)
        self._run(
            "gh", "pr", "merge", str(pr), "--repo", REPOSITORY, "--merge", "--match-head-commit", head
        )

    def pull_main(self) -> None:
        self._run("git", "pull", "--ff-only", "origin", "main")


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if not args or not all(arg.isdigit() for arg in args):
        print("usage: python -m scripts.land <PR> [<PR> ...]", file=sys.stderr)
        return 2
    from scripts.merge_ready import main as merge_ready

    gh, store = Gh(), default_ledger_dir()
    patterns = read_patterns(ENGINE_PATHS.read_text()) if ENGINE_PATHS.is_file() else []
    prs = [
        {
            "number": int(arg),
            "engine": bool(matching(gh.files(int(arg)), patterns)),
            "pass": has_pass(store, int(arg), gh.head_sha(int(arg))),
        }
        for arg in args
    ]
    skipped = sorted({int(arg) for arg in args} - set(order(prs)))
    for pr in skipped:
        print(f"land: PR {pr} has no ledger PASS for its head: left out")
    for pr in order(prs):
        code = land(pr, gh, ledger_dir=store, flaky=flaky_list(), ready=lambda n: merge_ready([str(n)]))
        if code != 0:
            return code
    return 3 if skipped else 0


if __name__ == "__main__":
    sys.exit(main())
