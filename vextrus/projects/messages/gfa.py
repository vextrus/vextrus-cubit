"""A Building's Gross Floor Area (S16-B; M1.md C15): the act of entering it, and why one is refused."""

from engine.messages import MessageCode

ENTERED = MessageCode("projects.gfa.entered", params=("actor",), event=True)
"""A Building's Gross Floor Area was entered or changed. `actor`: the acting user's name, filled in
when the act is shown; the event stores only ids."""

NOT_AN_AREA = MessageCode("projects.gfa.not_an_area", params=("units",))
"""The value is not a positive area this field holds, or its unit is neither of `units` ("sft, m2")."""
