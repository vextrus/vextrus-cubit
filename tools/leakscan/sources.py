"""Where the corpus comes from (contract section 1). Read only; nothing here prints a string it reads.

- `text_sources(folders)`: the test seam `build --source <dir>`: `*.txt` and `*.md` lines and every
  string in a `*.json` file (nested), under each folder.
- `real_sources()`: the local sources: every TEXT, MTEXT, ATTRIB and ATTDEF of each DWG under
  `.private/reference/` read through the engine's own reader, the Plot PDFs' text through the engine's
  PDF reader, `~/.cache/vextrus-real-drawings/exports/`, `.private/work/walks/*/` and the
  `.private/work/**/*.md` notes. The engine is imported only here, only when building locally.
"""

import json
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


def _under(folder: Path, suffixes: set[str]) -> Iterator[Path]:
    leak_home = home().resolve()
    for path in sorted(folder.rglob("*")):
        if path.is_file() and not path.is_symlink() and path.suffix.lower() in suffixes:
            if leak_home in path.resolve().parents:
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
    if walks.is_dir():
        yield from each("walks", _under(walks, TEXT_SUFFIXES | {".json"}), _file_strings)
    if work.is_dir():
        yield from each("notes", _under(work, {".md"}), _file_strings)


def normalised(values: Iterator[str]) -> Iterator[str]:
    for value in values:
        yield normalise(value)
