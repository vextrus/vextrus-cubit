"""S30-W1 acceptance, the database side: a walk's Jev answers leave its database and seed the next one.

The owner's ruling (15 Oct 2026): "Re-run #2; #3 reuses its Jev answers". The contract:
1. "Before run.py drops `vextrus_walk_<sha8>` (step 7), it writes the walk's `platform_jevanswer` rows
   to `.private/work/walks/<sha40>/jev-answers.json`. Columns: cache_key, node, model_version, options,
   choice, confidence (a decimal string), probabilities. No id, no tenant_id, no created_at; nothing
   else; no facts."
2. "`--jev-from <sha40>`: after `seed_demo` and before the web stack serves ... insert those rows into
   the fresh database under the walk's tenant(s): every tenant the walk's Projects use."
4. "A walk ... with `--jev-from` and a stand-in Jev that answers differently on each call keeps the
   seeded answers: no live call for a seeded key."

run.py reaches the walk's database only through the walked checkout's python (as it runs
`seed_demo`), so the seam is a module of the walk's own, `scripts/walk/jev_answers.py`, run as
`python -m scripts.walk.jev_answers export|seed <file>` with that checkout's python and Django
settings; here its `main(argv)` is called in-process and answers 0. It lives outside every product
path (`vextrus/`, `engine/`, `web/src/`, scripts/walk/ready.py's `is_product_path`): a seam landed
between walk #2 and walk #3 on a product path would make #3 walk other product code, no longer a
repeat (the orchestrator, S30). The module's name is the orchestrator's. The walk's Projects are
made by the seed's QS (`nusrat@shapla-homes.example`, web/e2e/real/walk.spec.ts) in her Developer,
Shapla Homes Ltd; the test makes that Developer and that QS, so a seed finding the tenant by either
lands.

The tests commit (`transaction=True`): the seam may write or read through either alias.

Synthetic rows only: the facts are `INVENTED_SHEETS` (vextrus/testing/jev.py), never drawing text.
"""

import importlib
import json
import uuid
from collections.abc import Callable, Mapping
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
import pytest
from django.core.management import get_commands

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import JevAnswer
from vextrus.platform.services import jev, tenancy
from vextrus.testing.jev import INVENTED_SHEETS, STAND_IN_KINDS, STAND_IN_QUESTION, Offline
from vextrus.testing.tenancy import add_member

jev_answers: Any = importlib.import_module("scripts.walk.jev_answers")  # the seam

QS_EMAIL = "nusrat@shapla-homes.example"
DEVELOPER = "Shapla Homes Ltd"
COLUMNS = {
    "cache_key",
    "node",
    "model_version",
    "options",
    "choice",
    "confidence",
    "probabilities",
}
"""Contract 1's columns, and nothing else."""


def _facts(sheet: Mapping[str, Any]) -> dict[str, Any]:
    return {key: sheet[key] for key in ("title", "discipline", "view_titles")}


def _row(sheet: Mapping[str, Any], choice: str, confidence: str) -> dict[str, Any]:
    """A JevAnswer's exported columns for an invented sheet, keyed as `ask` keys it."""
    prepared = jev.prepare("sheet_type", _facts(sheet), STAND_IN_QUESTION, STAND_IN_KINDS)
    assert isinstance(prepared, jev.Request)
    options = list(prepared.options)
    rest = (Decimal(1) - Decimal(confidence)) / (len(options) - 1)
    probabilities = {
        option: (confidence if option == choice else format(rest.quantize(Decimal("0.0001")), "f"))
        for option in options
    }
    return {
        "cache_key": prepared.cache_key,
        "node": "sheet_type",
        "model_version": jev.SHEET_TYPE.model,
        "options": options,
        "choice": choice,
        "confidence": confidence,
        "probabilities": probabilities,
    }


def _rows_in(text: str) -> list[dict[str, Any]]:
    """Every object in the exported file that carries a cache_key (the file's outer shape is the
    builder's: a list, or the list under a key)."""
    found: list[dict[str, Any]] = []

    def visit(value: object) -> None:
        if isinstance(value, dict):
            if "cache_key" in value:
                found.append(value)
                return
            for inner in value.values():
                visit(inner)
        elif isinstance(value, list):
            for inner in value:
                visit(inner)

    visit(json.loads(text))
    return found


def _walk_tenant(make_developer: Callable[..., uuid.UUID]) -> tuple[uuid.UUID, Any]:
    """The walk's tenant as seed_demo makes it: Shapla Homes Ltd, with the seed's QS a member."""
    developer = make_developer(DEVELOPER)
    user, _membership = add_member(developer, role="qs", email=QS_EMAIL)
    return developer, user


def _keep(developer: uuid.UUID, row: dict[str, Any]) -> None:
    with tenancy.acting_in(developer):
        JevAnswer.objects.create(
            tenant_id=developer,
            cache_key=row["cache_key"],
            node=row["node"],
            model_version=row["model_version"],
            options=row["options"],
            choice=row["choice"],
            confidence=Decimal(row["confidence"]),
            probabilities=row["probabilities"],
        )


