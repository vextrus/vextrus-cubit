# Session 9 — the critical review: why Cubit is not reaching M4 at production quality

Walked by the orchestrator on 25 Sep 2026, at the owner's request, in the running demo
(http://127.0.0.1:3213, workspace `886fa352…`, project "Bashundhara G+6", 1440x900 light). This is a
judgement of the product and of how it is built, not a bug list. It is input to session 10, where the
owner has decided to start again from zero. The purpose is to name what must not be repeated.

## The numbers

- Built in 5 weeks: 931 commits since 20 Aug 2026 and billions of tokens.
- The code:
  - 192,848 lines of TypeScript in `src/`;
  - 16,117 lines of Python in the CAD lane;
  - 18,877 lines of Python fixture generator;
  - 1,095 test files and 75 migrations;
  - 188 refusal codes;
  - 37,886 lines of Markdown docs, 43 Design Decisions and Interpretation ids up to I-695.
- What a quantity surveyor gets from it: a draft BOQ for one synthetic G+6 drawing set. Only these
  items carry a figure: piles, pile caps, tie beams, columns and column rebar, and some blinding.
- The rest of the building has **no figure**:
  - every beam, "slab thickness unstated";
  - every slab, stair, shear wall and lintel;
  - all excavation;
  - all masonry and all finishes.
- **No rate and no amount anywhere.** Assure, Estimate and Bid are greyed tabs.
- Ask, the AI feature, answered "total concrete for the 3rd floor" with columns only (12.017 m³). A
  real floor's slab and beams are several times that.
- By value, the measured share of a real building's estimate would be a small fraction, perhaps 10–15 %.
  That is an estimate, not a measurement.

## What is fundamentally wrong (the core, not the bugs)

### 1. We proved the product against ourselves

- **The drawings are ours.** Every drawing the product reads end to end was authored by our own
  generator: F-RCC6, F-RCC6-BNBC and F-ARCH, about 19k lines of fixture code.
- **So is the answer key.** The "golden" comes from that generator's own model.
- **So the readers fit our conventions.** They were built to read the conventions we drew. A green
  gate means "Cubit agrees with Cubit".
- **No real drawing ever went through.** Not one real consultant's drawing set has gone from upload to
  a BOQ. The real set we have, Edison, was deliberately kept to "conventions only".
- The thumbnails show it: toy drawings, a 6×5 grid, empty notes sheets. The first real drawing a
  customer uploads is where the product will actually be tested, and we have never run that test.

### 2. The automation bet was wrong, and it was placed on every class at once

- The product tries to read everything automatically:
  - sheets, views and captions;
  - the grid and levels;
  - member placement and schedules;
  - notes, joints, ties and bar shapes.
- Then it **refuses** any line where one parameter was not read. "A partial faulty estimate is more
  harmful than no estimate" was a sound principle. Applied as a hard block with no cheap human
  answer, it produced a product that says "Not measured" to most of the building.
- **Missing facts cannot be supplied easily.** A QS would type the slab thickness once (125 mm) in
  two seconds and unblock about 370 beam lines. The product has no easy path for that. Each human fact
  goes through a Design Decision, an act, a consequence digest and a commit, and the product does
  not ask for it at the point of need.
- **Real tools assist; they do not replace.** Real takeoff tools (Bluebeam, PlanSwift, OST, CostX,
  and OpenConstructionERP's "AI-assisted, human-confirmed") put the human in the driving seat and
  automate the tedious parts. We built the opposite: a machine that must do it alone, or refuse.

### 3. The process became the product

- **The overhead.** Each change carries:
  - law ids (I-695), Deviations and the Bible;
  - method hashes, refusal registers and digest re-freezes;
  - a 60-second verify budget fought over for days;
  - seven lanes, picture baselines and integration scripts that renumber ids across worktrees.
- **Where session 9 went.** Of its 115 commits, a large share went to:
  - integration and re-freezes;
  - flakes and the verify budget;
  - merge defects across parallel slices.
  Very little went to what a QS sees.
- **The machinery grew faster than the product.** The rigour was meant to protect quality. It became
  where the time and money went, and it still let the demo reach the owner in the state below.

### 4. The domain model is the machine's, not the QS's

- **The register is a database dump.** It holds 1,607 lines, one per member per kind: 89 piles × 3
  identical rows. A QS works in items and dimension sheets ("89 / 0.500 dia / 21.336 m"), trade
  bills, PWD SoR codes and rates.
- **The screens speak our internal vocabulary:**
  - "campaign", "pinned revision 7c540e8";
  - "Author storey height" ×9 on the project home;
  - Basis "Transcribed / Defaulted / Derived", Coverage "Partly declared";
  - "No class sighted in this campaign bears this kind, so no cell stands for it".
- **The project home is an audit log.** It lists our acts. It does not show what is measured, what
  is left, or what it will cost.
- **The money is missing.** The estimate, which is where the value and the money are, was deferred
  behind a perfect takeoff that never arrived.

### 5. Visible quality defects that the gates did not catch

- **One level, two spellings.** In one bill, the foundation level is "FDN" (item 1.1.1) and
  "Foundation" (item 1.3.1).
- **The level tree is unordered and duplicated:** Foundation, GF, 1F, 1ST, ROOF, SRR, 2F, 4F.
- **Grid coordinates render in lakh grouping** (12,00,000.0): the money format was applied to
  millimetres.
- **The first sheet looks empty.** A beam layout opened with 2 of 20 layers drawn, so the sheet
  looked empty until a toggle was pressed. The drawing fills about a third of the canvas, and its text
  is illegible.
- **Test artefacts show in the demo:** the workspace is named "Golden Legs mufzf9bciit" and the user
  appears as a test email.
- **Wrong or misplaced readouts.** The AI cost is shown in USD in a ৳ product. A CAD status bar
  (Sheet, Scale, Coordinates, Snap) sits on every page, including the projects list.
- **The register footer adds unlike quantities:** pcs, m, m³, m² and kg on one line.
- **The BOQ does not read like a BOQ.** Item descriptions are generated phrases ("measured net of its
  reinforcement — columns"), not SoR items, and carry no item codes.

### 6. The architecture is heavy for a product with no users

- **The stack:** Next.js 16, tRPC, Postgres with 75 migrations, pg-boss, a Python CAD lane, Typst
  documents, a fixture model transport, six seams and a per-area registry for everything.
- **The cost of a feature.** Every feature crosses all of it, and parallel agents collide on shared
  registries. That is why a wave needs an integration script.

## What is worth carrying into the reset (lessons and knowledge, not code)

- **The Trace.** Every figure links to where it was read on the drawing. It is a real differentiator,
  and the owner liked it. Keep the idea.
- **Honesty about coverage.** Say what is not measured, and never over-measure. Keep the principle,
  but as information beside a figure the human can complete, not as a wall.
- **The domain knowledge**, written in the Bible and the Design Decisions:
  - IS 1200 and BNBC measurement rules;
  - BBS practice and PWD conventions;
  - the Edison dissection (how real Bangladeshi drawings are organised).
- **The DWG know-how:** LibreDWG's failure modes, text healing, and ezdxf's extraction.
- **The live-Jev experience:** closed questions are cheap (Ask cost under 1 cent) and reliable for
  routing and classification.
- **The harness habits that paid off:** look at the product in the browser, and treat only a tool
  result as evidence.

## What session 10 should settle, from this review

1. **Human-driven or machine-driven.** The QS drives takeoff, with AI proposing and one-click
   confirming. Full auto-reading with refusals is what failed here.
2. **Real drawings from day one.** Validate on real Bangladeshi drawing sets, with permission, from
   the first week. Never again against drawings we author ourselves.
3. **The money in the loop early.** Rates (PWD SoR), amounts and a priced BOQ in the first milestone,
   not the tenth.
4. **Process proportionate to stage.** A lean definition of done that a user can see. Law and
   gates grow with users, not ahead of them.
5. **The stack and the scope,** judged against OpenConstructionERP (running at :8080, docs at
   openconstructionerp.com/docs): what to match, what to beat (UI/UX, AI autonomy, the Trace, local
   standards), and what to leave to them.
6. **The business model:** who pays, for what, and how that differs from OpenConstructionERP's
   open-source strategy.
