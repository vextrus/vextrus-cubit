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

The command rules scan the scan set plus `.claude/agents/*.md` (session 12: the runbook named
`scripts.land order`, which does not exist, and `gh` forms that fail on gh 2.45 or that the guard
refuses). The module rule, over every line (fences included): `python -m <module>` whose first dotted
segment is a top-level entry must be `<a/b>.py` or `<a/b>/__main__.py` on the tree; a bare word after
it must be one of the first `{a,b}` group of its `--help` usage, and is a problem when the usage has
none. A placeholder, quote, digit or flag after the module is not judged. The gh rule, per inline
span and per fenced line: `gh issue|pr view <arg>` without `--json`, any `--comments` and any `gh pr
edit` (gh 2.45 dies on Projects classic), and an inline `--body` or a heredoc body (the guard refuses
them; write the body to a file and pass `--body-file`).

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
HELP_TIMEOUT = 60
# Modules whose `--help` must not run because it would do work: none today (each module the docs
# name was probed on 5 Oct 2026; scripts.land, merge_ready, walk.run and verify exit 2 with a usage).
NO_PROBE: frozenset[str] = frozenset()

INLINE = re.compile(r"(?<!`)`([^`]+)`(?!`)")
FENCE = re.compile(r"^\s*(```|~~~)")
LINE_SUFFIX = re.compile(r":\d+(-\d+)?$")
SESSION = re.compile(r"^## Session (\d+)")
CHECK = re.compile(r"Check:\**\s*`([^`\n]+)`")
NO_CHECK = re.compile(r"No\s+check(\s+yet)?:")
MODULE = re.compile(r"\bpython3? -m (\S+)(?:[ \t]+(\S+))?")
MODULE_NAME = re.compile(r"[A-Za-z_]\w*(\.[A-Za-z_]\w*)*")
TRAILING = "`.,;:)"
SUBCOMMAND = re.compile(r"[a-z][a-z-]*")
CHOICES = re.compile(r"\{([\w,.-]+)\}")
GH = re.compile(r"(?:^|[\s;&|(])gh\s+(.*)$")
GH_VIEW = re.compile(r"(?:issue|pr)\s+view\b(.*)$")
GH_PR_EDIT = re.compile(r"pr\s+edit\b")
BLOCK_START = re.compile(r"^ {0,3}([-*+]\s|\d{1,9}[.)]\s|>)")
HEADING = re.compile(r"^ {0,3}#{1,6}(\s|$)")
INLINE_BODY = re.compile(r"--body(?![-\w])")


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

    def command_scan_set(self) -> list[str]:
        agents = [
            name
            for name in self.files
            if name.startswith(".claude/agents/") and name.count("/") == 2 and name.endswith(".md")
        ]
        return sorted({*self.scan_set(), *agents})


def blocks(text: str) -> Iterator[list[tuple[int, str]]]:
    """The CommonMark blocks outside fences that inline code pairs within, each a list of (1-based
    line, text): a run of non-blank lines, where a list item, a block quote or a fence starts a new
    block and an ATX heading is a block by itself. A span never crosses a block boundary, and a
    backtick left unpaired in a block is literal text."""
    block: list[tuple[int, str]] = []
    fenced = False
    for number, line in enumerate(text.splitlines(), start=1):
        fence = FENCE.match(line) is not None
        if fence or fenced or not line.strip() or BLOCK_START.match(line):
            if block:
                yield block
            block = []
            if fence:
                fenced = not fenced
            if fence or fenced or not line.strip():
                continue
        if HEADING.match(line):
            if block:
                yield block
            block = []
            yield [(number, line)]
            continue
        block.append((number, line))
    if block:
        yield block


def inline_tokens(text: str) -> Iterator[tuple[int, str]]:
    """Each inline-code token outside fenced blocks, with the 1-based line its span opens on.

    The docs are hard-wrapped, so a span can cross a line break: each block (`blocks`) is joined with
    spaces before its spans are paired, and each match is mapped back to the line it starts on."""
    for block in blocks(text):
        joined = ""
        starts: list[tuple[int, int]] = []  # (offset in joined, line number)
        for number, line in block:
            starts.append((len(joined), number))
            joined += line + " "
        for match in INLINE.finditer(joined):
            opened = next(n for offset, n in reversed(starts) if offset <= match.start())
            yield opened, match.group(1)


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


