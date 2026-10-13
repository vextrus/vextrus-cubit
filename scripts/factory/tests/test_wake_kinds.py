"""S26-FX2, review rounds 1 and 2 of PR #794 (a repeated class: a kind written to events.log that the
mod's wake never reads). Every kind a writer in the tree appends to events.log, collected from the
writers' source, must wake the orchestrator through the mod's own wake.js, unless wake.js names it
in its ride-along lists; and every one must reach events.tail, which the mod reads once the log is
over 1 MiB."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from scripts.factory import watch

REPO = Path(__file__).resolve().parents[3]
WAKE = REPO / "tools/mod/vextrus-factory/hooks/wake.js"
# Where a writer of events.log may live; tests are left out.
WRITER_ROOTS = ("scripts", ".claude/hooks", "tools")
WRITER_SUFFIXES = {".py", ".mjs", ".js", ".sh"}
# Lines the orchestrator writes by hand (the runbook's owner-action lines).
BY_HAND = {"OWNER-COMMAND", "OWNER-RULING"}
# Kinds whose writers this test must find, so a collector gone blind fails too.
KNOWN = {"READY", "PUSH", "REVIEW-READY", "STOP-FAILURE", "WALK", "ALARM-RESUME-COPY", "SAID"}

KIND = r"([A-Z][A-Z0-9-]*)"
WATCH_CALLS = (
    re.compile(r'step\.event\(\s*"' + KIND + '"'),
    re.compile(r'step\.alarm\(\s*[^,()]+(?:\([^()]*\))?[^,()]*,\s*"' + KIND + '"', re.S),
)
# A line written as `<utc expression> KIND ...`: `{status.utc(..)} KIND`, `${utc()} KIND`.
WRITTEN = re.compile(r"utc\([^)]*\)\)?\}\s+" + KIND + r"\s")


def writers() -> list[Path]:
    found = []
    for root in WRITER_ROOTS:
        for path in (REPO / root).rglob("*"):
            if path.suffix not in WRITER_SUFFIXES or not path.is_file():
                continue
            rel = path.relative_to(REPO).as_posix()
            if "/tests/" in rel or ".test." in path.name or path.name.startswith("test_"):
                continue
            if "node_modules" in rel:
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            if "events.log" in text:
                found.append(path)
    return found


def emitted_kinds() -> set[str]:
    kinds = set(BY_HAND)
    for path in writers():
        text = path.read_text(encoding="utf-8", errors="replace")
        for pattern in (*WATCH_CALLS, WRITTEN):
            kinds.update(pattern.findall(text))
    return kinds


def test_the_collector_finds_the_known_writers() -> None:
    assert emitted_kinds() >= KNOWN, sorted(KNOWN - emitted_kinds())


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not on PATH")
def test_every_kind_written_to_events_log_wakes_or_is_named_a_rider() -> None:
    kinds = sorted(emitted_kinds())
    script = (
        f"import({json.dumps(WAKE.as_uri())}).then((w) => {{"
        " const kinds = JSON.parse(require('fs').readFileSync(0, 'utf8'));"
        " const out = {};"
        " for (const k of kinds) {"
        "  const detail = k === 'WALK' ? '4596e870 done PASS' : 'x';"
        "  const line = `2026-10-13T01:00:00Z ${k} t1 ${detail}\\n`;"
        "  const now = Date.parse('2026-10-13T01:00:01Z');"
        "  const r = w.advance({ cursor: { at: '', hashes: [] } }, line, now, false);"
        "  out[k] = { woke: r.lines !== null, named: w.RIDING.includes(k) || w.ROUTINE.includes(k) } }"
        " process.stdout.write(JSON.stringify(out)) })"
    )
    done = subprocess.run(
        ["node", "-e", script],
        input=json.dumps(kinds),
        capture_output=True,
        text=True,
        check=True,
        timeout=60,
    )
    seen = json.loads(done.stdout)
    silent = [k for k in kinds if not seen[k]["woke"] and not seen[k]["named"]]
    assert silent == [], f"kinds written to events.log that neither wake nor are named riders: {silent}"
    named_but_woke = [
        k for k in kinds if seen[k]["named"] and seen[k]["woke"] and k not in ("PUSH", "COMMIT")
    ]
    assert named_but_woke == [], f"a named rider woke alone: {named_but_woke}"


def test_every_kind_written_to_events_log_reaches_events_tail(tmp_path: Path) -> None:
    kinds = sorted(emitted_kinds())
    lines = [f"2026-10-13T01:00:{i % 60:02d}Z {k} t1 x" for i, k in enumerate(kinds)]
    (tmp_path / "events.log").write_text("".join(f"{line}\n" for line in lines))
    watch.write_events_tail(tmp_path)
    kept = (tmp_path / "events.tail").read_text().splitlines()
    assert [k for k, line in zip(kinds, lines, strict=True) if line not in kept] == []
