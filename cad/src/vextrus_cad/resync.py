"""One tag-stream resync for a DXF whose code/value rhythm slipped (L-CAD-04, L-CAD-09).

An ASCII DXF is a stream of pairs: a line holding an integer group code, then a line holding that
code's value. A converter that writes one stray line — LibreDWG's `dwg2dxf` does, and so does an
R2018 export whose MTEXT column data leaves an `Embedded Object` marker where a code belongs —
breaks the rhythm for the whole rest of the file, and `ezdxf` stops at the first such line with
`Invalid group code "..." at line N`. Everything after it is lawful; only the parity is wrong.

So this module drops lines, one at a time, until the rhythm resumes, and *counts* what it dropped.
The count is the point: it is the sanity number L-CAD-09 asks for after a converter change, and it
is what makes the repair a named note (`RESYNCED_TAG_STREAM: n lines dropped`) rather than a quiet
rewrite of somebody's drawing. 13 dropped lines out of 2.36 million is a repair; a third of the file
is a different drawing, so the budget below refuses instead.

`ezdxf.recover.explore()` re-syncs too, with `synced_bytes_loader`, and says nothing about what it
skipped. That is the right tool for exploring a file by hand and the wrong one for an extractor
whose output is evidence: this one hands back the repaired bytes and the number.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

#: The highest group code a DXF tag may carry; anything above it is not a code, whatever it parses
#: as. (`ezdxf.lldxf.types.MAX_GROUP_CODE`, spelled here so the rhythm test owns its own bounds.)
MAX_GROUP_CODE: Final = 1071

#: How many pairs past a candidate must also read as code/value before the rhythm counts as resumed.
#: One pair is not evidence: a *value* line that happens to hold an integer looks exactly like a
#: code line, and resyncing on one would shift the parity of everything after it.
LOOKAHEAD_PAIRS: Final = 3

#: How many lines one resync may drop before the file stops being a drawing with a flaw in it. A
#: real converter fault is a handful of lines; beyond this the stream is not a DXF that slipped.
RESYNC_LINE_BUDGET: Final = 512

#: The marker a binary DXF opens with. Binary DXF has no lines to re-pair, so it is never resynced.
BINARY_SENTINEL: Final = b"AutoCAD Binary DXF"


@dataclass(frozen=True)
class Resync:
    """What one resync pass made of a tag stream."""

    #: The repaired bytes, or None when the stream never came back into rhythm inside its budget.
    repaired: bytes | None
    #: How many lines were dropped to bring the rhythm back — the sanity number.
    dropped: int
    #: The 1-based line the first mis-paired code stood on, or 0 when nothing was mis-paired.
    line: int
    #: That line's own text, so a refusal can carry the thing it choked on rather than a position.
    text: str

    @property
    def repaired_in_place(self) -> bool:
        """True when the stream was already in rhythm and nothing was dropped."""
        return self.repaired is not None and self.dropped == 0


def is_group_code(line: bytes) -> bool:
    """Whether this line is a group code: an integer, alone, inside the code range."""
    try:
        code = int(line.strip())
    except ValueError:
        return False
    return 0 <= code <= MAX_GROUP_CODE


def _rhythm_resumes(lines: list[bytes], index: int) -> bool:
    """Whether a code/value rhythm starting at `index` holds for the next few pairs."""
    for pair in range(LOOKAHEAD_PAIRS):
        at = index + pair * 2
        if at >= len(lines):
            # The stream ends here. A file's last pairs are `0/EOF`, so running out while still in
            # rhythm is the rhythm holding, not failing.
            return pair > 0
        if not is_group_code(lines[at]):
            return False
        if at + 1 >= len(lines):
            return pair > 0
    return True


def resync_tag_stream(data: bytes, budget: int = RESYNC_LINE_BUDGET) -> Resync:
    """Re-pair an ASCII DXF tag stream by dropping the lines that broke its rhythm.

    The scan walks in pairs. A line where a group code belongs that is not one is dropped, and the
    scan tries again one line further on — which is exactly what repairs a stray line, because a
    stray line is what shifted the parity. A candidate only counts once the next few pairs read as
    code/value too, so a value that happens to be an integer cannot restart the parity wrongly.
    """
    if data.startswith(BINARY_SENTINEL):
        return Resync(repaired=None, dropped=0, line=1, text=BINARY_SENTINEL.decode("ascii"))

    lines = data.splitlines(keepends=True)
    kept: list[bytes] = []
    dropped = 0
    offending_line = 0
    offending_text = ""
    index = 0

    while index < len(lines):
        if is_group_code(lines[index]):
            if index + 1 >= len(lines):
                # A code with no value is half a pair: there is nothing to pair it with, so the
                # stream ends here and the half pair is left where it stands.
                kept.append(lines[index])
                break
            kept.append(lines[index])
            kept.append(lines[index + 1])
            index += 2
            continue

        # A line where a group code belongs that is not one: the rhythm has slipped. Drop lines one
        # at a time — a stray line is what shifted the parity, so dropping one is what restores it —
        # until a code line stands at the head of pairs that read as pairs for a few more.
        if offending_line == 0:
            offending_line, offending_text = index + 1, _text(lines[index])
        while index < len(lines) and not (
            is_group_code(lines[index]) and _rhythm_resumes(lines, index)
        ):
            dropped += 1
            if dropped > budget:
                return Resync(
                    repaired=None, dropped=dropped, line=offending_line, text=offending_text
                )
            index += 1

    if not kept:
        return Resync(repaired=None, dropped=dropped, line=offending_line or 1, text=offending_text)
    return Resync(repaired=b"".join(kept), dropped=dropped, line=offending_line, text=offending_text)


def _text(line: bytes) -> str:
    """One line as a refusal can carry it: decoded loosely, stripped, and bounded."""
    return line.decode("utf-8", errors="replace").strip()[:200]
