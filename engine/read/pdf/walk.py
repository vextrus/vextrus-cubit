"""One PDF read with pdfminer.six, inside the sandbox: each page's facts and text items, as JSON.

This module runs only in the sandboxed child (`engine.read.pdf.child`); its output is checked field by
field by the caller (`engine.read.pdf.facts`), which never trusts it further. It never decodes an image,
never runs a script, never follows a link or opens a file the PDF names: it reads the objects the page
draws and the annotations it carries, nothing more.

**The frame** is pdfminer's: the page's MediaBox turned by its `/Rotate`, with its lower-left corner
at the origin, y up, in points. So a page that displays landscape is landscape here, and a text reads
at the angle it is seen at.

**Drawing order** (`index`, the anchor's path index): every object the page's content stream paints
counts one, in stream order, a Form XObject's contents in place: a path painted, a text shown (one
per show operator, `Tj`, `TJ`, `'` or `"`), an image drawn. A page's annotations come after its
content, as a viewer draws them: annotation k of the page's `/Annots` is `objects + k`. Glyphs are
placed as the PDF specification places them (9.4.4: the character spacing after every glyph, the word
spacing after a single-byte space).
"""

import logging
import math
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path
from typing import Any, BinaryIO

from pdfminer.pdfdevice import PDFTextDevice
from pdfminer.pdfdocument import PDFDocument, PDFEncryptionError, PDFPasswordIncorrect
from pdfminer.pdffont import PDFCIDFont, PDFFont, PDFType1Font, PDFType3Font, PDFUnicodeNotDefined
from pdfminer.pdfinterp import PDFGraphicState, PDFPageInterpreter, PDFResourceManager, PDFTextState
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser
from pdfminer.pdftypes import PDFObjRef, PDFStream, resolve1
from pdfminer.psparser import PSLiteral
from pdfminer.utils import Matrix, apply_matrix_pt, decode_text, mult_matrix, translate_matrix

from engine.read.pdf import coverage
from engine.read.pdf.text import UNKNOWN, Glyph, runs

VERSION = 1
"""This reading's own version: raised when the drawing order or the joining rule (`text.py`) changes,
since an anchor's path index and a text item's extent depend on them."""
MAX_PAGES = 1000
"""A PDF with more pages is refused before any page is read (the module's docstring says why)."""
SHX_TEXT = "autocad shx text"
"""What AutoCAD's plot names the comments that carry its SHX text, case folded."""
MAX_NAME = 200
"""A font's, a layer's or the producer's name is cut to this many characters."""
_MAX_DEPTH = 64
"""How deep a name tree or a chain of actions is followed; a deeper one is damaged, and stops there."""
_MAX_ACTIONS = 10_000
_ROUND = 3


