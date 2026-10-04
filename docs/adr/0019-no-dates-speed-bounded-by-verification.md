# No dates: build at the fastest pace verification allows

**Amended by ADR 0042** (4 Oct 2026; the owner's Q7 ruling): real drawings may go to cloud sessions (the two
Development Sets, through a private repository and a separate cloud environment); never into this repository.

No deadline or fixed timeline is set. Vextrus is built as fast as possible: the owner and the team
work long days, local and cloud Claude Code sessions run around the clock, and token spending is not
a constraint. Work runs in parallel as far as quality allows.

The condition that keeps this from repeating Vextrus Builder: **the pace is set by verification, not
by the number of agents.** Builder ran many agents in parallel and reported green gates, screenshots
and journey videos while the product had serious runtime bugs on real drawings (docs/postmortem.md).
So:
- **Fully parallel:** work that committed tests can prove (the web app, the BOQ grid, exports, Rate
  Analyses, Measurement Rules, auth, deployment).
- **Kept tight:** reading real drawings, the critical path. Every change to drawing reading or model
  assembly passes the real-drawing check on the Development Sets and Held-out Sets before it merges
  (ADR 0030), because real drawings never go to cloud sessions.
- **Judged by people:** a milestone is done only when the owner and the team have walked it in the
  running product on real drawings (ADR 0005). With the team testing daily, this loop sets the pace.

How waves run is ADR 0025.

## History
- 25 Sep 2026 (the owner's decision): no dates.
- 26 Sep 2026: the local check is now ADR 0030's real-drawing check, on Development Sets and Held-out
  Sets.
- 4 Oct 2026 (the owner's decision, session 12 Q7; ADR 0042): "real drawings never go to cloud sessions" no longer
  holds: the two Development Sets may, through a private drawings repository and a read-only token, after a probe
  (docs/specs/factory.md §2.4). Reading stays kept tight: posting and scored runs, the scorer's keys and Held-out Sets
  stay local. The owner's ruling: "Q7 drawing data - I'm allowing to be more easy going on this case and cloud
  sessions may read drawing and enabling Remote Control for most cases if that means more power and performance by
  allowing some privacy issues that I'm allowing willingly".
