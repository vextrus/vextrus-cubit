"""The docs' paths lint: every repository path the living docs name exists on the tree.

A doc that names a path gone from the tree sends an agent after a file that is not there (session 12:
`scripts/score/` in `docs/architecture.md` and the `real-drawings` skill, two milestones after the
scorer moved to `tools/scorer/`). The scan set is `CLAUDE.md`, `.claude/rules/*.md`,
`.claude/skills/**/*.md`, `docs/sdlc.md`, `docs/architecture.md` and `docs/agents/*.md`; the handoff
briefs and ADRs are history and are not checked.

The path rule. A repo path is an inline-code token (single backticks, outside fenced blocks) with no
whitespace and none of `< > { } $`, holding a `/`, whose first segment is a top-level entry of the
repository, once a trailing `:N` or `:N-M` and a trailing `/` are stripped. It must be a file in
`git ls-files --cached --others --exclude-standard` or a directory prefix of one, or (in a skill
file) exist under that skill's own folder. Exempt: the slug `vextrus/vextrus-cubit`; anything
starting `.private/`, `~`, `/` or `http`; a path `git check-ignore` matches; a bare file name. A
glob token (`*`), and every glob in a rules file's `paths:` frontmatter, must match a listed file.

The length rule: `CLAUDE.md` holds at most 90 lines (the laws and a map; detail lives in
`.claude/rules/`).

The lesson rule: in `docs/knowledge/lessons.md`, every top-level bullet under a `## Session NN`
heading with NN >= 8 ends in `Check:` and a backticked path that exists, or in `No check:` (or
`No check yet:`) and a reason. Older sections are legacy and not held to it.

    uv run python -m tools.lint.docs_paths [--root DIR]
"""

import argparse
import fnmatch
import re
import subprocess
import sys
from collections.abc import Iterator, Sequence
from pathlib import Path

CLAUDE_MD = "CLAUDE.md"
CLAUDE_MD_LINES = 90
LESSONS = "docs/knowledge/lessons.md"
FIRST_HELD_SESSION = 8
SLUG = "vextrus/vextrus-cubit"
EXEMPT_PREFIXES = (".private/", "~", "/", "http")

INLINE = re.compile(r"(?<!`)`([^`]+)`(?!`)")
FENCE = re.compile(r"^\s*(```|~~~)")
LINE_SUFFIX = re.compile(r":\d+(-\d+)?$")
SESSION = re.compile(r"^## Session (\d+)")
CHECK = re.compile(r"Check:\**\s*`([^`\n]+)`")
NO_CHECK = re.compile(r"No\s+check(\s+yet)?:")


def git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args], cwd=root, capture_output=True, text=True, check=False, timeout=120
    )


class Tree:
    """The files git lists under `root`, and the questions the rules ask of them."""

    def __init__(self, root: Path) -> None:
        self.root = root
        listed = git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
        self.files = sorted({name for name in listed.stdout.split("\0") if name})
        self.dirs = {"/".join(f.split("/")[:i]) for f in self.files for i in range(1, f.count("/") + 1)}
        self.top = {f.split("/")[0] for f in self.files}

    def exists(self, path: str) -> bool:
        return path in self.files or path in self.dirs

    def ignored(self, path: str) -> bool:
        return git(self.root, "check-ignore", "-q", "--no-index", path).returncode == 0

    def matches(self, glob: str) -> bool:
        pattern = glob.rstrip("/")
        return any(fnmatch.fnmatchcase(name, pattern) for name in self.files)

    def scan_set(self) -> list[str]:
        found = []
        for name in self.files:
            if not name.endswith(".md"):
                continue
            if (
                name == CLAUDE_MD
                or name in ("docs/sdlc.md", "docs/architecture.md")
                or (name.startswith(".claude/rules/") and name.count("/") == 2)
                or name.startswith(".claude/skills/")
                or (name.startswith("docs/agents/") and name.count("/") == 2)
            ):
                found.append(name)
        return found


def inline_tokens(text: str) -> Iterator[tuple[int, str]]:
    """Each inline-code token outside fenced blocks, with the 1-based line its span opens on.

    The docs are hard-wrapped, so a span can cross a line break: each paragraph (lines between blank
    lines and fences) is joined with spaces before its spans are paired, and each match is mapped back
    to the line it starts on."""
    paragraph: list[tuple[int, str]] = []

    def spans() -> Iterator[tuple[int, str]]:
        joined = ""
        starts: list[tuple[int, int]] = []  # (offset in joined, line number)
        for number, line in paragraph:
            starts.append((len(joined), number))
            joined += line + " "
        for match in INLINE.finditer(joined):
            opened = next(n for offset, n in reversed(starts) if offset <= match.start())
            yield opened, match.group(1)

    fenced = False
    for number, line in enumerate(text.splitlines(), start=1):
        if FENCE.match(line) or fenced or not line.strip():
            yield from spans()
            paragraph = []
            if FENCE.match(line):
                fenced = not fenced
            continue
        paragraph.append((number, line))
    yield from spans()


