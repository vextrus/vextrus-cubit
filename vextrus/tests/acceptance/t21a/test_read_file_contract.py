"""21a's fixed words and its no-migration promise (docs/plans/M0.md, 21a; the session-06 rulings, 21a).

- "Not read in full" is `takeoff.read_file.not_read_in_full` with params `{limit}`: 21a defines the
  code (and words it in `web/src/messages/takeoff/read_file/en.po`); the finder's budget report
  (`FileBudget.report()`, the file's `sheet_report`) fills it in 21b's step if it exists only there.
- 21a adds no drawings migration.
"""

from pathlib import Path

from vextrus.api import message_codes

ROOT = Path(__file__).resolve().parents[4]
NOT_READ_IN_FULL = "takeoff.read_file.not_read_in_full"


def test_not_read_in_full_is_a_takeoff_code_with_its_limit() -> None:
    found = {held.code: held for held in message_codes()}

    assert NOT_READ_IN_FULL in found
    assert found[NOT_READ_IN_FULL].params == ("limit",)


def test_not_read_in_full_is_worded_with_its_limit() -> None:
    po = ROOT / "web" / "src" / "messages" / "takeoff" / "read_file" / "en.po"

    assert po.is_file(), f"{po} is missing"
    entries = po.read_text(encoding="utf-8").split("\n\n")
    [entry] = [e for e in entries if f'msgid "{NOT_READ_IN_FULL}"' in e]
    msgstr = entry.split("msgstr", 1)[1]
    # The words select on the limit (each limit its own sentence), never print its key.
    assert "{limit, select," in msgstr


def test_21a_adds_no_drawings_migration() -> None:
    migrations = ROOT / "vextrus" / "drawings" / "migrations"

    # 21a added no drawings migration. Later tickets may add their own (#159's General Discipline
    # kind, session 08's ruling), never one for the read job.
    names = sorted(p.name for p in migrations.glob("*.py"))
    assert "0001_initial.py" in names
    assert not [n for n in names if "read" in n], names
