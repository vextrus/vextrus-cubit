"""Shared helpers for ticket f2's leak-scan acceptance tests (contract:
docs/specs/factory/contracts/leakscan-cli.md).

Every corpus string here is INVENTED (a name no drawing holds); every corpus, stamp, allowlist and
repository is made in the test's temporary folder. The seams (ticket f2 section 3; the contract's
section 8, "Test seams"):

- `VEXTRUS_LEAKSCAN_HOME`: the folder holding `corpus` (one file) and `ok/` (the stamps);
- `VEXTRUS_LEAKSCAN_ALLOWLIST`: the allowlist file (default `tools/leakscan/allowlist.txt`);
- `build --source <dir>`: text sources (`*.txt`, `*.md` lines, `*.json` strings) instead of the real
  ones;
- `CLAUDE_CODE_REMOTE`: set or deleted explicitly by every helper.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
GUARD = REPO / ".claude/hooks/guard.mjs"

ZEBRA = "Zebra Quarry Holdings Pvt 7731"
MARIGOLD = "Marigold Tannery Lane 42"
COPPERFIELD = "Copperfield Orchard Terrace"
SAFFRON = "Saffron Kiln Works Ltd"
INDIGO = "Indigo Ferry Mills 88"
QUILLMOOR = "Quillmoor-Estates"
LITERALS = [ZEBRA, MARIGOLD, COPPERFIELD, SAFFRON, INDIGO, QUILLMOOR]
# A distinctive word of each literal: none may appear in any output, in any case.
WORDS = ["ZEBRA", "MARIGOLD", "COPPERFIELD", "SAFFRON", "INDIGO", "QUILLMOOR"]
# Strings the corpus must not keep: under 8 characters, a pure number, a date, no run of 3 letters.
EXCLUDED = ["Ab 1", "12345678", "2026-10-05", "A1 B2 C3 D4"]

SUMMARY = re.compile(r"^leakscan: hits=(\d+) scanned=(\d+) corpus=([0-9a-f]{12})$")
HIT = re.compile(r"^HIT (\S+) (\d+)$")


def normalise(text: str) -> str:
    """The contract's normalisation: NFKC, whitespace runs collapsed, trimmed, upper-cased."""
    return " ".join(unicodedata.normalize("NFKC", text).split()).upper()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_sources(folder: Path) -> Path:
    """A synthetic source folder: a text file, a Markdown file and a nested JSON export.

    Six distinct strings are kept."""
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "notes.txt").write_text(
        "\n".join([ZEBRA, MARIGOLD, COPPERFIELD, QUILLMOOR, *EXCLUDED]) + "\n"
    )
    (folder / "walk.md").write_text("zebra   quarry HOLDINGS pvt\t7731\n" + SAFFRON + "\n")
    export = {"a": {"b": [INDIGO, 5, "short"]}, "c": "2026-10-05", "d": None}
    (folder / "export.json").write_text(json.dumps(export))
    return folder


def git_env(**extra: str) -> dict[str, str]:
    env = dict(os.environ)
    for name in (
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "CLAUDE_CODE_REMOTE",
        "VEXTRUS_MAIN_CHECKOUT",
    ):
        env.pop(name, None)
    env.update(
        GIT_CONFIG_GLOBAL="/dev/null",
        GIT_CONFIG_NOSYSTEM="1",
        GIT_AUTHOR_NAME="Acceptance",
        GIT_AUTHOR_EMAIL="acceptance@example.invalid",
        GIT_COMMITTER_NAME="Acceptance",
        GIT_COMMITTER_EMAIL="acceptance@example.invalid",
        GIT_AUTHOR_DATE="2026-10-05T00:00:00Z",
        GIT_COMMITTER_DATE="2026-10-05T00:00:00Z",
    )
    env.update(extra)
    return env


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", *args], cwd=repo, env=git_env(), capture_output=True, text=True, check=False
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"
    return done.stdout.strip()


