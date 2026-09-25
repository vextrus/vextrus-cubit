# Frontend stack for Vextrus

> **Correction, 26 Sep 2026.** The backend is Django + Django Ninja (ADR 0020), not FastAPI; the
> OpenAPI contract and generated types are unchanged. The generated `api-types.ts` is never committed
> (ADR 0022). The 3D and 2D viewer choices are revisited in viewer-3d-budgets.md and
> viewer-2d-fidelity.md.


Question: what frontend stack should Vextrus use for a dense professional web app that AI agents
build fast and well? The screens in scope are the QS's Takeoff with bulk Confirmation of Proposals,
a 2D sheet viewer that shows the Trace, a large editable Priced BOQ grid, the Building Model in 3D,
and the MD's Project Summary. The backend is Python (decided).

Researched 2026-09-25. Evidence comes from official docs, the npm and PyPI registries, the GitHub
API, package source unpacked from npm, and small local measurements (Node 24.19, `uv` Python). The
source ids [F1]… are listed at the end. Licences were read from the registry and GitHub licence
fields on 2026-09-25. Download counts are npm's last-month totals (23 Aug–21 Sep 2026) [F1].

## 0. The answer in one table

| Layer | Recommendation | Licence | Main alternative, and why not |
|---|---|---|---|
| App | **React 19 + TypeScript + Vite SPA**, with **TanStack Router** | MIT | Next.js: its server layer duplicates the Python API. SvelteKit: far less agent training data |
| Server state | **TanStack Query v5** | MIT | — |
| API contract | **FastAPI/OpenAPI 3.1 → `openapi-typescript` types + `openapi-fetch` (+ `openapi-react-query`)** | MIT | Hey API (pre-1.0). tRPC and GraphQL are ruled out (§1.3) |
| Forms | **React Hook Form + Zod**, through shadcn's `Form` | MIT | TanStack Form (newer and less known to agents) |
| Components and styling | **Tailwind v4 tokens + shadcn/ui copied into the app** (Radix primitives) | MIT | Mantine, MUI and antd: a component package we don't own. No separate design-system package |
| BOQ grid | **TanStack Table + TanStack Virtual**, inside one owned `BoqGrid` module | MIT | AG Grid Community lacks tree data, clipboard and range selection (Enterprise costs $999 per developer). Glide is canvas-based and stale. Handsontable is not free for commercial use |
| 2D sheet viewer | **One Sheet Viewer, two backdrops, one overlay:** DWG→DXF via **dxf-viewer** (three.js); PDF via **pdf.js**; the Trace highlight is our own overlay in sheet coordinates | MPL-2.0 (unmodified); Apache-2.0 | deck.gl on our own entity JSON is the fallback if dxf-viewer fails on real sets |
| 3D viewer | **Three.js directly**, rendering a GLB the backend emits (one node per element, carrying our element id) | MIT | That Open (MIT/MPL) is kept for viewing clients' IFC. Speckle has no IFC loader and pins old three. xeokit is AGPL |
| Excel | **XlsxWriter** (write), **openpyxl** (read), both server-side | BSD-2; MIT | SheetJS: npm copy frozen at 0.18.5. ExcelJS: client-side, and a second number formatter |
| PDF | **WeasyPrint** (HTML/CSS → PDF), server-side | BSD-3 | Typst (good, but a new language for agents). ReportLab (low-level). No AGPL (PyMuPDF, iText) |
| Number formatting | **One rule table, two implementations:** `Intl.NumberFormat("en-IN")` in TS, Babel `en_IN` in Python, one shared test table | built-in; BSD-3 | `en-BD` formats with Western grouping (§7) |
| Desktop | **None: web only** | — | Electron failed in vextrus-erp. The 3D share link and the MD's page are web links anyway |

A plain warning before the detail: **the stack will not make the UI good.** OpenConstructionERP
(OCE), which ranks lowest on UI/UX, already runs React 18, Vite, Tailwind 3, TanStack Query, AG Grid
Community, three.js, pdf.js and `openapi-typescript` (`~/reference/openconstructionerp/frontend/package.json`).
The old Cubit ran Next.js 16, React 19, Radix and TanStack Table 9 (`/home/riz/vextrus-cubit/package.json`)
and still shipped the defects listed in `docs/postmortem.md` cause 5. Both used much the same parts
we recommend here. Quality has to come from the practice in §8, not from the choice of library.

---

## 1. App framework

### 1.1 React + Vite SPA (recommended)

- React's docs recommend a framework (Next.js, React Router, Expo). For "special constraints" they
  also document building from scratch with Vite, Parcel or Rsbuild, noting that you then choose your
  own routing and data fetching [F2].
