# A Building's Gross Floor Area (M1.md C15; S16-B): the area in m2 to four places, who entered it and
# when. vextrus_app may UPDATE those three columns and no other new one (0001's column grants stand).

from django.conf import settings
from django.db import migrations, models

APP = settings.VEXTRUS_APP_ROLE

COLUMNS = "gross_floor_area_m2, gfa_entered_by, gfa_entered_at"
GRANTS = [f"grant update ({COLUMNS}) on projects_building to {APP}"]
GRANTS_REVERSE = [f"revoke update ({COLUMNS}) on projects_building from {APP}"]


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0003_a_building_keeps_its_project"),
    ]

    operations = [
        migrations.AddField(
            model_name="building",
            name="gfa_entered_at",
            field=models.DateTimeField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="building",
            name="gfa_entered_by",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="building",
            name="gross_floor_area_m2",
            field=models.DecimalField(decimal_places=4, max_digits=14, null=True),
        ),
        migrations.AddConstraint(
            model_name="building",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("gross_floor_area_m2__isnull", True),
                    ("gross_floor_area_m2__gt", 0),
                    _connector="OR",
                ),
                name="projects_building_gfa_positive",
            ),
        ),
        migrations.RunSQL(GRANTS, GRANTS_REVERSE),
    ]
