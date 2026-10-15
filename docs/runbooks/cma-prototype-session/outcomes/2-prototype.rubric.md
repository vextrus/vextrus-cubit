# Outcome 2 rubric: the final prototype, its Live Model read from Edison

Grade each criterion on its own. Paths are under /mnt/session/outputs/.

1. `private/02-prototype/` holds a static web prototype (index.html plus its assets) that opens from the
   file system or any static server with no network access at view time; three.js is vendored, not
   loaded from a CDN.
2. Its 3D Live Model is the Edison Building assembled from `private/01-dissect/inventory.json` by
   committed code (`public/02-prototype/generator/`), not hand-placed: re-running the generator on the
   inventory reproduces the model data.
3. Every Element in the viewer shows its Discipline, Category, Family, Type, Tag, Attributes, its Trace to
   the drawing, and its state (`read`, `inferred`, `placeholder`), and the three states are visibly
   different; a panel counts them.
4. The model tree files Elements as the Claude Design model does (Discipline, Category, Family, Type,
   Tag), with show, hide, isolate, filter by Attribute, storey by storey, section planes, measure, and
   an Element's dimensions; and each Category maps to an IFC4 class and a Uniclass code.
5. The prototype walks the product's flow on this Building: Drawing Set, Takeoff Steps with
   Confirmation and Questions, the Live Model, the Priced BOQ (concrete, formwork, rebar at least) and
   the Material Schedule in ৳ and cft/sft, and the MD's whole-building figure with its measured share and
   marked allowances; every figure opens its Trace to Elements.
6. Quantities in the Priced BOQ are computed by code from the model's geometry, and the QS critic's review
   of them (method, deductions, units) is recorded with each finding fixed or explained.
7. Life Phases (As designed, As built, As maintained) and the 4D and 5D readings are shown as working
   previews on the same Element identities (for example: construction stages that raise the building
   over time, cost by stage), clearly marked as previews.
8. It meets docs/research/viewer-3d-budgets.md on the sandbox or says by how much it misses; the agent
   measured load time, frame time and memory in headless Chromium and recorded them.
9. `private/02-prototype/screenshots/` holds screenshots of every screen and of the model by
   Discipline, taken by the agent, and the agent fixed what the screenshots showed was wrong.
10. `public/02-prototype/` holds the generator, its synthetic test fixture and a README, with no Edison
    content; the Adversary has checked that and has checked 20 Elements' Traces in the viewer.
