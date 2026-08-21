/**
 * The closed refusal taxonomy (R-SPINE-062), composed.
 *
 * R-SPINE-062 names this file, and this file is the only import surface: everything above it
 * asks for a code here and nowhere else. The codes themselves live one module at a time under
 * `src/core/errors/`, because a taxonomy kept in one flat file becomes a file every module
 * edits and nobody owns. The barrel folds those registries together and adds nothing —
 * composing is all it does, which is why it imports from `./errors/` and from nothing else.
 *
 * L-QTY-04: "Reason codes are closed enums, never prose; the same taxonomy serves machine
 * refusals and human deferrals." `RefusalCode` is that enum, derived from the table rather
 * than declared beside it, so a code cannot exist as a type without a message to go with it.
 */
import { SPINE_REFUSALS } from './errors/spine';

export type { RefusalEntry, RefusalSeverity, RefusalSurface } from './errors/types';
export { auditRefusalRegister } from './errors/audit';
export type { RegisterAuditInput, RegisterAuditResult } from './errors/audit';

/** Every registered refusal, by code. One module registry today; the fold is the same for n. */
export const REFUSALS = { ...SPINE_REFUSALS };

/** The closed enum: exactly the codes the table above carries. */
export type RefusalCode = keyof typeof REFUSALS;

/** The same enum as a value, for the register and for anything that must range over it. */
export const REFUSAL_CODES: readonly RefusalCode[] = Object.keys(REFUSALS) as RefusalCode[];
