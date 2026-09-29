"""`drawings`'s tables: private to the module (import-linter holds it). Only the one ticket per wave
that adds a migration to `drawings` edits this file. Every id comes from
`vextrus.platform.ids.new_id`.

Ticket 14 (docs/data-model.md §2 and §3.2). Every table but `Discipline` is a tenant table: its
`tenant_id`, row-level security with its own-tenant policy (migration 0001), every index led by
`tenant_id`, and a reference inside `drawings` held to a row of the same tenant by a composite key
(`(tenant_id, x_id)`), beside Django's, and a reference between two rows of one Drawing Set to a
row of the same set (`(tenant_id, drawing_set_id, x_id)`), so no write crosses Projects.
`Discipline` is a Library table: its rows are a Market's Library's, read through `app.library_id`
and written only by `sync_library`, as the owner; a tenant row names one by id, and a trigger
refuses one the writer cannot read (another Market's).

**One row per printed sheet.** A `Sheet` is the drawing a number names, `(set, Building, Discipline,
number)`; a `SheetRevision` is one printed issue of it, `(sheet, source file, location)`: S-07 rev A
and S-07 rev B drawn side by side in one file are one Sheet and two SheetRevisions. A sheet with no
number is its own Sheet, known by `(set, source file, location)`. What is read or decided about one
printed sheet (its kind, render, Plot, confirmation and exclusion) is kept on its SheetRevision.
"""

from typing import ClassVar

from django.db import models
from django.utils import timezone

from vextrus.platform.ids import new_id

_KEY = r"^[a-z][a-z0-9_]*$"
_SHA256 = r"^[0-9a-f]{64}$"


def _tenant_id_key(model: str) -> models.UniqueConstraint:
    """(tenant_id, id): what a composite key inside `drawings` names."""
    return models.UniqueConstraint(fields=["tenant_id", "id"], name=f"drawings_{model}_tenant_id")


def _set_id_key(model: str) -> models.UniqueConstraint:
    """(tenant_id, drawing_set, id): what a key holding a reference inside one Drawing Set names."""
    return models.UniqueConstraint(
        fields=["tenant_id", "drawing_set", "id"], name=f"drawings_{model}_set_id"
    )


# The Library: the Market's Disciplines ------------------------------------------------------------


class DisciplineKind(models.TextChoices):
    STRUCTURAL = "structural"
    ARCHITECTURAL = "architectural"
    MEP = "mep"


class Discipline(models.Model):
    """One family of drawings a Market knows (CONTEXT.md), with its one name per language and the
    sheet-number prefixes it is known by. A Library row per Market (`drawings/library.py`)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False, help_text="The Market's Library tenant.")
    key = models.CharField(max_length=40, help_text="Permanent: other modules hold it by value.")
    labels = models.JSONField(help_text="Its one name per language: {language: name}.")
    kind = models.CharField(max_length=16, choices=DisciplineKind.choices)
    sort_order = models.PositiveSmallIntegerField()
    prefixes = models.JSONField(
        default=list,
        blank=True,
        help_text="The sheet-number prefixes it is known by, as a drawing writes them: a list.",
    )

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "key"], name="drawings_discipline_key"),
            models.CheckConstraint(
                condition=models.Q(key__regex=_KEY), name="drawings_discipline_key_shape"
            ),
            models.CheckConstraint(
                condition=models.Q(kind__in=DisciplineKind.values), name="drawings_discipline_kind"
            ),
        ]

    def __str__(self) -> str:
        return self.key


# The Drawing Set, its states and its Revisions ---------------------------------------------------


class DrawingSet(models.Model):
    """All the drawings issued for one Project (CONTEXT.md): one per Project, across its Buildings
    and Disciplines, made with its first file. `project_id` is a downward id to `projects`."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    name = models.CharField(max_length=200, blank=True)
    current_state = models.ForeignKey(
        "DrawingSetState",
        models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        db_index=False,
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "project_id"], name="drawings_drawingset_one_per_project"
            ),
            _tenant_id_key("drawingset"),
        ]

    def __str__(self) -> str:
        return str(self.project_id)


