"""The run-to-run diff (the M0 plan, "Run-to-run matching"; fixed before any result, never tuned after).

Both runs read the same files, so items join by where they are, never by what they say: a file by its
sha256 (two copies of one file by their paths); a sheet by (file, layout name), else by (file,
model-space frame box, IoU >= 0.9); a view inside a joined sheet by its box (IoU >= 0.8); a register
entry inside a joined sheet by its row box (IoU >= 0.8); a Plot match by (PDF, page); an entity count
by (file, type); a font, PDF or Bangla-ANSI count by (file, its name); a Check result by (Check code,
its joined subject); a conflict or a continuation by (kind, its joined candidates); render F1 by the
joined sheet. An item that joins nothing is gained or lost; a joined item whose named values differ is
changed. A sheet's render F1 is changed when it moves by more than 0.005 and lost when it falls by more
than 0.01, the move taken to nine decimal places (exactly on an edge is not past it). A stage that fails
where it did not is lost, joined by (file, stage) or (the set, stage); a file's process that did not end
ok (or does not say) is its stage "process" (the owner's ruling, 28 Sep 2026: "Count it"). Read time
and peak memory are shown, never counted.

The export is the engine's (06b: engine/export.py and engine/export.schema.json), read as it is:
- `files`, each with `sha256`, `path`, `decoders_agree`, `entity_counts`, `font_report`, `pdf_report`
  and `bangla_ansi` (name -> count), `process` (`seconds`, `peak_rss_kib`) and `sheets`; a stage not
  built leaves its key null, read here as empty;
- a sheet: `location` (`layout`, `box` as [x0, y0, x1, y1]), its values (`number`, `title`,
  `discipline`, `revision_mark`, `issue_date`, `storeys_as_stated`, each `{value, source}` or null),
  `render_f1`, `views` (each with a `box` and its values) and `register` (each with a `row_box`);
- top-level `plot` (`page`: `{file, page}`; `sheet`: `{file, sheet}` or null), `checks` (`code`,
  `outcome`, `subject`: a position or null, `finding`), `conflicts` (`kind`, `candidates`: positions,
  `evidence`) and `continuations` (`sheets`: positions).
A position (`{file, sheet[, view | register]}` or `{file, page}`) only addresses an item inside its own
export: an old run's positions are mapped through the joins into the new run's before any comparison,
so an item that moved to another position still joins, and one whose item joined nothing is lost.

The item list holds drawing text (titles, numbers, layout names, file paths), so it is written only
under the owner's cache; the counts are what may leave the machine.
"""

import json
import re
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

JSON = Mapping[str, Any]
Position = tuple[int, ...]

MEASURES = (
    "files",
    "failed_stages",
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
    "issue_date",
    "storeys_as_stated",
    "paper",
)
VIEW_VALUES = (
    "kind",
    "not_to_scale",
    "stated_scale",
    "storeys",
    "storeys_meaning",
    "subject",
    "layer",
    "steps",
    "part",
    "exclusion",
    "coverage",
)
REGISTER_VALUES = ("number", "title", "revision_mark")
SHEET_IOU = 0.9
VIEW_IOU = 0.8
ROW_IOU = 0.8
F1_CHANGED = 0.005
F1_LOST = 0.01
# A render F1 move is compared to nine decimal places, so a move exactly on an edge in decimal is on it
# and not past it by the subtraction's float error (0.505 - 0.5 is 0.0050000000000000044). The edges
# themselves are fixed above and never tuned.
F1_DIGITS = 9


@dataclass(frozen=True)
class Change:
    measure: str
    change: str  # gained | lost | changed
    key: str
    fields: dict[str, list[Any]] = field(default_factory=dict)  # name -> [before, after]


@dataclass
class Diff:
    items: list[Change] = field(default_factory=list)
    timings: list[tuple[str, Any, Any, Any, Any]] = field(default_factory=list)  # sha, s, s, KiB, KiB

    def counts(self) -> dict[str, dict[str, int]]:
        found = {m: {"gained": 0, "lost": 0, "changed": 0} for m in MEASURES}
        for item in self.items:
            found[item.measure][item.change] += 1
        return found