class Refused(Exception):
    """The file as a whole is not read; `reason` is one of the report's failure words."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def read(stream: BinaryIO) -> dict[str, Any]:
    """The file's facts: its producer, its extras and every page's facts and text items."""
    logging.getLogger("pdfminer").setLevel(logging.CRITICAL)
    try:
        document = PDFDocument(PDFParser(stream))
    except PDFPasswordIncorrect:
        raise Refused("locked") from None
    except PDFEncryptionError:
        raise Refused("locked") from None
    except MemoryError:
        raise
    except Exception:
        raise Refused("unreadable") from None
    pages = _pages(document)
    info = _info(document)
    extras = _Extras()
    extras.document(document)
    resources = _Resources()
    facts = [_page(number, page, resources, extras) for number, page in enumerate(pages, start=1)]
    return {
        "producer": info.get("Producer"),
        "creator": info.get("Creator"),
        "extras": extras.counts,
        "pages": facts,
    }


def _pages(document: PDFDocument) -> list[PDFPage]:
    pages: list[PDFPage] = []
    try:
        for page in PDFPage.create_pages(document):
            pages.append(page)
            if len(pages) > MAX_PAGES:
                raise Refused("too_many_pages")
    except Refused, MemoryError:
        raise
    except Exception:  # a tree too deep to walk, or not a tree at all
        raise Refused("unreadable") from None
    if not pages:
        raise Refused("unreadable")
    return pages


def _info(document: PDFDocument) -> dict[str, str]:
    found: dict[str, str] = {}
    for info in document.info:
        if not isinstance(info, Mapping):
            continue
        for key in ("Producer", "Creator"):
            value = _text(info.get(key))
            if value and key not in found:
                found[key] = value
    return found


def _decode(value: bytes) -> str:
    """A PDF text string: UTF-16 with its mark, UTF-8 with its mark (PDF 2.0), else PDFDocEncoding."""
    if value.startswith(b"\xef\xbb\xbf"):
        return value[3:].decode("utf-8", errors="replace")
    return decode_text(value)


def _text(value: object) -> str | None:
    value = _resolve(value)
    if isinstance(value, bytes):
        text = _decode(value)
    elif isinstance(value, str):
        text = value
    else:
        return None
    text = "".join(c for c in text if c.isprintable()).strip()
    return text[:MAX_NAME] or None


def _resolve(value: object) -> object:
    try:
        return resolve1(value)
    except MemoryError:
        raise
    except Exception:
        return None


def _name(value: object) -> str | None:
    value = _resolve(value)
    if isinstance(value, PSLiteral):
        value = value.name
    if isinstance(value, bytes):
        value = value.decode("latin-1")
    return value if isinstance(value, str) else None


# The page -----------------------------------------------------------------------------------------


def _page(number: int, page: PDFPage, resources: _Resources, extras: _Extras) -> dict[str, Any]:
    device = _Device(resources)
    try:
        PDFPageInterpreter(resources, device).process_page(page)
        readable = True
    except MemoryError:
        raise
    except Exception:  # a damaged page: what it drew before the damage is kept, and it is marked
        readable = False
    ctm = device.page_ctm or (1, 0, 0, 1, 0, 0)
    width, height = _size(page, ctm)
    if not (math.isfinite(width) and math.isfinite(height) and width > 0 and height > 0):
        width = height = 0.0  # a page with no size: damaged
        readable = False
    items = [_item(run) for run in runs(device.glyphs)]
    extras.actions(page.attrs.get("AA"))
    comments = 0
    for k, annotation in enumerate(_annotations(page)):
        extras.annotation(annotation)
        comment = _shx_comment(annotation, ctm)
        if comment is not None:
            comments += 1
            items.append({**comment, "index": device.objects + k})
    return {
        "number": number,
        "readable": readable,
        "rotate": page.rotate if page.rotate in (0, 90, 180, 270) else 0,
        "width": round(width, _ROUND),
        "height": round(height, _ROUND),
        "crop": _box(_crop(page, ctm, width, height)),
        "objects": device.objects,
        "strokes": device.strokes,
        "fills": device.fills,
        "chars": device.chars,
        "hidden_chars": device.hidden_chars,
        "unmapped_chars": device.unmapped,
        "images": len(device.images),
        "picture_share": round(coverage.share(device.images, width, height), 6),
        "fonts": sorted(device.fonts.values()),
        "layers": sorted(_layers(page)),
        "shx_comments": comments,
        "items": items,
    }


def _size(page: PDFPage, ctm: Matrix) -> tuple[float, float]:
    x0, y0, x1, y1 = _transform_rect(ctm, page.mediabox)
    return abs(x1 - x0), abs(y1 - y0)


def _crop(page: PDFPage, ctm: Matrix, width: float, height: float) -> tuple[float, float, float, float]:
    """The visible part of the page: its CropBox where it overlaps the MediaBox, else the whole page."""
    x0, y0, x1, y1 = _transform_rect(ctm, page.cropbox)
    x0, y0, x1, y1 = max(x0, 0.0), max(y0, 0.0), min(x1, width), min(y1, height)
    return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else (0.0, 0.0, width, height)


def _item(run: Any) -> dict[str, Any]:
    return {
        "text": run.text,
        "source": "hidden_text" if run.hidden else "text",
        "index": run.index,
        "box": _box(run.box),
        "size": round(run.size, _ROUND),
        "angle": round(run.angle, _ROUND),
        "mirrored": run.mirrored,
        "font": run.font,
    }


def _box(box: Sequence[float]) -> list[float]:
    return [round(v, _ROUND) for v in box]


def _transform_rect(ctm: Matrix, rect: Sequence[float]) -> tuple[float, float, float, float]:
    x0, y0, x1, y1 = (float(v) for v in rect)
    corners = [apply_matrix_pt(ctm, p) for p in ((x0, y0), (x0, y1), (x1, y0), (x1, y1))]
    xs, ys = [p[0] for p in corners], [p[1] for p in corners]
    return min(xs), min(ys), max(xs), max(ys)


def _annotations(page: PDFPage) -> Iterator[Mapping[str, Any]]:
    listed = _resolve(page.annots)
    if not isinstance(listed, list):
        return
    for entry in listed:
        annotation = _resolve(entry)
        yield annotation if isinstance(annotation, Mapping) else {}


def _shx_comment(annotation: Mapping[str, Any], ctm: Matrix) -> dict[str, Any] | None:
    """An "AutoCAD SHX Text" comment's string and box, or none for any other annotation."""
    named = {(_text(annotation.get(key)) or "").casefold() for key in ("Subj", "T")}
    if SHX_TEXT not in named:
        return None
    contents = _resolve(annotation.get("Contents"))
    rect = _resolve(annotation.get("Rect"))
    if not isinstance(contents, bytes) or not isinstance(rect, list) or len(rect) != 4:
        return None
    try:
        corners = [float(_resolve(v)) for v in rect]  # type: ignore[arg-type]
    except TypeError, ValueError:
        return None
    box = _transform_rect(ctm, corners)
    # Checked on the page, not in the file: finite numbers can overflow once the page's frame moves them.
    if not all(math.isfinite(v) for v in box):
        return None
    text = _decode(contents).strip()
    if not text:
        return None
    return {
        "text": text,
        "source": "shx_comment",
        "box": _box(box),
        "size": None,
        "angle": None,
        "mirrored": False,
        "font": None,
    }


