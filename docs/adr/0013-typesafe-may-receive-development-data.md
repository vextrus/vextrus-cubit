# TypeSafe's servers may receive development data, including the Edison set

The owner permits Vextrus's development work (sessions, tests, prototypes and tuning) to send text
from the Edison set and the Sample Project to TypeSafe's servers, through the owner's
`TYPESAFE_API_KEY`, at the owner's cost. Jev is text only: drawing files and raw geometry are never sent; code-computed facts
(a size, a position, a neighbour) may go with the text as a node's state (ADR 0011)
(docs/research/jev-system-one.md). Without this, Jev nodes could not be tuned on real drawings, which
ADR 0005 requires.

This covers development only. Client data in production is sent to TypeSafe under terms stated in
Vextrus's client agreement. Before the beta we ask TypeSafe what it retains and whether zero retention
is available; it says it does not train on inputs, is hosted in the US, and states no retention
period. The key itself is never printed, written or committed.

**Cloud sessions** get their own TypeSafe key, separate from the owner's local key. The owner creates
it and pastes it into the cloud environment's settings, never into the repo or a chat. It has a
spending limit if TypeSafe offers one and is rotated when the execution phase ends. Tests use recorded
Jev answers by default; live calls run only in tests marked live.

## History
- 25 Sep 2026: decided (the owner's permission).
- 25 Sep 2026 (owner's decision): a separate key for cloud sessions.
