"""Walk issues, drafted only from `sanitize.py`'s allowlisted fields (docs/specs/factory.md 3.8).

"a triage agent drafts issues only from `sanitize.py`'s allowlisted fields (finish-line item, defect
class, screen, numeric delta; no free-text field) and dedupes on (class, screen) against open `walk`
issues, commenting the new sha on an existing one; ... the leak scan runs on every draft". Check:
findings counted = issues drafted + dedup comments (+ findings merged into another of the same run);
a free-text field in a draft is refused.

    drafts = draft(findings, open_issues, sha=sha40, scan=leakscan_text)

A title is `walk: <defect_class> on <screen>`; a body holds only `Item`, `Severity`, `Delta`,
`Walk: <sha40>` and the marker `<!-- walk-key: <class>/<screen> -->`. Every refusal raises `Refused`
with fixed words (never an input value). The scan is injected and fails closed: a hit, an error, or a
leak scan that cannot run refuses every draft.

The command line (run by `/real-set-walk`'s triage agent; paths under `.private/work/walks/<sha40>/`):

    python -m scripts.walk.issues draft <sha40> [--walks-dir D]
        reads triage.json ({"items", "findings"}: allowlisted keys only) and open-issues.json (`gh issue
        list --label walk --state open --json number,body`), writes public/issue-drafts.json and one
        body file per draft (public/new-<n>.md, public/comment-<n>.md), and the private drafts.json
        (which findings each draft carries). Exit 0, or 2 refused.
    python -m scripts.walk.issues record <sha40> [--walks-dir D] --created <n>=<issue number> ...
        writes findings.json (the agent layer's record for verdict.py): each finding with the issue
        drafted for it or the open issue it commented on. Exit 0, or 2 refused.
"""

import json
import re
import subprocess
import sys
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from scripts.walk.cli import QuietParser
from scripts.walk.sanitize import ALLOWED_KEYS, ITEMS, sanitize_finding
from scripts.walk.verdict import ISSUE_LIMIT

SHA = re.compile(r"[0-9a-f]{40}")
STATUSES = ("PASS", "FAIL", "NOT_WALKED")
MARKER = re.compile(r"<!-- walk-key: ([a-z][a-z0-9_]{0,39})/([a-z][a-z0-9_.-]{0,59}) -->")
SUMMARY = re.compile(r"^leakscan: hits=([0-9]+) scanned=[0-9]+ corpus=[0-9a-f]{12}$", re.M)
ROOT = Path(__file__).resolve().parents[2]

type Scan = Callable[[str], int]


class Refused(Exception):
    """A draft refused; the message is fixed words, never an input value."""


@dataclass
class Drafts:
    new: list[dict[str, Any]] = field(default_factory=list)
    """Each `{"key", "title", "body", "findings": [finding ids]}`: an issue to open."""
    comments: list[dict[str, Any]] = field(default_factory=list)
    """Each `{"key", "number", "body", "findings": [finding ids]}`: a comment on an open issue."""
    merged: int = 0
    """Findings folded into another of the same run (same class and screen)."""


def key_of(body: str) -> str | None:
    """The `<class>/<screen>` key a walk issue's body carries in its marker, or None."""
    if not isinstance(body, str):
        return None
    found = MARKER.search(body)
    return f"{found[1]}/{found[2]}" if found else None


def _marker(key: str) -> str:
    return f"<!-- walk-key: {key} -->"


def _delta(findings: list[dict[str, Any]]) -> str:
    """The first numeric delta (a number, from sanitize), or "none"."""
    for finding in findings:
        if finding["delta"] is not None:
            return json.dumps(finding["delta"])
    return "none"


def _body(sha: str, key: str, findings: list[dict[str, Any]]) -> str:
    """Only closed values: item codes, a severity word, a number, the sha and the marker."""
    items = [item for item in ITEMS if any(f["item"] == item for f in findings)]
    severity = "BLOCKS" if any(f["severity"] == "BLOCKS" for f in findings) else "OTHER"
    if any(f["misleading"] for f in findings):
        severity += ", misleading"
    return "\n".join(
        [
            f"- Item: {', '.join(items)}",
            f"- Severity: {severity}",
            f"- Delta: {_delta(findings)}",
            f"- Walk: {sha}",
            "",
            _marker(key),
            "",
        ]
    )


