"""Ticket S22-LOCKHOLD's fixtures: an invented DWG of `sheets` sheets, each with `views` views drawn in
a grid (21c's hand-built frames and title blocks, 13's test drawing; no toolchain), its read job run
with 21c's readers, and a watch on the statements a file's `finishing` step runs while it holds Step
1's write lock (`step1.lock_writes`, the advisory lock `step1-write:<project>`).

Everything is invented: proving mechanics only, never a reading (docs/sdlc.md).
"""

import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

import pytest
from django.db import connection, transaction

from engine.geometry.placement import chain, chain_transform
from engine.read import ReadArtefact
from engine.recognise.tests.drawing import frame_block, value_at
from vextrus.drawings import services as drawings
from vextrus.takeoff import models
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import files, proposals
from vextrus.takeoff.tests.acceptance.t21c import step1_whole as whole

COLUMNS = 10
"""Views a row on the invented A1 sheet (mm): ten columns of 50 x 80 mm boxes, five rows at most."""


def _place(i: int) -> tuple[float, float, float, float]:
    row, col = divmod(i, COLUMNS)
    x0 = 40.0 + col * 60.0
    y0 = 54.0 + row * 104.0
    return (x0, y0, x0 + 50.0, y0 + 80.0)


def view_title(sheet: int, view: int) -> str:
    return f"SECTION {sheet + 1}-{view + 1}"


def sheet_number(sheet: int) -> str:
    return f"S-{sheet + 1:02d}"


def artefact(sha256: str, name: str, sheets: int, views: int) -> ReadArtefact:
    """`sheets` A1 frames at 1:50 side by side, each numbered `S-nn`, with `views` views (at most 50)
    drawn as grids, each titled under it."""
    assert views <= 5 * COLUMNS
    d = whole._Invented(name, sha256)
    block = frame_block(d, labels=whole.LABELS)
    s = whole.SCALE
    for n in range(sheets):
        ox = n * 100_000.0
        insert = d.insert(block, (ox, 0.0, 0.0), scale=(s, s, s))
        placed = chain_transform(chain(d.artefact(), [insert]))
        values = {0: f"FLOOR PLAN {n + 1}", 2: sheet_number(n), 3: "12.08.2026", 4: "R0"}
        for cell, text in values.items():
            x, y, _ = placed.apply(value_at(cell))
            d.text(text, (x, y, 0.0), height=5.0 * s)
        for v in range(views):
            x0, y0, x1, y1 = _place(v)
            whole._grid(d, (ox + x0 * s, y0 * s, ox + x1 * s, y1 * s))
            d.text(view_title(n, v), (ox + x0 * s, (y0 - 10) * s, 0.0), height=4.0 * s)
    return d.artefact()


def readers(drawn: dict[str, tuple[int, int]]) -> files.Readers:
    """21c's readers, a DWG named in `drawn` reading as (sheets, views a sheet) invented sheets."""
    base = whole.readers({})

    def first(path: Any, name: str) -> ReadArtefact:
        sheets, views = drawn[name]
        return artefact(whole._sha(path), name, sheets, views)

    return files.Readers(
        dwg=first, second=base.second, fonts=base.fonts, bangla_ansi=base.bangla_ansi, pdf=base.pdf
    )


# The statements run under Step 1's write lock ------------------------------------------------------


@dataclass
class UnderLock:
    """Each `finishing` step's statements from the moment it took Step 1's write lock to its end."""

    counts: list[int] = field(default_factory=list)
    _open: Any = None
    _ran: list[str] = field(default_factory=list)

    def _count(self, execute: Any, sql: str, params: Any, many: bool, context: Any) -> Any:
        self._ran.append(sql)
        return execute(sql, params, many, context)