def _layers(page: PDFPage) -> set[str]:
    """The names of the optional-content groups the page's resources list: a plot's layers."""
    found: set[str] = set()
    resources = _resolve(page.resources)
    if not isinstance(resources, Mapping):
        return found
    properties = _resolve(resources.get("Properties"))
    if not isinstance(properties, Mapping):
        return found
    for value in properties.values():
        group = _resolve(value)
        if isinstance(group, Mapping) and _name(group.get("Type")) == "OCG":
            name = _text(group.get("Name"))
            if name:
                found.add(name)
    return found


# Drawing ------------------------------------------------------------------------------------------


class _Resources(PDFResourceManager):
    """pdfminer's fonts, with a font that cannot be read kept as one whose text is not known."""

    def __init__(self) -> None:
        super().__init__(caching=True)

    def get_font(self, objid: object, spec: Mapping[str, object]) -> PDFFont:
        try:
            return super().get_font(objid, spec)
        except MemoryError:
            raise
        except Exception:
            mapping = spec if isinstance(spec, Mapping) else {}
            name = _font_name(_name(mapping.get("BaseFont")))
            # pdfminer reads a Type 0 font's descendant through this same call: either is two bytes.
            multibyte = _name(mapping.get("Subtype")) in ("Type0", "CIDFontType0", "CIDFontType2")
            font = _Unreadable(self, name, multibyte=multibyte)
            if objid:
                self._cached_fonts[objid] = font
            return font


