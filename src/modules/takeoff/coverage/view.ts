// What S-Coverage is handed, as a value: the residue resolved into the grid's own shape, the two
// boundary statements the certificate will print, and nothing computed twice.
//
// A view type and nothing else — no reading, no rendering — so the screen's suite can mount the
// workspace over a value and the door can answer one (B-19, ARCH-01).
import type { ScopeDeclarationCause } from "@/core/errors";
import type { PartialStatementRow, ResidueCell, ResidueInput, Sighting, StatementRow, UnclassedStatementRow, UnnamedStatementRow } from "@/core/residue";

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
  /**
   * The measurement boundary's two further enumerations (s-coverage I-481/e): the cells
   * published only in part, with what their lines left out, and the members the drawings show that
   * no class measures. Absent reads as none.
   */
  readonly partial?: readonly PartialStatementRow[];
  readonly unclassed?: readonly UnclassedStatementRow[];
  /** And the beams the plans draw that no mark names (s-coverage I-613). Absent reads as none. */
  readonly unnamed?: readonly UnnamedStatementRow[];
  /**
   * The campaign's published lines kept with NO quantity (PARTIAL_DECLARED), by id (s-coverage
   * I-cov-1). The residue reads a cell QUANTITY_BEARING when it has published lines at all; this is
   * how the grid tells a cell whose lines bear a figure from one whose lines only declare what they
   * left out (L-QTY-02). Absent reads as none.
   */
  readonly declaredLineIds?: readonly string[];
  /**
   * What each sighting's Trace selects on the sheet the sighting names (s-coverage I-556): by
   * drawing, then by the sighting's own key, the entities the viewer flies to — a placed member's
   * outline and mark, a declaration's caption. A sighting absent here names nothing the pinned record
   * holds on that sheet and shows its key with no link. Absent reads as none.
   */
  readonly sightingSelections?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
};

/** One cell read on its own, as the inspector's own door answers it (`takeoff.coverageCell`). */
export type CoverageCellView = {
  readonly cell: ResidueCell;
  readonly sightings: readonly Sighting[];
};

/**
 * A boundary a model proposed for one unmeasured cell, and the call that proposed it (L-AI-02: a
 * classification held until confirmed). It is the ONLY thing of a Proposal that leaves the module —
 * the symbol-marked value never crosses a transport — and the act judges it by the call id.
 */
export type ProposedCause = {
  readonly callId: string;
  readonly cause: ScopeDeclarationCause;
};

/**
 * What the proposal door answers for one cell: a proposed boundary, or none. `null` is every form of
 * "no answer" at once and deliberately so — a cell code never asks about, a refusal the seam threw,
 * the model's own no-match, a confidence under the caller's floor — because what a reader does with
 * each is the same: read the evidence and decide unaided (L-AI-02, s-coverage I-297).
 */
export type CoverageCauseProposalView = {
  readonly proposal: ProposedCause | null;
};

/** The certificate preview's own answer: two enumerations, separately titled, never merged. */
export type CertificatePreview = {
  readonly measurement: readonly StatementRow[];
  readonly bill: readonly StatementRow[];
  readonly partial: readonly PartialStatementRow[];
  readonly unclassed: readonly UnclassedStatementRow[];
  readonly unnamed?: readonly UnnamedStatementRow[];
};
