"""What the leak scan reads (contract section 2) and the hits it finds, as `(where, count)` pairs.

A hit is a location and a count; the text is never kept beyond the test for it. GitHub is read through
`gh` (reads only).
"""

import contextlib
import gzip
import io
import json
import re
import subprocess
import zipfile
import zlib
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from tools.leakscan import pdftext
from tools.leakscan.core import CannotScan, Corpus, git

_GH_FAILED = (OSError, subprocess.TimeoutExpired)
_HUNK = re.compile(r"^@@+ -\d+(?:,\d+)?(?: -\d+(?:,\d+)?)* \+(\d+)(?:,\d+)? @@")
# What a wrapped line may start with: indentation, comment and list markers, quotes.
_PREFIX = re.compile(r"""^\s*(?:(?:#+|//+|--+|/\*+|\*+|<!--|;+|%+|>+|[-+*•]|\d+[.)]|["'`])\s*)*""")
_ZERO = "0" * 40
_INFLATE_ERRORS = (OSError, EOFError, zlib.error)
_ZIP_ERRORS = (OSError, zipfile.BadZipFile, RuntimeError, ValueError, EOFError, zlib.error)
MAX_BLOB = 64 * 1024 * 1024
MAX_STREAMS = 20000
_STREAM = re.compile(rb"(?<!end)stream[ \t]*+(?:\r\n|\r|\n)")  # an `endstream` never opens one
_W = rb"[\x00\t\n\x0c\r ]"
_ENDSTREAM = re.compile(_W + rb"*endstream")
# `/Length n` (group 1), or an indirect `/Length n g R` (groups 1 and 2); never part of a longer number.
_LENGTH = re.compile(
    rb"/Length%s++(\d{1,12})(?!\d)" % _W
    + rb"(?:%s++(\d{1,5})%s++R(?![^\x00\t\n\x0c\r ()<>\[\]{}/%%]))?" % (_W, _W)
)
# An object that is a whole number: `n g obj <number> endobj` (an indirect `/Length`).
_NUMBER_OBJECT = re.compile(
    rb"(?<!\d)(\d{1,10})%s++(\d{1,5})%s++obj%s*+(\d{1,12})%s*+endobj" % ((_W,) * 4)
)
_ENCRYPT = re.compile(rb"/Encrypt%s*+(?:\d|<<)" % _W)
_DICTIONARY = 64 * 1024  # how far back a stream's dictionary is read for its `/Length`
_CHUNK = 64 * 1024


def joined(first: str, second: str) -> str:
    """Two adjacent lines as one, their comment and list markers dropped (a string wrapped over two)."""
    return f"{_PREFIX.sub('', first)} {_PREFIX.sub('', second)}"


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

    def block(self, corpus: Corpus, rows: list[tuple[str, int, str]]) -> None:
        """Lines of one file in order, `(where, line number, text)`. Each pair of adjacent lines is also
        tested joined, comment and list markers dropped, so a string wrapped over two lines is found; a
        string found only that way counts at the first line."""
        found = [corpus.found(text) for _, _, text in rows]
        extra: list[set[str]] = [set() for _ in rows]
        for i in range(len(rows) - 1):
            if rows[i + 1][1] == rows[i][1] + 1:
                extra[i] = corpus.found(joined(rows[i][2], rows[i + 1][2])) - found[i] - found[i + 1]
        for (where, _, _), own, more in zip(rows, found, extra, strict=True):
            self.scanned += 1
            count = len(own | more)
            if count:
                self.hits.append((where, count))

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
    """`(path, line number in the new file, text)` for every added line of a unified diff.

    File headers (`--- `, `+++ `) are read only between a `diff ` line and the file's first hunk, so an
    added line that itself starts `++ ` is content, never a path."""
    path = ""
    line = 0
    header = False
    for row in diff.split("\n"):
        if row.startswith(("diff --git ", "diff --cc ", "diff --combined ")):
            path, line, header = "", 0, True
        elif header:
            if row.startswith("+++ "):
                target = _unquote(row[4:])
                path = "" if target == "/dev/null" else target[2:] if target.startswith("b/") else target
            elif row.startswith("@@"):
                header = False
                match = _HUNK.match(row)
                line = int(match[1]) if match else 0
        elif row.startswith("@@"):
            match = _HUNK.match(row)
            line = int(match[1]) if match else 0
        elif row.startswith("+") and path:
            yield path, line, row[1:]
            line += 1
        elif row.startswith(" ") and path:
            line += 1