class _Unreadable(PDFType1Font):
    """A font whose program or tables could not be read: its glyphs are drawn, their text unknown."""

    def __init__(self, resources: PDFResourceManager, name: str, *, multibyte: bool) -> None:
        super().__init__(resources, {"BaseFont": PSLiteral(name)})
        self.fontname = name
        self.multibyte = multibyte

    def is_multibyte(self) -> bool:
        return self.multibyte

    def decode(self, data: bytes) -> list[int]:
        if not self.multibyte:
            return list(data)
        return [
            int.from_bytes(data[i : i + 2]) for i in range(0, len(data) - 1, 2)
        ]  # a Type 0 font's two bytes

    def to_unichr(self, cid: int) -> str:
        raise PDFUnicodeNotDefined(None, cid)


def _font_name(name: str | None) -> str:
    if not name:
        return "unnamed"
    if len(name) > 7 and name[6] == "+" and name[:6].isupper() and name[:6].isalpha():
        name = name[7:]  # a subset's tag
    return "".join(c for c in name if c.isprintable())[:MAX_NAME] or "unnamed"


def _font_kind(font: PDFFont) -> str:
    if isinstance(font, PDFType3Font):
        return "type3"
    if isinstance(font, PDFCIDFont):
        return "type0"
    if isinstance(font, _Unreadable):
        return "unreadable"
    return "truetype" if type(font).__name__ == "PDFTrueTypeFont" else "type1"


def _embedded(font: PDFFont) -> bool:
    if isinstance(font, PDFType3Font):
        return True  # its glyphs are drawn by the PDF itself
    descriptor = getattr(font, "descriptor", None)
    return isinstance(descriptor, Mapping) and any(
        key in descriptor for key in ("FontFile", "FontFile2", "FontFile3")
    )


