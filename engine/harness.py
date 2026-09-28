"""The engine harness: runs the pipeline's stages over one Drawing Set and writes the export.

    python -m engine.harness --set <dir> --out <file> [--conventions <dir>]
        [--run-id <id>] [--commit <sha>] [--code-hash <hash>] [--file-timeout <seconds>]

The real-drawing check (06a) runs it inside its sandbox on both Development Sets until 21c, and passes
the run id, commit and code hash it computed as `VEXTRUS_RUN_ID`, `VEXTRUS_COMMIT` and
`VEXTRUS_CODE_HASH`, each the default of its flag; a run with neither gets a new id and none of the
others.
It prints counts only; the export (`engine/export.py`, its schema beside it) holds drawing text.

**The stage table** (`STAGES`; the M0 plan, "The contracts fixed here") names each stage's function and
the ticket that builds it. A stage whose module or function does not exist on this commit is reported
`not_built`, never faked; one that is built but lacks its input is `skipped`; one that raises, or returns
what the contract does not allow, is `failed`, and the stages that need it are skipped. Per file:

- DWG: `read(path)`, then with the artefact `decoders_agree.run(path, artefact)`,
  `fonts.report(artefact)`, `bangla_ansi.run(artefact)`, `sheets.find(artefact, file_discipline,
  sheet_conventions)` (each sheet then stamped with the file's group), `register.find(artefact,
  sheets)`, and per sheet `views.find(artefact, sheet, view_conventions)`, `buffers.build(artefact,
  sheet)` and `raster.rasterise(buffers, PX_PER_MM)`;
- PDF: `pdf.report(path)` and `pdf.page_text(path)` (a list of pages).

Then across the set: `registration.match(pages, sheets)`, `render_f1.score(buffers, page, transform)`
per matched page, `conflicts.find(sheets, views)` (Conflicts and Continuations; `views[i]` are
`sheets[i]`'s) and `catalogue.run_all(reading)` (a `SetReading`; Check results). **A set stage never
runs on part of the set**: it is skipped unless each stage it needs (sheets for all; pages for the Plot;
the Plot and the render buffers for F1) was read in every file. Conflicts and Checks need only the
sheets; the reading's `read` names what else was read everywhere, so a Check can tell "not read" from
"none found", and `conflicts.find` gets each sheet's views as read (none where views were not read).

**What the harness reads from a result** it does not type itself, through its JSON form
(`engine.export.to_json`): the artefact's `summary`, its `format` and its `entity_counts` (names to
counts); a report's `counts` (names to counts), or the report itself when it is only that (the font
report, the PDF report, the Bangla-ANSI Check); decoders agree as a boolean, an `agree` field, or a
Check result's `outcome` (`passed` agrees).

**Each file is read in its own child process** (the M0 plan's review A7), started with
`os.posix_spawn` (nothing relies on fork: Python 3.14 starts pools with forkserver) in its own process
group, and reaped with `os.wait4`, whose rusage gives the file's CPU seconds and peak RSS. Linux's
rusage for a reaped child covers the children it waited for, so a reader's `dwgread` counts. Linux
also copies the starter's memory high-water mark into a child's `ru_maxrss` at exec, so the children
are started by a small launcher process (`_Launcher`), begun while the harness holds nothing: each
file's peak is its own, never the harness's or an earlier file's. The launcher is the children's
subreaper: what a file's child leaves running is killed when it ends and counted (`left_behind`; its
memory is not in the peak). A child that runs past `--file-timeout` is killed with its group. A child
that dies leaves its stages as far as it got: the stage it was in is `failed`, the rest `skipped`, and
stages whose results never reached the harness `failed`. Nothing one file does stops the run.

**A file's process gets only the environment it needs** (`CHILD_ENV`): it reads hostile input, so it
does not inherit a key (`TYPESAFE_API_KEY`), a database address or any other variable of the caller's.
It gets `PATH`, `HOME`, `TMPDIR` and `LANG` where the caller has them; `PYTHONPATH`, the checkout
first (the launcher's own environment has it already, so a file's may name it twice, which is
harmless); the two variables its stages read, `VEXTRUS_LIBREDWG` (where the pinned LibreDWG is) and
`VEXTRUS_SANDBOX` (so the reader refuses by name, as it would anywhere); and BLAS pinned to one thread
(`ONE_THREAD`; the owner's ruling, 28 Sep 2026): numpy, which ezdxf imports, would otherwise start a
spinning OpenBLAS thread per core, seconds of CPU per file on many cores before any reading (#66).
The run's identity (`VEXTRUS_RUN_ID` and the others) is read by the harness before any file is, and
never reaches one.

The allow-list is defence in depth, not the boundary: it stops a file's process from inheriting
secrets through its environment, nothing more. The boundary against hostile input is bubblewrap: the
real-drawing check's sandbox around the whole harness, and the reader's own sandbox around `dwgread`.
Run directly from a developer's shell, a file's process runs as that user in the same PID namespace
and can read whatever the user can: another process's `/proc/<pid>/environ` (the harness's, holding
the caller's whole environment), `~/.bashrc`, `~/.pgpass`. So real drawings are read through the
check, never by running the harness directly from a shell that holds secrets.

**The file's Discipline default** comes from its path and the conventions' Disciplines (the engine
holds no list of them): a Discipline whose key is a word of the path (a folder named for it), or one of
whose prefixes, with or without digits after it, is the file name's first word. One match gives the
default; none or several give none. **Its group** is `GROUP`: M0 has one Building, so one group.

**Conventions** are `sheet-default.json` and `view-default.json`, taken from `--conventions <dir>` where
it has them, else from `engine/recognise/conventions/`; `conventions_applied` is the hash of the
files read. A conventions file that is not valid stops the run before any file is read.
"""

