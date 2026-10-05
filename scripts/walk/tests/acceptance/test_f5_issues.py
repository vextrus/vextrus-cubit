"""f5 acceptance: `scripts/walk/issues.py`, the triage's drafts (docs/specs/factory.md 3.8).

"a triage agent drafts issues only from `sanitize.py`'s allowlisted fields (finish-line item, defect
class, screen, numeric delta; no free-text field) and dedupes on (class, screen) against open `walk`
issues, commenting the new sha on an existing one; ... the leak scan runs on every draft". Check:
"findings counted = issues drafted + dedup comments; a free-text field in a draft is refused".

The seam's shape for a draft (the ticket names `Drafts(new, comments, merged)`; decided here): each
of `new` is a mapping with `title` and `body`; each of `comments` a mapping with `number` (the open
issue) and `body`; `merged` is the count of findings folded into another of the same run.
"""

from typing import Any

import pytest
from _f5_contract import (  # type: ignore[import-not-found, unused-ignore]
    PLANTED_NOTE,
    PLANTED_TITLE,
    has_planted,
)

SHA = "0123456789abcdef0123456789abcdef01234567"
BODY_LINES = ("Item", "Severity", "Delta", "Walk:")


def _closed() -> tuple[list[str], list[str]]:
    from scripts.walk.sanitize import DEFECT_CLASSES, SCREENS

    classes, screens = sorted(DEFECT_CLASSES), sorted(SCREENS)
    assert len(classes) >= 3, "the fixture needs three defect classes"
    assert len(screens) >= 2, "the fixture needs two screens"
    return classes, screens


def _finding(n: int, defect_class: str, screen: str, **extra: Any) -> dict[str, Any]:
    return {
        "id": f"planted-zz-{n}",
        "item": "M0-FL5",
        "defect_class": defect_class,
        "screen": screen,
        "delta": 1.5,
        "severity": "OTHER",
        "misleading": False,
        **extra,
    }


def _clean(text: str) -> int:
    return 0


def test_findings_counted_equal_drafts_plus_comments_plus_merged() -> None:
    from scripts.walk.issues import draft

    (c1, c2, c3), (s1, s2) = _closed()[0][:3], _closed()[1][:2]
    findings = [
        _finding(1, c1, s1),
        _finding(2, c2, s1),
        _finding(3, c1, s2),
        _finding(4, c3, s1),
        _finding(5, c3, s2),
        _finding(6, c1, s1),
    ]
    open_issues = [{"number": 7, "key": f"{c3}/{s1}"}, {"number": 9, "key": f"{c3}/{s2}"}]

    drafts = draft(findings, open_issues, sha=SHA, scan=_clean)

    assert len(drafts.new) == 3
    assert len(drafts.comments) == 2
    assert drafts.merged == 1
    assert len(drafts.new) + len(drafts.comments) + drafts.merged == len(findings)
    assert sorted(comment["number"] for comment in drafts.comments) == [7, 9]
    assert all(SHA in comment["body"] for comment in drafts.comments)
    assert sorted(new["title"] for new in drafts.new) == sorted(
        [f"walk: {c1} on {s1}", f"walk: {c2} on {s1}", f"walk: {c1} on {s2}"]
    )


@pytest.mark.parametrize("field", ["title", "detail"])
def test_a_free_text_field_in_a_finding_is_refused(field: str) -> None:
    from scripts.walk.issues import Refused, draft

    classes, screens = _closed()
    finding = _finding(1, classes[0], screens[0], **{field: PLANTED_TITLE})

    with pytest.raises(Refused) as refused:
        draft([finding], [], sha=SHA, scan=_clean)
    assert has_planted(str(refused.value)) == []


def _hits_on_second_call() -> Any:
    calls = {"n": 0}

    def scan(text: str) -> int:
        calls["n"] += 1
        return 0 if calls["n"] == 1 else 1

    return scan


def _broken(text: str) -> int:
    raise RuntimeError("leak scan cannot run")


@pytest.mark.parametrize(
    "scan",
    [lambda text: 1, _hits_on_second_call(), _broken],
    ids=["every-draft-hits", "a-later-draft-hits", "the-scan-errors"],
)
def test_a_leak_scan_hit_or_error_refuses_every_draft(scan: Any) -> None:
    from scripts.walk.issues import Refused, draft

    classes, screens = _closed()
    findings = [_finding(1, classes[0], screens[0]), _finding(2, classes[1], screens[1])]

    with pytest.raises(Refused):
        draft(findings, [], sha=SHA, scan=scan)


def test_titles_and_bodies_hold_only_closed_values_and_the_marker() -> None:
    from scripts.walk.issues import draft, key_of

    classes, screens = _closed()
    finding = _finding(1, classes[0], screens[0], id="planted-zz-xyzzy")
    seen: list[str] = []

    def scan(text: str) -> int:
        seen.append(text)
        return 0

    drafts = draft([finding], [], sha=SHA, scan=scan)

    (new,) = drafts.new
    assert new["title"] == f"walk: {classes[0]} on {screens[0]}"
    body = new["body"]
    assert f"<!-- walk-key: {classes[0]}/{screens[0]} -->" in body
    assert key_of(body) == f"{classes[0]}/{screens[0]}"
    assert SHA in body
    assert "M0-FL5" in body
    assert "OTHER" in body
    assert "planted-zz" not in body + new["title"]
    assert has_planted(body + new["title"]) == []
    for line in body.splitlines():
        if line.strip() and not line.startswith("<!-- walk-key:"):
            assert line.lstrip("-*# ").startswith(BODY_LINES), line
    assert any(body in text or text in body for text in seen), "the body went through the leak scan"
    assert key_of("a body with no marker " + PLANTED_NOTE) is None


def test_dedupe_is_on_the_exact_class_and_screen() -> None:
    from scripts.walk.issues import draft

    classes, screens = _closed()
    findings = [_finding(1, classes[0], screens[0]), _finding(2, classes[0], screens[1])]
    open_issues = [{"number": 7, "key": f"{classes[0]}/{screens[0]}"}]

    drafts = draft(findings, open_issues, sha=SHA, scan=_clean)

    assert [comment["number"] for comment in drafts.comments] == [7]
    assert [new["title"] for new in drafts.new] == [f"walk: {classes[0]} on {screens[1]}"]
    assert drafts.merged == 0
