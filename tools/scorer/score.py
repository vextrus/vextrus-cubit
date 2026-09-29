"""The blind scorer, `vx-score <run id>` (the M0 plan, "24s The blind scorer and the Development Set
keys"; ADR 0026 as amended; session 06's ruling "24s <-> 17").

It scores one posting run's own export against the Answer Keys, as the key user, and answers without
ever showing a key's value: per Development Set sheet, pass or fail and what is wrong in general terms
("number wrong", "a view missing", "storeys wrong"), and the totals n / N per level and per field; for a
Held-out Set, the totals alone. Every call, a refused one too, is logged with the run and its head.

It reads only a folder the pipeline's user wrote (`vxrun`, which alone runs the posting path from a
root-owned installed copy): the run's folder and every file it reads must be that user's and nobody
else's to write, no file a link, the export's digest the one the run's metadata records, and the export,
the metadata and the folder's name the same run. A hand-made or edited export fails one of those.

This file is the whole program: the standard library only, no import of the project, and it runs on the
system Python (`/usr/bin/python3 -I`, 3.12 on this machine) as root's file at /usr/local/bin/vx-score,
which `scripts/owner/keys-custody.sh` installs from this file with that first line.

#8's matching contract, word for word (docs/specs/M1.md, "Ticket 01's matching contract and tests,
word for word"; the join below is session 06's ruling for 24s, which replaces Edison's identity join
with the layout, the frame and the view's box):

> **The key** (with the key user only; 06c and 06d write it): per Development Set, the join rule;
> per sheet: number, title, Discipline, storeys list, revision mark, and for the Sample Project its
> frame box or layout; per view (level 2): its sheet, its reading-order position, kind, not-to-scale,
> storeys list and meaning; the register's N and the PDF page count.
>
> **Matching** (fixed now, never tuned after a result): the Sample Project joins a sheet by frame
> IoU ≥ 0.9 or a shared layout, a view by IoU ≥ 0.8 with the same kind. **Edison joins by identity:**
> a sheet by its normalised sheet number (case, whitespace, and `-`/`.`/space separators folded), then
> by normalised title for sheets with no number; a view inside a matched sheet by reading order (rows
> top to bottom, left to right, after the key's page rotation is undone) and kind. A title matches when
> equal after normalising case, whitespace and decoded symbols; storeys when the lists are equal.
> Export sheets and views that join nothing are phantoms.
>
> - **05 vx-score** · `cloud` · medium · blocked by: 01a. The export and key schemas above as JSON
>   Schema; the matching rules above; aggregates only (n / N, phantoms, change from the last merged
>   run); **no path argument** (it reads the drop folder and the keys' fixed location); checks the
>   export's run id; posts the status when given a commit; tests on invented keys, including that it
>   prints no key value, name or title, and the Edison identity join on an invented rotated key.
>   Owns `scripts/score/`.

The ruling's join, fixed here and never tuned after a result: a key sheet joins the export sheet on its
layout; when several export sheets share that layout (model space), it joins the one whose box has an
IoU of at least 0.8 with the key's frame. A key view joins a view of its joined sheet with the same kind
at an IoU of at least 0.8 (boxes on paper, in mm). Joins are one to one, the largest IoU first. The
sheet's six fields are compared after normalising: case and whitespace everywhere, the number's `-`, `.`
and space separators folded, and a title's decoded symbols (`%%c`, `%%d`, `%%p`). A sheet passes when
all six are right and every key view joins with its title and subject right; an export sheet or view
that joins nothing is an extra (a phantom), counted, and fails nothing by itself.

The keys: `<keys>/<set>.json` = `{set, held_out, sheets: [{layout, frame?, number, title, discipline,
storeys, revision, date, views: [{box, title, kind, subject}]}]}`.
"""

import hashlib
import json
import os
import re
import stat
import sys
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, TextIO

# The installed program's fixed places (no path argument): the drop folder (post-status.toml),
# the key user's keys and log (scripts/owner/keys-custody.sh), and the pipeline's user.
DROP = Path("/srv/vextrus-drop")
KEYS = Path("/home/vxkeys/keys")
LOG = Path("/home/vxkeys/score.log")
PIPELINE_USER = "vxrun"

RUN_ID = re.compile(r"\A[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}-[0-9a-f]{4}\Z")
COMMIT = re.compile(r"\A[0-9a-f]{40}\Z")
SET_NAME = re.compile(r"\A[a-z0-9][a-z0-9-]{0,63}\Z")
JOIN = 0.8
MOST = 1 << 30  # the most bytes read from one file
REFUSED = 2  # a refusal: nothing scored (sudo's own refusal is 1)
BROKEN = 3  # the scorer failed; nothing scored

