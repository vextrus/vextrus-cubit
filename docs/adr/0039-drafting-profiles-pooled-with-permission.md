# Drafting Profiles: a consultant office's conventions as data, pooled across Developers with permission

Most of what a reader must "fit" to a new Drawing Set is convention, not engineering: which layers hold
which members, how labels, levels and sheet numbers are written, where a title block's fields sit, how
schedules are drawn. Vextrus holds these as a **Drafting Profile** per consultant office:
- **Learnt and confirmed.** On an office's first set, code proposes the conventions it infers (candidates
  found by geometry, such as an outline whose width equals its label's size, or piles inside caps; Jev
  picks among them, ADR 0011); the QS confirms them early in the Takeoff; only what differs later becomes
  a Question. A profile holds conventions only, never drawing content.
- **Reused.** The profile serves that office's next Revision and next project.
- **Pooled across Developers, with permission.** The same office draws for many Developers, so a profile
  confirmed in one Developer's data may be published to the Vextrus Library for every Developer, once
  that client's written permission covers it and a Vextrus reviewer has checked that nothing but
  conventions leaves (layer names and label patterns can carry names). Vextrus also pre-builds profiles
  for the leading Dhaka consultant offices from sets it holds with permission.
- **Proof stays honest.** A Held-out Set is scored first as an unknown office's first read (no profile of
  its office), and only then with a profile if one exists; both figures are reported. A profile is never
  built from a Held-out Set by a build session (ADR 0026).

When: the per-Developer profile (learn, confirm, reuse) arrives with M1's reading; publishing to the
Library waits for the first client permission that covers it (the founding clients' agreement, ADR 0033,
gains the clause).

Why: on the Edison set, 27 of the 31 fittings session 02's readers needed were one office's conventions
(docs/research/edison-check-session-02.md); held as confirmed data they are visible and correctable,
not hidden rules in the reader (ADR 0009's judgement as data, applied to reading). Pooled, every
Developer's second set from a known office reads almost as cleanly as a known one, a quality no
competitor without the pool can match. Rejected: generic readers only (the same Questions on every set,
every time); profiles kept per Developer only (loses the pool). The owner's reason for pooling: "with
cooperation our product quality will be at top quality and can be real moat."

## History
- 27 Sep 2026 (owner's decision, session 02 Q16; recommended: B now, C after the beta). The owner's ruling:
  "I think we can go for C for Q16 which I know going extra mile and as you told that needs client's
  permission which we'll manage hopefully and with cooperation our product quality will be at top quality
  and can be real moat."