@dataclass
class _Joins:
    """The old run's positions -> the new run's: files `(i,)`, sheets `(i, s)`, views `(i, s, "view",
    v)` and register entries `(i, s, "register", r)`, keyed alike."""

    to_new: dict[tuple[Any, ...], tuple[Any, ...]] = field(default_factory=dict)
    old_labels: list[str] = field(default_factory=list)
    new_labels: list[str] = field(default_factory=list)


def compare(old: JSON, new: JSON) -> Diff:
    diff, joins = Diff(), _Joins()
    old_files, new_files = _list(old, "files"), _list(new, "files")
    joins.old_labels = [_label(f) for f in old_files]
    joins.new_labels = [_label(f) for f in new_files]
    pairs, lost, gained = _join_files(old_files, new_files)
    for i, j in pairs:
        before, after = old_files[i], new_files[j]
        joins.to_new[(i,)] = (j,)
        _values(diff, "files", joins.new_labels[j], before, after, ("decoders_agree",))
        seconds = (_process(before, "seconds"), _process(after, "seconds"))
        diff.timings.append(
            (
                after["sha256"],
                *seconds,
                _process(before, "peak_rss_kib"),
                _process(after, "peak_rss_kib"),
            )
        )
        _file(diff, joins, (i, before), (j, after))
    for i in lost:
        diff.items.append(Change("files", "lost", joins.old_labels[i]))
        _file(diff, joins, (i, old_files[i]), None)
    for j in gained:
        diff.items.append(Change("files", "gained", joins.new_labels[j]))
        _file(diff, joins, None, (j, new_files[j]))
    _failed(diff, "the set", old.get("set_stages"), new.get("set_stages"))
    _keyed(diff, "plot_matches", _plot(old, joins, True), _plot(new, joins, False))
    _keyed(diff, "checks", _checks(old, joins, True), _checks(new, joins, False))
    _keyed(
        diff,
        "conflicts",
        _groups(old, "conflicts", "candidates", joins, True),
        _groups(new, "conflicts", "candidates", joins, False),
    )
    _keyed(
        diff,
        "continuations",
        _groups(old, "continuations", "sheets", joins, True, value=None),
        _groups(new, "continuations", "sheets", joins, False, value=None),
    )
    return diff


def sizes(export: JSON) -> dict[str, int]:
    """How many items each measure holds in one run (a stage not built holds none)."""
    files = _list(export, "files")
    sheets = [s for f in files for s in _list(f, "sheets")]
    return {
        "files": len(files),
        "failed_stages": sum(failures(export).values()),
        "entity_counts": sum(len(f.get("entity_counts") or {}) for f in files),
        "report_counts": sum(len(_report_counts(f)) for f in files),
        "sheets": len(sheets),
        "views": sum(len(_list(s, "views")) for s in sheets),
        "register": sum(len(_list(s, "register")) for s in sheets),
        "plot_matches": len(_list(export, "plot")),
        "render_f1": sum(s.get("render_f1") is not None for s in sheets),
        "checks": len(_list(export, "checks")),
        "conflicts": len(_list(export, "conflicts")),
        "continuations": len(_list(export, "continuations")),
    }