# The sheet's fields: the key's name, the export's name, and how a wrong one is worded.
FIELDS = (
    ("number", "number", "number wrong"),
    ("title", "title", "title wrong"),
    ("discipline", "discipline", "Discipline wrong"),
    ("storeys", "storeys_as_stated", "storeys wrong"),
    ("revision", "revision_mark", "revision wrong"),
    ("date", "issue_date", "date wrong"),
)
SYMBOLS = {"%%c": "ø", "%%d": "°", "%%p": "±"}


class Refused(Exception):
    """Nothing is scored; the message names the rule broken, never a key's value."""


class Score:
    """One set's result: each key sheet's reasons (empty when it passes), in the key's order, and the
    totals: `right[field]` of `of[field]`."""

    def __init__(self) -> None:
        # Per key sheet: the export's layout ("" when none joins), the reasons it fails, its extra views.
        self.sheets: list[tuple[str, list[str], int]] = []
        self.right: dict[str, int] = {}
        self.of: dict[str, int] = {}
        self.extra_sheets = 0
        self.extra_views = 0

    def count(self, field: str, right: bool) -> None:
        self.right[field] = self.right.get(field, 0) + int(right)
        self.of[field] = self.of.get(field, 0) + 1


def main(argv: list[str], *, drop: Path, keys: Path, log: Path, writer: int) -> int:
    """Scores the run named by `argv`'s one run id in `drop`, whose folder and files `writer` (a user
    id) alone may have written, against `keys`; appends the call to `log`. Returns 0 when scored."""
    try:
        # Held for the whole call, and closed by the `with` below.
        journal = open(log, "a", encoding="utf-8")  # noqa: SIM115
    except OSError:
        print("vx-score: refused: the log cannot be written, so nothing is scored", file=sys.stderr)
        return REFUSED
    with journal:
        run_id = argv[0] if len(argv) == 1 and RUN_ID.match(argv[0]) else None
        named = run_id or f"(not a run id: {ascii(argv)[:80]})"
        try:
            if run_id is None:
                raise Refused("give exactly one run id, as the posting run printed it")
            head, sets = _scored(run_id, drop, keys, writer)
        except Refused as refused:
            _log(journal, f"run {named} refused: {refused}")
            print(f"vx-score: refused: {refused}", file=sys.stderr)
            return REFUSED
        # Any other failure: its message could quote a key, so none is shown.
        except Exception as error:
            _log(journal, f"run {named} failed: {type(error).__name__}")
            print(f"vx-score: failed ({type(error).__name__}); nothing is scored", file=sys.stderr)
            return BROKEN
        print(f"vx-score {run_id}: head {head}")
        for name, held_out, score in sets:
            lines = _answer(name, held_out, score)
            for line in lines:
                print(line)
            totals = "; ".join(line.strip() for line in lines if " / " in line)
            _log(journal, f"run {run_id} head {head} set {name} scored: {totals}")
        return 0


def _scored(
    run_id: str, drop: Path, keys: Path, writer: int
) -> tuple[str, list[tuple[str, bool, Score]]]:
    folder = _open_run(drop, run_id, writer)
    try:
        metadata = _json(_read(folder, "metadata.json", writer), "metadata.json")
        head = metadata.get("commit")
        if metadata.get("run_id") != run_id:
            raise Refused("metadata.json names another run")
        if not isinstance(head, str) or not COMMIT.match(head) or head[:12] != run_id.split("-")[1]:
            raise Refused("metadata.json's commit is not the run's head")
        recorded = metadata.get("sets")
        if not isinstance(recorded, dict):
            raise Refused("metadata.json records no sets")
        scored = []
        for name in sorted(recorded):
            if not isinstance(name, str) or not SET_NAME.match(name):
                raise Refused("metadata.json names a set that is not a plain name")
            key = _key(keys, name)
            if key is None:
                continue  # a set with no key is not scored
            data = _read(folder, f"export-{name}.json", writer)
            entry = recorded[name]
            digest = entry.get("export_sha256") if isinstance(entry, dict) else None
            if hashlib.sha256(data).hexdigest() != digest:
                raise Refused(f"export-{name}.json is not the export the run recorded")
            export = _json(data, f"export-{name}.json")
            run = export.get("run")
            if not isinstance(run, dict) or run.get("id") != run_id:
                raise Refused(f"export-{name}.json names another run")
            if run.get("commit") != head:
                raise Refused(f"export-{name}.json names another head")
            scored.append((name, key.get("held_out") is not False, _score(key, export)))
    finally:
        os.close(folder)
    if not scored:
        raise Refused("no set of this run has a key")
    return head, scored