class _Device(PDFTextDevice):
    """Counts what a page draws and keeps its glyphs, in drawing order, and nothing else of it."""

    def __init__(self, resources: _Resources) -> None:
        super().__init__(resources)
        self.page_ctm: Matrix | None = None
        self.objects = 0
        self.strokes = 0
        self.fills = 0
        self.chars = 0
        self.hidden_chars = 0
        self.unmapped = 0
        self.glyphs: list[Glyph] = []
        self.images: list[coverage.Picture] = []
        self.fonts: dict[int, tuple[str, str, bool]] = {}
        self._figures: list[Matrix | None] = []
        self._hidden = False
        self._font_name = ""
        self._index = 0

    def begin_page(self, page: PDFPage, ctm: Matrix) -> None:
        self.page_ctm = ctm

    def begin_figure(self, name: str, bbox: object, matrix: Matrix) -> None:
        # pdfminer leaves a Form's CTM on the device after it ends; keep the one it began with.
        self._figures.append(self.ctm)

    def end_figure(self, name: str) -> None:
        if self._figures:
            self.ctm = self._figures.pop()

    def paint_path(
        self, graphicstate: PDFGraphicState, stroke: bool, fill: bool, evenodd: bool, path: object
    ) -> None:
        self.objects += 1
        if stroke:
            self.strokes += 1
        elif fill:
            self.fills += 1

    def render_image(self, name: str, stream: PDFStream) -> None:
        self.objects += 1
        if self.ctm is None:
            return
        a, b, c, d, e, f = (float(v) for v in self.ctm)
        if all(math.isfinite(v) for v in (a, b, c, d, e, f)):
            # The image fills the unit square: the CTM gives its corner and its two edges on the page.
            # Only where it lies is read; its pixels, and the size it claims, are never decoded.
            self.images.append((e, f, a, b, c, d))

    def render_string(
        self, textstate: PDFTextState, seq: Any, ncs: Any, graphicstate: PDFGraphicState
    ) -> None:
        """One show operator, placed as the PDF specification places it (9.4.4): each glyph moves the
        pen by its width, then the character spacing, then the word spacing after a single-byte
        space; a number in a `TJ` array moves it back by thousandths of the size. (pdfminer's own loop
        leaves out the character spacing after the last glyph of each show.)"""
        self.objects += 1
        font = textstate.font
        if font is None or self.ctm is None:
            return
        self._hidden = textstate.render in (3, 7)  # neither filled nor stroked: hidden text
        name = _font_name(getattr(font, "fontname", None))
        self._font_name = name
        self.fonts.setdefault(id(font), (name, _font_kind(font), _embedded(font)))
        self._index = self.objects - 1
        matrix = mult_matrix(textstate.matrix, self.ctm)
        size = float(textstate.fontsize)
        scaling = float(textstate.scaling) * 0.01
        charspace = float(textstate.charspace) * scaling
        wordspace = 0.0 if font.is_multibyte() else float(textstate.wordspace) * scaling
        rise = float(textstate.rise)
        vertical = font.is_vertical()
        x, y = textstate.linematrix
        for item in seq:
            if isinstance(item, int | float):
                shift = float(item) * 0.001 * size * scaling
                x, y = (x, y - shift) if vertical else (x - shift, y)
            elif isinstance(item, bytes):
                for cid in font.decode(item):
                    spacing = charspace + (wordspace if cid == 32 else 0.0)
                    step = self._glyph(matrix, (x, y), font, size, scaling, rise, cid, vertical, spacing)
                    x, y = (x, y + step) if vertical else (x + step, y)
        textstate.linematrix = (x, y)

    def _glyph(
        self,
        text_matrix: Matrix,
        at: tuple[float, float],
        font: PDFFont,
        size: float,
        scaling: float,
        rise: float,
        cid: int,
        vertical: bool,
        spacing: float,
    ) -> float:
        """Keep one glyph drawn at `at` in text space; returns how far it moves the pen there: its
        width, then `spacing` (the character and word spacing after it)."""
        matrix = translate_matrix(text_matrix, at)
        try:
            text = font.to_unichr(cid)
        except PDFUnicodeNotDefined:
            text = UNKNOWN
            self.unmapped += 1
        width = float(font.char_width(cid)) * size * (1.0 if vertical else scaling)
        if self._hidden:
            self.hidden_chars += 1
        elif not text.isspace():
            self.chars += 1
        if vertical:
            # A vertical glyph hangs from its position vector: half an em left, `vy` up (9.7.4.3).
            disp = font.char_disp(cid)
            vx, vy = disp if isinstance(disp, tuple) else (None, 880)
            left = size * 0.5 if vx is None else float(vx) * size * 0.001
            top = float(vy) * size * 0.001
            descent = float(font.get_descent()) * size
            box = _transform_rect(
                matrix, (-left, rise - top + descent, size - left, rise - top + descent + size)
            )
            reading, em = (0.0, -1.0), (0.0, size)
            advance = (0.0, width + spacing)
        else:
            descent = float(font.get_descent()) * size
            box = _transform_rect(matrix, (0, descent + rise, width, descent + rise + size))
            reading, em = (1.0, 0.0), (size * scaling, 0.0)
            advance = (width + spacing, 0.0)
        origin = apply_matrix_pt(matrix, (0, rise))
        axis = _linear(matrix, reading)
        length = math.hypot(*axis)
        unit = (axis[0] / length, axis[1] / length) if length and math.isfinite(length) else (0.0, 0.0)
        up = _linear(matrix, (0.0, size))
        along = math.hypot(*_linear(matrix, em))
        moved = _linear(matrix, advance)
        if all(math.isfinite(v) for v in (*origin, *moved, *up, *box, along)):
            self.glyphs.append(
                Glyph(
                    text=text,
                    origin=origin,
                    axis=unit,
                    advance=moved,
                    up=up,
                    em=along,
                    box=box,
                    index=self._index,
                    hidden=self._hidden,
                    font=self._font_name,
                )
            )
        return width + spacing


