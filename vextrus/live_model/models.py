"""`live_model`'s tables: private to the module (import-linter holds it). Only the one ticket per wave
that adds a migration to `live_model` edits this file. Every id comes from
`vextrus.platform.ids.new_id`.

M0 creates only the tables of the owner's Q14 ruling, empty (docs/data-model.md §3.3; ADR 0037):
the Attribute Definitions and their Family Attributes, Records, the classification systems and their
references, and Element Relations, with the Element Families and Elements they point to. ModelVersion,
ElementState, DisciplinePart, RebarBar, ElementTrace, ViewPlacement and its storeys, and the
classification links are M1 ticket 08's.

Tenancy (docs/data-model.md §2; migration 0001 sets it up):
- **T** tables (Element, Record, ElementRelation) have the own-tenant policy only. A reference
  between them names a row of the same tenant: a composite key on `(tenant_id, …)`.
- **L** tables (ElementFamily, AttributeDefinition, FamilyAttribute, ClassificationSystem,
  ClassificationReference) also admit the acting tenant's Market Library through a `FOR SELECT`
  policy, so a tenant reads its Library and writes only its own rows. Their identity leads with
  `tenant_id` (the Library rule). A reference to an Element Family or an Attribute Definition may
  name the tenant's own row or its Library's, never another tenant's: a trigger looks the row up as
  the caller, under the caller's policies. A classification reference sits in its system's tenant.

Ids outside these tables (`building_id`, `discipline_part_id`, a Record's `stored_file_id` and
`recorded_by_id`, a relation's `confirmation_id`) are plain columns: no key crosses a module, and
DisciplinePart arrives with M1 ticket 08. No field has choices: each list of codes below is held by a
check constraint, and its words belong to the screens that show it.
"""

from typing import ClassVar

from django.db import models
from django.utils import timezone

from vextrus.platform.ids import new_id

# The lists of codes (docs/data-model.md §3.3).
DEFINITION_STATUSES = ("preview", "active", "inactive")
DATA_TYPES = ("decimal", "integer", "text", "date", "boolean", "enum", "reference")
STORAGES = ("core", "attrs", "derived")
DEFINITION_SOURCES = ("drawing", "rule", "qs", "supplier", "site", "maintenance")
TOLERANCE_KINDS = ("absolute", "relative")
ATTRIBUTE_GROUPS = ("identity", "geometry", "cost", "construction", "om")
ATTRIBUTE_LEVELS = ("occurrence", "type")
RECORD_LIFE_PHASES = ("as_built", "as_maintained")
RECORD_SOURCES = ("site_record", "maintenance_record", "handover")
MODEL_VERSION_CAUSES = ("confirmation", "carry_over", "unconfirm")
REBAR_BASES = ("by_ratio", "from_drawing", "from_drawing_rules", "none")
TRACE_KINDS = (
    "sheet_entity",
    "question",
    "best_candidate",
    "qs_typed",
    "default",
    "derived",
    "developer_specification",
)
PLACEMENT_MEANINGS = ("at_floor_level", "floor_to_floor")
RELATION_KINDS = (
    "hosted_in",
    "passes_through",
    "in_room",
    "spans_storeys",
    "same_thing_as",
    "junction",
)


