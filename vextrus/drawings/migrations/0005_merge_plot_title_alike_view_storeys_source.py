# Train A (S18): S15-Q2's 0004_plot_title_alike and S15-E3's 0004_view_storeys_source both follow
# 0003; this joins the two leaves (one leaf per module: tools.lint.migration_leaves). No operations.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0004_plot_title_alike"),
        ("drawings", "0004_view_storeys_source"),
    ]

    operations: list[migrations.operations.base.Operation] = []
