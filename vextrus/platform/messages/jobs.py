"""A job's state as the web shows it (ticket 09), worded in `web/src/messages/platform/jobs/en.po`.

`jobs.state(job_id)` gives one of these: the states every job shares. A file's row (20b, 21a) is
worded from the drawings module's own codes, in m0-screens 4.5's words, not from these; and a job's
state records neither who cancelled it nor when.
"""

from engine.messages import MessageCode

WAITING = MessageCode("platform.jobs.waiting")
RUNNING = MessageCode("platform.jobs.running")
RUNNING_AGAIN = MessageCode("platform.jobs.running_again", params=("attempt", "tries"))
RETRYING = MessageCode("platform.jobs.retrying", params=("attempt", "tries"))
STOPPING = MessageCode("platform.jobs.stopping")
CANCELLED = MessageCode("platform.jobs.cancelled")
FAILED = MessageCode("platform.jobs.failed", params=("tries",))
DONE = MessageCode("platform.jobs.done")
