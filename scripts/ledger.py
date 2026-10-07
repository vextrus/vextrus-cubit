"""`python -m scripts.ledger <check|decide|to-file|record|fetch-verdict>`: the review ledger
(docs/specs/factory.md 2.2 "Review record"; `docs/specs/factory/contracts/ledger-record.schema.json`).

- `check <PR> --round n [--exception <kind> --reason "<text>"]` (kinds: security75, crash,
  false-statement, fix-regression): may review round n start? Rounds 1 and 2 may; round 3 only with
  an allowed exception; never a round at or below the highest already recorded for the PR (a round
  cannot be relabelled lower).
- `decide --from <file> --head <sha>`: the verdict, computed here and nowhere else, from the reviewers'
  and refuters' final lines, one per line: `VERDICT: PASS|FIX|BLOCK at <40-hex>` (one per reviewer lens)
  and `FINDING <id> <score 0-100> <CONFIRMED|REFUTED|UNPROVEN|-> [<file>]` (the refuter's verdict; `-`:
  none run; the file the reviewer named). The bar (the owner's ruling, 7 Oct 2026; ADR 0041 amended): a
  finding "could block" when it scores 75 or more, or 50 or more on a strict path (`[strict] paths` of
  `scripts/factory/review_tiers.toml`; no file, a climbing or absolute path, or an unreadable list is
  judged strict; review.py and `fetch-verdict` drop a file that is not in the head's tree). The worst
  VERDICT wins (BLOCK over FIX over PASS); a finding that could block and stands (CONFIRMED or
  UNPROVEN) raises PASS to FIX; one that could block with no refuter verdict is refused. Prints one
  JSON line `{"verdict", "counts", "decision_input_sha256"}`: counts and ids, never text.
- `to-file --from <file> --head <sha>`: the same input (refused as `decide` refuses it); prints one JSON
  line `{"to_file": [<id>, ...]}`, the standing findings of 50 to 74 off the strict paths, to be filed
  as issues rather than fixed.
- `record <PR> --round n --head <sha> --from <file> [--exception … --reason …]`: decides, leak-scans
  what it will post and write, posts one marker comment
  (`<!-- vextrus-review round=N head=<sha> verdict=V findings=k -->`), then writes
  `<ledger>/<PR>-<head>.json` atomically, once: a record is never overwritten. The record of truth is
  local: refused in a cloud session (`CLAUDE_CODE_REMOTE=true`).
- `fetch-verdict <PR> --launch <launch record> --round n` (a cloud review): fetches the review branch the
  launch record names and records its verdict file only if the branch's tip is one commit on the PR's
  head adding only that file, and the file's nonce, head and PR match the launch record and the PR's
  current head (`contracts/review-verdict.schema.json`). Then it deletes the review branch.

A Jev triage sidecar (`.private/work/factory/ledger-jev/`) is never read here.
Exit codes: 0 ok, 2 bad input or usage, 3 refused. Standard library only.
"""

import argparse
import contextlib
import fcntl
import functools
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import tomllib
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPOSITORY = "vextrus/vextrus-cubit"
SHA = re.compile(r"[0-9a-f]{40}")
NONCE = re.compile(r"[0-9a-f]{32}")
VERDICT = re.compile(r"VERDICT: (PASS|FIX|BLOCK) at (\S+)")
FINDING = re.compile(r"FINDING (\S+) (-?[0-9]{1,4}) (CONFIRMED|REFUTED|UNPROVEN|-)(?: (\S+))?")
EXCEPTIONS = ("security75", "crash", "false-statement", "fix-regression")
RANK = {"PASS": 0, "FIX": 1, "BLOCK": 2}
STANDS = {"CONFIRMED", "UNPROVEN"}
MAX_ROUND = 3
OK, BAD, REFUSED = 0, 2, 3
# The review bar (the owner's ruling, 7 Oct 2026, session 17).
BLOCK_AT = 75
BLOCK_AT_ON_STRICT_PATH = 50
TIERS_FILE = Path(__file__).with_name("factory") / "review_tiers.toml"
# A location a reviewer may append to a file (`:12`, `:12:3`, `:12-20`, `#L12`, `#L12-L20`).
LOCATION = re.compile(r"(?::[0-9]+(?:[-:][0-9]+)?|#L[0-9]+(?:-L?[0-9]+)?)$")
PLAIN_PATH = re.compile(r"[A-Za-z0-9_@+.-][A-Za-z0-9_@+./-]*")  # relative, no blank, no mark

