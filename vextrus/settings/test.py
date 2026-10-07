"""The tests' settings: the product's, with fast password hashing and files under pytest's own folder
(`vextrus.testing.basetemp`).

The test database is created by the owner, migrated through the owner alias and flushed through it
(`vextrus/testing/database.py`); its name is `DATABASES[...]["TEST"]["NAME"]` (`db`).
"""

import os
from pathlib import Path

from vextrus.settings import *

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
if os.environ.get("VEXTRUS_TEST_STORAGE_ROOT"):
    VEXTRUS_STORAGE_ROOT = Path(os.environ["VEXTRUS_TEST_STORAGE_ROOT"])
# Otherwise the root is a folder of pytest's own basetemp, set by `vextrus.testing.basetemp` when the
# session starts: pytest's retention count bounds it, and nothing is left loose in /tmp (S15-T2, #243).
