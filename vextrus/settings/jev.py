"""Jev, TypeSafe's judgement model (ADR 0011; ticket 15's client, `platform.services.jev`).

Only the environment variable's name lives here; the key itself is never written, printed or
committed (CLAUDE.md, Law), and the client reads it at call time. Live calls happen only in tests
marked `live`.

The endpoint and its limits are TypeSafe's (docs.typesafe.ai/api and /models, read 29 Sep 2026;
docs/research/jev-system-one.md §1). The times are ours: a warm call took 0.33 s and a fresh one
0.87 s at the median, 0.95 s at p90, 3.9 s at worst (docs/research/jev-system-one.md §2.1), so a call
that has not answered in a few seconds is treated as TypeSafe being down, and the QS picks (story 86).
"""

from decimal import Decimal

VEXTRUS_JEV_KEY_VARIABLE = "TYPESAFE_API_KEY"

VEXTRUS_JEV_URL = "https://api.typesafe.ai/v1/systemone"
"""TypeSafe's evaluation endpoint. The client refuses any URL that is not https."""

VEXTRUS_JEV_CONNECT_SECONDS = 2.0
"""The longest wait to connect and finish TLS."""
VEXTRUS_JEV_READ_SECONDS = 4.0
"""The longest wait for any one read (the first byte of the answer included)."""
VEXTRUS_JEV_DEADLINE_SECONDS = 6.0
"""The whole call's limit, retries and pauses included: every socket wait is cut to what is left of
it, so a server dripping bytes is cut too. Name resolution is the system resolver's own."""
VEXTRUS_JEV_BACKOFF_SECONDS = 0.5
"""The pause before the first retry of a 429, a 529 or a dropped connection; it doubles each time."""
VEXTRUS_JEV_BACKOFF_MAX_SECONDS = 2.0
"""The longest pause between two tries (a longer Retry-After is waited only if the deadline allows)."""

VEXTRUS_JEV_COOL_OFF_AFTER = 3
"""After this many failed calls in a row, the client answers `Unavailable` at once for a while, so an
outage costs a Drawing Set's sheets seconds, not minutes."""
VEXTRUS_JEV_COOL_OFF_SECONDS = 60.0
"""How long it answers at once; then one call tries TypeSafe again."""

VEXTRUS_JEV_MAX_REQUEST_BYTES = 32_000
"""The largest request sent. TypeSafe takes 32k tokens for the state plus the longest question
(docs.typesafe.ai/models); a token is at least one byte of UTF-8, so a body within 32,000 bytes is
within that limit. A larger one is refused before sending, never cut."""
VEXTRUS_JEV_MAX_RESPONSE_BYTES = 65_536
"""The largest answer read. A Choice of 255 options answers in about 10 KB."""

VEXTRUS_JEV_SHEET_TYPE_PROPOSE_AT = Decimal("0.90")
"""The confidence at which a sheet's kind is proposed rather than asked as a `low_confidence`
Question. Set by ticket 23's spot check on 32 real sheets: the ruling, its numbers and the model it
holds for are in docs/knowledge/jev-nodes.md (its `sheet_type` row); change them together."""
