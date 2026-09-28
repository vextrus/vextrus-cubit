"""Storage: files on the local file system in development, object storage from the beta (09 fills).

Every key begins with its tenant's id, then its Project's (ADR 0038 item 8):
`<tenant id>/<project id>/<name>/…`. `vextrus.platform.services.storage` puts and gets files by key
under this root, and refuses a key that could leave it.
"""

import os
from pathlib import Path

from vextrus.settings.base import BASE_DIR

VEXTRUS_STORAGE_ROOT = Path(os.environ.get("VEXTRUS_STORAGE_ROOT") or BASE_DIR / "storage" / "files")
