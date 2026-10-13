"""Tenancy: the roles and the transaction-local settings row-level security reads (02 fills).

The tenant middleware (MIDDLEWARE, in `base`) opens `transaction.atomic()` and sets these three with
`is_local = true`; the policies read them through
`nullif(current_setting('app.tenant_id', true), '')::uuid` (docs/data-model.md §2).

The two roles' names are `vextrus_app` and `vextrus` unless the environment names others: the Held-out
instance runs as its own pair (`VEXTRUS_APP_ROLE=vextrus_heldout_app`,
`VEXTRUS_OWNER_ROLE=vextrus_heldout`; scripts/owner/heldout-instance.sh, ticket M1-06). Migrations
write these names into SQL, so each must be a plain lower-case identifier.
"""

import os
import re
from collections.abc import Mapping

from django.core.exceptions import ImproperlyConfigured

_ROLE = re.compile(r"[a-z_][a-z0-9_]{0,62}")


def role_name(variable: str, default: str, environ: Mapping[str, str]) -> str:
    """The role `variable` names, else `default`; refused unless a plain lower-case identifier."""
    value = environ.get(variable) or default
    if not _ROLE.fullmatch(value):
        raise ImproperlyConfigured(f"{variable} must be a lower-case PostgreSQL identifier")
    return value


# The web and the worker refuse to start unless connected as this role (02's startup check).
VEXTRUS_APP_ROLE = role_name("VEXTRUS_APP_ROLE", "vextrus_app", os.environ)
VEXTRUS_OWNER_ROLE = role_name("VEXTRUS_OWNER_ROLE", "vextrus", os.environ)

VEXTRUS_TENANT_SETTING = "app.tenant_id"
VEXTRUS_USER_SETTING = "app.user_id"
VEXTRUS_LIBRARY_SETTING = "app.library_id"
