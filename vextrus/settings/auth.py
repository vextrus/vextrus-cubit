"""Sign-in: the User model, session authentication and CSRF (07 fills the flows)."""

import os

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
# The web app's origins: the Vite dev server locally (web's `dev`, on 5410), the deployed one elsewhere.
CSRF_TRUSTED_ORIGINS = [
    origin
    for origin in os.environ.get("VEXTRUS_CSRF_TRUSTED_ORIGINS", "http://127.0.0.1:5410").split(",")
    if origin
]

# Invitations (07; docs/design/m0-screens.md §9, ruling 3): a link works once, for 7 days.
VEXTRUS_INVITATION_DAYS = 7
# A Vextrus Engineer's Membership ends after 30 days by default, renewable (ADR 0034).
VEXTRUS_ENGINEER_MEMBERSHIP_DAYS = 30
