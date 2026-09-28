"""`revisions`'s message codes: one submodule per ticket (`messages/<name>.py`), each code named
`revisions.<name>.<what>` and worded in `web/src/messages/revisions/<name>/en.po` in the same PR.
"""

from engine.messages import MessageCode, collect_codes


def codes() -> tuple[MessageCode, ...]:
    return collect_codes(__name__)
