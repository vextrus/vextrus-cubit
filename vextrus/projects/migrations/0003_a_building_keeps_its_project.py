# A Building keeps its Project, and a Site too (#93; docs/data-model.md §2 and §3.1). Written by
# hand, run as the owner.
#
# 0001 narrowed UPDATE so the app cannot move a Site or a Building to another Project by UPDATE; it
# kept DELETE, and a delete with an insert under the same id moved them anyway, in one transaction
# (found by the review of 14 on main a2175117: a Building put under another Project of its
# Developer, its code and ordinal changed past the unique indexes). Everything that names a
# Building by id (a DrawingFile's building_id, a Live Model Element's, plain ids both) then belonged
# to the other Project.
#
# - vextrus_app loses DELETE on projects_building and projects_site, and on projects_project as
#   well: a Project's delete cascades to its Site and Buildings through their keys (0001's
#   *_own_tenant, ON DELETE CASCADE), and PostgreSQL runs that cascade as the tables' owner, so
#   with DELETE on the Project alone the app still freed its Building's id for another Project
#   (measured on PostgreSQL 18.6: the cascade's current_user is vextrus). No act deletes a Project,
#   a Site or a Building (no service; the admin registers none; the seed makes them through
#   projects.services.create), so no id comes free.
# - Only the owner deletes one (a migration, or by hand), and the cascade still takes a Project's
#   Site and Buildings with it. An act that must delete one later needs a ruling first, and then a
#   record of retired ids, filled on delete and checked on insert, rather than DELETE back alone.
# - TRUNCATE stays ungranted (platform 0003). The column grants of 0001 are untouched.

from django.conf import settings
from django.db import migrations

APP = settings.VEXTRUS_APP_ROLE

TABLES = ("projects_project", "projects_site", "projects_building")

KEPT = [f"revoke delete on {table} from {APP}" for table in TABLES]
KEPT_REVERSE = [f"grant delete on {table} to {APP}" for table in TABLES]


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0002_ended_access_and_invitation_projects"),
    ]

    operations = [
        migrations.RunSQL(KEPT, KEPT_REVERSE),
    ]
