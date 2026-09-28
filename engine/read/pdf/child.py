"""The sandboxed child: reads one PDF with `walk` and writes its facts as JSON (engine/read/pdf).

    python -I -B -c <engine.read.pdf.CHILD> <checkout> <pdf> <output.json> <most bytes>

It writes `{"refused": reason}` for a file it will not read (`locked`, `unreadable`,
`too_many_pages`, `memory`, or `too_large` when its facts would pass the most bytes the caller reads),
else the facts. Everything reading the file raises, encoding its facts included, is one of these
refusals (a `MemoryError` the memory limit's, anything else `unreadable`), so it exits 0 whatever the
file holds; any other exit is the sandbox's to explain (a limit reached) or a fault of Vextrus's own.
"""

import errno
import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any

from engine.read.pdf import walk

TOO_LARGE = b'{"refused": "too_large"}'
MEMORY = b'{"refused": "memory"}'
UNREADABLE = b'{"refused": "unreadable"}'


def main(argv: list[str]) -> int:
    source, target, most = Path(argv[0]), Path(argv[1]), int(argv[2])
    try:
        data = _encode(walk.read_file(source))
    except walk.Refused as refused:
        data = _encode({"refused": refused.reason})
    except MemoryError:
        data = MEMORY  # what held the memory is freed as the error unwinds; nothing is encoded anew
    except Exception:
        # Whatever reading the file raised (a value that is not finite, a structure deeper than the
        # stack) is the file's own: it is damaged, and says so. Only an exit the child did not choose
        # (a signal, the sandbox's own fault) is Vextrus's.
        traceback.print_exc(limit=5)
        data = UNREADABLE
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


def _encode(result: dict[str, Any]) -> bytes:
    return json.dumps(result, ensure_ascii=False, allow_nan=False).encode("utf-8")


def _write(descriptor: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        view = view[os.write(descriptor, view) :]


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
