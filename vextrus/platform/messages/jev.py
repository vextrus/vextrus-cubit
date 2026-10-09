"""The Jev client's words (ticket 15), worded in `web/src/messages/platform/jev/en.po`.

Only what is stored or shown has a code. Jev's answer is shown only as a source of a pre-pick
("Picked for you:" and the agreeing sources, m0-screens 6.7), in plain words that never name the
model or its maker. When TypeSafe is unavailable nothing tells the QS (m0-screens 4.7), so the
reasons `services.jev.Unavailable` names are for logs and callers, never shown and never stored.
"""

from engine.messages import MessageCode

SHEET_TYPE_SOURCE = MessageCode("platform.jev.sheet_type_source")
"""The sheet-type node's answer, named as one source of a pre-picked kind of sheet."""
SHEET_TYPE_SOURCE_GROUP = MessageCode("platform.jev.sheet_type_source_group")
"""The same source on a kind Question of a group (S15-Q1): one reading per sheet it holds."""
