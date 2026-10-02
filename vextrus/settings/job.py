"""The product's read job alone, as the real-drawing check's sandbox runs it (ticket 21c;
`python -m vextrus.takeoff.services.export`): `DJANGO_SETTINGS_MODULE=vextrus.settings.job`.

The sandbox's checkout holds only the engine paths (`.github/engine-paths.txt`, which the code hash
follows) and `vextrus/settings/`, so only the modules the job imports are installed here: platform,
projects, drawings and takeoff (their migrations depend on no other module's). No URL is served: the
job answers no request, so its URL configuration is empty and imports no other module's routers.
"""

from vextrus.settings import *  # noqa: F403

JOB_MODULES = ("platform", "projects", "drawings", "takeoff")
"""The modules the job imports (21c's test_job_imports: every one on an engine path)."""

INSTALLED_APPS = [
    app
    for app in INSTALLED_APPS  # noqa: F405
    if not app.startswith("vextrus.") or app.removeprefix("vextrus.") in JOB_MODULES
]
ROOT_URLCONF = "vextrus.settings.job_urls"
