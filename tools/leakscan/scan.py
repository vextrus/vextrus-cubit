"""What the leak scan reads (contract section 2) and the hits it finds, as `(where, count)` pairs.

A hit is a location and a count; the text is never kept beyond the test for it. GitHub is read through
`gh` (reads only).
"""

import json
import re
import subprocess
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from tools.leakscan.core import CannotScan, Corpus, git

_GH_FAILED = (OSError, subprocess.TimeoutExpired)
_HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


@dataclass
class Result:
    """The hits (`where`, count) in scan order and the number of lines, messages and names examined."""

    hits: list[tuple[str, int]] = field(default_factory=list)
    scanned: int = 0

    def test(self, corpus: Corpus, where: str, text: str) -> int:
        self.scanned += 1
        count = corpus.count(text)
        if count:
            self.hits.append((where, count))
        return count

    @property
    def total(self) -> int:
        return sum(count for _, count in self.hits)


def _unquote(path: str) -> str:
    """A path as git's diff header quotes it (C-style, in double quotes) or as written."""
    if not (path.startswith('"') and path.endswith('"')):
        return path
    raw = (
        path[1:-1]
        .encode("latin-1", "backslashreplace")
        .decode("unicode_escape")
        .encode("latin-1", "replace")
    )
    return raw.decode("utf-8", "replace")


def added_lines(diff: str) -> Iterator[tuple[str, int, str]]:
    """`(path, line number in the new file, text)` for every added line of a unified diff."""
    path = ""
    line = 0
    for row in diff.split("\n"):
        if row.startswith("diff --git "):
            path, line = "", 0
        elif row.startswith("+++ "):
            target = row[4:]
            path = "" if target == "/dev/null" else _unquote(target)
            if path.startswith("b/"):
                path = path[2:]
            elif path.startswith('"b/'):
                path = _unquote(path)[2:]
        elif row.startswith("@@"):
            match = _HUNK.match(row)
            line = int(match[1]) if match else 0
        elif row.startswith("+") and path:
            yield path, line, row[1:]
            line += 1
        elif row.startswith(" ") and path:
            line += 1


def scan_diff(corpus: Corpus, result: Result, diff: str, names: list[str]) -> None:
    """Added lines by `<path>:<line>`, or `name:<i>:<line>` where the path holds a corpus string."""
    named = {name: i for i, name in enumerate(names)}
    matched = {name for name in names if corpus.count(name)}
    for path, number, text in added_lines(diff):
        where = f"name:{named.get(path, 0)}:{number}" if path in matched else f"{path}:{number}"
        result.test(corpus, where, text)


def scan_message(corpus: Corpus, result: Result, sha: str, message: str) -> None:
    for number, text in enumerate(message.split("\n"), start=1):
        result.test(corpus, f"commit:{sha[:12]}:{number}", text)


def scan_names(corpus: Corpus, result: Result, names: list[str]) -> None:
    for i, name in enumerate(names):
        result.test(corpus, f"name:{i}", name)


def resolve(repo: Path, revision: str) -> str:
    if revision.startswith("-") or revision == "":
        raise CannotScan("bad-range")
    done = git(repo, "rev-parse", "--verify", "-q", "--end-of-options", f"{revision}^{{commit}}")
    if done.returncode != 0:
        raise CannotScan("bad-range")
    return done.stdout.strip()


def scan_range(corpus: Corpus, repo: Path, base: str, head: str, ref: str | None) -> Result:
    """A push range: its added lines, its commit messages, its changed file names and the ref name."""
    result = Result()
    diff = git(
        repo,
        "-c",
        "core.quotePath=false",
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--unified=0",
        f"{base}..{head}",
        "--",
    )
    names_run = git(
        repo, "-c", "core.quotePath=false", "diff", "--name-only", "-z", f"{base}..{head}", "--"
    )
    log = git(repo, "log", "--format=%H%x00%B%x00", f"{base}..{head}", "--")
    if diff.returncode != 0 or names_run.returncode != 0 or log.returncode != 0:
        raise CannotScan("bad-range")
    names = [name for name in names_run.stdout.split("\0") if name]
    scan_diff(corpus, result, diff.stdout, names)
    fields = log.stdout.split("\0")
    for i in range(0, len(fields) - 1, 2):
        sha = fields[i].strip()
        if sha:
            scan_message(corpus, result, sha, fields[i + 1].strip("\n"))
    scan_names(corpus, result, names)
    if ref is not None:
        result.test(corpus, "ref", ref)
    return result


def scan_lines(corpus: Corpus, data: bytes, label: str) -> Result:
    """A body file or standard input, by `<label>:<line>`; bytes that are not UTF-8 read as replaced."""
    result = Result()
    for number, text in enumerate(data.decode("utf-8", "replace").split("\n"), start=1):
        result.test(corpus, f"{label}:{number}", text)
    return result


