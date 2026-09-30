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
layout, within the drawing file it names; a key sheet drawn in model space (layout "model", any case)
joins an export sheet with no layout or the layout "model"; a key sheet with a frame joins only the one
whose box has an IoU of at least 0.8 with the frame, a lone one too (session 06's F0 and F5). A key
view joins a view of its joined sheet with the same kind at an IoU of at least 0.8 (boxes on paper, in
mm). Joins are one to one, the largest IoU first. The sheet's six fields are compared after
normalising: case and whitespace everywhere, the number's `-`, `.` and space separators folded, and a
title's decoded symbols (`%%c`, `%%d`, `%%p`); storeys compare as lists, in order, the export's stated
text split on commas, "&" and "and" (F1). A sheet passes when all six are right and every key view
joins with its title and subject right; an export sheet or view that joins nothing is an extra (a
phantom), counted, and fails nothing by itself.

The keys: `<keys>/<set>.json` = `{set, held_out, sheets: [{layout, frame?, number, title, discipline,
storeys, revision, date, views: [{box, title, kind, subject}]}]}`.

Session 07's ruling R1 corrects two spellings and adds a diagnostic; the join rule is unchanged. A kind
is compared with `_` folded to a space and "3D/perspective", "3D" and "perspective" one kind. A key
view's subject is a free phrase, mapped to the first of the engine's subject words (SUBJECTS) in it,
whole words, the longest first; a joined view's subject is right when that word is the export's, and a
phrase naming none of them is left out of the count and reported as "subjects outside the vocabulary".
A Development Set's answer adds counts in general terms (missing views by kind per sheet; unjoined key
and export views by cause; how many would join with the frames' lower-left corners aligned; joined
views with no export subject); a Held-out Set's answer is its two totals, as before.
"""

import hashlib
import json
import math
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
UNLOGGED = "vx-score: refused: the log cannot be written, so nothing is scored"
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
# The engine's subject words, `subject_words` of engine/recognise/conventions/view-default.json, copied
# because the scorer imports nothing of the project; a committed test fails when the two differ. A key's
# free phrase is mapped to one of them before it is compared (session 07's ruling R1).
SUBJECTS = (
    "pile_cap",
    "pile",
    "foundation",
    "column",
    "shear_wall",
    "retaining_wall",
    "beam",
    "slab",
    "stair",
    "tank",
    "grid",
    "fixture",
    "toilet",
    "opening",
)
# The key brief's "3D/perspective" and its parts, and the engine's `perspective`: one kind (R1).
WORD = re.compile(r"[^\W_]+")  # a whole word of a phrase: letters and digits, `_` a separator
PERSPECTIVE = re.compile(r"\A(?:3d ?/ ?perspective|3d|perspective)\Z")
# The kinds the diagnostic may name, a closed list (the key brief's ten kinds, folded as `_kind`
# folds them); any other kind, of the key or the export, is named "another kind", so no key's text
# can reach an answer (24g's review: a list of shapes let "column c3" through).
KINDS = (
    "plan",
    "section",
    "elevation",
    "schedule",
    "detail",
    "notes",
    "legend",
    "title block",
    "key plan",
    "perspective",
)
# The diagnostic's causes for a view that joins nothing, in the order they are checked (R1); "{side}"
# is the other side's name ("export" for a key view, "key" for an export view).
CAUSES = (
    "other kind at IoU >= 0.8",
    "no {side} view of that kind",
    "same kind, best IoU >= 0.8 (taken by another view)",
    "same kind, best IoU 0.5-0.8",
    "same kind, best IoU 0.2-0.5",
    "same kind, best IoU < 0.2",
)
SEPARATORS = re.compile(r",|&|\band\b")  # between two storeys of a list stated as text


class Refused(Exception):
    """Nothing is scored; the message names the rule broken, never a key's value."""