class StateCause(models.TextChoices):
    REVISION = "revision"
    READER_UPGRADE = "reader_upgrade"


class StateStatus(models.TextChoices):
    READING = "reading"
    READ = "read"
    CURRENT = "current"
    SUPERSEDED = "superseded"


class DrawingSetState(models.Model):
    """One state of a Drawing Set: which printed sheets it holds, as read by one reader version. M0
    has one per set, seq 1, current from the start (a reader upgrade or a Revision makes the next)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    drawing_set = models.ForeignKey(DrawingSet, models.PROTECT, related_name="+", db_index=False)
    seq = models.PositiveIntegerField()
    cause = models.CharField(max_length=16, choices=StateCause.choices)
    revision = models.ForeignKey(
        "Revision", models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    reader = models.CharField(max_length=64, blank=True)
    reader_version = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=StateStatus.choices)
    parent_state = models.ForeignKey(
        "self", models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "drawing_set", "seq"], name="drawings_drawingsetstate_seq"
            ),
            _tenant_id_key("drawingsetstate"),
            _set_id_key("drawingsetstate"),
            models.CheckConstraint(
                condition=models.Q(cause__in=StateCause.values), name="drawings_drawingsetstate_cause"
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=StateStatus.values),
                name="drawings_drawingsetstate_status",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.drawing_set_id} #{self.seq}"


class RevisionKind(models.TextChoices):
    FIRST_ISSUE = "first_issue"
    REISSUE = "reissue"


class Revision(models.Model):
    """An issue of one Discipline's drawings (CONTEXT.md; each Discipline Part has its own
    Revisions, ADR 0040). M0 makes only first issues: a file of a Discipline the set does not yet
    hold is that Discipline's first issue, never a Revision of another (the plan's review Q6)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    drawing_set = models.ForeignKey(DrawingSet, models.PROTECT, related_name="+", db_index=False)
    seq = models.PositiveIntegerField()
    label = models.CharField(max_length=32, blank=True, help_text="As the consultant marks it.")
    discipline = models.ForeignKey(Discipline, models.PROTECT, related_name="+", db_index=False)
    kind = models.CharField(max_length=16, choices=RevisionKind.choices)
    received_at = models.DateTimeField(default=timezone.now)
    received_by = models.UUIDField(null=True, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "drawing_set", "seq"], name="drawings_revision_seq"
            ),
            models.UniqueConstraint(
                fields=["tenant_id", "drawing_set", "discipline"],
                condition=models.Q(kind="first_issue"),
                name="drawings_revision_one_first_issue",
            ),
            _tenant_id_key("revision"),
            _set_id_key("revision"),
            models.CheckConstraint(
                condition=models.Q(kind__in=RevisionKind.values), name="drawings_revision_kind"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.drawing_set_id} #{self.seq}"


# Files ------------------------------------------------------------------------------------------


class FileFormat(models.TextChoices):
    DWG = "dwg"
    PDF = "pdf"


class ReadStatus(models.TextChoices):
    """A file's reading as its own columns say it (a job's state is read over it while it has one)."""

    QUEUED = "queued"
    READING = "reading"
    READ = "read"
    QUARANTINED = "quarantined"
    """Held: its two readers disagree, so it may be misread (ADR 0029)."""
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUSED = "refused"
    """A scanned PDF (ADR 0014)."""


class HeldAnswer(models.TextChoices):
    """What the QS decided about a held file (its Question, 21c; m0-screens 4.5 "Held, answered")."""

    READ_ANYWAY = "read_anyway"
    """Its sheets are used, marked."""
    AWAIT_RESAVED = "await_resaved"
    """Set aside, waiting for the re-saved file."""
    SENT_TO_VEXTRUS = "sent_to_vextrus"
    """Set aside, sent to Vextrus to check."""


