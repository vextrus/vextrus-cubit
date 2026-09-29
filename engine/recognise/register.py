"""The drawing register (13): the rows of a drawing list drawn on a sheet of the set.

    register.find(artefact, sheets, *, conventions=None) -> list[RegisterEntry]

The harness's `register` stage (engine/harness.py): `sheets` are the file's sheets as the harness
stamped them, and each entry's `sheet` is the very object passed in (the export and the harness check
identity). 19b compares the entries with the sheets found, both ways, and 21c raises what disagrees.

**How a register is read.** On each sheet, a text that begins with one of the conventions'
`register_words` ("LIST OF DRAWINGS", "DRAWING LIST") is a register's heading. The texts under it, in
the heading's own direction (a turned sheet reads as an upright one) and within `SPAN` of its
heights either side, are gathered into lines, top to bottom. **With a header**: among the first
`HEADER_LINES` lines, the first holding two or more of the title block's labels, one of them the
number's ("SHEET NO.", "DRAWING TITLE", "REV."), names the columns: each header text starts one, which
runs to where the next begins (the last to its header's end and as far again), and a line's text
belongs to the column it overlaps most (a text outside every column, a general note beside the
register, to none). **With none**: a line's number is its first text that reads as a number
(`sheets.sequence`, at most `MAX_FIELD[NUMBER]` long), and what follows it without a gap wider than
`MAX_CELL_GAP` is its revision mark (a short text matching the conventions' revision-mark pattern) and
its title (its longest other text), and such a register has `MIN_ROWS` rows or more. The rows end at
a gap of more than `MAX_ROW_GAP` rows, or at `MAX_ROWS`. A line with no number is no row. A heading that
is a cell of another heading's rows (a row titled "Drawing list and notes"), or the sheet's own value
(its title), is no heading.

Each entry's box is its texts' box in the sheet's drawing units (paper units in a layout), so a run
joins it to the last run's by its place; its anchors are its texts', on the sheet's own key.

The conventions are the default sheet conventions unless given (21b passes the Market's).
"""

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from functools import partial

from engine.read.anchor import DwgAnchor
from engine.read.artefact import ReadArtefact
from engine.recognise import sheets as sheet_finder
from engine.recognise.sheets import (
    MAX_FIELD,
    FileBudget,
    _Labels,
    _normal,
    _Placed,
    _plain,
    sequence,
)
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
MAX_HEADINGS = 16
"""The most headings one sheet is read under (review round 1: 2,000 took 5 s, each a pass over the
sheet's texts); the rest are left out."""
MAX_CELL_GAP = 20.0
"""The widest gap between two texts of one row with no header, in the heading's heights."""
SPAN = 120.0
"""How far either side of its heading a register is looked for, in the heading's heights."""
HEADER_LINES = 3
"""The lines under a heading where its header is looked for."""
MIN_ROWS = 3
"""The fewest rows a register with no header is taken to have (a list of the set's sheets)."""


@dataclass(frozen=True)
class _Cell:
    text: _Placed
    u0: float  # in the heading's axes, in its heights: along its line
    u1: float
    v: float  # the line's middle
    height: float


type _Row = dict[SheetField, tuple[str, list[_Cell]]]
type _Column = tuple[float, float, SheetField | None]


def find(
    artefact: ReadArtefact,
    sheets: Sequence[SheetCandidate],
    *,
    conventions: SheetConventions | None = None,
    budget: FileBudget | None = None,
) -> list[RegisterEntry]:
    """The register entries read from the file's sheets (the module's docstring). Its walks spend
    `budget`, the file's (what the finder left: `sheets.find(...).budget`), or its own when none is
    given; a sheet's texts are read one sheet at a time."""
    held = conventions if conventions is not None else sheet_finder.default_conventions()
    headings = tuple(_normal(w) for w in held.register_words if _normal(w))
    if not headings or not sheets:
        return []
    labels = _Labels.of(held)
    spent = budget if budget is not None else FileBudget()
    entries: list[RegisterEntry] = []
    for i, on_sheet in sheet_finder.texts_on(artefact, sheets, held, budget=spent):
        sheet = sheets[i]
        own = {a.handle for a in sheet.anchors if isinstance(a, DwgAnchor)}
        found = [
            heading
            for heading in on_sheet
            if len(heading.shown) <= MAX_HEADING
            and _normal(heading.shown).startswith(headings)
            and heading.entity.handle not in own  # the sheet's own title is no heading
        ]
        if len(found) > MAX_HEADINGS:
            spent.counts["register_headings_capped"] += 1
        tables = [(heading, _table(heading, on_sheet, labels, held)) for heading in found[:MAX_HEADINGS]]
        in_rows = {
            id(cell.text)
            for _, rows in tables
            for row in rows
            for _, cells in row.values()
            for cell in cells
        }
        for heading, rows in tables:
            if id(heading) in in_rows:
                continue  # a row whose title begins like a heading is a row
            entries.extend(entry for row in rows if (entry := _entry(sheet, row)) is not None)
    return entries


def _entry(sheet: SheetCandidate, row: _Row) -> RegisterEntry | None:
    number = row.get(SheetField.NUMBER)
    cells = [cell for _, found in row.values() for cell in found]
    box = _box(cells)
    if number is None or box is None:
        return None
    title = row.get(SheetField.TITLE)
    mark = row.get(SheetField.REVISION_MARK)
    return RegisterEntry(
        sheet=sheet,
        row_box=box,
        number=number[0],
        title=title[0] if title else None,
        revision_mark=mark[0] if mark else None,
        anchors=_anchors(sheet, [cell.text for cell in cells]),
    )


