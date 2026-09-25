# The Building Model viewer: stack, data path and budgets

Question: which browser 3D stack and data path give a "Revit-grade" Building Model viewer for a G+10
RCC building (edges, section planes, levels, isolate, colour by status, picking), and what load and
frame budgets can we promise?

Researched 2026-09-26 with a throwaway prototype in `.private/work/session-01/viewer-3d/` (not in git).
**Every number comes from a SYNTHETIC model**: a generated G+10 frame used for render budgets only. It is
not a reading of any drawing. Raw results are in that folder under `results/`.

## What failed or is unmeasured (read first)

- **No real laptop was measured.** The GPU numbers come from an Intel UHD Graphics 770, the i9-12900K's
  integrated GPU (256 shaders / 32 EU at 1450 MHz, against 640 / 80 EU at 1250 MHz for the Iris Xe in
  an i5-1235U [V14]). It was reached from WSL through ANGLE → OpenGL → Mesa d3d12 → D3D12, in a
  **headed** Chromium window. Chrome on Windows uses ANGLE's D3D11 backend instead [V15], so real
  laptop costs may be higher or lower. Headless Chrome in WSL (the chrome-devtools MCP browser)
  only gets SwiftShader, so its numbers are relative only.
- **WebGPU is unmeasured on hardware.** WSL exposes only a SwiftShader WebGPU adapter.
- **Network transfer is not measured.** Everything was served from 127.0.0.1. Transfer times below are
  arithmetic from the measured byte sizes.
- **The model is simpler than a real one.** It has 2,923 elements and 67,620 triangles, and no joins
  or booleans beyond profile holes. A 4× tiled copy (11,692 elements, 270k triangles) stands in for a
  denser model.
- **With MSAA on every frame, our first design missed 60 fps** on the 4× model (25.9 ms of GPU per
  frame) and at DPR 1.5 (20.5 ms). The cause is MSAA combined with alpha blending (translucent
  Proposals and blended edges). The fix below, adaptive anti-aliasing, is measured. How much of the MSAA
  cost comes from WSL's D3D12 translation is unknown.
- **Two bugs were found by looking at screenshots, not by the numbers.** First, the stencil caps drew
  nothing: three.js sorts by a Group's `renderOrder` before an object's. Second, coplanar faces
  (a beam top level with a slab top) z-fight. Both were fixed in the prototype and become build rules
  below.

## Conclusions

1. **Stack: three.js `WebGLRenderer` (r186, MIT) with a thin layer we own. Keep ADR 0022's choice of
   three.js, but not its "one node per element" rendering.** Measured on the UHD 770 at 1440×900, with
   adaptive anti-aliasing, the whole model orbits with edges at **1.34 ms GPU p50 and 0.3–0.4 ms CPU per
   frame**. The 4× model takes 4.8 ms, and DPR 1.5 takes 1.85 ms. Every feature asked for works:
   crisp feature edges; plan cut and section box with stencil-capped cuts; storey isolation and a
   level filter; isolate, hide and ghost; colour by status, switched per element without any rebuild;
   hover and click picking that return the element id; orbit, pan and fit to selection.
   - **WebGPURenderer: not now.** WebGPU ships by default in Chrome on Windows (since 113) [V1], but it
     is unmeasured here. Its node materials do not take the `onBeforeCompile` GLSL injection our
     per-element state uses; that would be a rewrite in TSL. Its WebGL2 fallback works (2.45 ms GPU
     orbit) [V2].
   - **That Open (MIT): keep it for clients' own IFC, not for our model.** It orbits fast (1.78 ms, no
     edges). But its default look is flat grey with no edges, its colour and opacity calls on 1,000
     items took from 16 ms to **3.2 s** between repeats, and its bundle is 1.08 MB gzipped against our
     0.26 MB.