class DisciplineSource(models.TextChoices):
    FILE_NAME = "file_name"
    SHEET_NUMBERS = "sheet_numbers"
    QS = "qs"
    """The QS chose it: never overwritten by the machine."""


class DrawingFile(models.Model):
    """One uploaded file of a Drawing Set, kept once per set by its contents (sha256), with its
    reading's state and reports as message codes and parameters.

    `original_name` is the QS's label for it and nothing more: never a path or a storage key.
    `added_by_name` and `cancelled_by_name` keep the person's name as it was at the act (platform
    offers no service naming a user, and its models are its own), beside their ids.
    `building_id` is the Building whose sheets it holds (the Project's only one in M0; empty for a
    file of the Site); `stored_file_id` the original's StoredFile; both downward ids.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    drawing_set = models.ForeignKey(DrawingSet, models.PROTECT, related_name="+", db_index=False)
    revision = models.ForeignKey(
        Revision, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    sha256 = models.CharField(max_length=64, editable=False)
    format = models.CharField(max_length=8, choices=FileFormat.choices, editable=False)
    original_name = models.CharField(max_length=255, editable=False)
    size = models.PositiveBigIntegerField(editable=False)
    stored_file_id = models.UUIDField(editable=False)
    discipline = models.ForeignKey(
        Discipline, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    discipline_source = models.CharField(
        max_length=16, choices=DisciplineSource.choices, blank=True, default=""
    )
    building_id = models.UUIDField(null=True, blank=True, editable=False)
    read_status = models.CharField(max_length=16, choices=ReadStatus.choices, default=ReadStatus.QUEUED)
    read_step = models.CharField(max_length=64, blank=True, help_text="The step reading now.")
    sheets_done = models.PositiveIntegerField(default=0)
    sheets_total = models.PositiveIntegerField(
        null=True, blank=True, help_text="Its sheets (a DWG) or pages (a PDF), once known."
    )
    progress_at = models.DateTimeField(null=True, blank=True)
    sheets_started_at = models.DateTimeField(null=True, blank=True)
    read_job_id = models.BigIntegerField(null=True, blank=True)
    read_tries = models.PositiveSmallIntegerField(
        default=0, help_text="The tries its reading took, when it ended without a job to say so."
    )
    finding = models.JSONField(null=True, blank=True, help_text="Why it is held or failed: a message.")
    held_answer = models.CharField(max_length=16, choices=HeldAnswer.choices, blank=True, default="")
    cross_check = models.JSONField(null=True, blank=True)
    upload_report = models.JSONField(null=True, blank=True)
    font_report = models.JSONField(null=True, blank=True)
    bangla_ansi = models.JSONField(null=True, blank=True)
    bangla_lines = models.JSONField(default=list, blank=True)
    unmatched_pages = models.JSONField(default=list, blank=True)
    empty_layouts = models.PositiveIntegerField(default=0)
    sheets_refused = models.PositiveIntegerField(
        default=0, help_text="Sheets the reading found and did not keep: a text past its column."
    )
    added_by = models.UUIDField(null=True, blank=True, editable=False)
    added_by_name = models.CharField(
        max_length=200, blank=True, editable=False, help_text="Their name at the time, as shown."
    )
    added_by_vextrus = models.BooleanField(
        default=False, editable=False, help_text="Added by a Vextrus Engineer: shown with (Vextrus)."
    )
    added_at = models.DateTimeField(default=timezone.now, editable=False)
    cancelled_by = models.UUIDField(null=True, blank=True)
    cancelled_by_name = models.CharField(max_length=200, blank=True)
    cancelled_by_vextrus = models.BooleanField(default=False)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "drawing_set", "sha256"], name="drawings_drawingfile_once"
            ),
            _tenant_id_key("drawingfile"),
            _set_id_key("drawingfile"),
            models.CheckConstraint(
                condition=models.Q(sha256__regex=_SHA256), name="drawings_drawingfile_sha256_hex"
            ),
            models.CheckConstraint(
                condition=models.Q(format__in=FileFormat.values), name="drawings_drawingfile_format"
            ),
            models.CheckConstraint(
                condition=models.Q(read_status__in=ReadStatus.values),
                name="drawings_drawingfile_read_status",
            ),
            models.CheckConstraint(
                condition=models.Q(discipline__isnull=True, discipline_source="")
                | models.Q(discipline__isnull=False, discipline_source__in=DisciplineSource.values),
                name="drawings_drawingfile_discipline_source",
            ),
            models.CheckConstraint(
                condition=~models.Q(original_name=""), name="drawings_drawingfile_named"
            ),
            models.CheckConstraint(
                condition=models.Q(held_answer="")
                | models.Q(read_status=ReadStatus.QUARANTINED, held_answer__in=HeldAnswer.values),
                name="drawings_drawingfile_held_answer",
            ),
        ]

    def __str__(self) -> str:
        return self.original_name


class Artefact(models.Model):
    """A ReadArtefact kept for a file, one per reader version (and artefact schema version): an
    anchor names the reader version it was read with, and an artefact an anchor names is never
    deleted (ADR 0031 §2)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    file = models.ForeignKey(DrawingFile, models.PROTECT, related_name="+", db_index=False)
    reader = models.CharField(max_length=64)
    reader_version = models.CharField(max_length=64)
    schema_version = models.PositiveSmallIntegerField()
    insunits = models.PositiveSmallIntegerField(help_text="Its drawing units, as the file's header.")
    stored_file_id = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "file", "reader", "reader_version", "schema_version"],
                name="drawings_artefact_one_per_version",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.file_id} {self.reader} {self.reader_version}"


