"""The sandboxed child: reads one PDF with `walk` and writes its facts as JSON (engine/read/pdf).

    python -I -B -c <engine.read.pdf.CHILD> <checkout> <pdf> <output.json> <most bytes>

It writes `{"refused": reason}` for a file it will not read (`locked`, `unreadable`,
`too_many_pages`, `memory`, or `too_large` when its facts would pass the most bytes the caller reads),
else the facts. It exits 0 either way; any other exit is the sandbox's to explain (a limit reached)
or a fault of the reader's own.
"""

import errno
import json
import os
import sys
from pathlib import Path
from typing import Any

from engine.read.pdf import walk

TOO_LARGE = b'{"refused": "too_large"}'


def main(argv: list[str]) -> int:
    source, target, most = Path(argv[0]), Path(argv[1]), int(argv[2])
    result: dict[str, Any]
    try:
        result = walk.read_file(source)
    except walk.Refused as refused:
        result = {"refused": refused.reason}
    except MemoryError:
        result = {"refused": "memory"}  # what held the memory is freed as the error unwinds
    except RecursionError:
        result = {"refused": "unreadable"}
    data = json.dumps(result, ensure_ascii=False, allow_nan=False).encode("utf-8")
    if len(data) > most:
        data = TOO_LARGE
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        try:
            _write(descriptor, data)
        except OSError as error:  # past the sandbox's file-size limit (EFBIG): say so, in a few bytes
            if error.errno != errno.EFBIG:
                raise
            os.ftruncate(descriptor, 0)
            os.lseek(descriptor, 0, os.SEEK_SET)
            _write(descriptor, TOO_LARGE)
    finally:
        os.close(descriptor)
    return 0


def _write(descriptor: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        view = view[os.write(descriptor, view) :]


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
