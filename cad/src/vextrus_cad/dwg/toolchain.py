"""The LibreDWG programs this lane spawns, and how one pass is run (L-CAD-04).

LibreDWG is reached as an isolated subprocess and nothing else: no Python binding, no shared
library loaded into this interpreter, and no shell between here and the program. Three things make
that isolation real rather than nominal, and each is a law rather than a taste:

* **What a pass says is not what this process says.** A pass is started in a session of its own
  with both its streams pointed at files inside its own room, so nothing it prints — a payload, a
  complaint, a whole document — can ever land on the streams `cad/` answers its caller on. The
  files are read back afterwards, which is also how a program that answers on stdout is heard.
* **What a pass exits with is not evidence.** L-CAD-04 says the exit code is not a success signal,
  so nothing here looks at one: a pass is judged by the artifact it was asked to write.
* **A pass that outruns its budget ends, and so does everything it started.** The session started
  for the pass is signalled as a whole, so a program that left a helper behind cannot outlive the
  refusal, go on writing into the invocation's scratch, or hold the call open past its budget.
"""

from __future__ import annotations

import contextlib
import os
import re
import signal
import subprocess
import time
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from .errors import DwgError

#: The per-pass budget. L-CAD-04 asks for generous timeouts: large enough that a slow machine
#: reading a large drawing is never mistaken for a hung one, bounded so a hung one still ends.
DWG_TIMEOUT_SECONDS: Final[float] = 900.0

#: How much of a program's own diagnostics a refusal quotes back.
_DIAGNOSTIC_TAIL: Final = 800

#: Where a pass's own streams are kept while it runs: files in its room, never this process's.
_SAID_ON_STDOUT: Final = "pass-stdout"
_SAID_ON_STDERR: Final = "pass-stderr"

#: How long a signalled session is waited for before the invocation stops waiting for it.
_REAPING_SECONDS: Final = 10.0

#: What a release looks like in a banner, so the version line can be told from a greeting.
_RELEASE: Final = re.compile(r"\d+\.\d+")

#: What a refusal calls each half of the conversion, and the `Toolchain` field whose program runs
#: it. A toolchain may name one program for both passes — or a program named nothing like LibreDWG
#: — so neither the program nor the field alone says which half of the conversion ended the
#: drawing; the pass is named too (L-CAD-04's loud failures).
CENSUS_PASS: Final = "the census pass (dwgread)"
GEOMETRY_PASS: Final = "the geometry pass (dwg2dxf)"
VERSION_PASS: Final = "the version banner (dwgread)"


def refusal(source: Path, pass_name: str, program: str, what: str) -> str:
    """The words every refusal this lane raises owes its caller (L-CAD-04).

    Four facts, because a caller holding the message alone can act on none of them otherwise:
    which drawing — spelled as it is and said in full, so a caller holding a directory of them and
    one holding a path are told the same thing — which half of the conversion, which program ran
    that half, and what happened.
    """
    return f"{source.name} ({source}): {pass_name}, running {program}: {what}"


@dataclass(frozen=True)
class Toolchain:
    """The two programs one conversion spawns, and the budget each pass is given.

    Named rather than hard-wired so the laws about a pass that fails or outruns its budget are
    provable against a program written for the purpose, without a pathological drawing.
    """

    dwgread: str
    dwg2dxf: str
    timeout_seconds: float


#: LibreDWG as this machine provides it, on PATH under its own names.
DEFAULT_TOOLCHAIN: Final = Toolchain("dwgread", "dwg2dxf", DWG_TIMEOUT_SECONDS)


@dataclass(frozen=True)
class Deadline:
    """One invocation's whole budget, shared by every pass it runs (L-CAD-04).

    The budget is a promise to whoever is waiting: a drawing this toolchain cannot convert stops
    being converted within it. Each pass is bounded by what is left of the invocation rather than
    by a budget of its own, so a conversion that needs two passes and a version banner cannot end
    later than a conversion that hung on the first of them.
    """

    seconds: float
    opened: float

    @classmethod
    def opening(cls, seconds: float) -> Deadline:
        return cls(seconds=seconds, opened=time.monotonic())

    def left(self) -> float:
        return self.seconds - (time.monotonic() - self.opened)


@dataclass(frozen=True)
class PassOutput:
    """What one pass said for itself. Its exit code is not here, because it is not evidence."""

    stdout: str
    stderr: str

    @property
    def diagnostics(self) -> str:
        """Both streams together, for a refusal that quotes the program's own words."""
        return f"{self.stdout}\n{self.stderr}"


