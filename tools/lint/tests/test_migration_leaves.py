"""One leaf per module: two tickets' migrations never fork one module's chain unnoticed."""

from django.db.migrations.graph import MigrationGraph

from tools.lint.migration_leaves import leaf_problems, main


def graph(*edges: tuple[tuple[str, str], tuple[str, str] | None]) -> MigrationGraph:
    made = MigrationGraph()
    for node, _parent in edges:
        made.add_node(node, None)
    for node, parent in edges:
        if parent:
            made.add_dependency(None, node, parent)
    return made


def test_a_chain_has_one_leaf() -> None:
    chain = graph(
        (("platform", "0001_initial"), None),
        (("platform", "0002_market"), ("platform", "0001_initial")),
    )

    assert leaf_problems(chain, ["platform", "projects"]) == []


def test_two_migrations_on_one_parent_are_two_leaves() -> None:
    forked = graph(
        (("platform", "0001_initial"), None),
        (("platform", "0002_market"), ("platform", "0001_initial")),
        (("platform", "0002_jobs"), ("platform", "0001_initial")),
    )

    assert leaf_problems(forked, ["platform"]) == [
        "platform has 2 leaf migrations: 0002_jobs, 0002_market"
    ]


def test_this_repository_has_one_leaf_per_module() -> None:
    assert main() == 0