class Score:
    """One set's result: each key sheet's reasons (empty when it passes), in the key's order, and the
    totals: `right[field]` of `of[field]`."""

    def __init__(self) -> None:
        # Per key sheet: the export's layout ("" when none joins), the reasons it fails, its extra views
        # and whether its paper was unknown (a model-space sheet's boxes then go unscaled).
        self.sheets: list[tuple[str, list[str], int, bool]] = []
        self.right: dict[str, int] = {}
        self.of: dict[str, int] = {}
        self.extra_sheets = 0
        self.extra_views = 0
        # The diagnostic (a Development Set's answer only; counts and general terms, never a key value):
        # per key sheet, its missing views by kind; per set, the unjoined key views by cause, the
        # unjoined export views by kind and cause, the joined views with no export subject, those whose
        # key phrase maps to no subject word, and how many unjoined key views of framed sheets would
        # join if the frames' lower-left corners were aligned (None when no joined sheet has a frame).
        self.missing_kinds: list[dict[str, int]] = []
        self.key_causes = [0] * len(CAUSES)
        self.export_causes: dict[tuple[str, int], int] = {}
        self.no_export_subject = 0
        self.outside = 0
        self.aligned: int | None = None

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
        print(UNLOGGED, file=sys.stderr)
        return REFUSED
    # Every call is logged before anything is shown: a log that cannot be written (a full disk) lets no
    # answer out unlogged (session 06's F6).
    try:
        with journal:
            return _call(argv, drop, keys, writer, journal)
    except OSError:
        print(UNLOGGED, file=sys.stderr)
        return REFUSED


def _call(argv: list[str], drop: Path, keys: Path, writer: int, journal: TextIO) -> int:
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
    answers = [(name, _answer(name, held_out, score)) for name, held_out, score in sets]
    for name, lines in answers:
        totals = "; ".join(line.strip() for line in lines if " / " in line)
        _log(journal, f"run {run_id} head {head} set {name} scored: {totals}")
    print(f"vx-score {run_id}: head {head}")
    for _name, lines in answers:
        for line in lines:
            print(line)
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
            entry = recorded[name]
            _same_drawings(name, key, entry)
            data = _read(folder, f"export-{name}.json", writer)
            digest = entry.get("export_sha256") if isinstance(entry, dict) else None
            if hashlib.sha256(data).hexdigest() != digest:
                raise Refused(f"export-{name}.json is not the export the run recorded")
            export = _json(data, f"export-{name}.json")
            read_by, read_at = _export_run(name, entry, run_id, head)
            run = export.get("run")
            if not isinstance(run, dict) or run.get("id") != read_by:
                raise Refused(f"export-{name}.json names another run")
            if run.get("commit") != read_at:
                raise Refused(f"export-{name}.json names another head")
            scored.append((name, key.get("held_out") is not False, _score(key, export)))
    finally:
        os.close(folder)
    if not scored:
        raise Refused("no set of this run has a key")
    return head, scored