- Our constraint is real. The API, the auth, the domain logic and every number live in Python. The
  browser app is a client of that API, and a static SPA served by a CDN or by the Python server is
  the simplest thing that fits.
- **Routing: TanStack Router.** It offers fully type-safe routes and "type-safe search params"
  (parsed and validated JSON in the URL, "like having `useState` right in the URL"), with loaders that
  work with TanStack Query [F3]. That suits view state that must survive a reload or a shared link:
  the Takeoff Step, the selected storey, the grid filter, the sheet and the zoom. It has been at v1
  since Dec 2023 [F1a], so agents have seen a stable API. React Router is the alternative, but its
  v8 came out in Jun 2026 [F1a], so agents' knowledge of it is split across v6, v7 and v8.
- **Server state: TanStack Query v5** (v5 since Oct 2023; 233M downloads a month) [F1, F1a]. It is
  the default in React. OCE uses it too. It is the one place for cache, refetch and optimistic
  Confirmation.
- **Client state:** the URL first (the router), then `useState` and context. Add `zustand` (MIT)
  only for the viewer's selection bus shared between the grid, the 2D sheet and the 3D model [F1].

### 1.2 Why not Next.js or SvelteKit

- **Next.js** (MIT, 16.3.6) can build a strict SPA or a static export. Its own guide sells the
  server features (Server Components, Server Actions, streaming from a server `fetch`), and "Next.js
  server features are not supported with static exports" [F4]. With a Python backend, using those
  features means a second, Node server between the browser and the API: two backends and two auth
  paths. Not using them leaves a SPA with a heavier router.
  - Browser-only libraries (three.js, pdf.js, dxf-viewer) must be wrapped in
    `next/dynamic(..., { ssr: false })`, because client components are prerendered at build [F4].
    That is one more rule agents can get wrong on every viewer screen.
  - Cubit ran Next.js 16 with tRPC and a TS backend, so that combination has been tried here. It was
    not the reason Cubit failed, but it does not fit a Python API.
- **SvelteKit** (MIT) is good, but agents know it much less well. `svelte` has 19.7M downloads a
  month against React's 633M (about 32 times fewer). Svelte 5 (Oct 2024) changed the component
  syntax (runes), so older training data teaches the wrong idiom [F1, F1a]. Svelte publishes
  `llms.txt` docs for LLMs [F5], which helps but does not close that gap.
- **Download counts as a proxy for how well agents write it.** A download is not a measurement of
  agent skill. It is the best public proxy for how much code in a framework's idiom exists. React,
  Tailwind (459M a month) and TanStack Query dominate [F1]. No benchmark of Claude by framework was
  found. That is **unknown**.

### 1.3 Talking to the Python API

- **Recommended: OpenAPI as the single contract.** FastAPI generates OpenAPI and documents
  generating TypeScript clients from it. It names Hey API for TypeScript, recommends a custom
  `generate_unique_id_function` with tags for clean operation names, and lists the benefits:
  autocompletion, inline type errors, and a build that fails when the client and server drift [F6].
- **Pick `openapi-typescript` + `openapi-fetch` + `openapi-react-query` (all MIT).**
  - They generate types only. No runtime code is generated.
  - `openapi-react-query` is "a type-safe tiny wrapper (1 kb)" over TanStack Query. Calls read as
    `useQuery("get", "/projects/{id}", …)` [F7], so the path in the frontend matches the route in
    Python. That gives one obvious place and makes it greppable, which suits agents.
  - OCE uses `openapi-typescript` too, driven by an `api:generate` script (OCE `frontend/package.json`).
- **Alternative: Hey API** (`@hey-api/openapi-ts`, MIT). It generates a full SDK plus TanStack Query
  `…Options`/`…Mutation` helpers [F8], and FastAPI's docs point to it [F6]. It is still 0.x (0.99.0)
  [F1a], so breaking changes are expected. If chosen, pin the exact version.
- **Rule for agents:** a CI step regenerates `api-types.ts` from the running backend's
  `/openapi.json` and fails if the file differs from the committed one. A contract change is then
  visible in one diff.
- **Rejected:**
  - **tRPC.** It infers its contract from a TypeScript server router. Its docs frame it for
    "full-stack TypeScript projects" [F9], and our server is Python.
  - **GraphQL with codegen.** vextrus-erp's stack "slowed agentic coding to a crawl" (postmortem
    cause 6). REST + OpenAPI gives the same typed client with one moving part fewer.

### 1.4 Forms