Scan = Callable[[str], int]
Post = Callable[[int, str], int]
HeadOf = Callable[[int], str]
# One finding as the bar reads it: its score, its refuter word and its file (None: none named).
Judged = tuple[int, str, str | None]


class Refused(Exception):
    """A refusal (exit 3); its message names what, never scanned text."""


class BadInput(Exception):
    """Bad input or usage (exit 2)."""


@dataclass(frozen=True)
class Decision:
    verdict: str
    counts: dict[str, int]
    sha256: str
    # Not printed nor recorded: what the bar left over (findings that could block with no refuter
    # verdict, which `commit_record` refuses under a PASS; the ids to file as issues, in input order).
    unrefuted_blocking: int = 0
    to_file: tuple[str, ...] = ()

    def line(self) -> str:
        return json.dumps(
            {"verdict": self.verdict, "counts": self.counts, "decision_input_sha256": self.sha256}
        )


def glob_regex(pattern: str, *, ignore_case: bool = False) -> re.Pattern[str]:
    """A tier list's glob as a whole-path regex: `*` no `/`, `**/` any folders (or none), `**` all."""
    out, index = "", 0
    while index < len(pattern):
        if pattern.startswith("**/", index):
            out, index = out + "(?:.*/)?", index + 3
        elif pattern.startswith("**", index):
            out, index = out + ".*", index + 2
        elif pattern[index] == "*":
            out, index = out + "[^/]*", index + 1
        elif pattern[index] == "?":
            out, index = out + "[^/]", index + 1
        else:
            out, index = out + re.escape(pattern[index]), index + 1
    return re.compile(out, re.DOTALL | (re.IGNORECASE if ignore_case else 0))


def tier_globs(table: str) -> list[str] | None:
    """`[<table>] paths` of `review_tiers.toml`; None when it cannot be read or is empty."""
    try:
        paths = tomllib.loads(TIERS_FILE.read_text())[table]["paths"]
    except OSError, ValueError, KeyError, TypeError:
        return None
    if not isinstance(paths, list) or not paths or not all(isinstance(p, str) and p for p in paths):
        return None
    return paths


@functools.cache
def strict_paths() -> tuple[re.Pattern[str], ...] | None:
    """`[strict] paths` (case ignored), where `X/**` also matches the folder `X` itself (a reviewer
    naming the folder is on it); None when it cannot be read."""
    if (paths := tier_globs("strict")) is None:
        return None
    folders = [path.removesuffix("/**") for path in paths if path.endswith("/**")]
    return tuple(glob_regex(path, ignore_case=True) for path in [*paths, *folders])


@functools.cache
def lax_paths() -> tuple[re.Pattern[str], ...] | None:
    """`[lax] paths` (case ignored): the only places a 50-74 does not block; None when unreadable."""
    if (paths := tier_globs("lax")) is None:
        return None
    return tuple(glob_regex(path, ignore_case=True) for path in paths)


def named_file(file: Any) -> str | None:
    """The file as a FINDING line can carry it (one field, no blank): None when it cannot, which the
    bar then judges strict."""
    return file if isinstance(file, str) and re.fullmatch(r"\S+", file) else None


def on_tree(file: Any, tree: frozenset[str]) -> str | None:
    """The file as the bar reads it: kept only when it is exactly a file of the head's tree (a
    folder or a path shortened from its package root is not), else None, which is judged strict."""
    named = named_file(file)
    return named if named is not None and named in tree else None


