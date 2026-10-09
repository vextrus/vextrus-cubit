# Tickets T-W318, S15-E3: where a view's storeys were read (empty: its own title; "sheet_title": its
# sheet's; "title_line": a bracketed line under its title).

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0003_discipline_name_forms"),
    ]

    operations = [
        migrations.AddField(
            model_name="view",
            name="storeys_source",
            field=models.CharField(
                blank=True,
                db_default="",
                default="",
                help_text=(
                "Where its storeys were read: empty for its own title, else 'sheet_title' or "
                "'title_line'."
            ),
                max_length=16,
            ),
        ),
    ]
