"""The export: one JSON document per Drawing Set, written by the harness (06b) and diffed by the
real-drawing check (06a); M1's scorer extends it. Its schema is `export.schema.json`, beside this file.

`build(run, files, outcome)` turns what the harness read into the document and refuses one its schema
does not accept. The document holds drawing text (titles, numbers), so it never leaves the owner's
machine; only counts do (the M0 plan, "The real-drawing check").

The document, in brief (the schema has every field), in the shape the real-drawing check reads
(`scripts/real_drawings/diff.py`, 06a):
- `run`: its id, the commit and code hash it read with (06a passes them), when it started, how long;
- `stages`: the stage table, each stage's target, its ticket and whether it is built on this commit;
- `files`: per file, in path order, its sha256, name, format, Discipline default, group, the
  conventions applied (a hash of the conventions files), `read_seconds` and `peak_rss` (KiB) from its
  own child process (`os.wait4`'s rusage), the rest of its process, each stage's report, decoders
  agree, entity counts per type, the font, PDF and Bangla-ANSI counts (each left out when its stage
  did not produce it), a PDF's `plot_matches` (page, the sheet's id or the reason, the residual), and
  its sheets: each flat (its location as `layout` or `frame_box`, each value beside its `_source`,
  its render F1), with its views (each with its Coverage) and its register entries;
- `set_stages`, `conflicts`, `continuations` and `checks`: what was read across the set.

Candidates carry ids unique in the document: a sheet `f0.s1` (file 0, sheet 1), a view `f0.s1.v2`,
a register entry `f0.s1.r0`. Conflicts, continuations and Check results name them by id; a Check on
a Plot page names the PDF by its sha256, and a Check on the set names nothing.

`validate(document, schema)` checks a document against a schema in the subset of JSON Schema 2020-12
the export's schema uses (`KEYWORDS`); a schema using any other keyword is refused rather than half
checked. It is the engine's own, so the harness and the check need no further dependency.
"""

import dataclasses
import json
import math
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum, StrEnum
from functools import cache
from pathlib import Path
from typing import Any

from engine.read.anchor import DwgAnchor, PdfAnchor
from engine.recognise.types import (
    Box,
    CheckResult,
    Conflict,
    Continuation,
    PlotMatch,
    RegisterEntry,
    SheetCandidate,
    Sourced,
    ViewCandidate,
)

VERSION = 1
SCHEMA_PATH = Path(__file__).with_name("export.schema.json")

type JSON = bool | int | float | str | list[JSON] | dict[str, JSON] | None


class ExportError(ValueError):
    """The reading cannot be written as the export (a harness bug), or the document fails its schema."""


class StageState(StrEnum):
    OK = "ok"
    NOT_BUILT = "not_built"
    """Its function does not exist on this commit: reported, never faked."""
    FAILED = "failed"
    """It raised, returned what the contract does not allow, or its process ended during it."""
    SKIPPED = "skipped"
    """Built, but what it needs was not produced (`error` says what)."""


@dataclass
class StageReport:
    """One stage over one file (or the set): calls counts one per sheet for a per-sheet stage."""

    state: StageState
    calls: int = 0
    failed_calls: int = 0
    seconds: float = 0.0
    error: str | None = None
    """The first failure, why it is not built, or what a skipped stage needed."""

    def to_json(self) -> dict[str, JSON]:
        return {
            "state": str(self.state),
            "calls": self.calls,
            "failed_calls": self.failed_calls,
            "seconds": round(self.seconds, 6),
            "error": self.error,
        }

    @classmethod
    def from_json(cls, value: Mapping[str, Any]) -> StageReport:
        return cls(
            state=StageState(value["state"]),
            calls=value["calls"],
            failed_calls=value["failed_calls"],
            seconds=value["seconds"],
            error=value["error"],
        )


class ProcessStatus(StrEnum):
    OK = "ok"
    FAILED = "failed"
    """It exited with an error or was killed (by a signal, the out-of-memory killer among them)."""
    TIMED_OUT = "timed_out"


