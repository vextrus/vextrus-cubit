# Answer Keys are fenced by the operating system, and scored blind

Every Answer Key lives with a separate Linux user, `vxkeys`, whose home is mode 700: the Hand
Takeoffs, the Held-out Sets, the Sample Project's generating inputs and any Revit model of it
(ADR 0004), the expected N values of the real-drawing check (ADR 0030), and the laboratory's verified
Edison model if it is used as a check. `sudo` asks for a password again. One narrow sudoers rule lets
the owner's user run a single blind scorer as `vxkeys` without a password. The scorer compares a
Vextrus export with a key and returns only aggregates (n / N and % difference per Element Family, per BOQ Item line and per zone's ৳
total, as ADR 0005's tolerances need),
never a key's values. The guard refuses `sudo` and `su` in agent sessions.

The laboratory (`~/vextrus-cad`) keeps running as the owner. It is fenced by deny rules in the
committed `.claude/settings.json` and by a guard pattern that refuses any command naming it. Its
methods reach Vextrus only through documents the owner hands over. The Claude GitHub app is installed
on `vextrus-cubit` only, so no cloud session can clone the laboratory. A session tries once, on
purpose, to read a key and must be refused.

Why: a session that can read the answer will fit its reader to it, the post-mortem's cause 1 by a
shorter route. The plan review (C4) found the keys "protected by words"; session 01 found `sudo`
needed no password and `~/vextrus-cad` was world-readable. Rejected: deny rules and the guard only
(the Bash tool can route around deny rules). The setup is a guided script the owner runs.

## History
- 26 Sep 2026: decided. Evidence: plan review C4, docs/reviews/plan-review-ledger.md. The owner's
  ruling (26 Sep 2026): "yes I agree including putting a password".
- 26 Sep 2026: the key list names the Sample Project's generating inputs (ADR 0004, amended) and the
  real-drawing check's expected N values (ADR 0030).
