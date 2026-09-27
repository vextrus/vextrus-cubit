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
- 26 Sep 2026 (done): the owner ran `scripts/owner/custody-setup.sh` and reported "Setup complete"
  (the `vxkeys` user, the scorer placeholder and its one rule, `sudo` with a password). The
  deliberate test the same day: a session's Bash read of the keys and its Read-tool read of
  `/home/vxkeys/keys` were both refused by the permission layer before reaching the operating
  system; the operating-system fence itself was checked by the script's own stage 7, whose three
  lines the orchestrator did not see. The owner's words: "I ran the bash script: Setup complete".
- 26 Sep 2026 (owner's decision, from the M0 plan reviews): **the password-free rule is removed.** It
  let any process run the scorer as the key user with any input, so an agent could score crafted
  exports one sheet at a time and rebuild a key (refuter #5; the guard, which checked `sudo` only at a
  command's start, was tightened the same day to refuse it anywhere). The owner now types a password
  once per scoring run (`scripts/owner/scorer-rule-remove.sh`). The scorer reads only the export in
  the drop folder and the keys, and prints aggregates only; the Edison key-drafting script lives with
  the keys, never in the repo. The owner's ruling: "Agree, write the script to remove the rule".
- 27 Sep 2026 (done): the owner ran `scripts/owner/scorer-rule-remove.sh`; the scorer now runs only
  with the owner's password. The owner's words: "I bought GitHub Pro and ran the point 3 script."
