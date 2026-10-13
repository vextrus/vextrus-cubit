"""The world S25-F1's acceptance tests run `review_self` in: no network, no real `claude` or ledger.

`World(tmp_path)` builds:

- a bare `origin` and its clone `main` (the main checkout, on branch `main`), whose ledger folder
  `main/.private/work/factory/ledger` (as `scripts.ledger.default_ledger_dir()` finds it) already holds
  one record and a journal line, so a write, a change or a removal shows;
- a builder's worktree `main/.claude/worktrees/b1` on branch `b1`, cut from main, with one commit that
  adds `vextrus/rates/branch_change.py` (its text carries BRANCH_MARK); after the cut, main and
  origin/main gain a commit adding `vextrus/rates/main_only.py` (MAIN_MARK), which `main...HEAD` leaves
  out and the two-dot `git diff main HEAD` would show as removed;
- a fake `claude` first on PATH: each call is logged (argv, cwd, the HEAD of its cwd, stdin, its
  `VEXTRUS_DB_NAME`, and the text of every file its stdin names, read at the call, since a brief may
  name a temporary file) and answers one `--output-format json` result object whose `structured_output`
  is the reply scripted for its `--model` (the A0 probe's shape); a reply scripted `garbage` prints text
  that is not JSON;
- a fake `gh` and a fake `sudo` first on PATH that log every call and fail: posting anything (a comment,
  a status, the poster through sudo) shows in their logs.

`review_self` is run as `python -m scripts.factory.review_self` with this repository on PYTHONPATH and
the builder's worktree as its cwd (the same as `uv run python -m scripts.factory.review_self` there).
"""

from __future__ import annotations

import hashlib
import json
import os
import stat
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
OPUS = "claude-opus-5-5"
SONNET = "claude-sonnet-5-5"
BRANCH_MARK = "BRANCH_SIDE_MARK_7Q2"
MAIN_MARK = "MAIN_ONLY_MARK_4K9"
HANG = 300  # seconds: protection against a hung run only; no test asserts on time

CLAUDE = r"""#!@PYTHON@
import json, os, re, subprocess, sys
from pathlib import Path

LOG = Path(@LOG@)
REPLIES = Path(@REPLIES@)

argv = sys.argv[1:]
prompt = sys.stdin.read()
cwd = Path.cwd()


def option(name):
    for index, part in enumerate(argv):
        if part == name and index + 1 < len(argv):
            return argv[index + 1]
    return None


def named_files(text):
    seen = {}
    for token in re.findall(r"[A-Za-z0-9_./@+-]+", text):
        token = token.rstrip(".,;:")
        if not token or "/" not in token and "." not in token:
            continue
        for candidate in (Path(token), cwd / token):
            try:
                if candidate.is_file() and candidate.stat().st_size < 4_000_000:
                    seen[str(candidate)] = candidate.read_text(errors="replace")
            except OSError:
                pass
    return seen


head = subprocess.run(
    ["git", "-C", str(cwd), "rev-parse", "HEAD"], capture_output=True, text=True
).stdout.strip()
model = option("--model")
entry = {
    "argv": argv,
    "agent": option("--agent"),
    "model": model,
    "cwd": str(cwd),
    "head": head,
    "stdin": prompt,
    "db": os.environ.get("VEXTRUS_DB_NAME"),
    "files": named_files(prompt),
}
with LOG.open("a") as log:
    log.write(json.dumps(entry) + "\n")
reply = json.loads(REPLIES.read_text()).get(model or "", {"verdict": "PASS", "findings": []})
if reply == "garbage":
    print("this is not a JSON result")
    sys.exit(0)
out = {
    "verdict": reply["verdict"],
    "head": head,
    "findings": reply["findings"],
    "report": "scripted reply",
}
print(
    json.dumps(
        {
            "type": "result",
            "subtype": "success",
            "is_error": False,
            "result": "done",
            "structured_output": out,
            "total_cost_usd": 0.01,
            "duration_ms": 10,
            "num_turns": 1,
            "usage": {"input_tokens": 1, "output_tokens": 1},
        }
    )
)
"""

LOGGER = r"""#!@PYTHON@
import json, sys
from pathlib import Path

with Path(@LOG@).open("a") as log:
    log.write(json.dumps(sys.argv) + "\n")
sys.stderr.write("refused by the test world\n")
sys.exit(1)
"""


def finding(score: int, summary: str, file: str = "vextrus/rates/branch_change.py") -> dict[str, Any]:
    return {"score": score, "file": file, "line": 1, "summary": summary, "repro": None}


def git(where: Path, *parts: str) -> str:
    done = subprocess.run(
        ["git", "-c", "core.hooksPath=/dev/null", "-C", str(where), *parts],
        capture_output=True,
        text=True,
        check=True,
    )
    return done.stdout.strip()


