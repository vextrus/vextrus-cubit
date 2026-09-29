"""A Plot page as the consultant's PDF draws it: grey pixels, for the render check (18).

    picture(path, page, px_per_pt, sha256=...) -> Picture

The page is drawn by pypdfium2 (Apache-2.0 / BSD-3; ADR 0014 names it among the PDF readers, and
docs/research/viewer-2d-fidelity.md drew its reference plots with it), as displayed (its `/Rotate`
applied) and cut to its CropBox, in grey, without its comments (the "AutoCAD SHX Text" annotations
repeat, as text, lettering the page already draws as strokes) and without form fields. PyMuPDF (AGPL)
is never used.

**The trust boundary is 12's** (engine/read/pdf's docstring, "The trust boundary"): a PDF is hostile
input. This process copies it (a regular file only), hashing it as it copies, and refuses a copy whose
sha256 is not the page's (`Page.source_sha256`), so the page drawn is the page read. pdfium then runs
in a child Python process in `engine.read.sandbox` (bubblewrap: no network, a read-only file system
but one output folder, a cleared environment, CPU, memory, file-size and wall-clock limits,
`LIMITS`), reading only the copy, the engine's code and Python. The picture's size is checked in the
child before a pixel is drawn (`MAX_PIXELS`), and its output is read back without following a link,
as a header and exactly the pixels the header states, never more.
"""

import hashlib
import os
import stat
import struct
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

import numpy as np
from numpy.typing import NDArray

from engine.read.sandbox import LimitReached, Limits, open_output, run

MAX_PIXELS = 60_000_000
"""The largest picture drawn: an A0 page at the render check's 4 pixels a paper millimetre is 19
million; 60 million leaves room for a page plotted larger, and is 60 MB of grey."""
LIMITS = Limits(
    cpu_seconds=120, memory_bytes=2 * 2**30, wall_seconds=300.0, output_bytes=MAX_PIXELS + 64
)
"""The child's limits: pdfium draws a page in well under a second (the research's 34 to 87 ms at 3000
px); a first guess, which ticket 24 may measure."""
HEADER = struct.Struct("<4sII")
MAGIC = b"VXPP"
REFUSED = b"NO::"
"""What the child writes, followed by a reason's key, for a page it will not draw."""
ROOT = Path(__file__).resolve().parents[2]
PRELUDE = (
    "import os, sys; "
    "os.environ.update(OPENBLAS_NUM_THREADS='1', OMP_NUM_THREADS='1', MKL_NUM_THREADS='1'); "
    "sys.path.insert(0, sys.argv[1]); "
)
"""BLAS pinned to one thread before numpy can load (12's `PRELUDE`, and why), then the engine's path."""
CHILD = PRELUDE + "from engine.plot._picture_child import main; sys.exit(main(sys.argv[2:]))"


class PictureError(ValueError):
    """A page that could not be drawn: `reason` is a key (`changed`, `refused` and the child's own)."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"the Plot page could not be drawn: {reason}")
        self.reason = reason


@dataclass(frozen=True)
class Picture:
    """A page as grey pixels (rows from the top; 255 white), `px_per_pt` pixels a point, its first
    pixel's corner at the CropBox's top left."""

    pixels: NDArray[np.uint8]
    px_per_pt: float


_kept: list[tuple[tuple[str, int, float], Picture]] = []
"""The last pictures drawn, by the contents' sha256, page and density: registration draws a page at
the density the render check then scores it at. Keyed by the hash, a picture is always of the contents
the page was read from."""
KEEP = 2


def picture(path: Path, page: int, px_per_pt: float, *, sha256: str, limits: Limits = LIMITS) -> Picture:
    """The page (counting from 1) of the PDF at `path`, whose contents must hash to `sha256`."""
    key = (sha256, page, px_per_pt)
    for kept_key, kept in _kept:
        if kept_key == key:
            return kept
    drawn = _picture(Path(path), page, px_per_pt, sha256, limits)
    _kept.append((key, drawn))
    del _kept[:-KEEP]
    return drawn


def _picture(path: Path, page: int, px_per_pt: float, sha256: str, limits: Limits) -> Picture:
    if not (isinstance(page, int) and page >= 1 and 0 < px_per_pt < 100):
        raise ValueError(f"page {page!r} at {px_per_pt!r} pixels a point is not a page to draw")
    with tempfile.TemporaryDirectory(prefix="vextrus-plot-") as scratch:
        copy = Path(scratch, "source.pdf")
        try:
            digest = _copy(Path(path), copy)
        except OSError as error:
            raise PictureError("unreadable") from error
        if digest != sha256:
            raise PictureError("changed")
        output = Path(scratch, "out")
        output.mkdir()
        target = output / "page.grey"
        executable = Path(sys.executable)
        python = executable.parent.resolve() / executable.name
        reads = [copy, ROOT / "engine", Path(sys.prefix), Path(sys.base_prefix)]
        argv = [
            str(python), "-I", "-B", "-c", CHILD, str(ROOT), str(copy), str(target), str(page),
            repr(float(px_per_pt)), str(MAX_PIXELS),
        ]  # fmt: skip
        try:
            finished = run(argv, reads=_distinct(reads), output=output, limits=limits)
        except LimitReached as reached:
            raise PictureError(f"limit_{reached.limit}") from reached
        if finished.exit_code != 0:
            detail = finished.stderr.decode(errors="replace")[-2000:]
            raise PictureError("failed") from RuntimeError(detail)
        with open_output(target, "plot picture") as stream:
            return _parse(stream, px_per_pt)


def _parse(stream: BinaryIO, px_per_pt: float) -> Picture:
    """The child's output: `REFUSED` and a reason's key, or the header and exactly its pixels."""
    read = stream.read
    head = read(HEADER.size)
    if head.startswith(REFUSED):
        reason = (head + read(64))[len(REFUSED) :].decode("ascii", errors="replace")
        raise PictureError(reason if reason.isidentifier() and len(reason) <= 32 else "unreadable")
    if len(head) != HEADER.size:
        raise PictureError("unreadable")
    magic, width, height = HEADER.unpack(head)
    if magic != MAGIC or not (width > 0 and height > 0 and width * height <= MAX_PIXELS):
        raise PictureError("unreadable")
    data = read(width * height + 1)
    if len(data) != width * height:
        raise PictureError("unreadable")
    pixels = np.frombuffer(data, dtype=np.uint8).reshape(height, width)
    return Picture(pixels, px_per_pt)


def _copy(path: Path, copy: Path) -> str:
    """Copy the file, a regular file only (never a FIFO, a device or a folder), and return its sha256
    (12's rule, engine/read/pdf)."""
    descriptor = os.open(path.resolve(), os.O_RDONLY | os.O_NONBLOCK | os.O_CLOEXEC)
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):
        os.close(descriptor)
        raise OSError(f"{path.name} is not a regular file")
    with os.fdopen(descriptor, "rb") as file:
        digest = hashlib.sha256()
        with copy.open("xb") as out:
            while chunk := file.read(1 << 20):
                digest.update(chunk)
                out.write(chunk)
    return digest.hexdigest()


def _distinct(paths: list[Path]) -> list[Path]:
    """Each path once, and none that another in the list, or `/usr` (always bound), already holds."""
    resolved = sorted({p.resolve() for p in paths}, key=lambda p: len(p.parts))
    kept: list[Path] = []
    for path in resolved:
        if path.is_relative_to("/usr") or any(path.is_relative_to(k) for k in kept):
            continue
        kept.append(path)
    return kept
