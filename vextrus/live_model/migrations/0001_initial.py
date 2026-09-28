# The Live Model's empty tables (ticket 28; docs/data-model.md §2 and §3.3; ADR 0037). The tables are
# generated from models.py; their row-level security, the keys that hold references inside one tenant,
# and the reach triggers below are written by hand. Run as the owner.
#
# - Every table has row-level security ENABLED, never forced, and its own-tenant policy for reads
#   and writes alike. The L tables (the Library's kinds of row) add one FOR SELECT policy admitting
#   the acting tenant's Market Library through app.library_id, so a tenant reads its Library and
#   writes only its own rows. Both settings are read through nullif, so an unset or empty setting
#   admits no row. No policy holds a join, a sub-select or any other function call.
# - A reference between T rows names a row of the same tenant (composite keys on tenant_id). A
#   classification reference sits in its system's tenant (the same). An Element's family and a
#   Family Attribute's definition and family may be the tenant's own or its Library's, never another
#   tenant's: a key check runs as the owner and sees every row, so a trigger looks the row up as the
#   caller, under the caller's own policies, and refuses what the caller cannot read.
# - vextrus_app gets SELECT, INSERT, UPDATE and DELETE from platform's default privileges (0003),
#   never TRUNCATE. Records and Element Relations are append-only by the services that will write
#   them (M1): their rights are not narrowed here, since platform's test of the app's rights lists
#   every narrower table.

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models

import vextrus.platform.ids

OWN_TENANT = "tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid"
LIBRARY = "tenant_id = nullif(current_setting('app.library_id', true), '')::uuid"

TENANT_TABLES = (
    "live_model_element",
    "live_model_record",
    "live_model_elementrelation",
)
LIBRARY_TABLES = (
    "live_model_elementfamily",
    "live_model_attributedefinition",
    "live_model_familyattribute",
    "live_model_classificationsystem",
    "live_model_classificationreference",
)
TABLES = TENANT_TABLES + LIBRARY_TABLES

POLICIES = [
    *(f"alter table {table} enable row level security" for table in TABLES),
    *(f"create policy own_tenant on {table} using ({OWN_TENANT})" for table in TABLES),
    *(
        f"create policy library_reads on {table} for select using ({LIBRARY})"
        for table in LIBRARY_TABLES
    ),
]
POLICIES_REVERSE = [
    *(f"drop policy library_reads on {table}" for table in LIBRARY_TABLES),
    *(f"drop policy own_tenant on {table}" for table in TABLES),
    *(f"alter table {table} disable row level security" for table in TABLES),
]

# (table, constraint, column, referenced table): each reference held inside its row's tenant.
SAME_TENANT = (
    ("live_model_record", "live_model_record_element_own_tenant", "element_id", "live_model_element"),
    (
        "live_model_record",
        "live_model_record_supersedes_own_tenant",
        "supersedes_id",
        "live_model_record",
    ),
    (
        "live_model_elementrelation",
        "live_model_relation_from_own_tenant",
        "from_element_id",
        "live_model_element",
    ),
    (
        "live_model_elementrelation",
        "live_model_relation_to_own_tenant",
        "to_element_id",
        "live_model_element",
    ),
    (
        "live_model_classificationreference",
        "live_model_reference_system_own_tenant",
        "system_id",
        "live_model_classificationsystem",
    ),
)
KEYS = [
    f"""alter table {table} add constraint {name}
          foreign key (tenant_id, {column}) references {target} (tenant_id, id)
          deferrable initially deferred"""
    for table, name, column, target in SAME_TENANT
]
KEYS_REVERSE = [
    f"alter table {table} drop constraint {name}" for table, name, _c, _t in reversed(SAME_TENANT)
]

# (function, table, the columns it checks, each with the table it names).
IN_REACH = (
    (
        "live_model_element_in_reach",
        "live_model_element",
        (("family_id", "live_model_elementfamily"),),
    ),
    (
        "live_model_familyattribute_in_reach",
        "live_model_familyattribute",
        (
            ("definition_id", "live_model_attributedefinition"),
            ("family_id", "live_model_elementfamily"),
        ),
    ),
)


