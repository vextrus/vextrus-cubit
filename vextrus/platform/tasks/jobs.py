"""The stalled-job retrier (ticket 09): every minute, a job whose worker stopped beating (a server
restart, a killed process) is tried again, and its completed steps skip. It runs on the default queue,
so the default queue's worker must be running (`manage.py worker`)."""

from django.conf import settings
from procrastinate.contrib.django import app
from procrastinate.job_context import JobContext

from vextrus.platform.services import jobs


@app.periodic(cron="* * * * *", periodic_id="stalled")
@app.task(
    name="vextrus.platform.retry_stalled_jobs",
    queue=settings.VEXTRUS_DEFAULT_QUEUE,
    pass_context=True,
)
async def retry_stalled_jobs(context: JobContext, timestamp: int) -> None:
    await jobs.retry_stalled(context.app.job_manager)