def tree_files(commit: str) -> frozenset[str]:
    """Every file of `commit`'s tree in the cwd's checkout; empty when it cannot be read (every
    finding is then judged strict)."""
    done = subprocess.run(
        ["git", "ls-tree", "-r", "-z", "--name-only", commit], capture_output=True, check=False
    )
    if done.returncode != 0:
        return frozenset()
    return frozenset(name.decode(errors="replace") for name in done.stdout.split(b"\0") if name)


def on_strict_path(file: str | None) -> bool:
    """True when `file` is on a strict path. Strict is the default (ADR 0043 item 2): a file is lax
    only when it matches a `[lax]` glob (the whole path) and no `[strict]` glob (any trailing part of
    the path, `b/vextrus/rates/x.py`). Fail closed: no file, anything but a plain relative path once a
    location suffix (`:12`, `:12-20`, `#L12`) is dropped (absolute, a drive, a backslash, a blank,
    another mark), a `..` segment, or a list that cannot be read, is judged strict."""
    patterns, lax = strict_paths(), lax_paths()
    if not file or patterns is None or lax is None:
        return True
    path = LOCATION.sub("", file)
    if not PLAIN_PATH.fullmatch(path):
        return True
    parts = [part for part in path.split("/") if part not in ("", ".")]
    if not parts or ".." in parts:
        return True
    tails = ["/".join(parts[index:]) for index in range(len(parts))]
    if any(pattern.fullmatch(tail) for pattern in patterns for tail in tails):
        return True
    return not any(pattern.fullmatch(tails[0]) for pattern in lax)


def could_block(score: int, file: str | None) -> bool:
    """The bar: 75 or more anywhere, or 50 or more on a strict path."""
    return score >= BLOCK_AT or (score >= BLOCK_AT_ON_STRICT_PATH and on_strict_path(file))


def to_file(score: int, word: str, file: str | None) -> bool:
    """A finding that stands (or no refuter judged) at 50-74 off the strict paths: filed, not fixed."""
    return word != "REFUTED" and score >= BLOCK_AT_ON_STRICT_PATH and not could_block(score, file)


def decide(data: bytes, head: str) -> Decision:
    """The verdict from the reviewers' and refuters' final lines; BadInput if they are malformed."""
    try:
        text = data.decode()
    except UnicodeDecodeError as error:
        raise BadInput("the decision input is not UTF-8") from error
    verdicts: list[str] = []
    findings: dict[str, Judged] = {}
    for number, raw in enumerate(text.split("\n"), start=1):
        line = raw.removesuffix("\r")
        if not line.strip():
            continue
        if found := VERDICT.fullmatch(line):
            if found[2] != head:
                raise BadInput(f"line {number}: a VERDICT line for another head than {head}")
            verdicts.append(found[1])
        elif found := FINDING.fullmatch(line):
            name, score = found[1], int(found[2])
            if not 0 <= score <= 100:
                raise BadInput(f"line {number}: finding {name} scores outside 0-100")
            if name in findings:
                raise BadInput(f"line {number}: finding {name} is listed twice")
            findings[name] = (score, found[3], found[4])
        else:
            raise BadInput(f"line {number}: not a VERDICT or FINDING line")
    if not verdicts:
        raise BadInput("no VERDICT line: at least one reviewer's final line is needed")
    unrefuted = sorted(
        name
        for name, (score, word, file) in findings.items()
        if word == "-" and could_block(score, file)
    )
    if unrefuted:
        raise BadInput(
            f"findings that could block (75 or more, or 50 or more on a strict path) with no refuter "
            f"verdict: {', '.join(unrefuted)}: run a refuter on each first"
        )
    return judge(verdicts, findings, hashlib.sha256(data).hexdigest())


def judge(verdicts: Sequence[str], findings: dict[str, Judged], sha256: str) -> Decision:
    """The decision from the reviewers' verdicts and the findings by id, as the bar reads them."""
    judged = list(findings.values())
    return Decision(
        verdict(verdicts, judged),
        counts(len(verdicts), judged),
        sha256,
        sum(word == "-" and could_block(score, file) for score, word, file in judged),
        tuple(name for name, finding in findings.items() if to_file(*finding)),
    )


