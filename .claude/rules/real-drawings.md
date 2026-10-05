---
paths:
  - "engine/**"
  - "vextrus/takeoff/**"
  - "scripts/real_drawings/**"
  - "tools/scorer/**"
---
# Real drawings (engine, takeoff, the real-drawing check, the scorer)

- The law is in CLAUDE.md: nothing from a real drawing enters git, an issue, a PR or a cloud prompt. Real
  drawings are read only in local sessions, under `.private/`; the `real-drawings` skill says how.
- Every engine PR (the paths in `.github/engine-paths.txt`) carries the `real-drawings` status. Builders
  run `scripts/real-drawings <PR> --no-post` while tuning; the orchestrator runs the posting and scored
  runs from the main checkout under the accept rule (ADR 0041) and posts through `scripts/owner/post-status`.
- The blind scorer is `tools/scorer/` (`vx-score`); it answers in counts only. Every change to
  `scripts/real_drawings/` or `tools/scorer/` on main needs the owner's custody re-run: batch them.
- One real-drawing run per engine head, on one lock; every engine merge stales the next engine PR's head.
- Before pushing an engine branch, scan its new literals and messages for drawing text.
- Test fixtures are synthetic and typed as the real data holds them; they prove mechanics, never reading.
