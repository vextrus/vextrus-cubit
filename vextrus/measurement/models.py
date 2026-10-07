"""`measurement`'s tables: private to the module (import-linter holds it). Only the one ticket per wave
that adds a migration to `measurement` edits this file. Every id comes from
`vextrus.platform.ids.new_id`.

Session 16's subset of C11 (docs/plans/M1.md; docs/data-model.md §3.4): the Rule Set and its Version,
the Measurement Rules, the BOQ Items with their Billing Units and the Rebar Ratios. All are Library
rows (L): `sync_library` writes them into each Market's Library as the owner, a tenant reads its
Market's and writes none. A reference between them names a row of the same tenant (a composite key).
`ProjectRulePin`, `DiameterSplit` and `StrengthItemChoice` come with the tickets that read them.
"""

from typing import ClassVar

from django.db import models

from vextrus.platform.ids import new_id

RULE_SET_STATUSES = ("draft", "published")
RULE_KINDS = ("quantity", "junction", "rebar_detailing", "stage", "rounding", "run_by_rule")
BASIS_KINDS = ("measured", "lump_sum", "provisional")
SUPPLY_KINDS = ("developer_materials", "material_and_labour")


class RuleSet(models.Model):
    """A Market's Rule Set: its named line of Versions (L)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False, help_text="The Market's Library tenant.")
    name = models.CharField(max_length=120)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "name"], name="measurement_ruleset_name"),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="measurement_ruleset_tenant_id"),
        ]

    def __str__(self) -> str:
        return self.name


class RuleSetVersion(models.Model):
    """One numbered Version of a Rule Set; `content_hash` is the hash of every row it holds (L)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    rule_set = models.ForeignKey(RuleSet, on_delete=models.PROTECT, related_name="versions")
    number = models.PositiveIntegerField()
    status = models.CharField(max_length=16)
    content_hash = models.CharField(max_length=80)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["rule_set", "number"], name="measurement_rsv_number"),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="measurement_rsv_tenant_id"),
            models.CheckConstraint(
                condition=models.Q(status__in=RULE_SET_STATUSES), name="measurement_rsv_status"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.rule_set_id} v{self.number}"


class MeasurementRule(models.Model):
    """A rule in Vextrus's own words, citing its clause (`F1`, `FW2`, `R2`…) (L)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    version = models.ForeignKey(RuleSetVersion, on_delete=models.PROTECT, related_name="rules")
    code = models.CharField(max_length=16)
    kind = models.CharField(max_length=24)
    family_key = models.CharField(max_length=64, blank=True, default="")
    words = models.JSONField(
        help_text="Its words per language: {language: text}; never a standard's text."
    )
    cites = models.CharField(max_length=200, help_text="The clause it follows, by number only.")
    params = models.JSONField(default=dict)
    source = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["version", "code"], name="measurement_rule_code"),
            models.CheckConstraint(
                condition=models.Q(kind__in=RULE_KINDS), name="measurement_rule_kind"
            ),
        ]

    def __str__(self) -> str:
        return self.code


class BoqItem(models.Model):
    """A BOQ Item: its code is stable across Versions (L)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    version = models.ForeignKey(RuleSetVersion, on_delete=models.PROTECT, related_name="items")
    item_code = models.CharField(max_length=64)
    labels = models.JSONField(help_text="Its description per language: {language: text}.")
    trade = models.CharField(max_length=40)
    boq_section = models.CharField(max_length=40)
    group = models.CharField(max_length=40, help_text="Its element class.")
    stage_kind = models.CharField(max_length=40, blank=True, default="")
    basis_kind = models.CharField(max_length=16)
    supply_kind = models.CharField(max_length=24)
    labour_measure = models.BooleanField(default=False)
    description_template = models.JSONField(default=dict)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["version", "item_code"], name="measurement_boqitem_code"),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="measurement_boqitem_tenant_id"),
            models.CheckConstraint(
                condition=models.Q(basis_kind__in=BASIS_KINDS), name="measurement_boqitem_basis"
            ),
            models.CheckConstraint(
                condition=models.Q(supply_kind__in=SUPPLY_KINDS), name="measurement_boqitem_supply"
            ),
        ]

    def __str__(self) -> str:
        return self.item_code


class BoqItemBillingUnit(models.Model):
    """How a BOQ Item is billed in a unit system, and the one place its SI quantity is converted (L).

    `si_per_unit` is how many `unit_si` one `billing_unit` holds, exactly (a cft is 0.3048³ m³).
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    item = models.ForeignKey(BoqItem, on_delete=models.PROTECT, related_name="billing_units")
    unit_system = models.CharField(max_length=16)
    billing_unit = models.CharField(max_length=16)
    unit_si = models.CharField(max_length=16, help_text="The SI unit a Measurement Line holds.")
    si_per_unit = models.DecimalField(max_digits=24, decimal_places=12)
    line_decimals = models.PositiveSmallIntegerField(default=2)
    total_decimals = models.PositiveSmallIntegerField(default=2)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["item", "unit_system"], name="measurement_billingunit_system"
            ),
            models.CheckConstraint(
                condition=models.Q(si_per_unit__gt=0), name="measurement_billingunit_factor"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.item_id} {self.unit_system} {self.billing_unit}"


class RebarRatio(models.Model):
    """A family's Rebar Ratio in the unit it is set in; `band` empty is the default (L)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    version = models.ForeignKey(RuleSetVersion, on_delete=models.PROTECT, related_name="rebar_ratios")
    family_key = models.CharField(max_length=64)
    band = models.UUIDField(null=True, blank=True)
    value = models.DecimalField(max_digits=10, decimal_places=4)
    unit = models.CharField(max_length=16)
    confidence = models.CharField(max_length=16, blank=True, default="")
    source = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["version", "family_key", "band"],
                name="measurement_rebarratio_band",
                nulls_distinct=False,
            ),
            models.CheckConstraint(
                condition=models.Q(unit__in=("kg/cft", "kg/m3")), name="measurement_rebarratio_unit"
            ),
            models.CheckConstraint(condition=models.Q(value__gt=0), name="measurement_rebarratio_value"),
        ]

    def __str__(self) -> str:
        return f"{self.family_key} {self.value} {self.unit}"