def _clean(findings: Iterable[object]) -> list[dict[str, Any]]:
    out = []
    for raw in findings:
        if not isinstance(raw, Mapping):
            raise Refused("a finding is not an object")
        if not set(raw) <= ALLOWED_KEYS:
            raise Refused("a finding carries a field outside the allowlist")
        finding = sanitize_finding(raw)
        if finding is None:
            raise Refused("a finding holds a value outside its closed set")
        out.append(finding)
    return out


def _open_keys(open_issues: Iterable[object]) -> dict[str, int]:
    keys: dict[str, int] = {}
    for row in open_issues:
        if not isinstance(row, Mapping):
            raise Refused("an open issue is not an object")
        number, key = row.get("number"), row.get("key")
        if isinstance(number, bool) or not isinstance(number, int) or not 1 <= number < ISSUE_LIMIT:
            raise Refused("an open issue has no number")
        if key is None:
            continue
        if not isinstance(key, str) or key_of(_marker(key)) != key:
            raise Refused("an open issue's key is not a walk key")
        keys[key] = min(number, keys.get(key, number))
    return keys


def _scanned(scan: Scan, text: str) -> None:
    try:
        hits = scan(text)
    except Exception as error:
        raise Refused("the leak scan could not run") from error
    if isinstance(hits, bool) or not isinstance(hits, int):
        raise Refused("the leak scan did not give a count")
    if hits != 0:
        raise Refused("the leak scan hit a draft")


def draft(findings: Iterable[object], open_issues: Iterable[object], *, sha: str, scan: Scan) -> Drafts:
    """The run's issue drafts and dedup comments; every one leak-scanned, or nothing at all."""
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        raise Refused("the sha is not 40 hex")
    clean = _clean(findings)
    ids = [f["id"] for f in clean]
    if len(set(ids)) != len(ids):
        raise Refused("two findings share an id")
    existing = _open_keys(open_issues)
    groups: dict[str, list[dict[str, Any]]] = {}
    for finding in clean:
        groups.setdefault(f"{finding['defect_class']}/{finding['screen']}", []).append(finding)
    drafts = Drafts()
    for key, group in groups.items():
        drafts.merged += len(group) - 1
        body = _body(sha, key, group)
        members = [f["id"] for f in group]
        if key in existing:
            drafts.comments.append(
                {"key": key, "number": existing[key], "body": body, "findings": members}
            )
        else:
            defect_class, screen = key.split("/", 1)
            title = f"walk: {defect_class} on {screen}"
            drafts.new.append({"key": key, "title": title, "body": body, "findings": members})
    for new in drafts.new:
        _scanned(scan, f"{new['title']}\n{new['body']}")
    for comment in drafts.comments:
        _scanned(scan, comment["body"])
    return drafts


def leakscan_text(text: str, *, root: Path = ROOT) -> int:
    """f2's leak scan over `text` (leakscan-cli.md: `text --stdin --no-stamp`): its hit count.

    Raises when it cannot scan (exit 2, 64, no summary line, or `tools.leakscan` missing), so a
    caller's `draft` refuses: fail closed.
    """
    done = subprocess.run(
        [sys.executable, "-m", "tools.leakscan", "text", "--stdin", "--no-stamp", "--quiet"],
        cwd=root,
        input=text,
        capture_output=True,
        text=True,
        check=False,
        timeout=300,
    )
    found = SUMMARY.search(done.stdout)
    if done.returncode not in (0, 1) or found is None:
        raise RuntimeError("the leak scan could not scan")
    hits = int(found[1])
    if (done.returncode == 0) != (hits == 0):
        raise RuntimeError("the leak scan's exit and count disagree")
    return hits


# The command line ---------------------------------------------------------------------------------


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(path)


def _triage(folder: Path) -> dict[str, Any]:
    layer = _load(folder / "triage.json")
    if not isinstance(layer, dict) or set(layer) != {"items", "findings"}:
        raise Refused("triage.json is not {items, findings}")
    if not isinstance(layer["findings"], list) or not isinstance(layer["items"], list):
        raise Refused("triage.json's items or findings are not lists")
    items = []
    for entry in layer["items"]:
        if not isinstance(entry, dict) or set(entry) != {"item", "status"}:
            raise Refused("an item is not {item, status}")
        item = next((code for code in ITEMS if code == entry["item"]), None)
        status = next((word for word in STATUSES if word == entry["status"]), None)
        if item is None or status is None:
            raise Refused("an item or its status is outside its closed set")
        items.append({"item": item, "status": status})  # the allowlist's own words, rebuilt
    return {"items": items, "findings": layer["findings"]}


