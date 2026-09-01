"""The LibreDWG programs this lane spawns, and how one pass is run (L-CAD-04).

LibreDWG is reached as an isolated subprocess and nothing else: no Python binding, no shared
library loaded into this interpreter, and no shell between here and the program. The exit code a
pass returns is deliberately never read — L-CAD-04 says it is not a success signal, so a pass is
judged by the artifact it was asked to write, which the caller reads for itself.
"""

from __future__ import annotations

import re
import subprocess
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

#: What a release looks like in a banner, so the version line can be told from a greeting.
_RELEASE: Final = re.compile(r"\d+\.\d+")


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
    timeout_seconds: float,
) -> PassOutput:
    """Spawn one pass and return its diagnostics; refuse the drawing by name if it cannot run.

    Every refusal names the drawing and the pass that was running, because the two passes can be
    told apart by neither the program's name — a toolchain may name one program twice — nor by an
    exit code, which L-CAD-04 does not admit as evidence of anything.

    The pass is started in `room`, a directory of its own: a program that writes where it was
    started rather than where it was asked leaves that inside the invocation's scratch, where the
    caller finds it and where it dies with the call.

    The returned streams are decoded leniently: a program that writes bytes no encoding admits is
    still a program whose words belong in a refusal.
    """
    try:
        # An argv list and no shell: the program is spawned directly, never through a command line
        # something else could read as syntax (L-CAD-04's "isolated subprocess only").
        completed = subprocess.run(
            list(argv),
            capture_output=True,
            cwd=str(room),
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as error:
        raise DwgError(
            f"{source.name}: {pass_name} cannot run because {program} is not on this machine,"
            " so the drawing cannot be converted"
        ) from error
    except OSError as error:
        # Anything else the operating system refuses to spawn — a program that is not executable,
        # a name that resolves to a directory — is the same refusal: this drawing cannot be
        # converted, said in words rather than as an interpreter traceback.
        raise DwgError(
            f"{source.name}: {pass_name} cannot run {program}: {error.strerror or error}"
        ) from error
    except subprocess.TimeoutExpired as error:
        raise DwgError(
            f"{source.name}: {pass_name} outran its {timeout_seconds:g}s budget"
            f" and {program} was stopped"
        ) from error

    return PassOutput(stdout=_text(completed.stdout), stderr=_text(completed.stderr))


def tool_version(toolchain: Toolchain, source: Path, *, room: Path) -> str:
    """The toolchain's own account of itself, from its `--version` output (R-TO-001).

    The line carrying a version is the one recorded, so a banner that opens with a greeting or a
    warning still yields the release rather than the greeting. A toolchain that says nothing about
    itself is not a drawing this lane refuses: it is recorded as saying nothing.
    """
    banner = run_pass(
        toolchain.dwgread,
        [toolchain.dwgread, "--version"],
        source=source,
        pass_name="the toolchain's version banner",
        room=room,
        timeout_seconds=toolchain.timeout_seconds,
    )
    lines = [line.strip() for line in banner.diagnostics.splitlines() if line.strip()]
    for line in lines:
        if _RELEASE.search(line):
            return line
    return lines[0] if lines else ""


def _text(stream: bytes | None) -> str:
    return stream.decode("utf-8", errors="replace") if stream else ""
