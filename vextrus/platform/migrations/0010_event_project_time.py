# A Project's newest DomainEvent (the Projects list's "Updated") is read by project, so the event log
# gets an index on (tenant, project, time): the lookup no longer grows with the tenant's whole history.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform", "0009_market_date_order"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="domainevent",
            index=models.Index(
                fields=["tenant_id", "project_id", "occurred_at"], name="platform_event_project_time"
            ),
        ),
    ]
