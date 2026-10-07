"""`rates`'s tables: private to the module (import-linter holds it). Only the one ticket per wave
that adds a migration to `rates` edits this file. Every id comes from
`vextrus.platform.ids.new_id`.

S16-RT's subset of docs/plans/M1.md C12 (docs/data-model.md §3.4): Resources, Market Price sets and
their prices, Rate Analyses and their lines. Labour Contracts, their covers and the piling choice are
not in this slice.

Two kinds of row, one tenant column (docs/data-model.md §2, the Library rule):
- the Library's (`tenant_id` the Market's Library tenant): every Resource, every Rate Analysis and its
  lines, and the starter Market Price set with its prices. `sync_library` writes them as the owner;
  the app only reads them (migration 0001).
- the Developer's own: its Market Price set, copied from the starter when the Developer is made (or
  at first use, for one made before), and every edit of a price. A Rate Analysis is priced from the
  Developer's own set, so a Developer's edit never reaches another Developer.
"""

from typing import ClassVar

from django.db import models
from django.utils import timezone

from vextrus.platform.ids import new_id


class ResourceKind(models.TextChoices):
    MATERIAL = "material"
    LABOUR = "labour"
    PLANT = "plant"
    LABOUR_CONTRACT = "labour_contract"
    MATERIAL_AND_LABOUR = "material_and_labour"


class Resource(models.Model):
    """Something a Rate Analysis uses and a Market Price prices: a material, a day or a unit of
    labour, a plant hire. A Library row; its `code` is permanent (every price and line holds it)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False, help_text="The Market's Library tenant.")
    code = models.CharField(max_length=64, help_text="Permanent, lower-case words: `cement_opc`.")
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=24, choices=ResourceKind.choices)
    quoted_unit = models.CharField(max_length=16, help_text="A plain code: bag, cft, kg, sft, nos.")
    schedule_group = models.CharField(max_length=64, blank=True, default="")
    in_material_schedule = models.BooleanField(default=False)
    procurement_lead_days = models.PositiveSmallIntegerField(null=True, blank=True)
    ordinal = models.PositiveSmallIntegerField(
        default=0, help_text="Where the Resource sits in the list of prices."
    )

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "code"], name="rates_resource_code"),
        ]

    def __str__(self) -> str:
        return self.code


class PriceSetStatus(models.TextChoices):
    OPEN = "open"
    FROZEN = "frozen"


class MarketPriceSet(models.Model):
    """A dated set of Market Prices in one currency (C12). The Library holds the starter set; a
    Developer's own is a copy of it (`parent_set`), the one its Rate Analyses are priced from."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    effective_date = models.DateField()
    label = models.CharField(max_length=200)
    currency = models.CharField(max_length=3, help_text="The Market's currency, as its row gives it.")
    status = models.CharField(max_length=8, choices=PriceSetStatus.choices, default=PriceSetStatus.OPEN)
    parent_set = models.ForeignKey(
        "self", models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    source = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "effective_date", "label"], name="rates_marketpriceset_identity"
            ),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="rates_marketpriceset_tenant_id"),
        ]

    def __str__(self) -> str:
        return self.label


class MarketPrice(models.Model):
    """One Resource's price in a set, per its quoted unit, or empty: "rate not entered", never a
    silent zero (docs/data-model.md §3.4; C12). `source_ref` names where the figure is from: the
    page of the Schedule of Rates for the starter set."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    price_set = models.ForeignKey(MarketPriceSet, models.CASCADE, related_name="prices", db_index=False)
    resource = models.ForeignKey(Resource, models.PROTECT, related_name="+", db_index=False)
    price = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Empty: the rate is not entered.",
    )
    changed_at = models.DateTimeField(default=timezone.now)
    changed_by_user_id = models.UUIDField(
        null=True, blank=True, help_text="Who last changed it; empty for the starter's own value."
    )
    source_ref = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["price_set", "resource"], name="rates_marketprice_identity"),
            models.CheckConstraint(
                condition=models.Q(price__isnull=True) | models.Q(price__gte=0),
                name="rates_marketprice_not_negative",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "price_set"], name="rates_price_tenant_set")
        ]

    def __str__(self) -> str:
        return f"{self.resource_id}"


class RateAnalysis(models.Model):
    """What one unit of a BOQ Item takes (C12), by item code: its lines' Resources at their
    quantities. A Library row; `per_unit` is the unit it is analysed in, a plain code."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False, help_text="The Market's Library tenant.")
    item_code = models.CharField(max_length=64)
    per_unit = models.CharField(max_length=16)
    shown_per = models.PositiveSmallIntegerField(default=100)
    mix = models.CharField(max_length=16, blank=True, default="")
    dry_volume_factor = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    benchmark_ref = models.CharField(
        max_length=64, blank=True, default="", help_text="The Market's benchmark item, e.g. `07.3.2`."
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "item_code"], name="rates_rateanalysis_item"),
        ]

    def __str__(self) -> str:
        return self.item_code


class RateAnalysisLine(models.Model):
    """One Resource in a Rate Analysis: `qty_per_unit` in the Resource's own unit, per one `per_unit`
    of the item, and its wastage. `source_ref` says where the quantity is from."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False, help_text="The Market's Library tenant.")
    analysis = models.ForeignKey(RateAnalysis, models.CASCADE, related_name="lines", db_index=False)
    resource = models.ForeignKey(Resource, models.PROTECT, related_name="+", db_index=False)
    kind = models.CharField(max_length=16)
    ordinal = models.PositiveSmallIntegerField()
    qty_per_unit = models.DecimalField(max_digits=14, decimal_places=6)
    wastage_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    source_ref = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["analysis", "ordinal"], name="rates_rateanalysisline_order"),
            models.CheckConstraint(
                condition=models.Q(qty_per_unit__gt=0) & models.Q(wastage_pct__gte=0),
                name="rates_rateanalysisline_positive",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "analysis"], name="rates_line_tenant_analysis")
        ]

    def __str__(self) -> str:
        return f"{self.analysis_id}:{self.ordinal}"
