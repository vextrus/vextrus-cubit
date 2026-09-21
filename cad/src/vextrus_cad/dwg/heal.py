"""Heal the long text LibreDWG's `dwg2dxf` mis-spells, before any reader sees it (L-CAD-04, L-CAD-09).

An ASCII DXF is a stream of pairs: a group code on one line, its value on the next. A string longer
than 250 characters is spelled as group-3 chunks in reading order and then the tail under group 1.
LibreDWG 0.13 spells a long string two wrong ways, sometimes both in one entity:

* **Wrapped.** A value longer than its 255-column buffer is written as the first 255 characters,
  a raw line break, then the rest — and no code between them. Every reader stops at the second
  line with `Invalid group code "..." at line N`, and the drawing is refused over a note nobody
  lost. The stray-line resync in `vextrus_cad.resync` would DROP that line; this pass joins it
  back onto its value, byte for byte, so the note is whole.
* **Rotated.** An MTEXT's first chunk is written under group 1 and the chunks after it under
  group 3, the reverse of the reference's order, so a reader that concatenates the 3s and appends
  the 1 hands back the note with its opening moved to the end. This pass gives the run the
  lawful codes — 3 for every chunk but the last, 1 for the last — with the values left in the
  order the converter wrote them, which is the reading order.

Both counts travel (L-CAD-09's sanity number), so a repaired drawing is a named repair rather than
a quiet rewrite. The wrap column is the discriminator for both: a short value followed by a stray
line is a different fault (an `Embedded Object` marker, a converter's stray flag) and is left for
the resync to judge; a group-1/group-3 run in any entity but MTEXT — a DIMENSION's text and its
style name stand exactly so — is lawful and is never touched. A continuation that happens to
spell an integer is the one shape this pass cannot see, and is stated as such rather than guessed.
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from ..resync import BINARY_SENTINEL, is_group_code, takes_string
from .errors import DwgError

#: The shortest value line this pass will read as one that wrapped or was chunked, in bytes,
#: before its line ending. LibreDWG 0.13 breaks at 255; the DXF reference's own longest string
#: chunk is 250, so a lawful writer never leaves a value this long that is not a chunk of its own.
WRAP_COLUMN: Final = 250

#: The one entity whose long text LibreDWG spells with its chunk codes rotated.
_CHUNKED_ENTITY: Final = b"MTEXT"

#: The chunk codes of a long MTEXT string: the tail's, and the ones before it.
_TAIL_CODE: Final = 1
_CHUNK_CODE: Final = 3


@dataclass(frozen=True)
class Rejoined:
    """What one pass over a tag stream healed."""

    #: The stream healed — the input object itself when nothing needed healing.
    repaired: bytes
    #: How many continuation lines were joined back onto their value.
    rejoined: int
    #: How many MTEXT chunk runs were given their lawful code order.
    reordered: int
    #: The 1-based line the first continuation or rotated run stood on, or 0 when neither did.
    line: int

    @property
    def healed(self) -> int:
        """Everything this pass changed, as one sanity number."""
        return self.rejoined + self.reordered


@dataclass
class _Pair:
    code: int
    code_line: bytes
    value: bytes
    line: int


def rejoin_wrapped_text(data: bytes) -> Rejoined:
    """Heal every wrapped and rotated string value in an ASCII tag stream, and count what changed.

    The walk is in pairs. A code line is taken as a code and the next line as its value; then,
    while the value's last piece fills the wrap column, the code takes a string and the line after
    it cannot be a group code, that line is spliced onto the value with the break removed. A line
    that is not a code and not a continuation is carried as it stood — the resync, not this pass,
    owns strays. Once the pairs are whole, each MTEXT's group-1 chunk that fills the column and
    is followed by group-3 chunks has its run re-coded into the reference's order.
    """
    if data.startswith(BINARY_SENTINEL):
        return Rejoined(repaired=data, rejoined=0, reordered=0, line=0)

    lines = data.splitlines(keepends=True)
    items: list[_Pair | bytes] = []
    rejoined = 0
    first = 0
    index = 0
    total = len(lines)
    while index < total:
        code_line = lines[index]
        if index + 1 >= total or not is_group_code(code_line):
            items.append(code_line)
            index += 1
            continue
        code = int(code_line.strip())
        value = lines[index + 1]
        pair_line = index + 1
        index += 2
        if takes_string(code):
            tail = value
            while index < total and len(_body(tail)) >= WRAP_COLUMN and not is_group_code(lines[index]):
                if first == 0:
                    first = index + 1
                tail = lines[index]
                value = _body(value) + tail
                rejoined += 1
                index += 1
        items.append(_Pair(code, code_line, value, pair_line))

    reordered, first_rotated = _reorder_chunks(items)
    if reordered and (first == 0 or 0 < first_rotated < first):
        first = first_rotated

    if rejoined == 0 and reordered == 0:
        return Rejoined(repaired=data, rejoined=0, reordered=0, line=0)
    out: list[bytes] = []
    for item in items:
        if isinstance(item, _Pair):
            out.append(item.code_line)
            out.append(item.value)
        else:
            out.append(item)
    return Rejoined(repaired=b"".join(out), rejoined=rejoined, reordered=reordered, line=first)


def _reorder_chunks(items: list[_Pair | bytes]) -> tuple[int, int]:
    """Give every rotated MTEXT chunk run its lawful codes, in place; count the runs and name the first.

    A run is a group-1 pair whose value fills the wrap column, standing inside an MTEXT, followed
    at once by one or more group-3 pairs. The values keep their order — the converter wrote them
    in reading order — and only the code lines move: each chunk takes the code of the one after it,
    so every chunk but the last is a 3 and the last is the 1.
    """
    reordered = 0
    first = 0
    entity: bytes | None = None
    index = 0
    while index < len(items):
        item = items[index]
        if not isinstance(item, _Pair):
            index += 1
            continue
        if item.code == 0:
            entity = item.value.strip()
        elif (
            item.code == _TAIL_CODE
            and entity == _CHUNKED_ENTITY
            and len(_body(item.value)) >= WRAP_COLUMN
        ):
            end = index + 1
            while end < len(items):
                after = items[end]
                if not isinstance(after, _Pair) or after.code != _CHUNK_CODE:
                    break
                end += 1
            if end > index + 1:
                run = items[index:end]
                code_lines = [pair.code_line for pair in run if isinstance(pair, _Pair)]
                for pair, code_line in zip(run, code_lines[1:] + code_lines[:1], strict=True):
                    if isinstance(pair, _Pair):
                        pair.code_line = code_line
                        pair.code = int(code_line.strip())
                reordered += 1
                if first == 0:
                    first = item.line
                index = end
                continue
        index += 1
    return reordered, first


def heal_wrapped_text(dxf_path: Path) -> Rejoined:
    """Heal a converted DXF in place, and say what was healed.

    A file with nothing to heal is not touched at all — not rewritten, not re-timestamped. One that
    was is replaced whole in one step, staged beside itself, so a write that fails leaves the
    converted DXF as the converter left it.
    """
    path = Path(dxf_path)
    try:
        data = path.read_bytes()
    except OSError as error:
        raise DwgError(f"the converted DXF {path.name} cannot be read: {error}") from error
    result = rejoin_wrapped_text(data)
    if result.healed == 0:
        return result
    staged: Path | None = None
    try:
        handle, name = tempfile.mkstemp(prefix=f".{path.stem}.", suffix=path.suffix, dir=path.parent)
        staged = Path(name)
        with os.fdopen(handle, "wb") as stream:
            stream.write(result.repaired)
        os.replace(staged, path)
    except OSError as error:
        if staged is not None:
            staged.unlink(missing_ok=True)
        raise DwgError(f"the converted DXF {path.name} cannot be rewritten: {error}") from error
    return result


def _body(line: bytes) -> bytes:
    """A line without its ending, whichever ending the converter wrote."""
    return line.rstrip(b"\r\n")
