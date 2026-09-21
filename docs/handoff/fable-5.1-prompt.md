# Claude Fable 5.1 Initiation Prompt: Vextrus Cubit Pre-M4 CAD & Jev Modernization

```markdown
You are Anthropic's Claude Fable 5.1 continuing work on **Vextrus Cubit** in `/home/riz/vextrus-cubit`.

### 1. Context & Starting State
- **Repository:** Vextrus Cubit — an AI-native construction takeoff, cost estimation, and bidding platform adhering strictly to `docs/specs/cubit.bible.xml`.
- **Branches:**
  - `main`: Pristine state containing the original merged slices from the Builder engine (at commit `8cf9f11f`).
  - `dev-lane-and-jev`: The active working branch containing the six commits delivered in the previous session:
    1. Isolated local development lane (`pnpm dev`, `scripts/dev.mjs`, `db/seed.ts`, `storage/dev`, `cubit_dev`).
    2. WSL2/network origin and development CSP `unsafe-eval` allowances (`next.config.ts`, `src/proxy.ts`).
    3. Resilient client-side SHA-256 fallback algorithm for non-secure contexts (`upload-client.ts`).
    4. CAD DWG CLI conversion and handle collision refinement (`cli.py`, `report.py`).
    5. WebGL viewer tool switching (`select` vs `pan`), closed polygon loops, and permission relaxation (`use-pointer.ts`, `painter.ts`, `takeoff.ts`).
    6. Live TypeSafe Jev System One model transport integration (`src/core/model/live.ts`).
- **Essential Reading:** Review `docs/handoff/fable-5.1-session-guide.md` before making architectural modifications.

---

### 2. Primary Objectives (Pre-M4 Scope)

#### A. Resolve DWG Ingestion Failure on Real-World Drawings
- **Issue:** Uploading real-world drawings (e.g. `docs/design/reference/Structural Working Drawing_Edison Lavinia_Final.dwg`) crashes in 4 seconds with `DXFStructureError: Invalid group code: ...` during `ezdxf.readfile()`.
- **Root Cause:** LibreDWG's `dwg2dxf` hard-wraps long `MTEXT` strings (>256 characters) onto new lines without DXF continuation group codes.
- **Action:**
  1. Implement a stream-level tag sanitizer / pre-pass in `cad/src/vextrus_cad/dwg/convert.py` that normalizes wrapped text lines before passing the stream to `ezdxf`.
  2. Verify that `Edison Lavinia` (22,100+ entities, 106 layers) extracts to EntityGraph v2 in under 5 seconds with zero fatal faults.

#### B. Repair Synthetic CAD Fixtures (`F-RCC6` and `F-RCC6-BNBC`)
- **Issue:** Opening `fixtures/rcc6/rcc6.dwg` or `fixtures/rcc6-bnbc/rcc6-bnbc.dwg` in AutoCAD prompts for recovery, and paper space sheets appear blank. In Cubit's viewer, paper space layouts only show the title block.
- **Root Cause:** `fixtures/gen/rcc6.py` explicitly deletes AutoCAD's main viewport (`layout.delete_entity(viewport)`) and places all structural geometry in `model` space, leaving paper space sheets devoid of linework.
- **Action:**
  1. Update `fixtures/gen/rcc6.py` and `fixtures/gen/rcc6_bnbc/` to author compliant, valid AutoCAD viewports connecting paper space layouts to model space extents.
  2. Regenerate the fixtures and verify that AutoCAD opens them cleanly without repair dialogs.
  3. Ensure Cubit's viewer can project viewport-framed model entities onto paper space layouts, or seamlessly view model space partitions.

#### C. CAD Viewer Polish & Native Precision
- **Linework & Polygons:** Render dimension lines, arrows, and tick marks from exploded `DIMENSION` virtual entities with accurate world heights.
- **Layer Visibility:** Support interactive layer freezing and visibility toggling with instant WebGL buffer filtering.
- **Snapping & Two-Point Calibration:** Enable estimators to execute two-point scale affirmation directly in the viewer with live coordinate distance readouts.

#### D. Expand TypeSafe Jev System One Model Integration
- **Foundation:** TypeSafe Jev System One is already live in `src/core/model/live.ts` with API key support (`TYPESAFE_API_KEY`).
- **Expansion:** Extend Jev's fast (<1.5s), zero-hallucination structured choices across all pre-M4 intelligence tasks:
  1. Sheet understanding & title block parsing.
  2. View caption classification (layout plan, member section, long section, schedule, detail).
  3. Scale proposal ranking and corroboration.
  4. Structural schedule table row grouping.
- **Law:** Strictly uphold Bible laws L-AI-01, L-AI-02, and L-AI-03 — Jev emits typed `Proposal<T>` contracts citing original source keys; AI proposes, code resolves, a human disposes.

#### E. Complete & Audit M1–M3 Structural Takeoff Features
- Audit all structural takeoff rails (RCC columns, beams, slabs, footings, tie beams, shear walls, stairs).
- Ensure the golden vectors (`pnpm test:golden`), Bar Bending Schedules (BBS), and unpriced Bill of Quantities (BOQ) exports run deterministically and within tolerance.

#### F. Toolchain Optimization & Invariant Verification
- Maintain exact package pins and checkup compliance:
  - `pnpm verify` (all 10 lanes green: typegen, catalogue-drift, method-hash, schema-drift, golden, types, lint, unit, cad, build)
  - `pnpm checkup` (12/12 machine checks green)
  - `pnpm test` (0 failures, zero ESLint errors)

---

### 3. Execution Discipline
- **Stay on `dev-lane-and-jev`** (or create a dedicated feature branch from it); do not force-push or dirty `main`.
- Follow vertical slices: verify each fix with automated unit/integration tests before moving to the next.
- Commit systematically with descriptive subjects citing relevant Bible clauses.
```
