---
name: edison-drawings
description: Dissect the owner's professional drawing set (Edison Lavinia — structural, architectural, plumbing, electrical, general notes; .private/reference/edison/) to learn how real Bangladeshi construction drawings are organised and written, and carry those conventions into F-RCC6-BNBC, F-ARCH, F-MEP and the product's readers — without the drawings ever entering the repository. Use when improving fixtures, the extractor, the partition's readers, or the demo's realism.
---
# The Edison set

`.private/reference/edison/` (gitignored; copied from `~/vextrus-builder/docs/design/reference/`):
`Structural Working Drawing_Edison Lavinia_Final.dwg`, `ARCHITECTURE.dwg`, `PLUMBING.dwg`,
`ELECTRICAL.dwg`, `General Note_Edison Lavinia.dwg`. Real drawings of a real project by a real firm.

**The law** (L-CAD-09: competitor-derived drawings never enter the repository; the thesis: Edison is an
internal benchmark, never demo content; the repository is PUBLIC):
- Read, convert, render and ingest them freely — output only under `.private/work/`.
- Never commit them, their conversions, renders, inventories or text; never copy their geometry, text,
  names or numbers into a fixture, test, Decision, doc or commit message. The guard refuses a `git add`
  of `.private/` or a `.dwg`.
- What leaves `.private/` is CONVENTIONS, stated generically with counts ("the column schedule bands
  section sizes by floor range; 3 bands; marks like `C<n>`"), and the fixtures and readers improved by
  them. If a convention can only be shown by quoting the drawing, describe it instead.

**Instruments** (`cubit` MCP): `drawing_inventory` (converted once by the product's own audited DWG
lane; ~12 s for the structural set) → layers, census, blocks, layouts/viewport scales, dimension styles
and overrides, recurring texts; then `drawing_render` with a `box` from the inventory's extents to read
a region as PNG (the structural model space is several sheets side by side — render sheet by sheet).
The product's own reading: `uv run --project cad vextrus-cad ingest "<dwg>" --out .private/work/<name>.entitygraph.json`
(the artifact the partition reads; its stderr notes name what the conversion healed or refused).

A drawing the product REFUSES (a real set was refused `HANDLES_NOT_UNIQUE`) still opens in both tools:
the result names the refusal in `product_refusal` and reads the drawing analysis-only through ezdxf's
recover mode — the refusal itself is often what is under study. Each parallel agent keeps its own
scratch directory (`.private/work/<session>/<agent-key>/`): a shared one lost a helper script mid-run.

**Procedure** (fan it out with `drawing-analyst` agents, one per discipline):
1. Inventory each drawing; list its sheets and what each holds.
2. For the structural set, compare with F-RCC6-BNBC sheet by sheet: grids and bubbles, pile and cap
   layout, pile schedule, column schedule and bands, beam schedules and long sections, slab reinforcement,
   stair, shear walls/lift core, general notes (fy, cover, laps), dimension styles (feet-inches), title
   blocks, viewports. For each: how the real set does it, whether our fixture models it, whether our
   readers would read it (verify by ingest + the partition where you can).
3. Architectural/plumbing/electrical: the same against what F-ARCH/F-MEP (M4) need — rooms and labels,
   door/window schedules, finish schedules, wall types, pipe and conduit runs by size.
4. Rank the gaps by what they cost the demo and the M4 exit; propose the fixture-generator and reader
   changes. A fixture change goes through its generator and its own `baseline:` commit with the golden
   re-authored by the generator's independent model (never by the product's methods).