def quote(diagnostics: str) -> str:
    """A program's own words, trimmed, for a refusal that names what the program said."""
    said = diagnostics.strip()
    return f" — {said[-_DIAGNOSTIC_TAIL:]}" if said else ""


def run_pass(
    program: str,
    argv: Sequence[str],
    *,
    source: Path,
    pass_name: str,
    room: Path,
    deadline: Deadline,
) -> PassOutput:
    """Spawn one pass and return what it said; refuse the drawing by name if it cannot run.

    Every refusal names the drawing and the pass that was running, because the two passes can be
    told apart by neither the program's name — a toolchain may name one program twice — nor by an
    exit code, which L-CAD-04 does not admit as evidence of anything.

    The pass is started in `room`, a directory of its own: a program that writes where it was
    started rather than where it was asked leaves that inside the invocation's scratch, where the
    caller finds it and where it dies with the call.

    The streams are read back leniently: a program that writes bytes no encoding admits is still a
    program whose words belong in a refusal.
    """
    budget = deadline.left()
    if budget <= 0:
        raise DwgError(_outran(source, pass_name, program, deadline))

    on_stdout = room / _SAID_ON_STDOUT
    on_stderr = room / _SAID_ON_STDERR
    try:
        with on_stdout.open("wb") as to_stdout, on_stderr.open("wb") as to_stderr:
            # An argv list and no shell: the program is spawned directly, never through a command
            # line something else could read as syntax (L-CAD-04's "isolated subprocess only").
            # A session of its own makes the pass and its descendants one thing that can be ended.
            running = subprocess.Popen(
                list(argv),
                cwd=str(room),
                stdin=subprocess.DEVNULL,
                stdout=to_stdout,
                stderr=to_stderr,
                start_new_session=True,
                shell=False,
            )
    except FileNotFoundError as error:
        raise DwgError(
            refusal(source, pass_name, program, "that program is not on this machine")
        ) from error
    except OSError as error:
        # Anything else the operating system refuses to spawn — a program that is not executable, a
        # name that resolves to a directory — is the same refusal: this drawing cannot be
        # converted, said in words rather than as an interpreter traceback.
        said = error.strerror or error
        raise DwgError(
            refusal(source, pass_name, program, f"that program cannot be run: {said}")
        ) from error

    try:
        running.wait(timeout=budget)
    except subprocess.TimeoutExpired as error:
        _end_session(running)
        raise DwgError(_outran(source, pass_name, program, deadline)) from error

    return PassOutput(stdout=_said(on_stdout), stderr=_said(on_stderr))


def tool_version(toolchain: Toolchain, source: Path, *, room: Path, deadline: Deadline) -> str:
    """The toolchain's own account of itself, from its `--version` output (R-TO-001).

    The line carrying a version is the one recorded, so a banner that opens with a greeting or a
    warning still yields the release rather than the greeting.

    A toolchain that will not say what it is does not refuse a drawing it has already converted:
    L-CAD-04's refusals are about drawings and programs that cannot do the work, and this is a
    field on the answer. The identity is recorded as unsaid, which is what it is.
    """
    try:
        banner = run_pass(
            toolchain.dwgread,
            [toolchain.dwgread, "--version"],
            source=source,
            pass_name=VERSION_PASS,
            room=room,
            deadline=deadline,
        )
    except DwgError:
        return ""
    lines = [line.strip() for line in banner.diagnostics.splitlines() if line.strip()]
    for line in lines:
        if _RELEASE.search(line):
            return line
    return lines[0] if lines else ""


def _outran(source: Path, pass_name: str, program: str, deadline: Deadline) -> str:
    return refusal(
        source,
        pass_name,
        program,
        f"outran the {deadline.seconds:g}s budget for converting this drawing, and was stopped",
    )


def _end_session(running: subprocess.Popen[bytes]) -> None:
    """End the pass and everything it started (L-CAD-04's stateless lane).

    Signalling the session rather than the one process is what makes "nothing left behind" true of
    a program that started a helper: a survivor would go on writing into a scratch directory this
    invocation is about to remove, and would hold the call open past the budget it was given.
    """
    try:
        os.killpg(os.getpgid(running.pid), signal.SIGKILL)
    except OSError:
        # The session is already gone, or was never ours to signal; the process still is.
        running.kill()
    with contextlib.suppress(subprocess.TimeoutExpired):
        running.wait(timeout=_REAPING_SECONDS)


def _said(path: Path) -> str:
    try:
        return path.read_bytes().decode("utf-8", errors="replace")
    except OSError:
        return ""
