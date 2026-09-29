"""The Plot's codes (ticket 18): why a page of a Discipline's PDF matched no sheet
(`engine.plot.registration`).

Worded in web/src/messages/engine/plot/en.po, after m0-screens 6.13's "No Plot, and why" ("PDF page 21
could not be matched: neither its title block nor the text on the page names a sheet"). A `PlotMatch`
with no sheet carries the reason's key (`REASONS`, the code's last part); a screen shows the code with
`page`, the page's number counting from 1.

- `names_no_sheet`: the page's text, its title block's and its body's, names no sheet's number.
- `names_several_sheets`: it names more than one sheet's number, none more surely than the others.
- `no_text`: the page carries no text at all to match (its lettering drawn as lines, with no comments).
- `scan`: the page is a scan (12's rule): nothing on it but a picture.
"""

from engine.messages import MessageCode

NAMES_NO_SHEET = MessageCode("engine.plot.names_no_sheet", params=("page",))
NAMES_SEVERAL_SHEETS = MessageCode("engine.plot.names_several_sheets", params=("page",))
NO_TEXT = MessageCode("engine.plot.no_text", params=("page",))
SCAN = MessageCode("engine.plot.scan", params=("page",))

REASONS = {
    code.code.rsplit(".", 1)[1]: code for code in (NAMES_NO_SHEET, NAMES_SEVERAL_SHEETS, NO_TEXT, SCAN)
}
"""Each reason's key, as a `PlotMatch` carries it, to its code."""