shadcn documents React Hook Form, TanStack Form and Formisch [F10]. Use **React Hook Form 7 + Zod 4**
(both MIT) [F1]: it is the most common pairing in agent training data. Most dense editing, though,
happens in the grid, not in forms.

---

## 2. Components and styling

### 2.1 Tailwind v4 + shadcn/ui (recommended)

- **shadcn/ui is "not a component library" but "how you build your component library".** It gives
  open code you copy into the app and edit. It lists "AI-Ready: open code for LLMs to read,
  understand, and improve" among its principles [F11]. The components live in our `src/ui/`, in our
  repository, styled by our tokens. That avoids both of vextrus-erp's failures: there is no
  separate design-system package and no unstyled library to style from nothing.
- **Tailwind v4 `@theme`:** "Theme variables are special CSS variables defined using the `@theme`
  directive that influence which utility classes exist" [F12]. Our design tokens (colour, type
  scale, spacing, radius, density, status colours for Proposal and Confirmed) are therefore one
  CSS file. Utilities come from it, and the same variables can be read by canvas and WebGL code
  (the 2D overlay and the 3D status colours), so one palette serves both the DOM and the viewers.
- **Licences:** shadcn MIT; Radix primitives (`radix-ui`) MIT; Tailwind MIT; lucide-react ISC [F1, F13].
- **Versions:** shadcn CLI 4.x (Mar 2026) and Tailwind 4 (Jan 2025) [F1a]. Tell agents the major
  versions in CLAUDE.md, and use context7 for live docs: much older Tailwind 3 config code exists
  in training data.

### 2.2 Rejected

- **Mantine** (MIT, v9 since Mar 2026; 8.9M downloads a month) [F1, F1a]. It is a good, complete
  kit, but it is a package we style through its own theme system rather than code we own, and it
  would sit beside Tailwind rather than replace it.
- **MUI and antd.** They look like themselves (Material, Ant) and fight a dense, custom QS look.
  antd has 13.5M downloads a month, MUI 36.5M [F1].
- **A separate `@vextrus/ui` package.** vextrus-erp tried one and it failed (postmortem). Keep one
  app and one `src/ui/`.

### 2.3 The BOQ grid

**What the Priced BOQ grid needs:**
- a hierarchy (trade → item → Rate Analysis resources) with expand and collapse;
- a few thousand rows, virtualised;
- inline editing of rates, descriptions and lump-sum MEP items (most quantities come from the
  Takeoff and are read-only);
- keyboard-complete entry (Tab and Enter walk the row, which OCE broke: walk finding 13);
- copying out to Excel;
- clicking a quantity to open its Trace.

| Option | Licence | Fit |
|---|---|---|
| **TanStack Table 8/9 + TanStack Virtual** (recommended) | MIT [F1] | Headless: "logic, state, processing, and APIs… but do not provide markup, styles". Pairs with TanStack Virtual to "virtualize thousands of rows" [F14]. shadcn's Data Table is built on it, on purpose ("every data table… is unique") [F15]. Hierarchy (sub-rows and expansion) is in the free core. We build the keyboard, clipboard and edit behaviour ourselves, once, in `BoqGrid`. The cells are real DOM, so the chrome-devtools a11y snapshot can read them (§8) |
| AG Grid Community | MIT [F16] | Row grouping, tree data, clipboard operations, range selection, Excel export and the context menu are all **Enterprise** [F16, F17]. Community alone lacks the BOQ's hierarchy and paste |
| AG Grid Enterprise | Commercial EULA, **$999 per developer**, perpetual with 1 year of updates [F18] | Everything is built in. **Fallback** if our `BoqGrid` keyboard and paste quality falls short in the prototype. Check the EULA on who counts as a "developer" when agents write the code |
| Glide Data Grid | MIT; canvas, "millions of rows" [F19] | Last release v6.0.3 on 3 Feb 2024 [F20]. Canvas cells are invisible to the a11y tree our visual review reads. We don't need millions of rows |
| Handsontable | Commercial use "strictly limited to evaluation, development and testing" without a paid key [F21] | Rejected |

**Version caution:** TanStack Table **v9.0.0 was published on 4 Aug 2026** [F1a]. Agents know v8
(since 2022) far better. Cubit used 9.2.4. Decide once: pin v8 for agent fluency, or take v9 and
give agents its docs through context7. Recommendation: **v9 plus context7**, since v8 will fall
behind.

---

## 3. The 2D sheet viewer (the Trace)

**Requirement:** show a DWG-derived or vector-PDF sheet faithfully, pan and zoom smoothly on large
sheets, and highlight the entities a figure was read from (and the Proposals of the current Takeoff
Step), in status colours.

