"""The application: its apps, middleware, URLs and security basics.

Every M0 setting's name and default is written once, in its submodule (docs/architecture.md,
Settings); a ticket changes values only in the submodule it owns.
"""

import os
from pathlib import Path

from vextrus.modules import MODULES

BASE_DIR = Path(__file__).resolve().parents[2]


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    return default if value is None else value.strip().lower() in ("1", "true", "yes", "on")


# Development defaults to DEBUG off; a local session sets VEXTRUS_DEBUG=1. The key below is for
# development only and never used in a deployed environment, which sets VEXTRUS_SECRET_KEY.
DEBUG = env_flag("VEXTRUS_DEBUG")
SECRET_KEY = os.environ.get("VEXTRUS_SECRET_KEY") or "development-only-not-secret"
ALLOWED_HOSTS = [
    host for host in os.environ.get("VEXTRUS_ALLOWED_HOSTS", "127.0.0.1").split(",") if host
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",  # the admin needs it
    "django.contrib.staticfiles",  # the admin's own styles
    "ninja",  # its export_openapi_schema command, for the web's generated types
    "procrastinate.contrib.django",
    "vextrus.seed",
    *(f"vextrus.{module}" for module in MODULES),
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # 02's tenant middleware: a pass-through until 02 fills it. It must come after authentication.
    "vextrus.platform.http.middleware.TenantMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "vextrus.urls"
WSGI_APPLICATION = "vextrus.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "storage" / "static"

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
