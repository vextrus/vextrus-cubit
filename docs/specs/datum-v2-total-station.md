# Datum v2 — The Total Station · implementation handoff

> **In-product copy (founder act, 2026-08-24).** This file is the authoritative Datum v2
> value source, placed in the product tree because build sessions may read only this repo —
> the engine's home is hook-denied to every role, and a value source no role can read is not
> a source (the first inc-016 planner proved it live: its spec reads "THE VALUE SOURCE IS
> SEALED"). It lives under `docs/specs/` so it is write-locked like the Bible: founder-pen
> only. §1 below is the drafting record of the amendments; their applied form is
> AM-04..AM-06 in `docs/specs/cubit.bible.xml` (commit af134ba), which supersedes this
> draft wherever they differ. Brand assets referenced in §6 are vendored at `src/ui/brand/`.


**Status:** FINAL direction, chosen by the founder 2026-08-24 from three designed lanes.
**Authority:** this file is the authoritative value source for the actionable session. The
visual reference (not required reading; costs tokens to read back) is the design canvas:
https://claude.ai/code/artifact/5479020a-be0e-45b9-baa8-dc9a7084b790 — page 1 holds the
finalized system (Foundations, Brand, Components, Viewer, Register, Coverage-light), page 2
archives the unchosen lanes A/C.
**Scope of this doc:** everything a session needs to (1) apply the Bible amendments the
founder authorises, (2) rewrite `src/ui/tokens.ts` and restyle `src/ui/**`, (3) re-author
`docs/design/*.md`, without re-deriving any decision.

---

## 0. The decision in one paragraph, and the five laws

Datum v2 is a precision optical instrument: graphite surfaces seamed by 1px hairlines,
exactly two colours with meaning. Brand indigo ("the **beam**") replaces cobalt as the one
interactive accent; the logo's copper spark becomes the **act** colour, fired only when a
human commits (affirm / sign / issue / confirm-with-consequence). Focus is a four-tick
**reticle**, not a ring. Status is a mono **readout**. Dark-first, light complete
(cool instrument grey-white, no pure white ground). Type moves to Spline Sans + Spline Sans
Mono. Everything domain-law keeps its values: basis palette + glyphs, semantics, element and
canvas palettes, 4-pt grid, radii, motion bands, densities, states, WCAG 2.2 AA.

Laws: **1** Graphite is the ground (hairlines join surfaces; shadows only for overlays).
**2** Indigo is the beam (if it's indigo you can act on it). **3** Copper commits (never a
hover, never a chart; at most one act colour per screen). **4** Focus is a reticle (no glow,
no filled ring). **5** Status is a readout (mono, tabular; nothing bounces; no spinner on a
data table).

---

## 1. Bible amendments (founder act — apply to `docs/specs/cubit.bible.xml` before any build session; sessions must not edit the Bible)

Draft replacement texts, minimal diff to the existing requirements:

- **R-UI-001** — replace `one accent "cobalt" for interactive` with
  `one accent "beam" (the brand indigo) for interactive; an "act" copper reserved for act
  commitment (affirm/sign/issue/confirm) and for nothing else`. Everything else in R-UI-001
  stands (graphite scale, semantics, basis, element, canvas palettes, 4-pt grid, radii,
  elevation, type scale, motion, z, breakpoints, both themes on :root/[data-theme], the
  no-colour-literal lint).
- **R-UI-003** — replace `Inter for UI` with `Spline Sans for UI` and
  `JetBrains Mono for every number…` with `Spline Sans Mono for every number…` (keep
  `font-variant-numeric: tabular-nums slashed-zero`, keep Noto Sans for documents, keep the
  scale 12/13/14/16/20/24/32, weights and line heights unchanged).
- **R-UI-012** — replace `focus ring (2 px cobalt outer)` with `focus reticle: four corner
  ticks, 2 px beam stroke, 8 px arms, offset 4 px outside the element's box, drawn in 120 ms
  ease-out (instant under prefers-reduced-motion); where corner ticks cannot render, the
  fallback is a 2 px beam outline at 2 px offset — a visible focus indicator is never
  optional`. Keyboard reachability, ARIA, contrast and axe clauses stand.
- No other `<frontend>` change. The intent line ("best of Linear, Figma and a well-made
  surveying instrument") is already this direction.

---

## 2. Token sheet — exact deltas for `src/ui/tokens.ts`

The file's structure (tree of frozen groups + `GROUPS` emission order + `renderTokensCss()`)
stays. `src/ui/tokens.css` is regenerated output, never hand-edited; a test compares it
char-for-char, so regenerate and commit together. All hexes live only in tokens.ts
(`cubit/no-colour-literal`).

Changed/new groups, in the file's own idiom (`dual(light, dark)`):

```ts
// graphite — retinted slot-for-slot; roles unchanged (0 = app bg, 200 = the hairline seam,
// 500 = disabled text ≥3:1, 600 = captions/overlines ≥4.5:1, 700 = secondary, 900 = primary).
// Light 0 is instrument grey-white, deliberately not #FFFFFF.
graphite: {
  '0':    dual('#F4F5F4', '#0C0E11'),
  '50':   dual('#EFF0EF', '#101318'),
  '100':  dual('#E9EBEA', '#12151A'),
  '200':  dual('#DDE0E0', '#22262E'),
  '300':  dual('#C9CDD1', '#333A46'),
  '400':  dual('#B0B6BC', '#414957'),
  '500':  dual('#7F868D', '#66707F'),
  '600':  dual('#5F6772', '#7E8899'),
  '700':  dual('#4A515B', '#9AA3B2'),
  '800':  dual('#363C45', '#C3C9D2'),
  '900':  dual('#262B33', '#E7EAEE'),
  '950':  dual('#191D24', '#F1F4F7'),
  '1000': dual('#101318', '#FBFCFD'),
},

// beam — REPLACES the cobalt group (delete `cobalt`, sweep every `--cobalt-*` consumer).
// Anchored on the logo indigos: light 500 = #5A4FB0, dark 600 = #8B84E8 (AA text on graphite-0 dark).
// Light descends darker upward, dark ascends lighter — same convention cobalt used.
beam: {
  '100': dual('#E8E6F7', '#1A1830'),
  '300': dual('#B7B1E8', '#3B3478'),
  '500': dual('#5A4FB0', '#6E63C8'),
  '600': dual('#473E92', '#8B84E8'),
  '700': dual('#38316F', '#A7A1F0'),
},

// act — NEW group, emitted right after beam in GROUPS. Copper, scarce by law (§0 law 3).
// 500 = fills/borders/the dot; 600 = text on act-surface; surface = the quiet ground behind
// an act control. The MARK's spark keeps logo copper #D88A55/#E29A68 (brand asset, not a UI token).
act: {
  'surface': dual('#FBEFE4', '#1D1610'),
  '500':     dual('#A85B28', '#C97F4A'),
  '600':     dual('#9A5326', '#E29A68'),
},

// canvas — only these four keys change (selection/hover re-point to the beam; paper/grid
// cool slightly). ink, pulse, measure, snap and the light paper/grid values are unchanged.
canvas: {
  paper:     dual('#FCFCFB', '#101216'),
  grid:      dual('#E9EAE7', '#1B1F26'),
  selection: dual('#5A4FB0', '#8B84E8'),
  hover:     dual('rgba(90, 79, 176, 0.18)', 'rgba(139, 132, 232, 0.26)'),
},

// font — new stacks; Noto Sans for documents unchanged.
font: {
  ui:   "'Spline Sans', 'Helvetica Neue', Arial, sans-serif",
  mono: "'Spline Sans Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace",
  doc:  "'Noto Sans', 'Spline Sans', Arial, sans-serif",
},

// motion — one addition; existing keys unchanged (reduced-motion zeroing picks it up
// automatically because the key ends in -duration).
motion: { /* …existing… */ 'reticle-duration': '120ms' },
```

**Unchanged groups (do not touch):** semantic, basis (+ glyph pairing in `BASIS`), element,
space, radius, hairline (still `1px solid var(--graphite-200)` — the seam value moves with
the ramp), text, leading, weight, z, breakpoint, row, shadow.

Contrast facts already verified (keep them true): dark 600 on dark 0 ≈ 5:1; dark 500 on
dark 100 ≥ 3:1 (disabled floor); light 600 on light 0 ≈ 5.5:1; act-600 on act-surface ≥ 4.5:1
both themes; beam-600 dark on graphite-0 dark ≥ 4.5:1.

---

## 3. Fonts

Spline Sans + Spline Sans Mono, both SIL OFL (Google Fonts). **Vendor them** (next/font/local
or committed woff2 + @font-face) — a previous run's design finding was "unshipped fonts"; no
runtime Google fetch. Weights needed: 400/500/600/700 (sans), 400/500/600 (mono). Keep
`tabular-nums slashed-zero` on the mono utility exactly as today. Overlines are the one
letterspaced-caps allowance: 10px mono, tracking ~0.12–0.14em.

---

## 4. Work scope in `src/ui/` (current inventory, module by module)

- `tokens.ts` / `tokens.css` — §2 above; regenerate css; update `docs/design/datum-tokens.md`
  (it fixes group order/keys).
- `globals.css` — font loading, base text colours to new slots.
- `primitives/` (button, choice, combobox, dialog, display, field, floating, number-input,
  select, slider, tabs, toast, primitives.css): sweep `--cobalt-*` → `--beam-*`; add the
  **act button variant** (act-surface fill, act-500 border, act-600 text, 7px copper dot);
  reimplement the focus affordance as the reticle (shared CSS on `:focus-visible`, pseudo
  -element corner ticks + outline fallback per §1 R-UI-012); toast gains the act-dot variant
  for act confirmations; number-input keeps unit suffix + lakh/crore on blur.
- `patterns/` (consequence-dialog, refusal, states): ConsequenceDialog's confirm becomes the
  act button and shows the digest line (10px mono, graphite-600); refusal/empty/error keep
  their anatomy, colours re-point to tokens (they should already).
- `shell/` (app-shell, shell.css): rail carries the **no-spark quiet mark** at 26px (graphite
  facets `--graphite-300/400`-ish per brand sheet, beam spark omitted <32px); selection rails
  = 3px inset beam bar + beam-100 row fill; the mono readout status-line style becomes a
  shared class (viewer uses it later).
- `basis.tsx` — unchanged (values and glyphs are law).
- `gallery/` — new entries: act button states, reticle focus demo, readout bar, density rows;
  every restyled state re-rendered; then **re-baseline the visual suite** (see §7 traps).

## 5. Work scope in `docs/design/`

Every existing Design Decision was authored against Datum v1 and needs re-authoring or a v2
amendment: `datum-tokens.md`, `datum-primitives.md`, `datum-patterns.md`, `shell.md`,
`s-auth.md`, `s-design.md`, `s-settings.md`, `s-settings-tenant-slice-members-invitations-roles.md`,
`s-project-settings.md`, `s-project-settings-ruleset-slice.md`,
`design-gallery-design-exercised-end-to-end-not-changed.md` (re-examine — its premise was "not
changed"), and the placeholder-colour amendment doc (historical; superseded by the retint).
Copy verbatim in each DD must be re-decided against the instrument voice ("Measured, not
asserted"); refusal copy pattern stays code + message + remedy + evidence link.

Screen decisions already made on the canvas (source them into future DDs rather than
re-designing): viewer = rail 56 / top bar 46 / layers panel 224 / canvas / inspector 284 /
mono readout bottom bar; register = tree 240 / filter chips / offered-group banner (basis-
tinted, INTERPRETED magenta, act confirm at right) / table with inline refused rows + Σ
footer / inspector 300; coverage = kind × level heat grid, per-cell cause labels, certificate
preview panel with the copper "Proceed to sign" act; light theme is the coverage screen's
native rendering on the canvas (proof of light completeness).

## 6. Brand law (no repo asset changes required)

Mark geometry, wordmark, lockups: unchanged from `src/ui/brand/LOGO-SPEC.md (vendored)`.
New colour states: primary-dark (facets #564BA8/#6E63C8, spark #E29A68), primary-light
(founders' #3A2F86/#5A4FB0, spark #D88A55), quiet-chrome (graphite facets, beam spark),
tile unchanged. Usage in product: rail mark 26px no-spark; the full spark mark appears only
on sign-in and certificates; issued PDFs carry the light lockup + quiet watermark, and a
DRAFT banner never shares a page with the spark. Copper scarcity is one law across brand
(spark only) and product (acts only).

## 7. Known traps (already learned in this repo — do not relearn)

- `tokens.css` is generated; a char-compare test guards drift — regenerate, never hand-edit.
- The no-colour-literal lint has a fixture test; every new hex goes in tokens.ts only.
- The theme flip transitions controls for ~160ms — settle before any computed-style read or
  axe scan; jsdom `data-theme` flips are tautological — grade dark scope off the token sheet
  via fs, paint via screenshots.
- Visual re-baseline: `node_modules/.bin/playwright test --update-snapshots=all` against a
  hand-started `npx next build && npx next start -p 3210` carrying FONTCONFIG_FILE
  (`pnpm start` is a stub); `NEXT_DIST_DIR`/`.next-e2e` reuse or next build rewrites the
  locked tsconfig; string snapshot names lose slashes (use array names).
- `/design` currently has two unconditional axe defects (Select placeholder contrast, empty
  DataTable selection columnheader) — fix them as part of the restyle, don't inherit them.
- Read-only panes taller than the viewport trip axe scrollable-region on `.shell-main` —
  tabIndex={0} + the focus affordance on the content, not the wrapper.
- `next dev` rewrites CLAUDE.md (restore with `git checkout -- .`); axe scans mid-fade
  arrivals (settle `el.getAnimations()`); which axe threshold a journey gates on: read the
  increment's own AC, not memory.

## 8. Suggested slicing for the actionable work

1. **Founder pre-step:** apply §1 Bible amendments; commit.
2. **Increment A — tokens & fonts:** §2 + §3 + globals + regenerate css + datum-tokens.md DD;
   green: verify, token drift test, lint fixtures.
3. **Increment B — primitives & patterns:** cobalt sweep, reticle, act variant, dialog/toast;
   datum-primitives.md + datum-patterns.md DDs; gallery entries.
4. **Increment C — shell & gallery:** rail mark, readout class, shell.md DD, /design axe
   fixes, full visual re-baseline both themes.
5. Then per-screen DDs re-authored as their screens come up (s-auth first — it carries the
   full-spark mark).