**Recommendation: one `SheetViewer` component with two backdrops and one overlay.**

1. **DWG sheets:** the backend runs LibreDWG → DXF (subprocess, as already decided in
   `2d-to-bim-approaches.md`), and the browser renders the DXF with **dxf-viewer** (MPL-2.0, 1.0.49,
   three.js 0.186) [F1, F22].
   - It is built "for drawing huge real-world files": geometry batching, instanced block references
     and parsing in a web worker [F22].
   - It has **no entity picking or highlight API.** Its public events are pointer events in scene
     coordinates, and its batches merge entities by layer. It does expose `GetScene()`,
     `GetCamera()`, `GetOrigin()`, `FitView()` and `ShowLayer()` (read in `src/DxfViewer.js` of the
     npm package). So the Trace overlay is **our own three.js geometry added to its scene**, built
     from the entity outlines the backend already knows (ezdxf handles → coordinates).
   - Its README lists what is not fully supported: line patterns, some hatching, wide polylines,
     dimension styling, leaders, and non-UTF-8 encodings [F22]. It reads DXF only [F22].
   - MPL-2.0 is file-level copyleft, as with web-ifc: use it unmodified, or publish our changes to
     its files [F22] (licence table in `2d-to-bim-approaches.md`).
   - A model space holding many sheets side by side is shown one sheet at a time with `FitView` to
     the sheet's bounds.
2. **Vector-PDF sheets:** **pdf.js** (`pdfjs-dist`, Apache-2.0, 6.3.289) [F1, F23].
   - Its viewer caps a canvas at `maxCanvasPixels` = 2²⁵ pixels (5,242,880 on iOS and Android),
     `maxCanvasDim` 32767.
   - At high zoom it re-renders only the visible area into a "detail canvas" (`enableDetailCanvas`
     defaults to true; the `PDFPageDetailView` class) (read in `web/pdf_viewer.mjs` of the npm
     package).
   - The Trace overlay is an SVG or canvas layer positioned with the page viewport transform, fed
     with the PDF-space coordinates our Python reader (pdfplumber or pypdfium2, ADR 0014) extracted.
3. **The overlay is the product.** Highlights, Proposal and Confirmed colours, the hover card and
   click-to-Trace are one module fed by one API shape: sheet id, entity id, and outline in sheet
   units. The backdrop is interchangeable.

**Alternatives:**
- **deck.gl** (MIT) on our own entity JSON is the **fallback** if dxf-viewer renders real
  consultant sets badly. It has GPU picking (`pickable`, `onHover`, `onClick`; up to 255³−1
  pickable objects per layer) [F24]. We would own text and hatch rendering, which is real work.
- **PixiJS** (MIT) is a general 2D scene graph. It has no CAD entities and no picking model suited
  to 100k line entities, so everything would be ours. Rejected in favour of the two above.
- **Server-rendered SVG or PNG tiles from ezdxf** are good for AI and for thumbnails, not for
  interactive highlighting. ezdxf's PDF backend uses PyMuPDF, which is AGPL, so use only its SVG and
  PNG paths if this is ever needed.
- **Plain three.js on our own JSON** would mean re-building what dxf-viewer already does.

**Unknown until measured:** dxf-viewer's load time and pan frame rate on the Edison DWGs (converted
by LibreDWG), and pdf.js on an A1 structural sheet. These are the first spike's numbers (§9).

---

## 4. The 3D Building Model viewer

**Requirement:** a G+10 RCC frame of a few thousand members (estimated in
`2d-to-bim-approaches.md`, open question 8). Colour by status (Confirmed, Proposal, open Question).
Show Proposals, which by definition are not yet in the Building Model or the IFC. Isolate a storey.
Click an element to reach its BOQ lines and Trace. Also a read-only share link for the MD (ADR 0016).

**Recommendation: Three.js directly (MIT, 0.186; 57.9M downloads a month) [F1], rendering a GLB the
backend emits.**
- **Why not IFC in the browser.** The viewer must show things that are not in the IFC (Proposals,
  ghosted), and its colours change on every Confirmation. The Building Model's identity is our
  element id, not an IFC GUID. So the backend emits **one GLB per project state**, one node per
  element, with our element id in the node's extras, built with `trimesh` or `pygltflib` (both MIT)
  [F25], or with IfcOpenShell geometry. Status is just a colour per id sent through the API.
- **Rendering.** `BatchedMesh` renders many objects "with the same material but with different
  geometries" in few draw calls, with per-object `setColorAt` and `setVisibleAt` [F26]. That is
  exactly the job of colouring by status and isolating a storey. Picking uses `Raycaster` with
  `three-mesh-bvh` (MIT) [F1]; `camera-controls` (MIT) gives orbit and fit [F1].