class ReadStep(models.Model):
    """A read job's completed step (09's `StepStore`): kept once, never changed or deleted."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    file = models.ForeignKey(DrawingFile, models.PROTECT, related_name="+", db_index=False)
    step = models.CharField(max_length=64)
    input_hash = models.CharField(max_length=64)
    result = models.JSONField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "file", "step", "input_hash"], name="drawings_readstep_key"
            ),
            models.CheckConstraint(
                condition=models.Q(input_hash__regex=_SHA256), name="drawings_readstep_hash_hex"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.file_id} {self.step}"


# Sheets and views ---------------------------------------------------------------------------------


class Sheet(models.Model):
    """One drawing sheet of a Drawing Set (CONTEXT.md), known by `(set, Building, Discipline,
    number)`; with no number, by `(set, source file, location)` (then `source_file` and
    `location_key` are set, and only then). Its Building is its file's; its Discipline its file's,
    else its number's prefix. What was printed is on its SheetRevisions."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    drawing_set = models.ForeignKey(DrawingSet, models.PROTECT, related_name="+", db_index=False)
    building_id = models.UUIDField(null=True, blank=True)
    discipline = models.ForeignKey(
        Discipline, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    number = models.CharField(max_length=64, blank=True, default="")
    title = models.TextField(blank=True)
    consultant_office = models.CharField(max_length=200, blank=True, help_text="Empty until M1.")
    storeys_as_stated = models.TextField(blank=True)
    source_file = models.ForeignKey(
        DrawingFile, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    location_key = models.TextField(blank=True, default="")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "drawing_set", "building_id", "discipline", "number"],
                condition=~models.Q(number=""),
                nulls_distinct=False,
                name="drawings_sheet_identity",
            ),
            models.UniqueConstraint(
                fields=["tenant_id", "drawing_set", "source_file", "location_key"],
                condition=models.Q(number=""),
                name="drawings_sheet_unnumbered_identity",
            ),
            _tenant_id_key("sheet"),
            _set_id_key("sheet"),
            models.CheckConstraint(
                condition=~models.Q(number="") & models.Q(source_file__isnull=True, location_key="")
                | models.Q(number="", source_file__isnull=False) & ~models.Q(location_key=""),
                name="drawings_sheet_number_or_place",
            ),
        ]

    def __str__(self) -> str:
        return self.number or self.title


