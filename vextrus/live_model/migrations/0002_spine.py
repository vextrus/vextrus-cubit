# M1's spine (session 16's S16-L; M1.md C7; docs/data-model.md §2 and §3.3): DisciplinePart,
# ModelVersion, ElementState, ElementTrace, ViewPlacement, ViewPlacementStorey and FamilyClassification,
# and C8's meaning, reference face and datum on AttributeDefinition. The tables are generated from
# models.py; their row-level security, the keys that hold references inside one tenant, the reach
# trigger and vextrus_app's rights on the append-only tables are written by hand below, as in 0001.
# Run as the owner.
#
# - Every new table has row-level security ENABLED and its own-tenant policy; FamilyClassification,
#   an L table, adds the FOR SELECT policy admitting the acting tenant's Market Library.
# - A reference between T rows names a row of the same tenant (composite keys on tenant_id), and an
#   Element's discipline_part_id now names a DisciplinePart of its tenant (C7, "references completed").
#   A FamilyClassification's family and reference may be the tenant's own or its Library's, never
#   another tenant's: a trigger looks them up as the caller.
# - Append-only (docs/data-model.md §2): vextrus_app never updates or deletes a ModelVersion; an
#   ElementState, an ElementTrace and a ViewPlacement only ever have their valid_to_seq set; a
#   ViewPlacementStorey is never updated or deleted.

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

import vextrus.platform.ids
from vextrus.live_model.migrations import _sql

APP = settings.VEXTRUS_APP_ROLE

TENANT_TABLES = (
    "live_model_disciplinepart",
    "live_model_modelversion",
    "live_model_elementstate",
    "live_model_elementtrace",
    "live_model_viewplacement",
    "live_model_viewplacementstorey",
)
LIBRARY_TABLES = ("live_model_familyclassification",)
TABLES = TENANT_TABLES + LIBRARY_TABLES