def scan_diff(corpus: Corpus, result: Result, diff: str, names: list[str]) -> None:
    """Added lines by `<path>:<line>`; `name:<i>:<line>` where the path holds a corpus string, and
    `unknown:<line>` for a path git's name list does not hold (a path is printed only from that list)."""
    named = {name: i for i, name in enumerate(names)}
    matched = {name for name in names if corpus.count(name)}
    rows: dict[str, list[tuple[str, int, str]]] = {}
    for path, number, text in added_lines(diff):
        if path not in named:
            where = f"unknown:{number}"
        elif path in matched:
            where = f"name:{named[path]}:{number}"
        else:
            where = f"{path}:{number}"
        rows.setdefault(path, []).append((where, number, text))
    for block in rows.values():
        result.block(corpus, block)


def blob_texts(data: bytes, depth: int = 0) -> list[str]:
    """The text a binary blob may hold: UTF-16 decoded, gzip and zip members opened, PDF streams
    inflated, and printable runs of 8 or more characters (ASCII and UTF-16LE), as `strings` does."""
    texts: list[str] = []
    if depth > 2:
        return texts
    if data.startswith(b"\x1f\x8b"):
        with contextlib.suppress(*_INFLATE_ERRORS):
            texts += blob_texts(gzip.decompress(data)[:MAX_BLOB], depth + 1)
    if data.startswith(b"PK\x03\x04"):
        with contextlib.suppress(*_ZIP_ERRORS), zipfile.ZipFile(io.BytesIO(data)) as archive:
            for member in archive.infolist()[:2000]:
                texts.append(member.filename)
                if member.file_size <= MAX_BLOB:
                    texts += blob_texts(archive.read(member), depth + 1)
    if data.startswith(b"%PDF"):
        texts += _pdf_texts(data, depth)
    if data[:2] in (b"\xff\xfe", b"\xfe\xff"):
        texts += data.decode("utf-16", "replace").split("\n")
    elif len(data) >= 4 and data[1::2].count(0) > len(data) // 4:
        texts += data.decode("utf-16-le", "replace").split("\n")
    if b"\0" not in data:
        texts += data.decode("utf-8", "replace").split("\n")
    texts += [run.decode("ascii") for run in re.findall(rb"[\x20-\x7e\t]{8,}", data)]
    texts += [run.decode("utf-16-le") for run in re.findall(rb"(?:[\x20-\x7e]\x00){8,}", data)]
    return texts


def _inflate(data: bytes, start: int, end: int, budget: list[int]) -> tuple[bytes, int] | None:
    """The stream `data[start:end]` inflated by zlib and where its zlib data ended, or None when it is
    not a zlib stream. Zlib data that runs past `end` (an `endstream` inside the compressed bytes) is
    read on into the bytes after it, as a reader taking `/Length` would. More than `MAX_BLOB` out, or
    more than `budget` (bytes out and bytes read on, for the whole PDF), refuses the scan: never a
    silent cut."""
    inflater = zlib.decompressobj()
    try:
        out = inflater.decompress(data[start:end], MAX_BLOB + 1)
    except zlib.error:
        return None
    position = end
    while not inflater.eof and not inflater.unconsumed_tail and position < len(data):
        chunk = data[position : position + _CHUNK]
        position += len(chunk)
        budget[0] -= len(chunk)
        try:
            out += inflater.decompress(chunk, MAX_BLOB + 1 - len(out))
        except zlib.error:
            break
        if budget[0] < 0:
            break
    budget[0] -= len(out)
    if len(out) > MAX_BLOB or budget[0] < 0:
        raise CannotScan("source-unreadable")
    stop = position - len(inflater.unused_data) if inflater.eof and position > end else end
    return out, stop


