"""The tests' settings: the product's, with fast password hashing and files under pytest's own folder.

The test database is created by the owner, migrated through the owner alias and flushed through it
(`vextrus/testing/database.py`); its name is `DATABASES[...]["TEST"]["NAME"]` (`db`).
"""

import atexit
import os
import shutil
import tempfile
from pathlib import Path

from vextrus.settings import *

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
if os.environ.get("VEXTRUS_TEST_STORAGE_ROOT"):
    VEXTRUS_STORAGE_ROOT = Path(os.environ["VEXTRUS_TEST_STORAGE_ROOT"])
else:
    # This process's own folder, removed when it ends: 2,778 left behind filled the disk (session 11).
    VEXTRUS_STORAGE_ROOT = Path(tempfile.mkdtemp(prefix="vextrus-test-storage-"))
    atexit.register(shutil.rmtree, VEXTRUS_STORAGE_ROOT, ignore_errors=True)