def _command_draft(folder: Path, sha: str) -> int:
    scan: Scan = leakscan_text  # looked up at call time, so a test can stand a stub in
    layer = _triage(folder)
    rows = _load(folder / "open-issues.json")
    if not isinstance(rows, list):
        raise Refused("open-issues.json is not a list")
    open_issues = []
    for row in rows:
        if not isinstance(row, dict):
            raise Refused("an open issue is not an object")
        open_issues.append({"number": row.get("number"), "key": key_of(str(row.get("body", "")))})
    drafts = draft(layer["findings"], open_issues, sha=sha, scan=scan)
    public = folder / "public"
    # Private: which findings each draft carries (finding ids stay in the walk's folder).
    record: dict[str, Any] = {"sha": sha, "new": [], "comments": [], "merged": drafts.merged}
    # Public: titles, keys, issue numbers and body files only.
    shown: dict[str, Any] = {"sha": sha, "new": [], "comments": [], "merged": drafts.merged}
    for n, new in enumerate(drafts.new, start=1):
        _write(public / f"new-{n}.md", new["body"])
        record["new"].append({"n": n, "findings": new["findings"]})
        shown["new"].append(
            {"n": n, "key": new["key"], "title": new["title"], "body_file": f"new-{n}.md"}
        )
    for n, comment in enumerate(drafts.comments, start=1):
        _write(public / f"comment-{n}.md", comment["body"])
        record["comments"].append({"n": n, "number": comment["number"], "findings": comment["findings"]})
        shown["comments"].append(
            {"n": n, "key": comment["key"], "number": comment["number"], "body_file": f"comment-{n}.md"}
        )
    _write(folder / "drafts.json", json.dumps(record, indent=2, sort_keys=True) + "\n")
    _write(public / "issue-drafts.json", json.dumps(shown, indent=2, sort_keys=True) + "\n")
    print(f"issues: {len(drafts.new)} new, {len(drafts.comments)} comments, {drafts.merged} merged")
    return 0


def _command_record(folder: Path, sha: str, created: list[str]) -> int:
    layer = _triage(folder)
    record = _load(folder / "drafts.json")
    if not isinstance(record, dict) or record.get("sha") != sha:
        raise Refused("drafts.json is not this sha's")
    numbers: dict[int, int] = {}
    for pair in created:
        n, _, number = pair.partition("=")
        if not (n.isdigit() and number.isdigit()) or not 1 <= int(number) < ISSUE_LIMIT:
            raise Refused("--created takes <n>=<issue number>")
        numbers[int(n)] = int(number)
    issue_of: dict[str, tuple[int | None, int | None]] = {}
    for new in record["new"]:
        if new["n"] not in numbers:
            raise Refused("a drafted issue has no number yet")
        for finding_id in new["findings"]:
            issue_of[finding_id] = (numbers[new["n"]], None)
    for comment in record["comments"]:
        for finding_id in comment["findings"]:
            issue_of[finding_id] = (None, int(comment["number"]))
    findings = []
    for finding in _clean(layer["findings"]):
        if finding["id"] not in issue_of:
            raise Refused("a finding is neither drafted nor commented")
        issue, comment_on = issue_of[finding["id"]]
        findings.append({**finding, "issue": issue, "dedup_comment_on": comment_on})
    out = {"items": layer["items"], "findings": findings}
    _write(folder / "findings.json", json.dumps(out, indent=2, sort_keys=True) + "\n")
    print(f"issues: findings.json holds {len(findings)} finding(s)")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = QuietParser(prog="python -m scripts.walk.issues")
    parser.add_argument("command", choices=("draft", "record"))
    parser.add_argument("sha")
    parser.add_argument("--walks-dir", type=Path, default=Path(".private/work/walks"))
    parser.add_argument("--created", action="append", default=[])
    try:
        args = parser.parse_args(argv)
    except SystemExit:
        return 2
    try:
        if not SHA.fullmatch(args.sha):
            raise Refused("the sha is not 40 hex")
        folder = args.walks_dir / args.sha
        if args.command == "draft":
            return _command_draft(folder, args.sha)
        return _command_record(folder, args.sha, args.created)
    except (Refused, OSError, ValueError, KeyError, TypeError, RecursionError) as error:
        reason = str(error) if isinstance(error, Refused) else type(error).__name__
        print(f"issues: refused ({reason})", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