def _file(diff: Diff, joins: _Joins, old: tuple[int, JSON] | None, new: tuple[int, JSON] | None) -> None:
    """One file's counts and sheets; a file only one run has brings all its items, gained or lost."""
    label = joins.new_labels[new[0]] if new else joins.old_labels[old[0]] if old else ""
    before, after = old[1] if old else {}, new[1] if new else {}
    _keyed(
        diff,
        "entity_counts",
        _prefixed(label, before.get("entity_counts") or {}),
        _prefixed(label, after.get("entity_counts") or {}),
    )
    _keyed(
        diff,
        "report_counts",
        _prefixed(label, _report_counts(before)),
        _prefixed(label, _report_counts(after)),
    )
    _failed_files(diff, label, old[1] if old else None, new[1] if new else None)
    old_sheets, new_sheets = _list(before, "sheets"), _list(after, "sheets")
    pairs, lost, gained = _join_sheets(old_sheets, new_sheets)
    for s, t in pairs:  # pairs only when both runs have the file
        i, j = old[0] if old else -1, new[0] if new else -1
        joins.to_new[(i, s)] = (j, t)
        a, b = old_sheets[s], new_sheets[t]
        key = f"{label} sheet {_where(a)}"
        _values(diff, "sheets", key, a, b, SHEET_VALUES)
        _render_f1(diff, key, a.get("render_f1"), b.get("render_f1"))
        for name, box, threshold, values in (
            ("views", "box", VIEW_IOU, VIEW_VALUES),
            ("register", "row_box", ROW_IOU, REGISTER_VALUES),
        ):
            old_items, new_items = _list(a, name), _list(b, name)
            joined, unjoined_old, unjoined_new = _join(old_items, new_items, box, threshold)
            for v, w in joined:
                inner = "view" if name == "views" else "register"  # as a position names it
                joins.to_new[(i, s, inner, v)] = (j, t, inner, w)
                _values(
                    diff, name, f"{key} {box} {old_items[v][box]}", old_items[v], new_items[w], values
                )
            diff.items.extend(
                Change(name, "lost", f"{key} {box} {old_items[v][box]}") for v in unjoined_old
            )
            diff.items.extend(
                Change(name, "gained", f"{key} {box} {new_items[w][box]}") for w in unjoined_new
            )
    for change, sheets, indices in (("lost", old_sheets, lost), ("gained", new_sheets, gained)):
        for s in indices:
            key = f"{label} sheet {_where(sheets[s])}"
            diff.items.append(Change("sheets", change, key))
            for name, box in (("views", "box"), ("register", "row_box")):
                diff.items.extend(
                    Change(name, change, f"{key} {box} {i[box]}") for i in _list(sheets[s], name)
                )


def _join_files(old: list[JSON], new: list[JSON]) -> tuple[list[tuple[int, int]], list[int], list[int]]:
    """By sha256; two copies of one file by their paths as well."""
    by_key = {(f["sha256"], f.get("path")): j for j, f in enumerate(new)}
    pairs = [
        (i, by_key.pop((f["sha256"], f.get("path"))))
        for i, f in enumerate(old)
        if (f["sha256"], f.get("path")) in by_key
    ]
    joined_old = {i for i, _ in pairs}
    lost = [i for i in range(len(old)) if i not in joined_old]
    return pairs, lost, sorted(by_key.values())


def _join_sheets(old: list[JSON], new: list[JSON]) -> tuple[list[tuple[int, int]], list[int], list[int]]:
    """By layout name first, then the rest by model-space frame box."""
    by_layout = {
        _location(s, "layout"): t for t, s in enumerate(new) if _location(s, "layout") is not None
    }
    pairs = [
        (s, by_layout.pop(_location(a, "layout")))
        for s, a in enumerate(old)
        if _location(a, "layout") in by_layout
    ]
    rest_old = [s for s in range(len(old)) if s not in {p for p, _ in pairs}]
    rest_new = [t for t in range(len(new)) if t not in {q for _, q in pairs}]
    boxed_old = [s for s in rest_old if _location(old[s], "box")]
    boxed_new = [t for t in rest_new if _location(new[t], "box")]
    framed: list[JSON] = [{"box": _location(old[s], "box")} for s in boxed_old]
    framed_new: list[JSON] = [{"box": _location(new[t], "box")} for t in boxed_new]
    joined, lost, gained = _join(framed, framed_new, "box", SHEET_IOU)
    pairs += [(boxed_old[v], boxed_new[w]) for v, w in joined]
    lost_all = [boxed_old[v] for v in lost] + [s for s in rest_old if s not in boxed_old]
    gained_all = [boxed_new[w] for w in gained] + [t for t in rest_new if t not in boxed_new]
    return pairs, sorted(lost_all), sorted(gained_all)


def _join(
    old: list[JSON], new: list[JSON], box: str, threshold: float
) -> tuple[list[tuple[int, int]], list[int], list[int]]:
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
            pairs.append((i, j))
    lost = [i for i in range(len(old)) if i not in used_old]
    gained = [j for j in range(len(new)) if j not in used_new]
    return pairs, lost, gained


