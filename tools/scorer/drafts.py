"""Does a drafted key key the drawings it names? (Ticket 24s; the orchestrator's ruling of session 06:
two drafting agents collided on a scratch folder and one keyed the wrong drawing under another file's
name.)

    python3 -I tools/scorer/drafts.py --reference <the set's folder> <draft.json>...

A key file, per set or per drawing file, records the drawings it keys: `files: {<file name>: <sha256>}`
at its top and `file` on each sheet. A draft is refused, loudly and naming the file (never a key's
value), when a recorded file is not exactly one file of that name in the set's folder, when that file's
sha256 is not the recorded one, or when a sheet names a file the draft does not record. The review page
(`tools/scorer/review.py`) and `scripts/owner/keys-custody.sh` both refuse such a draft. The scorer
ignores these fields.

Standard library only, and runnable on the system Python, like the scorer.
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

SHA256 = 64


def problems(key: Any, reference: Path) -> list[str]:
    """Why `key` does not key the files in `reference` it names; empty when it does."""
    if not isinstance(key, dict):
        return ["the draft is not a JSON object"]
    files = key.get("files")
    if not isinstance(files, dict) or not files:
        return ["the draft records no drawing files and their sha256 (`files`)"]
    found: list[str] = []
    for name, digest in sorted(files.items()):
        if not isinstance(name, str) or not name or "/" in name or name in (".", ".."):
            found.append("a recorded file name is not a plain file name")
            continue
        matches = [
            p for p in reference.rglob("*") if p.name == name and p.is_file() and not p.is_symlink()
        ]
        if len(matches) != 1:
            many = "several files are" if matches else "no file is"
            found.append(f"{name}: {many} named so in the set's folder")
            continue
        if not isinstance(digest, str) or len(digest) != SHA256:
            found.append(f"{name}: the draft records no sha256 for it")
        elif _sha256(matches[0]) != digest.lower():
            found.append(f"{name}: the draft's sha256 is not this file's (it keys another drawing)")
    sheets = key.get("sheets")
    for n, sheet in enumerate(sheets if isinstance(sheets, list) else [], 1):
        named = sheet.get("file") if isinstance(sheet, dict) else None
        if named not in files:
            found.append(f"sheet {n}: names no drawing file the draft records")
    return found


def check(drafts: list[Path], reference: Path) -> list[str]:
    """Every draft's problems, each line naming the draft's file."""
    found = []
    for draft in drafts:
        try:
            key = json.loads(draft.read_bytes())
        except OSError, ValueError:
            found.append(f"{draft}: cannot be read as JSON")
            continue
        found += [f"{draft}: {problem}" for problem in problems(key, reference)]
    return found


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="drafts.py", description=__doc__.split("\n\n")[0])
    parser.add_argument("--reference", type=Path, required=True, help="the set's folder of drawings")
    parser.add_argument("drafts", type=Path, nargs="+")
    args = parser.parse_args(argv)
    found = check(args.drafts, args.reference)
    for line in found:
        print(f"REFUSED: {line}", file=sys.stderr)
    if found:
        print(f"REFUSED: {len(found)} problem(s); nothing was taken.", file=sys.stderr)
        return 1
    print(f"{len(args.drafts)} draft(s) key the files they name.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