import argparse
import contextlib
import ctypes
import hashlib
import importlib
import json
import math
import os
import pickle
import re
import select
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType
from typing import Any

from engine.export import (
    JSON,
    ExportError,
    FileReading,
    ProcessReport,
    ProcessStatus,
    References,
    RunInfo,
    SetOutcome,
    StageReport,
    StageState,
    build,
    to_json,
)
from engine.recognise.types import (
    CheckResult,
    Conflict,
    Continuation,
    PlotMatch,
    RegisterEntry,
    SetReading,
    SheetCandidate,
    SheetConventions,
    ViewCandidate,
    ViewConventions,
)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONVENTIONS = Path(__file__).resolve().parent / "recognise" / "conventions"
SHEET_CONVENTIONS = "sheet-default.json"
VIEW_CONVENTIONS = "view-default.json"
FORMATS = {".dwg": "dwg", ".pdf": "pdf"}
GROUP = "set"
"""Every file's group in M0: one Building per Drawing Set."""
PX_PER_MM = 4.0
"""The density the harness rasterises each sheet at, to run the stage; F1 is scored by 18's stage."""
FILE_TIMEOUT = 3600.0
LOG_TAIL = 4000
CLEAR_SECONDS = 10.0
"""How long the launcher tries to stop what a file's process left running before it gives up."""
_HANDOVER = "(handing over)"


@dataclass(frozen=True)
class Stage:
    name: str
    target: str
    """`module:function`."""
    ticket: str


STAGES = (
    Stage("read", "engine.read:read", "04"),
    Stage("decoders_agree", "engine.check.decoders_agree:run", "10"),
    Stage("font_report", "engine.render.fonts:report", "11"),
    Stage("bangla_ansi", "engine.check.bangla_ansi:run", "11"),
    Stage("sheets", "engine.recognise.sheets:find", "13"),
    Stage("register", "engine.recognise.register:find", "13"),
    Stage("views", "engine.recognise.views:find", "17"),
    Stage("render_buffers", "engine.render.buffers:build", "11"),
    Stage("rasterise", "engine.render.raster:rasterise", "11"),
    Stage("pdf_report", "engine.read.pdf:report", "12"),
    Stage("page_text", "engine.read.pdf:page_text", "12"),
    Stage("plot", "engine.plot.registration:match", "18"),
    Stage("render_f1", "engine.check.render_f1:score", "18"),
    Stage("conflicts", "engine.recognise.conflicts:find", "19b"),
    Stage("checks", "engine.check.catalogue:run_all", "19b"),
)
"""The stage table, in the order a file's stages run."""

FILE_STAGES = {
    "dwg": (
        "read", "decoders_agree", "font_report", "bangla_ansi", "sheets", "register", "views",
        "render_buffers", "rasterise",
    ),
    "pdf": ("pdf_report", "page_text"),
}  # fmt: skip
SET_STAGES = ("plot", "render_f1", "conflicts", "checks")


class UsageError(ValueError):
    """The run was asked for what it cannot do; it stops before reading any file."""


class ConventionsError(UsageError):
    """A conventions file is not valid."""


def _module_exists(module_name: str) -> bool:
    """Whether the module's file is on the path, without importing it or its packages."""
    parts = module_name.split(".")
    for entry in sys.path:
        base = Path(entry or ".", *parts)
        if base.with_suffix(".py").is_file() or (base / "__init__.py").is_file():
            return True
    return False


def resolve(target: str) -> tuple[Callable[..., Any] | None, str | None]:
    """A stage's function, or none and why it is not built. Any other import failure is raised,
    unless the stage's own module does not exist (its package failing to import is its package's)."""
    module_name, _, name = target.partition(":")
    try:
        module = importlib.import_module(module_name)
    except Exception as error:
        missing = getattr(error, "name", None) or ""
        named = isinstance(error, ModuleNotFoundError) and missing
        if (named and (module_name == missing or module_name.startswith(missing + "."))) or (
            not _module_exists(module_name)
        ):
            return None, f"{module_name} does not exist"
        raise
    function = getattr(module, name, None)
    if not callable(function) or isinstance(function, ModuleType | type):
        return None, f"{target} does not exist"
    return function, None


def _is_built(target: str) -> bool:
    try:
        return resolve(target)[0] is not None
    except Exception:
        return True  # it exists, and fails to import: its runs will say how


def _describe(error: BaseException) -> str:
    text = str(error)
    return f"{type(error).__name__}: {text}" if text else type(error).__name__


# One file, in its child process ---------------------------------------------------------------------


