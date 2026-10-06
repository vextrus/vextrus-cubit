"""Shared helpers for ticket S14-P7's acceptance tests (not a test file).

Everything is made in the test's temporary folder; nothing real is read and nothing is sent anywhere:

- **A fake leak corpus**, built the way the scanner's own tests build theirs
  (`tools/leakscan/tests/acceptance/_leak.py`, copied here in the parts needed, never imported): a source
  folder of invented strings, `python -m tools.leakscan build --source <folder>` under the seams
  `VEXTRUS_LEAKSCAN_HOME` (the folder holding `corpus` and the stamps `ok/`) and
  `VEXTRUS_LEAKSCAN_ALLOWLIST` (the allowlist file), the contract's test seams (leakscan-cli.md 8). Every
  corpus string here is INVENTED: a name no drawing holds. Stamps are written only by the scanner.
- **A temporary origin**: a bare `origin.git`; `main`, its clone, is the main checkout every tool runs
  in (its current directory, and `VEXTRUS_MAIN_CHECKOUT`); `work`, another clone, is where a builder
  commits (a local builder's branch reaches the main checkout's `refs/heads/` by a fetch, as a worktree
  shares the refs; a cloud builder's is pushed to origin).
- **A fake `gh`** first on PATH: it keeps its open PRs in a state file, logs every call (its argv, and
  the bytes of any `--body-file` with their sha256, read at the time of the call) and answers `auth
  status`, `repo view`, `pr list`, `pr view`, `pr create`, `pr edit` and `api .../pulls`; anything else
  (and `--jq`/`--template`) exits 1 with "stub: unsupported".
- **A fake `claude`** first on PATH: it logs its argv and answers `-p` with `{"ok": true}` (the reply
  `launch say` reads, launch-cli.md 3); anything else exits 1.

Tools run as subprocesses with PYTHONPATH at this repository, so `python -m scripts.factory.<tool>` and
`python -m tools.leakscan` resolve to this tree. `VEXTRUS_LEAKSCAN_CMD` (the watcher's existing seam)
names the same scanner.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-06T10:00:00Z"
KB_PER_GB = 1024 * 1024

# Invented corpus strings, and a distinctive word of each that no output may hold in any case.
BRAMBLE = "Bramblewick Foundry Yard 19"
TAMARIND = "Tamarind Cooperage Row 7"
QUENTHAL = "Quenthal Saltworks Lane"
LITERALS = [BRAMBLE, TAMARIND, QUENTHAL]
WORDS = ["BRAMBLEWICK", "TAMARIND", "COOPERAGE", "QUENTHAL", "SALTWORKS"]

DROPPED = {
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_CODE_REMOTE",
    "CLAUDE_CONFIG_DIR",
    "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS",
    "CLAUDE_CODE_PLUGIN_DIRS",
    "VEXTRUS_ROLE",
    "TYPESAFE_API_KEY",
}
ATTRIBUTION = (
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
    "Claude-Session: https://claude.ai/code/session_01Example\n"
)
USAGE = (
    "Current session: 12% used · resets Oct 6, 12:59pm (Asia/Dhaka)\n"
    "Current week (all models): 27% used · resets Oct 9, 2:59pm (Asia/Dhaka)\n"
)
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def normalise(text: str) -> str:
    """The contract's normalisation: NFKC, whitespace runs collapsed, trimmed, upper-cased."""
    return " ".join(unicodedata.normalize("NFKC", text).split()).upper()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def show(done: subprocess.CompletedProcess[str]) -> str:
    """A run's code and streams, for a failed assertion: only ever called on a run already checked to
    carry no corpus word (see `assert_no_text`), or on the scanner's own location-only output."""
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def assert_no_text(*texts: str) -> None:
    """None of `texts` holds a corpus string, its normalised form or a distinctive word of it."""
    for text in texts:
        upper = text.upper()
        for word in WORDS:
            assert word not in upper, f"the output names a corpus word ({word[0]}...)"
        for literal in LITERALS:
            assert normalise(literal) not in normalise(text), "the output holds a corpus string"