def _lines(heading: _Placed, texts: list[_Placed]) -> list[list[_Cell]]:
    """The texts under the heading and within `SPAN` of it, in its axes, gathered into lines top
    to bottom (two texts share a line when their middles lie within half the smaller's height)."""
    cells: list[_Cell] = []
    for text in texts:
        if text is heading:
            continue
        u0, v0, u1, v1 = text.in_frame_of(heading)
        if v1 < 0.5 and u1 > -SPAN and u0 < SPAN:
            cells.append(_Cell(text, u0, u1, (v0 + v1) / 2, v1 - v0))
    cells.sort(key=lambda c: -c.v)
    lines: list[list[_Cell]] = []
    for cell in cells:
        last = lines[-1] if lines else None
        if last is not None and abs(last[0].v - cell.v) <= 0.5 * min(last[0].height, cell.height):
            last.append(cell)
        else:
            lines.append([cell])
    return [sorted(line, key=lambda c: c.u0) for line in lines]


def _table(
    heading: _Placed, texts: list[_Placed], labels: _Labels, conventions: SheetConventions
) -> list[_Row]:
    lines = _lines(heading, texts)
    for i, line in enumerate(lines[:HEADER_LINES]):
        columns = _columns(line, labels)
        if columns:
            return _rows(lines[i + 1 :], partial(_by_column, columns=columns), conventions)
    rows = _rows(lines, partial(_by_shape, conventions=conventions), conventions)
    return rows if len(rows) >= MIN_ROWS else []


def _columns(line: list[_Cell], labels: _Labels) -> list[_Column]:
    """A header line's columns (start, end, field), or none when the line is no header."""
    header: list[tuple[_Cell, SheetField | None]] = []
    for cell in line:
        label = labels.label(cell.text.shown)
        if label is not None:
            held = labels.fields.get(label[0])
            header.append((cell, held[0] if held is not None else None))
    if len(header) < 2 or SheetField.NUMBER not in {name for _, name in header}:
        return []
    columns: list[_Column] = []
    for j, (cell, name) in enumerate(header):
        end = header[j + 1][0].u0 if j + 1 < len(header) else cell.u1 + (cell.u1 - cell.u0)
        columns.append((cell.u0, end, name))
    return columns


def _rows(
    lines: list[list[_Cell]], read: Callable[[list[_Cell]], _Row], conventions: SheetConventions
) -> list[_Row]:
    rows: list[_Row] = []
    last: float | None = None
    pitch = math.inf  # the closest two rows have stood so far
    for line in lines:
        row = read(line)
        number = row.get(SheetField.NUMBER)
        if number is None or sequence(number[0], conventions) is None:
            continue
        v = number[1][0].v
        if last is not None:
            gap = last - v
            if gap > MAX_ROW_GAP * pitch:
                break
            pitch = min(pitch, gap)
        if len(rows) >= MAX_ROWS:
            break
        rows.append(row)
        last = v
    return rows


def _by_column(line: list[_Cell], columns: list[_Column]) -> _Row:
    """Each text into the column it overlaps most; a column that names no field (a scale) and a
    text outside every column are left out."""
    found: dict[SheetField, list[_Cell]] = {}
    for cell in line:
        overlap, name = max(
            ((min(cell.u1, end) - max(cell.u0, start), name) for start, end, name in columns),
            key=lambda o: o[0],
        )
        if overlap > 0 and name is not None:
            found.setdefault(name, []).append(cell)
    return {name: (value, cells) for name, cells in found.items() if (value := _joined(name, cells))}


def _by_shape(line: list[_Cell], conventions: SheetConventions) -> _Row:
    """With no header: the first text that is a number, then what follows it without a wide gap: a
    revision mark by the conventions' pattern, and the longest other text as the title."""
    start = next((i for i, cell in enumerate(line) if _number(cell, conventions)), None)
    if start is None:
        return {}
    run = [line[start]]
    for cell in line[start + 1 :]:
        if cell.u0 - run[-1].u1 > MAX_CELL_GAP:
            break
        run.append(cell)
    number = _joined(SheetField.NUMBER, [run[0]])
    if number is None:
        return {}
    found: _Row = {SheetField.NUMBER: (number, [run[0]])}
    rest = run[1:]
    pattern = conventions.revision_mark_pattern
    for cell in list(rest):
        text = " ".join(_plain(cell.text.shown).split())
        short = len(text) <= MAX_FIELD[SheetField.REVISION_MARK]
        if pattern and short and pattern_search(pattern, text):
            found[SheetField.REVISION_MARK] = (text, [cell])
            rest.remove(cell)
            break
    if rest:
        longest = max(rest, key=lambda c: len(c.text.shown))
        value = _joined(SheetField.TITLE, [longest])
        if value is not None:
            found[SheetField.TITLE] = (value, [longest])
    return found


def _number(cell: _Cell, conventions: SheetConventions) -> bool:
    text = " ".join(cell.text.shown.split())
    return len(text) <= MAX_FIELD[SheetField.NUMBER] and sequence(text, conventions) is not None


def _joined(name: SheetField, cells: list[_Cell]) -> str | None:
    text = " ".join(" ".join(_plain(c.text.shown).split()) for c in sorted(cells, key=lambda c: c.u0))
    if not text or len(text) > MAX_FIELD[name] or not any(ch.isalnum() for ch in text):
        return None
    return text


def _box(cells: list[_Cell]) -> Box | None:
    if not cells:
        return None
    xs, ys = [], []
    for cell in cells:
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