- **Why agents do better here.** Three.js has about 325 times the downloads of
  `@thatopen/components` (57.9M against 179k a month) [F1]. That Open also went through three
  majors (1.x Apr 2024, 2.0 May 2024, 3.x Jul 2025) [F1a], so agents' memory of its API is
  unreliable.

**Keep That Open for IFC-in, later.** `@thatopen/components` and `@thatopen/fragments` are MIT, and
web-ifc is MPL-2.0 [F1, F27].
- Fragments claims to "handle millions of elements in seconds" (FlatBuffers-based), with an
  `IfcImporter` that runs in the browser or on a server [F27].
- Its model API has `setColor`, `resetColor`, `highlight` and `setVisible` by local id, and the
  components ship `Highlighter`, `Hider` and `Classifier` (read in the 3.4.x `.d.ts` files).
- When a client uploads their own IFC or RVT-exported IFC, or a model grows far past a G+10 frame,
  That Open is the ready answer. It is built on three.js [F28], so the two share a renderer.

**Rejected:**
- **Speckle viewer** (Apache-2.0). Its loaders are for Speckle objects and OBJ (`SpeckleLoader`,
  `ObjLoader`; no IFC loader in 2.31.14), and it pins three `^0.140.0` (read in the npm package).
  It assumes Speckle's server.
- **xeokit.** AGPL-3.0 [F29].
- **IFC.js.** This is That Open's old name (see `2d-to-bim-approaches.md` §3.9).

**Unknown:** frame rate and GLB size for a real G+10 model, which the first spike measures.

---

## 5. Excel and PDF output (server-side, in Python)

**Put both on the server.** The numbers, the Display Units, the Measurement Rules and the Trace all
live in Python, and OCE's screen and PDF disagreed on grouping (walk finding 16). One formatter
behind both outputs removes that class of defect.

- **Excel:**
  - **XlsxWriter** (BSD-2-Clause, 3.2.9): "full formatting", formulas, merged cells, defined names,
    autofilters, and a memory-optimisation mode for large files [F30, F31].
  - **openpyxl** (MIT, 3.1.5) for *reading* Excel: rate libraries, Market Price uploads [F30].
  - Lakh grouping in Excel needs a conditional custom number format, for example
    `[>=10000000]##\,##\,##\,##0.00;[>=100000]##\,##\,##0.00;##,##0.00`. I wrote one with XlsxWriter
    but **could not check how Excel displays it** (no Excel or LibreOffice here). Owner check needed.
  - **Rejected:**
    - **SheetJS.** Apache-2.0, but "the latest version on [the npm] registry is 0.18.5"; current
      builds come only from its CDN [F32], so a plain `npm i xlsx` gets a stale copy.
    - **ExcelJS** (MIT). A client-side export would be a second formatter.
- **PDF:**
  - **WeasyPrint** (BSD-3-Clause, 70.0) turns HTML/CSS into PDF [F30, F33]. It supports CSS Paged
    Media: `@page` margin boxes, page counters and running elements [F34].
  - **Measured here:** a 400-row A4 BOQ rendered to 8 pages in **0.8 s**, and the `<thead>`
    **repeated** at the top of page 2 (checked by text extraction).
  - Relying on system fonts (a `'Noto Sans', sans-serif` stack, with no Noto installed), **৳ came out
    as a tofu box**. I checked this on a rendered image of page 2. With Noto Sans Bengali
    (OFL-1.1, which has U+09F3) embedded through `@font-face`, ৳ rendered and extracted correctly.
    OCE showed ৳ as tofu (walk §1), so **always embed the font; never trust the server's fonts.**
  - Its system dependency is Pango ≥ 1.44 [F33]. Its docs advise sandboxing and limits for untrusted
    HTML [F33]; ours is our own template.
  - Agents write HTML/CSS templates well.
  - **Alternative: Typst** via `typst-py` (Apache-2.0) [F35, F36]. It is fast and typographically
    excellent, but a new markup language for agents.
  - **Rejected:** ReportLab (BSD) is low-level canvas code for tables. Anything AGPL (PyMuPDF,
    iText) is out, as ADR 0014 requires. Headless-Chrome printing adds a browser to the server.

---

## 6. Desktop: web only

- vextrus-erp shipped Electron, and its stack "slowed agentic coding to a crawl" (postmortem
  cause 6). OCE carries a Tauri app with a PyInstaller sidecar (`~/reference/openconstructionerp/desktop/`).
  That is a second product to build, sign and update.
