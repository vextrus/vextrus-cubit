"""The database settings: two aliases by environment variable, one database per worktree."""

from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured

from vextrus.settings.db import databases, migrations_hash, worktree_database_name


def main_checkout(tmp_path: Path) -> Path:
    (tmp_path / ".git").mkdir()
    return tmp_path


def linked_worktree(tmp_path: Path, name: str) -> Path:
    checkout = tmp_path / name
    checkout.mkdir()
    (checkout / ".git").write_text("gitdir: /elsewhere/.git/worktrees/x\n")
    return checkout


def test_the_main_checkout_uses_the_database_vextrus(tmp_path: Path) -> None:
    assert worktree_database_name(main_checkout(tmp_path)) == "vextrus"


def test_a_linked_worktree_gets_its_own_database(tmp_path: Path) -> None:
    checkout = linked_worktree(tmp_path, "agent-A39be3a34a80086db")

    assert worktree_database_name(checkout) == "vextrus_agent_a39be3a34a80086db"


def test_a_long_worktree_name_is_cut_so_its_test_database_name_fits(tmp_path: Path) -> None:
    checkout = linked_worktree(tmp_path, "w" * 80)

    name = worktree_database_name(checkout)

    assert name.startswith("vextrus_w")
    assert len(name) <= 40  # + "_test_" + 10 hex characters stays within PostgreSQL's 63


def test_locally_both_aliases_default_to_127_0_0_1_with_no_password(tmp_path: Path) -> None:
    result = databases({}, main_checkout(tmp_path))

    assert {alias: (db["USER"], db["HOST"], db["PORT"], db["NAME"]) for alias, db in result.items()} == {
        "default": ("vextrus_app", "127.0.0.1", "5432", "vextrus"),
        "owner": ("vextrus", "127.0.0.1", "5432", "vextrus"),
    }
    assert result["default"]["PASSWORD"] == ""
    assert result["owner"]["PASSWORD"] == ""


def test_the_environment_names_each_aliases_role_host_and_password(tmp_path: Path) -> None:
    environ = {
        "DATABASE_URL": "postgresql://vextrus_app:app%40pw@db.internal:6543/vextrus_ci",
        "DATABASE_OWNER_URL": "postgresql://vextrus:owner-pw@db.internal:6543/vextrus_ci",
    }

    result = databases(environ, main_checkout(tmp_path))

    assert (result["default"]["USER"], result["default"]["PASSWORD"]) == ("vextrus_app", "app@pw")
    assert (result["owner"]["USER"], result["owner"]["PASSWORD"]) == ("vextrus", "owner-pw")
    assert result["default"]["HOST"] == "db.internal"
    assert result["default"]["PORT"] == "6543"
    assert result["default"]["NAME"] == result["owner"]["NAME"] == "vextrus_ci"


def test_vextrus_db_name_names_the_database_when_the_urls_do_not(tmp_path: Path) -> None:
    result = databases({"VEXTRUS_DB_NAME": "vextrus_demo"}, main_checkout(tmp_path))

    assert result["default"]["NAME"] == result["owner"]["NAME"] == "vextrus_demo"


def test_the_two_aliases_must_name_one_database(tmp_path: Path) -> None:
    environ = {
        "DATABASE_URL": "postgresql://vextrus_app@127.0.0.1:5432/one",
        "DATABASE_OWNER_URL": "postgresql://vextrus@127.0.0.1:5432/two",
    }

    with pytest.raises(ImproperlyConfigured, match="one database"):
        databases(environ, main_checkout(tmp_path))


def test_a_url_that_is_not_postgresql_is_refused(tmp_path: Path) -> None:
    with pytest.raises(ImproperlyConfigured, match="DATABASE_URL"):
        databases({"DATABASE_URL": "sqlite:///x.db"}, main_checkout(tmp_path))


def test_the_test_database_is_named_by_the_worktrees_database_and_the_migrations(tmp_path: Path) -> None:
    result = databases({}, main_checkout(tmp_path))
    test_name = result["default"]["TEST"]["NAME"]

    assert test_name.startswith("vextrus_test_")
    assert len(test_name) == len("vextrus_test_") + 10
    assert result["owner"]["TEST"]["NAME"] == test_name


def write_migration(checkout: Path, module: str, name: str, text: str) -> None:
    folder = checkout / "vextrus" / module / "migrations"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / name).write_text(text)


def test_the_migrations_hash_changes_when_a_migration_changes(tmp_path: Path) -> None:
    write_migration(tmp_path, "platform", "0001_initial.py", "operations = []\n")
    before = migrations_hash(tmp_path)

    write_migration(tmp_path, "platform", "0001_initial.py", "operations = [1]\n")

    assert migrations_hash(tmp_path) != before


def test_the_migrations_hash_changes_when_a_migration_is_added(tmp_path: Path) -> None:
    write_migration(tmp_path, "platform", "0001_initial.py", "operations = []\n")
    before = migrations_hash(tmp_path)

    write_migration(tmp_path, "projects", "0001_initial.py", "operations = []\n")

    assert migrations_hash(tmp_path) != before


def test_the_migrations_hash_ignores_everything_but_migrations(tmp_path: Path) -> None:
    write_migration(tmp_path, "platform", "0001_initial.py", "operations = []\n")
    before = migrations_hash(tmp_path)

    (tmp_path / "vextrus" / "platform" / "models.py").write_text("# changed\n")

    assert migrations_hash(tmp_path) == before


def name_for_tests(checkout: Path) -> str:
    name: str = databases({}, checkout)["default"]["TEST"]["NAME"]
    return name


def test_a_checkout_reached_through_a_symlink_keeps_its_test_database(tmp_path: Path) -> None:
    (tmp_path / "real").mkdir()
    checkout = main_checkout(tmp_path / "real")
    link = tmp_path / "link"
    link.symlink_to(checkout)

    assert name_for_tests(link) == name_for_tests(checkout)


def test_a_moved_checkout_gets_a_fresh_test_database(tmp_path: Path) -> None:
    (tmp_path / "before").mkdir()
    checkout = main_checkout(tmp_path / "before")
    before = name_for_tests(checkout)

    moved = checkout.rename(tmp_path / "after")

    assert name_for_tests(moved) != before
