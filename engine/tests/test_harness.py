"""The engine harness, its export and the recognisers' types (ticket 06b).

The stages are fakes, written per test into a package under pytest's temporary folder and named in
a stage table that mirrors the real one, so nothing waits for the tickets that build the real stages.
Each run still spawns a real child process per file. Synthetic files prove mechanics only.
"""

import io
import json
import os
import signal
import stat
import subprocess
import sys
import textwrap
import token
import tokenize
import uuid
from collections.abc import Callable
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from engine import export, harness
from engine.export import ExportError, SchemaError, check_schema, load_schema, validate
from engine.harness import STAGES, ConventionsError, Stage
from engine.recognise.types import (
    Box,
    CheckOutcome,
    CheckResult,
    Conflict,
    Continuation,
    Exclusion,
    ExclusionReason,
    PlotMatch,
    PlotTransform,
    SetReading,
    SheetCandidate,
    SheetConventions,
    SheetLocation,
    Sourced,
    StoreysMeaning,
    ValueSource,
    ViewCandidate,
    ViewConventions,
    ViewKind,
)

MiB = 1 << 20

# The fake stages ------------------------------------------------------------------------------------

FAKES = {
    "read.py": """
        import os, signal, subprocess, sys, time
        from pathlib import Path

        class Artefact:
            def __init__(self, path):
                self.path = path
                self.summary = {"format": "AC1032", "entity_counts": {"LINE": 3, "TEXT": 2}}

        def read(path):
            held = []
            for line in path.read_text().splitlines():
                word, _, arg = line.partition(" ")
                if word == "alloc":
                    held.append(bytearray(b"\\x01") * (int(arg) << 20))
                elif word == "grandchild":
                    code = f"b = bytearray(b'\\\\x01') * ({int(arg)} << 20)"
                    subprocess.run([sys.executable, "-c", code], check=True)
                elif word == "pid":
                    (Path(arg) / str(os.getpid())).write_text("")
                elif word == "kill":
                    os.kill(os.getpid(), signal.SIGKILL)
                elif word == "sleep":
                    time.sleep(float(arg))
                elif word == "raise":
                    raise RuntimeError("the fake reader failed")
                elif word == "nosummary":
                    return object()
                elif word == "forkchain":
                    # A process that forks and exits for a while: its pid never stays still.
                    chain = (
                        "import os, time\\n"
                        "end = time.monotonic() + 3\\n"
                        "while time.monotonic() < end:\\n"
                        "    if os.fork():\\n"
                        "        os._exit(0)\\n"
                    )
                    for _ in range(int(arg)):
                        subprocess.Popen([sys.executable, "-c", chain], start_new_session=True)
                elif word == "orphan":
                    stray = subprocess.Popen(
                        [sys.executable, "-c", "import time; time.sleep(600)"], start_new_session=True
                    )
                    Path(arg).write_text(str(stray.pid))
            return Artefact(path)
    """,
    "decoders.py": """
        def run(path, artefact):
            return {"agree": True, "handles": 5}
    """,
    "fonts.py": """
        def report(artefact):
            return {"counts": {"fonts": 3, "substituted": 1}, "fonts": ["a", "b", "c"]}
    """,
    "bangla.py": """
        def run(artefact):
            return {"texts": 0, "fonts": 0}
    """,
    "sheets.py": """
        from engine.recognise.types import SheetCandidate, SheetConventions, SheetLocation, Sourced

        def find(artefact, discipline, conventions):
            assert isinstance(conventions, SheetConventions)
            if "badsheets" in artefact.path.read_text():
                return "not a list"
            return [
                SheetCandidate(
                    location=SheetLocation(layout=f"Layout{n}"),
                    number=Sourced(f"S-10{n}", "title_block_text"),
                    title=Sourced("Column layout", "title_block_attribute"),
                    discipline=None if discipline is None else Sourced(discipline, "file"),
                    revision_mark=Sourced("R0", "file_name"),
                )
                for n in (1, 2)
            ]
    """,
    "register.py": """
        from engine.recognise.types import Box, RegisterEntry

        def find(artefact, sheets):
            return [RegisterEntry(sheet=sheets[0], row_box=Box(0, 0, 10, 1), number="S-101", title="x")]
    """,
    "views.py": """
        from engine.recognise.types import (
            Box, Exclusion, ViewCandidate, ViewConventions, ViewKind,
        )

        def find(artefact, sheet, conventions):
            assert isinstance(conventions, ViewConventions)
            return [
                ViewCandidate(
                    box=Box(0, 0, 100, 80), kind=ViewKind.PLAN, title="Ground floor column layout",
                    storeys=("ground",), storeys_meaning="at_floor_level", steps=("columns",),
                ),
                ViewCandidate(
                    box=Box(100, 0, 120, 20), kind=ViewKind.TITLE_BLOCK,
                    exclusion=Exclusion("for_information"),
                ),
                ViewCandidate(box=Box(0, 80, 40, 100), kind=ViewKind.NOTES),
            ]
    """,
    "buffers.py": """
        class Odd(Exception):
            def __init__(self, a, b):
                super().__init__(a)

        def build(artefact, sheet):
            if "odd" in artefact.path.read_text():
                return Odd(1, 2)  # pickles, and cannot be unpickled
            return {"layout": sheet.location.layout}
    """,
    "raster.py": """
        def rasterise(buffers, px_per_mm):
            assert px_per_mm > 0
            return b""
    """,
    "pdf.py": """
        def report(path):
            return {"counts": {"pages": 2, "shx_comments": 0}}

        def page_text(path):
            return [{"page": 1}, {"page": 2}]
    """,
    "plot.py": """
        from engine.recognise.types import PlotMatch, PlotTransform

        def match(pages, sheets):
            if not pages:
                return []
            return [
                PlotMatch(page=pages[0], sheet=sheets[0], residual=0.4,
                          transform=PlotTransform(scale=0.01, rotation=90, offset=(3.0, 4.0))),
                PlotMatch(page=pages[1], reason="no_sheet_matched"),
            ]
    """,
    "f1.py": """
        def score(buffers, page, transform):
            assert buffers == {"layout": "Layout1"}
            return 0.9
    """,
    "conflicts.py": """
        from engine.recognise.types import Conflict, Continuation

        def find(sheets, views):
            assert len(views) == len(sheets)
            found = [Continuation(title="Column schedule", sheets=(sheets[0], sheets[1]))]
            if len(sheets) > 2:
                found.append(Conflict(kind="same_number", candidates=(sheets[0], sheets[2]),
                                      evidence={"files": 2}))
            return found
    """,
    "checks.py": """
        from engine.recognise.types import CheckResult, SetReading

        def run_all(reading):
            assert isinstance(reading, SetReading)
            assert reading.read == {"views", "register", "plot", "conflicts"}, reading.read
            results = [
                CheckResult("coverage", "fired", subject=reading.views[0][2],
                            finding={"code": "engine.coverage.unaccounted", "params": {"views": 1}}),
                CheckResult("register", "passed", subject=reading.register[0]),
                CheckResult("numbering", "passed"),
            ]
            if reading.plot:
                results.append(CheckResult("plot_pages", "passed", subject=reading.plot[0]))
            return results
    """,
}

