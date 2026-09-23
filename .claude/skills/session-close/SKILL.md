---
name: session-close
description: Close a Vextrus Cubit session so the next one starts from truth — the handoff, the ledger, the next prompt, CLAUDE.md's standing facts, a green gate on the committed tree, a clean tree, commit, sync and push. Use when the owner asks to end or hand off a session.
disable-model-invocation: true
---
# Closing a session

1. **Stop what runs**: background lanes and agents finished or stopped (say which), `pnpm demo --stop`
   unless the owner asked for it to stay up (then say how to stop it).
2. **The gate on the committed product tree**: `pnpm gate`, every lane green; quote its summary line and
   `GATE wall-time … exit 0` and verify's wall time. A red gate is reported as red with its cause.
3. **The documents** (`docs/handoff/`):
   - `session-N.md` — §0 the finish line, condition by condition, REACHED / NOT reached with evidence;
     what was built (commit → what and why); the gate verbatim; the read-back; what is not done and why;
     the owner's standing items and decisions owed; the law's gaps (Interpretation ids, Deviations).
   - `session-N-ledger.md` — every workflow/agent run and its outcome, costs, slips.
   - `session-(N+1)-prompt.md` — the next session's brief: goal, finish line, starting state, the
     programme, the owner's rulings in force.
   - `CLAUDE.md` standing facts — only facts every session needs; proofs stay in the handoff.
   Fact-check the documents against the tree before committing (a `refuter` per section when they are long).
4. **Commit**: explicit paths only (the guard refuses `git add -A`); one subject per concern
   (`baseline:` commits alone). The after-bash hook runs `sync` after each commit.
5. **Clean tree and push**: `git status` shows nothing but ignored paths; `git push` (the owner is
   asked). The last message states the state plainly — HEAD, gate verdict, what is running — and no plans.
