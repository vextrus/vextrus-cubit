"""The tracked tree holds no drawing and nothing under `.private/` (spec 5; runs in CI, needs no corpus).

`check(root)` reads `git ls-files` in `root` and returns the violations, each naming its path: a tracked
file that starts with DWG magic (`AC10`, as every DWG version string does) or a DXF header (ASCII
`  0\\nSECTION`, or `AutoCAD Binary DXF`), and any tracked path under `.private/`. The demo seed's
synthetic drawings, by exact name, are exempt as the guard's SEED_DRAWING rule exempts them
(none is tracked today).
"""

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

SEED_DRAWING = re.compile(r"vextrus/seed/recorded/[A-Za-z0-9_-][A-Za-z0-9._-]*\.dwg")
_DXF_ASCII = re.compile(rb"\A\s*0\s*\r?\nSECTION\b")
HEAD_BYTES = 64


@dataclass(frozen=True)
class Violation:
    path: str
    why: str

    def __str__(self) -> str:
        return f"{self.path}: {self.why}"


def _drawing_magic(head: bytes) -> str | None:
    if head.startswith(b"AC10"):
        return "starts with DWG magic"
    if head.startswith(b"AutoCAD Binary DXF") or _DXF_ASCII.match(head):
        return "starts with a DXF header"
    return None


def check(root: Path) -> list[Violation]:
    """Every tracked file of the repository at `root` that is a drawing or lives under `.private/`."""
    done = subprocess.run(["git", "ls-files", "-z"], cwd=root, capture_output=True, check=True)
    found: list[Violation] = []
    for raw in done.stdout.split(b"\0"):
        if not raw:
            continue
        path = raw.decode("utf-8", "surrogateescape")
        if path == ".private" or path.startswith(".private/"):
            found.append(Violation(path, "is under .private/"))
            continue
        if SEED_DRAWING.fullmatch(path):
            continue
        try:
            with (root / path).open("rb") as stream:
                head = stream.read(HEAD_BYTES)
        except OSError:
            continue
        why = _drawing_magic(head)
        if why is not None:
            found.append(Violation(path, why))
    return found