def scan_dir(corpus: Corpus, folder: Path) -> Result:
    """Every file under a folder: by name (`name:<i>`) and by line (`dir:<relative path>:<line>`)."""
    if not folder.is_dir():
        raise CannotScan("source-unreadable")
    result = Result()
    files = sorted(path for path in folder.rglob("*") if path.is_file() and not path.is_symlink())
    for i, path in enumerate(files):
        relative = path.relative_to(folder).as_posix()
        named = result.test(corpus, f"name:{i}", relative) > 0
        try:
            data = path.read_bytes()
        except OSError:
            raise CannotScan("source-unreadable") from None
        for number, text in enumerate(data.decode("utf-8", "replace").split("\n"), start=1):
            result.test(corpus, f"name:{i}:{number}" if named else f"dir:{relative}:{number}", text)
    return result


# ---------------------------------------------------------------------------------------------- GitHub


def gh(*args: str) -> Any:
    """`gh <args>`'s JSON (or text, for `pr diff`); any failure is `gh-failed`, its words unprinted."""
    try:
        done = subprocess.run(["gh", *args], capture_output=True, check=False, timeout=300)
    except _GH_FAILED:
        raise CannotScan("gh-failed") from None
    if done.returncode != 0:
        raise CannotScan("gh-failed")
    text = done.stdout.decode("utf-8", "replace")
    if args[:2] == ("pr", "diff"):
        return text
    return _json_values(text)


def _json_values(text: str) -> Any:
    """One JSON value, or the pages `gh api --paginate` prints back to back (their lists joined)."""
    decoder = json.JSONDecoder()
    values: list[Any] = []
    position = 0
    try:
        while True:
            while position < len(text) and text[position].isspace():
                position += 1
            if position >= len(text):
                break
            value, position = decoder.raw_decode(text, position)
            values.append(value)
    except ValueError:
        raise CannotScan("gh-failed") from None
    if len(values) <= 1:
        return values[0] if values else None
    if all(isinstance(value, list) for value in values):
        return [item for value in values for item in value]
    raise CannotScan("gh-failed")


def _text(value: object) -> str:
    return value if isinstance(value, str) else ""


def _body(corpus: Corpus, result: Result, prefix: str, text: str) -> None:
    for number, line in enumerate(text.split("\n"), start=1):
        result.test(corpus, f"{prefix}:{number}", line)


def _comments(corpus: Corpus, result: Result, prefix: str, comments: Iterable[object]) -> None:
    for i, comment in enumerate(comments):
        if isinstance(comment, dict):
            ident = comment.get("id", comment.get("databaseId", i))
            _body(corpus, result, f"{prefix}:comment:{ident}", _text(comment.get("body")))


def scan_pr(corpus: Corpus, number: int) -> Result:
    """A PR as `merge_ready` re-scans it: added lines, commit messages, file names, branch, title, body,
    comments and reviews."""
    fields = "number,title,body,headRefName,comments,reviews,files,commits"
    view = gh("pr", "view", str(number), "--json", fields)
    if not isinstance(view, dict):
        raise CannotScan("gh-failed")
    diff = gh("pr", "diff", str(number))
    review_comments = gh("api", "--paginate", f"repos/{{owner}}/{{repo}}/pulls/{number}/comments")
    result = Result()
    prefix = f"pr:{number}"
    result.test(corpus, f"{prefix}:title", _text(view.get("title")))
    _body(corpus, result, f"{prefix}:body", _text(view.get("body")))
    _comments(corpus, result, prefix, view.get("comments") or [])
    _comments(corpus, result, prefix, view.get("reviews") or [])
    _comments(corpus, result, prefix, review_comments if isinstance(review_comments, list) else [])
    result.test(corpus, f"{prefix}:branch", _text(view.get("headRefName")))
    names = [_text(item.get("path")) for item in view.get("files") or [] if isinstance(item, dict)]
    scan_diff(corpus, result, diff if isinstance(diff, str) else "", names)
    for commit in view.get("commits") or []:
        if isinstance(commit, dict):
            headline, body = _text(commit.get("messageHeadline")), _text(commit.get("messageBody"))
            scan_message(
                corpus, result, _text(commit.get("oid")), f"{headline}\n\n{body}" if body else headline
            )
    scan_names(corpus, result, names)
    return result


def scan_bodies(corpus: Corpus, since: str) -> Result:
    """Every issue and PR (title, body, comments) updated since `since`."""
    result = Result()
    search = f"updated:>={since[:10]}"
    for kind in ("issue", "pr"):
        items = gh(
            kind,
            "list",
            "--state",
            "all",
            "--limit",
            "1000",
            "--search",
            search,
            "--json",
            "number,title,body,updatedAt,comments",
        )
        for item in items if isinstance(items, list) else []:
            if not isinstance(item, dict) or _text(item.get("updatedAt"))[: len(since)] < since:
                continue
            prefix = f"{kind}:{item.get('number')}"
            result.test(corpus, f"{prefix}:title", _text(item.get("title")))
            _body(corpus, result, f"{prefix}:body", _text(item.get("body")))
            _comments(corpus, result, prefix, item.get("comments") or [])
    return result
