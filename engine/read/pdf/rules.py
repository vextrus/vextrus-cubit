"""From a PDF's facts to its report and its pages: the rules engine/read/pdf's docstring states.

Pure functions over `facts.DocumentFacts`, so each rule is tested just either side of its edges
without a PDF.
"""

import re
from collections.abc import Sequence

from engine.messages import Message
from engine.messages import pdf_report as codes
from engine.read.anchor import PdfAnchor
from engine.read.pdf.facts import DocumentFacts, PageFacts
from engine.read.pdf.types import (
    FontUse,
    Lettering,
    MadeBy,
    Page,
    PageReport,
    PdfReport,
    TextItem,
)

MOSTLY_PICTURE = 0.5
"""A page is mostly a picture when its pictures cover more than this share of its area."""
FEW_CHARS = 20
"""A drawn page with fewer glyphs of text than this, and no comments or hidden text, has its lettering
drawn as lines."""
_AUTOCAD = re.compile(r"autocad|dwg to pdf", re.IGNORECASE)


def made_by(producer: str | None, creator: str | None) -> MadeBy:
    """AutoCAD when the producer names it; the producer is the last program to write the file, so a
    merged or re-saved plot names its merger. The creator counts only when there is no producer."""
    named = producer or creator
    if named is None:
        return MadeBy.UNKNOWN
    return MadeBy.AUTOCAD if _AUTOCAD.search(named) else MadeBy.OTHER


def is_scan(page: PageFacts, share: float) -> bool:
    """Mostly a picture, with no text drawn and no stroke: nothing on it but pictures (and hidden
    text, which is what a scanner's OCR writes)."""
    return share > MOSTLY_PICTURE and page.chars == 0 and page.strokes == 0


def lettering(page: PageFacts) -> Lettering:
    if page.shx_comments > 0 or page.hidden_chars > 0:
        return Lettering.COMMENTS
    if page.chars >= FEW_CHARS:
        return Lettering.TEXT
    if page.strokes > 0:
        return Lettering.LINES
    return Lettering.NONE


def page_reports(facts: DocumentFacts) -> tuple[PageReport, ...]:
    reports = []
    for page in facts.pages:
        share = page.picture_share
        reports.append(
            PageReport(
                number=page.number,
                readable=page.readable,
                rotate=page.rotate,
                width=page.width,
                height=page.height,
                shx_comments=page.shx_comments,
                chars=page.chars,
                hidden_chars=page.hidden_chars,
                unmapped_chars=page.unmapped_chars,
                mirrored_texts=sum(item.mirrored for item in page.items),
                strokes=page.strokes,
                fills=page.fills,
                images=page.images,
                picture_share=share,
                mostly_picture=share > MOSTLY_PICTURE,
                layers=page.layers,
                lettering=lettering(page),
                scan=is_scan(page, share),
            )
        )
    return tuple(reports)


def report(facts: DocumentFacts, source_sha256: str) -> PdfReport:
    pages = page_reports(facts)
    fonts = _fonts(facts)
    layers = tuple(dict.fromkeys(name for page in facts.pages for name in page.layers))
    maker = made_by(facts.producer, facts.creator)
    refused = codes.SCAN() if pages and all(page.scan for page in pages) else None
    messages: list[Message] = [_made_by(maker, _maker_name(facts.producer or facts.creator))]
    messages.append(codes.PAGES(pages=len(pages), turned=sum(p.rotate != 0 for p in pages)))
    messages += [codes.PAGE_UNREADABLE(page=p.number) for p in pages if not p.readable]
    if refused is None:
        messages += _lettering(pages)
        messages.append(
            codes.LAYERS_KEPT(layers=len(layers)) if len(layers) > 1 else codes.LAYERS_FLATTENED()
        )
        messages += _pictures(pages)
        messages += _font_messages(fonts)
    if refused is not None:
        messages.append(refused)
    return PdfReport(
        source_sha256=source_sha256,
        producer=facts.producer,
        creator=facts.creator,
        made_by=maker,
        pages=pages,
        fonts=fonts,
        layers=layers,
        extras=dict(facts.extras),
        refused=refused,
        messages=tuple(messages),
    )


