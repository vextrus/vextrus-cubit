"""Reading a PDF plotted from AutoCAD: its upload report and each page's text (ticket 12; ADR 0014).

    engine.read.pdf.report(path) -> PdfReport
    engine.read.pdf.page_text(path) -> list[Page]

are the stages the harness calls (the M0 plan, "The contracts fixed here"). Both read the file once,
in a sandboxed child (below), and share that reading while the same file is asked for again. A PDF that
cannot be read at all raises `engine.read.ReadError` with its finding (`engine/messages/pdf_report.py`:
locked, damaged, too many pages, a limit reached). Everything else is in the report, as message codes
and parameters worded for a QS (web/src/messages/engine/pdf_report/en.po, after m0-screens 4.5), and as
counts for the real-drawing check.

Libraries: pdfminer.six only (MIT), pinned in uv.lock. pdfplumber is not used: its default word
extraction fragments a rotated page's strings and letter-reverses a mirrored one, where the content
stream's own order is right (docs/research/vector-pdf-evidence.md, conclusions 5 and 9). pypdfium2 is
not used either, so nothing of pdfium runs here. PyMuPDF (AGPL) is never used.

**What the report says** (evidence: docs/research/vector-pdf-evidence.md, "What the product must detect
at upload"):
- **Made by:** the Info dictionary's Producer, else its Creator. AutoCAD when it names AutoCAD or its
  "DWG To PDF" driver; a merged or re-saved file names its merger (Edison's say `pypdf`).
- **Pages**, and how many are turned by `/Rotate`. Text is read in the page as displayed.
- **SHX comments per page**: annotations whose subject (`/Subj`) or title (`/T`) is "AutoCAD SHX Text",
  the name Autodesk gives them (below). Their string and box are page text; a comment gives no size or
  angle.
- **Lettering**, per page, by this rule:
  - *comments*: the page carries SHX comments or hidden text (render mode 3 or 7, what PDFSHX at 2
    writes): its AutoCAD lettering was kept as text;
  - *text*: neither, but `FEW_CHARS` (20) or more glyphs of real text: TrueType text survives a plot
    as text, and a title block alone in TrueType holds more than 20 characters (a number, a title,
    dates, names), so AutoCAD's own lettering on the page, if any, is lines;
  - *lines*: neither, fewer than 20 glyphs of text, and at least one stroke: a drawn page whose
    lettering is drawn as lines (the research's "vector geometry but few characters and no SHX
    comments"); 20 is set above the handful a scale bar or a north arrow holds;
  - *none*: nothing stroked and next to no text (a blank page, or a scan).
  With comments on any page the plot had PDFSHX on, so a *text* page had no SHX text to keep and counts
  as kept; with none anywhere the PDF cannot say whether the drawings used AutoCAD's lettering, and the
  report says so rather than guessing.
- **Fonts** the text is set in: not embedded, Type 3 (glyphs drawn as pictures), or unreadable (a font
  program or table that fails to parse: its glyphs still count, their letters unknown).
- **Layers**: the optional-content groups each page's resources list (`/Properties`), read from the
  pages because AutoCAD's plots declare none in the catalog. Two or more names: kept; else flattened.
- **Pictures**: how many images each page draws and the share of its area they cover, overlaps counted
  once and a turned image as it lies (`coverage.py`); an image is never decoded.
- **Extras**: scripts (JavaScript actions and name trees, XFA forms), launch actions, web links,
  actions naming another file, and attached files are counted, never run, followed or opened.

**The scan rule** (ADR 0014: scans are refused). A page is *mostly a picture* when its pictures cover
more than `MOSTLY_PICTURE` (half) of its area: m0-screens' "mostly a picture". It is a **scan** when it
is mostly a picture and draws no text (hidden text does not count: a scanner's OCR writes hidden text)
and no stroke: nothing on it but a picture. A page mostly a picture that also has strokes or text is
reported ("it may be a scan") and read. A PDF is **refused** when every page is a scan; a scan page
among drawn ones is named and read as it is (it gives no text). Both thresholds were fixed before any
real result, and are not tuned after one: half is what "mostly" means, and a drawing has strokes while
a scan has none. A gradient hatch plots as a small picture (the research's 183 by 183 px images) and
never approaches half a page.

**Page text for registration** (`page_text`): each page's text objects and its SHX comments, the body's
as well as the title block's (the review Q4: Edison's title blocks are strokes, and 52 of its 57
structural pages registered through the text on the page). Glyphs are joined into items in stream
order (`text.py` states the rule and its thresholds); a comment is one item. Each item is anchored by
`PdfAnchor`: the page, its **path index** (the object's place in the page's drawing order, `walk.py`),
and its box. **The frame** is the page as displayed: its MediaBox turned by `/Rotate`, the lower-left
corner at the origin, y up, in points; `Page.crop` is the visible CropBox in it. Text is kept as the
PDF holds it, raw codes (`%%C`) included: 11's decode function reads it, not this module.

**The AutoCAD setting to ask for** when the lettering is lines: the system variable **PDFSHX at 1**,
which stores text in SHX fonts as comments when a drawing is exported or plotted to PDF (2 stores it as
hidden text, from AutoCAD 2024). Sources, all Autodesk's, as found on 28 Sep 2026:
- "PDFSHX (System Variable)", AutoCAD 2026 Help,
  https://help.autodesk.com/view/ACD/2026/ENU/?guid=GUID-56EA988C-A1DA-4E85-8765-B3F31A01AB02
  (also the 2025 and 2021 editions of the same topic): "Controls whether text objects using SHX fonts
  are stored in PDF files as comments or hidden text when you export a drawing as a PDF file"; the
  comments are labelled "AutoCAD SHX Text"; initial value 1; saved in the registry.
- "What's New in AutoCAD 2024", https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-WhatsNew/files/
  GUID-3890D5F7-04CB-4F3B-97FF-7A9577D41852.htm: value 2 stores SHX text as hidden text.
- "Drawing text appears as comments in a PDF created by AutoCAD or DWG TrueView",
  https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Drawing-text-appears-as-Comments-in-a-PDF-created-by-AutoCAD.html
  (plot, publish and export alike; since AutoCAD 2016).
- "PDF Options Dialog Box" (the DWG To PDF plotter), AutoCAD 2020 Help,
  https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-Core/files/GUID-BE373C38-678A-4AF9-96AB-4195FFD6F806.htm:
  "Text in SHX fonts is always converted to geometry … Additionally, the text is copied to the PDF file
  as a comment." The report therefore asks for a plot through AutoCAD's DWG To PDF plotter with PDFSHX
  at 1: a print driver outside AutoCAD writes no such comments whatever the setting.
**Not verified:** this environment's network refuses Autodesk's sites, so these pages were not opened;
the text above is the search engine's copy of them. No page date was seen. Autodesk's exact words for
values 0 and 1, and any checkbox label in the PDF options dialog for this setting, were not found (the
label "Include SHX text as comments" in m0-screens 4.5 is unconfirmed and is not used), and whether
2016 SP1's name for it, EPDFSHX, still applies on older installs is not checked. A local session with a
browser reads the pages and confirms the words before the catalogue's wording is final.

**The trust boundary.** A PDF is hostile input. This process only copies it (a regular file only, never
a FIFO, a device or a folder), hashing it as it copies, so the child reads exactly the bytes the sha256
names. The whole reading runs in a child Python process in `engine.read.sandbox` (bubblewrap: no
network, a read-only file system but one output folder, a cleared environment, and CPU, memory,
file-size and wall-clock limits, `LIMITS`), the pattern 04 uses for LibreDWG. The child sees the copy,
the engine's own code and Python, never the rest of the checkout (so never `.private/`). Its JSON is
read back without following a link, parsed only under `MAX_OUTPUT` bytes and `MAX_CONTAINERS` objects
(so a compromised child cannot exhaust this process), and checked field by field (`facts.py`). Inside,
nothing is executed or fetched: no script is run, no action followed, no attached or external file
opened (pdfminer reads none; the sandbox binds none), and no image decoded. A stream that inflates
past the memory limit ends the child with `MemoryError`, reported as the memory limit; a page tree that
loops is read once per page (pdfminer's walk skips a page it has seen); a PDF with more than `MAX_PAGES`
(1,000) pages is refused before any page is read (a discipline's plot of one DWG runs to tens or a few
hundred pages; more is not one plot); a damaged page, or a font that fails to parse, is marked and the
rest is read.
"""