def code_units(text: str) -> Iterator[tuple[int, str]]:
    """Each inline-code span (as `inline_tokens` pairs them) and each fenced command, with the line it
    opens on; a fenced line ending in `\\` is joined with the next."""
    yield from inline_tokens(text)
    fenced = False
    held: tuple[int, str] | None = None
    for number, line in enumerate(text.splitlines(), start=1):
        if FENCE.match(line):
            if held:
                yield held
                held = None
            fenced = not fenced
        elif fenced and line.strip():
            start, joined = held if held else (number, "")
            joined = f"{joined} {line.strip()}".strip()
            if joined.endswith("\\"):
                held = (start, joined[:-1].rstrip())
            else:
                held = None
                yield start, joined
    if held:
        yield held


def prose_lines(text: str) -> Iterator[tuple[int, str]]:
    """Each line outside fences with its inline code blanked out, spans paired per block (`blocks`)."""
    for block in blocks(text):
        joined = " ".join(line for _, line in block)
        code = INLINE.sub(lambda m: " " * len(m.group(0)), joined)
        offset = 0
        for number, line in block:
            yield number, code[offset : offset + len(line)]
            offset += len(line) + 1


class Usage:
    """Each module's `--help` text, asked once per run with the root as cwd."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.seen: dict[str, str | None] = {}

    def of(self, module: str) -> str | None:
        """The help text when it holds `usage:` (its exit code is not judged), else None."""
        if module not in self.seen:
            try:
                done = subprocess.run(
                    [sys.executable, "-m", module, "--help"],
                    cwd=self.root,
                    capture_output=True,
                    text=True,
                    timeout=HELP_TIMEOUT,
                    check=False,
                )
                out = done.stdout + done.stderr
            except OSError, subprocess.TimeoutExpired:
                out = ""
            self.seen[module] = out if "usage:" in out else None
        return self.seen[module]


def choices(usage: str) -> list[str] | None:
    """The first `{a,b}` group of a usage that is not an option's value, or None."""
    for match in CHOICES.finditer(usage):
        before = usage[: match.start()].split()
        if before and before[-1].lstrip("[(").startswith("-"):
            continue
        return match.group(1).split(",")
    return None


def module_problem(module: str, word: str | None, tree: Tree, usage: Usage) -> str | None:
    path = module.replace(".", "/")
    if f"{path}.py" not in tree.files and f"{path}/__main__.py" not in tree.files:
        return f"`python -m {module}` does not exist"
    if word is None or not SUBCOMMAND.fullmatch(word) or module in NO_PROBE:
        return None
    text = usage.of(module)
    if text is None:
        return f"`python -m {module} --help` prints no usage"
    group = choices(text)
    if group is None:
        return f"`{module}` takes no subcommand, so `{word}` is wrong"
    if word not in group:
        return f"`{module} {word}`: `{word}` is not one of {', '.join(group)}"
    return None


def module_problems(text: str, tree: Tree, usage: Usage) -> Iterator[tuple[int, str]]:
    """Each `python -m <module> [word]` naming a module or subcommand the tree lacks, judged per code
    span or fenced command (a span wrapped across lines joined first) and per line of prose."""
    for number, line in [*code_units(text), *prose_lines(text)]:
        for match in MODULE.finditer(line):
            module = match.group(1).rstrip(TRAILING)
            if not MODULE_NAME.fullmatch(module) or module.split(".")[0] not in tree.top:
                continue
            # A module closing its span or sentence has no word after it.
            closed = module != match.group(1)
            word = None if closed or match.group(2) is None else match.group(2).rstrip(TRAILING)
            problem = module_problem(module, word, tree, usage)
            if problem:
                yield number, problem


def gh_problem(unit: str) -> str | None:
    """Why a `gh` code span or fenced line dies on gh 2.45 or is refused by the guard, or None."""
    found = GH.search(unit)
    if found is None:
        return None
    rest = found.group(1)
    reasons = []
    view = GH_VIEW.match(rest)
    argument = view.group(1).split()[:1] if view else []
    if argument and not argument[0].startswith("-") and "--json" not in rest:
        reasons.append("`gh … view` without `--json` dies on gh 2.45 (Projects classic)")
    if "--comments" in rest:
        reasons.append("`--comments` dies on gh 2.45; read `--json comments`")
    if GH_PR_EDIT.match(rest):
        reasons.append("`gh pr edit` dies on gh 2.45; set a body with `gh api -X PATCH`")
    if INLINE_BODY.search(rest):
        reasons.append("the guard refuses an inline or heredoc `--body`; use `--body-file`")
    return "; ".join(reasons) or None


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
    usage = Usage(root)
    for doc in tree.command_scan_set():
        path = root / doc
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        rows = list(module_problems(text, tree, usage))
        rows += [(number, p) for number, unit in code_units(text) if (p := gh_problem(unit))]
        found += [f"{doc}:{number}: {p}" for number, p in sorted(rows)]
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