2. **Merging strategy: merge per storey, add an element-index vertex attribute, and keep a
   per-element state texture** (colour + opaque/ghost/hidden). Recolouring 1,000 elements takes
   0.2 ms of JS and 7.6 ms including a GPU-synced frame. Storey isolation toggles a whole chunk. The model
   needs 52 draw calls.
   - **One mesh per element** (what loading a one-node-per-element GLB gives you by default) costs
     5,846 draw calls and **22.8 ms of CPU per frame on an i9**, which runs under 60 fps even on this
     desktop. It is rejected.
   - **BatchedMesh** works (1.9–2.2 ms CPU and 2 ms GPU per frame). It is second choice: recolouring is
     twice as slow, it has no line mode, and ghosting needs a second batch.
3. **Status never travels as geometry.** A Confirmation is a status patch to the state texture:
   **16.9 ms** for 100 elements, fetch included. The critic's "re-download the GLB after every
   Confirmation" is therefore avoidable in either data path. Re-downloading the whole GLB costs
   256–285 ms here, plus network, and is never needed for a colour change.
4. **Data path: the client extrudes parametric element JSON into per-storey chunks (the critic's path
   b). GLB (meshopt) and IFC are only for export and the share link.** The owner decides; this changes
   ADR 0022. Measured evidence:
   - **First frame is the same.** JSON 392 ms median against meshopt GLB 398 ms, raw GLB 442 ms and Draco
     486 ms (5 runs each on a quiet machine).
   - **The payload is half the size.** JSON is 84 KB gzipped against 179 KB for meshopt, 303 KB for
     Draco and 625 KB for raw GLB. One node per element makes a GLB mostly JSON metadata:
     1.18–2.1 MB of it.
   - **Incremental updates are the cheapest.** A Takeoff Step adding 100 elements, including fetch,
     extrusion, storey-chunk rebuild, BVH and frame, took **32.6 ms**. Re-downloading that storey's GLB took
     51.3 ms, and the whole GLB 256–285 ms.
   - **The JS heap is smaller.** 49.5 MB against 67–100 MB for the GLB paths.
   - **The risk is two geometry codes:** the viewer's extrusion in JS, and whatever the server uses
     for quantities and IFC. Quantities come from measurement rules on the parametric data (ADR 0009),
     not from meshes, so the mesh is display only. Even so, a CI golden test must compare per-element
     volume and bounding box between the JS mesh and the server's geometry. If joins and booleans grow
     beyond profile holes, fall back to path (a) with **one meshopt GLB per storey** (51 ms per update),
     built by the server, with status still sent as patches.
5. **Look: "shaded with edges" = flat Lambert under a sky/ground fill, one key light and one rim light,
   no shadows, with 1 px `EdgesGeometry` lines at a 25° threshold, merged per storey and switched per
   element by the same state texture.** Proposals are drawn translucent blue with faint edges. Cuts get
   dark stencil caps.
   - Fat lines (`LineSegments2`) look almost the same and cost a little more. They remain an option for
     HiDPI.
   - The post-process outline is rejected: it cannot see the boundary between flush elements (a wall
     under a beam of the same width) and it aliases.
6. **Anti-aliasing is adaptive:** no AA while the camera moves, and one 4× MSAA frame 150 ms after it
   stops (16.6 ms once). MSAA on every frame cost 9.9 ms of GPU (7× more). FXAA on every frame is the
   fallback at 2.2 ms.
7. **Picking uses a GPU id pass:** render 1×1 pixel under the cursor and read it back. It takes 1.5 ms
   p50 and 1.8 p95, and respects hidden, ghosted and clipped elements through the same shader state.
   three-mesh-bvh (0.1 ms, and it agreed with the id pass on 59 of 60 points) stays for snapping and
   measuring later.

## Proposed budgets (a mid-range Windows laptop with integrated graphics, Chrome)

These rest on the UHD 770 numbers above (the weakest Intel iGPU tier of the same generation) with
headroom. A laptop CPU is assumed to be about 2× slower, so the load path was also run under a 2× CPU
throttle. **The owner's walk on a real Dhaka laptop is what confirms or breaks them.**