class _Stages:
    """The reports of one process's stages, saved to a progress file as they change."""

    def __init__(self, targets: Mapping[str, str], progress: Path | None) -> None:
        self.targets = targets
        self.progress = progress
        self.reports: dict[str, StageReport] = {}

    def open(self, name: str, missing: str | None = None) -> Callable[..., Any] | None:
        """The stage's function when it can run; else its report says why not."""
        try:
            function, why = resolve(self.targets[name])
        except Exception as error:
            self.reports[name] = StageReport(StageState.FAILED, error=_describe(error))
            function, why = None, None
        if function is None:
            if why is not None:
                self.reports[name] = StageReport(StageState.NOT_BUILT, error=why)
        elif missing is not None:
            self.reports[name] = StageReport(StageState.SKIPPED, error=f"needs {missing}")
            function = None
        else:
            self.reports[name] = StageReport(StageState.OK)
        self._save(running=name if function is not None else None)
        return function

    def call(self, name: str, function: Callable[..., Any], *args: object) -> tuple[bool, Any]:
        report = self.reports[name]
        report.calls += 1
        start = time.perf_counter()
        try:
            return True, function(*args)
        except Exception as error:
            self.fail(name, _describe(error))
            return False, None
        finally:
            report.seconds += time.perf_counter() - start

    def fail(self, name: str, error: str) -> None:
        """One call of the stage failed (it raised, or returned what the contract does not allow)."""
        report = self.reports[name]
        report.state = StageState.FAILED
        report.failed_calls = min(report.failed_calls + 1, max(report.calls, 1))
        report.error = report.error or error

    def handing_over(self) -> None:
        """Every stage is done; what they found is being handed to the parent."""
        self._save(running=_HANDOVER)

    def _save(self, running: str | None) -> None:
        if self.progress is None:
            return
        state = {"running": running, "stages": {n: r.to_json() for n, r in self.reports.items()}}
        partial = self.progress.with_name(self.progress.name + ".part")
        partial.write_text(json.dumps(state), encoding="utf-8")
        partial.replace(self.progress)


def _counts(value: JSON) -> dict[str, int] | None:
    """Names to counts, from a report's `counts` or from the report itself."""
    if isinstance(value, dict) and "counts" in value:
        value = value["counts"]
    if isinstance(value, dict) and all(
        isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in value.values()
    ):
        return {k: v for k, v in value.items() if isinstance(v, int)}
    return None


def _agree(value: JSON) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, dict):
        if isinstance(value.get("agree"), bool):
            return bool(value["agree"])
        if value.get("outcome") in ("passed", "fired"):
            return value["outcome"] == "passed"
    return None


def _as_json(stages: _Stages, name: str, value: object) -> JSON:
    try:
        return to_json(value)
    except (TypeError, ValueError, RecursionError) as error:
        stages.fail(name, f"its result has no JSON form: {_describe(error)}")
        return None


def _list_of[T](stages: _Stages, name: str, value: object, kind: type[T]) -> list[T] | None:
    if not isinstance(value, list | tuple) or not all(isinstance(v, kind) for v in value):
        stages.fail(name, f"it returned {type(value).__name__}, not a list of {kind.__name__}")
        return None
    return list(value)


def _counted(stages: _Stages, name: str, value: object) -> dict[str, int] | None:
    counts = _counts(_as_json(stages, name, value))
    if counts is None and stages.reports[name].state is not StageState.FAILED:
        stages.fail(name, "its result has no counts (names to counts)")
    return counts


def _read_dwg(job: Mapping[str, Any], stages: _Stages) -> dict[str, Any]:
    path = Path(job["path"])
    found: dict[str, Any] = {}
    sheet_conventions = view_conventions = None
    if job["conventions"]["sheet"] is not None:
        sheet_conventions = SheetConventions.from_json(_load(job["conventions"]["sheet"]))
    if job["conventions"]["view"] is not None:
        view_conventions = ViewConventions.from_json(_load(job["conventions"]["view"]))

    artefact: object = None
    have_artefact = False
    if read := stages.open("read"):
        have_artefact, artefact = stages.call("read", read, path)
        if have_artefact:
            summary = _as_json(stages, "read", getattr(artefact, "summary", None))
            if isinstance(summary, dict):
                found["read_format"] = summary.get("format")
                found["entity_counts"] = _counts(summary.get("entity_counts"))
            if found.get("entity_counts") is None:
                stages.fail("read", "its artefact has no summary with entity_counts (names to counts)")
    needs_artefact = None if have_artefact else "read"

    if decoders := stages.open("decoders_agree", needs_artefact):
        ok, result = stages.call("decoders_agree", decoders, path, artefact)
        if ok:
            found["decoders_agree"] = _agree(_as_json(stages, "decoders_agree", result))
            if found["decoders_agree"] is None:
                stages.fail("decoders_agree", "its result says neither agree nor disagree")
    for name, key in (("font_report", "font_report"), ("bangla_ansi", "bangla_ansi")):
        if function := stages.open(name, needs_artefact):
            ok, result = stages.call(name, function, artefact)
            if ok:
                found[key] = _counted(stages, name, result)

    sheets: list[SheetCandidate] | None = None
    missing = needs_artefact or (None if sheet_conventions is not None else "sheet conventions")
    if find_sheets := stages.open("sheets", missing):
        ok, result = stages.call(
            "sheets", find_sheets, artefact, job["discipline_default"], sheet_conventions
        )
        listed = _list_of(stages, "sheets", result, SheetCandidate) if ok else None
        if listed is not None:
            sheets = [replace(sheet, group=job["group"]) for sheet in listed]
    found["sheets"] = sheets or []
    needs_sheets = None if sheets is not None else "sheets"

    if find_register := stages.open("register", needs_sheets):
        ok, result = stages.call("register", find_register, artefact, list(sheets or []))
        entries = _list_of(stages, "register", result, RegisterEntry) if ok else None
        if entries is not None and not all(any(e.sheet is s for s in sheets or []) for e in entries):
            stages.fail("register", "an entry is on a sheet this file did not produce")
            entries = None
        found["register"] = entries or []

    views: list[list[ViewCandidate]] = [[] for _ in sheets or []]
    missing = needs_sheets or (None if view_conventions is not None else "view conventions")
    if find_views := stages.open("views", missing):
        for j, sheet in enumerate(sheets or []):
            ok, result = stages.call("views", find_views, artefact, sheet, view_conventions)
            listed_views = _list_of(stages, "views", result, ViewCandidate) if ok else None
            views[j] = listed_views or []
    found["views"] = views

    buffers: list[object | None] = [None for _ in sheets or []]
    if build_buffers := stages.open("render_buffers", needs_sheets):
        for j, sheet in enumerate(sheets or []):
            ok, result = stages.call("render_buffers", build_buffers, artefact, sheet)
            buffers[j] = result if ok else None
    built_buffers = stages.reports["render_buffers"].state in (StageState.OK, StageState.FAILED)
    if rasterise := stages.open("rasterise", None if built_buffers else "render_buffers"):
        for sheet_buffers in buffers:
            if sheet_buffers is not None:
                stages.call("rasterise", rasterise, sheet_buffers, PX_PER_MM)
    found["buffers"] = buffers if job["keep_buffers"] else []
    return found