def commit(where: Path, files: dict[str, str], message: str) -> str:
    for name, text in files.items():
        path = where / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        git(where, "add", "--", name)
    git(where, "commit", "-q", "-m", message)
    return git(where, "rev-parse", "HEAD")


def script(path: Path, text: str) -> None:
    path.write_text(text)
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


@dataclass
class Ran:
    code: int
    stdout: str
    stderr: str

    @property
    def text(self) -> str:
        return self.stdout + self.stderr


class World:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.origin = tmp / "origin.git"
        self.main = tmp / "main"
        self.bin = tmp / "bin"
        self.claude_log = tmp / "claude.jsonl"
        self.gh_log = tmp / "gh.jsonl"
        self.sudo_log = tmp / "sudo.jsonl"
        self.replies = tmp / "replies.json"
        self.ledger = self.main / ".private" / "work" / "factory" / "ledger"
        self.worktree = self.main / ".claude" / "worktrees" / "b1"

        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(self.origin)], check=True)
        subprocess.run(["git", "clone", "-q", str(self.origin), str(self.main)], check=True)
        for key, value in (("user.name", "Test"), ("user.email", "test@example.invalid")):
            git(self.main, "config", key, value)
        git(self.main, "checkout", "-q", "-B", "main")
        commit(
            self.main,
            {
                ".gitignore": "/.private/\n/.claude/worktrees/\n",
                "README.md": "base\n",
                "vextrus/rates/table.py": "RATES: dict[str, int] = {}\n",
            },
            "base",
        )
        git(self.main, "push", "-q", "-u", "origin", "main")

        git(self.main, "worktree", "add", "-q", "-b", "b1", str(self.worktree), "main")
        self.head = commit(
            self.worktree,
            {
                "vextrus/rates/branch_change.py": (
                    f'MARK = "{BRANCH_MARK}"\n\n\ndef rate(name: str) -> int:\n    return len(name)\n'
                )
            },
            "the builder's change",
        )
        commit(
            self.main,
            {"vextrus/rates/main_only.py": f'MARK = "{MAIN_MARK}"\n'},
            "main moves on after the cut",
        )
        git(self.main, "push", "-q", "origin", "main")
        git(self.worktree, "fetch", "-q", "origin")

        self.ledger.mkdir(parents=True)
        (self.ledger / f"41-{'a' * 40}.json").write_text('{"pr": 41, "verdict": "PASS"}\n')
        (self.ledger / "journal.jsonl").write_text('{"pr": 41}\n')

        self.bin.mkdir()
        python = sys.executable
        script(
            self.bin / "claude",
            CLAUDE.replace("@PYTHON@", python)
            .replace("@LOG@", repr(str(self.claude_log)))
            .replace("@REPLIES@", repr(str(self.replies))),
        )
        for name, log in (("gh", self.gh_log), ("sudo", self.sudo_log)):
            script(self.bin / name, LOGGER.replace("@PYTHON@", python).replace("@LOG@", repr(str(log))))
        self.reply(
            {OPUS: {"verdict": "PASS", "findings": []}, SONNET: {"verdict": "PASS", "findings": []}}
        )

    def reply(self, replies: dict[str, Any]) -> None:
        self.replies.write_text(json.dumps(replies))

    def run(self, *args: str, cwd: Path | None = None) -> Ran:
        env = {
            key: value
            for key, value in os.environ.items()
            if key not in ("CLAUDE_PROJECT_DIR", "VEXTRUS_DB_NAME", "GIT_DIR", "GIT_WORK_TREE")
        }
        env["PATH"] = f"{self.bin}{os.pathsep}{env.get('PATH', '')}"
        env["PYTHONPATH"] = str(REPO)
        env["VEXTRUS_REVIEW_LENS_TIMEOUT"] = str(HANG)
        done = subprocess.run(
            [sys.executable, "-m", "scripts.factory.review_self", *args],
            cwd=cwd or self.worktree,
            env=env,
            capture_output=True,
            text=True,
            timeout=HANG,
            check=False,
        )
        return Ran(done.returncode, done.stdout, done.stderr)

    def calls(self) -> list[dict[str, Any]]:
        if not self.claude_log.exists():
            return []
        return [json.loads(line) for line in self.claude_log.read_text().splitlines() if line]

    def posted(self) -> list[str]:
        """Every call of the fake `gh` and `sudo`: the poster and every comment go through one."""
        found: list[str] = []
        for log in (self.gh_log, self.sudo_log):
            if log.exists():
                found += log.read_text().splitlines()
        return found

    def ledger_files(self) -> dict[str, str]:
        """Every file under the ledger folder, by name, with the sha-256 of its bytes."""
        return {
            str(path.relative_to(self.ledger)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(self.ledger.rglob("*"))
            if path.is_file()
        }
