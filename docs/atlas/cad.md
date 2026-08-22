# The `cad/` seam

`cad/` turns file formats into one geometry vocabulary — the EntityGraph — and stops
(L-CAD-01). It is a Python CLI invoked once per drawing revision, never fed app-produced
input and never re-opened by the app. Everything that reads *meaning* over the artifact —
schedule reconstruction, view law, grid, placement, notation parsing, the `%%` escapes —
runs in TypeScript, on the far side of the seam.

This increment (inc-104) delivers the DXF half. DWG (LibreDWG, two-pass audited), PDF
(pypdfium2) and raster vectorisation arrive as later leaves under L-CAD-04; the vocabulary
below is already the vocabulary they will mint into.

## The one command

```
cd cad && uv run --frozen python -m cubit_cad ingest <drawing.dxf> --out <graph.json>
```

One shot, stateless, a temp dir per invocation, loud failures. Exit 0 means the EntityGraph
is at `--out`; any other exit means a message on stderr and *nothing* at `--out` — the
artifact is staged in the temp dir and moved into place in one step, so there is no partial
file for a caller to mistake for an answer. An unreadable file, a missing path, or a
`--format` other than `dxf` (the default, inferred from the extension) is refused before any
work begins.

## Extractor identity

A source key is scoped to (file bytes, extractor identity), so the ingest record pins both
halves: `ingest.extractor` carries `name`, the installed `version`, and
`parameter_set_hash`; `ingest.file_sha256` is the sha256 of the input bytes.

The parameter set is the whole of the extractor's tuning, hashed as canonical JSON with
sorted keys (`cad/src/cubit_cad/params.py`):

| Parameter | Value | What it bounds |
| --- | --- | --- |
| `explode_depth_cap` | 8 | how deep nested block references expand |
| `derived_entity_budget` | 200000 | derived paint entities one layout may hold |
| `flatten_tolerance` | 0.01 | sagitta, in drawing units, between a curve and its polyline |
| `flatten_point_cap` | 4096 | points one flattened curve may carry |

Change a number here and every key minted before the change belongs to a different
extractor: that is a declared re-ingest minting a new key multiset, not a silent upgrade.

## Keys, originals, derived paint

Every original entity carries `key` of the form `DXF_HANDLE:<handle>` — the file's own
handle, never a counter, never an index (L-CAD-02). The scheme rides per key and the set is
closed; the DXF extractor may mint only this one.

Derived paint geometry never reaches the extractor (L-CAD-03):

- `entities[]` holds originals only — the INSERT entities themselves included, their
  expansion excluded.
- `derived[]` holds the world-space paint an INSERT expands to, each element carrying `src`,
  the key of the top-level instance it came from. Nesting mints no new keys: derived paint
  is not an atom, so a reader always has an original to point at. A dimension's measurement
  text is a derived text entity too.
- `attributes[]` holds block attributes, separately, each with `src`, `tag` and `text`.

Text crosses the seam raw. The app's parsers own the AutoCAD escapes.

## Resolutions the seam performs (L-CAD-05)

- **Colour** is resolved server-side, in one pass, with the drawing's tables still open:
  true colour → explicit → BYLAYER → BYBLOCK. The artifact carries `#RRGGBB` and the rule
  that produced it; the app never sees an ACI index or a BYLAYER sentinel.
- **Text** carries its world `height` — the height after the block reference's scale, not
  the height the definition was drawn at.
- **Extents** are robust: a bbox centre outside the 2nd–98th inter-percentile window of the
  layout's own centres, enlarged by 25% of its span, is a stray and does not set the sheet's
  scale. The rejection is counted; the entity itself stays in the graph, because rejection
  is a claim about extents, not about existence.
- **Layouts** are inventoried with their own bbox — model space as name `Model`, kind
  `model`; each paper layout under its own name. A content-less layout is dropped and
  counted.
- **Closed polylines** carry `area`, by the shoelace formula over the flattened points.
- **Curves** flatten at the pinned tolerance under the point cap; a trip is counted, and a
  capped flattening carries no area, because its shoelace would be a number about a polyline
  nobody drew.
- **Every entity carries `space`** — `model`, or the name of the layout it lives on.
- **`$INSUNITS`** is reported through the closed map (0 unitless · 1 inch · 2 foot · 4 mm ·
  5 cm · 6 m); an unmapped code reports `unit: null` with `insunits_unmapped: true`, never
  "unitless". Coordinates stay in native drawing units — reporting the unit is the whole of
  the seam's opinion about it.

## The fidelity counters (R-TO-001)

`counters.layouts_dropped` and, per layout, `explode_truncated` with `explode_losses` keyed
by entity type, `flatten_capped` and `strays_rejected`. A cap that trips says so by name and
by type: the sheet card that shows these as named facts is a later leaf, but the numbers are
recorded from this increment on.

## Both sides of the mirror

The vocabulary is versioned (v2 as the floor) and stated twice, rule for rule:

| Side | Module | Entry point |
| --- | --- | --- |
| Python | `cad/src/cubit_cad/schema.py` | `parse_entity_graph(obj)`, raising `EntityGraphError` |
| TypeScript | `src/core/entitygraph/index.ts` | `parseEntityGraph(input)` over `EntityGraphV2Schema` (Zod) |

Neither is allowed to be the lenient one. Both parse every committed artifact in
`fixtures/entitygraph/*.json` — regenerated by the CLI from the DXF corpus in
`cad/tests/fixtures/` — and both refuse every file in `fixtures/entitygraph/malformed/`,
which is deliberately invalid and declared as such.

## Licences

The extractor is ezdxf (MIT); PDF, when it arrives, is read with pypdfium2 (permissive). The
AGPL PDF libraries named by L-CAD-04 are banned in shipped code, and the ban is enforced on
both runtimes by a test that reads *manifest* text — `cad/pyproject.toml` and `cad/uv.lock`
through `cubit_cad.licences.banned_licence_findings`, `package.json` and `pnpm-lock.yaml`
through `scripts/lib/licences.mjs`. A dependency is what the lockfile says is installed, so
a source scan would miss the transitive copy that actually ships and would report the
checkers themselves for naming their own subject.

## In the gate

`pnpm verify` runs `ruff check` and `pytest` over `cad/` as the `cad-ruff` and `cad-pytest`
stages, both under `uv run --frozen` — a lock that has drifted from `cad/pyproject.toml` is
a hard failure, not a silent re-resolve. The mirror suite
(`src/core/entitygraph/__tests__/mirror.test.ts`) and the licence suite
(`tests/toolchain/licences.test.ts`) run in the vitest stage.
