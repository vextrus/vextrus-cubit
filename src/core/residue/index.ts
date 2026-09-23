// The residue's public roster (L-QTY-05, L-QTY-07): the query, the pure resolution, the three
// channel readers and the two boundary statements. Every name is spelled rather than starred — this
// is the seam a screen and, later, a certificate read the residue through, and a roster is only
// readable if it says what it hands out (ARCH-02).
export { reportedAbsencesOf, residueOf, resolveResidue, type PlacedManifestView, type Residue, type ResidueScope } from "./residue";
export { registerSightings } from "./channels/register";
export { partitionSightings } from "./channels/partition";
export { layoutSightings } from "./channels/layout";
export { drawingIdsOf, layoutOf, type ManifestSheet, type SightingScope } from "./channels/scope";
export { billStatementOf, measurementStatementOf, partialStatementOf, unclassedStatementOf, type UnclassedStatementRow } from "./statement";
export { declaredSightings } from "./channels/declared";
export { classesDeclaredBy, classDeclarationsOf, unclassedDeclaredBy, unclassedDeclarationsOf, type ManifestView, type UnclassedDeclaration } from "./declared";
export { cellReasonOf, partialOf, type CellReason, type ReasonInput } from "./reasons";
export { runDeferralsOf, type RunDeferral, type RunDeferralInput } from "./deferrals";
export {
  BILL_CAUSES,
  CELL_GRAINS,
  COVERAGE_REASONS,
  IN_BILL,
  MEASUREMENT_CAUSES,
  QUANTITY_BEARING,
  RESIDUE_CAUSES,
  SIGHTING_CHANNELS,
  UNPLACED,
  cellRef,
  parseCellRef,
  type BillCause,
  type BillReading,
  type CellGrain,
  type CoverageReason,
  type MeasurementCause,
  type PartialDeclaration,
  type PartialOmission,
  type PartialStatementRow,
  type MeasurementReading,
  type ResidueCause,
  type ResidueCell,
  type ResidueDeclaration,
  type ResidueInput,
  type ResidueLevel,
  type ResidueLine,
  type ResidueObservation,
  type Sighting,
  type SightingChannel,
  type StatementRow,
  type TruncatedSheet,
} from "./law";