def verdict(verdicts: Sequence[str], findings: Sequence[Judged]) -> str:
    worst = max(verdicts, key=RANK.__getitem__)
    if worst == "PASS" and any(
        word in STANDS and could_block(score, file) for score, word, file in findings
    ):
        return "FIX"
    return worst


def counts(reviewers: int, findings: Sequence[Judged]) -> dict[str, int]:
    words = [word for _, word, _ in findings]
    return {
        "reviewers": reviewers,
        "findings": sum(word != "REFUTED" for word in words),
        "findings_ge_50": sum(score >= 50 for score, _, _ in findings),
        "confirmed": words.count("CONFIRMED"),
        "refuted": words.count("REFUTED"),
        "unproven": words.count("UNPROVEN"),
        "unrefuted_ge_50": sum(score >= 50 and word == "-" for score, word, _ in findings),
    }


def marker(round_: int, head: str, decision: Decision) -> str:
    return (
        f"<!-- vextrus-review round={round_} head={head} verdict={decision.verdict} "
        f"findings={decision.counts['findings']} -->"
    )


def recorded_rounds(ledger_dir: Path, pr: int) -> list[int]:
    """The rounds already recorded for the PR; Refused if a record cannot be read (fail closed)."""
    rounds: list[int] = []
    if not ledger_dir.exists():
        return rounds
    try:
        names = sorted(os.listdir(ledger_dir))
    except OSError as error:  # not a folder, or not listable: never "no rounds yet"
        raise Refused("the ledger folder cannot be listed") from error
    for name in names:
        path = ledger_dir / name
        if not name.endswith(".json") or not SHA.fullmatch(
            name.removesuffix(".json").removeprefix(f"{pr}-")
        ):
            continue
        try:
            rounds.append(int(json.loads(path.read_text())["round"]))
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise Refused(f"cannot read the ledger record {path.name}") from error
    return rounds


def check_round(ledger_dir: Path, pr: int, round_: int, exception: str | None) -> None:
    if not 1 <= round_ <= MAX_ROUND:
        raise Refused(f"round {round_}: the rounds are 1 and 2, and 3 only with an exception")
    if exception is not None and exception not in EXCEPTIONS:
        raise Refused(f"exception {exception!r} is not one of {', '.join(EXCEPTIONS)}")
    if round_ == MAX_ROUND and exception is None:
        raise Refused(
            "round 3 needs a recorded exception (--exception "
            "security75|crash|false-statement|fix-regression --reason ...): two fix rounds at most"
        )
    if round_ < MAX_ROUND and exception is not None:
        raise BadInput("an exception is for round 3 only")
    if (rounds := recorded_rounds(ledger_dir, pr)) and round_ <= max(rounds):
        raise Refused(
            f"round {round_} is not above round {max(rounds)}, already recorded for PR {pr}: a round "
            "is never relabelled"
        )


def check_exception(round_: int, exception: str | None, reason: str | None) -> dict[str, str] | None:
    if exception is None:
        if reason is not None:
            raise BadInput("--reason goes with --exception")
        return None
    if reason is None or not reason.strip() or not reason.isprintable() or len(reason) > 300:
        raise Refused("an exception needs --reason: one line of 1 to 300 characters")
    return {"kind": exception, "reason": reason}


def scan_or_refuse(scan: Scan, text: str) -> None:
    try:
        hits = scan(text)
    except Exception as error:
        raise Refused("leak scan unavailable: nothing posted or written") from error
    if hits != 0:
        raise Refused(f"leak scan: {hits} hit(s) in the text to post: nothing posted or written")