- What the MVP gives away is web-shaped: the MD's Project Summary and a "read-only 3D link to the
  Building Model" (ADR 0016). The "done with you" Vextrus Engineer (ADR 0012) needs nothing
  installed.
- **Web only is right for the MVP.** If an offline or on-premises need appears later, the SPA can be
  wrapped then (a Vite SPA is the easiest thing to wrap). Nothing in this stack blocks that.
- One licence note for a future on-prem build: MPL-2.0 (dxf-viewer, web-ifc) stays fine when
  distributed unmodified. LibreDWG must stay a subprocess (`2d-to-bim-approaches.md` §5).

---

## 7. Money and number formatting (measured)

Node 24.19 (`Intl`, ICU) and Python Babel 2.18 (BSD-3) [F30], for 123,456,789.5:

| Call | Output |
|---|---|
| `Intl.NumberFormat("en-IN")` | `12,34,56,789.5` |
| `Intl.NumberFormat("en-IN",{style:"currency",currency:"BDT",currencyDisplay:"narrowSymbol"})` | `৳12,34,56,789.50` |
| `Intl.NumberFormat("en-IN",{style:"currency",currency:"BDT"})` | `BDT 12,34,56,789.50` |
| `Intl.NumberFormat("en-BD",{style:"currency",currency:"BDT"})` | `BDT 123,456,789.50` (**Western grouping**) |
| `Intl.NumberFormat("bn-BD",…)` | Bengali digits (not wanted: the MVP is English, ADR 0016) |
| `Intl.NumberFormat("en-IN",{notation:"compact"})` | `12Cr` (1,250,000 → `13L`) |
| Babel `format_currency(…,'BDT',locale='en_IN')` | `BDT12,34,56,789.50` |

**Rules that follow:**
1. Money uses the **`en-IN` locale with BDT and `narrowSymbol`**, never `en-BD`.
2. Grouping applies to **money only**, never to lengths or coordinates (ADR 0008, postmortem cause 5).
   Formatting is a function of a value's *kind* (money, quantity with a unit, coordinate), never a
   global number formatter. The type system should make "format a coordinate as money" impossible.
3. The compact `Cr` and `L` forms round hard (`13L`). Use them only in the MD's tiles, with the exact
   figure on hover.
4. **One test table** (value, kind, unit → expected string) in the repo is run by both the TS and the
   Python formatter, so screen, Excel and PDF agree.
5. The web font stack must include a face with ৳ (for example Noto Sans Bengali through a
   `unicode-range` subset). A Latin-only UI font (Inter, IBM Plex Sans, Noto Sans Latin subsets)
   lacks U+09F3 (checked with fontTools on the fontsource files).

---

## 8. UI quality practice (what the stack cannot give)

- **Design tokens first.** Write one `tokens.css` (`@theme`) before any screen: a neutral scale,
  one accent, semantic status colours (Proposal, Confirmed, Question, over Target Cost), a dense
  type scale with tabular numerals for figures, and 4 px spacing. The viewers read the same
  variables. The agent rule is **no raw hex colours and no arbitrary pixel values in components.**
- **The work surface is the page** (OCE walk §4.5). There are no explainer banners, and the first
  BOQ row sits near the top at 1440×900. Test that position as a number in the review.
- **Visual review in the running product with the chrome-devtools MCP**, every slice:
  - `take_snapshot` reads the page through the **a11y tree**. DOM grids and real buttons are
    therefore reviewable by an agent, and canvas-only widgets are not. That is one more reason to
    avoid a canvas grid.
  - `take_screenshot` in light and dark, and at 1440×900 and 390×844.
  - `lighthouse_audit` covers accessibility.
  - `performance_start_trace` covers INP and LCP on the BOQ and the viewers.
  - The review uses the `product-review` skill and the `ux-critic` and `qs-critic` agents, and
    judges on the Sample Project and the Independent Set (ADR 0005).
- **Keyboard-complete** grid and Confirmation: Tab and Enter walk the row, Space confirms, and
  ↑/↓ move between Proposals. There is a Playwright test per keyboard path, because OCE's Tab bug is
  exactly what a click-only test misses.
- **One number, one source.** Every total on screen names its bill and revision (walk §4.1). The
  Project Summary reads the same endpoint as the BOQ footer.
- **Pin major versions in CLAUDE.md** (React 19, Tailwind 4, shadcn 4, TanStack Table 9, TanStack
  Router 1, three 0.18x), and point agents to context7 for them.

---

## 9. Risks and what to prove first

