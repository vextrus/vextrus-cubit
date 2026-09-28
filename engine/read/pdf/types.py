"""What `engine.read.pdf` returns: a PDF's upload report, and each page's text for registration.

Both are values, each to JSON (a box's and a size's numbers as decimal strings, never floats: docs/
data-model.md §2). The report carries what a QS reads as message codes and parameters (`messages`,
worded in web/src/messages/engine/pdf_report/en.po) and the counts the real-drawing check compares
(`counts`); the pages carry text items, each anchored where the page draws it.
"""

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from engine.messages import Message
from engine.read._json import decimal_string
from engine.read.anchor import PdfAnchor

type Box = tuple[float, float, float, float]


class TextSource(StrEnum):
    """Where a text item was read from."""

    TEXT = "text"
    """A text object the page draws: real text, as sure as the PDF's own."""
    HIDDEN_TEXT = "hidden_text"
    """A text object the page does not draw (render mode 3 or 7): AutoCAD writes its SHX text so
    with PDFSHX at 2; a scanner writes its OCR so."""
    SHX_COMMENT = "shx_comment"
    """An "AutoCAD SHX Text" comment: the string and its box only, a lower confidence than text (its
    symbols are raw codes such as `%%C`, and a stacked fraction loses its order)."""


class Lettering(StrEnum):
    """What a page's lettering is, by the rule in engine/read/pdf's docstring."""

    COMMENTS = "comments"
    """It carries SHX comments or hidden text: the plot kept its AutoCAD lettering as text."""
    TEXT = "text"
    """No comments and no hidden text, but real text: AutoCAD's own lettering, if any, is lines."""
    LINES = "lines"
    """Drawn, with next to no text and no comments: its lettering is drawn as lines."""
    NONE = "none"
    """Nothing drawn and next to no text (a blank page, or a scan)."""


class MadeBy(StrEnum):
    AUTOCAD = "autocad"
    OTHER = "other"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class TextItem:
    """One text item on a page: a run of glyphs drawn as one, or one SHX comment."""

    text: str
    """As the PDF holds it: never decoded here (`%%C` stays; 11's decode function reads it)."""
    source: TextSource
    anchor: PdfAnchor
    size: float | None
    """Its size on the page, in points; none for a comment, which gives only a box."""
    angle: float | None
    """The direction it advances in, degrees anticlockwise from the page's x axis; none for a comment."""
    mirrored: bool
    font: str | None

    def to_json(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "source": str(self.source),
            "anchor": self.anchor.to_json(),
            "size": _decimal(self.size),
            "angle": _decimal(self.angle),
            "mirrored": self.mirrored,
            "font": self.font,
        }


@dataclass(frozen=True)
class Page:
    """One page's text for registration (18 matches pages to sheets by it)."""

    source_sha256: str
    number: int
    """Counting from 1."""
    width: float
    height: float
    """The page as displayed (its `/Rotate` applied), in points."""
    rotate: int
    crop: Box
    """The visible part of the page (its CropBox), in the same frame."""
    scan: bool
    items: tuple[TextItem, ...]
    """In drawing order: the text objects, then the page's SHX comments."""

    def to_json(self) -> dict[str, Any]:
        return {
            "source_sha256": self.source_sha256,
            "number": self.number,
            "width": decimal_string(self.width),
            "height": decimal_string(self.height),
            "rotate": self.rotate,
            "crop": [decimal_string(v) for v in self.crop],
            "scan": self.scan,
            "items": [item.to_json() for item in self.items],
        }


@dataclass(frozen=True)
class FontUse:
    name: str
    """The font's name, its subset tag removed."""
    kind: str
    """`truetype`, `type1`, `type0`, `type3`, or `unreadable` (its program or tables were damaged)."""
    embedded: bool
    pages: int


