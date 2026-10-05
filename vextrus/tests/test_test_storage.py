"""The tests' file storage is a folder of the test process's own, gone when the process ends (session 11:
2,778 such folders left in /tmp filled the machine's disk)."""

import os
import subprocess
import sys
from pathlib import Path


def test_the_test_storage_folder_is_removed_when_its_process_ends() -> None:
    env = {k: v for k, v in os.environ.items() if k != "VEXTRUS_TEST_STORAGE_ROOT"}
    out = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import vextrus.settings.test as s; (s.VEXTRUS_STORAGE_ROOT / 'f').write_bytes(b'x');"
                " print(s.VEXTRUS_STORAGE_ROOT)"
            ),
        ],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    folder = Path(out.stdout.strip().splitlines()[-1])
    assert folder.name.startswith("vextrus-test-storage-")
    assert not folder.exists()