POLICIES = [
    *(f"alter table {table} enable row level security" for table in TABLES),
    *(f"create policy own_tenant on {table} using ({_sql.OWN_TENANT})" for table in TABLES),
    *(
        f"create policy library_reads on {table} for select using ({_sql.LIBRARY})"
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
    (
        "live_model_element",
        "live_model_element_part_own_tenant",
        "discipline_part_id",
        "live_model_disciplinepart",
    ),
    (
        "live_model_elementstate",
        "live_model_state_element_own_tenant",
        "element_id",
        "live_model_element",
    ),
    (
        "live_model_elementtrace",
        "live_model_trace_element_own_tenant",
        "element_id",
        "live_model_element",
    ),
    (
        "live_model_viewplacementstorey",
        "live_model_placement_storey_placement_own_tenant",
        "placement_id",
        "live_model_viewplacement",
    ),
    (
        "live_model_viewplacementstorey",
        "live_model_placement_storey_element_own_tenant",
        "storey_element_id",
        "live_model_element",
    ),
)
KEYS = _sql.same_tenant_keys(SAME_TENANT)
KEYS_REVERSE = _sql.same_tenant_keys_reverse(SAME_TENANT)

IN_REACH = (
    (
        "live_model_familyclassification_in_reach",
        "live_model_familyclassification",
        (
            ("family_id", "live_model_elementfamily"),
            ("reference_id", "live_model_classificationreference"),
        ),
    ),
)
TRIGGERS = [statement for spec in IN_REACH for statement in _sql.in_reach(*spec)]
TRIGGERS_REVERSE = [
    statement for spec in reversed(IN_REACH) for statement in _sql.in_reach_reverse(*spec)
]

APPEND_ONLY = [
    f"revoke update, delete on live_model_modelversion from {APP}",
    *(
        statement
        for table in (
            "live_model_elementstate",
            "live_model_elementtrace",
            "live_model_viewplacement",
        )
        for statement in (
            f"revoke update, delete on {table} from {APP}",
            f"grant update (valid_to_seq) on {table} to {APP}",
        )
    ),
    f"revoke update, delete on live_model_viewplacementstorey from {APP}",
]
APPEND_ONLY_REVERSE = [
    f"grant update, delete on live_model_viewplacementstorey to {APP}",
    *(
        statement
        for table in (
            "live_model_viewplacement",
            "live_model_elementtrace",
            "live_model_elementstate",
        )
        for statement in (
            f"revoke update (valid_to_seq) on {table} from {APP}",
            f"grant update, delete on {table} to {APP}",
        )
    ),
    f"grant update, delete on live_model_modelversion to {APP}",
]


class Migration(migrations.Migration):
    dependencies = [
        ("live_model", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="attributedefinition",
            name="datum",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="attributedefinition",
            name="meaning",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="attributedefinition",
            name="reference_face",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.CreateModel(
            name="DisciplinePart",
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
                ("discipline", models.CharField(max_length=32)),
                ("responsible_user_id", models.UUIDField(blank=True, null=True)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "building_id", "discipline"),
                        name="live_model_part_identity",
                    ),
                    models.UniqueConstraint(
                        fields=("tenant_id", "id"), name="live_model_part_tenant_id"
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ModelVersion",
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
                ("seq", models.PositiveIntegerField()),
                ("cause", models.CharField(max_length=16)),
                ("figures_changed", models.BooleanField()),
                ("figures_hash", models.CharField(max_length=80)),
                ("complete_for_state", models.BooleanField(default=False)),
                ("confirmation_id", models.UUIDField(blank=True, null=True)),
                ("drawing_set_state_id", models.UUIDField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "building_id", "seq"),
                        name="live_model_version_identity",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("seq__gte", 1)),
                        name="live_model_version_seq",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("cause__in", ("confirmation", "carry_over", "unconfirm"))),
                        name="live_model_version_cause",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ViewPlacement",
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
                ("view_id", models.UUIDField()),
                ("meaning", models.CharField(max_length=16)),
                ("valid_from_seq", models.PositiveIntegerField()),
                ("valid_to_seq", models.PositiveIntegerField(blank=True, null=True)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "view_id", "valid_from_seq"),
                        name="live_model_placement_identity",
                    ),
                    models.UniqueConstraint(
                        fields=("tenant_id", "id"),
                        name="live_model_placement_tenant_id",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("meaning__in", ("at_floor_level", "floor_to_floor"))),
                        name="live_model_placement_meaning",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("valid_to_seq__isnull", True),
                            ("valid_to_seq__gt", models.F("valid_from_seq")),
                            _connector="OR",
                        ),
                        name="live_model_placement_valid_range",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ElementState",
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
                ("valid_from_seq", models.PositiveIntegerField()),
                ("valid_to_seq", models.PositiveIntegerField(blank=True, null=True)),
                ("mark", models.CharField(blank=True, max_length=64)),
                ("storey_id", models.UUIDField(blank=True, null=True)),
                ("band_from_id", models.UUIDField(blank=True, null=True)),
                ("band_to_id", models.UUIDField(blank=True, null=True)),
                ("grid_ref", models.CharField(blank=True, max_length=64)),
                (
                    "x_m",
                    models.DecimalField(blank=True, decimal_places=6, max_digits=18, null=True),
                ),
                (
                    "y_m",
                    models.DecimalField(blank=True, decimal_places=6, max_digits=18, null=True),
                ),
                (
                    "rotation",
                    models.DecimalField(blank=True, decimal_places=6, max_digits=18, null=True),
                ),
                ("mix", models.CharField(blank=True, max_length=32)),
                ("grade", models.CharField(blank=True, max_length=32)),
                ("rebar_basis", models.CharField(blank=True, max_length=24)),
                ("construction_stage", models.CharField(blank=True, max_length=32)),
                ("casting_stage_id", models.UUIDField(blank=True, null=True)),
                ("attrs", models.JSONField(blank=True, default=dict)),
                ("held_by_question_id", models.UUIDField(blank=True, null=True)),
                ("facts_hash", models.CharField(max_length=80)),
                ("figures_hash", models.CharField(max_length=80)),
                ("confirmation_id", models.UUIDField(blank=True, null=True)),
                (
                    "element",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.element",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["tenant_id", "element", "valid_to_seq"],
                        name="live_model_state_element",
                    )
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "element", "valid_from_seq"),
                        name="live_model_state_identity",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("valid_to_seq__isnull", True),
                            ("valid_to_seq__gt", models.F("valid_from_seq")),
                            _connector="OR",
                        ),
                        name="live_model_state_valid_range",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("rebar_basis", ""),
                            (
                                "rebar_basis__in",
                                (
                                    "by_ratio",
                                    "from_drawing",
                                    "from_drawing_rules",
                                    "none",
                                ),
                            ),
                            _connector="OR",
                        ),
                        name="live_model_state_rebar_basis",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ElementTrace",
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
                ("fact", models.CharField(max_length=64)),
                ("kind", models.CharField(max_length=32)),
                ("anchor", models.JSONField(blank=True, default=dict)),
                ("question_id", models.UUIDField(blank=True, null=True)),
                ("valid_from_seq", models.PositiveIntegerField()),
                ("valid_to_seq", models.PositiveIntegerField(blank=True, null=True)),
                (
                    "element",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.element",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["tenant_id", "element", "valid_to_seq"],
                        name="live_model_trace_element",
                    )
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(
                            (
                                "kind__in",
                                (
                                    "sheet_entity",
                                    "question",
                                    "best_candidate",
                                    "qs_typed",
                                    "default",
                                    "derived",
                                    "developer_specification",
                                ),
                            )
                        ),
                        name="live_model_trace_kind",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("valid_to_seq__isnull", True),
                            ("valid_to_seq__gt", models.F("valid_from_seq")),
                            _connector="OR",
                        ),
                        name="live_model_trace_valid_range",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="FamilyClassification",
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
                (
                    "family",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.elementfamily",
                    ),
                ),
                (
                    "reference",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.classificationreference",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["tenant_id", "family"],
                        name="live_model_famclass_family",
                    )
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "family", "reference"),
                        name="live_model_famclass_identity",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="ViewPlacementStorey",
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
                (
                    "placement",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.viewplacement",
                    ),
                ),
                (
                    "storey_element",
                    models.ForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="live_model.element",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant_id", "placement", "storey_element"),
                        name="live_model_placement_storey_identity",
                    )
                ],
            },
        ),
        migrations.RunSQL(POLICIES, POLICIES_REVERSE),
        migrations.RunSQL(KEYS, KEYS_REVERSE),
        migrations.RunSQL(TRIGGERS, TRIGGERS_REVERSE),
        migrations.RunSQL(APPEND_ONLY, APPEND_ONLY_REVERSE),
    ]
