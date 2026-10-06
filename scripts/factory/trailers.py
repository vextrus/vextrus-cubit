"""The factory trailers of one commit message, by trailers.md 1: the one reading every consumer makes.

    read(message, tree) -> Trailers(outcome, reason, why)

`outcome` is READY, BLOCKED, READY-NO-VERIFY (a malformed READY, or a factory line the reading does not
take) or None. The rule:
- the read paragraph is the last paragraph holding a `Factory-*` line among the message's last two (so a
  Factory block followed by an attribution paragraph is read, as the guard and the stop gate read it);
- a `Factory-*` line in any other paragraph is READY-NO-VERIFY, "factory trailer not in the last
  paragraph", whatever it says: never silence;
- a loose `Factory-State` line (`factory_state`, `Factory State`, leading space, any case) counts as a
  `Factory-*` line; one whose value contains `ready`, in the last two paragraphs, makes the head `gated`
  (the guard's push gate and the stop gate treat it as READY) and, on a head that is not READY,
  READY-NO-VERIFY: a mistyped READY is gated and alarmed, never read as no trailer. A READY line further
  back is alarmed (outside the read paragraph) but not gated: prose quoting the trailer may sit there.

`.claude/hooks/trailers.mjs` is the same reading for node (the stop gate imports it; the guard carries a
byte-identical copy, being self-contained). Both use only ASCII classes and `\\n` splits, so they agree
on every input; `scripts/factory/tests/test_trailers.py` runs one table through both.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Trailers:
    outcome: str | None  # READY, BLOCKED, READY-NO-VERIFY or None
    reason: str | None = None
    why: str | None = None
    gated: bool = (
        False  # a READY-looking Factory-State line in the last two paragraphs: the gates' READY
    )


KEYS = {"factory-state", "factory-verify", "factory-reason"}
PARAGRAPH_BREAK = re.compile(r"\n[ \t]*\n")
TRAILER = re.compile(r"^([A-Za-z0-9-]+):[ \t]*([^\n]*?)[ \t]*$")
# Whitespace written out, so Python and JavaScript mean the same characters.
_WS_CHARS = r" \t\v\f\x1c-\x1f\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
_WS = f"[{_WS_CHARS}]"
# A paragraph of whitespace alone is no paragraph (as JavaScript's trim() and Python's strip() both say).
NOT_BLANK = re.compile(rf"[^\n{_WS_CHARS}]")
LOOSE_STATE = re.compile(rf"^{_WS}*factory[-_ ]?state{_WS}*:{_WS}*([^\n]*)$", re.IGNORECASE | re.ASCII)
READY_WORD = re.compile(r"ready", re.IGNORECASE | re.ASCII)
VERIFY = re.compile(r"[0-9a-f]{40} ok")
REASON = re.compile(r"[^\r\n]{1,200}")
OUTSIDE = "factory trailer not in the last paragraph"
LOOSE = "a READY-looking Factory-State line outside the factory trailers"


def is_factory(line: str) -> bool:
    """A `Factory-*` trailer line, or any line a loose eye reads as a `Factory-State`."""
    match = TRAILER.match(line)
    strict = match is not None and match.group(1).lower().startswith("factory-")
    return strict or LOOSE_STATE.match(line) is not None


def looks_ready(line: str) -> bool:
    match = LOOSE_STATE.match(line)
    return match is not None and READY_WORD.search(match.group(1)) is not None


def read(message: str, tree: str) -> Trailers:
    text = message.replace("\r", "")
    paragraphs = [p.split("\n") for p in PARAGRAPH_BREAK.split(text) if NOT_BLANK.search(p)]
    holds = [any(is_factory(line) for line in p) for p in paragraphs]
    last_two = [i for i in (len(paragraphs) - 1, len(paragraphs) - 2) if i >= 0]
    held = [i for i in last_two if holds[i]]
    read_at = held[0] if held else -1
    gated = any(looks_ready(line) for i in last_two for line in paragraphs[i])
    if any(h and i != read_at for i, h in enumerate(holds)):
        return Trailers("READY-NO-VERIFY", None, OUTSIDE, gated)
    found = _core([] if read_at < 0 else paragraphs[read_at], tree)
    if found.outcome == "READY" or not gated:
        return Trailers(found.outcome, found.reason, found.why, gated)
    return Trailers("READY-NO-VERIFY", None, found.why or LOOSE, gated)


def _core(lines: list[str], tree: str) -> Trailers:
    """The read paragraph's factory trailers: READY, BLOCKED, or None with why it is malformed."""
    found: dict[str, list[str]] = {}
    for line in lines:
        match = TRAILER.match(line)
        if match and match.group(1).lower().startswith("factory-"):
            found.setdefault(match.group(1).lower(), []).append(match.group(2))
    if not found:
        return Trailers(None)
    if any(len(values) > 1 for values in found.values()):
        return Trailers(None, None, "a factory trailer is repeated")
    if set(found) - KEYS:
        return Trailers(None, None, "an unknown factory trailer")
    if "factory-state" not in found:
        return Trailers(None, None, "factory trailers without Factory-State")
    state = found["factory-state"][0]
    verify = found.get("factory-verify", [None])[0]
    reason = found.get("factory-reason", [None])[0]
    verify_ok = verify is None or VERIFY.fullmatch(verify) is not None
    if state == "READY":
        if reason is not None:
            return Trailers(None, None, "READY carries a Factory-Reason")
        if verify is None:
            return Trailers(None, None, "no Factory-Verify")
        if not verify_ok:
            return Trailers(None, None, "Factory-Verify is malformed")
        if verify[:40] != tree:
            return Trailers(None, None, "the Factory-Verify tree is not the head's tree")
        return Trailers("READY")
    if state == "BLOCKED":
        if reason is None or REASON.fullmatch(reason) is None or not verify_ok:
            return Trailers(None, None, "BLOCKED without a one-line Factory-Reason")
        return Trailers("BLOCKED", reason)
    return Trailers(None, None, "Factory-State is not READY or BLOCKED")
