// R-TO-005 and L-REG-06's set refusals: what a draft set is answered with when it cannot be named,
// cannot be pinned or reaches past the project's own drawings — and Q-12's unsigned download.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type DrawingSetsRefusalCode =
  | "SET_NOT_PINNABLE"
  | "SET_NAME_NOT_USABLE"
  | "SET_MEMBER_NOT_IN_PROJECT"
  | "DOWNLOAD_NOT_SIGNABLE";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const DRAWING_SETS_REFUSALS: RefusalGroup<DrawingSetsRefusalCode> = Object.freeze({
  // L-REG-06's manifest is the citation list of a set's members, so a set naming none of this
  // project's drawings has nothing to be content-addressed: the pin answers by name rather than
  // recording an empty revision nobody could measure against.
  SET_NOT_PINNABLE: Object.freeze({
    code: "SET_NOT_PINNABLE",
    message: "This set names no members of this project, so no revision was pinned.",
    remedy: "Add at least one drawing to the set, then pin it.",
    severity: "error",
    surface: "inline",
  }),
  // R-TO-005: a project tells its sets apart by their names, so a blank name names nothing and a
  // name the project already carries names no new set.
  SET_NAME_NOT_USABLE: Object.freeze({
    code: "SET_NAME_NOT_USABLE",
    message: "The set name is blank or already names a set of this project, so no set was created.",
    remedy: "Give the set a name no other set of this project carries.",
    severity: "error",
    surface: "inline",
  }),
  // A membership is a draft over the project's own drawings (R-TO-005): a drawing the project does
  // not hold is one this set could never cite, so the toggle changes nothing and says so.
  SET_MEMBER_NOT_IN_PROJECT: Object.freeze({
    code: "SET_MEMBER_NOT_IN_PROJECT",
    message: "That drawing is not one of this project's, so the set was not changed.",
    remedy: "Reload the set and toggle a drawing the project holds.",
    severity: "error",
    surface: "inline",
  }),
  // Q-12's signed download URLs: an installation that has not been given a signing key signs
  // nothing rather than minting a key of its own — a minted key dies at the next restart, and a box
  // that mints one is effectively unsigned. Storing and serving evidence is untouched; only the
  // link is refused.
  DOWNLOAD_NOT_SIGNABLE: Object.freeze({
    code: "DOWNLOAD_NOT_SIGNABLE",
    message: "No download link was created, because this installation has not been given the key its links are signed with.",
    remedy: "Ask an operator to give this installation its signing key, then ask for the download again.",
    severity: "error",
    surface: "inline",
  }),
});
