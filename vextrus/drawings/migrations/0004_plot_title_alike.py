# Ticket #229: whether a sheet's Plot page reads its title as well as its number (a second source).
# Plots kept before it read no title alike until their PDF is read again.

from django.conf import settings
from django.db import migrations, models

APP = settings.VEXTRUS_APP_ROLE
GRANT = [f"grant update (plot_title_alike) on drawings_sheetrevision to {APP}"]
"""The app keeps a Plot (`record_plot`), so it writes the new column as it writes `plot_page`."""
GRANT_REVERSE = [f"revoke update (plot_title_alike) on drawings_sheetrevision from {APP}"]


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0003_discipline_name_forms"),
    ]

    operations = [
        migrations.AddField(
            model_name="sheetrevision",
            name="plot_title_alike",
            field=models.BooleanField(
                default=False,
                help_text="Its Plot page reads its title as well as its number: a second source (#229).",
            ),
        ),
        migrations.AddConstraint(
            model_name="sheetrevision",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("plot_title_alike", False), ("plot_page__isnull", False), _connector="OR"
                ),
                name="drawings_sheetrevision_plot_title_alike",
            ),
        ),
        migrations.RunSQL(GRANT, GRANT_REVERSE),
    ]
