"""Where the corpus comes from (contract section 1). Read only; nothing here prints a string it reads.

- `text_sources(folders)`: the test seam `build --source <dir>`: `*.txt` and `*.md` lines and every
  string in a `*.json` file (nested), under each folder.
- `real_sources()`: the local sources: every TEXT, MTEXT, ATTRIB and ATTDEF of each DWG under
  `.private/reference/` read through the engine's own reader, the Plot PDFs' text through the engine's
  PDF reader, `~/.cache/vextrus-real-drawings/exports/`, `.private/work/walks/*/` and the
  `.private/work/**/*.md` notes. The engine is imported only here, only when building locally.
"""

import json
import os
import subprocess
from collections.abc import Callable, Iterator
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


def _file_strings(path: Path) -> Iterator[str]:
    """A text file's lines (and a Markdown table row's cells), or a JSON file's strings."""
    try:
        data = path.read_bytes()
    except OSError:
        raise CannotScan("source-unreadable") from None
    text = data.decode("utf-8", "replace")
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


def _tracked(checkout: Path) -> set[Path]:
    """The files a nested checkout tracks (none when git cannot say)."""
    done = subprocess.run(
        ["git", "-C", str(checkout), "ls-files", "-z"], capture_output=True, check=False
    )
    if done.returncode != 0:
        return set()
    return {checkout / raw.decode("utf-8", "surrogateescape") for raw in done.stdout.split(b"\0") if raw}


def _under(folder: Path, suffixes: set[str], skipped: frozenset[Path] = frozenset()) -> Iterator[Path]:
    """Files under `folder` with one of `suffixes`, in a fixed order, streamed (the tree is large)."""
    leak_home = home().resolve()
    public: set[Path] = set()
    for current, folders, files in os.walk(folder):
        here = Path(current)
        if (here / ".git").exists() and here != folder:
            public |= _tracked(here)
        folders[:] = sorted(
            name
            for name in folders
            if name not in SKIPPED_FOLDERS
            and (here / name) not in skipped
            and (here / name).resolve() != leak_home
            and not (here / name).is_symlink()
        )
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


def _note_strings(path: Path) -> Iterator[str]:
    return (value for value in _file_strings(path) if drawing_like(value.strip()))


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
    for path in _under(walks, TEXT_SUFFIXES | {".json"}, walk_skips(walks)):
        yield from _note_strings(path)


def real_sources(counts: dict[str, int]) -> Iterator[str]:
    """The local sources, in a fixed order; `counts` gets each source's number of strings read."""
    main = main_checkout()
    reference = main / ".private/reference"
    work = main / ".private/work"
    exports = Path.home() / ".cache/vextrus-real-drawings/exports"

    def each(name: str, paths: Iterator[Path], read: Callable[[Path], Iterator[str]]) -> Iterator[str]:
        counts.setdefault(name, 0)
        for path in paths:
            try:
                for value in read(path):
                    counts[name] += 1
                    yield value
            except CannotScan:
                raise
            except Exception:
                raise CannotScan("source-unreadable") from None

    if reference.is_dir():
        yield from each("dwg", _under(reference, {".dwg"}), _dwg_texts)
        yield from each("pdf", _under(reference, {".pdf"}), _pdf_texts)
    if exports.is_dir():
        yield from each("exports", _under(exports, {".json"}), _file_strings)
    walks = work / "walks"
    skipped = walk_skips(walks)
    if walks.is_dir():
        yield from each("walks", _under(walks, TEXT_SUFFIXES | {".json"}, skipped), _note_strings)
    if work.is_dir():
        yield from each("notes", _under(work, {".md"}, skipped), _note_strings)


def normalised(values: Iterator[str]) -> Iterator[str]:
    for value in values:
        yield normalise(value)
