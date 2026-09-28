"""The Bangla-ANSI Check's codes (ticket 11; ADR 0031 §11): Bangla typed in an old Bijoy-style font.

Worded in web/src/messages/engine/bangla_ansi/en.po with m0-screens 4.5's words ("Bangla text"). `font`
is the most used such font's name, without its extension (never a path); `other_fonts` how many more.
`sheets` is how many sheets the texts lie on and `outside` how many of them lie on none; `also` is
`yes` when both findings show (the one by font first), so the pair says its closing words once.
"""

from engine.messages import MessageCode

# The finding, when the texts' fonts name a Bijoy-style font.
FOUND = MessageCode(
    "engine.bangla_ansi.found", params=("texts", "sheets", "outside", "font", "other_fonts", "also")
)
# The finding, when only the texts' characters show it (no font name gave it away).
FOUND_BY_PATTERN = MessageCode(
    "engine.bangla_ansi.found_by_pattern", params=("texts", "sheets", "outside", "also")
)
# One sheet's line under the finding, linking into Step 1 ("A-02: 5 texts").
SHEET = MessageCode("engine.bangla_ansi.sheet", params=("sheet", "texts"))