class Decision(models.TextChoices):
    CONFIRMED = "confirmed"
    EXCLUDED = "excluded"


class ExclusionReason(models.TextChoices):
    """The seven exclusion reasons (docs/data-model.md §3.2; engine.recognise.types.ExclusionReason)."""

    SUPERSEDED = "superseded"
    DUPLICATE = "duplicate"
    COVER_INDEX = "cover_index"
    FOR_INFORMATION = "for_information"
    BY_OTHERS = "by_others"
    BLANK = "blank"
    OTHER = "other"


def _decided(prefix: str) -> list[models.BaseConstraint]:
    """A decision's columns hang together: every decision carries its confirmation stamp, an
    exclusion its reason and only an exclusion one, text exactly for `other`; and the proposal's
    own exclusion has the same shape."""
    Q = models.Q
    reasons = ExclusionReason.values
    others = [reason for reason in reasons if reason != ExclusionReason.OTHER]
    return [
        models.CheckConstraint(
            condition=Q(decision="", confirmation_id__isnull=True)
            | Q(decision__in=Decision.values, confirmation_id__isnull=False),
            name=f"{prefix}_decision_stamped",
        ),
        models.CheckConstraint(
            condition=Q(decision=Decision.EXCLUDED, excluded_reason__in=reasons)
            | Q(decision="", excluded_reason="")
            | Q(decision=Decision.CONFIRMED, excluded_reason=""),
            name=f"{prefix}_excluded_reason",
        ),
        models.CheckConstraint(
            condition=Q(excluded_reason=ExclusionReason.OTHER, excluded_text__gt="")
            | Q(excluded_reason__in=others, excluded_text="")
            | Q(excluded_reason="", excluded_text=""),
            name=f"{prefix}_excluded_text",
        ),
        models.CheckConstraint(
            condition=Q(proposed_exclusion=ExclusionReason.OTHER, proposed_exclusion_text__gt="")
            | Q(proposed_exclusion__in=others, proposed_exclusion_text="")
            | Q(proposed_exclusion="", proposed_exclusion_text=""),
            name=f"{prefix}_proposed_exclusion",
        ),
    ]


class PlotNone(models.TextChoices):
    """Why a printed sheet has no Plot (m0-screens 4.6, "The Plot")."""

    NO_PDF = "no_pdf"
    """No PDF has been added for its Discipline."""
    NO_PAGE = "no_page"
    """No page of its Discipline's PDF (`plot_file`) matched it."""
    PDF_REFUSED = "pdf_refused"
    """Its PDF (`plot_file`) was a scan, and was refused."""
    NO_NUMBER = "no_number"
    """It has no number, so no page could be matched to it."""


