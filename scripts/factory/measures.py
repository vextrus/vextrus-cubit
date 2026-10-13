"""The session's measures, read from the factory's own logs, and their flags (S17-F4).

    measures.compute(started_utc=, ended_utc=, prs=, ledger=, lock_spans=, verify_spans=, ci_runs=)
    measures.load_targets(path)
    measures.compare(current, previous, targets)
    measures.render(current, previous, targets, flags)
    measures.collect(...)   (what `stamp end` calls: reads gh and the folders, never raises)

The seven measures, for a session's window [started, ended]:

- `prs_merged`: PRs whose `mergedAt` is in the window; `merge_p50_min`: their median open-to-merge
  minutes.
- `rounds_per_pr`: mean ledger records (review rounds) per merged PR that was reviewed.
- `rdlock_min`: minutes of real-drawing lock holds that began in the window.
- `verify_p50_min`, `verify_p90_min`: verify run minutes (runs that ended in the window).
- `ci_wall_p50_min`: median over pushed heads of the wall minutes from the earliest created to the
  latest finished run of the `ci` and `engine` workflows (the ones carrying required checks) for that
  head; the other workflows only skip or post a status. A head with a cancelled or unfinished run is
  left out (`cancel-in-progress` ends a superseded head's runs after minutes); only `success` and
  `failure` runs count.

The loop's measures (S25-F5), each None when its source was not given or gh failed:

- `round1_pass_product`, `round1_pass_factory`, `round1_pass_docs`: of the PRs of that area (merged,
  closed or open) whose round-1 review record was recorded in the window, the fraction that PASSed.
  A PR's area
  is where most of its changed lines are (`vextrus/`, `web/`, `engine/` product; `scripts/`, `tools/`,
  `.claude/`, `.github/` factory; `docs/` docs).
- `rounds_per_ticket`: mean review rounds per ticket (a ticket is its branch, so a closed PR
  and the fresh PR that replaced it count together), over the reviewed tickets with a PR merged or closed
  in the window.
- `ready_to_review_p50_min`: median minutes from a READY event (events.log) in the window to the first
  review start of that head (`review-cost.jsonl`'s `started_at`, which review.py writes).
- `factory_hours_share`: factory-area builder minutes over all builder minutes started in the window. A
  builder's span runs from its launch record to the ticket's first READY or BLOCKED event.
- `e2e_main_streak`: consecutive successful `e2e` runs on main, newest first by `createdAt`, over every
  run gh gives; a run not completed or cancelled neither counts nor breaks it.

A percentile is the inclusive linear interpolation. A measure with no data (or whose source gh could not
give) is None, shown as "not measured". Lower is better for every measure but
`prs_merged`, the round-1 rates and the e2e streak.

Approximation: the real-drawing lock keeps no history, so a hold is an `rdlock run` log of
`.private/work/rd/`: it began at the time in its file name and ended at the log's last write. A verify
run is `started_at` to `written_at` of its shared record; a record without `started_at` is not counted.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import tomllib
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

from scripts.factory import status
from scripts.factory.governor import NOT_BUILDER_ROLES

KEYS = (
    "prs_merged",
    "merge_p50_min",
    "rounds_per_pr",
    "rdlock_min",
    "verify_p50_min",
    "verify_p90_min",
    "ci_wall_p50_min",
    "round1_pass_product",
    "round1_pass_factory",
    "round1_pass_docs",
    "rounds_per_ticket",
    "ready_to_review_p50_min",
    "factory_hours_share",
    "e2e_main_streak",
)
HIGHER_IS_BETTER = (
    "prs_merged",
    "round1_pass_product",
    "round1_pass_factory",
    "round1_pass_docs",
    "e2e_main_streak",
)
AREAS = {
    "product": ("vextrus/", "web/", "engine/"),
    "factory": ("scripts/", "tools/", ".claude/", ".github/"),
    "docs": ("docs/",),
}
GH_TIMEOUT = 60
GH_ERRORS = (*status.RUN_ERRORS, ValueError)
REQUIRED_WORKFLOWS = ("ci", "engine")  # the workflows that carry required checks
NOT_MEASURED = "not measured"
Span = tuple[str, str]


def _time(text: Any) -> datetime | None:
    try:
        return status.parse_utc(str(text))
    except ValueError:
        return None


def _minutes(start: datetime, end: datetime) -> float:
    return max(0.0, (end - start).total_seconds() / 60)


def percentile(values: Sequence[float], fraction: float) -> float | None:
    """Inclusive linear interpolation; None for no values."""
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def _span_minutes(spans: Iterable[Span], window: tuple[datetime, datetime], by: int) -> list[float]:
    """Minutes of the spans whose start (`by` 0) or end (`by` 1) is inside the window."""
    found = []
    for pair in spans:
        start, end = _time(pair[0]), _time(pair[1])
        if start is None or end is None:
            continue
        if window[0] <= (start, end)[by] <= window[1]:
            found.append(_minutes(start, end))
    return found


def _head_walls(ci_runs: Sequence[Mapping[str, Any]], window: tuple[datetime, datetime]) -> list[float]:
    """Per pushed head: earliest created to latest finished among the runs of the workflows that carry
    required checks. Only a run that ended `success` or `failure` has a wall. A head with a cancelled
    run (`cancel-in-progress`: a newer push superseded it) or an unfinished one is left out whole; its
    minutes are not a CI wall. A head counts when its earliest run was created in the window."""
    heads: dict[str, list[tuple[datetime, datetime | None]]] = {}
    for run in ci_runs:
        if run.get("workflowName") not in REQUIRED_WORKFLOWS or not run.get("headSha"):
            continue
        created = _time(run.get("createdAt"))
        if created is None:
            continue
        conclusion = run.get("conclusion") if run.get("status") == "completed" else None
        if conclusion in ("success", "failure"):
            heads.setdefault(run["headSha"], []).append((created, _time(run.get("updatedAt"))))
        elif conclusion is None or conclusion == "cancelled":
            heads.setdefault(run["headSha"], []).append((created, None))
    walls = []
    for runs in heads.values():
        first = min(created for created, _ in runs)
        finished = [done for _, done in runs]
        if window[0] <= first <= window[1] and None not in finished:
            walls.append(_minutes(first, max(d for d in finished if d is not None)))
    return walls


def _area(files: Any) -> str | None:
    """The area holding most of the changed lines of `files` (gh's `files` rows), None for no files."""
    weight: dict[str, int] = {}
    for row in files or []:
        path = str(row.get("path", "")) if isinstance(row, Mapping) else ""
        for area, prefixes in AREAS.items():
            if path.startswith(prefixes):
                lines = int(row.get("additions") or 0) + int(row.get("deletions") or 0)
                weight[area] = weight.get(area, 0) + max(lines, 1)
                break
    return max(sorted(weight), key=lambda area: weight[area]) if weight else None


def _branch_areas(prs: Sequence[Mapping[str, Any]]) -> dict[str, str | None]:
    """Each branch's area, from the files of all its PRs together."""
    files: dict[str, list[Any]] = {}
    for row in prs:
        files.setdefault(str(row.get("headRefName")), []).extend(row.get("files") or [])
    return {branch: _area(rows) for branch, rows in files.items()}


def _round1_pass(
    prs: Sequence[Mapping[str, Any]],
    ledger: Sequence[Mapping[str, Any]],
    window: tuple[datetime, datetime],
) -> dict[str, float | None]:
    area_of = {row["number"]: _area(row.get("files")) for row in prs if "number" in row}
    first: dict[Any, tuple[datetime, str]] = {}
    for record in ledger:
        recorded = _time(record.get("recorded_at"))
        if record.get("round") != 1 or recorded is None or not window[0] <= recorded <= window[1]:
            continue
        number = record.get("pr")
        if number in area_of and (number not in first or recorded < first[number][0]):
            first[number] = (recorded, str(record.get("verdict")))
    out: dict[str, float | None] = {}
    for area in AREAS:
        verdicts = [v for number, (_, v) in first.items() if area_of[number] == area]
        out[f"round1_pass_{area}"] = verdicts.count("PASS") / len(verdicts) if verdicts else None
    return out


def _rounds_per_ticket(
    prs: Sequence[Mapping[str, Any]],
    ledger: Sequence[Mapping[str, Any]],
    window: tuple[datetime, datetime],
) -> float | None:
    rounds: dict[Any, set[Any]] = {}
    for record in ledger:
        rounds.setdefault(record.get("pr"), set()).add(record.get("round"))
    totals: dict[str, int] = {}
    for row in prs:
        ended = _time(row.get("mergedAt") or row.get("closedAt"))
        if ended is not None and window[0] <= ended <= window[1]:
            totals[str(row.get("headRefName"))] = 0
    for row in prs:
        branch = str(row.get("headRefName"))
        if branch in totals:
            totals[branch] += len(rounds.get(row.get("number"), ()))
    reviewed = [count for count in totals.values() if count]
    return sum(reviewed) / len(reviewed) if reviewed else None


def _ready_to_review(
    events: Iterable[str],
    review_starts: Iterable[Mapping[str, Any]],
    window: tuple[datetime, datetime],
) -> float | None:
    first: dict[str, datetime] = {}
    for row in review_starts:
        started, head = _time(row.get("started_at")), str(row.get("head") or "")
        if started is not None and head and (head not in first or started < first[head]):
            first[head] = started
    waits = []
    for line in events:
        parts = str(line).split(" ", 3)
        ready = _time(parts[0])
        if len(parts) < 4 or parts[1] != "READY" or ready is None or not window[0] <= ready <= window[1]:
            continue
        words = parts[3].split()
        prefix = words[0] if words else ""
        starts = [at for head, at in first.items() if prefix and head.startswith(prefix) and at >= ready]
        if starts:
            waits.append(_minutes(ready, min(starts)))
    return percentile(waits, 0.5)


def _factory_share(
    spans: Iterable[tuple[str, str, str]],
    prs: Sequence[Mapping[str, Any]],
    window: tuple[datetime, datetime],
) -> float | None:
    area_of = _branch_areas(prs)
    total = factory = 0.0
    for branch, start_text, end_text in spans:
        start, end = _time(start_text), _time(end_text)
        if start is None or end is None or not window[0] <= start <= window[1]:
            continue
        minutes = _minutes(start, end)
        total += minutes
        if area_of.get(branch) == "factory":
            factory += minutes
    return factory / total if total else None


def _e2e_streak(ci_runs: Sequence[Mapping[str, Any]]) -> int:
    runs = []
    for run in ci_runs:
        created = _time(run.get("createdAt"))
        if run.get("workflowName") == "e2e" and run.get("headBranch") == "main" and created:
            runs.append((created, run))
    streak = 0
    for _, run in sorted(runs, key=lambda pair: pair[0], reverse=True):
        conclusion = run.get("conclusion")
        if run.get("status") != "completed" or conclusion == "cancelled":
            continue
        if conclusion != "success":
            break
        streak += 1
    return streak


def compute(
    *,
    started_utc: str,
    ended_utc: str,
    prs: Sequence[Mapping[str, Any]] | None,
    ledger: Sequence[Mapping[str, Any]],
    lock_spans: Iterable[Span],
    verify_spans: Iterable[Span],
    ci_runs: Sequence[Mapping[str, Any]] | None,
    events: Iterable[str] | None = None,
    review_starts: Iterable[Mapping[str, Any]] | None = None,
    builder_spans: Iterable[tuple[str, str, str]] | None = None,
) -> dict[str, float | int | None]:
    """The measures of the window; `prs` or `ci_runs` None (gh failed) leaves theirs None, and so does a
    loop source (`events`, `review_starts`, `builder_spans`) not given."""
    started, ended = status.parse_utc(started_utc), status.parse_utc(ended_utc)
    window = (started, ended)
    out: dict[str, float | int | None] = dict.fromkeys(KEYS)
    if prs is not None:
        merged = []
        for row in prs:
            opened, closed = _time(row.get("createdAt")), _time(row.get("mergedAt"))
            if row.get("state") == "MERGED" and opened and closed and started <= closed <= ended:
                merged.append((row["number"], _minutes(opened, closed)))
        out["prs_merged"] = len(merged)
        out["merge_p50_min"] = percentile([m for _, m in merged], 0.5)
        rounds: dict[int, set[Any]] = {number: set() for number, _ in merged}
        for record in ledger:
            if record.get("pr") in rounds:
                rounds[record["pr"]].add(record.get("round"))
        reviewed = [len(seen) for seen in rounds.values() if seen]
        out["rounds_per_pr"] = sum(reviewed) / len(reviewed) if reviewed else None
        out.update(_round1_pass(prs, ledger, window))
        out["rounds_per_ticket"] = _rounds_per_ticket(prs, ledger, window)
        if builder_spans is not None:
            out["factory_hours_share"] = _factory_share(builder_spans, prs, window)
    if events is not None and review_starts is not None:
        out["ready_to_review_p50_min"] = _ready_to_review(events, review_starts, window)
    held = _span_minutes(lock_spans, window, 0)
    out["rdlock_min"] = sum(held)
    verify = _span_minutes(verify_spans, window, 1)
    out["verify_p50_min"] = percentile(verify, 0.5)
    out["verify_p90_min"] = percentile(verify, 0.9)
    if ci_runs is not None:
        out["ci_wall_p50_min"] = percentile(_head_walls(ci_runs, window), 0.5)
        out["e2e_main_streak"] = _e2e_streak(ci_runs)
    return out


def load_targets(path: Path) -> dict[str, float]:
    """The numbers of the targets file (top level, or its `[targets]` table)."""
    loaded = tomllib.loads(Path(path).read_text())
    table = loaded.get("targets", loaded)
    return {key: float(value) for key, value in table.items() if isinstance(value, int | float)}


def _show(value: Any) -> str:
    if value is None:
        return NOT_MEASURED
    return f"{value:g}" if isinstance(value, int | float) else str(value)


def compare(
    current: Mapping[str, Any], previous: Mapping[str, Any] | None, targets: Mapping[str, float]
) -> list[str]:
    """One flag per missed target or regression, each naming the measure's key."""
    flags = []
    for key, now_value in current.items():
        if now_value is None:
            continue
        target = targets.get(key)
        short = key in HIGHER_IS_BETTER
        if target is not None and (now_value < target if short else now_value > target):
            flags.append(f"{key}: missed target ({_show(now_value)} against {_show(target)})")
        before = (previous or {}).get(key)
        if before is None:
            continue
        worse = now_value < before if short else now_value > before
        if worse:
            flags.append(f"{key}: regressed ({_show(before)} -> {_show(now_value)})")
    return flags


def render(
    current: Mapping[str, Any],
    previous: Mapping[str, Any] | None,
    targets: Mapping[str, float],
    flags: Sequence[str],
) -> str:
    """The Markdown block `stamp end` appends to STATE.md."""
    rows = [
        "",
        "## Measures",
        "",
        "| measure | value | previous | target |",
        "| --- | --- | --- | --- |",
    ]
    for key in KEYS:
        target = targets.get(key)
        rows.append(
            f"| {key} | {_show(current.get(key))} | {_show((previous or {}).get(key))} | "
            f"{'' if target is None else _show(target)} |"
        )
    rows.append("")
    rows += [f"FLAG {flag}" for flag in flags] or ["No flags."]
    return "\n".join(rows) + "\n"


def _gh_json(argv: list[str]) -> list[dict[str, Any]] | None:
    try:
        done = subprocess.run(
            ["gh", *argv],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=GH_TIMEOUT,
            check=False,
        )
        loaded = json.loads(done.stdout) if done.returncode == 0 else None
    except GH_ERRORS:
        return None
    ok = isinstance(loaded, list) and all(isinstance(row, dict) for row in loaded)
    return loaded if ok else None


def read_prs() -> list[dict[str, Any]] | None:
    seam = os.environ.get("VEXTRUS_PRS_FILE")
    if seam:
        try:
            loaded = json.loads(Path(seam).read_text())
        except status.READ_ERRORS:
            return None
        return loaded if isinstance(loaded, list) else None
    return _gh_json(
        [
            "pr",
            "list",
            "--state",
            "all",
            "--limit",
            "300",
            "--json",
            "number,headRefName,state,createdAt,mergedAt,closedAt,files",
        ]
    )


def read_ci_runs() -> list[dict[str, Any]] | None:
    return _gh_json(
        [
            "run", "list", "--limit", "300", "--json",
            "databaseId,workflowName,headBranch,headSha,event,status,conclusion,createdAt,startedAt,updatedAt",
        ]
    )  # fmt: skip


def read_ledger(factory: Path) -> list[dict[str, Any]]:
    records = []
    for path in sorted((factory / "ledger").glob("*.json")):
        try:
            loaded = json.loads(path.read_text())
        except status.READ_ERRORS:
            continue
        if isinstance(loaded, dict):
            records.append(loaded)
    return records


def read_lock_spans(factory: Path) -> list[Span]:
    """Each `rdlock run` log of `<factory>/../rd/` as (the time in its name, its last write)."""
    spans = []
    for log in sorted((factory.parent / "rd").glob("*.log")):
        match = re.search(r"-(\d{8}T\d{6}Z)\.log$", log.name)
        try:
            began = datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ") if match else None
            ended = datetime.fromtimestamp(log.stat().st_mtime).astimezone() if began else None
        except status.READ_ERRORS:
            continue
        if began and ended:
            spans.append((began.strftime(status.UTC_FORMAT), status.utc(ended)))
    return spans


def read_verify_spans(common: Path) -> list[Span]:
    """Each shared verify record as (`started_at`, `written_at`); a record without `started_at` (written
    before it existed) is not measured, never guessed."""
    spans = []
    for path in sorted((common / "vextrus").glob("verify-*.json")):
        try:
            record = json.loads(path.read_text())
            spans.append((record["started_at"], record["written_at"]))
        except status.RECORD_ERRORS:
            continue
    return spans


def read_events(factory: Path) -> list[str] | None:
    """The lines of the watcher's `events.log`; None when it cannot be read."""
    try:
        return (factory / "events.log").read_text().splitlines()
    except status.READ_ERRORS:
        return None


def read_review_starts(factory: Path) -> list[dict[str, Any]]:
    """One row per review run from `review-cost.jsonl` (review.py writes `started_at` on each line; a
    line without it, written before it existed, is not a start)."""
    rows: list[dict[str, Any]] = []
    try:
        lines = (factory / "review-cost.jsonl").read_text().splitlines()
    except status.READ_ERRORS:
        return rows
    for line in lines:
        try:
            loaded = json.loads(line)
        except ValueError:
            continue
        if isinstance(loaded, dict) and loaded.get("started_at") and loaded.get("head"):
            rows.append(loaded)
    return rows


def _is_builder_record(record: Mapping[str, Any]) -> bool:
    """governor.read_builders' filter: a builder role, no review, no STOP sent, and a local launch or a
    cloud one whose judge was ok (a refused launch also writes a record)."""
    if record.get("role", "builder") in NOT_BUILDER_ROLES or record.get("review") is not None:
        return False
    if record.get("stop_sent") is True:
        return False
    judge = record.get("judge")
    return record.get("where") == "local" or (isinstance(judge, Mapping) and judge.get("ok") is True)


def read_builder_spans(factory: Path, events: Sequence[str]) -> list[tuple[str, str, str]]:
    """`(branch, start, end)` per builder launch record that governor.read_builders would count: from the
    record's `started_at` to the ticket's first READY or BLOCKED event after it, or to the ticket's next
    builder launch if that came first, so a relaunch never counts the same minutes twice. A builder with
    no such end yet has no span."""
    finished: dict[str, list[datetime]] = {}
    for line in events:
        parts = line.split(" ", 3)
        at = _time(parts[0])
        if len(parts) > 2 and parts[1] in ("READY", "BLOCKED") and at is not None:
            finished.setdefault(parts[2], []).append(at)
    launches: dict[str, list[tuple[datetime, str, str]]] = {}
    for path in sorted((factory / "launches").glob("*.json")):
        if path.name.endswith(".agents.json"):
            continue
        try:
            record = json.loads(path.read_text())
            started = status.parse_utc(record["started_at"])
            ticket, branch = str(record["ticket"]), str(record["branch"])
        except status.RECORD_ERRORS:
            continue
        if isinstance(record, dict) and _is_builder_record(record):
            launches.setdefault(ticket, []).append((started, branch, record["started_at"]))
    spans = []
    for ticket, rows in launches.items():
        rows.sort()
        for index, (started, branch, text) in enumerate(rows):
            ends = [at for at in finished.get(ticket, []) if at >= started]
            if index + 1 < len(rows):
                ends.append(rows[index + 1][0])
            if ends:
                spans.append((branch, text, status.utc(min(ends))))
    return spans


def previous_measures(factory: Path, started_utc: str) -> dict[str, Any] | None:
    """The stored measures of the newest session that started before this one."""
    best: tuple[datetime, dict[str, Any]] | None = None
    for path in factory.glob("measures-*.json"):
        try:
            loaded = json.loads(path.read_text())
            began = status.parse_utc(loaded["started_utc"])
            values = dict(loaded["measures"])
        except status.RECORD_ERRORS:
            continue
        if began < status.parse_utc(started_utc) and (best is None or began > best[0]):
            best = (began, values)
    return None if best is None else best[1]


def collect(repo: Path, factory: Path, started_utc: str, ended_utc: str) -> dict[str, Any]:
    """The measures for `stamp end`: gh and the folders read, a source that fails left unmeasured."""
    common = status.git_common_dir(repo)
    events = read_events(factory)
    return compute(
        started_utc=started_utc,
        ended_utc=ended_utc,
        prs=read_prs(),
        ledger=read_ledger(factory),
        lock_spans=read_lock_spans(factory),
        verify_spans=read_verify_spans(common) if common else [],
        ci_runs=read_ci_runs(),
        events=events,
        review_starts=None if events is None else read_review_starts(factory),
        builder_spans=None if events is None else read_builder_spans(factory, events),
    )