| Budget | Promise | Measured here (1×; 4×) | Rests on |
|---|---|---|---|
| Model on screen after the viewer opens (warm cache) | ≤ **1.5 s** | 0.39 s; 0.95 s. 2× CPU throttle: 0.89 s | load runs, 5 each; CDP throttle |
| … on a cold 10 Mbps line | ≤ **3 s** | + ~0.3 s transfer (bundle 257 KB + JSON 84 KB, gzipped; arithmetic) | byte sizes |
| Interactive (picking ready) after first frame | ≤ **+0.2 s** | +17 ms; +71 ms | BVH build marks |
| Orbit, pan, dolly and section drag | **60 fps**; GPU ≤ 8 ms p95 per motion frame at native resolution | 1.42 ms p95; 4.9 ms; DPR 1.5: 2.04 ms | GPU timer queries |
| Idle refinement frame | ≤ 50 ms, once | 16.6 ms; 39.6 ms; DPR 1.5: 34.4 ms | GPU timer |
| Section drag with capped cuts | 60 fps | 2.45 ms; 8.76 ms | GPU timer |
| Confirmation of ≤ 1,000 elements → painted | ≤ **16 ms** (one frame) | 7.6 ms (MSAA frame, synced) | recolour bench |
| A Takeoff Step's new elements (100) → painted | ≤ **100 ms** + network | 32.6 ms | patch bench |
| Hover and click pick | ≤ 2 ms per event | 1.5 / 1.8 ms p50 / p95 | id-pass bench |
| Draw calls in the default view | ≤ 100 | 52; 106 with section box + caps | `renderer.info` |
| JS heap | ≤ 150 MB | 49.5 MB; 149 MB | `performance.memory` |

## Method

1. `gen.mjs` generates the synthetic G+10 building on a 6×5 grid with levels B1, GF, L01–L10 and RF:
   pile caps, raft, retaining walls, 42 columns per storey, 71 downstand beams per floor, 30 slab
   panels with lift, stair and duct voids, a lift core of shear walls with a door opening, a two-flight
   stair with railings, brick walls with windows and doors (each a frame plus glass or leaf), and
   parapets. It has **2,923 elements and 67,620 triangles**, and ULID-like ids so payload sizes are
   realistic. It writes:
   - (a) GLBs with one node per element (id, family, level and status in `extras`): raw, Draco and
     meshopt, built with gltf-transform [V8], plus one GLB per storey;
   - (b) parametric element JSON (`col`, `beam`, `slab`, `wall` with openings, `flight`, `opening`,
     `railing`), extruded by one shared `src/geom.js` (three `ExtrudeGeometry`) in Node and in the
     browser.

   `make_ifc.py` exports the same model to IFC4 with IfcOpenShell (LGPL-3.0; `IfcExtrudedAreaSolid`
   with void profiles), and That Open's IfcImporter converts that to `.frag`.
2. The viewer is `src/viewer.js`, with switchable strategies (merged, batched, meshes), edge styles
   (lines, fat, post, none), anti-aliasing modes (msaa, adaptive, fxaa) and data sources (json, glb,
   glb-draco, glb-meshopt). There are spikes in WebGPURenderer and That Open Components.
3. Measurements come from Playwright-driven Chromium 153 at 1440×900:
   - GPU time per frame from `EXT_disjoint_timer_query_webgl2`;
   - CPU submit time;
   - the rAF interval;
   - a synchronous render + `readPixels` frame;
   - load marks from `performance.now()`;
   - the JS heap after a forced GC.

   Screenshots of each feature were taken with the chrome-devtools MCP (SwiftShader) at 1440×900.
4. **Contention:** another agent's SwiftShader benchmark kept the load average at 10–15 for part of the
   session. Load times and incremental updates were re-run when the load average was 1.3–1.6. GPU
   timer figures are unaffected by CPU load.

## Per-stack table