def temp_repo(root: Path, branch: str = "main") -> tuple[Path, str]:
    """A repository with one clean commit; `origin/main` points at it.

    Returns the folder and the base sha."""
    repo = root / "repo"
    repo.mkdir(parents=True)
    git(repo, "init", "-q", "-b", branch)
    (repo / "docs").mkdir()
    (repo / "docs/a.md").write_text("a clean first line\n")
    git(repo, "add", "--", "docs/a.md")
    git(repo, "commit", "-q", "-m", "base: the first commit")
    base = git(repo, "rev-parse", "HEAD")
    git(repo, "update-ref", "refs/remotes/origin/main", base)
    return repo, base


def commit(repo: Path, files: dict[str, str], message: str, remove: tuple[str, ...] = ()) -> str:
    for path, text in files.items():
        (repo / path).parent.mkdir(parents=True, exist_ok=True)
        (repo / path).write_text(text)
    if files:
        git(repo, "add", "--", *files)
    if remove:
        git(repo, "rm", "-q", "--", *remove)
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


class Leak:
    """One leak-scan home, allowlist and source folder under a test's temporary folder."""

    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.home = tmp / "leakhome"
        self.allowlist = tmp / "allowlist.txt"
        self.allowlist.write_text("")
        self.sources = write_sources(tmp / "sources")

    def env(self, *, remote: bool = False, path_prefix: Path | None = None) -> dict[str, str]:
        env = git_env(
            VEXTRUS_LEAKSCAN_HOME=str(self.home),
            VEXTRUS_LEAKSCAN_ALLOWLIST=str(self.allowlist),
            PYTHONPATH=str(REPO),
        )
        if remote:
            env["CLAUDE_CODE_REMOTE"] = "true"
        if path_prefix is not None:
            env["PATH"] = f"{path_prefix}{os.pathsep}{env['PATH']}"
        return env

    def run(
        self,
        *args: str,
        cwd: Path | None = None,
        stdin: str | bytes | None = None,
        remote: bool = False,
        path_prefix: Path | None = None,
    ) -> subprocess.CompletedProcess[str]:
        data = stdin.decode("latin-1") if isinstance(stdin, bytes) else stdin
        return subprocess.run(
            [sys.executable, "-m", "tools.leakscan", *args],
            cwd=cwd or self.tmp,
            env=self.env(remote=remote, path_prefix=path_prefix),
            input=data,
            capture_output=True,
            text=True,
            check=False,
        )

    def build(self) -> subprocess.CompletedProcess[str]:
        done = self.run("build", "--source", str(self.sources))
        assert done.returncode == 0, done.stdout + done.stderr
        return done

    @property
    def corpus_hash(self) -> str:
        return sha256_file(self.home / "corpus")

    def stamps(self) -> list[Path]:
        folder = self.home / "ok"
        return sorted(folder.iterdir()) if folder.exists() else []


def assert_no_text(done: subprocess.CompletedProcess[str]) -> None:
    """Neither stream holds a corpus string, its normalised form or a distinctive word of it."""
    for stream in (done.stdout, done.stderr):
        upper = stream.upper()
        for word in WORDS:
            assert word not in upper, f"the output names a corpus word ({word[0]}...)"
        for literal in LITERALS:
            assert normalise(literal) not in normalise(stream)


def lines(done: subprocess.CompletedProcess[str]) -> list[str]:
    return [line for line in done.stdout.splitlines() if line.strip()]


def hits(done: subprocess.CompletedProcess[str]) -> list[tuple[str, int]]:
    """The `HIT <where> <n>` lines; every line but the last must be one."""
    found = []
    for line in lines(done)[:-1]:
        match = HIT.match(line)
        assert match, f"not a HIT line: {line!r}"
        found.append((match[1], int(match[2])))
    return found


def summary(done: subprocess.CompletedProcess[str]) -> re.Match[str]:
    last = lines(done)[-1] if lines(done) else ""
    match = SUMMARY.match(last)
    assert match, f"the last line is not the summary: {last!r}"
    return match
