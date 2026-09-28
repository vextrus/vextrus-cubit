"""The run-to-run diff (the M0 plan, "Run-to-run matching"; fixed before any result, never tuned after).

Both runs read the same files, so items join by where they are, never by what they say: a sheet by
(file sha256, layout name), else by (file sha256, model-space frame box, IoU >= 0.9); a view inside a
joined sheet by its box (IoU >= 0.8); a register entry inside a joined sheet by its row box (IoU >= 0.8);
a Plot match by (PDF sha256, page); an entity count by (file sha256, type); a font, PDF or Bangla-ANSI
count by (file sha256, its name); a Check result by (Check code, its joined subject); a conflict or a
continuation by (kind, its joined candidates); render F1 by the joined sheet. An item that joins nothing
is gained or lost; a joined item whose named values differ is changed. A sheet's render F1 is changed
when it moves by more than 0.005 and lost when it falls by more than 0.01. Read time and peak memory
are shown, never counted.

The export's shape read here (06b writes it and its schema, engine/export.schema.json): `files`, each
with `sha256`, `decoders_agree`, `entity_counts`, `font_report`, `pdf_report` (name -> count),
`bangla_ansi`, `read_seconds`, `peak_rss`, `sheets` and `plot_matches` (`page`, `sheet`: a sheet id or
null); a sheet has an `id` unique in the export, `layout` or `frame_box` ([x0, y0, x1, y1]), its values,
`render_f1`, `views` (each with an `id`, a `box` and its values) and `register` (each with a `row_box`);
top-level `checks` (`code`, `subject`: a file's sha256 or a sheet's or view's id, `outcome`,
`finding`), `conflicts` (`kind`, `candidates`: ids, `evidence`) and `continuations` (`kind`, `sheets`:
ids). A missing key is a stage not built: its measure is empty.

The item list holds drawing text (titles, numbers, layout names), so it is written only under the
owner's cache; the counts are what may leave the machine.
"""

import json
import unicodedata
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

JSON = Mapping[str, Any]

MEASURES = (
    "files",
    "entity_counts",
    "report_counts",
    "sheets",
    "views",
    "register",
    "plot_matches",
    "render_f1",
    "checks",
    "conflicts",
    "continuations",
)
SHEET_VALUES = (
    "number",
    "title",
    "discipline",
    "revision_mark",
    "revision_mark_source",
    "issue_date",
    "storeys",
    "storeys_meaning",
)
VIEW_VALUES = (
    "kind",
    "not_to_scale",
    "stated_scale",
    "storeys",
    "storeys_meaning",
    "subject",
    "layer",
    "proposed_steps",
    "part",
    "exclusion_reason",
    "coverage",
)
REGISTER_VALUES = ("number", "title", "revision_mark")
SHEET_IOU = 0.9
VIEW_IOU = 0.8
ROW_IOU = 0.8
F1_CHANGED = 0.005
F1_LOST = 0.01


@dataclass(frozen=True)
class Change:
    measure: str
    change: str  # gained | lost | changed
    key: str
    fields: dict[str, list[Any]] = field(default_factory=dict)  # name -> [before, after]


@dataclass
class Diff:
    items: list[Change] = field(default_factory=list)
    timings: list[tuple[str, Any, Any, Any, Any]] = field(default_factory=list)  # sha, s, s, rss, rss

    def counts(self) -> dict[str, dict[str, int]]:
        found = {m: {"gained": 0, "lost": 0, "changed": 0} for m in MEASURES}
        for item in self.items:
            found[item.measure][item.change] += 1
        return found


def compare(old: JSON, new: JSON) -> Diff:
    diff = Diff()
    ids: dict[str, str] = {}  # an old sheet's or view's id -> the id it joined in the new run
    old_files = {f["sha256"]: f for f in old.get("files", [])}
    new_files = {f["sha256"]: f for f in new.get("files", [])}
    for sha in sorted(old_files.keys() | new_files.keys()):
        before, after = old_files.get(sha), new_files.get(sha)
        if before is None or after is None:
            diff.items.append(Change("files", "gained" if before is None else "lost", sha))
        else:
            ids[sha] = sha  # a Check on a file joins by the file itself
            _values(diff, "files", sha, before, after, ("decoders_agree",))
            seconds = (before.get("read_seconds"), after.get("read_seconds"))
            diff.timings.append((sha, *seconds, before.get("peak_rss"), after.get("peak_rss")))
        _file(diff, ids, sha, before or {}, after or {})
    _plot_matches(diff, ids, old_files, new_files)
    _keyed(diff, "checks", _checks(old, ids), _checks(new, None))
    _keyed(
        diff,
        "conflicts",
        _groups(old, "conflicts", "candidates", ids),
        _groups(new, "conflicts", "candidates", None),
    )
    _keyed(
        diff,
        "continuations",
        _groups(old, "continuations", "sheets", ids, value=None),
        _groups(new, "continuations", "sheets", None, value=None),
    )
    return diff


