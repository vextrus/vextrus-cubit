# Ticket #159: the General Discipline's kind, admitted by the kind's check constraint.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0001_initial"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="discipline",
            name="drawings_discipline_kind",
        ),
        migrations.AlterField(
            model_name="discipline",
            name="kind",
            field=models.CharField(
                choices=[
                    ("structural", "Structural"),
                    ("architectural", "Architectural"),
                    ("mep", "Mep"),
                    ("notes", "General"),
                ],
                max_length=16,
            ),
        ),
        migrations.AddConstraint(
            model_name="discipline",
            constraint=models.CheckConstraint(
                condition=models.Q(("kind__in", ["structural", "architectural", "mep", "notes"])),
                name="drawings_discipline_kind",
            ),
        ),
    ]