def write_once(path: Path, record: dict[str, Any]) -> None:
    """Write the record atomically; Refused if one exists for the PR and head (append-only)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=".record-", suffix=".tmp")
    try:
        with os.fdopen(handle, "w") as out:
            out.write(json.dumps(record, indent=2) + "\n")
            out.flush()
            os.fsync(out.fileno())
        os.link(temporary, path)  # fails if the record exists: never overwritten
    except FileExistsError as error:
        raise Refused(f"{path.name} is already recorded: a record is never overwritten") from error
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temporary)


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def refuse_in_the_cloud() -> None:
    if os.environ.get("CLAUDE_CODE_REMOTE", "").strip().lower() in ("true", "1", "yes"):
        raise Refused("the ledger is written only in the main checkout's local session, never the cloud")


def commit_record(
    *,
    pr: int,
    head: str,
    round_: int,
    decision: Decision,
    exception: dict[str, str] | None,
    source: str,
    scan: Scan,
    post: Post,
    ledger_dir: Path,
) -> None:
    """Scan, post the marker, then write the record: the steps every record takes, in this order."""
    refuse_in_the_cloud()
    path = ledger_dir / f"{pr}-{head}.json"
    if path.exists():
        raise Refused(f"{path.name} is already recorded: a record is never overwritten")
    if decision.verdict == "PASS" and decision.unrefuted_blocking:
        raise Refused(
            "a PASS with a finding that could block (75 or more, or 50 or more on a strict path) that "
            "no refuter has seen"
        )
    try:
        ledger_dir.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise Refused("the ledger folder cannot be made: nothing posted") from error
    body = marker(round_, head, decision)
    scan_or_refuse(scan, body if exception is None else f"{body}\n{exception['reason']}")
    try:
        comment_id = post(pr, body)
    except Exception as error:
        raise Refused("posting the marker comment failed: nothing written") from error
    if isinstance(comment_id, bool) or not isinstance(comment_id, int) or comment_id < 1:
        raise Refused("the marker comment's id was not read: nothing written")
    write_once(
        path,
        {
            "schema_version": 1,
            "pr": pr,
            "head": head,
            "round": round_,
            "verdict": decision.verdict,
            "counts": decision.counts,
            "decision_input_sha256": decision.sha256,
            "comment_id": comment_id,
            "exception": exception,
            "source": source,
            "recorded_at": utc_now(),
        },
    )
    with journal_path(ledger_dir).open("a") as journal:  # under the ledger lock, as every record
        journal.write(f"{path.name}\n")
    print(f"ledger: recorded PR {pr} round {round_}: {decision.verdict} ({path.name})")


def journal_path(ledger_dir: Path) -> Path:
    """Each record's name, appended as the ledger writes it (beside the ledger, never in it)."""
    return ledger_dir.with_name(ledger_dir.name + ".journal")


# The cloud review channel (tier 2).


def review_verdict_problems(value: Any, role_agent: str) -> list[str]:
    """Why a verdict file does not meet `contracts/review-verdict.schema.json` (empty: it does)."""
    keys = {"pr", "head_sha", "nonce", "agent", "verdict", "findings"}
    if not isinstance(value, dict):
        return ["not an object"]
    found = [f"key {key}" for key in sorted(set(value) ^ keys)]
    if found:
        return found
    if not _integer(value["pr"]) or value["pr"] < 1:
        found.append("pr")
    if not isinstance(value["head_sha"], str) or not SHA.fullmatch(value["head_sha"]):
        found.append("head_sha")
    if not isinstance(value["nonce"], str) or not NONCE.fullmatch(value["nonce"]):
        found.append("nonce")
    if value["agent"] != role_agent:
        found.append("agent")
    allowed = ("PASS", "FIX", "BLOCK") if role_agent == "pr-reviewer" else STANDS | {"REFUTED"}
    if value["verdict"] not in allowed:
        found.append("verdict")
    findings = value["findings"]
    if not isinstance(findings, list) or (role_agent == "refuter" and findings):
        return [*found, "findings"]
    for item in findings:
        if not _finding_ok(item):
            found.append("findings")
            break
    return found


