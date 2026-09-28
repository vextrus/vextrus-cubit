"""A made-up owner's machine for the command's tests: a git repository with main and PR heads, a fake
toolchain, invented Development Sets, a drop folder, and fakes for the sandbox, the fetch and the
poster. Nothing here raises privilege or reads a real drawing."""

import json
import os
import subprocess
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from scripts.real_drawings.command import Machine
from scripts.real_drawings.sandbox import Job
from scripts.real_drawings.tests.exports import SHA_A, dwg, export, sheet

REPO = Path(__file__).resolve().parents[3]
PYPROJECT = '[project]\nname = "vextrus"\n\n[tool.uv]\npackage = false\nno-build = true\n'
REGISTRY = '{ registry = "https://pypi.org/simple" }'
LOCK = f'version = 1\n\n[[package]]\nname = "django"\nversion = "6.1.1"\nsource = {REGISTRY}\n'
SCHEMA = {"type": "object", "required": ["files"], "properties": {"files": {"type": "array"}}}
# What the fake harness writes for each set: the invented export the head's checkout carries.
FAKE_EXPORT = "engine/invented_export.json"


def run_git(
    repo: Path, *args: str, stdin: bytes | None = None, env: dict[str, str] | None = None
) -> str:
    done = subprocess.run(
        ["git", "-C", str(repo), *args],
        input=stdin,
        capture_output=True,
        check=True,
        env={**os.environ, **(env or {})},
    )
    return done.stdout.decode().strip()


@dataclass
class World:
    root: Path
    repo: Path
    origin: Path
    toolchain: Path
    sets: dict[str, Path]
    drop: Path
    cache: Path
    answers: list[str] = field(default_factory=list)
    said: list[str] = field(default_factory=list)
    posted: list[str] = field(default_factory=list)
    sandbox_runs: list[Job] = field(default_factory=list)
    plant: Callable[[Path], None] | None = None  # what the PR's code leaves in the sandbox's output
    during: Callable[[], None] | None = None  # what happens while the sandbox runs

    def commit(self, branch: str, files: dict[str, str | None], parent: str = "main") -> str:
        """A commit on `branch` (made from `parent`) without touching the working tree."""
        index = self.root / "index"
        env = {"GIT_INDEX_FILE": str(index)}
        base = run_git(self.repo, "rev-parse", "--verify", "--quiet", parent) if parent else ""
        if base:
            run_git(self.repo, "read-tree", base, env=env)
        for path, text in files.items():
            if text is None:
                run_git(self.repo, "update-index", "--force-remove", path, env=env)
                continue
            oid = run_git(self.repo, "hash-object", "-w", "--stdin", stdin=text.encode())
            run_git(self.repo, "update-index", "--add", "--cacheinfo", f"100644,{oid},{path}", env=env)
        tree = run_git(self.repo, "write-tree", env=env)
        index.unlink()
        commit = run_git(self.repo, "commit-tree", tree, *(["-p", base] if base else []), "-m", branch)
        run_git(self.repo, "update-ref", f"refs/heads/{branch}", commit)
        return commit

    def pr(self, number: int, files: dict[str, str | None]) -> str:
        commit = self.commit(f"pr-{number}", files)
        run_git(self.repo, "push", "--quiet", "origin", f"{commit}:refs/pull/{number}/head")
        return commit

    def repo_commit(self, ref: str) -> str:
        return run_git(self.repo, "rev-parse", ref)

    def checkout_ref(self, branch: str) -> None:
        """The owner's checkout on another branch (HEAD only; this repository has no working tree)."""
        run_git(self.repo, "symbolic-ref", "HEAD", f"refs/heads/{branch}")

    def machine(self) -> Machine:
        def fetch(checkout: Path, wheels: Path, python: Path, requirements: Path) -> None:
            requirements.write_text("")

        def fake_sandbox(job: Job, log: Path) -> None:
            self.sandbox_runs.append(job)
            log.write_text("")
            for name in job.sets:  # the fake harness: the checkout's invented export, per set
                (job.scratch / f"export-{name}.json").write_bytes(
                    (job.checkout / FAKE_EXPORT).read_bytes()
                )
            if self.plant:
                self.plant(job.scratch)
            if self.during:
                self.during()

        def post(run_id: str) -> int:
            self.posted.append(run_id)
            return 0

        return Machine(
            repo=self.repo,
            toolchain=self.toolchain,
            cache=self.cache,
            drop=self.drop,
            sets=self.sets,
            sandbox=fake_sandbox,
            fetch=fetch,
            post=post,
            ask=lambda prompt: self.answers.pop(0),
            say=self.said.append,
        )


def invented(title: str = "Invented floor plan", **values: Any) -> str:
    return json.dumps(export(dwg(SHA_A, sheet("s1", layout="Invented layout", title=title, **values))))


def make_world(root: Path) -> World:
    repo, origin = root / "repo", root / "origin.git"
    run_git(root, "init", "--quiet", "--bare", str(origin))
    run_git(root, "init", "--quiet", "-b", "main", str(repo))
    run_git(repo, "config", "user.email", "test@example.invalid")
    run_git(repo, "config", "user.name", "Test")
    run_git(repo, "remote", "add", "origin", str(origin))
    toolchain = root / "opt"
    dwgread = toolchain / "libredwg" / "bin" / "dwgread"
    dwgread.parent.mkdir(parents=True)
    dwgread.write_text("#!/bin/sh\necho 'dwgread 0.14'\n")
    dwgread.chmod(0o755)
    python = toolchain / "python" / "cpython-3.14.7-linux-x86_64-gnu" / "bin" / "python3"
    python.parent.mkdir(parents=True)
    python.touch()
    sets = {"invented-a": root / "sets" / "a", "invented-b": root / "sets" / "b"}
    for folder in sets.values():
        folder.mkdir(parents=True)
        (folder / "sheet-1.bin").write_bytes(b"invented bytes")
    drop = root / "drop"
    drop.mkdir()
    (drop / ".lock").touch()
    world = World(root, repo, origin, toolchain, sets, drop, root / "cache")
    world.commit(
        "main",
        {
            ".github/engine-paths.txt": (REPO / ".github" / "engine-paths.txt").read_text(),
            "engine/__init__.py": "",
            "engine/export.schema.json": json.dumps(SCHEMA),
            FAKE_EXPORT: invented(),
            "toolchain/libredwg.version": "0.14\n",
            "toolchain/python.version": "3.14.7\n",
            "pyproject.toml": PYPROJECT,
            "uv.lock": LOCK,
            "README.md": "not an engine path\n",
        },
        parent="",
    )
    run_git(repo, "symbolic-ref", "HEAD", "refs/heads/main")
    return world
