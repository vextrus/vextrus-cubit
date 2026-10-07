"""Run only by `test_basetemp.py` in an inner pytest session (no `test_` prefix: never collected by
name). Its one test stores a file under the tests' storage root, then its run is killed (SIGKILL: no
`atexit`, no session finish), as a builder's interrupted or out-of-memory run is."""

import os
import signal
from pathlib import Path

from django.conf import settings


def test_stores_a_file_then_the_run_is_killed() -> None:
    root = Path(settings.VEXTRUS_STORAGE_ROOT)
    root.mkdir(parents=True, exist_ok=True)
    (root / "probe-stored.bin").write_bytes(b"a stored file")
    os.kill(os.getpid(), signal.SIGKILL)
