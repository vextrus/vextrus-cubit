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
    mapping.
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