def _export_run(name: str, entry: Any, run_id: str, head: str) -> tuple[str, str]:
    """The run and commit the set's export must name: this run's own, or, for an export the run took
    from the check's cache, the earlier run that read it, as this run's metadata records it
    (`export_run: {id, commit}`, session 06's F4). The digest check is the same either way."""
    recorded = entry.get("export_run") if isinstance(entry, dict) else None
    if recorded is None:
        return run_id, head
    read_by = recorded.get("id") if isinstance(recorded, dict) else None
    read_at = recorded.get("commit") if isinstance(recorded, dict) else None
    if (
        not isinstance(read_by, str)
        or not RUN_ID.match(read_by)
        or not isinstance(read_at, str)
        or not COMMIT.match(read_at)
        or read_at[:12] != read_by.split("-")[1]
    ):
        raise Refused(f"metadata.json's export_run of {name} is not a run and its head")
    return read_by, read_at


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
    """The set's key: a regular file of the scorer's own user that nobody else may write, opened
    without following a link (a key that is a link could lead to a file the owner's user holds)."""
    try:
        handle = os.open(keys / f"{name}.json", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        return None
    except OSError:
        raise Refused(f"the key for {name} cannot be read (a link is never followed)") from None
    try:
        info = os.fstat(handle)
        if not stat.S_ISREG(info.st_mode) or info.st_size > MOST:
            raise Refused(f"the key for {name} is not a plain file")
        if info.st_uid != os.getuid() or info.st_mode & 0o022:
            raise Refused(f"the key for {name} is not the key user's alone")
        chunks = []
        while chunk := os.read(handle, 1 << 20):
            chunks.append(chunk)
    finally:
        os.close(handle)
    key = _json(b"".join(chunks), f"the key for {name}")
    if key.get("set") != name or not isinstance(key.get("sheets"), list):
        raise Refused(f"the key for {name} is not a key of that set")
    return key


def _same_drawings(name: str, key: dict[str, Any], entry: Any) -> None:
    """A key that records its drawings (`files: {name: sha256}`, which keys-custody.sh requires) scores
    only a run that read exactly those drawings, as the run's metadata records them by sha256."""
    keyed = key.get("files")
    if keyed is None:
        return
    ran = entry.get("files") if isinstance(entry, dict) else None
    if not isinstance(keyed, dict) or not isinstance(ran, dict):
        raise Refused(f"the run of {name} records no drawings to check against its key")
    by_name: dict[str, str] = {}
    for path, digest in ran.items():
        base = str(path).rsplit("/", 1)[-1]
        if base in by_name:
            raise Refused(f"the run of {name} read two drawings of one name")
        by_name[base] = str(digest).lower()
    if by_name != {str(k): str(v).lower() for k, v in keyed.items()}:
        raise Refused(f"the run of {name} read other drawings than its key keys")


def _json(data: bytes, what: str) -> dict[str, Any]:
    try:
        value = json.loads(data)
    except ValueError:
        raise Refused(f"{what} is not JSON") from None
    if not isinstance(value, dict):
        raise Refused(f"{what} is not a JSON object")
    return value


def _score(key: dict[str, Any], export: dict[str, Any]) -> Score:
    """The set's score. Every value of the export, and of the key, is normalised first, in one pass
    over all of it: a value that cannot be (a views list that is a number, a list nested past the
    recursion limit) then fails the call whatever the key holds, never only when its sheet joins a
    key sheet, which would tell a Held-out Set's layouts and frames by the exit code (session 06's 24f
    refuter). After this pass nothing the join or the comparison does can raise on either's values."""
    found = [
        _sheet(sheet, file.get("name"), "found")
        for file in export.get("files") or []
        if isinstance(file, dict)
        for sheet in (file.get("sheets") or [])
        if isinstance(sheet, dict)
    ]
    keyed = [
        _sheet(sheet, sheet.get("file"), "key") for sheet in key["sheets"] if isinstance(sheet, dict)
    ]
    score = Score()
    joined = _join_sheets(keyed, found)
    score.extra_sheets = len(found) - len(joined)
    for index, sheet in enumerate(keyed):
        match = joined.get(index)
        if match is None:
            score.count("sheets", False)
            for field, _name, _reason in FIELDS:
                score.count(field, False)
            for _view in sheet.views:
                score.count("views", False)
            score.sheets.append(("", ["the sheet missing"], 0, False))
            score.missing_kinds.append({})
            continue
        other = found[match]
        reasons = []
        for field, _name, reason in FIELDS:
            right = sheet.fields[field] == other.fields[field]
            score.count(field, right)
            if not right:
                reasons.append(reason)
        # Session 06's ruling 14:20: a model-space sheet's (a keyed frame's) export boxes are scaled by
        # the key's paper over the export's before the IoU; a layout sheet's never are.
        scale, unknown = (1.0, 1.0), False
        if sheet.framed:
            ratio = _paper_ratio(sheet.paper, other.paper)
            scale, unknown = ratio or scale, ratio is None
        found_views = [_moved(view, scale) for view in other.views]
        wrong, extra, joined_views = _score_views(score, sheet.views, found_views)
        reasons += wrong
        _diagnose(score, sheet, other, found_views, joined_views)
        score.count("sheets", not reasons)
        score.sheets.append((other.layout or "", reasons, extra, unknown))
    return score


Box = tuple[float, float, float, float]


class _View:
    """A view, normalised: its box (four finite numbers, or None), kind, title and subject."""

    def __init__(self, view: dict[str, Any]) -> None:
        self.box = _box(view.get("box"))
        self.kind = _kind(view.get("kind"))
        self.title = _title(view.get("title"))
        self.subject = _underscored(view.get("subject"))
        # The subject word a key's phrase names, found here, for every view, so its cost and any
        # failure never depend on which views join (a Held-out Set's joins are never told; 24g's
        # refuter: a huge phrase ran out of memory only when its view joined).
        self.word = _subject_word(self.subject)


def _moved(view: _View, scale: tuple[float, float], shift: tuple[float, float] = (0.0, 0.0)) -> _View:
    """The view with its box scaled by (x, y), then moved by `shift`."""
    if (scale == (1.0, 1.0) and shift == (0.0, 0.0)) or view.box is None:
        return view
    (sx, sy), (dx, dy) = scale, shift
    x0, y0, x1, y1 = view.box
    moved = _View({})
    moved.box = (x0 * sx + dx, y0 * sy + dy, x1 * sx + dx, y1 * sy + dy)
    moved.kind, moved.title, moved.subject = view.kind, view.title, view.subject
    moved.word = view.word
    return moved


def _kind(value: Any) -> str:
    """A view's kind as it is compared: `_` folded to a space, "3D/perspective", "3D" and
    "perspective" one kind (R1: a correction of spelling, not a tuned threshold)."""
    kind = _underscored(value)
    return "perspective" if PERSPECTIVE.match(kind) else kind


def _underscored(value: Any) -> str:
    """Case, whitespace and `_` folded (a `_` is a space)."""
    return " ".join(_text(value).replace("_", " ").split())


def _subject_word(phrase: str) -> str | None:
    """The engine's subject word a key's phrase names (spelt with spaces), or None when it names none:
    the first word of SUBJECTS found in the phrase, whole words only, left to right, the longest word
    first where two start at one place ("pile cap" is "pile cap", not "pile")."""
    tokens = WORD.findall(phrase)
    words = sorted((word.split("_") for word in SUBJECTS), key=len, reverse=True)
    for start in range(len(tokens)):
        for word in words:
            if tokens[start : start + len(word)] == word:
                return " ".join(word)
    return None


class _Sheet:
    """A sheet of the key or of the export, normalised: where it is (its drawing file, layout, whether
    it is drawn in model space, its box: the key's `frame`, the export's `location.box`), its paper,
    its six fields and its views."""

    def __init__(self) -> None:
        self.origin: str | None = None
        self.layout: str | None = None
        self.in_model = False
        self.box: Box | None = None
        self.framed = False
        self.paper: tuple[float, float] | None = None
        self.fields: dict[str, Any] = {}
        self.views: list[_View] = []


def _sheet(sheet: dict[str, Any], origin: Any, side: str) -> _Sheet:
    """One sheet normalised; `side` is "key" (fields by the key's names, the box its `frame`) or
    "found" (the export's names, sourced values, the box its `location.box`)."""
    made = _Sheet()
    made.origin = origin if isinstance(origin, str) else None
    if side == "key":
        layout, box = sheet.get("layout"), sheet.get("frame")
        made.framed = box is not None
    else:
        location = sheet.get("location")
        location = location if isinstance(location, dict) else {}
        layout, box = location.get("layout"), location.get("box")
    made.layout = layout if isinstance(layout, str) else None
    # A model-space sheet: the key says "model" (any case); 13's export gives it no layout (F0).
    made.in_model = (layout is None and side == "found") or (
        isinstance(layout, str) and layout.casefold() == "model"
    )
    made.box = _box(box)
    made.paper = _paper(sheet.get("paper"))
    for field, name, _reason in FIELDS:
        value = sheet.get(field) if side == "key" else _value(sheet.get(name))
        made.fields[field] = _normal(field, value)
    views = sheet.get("views")
    made.views = [_View(v) for v in views if isinstance(v, dict)] if isinstance(views, list) else []
    return made


def _box(value: Any) -> Box | None:
    """Four finite numbers, as (min x, min y, max x, max y); None for anything else."""
    if not isinstance(value, list) or len(value) != 4:
        return None
    numbers = [_finite(n) for n in value]
    if None in numbers:
        return None
    x0, y0, x1, y1 = (n for n in numbers if n is not None)
    return min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)


