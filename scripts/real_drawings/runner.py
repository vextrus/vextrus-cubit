"""The pipeline's user (ticket 24s; session 06's ruling: "`vxrun` alone runs the posting path from a
root-owned installed copy and writes the posting runs' folders; the scorer refuses a folder `vxrun` did
not write").

A scored run (a PR's posting run, or `--score` on a branch or main) is not run as the owner's user: an
agent running as that user could otherwise write a hand-made export into the drop folder and have it
scored. The owner's side gathers what the run reads into a new spool folder, as that user may: a git
bundle of main and the head (git's objects, each checked by its hash when the bundle is fetched), the
Development Sets (hard links, never copies) and the locked wheels it fetched (each checked by its hash
again by pip). It then runs the installed command as `vxrun` through one password-free rule.

As `vxrun`, the installed command (root's copy under /usr/local/lib/vextrus/runner, on the toolchain's
Python with `-I`) fetches the bundle into `vxrun`'s own bare mirror, so no git command it runs reads the
owner's repository or its config (a config can run a program); refuses to run when its own files are not
main's; and runs the check with `vxrun`'s own cache (an export cached by the owner's user is never
reused), writing the run's folder in the drop folder, which only `vxrun` may write. The scorer then reads
that folder as the key user. Nothing here raises privilege but the one `sudo -n -u vxrun` line.
"""

import argparse
import os
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tomllib
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path

from scripts.real_drawings.drop import open_new, take
from scripts.real_drawings.source import MAIN, Refused, git, resolve, show

RUNNER_USER = "vxrun"
HOME = Path("/var/lib/vxrun")  # vxrun's, mode 700: its mirror and its cache
SPOOL = Path("/srv/vextrus-spool")  # the owner's user's, group vxrun (setgid), mode 2750
INSTALLED = Path("/usr/local/lib/vextrus/runner")  # root's copy of the command
RUNNER = Path("/usr/local/lib/vextrus/real-drawings-run")  # its launcher, root's
BIN = Path("/usr/local/lib/vextrus/bin")  # root's copy of uv, which the fetch runs
CONFIG = Path("/usr/local/lib/vextrus/post-status.toml")  # drop-setup.sh's root-owned copy
SCORER = Path("/usr/local/bin/vx-score")
TOKEN = re.compile(r"\A[0-9a-f]{16}\Z")
SET_NAME = re.compile(r"\A[a-z0-9][a-z0-9-]{0,63}\Z")
# A branch the poster can ask GitHub about (scripts/owner/post-status's `head`): no `/`.
BRANCH = re.compile(r"\A[A-Za-z0-9][A-Za-z0-9._-]{0,99}\Z")
BUNDLE = "head.bundle"
# The installed copy: every file the command imports, as paths in the repository (keys-custody.sh
# installs these and the runner checks each against main's).
FILES = (
    "scripts/__init__.py",
    "scripts/real_drawings/__init__.py",
    "scripts/real_drawings/command.py",
    "scripts/real_drawings/diff.py",
    "scripts/real_drawings/drop.py",
    "scripts/real_drawings/runner.py",
    "scripts/real_drawings/sandbox.py",
    "scripts/real_drawings/schema.py",
    "scripts/real_drawings/source.py",
    "scripts/real_drawings/wheels.py",
    "tools/__init__.py",
    "tools/lint/__init__.py",
    "tools/lint/engine_paths.py",
    "tools/lint/lock_sources.py",
)


# The owner's side.


def spool(repo: Path, target: str, sets: Mapping[str, Path], wheels: Path, into: Path = SPOOL) -> Path:
    """A new spool folder: the bundle of main and the head, the sets' hard links and the wheels."""
    refs = [f"refs/heads/{MAIN}"]
    if target.isdigit():
        git(repo, "fetch", "--quiet", "origin", f"+refs/pull/{target}/head:refs/pull/{target}/head")
        refs.append(f"refs/pull/{target}/head")
    elif target != MAIN:
        if not BRANCH.match(target) or ".." in target:
            raise Refused(f"not a branch name the check runs: {target!r}")
        refs.append(f"refs/heads/{target}")
    folder = into / secrets.token_hex(8)
    folder.mkdir(mode=0o750)
    git(repo, "bundle", "create", "--quiet", str(folder / BUNDLE), *refs)
    for name, source in sets.items():
        _link_tree(source, folder / "sets" / name)
    (folder / "wheels").mkdir(mode=0o750)
    for wheel in sorted(wheels.glob("*.whl")) if wheels.is_dir() else []:
        if wheel.is_file() and not wheel.is_symlink():
            _link(wheel, folder / "wheels" / wheel.name)
    return folder


