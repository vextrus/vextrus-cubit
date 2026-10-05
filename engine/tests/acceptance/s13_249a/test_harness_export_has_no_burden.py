"""Ticket T-249 (PR A), A1 case 9, a guard that passes on main: the harness's export carries no
`burden` key. `engine.export.build` writes the block only when it is given one (the job's export,
`vextrus/takeoff/services/export.py`); the harness gives none, and its document still meets the
schema."""

import json
from pathlib import Path

from engine import harness
from engine.export import RunInfo, SetOutcome, StageReport, StageState, build
from scripts.real_drawings.schema import problems

ROOT = Path(__file__).resolve().parents[4]


def test_the_harness_export_has_no_burden_key_and_meets_the_schema() -> None:
    run = RunInfo(
        id="invented-harness-run",
        commit=None,
        code_hash=None,
        started_at="2026-10-05T00:00:00Z",
        seconds=0.5,
        stages={stage.name: (stage.target, stage.ticket, False) for stage in harness.STAGES},
    )
    outcome = SetOutcome(
        stages={name: StageReport(StageState.SKIPPED, error="not built") for name in harness.SET_STAGES}
    )

    document = build(run, [], outcome)

    assert "burden" not in document
    schema = json.loads((ROOT / "engine" / "export.schema.json").read_text())
    assert problems(document, schema) == []
