"""A stub `gh` for ticket f2's `pr` and `bodies` tests: put first on PATH, it answers from invented
data.

The seam (the scanner reads GitHub "through `gh`, reads only", leakscan-cli.md 2). The stub answers
these read calls, which are the ways `gh` offers to read a PR, an issue and their comments:

- `gh pr view <n> --json <fields>` (title, body, comments, headRefName, files, commits; every field
  is returned whatever is asked) and `gh pr diff <n>` (a unified diff; `--name-only` lists the
  paths);
- `gh issue list ... --json ...`, `gh pr list ... --json ...`, `gh issue view <n> --json ...`;
- `gh api [--paginate] <path>` for `repos/<o>/<r>/pulls/<n>`, `.../pulls/<n>/files`,
  `.../pulls/<n>/commits`, `.../pulls/<n>/comments`, `.../pulls/<n>/reviews`,
  `.../issues/<n>/comments`, `.../issues?...`, `.../pulls?...`;
- `gh repo view --json nameWithOwner` and `gh auth status`.

Anything else exits 1 with "stub: unsupported" on stderr. With `GH_STUB_FAIL=1` every call fails.
"""

from pathlib import Path

STUB = r"""
import json, os, re, sys

ZEBRA = "Zebra Quarry Holdings Pvt 7731"
MARIGOLD = "Marigold Tannery Lane 42"
COPPERFIELD = "Copperfield Orchard Terrace"
SAFFRON = "Saffron Kiln Works Ltd"
INDIGO = "Indigo Ferry Mills 88"

PR = 12
OID = "abcdef0123456789abcdef0123456789abcdef01"
NAMED = f"docs/{SAFFRON}.md"
DIFF = (
    "diff --git a/src/plan.txt b/src/plan.txt\n"
    "new file mode 100644\n"
    "index 0000000..1111111\n"
    "--- /dev/null\n"
    "+++ b/src/plan.txt\n"
    "@@ -0,0 +1,3 @@\n"
    "+a clean line\n"
    f"+{ZEBRA}\n"
    "+another clean line\n"
    f"diff --git a/{NAMED} b/{NAMED}\n"
    "new file mode 100644\n"
    "index 0000000..e69de29\n"
)
PATCH = "@@ -0,0 +1,3 @@\n+a clean line\n+" + ZEBRA + "\n+another clean line"
VIEW = {
    "number": PR,
    "title": f"fix: {ZEBRA} in the title",
    "body": f"line one of the body\n{MARIGOLD}\n",
    "headRefName": "feature/quillmoor-estates-x",
    "comments": [
        {"id": "IC_1001", "body": f"looks fine\n\n{COPPERFIELD}", "author": {"login": "someone"}}
    ],
    "files": [
        {"path": "src/plan.txt", "additions": 3, "deletions": 0},
        {"path": NAMED, "additions": 0, "deletions": 0},
    ],
    "commits": [{"oid": OID, "messageHeadline": "feat: the plan", "messageBody": f"{INDIGO} noted"}],
    "state": "OPEN",
    "updatedAt": "2026-10-05T00:00:00Z",
}
REST_PR = {
    "number": PR,
    "title": VIEW["title"],
    "body": VIEW["body"],
    "head": {"ref": VIEW["headRefName"], "sha": OID},
    "state": "open",
    "updated_at": "2026-10-05T00:00:00Z",
}
REST_FILES = [
    {"filename": "src/plan.txt", "status": "added", "patch": PATCH},
    {"filename": NAMED, "status": "added"},
]
REST_COMMITS = [{"sha": OID, "commit": {"message": f"feat: the plan\n\n{INDIGO} noted"}}]
REST_COMMENTS = [{"id": 1001, "body": f"looks fine\n\n{COPPERFIELD}", "user": {"login": "someone"}}]
ISSUE = {
    "number": 7,
    "title": "an invented issue",
    "body": f"first line of the issue\n{ZEBRA}\n",
    "updatedAt": "2026-10-05T00:00:00Z",
    "updated_at": "2026-10-05T00:00:00Z",
    "comments": [],
    "state": "OPEN",
}


def out(value):
    sys.stdout.write(value if isinstance(value, str) else json.dumps(value))
    sys.exit(0)


def unsupported():
    sys.stderr.write("stub: unsupported " + " ".join(sys.argv[1:]) + "\n")
    sys.exit(1)


args = sys.argv[1:]
log = os.environ.get("GH_STUB_LOG")
if log:
    with open(log, "a") as handle:
        handle.write(json.dumps(args) + "\n")
if os.environ.get("GH_STUB_FAIL") == "1":
    sys.stderr.write("HTTP 502: stub failure\n")
    sys.exit(1)
words = [a for a in args if not a.startswith("-")]
if args[:2] == ["auth", "status"]:
    out("")
if args[:2] == ["repo", "view"]:
    out({"nameWithOwner": "vextrus/vextrus-cubit", "name": "vextrus-cubit"})
if args[:2] == ["pr", "view"]:
    out(VIEW) if str(PR) in args else unsupported()
if args[:2] == ["pr", "diff"]:
    if str(PR) not in args:
        unsupported()
    out("src/plan.txt\n" + NAMED + "\n" if "--name-only" in args else DIFF)
if args[:2] == ["issue", "list"]:
    out([ISSUE])
if args[:2] == ["pr", "list"]:
    out([])
if args[:2] == ["issue", "view"]:
    out(ISSUE) if "7" in args else unsupported()
if args[:1] == ["api"]:
    paths = [a for a in args[1:] if not a.startswith("-") and ("repos/" in a or a.startswith("/"))]
    if not paths:
        unsupported()
    path = paths[0].split("?")[0].rstrip("/")
    if re.search(r"/pulls/12$", path):
        out(REST_PR)
    if re.search(r"/pulls/12/files$", path):
        out(REST_FILES)
    if re.search(r"/pulls/12/commits$", path):
        out(REST_COMMITS)
    if re.search(r"/issues/12/comments$", path):
        out(REST_COMMENTS)
    if re.search(r"/pulls/12/(comments|reviews)$", path):
        out([])
    if re.search(r"/issues/7/comments$", path):
        out([])
    if re.search(r"/issues$", path):
        out([ISSUE])
    if re.search(r"/pulls$", path):
        out([])
unsupported()
"""


def install(folder: Path, python: str) -> None:
    """Writes the stub as `<folder>/gh`, run by `python`."""
    folder.mkdir(parents=True, exist_ok=True)
    gh = folder / "gh"
    gh.write_text(f"#!{python}\n" + STUB)
    gh.chmod(0o755)