def clean_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith("GIT_") and not k.startswith("VEXTRUS_") and k not in DROPPED
    }
    env.update(extra or {})
    return env


def stub(path: Path, body: str) -> Path:
    path.write_text(f"#!{sys.executable}\nimport hashlib, json, os, sys\n{body}")
    path.chmod(0o755)
    return path


class Git:
    """git cut off from the user's and the system's configuration, with pinned dates."""

    def __init__(self, tmp: Path) -> None:
        self.gitconfig = tmp / "gitconfig"
        self.gitconfig.write_text(
            "[user]\n\tname = t\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n"
            "[commit]\n\tgpgsign = false\n"
        )

    def env(self) -> dict[str, str]:
        return clean_env(
            {
                "GIT_CONFIG_GLOBAL": str(self.gitconfig),
                "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_ALLOW_PROTOCOL": "file",
                "GIT_AUTHOR_DATE": NOW,
                "GIT_COMMITTER_DATE": NOW,
            }
        )

    def __call__(self, cwd: Path, *args: str, check: bool = True) -> str:
        done = subprocess.run(
            ["git", *args],
            cwd=cwd,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            check=False,
        )
        if check:
            assert done.returncode == 0, f"git {args}: exit {done.returncode}"
        return done.stdout.strip()


class Leak:
    """One fake leak-scan home (corpus and stamps) and allowlist under a test's temporary folder."""

    def __init__(self, tmp: Path, git: Git) -> None:
        self.tmp = tmp
        self.git = git
        self.home = tmp / "leakhome"
        self.allowlist = tmp / "allowlist.txt"
        self.allowlist.write_text("")
        self.sources = tmp / "leak-sources"
        self.sources.mkdir()
        (self.sources / "notes.txt").write_text("\n".join(LITERALS) + "\n")

    def env(self) -> dict[str, str]:
        return {
            "VEXTRUS_LEAKSCAN_HOME": str(self.home),
            "VEXTRUS_LEAKSCAN_ALLOWLIST": str(self.allowlist),
            "VEXTRUS_LEAKSCAN_CMD": f"{sys.executable} -m tools.leakscan",
        }

    def run(self, cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
        env = self.git.env()
        env.update(self.env(), PYTHONPATH=str(REPO))
        return subprocess.run(
            [sys.executable, "-m", "tools.leakscan", *args],
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            check=False,
        )

    def build(self) -> None:
        done = self.run(self.tmp, "build", "--source", str(self.sources))
        assert done.returncode == 0, show(done)
        assert (self.home / "corpus").is_file()

    def stamp_valid(self, cwd: Path, name: str) -> bool:
        """The scanner's own verdict on the stamp `ok/<name>` (`verify-stamp`, leakscan-cli.md 4)."""
        done = self.run(cwd, "verify-stamp", name)
        return done.returncode == 0 and "stamp valid" in done.stdout


# --- the fake gh
GH = r"""
args = sys.argv[1:]
folder = os.environ["GH_STUB_DIR"]
state_path = os.path.join(folder, "prs.json")
log_path = os.path.join(folder, "gh.log")
try:
    with open(state_path) as handle:
        prs = json.load(handle)
except FileNotFoundError:
    prs = []


def value(*names):
    for i, a in enumerate(args):
        for name in names:
            if a == name and i + 1 < len(args):
                return args[i + 1]
            if a.startswith(name + "="):
                return a[len(name) + 1:]
    return None


body = None
body_sha256 = None
path = value("--body-file", "-F")
if path is not None and args[:2] in (["pr", "create"], ["pr", "edit"]):
    try:
        with open(path, "rb") as handle:
            data = handle.read()
        body = data.decode("utf-8", "replace")
        body_sha256 = hashlib.sha256(data).hexdigest()
    except OSError:
        body = None
with open(log_path, "a") as handle:
    handle.write(json.dumps({"argv": args, "body": body, "body_sha256": body_sha256}) + "\n")


def out(data):
    sys.stdout.write(data if isinstance(data, str) else json.dumps(data))
    sys.stdout.write("\n")
    sys.exit(0)


def unsupported():
    sys.stderr.write("stub: unsupported " + " ".join(args) + "\n")
    sys.exit(1)


def save():
    with open(state_path, "w") as handle:
        json.dump(prs, handle)


def shown(pr):
    return {
        "number": pr["number"],
        "url": pr["url"],
        "state": pr["state"],
        "headRefName": pr["headRefName"],
        "headRefOid": pr["headRefOid"],
        "baseRefName": "main",
        "title": pr["title"],
        "body": pr["body"],
        "isDraft": False,
    }


if "--jq" in args or "-q" in args or "--template" in args:
    unsupported()
if args[:2] == ["auth", "status"]:
    out("")
if args[:2] == ["repo", "view"]:
    out({"nameWithOwner": "vextrus/vextrus-cubit", "name": "vextrus-cubit"})
if args[:2] == ["pr", "list"]:
    head = value("--head", "-H")
    state = (value("--state", "-s") or "open").upper()
    found = [
        p
        for p in prs
        if (head is None or p["headRefName"] == head) and state in ("ALL", p["state"])
    ]
    out([shown(p) for p in found])
if args[:2] == ["pr", "view"]:
    flags_with_values = {"--json", "-R", "--repo"}
    picked = []
    skip = False
    for a in args[2:]:
        if skip:
            skip = False
            continue
        if a in flags_with_values:
            skip = True
            continue
        if not a.startswith("-"):
            picked.append(a)
    if not picked:
        unsupported()
    key = picked[0].rstrip("/").split("/")[-1]
    for p in prs:
        if str(p["number"]) == key or p["headRefName"] == picked[0]:
            out(shown(p))
    sys.stderr.write('no pull requests found for branch "' + picked[0] + '"\n')
    sys.exit(1)
if args[:2] == ["pr", "create"]:
    head = value("--head", "-H")
    if head is None or (body is None and value("--body", "-b") is None):
        sys.stderr.write("stub: pr create needs --head and a body\n")
        sys.exit(1)
    if any(p["headRefName"] == head and p["state"] == "OPEN" for p in prs):
        sys.stderr.write('a pull request for branch "' + head + '" already exists\n')
        sys.exit(1)
    number = 501 + len(prs)
    url = "https://github.com/vextrus/vextrus-cubit/pull/" + str(number)
    prs.append(
        {
            "number": number,
            "url": url,
            "state": "OPEN",
            "headRefName": head,
            "headRefOid": "",
            "title": value("--title", "-t") or "",
            "body": body or value("--body", "-b") or "",
        }
    )
    save()
    out(url)
if args[:2] == ["pr", "edit"]:
    out("")
if args[:1] == ["api"]:
    paths = [a for a in args[1:] if not a.startswith("-") and "repos/" in a]
    writing = ("-X", "--method", "-f", "-F", "--field", "--raw-field", "--input")
    if not paths or any(a in writing for a in args):
        unsupported()
    path, _, query = paths[0].partition("?")
    if path.rstrip("/").endswith("/pulls"):
        head = None
        for part in query.split("&"):
            if part.startswith("head="):
                head = part[len("head="):].split(":")[-1]
        found = [p for p in prs if p["state"] == "OPEN" and (head is None or p["headRefName"] == head)]
        out(
            [
                {
                    "number": p["number"],
                    "html_url": p["url"],
                    "state": "open",
                    "head": {"ref": p["headRefName"], "sha": p["headRefOid"]},
                    "title": p["title"],
                    "body": p["body"],
                }
                for p in found
            ]
        )
unsupported()
"""

GH_WRITES = {
    ("pr", "create"),
    ("pr", "edit"),
    ("pr", "comment"),
    ("pr", "close"),
    ("pr", "merge"),
    ("pr", "ready"),
    ("pr", "reopen"),
}

CLAUDE = r"""
args = sys.argv[1:]
with open(os.environ["CLAUDE_STUB_LOG"], "a") as handle:
    handle.write(json.dumps(args) + "\n")
if "-p" in args:
    sys.stdout.write(json.dumps({"ok": True, "session_id": "session_01P7Reply"}) + "\n")
    sys.exit(0)
sys.exit(1)
"""


class World:
    """A temporary origin, the main checkout, a builder's clone, a fake corpus, a fake gh and claude."""

    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.git = Git(tmp)
        self.leak = Leak(tmp, self.git)
        self.origin = tmp / "origin.git"
        self.main = tmp / "main"
        self.work = tmp / "work"
        self.factory = self.main / ".private" / "work" / "factory"
        seed = tmp / "seed"
        seed.mkdir()
        self.git(seed, "init", "-q", "-b", "main")
        (seed / "README").write_text("seed\n")
        (seed / "tools" / "leakscan").mkdir(parents=True)
        # One hash already allowed (64 hex), so a batch's diff is what it adds to an existing file.
        (seed / "tools" / "leakscan" / "allowlist.txt").write_text(sha256_text("ALREADY ALLOWED") + "\n")
        self.git(seed, "add", "README", "tools/leakscan/allowlist.txt")
        self.git(seed, "commit", "-q", "-m", "seed")
        self.git(tmp, "clone", "-q", "--bare", str(seed), str(self.origin))
        self.git(tmp, "clone", "-q", str(self.origin), str(self.main))
        self.git(tmp, "clone", "-q", str(self.origin), str(self.work))
        self.leak.allowlist.write_text((seed / "tools" / "leakscan" / "allowlist.txt").read_text())
        self.factory.mkdir(parents=True)

        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.gh_dir = tmp / "gh"
        self.gh_dir.mkdir()
        stub(self.stubs / "gh", GH)
        self.claude_log = tmp / "claude.log"
        stub(self.stubs / "claude", CLAUDE)

    # --- git
    def commit(self, branch: str, files: dict[str, str], message: str) -> str:
        """A commit on `branch` in the builder's clone (made from origin/main the first time)."""
        current = self.git(self.work, "rev-parse", "--abbrev-ref", "HEAD")
        if current != branch:
            exists = self.git(
                self.work, "rev-parse", "--verify", "-q", f"refs/heads/{branch}", check=False
            )
            if exists:
                self.git(self.work, "checkout", "-q", branch)
            else:
                self.git(self.work, "checkout", "-q", "-b", branch, "origin/main")
        for path, content in files.items():
            (self.work / path).parent.mkdir(parents=True, exist_ok=True)
            (self.work / path).write_text(content)
        self.git(self.work, "add", "--", *files)
        text = self.tmp / "message.txt"
        text.write_text(message)
        self.git(self.work, "commit", "-q", "-F", str(text))
        return self.git(self.work, "rev-parse", "HEAD")

    def to_main(self, branch: str) -> None:
        """The branch as a local builder's: `refs/heads/<branch>` of the main checkout, not on origin."""
        self.git(self.main, "fetch", "-q", str(self.work), f"+refs/heads/{branch}:refs/heads/{branch}")

    def to_origin(self, branch: str) -> None:
        """The branch pushed to origin (a cloud builder's), and fetched into the main checkout."""
        self.git(self.work, "push", "-q", "origin", f"+refs/heads/{branch}:refs/heads/{branch}")
        self.git(self.main, "fetch", "-q", "origin")

    def origin_refs(self) -> dict[str, str]:
        out = self.git(self.main, "ls-remote", str(self.origin))
        refs: dict[str, str] = {}
        for line in out.splitlines():
            sha, name = line.split("\t")
            refs[name] = sha
        return refs

    def tree(self, rev: str) -> str:
        return self.git(self.main, "rev-parse", f"{rev}^{{tree}}")

    # --- running the tools
    def env(self) -> dict[str, str]:
        env = self.git.env()
        env.update(self.leak.env())
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_MAIN_CHECKOUT=str(self.main),
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_NOW=NOW,
            GH_STUB_DIR=str(self.gh_dir),
            CLAUDE_STUB_LOG=str(self.claude_log),
        )
        return env

    def run(self, module: str, *args: str) -> subprocess.CompletedProcess[str]:
        # The command is the interface: a refusal by a module that does not exist is no refusal.
        assert importlib.util.find_spec(module) is not None, f"`python -m {module}` does not exist"
        return subprocess.run(
            [sys.executable, "-m", module, *args],
            cwd=self.main,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=600,
            check=False,
        )

    def publish(self, *args: str) -> subprocess.CompletedProcess[str]:
        return self.run("scripts.factory.publish", *args)

    # --- the fakes' logs
    def gh_calls(self) -> list[dict[str, Any]]:
        log = self.gh_dir / "gh.log"
        if not log.exists():
            return []
        return [json.loads(line) for line in log.read_text().splitlines() if line.strip()]

    def gh_writes(self) -> list[dict[str, Any]]:
        return [c for c in self.gh_calls() if tuple(c["argv"][:2]) in GH_WRITES]

    def prs_created(self) -> list[dict[str, Any]]:
        return [c for c in self.gh_calls() if c["argv"][:2] == ["pr", "create"]]

    def claude_calls(self) -> list[list[str]]:
        if not self.claude_log.exists():
            return []
        return [json.loads(line) for line in self.claude_log.read_text().splitlines() if line.strip()]


