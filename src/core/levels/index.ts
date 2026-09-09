// L-MEA-07's level model, as law rather than as storage: what a stack IS (`levelStackDigest`), what
// makes two storey-height readings the same reading (`readingKey`), how a height stands over the
// readings that compete for it (`storeyHeightStanding`), and the three refusals the model registers.
//
// Pure: nothing here touches a store, a clock or a random source, so the act seam's Consequence, the
// module door's read and inc-209's campaign snapshot all compute the same answers from the same
// values (ARCH-02, B-17). The store beside this file (`./store`) is what reaches the database, and
// the callers that need it name it directly.
export { STOREY_HEIGHT_BASES, STOREY_HEIGHT_STANDINGS, declaredOrdinal, isStoreyHeightBasis, type StoreyHeightBasis, type StoreyHeightStandingName } from "./law";
export { NO_SOURCE_SLOT, readingKey, type ReadingRef } from "./keys";
export { levelStackDigest, type StackMember } from "./digest";
export { storeyHeightStanding, type ReadingOfHeight, type StoreyHeightStanding } from "./standing";
export { CANONICAL_LENGTH, FACTOR_PROVENANCE, carryToMetres, type CarriedReading } from "./reading";
export { levelOrdinalUnmapped, storeyHeightContested, storeyHeightUnstated } from "./refusals";