class ElementFamily(models.Model):
    """A kind of Element (`column`, `beam`, `storey`…), as data (L).

    `discipline` is `building` for the Building's own storeys and grid, else a Discipline's key, by
    value (`drawings` owns the Disciplines); `takeoff_step` is a Takeoff Step's key, by value, empty
    for a family no step reads (`apartment`). `milestone` names the milestone that first reads it.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    key = models.CharField(max_length=64)
    discipline = models.CharField(max_length=32)
    takeoff_step = models.CharField(max_length=64, blank=True)
    labels = models.JSONField(help_text="Its name per language: {language: name}.")
    identity_rule = models.CharField(max_length=64)
    ifc_class = models.CharField(max_length=64)
    ifc_predefined_type = models.CharField(max_length=64, blank=True)
    milestone = models.CharField(max_length=8)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "key"], name="live_model_family_identity"),
        ]

    def __str__(self) -> str:
        return self.key


class Element(models.Model):
    """One physical piece of a Building (T). Its id is permanent and is its IFC GlobalId.

    `building_id` and `discipline_part_id` are plain ids: the Building is `projects`', and the
    Discipline Part's table and key arrive with M1 ticket 08 (empty for the storeys and grid).
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    building_id = models.UUIDField()
    family = models.ForeignKey(ElementFamily, models.PROTECT, related_name="+", db_index=False)
    discipline_part_id = models.UUIDField(null=True, blank=True)
    identity_key = models.CharField(max_length=200)
    mark_hint = models.CharField(max_length=64, blank=True)
    created_seq = models.PositiveIntegerField()
    retired_seq = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "building_id", "family", "identity_key"],
                name="live_model_element_identity",
            ),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="live_model_element_tenant_id"),
            models.CheckConstraint(
                condition=models.Q(retired_seq__isnull=True)
                | models.Q(retired_seq__gt=models.F("created_seq")),
                name="live_model_element_retired_after_created",
            ),
        ]

    def __str__(self) -> str:
        return self.identity_key


class AttributeDefinition(models.Model):
    """One kind of fact an Element can carry, defined as data (L; ADR 0037).

    Its key is permanent and never reused: a change of meaning is a new key that `replaces_key`
    names. It is one row per `(tenant_id, key)`, so a reference by id names one version.
    `life_phases` lists the Life Phases that may hold a value (a Confirmation writes As designed, a
    Record the others); `market_scope` lists Market codes (empty: every Market); `ifc` holds the IFC
    mapping. `meaning`, `reference_face` and `datum` are M1.md C8's three words: what the value is,
    the face it is measured from, and the level or point it is measured against.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    key = models.CharField(max_length=120)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=16)
    replaces_key = models.CharField(max_length=120, blank=True)
    data_type = models.CharField(max_length=16)
    allowed_values = models.JSONField(
        default=list, blank=True, help_text="For an enum: [{code, labels}], in order."
    )
    dimension = models.CharField(max_length=32, blank=True)
    storage_unit = models.CharField(max_length=16, blank=True)
    labels = models.JSONField(help_text="Its name per language: {language: name}.")
    storage = models.CharField(max_length=16)
    life_phases = models.JSONField(help_text="The Life Phases that may hold a value, in order.")
    source = models.CharField(max_length=16)
    source_ref = models.CharField(max_length=200, blank=True)
    feeds_figures = models.BooleanField(default=False)
    deviation_tolerance = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    deviation_tolerance_kind = models.CharField(max_length=16, blank=True)
    market_scope = models.JSONField(
        default=list, blank=True, help_text="Market codes; empty for every Market."
    )
    ifc = models.JSONField(default=dict, blank=True)
    meaning = models.TextField(blank=True, default="")
    reference_face = models.TextField(blank=True, default="")
    datum = models.TextField(blank=True, default="")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "key"], name="live_model_definition_identity"),
            models.CheckConstraint(
                condition=models.Q(status__in=DEFINITION_STATUSES),
                name="live_model_definition_status",
            ),
            models.CheckConstraint(
                condition=models.Q(data_type__in=DATA_TYPES), name="live_model_definition_data_type"
            ),
            models.CheckConstraint(
                condition=models.Q(storage__in=STORAGES), name="live_model_definition_storage"
            ),
            models.CheckConstraint(
                condition=models.Q(source__in=DEFINITION_SOURCES),
                name="live_model_definition_source",
            ),
            models.CheckConstraint(
                condition=models.Q(deviation_tolerance__isnull=True, deviation_tolerance_kind="")
                | models.Q(deviation_tolerance__gte=0, deviation_tolerance_kind__in=TOLERANCE_KINDS),
                name="live_model_definition_tolerance",
            ),
            models.CheckConstraint(
                condition=~models.Q(replaces_key=models.F("key")),
                name="live_model_definition_replaces_another",
            ),
        ]

    def __str__(self) -> str:
        return self.key


class FamilyAttribute(models.Model):
    """An Attribute Definition's applicability to one Element Family (L).

    Both are named by id: each the tenant's own or its Library's (a Developer's own definition on a
    Library family, say). `override` holds a per-family override of the allowed values or range.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    definition = models.ForeignKey(AttributeDefinition, models.PROTECT, related_name="+", db_index=False)
    family = models.ForeignKey(ElementFamily, models.PROTECT, related_name="+", db_index=False)
    required = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    group = models.CharField(max_length=16)
    level = models.CharField(max_length=16)
    override = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "family"], name="live_model_famattr_family"),
        ]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "definition", "family"], name="live_model_famattr_identity"
            ),
            models.CheckConstraint(
                condition=models.Q(group__in=ATTRIBUTE_GROUPS), name="live_model_famattr_group"
            ),
            models.CheckConstraint(
                condition=models.Q(level__in=ATTRIBUTE_LEVELS), name="live_model_famattr_level"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.definition_id} on {self.family_id}"


