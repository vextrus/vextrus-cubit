"""The web process's entry point. It refuses to start unless connected as `vextrus_app` under
row-level security (`vextrus.platform.startup`); `runserver` loads it too."""

import os

from django.core.wsgi import get_wsgi_application

from vextrus.platform import startup

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vextrus.settings")

application = get_wsgi_application()
startup.check()
