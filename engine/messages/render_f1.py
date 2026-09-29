"""The render check's code (ticket 18): its name in the Library (`engine.check.render_f1`'s `MESSAGE`).

Worded in web/src/messages/engine/render_f1/en.po. The check's result is a number per sheet, from 0 to
1 (the export's `render_f1`), not a finding, so its name is its only code.
"""

from engine.messages import MessageCode

RENDER_F1 = MessageCode("engine.render_f1.name")