@dataclass(frozen=True)
class PageReport:
    number: int
    readable: bool
    """False when the page is damaged: what it drew before the damage is counted."""
    rotate: int
    width: float
    height: float
    shx_comments: int
    chars: int
    """Glyphs drawn as text, spaces not counted."""
    hidden_chars: int
    unmapped_chars: int
    """Glyphs whose font does not say which letter they are."""
    mirrored_texts: int
    strokes: int
    fills: int
    images: int
    picture_share: float
    """The share of the page's area its pictures cover, 0 to 1."""
    mostly_picture: bool
    layers: tuple[str, ...]
    lettering: Lettering
    scan: bool

    def to_json(self) -> dict[str, Any]:
        return {
            "number": self.number,
            "readable": self.readable,
            "rotate": self.rotate,
            "width": decimal_string(self.width),
            "height": decimal_string(self.height),
            "shx_comments": self.shx_comments,
            "chars": self.chars,
            "hidden_chars": self.hidden_chars,
            "unmapped_chars": self.unmapped_chars,
            "mirrored_texts": self.mirrored_texts,
            "strokes": self.strokes,
            "fills": self.fills,
            "images": self.images,
            "picture_share": decimal_string(self.picture_share),
            "mostly_picture": self.mostly_picture,
            "layers": list(self.layers),
            "lettering": str(self.lettering),
            "scan": self.scan,
        }


@dataclass(frozen=True)
class PdfReport:
    """A PDF's upload report (ADR 0014; m0-screens 4.5, "The report panel for a PDF")."""

    source_sha256: str
    producer: str | None
    creator: str | None
    made_by: MadeBy
    pages: tuple[PageReport, ...]
    fonts: tuple[FontUse, ...]
    layers: tuple[str, ...]
    """Every layer name the pages' resources list, in order."""
    extras: dict[str, int]
    """What the PDF holds beyond the drawing, never run or opened: `scripts`, `launches`, `links`
    (web addresses), `remote` (actions naming another file) and `files` (attached)."""
    refused: Message | None
    """Why the PDF is refused (a scan), or none."""
    messages: tuple[Message, ...]
    """What the QS reads, in the report's order: made by, pages, lettering, layers, pictures, fonts,
    and the refusal last. The extras are counted here, never shown."""

    @property
    def counts(self) -> dict[str, int]:
        """The counts the real-drawing check compares, by name."""
        pages = self.pages
        return {
            "pages": len(pages),
            "rotated_pages": sum(p.rotate != 0 for p in pages),
            "unreadable_pages": sum(not p.readable for p in pages),
            "shx_comments": sum(p.shx_comments for p in pages),
            "pages_with_shx_comments": sum(p.shx_comments > 0 for p in pages),
            "chars": sum(p.chars for p in pages),
            "hidden_chars": sum(p.hidden_chars for p in pages),
            "unmapped_chars": sum(p.unmapped_chars for p in pages),
            "mirrored_texts": sum(p.mirrored_texts for p in pages),
            "pages_lettering_comments": sum(p.lettering is Lettering.COMMENTS for p in pages),
            "pages_lettering_text": sum(p.lettering is Lettering.TEXT for p in pages),
            "pages_lettering_lines": sum(p.lettering is Lettering.LINES for p in pages),
            "fonts": len(self.fonts),
            "fonts_not_embedded": sum(not f.embedded for f in self.fonts),
            "fonts_type3": sum(f.kind == "type3" for f in self.fonts),
            "fonts_unreadable": sum(f.kind == "unreadable" for f in self.fonts),
            "layers": len(self.layers),
            "images": sum(p.images for p in pages),
            "pages_with_images": sum(p.images > 0 for p in pages),
            "pages_mostly_picture": sum(p.mostly_picture for p in pages),
            "scan_pages": sum(p.scan for p in pages),
            "refused": int(self.refused is not None),
            **{f"extras_{name}": count for name, count in sorted(self.extras.items())},
        }

    def to_json(self) -> dict[str, Any]:
        return {
            "source_sha256": self.source_sha256,
            "producer": self.producer,
            "creator": self.creator,
            "made_by": str(self.made_by),
            "pages": [page.to_json() for page in self.pages],
            "fonts": [
                {"name": f.name, "kind": f.kind, "embedded": f.embedded, "pages": f.pages}
                for f in self.fonts
            ],
            "layers": list(self.layers),
            "extras": dict(self.extras),
            "refused": self.refused,
            "messages": list(self.messages),
            "counts": self.counts,
        }


def _decimal(value: float | None) -> str | None:
    return None if value is None else decimal_string(value)
