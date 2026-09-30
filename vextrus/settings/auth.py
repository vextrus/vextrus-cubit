"""Sign-in: the User model, session authentication and CSRF (07 fills the flows)."""

import os

from django.core.exceptions import ImproperlyConfigured

from vextrus.settings.base import env_flag

AUTH_USER_MODEL = "platform.User"
AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    # "At least 12 characters" (docs/design/m0-screens.md §4.2; 07).
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Sessions are the API's authentication (one NinjaAPI with session auth, vextrus/api.py), so every
# unsafe request carries the CSRF token.
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_AGE = 14 * 24 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_flag("VEXTRUS_SECURE_COOKIES")
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE


def web_port() -> int:
    """The web dev server's port: `VEXTRUS_WEB_PORT`, or 5410, as web/vite.config.ts reads it (#169).

    An empty variable is unset; anything but a whole number from 1 to 65535 is refused. Only ASCII
    whitespace is trimmed, as the web's config trims it, so the two agree on every value.
    """
    value = os.environ.get("VEXTRUS_WEB_PORT", "").strip(" \t\n\r\f\v")
    if not value:
        return 5410
    port = int(value) if value.isascii() and value.isdigit() else 0
    if not 1 <= port <= 65535:
        raise ImproperlyConfigured(f"VEXTRUS_WEB_PORT must be a port from 1 to 65535, not {value!r}")
    return port


# The web dev server's origin locally (web's `dev`, on VEXTRUS_WEB_PORT); a deployment sets its own.
_LOCAL_WEB_ORIGIN = f"http://127.0.0.1:{web_port()}"

# The web app's origins: the Vite dev server locally, the deployed one elsewhere.
CSRF_TRUSTED_ORIGINS = [
    origin
    for origin in (os.environ.get("VEXTRUS_CSRF_TRUSTED_ORIGINS") or _LOCAL_WEB_ORIGIN).split(",")
    if origin
]

# The web app's own origin, where an invitation link opens: `<origin>/join#<token>` (07).
VEXTRUS_WEB_ORIGIN = os.environ.get("VEXTRUS_WEB_ORIGIN") or _LOCAL_WEB_ORIGIN

# Invitations (07; docs/design/m0-screens.md §9, ruling 3): a link works once, for 7 days.
VEXTRUS_INVITATION_DAYS = 7
# A Vextrus Engineer's Membership ends after 30 days by default, renewable (ADR 0034).
VEXTRUS_ENGINEER_MEMBERSHIP_DAYS = 30
