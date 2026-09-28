"""The drawing register (13): the rows of a drawing list drawn on a sheet of the set.

    register.find(artefact, sheets, *, conventions=None) -> list[RegisterEntry]

The harness's `register` stage (engine/harness.py): `sheets` are the file's sheets as the harness
stamped them, and each entry's `sheet` is the very object passed in (the export and the harness check
identity). 19b compares the entries with the sheets found, both ways, and 21c raises what disagrees.

**How a register is read.** On each sheet, a text that begins with one of the conventions'
`register_words` ("LIST OF DRAWINGS", "DRAWING LIST") is a register's heading. Under it, in the
heading's own direction (a turned sheet reads as an upright one), texts are gathered into rows by
their line, top to bottom, until a gap of more than `MAX_ROW_GAP` rows or `MAX_ROWS` rows. A row whose
texts are the title block's labels ("SHEET NO.", "DRAWING TITLE", "REV.") is the header: it names each
column, and a row's texts are read into the column whose header they stand under. With no header, a
row's number is its first text that reads as a number (`sheets.sequence`, at most
`MAX_FIELD[NUMBER]` long), its revision mark a short text matching the conventions' revision-mark
pattern, and its title its longest other text. A row with no number is no entry. Each entry's box is
its texts' box in the sheet's drawing units (paper units in a layout), so a run joins it to the last
run's by its place; its anchors are its texts'.

The conventions are the default sheet conventions unless given (21b passes the Market's).
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass

from engine.read.anchor import DwgAnchor
from engine.read.artefact import ReadArtefact
from engine.recognise import sheets as sheet_finder
from engine.recognise.sheets import MAX_FIELD, _normal, _Placed, sequence
from engine.recognise.types import (
    Box,
    RegisterEntry,
    SheetCandidate,
    SheetConventions,
    SheetField,
    pattern_search,
)

MAX_ROWS = 2000
"""The most rows one register is read to."""
MAX_ROW_GAP = 4.0
"""The widest gap between two rows, in rows, before the register is taken to end."""
MAX_HEADING = 200
"""The longest heading text, in characters."""
MAX_CELL_GAP = 20.0
"""The widest gap between two texts of one row, in the heading's heights."""


@dataclass(frozen=True)
class _Cell:
    text: _Placed
    u0: float  # in the heading's axes, in its heights: along its line
    u1: float
    v: float  # the line's middle


def find(
    artefact: ReadArtefact,
    sheets: Sequence[SheetCandidate],
    *,
    conventions: SheetConventions | None = None,
) -> list[RegisterEntry]:
    """The register entries read from the file's sheets (the module's docstring)."""
    held = conventions if conventions is not None else sheet_finder.default_conventions()
    headings = tuple(_normal(w) for w in held.register_words if _normal(w))
    if not headings or not sheets:
        return []
    texts = sheet_finder.texts_on(artefact, sheets, held)
    entries: list[RegisterEntry] = []
    for i, sheet in enumerate(sheets):
        on_sheet = texts.get(i, [])
        found = [
            (heading, _rows(heading, on_sheet))
            for heading in on_sheet
            if len(heading.shown) <= MAX_HEADING and _normal(heading.shown).startswith(headings)
        ]
        in_rows = {id(c.text) for _, rows in found for row in rows for c in row}
        for heading, rows in found:
            if id(heading) not in in_rows:  # a row's title that begins like a heading is a row
                entries.extend(_entries(sheet, rows, held))
    return entries


def _entries(
    sheet: SheetCandidate, rows: list[list[_Cell]], conventions: SheetConventions
) -> list[RegisterEntry]:
    if not rows:
        return []
    labels = sheet_finder._Labels.of(conventions)
    columns: list[tuple[float, SheetField | None]] = []
    header = [(c, labels.label(c.text.shown)) for c in rows[0]]
    if all(label is not None for _, label in header):
        for cell, label in header:
            assert label is not None
            held = labels.fields.get(label[0])
            columns.append((cell.u0, held[0] if held is not None else None))
        rows = rows[1:]
    entries: list[RegisterEntry] = []
    for row in rows:
        values = _by_column(row, columns) if columns else _by_shape(row, conventions)
        number = values.get(SheetField.NUMBER)
        if number is None or sequence(number[0], conventions) is None:
            continue
        used = [c.text for _, cells in values.values() for c in cells]
        box = _box(row)
        if box is None:
            continue
        entries.append(
            RegisterEntry(
                sheet=sheet,
                row_box=box,
                number=number[0],
                title=values[SheetField.TITLE][0] if SheetField.TITLE in values else None,
                revision_mark=(
                    values[SheetField.REVISION_MARK][0] if SheetField.REVISION_MARK in values else None
                ),
                anchors=_anchors(sheet, used),
            )
        )
    return entries