def _iou(a: list[float], b: list[float]) -> float:
    width = min(a[2], b[2]) - max(a[0], b[0])
    height = min(a[3], b[3]) - max(a[1], b[1])
    if width <= 0 or height <= 0:
        return 0.0
    inter = width * height
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def _values(diff: Diff, measure: str, key: str, old: JSON, new: JSON, names: Iterable[str]) -> None:
    fields = {
        name: [old.get(name), new.get(name)]
        for name in names
        if _normal(name, old.get(name)) != _normal(name, new.get(name))
    }
    if fields:
        diff.items.append(Change(measure, "changed", key, fields))


def _normal(name: str, value: Any) -> Any:
    """What a value compares by: a sourced value by its value (a revision mark with its source), an
    exclusion by its reason, a title after case, whitespace and symbol forms are normalised."""
    if isinstance(value, Mapping) and "value" in value:
        value = (value["value"], value.get("source")) if name == "revision_mark" else value["value"]
    elif isinstance(value, Mapping) and name == "exclusion":
        value = value.get("reason")
    if name == "title" and isinstance(value, str):
        return " ".join(unicodedata.normalize("NFKC", value).casefold().split())
    return value


def _render_f1(diff: Diff, key: str, old: float | None, new: float | None) -> None:
    if old is None and new is None:
        return
    fields = {"render_f1": [old, new]}
    if old is None:
        diff.items.append(Change("render_f1", "gained", key, fields))
        return
    move = None if new is None else round(new - old, F1_DIGITS)
    if move is None or -move > F1_LOST:
        diff.items.append(Change("render_f1", "lost", key, fields))
    elif abs(move) > F1_CHANGED:
        diff.items.append(Change("render_f1", "changed", key, fields))


def _token(ref: Any, joins: _Joins, old: bool) -> str:
    """A position in the new run's terms: an old run's mapped through the joins, or marked unjoined."""
    if ref is None:
        return "the set"
    if "page" in ref:
        position: tuple[Any, ...] = (ref["file"],)
        tail: tuple[Any, ...] = ("page", ref["page"])
    else:
        position = (ref["file"], ref["sheet"])
        inner = next(((k, ref[k]) for k in ("view", "register") if k in ref), None)
        if inner:
            position += inner
        tail = ()
    labels = joins.new_labels
    if old:
        mapped = joins.to_new.get(position)
        if mapped is None:
            return f"unjoined {_render(position + tail, joins.old_labels)}"
        position = mapped
    return _render(position + tail, labels)


def _render(position: tuple[Any, ...], labels: list[str]) -> str:
    head = labels[position[0]] if position[0] < len(labels) else f"file {position[0]}"
    rest = position[1:]
    if rest and rest[0] != "page":
        rest = ("sheet", *rest)
    return " ".join([head, *map(str, rest)])


def _plot(export: JSON, joins: _Joins, old: bool) -> dict[str, Any]:
    return {
        _token(m["page"], joins, old): _token(m.get("sheet"), joins, old) for m in _list(export, "plot")
    }


def _checks(export: JSON, joins: _Joins, old: bool) -> dict[str, Any]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for check in _list(export, "checks"):
        key = f"{check['code']} on {_token(check.get('subject'), joins, old)}"
        grouped[key].append(
            _canonical({"outcome": check.get("outcome"), "finding": check.get("finding")})
        )
    return {key: sorted(values) for key, values in grouped.items()}


def _groups(
    export: JSON, name: str, members: str, joins: _Joins, old: bool, value: str | None = "evidence"
) -> dict[str, Any]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for item in _list(export, name):
        joined = sorted(_token(ref, joins, old) for ref in _list(item, members))
        grouped[f"{item.get('kind', name)} of {' + '.join(joined)}"].append(
            _canonical(item.get(value)) if value else ""
        )
    return {key: sorted(values) for key, values in grouped.items()}


def _keyed(diff: Diff, measure: str, old: Mapping[str, Any], new: Mapping[str, Any]) -> None:
    for key in sorted(old.keys() | new.keys()):
        if key not in new:
            diff.items.append(Change(measure, "lost", key))
        elif key not in old:
            diff.items.append(Change(measure, "gained", key))
        elif old[key] != new[key]:
            diff.items.append(Change(measure, "changed", key, {"value": [old[key], new[key]]}))


def _prefixed(label: str, values: Mapping[str, Any]) -> dict[str, Any]:
    return {f"{label} {name}": value for name, value in values.items()}


