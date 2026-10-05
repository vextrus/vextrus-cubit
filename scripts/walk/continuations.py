"""G1's false continuation count: the walk's conflict Questions against a local ground-truth list.

Two private files meet here (never in git):

- `<walks>/<sha>/conflicts.json`, written by `web/e2e/real/walk.spec.ts` beside `walk.json`:
  `{"schema": 1, "sha", "started_at", "sets": {<slug>: {"questions": [{"code", "proposals":
  [{"file", "number", "plot_page"} | null, ...]}]}}}`: each `conflict` Question the walk counted
  (open, or answered by the walk), each of its Proposals resolved to its keys (`null`: an id with no
  Proposal);
- `<expect-dir>/continuations.json` (schema 1), the ground truth: `sets.<slug>.{groups,
  near_misses}`; a sheet is `{file, page, sheet_number, plot_file?, plot_page?}`; a group has
  `discipline`, `title_form` (`same` or `mark_range`) and `sheets`; a near miss has `discipline`,
  `why` and `sheets`. Only these keys are read: a group's title (or any other text) never is.

The rule. A Proposal matches a truth sheet when `file` and `number` are equal and the `plot_page`s are
equal or either is absent. A Question counts when its code is `engine.conflicts.same_title` or
`engine.conflicts.same_storey`, it holds two or more Proposals, and every one matches a sheet of one
and the same group (for the unsure count: of one near miss whose `why` is `unsure`). Per the group's
Discipline row:

- `false_continuation_questions` (judged): Questions inside one group whose `title_form` is `same`
  (M0's one-title rule, docs/specs/M0.md);
- `false_continuation_questions_qs_view` (informational): Questions inside one group of any form;
- `continuation_questions_unsure` (informational): Questions inside one unsure near miss.

A Proposal the engine may have misread is doubt, not a miss: one that matches no group sheet but
shares a group sheet's `file` and `plot_page` (both present) under another or no number, or one with
no number in a file that holds a group sheet. A misread number would otherwise break a run in two
and count its false continuation Question as none; so a counted-code Question holding two or more
Proposals, one of them doubtful, leaves its set unmeasured.

`attach` returns a copy of the walk with the three counts on every burden row of each set it can
measure (a Discipline with a count and no row gets a zero row). Any doubt (a file missing, another
walk's `conflicts.json`, a set the truth does not hold, a `null` or malformed Proposal, a doubtful
Proposal, a Question that lies inside two groups) leaves that set exactly as the walk wrote it: its
null fails the check closed.
"""

import copy
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCHEMA = 1
CODES = frozenset({"engine.conflicts.same_title", "engine.conflicts.same_storey"})
"""The conflict codes a wrongly questioned continuation arrives as (engine/recognise/conflicts.py)."""
FORMS = frozenset({"same", "mark_range"})
JUDGED_FORM = "same"
UNSURE = "unsure"
DISCIPLINE = re.compile(r"[a-z][a-z0-9_]{1,24}")
JUDGED = "false_continuation_questions"
QS_VIEW = "false_continuation_questions_qs_view"
UNSURE_COUNT = "continuation_questions_unsure"
COUNTS = (JUDGED, QS_VIEW, UNSURE_COUNT)
CONFLICTS_NAME = "conflicts.json"
TRUTH_NAME = "continuations.json"

Key = tuple[str, str | None, int | None]
"""A sheet or a Proposal by its keys: (file, number, plot_page)."""


class Unmeasurable(ValueError):
    """A file, a set or a Question that cannot be counted with certainty."""


@dataclass(frozen=True)
class Group:
    """A group or a near miss, with only what the count needs."""

    discipline: str
    form: str
    """A group's `title_form`, or a near miss's `why`."""
    sheets: tuple[Key, ...]


@dataclass(frozen=True)
class Truth:
    groups: tuple[Group, ...]
    near_misses: tuple[Group, ...]