def _open_run(drop: Path, run_id: str, writer: int) -> int:
    """The run's folder, opened without following a link, when `writer` alone may write it."""
    try:
        parent = os.open(drop, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    except OSError:
        raise Refused("the drop folder cannot be opened") from None
    try:
        folder = os.open(run_id, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    except OSError:
        raise Refused("no such run in the drop folder (a run is scored from its own folder)") from None
    finally:
        os.close(parent)
    info = os.fstat(folder)
    if info.st_uid != writer:
        os.close(folder)
        raise Refused("the run's folder was not written by the pipeline's user")
    if info.st_mode & 0o022:
        os.close(folder)
        raise Refused("the run's folder may be written by others")
    return folder


def _read(folder: int, name: str, writer: int) -> bytes:
    """A regular file of the run's folder, one link, the writer's and nobody else's to write."""
    try:
        handle = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=folder)
    except OSError:
        raise Refused(f"the run has no plain file {name}") from None
    try:
        info = os.fstat(handle)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MOST:
            raise Refused(f"the run's {name} is not a plain file")
        if info.st_uid != writer or info.st_mode & 0o022:
            raise Refused(f"the run's {name} was not written by the pipeline's user alone")
        chunks = []
        while chunk := os.read(handle, 1 << 20):
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(handle)


def _key(keys: Path, name: str) -> dict[str, Any] | None:
    try:
        data = (keys / f"{name}.json").read_bytes()
    except FileNotFoundError:
        return None
    except OSError:
        raise Refused(f"the key for {name} cannot be read") from None
    key = _json(data, f"the key for {name}")
    if key.get("set") != name or not isinstance(key.get("sheets"), list):
        raise Refused(f"the key for {name} is not a key of that set")
    return key


def _json(data: bytes, what: str) -> dict[str, Any]:
    try:
        value = json.loads(data)
    except ValueError:
        raise Refused(f"{what} is not JSON") from None
    if not isinstance(value, dict):
        raise Refused(f"{what} is not a JSON object")
    return value


def _score(key: dict[str, Any], export: dict[str, Any]) -> Score:
    score = Score()
    found = [
        sheet
        for file in export.get("files") or []
        for sheet in (file.get("sheets") or [])
        if isinstance(sheet, dict)
    ]
    keyed = [sheet for sheet in key["sheets"] if isinstance(sheet, dict)]
    joined = _join_sheets(keyed, found)
    score.extra_sheets = len(found) - len(joined)
    for index, sheet in enumerate(keyed):
        match = joined.get(index)
        views = [view for view in sheet.get("views") or [] if isinstance(view, dict)]
        if match is None:
            score.count("sheets", False)
            for field, _name, _reason in FIELDS:
                score.count(field, False)
            for _view in views:
                score.count("views", False)
            score.sheets.append(("", ["the sheet missing"], 0))
            continue
        other = found[match]
        reasons = []
        for field, name, reason in FIELDS:
            right = _same(field, sheet.get(field), _value(other.get(name)))
            score.count(field, right)
            if not right:
                reasons.append(reason)
        found_views = [v for v in other.get("views") or [] if isinstance(v, dict)]
        wrong, extra = _score_views(score, views, found_views)
        reasons += wrong
        score.count("sheets", not reasons)
        layout = (other.get("location") or {}).get("layout")
        score.sheets.append((layout if isinstance(layout, str) else "", reasons, extra))
    return score


def _score_views(
    score: Score, keyed: list[dict[str, Any]], found: list[dict[str, Any]]
) -> tuple[list[str], int]:
    """Why the sheet's views fail it, and how many export views joined no key view."""
    pairs = sorted(
        (
            (_iou(view.get("box"), other.get("box")), k, f)
            for k, view in enumerate(keyed)
            for f, other in enumerate(found)
            if _text(view.get("kind")) == _text(other.get("kind"))
        ),
        key=lambda pair: (-pair[0], pair[1], pair[2]),
    )
    joined = _one_to_one(pairs)
    extra = len(found) - len(joined)
    score.extra_views += extra
    missing = titles = subjects = 0
    for k, view in enumerate(keyed):
        f = joined.get(k)
        score.count("views", f is not None)
        if f is None:
            missing += 1
            continue
        title = _same("title", view.get("title"), found[f].get("title"))
        subject = _same("subject", view.get("subject"), found[f].get("subject"))
        score.count("view titles", title)
        score.count("view subjects", subject)
        titles += not title
        subjects += not subject
    reasons = [
        _counted(n, one, many)
        for n, one, many in (
            (missing, "a view missing", "views missing"),
            (titles, "a view's title wrong", "views' titles wrong"),
            (subjects, "a view's subject wrong", "views' subjects wrong"),
        )
        if n
    ]
    return reasons, extra


def _counted(n: int, one: str, many: str) -> str:
    return one if n == 1 else f"{n} {many}"


def _join_sheets(keyed: list[dict[str, Any]], found: list[dict[str, Any]]) -> dict[int, int]:
    """Key sheet index to export sheet index: on the layout; on the frame's IoU when several export
    sheets share the layout."""
    by_layout: dict[Any, list[int]] = {}
    for f, sheet in enumerate(found):
        by_layout.setdefault((sheet.get("location") or {}).get("layout"), []).append(f)
    pairs = []
    for k, sheet in enumerate(keyed):
        layout = sheet.get("layout")
        candidates = by_layout.get(layout, []) if isinstance(layout, str) else []
        if len(candidates) == 1:
            pairs.append((1.0, k, candidates[0]))
        elif sheet.get("frame") is not None:
            for f in candidates:
                box = (found[f].get("location") or {}).get("box")
                pairs.append((_iou(sheet.get("frame"), box), k, f))
    pairs.sort(key=lambda pair: (-pair[0], pair[1], pair[2]))
    return _one_to_one(pairs)


def _one_to_one(pairs: list[tuple[float, int, int]]) -> dict[int, int]:
    joined: dict[int, int] = {}
    taken: set[int] = set()
    for iou, k, f in pairs:
        if iou >= JOIN - 1e-9 and k not in joined and f not in taken:
            joined[k] = f
            taken.add(f)
    return joined


def _iou(a: Any, b: Any) -> float:
    boxes = []
    for box in (a, b):
        if not isinstance(box, list) or len(box) != 4:
            return 0.0
        if not all(isinstance(n, (int, float)) and not isinstance(n, bool) for n in box):
            return 0.0
        x0, y0, x1, y1 = (float(n) for n in box)
        boxes.append((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)))
    (ax0, ay0, ax1, ay1), (bx0, by0, bx1, by1) = boxes
    inter = max(0.0, min(ax1, bx1) - max(ax0, bx0)) * max(0.0, min(ay1, by1) - max(ay0, by0))
    union = (ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0) - inter
    return inter / union if union > 0 else 0.0