class Record(models.Model):
    """One As built or As maintained value of an Element (T; append-only).

    `attribute_key` is an Attribute Definition's key, by value (keys are permanent). It names who
    (`recorded_by_id`, a user), when (`observed_on`, `recorded_at`), on what evidence
    (`stored_file_id` and a note) and the Model Version in force (`design_version_seq`). A correction
    is a new Record that `supersedes` the old one.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    element = models.ForeignKey(Element, models.PROTECT, related_name="+", db_index=False)
    attribute_key = models.CharField(max_length=120)
    life_phase = models.CharField(max_length=16)
    value = models.JSONField()
    observed_on = models.DateField()
    recorded_by_id = models.UUIDField()
    recorded_at = models.DateTimeField(default=timezone.now)
    stored_file_id = models.UUIDField(null=True, blank=True)
    evidence_note = models.TextField(blank=True)
    design_version_seq = models.PositiveIntegerField()
    source = models.CharField(max_length=24)
    supersedes = models.ForeignKey(
        "self", models.PROTECT, related_name="+", null=True, blank=True, db_index=False
    )

    class Meta:
        indexes: ClassVar = [
            models.Index(
                fields=["tenant_id", "element", "attribute_key"], name="live_model_record_element"
            ),
        ]
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "id"], name="live_model_record_tenant_id"),
            models.CheckConstraint(
                condition=models.Q(life_phase__in=RECORD_LIFE_PHASES),
                name="live_model_record_life_phase",
            ),
            models.CheckConstraint(
                condition=models.Q(source__in=RECORD_SOURCES), name="live_model_record_source"
            ),
            models.CheckConstraint(
                condition=~models.Q(supersedes=models.F("id")),
                name="live_model_record_supersedes_another",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.attribute_key} ({self.life_phase})"


class ElementRelation(models.Model):
    """A typed, versioned relation between two Elements, often across Parts (T; append-only but for
    `valid_to_seq`). `confirmation_id` is an upward stamp: stored, never resolved here."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    kind = models.CharField(max_length=24)
    from_element = models.ForeignKey(Element, models.PROTECT, related_name="+", db_index=False)
    to_element = models.ForeignKey(Element, models.PROTECT, related_name="+", db_index=False)
    detail = models.JSONField(default=dict, blank=True)
    valid_from_seq = models.PositiveIntegerField()
    valid_to_seq = models.PositiveIntegerField(null=True, blank=True)
    confirmation_id = models.UUIDField()

    class Meta:
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "to_element"], name="live_model_relation_to"),
        ]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "from_element", "kind", "to_element", "valid_from_seq"],
                name="live_model_relation_identity",
            ),
            models.CheckConstraint(
                condition=models.Q(kind__in=RELATION_KINDS), name="live_model_relation_kind"
            ),
            models.CheckConstraint(
                condition=~models.Q(from_element=models.F("to_element")),
                name="live_model_relation_two_elements",
            ),
            models.CheckConstraint(
                condition=models.Q(valid_to_seq__isnull=True)
                | models.Q(valid_to_seq__gt=models.F("valid_from_seq")),
                name="live_model_relation_valid_range",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.from_element_id} {self.kind} {self.to_element_id}"


