"""S14-C1 (d): the owner's checklist for the cloud environment, `docs/runbooks/cloud-env.md`.

The ticket (session-14 brief, row 18): "Sonnet 5.5 high + an owner checklist". The orchestrator's pin:
a checklist doc for the owner naming each step, which the docs-path lint accepts. The steps are the
ones the cloud environment holds (setup.sh's header; docs/research/sdlc-waves-and-cloud.md 1.1): the
setup script pasted into the environment's "Setup script" box, the network list covering every host
the cloud scripts fetch from, the environment variables (`DATABASE_URL`, `DATABASE_OWNER_URL`; no
password value written down), the five-minute budget to check, and the browser rule (walks with
chrome-devtools are local-only). The docs-path lint's own rules (`tools/lint/docs_paths.py`: every
repo path named exists, every `python -m` module and subcommand exists, no refused `gh` form) are
applied to the checklist wherever its scan set stands.
"""

from __future__ import annotations

import re

from scripts.tests.acceptance.ts14c1._world import REPO
from tools.lint import docs_paths

CHECKLIST = "docs/runbooks/cloud-env.md"
ALWAYS_REACHABLE = {
    "github.com",
    "api.github.com",
    "codeload.github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
}


def text() -> str:
    path = REPO / CHECKLIST
    assert path.is_file(), f"{CHECKLIST} does not exist"
    return path.read_text(encoding="utf-8")


def test_the_checklist_is_a_list_of_steps() -> None:
    steps = re.findall(r"(?m)^\s{0,3}(?:[-*] \[[ xX]\]|\d{1,2}[.)])\s+\S", text())
    assert len(steps) >= 4, f"{len(steps)} steps"


def test_it_names_the_setup_script_to_paste_into_the_setup_script_box() -> None:
    body = text()
    assert "`scripts/cloud/setup.sh`" in body
    assert re.search(r"(?i)setup script", body)


def test_it_names_every_host_the_cloud_scripts_fetch_from() -> None:
    hosts: set[str] = set()
    for path in sorted((REPO / "scripts" / "cloud").rglob("*")):
        if path.is_file():
            found = re.findall(
                r"https?://([A-Za-z0-9.-]+\.[A-Za-z]{2,})", path.read_text(errors="replace")
            )
            hosts |= set(found)
    body = text()
    assert re.search(r"\bCustom\b", body), "the network level is not named"
    missing = sorted(h for h in hosts - ALWAYS_REACHABLE if h not in body)
    assert missing == [], f"the checklist's network list leaves out {missing}"


def test_it_names_the_database_variables_without_a_password() -> None:
    body = text()
    assert "DATABASE_URL" in body
    assert "DATABASE_OWNER_URL" in body
    written = [
        m.group(0)
        for m in re.finditer(r"postgres(?:ql)?://[^:/\s@`'\"]+:([^@\s`'\"]+)@", body)
        if not m.group(1).startswith(("<", "$", "{", "*", "…", "..."))
    ]
    assert written == [], f"a password is written in the checklist: {written}"


def test_it_says_how_to_check_the_five_minute_budget() -> None:
    assert re.search(r"(?i)\b(300\s*s|five minutes|5 minutes|5 min)\b", text())


def test_it_says_browser_walks_are_local_only() -> None:
    body = text()
    assert "chrome-devtools" in body
    assert re.search(r"(?i)\blocal[- ]only\b", body)


def test_the_docs_path_lint_accepts_it() -> None:
    body = text()
    tree = docs_paths.Tree(REPO)
    found = []
    for number, token in docs_paths.inline_tokens(body):
        checked = docs_paths.candidate(token, tree)
        problem = checked and docs_paths.path_problem(checked, CHECKLIST, tree)
        if problem:
            found.append(f"{CHECKLIST}:{number}: {problem}")
    usage = docs_paths.Usage(REPO)
    found += [f"{CHECKLIST}:{n}: {p}" for n, p in docs_paths.module_problems(body, tree, usage)]
    for n, unit in docs_paths.code_units(body):
        problem = docs_paths.gh_problem(unit)
        if problem:
            found.append(f"{CHECKLIST}:{n}: {problem}")
    assert found == [], "\n".join(found)
