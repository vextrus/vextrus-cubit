"""Ticket 21c's fixtures (its tests import them by name): invented Drawing Sets as hand-built
ReadArtefacts (no toolchain), 21a's read job run with readers a test gives (`files.READERS`, as 21b's
acceptance tests do), the upload through the API as the web sends it, and Step 1's API.

Everything is invented: frames, title blocks and views drawn by 13's test drawing
(`engine/recognise/tests/drawing.py`), proving mechanics only, never a reading (docs/sdlc.md). The
sheet finder, the view finder, 13's register reader and 19b's conflicts run on them as they are; only
the readers of the file's bytes are given (the toolchain's are in `test_step1_whole_toolchain.py`).

Names chosen by the acceptance writer where no authority gives one (the builder meets them; the report
lists each):
- `POST {step1}/questions/{question_id}/answer` with `{"option": key}` (and `"text"` where the option
  takes the QS's words): answers a Question (200); an option the Question does not offer is 400
  `{code, params}`.
- A Question in `GET {step1}/questions` carries `proposals`: the ids of the Proposals it holds (the
  model's QuestionLink), so the card can say "Answering confirms 2 sheets" and show each copy's
  revision mark, date and file from those Proposals.
- `GET {step1}/coverage` carries `unaccounted_views` (each `{id, view_id, sheet_id}`: `id` the view's
  Proposal, which `exclude` takes as it takes a sheet's) and `unread_sheets` (#135: the sheets left
  out for unreadable writing).
- `GET {step1}/progress`: each Discipline's row carries `status`, the StepProgress status
  (`in_review`, `confirmed`, ...).
- A Proposal in `GET {step1}/proposals` carries `agrees` (m0-screens §5, "What 'agrees' means": in the
  bulk act) - used by the seed's test only.
"""

import hashlib
import io
import json
import re
import uuid
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
import pytest
from django.conf import settings as django_settings
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

from engine.check.bangla_ansi import BanglaAnsi, Flagged, FoundBy
from engine.geometry.placement import chain, chain_transform
from engine.messages import decoders_agree as agree_codes
from engine.read import ReadArtefact
from engine.read.artefact import Block, Format, Text
from engine.read.pdf.types import PdfReport
from engine.recognise.tests.drawing import Sheets, frame_block, value_at
from engine.recognise.types import CheckOutcome, CheckResult
from engine.render import fonts
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import drawing, pdf_report
from vextrus.testing.jev import Offline
from vextrus.testing.jobs import run_inline
from vextrus.testing.tenancy import Member

REPO = Path(__file__).resolve().parents[5]
NOT_FOUND = {"code": "platform.auth.not_found", "params": {}}
KEEP_OPEN = "keep_open"
"""The last option of every Question (m0-screens §5: "The last option is always 'Keep open, ask the
consultant'"); the key the seed gives it (`vextrus/seed/takeoff.py`)."""
HELD_OPTIONS = ["read_anyway", "await_resaved", "sent_to_vextrus", KEEP_OPEN]
"""The held file's options in m0-screens §5's order, by the keys `drawings.HeldAnswer` and the seed
give them."""

# Where each view is drawn on the invented A1 paper (mm): four places, rows unambiguous.
TOP_LEFT = (40.0, 330.0, 320.0, 560.0)
TOP_RIGHT = (360.0, 330.0, 640.0, 560.0)
BOTTOM_LEFT = (40.0, 40.0, 320.0, 260.0)
BOTTOM_RIGHT = (360.0, 40.0, 640.0, 260.0)
PLACES = (TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT)
LABELS = ("SHEET TITLE", "SCALE", "SHEET NO", "DATE", "REV")
SCALE = 50.0
BANGLA_TEXT = "Kÿvm"
"""An invented text as a Bijoy-style font stores Bangla (Latin letters), for the flag's sheets."""


