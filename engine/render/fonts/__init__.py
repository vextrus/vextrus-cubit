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
its extension, cut to `MAX_NAME` characters, and capitalised as its family is written when it is typed
all in one case, as file names usually are (`romans.shx`: Romans; `sutonnymj.ttf`: SutonnyMJ).

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
(engine/messages/font_report.py). **A row is a name the drawing asks for** (and its kind): Arial named
by a style and `{\\fArial|b1;…}` inline are one row, one font, whose faces (bold, italic) are the row's
detail, and "drawn with" is the free font's family (Liberation Sans, whichever of its faces draws it).
"""

import unicodedata
from collections import Counter
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from enum import StrEnum
from functools import lru_cache

from engine.messages import Message
from engine.messages import font_report as codes
from engine.read.artefact import ReadArtefact, Text
from engine.render.fonts.glyphs import FontKey, _true_type, strokes
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
        """The free font's family (Liberation Sans for its regular and bold faces alike)."""
        return FAMILY_OF[self.key]

    @property
    def row(self) -> tuple[str, str]:
        """The report's row it belongs to: the name the drawing asks for, in any case, and its kind."""
        return (self.asked.casefold(), self.kind)


FAMILY_OF = {
    FontKey.SANS: "Liberation Sans",
    FontKey.SANS_BOLD: "Liberation Sans",
    FontKey.SERIF: "Liberation Serif",
    FontKey.STROKE: "Hershey Simplex",
}
"""The family of each font Vextrus draws with, as the report names it."""


class Face(StrEnum):
    """How a run asks for its font: a detail of the report's row, never a row of its own."""

    REGULAR = "regular"
    BOLD = "bold"
    ITALIC = "italic"
    BOLD_ITALIC = "bold_italic"

    @classmethod
    def of(cls, bold: bool, italic: bool) -> Face:
        return {(False, False): cls.REGULAR, (True, False): cls.BOLD, (False, True): cls.ITALIC,
                (True, True): cls.BOLD_ITALIC}[(bold, italic)]  # fmt: skip


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


_INITIALS = frozenset({"ms", "mt", "bt", "itc"})
"""Words a font's name writes in capitals: its foundry's initials (Arial Unicode MS, Swiss 721 BT)."""


def _capitalised(name: str) -> str:
    """A name typed all in one case, capitalised as its family is written: each word's first letter,
    and Mustafa Jabbar's MJ or OMJ (sutonnymj: SutonnyMJ; sutonnyomj: SutonnyOMJ). A name in mixed
    case is the drawing's own."""
    if not (name.islower() or name.isupper()):
        return name
    name = " ".join(
        word.upper() if word.casefold() in _INITIALS else word[:1].upper() + word[1:].lower()
        for word in name.split(" ")
    )
    if name.casefold().endswith("omj") and len(name) > 3:
        name = name[:-3] + "OMJ"  # Mustafa Jabbar's Unicode OpenType fonts: SutonnyOMJ
    elif is_bangla_ansi_font(name):
        name = name[:-2] + "MJ"
    return name


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
    key = normalise(name)
    if extension == "shx" or (extension is None and key in KNOWN_SHX):
        asked = stem[:MAX_NAME]
        return Substitute(
            asked[:1].upper() + asked[1:].lower(), "shx", FontKey.STROKE, HowClose.SINGLE_STROKE
        )
    asked = _capitalised(stem[:MAX_NAME])
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
    """One row of the report: a name the drawing asks for, what draws it, in how many texts and in
    which faces."""

    substitute: Substitute
    texts: int
    faces: tuple[Face, ...] = (Face.REGULAR,)

    def to_json(self) -> dict[str, object]:
        s = self.substitute
        return {
            "asked": s.asked,
            "kind": s.kind,
            "drawn_with": s.drawn_with,
            "how_close": str(s.how_close),
            "texts": self.texts,
            "faces": [str(face) for face in self.faces],
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


def uses_of(text: Text) -> Iterator[tuple[Substitute, str, Face]]:
    """Each font a text is drawn with, the characters it draws with it and the face they ask for (an
    MTEXT's inline fonts included; a run with no inline font uses the style's)."""
    if text.type != "MTEXT":
        yield substitute(text.font), decode(text.text), Face.REGULAR
        return
    for run in runs(text.text):
        name = run.style.font if run.style.font is not None else text.font
        yield substitute(name, run.style.bold), run.text, Face.of(run.style.bold, run.style.italic)


def fonts_of(text: Text) -> Iterator[tuple[Substitute, str]]:
    """`uses_of` without the faces."""
    for used, characters, _ in uses_of(text):
        yield used, characters


class FontTally:
    """Texts counted per row of the report (the module's docstring): a text naming Arial by its style
    and again inline in bold counts once, in one row, with both faces."""

    def __init__(self) -> None:
        self._texts: Counter[tuple[str, str]] = Counter()
        self._named: dict[tuple[str, str], Substitute] = {}
        self._faces: dict[tuple[str, str], set[Face]] = {}

    def __bool__(self) -> bool:
        return bool(self._texts)

    def add(self, uses: Iterable[tuple[Substitute, Face]]) -> None:
        """One text's fonts."""
        rows = set()
        for used, face in uses:
            if not used.asked:
                continue
            row = used.row
            rows.add(row)
            self._faces.setdefault(row, set()).add(face)
            shown = self._named.get(row)
            if shown is None or _rank(used) < _rank(shown):
                self._named[row] = used
        self._texts.update(rows)

    def rows(self) -> tuple[FontUse, ...]:
        order = list(Face)
        return tuple(
            FontUse(self._named[row], n, tuple(sorted(self._faces[row], key=order.index)))
            for row, n in sorted(self._texts.items())
        )


def _rank(used: Substitute) -> tuple[bool, str]:
    """Which of a row's substitutes it shows: the regular face's, then its name's first spelling."""
    return (used.key is FontKey.SANS_BOLD, used.asked)


def report(artefact: ReadArtefact) -> FontReport:
    """The font report of a drawing (the module's docstring)."""
    tally = FontTally()
    heights = Heights(artefact)
    texts = defaulted = missing = 0
    for entity in artefact.entities.values():
        if not isinstance(entity, Text):
            continue
        texts += 1
        named: list[tuple[Substitute, Face]] = []
        lacking = False
        for used, characters, face in uses_of(entity):
            named.append((used, face))
            lacking = lacking or not all(drawable(used.key, c) for c in characters)
        tally.add(named)
        missing += lacking
        defaulted += heights.local(entity)[1] is HeightSource.DEFAULT
    rows = tally.rows()
    by_close = Counter(str(row.substitute.how_close) for row in rows)
    counts = {
        "fonts_named": len(rows),
        **{str(how): by_close.get(str(how), 0) for how in HowClose},
        "texts": texts,
        "texts_height_defaulted": defaulted,
        "texts_glyphs_missing": missing,
    }
    return FontReport(rows, texts, defaulted, missing, counts)
