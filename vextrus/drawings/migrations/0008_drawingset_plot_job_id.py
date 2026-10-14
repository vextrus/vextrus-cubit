# S27-G1 fix round 1: a read file's Discipline changed by the QS queues the set's Plot match again
# (a job on the cad queue); the set keeps that job's id while it is to run, so its PDFs' rows wait
# for it. The app writes the column (0001 left it only the set's name and current state).

from django.conf import settings
from django.db import migrations, models

APP = settings.VEXTRUS_APP_ROLE
GRANT = [f"grant update (plot_job_id) on drawings_drawingset to {APP}"]
GRANT_REVERSE = [f"revoke update (plot_job_id) on drawings_drawingset from {APP}"]


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0007_view_storeys_grant"),
    ]

    operations = [
        migrations.AddField(
            model_name="drawingset",
            name="plot_job_id",
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.RunSQL(GRANT, GRANT_REVERSE),
    ]
