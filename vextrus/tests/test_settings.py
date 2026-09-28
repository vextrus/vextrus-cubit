"""The settings the M0 plan fixes for every later ticket (the plan, 01a; ADR 0038)."""

from django.conf import settings

from vextrus.modules import MODULES


def test_every_module_and_every_m0_app_is_installed() -> None:
    assert set(settings.INSTALLED_APPS) >= {
        "django.contrib.admin",
        "django.contrib.auth",
        "django.contrib.contenttypes",
        "django.contrib.sessions",
        "procrastinate.contrib.django",
        *(f"vextrus.{module}" for module in MODULES),
    }
    assert settings.AUTH_USER_MODEL == "platform.User"


def test_the_tenant_middleware_runs_after_sessions_authentication_and_csrf() -> None:
    middleware = list(settings.MIDDLEWARE)
    tenant = middleware.index("vextrus.platform.http.middleware.TenantMiddleware")

    assert middleware.index("django.contrib.sessions.middleware.SessionMiddleware") < tenant
    assert middleware.index("django.middleware.csrf.CsrfViewMiddleware") < tenant
    assert middleware.index("django.contrib.auth.middleware.AuthenticationMiddleware") < tenant


def test_times_are_utc_english_is_the_only_language_and_the_server_groups_no_figure() -> None:
    assert (settings.USE_TZ, settings.TIME_ZONE) == (True, "UTC")
    assert settings.LANGUAGES == [("en", "English")]
    assert settings.LANGUAGE_CODE == "en"
    assert settings.USE_THOUSAND_SEPARATOR is False


def test_the_two_aliases_are_the_app_and_the_owner() -> None:
    assert set(settings.DATABASES) == {"default", "owner"}
    assert settings.DATABASES["default"]["USER"] == settings.VEXTRUS_APP_ROLE == "vextrus_app"
    assert settings.DATABASES["owner"]["USER"] == settings.VEXTRUS_OWNER_ROLE == "vextrus"
    assert settings.PROCRASTINATE_DATABASE_ALIAS == "default"


def test_the_jev_key_is_named_never_held() -> None:
    assert settings.VEXTRUS_JEV_KEY_VARIABLE == "TYPESAFE_API_KEY"
    assert not any("TYPESAFE" in name and name != "VEXTRUS_JEV_KEY_VARIABLE" for name in dir(settings))
