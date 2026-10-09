"""What any act may be refused for, whatever its module (S15-A2).

Worded in `web/src/messages/platform/acts/en.po`.
"""

from engine.messages import MessageCode

BUSY = MessageCode("platform.acts.busy")
"""The act waited on a lock longer than an act may (`deadlocks.LOCK_TIMEOUT_MS`): another
transaction, a person's act or a file being read, held a row it changes. Nothing was changed, and the
same act tried again in a moment goes through (503)."""