def delegate(
    argv: Sequence[str],
    target: str,
    *,
    repo: Path,
    sets: Mapping[str, Path],
    wheels: Path,
    into: Path = SPOOL,
    runner: Callable[[list[str]], int] | None = None,
) -> int:
    """Runs the scored run as the pipeline's user from a new spool folder, which it then removes."""
    folder = spool(repo, target, sets, wheels, into)
    try:
        command = ["--spool", folder.name, *argv]
        if runner is not None:
            return runner(command)
        sudo = ["sudo", "-n", "-u", RUNNER_USER, str(RUNNER), *command]
        return subprocess.run(sudo, check=False).returncode
    finally:
        shutil.rmtree(folder)  # the spool's own new folder: hard links and the bundle, never followed


def installed() -> bool:
    return RUNNER.exists()


def _link_tree(source: Path, into: Path) -> None:
    """The set's folders and regular files as hard links (a link or any other file is left out)."""
    into.mkdir(parents=True, mode=0o750)
    for path in sorted(source.rglob("*")):
        if path.is_symlink():
            continue
        target = into / path.relative_to(source)
        if path.is_dir():
            target.mkdir(mode=0o750, exist_ok=True)
        elif path.is_file():
            _link(path, target)


def _link(path: Path, target: Path) -> None:
    try:
        os.link(path, target, follow_symlinks=False)
    except OSError:  # another file system: a copy
        shutil.copyfile(path, target, follow_symlinks=False)


# The pipeline's user's side: the installed command.


def runner_main(
    argv: Sequence[str] | None = None,
    *,
    home: Path = HOME,
    spools: Path = SPOOL,
    installed_at: Path = INSTALLED,
    run: Callable[..., int] | None = None,
    machine: Callable[[Path, Path], object] | None = None,
    on_github: Callable[[str], str] | None = None,
) -> int:
    """`real-drawings-run --spool TOKEN <target> [--score] [--fresh] [--accept-if-clean | --accept R]`,
    as the pipeline's user; the command's own `main` is the owner's side."""
    from scripts.real_drawings import command

    parser = argparse.ArgumentParser(prog="real-drawings-run")
    parser.add_argument("--spool", required=True)
    parser.add_argument("target")
    parser.add_argument("--score", action="store_true")
    parser.add_argument("--fresh", action="store_true")
    how = parser.add_mutually_exclusive_group()
    how.add_argument("--accept-if-clean", action="store_true")
    how.add_argument("--accept", metavar="REASON")
    args = parser.parse_args(argv)
    try:
        if not TOKEN.match(args.spool):
            raise Refused("the spool is not one the owner's side made")
        if not (args.target.isdigit() or args.target == MAIN or BRANCH.match(args.target)):
            raise Refused(f"not a target the check runs: {args.target!r}")
        if not args.target.isdigit() and not args.score:
            raise Refused("the pipeline's user runs a PR's posting run or a scored run, nothing else")
        folder = _spool_folder(spools, args.spool)
        mirror = fetch_bundle(home / "repo.git", folder / BUNDLE)
        main_commit = git(mirror, "rev-parse", "--verify", f"refs/heads/{MAIN}^{{commit}}").decode()
        if stale := stale_files(installed_at, mirror, main_commit.strip()):
            raise Refused(
                f"the installed command is not main's ({stale}): the owner runs"
                " scripts/owner/keys-custody.sh again"
            )
        # Only what GitHub holds is scored: a commit nobody pushed, whose engine could write any export,
        # is never measured, and neither is a head measured against a main nobody pushed.
        head = resolve(mirror, args.target, fetch=False)
        for ref, commit in ((args.target, head.commit), (MAIN, main_commit.strip())):
            if (on_github or github_head)(ref) != commit:
                raise Refused(
                    f"{ref} is not {commit[:12]} on GitHub: a scored run measures only what GitHub"
                    " holds (push it, or bring main up to date, and run again)"
                )
        work = home / "work" / args.spool
        try:
            _take_sets(folder / "sets", work / "sets")
            m = (machine or runners_machine)(home, work)
            assert isinstance(m, command.Machine)
            _take_wheels(folder / "wheels", m.cache / "wheels")
            return (run or command.run)(
                args.target,
                no_post=not args.target.isdigit(),
                score=True,
                m=m,
                fresh=args.fresh,
                accept=args.accept,
                accept_if_clean=args.accept_if_clean,
            )
        finally:
            shutil.rmtree(work, ignore_errors=True)  # the pipeline's user's own copy of the sets
    except Refused as refused:
        print(f"real-drawings: refused: {refused}", file=sys.stderr)
        return 2


def runners_machine(home: Path, work: Path) -> object:
    """The pipeline's user's machine: its mirror and cache, its own copy of the sets, and the key
    user's poster and scorer, each through `sudo -n` (vxrun's rule names exactly those two)."""
    from scripts.real_drawings.command import SETS, Machine

    config = tomllib.loads(CONFIG.read_text())

    def as_key_user(*command: str) -> int:
        line = ["sudo", "-n", "-u", config["key_user"], *command]
        return subprocess.run(line, check=False).returncode

    return Machine(
        repo=home / "repo.git",
        toolchain=Path("/opt/vextrus"),
        cache=home / "cache",
        drop=Path(config["drop"]),
        sets={name: work / "sets" / name for name in SETS},
        post=lambda run_id: as_key_user(config["installed"], "real-drawings", run_id),
        score=lambda run_id: as_key_user(str(SCORER), run_id),
        fetch_prs=False,
    )