@dataclass(frozen=True)
class ProcessReport:
    """A file's own child process, measured by `os.wait4` (rusage includes the children it waited for,
    so `dwgread`'s memory counts)."""

    status: ProcessStatus
    exit_code: int | None
    signal: int | None
    seconds: float
    """Wall-clock seconds from its start to its end: the file's read seconds."""
    cpu_seconds: float
    peak_rss_kib: int
    left_behind: int = 0
    """Processes it left running (a grandchild it did not wait for), killed when it ended; their
    memory is not in `peak_rss_kib`."""
    left_running: bool = False
    """Whether some of them could not be stopped (they forked faster than they were killed)."""
    log_tail: str | None = None
    """The end of what it printed, when it did not end well."""

    def to_json(self) -> dict[str, JSON]:
        """All but its seconds and peak, which the file's entry carries as `read_seconds` and
        `peak_rss` (the names the check reads)."""
        return {
            "status": str(self.status),
            "exit_code": self.exit_code,
            "signal": self.signal,
            "cpu_seconds": round(self.cpu_seconds, 6),
            "left_behind": self.left_behind,
            "left_running": self.left_running,
            "log_tail": self.log_tail,
        }


@dataclass
class FileReading:
    """What the harness read from one file. `views[j]`, `buffers[j]` belong to `sheets[j]`."""

    path: str
    """The file's path inside the set, with `/` between folders."""
    sha256: str
    format: str
    discipline_default: str | None
    group: str
    conventions_applied: str | None
    process: ProcessReport
    stages: dict[str, StageReport]
    read_format: JSON = None
    decoders_agree: bool | None = None
    entity_counts: dict[str, int] | None = None
    font_report: dict[str, int] | None = None
    pdf_report: dict[str, int] | None = None
    bangla_ansi: dict[str, int] | None = None
    sheets: list[SheetCandidate] = field(default_factory=list)
    views: list[list[ViewCandidate]] = field(default_factory=list)
    register: list[RegisterEntry] = field(default_factory=list)
    page_count: int | None = None
    """How many pages `page_text` returned, for a PDF it read."""
    pages: list[object] = field(default_factory=list)
    """The PDF's pages as `page_text` returned them; kept only while the Plot stage is built."""
    buffers: list[object | None] = field(default_factory=list)
    """Each sheet's render buffers; kept only while the render F1 stage is built."""

    @property
    def name(self) -> str:
        return self.path.rsplit("/", 1)[-1]


@dataclass(frozen=True)
class RunInfo:
    id: str
    commit: str | None
    code_hash: str | None
    started_at: str
    seconds: float
    stages: Mapping[str, tuple[str, str, bool]]
    """Per stage: its target, its ticket and whether it is built."""


@dataclass
class SetOutcome:
    """What the set-level stages found: `render_f1` pairs a sheet with its score."""

    stages: dict[str, StageReport]
    plot: list[PlotMatch] = field(default_factory=list)
    render_f1: list[tuple[SheetCandidate, float]] = field(default_factory=list)
    conflicts: list[Conflict] = field(default_factory=list)
    continuations: list[Continuation] = field(default_factory=list)
    checks: list[CheckResult] = field(default_factory=list)


# Building the document ------------------------------------------------------------------------------


