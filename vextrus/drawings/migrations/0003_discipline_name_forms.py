# Ticket #168: a Discipline's file-name forms, Market data apart from its sheet-number prefixes.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0002_discipline_kind_general"),
    ]

    operations = [
        migrations.AddField(
            model_name="discipline",
            name="name_forms",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="The forms a file's name gives it by, whole words, case aside: a list.",
            ),
        ),
    ]