import hashlib
import json
import os
import stat
import sys
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path

import pdfminer

from engine.messages import Message
from engine.messages import pdf_report as codes
from engine.read.errors import ReadError
from engine.read.pdf import facts as child_facts
from engine.read.pdf import rules
from engine.read.pdf.facts import DocumentFacts
from engine.read.pdf.rules import FEW_CHARS, MOSTLY_PICTURE
from engine.read.pdf.types import Lettering, MadeBy, Page, PageReport, PdfReport, TextItem, TextSource
from engine.read.pdf.walk import MAX_PAGES, VERSION
from engine.read.sandbox import LimitReached, Limits, open_output, run

__all__ = [
    "FEW_CHARS",
    "LIMITS",
    "MAX_PAGES",
    "MOSTLY_PICTURE",
    "READER",
    "Lettering",
    "MadeBy",
    "Page",
    "PageReport",
    "PdfReport",
    "ReadError",
    "TextItem",
    "TextSource",
    "page_text",
    "report",
]

READER = "pdfminer.six"
READER_VERSION = f"{pdfminer.__version__}+{VERSION}"
"""pdfminer.six's version, and this reading's own (`walk.VERSION`: the drawing order and the joining
rule the anchors depend on)."""

LIMITS = Limits(cpu_seconds=600, memory_bytes=2 * 2**30, wall_seconds=900.0, output_bytes=16 * 2**20)
"""The child's limits: a first guess over the research's timings (pdfplumber took 3.4 s on the densest
Edison page, of 57 to 84 pages a file); ticket 24 measures them."""
MAX_OUTPUT = 16 * 2**20
"""The most JSON this process parses from the child, whatever its limits say: parsed JSON takes many
times its size in memory, and this process is the caller's (the CAD worker's). A text item is about
200 bytes, so this holds some 80,000 items, where Edison's densest set has some 55,000 glyphs and 5,000
comments in all. Measured on 28 Sep 2026, the worst it lets through (16 MiB of numbers in one list)
grew this process by 175 MiB; 32 MiB had grown it by 322 MiB."""
MAX_CONTAINERS = 1_000_000
"""…and the most objects and lists in it, counted before it is parsed (an empty object is 2 bytes of
JSON and some 64 of memory)."""