class ClassificationSystem(models.Model):
    """A published classification (Uniclass 2015, PWD SoR, Vextrus's family list), with its edition
    and licence (L). `market_scope` lists Market codes (empty: every Market)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    name = models.CharField(max_length=200)
    publisher = models.CharField(max_length=200)
    edition = models.CharField(max_length=64)
    edition_date = models.DateField(null=True, blank=True)
    licence = models.CharField(max_length=200)
    attribution = models.TextField(blank=True)
    may_ship = models.BooleanField(default=False)
    market_scope = models.JSONField(
        default=list, blank=True, help_text="Market codes; empty for every Market."
    )
    uri = models.URLField(max_length=500, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "name", "edition"], name="live_model_system_identity"
            ),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="live_model_system_tenant_id"),
        ]

    def __str__(self) -> str:
        return f"{self.name} {self.edition}"


class ClassificationReference(models.Model):
    """A code as its system publishes it (`EF_20_05`), with its name and uri (L). It sits in its
    system's tenant; never a code of ours inside another's table."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    system = models.ForeignKey(ClassificationSystem, models.PROTECT, related_name="+", db_index=False)
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=500)
    uri = models.URLField(max_length=500, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "system", "code"], name="live_model_reference_identity"
            ),
        ]

    def __str__(self) -> str:
        return self.code


# M1's spine (M1.md C7; docs/data-model.md §3.3; session 16's subset). Every table is T but
# FamilyClassification (L). ModelVersion is append-only; an ElementState, an ElementTrace and a
# ViewPlacement only ever have their valid_to_seq set (migration 0002 holds both for vextrus_app).
# `apply` (services) is their one writer.


class DisciplinePart(models.Model):
    """One Discipline's part of a Building (T): the structural Elements belong to it.
    `discipline` is a Discipline's key, by value (`drawings` owns the Disciplines)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    building_id = models.UUIDField()
    discipline = models.CharField(max_length=32)
    responsible_user_id = models.UUIDField(null=True, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "building_id", "discipline"], name="live_model_part_identity"
            ),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="live_model_part_tenant_id"),
        ]

    def __str__(self) -> str:
        return self.discipline


class ModelVersion(models.Model):
    """One version of a Building's Live Model (T; append-only), numbered `seq` from 1 per Building.

    `figures_hash` is a hash over every state valid at `seq` (`services.figures_hash`), `boq`'s cache
    key; `figures_changed` says it differs from the version before. `confirmation_id` (upward) and
    `drawing_set_state_id` are plain ids.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    building_id = models.UUIDField()
    seq = models.PositiveIntegerField()
    cause = models.CharField(max_length=16)
    figures_changed = models.BooleanField()
    figures_hash = models.CharField(max_length=80)
    complete_for_state = models.BooleanField(default=False)
    confirmation_id = models.UUIDField(null=True, blank=True)
    drawing_set_state_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "building_id", "seq"], name="live_model_version_identity"
            ),
            models.CheckConstraint(condition=models.Q(seq__gte=1), name="live_model_version_seq"),
            models.CheckConstraint(
                condition=models.Q(cause__in=MODEL_VERSION_CAUSES), name="live_model_version_cause"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.building_id} @ {self.seq}"


