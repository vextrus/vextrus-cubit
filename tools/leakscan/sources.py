"""Where the corpus comes from (contract section 1). Read only; nothing here prints a string it reads.

- `text_sources(folders)`: the test seam `build --source <dir>`: `*.txt` and `*.md` lines and every
  string in a `*.json` file (nested), under each folder.
- `real_sources()`: the local sources: every TEXT, MTEXT, ATTRIB and ATTDEF of each DWG under
  `.private/reference/` read through the engine's own reader, the Plot PDFs' text through the engine's
  PDF reader, `~/.cache/vextrus-real-drawings/exports/`, `.private/work/walks/*/` and the
  `.private/work/**/*.md` notes. The engine is imported only here, only when building locally.
- `WORK_RULES`: what each folder kind of the notes folder is, read or skipped (agents' scratch, copies
  of the repository and test output hold no drawing text); `unclassified_work_folders` names the kinds
  no rule covers (read all the same, and counted by `build`).
"""

import json
import os
import re
import subprocess
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any

from tools.leakscan.core import CannotScan, home, main_checkout, normalise

TEXT_SUFFIXES = {".txt", ".md"}
_CELL_SPLIT = "|"


def _strings(value: Any) -> Iterator[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def _file_text(path: Path) -> str:
    try:
        return path.read_bytes().decode("utf-8", "replace")
    except OSError:
        raise CannotScan("source-unreadable") from None


def _file_strings(path: Path) -> Iterator[str]:
    """A text file's lines (and a Markdown table row's cells), or a JSON file's strings."""
    return _text_strings(path, _file_text(path))


def _text_strings(path: Path, text: str) -> Iterator[str]:
    if path.suffix.lower() == ".json":
        try:
            yield from _strings(json.loads(text))
        except ValueError:
            yield from text.splitlines()
        return
    for line in text.splitlines():
        yield line
        if _CELL_SPLIT in line:
            yield from line.split(_CELL_SPLIT)


# Folders that hold copies of public or third-party text, never notes: packages, caches and the leak-scan
# home itself. Inside a nested git checkout (a copy of the repository for a walk or a review) the files
# that checkout tracks are public copies and are skipped; its untracked files (walk outputs) are read.
SKIPPED_FOLDERS = {
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
}
SKIPPED_FOLDERS |= {".ruff_cache", "site-packages", ".cache", "leakscan"}
MAX_TEXT_BYTES = 2_000_000
_TEXT = {".md", ".txt", ".json"}

# Each folder kind of the notes folder, decided once (#311): `(fnmatch glob on a folder name, action,
# reason)`, matched lower-cased, first match wins. A `skip` glob applies to a folder of that name at any
# depth of the notes and walks sources; a `read` glob names a kind of notes. A kind no rule covers is
# read all the same, and `build` counts it (`work folders without a rule`).
WORK_RULES: tuple[tuple[str, str, str], ...] = (
    ("review", "skip", "an agent's review slot: copies of the repository's docs and diffs"),
    ("review-*", "skip", "an agent's review slot for one plan or PR"),
    ("reviews", "skip", "agents' review slots"),
    ("scratch", "skip", "an agent's scratch copy"),
    ("scratch-*", "skip", "an agent's scratch copy for one round"),
    ("refuter", "skip", "a refuter's scratch"),
    ("refuter-*", "skip", "a refuter's scratch for one claim"),
    ("writer", "skip", "an acceptance writer's scratch"),
    ("adversary", "skip", "the adversary agent's scratch"),
    ("premerge-*", "skip", "a pre-merge check's copy of a head"),
    ("redtree*", "skip", "a red-on-main run's copy of the tree"),
    ("ledger", "skip", "the review ledger: verdicts and hashes in closed words"),
    ("ledger-*", "skip", "a review ledger's copy"),
    ("launches", "skip", "builder launch records and prompts"),
    ("verdicts", "skip", "gate verdicts in closed words"),
    ("jev-cache", "skip", "cached Jev replies, a copy of what the drawing sources read"),
    ("worktree-leftovers", "skip", "leftover worktrees: copies of the repository"),
    ("leakscan", "skip", "the leak scan's own home"),
    ("logs", "skip", "run logs: tool output"),
    ("log", "skip", "run logs: tool output"),
    ("session-*", "read", "a session's notes"),
    ("session-*/*", "read", "a session's topic folder (the topic names are open-ended)"),
    ("factory", "read", "the factory's notes"),
    ("walks", "read", "the G1 walks (also a source of their own)"),
    ("walks-smoke", "read", "smoke walks' notes"),
    ("walk-expect", "read", "what a walk expects of the real sets"),
    ("sheets", "read", "notes on the real sets' sheets"),
    ("renders", "read", "renders of the real sets and their notes"),
    ("proto-*", "read", "a prototype's notes"),
    ("jev-system-one", "read", "notes on Jev's reading of the real sets"),
    ("t*-gate", "read", "a ticket gate's notes"),
    (".convert", "read", "conversions of the real sets"),
)
# Test output: a note whose lower-cased stem says so, or whose text holds pytest's header or summary
# line or a `node --test` summary.
_TEST_OUTPUT_STEMS = (
    "*pytest*",
    "*test-output*",
    "*test_output*",
    "red",
    "green",
    "red-*",
    "green-*",
    "*-red",
    "*-green",
    "*-red-*",
    "*-green-*",
)
_TEST_OUTPUT_LINE = re.compile(
    r"^\s*(?:=+ (?:test session starts|short test summary info) =+"
    r"|=+ .*\b(?:passed|failed)\b.* in [0-9.]+s\b.*=+"
    r"|# pass \d+)\s*$",
    re.MULTILINE,
)


@dataclass
class Tally:
    """One source's counts: the strings it read and the files its skips removed."""

    read: int = 0
    skipped: int = 0


def work_rule(name: str) -> str | None:
    """The action of the first `WORK_RULES` glob that matches a folder name (`None`: no rule)."""
    lowered = name.lower()
    return next((action for glob, action, _ in WORK_RULES if fnmatchcase(lowered, glob)), None)


def unclassified_work_folders(work: Path) -> list[str]:
    """The sorted names of the folders directly under the notes folder that no rule covers."""
    if not work.is_dir():
        return []
    return sorted(
        entry.name
        for entry in work.iterdir()
        if entry.is_dir()
        and not entry.is_symlink()
        and entry.name not in SKIPPED_FOLDERS
        and work_rule(entry.name) is None
    )


def _repository_copy(folder: Path) -> bool:
    """A copy of the repository (`CLAUDE.md` beside `pyproject.toml`), whatever its name. A nested git
    checkout keeps its own rule (its tracked files skipped, its untracked outputs read)."""
    return (
        (folder / "CLAUDE.md").is_file()
        and (folder / "pyproject.toml").is_file()
        and not (folder / ".git").exists()
    )


def _test_output(path: Path, text: str) -> bool:
    stem = path.stem.lower()
    return any(fnmatchcase(stem, glob) for glob in _TEST_OUTPUT_STEMS) or bool(
        _TEST_OUTPUT_LINE.search(text)
    )


def _files_in(folder: Path, suffixes: set[str]) -> int:
    """How many files with one of `suffixes` a skipped folder holds (packages and links not followed)."""
    found = 0
    for current, folders, files in os.walk(folder):
        here = Path(current)
        folders[:] = [n for n in folders if n not in SKIPPED_FOLDERS and not (here / n).is_symlink()]
        found += sum(1 for name in files if Path(name).suffix.lower() in suffixes)
    return found


def _tracked(checkout: Path) -> set[Path]:
    """The files a nested checkout tracks (none when git cannot say)."""
    done = subprocess.run(
        ["git", "-C", str(checkout), "ls-files", "-z"], capture_output=True, check=False
    )
    if done.returncode != 0:
        return set()
    return {checkout / raw.decode("utf-8", "surrogateescape") for raw in done.stdout.split(b"\0") if raw}


def _under(
    folder: Path,
    suffixes: set[str],
    skipped: frozenset[Path] = frozenset(),
    tally: Tally | None = None,
) -> Iterator[Path]:
    """Files under `folder` with one of `suffixes`, in a fixed order, streamed (the tree is large).
    With a `tally` (the notes and walks sources) the `skip` rules and the repository-copy marker apply
    too, and the files each of those skips removes are counted."""
    leak_home = home().resolve()
    public: set[Path] = set()
    for current, folders, files in os.walk(folder):
        here = Path(current)
        if (here / ".git").exists() and here != folder:
            public |= _tracked(here)
        kept = []
        for name in sorted(folders):
            path = here / name
            if name in SKIPPED_FOLDERS or path.is_symlink() or path.resolve() == leak_home:
                continue
            if path in skipped or (
                tally is not None and (work_rule(name) == "skip" or _repository_copy(path))
            ):
                if tally is not None:
                    tally.skipped += _files_in(path, suffixes)
                continue
            kept.append(name)
        folders[:] = kept
        for name in sorted(files):
            path = here / name
            suffix = path.suffix.lower()
            if suffix not in suffixes or path.is_symlink() or path in public:
                continue
            try:
                if suffix in _TEXT and path.stat().st_size > MAX_TEXT_BYTES:
                    continue
            except OSError:
                continue
            yield path


def text_sources(folders: list[Path]) -> Iterator[str]:
    """The `--source` seam: text and JSON files under each folder; a missing folder cannot be read."""
    for folder in folders:
        if not folder.is_dir():
            raise CannotScan("source-unreadable")
        for path in _under(folder, TEXT_SUFFIXES | {".json"}):
            yield from _file_strings(path)


def _dwg_texts(path: Path) -> Iterator[str]:
    from engine.read import libredwg
    from engine.read.artefact import Text
    from engine.text.decode import decode

    artefact = libredwg.read(path, source_name=path.name)
    for entity in artefact.entities.values():
        if isinstance(entity, Text):
            yield entity.text
            yield decode(entity.text, mtext=entity.type == "MTEXT")


def _pdf_texts(path: Path) -> Iterator[str]:
    from engine.read import pdf

    for page in pdf.page_text(path):
        for item in page.items:
            yield item.text


# Agents' notes quote code, commands and the repository's own docs far more than drawings: measured on
# 5 Oct 2026, every line of the notes made 169,049 corpus strings and 935 of 1,195 hit lines on one
# branch's diff, against 4 distinct strings from each drawing source. A note keeps a string only when it
# reads like drawing text as AutoCAD sets it: no lower-case letter and no code or Markdown character.
_CODE_CHARACTERS = set('`/\\_=(){}[]<>$#*|;"~^@')


def drawing_like(value: str) -> bool:
    """A note's string that reads like drawing text: upper case, no code or Markdown characters."""
    return not any(c.islower() or c in _CODE_CHARACTERS for c in value)


def _note_strings(path: Path, tally: Tally) -> Iterator[str]:
    """A note's drawing-like strings; test output (by its name or its pytest lines) gives none."""
    text = _file_text(path)
    if _test_output(path, text):
        tally.skipped += 1
        return
    yield from (value for value in _text_strings(path, text) if drawing_like(value.strip()))


def _notes(folder: Path, suffixes: set[str], skipped: frozenset[Path], tally: Tally) -> Iterator[str]:
    """A notes-like source: its files' drawing-like strings, every skip applied and counted."""
    for path in _under(folder, suffixes, skipped, tally):
        yield from _note_strings(path, tally)


def walk_skips(walks: Path) -> frozenset[Path]:
    """The walk folders that hold no drawing text: f5's serving worktree (`walks/_src`), and each walk's
    `public/` (what is published) and `logs/`. A walk's own words (check ids, defect classes, screens)
    would otherwise enter the corpus and refuse the next walk's drafts (PR #293's review)."""
    skipped = {walks / "_src"}
    if walks.is_dir():
        for walk in walks.iterdir():
            skipped |= {walk / "public", walk / "logs"}
    return frozenset(skipped)


def walk_strings(walks: Path) -> Iterator[str]:
    """The walk source: drawing-like strings of a walk's own files (the notes' filter), skips applied."""
    return _notes(walks, TEXT_SUFFIXES | {".json"}, walk_skips(walks), Tally())


def notes_folder() -> Path:
    return main_checkout() / ".private/work"


def real_sources(counts: dict[str, Tally]) -> Iterator[tuple[str, str]]:
    """The local sources' `(source, string)` pairs, in a fixed order; `counts` gets each source's
    strings read and files skipped."""
    reference = main_checkout() / ".private/reference"
    work = notes_folder()
    exports = Path.home() / ".cache/vextrus-real-drawings/exports"

    def each(name: str, values: Callable[[Tally], Iterator[str]]) -> Iterator[tuple[str, str]]:
        tally = counts.setdefault(name, Tally())
        try:
            for value in values(tally):
                tally.read += 1
                yield name, value
        except CannotScan:
            raise
        except Exception:
            raise CannotScan("source-unreadable") from None

    def files(paths: Iterator[Path], read: Callable[[Path], Iterator[str]]) -> Iterator[str]:
        for path in paths:
            yield from read(path)

    if reference.is_dir():
        yield from each("dwg", lambda _: files(_under(reference, {".dwg"}), _dwg_texts))
        yield from each("pdf", lambda _: files(_under(reference, {".pdf"}), _pdf_texts))
    if exports.is_dir():
        yield from each("exports", lambda _: files(_under(exports, {".json"}), _file_strings))
    walks = work / "walks"
    skipped = walk_skips(walks)
    if walks.is_dir():
        yield from each("walks", lambda t: _notes(walks, TEXT_SUFFIXES | {".json"}, skipped, t))
    if work.is_dir():
        yield from each("notes", lambda t: _notes(work, {".md"}, skipped, t))


def normalised(values: Iterator[str]) -> Iterator[str]:
    for value in values:
        yield normalise(value)