ROOT = Path(__file__).resolve().parents[3]
CHILD = (
    "import sys; sys.path.insert(0, sys.argv[1]); "
    "from engine.read.pdf.child import main; sys.exit(main(sys.argv[2:]))"
)


def report(path: Path, *, limits: Limits = LIMITS) -> PdfReport:
    """The PDF's upload report. Raises `ReadError` when the file cannot be read at all."""
    reading = _reading(Path(path), limits)
    return rules.report(reading.facts, reading.sha256)


def page_text(path: Path, *, limits: Limits = LIMITS) -> list[Page]:
    """Every page's text items, anchored, in page order. Raises `ReadError` as `report` does."""
    reading = _reading(Path(path), limits)
    return rules.pages(reading.facts, reading.sha256, READER, READER_VERSION)


@dataclass(frozen=True)
class _Reading:
    sha256: str
    facts: DocumentFacts


_lock = threading.Lock()
_last: tuple[tuple[str, Limits], _Reading | ReadError] | None = None
_LASTING = {codes.LOCKED.code, codes.UNREADABLE.code, codes.TOO_MANY_PAGES.code}
"""Refusals the file itself decides, kept for the next call; a limit reached or a sandbox that could
not start may be the machine's, and is tried again."""


def _reading(path: Path, limits: Limits) -> _Reading:
    """The file's reading, from the last call when it asked for the same contents and limits.

    The file is copied, and hashed as it is copied, into a private folder, and the child reads the copy:
    what is hashed is what is read, however the file changes meanwhile."""
    global _last
    with tempfile.TemporaryDirectory(prefix="vextrus-pdf-") as scratch:
        copy = Path(scratch, "source.pdf")
        sha256 = _copy(path, copy)
        key = (sha256, limits)
        with _lock:
            if _last is not None and _last[0] == key:
                found = _last[1]
            else:
                try:
                    found = _Reading(sha256, _read(copy, Path(scratch), limits))
                except ReadError as error:
                    found = error
                if isinstance(found, _Reading) or found.message["code"] in _LASTING:
                    _last = (key, found)
    if isinstance(found, ReadError):
        raise found
    return found