def _declared_end(
    data: bytes, floor: int, keyword: int, start: int, end: int, objects: dict[str, Any]
) -> int:
    """Where a raw stream ends: at `end` (its first `endstream`), or further when its dictionary's
    `/Length` (direct, or an indirect whole-number object) says so, an `endstream` follows there and
    no other stream opens between (an `endstream` inside the stream's own text, as a reader taking
    `/Length` reads it). `objects` caches the whole-number objects, read once per PDF."""
    window = max(floor, keyword - _DICTIONARY)  # never before the last stream's end: linear
    lengths = list(_LENGTH.finditer(data, max(window, data.rfind(b"obj", window, keyword)), keyword))
    if not lengths:
        return end
    length = lengths[-1]
    if length[2] is None:
        declared = start + int(length[1])
    else:
        if "numbers" not in objects:
            objects["numbers"] = {
                (int(found[1]), int(found[2])): int(found[3]) for found in _NUMBER_OBJECT.finditer(data)
            }
        value = objects["numbers"].get((int(length[1]), int(length[2])))
        declared = end if value is None else start + value
    if (
        end < declared < len(data)
        and _ENDSTREAM.match(data[declared : declared + 64])
        and _STREAM.search(data, end, declared) is None
    ):
        return declared
    return end


def _pdf_texts(data: bytes, depth: int) -> list[str]:
    """A PDF's streams, in order (an unterminated last one runs to the data's end): each inflated one's
    text (as any blob's), and every stream's shown text, assembled from its text operators (`pdftext`),
    inflated or raw. Each search starts after the last stream's true end (where its zlib data or its
    `/Length` ended), so the pass is linear. More than `MAX_STREAMS` streams, or an encrypted PDF (its
    streams unreadable), refuses the scan."""
    if _ENCRYPT.search(data):
        raise CannotScan("source-unreadable")
    texts: list[str] = []
    budget = [MAX_BLOB]
    objects: dict[str, Any] = {}
    position = 0
    count = 0
    while (opening := _STREAM.search(data, position)) is not None:
        count += 1
        if count > MAX_STREAMS:
            raise CannotScan("source-unreadable")
        start = opening.end()
        close = data.find(b"endstream", start)
        end = len(data) if close < 0 else close
        inflated = _inflate(data, start, end, budget)
        if inflated is None:
            stop = _declared_end(data, position, opening.start(), start, end, objects)
            texts += pdftext.assemble(data[start:stop])
        else:
            stop = inflated[1]
            texts += blob_texts(inflated[0], depth + 1)
            texts += pdftext.assemble(inflated[0])
        if stop > end:
            close = data.find(b"endstream", stop)
        if close < 0:
            break
        position = close + len(b"endstream")
    return texts


def scan_blob(corpus: Corpus, result: Result, where: str, data: bytes) -> None:
    """A binary blob's text, by `<where>:<n>` (n counts the texts found in it)."""
    texts = blob_texts(data)
    result.block(corpus, [(f"{where}:{n}", 0, text) for n, text in enumerate(texts, start=1)])


def scan_message(corpus: Corpus, result: Result, sha: str, message: str) -> None:
    rows = [(f"commit:{sha[:12]}:{n}", n, text) for n, text in enumerate(message.split("\n"), start=1)]
    result.block(corpus, rows)


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


def _run(repo: Path, *args: str) -> str:
    done = git(repo, "-c", "core.quotePath=false", *args)
    if done.returncode != 0:
        raise CannotScan("bad-range")
    return done.stdout


def _blob(repo: Path, sha: str) -> bytes:
    done = subprocess.run(["git", "cat-file", "blob", sha], cwd=repo, capture_output=True, check=False)
    if done.returncode != 0:
        raise CannotScan("bad-range")
    return done.stdout