@pytest.mark.django_db(transaction=True, databases=["default", OWNER_ALIAS])
def test_the_export_holds_each_answer_in_the_seven_columns_and_nothing_else(
    make_developer: Callable[..., uuid.UUID], tmp_path: Path
) -> None:
    first, _ = _walk_tenant(make_developer)
    second = make_developer("Meghna Properties Ltd")
    rows = [
        _row(INVENTED_SHEETS[0], "beam_layout", "0.9312"),
        _row(INVENTED_SHEETS[1], "floor_plan", "0.5000"),
    ]
    _keep(first, rows[0])
    _keep(second, rows[1])
    target = tmp_path / "jev-answers.json"

    assert jev_answers.main(["export", str(target)]) == 0

    text = target.read_text(encoding="utf-8")
    exported = _rows_in(text)
    assert sorted(r["cache_key"] for r in exported) == sorted(r["cache_key"] for r in rows)
    for row in exported:
        assert set(row) == COLUMNS
        wanted = next(r for r in rows if r["cache_key"] == row["cache_key"])
        assert isinstance(row["confidence"], str), "confidence is a decimal string"
        assert Decimal(row["confidence"]) == Decimal(wanted["confidence"])
        assert row["options"] == wanted["options"]
        assert row["choice"] == wanted["choice"]
        assert row["model_version"] == wanted["model_version"]
        assert {k: Decimal(v) for k, v in row["probabilities"].items()} == {
            k: Decimal(v) for k, v in wanted["probabilities"].items()
        }
    for leaked in ("tenant_id", "created_at", str(first), str(second)):
        assert leaked not in text
    assert '"id"' not in text
    assert INVENTED_SHEETS[0]["title"] not in text, "no facts leave the walk's database"


@pytest.mark.django_db(transaction=True, databases=["default", OWNER_ALIAS])
def test_a_seeded_answer_is_kept_and_jev_is_not_called_for_its_key(
    make_developer: Callable[..., uuid.UUID], jev_offline: Offline, tmp_path: Path
) -> None:
    developer, user = _walk_tenant(make_developer)
    sheet = INVENTED_SHEETS[1]
    seeded = _row(sheet, "other", "0.6100")
    source = tmp_path / "jev-answers.json"
    source.write_text(json.dumps([seeded]), encoding="utf-8")
    calls: list[int] = []

    def changeable(request: httpx.Request) -> httpx.Response:
        """A stand-in Jev that answers a different kind on each call (never the seeded one)."""
        calls.append(1)
        choice = ("floor_plan", "elevation")[len(calls) % 2]
        probabilities = {key: (1.0 if key == choice else 0.0) for key in STAND_IN_KINDS}
        answer = {"type": "choice", "choice": choice, "confidence": 1.0}
        answer["probabilities"] = probabilities
        body = {"model": jev.SHEET_TYPE.model, "answers": {"sheet_type": answer}}
        return httpx.Response(200, json=body)

    jev_offline.use(httpx.MockTransport(changeable))

    assert jev_answers.main(["seed", str(source)]) == 0

    with tenancy.acting_in(developer, user_id=user.pk):
        first = jev.ask("sheet_type", _facts(sheet), STAND_IN_QUESTION, STAND_IN_KINDS)
        again = jev.ask("sheet_type", _facts(sheet), STAND_IN_QUESTION, STAND_IN_KINDS)
    assert isinstance(first, jev.Answer)
    assert isinstance(again, jev.Answer)
    assert (first.choice, first.confidence) == ("other", Decimal("0.6100"))
    assert (again.choice, again.confidence) == ("other", Decimal("0.6100"))
    assert calls == [], "no live call for a seeded key"


@pytest.mark.django_db(transaction=True, databases=["default", OWNER_ALIAS])
def test_the_seed_puts_every_row_under_the_walks_tenant(
    make_developer: Callable[..., uuid.UUID], tmp_path: Path
) -> None:
    developer, _user = _walk_tenant(make_developer)
    rows = [
        _row(INVENTED_SHEETS[0], "beam_layout", "0.9312"),
        _row(INVENTED_SHEETS[2], "schedule", "0.8000"),
        _row(INVENTED_SHEETS[3], "general_notes", "0.7777"),
    ]
    source = tmp_path / "jev-answers.json"
    source.write_text(json.dumps(rows), encoding="utf-8")

    assert jev_answers.main(["seed", str(source)]) == 0

    kept = {
        row.cache_key: row for row in JevAnswer.objects.using(OWNER_ALIAS).filter(tenant_id=developer)
    }
    assert set(kept) == {r["cache_key"] for r in rows}
    for wanted in rows:
        row = kept[wanted["cache_key"]]
        assert row.node == wanted["node"]
        assert row.model_version == wanted["model_version"]
        assert row.options == wanted["options"]
        assert row.choice == wanted["choice"]
        assert row.confidence == Decimal(wanted["confidence"])
        assert row.probabilities == wanted["probabilities"]


def test_the_seam_adds_no_product_path() -> None:
    """The seam is the walk's own code, so landing it leaves the walked product code as it was."""
    from scripts.walk.ready import is_product_path

    checkout = Path(__file__).resolve().parents[4]
    seam = Path(jev_answers.__file__).resolve().relative_to(checkout).as_posix()
    assert seam == "scripts/walk/jev_answers.py"
    assert not is_product_path(seam)
    assert "jev_answers" not in get_commands(), "no management command under vextrus/ for it"
