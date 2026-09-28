"""The tests' settings: the product's, with fast password hashing and files under pytest's own folder.

The test database is created by the owner, migrated through the owner alias and flushed through it
(`vextrus/testing/database.py`); its name is `DATABASES[...]["TEST"]["NAME"]` (`db`).
"""

import os
import tempfile
from pathlib import Path

from vextrus.settings import *

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
VEXTRUS_STORAGE_ROOT = Path(
    os.environ.get("VEXTRUS_TEST_STORAGE_ROOT") or tempfile.mkdtemp(prefix="vextrus-test-storage-")
)