class SheetRevision(models.Model):
    """One printed sheet: one issue of a Sheet, in one file at one location (a layout, or a frame's
    box laid out in the drawing), with what was read of it and what the QS decided.

    `location_key` is its location as canonical JSON; `sheet_key` the opaque key its anchors name
    it by (`DwgAnchor.sheet`), stored and never parsed. `source_sha256`, `reader_version` and
    `anchors` are the Trace anchor's columns (docs/data-model.md §3.2, "The Trace anchor").
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    drawing_set = models.ForeignKey(DrawingSet, models.PROTECT, related_name="+", db_index=False)
    sheet = models.ForeignKey(Sheet, models.PROTECT, related_name="+", db_index=False)
    revision = models.ForeignKey(
        Revision, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    source_file = models.ForeignKey(DrawingFile, models.PROTECT, related_name="+", db_index=False)
    location_key = models.TextField()
    location = models.JSONField()
    sheet_key = models.TextField(blank=True, default="")
    ordinal = models.PositiveIntegerField(help_text="Its place among its file's sheets, from 1.")
    title = models.TextField(blank=True)
    revision_mark = models.CharField(max_length=64, blank=True)
    issue_date = models.CharField(max_length=64, blank=True)
    storeys_as_stated = models.TextField(blank=True)
    sources = models.JSONField(default=dict, blank=True)
    content_hash = models.CharField(max_length=64, blank=True)
    kind = models.CharField(max_length=64, blank=True, default="", help_text="Its kind, as read.")
    confirmed_kind = models.CharField(max_length=64, blank=True, default="")
    source_sha256 = models.CharField(max_length=64)
    reader_version = models.CharField(max_length=64)
    anchors = models.JSONField(default=list, blank=True)
    proposed_exclusion = models.CharField(
        max_length=16, choices=ExclusionReason.choices, blank=True, default=""
    )
    proposed_exclusion_text = models.TextField(blank=True)
    views_refused = models.PositiveIntegerField(
        default=0, help_text="Its views the reading found and did not keep: a text past its column."
    )
    render_file_id = models.UUIDField(null=True, blank=True)
    render_key = models.CharField(max_length=1200, blank=True, help_text="Its render's storage key.")
    plot_file = models.ForeignKey(
        DrawingFile, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    plot_page = models.PositiveIntegerField(null=True, blank=True)
    plot_transform = models.JSONField(null=True, blank=True)
    plot_residual = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    render_f1 = models.DecimalField(max_digits=7, decimal_places=6, null=True, blank=True)
    plot_none_reason = models.CharField(max_length=16, choices=PlotNone.choices, blank=True, default="")
    decision = models.CharField(max_length=16, choices=Decision.choices, blank=True, default="")
    confirmation_id = models.UUIDField(null=True, blank=True, help_text="An upward stamp.")
    decided_by = models.UUIDField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    excluded_reason = models.CharField(
        max_length=16, choices=ExclusionReason.choices, blank=True, default=""
    )
    excluded_text = models.TextField(blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "sheet", "source_file", "location_key"],
                name="drawings_sheetrevision_identity",
            ),
            models.UniqueConstraint(
                fields=["tenant_id", "source_file", "location_key"],
                name="drawings_sheetrevision_one_per_place",
            ),
            _tenant_id_key("sheetrevision"),
            _set_id_key("sheetrevision"),
            models.CheckConstraint(
                condition=models.Q(source_sha256__regex=_SHA256),
                name="drawings_sheetrevision_sha256_hex",
            ),
            models.CheckConstraint(
                condition=models.Q(kind="") | models.Q(kind__regex=_KEY),
                name="drawings_sheetrevision_kind_key",
            ),
            models.CheckConstraint(
                condition=models.Q(confirmed_kind="") | models.Q(confirmed_kind__regex=_KEY),
                name="drawings_sheetrevision_confirmed_kind_key",
            ),
            models.CheckConstraint(
                condition=models.Q(plot_page__isnull=True)
                | models.Q(plot_file__isnull=False, plot_page__gte=1, plot_none_reason=""),
                name="drawings_sheetrevision_plot",
            ),
            models.CheckConstraint(
                condition=models.Q(plot_none_reason="") | models.Q(plot_none_reason__in=PlotNone.values),
                name="drawings_sheetrevision_plot_none",
            ),
            *_decided("drawings_sheetrevision"),
        ]

    def __str__(self) -> str:
        return f"{self.sheet_id} @ {self.location_key}"


class StateSheet(models.Model):
    """A printed sheet a Drawing Set's state holds (the map row)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    drawing_set = models.ForeignKey(DrawingSet, models.PROTECT, related_name="+", db_index=False)
    state = models.ForeignKey(DrawingSetState, models.PROTECT, related_name="+", db_index=False)
    sheet_revision = models.ForeignKey(SheetRevision, models.PROTECT, related_name="+", db_index=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "state", "sheet_revision"], name="drawings_statesheet_once"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.state_id}: {self.sheet_revision_id}"


class ViewKind(models.TextChoices):
    """The one list of view kinds (engine.recognise.types.ViewKind)."""

    PLAN = "plan"
    SECTION = "section"
    ELEVATION = "elevation"
    SCHEDULE = "schedule"
    DETAIL = "detail"
    NOTES = "notes"
    LEGEND = "legend"
    TITLE_BLOCK = "title_block"
    KEY_PLAN = "key_plan"
    PERSPECTIVE = "perspective"


