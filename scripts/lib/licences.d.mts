/**
 * Types for the node half of the AGPL ban, so the tree's own TypeScript suite can drive the
 * real checker (tests/toolchain/licences.test.ts). The implementation is licences.mjs;
 * allowJs is off, so the shape is declared here — the same arrangement verify-roster.d.mts
 * makes for the roster.
 */

/** The banned distributions, by the name a manifest spells them with (L-CAD-04). */
export declare const BANNED: readonly string[];

/** Every banned distribution the two manifests name; empty is the whole of "clean". */
export declare function bannedLicenceFindings(
  packageJsonText: string,
  lockfileText: string,
): string[];