def github_head(ref: str) -> str:
    """The commit GitHub holds for main, a branch or a PR, as the poster (run as the key user, whose App
    reads it) prints it; "" when it cannot say."""
    config = tomllib.loads(CONFIG.read_text())
    line = ["sudo", "-n", "-u", config["key_user"], config["installed"], "head", ref]
    done = subprocess.run(line, capture_output=True, text=True, check=False)
    if done.returncode != 0:
        print(done.stderr.strip(), file=sys.stderr)
        return ""
    return done.stdout.strip()


def fetch_bundle(mirror: Path, bundle: Path) -> Path:
    """The bundle's refs into the pipeline's user's own bare mirror, every object checked. The spool is
    the owner's user's, so the bundle is first copied, as a regular file opened without following a
    link, beside the mirror: git never reads a path the owner's user could swap for a repository."""
    if not mirror.exists():
        mirror.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "init", "--quiet", "--bare", "-b", MAIN, str(mirror)], check=True)
        git(mirror, "config", "transfer.fsckObjects", "true")
    incoming = mirror.parent / "incoming.bundle"
    incoming.unlink(missing_ok=True)
    try:
        take(bundle.parent, bundle.name, incoming)
    except Refused, OSError:
        raise Refused("the spool holds no plain bundle") from None
    try:
        git(
            mirror,
            "fetch",
            "--quiet",
            "--no-tags",
            str(incoming),
            "+refs/heads/*:refs/heads/*",
            "+refs/pull/*:refs/pull/*",
        )
    finally:
        incoming.unlink(missing_ok=True)
    return mirror


def launch() -> None:
    """The installed launcher's entry: a fixed environment and folder, then `runner_main`."""
    os.environ.clear()
    os.environ.update({"PATH": f"{BIN}:/usr/bin:/bin", "HOME": str(HOME), "LANG": "C.UTF-8"})
    os.chdir(HOME)
    sys.exit(runner_main())


def stale_files(root: Path, mirror: Path, main_commit: str) -> str:
    """The first installed file that is not main's, or "" when every one is."""
    for path in FILES:
        on_main = show(mirror, main_commit, path)
        here = root / path
        if on_main is None or not here.is_file() or here.read_bytes() != on_main:
            return path
    return ""


def _spool_folder(spools: Path, token: str) -> Path:
    folder = spools / token
    info = os.lstat(folder) if os.path.lexists(folder) else None
    if info is None or not stat.S_ISDIR(info.st_mode):
        raise Refused("no such spool folder")
    return folder


def _take_sets(spooled: Path, into: Path) -> None:
    """The spool's sets copied into the pipeline's user's own folder, so what is digested is what the
    sandbox reads (the owner's user can change its own hard links' files at any time): folders and
    regular files only, each opened without following a link."""
    if spooled.is_symlink() or not spooled.is_dir():
        raise Refused("the spool holds no sets")
    for root in sorted(spooled.iterdir()):
        name = root.name
        if root.is_symlink() or not root.is_dir() or not SET_NAME.match(name):
            continue  # a set the check reads but the spool lacks is refused by the check itself
        for folder, dirs, files in os.walk(root, followlinks=False):
            relative = Path(folder).relative_to(root)
            (into / name / relative).mkdir(parents=True, exist_ok=True)
            dirs[:] = [d for d in dirs if not (Path(folder) / d).is_symlink()]
            for file in files:
                _copy_regular(Path(folder) / file, into / name / relative / file)


def _copy_regular(source: Path, target: Path) -> None:
    """`source` into a new `target` when it is a regular file (a hard link is: the spool is made of
    them); a symbolic link, a pipe or a device is never opened for reading."""
    try:
        handle = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except OSError:
        return
    try:
        if not stat.S_ISREG(os.fstat(handle).st_mode):
            return
        with os.fdopen(os.dup(handle), "rb") as reading, open_new(target) as writing:
            shutil.copyfileobj(reading, writing, 1 << 20)
    finally:
        os.close(handle)


def _take_wheels(spooled: Path, wheels: Path) -> None:
    """The owner's wheels into the pipeline's user's own wheel folder (pip checks each by its hash)."""
    wheels.mkdir(parents=True, exist_ok=True)
    for wheel in sorted(spooled.glob("*.whl")) if spooled.is_dir() else []:
        target = wheels / wheel.name
        if wheel.is_symlink() or not wheel.is_file() or target.exists():
            continue
        shutil.copyfile(wheel, target, follow_symlinks=False)