class References:
    """Where each candidate of a reading sits, by the object's identity: `of` gives its place
    (`{"file": i, "sheet": j, …}`), `id_of` its id in the document."""

    def __init__(self, files: Sequence[FileReading]) -> None:
        self._refs: dict[int, dict[str, int] | None] = {}
        self._held: list[object] = []
        self._sha = [reading.sha256 for reading in files]
        for i, reading in enumerate(files):
            for j, sheet in enumerate(reading.sheets):
                self._add(sheet, {"file": i, "sheet": j})
                for k, view in enumerate(reading.views[j] if j < len(reading.views) else ()):
                    self._add(view, {"file": i, "sheet": j, "view": k})
            on_sheet: dict[int, int] = {}
            for entry in reading.register:
                j = self._sheet_index(reading, entry.sheet)
                k = on_sheet[j] = on_sheet.get(j, -1) + 1
                self._add(entry, {"file": i, "sheet": j, "register": k})
            for n, page in enumerate(reading.pages, start=1):
                self._add(page, {"file": i, "page": n})

    @staticmethod
    def _sheet_index(reading: FileReading, sheet: SheetCandidate) -> int:
        for j, candidate in enumerate(reading.sheets):
            if candidate is sheet:
                return j
        raise ExportError(f"{reading.path}: a register entry is on a sheet the file did not produce")

    def _add(self, item: object, ref: dict[str, int]) -> None:
        # One object in two places (two blank pages as one interned string) cannot be referred to:
        # it is marked, and a stage naming it fails, while the rest of the run is written.
        self._refs[id(item)] = None if id(item) in self._refs else ref
        self._held.append(item)

    def of(self, item: object) -> dict[str, int]:
        if id(item) not in self._refs:
            raise ExportError(f"{type(item).__name__} is not a candidate this run produced")
        ref = self._refs[id(item)]
        if ref is None:
            raise ExportError(
                f"one {type(item).__name__} object stands in two places; it cannot be named"
            )
        return dict(ref)

    def id_of(self, item: object) -> str:
        """A sheet's, view's or register entry's id (`f0.s1`, `f0.s1.v2`, `f0.s1.r0`); a page is
        named by its PDF's sha256, which the check joins across runs."""
        ref = self.of(item)
        if "page" in ref:
            return self._sha[ref["file"]]
        return ".".join(f"{letter}{ref[name]}" for name, letter in _ID_PARTS if name in ref)


_ID_PARTS = (("file", "f"), ("sheet", "s"), ("view", "v"), ("register", "r"))


def build(run: RunInfo, files: Sequence[FileReading], outcome: SetOutcome) -> dict[str, JSON]:
    """The export's document for a run; `ExportError` when it would not meet its schema."""
    refs = References(files)
    f1 = {id(sheet): score for sheet, score in outcome.render_f1}
    plot: dict[int, list[JSON]] = {}
    for match in outcome.plot:
        plot.setdefault(refs.of(match.page)["file"], []).append(_plot(match, refs))
    document: dict[str, JSON] = {
        "version": VERSION,
        "run": {
            "id": run.id,
            "commit": run.commit,
            "code_hash": run.code_hash,
            "started_at": run.started_at,
            "seconds": round(run.seconds, 6),
        },
        "stages": {
            name: {"target": target, "ticket": ticket, "built": built}
            for name, (target, ticket, built) in run.stages.items()
        },
        "files": [_file(i, reading, refs, f1, plot.get(i, [])) for i, reading in enumerate(files)],
        "set_stages": {name: report.to_json() for name, report in outcome.stages.items()},
        "conflicts": [
            {
                "kind": conflict.kind,
                "candidates": [refs.id_of(c) for c in conflict.candidates],
                "evidence": dict(conflict.evidence),
            }
            for conflict in outcome.conflicts
        ],
        "continuations": [
            {"title": c.title, "sheets": [refs.id_of(s) for s in c.sheets]}
            for c in outcome.continuations
        ],
        "checks": [
            {
                "code": check.code,
                "outcome": str(check.outcome),
                "subject": _subject(check.subject, refs),
                "finding": None if check.finding is None else to_json(check.finding),
            }
            for check in outcome.checks
        ],
    }
    errors = validate(document, load_schema())
    if errors:
        raise ExportError("the export does not meet its schema:\n" + "\n".join(errors[:20]))
    return document


def _subject(subject: object, refs: References) -> JSON:
    """A Check's subject: a candidate's id, a Plot match's PDF (by its sha256), or none (the set)."""
    if subject is None:
        return None
    return refs.id_of(subject.page if isinstance(subject, PlotMatch) else subject)


