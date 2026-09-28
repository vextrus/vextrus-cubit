"""The head a run measures, and what it may bring into the sandbox (the M0 plan, the real-drawing check,
steps 1, 2 and 7).

A run's checkout holds only the files on the engine paths (main's `.github/engine-paths.txt`), written
from git's objects into a folder under the owner's cache: the code hash covers exactly what the sandbox
can execute, so a cached export is never reused for code that differs. Before anything runs, a head is
refused when the installed `dwgread` is off its pin, when its `uv.lock` names a source other than the
package registry, or when its `[tool.uv]` table differs from main's.
"""

import hashlib
import os
import subprocess
import tomllib
from dataclasses import dataclass
from pathlib import Path

from tools.lint.engine_paths import matching, read_patterns
from tools.lint.lock_sources import problems as lock_problems

MAIN = "main"


class Refused(Exception):
    """The check will not run, or will not post, and says why."""


@dataclass(frozen=True)
class Head:
    target: str  # "PR 57", "branch x" or "main"
    pr: int | None
    commit: str


@dataclass(frozen=True)
class Blob:
    mode: str
    oid: str
    path: str


def git(repo: Path, *args: str, stdin: bytes | None = None) -> bytes:
    done = subprocess.run(["git", "-C", str(repo), *args], input=stdin, capture_output=True, check=False)
    if done.returncode != 0:
        raise Refused(f"git {' '.join(args)}: {done.stderr.decode(errors='replace').strip()}")
    return done.stdout


def resolve(repo: Path, target: str) -> Head:
    """A PR number (its head fetched from origin), `main`, or a local branch."""
    if target.isdigit():
        git(repo, "fetch", "--quiet", "origin", f"refs/pull/{target}/head")
        return Head(f"PR {target}", int(target), _commit(repo, "FETCH_HEAD"))
    if target == MAIN:
        return Head(MAIN, None, _commit(repo, f"refs/heads/{MAIN}"))
    return Head(f"branch {target}", None, _commit(repo, f"refs/heads/{target}"))


def show(repo: Path, commit: str, path: str) -> bytes | None:
    done = subprocess.run(
        ["git", "-C", str(repo), "show", f"{commit}:{path}"], capture_output=True, check=False
    )
    return done.stdout if done.returncode == 0 else None


def engine_files(repo: Path, commit: str, patterns_text: str) -> list[Blob]:
    listed = git(repo, "ls-tree", "-r", "-z", "--full-tree", commit).split(b"\0")
    blobs = {}
    for entry in filter(None, listed):
        meta, path = entry.decode().split("\t", 1)
        mode, _kind, oid = meta.split()
        blobs[path] = Blob(mode, oid, path)
    chosen = matching(sorted(blobs), read_patterns(patterns_text))
    # ls-tree and cat-file, unlike a checkout, accept a tree entry named `..` or `.` (git mktree
    # builds one), so a head's tree could name a file outside the scratch checkout (review of #58).
    crafted = [p for p in chosen if any(part in ("", ".", "..") for part in p.split("/"))]
    if crafted:
        raise Refused(f"an engine path is not a plain path (an empty, . or .. part): {crafted[0]!r}")
    odd = [p for p in chosen if blobs[p].mode not in ("100644", "100755")]
    if odd:
        raise Refused(
            f"an engine path is a link or a submodule, which the check does not copy: {odd[0]}"
        )
    return [blobs[p] for p in chosen]


def code_hash(files: list[Blob]) -> str:
    """Every engine path's name, mode and content (git's object id), in path order."""
    listing = "".join(f"{f.mode} {f.oid} {f.path}\n" for f in files)
    return hashlib.sha256(listing.encode()).hexdigest()


def write_checkout(repo: Path, files: list[Blob], into: Path) -> None:
    """The engine paths' files from git's objects (never a working tree), into a new folder."""
    into.mkdir(parents=True)
    root = into.resolve()
    batch = git(repo, "cat-file", "--batch", stdin="".join(f"{f.oid}\n" for f in files).encode())
    at = 0
    for f in files:
        header_end = batch.index(b"\n", at)
        size = int(batch[at:header_end].split()[2])
        body = batch[header_end + 1 : header_end + 1 + size]
        at = header_end + 1 + size + 1
        target = into / f.path
        if not target.resolve().is_relative_to(root):  # a second wall behind engine_files' refusal
            raise Refused(f"an engine path would be written outside the checkout: {f.path!r}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        os.chmod(target, 0o755 if f.mode == "100755" else 0o644)


def refusals(checkout: Path, main_pyproject: bytes, dwgread_version: str) -> list[str]:
    """Why this head may not run: the dwgread pin, the lock's sources, and `[tool.uv]` against main's."""
    found = []
    pin = (checkout / "toolchain" / "libredwg.version").read_text().strip()
    if dwgread_version.split() != ["dwgread", pin]:
        found.append(
            f"the installed dwgread is '{dwgread_version.strip()}', but the head pins LibreDWG {pin}"
        )
    found += lock_problems(checkout)
    head_uv = tomllib.loads((checkout / "pyproject.toml").read_text()).get("tool", {}).get("uv")
    if head_uv != tomllib.loads(main_pyproject.decode()).get("tool", {}).get("uv"):
        found.append("pyproject.toml: the head's [tool.uv] differs from main's")
    return found


def set_digest(folder: Path) -> str:
    """A Drawing Set's content: every regular file's path and sha256 (a link is never followed)."""
    lines = []
    for path in sorted(p for p in folder.rglob("*") if p.is_file() and not p.is_symlink()):
        digest = hashlib.sha256()
        with path.open("rb") as file:
            while chunk := file.read(1 << 20):
                digest.update(chunk)
        lines.append(f"{digest.hexdigest()} {path.relative_to(folder).as_posix()}\n")
    return hashlib.sha256("".join(lines).encode()).hexdigest()


def _commit(repo: Path, ref: str) -> str:
    return git(repo, "rev-parse", "--verify", f"{ref}^{{commit}}").decode().strip()