def _page(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise Unmeasurable("a plot page is not a page number")
    return value


def _text(value: object) -> str:
    if not isinstance(value, str) or not value:
        raise Unmeasurable("a key is not text")
    return value


def _sheet(raw: object) -> Key:
    if not isinstance(raw, Mapping):
        raise Unmeasurable("a truth sheet is not an object")
    return (_text(raw.get("file")), _text(raw.get("sheet_number")), _page(raw.get("plot_page")))


def _entries(raw: object, kind_key: str, kinds: frozenset[str] | None) -> tuple[Group, ...]:
    if not isinstance(raw, list):
        raise Unmeasurable("groups or near misses are not a list")
    entries = []
    for entry in raw:
        if not isinstance(entry, Mapping):
            raise Unmeasurable("a group is not an object")
        discipline, form, sheets = entry.get("discipline"), entry.get(kind_key), entry.get("sheets")
        if not isinstance(discipline, str) or not DISCIPLINE.fullmatch(discipline):
            raise Unmeasurable("a group's Discipline is not a Discipline code")
        if not isinstance(form, str) or (kinds is not None and form not in kinds):
            raise Unmeasurable("a group's form is not known")
        if not isinstance(sheets, list) or not sheets:
            raise Unmeasurable("a group has no sheets")
        entries.append(Group(discipline, form, tuple(_sheet(s) for s in sheets)))
    return tuple(entries)


def load_truth(path: Path | str) -> dict[str, Truth]:
    """The ground truth by set slug; raises (OSError, ValueError) when the file cannot be trusted."""
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(raw, Mapping) or raw.get("schema") != SCHEMA:
        raise Unmeasurable("the truth is not schema 1")
    sets = raw.get("sets")
    if not isinstance(sets, Mapping):
        raise Unmeasurable("the truth has no sets")
    truth = {}
    for slug, entry in sets.items():
        if not isinstance(slug, str) or not isinstance(entry, Mapping):
            raise Unmeasurable("a truth set is not an object")
        truth[slug] = Truth(
            _entries(entry.get("groups"), "title_form", FORMS),
            _entries(entry.get("near_misses"), "why", None),
        )
    return truth


def _proposal(raw: object) -> Key:
    if raw is None:
        raise Unmeasurable("a Proposal id with no Proposal")
    if not isinstance(raw, Mapping) or set(raw) != {"file", "number", "plot_page"}:
        raise Unmeasurable("a Proposal is not its keys")
    number = raw["number"]
    if number is not None and not isinstance(number, str):
        raise Unmeasurable("a Proposal's number is not text")
    return (_text(raw["file"]), number, _page(raw["plot_page"]))


def _set_questions(entry: object) -> list[tuple[str, list[Key]]]:
    """One set's conflict Questions, each `(code, its Proposals' keys)`; raises when malformed."""
    questions = entry.get("questions") if isinstance(entry, Mapping) else None
    if not isinstance(questions, list):
        raise Unmeasurable("a set's Questions are not a list")
    listed = []
    for question in questions:
        if not isinstance(question, Mapping):
            raise Unmeasurable("a Question is not an object")
        code, proposals = question.get("code"), question.get("proposals")
        if not isinstance(code, str) or not isinstance(proposals, list):
            raise Unmeasurable("a Question has no code or Proposals")
        listed.append((code, [_proposal(p) for p in proposals]))
    return listed


def load_questions(path: Path, walk: Mapping[str, Any]) -> dict[str, list[tuple[str, list[Key]]] | None]:
    """The walk's conflict Questions by set slug (None: that set's are malformed, so it cannot be
    measured); raises when the file is not this walk's (its sha and started_at) or not schema 1."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, Mapping) or raw.get("schema") != SCHEMA:
        raise Unmeasurable("conflicts.json is not schema 1")
    for key in ("sha", "started_at"):
        if not isinstance(raw.get(key), str) or raw.get(key) != walk.get(key):
            raise Unmeasurable("conflicts.json is another walk's")
    sets = raw.get("sets")
    if not isinstance(sets, Mapping):
        raise Unmeasurable("conflicts.json has no sets")
    found: dict[str, list[tuple[str, list[Key]]] | None] = {}
    for slug, entry in sets.items():
        if not isinstance(slug, str):
            raise Unmeasurable("a set's name is not text")
        try:
            found[slug] = _set_questions(entry)
        except Unmeasurable:
            found[slug] = None  # this set only: the others are still measured
    return found


def matches(proposal: Key, sheet: Key) -> bool:
    """Same file and number; the plot pages equal, or either absent."""
    (file, number, page), (sheet_file, sheet_number, sheet_page) = proposal, sheet
    if number is None or file != sheet_file or number != sheet_number:
        return False
    return page is None or sheet_page is None or page == sheet_page


def doubtful(proposal: Key, groups: tuple[Group, ...]) -> bool:
    """A Proposal that matches no group sheet yet may be one misread: it shares a group sheet's file
    and plot page (both present) under another or no number, or it has no number in a file that
    holds a group sheet."""
    sheets = [s for g in groups for s in g.sheets]
    if any(matches(proposal, s) for s in sheets):
        return False
    file, number, page = proposal
    if number is None and any(s[0] == file for s in sheets):
        return True
    return page is not None and any(s[0] == file and s[2] == page for s in sheets)


def _inside(proposals: list[Key], groups: tuple[Group, ...]) -> Group | None:
    """The one group every Proposal matches a sheet of; None for none; raises for two."""
    holding = [g for g in groups if all(any(matches(p, s) for s in g.sheets) for p in proposals)]
    if len(holding) > 1:
        raise Unmeasurable("a Question lies inside two groups")
    return holding[0] if holding else None


def count(questions: list[tuple[str, list[Key]]], truth: Truth) -> dict[str, dict[str, int]]:
    """The three counts by Discipline for one set (only Disciplines a Question counted on)."""
    rows: dict[str, dict[str, int]] = {}

    def add(discipline: str, key: str) -> None:
        row = rows.setdefault(discipline, dict.fromkeys(COUNTS, 0))
        row[key] += 1

    unsure = tuple(n for n in truth.near_misses if n.form == UNSURE)
    for code, proposals in questions:
        if code not in CODES or len(proposals) < 2:
            continue
        if any(doubtful(p, truth.groups) for p in proposals):
            raise Unmeasurable("a Proposal may be a group sheet misread")
        group = _inside(proposals, truth.groups)
        if group is not None:
            add(group.discipline, QS_VIEW)
            if group.form == JUDGED_FORM:
                add(group.discipline, JUDGED)
        near = _inside(proposals, unsure)
        if near is not None:
            add(near.discipline, UNSURE_COUNT)
    return rows


ZERO_ROW = {"sheets": 0, "one_source": 0, "bulk_confirmable": 0, "continuation_questions": 0}


def attach(walk: Any, folder: Path, expect_dir: Path) -> Any:
    """A copy of `walk` with the three counts on every burden row of each set that can be measured
    from `folder`'s conflicts.json and `expect_dir`'s continuations.json; any other set unchanged."""
    counted = copy.deepcopy(walk)
    if not isinstance(counted, Mapping) or not isinstance(counted.get("sets"), Mapping):
        return counted
    try:
        truth = load_truth(expect_dir / TRUTH_NAME)
        questions = load_questions(folder / CONFLICTS_NAME, counted)
    except OSError, ValueError, RecursionError:
        return counted  # nothing can be measured: every set stays as the walk wrote it
    for slug, record in counted["sets"].items():
        burden = record.get("burden") if isinstance(record, Mapping) else None
        listed = questions.get(slug)
        if slug not in truth or listed is None or not isinstance(burden, dict):
            continue
        try:
            rows = count(listed, truth[slug])
        except Unmeasurable:
            continue
        if not all(isinstance(row, dict) for row in burden.values()):
            continue
        for discipline in rows:
            burden.setdefault(discipline, {**ZERO_ROW, JUDGED: None})
        for discipline, row in burden.items():
            row.update(rows.get(discipline, dict.fromkeys(COUNTS, 0)))
    return counted