| | three.js WebGLRenderer + our layer | three.js WebGPURenderer | That Open Components/Fragments 3.4 |
|---|---|---|---|
| Licence [V3] | MIT (three 0.186.1, three-mesh-bvh 0.9.15, camera-controls 3.1.2) | MIT (same package) | MIT (components 3.4.8, fragments 3.4.7); web-ifc MPL-2.0 |
| Maturity | WebGL2 path is mature; `BatchedMesh`, clipping, stencil and `EdgesGeometry` are core [V4–V7] | Default in Chrome on Windows since 113 [V1]; node materials only | 3 majors in 15 months (see stack-frontend.md); logo shown by default (`showLogo`) |
| Edges | ✅ `EdgesGeometry` 1 px or `LineSegments2`, per element via the state texture | ✅ lines (no per-element state in the spike) | ❌ none by default; section edges via `getSection` |
| Section + caps | ✅ `clippingPlanes` + stencil caps (plan cut 2.45 ms, adaptive) | ClippingGroup ✅, caps not tried | `getSection` returns fills + edges (4.5 ms); not drawn in the spike |
| Levels, isolate, hide, ghost | ✅ chunk toggles + texels | not built | `setVisible`/`setOpacity` (16 ms to 3.2 s) |
| Colour by status, 1,000 elements | ✅ 0.2 ms JS, 7.6 ms with frame | 2.2 ms (vertex colours, WebGL2) | `setColor` 11–18 ms |
| Picking | ✅ GPU id 1.5 ms; BVH 0.1 ms | not built | `raycast` 0.8 ms p50 |
| First frame | 392 ms (JSON), 398 ms (meshopt) | 496 ms (WebGL2); 756 ms (software WebGPU) | 684 ms |
| Orbit GPU p50 | 1.34 ms adaptive; 9.9 ms MSAA with blending | 2.45 ms (WebGL2, MSAA, no ghosts) | 1.78 ms (MSAA, no edges) |
| Bundle (gzip) | 257 KB | 311 KB | 1,078 KB |
| Verdict | **Recommended** | Revisit when WebGPU matters; would need a TSL rewrite of the state shader | Keep for clients' IFC |

xeokit was excluded (AGPL).

## Merging strategy (the same model, UHD 770)

| Strategy | Draw calls | CPU per frame | GPU orbit (adaptive) | Recolour 1,000 (apply / +frame) | Pick | Verdict |
|---|---:|---:|---:|---|---|---|
| One `Mesh` + material per element | 5,846 | **22.8 ms** (4×: 70 ms) | 1.34 ms | 0.8 / 26.2 ms | BVH 0.7 ms | ❌ CPU-bound under 60 fps |
| `BatchedMesh` (opaque + ghost batch) [V4] | 28 | 1.9–2.2 ms | 1.97 ms | 0.6 / 15.2 ms (p95 78.6) | BVH on batch [V9] 0.7 ms | ✅ viable second |
| **Merged per storey + `aElem` + state texture** | 52 | **0.3–0.4 ms** | **1.34 ms** | **0.2 / 7.6 ms** | GPU id 1.5 ms; BVH 0.1 ms | ✅ **recommended** |

Merged costs:
- The opaque and ghost passes each process every vertex of a storey, so the reported triangle count
  doubles (135k). Vertex work is cheap here: the opaque pass costs 0.41 ms.
- Changing a storey's geometry means rebuilding that chunk: 5.3 ms for 344 elements, BVH included.

## Build rules this implies

- Keep geometry, status and visibility apart: geometry changes rebuild one storey chunk; status and
  visibility changes are texel writes.
- Never let two elements share a visible coplanar face. Draw beams as downstands below the slab soffit,
  and stop columns at the soffit. The retaining-wall top still z-fights with the GF slab in the prototype.
- Group `renderOrder` wins over object `renderOrder` in three.js: set stencil and cap ordering on
  objects, not Groups.