TARGETS = {
    "read": "read:read",
    "decoders_agree": "decoders:run",
    "font_report": "fonts:report",
    "bangla_ansi": "bangla:run",
    "sheets": "sheets:find",
    "register": "register:find",
    "views": "views:find",
    "render_buffers": "buffers:build",
    "rasterise": "raster:rasterise",
    "pdf_report": "pdf:report",
    "page_text": "pdf:page_text",
    "plot": "plot:match",
    "render_f1": "f1:score",
    "conflicts": "conflicts:find",
    "checks": "checks:run_all",
}

SHEET_CONVENTIONS = {
    "disciplines": [
        {"key": "structural", "prefixes": ["S"]},
        {"key": "architectural", "prefixes": ["A"]},
    ],
    "number_patterns": [r"^[A-Z]-\d{3}$"],
}


@pytest.fixture
def fakes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Callable[..., tuple[Stage, ...]]:
    """A stage table over fresh fake modules: `fakes(sheets="...")` replaces one module's source."""

    def make(**sources: str) -> tuple[Stage, ...]:
        package = f"fakes_{uuid.uuid4().hex}"
        folder = tmp_path / "code" / package
        folder.mkdir(parents=True)
        (folder / "__init__.py").write_text("")
        for name, source in FAKES.items():
            text = sources.get(name.removesuffix(".py"), source)
            (folder / name).write_text(textwrap.dedent(text))
        monkeypatch.syspath_prepend(str(tmp_path / "code"))
        return tuple(replace(s, target=f"{package}.{TARGETS[s.name]}") for s in STAGES)

    return make


def write_set(root: Path, files: dict[str, str]) -> Path:
    for relative, text in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return root


@pytest.fixture
def conventions(tmp_path: Path) -> Path:
    folder = tmp_path / "conventions"
    folder.mkdir()
    (folder / "sheet-default.json").write_text(json.dumps(SHEET_CONVENTIONS))
    (folder / "view-default.json").write_text(json.dumps({"kind_words": {"plan": ["plan", "layout"]}}))
    return folder


def run(
    tmp_path: Path, stages: tuple[Stage, ...], files: dict[str, str], **options: Any
) -> dict[str, Any]:
    set_dir = write_set(tmp_path / "set", files)
    return harness.run(set_dir, tmp_path / "out" / "export.json", stages=stages, **options)