def _file(
    index: int,
    reading: FileReading,
    refs: References,
    f1: Mapping[int, float],
    plot: list[JSON],
) -> dict[str, JSON]:
    found: dict[str, JSON] = {
        "path": reading.path,
        "name": reading.name,
        "sha256": reading.sha256,
        "format": reading.format,
        "read_format": reading.read_format,
        "discipline_default": reading.discipline_default,
        "group": reading.group,
        "conventions_applied": reading.conventions_applied,
        "read_seconds": round(reading.process.seconds, 6),
        "peak_rss": reading.process.peak_rss_kib,
        "process": reading.process.to_json(),
        "stages": {name: report.to_json() for name, report in reading.stages.items()},
        "decoders_agree": reading.decoders_agree,
        "pages": reading.page_count,
        "plot_matches": plot,
    }
    # A count a stage did not produce is left out, never written empty (the check reads a missing
    # key as a stage not built).
    for name in ("entity_counts", "font_report", "pdf_report", "bangla_ansi"):
        counts: Mapping[str, int] | None = getattr(reading, name)
        if counts is not None:
            found[name] = {key: counts[key] for key in sorted(counts)}
    found["sheets"] = [
        _sheet(sheet, reading.views[j] if j < len(reading.views) else [], reading.register, refs, f1)
        for j, sheet in enumerate(reading.sheets)
    ]
    return found


def _sourced(name: str, value: Sourced | None) -> dict[str, JSON]:
    return {
        name: None if value is None else value.value,
        f"{name}_source": None if value is None else str(value.source),
    }


def _box(box: Box | None) -> JSON:
    return None if box is None else list[JSON](box.to_json())


def _exclusion(candidate: SheetCandidate | ViewCandidate) -> dict[str, JSON]:
    e = candidate.exclusion
    return {
        "exclusion_reason": None if e is None else str(e.reason),
        "exclusion_text": None if e is None else e.text,
    }


def _sheet(
    sheet: SheetCandidate,
    views: Sequence[ViewCandidate],
    register: Sequence[RegisterEntry],
    refs: References,
    f1: Mapping[int, float],
) -> dict[str, JSON]:
    return {
        "id": refs.id_of(sheet),
        "layout": sheet.location.layout,
        "frame_box": _box(sheet.location.box),
        **_sourced("number", sheet.number),
        **_sourced("title", sheet.title),
        **_sourced("discipline", sheet.discipline),
        **_sourced("revision_mark", sheet.revision_mark),
        **_sourced("issue_date", sheet.issue_date),
        **_sourced("storeys_as_stated", sheet.storeys_as_stated),
        **_exclusion(sheet),
        "group": sheet.group,
        "anchors": [anchor_json(a) for a in sheet.anchors],
        "render_f1": f1.get(id(sheet)),
        "views": [_view(view, refs) for view in views],
        "register": [
            {
                "id": refs.id_of(entry),
                "row_box": _box(entry.row_box),
                "number": entry.number,
                "title": entry.title,
                "revision_mark": entry.revision_mark,
                "anchors": [anchor_json(a) for a in entry.anchors],
            }
            for entry in register
            if entry.sheet is sheet
        ],
    }


def coverage(view: ViewCandidate) -> str:
    """A view's Coverage at read, from its proposal (the M0 plan, "Coverage"); "used" is M1's."""
    if view.exclusion is not None:
        return "excluded"
    if view.steps or view.part is not None:
        return "assigned"
    return "unaccounted"


def _view(view: ViewCandidate, refs: References) -> dict[str, JSON]:
    return {
        "id": refs.id_of(view),
        "box": _box(view.box),
        "kind": str(view.kind),
        "title": view.title,
        "not_to_scale": view.not_to_scale,
        "stated_scale": view.stated_scale,
        "storeys_as_stated": view.storeys_as_stated,
        "storeys": list[JSON](view.storeys),
        "storeys_meaning": None if view.storeys_meaning is None else str(view.storeys_meaning),
        "subject": view.subject,
        "layer": None if view.layer is None else str(view.layer),
        "proposed_steps": list[JSON](view.steps),
        "part": view.part,
        **_exclusion(view),
        "coverage": coverage(view),
        "anchors": [anchor_json(a) for a in view.anchors],
    }


