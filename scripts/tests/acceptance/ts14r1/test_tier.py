"""S14-R1: the tier, decided by code from the changed paths and lines (factory-next.md 2 and 8 row 4;
research/review.md 3 "Tiers"; the owner's ruling Q3, 5 Oct 2026: an allowlist-only PR, only 64-hex
lines added, gets code checks and no model):

- allowlist-only: no model, a verdict by code (PASS, recorded in the ledger);
- docs-only: no model, a verdict by code (PASS, recorded);
- small (a few lines, no trust boundary): one lens;
- normal: two lenses; a security-wall path (the guard) is never "small";
- `web/src/messages/**` changed: the `ux-critic` words lens joins.

A lens is a `claude` call (the fake logs each); which of lens A or B a small PR gets is not pinned (the
plan's table and research/review.md disagree)."""

import pytest

from scripts.tests.acceptance.ts14r1._world import BASE_FILES, SMALL, World, why

HASHES = [
    "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7",
    "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
]
ALLOWLIST = "tools/leakscan/allowlist.txt"
NORMAL = {"vextrus/rates/table.py": "".join(f"RATE_{i}: int = {i}\n" for i in range(600))}
WORDS = NORMAL | {"web/src/messages/rates.ts": "export const rates = { title: 'Rates' }\n"}
WALL = {".claude/hooks/guard.mjs": "// the guard\nconst refused = new Set()\nexport { refused }\n"}


def reviewers(world: World) -> list[str]:
    return [call["agent"] for call in world.lens_calls() if call["agent"] != "ux-critic"]


def test_an_allowlist_only_pr_gets_no_model_and_a_pass_by_code(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, {ALLOWLIST: BASE_FILES[ALLOWLIST] + "".join(f"{h}\n" for h in HASHES)})
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.claude_calls() == []
    record = world.record(12, head)
    assert record is not None, "no ledger record for the allowlist-only head"
    assert record["verdict"] == "PASS"


def test_an_allowlist_change_with_a_line_that_is_not_a_hash_gets_a_model(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, {ALLOWLIST: BASE_FILES[ALLOWLIST] + f"{HASHES[0]}\nnot a hash, a sentence\n"})
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.lens_calls(), "a non-hash line in the allowlist was passed without a lens"


def test_a_docs_only_pr_gets_no_model_and_a_pass_by_code(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, {"docs/notes/howto.md": "# How to\n\nRun the review from the main checkout.\n"})
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.claude_calls() == []
    record = world.record(12, head)
    assert record is not None, "no ledger record for the docs-only head"
    assert record["verdict"] == "PASS"


def test_a_small_pr_gets_one_lens(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, SMALL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert len(reviewers(world)) == 1, reviewers(world)
    assert not [call for call in world.lens_calls() if call["agent"] == "ux-critic"]


def test_a_normal_pr_gets_two_lenses(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, NORMAL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert len(reviewers(world)) == 2, reviewers(world)
    assert not [call for call in world.lens_calls() if call["agent"] == "ux-critic"]


def test_a_small_change_to_the_guard_is_not_small(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, WALL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert len(reviewers(world)) == 2, reviewers(world)


def test_a_change_to_the_messages_adds_the_ux_critic_words_lens(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, WORDS)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    words = [call for call in world.lens_calls() if call["agent"] == "ux-critic"]
    assert len(words) == 1, [call["agent"] for call in world.lens_calls()]
    assert len(reviewers(world)) == 2, reviewers(world)
