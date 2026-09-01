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


def quote(diagnostics: str) -> str:
    """A program's own words, trimmed, for a refusal that names what the program said."""
    said = diagnostics.strip()
    return f" — {said[-_DIAGNOSTIC_TAIL:]}" if said else ""


def run_pass(program: str, argv: Sequence[str], *, source: Path, timeout_seconds: float) -> str:
    """Spawn one pass and return its diagnostics; refuse the drawing by name if it cannot run.

    The returned text is the program's stdout and stderr together, decoded leniently: a program
    that writes bytes no encoding admits is still a program whose words belong in a refusal.
    """
    try:
        # An argv list and no shell: the program is spawned directly, never through a command line
        # something else could read as syntax (L-CAD-04's "isolated subprocess only").
        completed = subprocess.run(
            list(argv),
            capture_output=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as error:
        raise DwgError(
            f"{source.name}: {program} is not on this machine, so the drawing cannot be converted"
        ) from error
    except PermissionError as error:
        raise DwgError(f"{source.name}: {program} cannot be run: {error.strerror}") from error
    except subprocess.TimeoutExpired as error:
        raise DwgError(
            f"{source.name}: {program} outran its {timeout_seconds:g}s budget and was stopped"
        ) from error

    return f"{_text(completed.stdout)}\n{_text(completed.stderr)}"


def tool_version(toolchain: Toolchain, source: Path) -> str:
    """The toolchain's own account of itself, from its `--version` output (R-TO-001).

    The line carrying a version is the one recorded, so a banner that opens with a greeting or a
    warning still yields the release rather than the greeting. A toolchain that says nothing about
    itself is not a drawing this lane refuses: it is recorded as saying nothing.
    """
    banner = run_pass(
        toolchain.dwgread,
        [toolchain.dwgread, "--version"],
        source=source,
        timeout_seconds=toolchain.timeout_seconds,
    )
    lines = [line.strip() for line in banner.splitlines() if line.strip()]
    for line in lines:
        if _RELEASE.search(line):
            return line
    return lines[0] if lines else ""


def _text(stream: bytes | None) -> str:
    return stream.decode("utf-8", errors="replace") if stream else ""
