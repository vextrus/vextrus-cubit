"""The font substitution table and the font report (the M0 plan, ticket 11; ADR 0022; m0-screens 4.5).

Vextrus cannot ship AutoCAD's fonts, so it draws every font a drawing names with one it may ship
(files/, each with its licence): **Liberation Sans, Liberation Sans Bold and Liberation Serif** (SIL
OFL 1.1) and the **Hershey Roman Simplex** single-stroke font (public domain data with a notice).
Liberation Sans Narrow (GPL-2 with the font exception) and DejaVu (a Bitstream Vera derivative) are
not shipped: neither licence is OFL, Apache or public domain.

`substitute(name)` resolves one font name, as a style (`romans.shx`, `arial.ttf`) or an MTEXT's inline
font (`\\fArial|b1;`, `\\Fromans|c0;`) names it. **A name is only ever a key into the table below:**
its last path component, cut at a `?` or `#`, without its extension, folded to lower case and with its
spaces removed. It never reaches the file system, so `../../etc/passwd`, `/etc/passwd` or a URL is an
unknown font, drawn with Liberation Sans. The name shown to a QS is the same last component, without
its extension, cut to `MAX_NAME` characters.

**How close** (m0-screens 4.5's six answers; `HowClose`) is claimed only from a measurement or from a
certainty, never guessed (docs/research/viewer-2d-fidelity.md, "Font policy"):
- `same_widths`: Arial (every weight) by Liberation Sans, Times New Roman by Liberation Serif (Liberation
  is made metric-compatible with them; measured -0.1 % and 0.0 %);
- `wider`: Swiss 721 by Liberation Sans (measured +2.3 %), and the condensed faces (Arial Narrow, Swiss
  721 Condensed) by Liberation Sans, wider by the width of a regular face over a condensed one
  (direction certain, size not measured);
- `narrower`: Times New Roman Bold by Liberation Serif (a regular face for a bold one);
- `single_stroke`: every SHX font (AutoCAD lettering) by the Hershey simplex, which matched the plot's
  width at 0.997 (docs/knowledge/lessons.md);
- `bangla_ansi`: a Bijoy-style font (`engine.check.bangla_ansi`), drawn with Liberation Sans;
- `not_found`: any other name, drawn with Liberation Sans.

`report(artefact)` is the stage the harness calls (the M0 plan's contract). It lists every font the
drawing's texts name, by style and inline, with its substitute and how close, and counts them; the
harness reads `counts`, and the product stores the report's rows as message codes and parameters
(engine/messages/font_report.py).
"""

import unicodedata
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass, field
from enum import StrEnum
from functools import lru_cache

from engine.messages import Message
from engine.messages import font_report as codes
from engine.read.artefact import ReadArtefact, Text
from engine.render.fonts.glyphs import NAME_OF, FontKey, _true_type, strokes
from engine.text.decode import decode, runs
from engine.text.mtext import Heights, HeightSource

MAX_NAME = 64
_EXTENSIONS = frozenset({"ttf", "ttc", "otf", "shx", "pfb", "pfm", "fon"})
KNOWN_SHX = frozenset(
    {"txt", "simplex", "romans", "romand", "romanc", "romant", "italic", "italicc", "italict",
     "scripts", "scriptc", "greeks", "greekc", "gothice", "gothicg", "gothici", "syastro", "symap",
     "symath", "symeteo", "symusic", "monotxt", "isocp", "isocp2", "isocp3", "isoct", "isoct2",
     "isoct3", "complex", "gdt", "ltypeshp", "bigfont", "chineset", "extfont", "extfont2"}
)  # fmt: skip
"""SHX fonts a style may name without the extension (AutoCAD's own)."""


class HowClose(StrEnum):
    SAME_WIDTHS = "same_widths"
    SINGLE_STROKE = "single_stroke"
    WIDER = "wider"
    NARROWER = "narrower"
    NOT_FOUND = "not_found"
    BANGLA_ANSI = "bangla_ansi"


@dataclass(frozen=True)
class _Entry:
    key: FontKey
    display: str
    how_close: HowClose


