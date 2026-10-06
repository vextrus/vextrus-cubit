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
spending limit if TypeSafe offers one and is rotated when the execution phase ends. Since 5 Oct 2026,
cloud sessions may send text from the two Development Sets (the Edison set and the Sample Project) to Jev
under the cloud key; Held-out Sets and clients' sets still go only under the local key. Tests use recorded
Jev answers by default; live calls run only in tests marked live.

## History
- 25 Sep 2026: decided (the owner's permission).
- 25 Sep 2026 (owner's decision): a separate key for cloud sessions.
- 26 Sep 2026 (owner's decision): in development, text (and code-computed facts, never files) from
  any set Vextrus may use (Edison, the Sample Project, Held-out Sets, founding clients' sets) may go to
  Jev under the owner's local key, never the cloud key. Held-out Sets go only through the key user's
  scoring run, which holds its own copy of the key readable only by `vxkeys`; build sessions never see
  Held-out text. Each founding client's written permission names TypeSafe as a processor (US servers,
  no training on inputs). The owner's ruling: "Agree".
- 5 Oct 2026 (owner's ruling, session 13's Q23, "Yes, now"): cloud sessions may send text from the two
  Development Sets to Jev under the cloud key, before the cloud key has a spending limit (none is set
  today). It follows the owner's Q7 ruling of 4 Oct, which lets cloud sessions read those two sets.
  Held-out Sets and founding clients' sets stay as the 26 Sep decision says.
