# THE v22 GALLERY — what is in this directory, and what it is evidence of

Rewritten 2026-09-12 against the branch as it stands (`v22/u2-lease-unspent`). The version this
replaced described a branch that no longer existed: it said the lease was unwritten and unspent, that
`height-budget.ts` was empty, and that nothing in `tests/e2e/baselines/` had been re-taken — all four
untrue of the tree it sat in. A README that contradicts its own directory is not documentation, it is
a second, wrong source of truth, so this one states only what can be read off the tree beside it.

## THE LEASE IS SPENT

`6428b01` (later `70e0b5a`) is the `baseline:` commit: every design baseline re-taken in both themes
at §9.3's geometry, 70 PNGs in `tests/e2e/baselines/design-{dark,light}/`. `the-lease.patch` is
DELETED — it was applied, and a patch file sitting beside the tree it has already been applied to is
a trap for the next reader.

Corrections landed since, each its own commit:

- **the picture tenant can sign in.** The fixture seeded `users.email` as the address is typed; every
  door reads it FOLDED (`storedAddress` → `foldedKey`, `src/server/auth/folded-key.ts`), so the
  gallery spec spent 600 s photographing the sign-in card it was refused at. The seed now calls the
  door's own key function, and the live suite that asserted the bug asserts the door instead.
- **the drawing exists.** The seed stopped at the project, so the drawings, viewer and takeoff stills
  were pictures of empty states. It now lands the content, the drawing at `PICTURE_TENANT.drawingId`,
  its ingest record and the sheet `A-101 — Foundation Plan` at three raster tiers.
- **the dark lane pictures the dark product.** Six dark-lane baselines re-taken and one renamed — see
  the `baseline:` commit "the dark lane pictures the dark product" for the luma table.
- **thirteen invalid `border` rules** in `src/ui/primitives` fixed, and the mechanical suite now reads
  the primitives it had never opened.

## THE STILLS

Eighteen: nine screens × two themes, taken by `tests/e2e/gallery-v22.spec.ts` (`CUBIT_GALLERY=1`),
6.0 s in the light project and 5.9 s in the dark. Mean luma says each is a picture of the theme it
names (home 15.9 / 243.0, register 21.2 / 237.7, auth 15.8 / 242.3).

**`viewer-dark.png` and `viewer-light.png` are black (luma 0.2) and are owed.** The picture tenant's
sheet has its raster ROWS but no artifact in the store — the server answers "the store holds no
artifact at f1c7c0de… (SEAM-STORAGE)". Seeding bytes into the object store is the next node's, and
until then this pair is an honest picture of the fixture rather than of the viewer.

## THE HEIGHT BUDGET — five entries, all ceilings

`tests/e2e/support/height-budget.ts` is NOT empty. Every entry is a ceiling a screen may not grow
past, never an exemption, and `checkpoint.ts` still fails any checkpoint over its recorded height:

| checkpoint | px | measured by |
| --- | --- | --- |
| `j-010-timeline-done` | 2989 | `cubit-u2b`'s walk, 2026-09-12 (corroborated in this tree) |
| `j-010-jobs-tray-open` | 2989 | the same walk |
| `j-010-sheets-fanned-out` | 2989 | the same walk |
| `j-010-discipline-confirmed` | 2585 | a walk whose log is NOT in this tree — unfalsifiable here |
| `j-000/disciplines-confirmed` | 2417 | the same: not corroborated from this branch |

Two things are still owed on this file and neither was reached this session: (a) no test says an
entry may only FALL, so a number can be raised in one byte; (b) `CUBIT_HEIGHT_BUDGET_SEED=1` — the
switch at `checkpoint.ts:258` that turns the cap off — was in force for the re-baseline walk, so the
committed pictures were blessed in a run where §9.3's cap was not enforced. Until a full walk runs
WITHOUT it, every entry above is a claim about a screen and not a measurement of this tree.

## MASKS — still on eight specs, contrary to §9.3

§9.3 says "no masks, because the picture tenant's data is fixed". Thirteen specs still pass `mask:`,
and these hold committed design baselines: `j-001-auth` (`invite-pending`, `accept`, `switched`),
`j-002-tenant-admin`, `j-022-coverage`, `j-021-column-slice`, `project-home` (`s-project/home`),
`register` (`s-takeoff/register`), `palette` (`open-*`, `sheet`), `shell`, `audit`, `j-003-projects`,
`j-010-upload`, `j-000/m0-workspace-and-project`. The masks survive because `pictureTest` — the
fixture that makes them unnecessary — is imported by `gallery-v22.spec.ts` ALONE; every other spec
still makes its own per-run tenant. `capture-geometry.ts`'s claim that "every committed baseline was
taken against the picture tenant" is therefore false and should be read as an aspiration.

## THE FOLD CAPTURE — owed

There is **no 1280×800 capture anywhere** (`grep 1280 tests/e2e playwright.config.ts` finds nothing)
though §9.3 and `SCORES.md` both require one. Nothing on this branch takes it.

## THE FLAGS ACTUALLY SHIPPED

`tests/e2e/support/capture-geometry.ts` launches with `--force-prefers-reduced-motion` and §9.3's
three font flags — `--font-render-hinting=none`, `--disable-font-subpixel-positioning`,
`--disable-lcd-text` — plus `contextOptions: { reducedMotion: "reduce" }`, `viewport 1440×900`,
`deviceScaleFactor 1`, `locale en-GB`, `timezone Asia/Dhaka`. `--force-color-profile=srgb`, which an
earlier version of this file named, is NOT shipped. The three font flags are now exported as
`FONT_RENDER_FLAGS` so a spec that needs a flag of its own extends the lane's list instead of
replacing it; `j-011-viewer.spec.ts` is the one spec that drops `--force-prefers-reduced-motion`, by
name and with its reason, because its clause is the pulse.

## SCORES.md

Not touched by this session, and not to be read as current: the adversary's finding that C9 = 4 is
written on seven rows while four real axe SERIOUS findings stand on this branch is unanswered here.
The next node writes that file from real captures.
