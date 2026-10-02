"""`takeoff`'s tables: private to the module (import-linter holds it). Only the one ticket per wave
that adds a migration to `takeoff` edits this file. Every id comes from
`vextrus.platform.ids.new_id`.

Ticket 19a (docs/data-model.md §3.4, Step 1's subset). `TakeoffStep` and `Check` are Library tables:
a Market's Library's rows, read through `app.library_id` and written only by `sync_library` as the
owner (`takeoff/library.py`). Every other table is a tenant table: its `tenant_id`, row-level security
with its own-tenant policy, every index led by `tenant_id`, and each row of one Project: a reference
inside `takeoff` names a row of the same tenant and Project by a composite key
(`(tenant_id, project_id, x_id)`, migration 0001), so no write crosses Projects inside one Developer.
Ids of other modules' rows (a printed sheet, a view, a file, a Building, a Jev answer) are downward
ids, held by value and checked by the services that write them.

A Takeoff Step is named by its permanent key (`step`), a Discipline by its key, by value.
"""

from typing import ClassVar

from django.conf import settings
from django.db import models
from django.utils import timezone

from vextrus.platform.ids import new_id

_KEY = r"^[a-z][a-z0-9_]*$"


def _project_key(model: str) -> models.UniqueConstraint:
    """(tenant_id, project_id, id): what a reference inside one Project names (migration 0001)."""
    return models.UniqueConstraint(
        fields=["tenant_id", "project_id", "id"], name=f"takeoff_{model}_project_id"
    )


def _index(model: str, *fields: str) -> models.Index:
    return models.Index(fields=["tenant_id", *fields], name=f"takeoff_{model}_{'_'.join(fields)}"[:30])


# The Library: the Takeoff Steps and the Checks --------------------------------------------------------


class TakeoffStep(models.Model):
    """One of the fourteen Takeoff Steps (ADR 0007), in the building-first order: a Library row."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False, help_text="The Market's Library tenant.")
    number = models.PositiveSmallIntegerField()
    key = models.CharField(max_length=40, help_text="Permanent: held by value.")
    labels = models.JSONField(help_text="Its one name per language: {language: name}.")
    discipline = models.CharField(
        max_length=40, help_text="`building` for steps 1 to 4 and 14, else its Discipline Part's key."
    )
    milestone = models.CharField(max_length=8)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "key"], name="takeoff_takeoffstep_key"),
            models.CheckConstraint(
                condition=models.Q(key__regex=_KEY), name="takeoff_takeoffstep_key_shape"
            ),
        ]

    def __str__(self) -> str:
        return self.key


class CheckKind(models.TextChoices):
    SOURCE = "source"
    CONSERVATION = "conservation"
    SANITY = "sanity"
    RELATION = "relation"


class Check(models.Model):
    """A Check (ADR 0027) as the engine's catalogue declares it (`engine.check.catalogue`): its code
    (`key`), version, kind and the code of its words. A Library row."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False, help_text="The Market's Library tenant.")
    key = models.CharField(max_length=64, help_text="The Check's code: permanent.")
    version = models.PositiveIntegerField()
    family_key = models.CharField(max_length=64, blank=True, default="")
    kind = models.CharField(max_length=16, choices=CheckKind.choices)
    message_code = models.CharField(max_length=128)
    milestone = models.CharField(max_length=8)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "key", "version"], name="takeoff_check_key_version"
            ),
            models.CheckConstraint(condition=models.Q(key__regex=_KEY), name="takeoff_check_key_shape"),
            models.CheckConstraint(
                condition=models.Q(kind__in=CheckKind.values), name="takeoff_check_kind"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.key} v{self.version}"


# Progress ----------------------------------------------------------------------------------------


class ProgressStatus(models.TextChoices):
    NOT_STARTED = "not_started"
    READING = "reading"
    IN_REVIEW = "in_review"
    CONFIRMED = "confirmed"
    CLOSED_WITH_QUESTIONS = "closed_with_questions"
    REOPENED = "reopened"