def pages(facts: DocumentFacts, source_sha256: str, reader: str, reader_version: str) -> list[Page]:
    found = []
    for page in facts.pages:
        items = tuple(
            TextItem(
                text=item.text,
                source=item.source,
                anchor=PdfAnchor(
                    source_sha256=source_sha256,
                    reader=reader,
                    reader_version=reader_version,
                    page=page.number,
                    path_index=item.index,
                    box=item.box,
                ),
                size=item.size,
                angle=item.angle,
                mirrored=item.mirrored,
                font=item.font,
            )
            for item in page.items
        )
        found.append(
            Page(
                source_sha256=source_sha256,
                number=page.number,
                width=page.width,
                height=page.height,
                rotate=page.rotate,
                crop=page.crop,
                scan=is_scan(page, page.picture_share),
                items=items,
            )
        )
    return found


def _made_by(maker: MadeBy, producer: str | None) -> Message:
    if maker is MadeBy.AUTOCAD:
        return codes.MADE_BY_AUTOCAD()
    if maker is MadeBy.OTHER and producer is not None:
        return codes.MADE_BY_OTHER(producer=producer)
    return codes.MADE_BY_UNKNOWN()


def _lettering(pages: Sequence[PageReport]) -> list[Message]:
    drawn = [p for p in pages if p.lettering is not Lettering.NONE and not p.scan]
    if not drawn:
        return []
    commented = sum(p.lettering is Lettering.COMMENTS for p in drawn)
    text = sum(p.lettering is Lettering.TEXT for p in drawn)
    lines = sum(p.lettering is Lettering.LINES for p in drawn)
    # With comments on any page the plot had PDFSHX on, so a page of real text without them had no
    # SHX text to keep; with none anywhere, the PDF cannot say.
    kept = commented + (text if commented else 0)
    unconfirmed = 0 if commented else text
    messages: list[Message] = []
    if kept == len(drawn):
        messages.append(codes.LETTERING_KEPT())
    elif kept:
        messages.append(codes.LETTERING_PARTLY(pages=kept, of=len(drawn)))
    if lines:
        messages.append(codes.LETTERING_LINES(pages=lines))
    if unconfirmed and not lines:  # with lines as well, their message already asks for the setting
        messages.append(codes.LETTERING_UNCONFIRMED(pages=unconfirmed))
    unmapped = sum(p.unmapped_chars for p in pages)
    if unmapped:
        messages.append(codes.UNMAPPED_TEXT(chars=unmapped))
    return messages


def _pictures(pages: Sequence[PageReport]) -> list[Message]:
    pictured = [p for p in pages if p.images]
    if not pictured:
        return [codes.NO_PICTURES()]
    messages: list[Message] = []
    small = [p for p in pictured if not p.mostly_picture]
    if small:
        largest = max(p.picture_share for p in small)
        messages.append(codes.PICTURES(pages=len(small), percent=_percent(largest)))
    for page in pictured:
        if page.scan:
            messages.append(codes.SCAN_PAGE(page=page.number))
        elif page.mostly_picture:
            messages.append(codes.MOSTLY_PICTURE(page=page.number, percent=_percent(page.picture_share)))
    return messages


def _fonts(facts: DocumentFacts) -> tuple[FontUse, ...]:
    pages: dict[tuple[str, str, bool], int] = {}
    for page in facts.pages:
        for font in set(page.fonts):
            pages[font] = pages.get(font, 0) + 1
    return tuple(
        FontUse(name=name, kind=kind, embedded=embedded, pages=count)
        for (name, kind, embedded), count in sorted(pages.items())
    )


def _font_messages(fonts: Sequence[FontUse]) -> list[Message]:
    messages: list[Message] = []
    readable = [f for f in fonts if f.kind != "unreadable"]
    missing = sum(not f.embedded and f.kind != "type3" for f in readable)
    if missing:
        messages.append(codes.FONTS_NOT_EMBEDDED(fonts=missing))
    drawn = sum(f.kind == "type3" for f in readable)
    if drawn:
        messages.append(codes.FONTS_DRAWN(fonts=drawn))
    broken = len(fonts) - len(readable)
    if broken:
        messages.append(codes.FONTS_UNREADABLE(fonts=broken))
    return messages


def _maker_name(named: str | None) -> str | None:
    """The maker as a QS reads it: the name before any version note, `;` or copyright sign
    ("Adobe PDF Library 15.0; modified using iText" reads "Adobe PDF Library 15.0")."""
    if named is None:
        return None
    cut = re.split(r"[;©(]", named, maxsplit=1)[0].strip()
    return cut or named


def _percent(share: float) -> int:
    """A share as a whole percent, never 0 for a picture that is there."""
    return max(1, round(share * 100))
