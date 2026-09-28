"""The sandboxed child: reads one PDF with `walk` and writes its facts as JSON (engine/read/pdf).

    python -I -c <engine.read.pdf.CHILD> <checkout> <pdf> <output.json>

It writes `{"refused": reason}` for a file it will not read (`locked`, `unreadable`,
`too_many_pages`, `memory`), else the facts. It exits 0 either way; any other exit is the sandbox's
to explain (a limit reached, or a crash).
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

from engine.read.pdf import walk


def main(argv: list[str]) -> int:
    source, target = Path(argv[0]), Path(argv[1])
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
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(data)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
