# S24-B2: the QS corrects a plan view's storeys and their meaning (Step 1's Correct act, m0-screens
# 6.9), so the app writes three more columns of a view: its storeys, their meaning and where they were
# read ("typed"). 0001 left it only a decision's columns (a reading replaces views; it never moves one).

from django.conf import settings
from django.db import migrations

APP = settings.VEXTRUS_APP_ROLE
GRANT = [f"grant update (storeys, storeys_meaning, storeys_source) on drawings_view to {APP}"]
GRANT_REVERSE = [f"revoke update (storeys, storeys_meaning, storeys_source) on drawings_view from {APP}"]


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0006_sheetrevision_layers"),
    ]

    operations = [
        migrations.RunSQL(GRANT, GRANT_REVERSE),
    ]
