"""The font report's codes (ticket 11): which fonts a drawing names and what Vextrus draws each with.

Worded in web/src/messages/engine/font_report/en.po with m0-screens 4.5's words ("Fonts"). `asked` is
a font's family name as the drawing names it, without its extension or any folder (never a path);
`drawn_with` is the name of the free font Vextrus draws it with.
"""

from engine.messages import MessageCode

# The section's opening line: how many fonts the drawing names.
SUMMARY = MessageCode("engine.font_report.summary", params=("fonts",))
# A row's "The drawing asks for": `kind` is `shx` for AutoCAD's own lettering, else `other`.
ASKED = MessageCode("engine.font_report.asked", params=("asked", "kind"))
# A row's "How close": `how_close` is one of engine.render.fonts.HowClose's values.
HOW_CLOSE = MessageCode("engine.font_report.how_close", params=("how_close", "drawn_with"))
# Texts that store no height anywhere Vextrus can find one (engine.text.mtext): drawn at the default.
HEIGHT_DEFAULTED = MessageCode("engine.font_report.height_defaulted", params=("count",))
# Texts with a character no shipped font has: that character shows as an empty box.
GLYPHS_MISSING = MessageCode("engine.font_report.glyphs_missing", params=("count",))
