/**
 * The gallery module (R-UI-011, S-Design) — one import for the sheet, its register and the
 * seam the completeness test stands on.
 *
 * A consumer imports from here and from no file under it: the split into a registry, a screen
 * and one module per entry is this module's own business, the same rule the primitives,
 * patterns and data barrels state.
 */
'use client';
export { GalleryScreen } from './screen';
export type { GalleryScreenProps } from './screen';

export { galleryEntries, galleryModules } from './registry';
export type { GalleryModuleGroup, GalleryModuleKey } from './registry';

export { coverageReport } from './coverage';
export type { CoverageReport } from './coverage';

export type { GalleryEntry, GalleryEntryState, ScreenStateName } from './types';

// The string table stays at `src/ui/gallery/strings.ts` (R-SPINE-060); a second name for it
// here would be a second place to look.
export type { GalleryStringKey } from './strings';