1. **dxf-viewer on real sets.** Its rendering gaps (hatches, dimensions, line types) [F22] may make
   Edison sheets look wrong. *Spike:* LibreDWG → DXF → dxf-viewer on three Edison sheets. Measure
   the load time and pan frame rate, and judge fidelity by eye against the PDF print. Fallback:
   deck.gl on our own entities.
2. **The `BoqGrid` keyboard and clipboard work is ours.** *Spike:* a 2,000-row hierarchical grid
   with Tab and Enter entry, paste from Excel, and virtualised scroll. If it takes more than a few
   days to reach spreadsheet quality, buy AG Grid Enterprise ($999 per developer [F18]).
3. **Very new majors** (TanStack Table 9, React Router 8, shadcn 4, Vite 8) [F1a]. Agents may write
   old APIs. Pin versions and use context7.
4. **Hey API is pre-1.0** if chosen instead of openapi-typescript.
5. **Two formatters (TS and Python).** They are held equal only by the shared test table (§7).
6. **Lakh format in Excel** is unverified in Excel itself (§5).
7. **3D performance** of the GLB approach on a real G+10 model is unmeasured. The fallback is That
   Open Fragments.
8. **MPL-2.0 files** (dxf-viewer, web-ifc) must not be modified in place without publishing the
   changes. Vendor them untouched, or fork them in public.

---

## Sources