def _integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _finding_ok(item: Any) -> bool:
    if not isinstance(item, dict) or set(item) != {"score", "file", "line", "summary"}:
        return False
    score, line = item["score"], item["line"]
    if not (_integer(score) and 0 <= score <= 100 and _integer(line) and line >= 0):
        return False
    return all(
        isinstance(item[key], str) and 1 <= len(item[key]) <= limit
        for key, limit in (("file", 300), ("summary", 600))
    )


def unique_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    keys = [key for key, _ in pairs]
    if len(keys) != len(set(keys)):
        raise ValueError("a key is repeated")
    return dict(pairs)


@contextlib.contextmanager
def ledger_lock(ledger_dir: Path) -> Iterator[None]:
    """One writer at a time: the round check, the post and the write happen under this lock (a sibling
    file, so the ledger folder holds records only)."""
    try:
        ledger_dir.parent.mkdir(parents=True, exist_ok=True)
        handle = open(ledger_dir.with_name(ledger_dir.name + ".lock"), "a")  # noqa: SIM115
    except OSError as error:
        raise Refused("the ledger lock cannot be taken") from error
    with handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield


def _git(*args: str) -> str:
    done = subprocess.run(["git", *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise Refused(f"git {args[0]} failed")
    return done.stdout


def fetch_verdict(
    pr: int,
    launch: Path,
    round_: int,
    *,
    scan: Scan,
    post: Post,
    ledger_dir: Path,
    head_of: HeadOf,
) -> None:
    try:
        launched = json.loads(launch.read_text())
        review, role = launched["review"], launched.get("role", "reviewer")
        head, nonce, branch = review["head_sha"], review["nonce"], review["branch"]
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise BadInput("the launch record has no review object") from error
    if not (
        review.get("pr") == pr
        and isinstance(head, str)
        and SHA.fullmatch(head)
        and isinstance(nonce, str)
        and NONCE.fullmatch(nonce)
        and branch == f"review/{pr}-{nonce[:8]}"
    ):
        raise Refused("the launch record's review object is not for this PR or is malformed")
    agent = "refuter" if role == "refuter" else "pr-reviewer"
    handed = ledger_dir.parent / "review" / "cloud"
    if agent == "pr-reviewer" and any(handed.glob(f"{pr}-{head}-r*.handoff.json")):
        command = ["uv", "run", "python", "-m", "scripts.factory.review", "collect", str(pr)]
        command += ["--round", str(round_), *handoff_flags(handed, pr, head, round_)]
        raise Refused(
            "this head's lenses were handed off together: record them all at once with "
            f"`{shlex.join(command)}`"
        )
    verdict_file, text, name = read_cloud_verdict(pr, head, nonce, branch, agent)
    if head_of(pr) != head:
        raise Refused("the PR's head moved during the review: review the new head")
    if agent == "refuter":
        print(
            f"ledger: refuter {name.rsplit('-', 1)[1].removesuffix('.json')}: {verdict_file['verdict']}"
        )
    else:
        tree = tree_files(head)
        findings: dict[str, Judged] = {
            f"f{number}": (item["score"], "-", on_tree(item["file"], tree))
            for number, item in enumerate(verdict_file["findings"], start=1)
        }
        decision = judge([verdict_file["verdict"]], findings, hashlib.sha256(text.encode()).hexdigest())
        commit_record(
            pr=pr,
            head=head,
            round_=round_,
            decision=decision,
            exception=None,
            source="fetch-verdict",
            scan=scan,
            post=post,
            ledger_dir=ledger_dir,
        )
    _git("push", "-q", "origin", "--delete", branch)


def handoff_flags(handed: Path, pr: int, head: str, round_: int) -> list[str]:
    """The round's own `--exception` and `--reason`, as the hand-off keeps them (none if unread)."""
    try:
        manifest = json.loads((handed / f"{pr}-{head}-r{round_}.handoff.json").read_text())
    except OSError, ValueError:
        return []
    flags: list[str] = []
    for key in ("exception", "reason"):
        if isinstance(manifest, dict) and isinstance(manifest.get(key), str):
            flags += [f"--{key}", manifest[key]]
    return flags


def read_cloud_verdict(
    pr: int, head: str, nonce: str, branch: str, agent: str
) -> tuple[dict[str, Any], str, str]:
    """The verdict file a cloud reviewer pushed on `branch`, checked (one commit on the head adding
    exactly that one file, its schema, its nonce, its PR and head): `(verdict, its text, its path)`.
    Nothing is recorded or deleted here."""
    _git("fetch", "-q", "origin", f"refs/heads/{branch}")
    tip = _git("rev-parse", "FETCH_HEAD").strip()
    parents = _git("rev-list", "--parents", "-n", "1", tip).split()[1:]
    if parents != [head]:
        raise Refused("the review branch's tip is not one commit on the PR head")
    raw = _git("diff-tree", "--no-commit-id", "--raw", "-r", tip).splitlines()
    # `:<old mode> <new mode> <old> <new> <status>\t<path>`: one regular file (mode 100644), added.
    changed = [[row.split("\t")[0].split()[-1], row.split("\t", 1)[-1]] for row in raw]
    if len(raw) != 1 or raw[0].split()[1] != "100644":
        raise Refused("the review branch's tip must add exactly the one verdict file, a regular file")
    expected = re.compile(
        re.escape(f".review/{pr}-{nonce[:8]}.json")
        if agent == "pr-reviewer"
        else re.escape(f".review/refute-{pr}-{nonce[:8]}-") + r"[1-9][0-9]*\.json"
    )
    if len(changed) != 1 or changed[0][0] != "A" or not expected.fullmatch(changed[0][1]):
        raise Refused("the review branch's tip must add exactly the one verdict file")
    try:
        verdict_file = json.loads(_git("show", f"{tip}:{changed[0][1]}"), object_pairs_hook=unique_keys)
    except ValueError as error:
        raise Refused("the verdict file is not JSON") from error
    if wrong := review_verdict_problems(verdict_file, agent):
        raise Refused(f"the verdict file fails its schema: {', '.join(wrong)}")
    if verdict_file["nonce"] != nonce:
        raise Refused("the verdict file's nonce is not the launch's")
    if verdict_file["pr"] != pr or verdict_file["head_sha"] != head:
        raise Refused("the verdict file is for another PR or head")
    return verdict_file, _git("show", f"{tip}:{changed[0][1]}"), changed[0][1]


# The real seams.


def leak_scan(text: str) -> int:
    """Hits of `python -m tools.leakscan text --stdin` (leakscan-cli.md); raises if unavailable."""
    done = subprocess.run(
        [sys.executable, "-m", "tools.leakscan", "text", "--stdin"],
        input=text,
        capture_output=True,
        text=True,
        check=False,
    )
    lines = done.stdout.strip().splitlines()
    found = re.fullmatch(r"leakscan: hits=([0-9]+) .*", lines[-1]) if lines else None
    if done.returncode not in (0, 1) or found is None:
        raise RuntimeError("leak scan unavailable")
    hits = int(found[1])
    if (done.returncode == 1) != (hits > 0):
        raise RuntimeError("leak scan unavailable")
    return hits


def post_comment(pr: int, body: str) -> int:
    """Post a PR comment with `gh` and return its id (from the printed `#issuecomment-<id>` URL)."""
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as out:
        out.write(body + "\n")
    try:
        done = subprocess.run(
            ["gh", "pr", "comment", str(pr), "--repo", REPOSITORY, "--body-file", out.name],
            capture_output=True,
            text=True,
            check=True,
        )
    finally:
        os.unlink(out.name)
    found = re.search(r"#issuecomment-([0-9]+)", done.stdout)
    if found is None:
        raise RuntimeError("gh printed no comment URL")
    return int(found[1])


def pr_head(pr: int) -> str:
    done = subprocess.run(
        ["gh", "pr", "view", str(pr), "--repo", REPOSITORY, "--json", "headRefOid", "-q", ".headRefOid"],
        capture_output=True,
        text=True,
        check=True,
    )
    return done.stdout.strip()


def default_ledger_dir() -> Path:
    """`.private/work/factory/ledger` in the main checkout (the parent of the git common dir)."""
    done = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(done.stdout.strip()).parent / ".private" / "work" / "factory" / "ledger"


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> Any:
        raise BadInput(message)


def parser() -> argparse.ArgumentParser:
    top = _Parser(prog="python -m scripts.ledger", add_help=False)
    commands = top.add_subparsers(dest="command", required=True, parser_class=_Parser)
    check = commands.add_parser("check", add_help=False)
    check.add_argument("pr", type=int)
    check.add_argument("--round", type=int, required=True)
    check.add_argument("--exception")
    check.add_argument("--reason")
    choose = commands.add_parser("decide", add_help=False)
    choose.add_argument("--from", dest="source", type=Path, required=True)
    choose.add_argument("--head", required=True)
    listing = commands.add_parser("to-file", add_help=False)
    listing.add_argument("--from", dest="source", type=Path, required=True)
    listing.add_argument("--head", required=True)
    record = commands.add_parser("record", add_help=False)
    record.add_argument("pr", type=int)
    record.add_argument("--round", type=int, required=True)
    record.add_argument("--head", required=True)
    record.add_argument("--from", dest="source", type=Path, required=True)
    record.add_argument("--exception")
    record.add_argument("--reason")
    fetch = commands.add_parser("fetch-verdict", add_help=False)
    fetch.add_argument("pr", type=int)
    fetch.add_argument("--launch", type=Path, required=True)
    fetch.add_argument("--round", type=int, required=True)
    return top


def run(args: argparse.Namespace, *, scan: Scan, post: Post, ledger_dir: Path, head_of: HeadOf) -> None:
    if getattr(args, "pr", 1) < 1:
        raise BadInput("the PR number is 1 or more")
    if args.command in ("decide", "to-file", "record") and not SHA.fullmatch(args.head):
        raise BadInput("--head is a full 40-hex sha")
    if args.command == "check":
        check_exception(args.round, args.exception, args.reason)
        check_round(ledger_dir, args.pr, args.round, args.exception)
        print(f"ledger: PR {args.pr} round {args.round} may start")
    elif args.command == "decide":
        print(decide(read(args.source), args.head).line())
    elif args.command == "to-file":
        print(json.dumps({"to_file": list(decide(read(args.source), args.head).to_file)}))
    elif args.command == "record":
        exception = check_exception(args.round, args.exception, args.reason)
        decision = decide(read(args.source), args.head)
        refuse_in_the_cloud()
        with ledger_lock(ledger_dir):
            check_round(ledger_dir, args.pr, args.round, args.exception)
            commit_record(
                pr=args.pr,
                head=args.head,
                round_=args.round,
                decision=decision,
                exception=exception,
                source="review-pr",
                scan=scan,
                post=post,
                ledger_dir=ledger_dir,
            )
    else:
        refuse_in_the_cloud()
        with ledger_lock(ledger_dir):
            check_round(ledger_dir, args.pr, args.round, None)
            fetch_verdict(
                args.pr,
                args.launch,
                args.round,
                scan=scan,
                post=post,
                ledger_dir=ledger_dir,
                head_of=head_of,
            )


def read(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError as error:
        raise BadInput(f"cannot read {path}") from error


def main(
    argv: list[str] | None = None,
    *,
    scan: Scan = leak_scan,
    post: Post = post_comment,
    ledger_dir: Path | None = None,
    head_of: HeadOf = pr_head,
) -> int:
    try:
        args = parser().parse_args(sys.argv[1:] if argv is None else argv)
        run(
            args,
            scan=scan,
            post=post,
            ledger_dir=default_ledger_dir() if ledger_dir is None else ledger_dir,
            head_of=head_of,
        )
    except BadInput as error:
        print(f"ledger: {error}", file=sys.stderr)
        return BAD
    except Refused as error:
        print(f"ledger: refused: {error}", file=sys.stderr)
        return REFUSED
    return OK


if __name__ == "__main__":
    sys.exit(main())
