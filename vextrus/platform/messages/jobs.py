"""A job's state as the web shows it (ticket 09), worded in `web/src/messages/platform/jobs/en.po`.

`jobs.state(job_id)` gives one of these. A module whose work runs as a job (21a's reading) words its
own steps; these are the states every job shares.
"""

from engine.messages import MessageCode

WAITING = MessageCode("platform.jobs.waiting")
RUNNING = MessageCode("platform.jobs.running")
RETRYING = MessageCode("platform.jobs.retrying", params=("attempt", "tries"))
STOPPING = MessageCode("platform.jobs.stopping")
CANCELLED = MessageCode("platform.jobs.cancelled")
FAILED = MessageCode("platform.jobs.failed", params=("tries",))
DONE = MessageCode("platform.jobs.done")