- Render on demand. Use no AA while moving and MSAA at rest, and never MSAA with blending on every frame.
- Sort translucent Proposals apart from opaque elements (three's transparent list), and draw their edges
  faintly (alpha 0.2).

## Still unmeasured

- Chrome on a real Windows laptop (D3D11) with Iris Xe/UHD, including single-channel-RAM machines,
  at 1920×1080 with 125–150% scaling.
- WebGPU on real hardware.
- A model from real drawings (joins, openings in shear walls, more families).
- Network transfer from AWS Mumbai (ADR 0023) to Dhaka.
- GPU memory, battery and thermals over a long session, and memory growth over many chunk rebuilds.
- That Open's post-processing edges (`@thatopen/components-front`) and whether its state-call spikes
  are misuse on our part.
- Cut patterns or hatches on caps (Revit shows them), shadows or ambient occlusion, touch input and
  keyboard navigation.

## Sources

- [V1] gpuweb wiki, Implementation Status, https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
  (fetched 2026-09-26): Chrome ships WebGPU by default on Mac, Windows x86/x64 and ChromeOS from 113;
  Linux is behind a flag.
- [V2] three.js `WebGPURenderer` docstring, `src/renderers/webgpu/WebGPURenderer.js` in three 0.186.1
  (read in the npm package): "falls backs to a WebGL 2 backend". No `onBeforeCompile` in
  `src/renderers/common/`. Docs: https://threejs.org/docs/#api/en/renderers/webgpu/WebGPURenderer
- [V3] npm registry licence and version fields, fetched 2026-09-26: three, three-mesh-bvh,
  camera-controls, @thatopen/components, @thatopen/fragments, @thatopen/components-front (all MIT);
  web-ifc MPL-2.0.
- [V4] three.js `BatchedMesh`: https://threejs.org/docs/#api/en/objects/BatchedMesh. `setColorAt`
  accepts a `Vector4` for alpha (`src/objects/BatchedMesh.js`, 0.186.1).
- [V5] three.js `EdgesGeometry`: https://threejs.org/docs/#api/en/geometries/EdgesGeometry; fat lines
  example: https://threejs.org/examples/#webgl_lines_fat
- [V6] three.js stencil-capped clipping example: https://threejs.org/examples/#webgl_clipping_stencil
- [V7] three.js `Material.clippingPlanes`: https://threejs.org/docs/#api/en/materials/Material.clippingPlanes
- [V8] glTF Transform (`draco`, `meshopt` functions): https://gltf-transform.dev/functions;
  EXT_meshopt_compression:
  https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression
- [V9] three-mesh-bvh, including `computeBatchedBoundsTree`: https://github.com/gkjohnson/three-mesh-bvh
- [V10] camera-controls: https://github.com/yomotsu/camera-controls
- [V11] That Open docs: https://docs.thatopen.com/. Fragments API (`setColor`, `setOpacity`,
  `setVisible`, `raycast`, `getSection`, `Editor.createElements`, `GeometryEngine`) read in
  `@thatopen/fragments@3.4.7/dist/index.d.ts`. `showLogo` read in `@thatopen/components@3.4.8`.
- [V12] IfcOpenShell 0.8.5 (LGPL-3.0): https://ifcopenshell.org/
- [V13] Mesa d3d12 driver (WSL's OpenGL-on-D3D12): https://docs.mesa3d.org/drivers/d3d12.html
- [V14] Wikipedia, List of Intel graphics processing units (Gen12.2 rows), fetched 2026-09-26: UHD 770
  256:32:4 at 1450 MHz; Iris Xe (i5-1235U) 640:80:6 at 1250 MHz.
  https://en.wikipedia.org/wiki/List_of_Intel_graphics_processing_units
- [V15] ANGLE README, fetched 2026-09-26: ANGLE is the default WebGL backend of Chrome on Windows,
  and Direct3D 11 is its complete Windows backend. https://chromium.googlesource.com/angle/angle/+/HEAD/README.md
