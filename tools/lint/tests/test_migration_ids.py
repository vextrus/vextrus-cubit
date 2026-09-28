"""The migration scan: no migration names `uuid7`; ids come from `ids.new_id` (docs/data-model.md §2)."""

from pathlib import Path

import pytest

from tools.lint.migration_ids import main, scan

REPO = Path(__file__).resolve().parents[3]


def write_migration(root: Path, module: str, text: str) -> None:
    folder = root / "vextrus" / module / "migrations"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "0002_rows.py").write_text(text)


@pytest.mark.parametrize(
    "line",
    [
        "        ('id', models.UUIDField(default=uuid.uuid7, primary_key=True)),",
        "from uuid import uuid7",
        "        ('id', models.UUIDField(db_default=UUID7(), primary_key=True)),",
        "import uuid_utils  # uuid7 from a backport",
    ],
)
def test_a_migration_naming_uuid7_is_found(tmp_path: Path, line: str) -> None:
    write_migration(tmp_path, "projects", f"import uuid\n{line}\n")

    assert [(f.path, f.line) for f in scan(tmp_path)] == [
        ("vextrus/projects/migrations/0002_rows.py", 2)
    ]


def test_a_migration_naming_new_id_passes(tmp_path: Path) -> None:
    write_migration(
        tmp_path,
        "projects",
        "import vextrus.platform.ids\n"
        "        ('id', models.UUIDField(default=vextrus.platform.ids.new_id, primary_key=True)),\n",
    )

    assert scan(tmp_path) == []


def test_uuid7_outside_a_migration_is_not_this_scan_s_business(tmp_path: Path) -> None:
    (tmp_path / "vextrus" / "platform").mkdir(parents=True)
    (tmp_path / "vextrus" / "platform" / "ids.py").write_text("return uuid.uuid7()\n")

    assert scan(tmp_path) == []


def test_the_command_fails_and_names_the_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write_migration(tmp_path, "drawings", "default=uuid.uuid7\n")

    assert main(["--root", str(tmp_path)]) == 1
    assert "vextrus/drawings/migrations/0002_rows.py:1:" in capsys.readouterr().out


def test_this_repository_s_migrations_pass() -> None:
    assert main(["--root", str(REPO)]) == 0