def flag(argv: list[str], *names: str) -> str | None:
    """The value of the first of `names` in `argv` (`--name v` or `--name=v`)."""
    for i, a in enumerate(argv):
        for name in names:
            if a == name and i + 1 < len(argv):
                return argv[i + 1]
            if a.startswith(f"{name}="):
                return a[len(name) + 1 :]
    return None


def ready_message(tree: str, subject: str = "S99-X1: the widget's publish path") -> str:
    """A READY commit message in the T-W317 shape (trailers.md 1): a subject, headed sections, the
    factory block, a blank line, the attribution block. Synthetic words only."""
    return (
        f"{subject}\n"
        "\n"
        "Closes #999. The widget now publishes in one step.\n"
        "\n"
        "## Verify\n"
        "- uv run python -m scripts.verify: pytest 0, ruff 0, mypy 0 (widget-body-marker-5e1).\n"
        "\n"
        "## Cut\n"
        "None.\n"
        "\n"
        f"Factory-State: READY\nFactory-Verify: {tree} ok\n"
        "\n"
        f"{ATTRIBUTION}"
    )


def commit_ready(world: World, branch: str, files: dict[str, str]) -> str:
    """A READY tip on `branch` whose Factory-Verify names its own tree: one commit to learn the tree,
    amended with the message that names it (the tree does not change)."""
    world.commit(branch, files, "wip: the widget\n")
    tree = world.git(world.work, "rev-parse", "HEAD^{tree}")
    text = world.tmp / "ready.txt"
    text.write_text(ready_message(tree))
    world.git(world.work, "commit", "-q", "--amend", "-F", str(text))
    return world.git(world.work, "rev-parse", "HEAD")


def hit_file(line: int, literal: str = BRAMBLE) -> str:
    """A three-line file whose line `line` carries a corpus string."""
    rows = ["a clean first line", "a clean second line", "a clean third line"]
    rows[line - 1] = f"the yard is {literal} today"
    return "\n".join(rows) + "\n"
