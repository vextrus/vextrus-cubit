# TypeSafe's servers may receive development data, including the Edison set

The owner permits Vextrus's development work (sessions, tests, prototypes and tuning) to send data
to TypeSafe's servers through the owner's TYPESAFE_API_KEY: text from the Edison set and the Sample
Project, and files where a Jev call needs them. The owner bears the cost. Without this, Jev nodes
could not be tuned on real drawings, which ADR 0005 requires.

This covers development only. Client data in production is sent to TypeSafe under terms stated in
Vextrus's client agreement. Before the beta, we ask TypeSafe what it retains and whether zero
retention is available. TypeSafe says it does not train on inputs, is hosted in the US and does not
state a retention period (docs/research/jev-system-one.md). The key itself is never printed, written
or committed.