def scan_commit(corpus: Corpus, result: Result, repo: Path, sha: str, names: list[str]) -> None:
    """One commit's own changes (against its parent; a merge, what it did beyond the automatic merge):
    its added lines, read as text whatever `.gitattributes` says, and every binary blob it adds. New file
    names are appended to `names`."""
    parents = _run(repo, "rev-list", "--parents", "-n", "1", sha).split()[1:]
    common = ["--no-color", "--no-ext-diff", "--no-textconv", "--text", "--unified=0", "--no-renames"]
    if len(parents) > 1:
        patch = _run(repo, "show", "--remerge-diff", "--format=", *common, sha, "--")
        raw = _run(repo, "diff-tree", "-r", "-z", "--no-renames", "-m", "--first-parent", sha, "--")
    else:
        patch = _run(repo, "diff-tree", "-p", "-r", "--root", *common, sha, "--")
        raw = _run(repo, "diff-tree", "-r", "-z", "--root", "--no-renames", sha, "--")
    fields = raw.split("\0")
    changed: list[tuple[str, str, str]] = []
    i = 0
    while i < len(fields):
        meta = fields[i]
        if meta.startswith(":") and i + 1 < len(fields):
            parts = meta[1:].split()
            changed.append((parts[1], parts[3], fields[i + 1]))
            i += 2
        else:
            i += 1
    for _, _, path in changed:
        if path not in names:
            names.append(path)
    scan_diff(corpus, result, patch, names)
    for mode, blob, path in changed:
        if blob == _ZERO or mode.startswith("160") or mode == "000000":
            continue
        data = _blob(repo, blob)
        if b"\0" in data[:8000] or data.startswith((b"\x1f\x8b", b"PK\x03\x04", b"%PDF")):
            index = names.index(path)
            where = f"name:{index}" if corpus.count(path) else path
            scan_blob(corpus, result, where, data)


def scan_range(corpus: Corpus, repo: Path, base: str, head: str, ref: str | None) -> Result:
    """A push range, commit by commit (what the push publishes, not only the net diff): each commit's
    added lines and binary blobs, its message, every file name it touches, and the ref name."""
    result = Result()
    commits = _run(repo, "rev-list", "--reverse", "--topo-order", f"{base}..{head}", "--").split()
    names: list[str] = []
    for sha in commits:
        scan_commit(corpus, result, repo, sha, names)
        scan_message(corpus, result, sha, _run(repo, "log", "-1", "--format=%B", sha, "--").strip("\n"))
    scan_names(corpus, result, names)
    if ref is not None:
        result.test(corpus, "ref", ref)
    return result


def scan_lines(corpus: Corpus, data: bytes, label: str) -> Result:
    """A body file or standard input, by `<label>:<line>`; bytes that are not UTF-8 read as replaced."""
    result = Result()
    text = data.decode("utf-8", "replace").split("\n")
    result.block(corpus, [(f"{label}:{n}", n, line) for n, line in enumerate(text, start=1)])
    if b"\0" in data or data.startswith(b"%PDF"):
        scan_blob(corpus, result, f"{label}:bin", data)
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
        prefix = f"name:{i}" if named else f"dir:{relative}"
        lines = data.decode("utf-8", "replace").split("\n")
        result.block(corpus, [(f"{prefix}:{n}", n, line) for n, line in enumerate(lines, start=1)])
        if b"\0" in data[:8000] or data.startswith((b"\x1f\x8b", b"PK\x03\x04", b"%PDF")):
            scan_blob(corpus, result, f"{prefix}:bin", data)
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
    lines = text.split("\n")
    result.block(corpus, [(f"{prefix}:{n}", n, line) for n, line in enumerate(lines, start=1)])


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
    _scan_pr_commits(corpus, result, number, view.get("commits") or [], names)
    scan_names(corpus, result, names)
    return result


def _scan_pr_commits(
    corpus: Corpus, result: Result, number: int, commits: list[Any], names: list[str]
) -> None:
    """Each of the PR's commits, scanned locally commit by commit (`gh pr diff` is only the net diff).
    Run from a clone (the main checkout); a commit it lacks is fetched from the PR's head ref, and one
    still missing refuses the scan. Outside a clone only the net diff is read."""
    repo = Path.cwd()
    if git(repo, "rev-parse", "--git-dir").returncode != 0:
        return
    oids = [_text(commit.get("oid")) for commit in commits if isinstance(commit, dict)]

    def missing() -> list[str]:
        return [oid for oid in oids if git(repo, "cat-file", "-e", f"{oid}^{{commit}}").returncode != 0]

    if missing():
        try:
            subprocess.run(
                ["git", "fetch", "-q", "--no-tags", "origin", f"refs/pull/{number}/head"],
                cwd=repo,
                capture_output=True,
                check=False,
                timeout=300,
            )
        except _GH_FAILED:
            raise CannotScan("gh-failed") from None
        if missing():
            raise CannotScan("gh-failed")
    for oid in oids:
        scan_commit(corpus, result, repo, oid, names)


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