_SANS, _BOLD, _SERIF = FontKey.SANS, FontKey.SANS_BOLD, FontKey.SERIF
_SAME, _WIDER, _NARROWER = HowClose.SAME_WIDTHS, HowClose.WIDER, HowClose.NARROWER
TABLE: dict[str, _Entry] = {
    # Arial and its file names (Liberation Sans is metric-compatible with every weight).
    "arial": _Entry(_SANS, "Arial", _SAME),
    "arialbd": _Entry(_BOLD, "Arial Bold", _SAME),
    "ariali": _Entry(_SANS, "Arial Italic", _SAME),
    "arialbi": _Entry(_BOLD, "Arial Bold Italic", _SAME),
    "arialbold": _Entry(_BOLD, "Arial Bold", _SAME),
    # Times New Roman.
    "times": _Entry(_SERIF, "Times New Roman", _SAME),
    "timesnewroman": _Entry(_SERIF, "Times New Roman", _SAME),
    "timesi": _Entry(_SERIF, "Times New Roman Italic", _SAME),
    "timesbd": _Entry(_SERIF, "Times New Roman Bold", _NARROWER),
    "timesbi": _Entry(_SERIF, "Times New Roman Bold Italic", _NARROWER),
    # Swiss 721 (Bitstream's names for AutoCAD's bundled TrueType files).
    "swiss": _Entry(_SANS, "Swiss 721", _WIDER),
    "swis721bt": _Entry(_SANS, "Swiss 721", _WIDER),
    "swissc": _Entry(_SANS, "Swiss 721 Condensed", _WIDER),
    "swis721cnbt": _Entry(_SANS, "Swiss 721 Condensed", _WIDER),
    "swisscb": _Entry(_BOLD, "Swiss 721 Bold Condensed", _WIDER),
    "swis721bdcnbt": _Entry(_BOLD, "Swiss 721 Bold Condensed", _WIDER),
    "swisscl": _Entry(_SANS, "Swiss 721 Light Condensed", _WIDER),
    "swis721ltcnbt": _Entry(_SANS, "Swiss 721 Light Condensed", _WIDER),
    # Arial Narrow.
    "arialn": _Entry(_SANS, "Arial Narrow", _WIDER),
    "arialnarrow": _Entry(_SANS, "Arial Narrow", _WIDER),
    "arialnb": _Entry(_BOLD, "Arial Narrow Bold", _WIDER),
}
"""Known fonts, by normalised name (`normalise`), with the shipped font and how close it is."""


@dataclass(frozen=True)
class Substitute:
    """What Vextrus draws a named font with."""

    asked: str
    """The font's name for a QS: no folder, no extension."""
    kind: str
    """`shx` for AutoCAD's own lettering, else `other`."""
    key: FontKey
    how_close: HowClose

    @property
    def drawn_with(self) -> str:
        return NAME_OF[self.key]


def _component(name: str) -> str:
    """The name's last path component, cut at a query or fragment, without control characters."""
    last = name.replace("\\", "/").rsplit("/", 1)[-1]
    last = last.split("?", 1)[0].split("#", 1)[0]
    return "".join(c for c in last if unicodedata.category(c)[0] != "C").strip()


def _split(name: str) -> tuple[str, str | None]:
    component = _component(name)
    stem, dot, extension = component.rpartition(".")
    if dot and extension.lower() in _EXTENSIONS and stem:
        return stem, extension.lower()
    return component, None


def normalise(name: str) -> str:
    """The table's key for a font name (the module's docstring)."""
    stem, _ = _split(name)
    return "".join(stem.split()).casefold()


def is_bangla_ansi_font(name: str) -> bool:
    """A Bijoy-style font: its family ends in `MJ`, but not `OMJ` (Mustafa Jabbar's Unicode OpenType
    fonts, which must not be flagged). The evidence is in `engine.check.bangla_ansi`'s docstring."""
    key = normalise(name)
    return key.endswith("mj") and not key.endswith("omj") and len(key) > 2


@lru_cache(maxsize=4096)
def substitute(name: str | None, bold: bool = False) -> Substitute:
    """What Vextrus draws the named font with (none named: Liberation Sans, not found)."""
    if name is None or not _component(name):
        return Substitute("", "other", FontKey.SANS, HowClose.NOT_FOUND)
    stem, extension = _split(name)
    asked = stem[:MAX_NAME]
    key = normalise(name)
    if extension == "shx" or (extension is None and key in KNOWN_SHX):
        return Substitute(
            asked[:1].upper() + asked[1:].lower(), "shx", FontKey.STROKE, HowClose.SINGLE_STROKE
        )
    if is_bangla_ansi_font(name):
        return Substitute(asked, "other", FontKey.SANS, HowClose.BANGLA_ANSI)
    entry = TABLE.get(key)
    if entry is None:
        return Substitute(
            asked, "other", FontKey.SANS_BOLD if bold else FontKey.SANS, HowClose.NOT_FOUND
        )
    font = FontKey.SANS_BOLD if bold and entry.key is FontKey.SANS else entry.key
    return Substitute(entry.display, "other", font, entry.how_close)