def _read(source: Path, scratch: Path, limits: Limits) -> DocumentFacts:
    executable = Path(sys.executable)
    python = executable.parent.resolve() / executable.name  # the venv's own name, so its site is found
    # Only the copy, the engine's own code and Python: never the rest of the checkout (its `.private/`).
    reads = [source, ROOT / "engine", Path(sys.prefix), Path(sys.base_prefix)]
    output = scratch / "out"
    output.mkdir()
    target = output / "facts.json"
    try:
        finished = run(
            [str(python), "-I", "-B", "-c", CHILD, str(ROOT), str(source), str(target)],
            reads=_distinct(reads),
            output=output,
            limits=limits,
        )
    except LimitReached as reached:
        raise ReadError(codes.LIMIT_REACHED(limit=reached.limit)) from reached
    if finished.exit_code != 0:
        detail = finished.stderr.decode(errors="replace")[-2000:]
        raise ReadError(codes.UNREADABLE()) from RuntimeError(detail)
    with open_output(target, "pdf reader") as stream:
        data = _load(stream.read(min(limits.output_bytes, MAX_OUTPUT) + 1), limits)
    reason = child_facts.refusal(data) if isinstance(data, dict) else None
    if reason is not None:
        raise ReadError(_refusal(reason))
    try:
        return child_facts.parse(data)
    except (ValueError, TypeError, OverflowError, RecursionError) as error:
        raise ReadError(codes.UNREADABLE()) from error


def _load(raw: bytes, limits: Limits) -> object:
    """The child's JSON, parsed only when it is small enough to parse safely in this process."""
    containers = raw.count(b"{") + raw.count(b"[")
    if len(raw) > min(limits.output_bytes, MAX_OUTPUT) or containers > MAX_CONTAINERS:
        raise ReadError(codes.UNREADABLE())
    try:
        return json.loads(raw)
    except (ValueError, RecursionError) as error:
        raise ReadError(codes.UNREADABLE()) from error


def _refusal(reason: str) -> Message:
    if reason == "locked":
        return codes.LOCKED()
    if reason == "too_many_pages":
        return codes.TOO_MANY_PAGES(limit=MAX_PAGES)
    if reason == "memory":
        return codes.LIMIT_REACHED(limit="memory")
    return codes.UNREADABLE()


def _distinct(paths: list[Path]) -> list[Path]:
    """Each path once, and none that another in the list, or `/usr` (always bound), already holds."""
    resolved = sorted({p.resolve() for p in paths}, key=lambda p: len(p.parts))
    kept: list[Path] = []
    for path in resolved:
        if path.is_relative_to("/usr") or any(path.is_relative_to(k) for k in kept):
            continue
        kept.append(path)
    return kept


def _copy(path: Path, copy: Path) -> str:
    """Copy the file, a regular file only (never a FIFO, a device or a folder), and return its sha256."""
    descriptor = os.open(Path(path).resolve(), os.O_RDONLY | os.O_NONBLOCK | os.O_CLOEXEC)
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):
        os.close(descriptor)
        raise ReadError(codes.UNREADABLE())
    with os.fdopen(descriptor, "rb") as file:
        digest = hashlib.sha256()
        with copy.open("xb") as out:
            while chunk := file.read(1 << 20):
                digest.update(chunk)
                out.write(chunk)
    return digest.hexdigest()