@contextmanager
def statements_under_the_lock(monkeypatch: pytest.MonkeyPatch) -> Iterator[UnderLock]:
    """Count, per `finishing` step (21a's `proposals.propose`), the statements its connection ran
    (Django's `execute_wrapper`) after `step1.lock_writes` was called, up to the step's last
    statement (the step's transaction commits next)."""
    seen = UnderLock()
    real_lock = step1.lock_writes
    real_propose = proposals.propose

    def lock_writes(project_id: uuid.UUID) -> None:
        real_lock(project_id)
        if seen._open is None:
            seen._ran = []
            seen._open = connection.execute_wrapper(seen._count)
            seen._open.__enter__()

    def propose(*args: Any, **kwargs: Any) -> Any:
        try:
            return real_propose(*args, **kwargs)
        finally:
            if seen._open is not None:
                seen._open.__exit__(None, None, None)
                seen.counts.append(len(seen._ran))
                seen._open = None

    monkeypatch.setattr(step1, "lock_writes", lock_writes)
    monkeypatch.setattr(proposals, "propose", propose)
    yield seen
    monkeypatch.setattr(step1, "lock_writes", real_lock)
    monkeypatch.setattr(proposals, "propose", real_propose)


def read(qs: Any, monkeypatch: pytest.MonkeyPatch, name: str, sheets: int, views: int) -> uuid.UUID:
    """Upload an invented DWG and run its read job; the file's id (it ends READ)."""
    file_id = whole.uploaded(qs.member, qs.project_id, name)
    whole.run_job(qs.member, file_id, monkeypatch, readers({name: (sheets, views)}))
    with qs.member.acting():
        assert drawings.file(file_id).state == drawings.FileState.READ
    return file_id


def views_found(qs: Any, file_id: uuid.UUID) -> int:
    with qs.member.acting():
        view = drawings.file(file_id)
        listed = [s for s in drawings.sheets(view.set_id) if s.file_id == file_id]
        return sum(len(drawings.views(s.id)) for s in listed)


# What the step writes, as a QS-independent snapshot --------------------------------------------------


def written(qs: Any) -> dict[str, Any]:
    with qs.member.acting():
        return _written(qs.project_id)


def _written(project_id: uuid.UUID) -> dict[str, Any]:
    """Every Step 1 Proposal, ProposalTrace, Coverage and CoverageStep row of the Project, with ids
    kept (so an update in place is told from a delete and insert)."""
    proposals_ = sorted(
        (
            str(p.id),
            p.step,
            p.candidate_key,
            str(p.subject),
            str(p.subject_id),
            repr(sorted(p.values.items())),
            p.source,
            str(p.confidence),
            str(p.jev_answer_id),
            repr(p.jev_pick),
        )
        for p in models.Proposal.objects.filter(project_id=project_id)
    )
    traces = sorted(
        (str(t.id), str(t.proposal_id), t.fact, repr(sorted(t.anchor.items())))
        for t in models.ProposalTrace.objects.filter(project_id=project_id)
    )
    coverage = sorted(
        (
            str(c.id),
            str(c.view_id),
            str(c.sheet_revision_id),
            str(c.drawing_set_state_id),
            str(c.proposed_status),
            c.proposed_reason,
            str(c.status),
            c.reason,
            c.part_key,
        )
        for c in models.Coverage.objects.filter(project_id=project_id)
    )
    steps = sorted(
        (str(s.id), str(s.coverage_id), s.step, str(s.confirmation_id))
        for s in models.CoverageStep.objects.filter(project_id=project_id)
    )
    return {"proposals": proposals_, "traces": traces, "coverage": coverage, "coverage_steps": steps}


