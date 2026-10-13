"""S26-FX5: real-drawings-na.yml posts design-gate "not applicable" for a PR whose web changes are all
tests.

The authority: the session 26 brief (docs/handoff/session-26-prompt.md, "The factory fixes", FX0+FX5):
"`real-drawings-na.yml` posts design-gate "not applicable" when every `web/**` path a PR changes is a
test (`web/src/acceptance/**`, `web/e2e/**`, `*.test.*`) (Q-R2)"; the owner's ruling (docs/rulings.md,
13 Oct 2026): "the design gate is "not applicable" when every web/** path a PR changes is a test",
`design_gate.test_only_web = not-applicable`. A PR touching any non-test web file still needs the real
design gate, so nothing is posted for it. The workflow's own rule stands: "a renamed file counts under
both names".

The workflow runs as the runner runs it (`_runs.py`): main's sparse checkout only, `gh` stubbed, no
network. The description's words are the builder's; only the status and its state are pinned.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tools.lint.tests.acceptance.ts26fx0._runs import posted, real_drawings_na

NOT_POSTED = "real-drawings-na.yml posts no design-gate for a test-only web PR"


def design_gate(files: list[str], tmp_path: Path) -> list[str]:
    return [str(s.get("state")) for s in posted(real_drawings_na(files, tmp_path), "design-gate")]


@pytest.mark.parametrize(
    "files",
    [
        ["web/src/acceptance/t99/screen.test.tsx"],
        ["web/e2e/acceptance/t99/flow.spec.ts"],
        ["web/src/ui/Kbd.test.tsx"],
        ["web/src/review/deep/folder/rows.node.test.ts"],
        [
            "web/src/acceptance/t99/screen.test.tsx",
            "web/e2e/acceptance/t99/flow.spec.ts",
            "web/src/ui/Kbd.test.tsx",
            "docs/plans/M0.md",
        ],
    ],
    ids=["acceptance", "e2e", "test-beside-code", "node-test-deep", "all-three-and-docs"],
)
def test_a_test_only_web_pr_gets_design_gate_not_applicable(files: list[str], tmp_path: Path) -> None:
    assert design_gate(files, tmp_path) == ["success"], f"{NOT_POSTED}: {files}"


@pytest.mark.parametrize(
    "extra",
    [
        "web/src/ui/Kbd.tsx",
        "web/package.json",
        "web/src/test.tsx",
        "web/src/testing/helpers.ts",
        "web/src/acceptance-notes.tsx",
    ],
    ids=["component", "package-json", "test-tsx", "testing-folder", "acceptance-lookalike"],
)
def test_one_non_test_web_file_needs_the_real_design_gate(extra: str, tmp_path: Path) -> None:
    tests_only = ["web/src/acceptance/t99/screen.test.tsx", "web/src/ui/Kbd.test.tsx"]
    assert design_gate(tests_only, tmp_path / "tests") == ["success"], f"{NOT_POSTED}: {tests_only}"
    assert design_gate([*tests_only, extra], tmp_path / "mixed") == [], (
        f"design-gate posted for a PR changing the non-test web file {extra}"
    )


def test_a_web_file_renamed_into_a_test_name_needs_the_real_design_gate(tmp_path: Path) -> None:
    # The API lists the new name and the previous one; the previous one is not a test.
    assert design_gate(["web/src/ui/Kbd.test.tsx"], tmp_path / "tests") == ["success"], NOT_POSTED
    renamed = ["web/src/ui/Kbd.test.tsx", "web/src/ui/Kbd.tsx"]
    assert design_gate(renamed, tmp_path / "renamed") == []