def sizes(export: JSON) -> dict[str, int]:
    """How many items each measure holds in one run (a measure whose stage is not built holds none)."""
    files = export.get("files", [])
    sheets = [s for f in files for s in f.get("sheets", [])]
    return {
        "files": len(files),
        "entity_counts": sum(len(f.get("entity_counts", {})) for f in files),
        "report_counts": sum(len(_report_counts(f)) for f in files),
        "sheets": len(sheets),
        "views": sum(len(s.get("views", [])) for s in sheets),
        "register": sum(len(s.get("register", [])) for s in sheets),
        "plot_matches": sum(len(f.get("plot_matches", [])) for f in files),
        "render_f1": sum(s.get("render_f1") is not None for s in sheets),
        "checks": len(export.get("checks", [])),
        "conflicts": len(export.get("conflicts", [])),
        "continuations": len(export.get("continuations", [])),
    }


def _file(diff: Diff, ids: dict[str, str], sha: str, before: JSON, after: JSON) -> None:
    _keyed(
        diff,
        "entity_counts",
        _prefixed(sha, before.get("entity_counts", {})),
        _prefixed(sha, after.get("entity_counts", {})),
    )
    _keyed(
        diff,
        "report_counts",
        _prefixed(sha, _report_counts(before)),
        _prefixed(sha, _report_counts(after)),
    )
    pairs, lost, gained = _join_sheets(before.get("sheets", []), after.get("sheets", []))
    for old_sheet, new_sheet in pairs:
        key = f"{sha[:12]} sheet {_where(old_sheet)}"
        ids[old_sheet["id"]] = new_sheet["id"]
        _values(diff, "sheets", key, old_sheet, new_sheet, SHEET_VALUES)
        _render_f1(diff, key, old_sheet.get("render_f1"), new_sheet.get("render_f1"))
        views = _join(old_sheet.get("views", []), new_sheet.get("views", []), "box", VIEW_IOU)
        for old_view, new_view in views[0]:
            ids[old_view["id"]] = new_view["id"]
            _values(diff, "views", f"{key} view {old_view['box']}", old_view, new_view, VIEW_VALUES)
        _unjoined(diff, "views", key, views[1], views[2], "box")
        rows = _join(old_sheet.get("register", []), new_sheet.get("register", []), "row_box", ROW_IOU)
        for old_row, new_row in rows[0]:
            _values(
                diff, "register", f"{key} row {old_row['row_box']}", old_row, new_row, REGISTER_VALUES
            )
        _unjoined(diff, "register", key, rows[1], rows[2], "row_box")
    for change, sheets in (("lost", lost), ("gained", gained)):
        for one in sheets:
            key = f"{sha[:12]} sheet {_where(one)}"
            diff.items.append(Change("sheets", change, key))
            for name, box in (("views", "box"), ("register", "row_box")):
                diff.items.extend(
                    Change(name, change, f"{key} {box} {i[box]}") for i in one.get(name, [])
                )


def _join_sheets(
    old: list[JSON], new: list[JSON]
) -> tuple[list[tuple[JSON, JSON]], list[JSON], list[JSON]]:
    by_layout = {s["layout"]: s for s in new if s.get("layout") is not None}
    pairs = [(s, by_layout.pop(s["layout"])) for s in old if s.get("layout") in by_layout]
    joined_old = {id(a) for a, _ in pairs}
    joined_new = {id(b) for _, b in pairs}
    rest_old = [s for s in old if id(s) not in joined_old]
    rest_new = [s for s in new if id(s) not in joined_new]
    boxed, lost, gained = _join(
        [s for s in rest_old if s.get("frame_box")],
        [s for s in rest_new if s.get("frame_box")],
        "frame_box",
        SHEET_IOU,
    )
    lost += [s for s in rest_old if not s.get("frame_box")]
    gained += [s for s in rest_new if not s.get("frame_box")]
    return pairs + boxed, lost, gained


def _join(
    old: list[JSON], new: list[JSON], box: str, threshold: float
) -> tuple[list[tuple[JSON, JSON]], list[JSON], list[JSON]]:
    """One-to-one, greedily by the highest IoU first; a pair below the threshold never joins."""
    scored = sorted(
        ((_iou(a[box], b[box]), i, j) for i, a in enumerate(old) for j, b in enumerate(new)),
        key=lambda t: (-t[0], t[1], t[2]),
    )
    used_old: set[int] = set()
    used_new: set[int] = set()
    pairs = []
    for iou, i, j in scored:
        if iou >= threshold and i not in used_old and j not in used_new:
            used_old.add(i)
            used_new.add(j)
            pairs.append((old[i], new[j]))
    lost = [a for i, a in enumerate(old) if i not in used_old]
    gained = [b for j, b in enumerate(new) if j not in used_new]
    return pairs, lost, gained