def expected_from_the_views(qs: Any, file_id: uuid.UUID) -> dict[str, Any]:
    """What the step promises for each view of the file, read off the drawings' views as the
    per-view writes on main write them (`step1.propose_view`, `step1.record_coverage`): one view
    Proposal keyed `view:<id>` with the view's values, its Traces (the view's anchors, or its place),
    one Coverage row and one CoverageStep per Takeoff Step. Ids left out."""
    proposals_: list[tuple[Any, ...]] = []
    traces: list[tuple[Any, ...]] = []
    coverage: list[tuple[Any, ...]] = []
    steps: list[tuple[Any, ...]] = []
    with qs.member.acting():
        view = drawings.file(file_id)
        listed = [s for s in drawings.sheets(view.set_id) if s.file_id == file_id]
        for sheet in listed:
            for seen in drawings.views(sheet.id):
                key = f"view:{seen.id}"
                values = {
                    "sheet_id": str(seen.sheet_revision_id),
                    "title": seen.title,
                    "kind": seen.kind,
                    "steps": list(seen.steps),
                    "part": seen.part,
                    "exclusion": seen.proposed_exclusion,
                }
                proposals_.append((key, str(seen.id), repr(sorted(values.items()))))
                for fact, anchor in proposals._view_traces(seen):
                    traces.append((key, fact[:64], repr(sorted(dict(anchor).items()))))
                if seen.proposed_exclusion:
                    status, reason = "excluded", seen.proposed_exclusion
                elif seen.steps or seen.part:
                    status, reason = "assigned", ""
                else:
                    status, reason = "unaccounted", ""
                coverage.append((str(seen.id), str(sheet.id), status, reason, seen.part or ""))
                for step in seen.steps:
                    steps.append((str(seen.id), step))
    return {
        "proposals": sorted(proposals_),
        "traces": sorted(set(traces)),
        "coverage": sorted(coverage),
        "coverage_steps": sorted(set(steps)),
    }


def written_for_the_views(qs: Any) -> dict[str, Any]:
    with qs.member.acting():
        return _written_for_the_views(qs.project_id)


def _written_for_the_views(project_id: uuid.UUID) -> dict[str, Any]:
    """`written`, the view rows only and without ids, in `expected_from_the_views`' shape."""
    rows = models.Proposal.objects.filter(project_id=project_id, candidate_key__startswith="view:")
    by_id = {p.id: p.candidate_key for p in rows}
    coverage = models.Coverage.objects.filter(project_id=project_id, drawing_set_state_id=None)
    view_of = {c.id: str(c.view_id) for c in coverage}
    return {
        "proposals": sorted(
            (p.candidate_key, str(p.subject_id), repr(sorted(p.values.items()))) for p in rows
        ),
        "traces": sorted(
            (by_id[t.proposal_id], t.fact, repr(sorted(t.anchor.items())))
            for t in models.ProposalTrace.objects.filter(project_id=project_id, proposal_id__in=by_id)
        ),
        "coverage": sorted(
            (
                str(c.view_id),
                str(c.sheet_revision_id),
                str(c.proposed_status),
                c.proposed_reason,
                c.part_key,
            )
            for c in coverage
        ),
        "coverage_steps": sorted(
            (view_of[s.coverage_id], s.step)
            for s in models.CoverageStep.objects.filter(project_id=project_id, coverage_id__in=view_of)
        ),
    }


def finishing_again(qs: Any, file_id: uuid.UUID, sheets: int, views: int) -> Callable[[], Any]:
    """The file's `finishing` step's write run again on the file as read (a retried step: the job
    run again after its rows were written), as the read job runs it: `proposals.propose` in a
    transaction of its own, the file's bytes reading as before, Jev's answers from its cache."""

    def again() -> Any:
        with qs.member.acting():
            view = drawings.file(file_id)
            with transaction.atomic():
                return proposals.propose(
                    file_id,
                    lambda: artefact(view.sha256, view.name, sheets, views),
                    step1.sheet_conventions(),
                    sent={},
                )

    return again


def another_project(qs: Any) -> Any:
    """A second Project of the same QS (ts21c1's way), so two reads never share a set."""
    from vextrus.projects.services import projects
    from vextrus.testing.drawings import QsProject

    with qs.member.acting():
        made = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="A test project").id
    return QsProject(qs.member, made)


def uploaded_only(qs: Any, name: str) -> uuid.UUID:
    return whole.uploaded(qs.member, qs.project_id, name)


def run(
    qs: Any, monkeypatch: pytest.MonkeyPatch, file_id: uuid.UUID, name: str, sheets: int, views: int
) -> None:
    whole.run_job(qs.member, file_id, monkeypatch, readers({name: (sheets, views)}))


def assert_read(qs: Any, file_id: uuid.UUID) -> None:
    with qs.member.acting():
        assert drawings.file(file_id).state == drawings.FileState.READ
