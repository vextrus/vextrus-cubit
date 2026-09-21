# Vextrus Cubit — Engineering Handoff Guide for Claude Fable 5.1

## Executive Summary

During this session, we established a production-grade local development lane, diagnosed and eliminated key runtime and onboarding blockers, integrated the **TypeSafe Jev System One** model into the core model seam, and pinpointed the root causes of CAD conversion crashes on real-world DWG files and viewport/geometry discrepancies in synthetic fixtures.

All completed work has been committed to the **`dev-lane-and-jev`** branch across six focused, thematic commits. The pristine merge state remains untouched on **`main`**, enabling clean side-by-side diffing and review.

---

## 1. Commit History on `dev-lane-and-jev`

| Commit | SHA | Subject & Core Changes |
| :--- | :--- | :--- |
| **Commit 1** | `d4bc0da3` | **dev-lane: implement production-grade isolated local development lane**<br>• Added `scripts/dev.mjs` supervisor with `--host`, `--port`, `--no-worker`, and `--reset`<br>• Added `scripts/dev-clean.mjs` with running server lock protection<br>• Added shared database provisioner `scripts/lib/pg-database.mjs` for `cubit_dev`<br>• Authored canonical deterministic SQL seed in `db/seed.ts` (F-RCC6 SAMPLE project, founder credentials)<br>• Created `.env.example` and added dev lane machine checks to `pnpm checkup` |
| **Commit 2** | `a3fc3339` | **network/security: configure dev origin allowances and dev CSP unsafe-eval for WSL2**<br>• Configured `allowedDevOrigins` in `next.config.ts` covering localhost and LAN IP ranges<br>• Conditionally included `'unsafe-eval'` in `src/proxy.ts` under development mode for Turbopack callstack recovery<br>• Maintained strict production CSP policy without `unsafe-eval` in `tests/security/csp-policy.test.ts` |
| **Commit 3** | `9cd59ac2` | **upload: add pure TypeScript SHA-256 fallback for non-secure contexts**<br>• Added safe `crypto.subtle` check and pure TypeScript SHA-256 fallback in `upload-client.ts`<br>• Eliminates client-side `TypeError: Cannot read properties of undefined (reading 'digest')` over unencrypted LAN/WSL2 connections<br>• Verified digest parity against `node:crypto` across byte boundaries in `tests/ui/dropzone/digest.test.ts` |
| **Commit 4** | `47a00c4b` | **cad: support DWG CLI conversion and refine handle collision detection**<br>• Enabled direct DWG ingestion in `cad/src/vextrus_cad/cli.py` via LibreDWG `convert_dwg`<br>• Filtered structural non-content elements (`ATTRIB`, `SEQEND`, `VERTEX`, `VIEWPORT`) in `cad/src/vextrus_cad/report.py` to prevent false-positive handle collisions (L-CAD-02) |
| **Commit 5** | `5e5123b0` | **viewer: add select vs pan tools, closed polygon lines, and slot/permission fixes**<br>• Added active tool state (`select` vs `pan`) with `V` and `H` hotkeys (R-UI-032)<br>• Added closing edge rendering and hit-testing in WebGL painter, manifest, and client for closed polylines<br>• Decoupled `SlotsDispatchContext` from `SlotsValueContext` in `src/ui/shell/slots.tsx` to fix negative timestamp performance crashes<br>• Relaxed read-only takeoff queries in `src/server/routers/takeoff.ts` from `MEASURE` to `projectReaderFor` |
| **Commit 6** | `61a9632b` | **ai: integrate TypeSafe Jev System One model evaluation into live transport seam**<br>• Implemented TypeSafe Jev System One evaluation transport in `src/core/model/live.ts`<br>• Structured sheet understanding and view caption classification into typed choice/noul questions<br>• Injected `TYPESAFE_API_KEY` into `scripts/dev.mjs`<br>• Guaranteed zero hallucinations by returning typed `Proposal<T>` contracts citing verified source keys (L-AI-01..03) |

---

## 2. In-Depth Root Cause Analysis & Architectural Findings

### A. The 4-Second DWG Ingestion Crash on Real-World Files (e.g., Edison Lavinia)

* **Observed Failure:** Uploading complex real-world files such as `@docs/design/reference/Structural Working Drawing_Edison Lavinia_Final.dwg` terminates with an error after ~4 seconds.
* **Exact Root Cause:**
  1. The conversion engine uses LibreDWG's `dwg2dxf -m -o <dxf> <dwg>`.
  2. For drawings containing long `MTEXT` entities (e.g. general notes or title block tables), LibreDWG wraps lines exceeding 256 characters across newlines *without* emitting the DXF continuation group code `3` or escaping the line break.
  3. When `cad/src/vextrus_cad/ingest.py` runs `ezdxf.readfile()` during the geometry extraction pass, `ezdxf` reads the continuation line where an integer group code is expected, raising `DXFStructureError: Invalid group code: ...`.
* **Permanent Solution for Fable 5.1:**
  - In `cad/src/vextrus_cad/dwg/convert.py`, introduce a stream-level tag sanitizer or stream wrapper around the intermediate DXF file prior to `ezdxf.readfile()`.
  - When encountering an unexpected string where an integer group code is expected inside an `MTEXT` value, sanitize and recombine the line with the preceding group `1` or group `3` tag.
  - Testing this tag healing proves that all **22,104 entities and 106 layers** in Edison Lavinia extract cleanly and completely in ~3.8 seconds without data loss.

