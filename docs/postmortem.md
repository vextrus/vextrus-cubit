# Post-mortem: why Vextrus Cubit (Aug–Sep 2026) was reset to zero

This is the one document the reset keeps from the old product. It exists so the next plan does not
repeat the old one. Read it once, early. It is not a spec, and nothing in it is a requirement.

## The history, briefly

- **vextrus-erp** (about a year). An enterprise ERP attempt built on a heavy stack: a workspaces
  monorepo, NestJS/CQRS/DDD, GraphQL with generated clients, Prisma, Redis, a Python web service,
  Electron, a separate design-system package, Docker in dev. Agentic coding fought that stack
  constantly. Several pivots followed. Cubit was meant to be the final attempt.
- **The Bible** (`docs/specs/cubit.bible.xml`, 20 Aug 2026). A 1,058-line XML specification of Cubit
  (drawing → quantity → rate → estimate → bid) in eleven milestones, M0–M10. It was written with
  Fable 5 from extensive research.
- **Vextrus Builder** (`~/vextrus-builder`, spec `docs/specs/builder.spec.md`). An autonomous
  "software factory". It was a long-running, resumable, self-verifying, self-improving engine with
  sixteen model roles (Architect, Planner, Verifier, Builder, Reviewer, Skeptic, Surveyor, Breaker,
  Fixer, Integrator, Coach and others). It also had a Ledger, a Conductor state machine, held-out
  tests, locked paths, relays, evidence packs and a dashboard.
  - It was meant to build Cubit from the Bible in weeks.
  - In practice, most of the money went into fixing the engine itself, through versions up to v22.
  - Every run found new faults in a growing codebase.
  - It reported green gates, screenshots and journey videos. When the owner ran the product on real
    and fixture drawings, it had serious runtime bugs.
- **Direct Claude Code sessions** (up to session 9, Opus 5 then Opus 5.5). These fixed those faults
  and pushed M3 and M4.
- **By 25 Sep 2026** the repository held:
  - 931 commits;
  - about 193k lines of TypeScript, 16k of Python CAD code and 19k of fixture generator;
  - 1,095 test files, 75 migrations, 188 refusal codes, 43 Design Decisions and about 700
    Interpretation ids;
  - a seven-lane gate.

  It had cost billions of tokens and missed investor deadlines.

## What it could do at the end

- **One drawing set.** It took a draft BOQ for one synthetic G+6 drawing set that we generated
  ourselves.
- **What it measured:** piles, pile caps, tie beams, columns and column rebar.
- **What it did not measure:** beams, slabs, stairs, walls, excavation, masonry and finishes. Every
  beam was blocked on one unread slab thickness.
- **No money anywhere:** no rates and no amounts.
- **Ask**, the AI feature, gave a floor's concrete as its columns only.

## Why it failed: the causes, not the bugs

1. **We proved the product against ourselves.**
   - Every drawing read end to end came from our own generator, and so did the answer key.
   - The readers were fitted to the conventions we drew, so a green gate meant "Cubit agrees with
     Cubit".
   - No real consultant's drawing set ever went from upload to a BOQ.
2. **The automation bet was wrong.**
   - The product tried to read everything from 2D CAD automatically, and refused any line missing
     one fact.
   - The human had no cheap way to supply that fact at the point of need.
   - "Never over-measure" is right. As a hard wall with no human path, it produced a product that
     measured almost nothing.
3. **The process became the product.** The machinery grew faster than the product:
   - law ids, deviations and method hashes;
   - refusal registers and digests;
   - lane budgets and picture baselines;
   - integration scripts;
   - the Builder engine itself.

   Most effort went into keeping the machinery green, not into what a quantity surveyor sees.
   Rigour ran ahead of users.
4. **The domain model was the machine's, not the user's.**
   - The register had one line per member per kind: 1,607 lines, 89 identical pile rows.
   - The screens spoke internal vocabulary ("campaign", "Transcribed / Defaulted", "Author storey
     height").
   - The estimate, where the money and the value are, was deferred behind a perfect takeoff that
     never arrived.
5. **Visible quality defects slipped every gate:**
   - one level spelled "FDN" and "Foundation" in the same bill;
   - an unordered, duplicated level tree;
   - lakh grouping on drawing coordinates;
   - a sheet that opened looking empty;
   - test artefacts showing in the demo.
6. **Both stack extremes failed.**
   - The ERP's enterprise stack (monorepo, NestJS/CQRS/DDD, GraphQL codegen, Prisma, Redis,
     Electron, Docker in dev) slowed agentic coding to a crawl.
   - Cubit's opposite ("one application, one schema lane, one verification command") still carried
     six seams and per-area registries that parallel agents collided on.
   - The lesson is not "small" or "big". It is an architecture designed for how agents actually
     build: clear module boundaries, one obvious place for each thing, fast feedback, and room to
     grow into production.

## What is worth carrying, as knowledge rather than code

- **The Trace.** Every figure links to where it was read on the drawing. The owner valued it.
- **Honest coverage.** Say what is not measured, but beside a figure the human can complete.
- **Domain knowledge:**
  - IS 1200 and BNBC 2020 measurement rules;
  - bar-bending schedule practice (BS 8666), PWD Schedule of Rates conventions;
  - how real Bangladeshi drawing sets are organised (the Edison dissection).
- **DWG know-how:** LibreDWG's failure modes (text wrapping, MTEXT order) and ezdxf extraction.
- **AI:** closed questions to a small judgment model (TypeSafe Jev) were cheap (under one cent per
  Ask) and reliable for routing and classification.
- **Working habits that paid off:**
  - look at the running product in a browser;
  - only a tool result is evidence;
  - report failures plainly.

## The rules the next plan must satisfy

- Real drawings from week one, with permission. Never a self-authored corpus as the proof.
- The human drives with AI assisting and one-click confirmation, and the machine asks for a missing
  fact at the point of need.
- Money (rates, amounts) in the loop early.
- A process proportionate to the stage. Gates and law grow with users, not ahead of them.
- An architecture that agents build well and that can grow into enterprise production.
- One product, judged in the running product by its users. No engine that builds the engine.
