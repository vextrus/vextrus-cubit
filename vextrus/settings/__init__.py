"""Vextrus's settings, one submodule per concern (docs/architecture.md, Settings).

`DJANGO_SETTINGS_MODULE=vextrus.settings` runs the product; `vextrus.settings.test` runs the tests.
"""

from vextrus.settings.auth import *
from vextrus.settings.base import *
from vextrus.settings.db import *
from vextrus.settings.i18n import *
from vextrus.settings.jev import *
from vextrus.settings.jobs import *
from vextrus.settings.storage import *
from vextrus.settings.tenancy import *
from vextrus.settings.uploads import *
