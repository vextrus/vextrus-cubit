"""`platform`'s tables: private to the module (import-linter holds it). Only the one ticket per wave
that adds a migration to `platform` edits this file. Every id comes from
`vextrus.platform.ids.new_id`.
"""

from typing import Any, ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from vextrus.platform.ids import new_id


class UserManager(BaseUserManager["User"]):
    def get_by_natural_key(self, username: str | None) -> User:
        return self.get(email__iexact=username)

    def create_user(self, email: str, name: str, password: str | None = None, **fields: Any) -> User:
        user = self.model(email=self.normalize_email(email), name=name, **fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(
        self, email: str, name: str, password: str | None = None, **fields: Any
    ) -> User:
        """`createsuperuser` makes a member of Vextrus's staff (there is no other superuser). Run it
        as the owner, `manage.py createsuperuser --database owner`: `vextrus_app` may never make a
        user staff (the staff wall, migration 0005); `manage.py set_staff` flips an existing user."""
        return self.create_user(email, name, password, is_vextrus_staff=True, **fields)


class User(AbstractBaseUser):
    """A person who signs in. Global, with no tenant: a person may hold Memberships in several
    Developers (docs/data-model.md §3.0; `vextrus_app` can read every row, an accepted risk).

    The email is unique whatever its case. Vextrus's staff (`is_vextrus_staff`) may use the admin,
    where they act in a Developer only as 02 rules; nobody else may.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    email = models.EmailField(max_length=254, unique=True)
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=32, blank=True)
    is_vextrus_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects: ClassVar[UserManager] = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = ["name"]

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(Lower("email"), name="platform_user_email_ci_unique"),
        ]

    def __str__(self) -> str:
        return self.email

    @property
    def is_staff(self) -> bool:
        """The admin lets in only Vextrus's staff."""
        return self.is_active and self.is_vextrus_staff

    def has_perm(self, perm: str, obj: object = None) -> bool:
        return self.is_staff

    def has_module_perms(self, app_label: str) -> bool:
        return self.is_staff


class Market(models.Model):
    """A Market (ADR 0038): a row of its own Library, which every Developer points to.

    `tenant` is the Market's Library tenant (a Developer with `is_library`), so the row is read
    through `app.library_id`. Its `code` is the one key unique across every Library (the index
    rule's allowlist). Every value a market decides is here as data: the currency and its minor
    units, the format profile, the unit systems, the languages, the time zone, the work week and the
    default home region. Only the owner writes Markets (a data migration); `vextrus_app` may only
    read them (docs/data-model.md §3.0).
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant = models.ForeignKey("Developer", models.PROTECT, related_name="+", db_index=False)
    code = models.CharField(max_length=8)
    labels = models.JSONField(help_text="Its name per language: {language: name}.")
    currency_code = models.CharField(max_length=3, help_text="ISO 4217.")
    currency_minor_units = models.PositiveSmallIntegerField()
    currency_symbol = models.CharField(max_length=8)
    currency_symbol_position = models.JSONField(
        help_text='Per language, "before" or "after" the amount.'
    )
    grouping = models.CharField(max_length=16, help_text='"lakh" or "thousands".')
    digits = models.CharField(max_length=8, help_text='The numbering system, as "latn".')
    borrowed_locales = models.JSONField(
        help_text="The locale each language borrows for its formats: {language: locale}."
    )
    unit_systems = models.JSONField(help_text="The unit systems offered, in order.")
    default_unit_system = models.CharField(max_length=16)
    languages = models.JSONField(help_text="The languages offered, in order.")
    default_language = models.CharField(max_length=8)
    time_zone = models.CharField(max_length=64, help_text="An IANA time zone.")
    days_off = models.JSONField(help_text="The work week's days off, as ISO weekdays (1 is Monday).")
    default_home_region = models.CharField(max_length=32)
    date_order = models.CharField(
        max_length=3,
        blank=True,
        db_default="",
        help_text='How its drawings write a date in figures: "DMY", "MDY" or "YMD"; "" when unknown.',
    )

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["code"], name="platform_market_code_unique"),
            models.CheckConstraint(
                condition=models.Q(date_order__in=["", "DMY", "MDY", "YMD"]),
                name="platform_market_date_order_known",
            ),
            models.UniqueConstraint(fields=["tenant", "id"], name="platform_market_tenant_id"),
            models.CheckConstraint(
                condition=models.Q(currency_minor_units__lte=4),
                name="platform_market_minor_units_fit",
            ),
        ]

    def __str__(self) -> str:
        return self.code


class Developer(models.Model):
    """A Developer: a tenant. Its row is its own tenant's (`tenant_id` equals `id`).

    `library_id` is its Market's Library tenant, copied here so a request sets both policy settings
    from the tenant's own row; a composite key holds it to the Market's. A Library tenant is a
    Developer with `is_library`, whose `library_id` is itself.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField(editable=False)
    name = models.CharField(max_length=200)
    market = models.ForeignKey(Market, models.PROTECT, related_name="+", db_index=False)
    library_id = models.UUIDField(editable=False)
    home_region = models.CharField(max_length=32)
    is_library = models.BooleanField(default=False, editable=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes: ClassVar = [models.Index(fields=["tenant_id"], name="platform_developer_tenant")]
        constraints: ClassVar = [
            models.CheckConstraint(
                condition=models.Q(tenant_id=models.F("id")), name="platform_developer_is_its_tenant"
            ),
            models.CheckConstraint(
                condition=models.Q(is_library=False) | models.Q(library_id=models.F("id")),
                name="platform_developer_library_is_itself",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Role(models.TextChoices):
    QS = "qs", _("QS")
    MD = "md", _("MD")
    VEXTRUS_ENGINEER = "vextrus_engineer", _("Vextrus Engineer")
    GUEST = "guest", _("Guest")


class Membership(models.Model):
    """A person's place in a Developer, or the invitation to it while `user` is empty.

    Current when accepted, not revoked, started and not expired. Its Projects are its
    MembershipProject rows (none = all). A Vextrus Engineer's always ends (ADR 0034).
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant = models.ForeignKey(Developer, models.PROTECT, related_name="+", db_index=False)
    user = models.ForeignKey(
        User, models.PROTECT, related_name="+", null=True, blank=True, db_index=False
    )
    role = models.CharField(max_length=24, choices=Role.choices)
    outside_org = models.CharField(max_length=200, blank=True)
    invited_by = models.ForeignKey(
        User, models.PROTECT, related_name="+", null=True, blank=True, db_index=False
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    starts_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    invited_email = models.EmailField(max_length=254, blank=True)
    invite_token_hash = models.CharField(max_length=64, blank=True, editable=False)
    invite_expires_at = models.DateTimeField(null=True, blank=True, editable=False)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes: ClassVar = [
            # The signed-in user's own Memberships, read before a tenant is set (INDEX_EXCEPTIONS).
            models.Index(fields=["user"], name="platform_membership_user"),
        ]
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant", "id"], name="platform_membership_tenant_id"),
            models.UniqueConstraint(
                fields=["tenant", "user"],
                condition=models.Q(user__isnull=False, revoked_at__isnull=True),
                name="platform_membership_one_live_per_user",
            ),
            models.UniqueConstraint(
                fields=["tenant", "invite_token_hash"],
                condition=~models.Q(invite_token_hash=""),
                name="platform_membership_token",
            ),
            models.CheckConstraint(
                condition=models.Q(role__in=Role.values), name="platform_membership_role"
            ),
            models.CheckConstraint(
                condition=~models.Q(role=Role.VEXTRUS_ENGINEER) | models.Q(expires_at__isnull=False),
                name="platform_membership_engineer_ends",
            ),
            models.CheckConstraint(
                condition=models.Q(user__isnull=True, accepted_at__isnull=True)
                | models.Q(user__isnull=False, accepted_at__isnull=False),
                name="platform_membership_accepted_with_user",
            ),
            models.CheckConstraint(
                condition=models.Q(user__isnull=False)
                | (
                    models.Q(invite_expires_at__isnull=False)
                    & ~models.Q(invite_token_hash="")
                    & ~models.Q(invited_email="")
                ),
                name="platform_membership_invitation_complete",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.role}: {self.user_id or self.invited_email}"


class MembershipProject(models.Model):
    """A Project a Membership may open (s02 Q11); a Membership with none may open all.

    `project_id` is an upward stamp (`projects` is a higher layer), never resolved here.
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    membership = models.ForeignKey(Membership, models.CASCADE, related_name="+", db_index=False)
    project_id = models.UUIDField()

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["tenant_id", "membership", "project_id"],
                name="platform_membershipproject_unique",
            ),
        ]

    def __str__(self) -> str:
        return str(self.project_id)


class StoredFileKind(models.TextChoices):
    ORIGINAL = "original", _("Original")
    DERIVED = "derived", _("Derived")
    EXPORT = "export", _("Export")
    EVIDENCE = "evidence", _("Evidence")


STORED_FILE_KEY = (
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    r"(/[A-Za-z0-9_][A-Za-z0-9._@+-]{0,127}){1,8}$"
)
"""A key: the tenant's id, the Project's id, then one to eight names. A name starts with a letter, a
digit or `_`, so none is `.` or `..`, and holds no `/`, `\\` or NUL (`storage` checks the same)."""


class StoredFile(models.Model):
    """A file kept by key (docs/data-model.md §3.0): an upload (`original`), what a reader derived
    from one, an export, or a Record's evidence.

    Its key begins with its tenant's id, then its Project's (s02 Q15), which a check holds. A key
    names one content for good: `storage.put` never replaces a file under a key (derived files of a
    newer reader get new keys). `project_id` is an upward stamp (`projects` is a higher layer).
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    project_id = models.UUIDField()
    key = models.CharField(max_length=1200)
    sha256 = models.CharField(max_length=64)
    kind = models.CharField(max_length=16, choices=StoredFileKind.choices)
    media_type = models.CharField(max_length=127)
    size = models.PositiveBigIntegerField()
    producer = models.CharField(max_length=64, help_text="What made it: `upload`, a reader, …")
    producer_version = models.CharField(max_length=64, blank=True)
    source_sha256 = models.CharField(
        max_length=64, blank=True, help_text="The file it was derived from, if any."
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "sha256"], name="platform_storedfile_sha256"),
        ]
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "key"], name="platform_storedfile_key"),
            models.CheckConstraint(
                condition=models.Q(kind__in=StoredFileKind.values), name="platform_storedfile_kind"
            ),
            models.CheckConstraint(
                condition=models.Q(key__regex=STORED_FILE_KEY), name="platform_storedfile_key_shape"
            ),
            models.CheckConstraint(
                condition=models.Q(sha256__regex=r"^[0-9a-f]{64}$")
                & (models.Q(source_sha256="") | models.Q(source_sha256__regex=r"^[0-9a-f]{64}$")),
                name="platform_storedfile_sha256_hex",
            ),
        ]

    def __str__(self) -> str:
        return self.key


class DomainEvent(models.Model):
    """One domain act (docs/data-model.md §2, Events): append-only, its kind a message code with
    `event=True`, its payload ids and counts only, its time in UTC."""

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    kind = models.CharField(max_length=120)
    project_id = models.UUIDField(null=True, blank=True)
    building_id = models.UUIDField(null=True, blank=True)
    subject_type = models.CharField(max_length=60)
    subject_id = models.UUIDField(null=True, blank=True)
    actor_user_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    occurred_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "occurred_at"], name="platform_event_tenant_time"),
        ]

    def __str__(self) -> str:
        return self.kind


JEV_KEY = r"^[a-z][a-z0-9_]{0,63}$"
"""A node's key and an option's: lower-case words, as the engine names keys, at most 64 characters."""


class JevAnswer(models.Model):
    """One answer of Jev's, cached per tenant (ADR 0011 item 5; ticket 15): the same node, facts,
    question, options and pinned model are answered from here, never asked again.

    `cache_key` is the sha256 of those five as canonical JSON (`services.jev`); the facts themselves
    are not kept. An answer never changes (its key includes the model), so `vextrus_app` may add a
    row but never change or delete one. `options` are the option keys offered, in order;
    `probabilities` maps each to its probability as a decimal string, for "the kinds, most likely
    first" (m0-screens 5).
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    cache_key = models.CharField(max_length=64)
    node = models.CharField(max_length=64)
    model_version = models.CharField(max_length=64)
    options = models.JSONField(help_text="The option keys offered, in order.")
    choice = models.CharField(max_length=64)
    confidence = models.DecimalField(max_digits=5, decimal_places=4)
    probabilities = models.JSONField(help_text="{option: probability as a decimal string}.")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "node", "model_version"], name="platform_jevanswer_node"),
        ]
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["tenant_id", "cache_key"], name="platform_jevanswer_key"),
            # The target of JevOverride's key, so an override carries its answer's node, model and
            # choice and no other (migration 0008).
            models.UniqueConstraint(
                fields=["tenant_id", "id", "node", "model_version", "choice"],
                name="platform_jevanswer_what",
            ),
            models.CheckConstraint(
                condition=models.Q(cache_key__regex=r"^[0-9a-f]{64}$"),
                name="platform_jevanswer_key_shape",
            ),
            models.CheckConstraint(
                condition=models.Q(node__regex=JEV_KEY) & models.Q(choice__regex=JEV_KEY),
                name="platform_jevanswer_keys",
            ),
            models.CheckConstraint(
                condition=models.Q(model_version__regex=r"^[a-z0-9][a-z0-9._-]{0,63}$"),
                name="platform_jevanswer_model_shape",
            ),
            models.CheckConstraint(
                condition=models.Q(confidence__gte=0, confidence__lte=1),
                name="platform_jevanswer_confidence",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.node}: {self.choice}"


