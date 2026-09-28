"""The Bangla-ANSI Check (ADR 0031 §11; story 18): Bangla typed in an old Bijoy-style font.

Bijoy's fonts (SutonnyMJ and its kin) draw Bangla letters on the code points of Windows-1252's Latin
letters and signs, so a text typed in one is stored as Latin characters: it shows as Bangla only where
the font is installed, and no machine can read it. `run(artefact)` flags each such text, **by its
fonts' names** (the style's and the inline ones) **or by its characters' pattern**, and counts them.
`findings(sheet_of)` gives one line for the texts found by their font (naming the font) and another
for those found only by their characters, each with the texts it counts and the sheets they are on, in
a QS's words (engine/messages/bangla_ansi.py). Texts in a Unicode Bangla font are never flagged.

**The rules, and their evidence** (a research agent's report of 28 Sep 2026, from the fonts' own
tables and two independent converters; no real drawing was seen):
- **By name:** a font whose family ends in `MJ` is one of Mustafa Jabbar's Bijoy (ANSI) fonts, but one
  ending in `OMJ` is his Unicode OpenType version and must not be flagged. Five fonts from
  github.com/fahimscirex/bangla-fonts were opened with fontTools: TeeshtaMJ, PandulipiMJ and
  BurigangaSushreeMJ map no Bengali code point (U+0980-09FF) and cover Windows-1252; SutonnyOMJ and
  PadmaOMJ map 97 Bengali code points and carry a `beng` GSUB. `engine.render.fonts.is_bangla_ansi_font`.
- **By pattern:** Bijoy stores the vowel signs written before a consonant (e-kar ে, oi-kar ৈ) in visual
  order, as U+2020 †, U+2021 ‡, U+02C6 (a modifier circumflex) and U+2030 ‰ (Windows-1252 0x86 to 0x89),
  each followed by the consonant, an ASCII letter: `‡K` is কে. OmicronLab Avro's
  `clsUnicodeToBijoy2000.pas` (MPL-1.1, lines 98-102) and a second converter's table agree; only the
  facts are used, no code. An English drawing almost never writes a dagger or a per-mille sign before a
  letter, so one such pair flags a text. The weaker marks (`v` for া, `w` for ি, ¨ © ª «) are not used:
  they are ordinary English or would need a threshold nobody has measured.
- **Not detected:** Boishakhi, Bornosoft and other ANSI encodings, which put their signs on other code
  points; a Bijoy text with no pre-base vowel sign whose font was renamed.

Declares `CODE`, `VERSION`, `MILESTONE`, `KIND` and `MESSAGE` (the M0 plan's contract for a
Check, and engine/check/catalogue.py's).
"""

import re
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum

from engine.messages import Message
from engine.messages import bangla_ansi as codes
from engine.read.artefact import ReadArtefact, Text
from engine.render.fonts import HowClose, fonts_of

CODE = "bangla_ansi"
VERSION = 1
MILESTONE = "M0"
KIND = "sanity"
"""A flag, never a block (ADR 0027's sanity range raises a flag; engine/check/catalogue.py)."""
MESSAGE = codes.FOUND

PATTERN = re.compile("[\u2020\u2021\u02c6\u2030][A-Za-z`_]")
"""A Bijoy pre-base vowel sign (e-kar or oi-kar) followed by the consonant it goes before."""


class FoundBy(StrEnum):
    FONT = "font"
    PATTERN = "pattern"


@dataclass(frozen=True)
class Flagged:
    """One text: its handle, how it was found and, when by name, its font as a QS reads it."""

    handle: str
    by: FoundBy
    font: str | None = None


@dataclass(frozen=True)
class BanglaAnsi:
    """The Check's result on one file: the flagged texts and the counts the harness reads."""

    texts: tuple[Flagged, ...]

    @property
    def fonts(self) -> tuple[str, ...]:
        """The Bijoy-style fonts named, the most used first."""
        used = Counter(t.font for t in self.texts if t.font is not None)
        return tuple(name for name, _ in sorted(used.items(), key=lambda item: (-item[1], item[0])))

    @property
    def counts(self) -> dict[str, int]:
        return {
            "texts": len(self.texts),
            "by_font": sum(t.by is FoundBy.FONT for t in self.texts),
            "by_pattern": sum(t.by is FoundBy.PATTERN for t in self.texts),
            "fonts": len(self.fonts),
        }

    def findings(self, sheet_of: Callable[[str], str | None]) -> list[Message]:
        """The file's lines: the texts found by their font, then those found only by their characters,
        each counted with the sheets they lie on and how many lie on none (`sheet_of` gives a text's
        sheet by its handle, none when it is on none); no line for a kind with no text. When both show,
        `also` is `yes`, so the second closes the pair and the first does not say nothing else is
        affected before the second shows more."""
        by_font = [t.handle for t in self.texts if t.by is FoundBy.FONT]
        by_pattern = [t.handle for t in self.texts if t.by is FoundBy.PATTERN]
        also = "yes" if by_font and by_pattern else "no"
        found = []
        if by_font:
            fonts = self.fonts
            found.append(
                codes.FOUND(
                    **_where(by_font, sheet_of), font=fonts[0], other_fonts=len(fonts) - 1, also=also
                )
            )
        if by_pattern:
            found.append(codes.FOUND_BY_PATTERN(**_where(by_pattern, sheet_of), also=also))
        return found

    def to_json(self) -> dict[str, object]:
        return {
            "counts": self.counts,
            "fonts": list(self.fonts),
            "texts": [{"handle": t.handle, "by": str(t.by), "font": t.font} for t in self.texts],
        }


def _where(handles: list[str], sheet_of: Callable[[str], str | None]) -> dict[str, int]:
    sheets = [sheet_of(h) for h in handles]
    outside = sum(s is None for s in sheets)
    return {
        "texts": len(handles),
        "on_sheets": len(handles) - outside,
        "sheets": len({s for s in sheets if s is not None}),
        "outside": outside,
    }


def sheet_line(sheet: str, texts: int) -> Message:
    """One sheet's line under the finding (its number as the sheet states it)."""
    return codes.SHEET(sheet=sheet, texts=texts)


def check(text: Text) -> Flagged | None:
    """Whether one text is Bangla in a Bijoy-style font, and how that shows."""
    plain: list[str] = []
    for used, characters in fonts_of(text):
        if used.how_close is HowClose.BANGLA_ANSI and characters.strip():
            return Flagged(text.handle, FoundBy.FONT, used.asked)
        plain.append(characters)
    if PATTERN.search("".join(plain)):
        return Flagged(text.handle, FoundBy.PATTERN)
    return None


def run(artefact: ReadArtefact) -> BanglaAnsi:
    """The Check over every text of a drawing."""
    flagged = []
    for entity in artefact.entities.values():
        if isinstance(entity, Text) and (found := check(entity)) is not None:
            flagged.append(found)
    return BanglaAnsi(tuple(flagged))
