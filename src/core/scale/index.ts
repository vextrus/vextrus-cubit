// L-MEA-05's scale engine, pure: the law's rosters and arithmetic (./law), a QS observation judged
// (./observation), the machine's proposals over an artifact (./proposals) and the refusals the engine
// answers with (./refusals). This barrel opens no store and reads no clock — what needs a store
// stands beside it (./store, ./tolerances, ./evidence) and is reached by the act seam and the takeoff
// door by name, so the law stays a law (ARCH-02, B-17).
export {
  FACTOR_PATTERN,
  FACTOR_PLACES,
  QS_TWO_POINT,
  SCALE_RANKS,
  SCALE_UNITS,
  anisotropyOf,
  calibrationKey,
  exact,
  factorPair,
  isFactorString,
  isScaleRank,
  isScaleUnit,
  judgeAnisotropy,
  metresPer,
  metresPerExact,
  precedenceOf,
  renderFactor,
  strongestOf,
  unitFactor,
  withinTolerance,
  type AnisotropyJudgement,
  type DecimalValue,
  type FactorPair,
  type MachineScaleRank,
  type ScalePrecedence,
  type ScaleRank,
  type ScaleUnit,
} from "./law";
export {
  DISTANCE_BASIS_ENTERED,
  citeObservation,
  verifyAxis,
  type AxisVerification,
  type CitedObservation,
  type CitedPoint,
  type EnteredDistance,
  type ScaleAxis,
  type TwoPointObservation,
} from "./observation";
export {
  GRID_MATCH_TOLERANCE,
  proposalsFor,
  readDimensions,
  type DimensionReading,
  type GridReading,
  type ScaleEvidence,
  type ScaleProposal,
  type ScaleTolerances,
} from "./proposals";
export {
  scaleNoEvidence,
  scaleObservationOblique,
  scaleObservationUncited,
  scaleObservationUnverified,
  scaleUnitUnmapped,
  type ScaleAbsenceCode,
  type ScaleRefusalCode,
} from "./refusals";
