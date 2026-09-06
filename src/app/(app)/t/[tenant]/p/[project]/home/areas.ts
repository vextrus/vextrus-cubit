// What a project has, and where each of it stands. S-Project names seven areas in one order —
// "Drawings · Takeoff · Assure · Estimate · Bid · Activity · Settings" — and four of them have no
// screen on this tree yet. The roster below is the one place that is stated: a tab's availability is
// read off its `route`, never written beside it, so the day an area's screen lands the tab becomes a
// link by gaining an address and nothing else changes (B-17, R-UI-031).
//
// An address that already has a home is imported from it rather than respelled (B-17); the two this
// screen is the first to link have their spelling here.
import { drawingsRoute } from "../drawings/route-address";
import { setsRoute } from "../drawings/sets/route-address";
import { participantsRoute } from "../settings/participants/route-address";
import type { ProjectHomeStringKey } from "./strings";

/** This screen's own address, spelled once (B-17): the door every S-Home card opens (I-131). */
export function projectHomeRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}`;
}

/** S-Audit's address — the whole act log, and the model ledger every AI figure here is evidence of. */
export function auditRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/audit`;
}

/** The pinned rule set — the settings surface a project's `settings` area answers on today. */
export function rulesetRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/settings/ruleset`;
}

/** One place a reader can go from this home, named by its own line of the table beside it. */
export interface ProjectArea {
  /** The key the screen carries as `data-area` or `data-action`, and the roster is read by. */
  readonly key: string;
  readonly label: ProjectHomeStringKey;
  /** Where it leads, or `null` for an area this tree has no screen for yet (I-126). */
  readonly route: ((tenantId: string, projectId: string) => string) | null;
}

/**
 * S-Project's seven areas, in the clause's order. The four with no route are shown and not hidden:
 * the clause's seven areas are what this project has, and an area a reader cannot see is an area
 * they cannot plan around (I-126).
 */
export const PROJECT_AREAS: readonly ProjectArea[] = Object.freeze([
  { key: "drawings", label: "project_home_tab_drawings", route: drawingsRoute },
  { key: "takeoff", label: "project_home_tab_takeoff", route: null },
  { key: "assure", label: "project_home_tab_assure", route: null },
  { key: "estimate", label: "project_home_tab_estimate", route: null },
  { key: "bid", label: "project_home_tab_bid", route: null },
  { key: "activity", label: "project_home_tab_activity", route: auditRoute },
  { key: "settings", label: "project_home_tab_settings", route: rulesetRoute },
]);

/** A quick action always leads somewhere: a door that answers nothing is not an action (I-126). */
export interface ProjectQuickAction extends ProjectArea {
  readonly route: (tenantId: string, projectId: string) => string;
}

/**
 * The three things a reader most often comes to a project home to do (R-SPINE-013's quick actions).
 * Every one of them has a screen, so every one of them is a link.
 */
export const QUICK_ACTIONS: readonly ProjectQuickAction[] = Object.freeze([
  { key: "upload-drawings", label: "project_home_action_upload", route: drawingsRoute },
  { key: "browse-sets", label: "project_home_action_sets", route: setsRoute },
  { key: "manage-participants", label: "project_home_action_participants", route: participantsRoute },
]);

/**
 * How many of the newest acts the home lists before handing the reader the whole log (I-132). The
 * number is this screen's, and it is stated once: the page renders by it and the acceptance reads it
 * from here rather than transcribing a five (B-19).
 */
export const RECENT_ACTIVITY_LIMIT = 5;
