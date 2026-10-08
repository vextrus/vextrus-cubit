"""S15-E4's synthetic files and how their views are read, for the identity tests.

Every file is the repo's own: the engine's DWG fixtures (`engine/fixtures/dwg/*.py`) and the sets the
acceptance tests of 17 and 162 draw, each written to DWG by the repo's writer in the test's temporary
folder. No real drawing; they prove mechanics only.

`read_views` reads each file's sheets (13's finder, its default conventions, as a Structural file) and
then, for each Discipline of `DISCIPLINES` in turn, every sheet's views with that Discipline, in the
sheets' order, all on the one artefact: the calls a file's read makes, so one file's budget is spent
across all of them. `golden.json` is what main's single module gave for them (commit bd5378fe5,
before the split), in the form `plain` writes: every field of every view, and the sheet's paper and
limits, floats to 6 places (a micrometre of paper).
"""

import json
import warnings
from collections.abc import Callable, Collection, Mapping
from dataclasses import fields, is_dataclass, replace
from enum import Enum
from functools import partial
from importlib import import_module
from pathlib import Path
from types import ModuleType
from typing import Any

from ezdxf.document import Drawing

from engine.fixtures import dwg
from engine.read import read
from engine.read.artefact import ReadArtefact
from engine.recognise import sheets
from engine.recognise.tests.acceptance.t17 import drawing as t17
from engine.recognise.tests.acceptance.t162 import drawing as t162
from engine.recognise.types import SheetCandidate, Sourced, ValueSource, ViewConventions

GOLDEN = Path(__file__).with_name("golden.json")

ENGINE_FIXTURES = (
    "sheet_layout",
    "sheet_set_layouts",
    "sheet_set_model",
    "title_block",
    "entity_kinds",
    "text_kinds",
    "mirrored_insert",
    "duplicate_layer",
    "mtext_angle",
)
"""The engine's DWG fixtures read here: those the reader reads (`second_reader_fails` is a reader
fault, the others draw nothing a sheet holds)."""

GENERAL = "general"
DISCIPLINES = ("structural", "architectural", "plumbing", GENERAL)
"""Each a routing branch of the proposal: Structural and Architectural Steps, an MEP Part, and a
notes Discipline (`ViewConventions.notes_disciplines`)."""


def views_package() -> ModuleType:
    return import_module("engine.recognise.views")


def conventions() -> ViewConventions:
    held: ViewConventions = views_package().default_conventions()
    return replace(held, notes_disciplines=(GENERAL,))


def build_files(folder: Path, names: Collection[str] | None = None) -> dict[str, Path]:
    """The files named (every file by default), written by the repo's writer into `folder`, by
    name."""
    build = folder / "build"
    build.mkdir()
    writer = dwg.build_writer(build)
    built = {}
    for name in ENGINE_FIXTURES:
        if names is None or name in names:
            with warnings.catch_warnings():
                # ezdxf's own dimension arrows set an array's shape, deprecated by NumPy 2.5: the
                # drawing is the same, and the warning is ezdxf's, not the engine's.
                warnings.filterwarnings("ignore", category=DeprecationWarning, module=r"ezdxf\.")
                built[name] = dwg.build(name, build, writer)
    drawn: list[tuple[str, Callable[[], Drawing], str]] = [
        ("t17-S-layouts", t17.draw_layouts, t17.VERSION),
        ("t17-S-model", t17.draw_model, t17.VERSION),
        *((f"t162-{p}", partial(t162.draw, p), t162.VERSION) for p in t162.PHANTOMS),
    ]
    for name, draw, version in drawn:
        if names is not None and name not in names:
            continue
        dxf = build / f"{name}.dxf"
        draw().saveas(dxf)
        target = build / f"{name}.dwg"
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(target), version], 120)
        built[name] = target
    return built


THIS_FILE = "<this file>"
"""An anchor's `source_sha256` when it is the file's own: the writer's bytes differ build to build."""


def plain(value: object, sha256: str = "") -> object:
    """A view, a box or an anchor as JSON: each dataclass by its type's name and fields; the file's
    own hash (`sha256`) as `THIS_FILE`."""
    if sha256 and value == sha256:
        return THIS_FILE
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value) and not isinstance(value, type):
        return {
            "type": type(value).__name__,
            **{f.name: plain(getattr(value, f.name), sha256) for f in fields(value)},
        }
    if isinstance(value, Mapping):
        return {str(k): plain(v, sha256) for k, v in value.items()}
    if isinstance(value, (list, tuple, frozenset, set)):
        items = [plain(v, sha256) for v in value]
        return sorted(items, key=json.dumps) if isinstance(value, (frozenset, set)) else items
    if isinstance(value, float):
        return round(value, 6)
    return value


def file_sheets(artefact: ReadArtefact) -> list[SheetCandidate]:
    return list(sheets.find(artefact, "structural", sheets.default_conventions()))


Find = Callable[[ReadArtefact, SheetCandidate, ViewConventions], Any]


def read_file(artefact: ReadArtefact, find: Find) -> list[dict[str, object]]:
    """One file's readings, each Discipline's turn in order, through `find`."""
    held = conventions()
    sha256 = artefact.summary.source_sha256
    found_sheets = file_sheets(artefact)
    readings: list[dict[str, object]] = []
    for discipline in DISCIPLINES:
        for position, sheet in enumerate(found_sheets):
            given = replace(sheet, discipline=Sourced(discipline, ValueSource.FILE))
            found = find(artefact, given, held)
            readings.append(
                {
                    "discipline": discipline,
                    "sheet": position,
                    "number": sheet.number.value if sheet.number is not None else None,
                    "paper": plain(found.paper),
                    "limits": plain(found.limits),
                    "views": plain(list(found), sha256),
                }
            )
    return readings


def read_views(files: Mapping[str, Path], *, explicit_budget: bool) -> dict[str, object]:
    """Every file's readings by name: with one `ViewBudget` of the file passed to each call
    (`explicit_budget`), else as main's module read them (no budget given)."""
    package = views_package()
    result: dict[str, object] = {}
    for name, path in files.items():
        artefact = read(path)
        if explicit_budget:
            result[name] = read_file(
                artefact, partial(package.find, budget=package.ViewBudget(artefact))
            )
        else:
            result[name] = read_file(artefact, package.find)
    return result


def golden() -> dict[str, list[dict[str, Any]]]:
    data: dict[str, list[dict[str, Any]]] = json.loads(GOLDEN.read_text(encoding="utf-8"))
    return data
