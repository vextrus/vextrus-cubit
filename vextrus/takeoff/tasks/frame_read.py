"""The frame read job per Building (S16-T1): Step 3, 4 and 6's families run on its confirmed views.

    job_id = read_frame.defer(building_id=building.id)   # inside the transaction that asks for it

The whole read is one step, one transaction acting in the job's tenant as the user who asked: it
writes every family's Proposals and Questions or none. It is not kept as a step of a store (a
read file's steps are): a second run reads again, and `frame_read.run` writes no duplicate. It runs
on the default queue: it reads the kept artefacts, never a DWG.
"""

import uuid

from vextrus.platform.services import jobs
from vextrus.takeoff.services import frame_read


@jobs.job()
def read_frame(run: jobs.Run, *, building_id: uuid.UUID) -> None:
    """Read the Building's frame (`frame_read.run`)."""
    with run.acting():
        frame_read.run(building_id)