def _in_reach(function, table, columns):
    """A trigger function run as its caller (not SECURITY DEFINER), so the lookups see only what the
    caller's policies admit: its own rows and its Library's. The owner sees every row and passes."""
    checks = "\n".join(
        f"""      if not exists (select 1 from public.{target} where id = new.{column}) then
        raise exception '{table}.{column} names a row neither this tenant''s nor its Library''s'
          using errcode = '42501';
      end if;"""
        for column, target in columns
    )
    updated = ", ".join(column for column, _target in columns)
    return [
        f"""
    create function public.{function}() returns trigger
    language plpgsql
    set search_path = pg_catalog, pg_temp
    as $$
    begin
{checks}
      return new;
    end
    $$
    """,
        f"revoke all on function public.{function}() from public",
        f"""
    create trigger {function}
      before insert or update of tenant_id, {updated} on public.{table}
      for each row execute function public.{function}()
    """,
    ]


TRIGGERS = [statement for spec in IN_REACH for statement in _in_reach(*spec)]
TRIGGERS_REVERSE = [
    statement
    for function, table, _columns in reversed(IN_REACH)
    for statement in (
        f"drop trigger {function} on public.{table}",
        f"drop function public.{function}()",
    )
]

class Migration(migrations.Migration):

    initial = True

    dependencies = [
        # vextrus_app's default privileges and platform's policies come first.
        ("platform", "0003_row_level_security"),
    ]

    operations = [
        migrations.CreateModel(
            name="AttributeDefinition",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=vextrus.platform.ids.new_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField()),
                ("key", models.CharField(max_length=120)),
                ("version", models.PositiveIntegerField(default=1)),
                ("status", models.CharField(max_length=16)),
                ("replaces_key", models.CharField(blank=True, max_length=120)),
                ("data_type", models.CharField(max_length=16)),
                (
                    "allowed_values",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="For an enum: [{code, labels}], in order.",
                    ),
                ),
                ("dimension", models.CharField(blank=True, max_length=32)),
                ("storage_unit", models.CharField(blank=True, max_length=16)),
                (
                    "labels",
                    models.JSONField(
                        help_text="Its name per language: {language: name}."
                    ),
                ),
                ("storage", models.CharField(max_length=16)),
                (
                    "life_phases",
                    models.JSONField(
                        help_text="The Life Phases that may hold a value, in order."
                    ),
                ),
                ("source", models.CharField(max_length=16)),
                ("source_ref", models.CharField(blank=True, max_length=200)),
                ("feeds_figures", models.BooleanField(default=False)),
                (
                    "deviation_tolerance",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=18, null=True
                    ),
                ),
                (
                    "deviation_tolerance_kind",
                    models.CharField(blank=True, max_length=16),
                ),
                (
                    "market_scope",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Market codes; empty for every Market.",
                    ),
                ),
                ("ifc", models.JSONField(blank=True, default=dict)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "key"),
                        name="live_model_definition_identity",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("status__in", ("preview", "active", "inactive"))
                        ),
                        name="live_model_definition_status",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            (
                                "data_type__in",
                                (
                                    "decimal",
                                    "integer",
                                    "text",
                                    "date",
                                    "boolean",
                                    "enum",
                                    "reference",
                                ),
                            )
                        ),
                        name="live_model_definition_data_type",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("storage__in", ("core", "attrs", "derived"))
                        ),
                        name="live_model_definition_storage",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            (
                                "source__in",
                                (
                                    "drawing",
                                    "rule",
                                    "qs",
                                    "supplier",
                                    "site",
                                    "maintenance",
                                ),
                            )
                        ),
                        name="live_model_definition_source",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            models.Q(
                                ("deviation_tolerance__isnull", True),
                                ("deviation_tolerance_kind", ""),
                            ),
                            models.Q(
                                ("deviation_tolerance__gte", 0),
                                (
                                    "deviation_tolerance_kind__in",
                                    ("absolute", "relative"),
                                ),
                            ),
                            _connector="OR",
                        ),
                        name="live_model_definition_tolerance",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("replaces_key", models.F("key")), _negated=True
                        ),
                        name="live_model_definition_replaces_another",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ClassificationSystem",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=vextrus.platform.ids.new_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField()),
                ("name", models.CharField(max_length=200)),
                ("publisher", models.CharField(max_length=200)),
                ("edition", models.CharField(max_length=64)),
                ("edition_date", models.DateField(blank=True, null=True)),
                ("licence", models.CharField(max_length=200)),
                ("attribution", models.TextField(blank=True)),
                ("may_ship", models.BooleanField(default=False)),
                (
                    "market_scope",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Market codes; empty for every Market.",
                    ),
                ),
                ("uri", models.URLField(blank=True, max_length=500)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "name", "edition"),
                        name="live_model_system_identity",
                    ),
                    models.UniqueConstraint(
                        fields=("tenant_id", "id"), name="live_model_system_tenant_id"
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ElementFamily",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=vextrus.platform.ids.new_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField()),
                ("key", models.CharField(max_length=64)),
                ("discipline", models.CharField(max_length=32)),
                ("takeoff_step", models.CharField(blank=True, max_length=64)),
                (
                    "labels",
                    models.JSONField(
                        help_text="Its name per language: {language: name}."
                    ),
                ),
                ("identity_rule", models.CharField(max_length=64)),
                ("ifc_class", models.CharField(max_length=64)),
                ("ifc_predefined_type", models.CharField(blank=True, max_length=64)),
                ("milestone", models.CharField(max_length=8)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "key"), name="live_model_family_identity"
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="Element",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=vextrus.platform.ids.new_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField()),
                ("building_id", models.UUIDField()),
                ("discipline_part_id", models.UUIDField(blank=True, null=True)),
                ("identity_key", models.CharField(max_length=200)),
                ("mark_hint", models.CharField(blank=True, max_length=64)),
                ("created_seq", models.PositiveIntegerField()),
                ("retired_seq", models.PositiveIntegerField(blank=True, null=True)),
                (
                    "family",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.elementfamily",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ElementRelation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=vextrus.platform.ids.new_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField()),
                ("kind", models.CharField(max_length=24)),
                ("detail", models.JSONField(blank=True, default=dict)),
                ("valid_from_seq", models.PositiveIntegerField()),
                ("valid_to_seq", models.PositiveIntegerField(blank=True, null=True)),
                ("confirmation_id", models.UUIDField()),
                (
                    "from_element",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.element",
                    ),
                ),
                (
                    "to_element",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.element",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="FamilyAttribute",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=vextrus.platform.ids.new_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField()),
                ("required", models.BooleanField(default=False)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("group", models.CharField(max_length=16)),
                ("level", models.CharField(max_length=16)),
                ("override", models.JSONField(blank=True, default=dict)),
                (
                    "definition",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.attributedefinition",
                    ),
                ),
                (
                    "family",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.elementfamily",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Record",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=vextrus.platform.ids.new_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField()),
                ("attribute_key", models.CharField(max_length=120)),
                ("life_phase", models.CharField(max_length=16)),
                ("value", models.JSONField()),
                ("observed_on", models.DateField()),
                ("recorded_by_id", models.UUIDField()),
                (
                    "recorded_at",
                    models.DateTimeField(default=django.utils.timezone.now),
                ),
                ("stored_file_id", models.UUIDField(blank=True, null=True)),
                ("evidence_note", models.TextField(blank=True)),
                ("design_version_seq", models.PositiveIntegerField()),
                ("source", models.CharField(max_length=24)),
                (
                    "element",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.element",
                    ),
                ),
                (
                    "supersedes",
                    models.ForeignKey(
                        blank=True,
                        db_index=False,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.record",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ClassificationReference",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=vextrus.platform.ids.new_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("tenant_id", models.UUIDField()),
                ("code", models.CharField(max_length=64)),
                ("name", models.CharField(max_length=500)),
                ("uri", models.URLField(blank=True, max_length=500)),
                (
                    "system",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.classificationsystem",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "system", "code"),
                        name="live_model_reference_identity",
                    )
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="element",
            constraint=models.UniqueConstraint(
                fields=("tenant_id", "building_id", "family", "identity_key"),
                name="live_model_element_identity",
            ),
        ),
        migrations.AddConstraint(
            model_name="element",
            constraint=models.UniqueConstraint(
                fields=("tenant_id", "id"), name="live_model_element_tenant_id"
            ),
        ),
        migrations.AddConstraint(
            model_name="element",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("retired_seq__isnull", True),
                    ("retired_seq__gt", models.F("created_seq")),
                    _connector="OR",
                ),
                name="live_model_element_retired_after_created",
            ),
        ),
        migrations.AddIndex(
            model_name="elementrelation",
            index=models.Index(
                fields=["tenant_id", "to_element"], name="live_model_relation_to"
            ),
        ),
        migrations.AddConstraint(
            model_name="elementrelation",
            constraint=models.UniqueConstraint(
                fields=(
                    "tenant_id",
                    "from_element",
                    "kind",
                    "to_element",
                    "valid_from_seq",
                ),
                name="live_model_relation_identity",
            ),
        ),
        migrations.AddConstraint(
            model_name="elementrelation",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "kind__in",
                        (
                            "hosted_in",
                            "passes_through",
                            "in_room",
                            "spans_storeys",
                            "same_thing_as",
                            "junction",
                        ),
                    )
                ),
                name="live_model_relation_kind",
            ),
        ),
        migrations.AddConstraint(
            model_name="elementrelation",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("from_element", models.F("to_element")), _negated=True
                ),
                name="live_model_relation_two_elements",
            ),
        ),
        migrations.AddConstraint(
            model_name="elementrelation",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("valid_to_seq__isnull", True),
                    ("valid_to_seq__gt", models.F("valid_from_seq")),
                    _connector="OR",
                ),
                name="live_model_relation_valid_range",
            ),
        ),
        migrations.AddIndex(
            model_name="familyattribute",
            index=models.Index(
                fields=["tenant_id", "family"], name="live_model_famattr_family"
            ),
        ),
        migrations.AddConstraint(
            model_name="familyattribute",
            constraint=models.UniqueConstraint(
                fields=("tenant_id", "definition", "family"),
                name="live_model_famattr_identity",
            ),
        ),
        migrations.AddConstraint(
            model_name="familyattribute",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "group__in",
                        ("identity", "geometry", "cost", "construction", "om"),
                    )
                ),
                name="live_model_famattr_group",
            ),
        ),
        migrations.AddConstraint(
            model_name="familyattribute",
            constraint=models.CheckConstraint(
                condition=models.Q(("level__in", ("occurrence", "type"))),
                name="live_model_famattr_level",
            ),
        ),
        migrations.AddIndex(
            model_name="record",
            index=models.Index(
                fields=["tenant_id", "element", "attribute_key"],
                name="live_model_record_element",
            ),
        ),
        migrations.AddConstraint(
            model_name="record",
            constraint=models.UniqueConstraint(
                fields=("tenant_id", "id"), name="live_model_record_tenant_id"
            ),
        ),
        migrations.AddConstraint(
            model_name="record",
            constraint=models.CheckConstraint(
                condition=models.Q(("life_phase__in", ("as_built", "as_maintained"))),
                name="live_model_record_life_phase",
            ),
        ),
        migrations.AddConstraint(
            model_name="record",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("source__in", ("site_record", "maintenance_record", "handover"))
                ),
                name="live_model_record_source",
            ),
        ),
        migrations.AddConstraint(
            model_name="record",
            constraint=models.CheckConstraint(
                condition=models.Q(("supersedes", models.F("id")), _negated=True),
                name="live_model_record_supersedes_another",
            ),
        ),
        migrations.RunSQL(POLICIES, POLICIES_REVERSE),
        migrations.RunSQL(KEYS, KEYS_REVERSE),
        migrations.RunSQL(TRIGGERS, TRIGGERS_REVERSE),
    ]