def _report_counts(file: JSON) -> dict[str, Any]:
    found: dict[str, Any] = {}
    reports = (("font_report", "font"), ("pdf_report", "pdf"), ("bangla_ansi", "bangla_ansi"),
               ("sheet_report", "sheets"))  # fmt: skip
    for key, prefix in reports:
        found |= {f"{prefix} {name}": n for name, n in (file.get(key) or {}).items()}
    return found


def failures(export: JSON) -> Counter[tuple[str, str]]:
    """The stages that failed, as (stage, error kind) -> how many files; a set stage is named
    "set <stage>" and counts once."""
    found: Counter[tuple[str, str]] = Counter()
    for file in _list(export, "files"):
        found.update(_file_failures(file).items())
    stages = export.get("set_stages") or {}
    found.update((f"set {n}", error_kind(r.get("error"))) for n, r in stages.items() if _is_failed(r))
    return found


KIND = re.compile(r"^([A-Za-z_][A-Za-z0-9_.]*)(?::|$)")


def error_kind(error: str | None) -> str:
    """A failure's kind: the exception's class name, or a fixed word for the harness's own sentences;
    never the message, which may quote a drawing."""
    if not error:
        return "unknown"
    if error.startswith("it returned"):
        return "broke its contract"
    if error.startswith("the file's process ended"):
        return "process ended"
    named = KIND.match(error)
    return named[1] if named else "other"


PROCESS_KINDS = ("failed", "timed_out")


def _file_failures(file: JSON) -> dict[str, str]:
    """A file's failed stages, stage -> error kind, and its process as the stage "process" when it did
    not end ok (the owner's ruling, 28 Sep 2026: a process killed before its first stage, or between
    two, leaves its stages skipped, none failed, and counts): by its status, and "unknown" when the
    export does not say."""
    found = {
        n: error_kind(r.get("error")) for n, r in (file.get("stages") or {}).items() if _is_failed(r)
    }
    process = file.get("process")
    status = process.get("status") if isinstance(process, Mapping) else None
    if status != "ok":
        found["process"] = status if status in PROCESS_KINDS else "unknown"
    return found


def _failed_files(diff: Diff, label: str, old: JSON | None, new: JSON | None) -> None:
    """A file's failures in each run it is in (none in a run without it), compared as stages are."""
    before = _file_failures(old) if old is not None else {}
    after = _file_failures(new) if new is not None else {}
    _compare_failures(diff, label, before, after)


def _failed(
    diff: Diff, label: str, old: Mapping[str, Any] | None, new: Mapping[str, Any] | None
) -> None:
    """A stage failed now that did not fail before is lost; the reverse is gained; failing another
    way (another error kind) is changed."""
    before = {name: error_kind(r.get("error")) for name, r in (old or {}).items() if _is_failed(r)}
    after = {name: error_kind(r.get("error")) for name, r in (new or {}).items() if _is_failed(r)}
    _compare_failures(diff, label, before, after)


def _compare_failures(
    diff: Diff, label: str, before: Mapping[str, str], after: Mapping[str, str]
) -> None:
    for name in sorted(before.keys() | after.keys()):
        key = f"{label} {name}"
        if name not in before:
            diff.items.append(Change("failed_stages", "lost", key, {"kind": [None, after[name]]}))
        elif name not in after:
            diff.items.append(Change("failed_stages", "gained", key, {"kind": [before[name], None]}))
        elif before[name] != after[name]:
            diff.items.append(
                Change("failed_stages", "changed", key, {"kind": [before[name], after[name]]})
            )


def _is_failed(report: Any) -> bool:
    return isinstance(report, Mapping) and report.get("state") == "failed"


def _list(item: JSON, key: str) -> list[Any]:
    return list(item.get(key) or [])


def _location(sheet: JSON, key: str) -> Any:
    return (sheet.get("location") or {}).get(key)


def _process(file: JSON, key: str) -> Any:
    return (file.get("process") or {}).get(key)


def _label(file: JSON) -> str:
    return f"{file['sha256'][:12]} {file.get('path')}"


def _where(sheet: JSON) -> str:
    layout = _location(sheet, "layout")
    return f"layout {layout}" if layout is not None else f"frame {_location(sheet, 'box')}"


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False)
