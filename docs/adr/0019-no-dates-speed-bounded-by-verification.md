# No dates: build at the fastest pace verification allows

The owner's decision: no deadline or fixed timeline is set. Vextrus is built as fast as possible. The
owner and the team work long days, local and cloud Claude Code sessions run around the clock, and
token spending is not a constraint. Work runs in parallel as far as quality allows, including large
orchestrated workflows.

The condition that keeps this from repeating Vextrus Builder: **the pace is set by verification, not
by the number of agents.** Builder ran many agents in parallel and reported green gates, screenshots
and journey videos, while the product had serious runtime bugs on real drawings (docs/postmortem.md).
So:
- **Fully parallel:** work that committed tests can prove, such as the web app, the BOQ grid,
  exports, Rate Analyses, Measurement Rules, auth and deployment.
- **Kept tight:** reading real drawings, the critical path. Every change to drawing reading or model
  assembly passes a local check on the Sample Project and an Independent Set before it merges
  (ADR 0005), because real drawings never go to cloud sessions.
- **Judged by people:** a milestone is done only when the owner and the team have walked it in the
  running product on real drawings. With the team testing daily, this loop sets the real pace.
