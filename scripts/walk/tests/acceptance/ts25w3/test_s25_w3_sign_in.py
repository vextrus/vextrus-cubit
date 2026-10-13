"""Ticket S25-W3's acceptance tests, the sign-in half: the agent layer's sign-in data names every
seeded role the finish-line items need, not only the QS.

G1 walk A (a492e91a) left M0-FL1, M0-FL10 and M0-FL11 NOT_WALKED: g1.sign-in held only the QS, while
M0-FL1 needs a Vextrus staff sign-in, M0-FL10 the MD, the Vextrus Engineer and a Guest, and M0-FL11 a
user of a second Developer (docs/specs/factory.md 5, the items' table). Every seeded person shares the
run's one password (vextrus/seed/platform.py), so the file names each email and the password once or
more; its shape is the builder's. The emails are the seed's (vextrus/seed/platform.py), written out
here because importing the seed needs Django. The password is planted, never a real one.
"""

import json
import stat
from pathlib import Path
from typing import Any

from scripts.walk import run

PLANTED = "synthetic-planted-password-s25w3"

# The seed's people, by the role a finish-line item needs (vextrus/seed/platform.py).
SEEDED = {
    "the QS": "nusrat@shapla-homes.example",
    "the MD": "kamal@shapla-homes.example",
    "the Vextrus Engineer (Vextrus staff)": "arif@vextrus.example",
    "the Guest": "farhana@padma-builders.example",
    "a second Developer's QS (Meghna)": "tanvir@meghna.example",
    "a second Developer's QS (Chameli)": "sharmin@chameli-homes.example",
}


def _strings(value: Any) -> set[str]:
    """Every string value in the parsed file, at any depth."""
    if isinstance(value, str):
        return {value}
    if isinstance(value, dict):
        return set().union(*(_strings(item) for item in value.values())) if value else set()
    if isinstance(value, list):
        return set().union(*(_strings(item) for item in value)) if value else set()
    return set()


def _written(tmp_path: Path) -> tuple[Path, set[str]]:
    path = tmp_path / ".private" / "work" / "factory" / "g1.sign-in"
    run.write_sign_in(path, PLANTED)
    run.write_sign_in(path, PLANTED)  # a stale one is replaced
    return path, _strings(json.loads(path.read_text(encoding="utf-8")))


def test_the_sign_in_data_names_every_seeded_role(tmp_path: Path) -> None:
    _, strings = _written(tmp_path)
    missing = [role for role, email in SEEDED.items() if email not in strings]
    assert not missing, f"scripts/walk/run.py write_sign_in names no sign-in for: {', '.join(missing)}"


def test_the_sign_in_with_every_role_keeps_the_password_owner_only_and_outside_the_walk(
    tmp_path: Path,
) -> None:
    path, strings = _written(tmp_path)
    assert SEEDED["the MD"] in strings, "scripts/walk/run.py write_sign_in names no MD"
    assert PLANTED in strings, "scripts/walk/run.py write_sign_in dropped the run's password"
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert "walks" not in path.parts
