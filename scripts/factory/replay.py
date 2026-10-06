"""`python -m scripts.factory.replay --cases <dir> [--reviews <dir>]`: the replay gate of the review
cutover (factory-next.md section 8, row 11; issue #368). It measures how much of what earlier review
confirmed `scripts.factory.review` finds again, and exits non-zero below 90 %.

A case is a folder `<cases>/<name>/` holding `case.json`:
`{"pr": <int>, "head": "<40 hex>", "confirmed": [{"file": ..., "line": <int>, "summary": ...}, ...]}`:
a PR head and the findings confirmed on it. Its review result is the JSON object `review run` prints
(`{"pr", "head", "findings": [{"id", "score", "file", "line", "summary", "status", "method"}]}`), read
from `<cases>/<name>/review.json`, or from `<reviews>/<name>.json` when `--reviews` is given.

A confirmed finding is recalled when the review reports a finding of 50 or more, not one it REFUTED, in
the same file within `LINES` lines of it. One review finding may recall several confirmed ones (two
confirmed findings a few lines apart are one defect found). The recall is every confirmed finding of
every case counted together; the line `recall NN.N % (found of total confirmed findings, N cases)` is
printed, with each case's own count above it.

Refused (exit 2, nothing measured): no cases, no confirmed finding in any case, a case without its
`case.json` or review result, a case whose head is not 40 hex, a review whose head differs from the
case's (a review of another head says nothing about this one) and a result that is not the review's
shape. Exit 1: recall below `GATE`. Exit 0: at or above it. Standard library only.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

GATE = 90.0  # per cent of the confirmed findings the review must find again
LINES = 5  # a finding within this many lines of the confirmed one is the same finding
MIN_SCORE = 50  # review.py's own standing threshold


class Refused(Exception):
    """The replay cannot be measured: said in words, exit 2."""


def load(path: Path, what: str) -> Any:
    try:
        return json.loads(path.read_text())
    except OSError as error:
        raise Refused(f"{what} {path} cannot be read: {error.strerror or error}") from error
    except ValueError as error:
        raise Refused(f"{what} {path} is not JSON: {error}") from error


def is_hex40(value: object) -> bool:
    return isinstance(value, str) and len(value) == 40 and all(c in "0123456789abcdef" for c in value)


def confirmed_of(case: dict[str, Any], where: Path) -> list[dict[str, Any]]:
    found = case.get("confirmed")
    if not isinstance(found, list):
        raise Refused(f"{where}: 'confirmed' must be a list")
    for item in found:
        if not (
            isinstance(item, dict)
            and isinstance(item.get("file"), str)
            and isinstance(item.get("line"), int)
            and not isinstance(item.get("line"), bool)
        ):
            raise Refused(f"{where}: every confirmed finding needs a 'file' and an integer 'line'")
    return found


def standing_of(review: dict[str, Any], where: Path) -> list[dict[str, Any]]:
    """The findings the review stands behind: a score of `MIN_SCORE` or more, never REFUTED."""
    findings = review.get("findings")
    if not isinstance(findings, list):
        raise Refused(f"{where}: the review result has no 'findings' list")
    kept = []
    for item in findings:
        if not (isinstance(item, dict) and isinstance(item.get("file"), str)):
            raise Refused(f"{where}: a review finding needs a 'file'")
        line, score = item.get("line"), item.get("score")
        if not isinstance(line, int) or isinstance(line, bool) or not isinstance(score, int | float):
            raise Refused(f"{where}: a review finding needs an integer 'line' and a numeric 'score'")
        if score >= MIN_SCORE and item.get("status") != "REFUTED":
            kept.append(item)
    return kept


def recalled(confirmed: dict[str, Any], standing: list[dict[str, Any]]) -> bool:
    return any(
        item["file"] == confirmed["file"] and abs(item["line"] - confirmed["line"]) <= LINES
        for item in standing
    )


def measure(cases: Path, reviews: Path | None) -> tuple[int, int, list[str]]:
    """(recalled, total, one report line per case). Raises `Refused`."""
    if not cases.is_dir():
        raise Refused(f"--cases {cases} is not a folder")
    folders = sorted(path for path in cases.iterdir() if path.is_dir())
    if not folders:
        raise Refused(f"--cases {cases} holds no case folder")
    found = total = 0
    lines = []
    for folder in folders:
        case = load(folder / "case.json", "case")
        if not isinstance(case, dict) or not is_hex40(case.get("head")):
            raise Refused(f"{folder / 'case.json'}: needs an object with a 40-hex 'head'")
        confirmed = confirmed_of(case, folder / "case.json")
        path = (reviews / f"{folder.name}.json") if reviews else (folder / "review.json")
        review = load(path, "review result")
        if not isinstance(review, dict):
            raise Refused(f"{path}: the review result is not an object")
        if review.get("head") != case["head"]:
            raise Refused(
                f"{path}: reviewed head {str(review.get('head'))[:12]}, the case's is "
                f"{case['head'][:12]}: a review of another head says nothing about this one"
            )
        standing = standing_of(review, path)
        hits = sum(recalled(item, standing) for item in confirmed)
        found, total = found + hits, total + len(confirmed)
        lines.append(f"{folder.name} (PR {case.get('pr')}): {hits} of {len(confirmed)} recalled")
    if total == 0:
        raise Refused(f"--cases {cases} holds no confirmed finding: there is nothing to recall")
    return found, total, lines


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.replay", description=__doc__)
    parser.add_argument("--cases", type=Path, required=True, help="the folder of case folders")
    parser.add_argument("--reviews", type=Path, help="the folder of <case>.json review results")
    args = parser.parse_args(argv)
    try:
        found, total, lines = measure(args.cases, args.reviews)
    except Refused as why:
        print(f"replay refused: {why}", file=sys.stderr)
        return 2
    print("\n".join(lines))
    percent = 100.0 * found / total
    print(f"recall {percent:.1f} % ({found} of {total} confirmed findings, {len(lines)} cases)")
    if percent < GATE:
        print(f"replay failed: recall is below {GATE:.0f} %")
        return 1
    print(f"replay passed: recall is {GATE:.0f} % or more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
