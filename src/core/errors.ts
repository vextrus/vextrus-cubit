// R-SPINE-062: the closed refusal taxonomy, and its one home (ARCH-02, B-17). Every code carries
// an English message, a remedy hint, a severity and a surface hint; every transport and every
// screen reads a refusal from here rather than writing one of its own.
//
// The taxonomy is closed in the strong sense B-06 asks for: a code is registered here or it does
// not exist. `refusalOf` throws on a code the registry lacks rather than inventing an entry, so a
// mistyped code fails loudly at its call site instead of reaching a user as an empty answer.
//
// The copy is fixed by docs/design/refusal-state.md § 3, whose rules bind every entry here: the
// message is one present-tense sentence saying what was refused and why, the remedy one sentence
// beginning with the verb that resolves it. Operator detail — the internal "why" a seam carries
// alongside the code — never appears here; it travels with the thrown marker instead.
//
// "Here" is this DIRECTORY, not this file (AM-11). Each area of the product registers its own codes
// in `./errors/<area>.ts`, and this file is the register: it ENUMERATES those groups and merges
// them, so the taxonomy is still exactly one closed set and every importer still reads it from
// `@/core/errors`. An area adds a code by editing its own file and nothing else — two areas written
// at once never touch one list, and a group this file does not name is a group nothing holds (B-19).

import { ACTS_REFUSALS, type ActsRefusalCode } from "./errors/acts";
import { AI_REFUSALS, type AiRefusalCode } from "./errors/ai";
import { BOQ_REFUSALS, type BoqRefusalCode } from "./errors/boq";
import { DOCS_REFUSALS, type DocsRefusalCode } from "./errors/docs";
import { DRAWINGS_REFUSALS, type DrawingsRefusalCode } from "./errors/drawings";
import { DRAWING_SETS_REFUSALS, type DrawingSetsRefusalCode } from "./errors/drawing-sets";
import { FORMAT_REFUSALS, type FormatRefusalCode } from "./errors/format";
import { FOUNDATIONS_REFUSALS, type FoundationsRefusalCode } from "./errors/foundations";
import { FRAME_REFUSALS, type FrameRefusalCode } from "./errors/frame";
import { GATE_REFUSALS, type GateRefusalCode } from "./errors/gate";
import { IDENTITY_REFUSALS, type IdentityRefusalCode } from "./errors/identity";
import { INVITATIONS_REFUSALS, type InvitationsRefusalCode } from "./errors/invitations";
import type { RefusalSeverity, RefusalSurface } from "./errors/law";
import { MASONRY_REFUSALS, type MasonryRefusalCode } from "./errors/masonry";
import { REBAR_REFUSALS, type RebarRefusalCode } from "./errors/rebar";
import { REGISTER_REFUSALS, type RegisterRefusalCode } from "./errors/register";
import { RESIDUE_REFUSALS, type ResidueRefusalCode } from "./errors/residue";
import { SERVER_REFUSALS, type ServerRefusalCode } from "./errors/server";
import { SLABS_REFUSALS, type SlabsRefusalCode } from "./errors/slabs";
import { TAKEOFF_GRIDS_REFUSALS, type TakeoffGridsRefusalCode } from "./errors/takeoff-grids";
import { TAKEOFF_INGEST_REFUSALS, type TakeoffIngestRefusalCode } from "./errors/takeoff-ingest";
import { TAKEOFF_LEVELS_REFUSALS, type TakeoffLevelsRefusalCode } from "./errors/takeoff-levels";
import { TAKEOFF_PLACEMENTS_REFUSALS, type TakeoffPlacementsRefusalCode } from "./errors/takeoff-placements";
import { TAKEOFF_SCALE_REFUSALS, type TakeoffScaleRefusalCode } from "./errors/takeoff-scale";
import { TAKEOFF_SCHEDULES_REFUSALS, type TakeoffSchedulesRefusalCode } from "./errors/takeoff-schedules";
import { TAKEOFF_VIEWS_REFUSALS, type TakeoffViewsRefusalCode } from "./errors/takeoff-views";
import { UNITS_REFUSALS, type UnitsRefusalCode } from "./errors/units";

// The shape an entry is registered in lives beside the areas that declare theirs against it, and is
// published from here because this is the door every reader opens (B-17).
export type { RefusalSeverity, RefusalSurface } from "./errors/law";

