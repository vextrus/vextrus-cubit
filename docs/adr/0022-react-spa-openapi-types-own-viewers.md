# The frontend is a React SPA on generated OpenAPI types, with our own sheet and 3D renderers

- **The app:** React 19 + TypeScript + Vite, in the browser only. TanStack Router and Query, React
  Hook Form + Zod, Tailwind v4 tokens from the design system (docs/design/system.md) with shadcn/ui
  components copied in.
- **The API contract:** TypeScript types generated from the Django API's OpenAPI schema
  (openapi-typescript and openapi-fetch). The generated file is never committed.
- **The BOQ grid:** TanStack Table and Virtual in one module we own; AG Grid Enterprise is the
  fallback if keyboard and paste take more than a few days.
- **The sheet:** the engine's own render buffers, one sheet at a time (never a whole file): thin lines
  as GL_LINES, lines of visible plotted width as quads, text as SDF glyphs, every primitive carrying
  its top-level and nested handles; picking by a CPU R-tree. The QS sees exactly what was read, and a
  Trace highlights exactly that entity. A **Plot** switch shows the consultant's own PDF page
  registered beneath, where one exists. pdf.js serves only that underlay and PDF-only sets.
- **Fonts:** one substitution table with redistributable fonts only (Liberation Sans, Serif and Sans
  Narrow; DejaVu; a single-stroke font for SHX); every upload lists the fonts it substituted. Never
  Autodesk, Bitstream or Monotype files.
- **The Building Model:** plain three.js (WebGL), merged per storey, with a per-element state texture.
  The browser builds the RCC geometry from parametric element data, so a Confirmation is a colour
  patch, never new geometry. A GLB per storey is built on the server for the share link (no IFC export in the MVP; ADR 0035); a CI
  test checks the browser's geometry against the server's per-element volume and bounds. That Open
  is kept only for viewing clients' own IFC.
- **Budgets** (a mid-range Windows laptop, checked on a real one in M0): 3D model on screen ≤ 1.5 s
  warm and ≤ 3 s cold on 10 Mbps, 60 fps with ≤ 8 ms GPU a frame, a Confirmation painted ≤ 16 ms,
  picking ≤ 2 ms, ≤ 100 draw calls; a cached sheet interactive ≤ 1.5 s.
- **Documents:** built on the server, XlsxWriter for Excel and WeasyPrint for PDF, with the ৳ glyph
  embedded.
- **Numbers:** money and quantities group in lakh and crore through `en-IN`, never `en-BD`;
  coordinates and dimensions never group (ADR 0008). Screen, Excel and PDF are checked against one
  shared table of expected formats.

Web only. Rejected: Next.js (a second server), tRPC (a TypeScript server), GraphQL codegen and a
separate design-system package and Electron (the old ERP), xeokit (AGPL), dxf-viewer as the sheet
renderer (measured below), one GLB node per element (measured below).

The stack alone will not make the UI good; quality comes from the design system, prototypes judged
by the owner, and the design gate on every UI PR (docs/sdlc.md).

## History
- 25 Sep 2026: decided (React SPA on generated types; dxf-viewer for sheets, pdf.js for PDFs; plain
  Three.js over a backend GLB with one node per element). Evidence: docs/research/stack-frontend.md.
- 26 Sep 2026 (owner's decision): the sheet and 3D renderers and the font policy, on measurements.
  Evidence: docs/research/viewer-2d-fidelity.md (dxf-viewer hid 2,568 / 2,568 title-block attributes
  and drew no leaders, linetypes or lineweights, F1 0.78–0.93; engine buffers 0.83–0.97; the plot
  1.000 but 0.1–1.3 s to re-render) and docs/research/viewer-3d-budgets.md (one node per element:
  5,846 draw calls, under 60 fps; merged per storey: 1.3 ms GPU with edges, a Confirmation in 17 ms).
  Answers plan review M9 and M10 and architecture critic #8 and #9. The owner's ruling: "Agree".
- 26 Sep 2026 (owner's decision): the budgets hold on the owner's PC with Chrome forced onto the
  integrated GPU (Intel UHD 770, Windows "Power saving") and DevTools' 4× CPU throttle, for M0–M2; and
  on a founding client's own QS computer before M5. The RTX 3060 Ti is never the reference. The
  owner's ruling: "Q55: Agree". The owner's first run was on the RTX 3060 Ti (not the reference):
  sheet S-08 GPU p95 0.87 ms at 60 fps; 3D model on screen 0.32 s, GPU moving p95 1.23 ms,
  Confirmation painted 2.7 ms, pick p95 1.30 ms, 29 draw calls, idle MSAA frame 24 ms.
- 26 Sep 2026: the owner re-ran the sheet and 3D prototypes on the reference setup and reported they
  "still it's managing to hold up and it'll do the work" (figures not captured; to be recorded at
  M0's budget check).
- 26 Sep 2026 (owner's decision, M0 spec, ruling 4): the render check and the sheet's frame budget.
  Every sheet scores F1 ≥ 0.90 against its Plot (within 2 px) and the median ≥ 0.95; pan and zoom on
  the densest sheet hold p95 ≤ 16.7 ms a frame on the reference setup, beside the 1.5 s for a cached
  sheet. The owner's ruling: "Agree with 1–5, No laptop - it was assumed." (docs/specs/M0.md).
- 27 Sep 2026 (owner's decision, session 02 Q12): no IFC export in the MVP. Every Element Family carries
  its IFC class and every attribute definition its IFC property mapping, as data from M1, so an exporter
  is added when the first client or market asks; the share link stays a GLB per storey. The owner's
  ruling: "Agree with A on Q12".
