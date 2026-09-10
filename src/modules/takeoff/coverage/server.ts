// S-Coverage's reading, composed once (ARCH-02): the residue query in core answers the grid, and the
// two boundary statements are computed off exactly the cells the grid paints.
//
// This file computes nothing of its own. The arms are L-QTY-05's and live in `@/core/residue`, so
// M7's certificate reads the same answer through the same functions without ever importing a module
// (B-17, ARCH-01).
import { billStatementOf, cellRef, measurementStatementOf, parseCellRef, residueOf } from "@/core/residue";
import type { CertificatePreview, CoverageCellView, CoverageView } from "./view";

/** Which project's coverage is read, in whose workspace. */
export type CoverageScope = { readonly tenantId: string; readonly projectId: string };

/** The whole screen's reading, in one answer. */
export async function coverageViewOf(scope: CoverageScope): Promise<CoverageView> {
  const residue = await residueOf(scope);
  return {
    tenantId: residue.tenantId,
    projectId: residue.projectId,
    campaign: residue.campaign,
    levels: residue.levels,
    classes: residue.classes,
    cells: residue.cells,
    measurement: measurementStatementOf(residue.cells),
    bill: billStatementOf(residue.cells),
  };
}

/**
 * One cell of the residue, addressed. An address this residue holds no cell for answers `null`: a
 * stale address is a fact about the address, and nothing is invented for it (I-193).
 */
export async function coverageCellOf(scope: CoverageScope, address: string): Promise<CoverageCellView | null> {
  const named = parseCellRef(address);
  if (named === null) return null;
  const residue = await residueOf(scope);
  const held = residue.cells.find((cell) => cellRef(cell) === cellRef(named));
  return held === undefined ? null : { cell: held, sightings: held.sightings };
}

/** The certificate's two boundary statements, as they will print (L-QTY-07). */
export async function certificatePreviewOf(scope: CoverageScope): Promise<CertificatePreview> {
  const residue = await residueOf(scope);
  return { measurement: measurementStatementOf(residue.cells), bill: billStatementOf(residue.cells) };
}