@dataclass(frozen=True)
class Sheet:
    """One invented sheet: its title block's values and its views' titles, in reading order."""

    number: str | None
    title: str
    views: tuple[str, ...] = ()
    rev: str = "R0"
    date: str = "12.08.2026"
    register: tuple[tuple[str, str], ...] = ()
    """A drawing list drawn on the sheet: (number, title) rows under "DRAWING LIST"."""
    bangla: int = 0
    """How many texts on the sheet are Bangla in an old font (`BANGLA_TEXT`)."""


def _grid(d: Sheets, box: tuple[float, float, float, float]) -> None:
    x0, y0, x1, y1 = box
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((x, y0), (x, y1))
        d.line((x0, y), (x1, y))


class _Invented(Sheets):
    def __init__(self, name: str, sha256: str) -> None:
        super().__init__(source_name=name)
        self.sha256 = sha256

    def artefact(self) -> ReadArtefact:
        return ReadArtefact.build(
            source_sha256=self.sha256,
            source_name=self.source_name,
            format=Format("dwg", "AC1032"),
            reader="synthetic",
            reader_version="1",
            layouts=self.tabs,
            insunits=self.insunits,
            notes=[],
            blocks=[
                Block(r.handle, r.name, r.base_point, r.layout, tuple(r.entities))
                for r in self.records.values()
            ],
            entities=self.entities.values(),
        )


def artefact(sha256: str, name: str, sheets: Sequence[Sheet]) -> ReadArtefact:
    """The invented sheets side by side in model space, each an A1 frame at 1:50 with its title
    block's values under their labels and each view a drawing with its title under it."""
    d = _Invented(name, sha256)
    block = frame_block(d, labels=LABELS)
    s = SCALE
    for n, sheet in enumerate(sheets):
        ox = n * 100_000.0
        insert = d.insert(block, (ox, 0.0, 0.0), scale=(s, s, s))
        placed = chain_transform(chain(d.artefact(), [insert]))
        values = {0: sheet.title, 2: sheet.number, 3: sheet.date, 4: sheet.rev}
        for cell, text in values.items():
            if text:
                x, y, _ = placed.apply(value_at(cell))
                d.text(text, (x, y, 0.0), height=5.0 * s)
        for title, (x0, y0, x1, y1) in zip(sheet.views, PLACES, strict=False):
            _grid(d, (ox + x0 * s, y0 * s, ox + x1 * s, y1 * s))
            d.text(title, (ox + x0 * s, (y0 - 12) * s, 0.0), height=6.0 * s)
        if sheet.register:
            d.text("DRAWING LIST", (ox + 400 * s, 520 * s, 0.0), height=6.0 * s)
            for i, (number, title) in enumerate(sheet.register):
                y = (500 - 12 * i) * s
                d.text(number, (ox + 400 * s, y, 0.0), height=4.0 * s)
                d.text(title, (ox + 440 * s, y, 0.0), height=4.0 * s)
        for i in range(sheet.bangla):
            d.text(BANGLA_TEXT, (ox + (60 + 40 * i) * s, 450 * s, 0.0), height=3.0 * s)
    return d.artefact()


AGREE = CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED)
DISAGREE = CheckResult(
    code="decoders_agree",
    outcome=CheckOutcome.FIRED,
    finding=agree_codes.DISAGREE(items=3, only_first=2, only_second=1, kinds=0, layers=1, unread=0),
)


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _bangla(read: ReadArtefact) -> BanglaAnsi:
    texts = [e for e in read.entities.values() if isinstance(e, Text) and e.text == BANGLA_TEXT]
    return BanglaAnsi(tuple(Flagged(t.handle, FoundBy.FONT, "SutonnyMJ") for t in texts))


