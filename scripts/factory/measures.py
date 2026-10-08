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

A percentile is the inclusive linear interpolation. A measure with no data (or whose source gh could not
give) is None, shown as "not measured". Lower is better for every measure but `prs_merged`.

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

KEYS = (
    "prs_merged",
    "merge_p50_min",
    "rounds_per_pr",
    "rdlock_min",
    "verify_p50_min",
    "verify_p90_min",
    "ci_wall_p50_min",
)
HIGHER_IS_BETTER = ("prs_merged",)
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


def compute(
    *,
    started_utc: str,
    ended_utc: str,
    prs: Sequence[Mapping[str, Any]] | None,
    ledger: Sequence[Mapping[str, Any]],
    lock_spans: Iterable[Span],
    verify_spans: Iterable[Span],
    ci_runs: Sequence[Mapping[str, Any]] | None,
) -> dict[str, float | int | None]:
    """The seven measures of the window; `prs` or `ci_runs` None (gh failed) leaves theirs None."""
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
    held = _span_minutes(lock_spans, window, 0)
    out["rdlock_min"] = sum(held)
    verify = _span_minutes(verify_spans, window, 1)
    out["verify_p50_min"] = percentile(verify, 0.5)
    out["verify_p90_min"] = percentile(verify, 0.9)
    if ci_runs is not None:
        out["ci_wall_p50_min"] = percentile(_head_walls(ci_runs, window), 0.5)
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
        if target is not None and now_value > target:
            flags.append(f"{key}: missed target ({_show(now_value)} against {_show(target)})")
        before = (previous or {}).get(key)
        if before is None:
            continue
        worse = now_value < before if key in HIGHER_IS_BETTER else now_value > before
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
            "merged",
            "--limit",
            "300",
            "--json",
            "number,headRefName,state,createdAt,mergedAt",
        ]
    )


def read_ci_runs() -> list[dict[str, Any]] | None:
    return _gh_json(
        [
            "run", "list", "--limit", "300", "--json",
            "databaseId,workflowName,headSha,event,status,conclusion,createdAt,startedAt,updatedAt",
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
    return compute(
        started_utc=started_utc,
        ended_utc=ended_utc,
        prs=read_prs(),
        ledger=read_ledger(factory),
        lock_spans=read_lock_spans(factory),
        verify_spans=read_verify_spans(common) if common else [],
        ci_runs=read_ci_runs(),
    )
