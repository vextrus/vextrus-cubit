"""`python -m tools.leakscan <command>`: the command line of the contract leakscan-cli.md.

Output is locations, counts and hashes only. Every failure prints a fixed line (never an exception's
words, a path given on the command line, or scanned text), and any unexpected error exits 2.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from collections.abc import Iterator, Sequence
from pathlib import Path
from typing import NoReturn

from tools.leakscan import core, scan, sources
from tools.leakscan.core import CannotScan, Corpus

USAGE = 64
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?Z?)?")
_HEX40 = re.compile(r"[0-9a-f]{40}")
_ORIGIN_MAIN = "refs/remotes/origin/main"
# `allow`'s locations (contract section 2): a commit message line, a range's file name, a ref name.
_AT_COMMIT = re.compile(r"commit:([0-9a-f]{7,40}):([0-9]+)")
_AT_NAME = re.compile(r"name:([0-9]+)")
_LINE = re.compile(r"[0-9]+")


class UsageError(Exception):
    pass


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> NoReturn:
        raise UsageError(message)


def _parser() -> argparse.ArgumentParser:
    common = _Parser(add_help=False, allow_abbrev=False)
    common.add_argument("--quiet", action="store_true")
    common.add_argument("--json", action="store_true")
    parser = _Parser(
        allow_abbrev=False,
        prog="python -m tools.leakscan",
        description="The leak scan: prints locations and counts, never text.",
    )
    commands = parser.add_subparsers(dest="command", required=True, parser_class=_Parser)
    build = commands.add_parser("build", parents=[common], allow_abbrev=False)
    build.add_argument("--source", action="append", type=Path, default=[])
    build.add_argument("--force", action="store_true")
    ranged = commands.add_parser("range", parents=[common], allow_abbrev=False)
    ranged.add_argument("span")
    ranged.add_argument("--ref")
    ranged.add_argument("--no-stamp", action="store_true")
    body = commands.add_parser("file", parents=[common], allow_abbrev=False)
    body.add_argument("path", type=Path)
    body.add_argument("--no-stamp", action="store_true")
    text = commands.add_parser("text", parents=[common], allow_abbrev=False)
    text.add_argument("--stdin", action="store_true", required=True)
    text.add_argument("--no-stamp", action="store_true")
    pr = commands.add_parser("pr", parents=[common], allow_abbrev=False)
    pr.add_argument("number", type=int)
    folder = commands.add_parser("dir", parents=[common], allow_abbrev=False)
    folder.add_argument("path", type=Path)
    bodies = commands.add_parser("bodies", parents=[common], allow_abbrev=False)
    bodies.add_argument("--since", required=True)
    allow = commands.add_parser("allow", parents=[common], allow_abbrev=False)
    allow.add_argument("--range")
    allow.add_argument("locations", nargs="+")
    verify = commands.add_parser("verify-stamp", parents=[common], allow_abbrev=False)
    verify.add_argument("name")
    return parser


def _report(
    result: scan.Result | None,
    corpus: Corpus | None,
    options: argparse.Namespace,
    status: str,
    reason: str | None,
) -> None:
    hits = result.hits if result is not None else []
    total = result.total if result is not None else 0
    scanned = result.scanned if result is not None else 0
    short = corpus.sha256[:12] if corpus is not None else ""
    if options.json:
        summary = {
            "hits": total,
            "scanned": scanned,
            "corpus": short,
            "status": status,
            "reason": reason,
        }
        print(json.dumps({"hits": [{"where": where, "n": n} for where, n in hits], "summary": summary}))
        return
    if not options.quiet:
        for where, n in hits:
            print(f"HIT {where} {n}")
    if status == "cannot-scan":
        print(f"leakscan: cannot-scan {reason}")
    elif status == "skipped":
        print("leakscan: skipped no-corpus (cloud)")
    else:
        print(f"leakscan: hits={total} scanned={scanned} corpus={short}")


def _corpus(options: argparse.Namespace) -> Corpus | None:
    """The corpus, or None in a cloud session that has none (the caller skips, writing no stamp)."""
    try:
        return Corpus.load()
    except CannotScan as missing:
        if missing.reason == "no-corpus" and core.in_cloud():
            return None
        raise


def _scan(options: argparse.Namespace) -> int:
    corpus = _corpus(options)
    if corpus is None:
        _report(None, None, options, "skipped", "no-corpus")
        return 0
    stamp: tuple[str, str] | None = None
    unstamped: str | None = None
    command = options.command
    if command == "range":
        repo = Path.cwd()
        base, head, scanned, stampable = _span(repo, options.span)
        result = scan.scan_range(corpus, repo, scanned, head, options.ref)
        if stampable:
            stamp = (head, f"{scanned}..{head}")
        elif result.total == 0 and not options.no_stamp:
            unstamped = _unstamped_line(repo, base, head)
    elif command in ("file", "text"):
        if command == "file":
            try:
                data = options.path.read_bytes()
            except OSError:
                raise CannotScan("source-unreadable") from None
        else:
            data = sys.stdin.buffer.read()
        result = scan.scan_lines(corpus, data, "file" if command == "file" else "stdin")
        name = hashlib.sha256(data).hexdigest()
        stamp = (name, f"sha256:{name}")
    elif command == "dir":
        result = scan.scan_dir(corpus, options.path)
    elif command == "pr":
        result = scan.scan_pr(corpus, options.number)
    else:
        if not _DATE.fullmatch(options.since):
            raise UsageError("--since takes YYYY-MM-DD or a UTC timestamp")
        result = scan.scan_bodies(corpus, options.since)
    if result.total == 0 and stamp is not None and not getattr(options, "no_stamp", False):
        core.write_stamp(stamp[0], corpus.sha256, stamp[1])
    _report(result, corpus, options, "hits" if result.total else "clean", None)
    if unstamped is not None:
        print(unstamped, file=sys.stderr)
    return 1 if result.total else 0


def _span(repo: Path, span: str) -> tuple[str, str, str, bool]:
    """`<base>..<head>` resolved: `(base, head, the base to scan from, whether a clean scan stamps)`.

    A base that is an ancestor of the head is scanned as given, and stamps when it is also an ancestor
    of origin/main (contract section 4, rule 3). A base that is not (the natural `origin/main..HEAD`
    once another PR has landed) gives way to its merge-base with the head when that is an ancestor of
    origin/main: `merge-base..head` holds every commit `base..head` does, never fewer."""
    if span.count("..") != 1 or "..." in span:
        raise UsageError("range takes <base>..<head>")
    base_rev, head_rev = span.split("..")
    base, head = scan.resolve(repo, base_rev), scan.resolve(repo, head_rev)
    if core.is_ancestor(repo, base, head):
        return base, head, base, core.is_ancestor(repo, base, _ORIGIN_MAIN)
    merge = _merge_base(repo, base, head)
    if merge is not None and core.is_ancestor(repo, merge, _ORIGIN_MAIN):
        return base, head, merge, True
    return base, head, base, False


def _merge_base(repo: Path, one: str, two: str) -> str | None:
    done = core.git(repo, "merge-base", one, two)
    merge = done.stdout.strip()
    return merge if done.returncode == 0 and _HEX40.fullmatch(merge) else None


def _unstamped_line(repo: Path, base: str, head: str) -> str:
    """Why a clean range wrote no stamp, and the range that would (shas only, never scanned text)."""
    line = (
        f"leakscan: clean, but no stamp written: {base[:12]} is not an ancestor of origin/main "
        "and of the head"
    )
    merge = _merge_base(repo, _ORIGIN_MAIN, head)
    return line if merge is None else f"{line}; scan {merge[:12]}..{head[:12]}"


def _build(options: argparse.Namespace) -> int:
    if options.source and not os.environ.get("VEXTRUS_LEAKSCAN_HOME"):
        # `--source` is a test seam: it never writes the real corpus (the guard refuses the seam).
        print("leakscan: build --source needs the test seam VEXTRUS_LEAKSCAN_HOME", file=sys.stderr)
        return USAGE
    counts: dict[str, sources.Tally] = {}
    pairs: Iterator[tuple[str, str]]
    if options.source:
        pairs = (("source", value) for value in sources.text_sources(options.source))
    else:
        pairs = sources.real_sources(counts)
    allowed = core.allowlist()
    kept_by: dict[str, set[str]] = {}
    for name, raw in pairs:
        value = core.normalise(raw)
        if core.keeps(value) and core.digest(value) not in allowed:
            kept_by.setdefault(name, set()).add(value)
    kept = set().union(*kept_by.values())
    unruled = [] if options.source else sources.unclassified_work_folders(sources.notes_folder())
    previous = core.corpus_strings()
    floor = max(previous // 2, 0 if os.environ.get("VEXTRUS_LEAKSCAN_HOME") else core.CORPUS_FLOOR)
    if len(kept) < floor and not options.force:
        # A rebuild losing half the corpus (or under the floor) would make scans clean: refused.
        print(
            f"leakscan: build refused: {len(kept)} strings, under the floor of {floor} "
            "(--force overrides)"
        )
        return 2
    count, sha256 = core.write_corpus(kept)
    if not options.quiet and not options.source:
        # Counts only, never a folder name: how much each source read, kept after the allowlist and
        # de-duplication, and how many files its skips removed; then the notes' undecided folder kinds.
        for name, tally in counts.items():
            print(
                f"source {name}: {tally.read} strings read, {len(kept_by.get(name, ()))} kept, "
                f"{tally.skipped} files skipped"
            )
        print(f"leakscan: work folders without a rule: {len(unruled)}")
    print(f"corpus: {count} strings, sha256 {sha256[:12]}")
    return 0


def _location(location: str, ranged: bool) -> tuple[str, str, int]:
    """One `allow` location as `(kind, text, number)`; a malformed one is a usage error."""
    if location.startswith("commit:"):
        match = _AT_COMMIT.fullmatch(location)
        if match is None or int(match[2]) < 1:
            raise UsageError("allow takes commit:<sha>:<line>")
        return "commit", match[1], int(match[2])
    if location.startswith("name:"):
        match = _AT_NAME.fullmatch(location)
        if match is None or not ranged:
            raise UsageError("allow takes --range <base>..<head> name:<i>")
        return "name", "", int(match[1])
    if location.startswith("ref:"):
        if location == "ref:":
            raise UsageError("allow takes ref:<name>")
        return "ref", location[len("ref:") :], 0
    file, _, number = location.rpartition(":")
    if not file or not _LINE.fullmatch(number) or int(number) < 1:
        raise UsageError("allow takes <file>:<line>")
    return "file", file, int(number)


def _allow(options: argparse.Namespace) -> int:
    """Hashes the corpus strings that hit at each location into the allowlist: `<file>:<line>`,
    `commit:<sha>:<line>`, `name:<i>` (of `--range`) or `ref:<name>`, each read as the scan reads it.
    No hit at all, a sha that names no commit, or a message line or name index past the end: refused,
    nothing appended."""
    places = [_location(location, options.range is not None) for location in options.locations]
    repo = Path.cwd()
    names: list[str] = []
    if any(kind == "name" for kind, _, _ in places):
        _, head, scanned, _ = _span(repo, options.range)
        names = scan.range_names(repo, scanned, head)
    corpus = Corpus.load()
    found: set[str] = set()
    files: dict[str, list[str]] = {}
    for kind, text, number in places:
        if kind == "file":
            if text not in files:
                try:
                    files[text] = Path(text).read_bytes().decode("utf-8", "replace").split("\n")
                except OSError:
                    raise CannotScan("source-unreadable") from None
            # A file line reads as an added line does: as written, not as a slug.
            found |= scan.line_found(corpus, files[text], number, slug=False)
        elif kind == "commit":
            done = core.git(
                repo, "rev-parse", "--verify", "-q", "--end-of-options", f"{text}^{{commit}}"
            )
            sha = done.stdout.strip()
            if done.returncode != 0 or not sha.startswith(text):
                print("leakscan: allow refused: a commit location names no commit", file=sys.stderr)
                return 1
            lines = scan.message_lines(repo, sha)
            if number > len(lines):
                print("leakscan: allow refused: a line past the message's end", file=sys.stderr)
                return 1
            found |= scan.line_found(corpus, lines, number, slug=True)
        elif kind == "name":
            if number >= len(names):
                print("leakscan: allow refused: a name index past the range's names", file=sys.stderr)
                return 1
            found |= scan.found_in(corpus, names[number], slug=True)
        else:
            found |= scan.found_in(corpus, text, slug=True)
    if not found:
        print("leakscan: allow refused: no hit on the given lines", file=sys.stderr)
        return 1
    added = core.add_to_allowlist(core.digest(value) for value in found)
    print(f"leakscan: allowed {len(found)} strings ({added} new hashes)")
    return 0


def _verify(options: argparse.Namespace) -> int:
    valid = core.stamp_valid(options.name, Path.cwd())
    print(f"leakscan: stamp {'valid' if valid else 'invalid'}")
    return 0 if valid else 1


def run(argv: Sequence[str]) -> int:
    try:
        options = _parser().parse_args(list(argv))
    except UsageError:
        print(
            "leakscan: usage: python -m tools.leakscan "
            "build|range|file|text --stdin|pr|dir|bodies|allow|verify-stamp ...",
            file=sys.stderr,
        )
        return USAGE
    try:
        if options.command == "build":
            return _build(options)
        if options.command == "allow":
            return _allow(options)
        if options.command == "verify-stamp":
            return _verify(options)
        return _scan(options)
    except UsageError:
        print("leakscan: usage error", file=sys.stderr)
        return USAGE
    except CannotScan as failure:
        _report(None, None, options, "cannot-scan", failure.reason)
        print(f"leakscan: cannot scan ({failure.reason})", file=sys.stderr)
        return 2


def main() -> int:
    """Runs the command line; an unexpected error prints a fixed line and exits 2 (no traceback)."""
    try:
        return run(sys.argv[1:])
    except SystemExit as leaving:
        return leaving.code if isinstance(leaving.code, int) else USAGE
    except BaseException:
        try:
            print("leakscan: cannot-scan source-unreadable")
            print("leakscan: internal error (no details are printed)", file=sys.stderr)
        except BaseException:
            pass
        return 2
