// What S-Coverage is handed, as a value: the residue resolved into the grid's own shape, the two
// boundary statements the certificate will print, and nothing computed twice.
//
// A view type and nothing else — no reading, no rendering — so the screen's suite can mount the
// workspace over a value and the door can answer one (B-19, ARCH-01).
import type { ResidueCell, ResidueInput, Sighting, StatementRow } from "@/core/residue";

/**
 * The whole reading one coverage screen paints. The cells are the residue's own rows — kind-grain
 * first, then the grid in canonical order — and the two statements are computed off exactly those
 * cells, so the preview and the grid can never disagree about a boundary (B-17).
 *
 * The reading carries the `ResidueInput` it was resolved from rather than a second copy of any part
 * of it: the level stack the grid's columns are ordered by is the stack the cells were resolved over,
 * read from the one place it stands (B-17, ARCH-02).
 */
export type CoverageView = {
  /** The workspace and project every cross-link is spelled from, where the caller states them. */
  readonly tenantId?: string;
  readonly projectId?: string;
  /** The campaign the grid is read under, `null` where none is pinned (L-REG-06, R-UI-050). */
  readonly campaignId: string | null;
  /** The revision that campaign is pinned to, quoted whole on the screen (I-26). */
  readonly setRevisionId: string | null;
  readonly input: ResidueInput;
  readonly cells: readonly ResidueCell[];
  readonly measurement: readonly StatementRow[];
  readonly bill: readonly StatementRow[];
};

/** One cell read on its own, as the inspector's own door answers it (`takeoff.coverageCell`). */
export type CoverageCellView = {
  readonly cell: ResidueCell;
  readonly sightings: readonly Sighting[];
};

/** The certificate preview's own answer: two enumerations, separately titled, never merged. */
export type CertificatePreview = {
  readonly measurement: readonly StatementRow[];
  readonly bill: readonly StatementRow[];
};