def _plot(match: PlotMatch, refs: References) -> dict[str, JSON]:
    t = match.transform
    return {
        "page": refs.of(match.page)["page"],
        "sheet": None if match.sheet is None else refs.id_of(match.sheet),
        "reason": match.reason,
        "residual": match.residual,
        "transform": None
        if t is None
        else {"scale": t.scale, "rotation": t.rotation, "offset": [t.offset[0], t.offset[1]]},
    }


def anchor_json(anchor: DwgAnchor | PdfAnchor) -> dict[str, JSON]:
    """An anchor as `{"kind": "dwg" | "pdf", "value": …}`, the value its own JSON (04's `to_json`)."""
    if not isinstance(anchor, DwgAnchor | PdfAnchor):
        raise TypeError(f"{type(anchor).__name__} is not an anchor")
    kind = "dwg" if isinstance(anchor, DwgAnchor) else "pdf"
    return {"kind": kind, "value": to_json(anchor)}


def to_json(value: object) -> JSON:
    """A stage's result as JSON: its own `to_json()`, else a dataclass's fields, a mapping, a sequence,
    an enum's value, or a plain value. Anything else (or a number that is not finite) is refused."""
    method = getattr(value, "to_json", None)
    if callable(method) and not isinstance(value, type):
        return to_json(method())
    if value is None or isinstance(value, bool | int | str):
        return value
    if isinstance(value, Enum):
        return to_json(value.value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise TypeError(f"{value} is not a finite number")
        return value
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: to_json(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, Mapping):
        if not all(isinstance(k, str) for k in value):
            raise TypeError("a mapping's keys are strings")
        return {k: to_json(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [to_json(v) for v in value]
    raise TypeError(f"{type(value).__name__} has no JSON form")


# Validation -----------------------------------------------------------------------------------------

KEYWORDS = frozenset(
    {
        "$schema", "$id", "$defs", "$ref", "$comment", "title", "description",
        "type", "properties", "required", "additionalProperties", "propertyNames", "items",
        "enum", "const", "minimum", "maximum", "exclusiveMinimum", "pattern", "minLength",
        "minItems", "maxItems", "oneOf", "anyOf",
    }
)  # fmt: skip
"""The JSON Schema keywords `validate` checks; a schema with any other is refused."""

_TYPES: dict[str, tuple[type, ...]] = {
    "object": (dict,),
    "array": (list,),
    "string": (str,),
    "integer": (int,),
    "number": (int, float),
    "boolean": (bool,),
    "null": (type(None),),
}


class SchemaError(ValueError):
    """The schema uses what `validate` does not check."""


@cache
def load_schema() -> dict[str, Any]:
    schema: dict[str, Any] = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    check_schema(schema)
    return schema


def check_schema(schema: Any, where: str = "#") -> None:
    """Refuse a schema that uses a keyword `validate` does not check, anywhere in it."""
    if isinstance(schema, bool):
        return
    if not isinstance(schema, dict):
        raise SchemaError(f"{where}: a schema is an object or a boolean")
    unknown = set(schema) - KEYWORDS
    if unknown:
        raise SchemaError(f"{where}: `validate` does not check {sorted(unknown)}")
    for name in ("$defs", "properties"):
        for key, sub in schema.get(name, {}).items():
            check_schema(sub, f"{where}/{name}/{key}")
    for name in ("items", "additionalProperties", "propertyNames"):
        if name in schema:
            check_schema(schema[name], f"{where}/{name}")
    for name in ("oneOf", "anyOf"):
        for index, sub in enumerate(schema.get(name, [])):
            check_schema(sub, f"{where}/{name}/{index}")


def validate(document: Any, schema: Mapping[str, Any]) -> list[str]:
    """Every place the document breaks the schema, as `$.path: what`; empty when it meets it."""
    check_schema(schema)
    errors: list[str] = []
    _check(document, schema, schema, "$", errors)
    return errors


def _is_type(value: Any, name: str) -> bool:
    if isinstance(value, bool) and name not in ("boolean",):
        return False
    return isinstance(value, _TYPES[name])


def _same(a: Any, b: Any) -> bool:
    return (type(a) is type(b) and a == b) or (
        _is_type(a, "number") and _is_type(b, "number") and a == b
    )


def _check(value: Any, schema: Any, root: Mapping[str, Any], path: str, errors: list[str]) -> None:
    if schema is True:
        return
    if schema is False:
        errors.append(f"{path}: nothing is allowed here")
        return
    if "$ref" in schema:
        _check(value, _resolve(schema["$ref"], root), root, path, errors)
    if "type" in schema:
        names = [schema["type"]] if isinstance(schema["type"], str) else schema["type"]
        if not any(_is_type(value, name) for name in names):
            errors.append(f"{path}: {json.dumps(value)[:60]} is not {' or '.join(names)}")
            return
    if "const" in schema and not _same(value, schema["const"]):
        errors.append(f"{path}: is not {json.dumps(schema['const'])}")
    if "enum" in schema and not any(_same(value, option) for option in schema["enum"]):
        errors.append(f"{path}: {json.dumps(value)[:60]} is not one of {json.dumps(schema['enum'])}")
    if _is_type(value, "number"):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} is below {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} is above {schema['maximum']}")
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            errors.append(f"{path}: {value} is not above {schema['exclusiveMinimum']}")
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: is shorter than {schema['minLength']}")
        if "pattern" in schema and not _pattern(schema["pattern"]).search(value):
            errors.append(f"{path}: {value[:60]!r} does not match {schema['pattern']}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: has fewer than {schema['minItems']} items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: has more than {schema['maxItems']} items")
        if "items" in schema:
            for index, item in enumerate(value):
                _check(item, schema["items"], root, f"{path}[{index}]", errors)
    if isinstance(value, dict):
        properties = schema.get("properties", {})
        for name in schema.get("required", []):
            if name not in value:
                errors.append(f"{path}: lacks {name!r}")
        for name, item in value.items():
            if "propertyNames" in schema:
                _check(name, schema["propertyNames"], root, f"{path} key {name!r}", errors)
            if name in properties:
                _check(item, properties[name], root, f"{path}.{name}", errors)
            elif "additionalProperties" in schema:
                _check(item, schema["additionalProperties"], root, f"{path}.{name}", errors)
    for name, needed in (("oneOf", 1), ("anyOf", None)):
        if name not in schema:
            continue
        passing = sum(1 for sub in schema[name] if not _errors(value, sub, root, path))
        if (needed is None and passing == 0) or (needed is not None and passing != needed):
            errors.append(f"{path}: matches {passing} of its {name} alternatives")


@cache
def _pattern(pattern: str) -> re.Pattern[str]:
    """A schema's pattern (ECMA-262, as JSON Schema has it) as Python's: `$` only at the very end,
    never before a final line break, and `\\d` and `\\w` in ASCII only (the schema has no `\\s`)."""
    out: list[str] = []
    i, in_class = 0, False
    while i < len(pattern):
        char = pattern[i]
        if char == "\\":
            out.append(pattern[i : i + 2])
            i += 2
            continue
        if char == "[":
            in_class = True
        elif char == "]":
            in_class = False
        out.append(r"\Z" if char == "$" and not in_class else char)
        i += 1
    return re.compile("".join(out), re.ASCII)


def _errors(value: Any, schema: Any, root: Mapping[str, Any], path: str) -> list[str]:
    found: list[str] = []
    _check(value, schema, root, path, found)
    return found


def _resolve(ref: str, root: Mapping[str, Any]) -> Any:
    if not ref.startswith("#/$defs/") or ref.count("/") != 2:
        raise SchemaError(f"`validate` follows only `#/$defs/<name>` references, not {ref!r}")
    try:
        return root["$defs"][ref.removeprefix("#/$defs/")]
    except KeyError:
        raise SchemaError(f"{ref} names no definition") from None
