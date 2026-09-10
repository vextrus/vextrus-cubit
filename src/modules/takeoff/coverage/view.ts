// What S-Coverage is handed, as a value: the residue resolved into the grid's own shape, the two
// boundary statements the certificate will print, and nothing computed twice.
//
// A view type and nothing else — no reading, no rendering — so the screen's suite can mount the
// workspace over a value and the door can answer one (B-19, ARCH-01).
import type { ResidueCell, ResidueLevel, Sighting, StatementRow } from "@/core/residue";

/** The campaign the grid is read under, and the revision it is pinned to (L-REG-06). */
export type CoverageCampaign = {
  readonly campaignId: string;
  readonly setRevisionId: string;
};

/**
 * The whole reading one coverage screen paints. The cells are the residue's own rows — kind-grain
 * first, then the grid in canonical order — and the two statements are computed off exactly those
 * cells, so the preview and the grid can never disagree about a boundary (B-17).
 */
export type CoverageView = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly campaign: CoverageCampaign | null;
  readonly levels: readonly ResidueLevel[];
  /** The classes any channel sighted, in `compareCanonical` order — the grid's column bands. */
  readonly classes: readonly string[];
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
