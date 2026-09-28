"""Tenancy: the roles and the transaction-local settings row-level security reads (02 fills).

The tenant middleware (MIDDLEWARE, in `base`) opens `transaction.atomic()` and sets these three with
`is_local = true`; the policies read them through
`nullif(current_setting('app.tenant_id', true), '')::uuid` (docs/data-model.md §2).
"""

# The web and the worker refuse to start unless connected as this role (02's startup check).
VEXTRUS_APP_ROLE = "vextrus_app"
VEXTRUS_OWNER_ROLE = "vextrus"

VEXTRUS_TENANT_SETTING = "app.tenant_id"
VEXTRUS_USER_SETTING = "app.user_id"
VEXTRUS_LIBRARY_SETTING = "app.library_id"