class ElementState(models.Model):
    """An Element's facts over a range of Model Versions (T): the typed core and `attrs` (SI decimal
    strings keyed by Attribute Definition keys). Never updated in place: a change closes it
    (`valid_to_seq`) and opens the next. `storey_id` is the storey Element it is in."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    element = models.ForeignKey(Element, models.PROTECT, related_name="+", db_index=False)
    valid_from_seq = models.PositiveIntegerField()
    valid_to_seq = models.PositiveIntegerField(null=True, blank=True)
    mark = models.CharField(max_length=64, blank=True)
    storey_id = models.UUIDField(null=True, blank=True)
    band_from_id = models.UUIDField(null=True, blank=True)
    band_to_id = models.UUIDField(null=True, blank=True)
    grid_ref = models.CharField(max_length=64, blank=True)
    x_m = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    y_m = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    rotation = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    mix = models.CharField(max_length=32, blank=True)
    grade = models.CharField(max_length=32, blank=True)
    rebar_basis = models.CharField(max_length=24, blank=True)
    construction_stage = models.CharField(max_length=32, blank=True)
    casting_stage_id = models.UUIDField(null=True, blank=True)
    attrs = models.JSONField(default=dict, blank=True)
    held_by_question_id = models.UUIDField(null=True, blank=True)
    facts_hash = models.CharField(max_length=80)
    figures_hash = models.CharField(max_length=80)
    confirmation_id = models.UUIDField(null=True, blank=True)

    class Meta:
        indexes: ClassVar = [
            models.Index(
                fields=["tenant_id", "element", "valid_to_seq"], name="live_model_state_element"
            ),
        ]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "element", "valid_from_seq"], name="live_model_state_identity"
            ),
            models.CheckConstraint(
                condition=models.Q(valid_to_seq__isnull=True)
                | models.Q(valid_to_seq__gt=models.F("valid_from_seq")),
                name="live_model_state_valid_range",
            ),
            models.CheckConstraint(
                condition=models.Q(rebar_basis="") | models.Q(rebar_basis__in=REBAR_BASES),
                name="live_model_state_rebar_basis",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.mark or self.element_id} from {self.valid_from_seq}"


class ElementTrace(models.Model):
    """Where one fact of an Element came from (T), copied in on Confirmation: `anchor` names the
    sheet, the view and the entity. It has its own validity range, so a re-anchored fact opens a
    new row. `question_id` (upward) is a plain id."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    element = models.ForeignKey(Element, models.PROTECT, related_name="+", db_index=False)
    fact = models.CharField(max_length=64)
    kind = models.CharField(max_length=32)
    anchor = models.JSONField(default=dict, blank=True)
    question_id = models.UUIDField(null=True, blank=True)
    valid_from_seq = models.PositiveIntegerField()
    valid_to_seq = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        indexes: ClassVar = [
            models.Index(
                fields=["tenant_id", "element", "valid_to_seq"], name="live_model_trace_element"
            ),
        ]
        constraints: ClassVar = [
            models.CheckConstraint(
                condition=models.Q(kind__in=TRACE_KINDS), name="live_model_trace_kind"
            ),
            models.CheckConstraint(
                condition=models.Q(valid_to_seq__isnull=True)
                | models.Q(valid_to_seq__gt=models.F("valid_from_seq")),
                name="live_model_trace_valid_range",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.fact} ({self.kind})"


class ViewPlacement(models.Model):
    """Where a plan view sits in the Building (T): its meaning and, as ViewPlacementStorey rows, the
    explicit list of storeys it shows (never a first-last range). `view_id` is `drawings`' View."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    building_id = models.UUIDField()
    view_id = models.UUIDField()
    meaning = models.CharField(max_length=16)
    valid_from_seq = models.PositiveIntegerField()
    valid_to_seq = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "view_id", "valid_from_seq"], name="live_model_placement_identity"
            ),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="live_model_placement_tenant_id"),
            models.CheckConstraint(
                condition=models.Q(meaning__in=PLACEMENT_MEANINGS),
                name="live_model_placement_meaning",
            ),
            models.CheckConstraint(
                condition=models.Q(valid_to_seq__isnull=True)
                | models.Q(valid_to_seq__gt=models.F("valid_from_seq")),
                name="live_model_placement_valid_range",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.view_id} from {self.valid_from_seq}"


class ViewPlacementStorey(models.Model):
    """One storey a View Placement shows (T): the storey's Element."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    placement = models.ForeignKey(ViewPlacement, models.PROTECT, related_name="+", db_index=False)
    storey_element = models.ForeignKey(Element, models.PROTECT, related_name="+", db_index=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "placement", "storey_element"],
                name="live_model_placement_storey_identity",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.placement_id}: {self.storey_element_id}"


class FamilyClassification(models.Model):
    """An Element Family's default reference in a classification system (L): the Library's column
    is Uniclass `EF_20_10`. The family and the reference may be the tenant's own or its Library's."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    family = models.ForeignKey(ElementFamily, models.PROTECT, related_name="+", db_index=False)
    reference = models.ForeignKey(
        ClassificationReference, models.PROTECT, related_name="+", db_index=False
    )

    class Meta:
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "family"], name="live_model_famclass_family"),
        ]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "family", "reference"], name="live_model_famclass_identity"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.family_id}: {self.reference_id}"