def has_glyph(key: FontKey, char: str) -> bool:
    if key is FontKey.STROKE:
        return strokes(char) is not None
    return ord(char) in _true_type(key).cmap


def drawable(key: FontKey, char: str) -> bool:
    """Whether a character is drawn with a real glyph: by the font, or, for the single-stroke font, by
    Liberation Sans in its place (⌀ in an outline font is drawn as Ø)."""
    if char.isspace() or has_glyph(key, char):
        return True
    if char == "⌀":
        return True
    return key is FontKey.STROKE and has_glyph(FontKey.SANS, char)


@dataclass(frozen=True)
class FontUse:
    """One row of the report: a font the drawing names, what draws it and in how many texts."""

    substitute: Substitute
    texts: int

    def to_json(self) -> dict[str, object]:
        s = self.substitute
        return {
            "asked": s.asked,
            "kind": s.kind,
            "drawn_with": s.drawn_with,
            "how_close": str(s.how_close),
            "texts": self.texts,
            "asked_message": codes.ASKED(asked=s.asked, kind=s.kind),
            "how_close_message": codes.HOW_CLOSE(how_close=str(s.how_close), drawn_with=s.drawn_with),
        }


@dataclass(frozen=True)
class FontReport:
    """The fonts a drawing names, what Vextrus draws each with, and the counts the harness reads."""

    fonts: tuple[FontUse, ...]
    texts: int
    height_defaulted: int
    glyphs_missing: int
    counts: dict[str, int] = field(default_factory=dict)

    def messages(self) -> list[Message]:
        """The section's lines; none when the drawing names no font (the section is hidden)."""
        found = [codes.SUMMARY(fonts=len(self.fonts))] if self.fonts else []
        if self.height_defaulted:
            found.append(codes.HEIGHT_DEFAULTED(count=self.height_defaulted))
        if self.glyphs_missing:
            found.append(codes.GLYPHS_MISSING(count=self.glyphs_missing))
        return found

    def to_json(self) -> dict[str, object]:
        return {
            "counts": dict(self.counts),
            "fonts": [use.to_json() for use in self.fonts],
            "messages": self.messages(),
        }


def fonts_of(text: Text) -> Iterator[tuple[Substitute, str]]:
    """Each font a text is drawn with and the characters it draws with it (an MTEXT's inline fonts
    included; a run with no inline font uses the style's)."""
    if text.type != "MTEXT":
        yield substitute(text.font), decode(text.text)
        return
    for run in runs(text.text):
        name = run.style.font if run.style.font is not None else text.font
        yield substitute(name, run.style.bold), run.text


def report(artefact: ReadArtefact) -> FontReport:
    """The font report of a drawing (the module's docstring)."""
    uses: Counter[Substitute] = Counter()
    heights = Heights(artefact)
    texts = defaulted = missing = 0
    for entity in artefact.entities.values():
        if not isinstance(entity, Text):
            continue
        texts += 1
        named: set[Substitute] = set()
        lacking = False
        for used, characters in fonts_of(entity):
            named.add(used)
            lacking = lacking or not all(drawable(used.key, c) for c in characters)
        for used in named:
            if used.asked:
                uses[used] += 1
        missing += lacking
        defaulted += heights.local(entity)[1] is HeightSource.DEFAULT
    rows = tuple(
        FontUse(s, n)
        for s, n in sorted(uses.items(), key=lambda item: (item[0].asked.casefold(), item[0].key))
    )
    by_close = Counter(str(row.substitute.how_close) for row in rows)
    counts = {
        "fonts_named": len(rows),
        **{str(how): by_close.get(str(how), 0) for how in HowClose},
        "texts": texts,
        "texts_height_defaulted": defaulted,
        "texts_glyphs_missing": missing,
    }
    return FontReport(rows, texts, defaulted, missing, counts)
