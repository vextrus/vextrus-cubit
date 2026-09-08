// The register's identity core (L-REG-02, L-REG-04, L-REG-05): the grammars every derived row key is
// spelled by, the one code-unit sort every ordering in the register goes through, the ordinal keys a
// mark family freezes under, and the semantic that invalidates a disposition without ever keying a
// row.
//
// Pure and storeless: no clock, no sequence, no random source, no database (ARCH-02). A key is a
// function of what was seen, which is what makes an identical re-derivation reproduce the identical
// key multiset (L-REG-04).
//
// Every name is spelled rather than starred — this barrel is the area's public roster, and a roster
// that says nothing cannot tell a moved name from a dropped one (ARCH-02).
export { compareCanonical, sortCanonical } from "./compare-canonical";
export { LEVEL_SLOTS, UNREGISTERED_PREFIX, barKey, carryLevel, instanceKey, isLevelSlot, levelSegment, placementKey, quantise, viewKey } from "./keys";
export type { BarRef, CarriedKey, InstanceRef, LevelRef, LevelSlot, PlacementRef, ViewRef } from "./keys";
export { contentSignature, ordinalKeys } from "./ordinals";
export type { FamilyRow } from "./ordinals";
export { canonicalSemantic, dispositionsCarry, semanticDigest } from "./semantic";
