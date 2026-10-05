"""Jev's advice on whether a walk finding repeats an open walk issue (#258; jev-cli.md 2, J-d).

    advice = advise("walk: <class> on <screen>", [(number, "walk: <class> on <screen>"), ...])

Jev advises beside the exact `<class>/<screen>` rule (`issues.draft`); the exact rule decides, and a
missing, late or odd answer is a new issue. `advise` runs `scripts.factory.jev same-issue` with only the
public titles, re-checks the contract's thresholds on the way back, and never raises: every outcome but
a well-formed answer within them is `Advice("new", None, None)`. It never prints the text and never
reads the key (the jev command reads it from the environment).
"""

import json
import math
import os
import subprocess
import sys
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
THRESHOLDS = {"comment": 0.8, "possible": 0.3}
"""The contract's thresholds on P(same defect): `comment` at 0.8 or more, `possible` 0.3 to below 0.8."""
MAX_ADVISED = 12
"""At most this many groups of one walk are put to Jev; the rest are new issues."""
TIMEOUT = 60

type Run = Callable[..., subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class Advice:
    decision: str
    """`comment`, `possible` or `new` (a str, checked by `checked`: an advisor may answer anything)."""
    issue: int | None
    p: float | None


NEW = Advice("new", None, None)


def checked(advice: object, numbers: Sequence[int]) -> Advice:
    """`advice` if it is an `Advice` the thresholds allow on one of `numbers`, else `new`."""
    if not isinstance(advice, Advice) or advice.decision not in THRESHOLDS:
        return NEW
    issue, p = advice.issue, advice.p
    if isinstance(issue, bool) or not isinstance(issue, int) or issue not in numbers:
        return NEW
    if isinstance(p, bool) or not isinstance(p, (int, float)) or not math.isfinite(p):
        return NEW
    if not THRESHOLDS[advice.decision] <= p <= 1.0:
        return NEW
    if advice.decision == "possible" and p >= THRESHOLDS["comment"]:
        return NEW
    return Advice(advice.decision, issue, float(p))


def _run(argv: list[str], *, timeout: float) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, capture_output=True, text=True, check=False, cwd=ROOT, timeout=timeout)


def _read(stdout: str, numbers: Sequence[int]) -> Advice:
    try:
        said = json.loads(stdout)
    except ValueError:
        return NEW
    if not isinstance(said, dict) or said.get("decision") not in THRESHOLDS:
        return NEW
    return checked(Advice(said["decision"], said.get("issue"), said.get("p")), numbers)


def advise(text: str, issues: Sequence[tuple[int, str]], *, run: Run = _run) -> Advice:
    """Jev's advice on `text` against the open `issues` (number, public title); never raises."""
    try:
        if not issues:
            return NEW
        numbers = [number for number, _ in issues]
        rows = [{"number": number, "title": title} for number, title in issues]
        handle, name = tempfile.mkstemp(prefix="same-issue-", suffix=".json")
        try:
            with os.fdopen(handle, "w", encoding="utf-8") as file:
                json.dump(rows, file)
            argv = [sys.executable, "-m", "scripts.factory.jev", "same-issue", "--text", text]
            done = run([*argv, "--issues", name], timeout=TIMEOUT)
        finally:
            Path(name).unlink(missing_ok=True)
        if done.returncode != 0 or not isinstance(done.stdout, str):
            return NEW
        return _read(done.stdout, numbers)
    except Exception:  # a timeout, a missing interpreter, an odd runner: no advice
        return NEW