// The closed lists that are made OF these codes stand with the codes they name, and are handed out
// from here for the same reason: the seam is not a module's to import (SEAM-TENANT), and a roster its
// readers cannot reach is a roster they would copy (B-17, Q-07).
export { SCHEDULE_DEFERRAL_REASONS, type ScheduleDeferralReason } from "./errors/takeoff-schedules";
export { EXPANSION_DEFERRAL_REASONS, type ExpansionDeferralReason } from "./errors/takeoff-placements";
export { SCOPE_DECLARATION_CAUSES, type ScopeDeclarationCause } from "./errors/residue";

/**
 * Every code the taxonomy holds: the union of what each area registers. The union is the registry's
 * key set — the two cannot drift, because both are read off the same groups (B-19).
 */
export type RefusalCode =
  | FormatRefusalCode
  | IdentityRefusalCode
  | ActsRefusalCode
  | InvitationsRefusalCode
  | AiRefusalCode
  | DrawingsRefusalCode
  | TakeoffIngestRefusalCode
  | TakeoffViewsRefusalCode
  | TakeoffGridsRefusalCode
  | TakeoffSchedulesRefusalCode
  | TakeoffPlacementsRefusalCode
  | DrawingSetsRefusalCode
  | TakeoffScaleRefusalCode
  | UnitsRefusalCode
  | RegisterRefusalCode
  | ServerRefusalCode
  | TakeoffLevelsRefusalCode
  | GateRefusalCode
  | FrameRefusalCode
  | ResidueRefusalCode
  | BoqRefusalCode
  | DocsRefusalCode
  | FoundationsRefusalCode
  | MasonryRefusalCode
  | RebarRefusalCode
  | SlabsRefusalCode;

/** One registered refusal, whole: what it is, what happened, what resolves it, how it renders. */
export type RefusalEntry = {
  readonly code: RefusalCode;
  readonly message: string;
  readonly remedy: string;
  readonly severity: RefusalSeverity;
  readonly surface: RefusalSurface;
};

/**
 * The registry, keyed by the code itself and frozen entry by entry — a refusal read at a transport
 * or a screen is the registered answer, never a mutated one. Each entry's `code` keeps the type of
 * its own key, so a seam that answers with a narrow set of codes can read the value out of the
 * register instead of re-spelling it as a literal beside it (Q-07).
 *
 * It is assembled by spreading every area group above rather than by listing entries: the merge is
 * the enumeration, and the annotation is what proves it total — an area whose group this file forgot
 * to spread is a code in `RefusalCode` with no entry under it, and tsc says so here.
 */
export const REFUSALS: Readonly<{ [C in RefusalCode]: RefusalEntry & { code: C } }> = Object.freeze({
  ...FORMAT_REFUSALS,
  ...IDENTITY_REFUSALS,
  ...ACTS_REFUSALS,
  ...INVITATIONS_REFUSALS,
  ...AI_REFUSALS,
  ...DRAWINGS_REFUSALS,
  ...TAKEOFF_INGEST_REFUSALS,
  ...TAKEOFF_VIEWS_REFUSALS,
  ...TAKEOFF_GRIDS_REFUSALS,
  ...TAKEOFF_SCHEDULES_REFUSALS,
  ...TAKEOFF_PLACEMENTS_REFUSALS,
  ...DRAWING_SETS_REFUSALS,
  ...TAKEOFF_SCALE_REFUSALS,
  ...UNITS_REFUSALS,
  ...REGISTER_REFUSALS,
  ...SERVER_REFUSALS,
  ...TAKEOFF_LEVELS_REFUSALS,
  ...GATE_REFUSALS,
  ...FRAME_REFUSALS,
  ...RESIDUE_REFUSALS,
  ...BOQ_REFUSALS,
  ...DOCS_REFUSALS,
  ...FOUNDATIONS_REFUSALS,
  ...MASONRY_REFUSALS,
  ...REBAR_REFUSALS,
  ...SLABS_REFUSALS,
});

/**
 * The registered entry for a code. An unregistered code is a mistake in the caller, not a refusal
 * the product can answer with, so it throws rather than guessing one (B-06, R-SPINE-062).
 */
export function refusalOf(code: RefusalCode): RefusalEntry {
  if (!Object.hasOwn(REFUSALS, code)) {
    throw new Error(`"${code}" is not a registered refusal — the taxonomy is closed (R-SPINE-062, B-06)`);
  }
  return REFUSALS[code];
}