def candidate(token: str, tree: Tree) -> str | None:
    """The token as a repo path to check (as written, less a line suffix), or None when it is not one
    (or is exempt)."""
    token = token.strip()
    if not token or any(c.isspace() for c in token) or any(c in token for c in "<>{}$"):
        return None
    if token == SLUG or token.startswith(EXEMPT_PREFIXES):
        return None
    written = LINE_SUFFIX.sub("", token)
    path = written.rstrip("/")
    if "/" not in path or path.split("/")[0] not in tree.top:
        return None
    return written


def path_problem(written: str, doc: str, tree: Tree) -> str | None:
    path = written.rstrip("/")
    if "*" in path:
        return None if tree.matches(path) else f"glob `{written}` matches no file"
    if tree.exists(path) or tree.ignored(path) or tree.ignored(f"{path}/"):
        return None
    if doc.startswith(".claude/skills/"):
        folder = "/".join(doc.split("/")[:3])
        if tree.exists(f"{folder}/{path}"):
            return None
    return f"`{written}` does not exist"


def frontmatter_paths(text: str) -> list[tuple[int, str]]:
    """A rules file's `paths:` globs with their line numbers, as a YAML list or one comma line."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return []
    found: list[tuple[int, str]] = []
    in_paths = False
    for number, line in enumerate(lines[1:], start=2):
        if line.strip() == "---":
            break
        if line.startswith("paths:"):
            rest = line[len("paths:") :].strip().strip("[]")
            found += [(number, item.strip().strip("\"'")) for item in rest.split(",") if item.strip()]
            in_paths = not rest
        elif in_paths and line.strip().startswith("- "):
            found.append((number, line.strip()[2:].strip().strip("\"'")))
        else:
            in_paths = False
    return found


def lesson_problems(text: str, tree: Tree) -> Iterator[tuple[int, str]]:
    """Each top-level bullet under `## Session NN` (NN >= 8) without a check or a stated debt."""
    held = False
    bullet: list[tuple[int, str]] = []

    def judge() -> Iterator[tuple[int, str]]:
        if not bullet:
            return
        body = " ".join(line for _, line in bullet)
        start = bullet[0][0]
        if NO_CHECK.search(body):
            return
        check = CHECK.search(body)
        if check is None:
            yield start, "a lesson without `Check:` and a path, or `No check:` and a reason"
            return
        path = LINE_SUFFIX.sub("", check.group(1).strip()).rstrip("/")
        if not tree.exists(path):
            yield start, f"`{path}` (the lesson's check) does not exist"

    for number, line in enumerate(text.splitlines(), start=1):
        if line.startswith("#"):
            yield from judge()
            bullet = []
            if line.startswith("## "):
                session = SESSION.match(line)
                held = session is not None and int(session.group(1)) >= FIRST_HELD_SESSION
        elif line.startswith("- "):
            yield from judge()
            bullet = [(number, line)] if held else []
        elif bullet and (line.startswith((" ", "\t")) or not line.strip()):
            bullet.append((number, line))
        elif bullet:
            yield from judge()
            bullet = []
    yield from judge()


def problems(root: Path) -> list[str]:
    tree = Tree(root)
    found: list[str] = []
    for doc in tree.scan_set():
        path = root / doc
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for number, token in inline_tokens(text):
            checked = candidate(token, tree)
            problem = checked and path_problem(checked, doc, tree)
            if problem:
                found.append(f"{doc}:{number}: {problem}")
        if doc.startswith(".claude/rules/"):
            for number, glob in frontmatter_paths(text):
                if not tree.matches(glob):
                    found.append(f"{doc}:{number}: `paths:` glob `{glob}` matches no file")
        if doc == CLAUDE_MD:
            count = len(text.splitlines())
            if count > CLAUDE_MD_LINES:
                found.append(f"{doc}:{CLAUDE_MD_LINES + 1}: {count} lines; at most {CLAUDE_MD_LINES}")
    lessons = root / LESSONS
    if LESSONS in tree.files and lessons.is_file():
        for number, problem in lesson_problems(lessons.read_text(encoding="utf-8"), tree):
            found.append(f"{LESSONS}:{number}: {problem}")
    return found


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    default = Path(__file__).resolve().parents[2]
    parser.add_argument("--root", type=Path, default=default)
    found = problems(parser.parse_args(argv).root.resolve())
    for problem in found:
        print(problem)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