def _rows(heading: _Placed, texts: list[_Placed]) -> list[list[_Cell]]:
    """The texts under the heading, in its axes, gathered into lines top to bottom; a line is the
    run of texts that begins under the heading, cut where a gap wider than `MAX_CELL_GAP` opens (the
    title block beside a register is not part of it)."""
    _, _, width, _ = heading.box
    lines: list[list[_Cell]] = []
    for text in sorted(texts, key=lambda t: -t.in_frame_of(heading)[3]):
        if text is heading:
            continue
        u0, v0, u1, v1 = text.in_frame_of(heading)
        if v1 >= 0.5 or u1 < -MAX_CELL_GAP:
            continue
        cell = _Cell(text, u0, u1, (v0 + v1) / 2)
        if lines and abs(lines[-1][0].v - cell.v) <= 0.6:
            lines[-1].append(cell)
        else:
            lines.append([cell])
    rows: list[list[_Cell]] = []
    pitch = math.inf  # the closest two rows have stood so far
    for line in lines:
        row = _run(sorted(line, key=lambda c: c.u0), width)
        if not row:
            continue
        if rows:
            gap = rows[-1][0].v - row[0].v
            if gap > MAX_ROW_GAP * pitch:
                break
            pitch = min(pitch, gap)
        if len(rows) >= MAX_ROWS:
            break
        rows.append(row)
    return rows


def _run(line: list[_Cell], width: float) -> list[_Cell]:
    """The texts of a line that begin under the heading and follow one another without a wide gap."""
    start = next((i for i, c in enumerate(line) if -MAX_CELL_GAP <= c.u0 <= width + 1.0), None)
    if start is None:
        return []
    run = [line[start]]
    for cell in line[start + 1 :]:
        if cell.u0 - run[-1].u1 > MAX_CELL_GAP:
            break
        run.append(cell)
    return run


def _by_column(
    row: list[_Cell], columns: list[tuple[float, SheetField | None]]
) -> dict[SheetField, tuple[str, list[_Cell]]]:
    """Each text into the column whose header it stands under (the nearest header by its start); a
    column that names no field (a scale) is left out."""
    found: dict[SheetField, list[_Cell]] = {}
    for cell in row:
        _, name = min(columns, key=lambda column: abs(column[0] - cell.u0))
        if name is not None:
            found.setdefault(name, []).append(cell)
    return {
        name: (value, cells)
        for name, cells in found.items()
        if (value := _joined(name, cells)) is not None
    }


def _by_shape(
    row: list[_Cell], conventions: SheetConventions
) -> dict[SheetField, tuple[str, list[_Cell]]]:
    """With no header: the first text that is a number, a revision mark, and the longest other."""
    found: dict[SheetField, tuple[str, list[_Cell]]] = {}
    rest = list(row)
    for cell in row:
        text = " ".join(cell.text.shown.split())
        if len(text) <= MAX_FIELD[SheetField.NUMBER] and sequence(text, conventions) is not None:
            found[SheetField.NUMBER] = (text, [cell])
            rest.remove(cell)
            break
    pattern = conventions.revision_mark_pattern
    for cell in list(rest):
        text = " ".join(cell.text.shown.split())
        if (
            pattern
            and len(text) <= MAX_FIELD[SheetField.REVISION_MARK]
            and pattern_search(pattern, text)
        ):
            found[SheetField.REVISION_MARK] = (text, [cell])
            rest.remove(cell)
            break
    if rest:
        longest = max(rest, key=lambda c: len(c.text.shown))
        value = _joined(SheetField.TITLE, [longest])
        if value is not None:
            found[SheetField.TITLE] = (value, [longest])
    return found


def _joined(name: SheetField, cells: list[_Cell]) -> str | None:
    text = " ".join(" ".join(c.text.shown.split()) for c in sorted(cells, key=lambda c: c.u0))
    if not text or len(text) > MAX_FIELD[name] or not any(ch.isalnum() for ch in text):
        return None
    return text


def _box(row: list[_Cell]) -> Box | None:
    xs, ys = [], []
    for cell in row:
        for x, y in cell.text.corners():
            xs.append(x)
            ys.append(y)
    values = (min(xs), min(ys), max(xs), max(ys))
    return Box(*values) if all(math.isfinite(v) for v in values) else None


def _anchors(sheet: SheetCandidate, texts: list[_Placed]) -> tuple[DwgAnchor, ...]:
    """Each text's anchor, on the sheet's own key (its frame anchor's); none for a sheet made with
    no anchor of its own."""
    frame = next((a for a in sheet.anchors if isinstance(a, DwgAnchor)), None)
    if frame is None:
        return ()
    return tuple(
        DwgAnchor(
            frame.source_sha256,
            frame.reader,
            frame.reader_version,
            frame.sheet,
            tuple(link.insert.handle for link in text.chain),
            text.entity.handle,
        )
        for text in texts
    )