def _linear(matrix: Matrix, vector: tuple[float, float]) -> tuple[float, float]:
    a, b, c, d, _, _ = matrix
    x, y = vector
    return (a * x + c * y, b * x + d * y)


def _count(value: object) -> int:
    value = _resolve(value)
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        return 0
    return max(0, int(value))


# Extras: what the PDF holds beyond the drawing, counted and never acted on ------------------------

_SCRIPT_ACTIONS = {"JavaScript"}
_LAUNCH_ACTIONS = {"Launch"}
_LINK_ACTIONS = {"URI"}
_REMOTE_ACTIONS = {"GoToR", "GoToE", "SubmitForm", "ImportData", "Thread"}


class _Extras:
    """Scripts, launch actions, web links, actions that name another file, and attached files."""

    def __init__(self) -> None:
        self.counts = {"scripts": 0, "launches": 0, "links": 0, "remote": 0, "files": 0}
        self._seen: set[int] = set()
        self._actions = 0

    def document(self, document: PDFDocument) -> None:
        catalog = document.catalog
        if not isinstance(catalog, Mapping):
            return
        names = _resolve(catalog.get("Names"))
        if isinstance(names, Mapping):
            self.counts["scripts"] += _leaves(names.get("JavaScript"))
            self.counts["files"] += _leaves(names.get("EmbeddedFiles"))
        self.action(catalog.get("OpenAction"))
        self.actions(catalog.get("AA"))
        form = _resolve(catalog.get("AcroForm"))
        if isinstance(form, Mapping) and form.get("XFA") is not None:
            self.counts["scripts"] += 1  # an XFA form may carry scripts; none is ever run

    def annotation(self, annotation: Mapping[str, Any]) -> None:
        if _name(annotation.get("Subtype")) == "FileAttachment":
            self.counts["files"] += 1
        self.action(annotation.get("A"))
        self.actions(annotation.get("AA"))

    def actions(self, value: object) -> None:
        table = _resolve(value)
        if isinstance(table, Mapping):
            for action in table.values():
                self.action(action)

    def action(self, value: object, depth: int = 0) -> None:
        if isinstance(value, PDFObjRef):
            if value.objid in self._seen:
                return
            self._seen.add(value.objid)
        action = _resolve(value)
        if not isinstance(action, Mapping) or depth > _MAX_DEPTH or self._actions >= _MAX_ACTIONS:
            return
        self._actions += 1
        kind = _name(action.get("S"))
        if kind in _SCRIPT_ACTIONS or (kind == "Rendition" and action.get("JS") is not None):
            self.counts["scripts"] += 1
        elif kind in _LAUNCH_ACTIONS:
            self.counts["launches"] += 1
        elif kind in _LINK_ACTIONS:
            self.counts["links"] += 1
        elif kind in _REMOTE_ACTIONS:
            self.counts["remote"] += 1
        following = _resolve(action.get("Next"))
        for item in following if isinstance(following, list) else [action.get("Next")]:
            if item is not None:
                self.action(item, depth + 1)


def _leaves(value: object) -> int:
    """How many entries a name tree holds, each node read once, to `_MAX_DEPTH` levels."""
    seen: set[int] = set()
    count = 0
    stack: list[tuple[object, int]] = [(value, 0)]
    while stack:
        node, depth = stack.pop()
        if isinstance(node, PDFObjRef):
            if node.objid in seen:
                continue
            seen.add(node.objid)
        node = _resolve(node)
        if not isinstance(node, Mapping) or depth > _MAX_DEPTH:
            continue
        names = _resolve(node.get("Names"))
        if isinstance(names, list):
            count += len(names) // 2
        kids = _resolve(node.get("Kids"))
        if isinstance(kids, list):
            stack.extend((kid, depth + 1) for kid in kids)
    return count


def read_file(path: Path) -> dict[str, Any]:
    with path.open("rb") as stream:
        return read(stream)
