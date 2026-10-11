# S19-B7: each printed sheet's layer histogram (`SheetCandidate.layers`, model space's sheets), so
# Step 1's conflicts read content twins as the engine does. Sheets kept before it hold none ([]) until
# their file is read again; the rule then sits out for them. A database default, so an insert that
# leaves it out holds none (as 0004_plot_title_alike).

from django.conf import settings
from django.db import migrations, models

APP = settings.VEXTRUS_APP_ROLE
GRANT = [f"grant update (layers) on drawings_sheetrevision to {APP}"]
"""The app records a reading again (`record_sheets`), so it writes the new column as it writes `title`."""
GRANT_REVERSE = [f"revoke update (layers) on drawings_sheetrevision from {APP}"]


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0005_merge_plot_title_alike_view_storeys_source"),
    ]

    operations = [
        migrations.AddField(
            model_name="sheetrevision",
            name="layers",
            field=models.JSONField(
                blank=True,
                db_default=[],
                default=list,
                help_text="What it draws by layer, [name, count] pairs (S19-B7's content twins); [] unread.",
            ),
        ),
        migrations.RunSQL(GRANT, GRANT_REVERSE),
    ]