def _paper(value: Any) -> tuple[float, float] | None:
    """A paper `[w, h]` in mm, both finite and positive; None for anything else."""
    if not isinstance(value, list) or len(value) != 2:
        return None
    width, height = _finite(value[0]), _finite(value[1])
    if width is None or height is None or width <= 0 or height <= 0:
        return None
    return width, height


def _paper_ratio(
    key: tuple[float, float] | None, found: tuple[float, float] | None
) -> tuple[float, float] | None:
    """Key paper over export paper, (x, y); None when either is unknown."""
    if key is None or found is None:
        return None
    return key[0] / found[0], key[1] / found[1]


def _finite(value: Any) -> float | None:
    """A number as a finite float; None for anything else (a bool, text, an overflowing integer)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        number = float(value)
    except OverflowError:
        return None
    return number if math.isfinite(number) else None


def _score_views(
    score: Score, keyed: list[_View], found: list[_View]
) -> tuple[list[str], int, dict[int, int]]:
    """Why the sheet's views fail it, how many export views joined no key view, and the join (key
    view index to export view index)."""
    joined = _one_to_one(_view_pairs(keyed, found))
    extra = len(found) - len(joined)
    score.extra_views += extra
    missing = titles = subjects = 0
    for k, view in enumerate(keyed):
        f = joined.get(k)
        score.count("views", f is not None)
        if f is None:
            missing += 1
            continue
        title = view.title == found[f].title
        score.count("view titles", title)
        titles += not title
        score.no_export_subject += not found[f].subject
        # A key phrase naming none of the engine's subject words is left out of the count (R1).
        word = view.word
        if word is None:
            score.outside += 1
            continue
        subject = word == found[f].subject
        score.count("view subjects", subject)
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
    return reasons, extra, joined


def _diagnose(
    score: Score, sheet: _Sheet, other: _Sheet, found: list[_View], joined: dict[int, int]
) -> None:
    """The diagnostic's counts for one joined sheet, from its export views as they were joined
    (paper-scaled) and that join; it changes no score."""
    keyed = sheet.views
    taken = set(joined.values())
    missing: dict[str, int] = {}
    for k, view in enumerate(keyed):
        if k not in joined:
            kind = _named(view.kind)
            missing[kind] = missing.get(kind, 0) + 1
            score.key_causes[_cause(view, found)] += 1
    score.missing_kinds.append(missing)
    for f, view in enumerate(found):
        if f not in taken:
            cause = (_named(view.kind), _cause(view, keyed))
            score.export_causes[cause] = score.export_causes.get(cause, 0) + 1
    if not sheet.framed:
        return
    score.aligned = score.aligned or 0
    shift = _corner_shift(sheet, other)
    if shift is None:
        return
    aligned = _one_to_one(_view_pairs(keyed, [_moved(view, (1.0, 1.0), shift) for view in found]))
    score.aligned += sum(1 for k in aligned if k not in joined)


def _named(kind: str) -> str:
    """A kind as the diagnostic may print it: one of KINDS, else "another kind"."""
    return kind if kind in KINDS else "another kind"


def _corner_shift(sheet: _Sheet, other: _Sheet) -> tuple[float, float] | None:
    """How far, on the key's paper in mm, to move the export's views so its frame's lower-left corner
    meets the key's. Every view box is on paper, in mm, from its own sheet's lower-left corner
    (engine/recognise/views.py; the rulings, "24s <-> 17"), while the frames are where they lie (a
    model-space frame in model units): a place p is at (p - corner) * paper / frame on either paper,
    so an export view is at the key's place when moved by (export corner - key corner) * paper /
    frame. The paper is the key's, else the export's (over the export's frame), else, for a layout
    sheet, the frame itself (a layout is drawn in paper mm); None when the ratio is unknown (a
    model-space sheet with no paper) or a frame is not a box."""
    key, found = sheet.box, other.box
    if key is None or found is None:
        return None
    if sheet.paper is not None:
        paper, frame = sheet.paper, key
    elif other.paper is not None:
        paper, frame = other.paper, found
    elif not sheet.in_model:
        return found[0] - key[0], found[1] - key[1]
    else:
        return None
    width, height = frame[2] - frame[0], frame[3] - frame[1]
    if not (width > 0 and height > 0):
        return None
    return (found[0] - key[0]) * paper[0] / width, (found[1] - key[1]) * paper[1] / height


def _cause(view: _View, others: list[_View]) -> int:
    """Why `view` joined nothing among `others` (the other side's views of its sheet): the index of
    the first of CAUSES that holds."""
    if any(o.kind != view.kind and _iou(view.box, o.box) >= JOIN - 1e-9 for o in others):
        return 0
    same = [_iou(view.box, o.box) for o in others if o.kind == view.kind]
    if not same:
        return 1
    best = max(same)
    if best >= JOIN - 1e-9:
        return 2
    if best >= 0.5:
        return 3
    return 4 if best >= 0.2 else 5


def _counted(n: int, one: str, many: str) -> str:
    return one if n == 1 else f"{n} {many}"


def _view_pairs(keyed: list[_View], found: list[_View]) -> list[tuple[float, int, int]]:
    """Every same-kind (key view, export view) pair by its IoU, the largest first."""
    return sorted(
        (
            (_iou(view.box, other.box), k, f)
            for k, view in enumerate(keyed)
            for f, other in enumerate(found)
            if view.kind == other.kind
        ),
        key=lambda pair: (-pair[0], pair[1], pair[2]),
    )


def _join_sheets(keyed: list[_Sheet], found: list[_Sheet]) -> dict[int, int]:
    """Key sheet index to export sheet index, within the key sheet's drawing file when it names one. A
    key sheet whose layout is "model" (any case) is drawn in model space: its candidates are the export
    sheets with no layout or the layout "model" (13's export gives a model-space sheet a null layout and
    its frame as `location.box`, in model units; session 06's F0). Any other key sheet's candidates
    share its layout's name. A key sheet with a frame joins only a candidate whose box has an IoU of at
    least 0.8 with it, a lone one too (session 06's F5); one with no frame joins a lone candidate."""
    pairs = []
    for k, sheet in enumerate(keyed):
        if sheet.layout is None:
            continue
        candidates = [
            f
            for f, other in enumerate(found)
            if (other.in_model if sheet.in_model else other.layout == sheet.layout)
            and (sheet.origin is None or other.origin == sheet.origin)
        ]
        if sheet.framed:
            pairs += [(_iou(sheet.box, found[f].box), k, f) for f in candidates]
        elif len(candidates) == 1:
            pairs.append((1.0, k, candidates[0]))
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


def _iou(a: Box | None, b: Box | None) -> float:
    if a is None or b is None:
        return 0.0
    (ax0, ay0, ax1, ay1), (bx0, by0, bx1, by1) = a, b
    inter = max(0.0, min(ax1, bx1) - max(ax0, bx0)) * max(0.0, min(ay1, by1) - max(ay0, by0))
    union = (ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0) - inter
    return inter / union if union > 0 else 0.0


def _value(sourced: Any) -> Any:
    """A sourced value's value (13's `{value, source}`), or the value itself."""
    return sourced.get("value") if isinstance(sourced, dict) else sourced


def _normal(field: str, value: Any) -> Any:
    """A sheet field's value as it is compared: two are right when their normal forms are equal."""
    if field == "number":
        return _number(value)
    if field == "title":
        return _title(value)
    if field == "storeys":
        return _storeys(value)
    return _text(value)


def _text(value: Any) -> str:
    """Case and whitespace folded; a missing value is the empty text."""
    if value is None:
        return ""
    return " ".join(unicodedata.normalize("NFKC", str(value)).casefold().split())


def _storeys(value: Any) -> list[str]:
    """Storeys as a list of items, in order (session 06's F1): a key's list or the export's stated
    text, each split on commas, "&" and the word "and", each item case- and whitespace-folded with the
    punctuation around its words stripped; empty items are dropped, so a missing value is the empty
    list."""
    items = []
    for part in value if isinstance(value, list) else [value]:
        for item in SEPARATORS.split(_text(part)):
            words = (_unpunctuated(word) for word in item.split())
            if folded := " ".join(word for word in words if word):
                items.append(folded)
    return items


def _unpunctuated(word: str) -> str:
    """The word without the punctuation at either end ("(3rd)" is "3rd"; "1st-floor" keeps its "-")."""
    start, end = 0, len(word)
    while start < end and unicodedata.category(word[start]).startswith("P"):
        start += 1
    while end > start and unicodedata.category(word[end - 1]).startswith("P"):
        end -= 1
    return word[start:end]


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
        for n, (layout, reasons, extra, unknown) in enumerate(score.sheets, 1):
            where = f" (layout {layout})" if layout else ""
            said = "pass" if not reasons else "fail: " + ", ".join(reasons)
            if extra:
                said += f"; {'an extra view' if extra == 1 else f'{extra} extra views'}"
            if unknown:
                said += "; paper unknown"
            lines.append(f"  sheet {n}{where}: {said}")
            missing = score.missing_kinds[n - 1]
            lines += [
                f"    {k} missing {'view' if k == 1 else 'views'} of kind {kind}"
                for kind, k in sorted(missing.items())
            ]
        lines.append(
            f"  extra sheets {score.extra_sheets}, extra views {score.extra_views} (in the export only)"
        )
        lines += _diagnostic(score)
    order = ["sheets", "views", *(field for field, _n, _r in FIELDS), "view titles", "view subjects"]
    totals = [f"  {field:14} {score.right.get(field, 0)} / {score.of.get(field, 0)}" for field in order]
    return lines + totals[:2] + ([] if held_out else totals[2:])


def _diagnostic(score: Score) -> list[str]:
    """A Development Set's diagnostic lines: counts and general terms only, never a key's value, and
    never " / " (the log keeps only the lines that hold one: the totals)."""
    lines = ["  unjoined key views of joined sheets, by cause:"]
    lines += [
        f"    {cause.format(side='export')}: {n}"
        for cause, n in zip(CAUSES, score.key_causes, strict=True)
    ]
    lines.append("  unjoined export views of joined sheets, by kind and cause:")
    lines += [
        f"    {kind}: {CAUSES[cause].format(side='key')}: {n}"
        for (kind, cause), n in sorted(score.export_causes.items())
    ] or ["    none"]
    if score.aligned is None:
        lines.append(
            "  key views that would join if frame corners were aligned: no joined sheet has a frame"
        )
    else:
        lines.append(
            "  key views that would join if frame corners were aligned (lower-left, translation"
            f" only): {score.aligned}"
        )
    lines.append(f"  joined views with no export subject: {score.no_export_subject}")
    lines.append(f"  subjects outside the vocabulary: {score.outside}")
    return lines


def _log(journal: TextIO, line: str) -> None:
    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    caller = os.environ.get("SUDO_UID", str(os.getuid()))
    journal.write(f"{stamp} uid {caller} " + " ".join(line.split()) + "\n")
    journal.flush()
    os.fsync(journal.fileno())


if __name__ == "__main__":
    import pwd

    try:
        pipeline = pwd.getpwnam(PIPELINE_USER).pw_uid
    except KeyError:
        print(f"vx-score: refused: no user {PIPELINE_USER} runs the pipeline here", file=sys.stderr)
        sys.exit(REFUSED)
    sys.exit(main(sys.argv[1:], drop=DROP, keys=KEYS, log=LOG, writer=pipeline))