class StepProgress(models.Model):
    """One Takeoff Step's progress in a Project: per Discipline on Step 1 (the Building empty, the
    Discipline's key set, or empty for the sheets of no Discipline, #102); never shown to the client."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    building_id = models.UUIDField(null=True, blank=True, editable=False)
    step = models.CharField(max_length=40)
    discipline = models.CharField(max_length=40, blank=True, default="")
    status = models.CharField(
        max_length=24, choices=ProgressStatus.choices, default=ProgressStatus.NOT_STARTED
    )
    placed = models.PositiveIntegerField(default=0, help_text="n: decided so far.")
    total = models.PositiveIntegerField(null=True, blank=True, help_text="N; empty while unknown.")
    open_questions = models.PositiveIntegerField(default=0)
    awaiting_answer = models.PositiveIntegerField(default=0)
    active_seconds = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "project_id", "building_id", "step", "discipline"],
                name="takeoff_stepprogress_one",
                nulls_distinct=False,
            ),
            _project_key("stepprogress"),
            models.CheckConstraint(
                condition=models.Q(status__in=ProgressStatus.values), name="takeoff_stepprogress_status"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.step} {self.discipline or '-'}: {self.placed}/{self.total}"


# What the machine proposes -------------------------------------------------------------------------


class RecogniseRun(models.Model):
    """One run of a family's recogniser over a Building's sheets (21c's read job writes it)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    building_id = models.UUIDField(null=True, blank=True, editable=False)
    drawing_set_state_id = models.UUIDField(null=True, blank=True, editable=False)
    family_key = models.CharField(max_length=64)
    drafting_profile_version_id = models.UUIDField(null=True, blank=True)
    cache_key = models.CharField(max_length=64)
    status = models.CharField(max_length=16, default="done")
    candidates = models.PositiveIntegerField(default=0)
    reused_answers = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "project_id", "building_id", "family_key", "cache_key"],
                name="takeoff_recogniserun_one",
                nulls_distinct=False,
            ),
            _project_key("recogniserun"),
        ]

    def __str__(self) -> str:
        return f"{self.family_key} {self.cache_key[:12]}"


class ProposalSubject(models.TextChoices):
    ELEMENT = "element"
    RELATION = "relation"
    SHEET = "sheet"
    VIEW = "view"
    DRAFTING_PROFILE = "drafting_profile"


class ProposalStatus(models.TextChoices):
    OPEN = "open"
    BLOCKED = "blocked"
    HELD = "held"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class Proposal(models.Model):
    """What the machine proposes about one subject: on Step 1, one printed sheet (its kind, Jev's pick
    among the kinds, or leaving it out). `subject_id` is the printed sheet's (a SheetRevision's) id.
    `jev_answer_id` names Jev's answer in platform's cache; `jev_pick` holds its choice and options."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    run = models.ForeignKey(
        RecogniseRun, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    step = models.CharField(max_length=40)
    subject = models.CharField(max_length=24, choices=ProposalSubject.choices)
    subject_id = models.UUIDField(editable=False)
    family_key = models.CharField(max_length=64, blank=True, default="")
    candidate_key = models.CharField(max_length=128)
    outcome = models.CharField(max_length=16, default="first_read")
    values = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=32, default="reader")
    confidence = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    reader = models.CharField(max_length=64, blank=True, default="")
    reader_version = models.CharField(max_length=64, blank=True, default="")
    candidate_geometry = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=ProposalStatus.choices, default=ProposalStatus.OPEN)
    rejected_reason = models.CharField(max_length=64, blank=True, default="")
    supersedes = models.ForeignKey(
        "self", models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    confirmation = models.ForeignKey(
        "Confirmation", models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    jev_answer_id = models.UUIDField(null=True, blank=True)
    jev_pick = models.JSONField(
        null=True, blank=True, help_text="Jev's answer: {choice, options}, its keys in order."
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes: ClassVar = [_index("proposal", "project_id", "subject_id")]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "project_id", "step", "candidate_key"],
                name="takeoff_proposal_candidate",
            ),
            _project_key("proposal"),
            models.CheckConstraint(
                condition=models.Q(subject__in=ProposalSubject.values), name="takeoff_proposal_subject"
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=ProposalStatus.values), name="takeoff_proposal_status"
            ),
            models.CheckConstraint(
                condition=models.Q(jev_answer_id__isnull=True) | models.Q(jev_pick__isnull=False),
                name="takeoff_proposal_jev_pick",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.subject} {self.subject_id}: {self.status}"


class ProposalTrace(models.Model):
    """Where a Proposal's fact was read: a Trace anchor (drawings' `StoredAnchor` detail)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    proposal = models.ForeignKey(Proposal, models.PROTECT, related_name="+", db_index=False)
    fact = models.CharField(max_length=64)
    anchor = models.JSONField()
    question = models.ForeignKey(
        "Question", models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )

    class Meta:
        indexes: ClassVar = [_index("proposaltrace", "proposal")]
        constraints: ClassVar = [_project_key("proposaltrace")]

    def __str__(self) -> str:
        return self.fact


