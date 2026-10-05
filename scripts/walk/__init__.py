"""G1, the real-set walk gate (docs/specs/factory.md 5 "G1"; ticket f5).

`run.py` serves a head and runs the scripted walk (`web/e2e/real/walk.spec.ts`), which writes the raw,
private `walk.json`; `verdict.py` judges it against `.private/work/walk-expect/<set>.json` and the agent
layer's findings into `verdict.json` (docs/specs/factory/contracts/walk-verdict.schema.json); `ready.py`
says whether main is walk-ready; `sanitize.py` is the only door from a walk to anything public and
`issues.py` drafts walk issues from its allowlisted fields. Standard library only.
"""
