"""S14-D1 (factory-next.md section 8, row 17): "lessons.md entries each with its check"; its
acceptance check: "each new lesson names a committed check". CLAUDE.md: "Every serious finding leaves
a committed check (a test, lint or scan that fails on the class) ... `docs/knowledge/lessons.md`
points each lesson at its check".

The rule pinned, generically: every top-level `- ` bullet (with its indented continuation lines) under
the `## Session 14` heading of `docs/knowledge/lessons.md` carries `Check:` and a backticked path (as
`tools/lint/docs_paths.py` reads one: a trailing `:N` or `:N-M` stripped), and every such path is a file
git tracks that is not prose (not `.md`). A stated debt (`No check:` / `No check yet:`), which
`docs_paths.py` accepts for sessions 08 to 12, does not count here: each new lesson names its check.
"""

import re

from tools.lint.tests.acceptance.ts14d1._repo import read, tracked

LESSONS = "docs/knowledge/lessons.md"
SESSION_14 = re.compile(r"^## Session 14\b")
CHECK = re.compile(r"Check:\**\s*`([^`\n]+)`")
NO_CHECK = re.compile(r"No\s+check(\s+yet)?:", re.IGNORECASE)
LINE_SUFFIX = re.compile(r":\d+(-\d+)?$")


def session_14_lessons() -> list[tuple[int, str]]:
    """Each top-level bullet under `## Session 14`, as (1-based line, the bullet's text joined)."""
    found: list[tuple[int, list[str]]] = []
    inside = False
    current: list[str] | None = None
    for number, line in enumerate(read(LESSONS).splitlines(), start=1):
        if line.startswith("#"):
            inside = SESSION_14.match(line) is not None
            current = None
        elif inside and line.startswith("- "):
            current = [line]
            found.append((number, current))
        elif current is not None and (line.startswith((" ", "\t")) or not line.strip()):
            current.append(line)
        else:
            current = None  # a lead paragraph or prose: not a lesson
    return [(number, " ".join(" ".join(lines).split())) for number, lines in found]


def test_lessons_md_has_a_session_14_section_with_at_least_one_lesson() -> None:
    headings = [line for line in read(LESSONS).splitlines() if SESSION_14.match(line)]
    assert len(headings) == 1, f"{LESSONS}: {len(headings)} `## Session 14` headings"
    assert session_14_lessons(), f"{LESSONS}: `## Session 14` holds no `- ` lesson"


def test_each_session_14_lesson_names_a_check_and_no_stated_debt() -> None:
    lessons = session_14_lessons()
    assert lessons, "no session 14 lessons"
    problems = []
    for number, body in lessons:
        if NO_CHECK.search(body):
            problems.append(f"{LESSONS}:{number}: a stated debt, not a check")
        elif not CHECK.search(body):
            problems.append(f"{LESSONS}:{number}: no `Check:` and a backticked path")
    assert not problems, "\n".join(problems)


def test_each_session_14_lessons_check_is_a_committed_file_that_is_not_prose() -> None:
    files = tracked()
    lessons = session_14_lessons()
    assert lessons, "no session 14 lessons"
    problems = []
    named = 0
    for number, body in lessons:
        for match in CHECK.finditer(body):
            named += 1
            path = LINE_SUFFIX.sub("", match.group(1).strip())
            if path not in files:
                problems.append(f"{LESSONS}:{number}: `{path}` is not a committed file")
            elif path.endswith(".md"):
                problems.append(f"{LESSONS}:{number}: `{path}` is prose, not a test, lint or scan")
    assert named, "no session 14 lesson names a check path"
    assert not problems, "\n".join(problems)