# What the QS decided --------------------------------------------------------------------------------


class ConfirmationKind(models.TextChoices):
    BULK = "bulk"
    SINGLE = "single"
    QUESTION_ANSWER = "question_answer"
    STEP_CLOSE = "step_close"
    REVISION = "revision"
    UNCONFIRM = "unconfirm"


class ConfirmationAct(models.TextChoices):
    """What the act was, on Step 1 (its undo reverses it)."""

    CONFIRM = "confirm"
    EXCLUDE = "exclude"
    DRAWING_LIST = "drawing_list"


class Confirmation(models.Model):
    """One act of the QS, under their name: every decision it made carries its id, and `undo`
    reverses them all, putting back what each sheet carried before (`before`); `undone_at` set, the
    only column the app may change."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    step = models.CharField(max_length=40)
    building_id = models.UUIDField(null=True, blank=True, editable=False)
    discipline = models.CharField(max_length=40, blank=True, default="")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, models.PROTECT, related_name="+", db_index=False)
    by_name = models.CharField(max_length=200, help_text="Who, by their name as it was then.")
    kind = models.CharField(max_length=16, choices=ConfirmationKind.choices)
    act = models.CharField(max_length=16, choices=ConfirmationAct.choices)
    question = models.ForeignKey(
        "Question", models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    proposals = models.PositiveIntegerField(default=0)
    model_version_seq = models.PositiveIntegerField(null=True, blank=True)
    at = models.DateTimeField(default=timezone.now, editable=False)
    undone_at = models.DateTimeField(null=True, blank=True)
    before = models.JSONField(
        default=dict,
        blank=True,
        help_text="What it overwrote, by printed sheet: {sheets: {id: {decision, confirmation_id, "
        "kind, reason, text}}}; undo puts back the newest of those still standing.",
    )

    class Meta:
        indexes: ClassVar = [_index("confirmation", "project_id", "user", "at")]
        constraints: ClassVar = [
            _project_key("confirmation"),
            models.CheckConstraint(
                condition=models.Q(kind__in=ConfirmationKind.values), name="takeoff_confirmation_kind"
            ),
            models.CheckConstraint(
                condition=models.Q(act__in=ConfirmationAct.values), name="takeoff_confirmation_act"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.act} by {self.by_name}"


class QuestionKind(models.TextChoices):
    MISSING = "missing"
    CONFLICT = "conflict"
    LOW_CONFIDENCE = "low_confidence"
    CHECK = "check"
    FILE_MISREAD = "file_misread"
    LABOUR_SOURCE = "labour_source"
    RELATION = "relation"
    MISSING_DISCIPLINE = "missing_discipline"
    CONVENTION = "convention"


class QuestionStatus(models.TextChoices):
    OPEN = "open"
    ANSWERED = "answered"
    WITHDRAWN = "withdrawn"


class Question(models.Model):
    """One thing the machine cannot settle, asked once (as a code and parameters, never English),
    with its options; answered once for everything it blocks. `subject_id`: what it is about (a
    file, a printed sheet, a view), a downward id."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    step = models.CharField(max_length=40)
    building_id = models.UUIDField(null=True, blank=True, editable=False)
    discipline = models.CharField(max_length=40, blank=True, default="")
    kind = models.CharField(max_length=24, choices=QuestionKind.choices)
    question_key = models.CharField(max_length=64)
    subject_id = models.UUIDField(null=True, blank=True)
    message_code = models.CharField(max_length=128)
    params = models.JSONField(default=dict, blank=True)
    options = models.JSONField(default=list, blank=True)
    check_code = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=16, choices=QuestionStatus.choices, default=QuestionStatus.OPEN)
    answer = models.JSONField(null=True, blank=True)
    answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        db_index=False,
    )
    answered_at = models.DateTimeField(null=True, blank=True)
    withdrawn_by = models.ForeignKey(
        Confirmation,
        models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        db_index=False,
        help_text="The exclusion that withdrew it (its sheet left out); no answer overwrites it, and "
        "the exclusion's undo asks it again.",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes: ClassVar = [_index("question", "project_id", "created_at")]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "project_id", "question_key"], name="takeoff_question_key"
            ),
            _project_key("question"),
            models.CheckConstraint(
                condition=models.Q(kind__in=QuestionKind.values), name="takeoff_question_kind"
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=QuestionStatus.values), name="takeoff_question_status"
            ),
            models.CheckConstraint(
                condition=~models.Q(status=QuestionStatus.ANSWERED)
                | models.Q(answer__isnull=False, answered_at__isnull=False),
                name="takeoff_question_answered",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.kind}: {self.status}"