def _value(sourced: Any) -> Any:
    """A sourced value's value (13's `{value, source}`), or the value itself."""
    return sourced.get("value") if isinstance(sourced, dict) else sourced


def _same(field: str, key: Any, found: Any) -> bool:
    if field == "number":
        return _number(key) == _number(found)
    if field == "title":
        return _title(key) == _title(found)
    return _text(key) == _text(found)


def _text(value: Any) -> str:
    """Case and whitespace folded; a missing value is the empty text."""
    if value is None:
        return ""
    return " ".join(unicodedata.normalize("NFKC", str(value)).casefold().split())


def _number(value: Any) -> str:
    return re.sub(r"[-.\s]+", "-", _text(value)).strip("-")


def _title(value: Any) -> str:
    text = _text(value)
    for code, symbol in SYMBOLS.items():
        text = text.replace(code, symbol)
    return text


def _answer(name: str, held_out: bool, score: Score) -> list[str]:
    """What the call shows: per sheet for a Development Set, and always the totals, last."""
    lines = [f"{name}: {'a Held-out Set, in aggregate only' if held_out else 'a Development Set'}"]
    if not held_out:
        for n, (layout, reasons, extra) in enumerate(score.sheets, 1):
            where = f" (layout {layout})" if layout else ""
            said = "pass" if not reasons else "fail: " + ", ".join(reasons)
            if extra:
                said += f"; {'an extra view' if extra == 1 else f'{extra} extra views'}"
            lines.append(f"  sheet {n}{where}: {said}")
        lines.append(
            f"  extra sheets {score.extra_sheets}, extra views {score.extra_views} (in the export only)"
        )
    order = ["sheets", "views", *(field for field, _n, _r in FIELDS), "view titles", "view subjects"]
    totals = [f"  {field:14} {score.right.get(field, 0)} / {score.of.get(field, 0)}" for field in order]
    return lines + totals[:2] + ([] if held_out else totals[2:])


def _log(journal: TextIO, line: str) -> None:
    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    caller = os.environ.get("SUDO_UID", str(os.getuid()))
    journal.write(f"{stamp} uid {caller} " + " ".join(line.split()) + "\n")
    journal.flush()


if __name__ == "__main__":
    import pwd

    try:
        pipeline = pwd.getpwnam(PIPELINE_USER).pw_uid
    except KeyError:
        print(f"vx-score: refused: no user {PIPELINE_USER} runs the pipeline here", file=sys.stderr)
        sys.exit(REFUSED)
    sys.exit(main(sys.argv[1:], drop=DROP, keys=KEYS, log=LOG, writer=pipeline))