class JevOverride(models.Model):
    """A QS's change of a Jev proposal (ADR 0011 item 4; story 85): the node's live error rate.

    Append-only. Its node, model and Jev's choice are its answer's, which a composite key holds
    (migration 0008); the QS's choice is never Jev's. `subject_id` is what the proposal was about (a
    Proposal: an upward stamp, never resolved here).
    """

    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    tenant_id = models.UUIDField()
    answer = models.ForeignKey(JevAnswer, models.PROTECT, related_name="+", db_index=False)
    node = models.CharField(max_length=64)
    model_version = models.CharField(max_length=64)
    subject_id = models.UUIDField()
    jev_choice = models.CharField(max_length=64)
    qs_choice = models.CharField(max_length=64)
    user = models.ForeignKey(User, models.PROTECT, related_name="+", db_index=False)
    at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes: ClassVar = [
            models.Index(fields=["tenant_id", "answer"], name="platform_jevoverride_answer"),
            models.Index(
                fields=["tenant_id", "node", "model_version"], name="platform_jevoverride_node"
            ),
        ]
        constraints: ClassVar = [
            models.CheckConstraint(
                condition=models.Q(qs_choice__regex=JEV_KEY)
                & ~models.Q(qs_choice=models.F("jev_choice")),
                name="platform_jevoverride_qs_not_jev",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.node}: {self.jev_choice} to {self.qs_choice}"