class QuestionLink(models.Model):
    """A Proposal a Question blocks."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    question = models.ForeignKey(Question, models.PROTECT, related_name="+", db_index=False)
    proposal = models.ForeignKey(Proposal, models.PROTECT, related_name="+", db_index=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "question", "proposal"], name="takeoff_questionlink_one"
            ),
            _project_key("questionlink"),
        ]

    def __str__(self) -> str:
        return f"{self.question_id} blocks {self.proposal_id}"


# Checks run ------------------------------------------------------------------------------------------


class CheckTrigger(models.TextChoices):
    READ = "read"
    CONFIRMATION = "confirmation"
    BOQ = "boq"


class CheckRun(models.Model):
    """One run of a Check (by its key and version, the Library's): how many subjects passed of N."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    check_key = models.CharField(max_length=64)
    check_version = models.PositiveIntegerField()
    trigger = models.CharField(max_length=16, choices=CheckTrigger.choices)
    passed = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(default=0)
    confirmation = models.ForeignKey(
        Confirmation, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    drawing_set_state_id = models.UUIDField(null=True, blank=True)
    at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes: ClassVar = [_index("checkrun", "project_id", "check_key")]
        constraints: ClassVar = [
            _project_key("checkrun"),
            models.CheckConstraint(
                condition=models.Q(trigger__in=CheckTrigger.values), name="takeoff_checkrun_trigger"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.check_key}: {self.passed}/{self.total}"


class CheckFinding(models.Model):
    """What a Check found: its subjects' ids and a message (code and params)."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    run = models.ForeignKey(CheckRun, models.PROTECT, related_name="+", db_index=False)
    subject_ids = models.JSONField(default=list, blank=True)
    message_code = models.CharField(max_length=128)
    params = models.JSONField(default=dict, blank=True)
    question = models.ForeignKey(
        Question, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )

    class Meta:
        indexes: ClassVar = [_index("checkfinding", "run")]
        constraints: ClassVar = [_project_key("checkfinding")]

    def __str__(self) -> str:
        return self.message_code


# Coverage ----------------------------------------------------------------------------------------------


class CoverageStatus(models.TextChoices):
    UNACCOUNTED = "unaccounted"
    ASSIGNED = "assigned"
    USED = "used"
    EXCLUDED = "excluded"


class Coverage(models.Model):
    """How one view of the Drawing Set is accounted for (ADR 0027): assigned to Takeoff Steps
    (CoverageStep) or, before its steps exist, to its Discipline Part (`part_key`), used, or excluded
    with a reason from the seven; else unaccounted.

    `proposed_*` is what the machine proposed, never changed by the QS; `status`, `reason` and
    `reason_text` are what stands. With no `confirmation` the row is a proposal (m0-screens 6.11's
    "proposed"); the QS's act stamps it, and `undo` puts the proposal back."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    drawing_set_state_id = models.UUIDField(null=True, blank=True, editable=False)
    view_id = models.UUIDField(editable=False)
    sheet_revision_id = models.UUIDField(editable=False)
    proposed_status = models.CharField(max_length=16, choices=CoverageStatus.choices)
    proposed_reason = models.CharField(max_length=24, blank=True, default="")
    status = models.CharField(max_length=16, choices=CoverageStatus.choices)
    part_key = models.CharField(max_length=40, blank=True, default="")
    reason = models.CharField(max_length=24, blank=True, default="")
    reason_text = models.CharField(max_length=500, blank=True, default="")
    confirmation = models.ForeignKey(
        Confirmation, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        db_index=False,
    )

    class Meta:
        indexes: ClassVar = [_index("coverage", "project_id", "sheet_revision_id")]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "project_id", "drawing_set_state_id", "view_id"],
                name="takeoff_coverage_one",
                nulls_distinct=False,
            ),
            _project_key("coverage"),
            models.CheckConstraint(
                condition=models.Q(status__in=CoverageStatus.values)
                & models.Q(proposed_status__in=CoverageStatus.values),
                name="takeoff_coverage_status",
            ),
            models.CheckConstraint(
                condition=~models.Q(status=CoverageStatus.EXCLUDED) | ~models.Q(reason=""),
                name="takeoff_coverage_excluded_reason",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.view_id}: {self.status}"


class CoverageStep(models.Model):
    """A Takeoff Step a view is assigned to; `used` once that step's Confirmation draws on it."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    coverage = models.ForeignKey(Coverage, models.PROTECT, related_name="+", db_index=False)
    step = models.CharField(max_length=40)
    used = models.BooleanField(default=False)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "coverage", "step"], name="takeoff_coveragestep_one"
            ),
            _project_key("coveragestep"),
        ]

    def __str__(self) -> str:
        return self.step


# The drawing list (the register) ----------------------------------------------------------------------


class RegisterSource(models.TextChoices):
    SHEET = "sheet"
    PASTED = "pasted"
    TYPED = "typed"


class DrawingRegister(models.Model):
    """A Discipline's drawing list: read from a sheet of the set (`source_sheet_id`), or pasted or
    typed by the QS (who and when, and the text as given). Kept, never changed: the QS's next list
    is a new row, and the one standing is the latest whose Confirmation is not undone."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    discipline = models.CharField(max_length=40)
    source = models.CharField(max_length=8, choices=RegisterSource.choices)
    source_sheet_id = models.UUIDField(null=True, blank=True)
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        db_index=False,
    )
    entered_by_name = models.CharField(max_length=200, blank=True, default="")
    entered_at = models.DateTimeField(default=timezone.now, editable=False)
    raw_text = models.TextField(blank=True, default="")
    ignored = models.PositiveIntegerField(default=0)
    confirmation = models.ForeignKey(
        Confirmation, models.PROTECT, null=True, blank=True, related_name="+", db_index=False
    )

    class Meta:
        indexes: ClassVar = [_index("drawingregister", "project_id", "discipline")]
        constraints: ClassVar = [
            _project_key("drawingregister"),
            models.CheckConstraint(
                condition=models.Q(source__in=RegisterSource.values), name="takeoff_register_source"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(source=RegisterSource.SHEET, source_sheet_id__isnull=False)
                    | (
                        ~models.Q(source=RegisterSource.SHEET)
                        & models.Q(entered_by__isnull=False, confirmation__isnull=False)
                    )
                ),
                name="takeoff_register_whence",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.discipline} ({self.source})"


class RegisterEntry(models.Model):
    """One number of a drawing list, as listed: its title and revision mark, its line."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    project_id = models.UUIDField(editable=False)
    register = models.ForeignKey(DrawingRegister, models.PROTECT, related_name="+", db_index=False)
    number = models.CharField(max_length=64)
    title = models.CharField(max_length=500, blank=True, default="")
    revision_mark = models.CharField(max_length=16, blank=True, default="")
    line = models.PositiveIntegerField()

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "register", "number"], name="takeoff_registerentry_one"
            ),
            _project_key("registerentry"),
        ]

    def __str__(self) -> str:
        return self.number