def _iou(a: list[float], b: list[float]) -> float:
    width = min(a[2], b[2]) - max(a[0], b[0])
    height = min(a[3], b[3]) - max(a[1], b[1])
    if width <= 0 or height <= 0:
        return 0.0
    inter = width * height
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def _unjoined(
    diff: Diff, measure: str, key: str, lost: list[JSON], gained: list[JSON], box: str
) -> None:
    diff.items.extend(Change(measure, "lost", f"{key} {box} {i[box]}") for i in lost)
    diff.items.extend(Change(measure, "gained", f"{key} {box} {i[box]}") for i in gained)


def _values(diff: Diff, measure: str, key: str, old: JSON, new: JSON, names: Iterable[str]) -> None:
    fields = {
        name: [old.get(name), new.get(name)]
        for name in names
        if _normal(name, old.get(name)) != _normal(name, new.get(name))
    }
    if fields:
        diff.items.append(Change(measure, "changed", key, fields))


def _normal(name: str, value: Any) -> Any:
    """A title compares after case, whitespace and the symbols' compatibility forms are normalised."""
    if name == "title" and isinstance(value, str):
        return " ".join(unicodedata.normalize("NFKC", value).casefold().split())
    return value


def _render_f1(diff: Diff, key: str, old: float | None, new: float | None) -> None:
    if old is None and new is None:
        return
    fields = {"render_f1": [old, new]}
    if old is None:
        diff.items.append(Change("render_f1", "gained", key, fields))
    elif new is None or new < old - F1_LOST:
        diff.items.append(Change("render_f1", "lost", key, fields))
    elif abs(new - old) > F1_CHANGED:
        diff.items.append(Change("render_f1", "changed", key, fields))


def _plot_matches(
    diff: Diff, ids: Mapping[str, str], old: Mapping[str, JSON], new: Mapping[str, JSON]
) -> None:
    def pages(files: Mapping[str, JSON], rename: Callable[[Any], Any]) -> dict[str, Any]:
        return {
            f"{sha[:12]} page {m['page']}": {"sheet": rename(m.get("sheet"))}
            for sha, f in files.items()
            for m in f.get("plot_matches", [])
        }

    _keyed(diff, "plot_matches", pages(old, lambda s: _renamed(s, ids)), pages(new, lambda s: s))


def _checks(export: JSON, ids: Mapping[str, str] | None) -> dict[str, Any]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for check in export.get("checks", []):
        key = f"{check['code']} on {_renamed(check.get('subject'), ids)}"
        grouped[key].append(
            _canonical({"outcome": check.get("outcome"), "finding": check.get("finding")})
        )
    return {key: sorted(values) for key, values in grouped.items()}


def _groups(
    export: JSON, name: str, members: str, ids: Mapping[str, str] | None, value: str | None = "evidence"
) -> dict[str, Any]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for item in export.get(name, []):
        joined = sorted(str(_renamed(i, ids)) for i in item.get(members, []))
        grouped[f"{item.get('kind', name)} of {' '.join(joined)}"].append(
            _canonical(item.get(value)) if value else ""
        )
    return {key: sorted(values) for key, values in grouped.items()}


def _renamed(ref: Any, ids: Mapping[str, str] | None) -> Any:
    """An old run's id in the new run's terms (None: the new run's own); one that joined nothing stays
    apart from every new id."""
    if ids is None or ref is None:
        return ref
    return ids.get(ref, f"unjoined:{ref}")


def _keyed(diff: Diff, measure: str, old: Mapping[str, Any], new: Mapping[str, Any]) -> None:
    for key in sorted(old.keys() | new.keys()):
        if key not in new:
            diff.items.append(Change(measure, "lost", key))
        elif key not in old:
            diff.items.append(Change(measure, "gained", key))
        elif old[key] != new[key]:
            diff.items.append(Change(measure, "changed", key, {"value": [old[key], new[key]]}))


def _prefixed(sha: str, values: Mapping[str, Any]) -> dict[str, Any]:
    return {f"{sha[:12]} {name}": value for name, value in values.items()}


def _report_counts(file: JSON) -> dict[str, Any]:
    found = {f"font {k}": v for k, v in file.get("font_report", {}).items()}
    found |= {f"pdf {k}": v for k, v in file.get("pdf_report", {}).items()}
    if file.get("bangla_ansi") is not None:
        found["bangla_ansi"] = file["bangla_ansi"]
    return found


def _where(sheet: JSON) -> str:
    return (
        f"layout {sheet['layout']}"
        if sheet.get("layout") is not None
        else f"frame {sheet.get('frame_box')}"
    )


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False)