class View(models.Model):
    """One part of a printed sheet (CONTEXT.md), as one reader version read it, in reading order.

    Its box is in drawing units, as four decimal strings; its storeys an explicit list of canonical
    storey keys, never a range. `steps`, `part` and `proposed_exclusion` are what the reading
    proposes to do with it; `decision` what the QS decided.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    sheet_revision = models.ForeignKey(SheetRevision, models.PROTECT, related_name="+", db_index=False)
    reader_version = models.CharField(max_length=64)
    ordinal = models.PositiveIntegerField()
    kind = models.CharField(max_length=16, choices=ViewKind.choices)
    confirmed_kind = models.CharField(max_length=16, choices=ViewKind.choices, blank=True, default="")
    title = models.TextField(blank=True)
    box = models.JSONField(help_text="[x0, y0, x1, y1] in drawing units, as decimal strings.")
    drawing_unit = models.CharField(max_length=8, blank=True)
    not_to_scale = models.BooleanField(default=False)
    stated_scale_text = models.CharField(max_length=64, blank=True)
    confirmed_scale = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    storeys_as_stated = models.TextField(blank=True)
    storeys = models.JSONField(default=list, blank=True)
    storeys_meaning = models.CharField(max_length=16, blank=True, default="")
    subject = models.CharField(max_length=64, blank=True, default="")
    layer = models.CharField(max_length=8, blank=True, default="")
    steps = models.JSONField(default=list, blank=True)
    part = models.ForeignKey(
        Discipline,
        models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        db_index=False,
        help_text="The Discipline Part it is proposed to (an MEP view, or a legend).",
    )
    proposed_exclusion = models.CharField(
        max_length=16, choices=ExclusionReason.choices, blank=True, default=""
    )
    proposed_exclusion_text = models.TextField(blank=True)
    source_sha256 = models.CharField(max_length=64)
    anchors = models.JSONField(default=list, blank=True)
    predecessor_view = models.ForeignKey(
        "self", models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    decision = models.CharField(max_length=16, choices=Decision.choices, blank=True, default="")
    confirmation_id = models.UUIDField(null=True, blank=True, help_text="An upward stamp.")
    decided_by = models.UUIDField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    excluded_reason = models.CharField(
        max_length=16, choices=ExclusionReason.choices, blank=True, default=""
    )
    excluded_text = models.TextField(blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "sheet_revision", "reader_version", "ordinal"],
                name="drawings_view_identity",
            ),
            _tenant_id_key("view"),
            models.CheckConstraint(
                condition=models.Q(kind__in=ViewKind.values), name="drawings_view_kind"
            ),
            models.CheckConstraint(
                condition=models.Q(confirmed_kind="") | models.Q(confirmed_kind__in=ViewKind.values),
                name="drawings_view_confirmed_kind",
            ),
            models.CheckConstraint(
                condition=models.Q(source_sha256__regex=_SHA256), name="drawings_view_sha256_hex"
            ),
            *_decided("drawings_view"),
        ]

    def __str__(self) -> str:
        return f"{self.sheet_revision_id} #{self.ordinal}"


class UsedId(models.Model):
    """Every id a Sheet, a printed sheet, a view or a state's map row has had: written by the
    tables' own trigger at each insert, never changed or deleted (migration 0001). The app may
    delete those rows (a reading replaces them), so without this an id could come back naming
    another row, and whatever names it (takeoff's Coverage, placements and Traces) would follow; an
    id, once used, is never used again, by any Developer (so its one key does not lead with
    tenant_id: it holds every Developer's ids)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    used_id = models.UUIDField(editable=False, help_text="The id a row has had.")

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["used_id"], name="drawings_usedid_once"),
        ]

    def __str__(self) -> str:
        return str(self.used_id)
