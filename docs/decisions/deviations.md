# Deviations from the Bible

**Authority.** The owner's ruling of session 6 (2026-09-23), carried into `CLAUDE.md` § Law: *the
Bible is a default, not a cage.* Where testing, measurement or research shows a clause of
`docs/specs/cubit.bible.xml` wrong, stale, self-contradictory or harmful to the product, a session
departs from it — and records the departure here, in the same commit as the code that departs.

This file is the one home for those departures. It is not an Interpretation register (an
Interpretation takes the most defensible reading OF a clause and lives in the Design Decision that
applies it); a Deviation says the product does something OTHER than what a clause says, and why.

## The rules

1. **Never silent.** A departure with no row here is a defect, exactly as an unrecorded deviation from
   a Design Decision is (`CLAUDE.md` § Law, the screens bullet). The row and the code land together.
2. **Never an edit to the Bible.** `docs/specs/**` stays locked. The Bible's owner may later fold a
   Deviation into an amendment; until then this row is the current law for the clause it names.
3. **Evidence, not taste.** Every row cites a measurement, a failing or passing test, a fixture, a
   published document, or a customer-visible defect. "It reads better" is not evidence.
4. **Never to pass a gate.** A Deviation may change what the product does; it may never loosen a proof,
   a golden band, a ratchet, a budget or a refusal so that a red lane turns green. A lane that is red
   because the clause is wrong is fixed by departing from the clause AND proving the new behaviour.
5. **Numbered once.** D-001, D-002, … in order; a number is never reused, and a withdrawn Deviation
   stays in the table marked WITHDRAWN with the commit that withdrew it.

## The format

Each Deviation is one row in the table below, and a section beneath it when the evidence needs room:

- **Id** — `D-NNN`.
- **Clause** — the Bible id(s) departed from, quoted in the fewest words that fix it.
- **Evidence** — what showed the clause wrong: file:line, a lane's own verdict line, a measured figure.
- **What the product does instead** — stated as law, the way the clause would have been.
- **Cost** — what is given up, what a reader of the Bible will now find different, what else moves.
- **Commit** — the commit that landed it.

## Register

| Id | Clause | Evidence | What the product does instead | Cost | Commit |
|---|---|---|---|---|---|
| — | *(none yet)* | | | | |
