"""S15-R3b (issue #521, wanted item 1): "Raise review.py's recall. Options: a third lens for docs,
prompts and contract-versus-code; both lenses at high". The misses were "findings in docs and prompts
(session-13-prompt.md, commands.md, leakscan-cli.md)" and "contract-versus-code findings (launch.py,
lens_pytest.py)".

Pinned here (the orchestrator's ticket, session 15):

- A third lens, labelled `docs` in the object `review run` prints (`lenses[].label`, beside `lens-a`,
  `lens-b` and `words`), runs on a model tier whenever the PR changes a docs, prompt or contract path:
  a `.md` file under `docs/`, anything under `.claude/`, anything under `docs/specs/factory/contracts/`;
  or whenever a contract doc (`docs/specs/factory/contracts/`) names, by its path or by its module, a
  code file the PR changes. A PR changing only code no contract names gets no docs lens.
- The docs lens runs on Opus 5.5 at effort high (the depth lens's model: the misses were reasoning
  across a doc and the code it describes); on the normal tier lens A runs on Opus 5.5 high and lens B on
  Sonnet 5.5 high (CLAUDE.md "Effort and models": "the `pr-reviewer` depth lens" Opus 5.5 `high`, "at
  `high` the adversary lens").
- A docs-only PR still gets no model (ADR 0043, decision 2).

The lenses are the world's fake `claude` (no model is called).
"""

from collections.abc import Iterator

import pytest

from scripts.tests.acceptance.ts15r3b._world import (
    BASE_FILES,
    NORMAL,
    World,
    fresh,
    labels,
    lens_models,
    model_effort,
    why,
)

OPUS = ("claude-opus-5-5", "high")
SONNET = ("claude-sonnet-5-5", "high")


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


def changed(path: str) -> dict[str, str]:
    """The base's file at `path` with one line added (a new file when the base has none)."""
    return {path: BASE_FILES.get(path, "") + "One line more.\n"}


def reviewed(world: World, changes: dict[str, str]) -> list[str]:
    """The labels of the lenses a review of a PR making `changes` started."""
    world.pr(12, changes)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    return labels(done)


@pytest.mark.parametrize(
    "path",
    [
        "docs/specs/factory.md",
        "docs/handoff/session-13-prompt.md",
        ".claude/agents/helper.md",
        ".claude/skills/orchestrate-wave/commands.md",
        "docs/specs/factory/contracts/gadget.md",
        "docs/specs/factory/contracts/status.schema.json",
    ],
    ids=["spec", "session-prompt", "agent-prompt", "command-card", "contract-doc", "contract-schema"],
)
def test_a_pr_changing_a_doc_prompt_or_contract_gets_the_docs_lens(world: World, path: str) -> None:
    found = reviewed(world, changed(path))
    assert "docs" in found, f"no docs lens for a change to {path}: the lenses were {found}"


@pytest.mark.parametrize(
    "path",
    ["scripts/factory/gadget.py", "scripts/factory/thing.py"],
    ids=["named-by-path", "named-by-module"],
)
def test_a_pr_changing_code_a_contract_names_gets_the_docs_lens(world: World, path: str) -> None:
    found = reviewed(world, changed(path))
    assert "docs" in found, f"no docs lens for {path}, which a contract names: the lenses were {found}"


@pytest.mark.parametrize(
    "path",
    ["scripts/factory/thingamajig.py", "vextrus/rates/table.py"],
    ids=["a-longer-name-than-a-named-module", "code-no-doc-names"],
)
def test_a_pr_changing_only_code_no_contract_names_gets_no_docs_lens(world: World, path: str) -> None:
    found = reviewed(world, changed(path))
    assert found == ["lens-a", "lens-b"], f"the lenses for a change to {path}: {found}"


def test_the_docs_lens_runs_on_opus_5_5_high_beside_both_code_lenses_at_high(world: World) -> None:
    world.pr(12, NORMAL | changed("docs/specs/factory.md"))
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    models = lens_models(done)
    assert models.get("docs") == OPUS[0], f"no docs lens on Opus 5.5: {models}"
    assert models.get("lens-a") == OPUS[0], models
    assert models.get("lens-b") == SONNET[0], models
    calls = sorted(model_effort(call) for call in world.lens_calls())
    assert calls == sorted([OPUS, OPUS, SONNET]), f"no docs lens on Opus 5.5 high: {calls}"


def test_a_docs_only_pr_still_gets_no_model(world: World) -> None:
    world.pr(12, changed("docs/notes/howto.md"))
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.claude_calls() == [], "a docs-only PR started a model"
