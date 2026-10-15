"""What marks a file of the tree as one that decides access (S30-F7, issue #898's owed check; read by
test_no_ordinary_file_decides_access.py).

A file decides access when it sits in an access module, imports from one, or names the access nouns.
The access modules are where Vextrus decides who may do what (docs/architecture.md's module map):
the tenancy, RLS, Memberships, auth and invitations of `vextrus.platform`, the project-scoped
Memberships and ended access of `vextrus.projects`, the settings that wire auth and tenancy, and the
web's members screens, its auth helpers (`can`, the refusals) and its API transport (the session
cookie and the CSRF token). A file that changes who may act must either be one of those or reach
them: it imports their grants (`Act`, `Grant`, `declare`, `can`) or the transport, or it handles the
nouns themselves (a role, a Membership, a permission, a tenant) to decide what a person sees. Each of
the four files PR #896's round 1 found on the one-lens tier carries one of these marks:
`vextrus/drawings/acts.py` and `vextrus/drawings/http/files.py` import `vextrus.platform`,
`web/src/api/client.ts` sits in `web/src/api`, `web/src/routes/_app/members/index.tsx` imports
`@/members`.

The marks are read in source files only (`SOURCE_SUFFIXES`): Markdown and text run no code, and the
Markdown a script or Claude Code reads at run time is a `[strict] paths` carve-out of
`scripts/factory/review_tiers.toml`, judged there. The list errs wide (a file that only shows a role's
name is marked too): a wide mark costs a second lens, a narrow one lets a wall take one lens.
"""

import re

# Python modules whose import marks a file (`vextrus.platform` and anything below it).
ACCESS_MODULES = (
    "vextrus.platform",
    "vextrus.projects",
    "vextrus.settings.auth",
    "vextrus.settings.tenancy",
)

# Repository paths of the access modules: a file inside one, or a web import resolving into one.
ACCESS_PATHS = (
    "vextrus/platform",
    "vextrus/projects",
    "vextrus/settings/auth",
    "vextrus/settings/tenancy",
    "web/src/members",
    "web/src/auth",
    "web/src/api",
)

# The access nouns, as words (any case, singular or plural); `role="..."`, `role={...}` (an ARIA
# attribute in JSX) and `[role=menu]` (a CSS selector of one) are not the noun. `getByRole` or
# `aria-roledescription` hold no word `role`.
NOUNS = re.compile(
    r"(?i)\b(?:memberships?|permissions?|tenants?|tenancy|roles|(?<!\[)role(?!\s*=\s*[\"'{]))\b"
)

# The web's alias for web/src/ (web/tsconfig.json, web/vite.config.ts).
WEB_ALIAS = ("@/", "web/src/")

SOURCE_SUFFIXES = (".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
