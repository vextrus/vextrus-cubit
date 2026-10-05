"""f5 acceptance: tripwires on committed files (they read text; they cannot prove behaviour).

What each guards, from docs/specs/factory.md: 5 "G1" (the Playwright spec's own config, "Selectors use
roles and test ids, never a title", outputs under `.private/work/walks/<sha40>/`), 5 item 9 ("The real
walk never runs in GitHub Actions"), 3.8 (`real-set-walk.js`: no `Date.now()`, `Math.random()` or
no-argument `new Date()`, every stage names `model: 'opus'`), 3.3 (`ux-critic`, `qs-critic` pins),
3.4 (`product-review`: Rebar Basis, per-page `emulate` only), 3.9 (`e2e.yml`: `push: main` and nightly).
"""

import json
import re
import subprocess
from pathlib import Path
from typing import Any

from _f5_contract import ROOT  # type: ignore[import-not-found, unused-ignore]

REAL = ROOT / "web" / "e2e" / "real"
WORKFLOW = ROOT / ".claude" / "workflows" / "real-set-walk.js"
UX_CRITIC = ROOT / ".claude" / "agents" / "ux-critic.md"
QS_CRITIC = ROOT / ".claude" / "agents" / "qs-critic.md"
PRODUCT_REVIEW = ROOT / ".claude" / "skills" / "product-review" / "SKILL.md"
E2E = ROOT / ".github" / "workflows" / "e2e.yml"


def _set_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """The schema of one set under walk.json's `sets` (inline, by pattern, or through `$defs`)."""
    sets = schema["properties"]["sets"]
    inner = sets.get("additionalProperties")
    if not isinstance(inner, dict):
        patterns = list(sets.get("patternProperties", {}).values())
        assert len(patterns) == 1, "walk.schema.json names one schema for a set"
        inner = patterns[0]
    if "$ref" in inner:
        inner = schema["$defs"][inner["$ref"].removeprefix("#/$defs/")]
    assert isinstance(inner, dict)
    return inner


def test_the_real_walk_has_its_own_config_spec_and_schemas() -> None:
    for name in ("playwright.config.ts", "walk.spec.ts", "walk.schema.json", "expect.schema.json"):
        assert (REAL / name).is_file(), name
    walk_schema = json.loads((REAL / "walk.schema.json").read_text())
    json.loads((REAL / "expect.schema.json").read_text())
    assert walk_schema["additionalProperties"] is False
    assert _set_schema(walk_schema)["additionalProperties"] is False

    config = (REAL / "playwright.config.ts").read_text()
    assert "outputDir" in config
    assert "process.env.WALK_OUT" in config
    assert "baseURL" in config
    assert "process.env.WALK_URL" in config
    for name in ("playwright.config.ts", "walk.spec.ts"):
        text = (REAL / name).read_text()
        assert "5410" not in text, name
        assert ".private/" not in text, name


def test_the_real_walk_selects_by_role_and_test_id_never_by_text() -> None:
    sources = sorted(REAL.glob("*.ts"))
    assert sources, "web/e2e/real has its TypeScript"
    for source in sources:
        text = source.read_text()
        for selector in ("getByText(", ":has-text(", "text=", "getByTitle("):
            assert selector not in text, f"{source.name} uses {selector}"


def _calls(text: str, name: str) -> list[str]:
    """Each `name(...)` call's text, by bracket count (strings are not parsed: a tripwire)."""
    found = []
    for match in re.finditer(rf"\b{re.escape(name)}\(", text):
        depth, at = 0, match.end() - 1
        for at in range(match.end() - 1, len(text)):
            depth += {"(": 1, ")": -1}.get(text[at], 0)
            if depth == 0:
                break
        found.append(text[match.start() : at + 1])
    return found


def test_the_walk_workflow_is_deterministic_and_runs_every_stage_on_opus() -> None:
    assert WORKFLOW.is_file()
    checked = subprocess.run(
        ["node", "--check", str(WORKFLOW)], capture_output=True, text=True, check=False
    )
    assert checked.returncode == 0, checked.stderr
    text = WORKFLOW.read_text()
    assert "Date.now(" not in text
    assert "Math.random(" not in text
    assert not re.search(r"new\s+Date\s*\(\s*\)", text)
    assert WORKFLOW.stem == "real-set-walk"
    stages = _calls(text, "agent")
    assert stages, "the workflow runs its stages through agent(...)"
    for stage in stages:
        assert re.search(r"""model\s*:\s*['"]opus['"]""", stage), stage[:80]
    for word in ("walk.json", "sanitize", "ux-critic", "qs-critic"):
        assert word in text, word


def _frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text()
    assert text.startswith("---\n")
    head = text.split("---\n", 2)[1]
    return {
        key.strip(): value.strip()
        for key, _, value in (line.partition(":") for line in head.splitlines())
        if key.strip()
    }


def test_the_critics_and_the_review_skill_carry_the_g1_pins() -> None:
    for agent in (UX_CRITIC, QS_CRITIC):
        front = _frontmatter(agent)
        assert front.get("model") == "opus", agent.name
        assert front.get("effort") == "high", agent.name
        disallowed = {tool.strip() for tool in front.get("disallowedTools", "").strip("[]").split(",")}
        assert {"Edit", "Write", "NotebookEdit"} <= disallowed, agent.name

    ux = UX_CRITIC.read_text()
    assert "seeded demo project unless told otherwise" not in ux
    assert "session 0" not in ux.lower()

    qs = QS_CRITIC.read_text()
    assert "Rebar Basis" in qs
    assert "Rod Basis" not in qs
    assert "burden" in qs

    review = PRODUCT_REVIEW.read_text()
    assert "Rod Basis" not in review
    assert "resize_page" not in review
    assert "emulate" in review
    assert "walk.json" in review
    assert ".private/work/walks/" in review


def test_e2e_runs_on_main_and_nightly_and_never_the_real_walk() -> None:
    from tools.lint.workflows import triggers

    text = E2E.read_text()

    assert triggers(text) == {"push", "schedule", "workflow_dispatch"}
    on = text.split("\non:", 1)[1].split("\npermissions:", 1)[0]
    push = on.split("push:", 1)[1].split("schedule:", 1)[0].split("workflow_dispatch:", 1)[0]
    branches = re.search(r"branches:\s*(\[[^\]]*\]|(?:\s*-\s*\S+)+)", push)
    assert branches, "push names its branches"
    assert re.findall(r"[\w./*][\w./*-]*", branches.group(1)) == ["main"], "push is limited to main"
    assert "pull_request" not in text
    assert "web/e2e/real" not in text