def readers(drawn: Mapping[str, Sequence[Sheet]], *, held: Iterable[str] = ()) -> files.Readers:
    """21a's readers, given: a DWG named in `drawn` reads as its invented sheets; the second reader
    disagrees on the names in `held` (the file is held), else agrees."""
    holding = frozenset(held)

    def first(path: Path, name: str) -> ReadArtefact:
        return artefact(_sha(path), name, drawn[name])

    def second(path: Path, read: ReadArtefact) -> CheckResult:
        return DISAGREE if read.summary.source_name in holding else AGREE

    def pdf(path: Path) -> PdfReport:
        return pdf_report(_sha(path), 1)

    return files.Readers(dwg=first, second=second, fonts=fonts.report, bangla_ansi=_bangla, pdf=pdf)


# The API, as the web calls it ---------------------------------------------------------------------


def step1(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1"


def files_path(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/drawings/files"


def upload(member: Member, project_id: uuid.UUID, name: str, content: bytes) -> Any:
    """21a's upload operation, one multipart part `file`, CSRF enforced (as the web sends it)."""
    part = io.BytesIO(content)
    part.name = name
    client = Client(enforce_csrf_checks=True)
    client.cookies = member.client.cookies
    client.cookies[django_settings.CSRF_COOKIE_NAME] = "a" * 32
    return client.generic(
        "POST",
        files_path(project_id),
        encode_multipart(BOUNDARY, {"file": part}),
        content_type=MULTIPART_CONTENT,
        headers={"X-CSRFToken": "a" * 32},
    )


def uploaded(
    member: Member, project_id: uuid.UUID, name: str, content: bytes | None = None
) -> uuid.UUID:
    """Upload a file (invented bytes, unique unless given) and answer its id; 201 expected."""
    response = upload(member, project_id, name, content or drawing("dwg", f"{name} {uuid.uuid4()}"))
    assert response.status_code == 201, response.content
    return uuid.UUID(response.json()["file"]["id"])


def run_job(
    member: Member,
    file_id: uuid.UUID,
    monkeypatch: pytest.MonkeyPatch,
    use: files.Readers,
    *,
    abort_reason: Callable[[], Any] = lambda: None,
    attempts: int | None = None,
) -> None:
    """21a's read job for the file, run here with the given readers, as its worker would run it."""
    monkeypatch.setattr(files, "READERS", use)
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=abort_reason,
        attempts=attempts,
        file_id=file_id,
    )


def got(api: Any, path: str) -> Any:
    response = api.get(path)
    assert response.status_code == 200, (path, response.status_code, response.content)
    return response.json()


def proposals(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    listed: list[dict[str, Any]] = got(api, f"{step1(project_id)}/proposals")["proposals"]
    return listed


def questions(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    listed: list[dict[str, Any]] = got(api, f"{step1(project_id)}/questions")["questions"]
    return listed


def open_questions(api: Any, project_id: uuid.UUID, kind: str | None = None) -> list[dict[str, Any]]:
    return [
        q
        for q in questions(api, project_id)
        if q["status"] == "open" and (kind is None or q["kind"] == kind)
    ]


def coverage(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    found: dict[str, Any] = got(api, f"{step1(project_id)}/coverage")
    return found


def progress(api: Any, project_id: uuid.UUID) -> dict[str | None, dict[str, Any]]:
    rows = got(api, f"{step1(project_id)}/progress")["disciplines"]
    return {row["discipline"]: row for row in rows}


def a_file(api: Any, project_id: uuid.UUID, file_id: uuid.UUID) -> dict[str, Any]:
    found: dict[str, Any] = got(api, f"{files_path(project_id)}/{file_id}")
    return found


def answer(api: Any, project_id: uuid.UUID, question_id: str, option: str, text: str = "") -> Any:
    body: dict[str, Any] = {"option": option}
    if text:
        body["text"] = text
    return api.post(f"{step1(project_id)}/questions/{question_id}/answer", body)


def confirm(api: Any, project_id: uuid.UUID, ids: Sequence[str], kind: str | None = None) -> Any:
    body: dict[str, Any] = {"proposals": list(ids)}
    if kind is not None:
        body["kind"] = kind
    return api.post(f"{step1(project_id)}/confirm", body)


def exclude(api: Any, project_id: uuid.UUID, ids: Sequence[str], reason: str, text: str = "") -> Any:
    return api.post(
        f"{step1(project_id)}/exclude", {"proposals": list(ids), "reason": reason, "text": text}
    )


def of_number(listed: Sequence[dict[str, Any]], number: str | None) -> list[dict[str, Any]]:
    return [p for p in listed if p["number"] == number]


def the(listed: Sequence[dict[str, Any]], number: str | None) -> dict[str, Any]:
    [found] = of_number(listed, number)
    return found


def picked(question: Mapping[str, Any]) -> list[str]:
    return [o["key"] for o in question["options"] if o.get("picked")]


def keys(question: Mapping[str, Any]) -> list[str]:
    return [o["key"] for o in question["options"]]


# The words: every code has its English in the catalogue ------------------------------------------


_ESCAPE = re.compile(r'\\(["\\nt])')


def _po_string(quoted: str) -> str:
    """A PO file's quoted string, its C escapes (\\" \\\\ \\n \\t) read."""
    body = quoted.strip()[1:-1]
    return _ESCAPE.sub(lambda m: {"n": "\n", "t": "\t"}.get(m.group(1), m.group(1)), body)


def _catalogue() -> dict[str, str]:
    words: dict[str, str] = {}
    for po in sorted((REPO / "web" / "src" / "messages").glob("*/*/en.po")):
        msgid: str | None = None
        into: str | None = None
        for line in po.read_text(encoding="utf-8").splitlines():
            if line.startswith("msgid "):
                msgid, into = _po_string(line[6:]), None
            elif line.startswith("msgstr ") and msgid is not None:
                into = msgid
                words[into] = _po_string(line[7:])
            elif line.startswith('"') and into is not None:
                words[into] += _po_string(line)
            else:
                into = None
    return words


def english(code: str) -> str | None:
    """The code's English in `web/src/messages/<module>/<submodule>/en.po`, or None."""
    return _catalogue().get(code)


# Jev: a stand-in TypeSafe, so nothing leaves the machine ------------------------------------------


def jev_says(offline: Offline, top: str) -> None:
    """Every `ask` for the rest of the test is answered by a stand-in: its first option, with
    probability `top` ("0.97": sure; "0.34": barely above the rest)."""
    first = Decimal(top)

    def answer_it(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        answers = {}
        for node, asked in body["questions"].items():
            options = list(asked["criteria"])
            rest = (Decimal(1) - first) / max(len(options) - 1, 1)
            probabilities = {o: float(rest) for o in options[1:]} | {options[0]: float(first)}
            answers[node] = {
                "type": "choice",
                "choice": options[0],
                "confidence": float(first),
                "probabilities": probabilities,
            }
        return httpx.Response(200, json={"model": body["model"], "answers": answers})

    offline.use(httpx.MockTransport(answer_it))


def no_raw_code(value: object) -> bool:
    """No `%%` (nor another raw drawing code 21b refuses) anywhere in a value shown to the QS."""
    text = json.dumps(value, ensure_ascii=False)
    return not any(code in text for code in ("%%", "\\\\P", "\\\\S", "{\\\\"))


@dataclass
class Seen:
    """What the QS's API shows of a project, for comparing before and after."""

    proposals: list[dict[str, Any]] = field(default_factory=list)
    questions: list[dict[str, Any]] = field(default_factory=list)
    coverage: dict[str, Any] = field(default_factory=dict)


def seen(api: Any, project_id: uuid.UUID) -> Seen:
    return Seen(proposals(api, project_id), questions(api, project_id), coverage(api, project_id))


def sheet_ids(listed: Sequence[dict[str, Any]]) -> set[str]:
    return {p["sheet_id"] for p in listed}


UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
