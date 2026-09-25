# Answer Keys are fenced by the operating system, and scored blind

Every Answer Key (the Hand Takeoffs, the Held-out Sets, the team's Revit model of the Sample
Project, and the laboratory's verified Edison model if it is used as a check) lives with a separate
Linux user, `vxkeys`, whose home is mode 700. `sudo` asks for a password again. One narrow sudoers
rule lets the owner's user run a single blind scorer as `vxkeys` without a password. The scorer
compares a Vextrus export with a key and returns only aggregates per element family (n / N and %
difference), never a key's values. The guard refuses `sudo` and `su` in agent sessions.

The laboratory (`~/vextrus-cad`) keeps running as the owner. It is fenced by deny rules in the
committed `.claude/settings.json` and by a guard pattern that refuses any command naming it. Its
methods reach Vextrus only through documents the owner hands over. The Claude GitHub app is installed
on `vextrus-cubit` only, so no cloud session can clone the laboratory. A session tries once, on
purpose, to read a key and must be refused.

Why: a session that can read the answer will fit its reader to it, which is the post-mortem's cause 1
by a shorter route. The plan review (C4, docs/reviews/plan-review-ledger.md) found the keys "protected
by words". Session 01 found worse: `sudo` needed no password and `~/vextrus-cad` was world-readable,
so a separate user alone would have been no fence.

Considered: deny rules and the guard only. Rejected: the Bash tool can route around deny rules.

The owner's ruling (26 Sep 2026): "yes I agree including putting a password". The setup is a guided
script the owner runs; this adds one small piece to the harness (docs/sdlc.md).
