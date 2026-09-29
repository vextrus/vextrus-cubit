# The order a Market's drawings write a date in (ticket 22, the design gate's M1; ADR 0038). A title
# block writes "12.09.2026"; only the Market knows whether that is the 12th of September. Step 1's
# API turns a sheet's issue date into an ISO date with it. Market data, written by the owner:
# Bangladesh writes day, month, year. A Market that has not said stays "" and its dates in numbers
# are not read (the API sends null), never guessed.

import uuid

from django.db import migrations, models

MARKET_ID = uuid.UUID("01a0e713-563c-74c4-9eb3-48f94d9f16cd")  # 0004's
DATE_ORDER = "dmy"


def seed(Market, using):
    """Write (or put back, after the tests' flush) the Market's date order."""
    Market.objects.using(using).filter(id=MARKET_ID).update(date_order=DATE_ORDER)


def forward(apps, schema_editor):
    seed(apps.get_model("platform", "Market"), schema_editor.connection.alias)


class Migration(migrations.Migration):
    dependencies = [
        ("platform", "0008_jev"),
    ]

    operations = [
        migrations.AddField(
            model_name="market",
            name="date_order",
            field=models.CharField(
                db_default="",
                help_text='How its drawings write a date in numbers: "dmy", "mdy" or "ymd"; "" unsaid.',
                max_length=3,
            ),
        ),
        migrations.RunPython(forward, migrations.RunPython.noop),
    ]
