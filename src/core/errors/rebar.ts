// The REBAR rail's own refusals — empty until M3 writes it (AM-11).
//
// M3's rebar rail registers its codes HERE. The barrel `src/core/errors.ts` already enumerates this
// file, so a code added to the group below is a code the closed taxonomy holds — with no shared list
// to edit and no other area's file to touch.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type RebarRefusalCode = never;

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const REBAR_REFUSALS: RefusalGroup<RebarRefusalCode> = Object.freeze({});
