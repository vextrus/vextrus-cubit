"""One command to commit an acceptance amendment (#313): ruff, ruff format, mypy and the acceptance lint
pass on it before it is committed, so an amendment never fails CI's Ruff or the acceptance check.

    python -m scripts.factory.amend --subject "<text>" --red <n> --green <n>
        [--body-file <f>] [--base <rev>] <path>...

Each path is one changed acceptance file (`tools.lint.acceptance.is_acceptance`), named explicitly.
The message is `acceptance: <subject>`, the body file verbatim, then `red-on-main: <n> failed` and
`green-on-throwaway: <n> passed`; the caller puts any trailers in the body file. Every check runs even
after one fails. The commit is built with `git commit-tree` and judged by the acceptance lint on
`<base>..<commit>` before HEAD moves to it (`git update-ref`, compare-and-swap), so a refusal leaves
nothing to undo. The base defaults to `git merge-base origin/main HEAD`.

Exit 0 committed, 2 bad input or usage (nothing changed), 3 a check refused (nothing committed, the
index as found).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from scripts.verify import Check
from tools.lint.acceptance import count_problems, is_acceptance, problems

Run = Callable[[Check, Path], tuple[int, str]]
GLOB = set("*?[")
SHOWN = 40


def run_command(check: Check, cwd: Path) -> tuple[int, str]:
    """`scripts.verify.run_command` with a working directory."""
    done = subprocess.run(
        check.argv, cwd=cwd, capture_output=True, text=True, check=False, env={**os.environ, **check.env}
    )
    return done.returncode, done.stdout + done.stderr


class Refused(Exception):
    def __init__(self, code: int, reason: str) -> None:
        super().__init__(reason)
        self.code = code


def _git(root: Path, *args: str, stdin: str | None = None) -> str:
    done = subprocess.run(
        ["git", "-C", str(root), *args], input=stdin, capture_output=True, text=True, check=False
    )
    if done.returncode != 0:
        raise Refused(2, f"git {' '.join(args)} failed: {done.stderr.strip()}")
    return done.stdout.strip()


def parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.amend")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--red", type=int, required=True)
    parser.add_argument("--green", type=int, required=True)
    parser.add_argument("--body-file", type=Path)
    parser.add_argument("--base")
    parser.add_argument("paths", nargs="+")
    return parser.parse_args(argv)


def acceptance_path(root: Path, raw: str) -> str:
    """The path relative to the repository, if it is one existing acceptance file; else refused (2)."""
    parts = raw.replace("\\", "/").split("/")
    if GLOB & set(raw) or any(part in {".", ".."} for part in parts):
        raise Refused(2, f"{raw}: name each file exactly (no glob, '.' or '..')")
    target = Path(raw).absolute()
    if target.is_symlink() or not target.is_file():
        raise Refused(2, f"{raw}: not an existing regular file")
    try:
        path = target.relative_to(root.absolute()).as_posix()
    except ValueError:
        raise Refused(2, f"{raw}: outside the repository {root}") from None
    if not is_acceptance(path):
        raise Refused(2, f"{raw}: not an acceptance path (an acceptance commit changes them only)")
    return path


def message(subject: str, body: str, red: int, green: int) -> str:
    counts = f"red-on-main: {red} failed\ngreen-on-throwaway: {green} passed\n"
    return f"acceptance: {subject}\n\n" + (f"{body.strip(chr(10))}\n\n" if body.strip() else "") + counts


def plan(paths: list[str]) -> tuple[list[Check], list[str]]:
    """The checks for the changed files, and the files no check covers."""
    python = [path for path in paths if path.endswith(".py")]
    checks = []
    if python:
        checks += [
            Check("ruff", ("uv", "run", "ruff", "check", *python)),
            Check("ruff-format", ("uv", "run", "ruff", "format", "--check", *python)),
            Check("mypy", ("uv", "run", "mypy", *python)),
        ]
    mjs = [path for path in paths if path.endswith(".mjs")]
    checks += [Check("node", ("node", "--check", path)) for path in mjs]
    return checks, [path for path in paths if path not in python and path not in mjs]


def prepare(args: argparse.Namespace, root: Path) -> tuple[list[str], str, str]:
    """The paths, the base sha and the message, validated before anything is touched."""
    if not args.subject.strip() or "\n" in args.subject:
        raise Refused(2, "--subject must be one non-empty line")
    paths = list(dict.fromkeys(acceptance_path(root, raw) for raw in args.paths))
    for path in paths:
        if not _git(root, "status", "--porcelain", "--", path):
            raise Refused(2, f"{path}: does not differ from HEAD")
    staged = _git(root, "diff", "--cached", "--name-only").splitlines()
    if extra := [name for name in staged if name and name not in paths]:
        raise Refused(2, f"{extra[0]} is staged: an acceptance commit changes acceptance tests only")
    try:
        base = _git(root, "rev-parse", "--verify", f"{args.base}^{{commit}}") if args.base else ""
        base = base or _git(root, "merge-base", "origin/main", "HEAD")
    except Refused:
        raise Refused(2, "no base found: pass --base <rev>") from None
    body = args.body_file.read_text() if args.body_file else ""
    return paths, base, message(args.subject.strip(), body, args.red, args.green)


def check(paths: list[str], text: str, run: Run, root: Path) -> bool:
    """Every check, each reported; True when all passed."""
    clean = True
    if found := count_problems(text):
        clean = False
        print("amend: acceptance 1")
        for problem in found:
            print(f"  the message {problem}")
    checks, unchecked = plan(paths)
    for path in unchecked:
        print(f"amend: not checked: {path}")
    for one in checks:
        code, output = run(one, root)
        print(f"amend: {one.name} {code}")
        if code != 0:
            clean = False
            print("\n".join(output.splitlines()[:SHOWN]))
    return clean


def commit(paths: list[str], base: str, text: str, root: Path) -> int:
    """Stage the paths, build the commit, let the real lint judge it, and only then move HEAD."""
    found_index, head = _git(root, "write-tree"), _git(root, "rev-parse", "HEAD")
    _git(root, "add", "--", *paths)
    tree = _git(root, "write-tree")
    new = _git(root, "commit-tree", tree, "-p", head, "-F", "-", stdin=text)
    if found := problems(root, base, new):
        _git(root, "read-tree", found_index)
        print("amend: acceptance 1")
        print("\n".join(found))
        return 3
    _git(root, "update-ref", "-m", "amend: acceptance", "HEAD", new, head)
    print(f"amend: committed {new[:12]}")
    return 0


def main(argv: list[str] | None = None, *, run: Run = run_command, root: Path | None = None) -> int:
    args = parse(sys.argv[1:] if argv is None else argv)
    try:
        top = root or Path(_git(Path.cwd(), "rev-parse", "--show-toplevel"))
        paths, base, text = prepare(args, top)
        if not check(paths, text, run, top):
            return 3
        return commit(paths, base, text, top)
    except Refused as refused:
        print(f"amend: {refused}", file=sys.stderr)
        return refused.code


if __name__ == "__main__":
    sys.exit(main())