- [F1] npm registry `/<pkg>/latest` licence and version fields, and `api.npmjs.org/downloads/point/last-month/<pkg>`, fetched 2026-09-25. Monthly downloads: react 632.9M, next 197.6M, svelte 19.7M, @sveltejs/kit 9.2M, vue 57.0M, @angular/core 21.9M, tailwindcss 459.2M, @tanstack/react-query 233.0M, @tanstack/react-table 69.3M, ag-grid-community 11.8M, @glideapps/glide-data-grid 1.18M, @mantine/core 8.9M, @mui/material 36.5M, antd 13.5M, three 57.9M, @thatopen/components 179k, web-ifc 674k, dxf-viewer 144k, pdfjs-dist 90.3M, openapi-typescript 26.0M, @hey-api/openapi-ts 16.7M, @trpc/client 16.1M, graphql 170.7M, react-router 192.2M, @tanstack/react-router 78.3M, electron 24.7M, xlsx 43.0M, exceljs 52.8M. Licences: all MIT (including radix-ui, react-hook-form, zod, zustand, camera-controls, three-mesh-bvh, @tanstack/react-virtual) except pdfjs-dist Apache-2.0, dxf-viewer MPL-2.0, web-ifc MPL-2.0, @speckle/viewer Apache-2.0, xlsx Apache-2.0, handsontable "SEE LICENSE", lucide-react ISC, @fontsource Noto Sans Bengali and Inter OFL-1.1.
- [F1a] npm registry `time` field (first release of each major, and latest): @tanstack/react-table 9.0.0 on 2026-08-04; react-router 8.0.0 on 2026-06-17; @tanstack/react-router 1.0.0 on 2023-12-23; @tanstack/react-query 5.0.0 on 2023-10-17; svelte 5.0.0 on 2024-10-19; tailwindcss 4.0.0 on 2025-01-21; shadcn 4.0.0 on 2026-03-06; @mantine/core 9.0.0 on 2026-03-31; vite 8.0.0 on 2026-03-12; @thatopen/components 1.5.0 on 2024-04-29, 2.0.0 on 2024-05-22, 3.1.0 on 2025-07-10; @hey-api/openapi-ts latest 0.99.0 on 2026-06-22.
- [F2] React, "Creating a React App": https://react.dev/learn/creating-a-react-app
- [F3] TanStack Router overview: https://tanstack.com/router/latest/docs/framework/react/overview
- [F4] Next.js 16.3.6, "How to build single-page applications": https://nextjs.org/docs/app/guides/single-page-applications
- [F5] Svelte, "Docs for LLMs": https://svelte.dev/docs/llms
- [F6] FastAPI, "Generating SDKs": https://fastapi.tiangolo.com/advanced/generate-clients/
- [F7] openapi-react-query: https://openapi-ts.dev/openapi-react-query/
- [F8] Hey API, TanStack Query plugin: https://heyapi.dev/openapi-ts/plugins/tanstack-query
- [F9] tRPC docs introduction: https://trpc.io/docs
- [F10] shadcn/ui Forms: https://ui.shadcn.com/docs/forms
- [F11] shadcn/ui Introduction: https://ui.shadcn.com/docs
- [F12] Tailwind CSS, "Theme variables": https://tailwindcss.com/docs/theme
- [F13] GitHub API licence fields, 2026-09-25: shadcn-ui/ui MIT; mantinedev/mantine MIT; TanStack/table MIT; glideapps/glide-data-grid MIT; vagran/dxf-viewer MPL-2.0; mozilla/pdf.js Apache-2.0; ThatOpen/engine_components MIT; ThatOpen/engine_fragment MIT; ThatOpen/engine_web-ifc MPL-2.0; xeokit/xeokit-sdk AGPL-3.0; pixijs/pixijs MIT; visgl/deck.gl MIT; mrdoob/three.js MIT; SheetJS/sheetjs Apache-2.0; Kozea/WeasyPrint BSD-3-Clause; typst/typst Apache-2.0; messense/typst-py Apache-2.0; jmcnamara/XlsxWriter BSD-2-Clause.
- [F14] TanStack Table overview: https://tanstack.com/table/latest/docs/overview
- [F15] shadcn/ui Data Table: https://ui.shadcn.com/docs/components/data-table
- [F16] AG Grid, "Community vs Enterprise": https://www.ag-grid.com/react-data-grid/community-vs-enterprise/
- [F17] AG Grid, Tree Data (marked enterprise): https://www.ag-grid.com/react-data-grid/tree-data/
- [F18] AG Grid pricing: https://www.ag-grid.com/license-pricing/
- [F19] Glide Data Grid README: https://github.com/glideapps/glide-data-grid
- [F20] GitHub API, glideapps/glide-data-grid releases (v6.0.3, 2024-02-03)
- [F21] Handsontable software licence: https://handsontable.com/docs/javascript-data-grid/software-license/
- [F22] dxf-viewer README: https://github.com/vagran/dxf-viewer ; package source `dxf-viewer@1.0.49` `src/DxfViewer.js` (public methods and events), read locally
- [F23] pdf.js: https://github.com/mozilla/pdf.js ; package `pdfjs-dist@6.3.289` `web/pdf_viewer.mjs` (`maxCanvasPixels`, `maxCanvasDim`, `enableDetailCanvas`, `PDFPageDetailView`), read locally
- [F24] deck.gl, Interactivity / picking: https://deck.gl/docs/developer-guide/interactivity
- [F25] PyPI JSON: trimesh (MIT), pygltflib (MIT), ifcopenshell 0.8.5 (LGPL-3.0+)
- [F26] three.js BatchedMesh: https://threejs.org/docs/pages/BatchedMesh.html
- [F27] That Open Fragments README: https://github.com/ThatOpen/engine_fragment ; `@thatopen/fragments@3.4.7` and `@thatopen/components(-front)@3.4.x` `.d.ts` files, read locally
- [F28] That Open docs, intro: https://docs.thatopen.com/intro
- [F29] xeokit SDK licence (GitHub API AGPL-3.0; see `2d-to-bim-approaches.md` [S48])
- [F30] PyPI JSON, 2026-09-25: openpyxl 3.1.5 MIT; XlsxWriter 3.2.9 BSD-2-Clause; weasyprint 70.0 BSD; reportlab 5.0.1 BSD; typst 0.15.0; babel 2.18.0 BSD-3-Clause; fastapi 0.141.1 MIT
- [F31] XlsxWriter docs: https://xlsxwriter.readthedocs.io/
- [F32] SheetJS, Node.js installation: https://docs.sheetjs.com/docs/getting-started/installation/nodejs
- [F33] WeasyPrint, First steps: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html
- [F34] WeasyPrint, API reference (supported features): https://doc.courtbouillon.org/weasyprint/stable/api_reference.html
- [F35] typst-py README: https://github.com/messense/typst-py
- [F36] Typst: https://github.com/typst/typst
- Local measurements (2026-09-25, scratchpad, not kept):
  - the `Intl` and Babel outputs in §7;
  - the WeasyPrint 400-row test in §5 (0.75–0.82 s, 8 pages, header repeated; ৳ a tofu box on system fonts, correct with an embedded Noto Sans Bengali; checked by pypdf text extraction and a pypdfium2 render);
  - fontTools cmap checks on fontsource files for Inter, Noto Sans, IBM Plex Sans (no U+09F3), Noto Sans Bengali and Hind Siliguri (U+09F3 present).
- In-repo: `docs/postmortem.md`; `docs/research/oce-product-walk.md`; `docs/research/2d-to-bim-approaches.md`; ADRs 0005, 0008, 0012, 0014, 0016; `~/reference/openconstructionerp/frontend/package.json` (stack only, nothing copied); `/home/riz/vextrus-cubit/package.json` (the old Cubit's stack).
