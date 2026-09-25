# Session 10 — brief: the grill, the research, the course

**This session builds nothing.** The owner has paused session 9's programme and its finish line. They
are reviewing the running product in depth, testing it and judging it critically in the demo server,
and they have new thoughts about the whole project. Session 10 is a long working session with the
owner. It grills their review, researches what it raises, and ends with **the final conclusion of our
next course of action**, written down.

Read first:
- `docs/handoff/session-9.md`: where the product stands, what is held, and what is not done.
- `~/reference/README.md`: the two open-source references and the law on what we may take from them.

## The finish line

1. **The owner's review is understood whole.** Every finding they bring has been grilled to a precise
   statement: what they saw, why it matters to a QS, and what "right" would be.
2. **The questions it raises are researched from primary sources.** These are OpenConstructionERP's code and running product,
   cad2data's docs and pipelines, the standards (BNBC 2020, IS 1200, PWD SoR, BS 8666, RICS), and our
   own code and law. Findings are cited and written into the repo.
3. **The conclusion is written and the owner agrees with it.** It says:
   - what the product is and is for, from here;
   - what we keep, change or drop of what exists (the code, the Bible, the law, the held branches);
   - the next sessions' programme, in order, each with a finish line the owner can judge in the
     running product.

   It is recorded as the owner rules, in the documents below.
4. **An honest close** (`session-close`): the documents committed, the tree clean, the next brief written.

## How to run it

- **Grill, don't build.** Use `/grill-with-docs` on the owner's review, one finding at a time, recommendation
  first. It keeps `CONTEXT.md`, the project's glossary (Cubit's words: sheet, view, campaign, line,
  coverage, the Trace, and so on), and records each ruling as an ADR in `docs/adr/` as it lands.
  `/grilling` is the plain version for non-code questions.
- **Map a large course with `/wayfinder`.** It keeps a map of decision tickets on GitHub Issues
  (`docs/agents/issue-tracker.md`). The repo is public: no secrets, nothing from `.private/`, no Edison
  content in an issue.
- **Research in the background.** Use the `research` skill or read-only agents at `medium` effort for
  "how does OpenConstructionERP solve X" and "what does the standard say". Each writes a cited file;
  keep your context for the owner.
- **Look at the references directly.** Start OpenConstructionERP with `~/reference/oce.sh start` (it
  serves on http://127.0.0.1:8080; "Try demo" signs in). Walk its Takeoff (PDF, DWG, BIM 3D, Quantity) and its
  BOQ and cost flows beside Cubit (`pnpm demo`, 3213) wherever the owner compares them. Both can be
  served at once: they share no port and no database.
- **Architecture questions**: `/improve-codebase-architecture` and `codebase-design`, only if the owner's
  course reaches into how the code is shaped.
- **The law on the references**: learn their domain knowledge and solved problems, and re-implement
  them in our own code. Never copy OpenConstructionERP's code, schemas, strings or data into this
  public repo, because it is AGPL-3.0. Never run cad2data's proprietary converters: that is the owner's
  call, and they have not made it.

## The starting state

- **Code**: `dev-lane-and-jev`, clean, with the gate green on `936febc6` (session-9.md §2). Session 9's
  close and the harness commits came after it (Matt Pocock's skills, the setup, the reference law).
- **Held**: wave 3e's seven slices on `worktree-wf_2f62ed4b-e02-1…7`, unmerged and unreviewed
  (session-9.md §4). Whether they are merged, reworked or dropped is part of the conclusion.
- **Owner items carried over**: the push; removing old worktrees; the Edison-names history scrub; the
  cad2data converters; whether the rulings below survive the new course.

## Rulings in force until the owner changes them

- **R0**: regenerate and draw all.
- **Ties**: A′ under D-003.
- **The bill**: one item per description, with a details-of-measurement appendix.
- **The BBS**: one mark per floor, with its member count.
- **Ask**: on Jev alone, live in the demo.
- **Edison**: conventions only.
- **GC-3**: formula (iii).
- **The Bible**: the default reading, not a cage.

## Next free ids

I-696, D-011 (D-008 unassigned), migration 0075. ADRs from `/grill-with-docs` start at `docs/adr/0001-…`.
