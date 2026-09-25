# The product repository is private

On 25 Sep 2026, before any product code was written, `vextrus/vextrus-cubit` was made private at the
owner's decision. It had no forks and no stars. The 2D→BIM engine, the Measurement Rules, the Rate
Analyses and the plan are Vextrus's moat, and a public repository showed them to every competitor.
Private also means a slip in an issue or PR no longer publishes client content.

The rules stay: no secret is ever written or committed; `.private/` never enters git; client and
Edison content never goes into issues. GitHub Actions minutes are no longer unlimited (2,000–3,000 a
month are free, then a small per-minute charge). Cloud sessions, `/code-review`, ultrareview and Issues
all work on private repositories.

## Correction (26 Sep 2026)
Anthropic's managed Code Review is for Team and Enterprise plans only (docs/research/sdlc-claude-code.md);
the built-in `/code-review` and ultrareview work on this private repo. Branch protection needs GitHub
Pro (ADR 0025, amended).
