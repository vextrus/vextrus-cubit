/**
 * THE PANEL'S MOUNT CONTRACT (inc-304b-site-facts-panel, AC-6), public and in one place.
 *
 * AC-6 mounts `SiteFactsPanel` from `src/modules/takeoff/site-facts-ui` "with injected standing
 * facts and injected preview/commit actions". WHICH props those are is a literal a test cannot
 * guess, so it is declared here, in the tree, where the Builder reads it: the panel is mounted with
 * exactly the values below, and a panel whose props are spelled otherwise fails to compile against
 * this file rather than failing a run for a reason nobody can see.
 *
 * The door shapes are the tree's own precedent, the one the Author edition screen already ships
 * (`settings/ruleset-author/actions.ts`): a preview answers the consequence and its digest or the
 * refusal code, a commit answers the act it wrote or the refusal that stopped it. The panel turns a
 * refused answer into what `ConsequenceDialog` renders — that conversion is the screen's, not this
 * stage's (B-17).
 *
 * No JSX: this module is imported by suites that run under configs which leave `jsx: preserve`
 * alone, and `createElement` is the same mount with no transform to agree about.
 */
import { render, type RenderResult } from "@testing-library/react";
import { createElement } from "react";
import { expect } from "vitest";
import type { Consequence } from "../../../../src/core/acts";
import type { RefusalCode } from "../../../../src/core/errors";
import type { SiteFact, StandingSiteFact } from "../../../../src/core/site-facts/law";
import { SiteFactsPanel } from "../../../../src/modules/takeoff/site-facts-ui";

/** What the screen states at either door, for one fact of one project. */
export interface StagedSiteFactStatement {
  readonly projectId: string;
  readonly fact: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly sourceNote: string;
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type StagedPreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type StagedCommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/** Everything the panel is mounted with. A prop the panel needs that is absent here is a plan defect. */
export interface StagedSiteFactsPanel {
  readonly tenantId: string;
  readonly projectId: string;
  /** What each fact stands at — `standingSiteFacts`' own answer, with an absent key per absent fact. */
  readonly standing: Readonly<Partial<Record<SiteFact, StandingSiteFact>>>;
  /** Whether this reader holds AUTHOR_PROJECT_FACT; a reader without it still sees the whole panel. */
  readonly mayAuthor: boolean;
  readonly preview: (statement: StagedSiteFactStatement) => Promise<StagedPreviewAnswer>;
  readonly commit: (carried: StagedSiteFactStatement & { consequenceDigest: string }) => Promise<StagedCommitAnswer>;
  /** Where a deferral's evidence leads for the facts the pinned edition may also state (I-B). */
  readonly rulesetHref: string;
  /** Where PERMISSION_NOT_HELD is resolved: the screen a role is granted on. */
  readonly participantsHref: string;
}

/**
 * The DOM instruments a suite reads this mount with, re-exported from here so that every caller —
 * including one whose own module resolution cannot see this checkout's `node_modules` — reaches the
 * same testing library the mount rendered with, rather than a second copy of it.
 */
export { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";

/** The workspace and project every mount stands in, so a caller states only what its case is about. */
export const STAGED_TENANT = "00000000-0000-4000-8000-0000000000aa";
export const STAGED_PROJECT = "00000000-0000-4000-8000-0000000000bb";

/** The panel, mounted with the values a case states and the defaults for everything it does not. */
export function mountSiteFactsPanel(staged: Partial<StagedSiteFactsPanel> = {}): RenderResult {
  // The panel is a component before it is anything else: a barrel that exports something else under
  // this name fails HERE, naming the module, rather than as an opaque render fault in the caller.
  expect(typeof SiteFactsPanel, "src/modules/takeoff/site-facts-ui exports SiteFactsPanel as a component").toBe("function");
  const props: StagedSiteFactsPanel = {
    tenantId: STAGED_TENANT,
    projectId: STAGED_PROJECT,
    standing: {},
    mayAuthor: true,
    preview: () => Promise.reject(new Error("this mount states no preview door")),
    commit: () => Promise.reject(new Error("this mount states no commit door")),
    rulesetHref: `/t/${STAGED_TENANT}/p/${STAGED_PROJECT}/settings/ruleset`,
    participantsHref: `/t/${STAGED_TENANT}/p/${STAGED_PROJECT}/settings/participants`,
    ...staged,
  };
  return render(createElement(SiteFactsPanel, props));
}
