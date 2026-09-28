"""`projects`'s tables: private to the module (import-linter holds it). Only the one ticket per wave
that adds a migration to `projects` edits this file. Every id comes from
`vextrus.platform.ids.new_id`.

Each table is a tenant table (docs/data-model.md §2 and §3.1): `tenant_id`, row-level security with its
own-tenant policy (migration 0001), every index led by `tenant_id`. A Site or a Building is held to a
Project of its own tenant by a composite key (`(tenant_id, project_id)`), besides Django's key.
"""

from typing import ClassVar

from django.db import models
from django.db.models.functions import Upper
from django.utils import timezone

from vextrus.platform.ids import new_id


class Project(models.Model):
    """One Developer's development on one plot of land (CONTEXT.md).

    `market_id` is the Developer's Market (a downward id to `platform`, read through its services);
    `currency_code` is that Market's currency, stored when the Project is made; `unit_system` is its
    Display Units, one its Market offers. Its code is unique in the Developer whatever its case.
    Target Cost and Saleable Area are M1 to M2 fields.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=200)
    address = models.CharField(max_length=500, blank=True)
    market_id = models.UUIDField(editable=False)
    currency_code = models.CharField(max_length=3, editable=False, help_text="ISO 4217.")
    unit_system = models.CharField(max_length=16)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                models.F("tenant_id"), Upper("code"), name="projects_project_code_unique"
            ),
            models.UniqueConstraint(fields=["tenant_id", "id"], name="projects_project_tenant_id"),
            models.CheckConstraint(
                condition=~models.Q(code="") & ~models.Q(name=""),
                name="projects_project_code_and_name",
            ),
        ]

    def __str__(self) -> str:
        return self.code


class Site(models.Model):
    """The Project's land outside its Buildings: one per Project, made with it (ADR 0036). Its
    boundary and area are read or entered later (empty in the MVP)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project = models.ForeignKey(Project, models.CASCADE, related_name="+", db_index=False)
    name = models.CharField(max_length=200, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "project"], name="projects_site_one"),
        ]

    def __str__(self) -> str:
        return str(self.project_id)


class Building(models.Model):
    """One structure of a Project (ADR 0036). M0 makes one with each Project and never a second;
    M4 reads more. Gross Floor Area is an M1 to M2 field."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project = models.ForeignKey(Project, models.CASCADE, related_name="+", db_index=False)
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=200)
    ordinal = models.PositiveSmallIntegerField()

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "project", "code"], name="projects_building_code_unique"
            ),
            models.UniqueConstraint(
                fields=["tenant_id", "project", "ordinal"], name="projects_building_ordinal_unique"
            ),
        ]

    def __str__(self) -> str:
        return self.code
