"""Sign-in's and the permission check's codes (ticket 07): why a request was refused.

Worded in `web/src/messages/platform/auth/en.po`. A refusal reaches the web as the body of the
refused response, `{code, params}` (`platform.http.acts`).
"""

from engine.messages import MessageCode

SIGNED_OUT = MessageCode("platform.auth.signed_out")
"""No one is signed in (401)."""
WRONG_CREDENTIALS = MessageCode("platform.auth.wrong_credentials")
"""The email and password match no account; never says which was wrong (401)."""
CSRF_FAILED = MessageCode("platform.auth.csrf_failed")
"""An unsafe request came without the CSRF token (403)."""
CHOOSE_DEVELOPER = MessageCode("platform.auth.choose_developer")
"""Signed in and holding current Memberships, but working in none of them: none chosen, or the one
chosen has ended (403)."""
NO_ACCESS = MessageCode("platform.auth.no_access")
"""Signed in, holding no current Membership in any Developer (403; m0-screens §4.1)."""
NOT_ALLOWED = MessageCode("platform.auth.not_allowed", params=("role",))
"""The role may not do this act, as the MD and a Guest may not change the Takeoff (403)."""
NOT_FOUND = MessageCode("platform.auth.not_found")
"""Nothing at this address for this member: another Developer's, a Project outside the
Membership's scope, or nothing at all (404). Never says which."""

PASSWORD_TOO_SHORT = MessageCode("platform.auth.password_too_short", params=("min",))
PASSWORD_TOO_COMMON = MessageCode("platform.auth.password_too_common")
PASSWORD_TOO_SIMILAR = MessageCode("platform.auth.password_too_similar")
PASSWORD_ENTIRELY_NUMERIC = MessageCode("platform.auth.password_entirely_numeric")
PASSWORD_REFUSED = MessageCode("platform.auth.password_refused")
"""A password refused by a rule with no code of its own."""