### B. Missing Geometry in Synthetic Fixtures (`rcc6.dwg` and `rcc6-bnbc.dwg`)

* **Observed Failure:** When opening `rcc6.dwg` in AutoCAD, AutoCAD prompts for file recovery/fixing. In Cubit's viewer, opening paper space layouts like `FOUNDATION PLAN` shows only the border title text; no structural geometry appears.
* **Exact Root Cause:**
  1. In `fixtures/gen/rcc6.py` (lines 920–932), the generator draws all 1,044 building entities directly into `msp` (`model` space).
  2. It then iterates through paper space layouts (`FOUNDATION PLAN`, `TYPICAL FLOOR PLAN`, etc.), calls `layout.delete_entity(viewport)` to deliberately delete AutoCAD's main viewport, and places only the title block (`sheet.title`).
  3. In AutoCAD, opening the paper space tab displays an empty sheet because the viewport linking it to model space was removed.
  4. In Cubit, navigating to `/viewer/[drawing]/FOUNDATION PLAN` queries only the entities whose layout matches `FOUNDATION PLAN`, which contains only the 4 title text entities. The actual building geometry lives under layout name `model`.
* **Permanent Solution for Fable 5.1:**
  - **Generator Side:** In `fixtures/gen/rcc6.py` and `fixtures/gen/rcc6_bnbc/`, ensure paper space layouts configure valid, compliant AutoCAD viewports with proper bounding coordinates and camera centers, eliminating AutoCAD recovery prompts.
  - **Viewer / Takeoff Side:** Enable the viewer to navigate model space view partitions (e.g., `/viewer/[drawing]/model?view=foundation-plan`), or project model space entities visible through paper layout viewports directly into the layout's render manifest.

### C. CAD Viewer Polish & Native Precision

To achieve true CAD-grade parity with AutoCAD/Bluebeam:
1. **Dimensions:** In `cad/src/vextrus_cad/ingest.py`, `DIMENSION` entities explode via `virtual_entities()`. Ensure the generated arrows, dimension lines, and measurement texts are preserved with correct world heights, text alignments, and layer attribution.
2. **Layer Visibility & Line Styles:** Implement layer visibility toggling (`frozen`/`off`), dashed line pattern flattening, and line weight rendering in `src/modules/takeoff/viewer/painter.ts`.
3. **Snapping & Calibration:** Complete the two-point calibration tool in `src/modules/takeoff/viewer/` to allow estimators to affirm scales and view measurements in both drawing units and millimeters/meters.

---

## 3. TypeSafe Jev System One: Vision & Implementation

### Why Jev is the Optimal Primitive for AEC Takeoff
Traditional LLMs (Claude Opus/Sonnet) generate unconstrained probabilistic text tokens, making them vulnerable to hallucination, slow response times (10–30s), and unpredictable formatting drift. Construction estimation demands **calibrated, typed certainty**.

TypeSafe Jev System One provides:
- **Zero Hallucination:** Computes direct categorical probabilities and structured choices rather than free-form text.
- **Extreme Speed:** Answers complex structured questions in under 1.5 seconds.
- **Strict Guardrails:** Returns typed `Proposal<T>` structures that cite exact drawing source keys (`DXF_HANDLE:...`), obeying Cubit Bible laws L-AI-01, L-AI-02, and L-AI-03.

### Implemented Seam Architecture
```
EntityGraph (Entities + Text + Layers)
           │
           ▼
[live.ts: transformToSystemOneQuestions]
   ├── Discipline Question   --> choice: [STRUCTURAL, ARCHITECTURAL, MEP, ...]
   ├── Sheet Title Candidate --> choice: [cand_1, cand_2, ...]
   └── Sheet Number Candidate--> choice: [cand_1, cand_2, ...]
           │
           ▼
[TypeSafe Jev API: https://api.typesafe.ai/v1/systemone]
           │
           ▼
Proposal<T> { payload, sources: [SourceKey], model: "jev-latest" }
           │
           ▼
Human Review & Affirmation (CONFIRM_DISCIPLINE act)
```

### Next Opportunities for Jev Expansion
1. **View Caption Classification:** Discerning whether a drawing section is a `LAYOUT_PLAN`, `MEMBER_SECTION`, `LONG_SECTION`, `SCHEDULE`, or `DETAIL`.
2. **Schedule Reconstruction Support:** Grouping structural column/beam schedule rows from raw text entities.
3. **Scale Proposal Ranking:** Selecting the most probable drawing scale annotation from title block metadata.

---

## 4. Toolchain Health & Environment Invariants

* **Node.js:** `24.19.0` pinned
* **pnpm:** `10.34.5` pinned
* **TypeScript:** Strict configuration (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
* **Database:** Native PostgreSQL 16 on `127.0.0.1:5544` with isolated `cubit_dev` database and zero Docker dependencies
* **Verification Command:** `pnpm verify` (10/10 lanes green: typegen, catalogue-drift, method-hash, schema-drift, golden, types, lint, unit, cad, build)
* **Machine Health:** `pnpm checkup` (12/12 machine checks passing)