def by_path(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {f["path"]: f for f in document["files"]}


def states(reading: dict[str, Any]) -> dict[str, str]:
    return {name: report["state"] for name, report in reading["stages"].items()}


# The stage table ------------------------------------------------------------------------------------


def test_the_stage_table_is_the_contracts() -> None:
    assert [(s.name, s.target, s.ticket) for s in STAGES] == [
        ("read", "engine.read:read", "04"),
        ("decoders_agree", "engine.check.decoders_agree:run", "10"),
        ("font_report", "engine.render.fonts:report", "11"),
        ("bangla_ansi", "engine.check.bangla_ansi:run", "11"),
        ("sheets", "engine.recognise.sheets:find", "13"),
        ("register", "engine.recognise.register:find", "13"),
        ("views", "engine.recognise.views:find", "17"),
        ("render_buffers", "engine.render.buffers:build", "11"),
        ("rasterise", "engine.render.raster:rasterise", "11"),
        ("pdf_report", "engine.read.pdf:report", "12"),
        ("page_text", "engine.read.pdf:page_text", "12"),
        ("plot", "engine.plot.registration:match", "18"),
        ("render_f1", "engine.check.render_f1:score", "18"),
        ("conflicts", "engine.recognise.conflicts:find", "19b"),
        ("checks", "engine.check.catalogue:run_all", "19b"),
    ]
    assert load_schema()["$defs"]["stage_name"]["enum"] == [s.name for s in STAGES]


def test_a_missing_module_or_function_is_not_built_and_a_broken_import_is_raised(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    folder = tmp_path / "resolvable"
    folder.mkdir()
    (folder / "__init__.py").write_text("")
    (folder / "present.py").write_text("def run():\n    return 1\n")
    (folder / "broken.py").write_text("import resolvable.absent_helper\n\ndef run():\n    return 1\n")
    monkeypatch.syspath_prepend(str(tmp_path))

    assert harness.resolve("resolvable.present:run")[0] is not None
    assert harness.resolve("resolvable.absent:run") == (None, "resolvable.absent does not exist")
    assert harness.resolve("resolvable.present:find") == (None, "resolvable.present:find does not exist")
    assert harness.resolve("resolvable.present:json")[0] is None
    with pytest.raises(ModuleNotFoundError):
        harness.resolve("resolvable.broken:run")


# A run over fake stages -----------------------------------------------------------------------------


def test_a_set_read_by_every_stage_is_written_to_the_export(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(
        tmp_path,
        fakes(),
        {
            "structural/S-101.dwg": "",
            "A-201.dwg": "",
            "plot.pdf": "",
            "notes.txt": "",
            ".hidden.dwg": "",
        },
        conventions=conventions,
        run_id="run-1",
        commit="a" * 40,
        code_hash="c0de",
    )

    assert validate(document, load_schema()) == []
    files = by_path(document)
    assert list(files) == ["A-201.dwg", "plot.pdf", "structural/S-101.dwg"]
    assert document["run"]["id"] == "run-1"
    assert document["run"]["commit"] == "a" * 40
    assert all(entry["built"] for entry in document["stages"].values())
    for reading in files.values():
        assert set(states(reading).values()) == {"ok"}, reading["stages"]
        assert reading["process"]["status"] == "ok"
        assert reading["group"] == "set"
        assert len(reading["conventions_applied"]) == 64
    assert {r["state"] for r in document["set_stages"].values()} == {"ok"}

    structural, pdf, architectural = (
        files["structural/S-101.dwg"],
        files["plot.pdf"],
        files["A-201.dwg"],
    )
    assert structural["discipline_default"] == "structural"
    assert architectural["discipline_default"] == "architectural"
    assert pdf["discipline_default"] is None
    assert structural["decoders_agree"] is True
    assert structural["entity_counts"] == {"LINE": 3, "TEXT": 2}
    assert structural["read_format"] == "AC1032"
    assert structural["font_report"] == {"fonts": 3, "substituted": 1}
    assert structural["bangla_ansi"] == {"fonts": 0, "texts": 0}
    assert pdf["pdf_report"] == {"pages": 2, "shx_comments": 0}
    assert pdf["pages"] == 2
    assert structural["stages"]["views"]["calls"] == 2

    sheet = architectural["sheets"][0]
    assert sheet["group"] == "set"
    assert sheet["number"] == {"value": "S-101", "source": "title_block_text"}
    assert sheet["discipline"] == {"value": "architectural", "source": "file"}
    assert sheet["location"] == {"layout": "Layout1", "box": None}
    assert [v["coverage"] for v in sheet["views"]] == ["assigned", "excluded", "unaccounted"]
    assert sheet["views"][0]["storeys"] == ["ground"]
    assert sheet["views"][1]["exclusion"] == {"reason": "for_information", "text": None}
    assert sheet["register"] == [
        {"row_box": [0, 0, 10, 1], "number": "S-101", "title": "x", "revision_mark": None, "anchors": []}
    ]
    assert architectural["sheets"][1]["register"] == []
    assert sheet["render_f1"] == 0.9
    assert architectural["sheets"][1]["render_f1"] is None

    assert document["plot"] == [
        {
            "page": {"file": 1, "page": 1},
            "sheet": {"file": 0, "sheet": 0},
            "reason": None,
            "residual": 0.4,
            "transform": {"scale": 0.01, "rotation": 90, "offset": [3.0, 4.0]},
        },
        {"page": {"file": 1, "page": 2}, "sheet": None, "reason": "no_sheet_matched", "residual": None,
         "transform": None},
    ]  # fmt: skip
    assert document["conflicts"] == [
        {
            "kind": "same_number",
            "candidates": [{"file": 0, "sheet": 0}, {"file": 2, "sheet": 0}],
            "evidence": {"files": 2},
        }
    ]
    assert document["continuations"] == [
        {"title": "Column schedule", "sheets": [{"file": 0, "sheet": 0}, {"file": 0, "sheet": 1}]}
    ]
    assert [(c["code"], c["outcome"], c["subject"]) for c in document["checks"]] == [
        ("coverage", "fired", {"file": 0, "sheet": 0, "view": 2}),
        ("register", "passed", {"file": 0, "sheet": 0, "register": 0}),
        ("numbering", "passed", None),
        ("plot_pages", "passed", {"file": 1, "page": 1}),
    ]
    assert document["checks"][0]["finding"] == {
        "code": "engine.coverage.unaccounted",
        "params": {"views": 1},
    }

    written = tmp_path / "out" / "export.json"
    assert json.loads(written.read_text()) == document
    assert stat.S_IMODE(written.stat().st_mode) == 0o600
    assert [p.name for p in written.parent.iterdir()] == ["export.json"]


def test_stages_not_built_are_reported_so_and_nothing_is_faked(
    tmp_path: Path, conventions: Path
) -> None:
    absent = tuple(replace(s, target=f"absent_{uuid.uuid4().hex}.{s.name}:run") for s in STAGES)

    document = run(tmp_path, absent, {"a.dwg": "x", "b.pdf": "y"}, conventions=conventions)

    assert validate(document, load_schema()) == []
    assert not any(entry["built"] for entry in document["stages"].values())
    files = by_path(document)
    assert set(states(files["a.dwg"]).values()) == {"not_built"}
    assert list(files["a.dwg"]["stages"]) == list(harness.FILE_STAGES["dwg"])
    assert list(files["b.pdf"]["stages"]) == list(harness.FILE_STAGES["pdf"])
    assert {r["state"] for r in document["set_stages"].values()} == {"not_built"}
    assert files["a.dwg"]["entity_counts"] is None
    assert files["a.dwg"]["sheets"] == []
    assert files["a.dwg"]["sha256"] == "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881"
    assert files["a.dwg"]["process"]["status"] == "ok"


def test_a_stage_that_raises_fails_and_what_needs_it_is_skipped(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(tmp_path, fakes(), {"bad.dwg": "raise", "good.dwg": ""}, conventions=conventions)

    bad, good = by_path(document)["bad.dwg"], by_path(document)["good.dwg"]
    assert bad["stages"]["read"]["state"] == "failed"
    assert bad["stages"]["read"]["error"] == "RuntimeError: the fake reader failed"
    assert bad["stages"]["read"]["failed_calls"] == 1
    assert {n: s for n, s in states(bad).items() if n != "read"} == dict.fromkeys(
        harness.FILE_STAGES["dwg"][1:], "skipped"
    )
    assert bad["stages"]["sheets"]["error"] == "needs read"
    assert bad["process"]["status"] == "ok"
    assert set(states(good).values()) == {"ok"}


def test_a_result_the_contract_does_not_allow_fails_its_stage(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(
        tmp_path, fakes(), {"a.dwg": "badsheets", "b.dwg": "nosummary"}, conventions=conventions
    )

    a, b = by_path(document)["a.dwg"], by_path(document)["b.dwg"]
    assert a["stages"]["sheets"]["state"] == "failed"
    assert "not a list of SheetCandidate" in a["stages"]["sheets"]["error"]
    assert a["stages"]["views"] == {
        "state": "skipped", "calls": 0, "failed_calls": 0, "seconds": 0.0, "error": "needs sheets"
    }  # fmt: skip
    assert b["stages"]["read"]["state"] == "failed"
    assert "entity_counts" in b["stages"]["read"]["error"]


def test_a_stage_whose_own_import_fails_is_failed_not_unbuilt(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    stages = fakes(sheets="import a_module_nobody_wrote\n\ndef find(artefact, d, c):\n    return []\n")

    document = run(tmp_path, stages, {"a.dwg": ""}, conventions=conventions)

    report = by_path(document)["a.dwg"]["stages"]["sheets"]
    assert report["state"] == "failed"
    assert "a_module_nobody_wrote" in report["error"]
    assert document["stages"]["sheets"]["built"] is True


def test_a_set_stage_naming_a_candidate_the_run_did_not_produce_fails(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    stages = fakes(
        checks="""
from engine.recognise.types import CheckResult, SheetCandidate, SheetLocation

def run_all(reading):
    stranger = SheetCandidate(location=SheetLocation(layout="Layout1"))
    return [CheckResult("coverage", "passed", subject=stranger)]
"""
    )

    document = run(tmp_path, stages, {"a.dwg": ""}, conventions=conventions)

    assert document["set_stages"]["checks"]["state"] == "failed"
    assert "not a candidate this run produced" in document["set_stages"]["checks"]["error"]
    assert document["checks"] == []


# Each file in its own child process -----------------------------------------------------------------


def test_each_file_is_read_in_its_own_child_process(
    tmp_path: Path,
    fakes: Callable[..., tuple[Stage, ...]],
    conventions: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pids = tmp_path / "pids"
    pids.mkdir()

    def no_fork() -> int:
        raise AssertionError("the harness forked")

    monkeypatch.setattr(os, "fork", no_fork)
    run(tmp_path, fakes(), {f"{n}.dwg": f"pid {pids}" for n in "abc"}, conventions=conventions)

    seen = {int(p.name) for p in pids.iterdir()}
    assert len(seen) == 3
    assert os.getpid() not in seen


def test_peak_memory_is_each_files_own(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(
        tmp_path,
        fakes(),
        {"1-big.dwg": "alloc 256", "2-small.dwg": "", "3-grandchild.dwg": "grandchild 256"},
        conventions=conventions,
    )

    files = by_path(document)
    big, small, grandchild = (
        files[n]["process"] for n in ("1-big.dwg", "2-small.dwg", "3-grandchild.dwg")
    )
    assert big["peak_rss_kib"] >= 256 * 1024
    # ru_maxrss only rises within one process: the small file after the big one is measured alone.
    assert small["peak_rss_kib"] < 128 * 1024
    # The rusage wait4 gives covers the children the file's process waited for (dwgread's, later).
    assert grandchild["peak_rss_kib"] >= 256 * 1024
    assert big["cpu_seconds"] > 0
    assert big["seconds"] >= big["cpu_seconds"] * 0.5


def test_a_child_that_dies_is_reported_as_far_as_it_got(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(tmp_path, fakes(), {"a.dwg": "kill", "b.dwg": ""}, conventions=conventions)

    assert validate(document, load_schema()) == []
    dead, alive = by_path(document)["a.dwg"], by_path(document)["b.dwg"]
    assert dead["process"]["status"] == "failed"
    assert dead["process"]["signal"] == signal.SIGKILL
    assert dead["process"]["exit_code"] is None
    assert dead["stages"]["read"]["state"] == "failed"
    assert dead["stages"]["read"]["error"] == "the file's process ended during this stage (signal 9)"
    assert states(dead)["sheets"] == "skipped"
    assert list(dead["stages"]) == list(harness.FILE_STAGES["dwg"])
    assert set(states(alive).values()) == {"ok"}


def test_a_child_past_the_timeout_is_killed(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(
        tmp_path, fakes(), {"a.dwg": "sleep 60", "b.dwg": ""}, conventions=conventions, file_timeout=2
    )

    slow = by_path(document)["a.dwg"]
    assert slow["process"]["status"] == "timed_out"
    assert slow["process"]["seconds"] < 30
    assert slow["stages"]["read"]["error"] == (
        "the file's process ended during this stage (it ran past the file timeout)"
    )
    assert by_path(document)["b.dwg"]["process"]["status"] == "ok"


# The file's Discipline and the conventions ----------------------------------------------------------


@pytest.mark.parametrize(
    ("relative", "expected"),
    [
        ("structural/S-101.dwg", "structural"),
        ("S101.dwg", "structural"),
        ("s-101 column layout.dwg", "structural"),
        ("A-201.dwg", "architectural"),
        ("Structural/A-201.dwg", None),  # two Disciplines named: none
        ("STR-101.dwg", None),  # "STR" is not a prefix the conventions carry
        ("plot.pdf", None),
    ],
)
def test_a_files_discipline_default_comes_from_its_path_and_the_conventions(
    relative: str, expected: str | None
) -> None:
    conventions = SheetConventions.from_json(SHEET_CONVENTIONS)

    assert harness.file_discipline(relative, conventions) == expected
    assert harness.file_discipline(relative, None) is None


def test_conventions_are_hashed_and_a_folder_overrides_the_defaults_file_by_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    defaults = tmp_path / "defaults"
    defaults.mkdir()
    (defaults / "view-default.json").write_text("{}")
    monkeypatch.setattr(harness, "DEFAULT_CONVENTIONS", defaults)
    override = tmp_path / "override"
    override.mkdir()

    only_defaults = harness.load_conventions(override)
    (override / "sheet-default.json").write_text(json.dumps(SHEET_CONVENTIONS))
    with_sheet = harness.load_conventions(override)

    assert only_defaults.view == defaults / "view-default.json"
    assert only_defaults.sheet is None
    assert with_sheet.sheet == override / "sheet-default.json"
    assert with_sheet.sheet_conventions is not None
    assert with_sheet.sheet_conventions.discipline_keys() == ("structural", "architectural")
    assert only_defaults.applied != with_sheet.applied
    (defaults / "view-default.json").unlink()
    (override / "sheet-default.json").unlink()
    assert harness.load_conventions(override).applied is None


def test_conventions_that_are_not_valid_stop_the_run(tmp_path: Path) -> None:
    folder = tmp_path / "bad"
    folder.mkdir()
    (folder / "sheet-default.json").write_text(json.dumps({"disciplines": [], "sheet_count": 57}))

    with pytest.raises(ConventionsError, match="sheet_count"):
        harness.load_conventions(folder)


def test_stages_needing_conventions_are_skipped_without_them(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], monkeypatch: pytest.MonkeyPatch
) -> None:
    empty = tmp_path / "none"
    empty.mkdir()
    monkeypatch.setattr(harness, "DEFAULT_CONVENTIONS", empty)

    document = run(tmp_path, fakes(), {"a.dwg": ""})

    reading = by_path(document)["a.dwg"]
    assert reading["conventions_applied"] is None
    assert reading["discipline_default"] is None
    assert reading["stages"]["sheets"]["state"] == "skipped"
    assert reading["stages"]["sheets"]["error"] == "needs sheet conventions"
    assert reading["stages"]["read"]["state"] == "ok"


# The command ----------------------------------------------------------------------------------------


def test_the_command_writes_a_valid_export_and_prints_counts_only(tmp_path: Path) -> None:
    set_dir = write_set(tmp_path / "set", {"Tower Block S-101 Column Layout.dwg": "not a drawing"})
    out = tmp_path / "out.json"

    done = subprocess.run(
        [sys.executable, "-m", "engine.harness", "--set", str(set_dir), "--out", str(out),
         "--file-timeout", "120"],
        capture_output=True, text=True, check=False, timeout=300, cwd=harness.ROOT,
    )  # fmt: skip

    assert done.returncode == 0, done.stderr
    document = json.loads(out.read_text())
    assert validate(document, load_schema()) == []
    assert [f["name"] for f in document["files"]] == ["Tower Block S-101 Column Layout.dwg"]
    assert "Tower" not in done.stdout
    assert "S-101" not in done.stdout
    assert done.stdout.startswith("1 files: ")


def test_the_command_refuses_a_set_that_is_not_a_folder(tmp_path: Path) -> None:
    with pytest.raises(SystemExit) as refused:
        harness.main(["--set", str(tmp_path / "absent"), "--out", str(tmp_path / "o.json")])
    assert refused.value.code == 2


# The export and its schema --------------------------------------------------------------------------


def test_the_schema_uses_only_what_validate_checks() -> None:
    check_schema(load_schema())
    with pytest.raises(SchemaError, match="if"):
        check_schema({"type": "object", "properties": {"a": {"if": {}}}})
    with pytest.raises(SchemaError, match="references"):
        validate(1, {"$ref": "other.json#/x"})


@pytest.mark.parametrize(
    ("value", "schema", "error"),
    [
        (
            {"a": 1, "b": 2},
            {"type": "object", "additionalProperties": False, "properties": {"a": {}}},
            "$.b",
        ),
        ({}, {"type": "object", "required": ["a"]}, "lacks 'a'"),
        (True, {"type": "integer"}, "is not integer"),
        (1, {"enum": [True, None]}, "is not one of"),
        ([1, 2, 3], {"type": "array", "maxItems": 2}, "more than 2"),
        ("x", {"type": "string", "pattern": "^[0-9]+$"}, "does not match"),
        (-1, {"type": "integer", "minimum": 0}, "below 0"),
        ({"file": 0}, {"oneOf": [{"required": ["file"]}, {"type": "object"}]}, "matches 2 of"),
        ({"k": "v"}, {"type": "object", "propertyNames": {"pattern": "^[0-9]+$"}}, "key 'k'"),
    ],
)
def test_validate_finds_what_breaks_a_schema(value: object, schema: dict[str, Any], error: str) -> None:
    errors = validate(value, schema)

    assert len(errors) >= 1
    assert error in errors[0]


def test_a_document_off_its_schema_is_refused(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(tmp_path, fakes(), {"a.dwg": ""}, conventions=conventions)
    schema = load_schema()

    extra = json.loads(json.dumps(document))
    extra["files"][0]["sheets"][0]["colour"] = "red"
    missing = json.loads(json.dumps(document))
    del missing["files"][0]["sha256"]
    wrong = json.loads(json.dumps(document))
    wrong["files"][0]["sheets"][0]["views"][0]["kind"] = "viewport"

    assert any("colour" in e for e in validate(extra, schema))
    assert any("lacks 'sha256'" in e for e in validate(missing, schema))
    assert any("viewport" in e for e in validate(wrong, schema))


def test_one_object_standing_for_two_candidates_is_refused() -> None:
    sheet = SheetCandidate(location=SheetLocation(layout="Layout1"), group="set")
    reading = export.FileReading(
        path="a.dwg",
        sha256="0" * 64,
        format="dwg",
        discipline_default=None,
        group="set",
        conventions_applied=None,
        process=export.ProcessReport(export.ProcessStatus.OK, 0, None, 1.0, 1.0, 1),
        stages={},
        sheets=[sheet, sheet],
        views=[[], []],
    )

    refs = export.References([reading])

    with pytest.raises(ExportError, match="two places"):
        refs.of(sheet)


def test_to_json_takes_dataclasses_mappings_enums_and_refuses_the_rest() -> None:
    assert export.to_json({"kind": ViewKind.PLAN, "box": Box(0, 0, 1, 2), "n": (1, 2.5)}) == {
        "kind": "plan",
        "box": [0.0, 0.0, 1.0, 2.0],
        "n": [1, 2.5],
    }
    assert export.to_json(Exclusion(ExclusionReason.OTHER, "a note")) == {
        "reason": "other",
        "text": "a note",
    }
    with pytest.raises(TypeError):
        export.to_json({"x": object()})
    with pytest.raises(TypeError):
        export.to_json(float("nan"))


# The recognisers' types -----------------------------------------------------------------------------


def test_the_lists_m0_fixes() -> None:
    assert [str(k) for k in ViewKind] == [
        "plan", "section", "elevation", "schedule", "detail", "notes", "legend", "title_block",
        "key_plan", "perspective",
    ]  # fmt: skip
    assert [str(r) for r in ExclusionReason] == [
        "superseded", "duplicate", "cover_index", "for_information", "by_others", "blank", "other",
    ]  # fmt: skip
    schema = load_schema()["$defs"]
    assert schema["view"]["properties"]["kind"]["enum"] == [str(k) for k in ViewKind]
    exclusion = schema["exclusion"]["anyOf"][1]["properties"]["reason"]["enum"]
    assert exclusion == [str(r) for r in ExclusionReason]
    assert schema["sourced"]["anyOf"][1]["properties"]["source"]["enum"] == [str(s) for s in ValueSource]


BANGLADESH_DISCIPLINES = {"structural", "architectural", "electrical", "plumbing", "fire"}
BANGLADESH_DISCIPLINES |= {"mechanical", "lift", "gas"}


@pytest.mark.parametrize(
    "module", ["recognise/types.py", "harness.py", "export.py", "export.schema.json"]
)
def test_the_engine_holds_no_list_of_disciplines(module: str) -> None:
    source = (Path(harness.__file__).parent / module).read_text()
    if module.endswith(".py"):
        pieces = [
            t.string.strip("\"'").casefold()
            for t in tokenize.generate_tokens(io.StringIO(source).readline)
            if t.type in (token.NAME, token.STRING)
            and not (t.type == token.STRING and t.string.startswith('"""'))
        ]
    else:
        pieces = [p.casefold() for p in json.dumps(json.loads(source)).replace('"', " ").split()]

    assert not [word for word in pieces if word.strip(",:") in BANGLADESH_DISCIPLINES]


def test_a_view_proposal_is_steps_and_a_part_or_an_exclusion() -> None:
    box = Box(0, 0, 1, 1)
    both = ViewCandidate(box=box, kind=ViewKind.DETAIL, steps=("finishes",), part="plumbing_part")

    assert export.coverage(both) == "assigned"
    with pytest.raises(ValueError, match="excluded"):
        ViewCandidate(
            box=box, kind=ViewKind.PLAN, steps=("slabs",), exclusion=Exclusion(ExclusionReason.BLANK)
        )
    with pytest.raises(ValueError, match="storey"):
        ViewCandidate(box=box, kind=ViewKind.PLAN, storeys=("ground",))
    with pytest.raises(ValueError, match="storey"):
        ViewCandidate(box=box, kind=ViewKind.PLAN, storeys_meaning=StoreysMeaning.FLOOR_TO_FLOOR)
    with pytest.raises(ValueError, match="viewport"):
        ViewCandidate(box=box, kind="viewport")  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("make", "match"),
    [
        (lambda: Exclusion(ExclusionReason.OTHER), "text exactly"),
        (lambda: Exclusion(ExclusionReason.BLANK, "why"), "text exactly"),
        (lambda: Box(1, 0, 0, 1), "past its opposite"),
        (lambda: Box(0, 0, float("inf"), 1), "finite"),
        (lambda: SheetLocation(), "exactly one"),
        (lambda: SheetLocation(layout="Layout1", box=Box(0, 0, 1, 1)), "exactly one"),
        (lambda: Sourced("  ", ValueSource.FILE), "empty"),
        (lambda: Conflict("same number", candidates=()), "lower-case key"),
        (lambda: Continuation("Column schedule", sheets=()), "two sheets"),
        (lambda: PlotTransform(scale=1.0, rotation=45, offset=(0, 0)), "90° steps"),
        (lambda: PlotMatch(page={}, sheet=None), "exactly one"),
        (lambda: PlotMatch(page={}, reason="no_sheet_matched", residual=1.0), "no residual"),
        (lambda: CheckResult("coverage", CheckOutcome.FIRED), "finding"),
        (
            lambda: CheckResult("coverage", CheckOutcome.PASSED, finding={"code": "a.b", "params": {}}),
            "finding",
        ),
        (lambda: SetReading(sheets=(SheetCandidate(location=SheetLocation(layout="L")),)), "per sheet"),
    ],
)
def test_a_value_the_contracts_do_not_allow_is_refused(make: Callable[[], object], match: str) -> None:
    with pytest.raises(ValueError, match=match):
        make()


def test_conventions_round_trip_through_json_and_refuse_what_they_do_not_hold() -> None:
    sheet: dict[str, Any] = {
        "disciplines": [{"key": "structural", "prefixes": ["S", "ST"]}],
        "number_patterns": [r"^\w-\d+$"],
        "title_block_fields": [
            {"field": "number", "words": ["drawing no"], "position": [0.5, 0, 1, 0.2]}
        ],
        "revision_mark_pattern": r"^R\d+$",
        "storey_words": [{"storey": "plinth", "words": ["tie beam", "grade beam", "plinth beam"]}],
        "frame_hints": ["frame", "border"],
    }
    view: dict[str, Any] = {
        "kind_words": {"plan": ["plan", "layout"], "section": ["section"]},
        "subject_words": {"beams": ["beam"]},
        "layer_words": {"top": ["top"], "bottom": ["bottom"]},
        "scale_patterns": [r"1\s*:\s*(\d+)"],
    }

    assert SheetConventions.from_json(sheet).to_json() == sheet
    assert ViewConventions.from_json(view).to_json() == view
    bad_sheets: list[tuple[dict[str, Any], str]] = [
        ({**sheet, "sheets_expected": 57}, "no field"),
        ({**sheet, "number_patterns": ["(unclosed"]}, "not a regular expression"),
        ({**sheet, "disciplines": [{"key": "structural"}, {"key": "structural"}]}, "given twice"),
        ({**sheet, "disciplines": [{"key": "Structural"}]}, "lower-case key"),
        ({**sheet, "title_block_fields": [{"field": "number", "position": [0, 0, 2, 1]}]}, "0 to 1"),
    ]
    for bad, match in bad_sheets:
        with pytest.raises(ValueError, match=match):
            SheetConventions.from_json(bad)
    bad_views: list[tuple[dict[str, Any], str]] = [
        ({**view, "kind_words": {"viewport": ["vp"]}}, "viewport"),
        ({**view, "layer_words": {"middle": []}}, "middle"),
    ]
    for bad, match in bad_views:
        with pytest.raises(ValueError, match=match):
            ViewConventions.from_json(bad)


# What the refuters found (review before the PR) -----------------------------------------------------


def test_a_files_peak_is_not_the_harnesss_own(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    # Linux copies the starter's high-water mark into a child's ru_maxrss at exec: a harness that
    # has grown must not lend its peak to the files it starts.
    grown = bytearray(b"\x01") * (400 * MiB)
    del grown

    document = run(tmp_path, fakes(), {"a.dwg": "", "b.pdf": ""}, conventions=conventions)

    for reading in document["files"]:
        assert reading["process"]["peak_rss_kib"] < 128 * 1024, reading["path"]


def test_what_a_file_leaves_running_is_killed_and_counted(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    stray = tmp_path / "stray.pid"

    document = run(tmp_path, fakes(), {"a.dwg": f"orphan {stray}"}, conventions=conventions)

    pid = int(stray.read_text())
    with pytest.raises(ProcessLookupError):
        os.kill(pid, 0)
    assert by_path(document)["a.dwg"]["process"]["left_behind"] >= 1
    assert by_path(document)["a.dwg"]["process"]["status"] == "ok"


def test_results_that_never_reach_the_harness_fail_their_stages_not_the_run(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(tmp_path, fakes(), {"a.dwg": "odd", "b.dwg": ""}, conventions=conventions)

    assert validate(document, load_schema()) == []
    lost, fine = by_path(document)["a.dwg"], by_path(document)["b.dwg"]
    assert lost["process"]["status"] == "failed"
    assert set(states(lost).values()) == {"failed"}
    assert "its results were lost" in lost["stages"]["sheets"]["error"]
    assert "could not be read" in lost["stages"]["sheets"]["error"]
    assert set(states(fine).values()) == {"ok"}
    assert document["set_stages"]["checks"] == {
        "state": "skipped",
        "calls": 0,
        "failed_calls": 0,
        "seconds": 0.0,
        "error": "needs sheets (not read in 1 of the files)",
    }


def test_a_set_stage_never_runs_on_part_of_the_set(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(tmp_path, fakes(), {"a.dwg": "badsheets", "b.dwg": ""}, conventions=conventions)

    assert {n: r["state"] for n, r in document["set_stages"].items()} == dict.fromkeys(
        harness.SET_STAGES, "skipped"
    )
    assert document["checks"] == []
    assert document["conflicts"] == []


def test_one_object_in_two_places_fails_the_stage_naming_it_and_the_run_is_written(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    blank_pages = "def report(path):\n    return {}\n\ndef page_text(path):\n    return ['', '']\n"

    document = run(tmp_path, fakes(pdf=blank_pages), {"a.dwg": "", "b.pdf": ""}, conventions=conventions)

    assert document["set_stages"]["plot"]["state"] == "failed"
    assert "two places" in document["set_stages"]["plot"]["error"]
    assert by_path(document)["b.pdf"]["pages"] == 2
    assert validate(document, load_schema()) == []


@pytest.mark.parametrize(
    ("value", "pattern"),
    [
        ("a" * 40 + "\n", "^[0-9a-f]{40}$"),
        ("structural\n", "^[a-z][a-z0-9_]*$"),
        ("\u09e8\u09e6\u09e8\u09ec", "^\\d{4}$"),  # Bengali digits: JSON Schema's \\d is ASCII
    ],
)
def test_patterns_are_read_as_json_schema_reads_them(value: str, pattern: str) -> None:
    assert validate(value, {"type": "string", "pattern": pattern}) != []
    assert validate(value.strip(), {"type": "string", "pattern": pattern}) == [] or "\\d" in pattern
    assert validate("$", {"type": "string", "pattern": "^[$]$"}) == []  # a `$` in a class is itself


def test_a_stage_missing_under_a_package_that_fails_to_import_is_not_built(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    folder = tmp_path / "brokenpkg"
    folder.mkdir()
    (folder / "__init__.py").write_text("import a_dependency_nobody_installed\n")
    (folder / "present.py").write_text("def run():\n    return 1\n")
    monkeypatch.syspath_prepend(str(tmp_path))

    assert harness.resolve("brokenpkg.pdf:report") == (None, "brokenpkg.pdf does not exist")
    with pytest.raises(ModuleNotFoundError):
        harness.resolve("brokenpkg.present:run")


@pytest.mark.parametrize(
    "options",
    [
        {"commit": "a" * 40 + "\n"},
        {"commit": "HEAD"},
        {"code_hash": "two words"},
        {"run_id": ""},
        {"file_timeout": float("inf")},
        {"file_timeout": float("nan")},
        {"file_timeout": 0},
    ],
)
def test_a_run_asked_for_what_it_cannot_do_stops_before_reading(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    with pytest.raises(harness.UsageError):
        harness.run(tmp_path, tmp_path / "out.json", **options)
    assert not (tmp_path / "out.json").exists()


def test_the_command_says_why_it_will_not_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = harness.main(
        ["--set", str(tmp_path), "--out", str(tmp_path / "o.json"), "--file-timeout", "inf"]
    )

    assert code == 2
    assert "file timeout" in capsys.readouterr().err


@pytest.mark.parametrize(
    ("make", "error"),
    [
        (lambda: ViewCandidate(box=Box(0, 0, 1, 1), kind=ViewKind.PLAN, subject="slab\n"), ValueError),
        (
            lambda: ViewCandidate(
                box=Box(0, 0, 1, 1), kind=ViewKind.PLAN, storeys=("ground\n",),
                storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL,
            ),
            ValueError,
        ),
        (lambda: ViewCandidate(box=(0, 0, 1, 1), kind=ViewKind.PLAN), TypeError),  # type: ignore[arg-type]
        (lambda: SheetCandidate(location=SheetLocation(layout="L"), number="S-101"), TypeError),  # type: ignore[arg-type]
        (lambda: SheetCandidate(location=SheetLocation(layout="L"), anchors=("here",)), TypeError),  # type: ignore[arg-type]
        (
            lambda: SheetCandidate(
                location=SheetLocation(layout="L"), discipline=Sourced("Structural", ValueSource.FILE)
            ),
            ValueError,
        ),
        (lambda: PlotTransform(scale=1.0, rotation=0, offset=(1.0, 2.0, 3.0)), ValueError),  # type: ignore[arg-type]
        (lambda: Conflict("same_number", candidates=("a", "b")), TypeError),  # type: ignore[arg-type]
        (
            lambda: CheckResult(
                "c", CheckOutcome.FIRED, finding={"code": "not a code", "params": {}}
            ),
            ValueError,
        ),
    ],
)  # fmt: skip
def test_a_candidate_of_the_wrong_shape_fails_where_it_is_made(
    make: Callable[[], object], error: type[Exception]
) -> None:
    with pytest.raises(error):
        make()


def test_a_fork_chain_a_file_leaves_is_stopped_and_never_charged_to_the_next_file(
    tmp_path: Path, fakes: Callable[..., tuple[Stage, ...]], conventions: Path
) -> None:
    document = run(tmp_path, fakes(), {"a.dwg": "forkchain 4", "b.dwg": ""}, conventions=conventions)

    first, second = (by_path(document)[name]["process"] for name in ("a.dwg", "b.dwg"))
    assert first["left_behind"] >= 1
    assert second["left_behind"] == 0
    assert second["left_running"] is False


def test_the_runs_identity_comes_from_the_environment_the_check_sets(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 06a's sandbox passes the run's identity as environment variables (scripts/real_drawings).
    set_dir = write_set(tmp_path / "set", {"a.dwg": "a"})
    monkeypatch.setenv("VEXTRUS_RUN_ID", "run-from-env")
    monkeypatch.setenv("VEXTRUS_COMMIT", "c" * 40)
    monkeypatch.setenv("VEXTRUS_CODE_HASH", "d" * 64)

    assert harness.main(["--set", str(set_dir), "--out", str(tmp_path / "env.json")]) == 0
    assert (
        harness.main(
            ["--set", str(set_dir), "--out", str(tmp_path / "flag.json"), "--run-id", "run-from-flag"]
        )
        == 0
    )

    from_env = json.loads((tmp_path / "env.json").read_text())["run"]
    assert (from_env["id"], from_env["commit"], from_env["code_hash"]) == (
        "run-from-env",
        "c" * 40,
        "d" * 64,
    )
    from_flag = json.loads((tmp_path / "flag.json").read_text())["run"]
    assert (from_flag["id"], from_flag["commit"]) == ("run-from-flag", "c" * 40)
