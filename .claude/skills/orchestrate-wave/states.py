"""The states of a real-drawing run's exports, for the orchestrator before the owner accepts.

Prints, per file of each set: its index, each built stage's state and seconds, and each failed
stage's error kind. It never prints a file's name, path, hash or any drawing text, so its output
may leave `.private/`.

    python3 .claude/skills/orchestrate-wave/states.py <run id>
"""

import json
import sys
from pathlib import Path

RUNS = Path.home() / ".cache" / "vextrus-real-drawings" / "runs"


def kind(error: object) -> str:
    """The error's class name only: the text before the first colon or bracket."""
    text = str(error or "")
    return text.split(":", 1)[0].split("(", 1)[0].strip()[:60]


def main(run_id: str) -> None:
    head = RUNS / run_id / "head"
    for export in sorted(head.glob("export-*.json")):
        name = export.stem.removeprefix("export-")
        for index, file in enumerate(json.loads(export.read_text())["files"]):
            stages = file.get("stages") or {}
            built = {
                stage: value
                for stage, value in stages.items()
                if isinstance(value, dict) and value.get("state") not in (None, "not_built")
            }
            cells = [
                f"{stage}={value.get('state')}({value.get('seconds', 0):.1f}s"
                + (f", {kind(value.get('error'))}" if value.get("state") == "failed" else "")
                + ")"
                for stage, value in built.items()
            ]
            agree = file.get("decoders_agree")
            tail = f" agree={agree}" if agree is not None else ""
            print(f"{name} #{index}: " + " ".join(cells) + tail)


if __name__ == "__main__":
    main(sys.argv[1])