def _read_pdf(job: Mapping[str, Any], stages: _Stages) -> dict[str, Any]:
    path = Path(job["path"])
    found: dict[str, Any] = {}
    if report := stages.open("pdf_report"):
        ok, result = stages.call("pdf_report", report, path)
        if ok:
            found["pdf_report"] = _counted(stages, "pdf_report", result)
    if page_text := stages.open("page_text"):
        ok, result = stages.call("page_text", page_text, path)
        if ok and not isinstance(result, list | tuple):
            stages.fail("page_text", f"it returned {type(result).__name__}, not a list of pages")
        elif ok:
            found["page_count"] = len(result)
            found["pages"] = list(result) if job["keep_pages"] else []
    return found


def _load(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def child_main(job_path: str) -> int:
    """A file's child process: runs its stages and leaves what it found for the parent, by pickle."""
    job = _load(job_path)
    sys.path[:] = job["sys_path"]
    stages = _Stages(job["targets"], Path(job["progress"]))
    found = _read_dwg(job, stages) if job["format"] == "dwg" else _read_pdf(job, stages)
    stages.handing_over()
    found["stages"] = {name: report.to_json() for name, report in stages.reports.items()}
    result = Path(job["result"])
    partial = result.with_name(result.name + ".part")
    with partial.open("wb") as handle:
        pickle.dump(found, handle, protocol=pickle.HIGHEST_PROTOCOL)
    partial.replace(result)
    return 0


_CHILD = "import sys; from engine.harness import child_main; sys.exit(child_main(sys.argv[1]))"
_LAUNCHER = "from engine.harness import launcher_main; launcher_main()"
_PR_SET_CHILD_SUBREAPER = 36
ONE_THREAD = {"OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1", "MKL_NUM_THREADS": "1"}
"""What each file's process runs BLAS with (the owner's ruling, 28 Sep 2026: "Pin to 1 thread")."""
CHILD_ENV = ("PATH", "HOME", "TMPDIR", "LANG", "PYTHONPATH", "VEXTRUS_LIBREDWG", "VEXTRUS_SANDBOX")
"""The caller's variables a file's process gets, where set; nothing else of the caller's reaches it."""


def _child_env() -> dict[str, str]:
    env = {name: os.environ[name] for name in CHILD_ENV if name in os.environ} | ONE_THREAD
    env["PYTHONPATH"] = os.pathsep.join(filter(None, [str(ROOT), env.get("PYTHONPATH")]))
    return env


# The launcher: where each file's child is started from ---------------------------------------------


def _kill(pid: int) -> None:
    for kill in (os.killpg, os.kill):
        with contextlib.suppress(ProcessLookupError, PermissionError):
            kill(pid, signal.SIGKILL)


def _children() -> list[tuple[int, str, int, int]]:
    """This process's children from /proc (a subreaper's orphans included): each one's pid, state,
    process group and session."""
    me, found = os.getpid(), []
    try:
        entries = list(os.scandir("/proc"))
    except OSError:
        return []
    for entry in entries:
        if not entry.name.isdigit():
            continue
        try:
            stat = Path(entry.path, "stat").read_text()
        except OSError:
            continue
        state, parent, group, session = stat[stat.rindex(")") + 2 :].split()[:4]
        if int(parent) == me:
            found.append((int(entry.name), state, int(group), int(session)))
    return found


def _reap() -> int:
    """Reap every child that has ended (the launcher has no others to wait for): how many were
    killed with SIGKILL, the way it kills."""
    killed = 0
    while True:
        try:
            pid, status = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            return killed
        if pid == 0:
            return killed
        if os.WIFSIGNALED(status) and os.WTERMSIG(status) == signal.SIGKILL:
            killed += 1


def _clear() -> tuple[int, bool]:
    """Kill and reap every orphan the launcher took in, for up to `CLEAR_SECONDS`: what the files'
    children left behind. How many were killed, and whether some are still running (a process that
    forks faster than it can be killed). The file's own group was killed before its child was reaped.

    A fork chain's processes each live for one fork, less time than a scan of /proc takes: seen
    running, one has exited before it can be killed, and the one it forked was not in the listing. So
    each orphan's process group is killed as well, which the kernel does at once, forks included, and
    which the chain's zombies still name. Only groups a file made are killed: one led by an orphan
    (living or a zombie), or one in a session a file's process began (nothing from outside a session
    can join its groups). An orphan in another group of the launcher's session is killed alone.
    No guard spares the launcher's own group, as none is needed: that group is in the launcher's
    session and led by the launcher's ancestor, never by one of its orphans.
    """
    session = os.getsid(0)
    deadline = time.monotonic() + CLEAR_SECONDS
    killed = 0
    while left := _children():
        if time.monotonic() > deadline:
            return killed + _reap(), any(state != "Z" for _, state, _, _ in left)
        leaders = {pid for pid, _, _, _ in left}
        for pid, state, pgid, sid in left:
            if sid != session or pgid in leaders:
                with contextlib.suppress(ProcessLookupError, PermissionError):
                    os.killpg(pgid, signal.SIGKILL)
            if state != "Z":
                with contextlib.suppress(ProcessLookupError, PermissionError):
                    os.kill(pid, signal.SIGKILL)
        killed += _reap()
        time.sleep(0.001)
    return killed, False


def _launch(request: Mapping[str, Any]) -> dict[str, Any]:
    actions = [
        (os.POSIX_SPAWN_OPEN, 0, os.devnull, os.O_RDONLY, 0),
        (os.POSIX_SPAWN_OPEN, 1, request["log"], os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600),
        (os.POSIX_SPAWN_DUP2, 1, 2),
    ]
    _clear()  # what an earlier file left that could not be stopped then is not this file's
    start = time.monotonic()
    argv = [sys.executable, "-c", _CHILD, request["job"]]
    pid = os.posix_spawn(sys.executable, argv, _child_env(), file_actions=actions, setpgroup=0)
    handle = os.pidfd_open(pid)
    timed_out = parent_gone = False
    try:
        poller = select.poll()
        poller.register(handle, select.POLLIN)
        poller.register(sys.stdin.fileno(), select.POLLIN | select.POLLHUP)
        deadline = start + request["timeout"]
        while True:
            left = deadline - time.monotonic()
            if left <= 0:
                timed_out = True
                break
            ready = {fd for fd, _ in poller.poll(math.ceil(min(left, 60.0) * 1000))}
            if handle in ready:
                break
            if ready:  # the parent wrote nothing more, so its end of the pipe closed: it is gone
                parent_gone = True
                break
        if timed_out or parent_gone:
            _kill(pid)
        # The file's group is killed while its child is a zombie, which keeps the group's id from reuse.
        with contextlib.suppress(ProcessLookupError, PermissionError):
            os.killpg(pid, signal.SIGKILL)
        _, status, usage = os.wait4(pid, 0)
    finally:
        os.close(handle)
    seconds = time.monotonic() - start
    left_behind, left_running = _clear()
    if parent_gone:
        raise SystemExit(1)
    return {
        "status": status,
        "timed_out": timed_out,
        "seconds": seconds,
        "cpu_seconds": usage.ru_utime + usage.ru_stime,
        "peak_rss_kib": usage.ru_maxrss,
        "left_behind": left_behind,
        "left_running": left_running,
    }


def launcher_main() -> None:
    """Start each file's child as the parent asks (one JSON line in, one out), until it hangs up."""
    signal.signal(signal.SIGINT, signal.SIG_IGN)  # the parent's hang-up, not Ctrl-C, ends a child
    # Without a subreaper, orphans go to init; a file's process group is still killed.
    with contextlib.suppress(OSError, AttributeError):
        ctypes.CDLL(None, use_errno=True).prctl(_PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0)
    while line := sys.stdin.readline():
        print(json.dumps(_launch(json.loads(line))), flush=True)


class _Launcher:
    """The process each file's child is started from.

    A child started with `posix_spawn` begins with its starter's peak RSS (Linux copies the memory's
    high-water mark into `ru_maxrss` at exec), and the harness grows with every file's results. So
    the children are started by this launcher, which is started while the harness is small and holds
    nothing, and each file's peak is its own. The launcher is the children's subreaper: whatever a
    file's child leaves running (a grandchild it did not wait for) is killed and counted when it ends,
    and a child is killed when the harness goes away.
    """

    def __enter__(self) -> _Launcher:
        self.process = subprocess.Popen(
            [sys.executable, "-c", _LAUNCHER],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            env=_child_env(),
            text=True,
        )
        return self

    def launch(self, job: Path, log: Path, timeout: float) -> dict[str, Any]:
        stdin, stdout = self.process.stdin, self.process.stdout
        if stdin is None or stdout is None:
            raise RuntimeError("the harness's launcher has no pipes")
        stdin.write(json.dumps({"job": str(job), "log": str(log), "timeout": timeout}) + "\n")
        stdin.flush()
        line = stdout.readline()
        if not line:
            raise RuntimeError(f"the harness's launcher ended (exit code {self.process.wait()})")
        reply: dict[str, Any] = json.loads(line)
        return reply

    def __exit__(self, *exc: object) -> None:
        for stream in (self.process.stdin, self.process.stdout):
            if stream is not None:
                stream.close()
        try:
            self.process.wait(timeout=60)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait()


def _tail(log: Path) -> str | None:
    try:
        with log.open("rb") as handle:
            handle.seek(max(handle.seek(0, os.SEEK_END) - LOG_TAIL, 0))
            data = handle.read()
    except OSError:
        return None
    return data.decode("utf-8", errors="replace") or None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def file_discipline(relative: str, conventions: SheetConventions | None) -> str | None:
    """The file's Discipline default from its path (the module's docstring says how), or none."""
    if conventions is None:
        return None
    parts = Path(relative).with_suffix("").parts
    words = {w.casefold() for part in parts for w in re.split(r"[^0-9A-Za-z]+", part) if w}
    first = next((w for w in re.split(r"[^0-9A-Za-z]+", parts[-1]) if w), "")
    matched = {
        d.key
        for d in conventions.disciplines
        if d.key.casefold() in words
        or any(re.fullmatch(re.escape(p) + r"\d*", first, re.IGNORECASE) for p in d.prefixes)
    }
    return matched.pop() if len(matched) == 1 else None


def drawing_files(set_dir: Path) -> list[str]:
    """The set's DWG and PDF files, as paths inside it, in order; links and hidden files left out."""
    found = []
    for path in set_dir.rglob("*"):
        relative = path.relative_to(set_dir)
        if any(part.startswith(".") for part in relative.parts):
            continue
        if not path.is_symlink() and path.is_file() and path.suffix.lower() in FORMATS:
            found.append(relative.as_posix())
    return sorted(found)


@dataclass(frozen=True)
class Conventions:
    sheet: Path | None
    view: Path | None
    sheet_conventions: SheetConventions | None
    applied: str | None
    """The sha256 of the files read, or none when there were none."""


def load_conventions(directory: Path | None) -> Conventions:
    chosen: dict[str, Path | None] = {}
    for name in (SHEET_CONVENTIONS, VIEW_CONVENTIONS):
        candidates = [d / name for d in (directory, DEFAULT_CONVENTIONS) if d is not None]
        chosen[name] = next((p for p in candidates if p.is_file()), None)
    digest = hashlib.sha256()
    sheet_conventions = None
    for name, path in chosen.items():
        if path is None:
            continue
        data = path.read_bytes()
        digest.update(name.encode() + b"\0" + hashlib.sha256(data).digest())
        try:
            value = json.loads(data)
            if name == SHEET_CONVENTIONS:
                sheet_conventions = SheetConventions.from_json(value)
            else:
                ViewConventions.from_json(value)
        except ValueError as error:
            raise ConventionsError(f"{path}: {error}") from None
    applied = None if all(p is None for p in chosen.values()) else digest.hexdigest()
    return Conventions(
        sheet=chosen[SHEET_CONVENTIONS],
        view=chosen[VIEW_CONVENTIONS],
        sheet_conventions=sheet_conventions,
        applied=applied,
    )


def _read_file(
    set_dir: Path,
    relative: str,
    work: Path,
    index: int,
    conventions: Conventions,
    targets: Mapping[str, str],
    built: Mapping[str, bool],
    file_timeout: float,
    launcher: _Launcher,
) -> FileReading:
    path = set_dir / relative
    kind = FORMATS[path.suffix.lower()]
    job_path, result, progress, log = (
        work / f"{index}.{ext}" for ext in ("job", "result", "progress", "log")
    )
    discipline = file_discipline(relative, conventions.sheet_conventions)
    job = {
        "path": str(path),
        "format": kind,
        "discipline_default": discipline,
        "group": GROUP,
        "conventions": {
            "sheet": None if conventions.sheet is None else str(conventions.sheet),
            "view": None if conventions.view is None else str(conventions.view),
        },
        "targets": dict(targets),
        "sys_path": list(sys.path),
        "result": str(result),
        "progress": str(progress),
        "keep_pages": built["plot"],
        "keep_buffers": built["plot"] and built["render_f1"],
    }
    job_path.write_text(json.dumps(job), encoding="utf-8")
    reply = launcher.launch(job_path, log, file_timeout)
    code = os.waitstatus_to_exitcode(reply["status"])
    found: dict[str, Any] = {}
    how = (
        "it ran past the file timeout"
        if reply["timed_out"]
        else f"signal {-code}"
        if code < 0
        else f"exit code {code}"
    )
    if result.is_file() and not reply["timed_out"] and code == 0:
        try:
            with result.open("rb") as handle:
                found = pickle.load(handle)
        except Exception as error:
            how = f"its result could not be read: {_describe(error)}"
    ended = (
        ProcessStatus.TIMED_OUT
        if reply["timed_out"]
        else ProcessStatus.OK
        if found
        else ProcessStatus.FAILED
    )
    process = ProcessReport(
        status=ended,
        exit_code=None if code < 0 else code,
        signal=-code if code < 0 else None,
        seconds=reply["seconds"],
        cpu_seconds=reply["cpu_seconds"],
        peak_rss_kib=reply["peak_rss_kib"],
        left_behind=reply["left_behind"],
        left_running=reply["left_running"],
        log_tail=None if ended is ProcessStatus.OK else _tail(log),
    )
    reports = _file_stages(kind, found, progress, how)
    return FileReading(
        path=relative,
        sha256=_sha256(path),
        format=kind,
        discipline_default=discipline,
        group=GROUP,
        conventions_applied=conventions.applied,
        process=process,
        stages=reports,
        read_format=found.get("read_format"),
        decoders_agree=found.get("decoders_agree"),
        entity_counts=found.get("entity_counts"),
        font_report=found.get("font_report"),
        pdf_report=found.get("pdf_report"),
        bangla_ansi=found.get("bangla_ansi"),
        sheets=found.get("sheets", []),
        views=found.get("views", []),
        register=found.get("register", []),
        page_count=found.get("page_count"),
        pages=found.get("pages", []),
        buffers=found.get("buffers", []),
    )


def _file_stages(
    kind: str, found: Mapping[str, Any], progress: Path, how: str
) -> dict[str, StageReport]:
    """The file's stage reports: the child's own, or, when it died, as far as it got (`how` it
    ended); stages that finished but whose results never reached the parent are failed."""
    if found:
        return {name: StageReport.from_json(value) for name, value in found["stages"].items()}
    saved: Mapping[str, Any] = {"running": None, "stages": {}}
    if progress.is_file():
        saved = _load(progress)
    reports = {name: StageReport.from_json(value) for name, value in saved["stages"].items()}
    if saved["running"] == _HANDOVER:
        for report in reports.values():
            if report.state is StageState.OK:
                report.state = StageState.FAILED
                report.error = (
                    f"its results were lost: the file's process ended handing them over ({how})"
                )
    elif saved["running"] is not None:
        report = reports[saved["running"]]
        report.state = StageState.FAILED
        report.failed_calls += 1
        report.error = f"the file's process ended during this stage ({how})"
    for name in FILE_STAGES[kind]:
        if name not in reports:
            reports[name] = StageReport(
                StageState.SKIPPED, error=f"the file's process ended before this stage ({how})"
            )
    return {name: reports[name] for name in FILE_STAGES[kind]}


def _read_set(
    files: Sequence[FileReading], targets: Mapping[str, str], built: Mapping[str, bool]
) -> SetOutcome:
    stages = _Stages(targets, progress=None)
    refs = References(files)
    outcome = SetOutcome(stages=stages.reports)
    sheets = [sheet for reading in files for sheet in reading.sheets]
    views = [
        tuple(reading.views[j]) if j < len(reading.views) else ()
        for reading in files
        for j in range(len(reading.sheets))
    ]
    pages = [page for reading in files for page in reading.pages]
    buffers = {
        id(sheet): reading.buffers[j]
        for reading in files
        for j, sheet in enumerate(reading.sheets)
        if j < len(reading.buffers)
    }

    def needs(*names: str) -> str | None:
        """The first input not read everywhere: a set stage never runs on part of the set."""
        for name in names:
            if not built[name]:
                return name
            if name in SET_STAGES:
                if stages.reports[name].state is not StageState.OK:
                    return name
                continue
            kind = "pdf" if name in FILE_STAGES["pdf"] else "dwg"
            short = sum(
                1 for f in files if f.format == kind and f.stages[name].state is not StageState.OK
            )
            if short:
                return f"{name} (not read in {short} of the files)"
        return None

    def known(name: str, items: Sequence[object]) -> bool:
        try:
            for item in items:
                refs.of(item)
        except ExportError as error:
            stages.fail(name, str(error))
            return False
        return True

    if match := stages.open("plot", needs("sheets", "page_text")):
        ok, result = stages.call("plot", match, pages, sheets)
        matches = _list_of(stages, "plot", result, PlotMatch) if ok else None
        if matches is not None and known(
            "plot", [m.page for m in matches] + [m.sheet for m in matches if m.sheet is not None]
        ):
            if not all(any(m.page is p for p in pages) for m in matches):
                stages.fail("plot", "a match names something other than a page")
            else:
                outcome.plot = matches

    if score := stages.open("render_f1", needs("plot", "render_buffers")):
        for m in outcome.plot:
            sheet_buffers = buffers.get(id(m.sheet))
            if m.sheet is None or m.transform is None or sheet_buffers is None:
                continue
            ok, value = stages.call("render_f1", score, sheet_buffers, m.page, m.transform)
            if ok and (
                isinstance(value, bool) or not isinstance(value, int | float) or not 0 <= value <= 1
            ):
                stages.fail("render_f1", f"it returned {value!r}, not a score from 0 to 1")
            elif ok:
                outcome.render_f1.append((m.sheet, float(value)))

    if find := stages.open("conflicts", needs("sheets")):
        ok, result = stages.call("conflicts", find, sheets, views)
        found = _list_of(stages, "conflicts", result, object) if ok else None
        if found is not None and not all(isinstance(c, Conflict | Continuation) for c in found):
            stages.fail("conflicts", "it returned something other than Conflicts and Continuations")
        elif found is not None:
            conflicts = [c for c in found if isinstance(c, Conflict)]
            continuations = [c for c in found if isinstance(c, Continuation)]
            named = [x for c in conflicts for x in c.candidates] + [
                s for c in continuations for s in c.sheets
            ]
            if known("conflicts", named):
                outcome.conflicts, outcome.continuations = conflicts, continuations

    if run_all := stages.open("checks", needs("sheets")):
        reading = SetReading(
            sheets=tuple(sheets),
            views=tuple(views),
            register=tuple(entry for f in files for entry in f.register),
            plot=tuple(outcome.plot),
            conflicts=tuple(outcome.conflicts),
            continuations=tuple(outcome.continuations),
            read=frozenset(
                name for name in ("views", "register", "plot", "conflicts") if not needs(name)
            ),
        )
        ok, result = stages.call("checks", run_all, reading)
        results = _list_of(stages, "checks", result, CheckResult) if ok else None
        subjects = [
            r.subject.page if isinstance(r.subject, PlotMatch) else r.subject
            for r in results or []
            if r.subject is not None
        ]
        if results is not None and known("checks", subjects):
            outcome.checks = results
    return outcome


def run(
    set_dir: Path,
    out: Path,
    *,
    conventions: Path | None = None,
    stages: Sequence[Stage] = STAGES,
    file_timeout: float = FILE_TIMEOUT,
    run_id: str | None = None,
    commit: str | None = None,
    code_hash: str | None = None,
) -> dict[str, JSON]:
    """Read the set, write its export to `out` (readable by its owner only) and return it."""
    if commit is not None and not re.fullmatch(r"[0-9a-f]{40}(?:[0-9a-f]{24})?", commit):
        raise UsageError(f"the commit {commit!r} is not a full hexadecimal commit id")
    for what, value in (("run id", run_id), ("code hash", code_hash)):
        if value is not None and not re.fullmatch(r"[\x21-\x7e]+", value):
            raise UsageError(f"the {what} {value!r} is not printable characters without spaces")
    if not (math.isfinite(file_timeout) and 0 < file_timeout <= 1e6):
        raise UsageError(f"the file timeout, {file_timeout}, is not seconds from 0 to a million")
    started = datetime.now(UTC)
    clock = time.monotonic()
    set_dir = set_dir.resolve()
    applied = load_conventions(conventions)
    targets = {stage.name: stage.target for stage in stages}
    built = {stage.name: _is_built(stage.target) for stage in stages}
    out.parent.mkdir(parents=True, exist_ok=True)
    with (
        tempfile.TemporaryDirectory(dir=out.parent, prefix=".harness-") as work,
        _Launcher() as launcher,
    ):
        files = [
            _read_file(
                set_dir, relative, Path(work), index, applied, targets, built, file_timeout, launcher
            )
            for index, relative in enumerate(drawing_files(set_dir))
        ]
    outcome = _read_set(files, targets, built)
    info = RunInfo(
        id=run_id or str(uuid.uuid7()),
        commit=commit,
        code_hash=code_hash,
        started_at=started.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        seconds=time.monotonic() - clock,
        stages={stage.name: (stage.target, stage.ticket, built[stage.name]) for stage in stages},
    )
    document = build(info, files, outcome)
    text = json.dumps(document, ensure_ascii=False, indent=1, allow_nan=False) + "\n"
    partial = out.with_name(out.name + ".part")
    handle = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(handle, "w", encoding="utf-8") as stream:
        stream.write(text)
    partial.replace(out)
    return document


def summary(document: Mapping[str, Any]) -> str:
    """What the run did, in counts only (never a title, number or name from the drawings)."""
    states: dict[str, dict[str, int]] = {}
    for reading in document["files"]:
        for name, report in reading["stages"].items():
            states.setdefault(name, {}).setdefault(report["state"], 0)
            states[name][report["state"]] += 1
    for name, report in document["set_stages"].items():
        states.setdefault(name, {})[report["state"]] = 1
    processes = [f["process"]["status"] for f in document["files"]]
    ended = ", ".join(
        f"{processes.count(s)} {s.replace('_', ' ')}" for s in ("ok", "failed", "timed_out")
    )
    lines = [
        f"{len(processes)} files: {ended}",
        f"{sum(len(f['sheets']) for f in document['files'])} sheets",
    ]
    lines += [
        f"  {name}: " + ", ".join(f"{count} {state}" for state, count in sorted(counts.items()))
        for name, counts in states.items()
    ]
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m engine.harness",
        description="Read a Drawing Set with the engine; write the export.",
    )
    parser.add_argument("--set", type=Path, required=True, help="the Drawing Set's folder")
    parser.add_argument("--out", type=Path, required=True, help="the export's file")
    parser.add_argument(
        "--conventions", type=Path, help="a folder of conventions files over the defaults"
    )
    # The real-drawing check (06a) passes the run's identity in the environment; a flag still wins.
    parser.add_argument(
        "--run-id",
        default=os.environ.get("VEXTRUS_RUN_ID"),
        help="the run's id (default: $VEXTRUS_RUN_ID, else a new UUIDv7)",
    )
    parser.add_argument(
        "--commit",
        default=os.environ.get("VEXTRUS_COMMIT"),
        help="the commit read with (default: $VEXTRUS_COMMIT)",
    )
    parser.add_argument(
        "--code-hash",
        default=os.environ.get("VEXTRUS_CODE_HASH"),
        help="the hash of the engine paths read with (default: $VEXTRUS_CODE_HASH)",
    )
    parser.add_argument("--file-timeout", type=float, default=FILE_TIMEOUT, help="seconds per file")
    options = parser.parse_args(argv)
    if not options.set.is_dir():
        parser.error(f"{options.set} is not a folder")
    if options.conventions is not None and not options.conventions.is_dir():
        parser.error(f"{options.conventions} is not a folder")
    try:
        document = run(
            options.set,
            options.out,
            conventions=options.conventions,
            file_timeout=options.file_timeout,
            run_id=options.run_id,
            commit=options.commit,
            code_hash=options.code_hash,
        )
    except UsageError as error:
        print(f"python -m engine.harness: {error}", file=sys.stderr)
        return 2
    print(summary(document))
    return 0


if __name__ == "__main__":
    sys.exit(main())
