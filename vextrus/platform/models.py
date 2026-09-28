"""`platform`'s tables: private to the module (import-linter holds it). Only the one ticket per wave
that adds a migration to `platform` edits this file. Every id comes from
`vextrus.platform.ids.new_id`.
"""

from typing import Any, ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower

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
        """`createsuperuser` makes a member of Vextrus's staff (there is no other superuser)."""
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
