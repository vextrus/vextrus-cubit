/**
 * AM-09 §1 — the registry IS the test surface, and this is what makes that a fact rather than a wish.
 *
 * Three things are asserted, and the first is the one that matters most:
 *
 * 1. EVERY ID IS BYTE-IDENTICAL to what it was. The golden list below is the harvest taken the day
 *    the registry landed — `data-testid="…"` across `src/**`, plus the ids the journeys address that
 *    no literal in `src` spells (they are composed at runtime from a table: the shell rail, the auth
 *    form's fields, the takeoff nav, the snap and partition toggles). A rename is never a refactor:
 *    a Design Decision cites the id, a committed baseline was taken through it, and the engine's
 *    fault-271 testContract reads it. If this test goes red, the question is not "is the new name
 *    nicer" — it is "which Decision, which baseline and which contract is being amended, and where
 *    is that written down".
 *
 * 2. NO PAGE OBJECT SPELLS AN ID. `tests/e2e/pages/*.page.ts` reach the registry or they reach
 *    nothing. This is read from the files' text on purpose and it is the one honest way to read it:
 *    the claim is about what is WRITTEN in those files, not about what any of them does at runtime —
 *    a page object that held a duplicate literal would behave identically to one that imported the
 *    same string, which is exactly why the duplicate is invisible to every behavioural test and has
 *    to be caught here.
 *
 * 3. EVERY ID `src/**` PUBLISHES IS IN THE REGISTRY. Coverage, not exclusivity: the component files
 *    still carry their literals (they belong to other nodes and are listed in this increment's
 *    handoff), so the law this test can enforce today is that no id exists that the registry has
 *    never heard of. A component that publishes a new id registers it in the same commit.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ALL_TESTIDS, TESTIDS, isTestId, testId, testIdSelector } from "./testids";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PAGES = join(REPO_ROOT, "tests", "e2e", "pages");
const SRC = join(REPO_ROOT, "src");

/**
 * THE GOLDEN LIST. Every test id the tree published on 2026-09-12, sorted, byte for byte. Nothing
 * derives it; it is written out so that a diff of this file is a diff of the product's test surface.
 */
const GOLDEN: readonly string[] = [
  "accept-invitation-form",
  "accept-invitation-refusal",
  "accept-invitation-submit",
  "accept-invitation-workspace",
  "act-dot",
  "acting",
  "audit-act-consequence",
  "audit-act-evidence",
  "audit-act-row",
  "audit-acts",
  "audit-acts-empty",
  "audit-filter-actor",
  "audit-filter-subject",
  "audit-filter-type",
  "audit-panel-jobs",
  "audit-panel-model-ledger",
  "basis-chip",
  "basis-glyph",
  "boundary-reached",
  "breadcrumb",
  "breadcrumb-crumb",
  "breadcrumb-menu",
  "breadcrumb-menu-list",
  "command-palette",
  "command-palette-empty",
  "command-palette-group",
  "command-palette-input",
  "command-palette-item",
  "command-palette-item-reason",
  "command-palette-list",
  "command-palette-loading",
  "command-palette-refusal",
  "consequence-confirm",
  "consequence-dialog",
  "consequence-digest-line",
  "consequence-effect-lines",
  "consequence-effect-signatures",
  "consequence-stale-notice",
  "consequence-subject-row",
  "contextmenu-content",
  "coverage-answer",
  "coverage-cell",
  "coverage-cell-glyph",
  "coverage-certificate-preview",
  "coverage-chip",
  "coverage-declare-out-of-scope",
  "coverage-empty",
  "coverage-grid",
  "coverage-hold-out",
  "coverage-inspector",
  "coverage-inspector-cause",
  "coverage-inspector-observation",
  "coverage-inspector-remedy",
  "coverage-inspector-sighting",
  "coverage-kind-row",
  "coverage-legend",
  "coverage-legend-entry",
  "coverage-retry",
  "coverage-screen",
  "coverage-statement",
  "coverage-statement-none",
  "coverage-statement-row",
  "datatable",
  "datatable-cell",
  "datatable-cell-editor",
  "datatable-cell-entered",
  "datatable-columns",
  "datatable-columns-toggle",
  "datatable-footer",
  "datatable-group-row",
  "datatable-group-subtotal",
  "datatable-header",
  "datatable-row",
  "datatable-row-refusal",
  "datatable-row-refused",
  "datatable-skeleton-row",
  "datatable-total",
  "datatable-viewport",
  "density-option-comfortable",
  "density-option-compact",
  "density-toggle",
  "dialog-content",
  "dropdown-content",
  "dropzone",
  "dropzone-browse",
  "dropzone-folder-input",
  "dropzone-input",
  "dropzone-item",
  "dropzone-item-progress",
  "error-retry",
  "error-state",
  "error-state-message",
  "error-state-report",
  "error-state-retry",
  "error-state-title",
  "evidence-link",
  "evidence-link-glyph",
  "gallery-barrel",
  "gallery-entry",
  "gallery-shell",
  "gallery-state",
  "invitations-email",
  "invitations-none",
  "invitations-refusal",
  "invitations-resend",
  "invitations-revoke",
  "invitations-row",
  "invitations-submit",
  "job-timeline",
  "job-timeline-idle",
  "job-timeline-step",
  "job-timeline-step-fault",
  "job-timeline-step-status",
  "job-timeline-step-timing",
  "job-timeline-transport-lost",
  "members-history-entry",
  "members-invite-form",
  "members-list",
  "members-pending-invitations",
  "members-refusal",
  "members-remove-form",
  "members-remove-submit",
  "members-role-form",
  "members-role-history",
  "members-role-select",
  "members-role-submit",
  "members-row",
  "members-row-role",
  "members-section",
  "offered-group",
  "offered-group-confirm",
  "offered-group-count",
  "offered-groups",
  "participants-assign-direction",
  "participants-assign-form",
  "participants-assign-role",
  "participants-assign-subject",
  "participants-history",
  "participants-history-row",
  "participants-list",
  "participants-refusal",
  "participants-row",
  "popover-content",
  "project-archive",
  "project-building-type",
  "project-client",
  "project-code",
  "project-district",
  "project-edit",
  "project-form",
  "project-form-refusal",
  "project-form-submit",
  "project-gfa-m2",
  "project-gfa-sft",
  "project-home",
  "project-home-activity",
  "project-home-activity-all",
  "project-home-activity-empty",
  "project-home-activity-row",
  "project-home-ai-calls",
  "project-home-ai-cost",
  "project-home-ai-cost-unit",
  "project-home-ai-ledger",
  "project-home-ai-none",
  "project-home-ai-outcomes",
  "project-home-ai-spend",
  "project-home-client",
  "project-home-district",
  "project-home-gfa",
  "project-home-gfa-sft",
  "project-home-header",
  "project-home-name",
  "project-home-participant",
  "project-home-participant-role",
  "project-home-participants",
  "project-home-zone-badge",
  "project-home-zones",
  "project-name",
  "project-notes",
  "project-quick-action",
  "project-quick-actions",
  "project-restore",
  "project-site-address",
  "project-storeys",
  "project-tab",
  "project-tabs",
  "refusal-code",
  "refusal-evidence-link",
  "refusal-message",
  "refusal-remedy",
  "refusal-state",
  "register-answer",
  "register-attribute",
  "register-campaign",
  "register-empty",
  "register-inspector",
  "register-level-stack",
  "register-lines",
  "register-lines-count",
  "register-measure",
  "register-object-basis",
  "register-object-corroboration",
  "register-object-key",
  "register-object-role",
  "register-reading",
  "register-refusal",
  "register-refusal-object",
  "register-refusals",
  "register-repudiated-count",
  "register-retry",
  "register-source-key",
  "register-timeline",
  "register-tree",
  "register-workspace",
  "resizable-handle",
  "root-home-heading",
  "root-home-main",
  "root-home-tagline",
  "root-home-workspace-door",
  "ruleset-edition-digest",
  "ruleset-edition-identity",
  "ruleset-lineage",
  "ruleset-lineage-step",
  "ruleset-parameter-row",
  "ruleset-parameter-table",
  "ruleset-unpinned",
  "s-auth-email",
  "s-auth-fault",
  "s-auth-notice",
  "s-auth-password",
  "s-auth-refusal",
  "s-auth-session-current",
  "s-auth-session-revoke",
  "s-auth-session-row",
  "s-auth-signout",
  "s-auth-submit",
  "s-auth-tenant-name",
  "s-home-create-project",
  "s-home-grid",
  "s-home-project-archived-badge",
  "s-home-project-card",
  "s-home-project-last-activity",
  "s-home-project-open",
  "s-home-project-ruleset",
  "s-home-project-status",
  "s-home-quick-stats",
  "s-home-recent-documents",
  "s-home-stat-bids",
  "s-home-stat-campaigns",
  "s-home-stat-estimates",
  "s-home-stat-sheets",
  "scrollarea-viewport",
  "set-browser",
  "set-create",
  "set-create-form",
  "set-drawing",
  "set-drawing-name",
  "set-drawing-revision",
  "set-drawing-revision-count",
  "set-drawings",
  "set-drawings-link",
  "set-empty",
  "set-heading",
  "set-member-toggle",
  "set-name-input",
  "set-open",
  "set-pin",
  "set-revision",
  "set-revision-digest",
  "set-revision-member",
  "set-revisions",
  "set-row",
  "set-row-digest",
  "set-row-name",
  "sets-empty",
  "sets-index",
  "settings-members-link",
  "sheet-card",
  "sheet-card-discipline",
  "sheet-card-format",
  "sheet-card-number",
  "sheet-card-open",
  "sheet-card-scale",
  "sheet-card-scheme",
  "sheet-card-thumbnail",
  "sheet-card-title",
  "sheet-card-views",
  "sheet-confirm",
  "sheet-content",
  "sheet-discipline-option",
  "sheet-fact",
  "sheet-filter-option",
  "sheet-index",
  "sheet-search",
  "sheets-empty",
  "shell-breadcrumb",
  "shell-command-palette",
  "shell-crumb-page",
  "shell-denied-holder",
  "shell-denied-permission",
  "shell-empty",
  "shell-empty-action",
  "shell-inspector",
  "shell-inspector-resize",
  "shell-jobs-tray",
  "shell-jobs-tray-empty",
  "shell-jobs-tray-item",
  "shell-jobs-tray-item-timing",
  "shell-jobs-tray-panel",
  "shell-main",
  "shell-permission-denied",
  "shell-rail",
  "shell-rail-collapse",
  "shell-rail-mark",
  "shell-rename-input",
  "shell-rename-refusal",
  "shell-rename-submit",
  "shell-root",
  "shell-sample-offer",
  "shell-sample-outcome",
  "shell-settings-name",
  "shell-status",
  "shell-status-jobs",
  "shell-tenant-switcher",
  "shell-toolbar",
  "shell-topbar",
  "shell-user",
  "shell-user-sessions",
  "shell-user-signout",
  "shortcut-sheet",
  "shortcut-sheet-keys",
  "shortcut-sheet-row",
  "skeleton",
  "takeoff-nav",
  "takeoff-nav-coverage",
  "takeoff-nav-register",
  "theme-option-dark",
  "theme-option-light",
  "theme-option-system",
  "theme-toggle",
  "tooltip-content",
  "tree",
  "tree-item",
  "unit-badge",
  "viewer-canvas",
  "viewer-empty",
  "viewer-fidelity-fact",
  "viewer-fidelity-facts",
  "viewer-fit",
  "viewer-inspector",
  "viewer-inspector-cited",
  "viewer-inspector-cited-line",
  "viewer-inspector-clear",
  "viewer-inspector-copy",
  "viewer-inspector-entity",
  "viewer-inspector-hover",
  "viewer-inspector-hover-handle",
  "viewer-inspector-hover-layer",
  "viewer-inspector-hover-type",
  "viewer-inspector-key",
  "viewer-inspector-missing",
  "viewer-inspector-missing-key",
  "viewer-inspector-reveal",
  "viewer-inspector-selection",
  "viewer-inspector-tab-scale",
  "viewer-inspector-tab-selection",
  "viewer-inspector-tabs",
  "viewer-inspector-trace",
  "viewer-inspector-trace-formula",
  "viewer-inspector-trace-origin",
  "viewer-inspector-trace-retry",
  "viewer-inspector-trace-variable",
  "viewer-layer-count",
  "viewer-layer-isolate",
  "viewer-layer-lock",
  "viewer-layer-row",
  "viewer-layer-select",
  "viewer-layer-swatch",
  "viewer-layer-visible",
  "viewer-layers",
  "viewer-loading",
  "viewer-marquee",
  "viewer-partition",
  "viewer-partition-axis",
  "viewer-partition-canvas",
  "viewer-partition-grid-deferral",
  "viewer-partition-grid-toggle",
  "viewer-partition-groups",
  "viewer-partition-retry",
  "viewer-partition-view",
  "viewer-partition-view-badge",
  "viewer-partition-view-reason",
  "viewer-partition-views-toggle",
  "viewer-scale",
  "viewer-scale-affirm",
  "viewer-scale-answer",
  "viewer-scale-check-verification",
  "viewer-scale-distance",
  "viewer-scale-member",
  "viewer-scale-observation",
  "viewer-scale-observe",
  "viewer-scale-proposal",
  "viewer-scale-retry",
  "viewer-scale-unit",
  "viewer-scale-view",
  "viewer-screen",
  "viewer-snap-angle",
  "viewer-snap-glyph",
  "viewer-snap-ortho",
  "viewer-snap-pick",
  "viewer-snap-toggle",
  "viewer-status",
  "viewer-status-distance",
  "viewer-status-selection",
  "viewer-status-snap",
  "viewer-zoom-in",
  "viewer-zoom-out",
];

/** Every file under a tree, by extension, so a scan reads the tree rather than a listing of it. */
function filesUnder(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

describe("AM-09 §1: the test-id registry", () => {
  test("every id is byte-identical to the committed golden list", () => {
    expect([...ALL_TESTIDS]).toEqual([...GOLDEN]);
  });

  test("no id is declared twice, under any key", () => {
    expect(new Set(ALL_TESTIDS).size, "two keys in the registry carry the same id — one home per id (ARCH-02)").toBe(ALL_TESTIDS.length);
  });

  test("the helpers answer for the registry and for nothing else", () => {
    expect(isTestId(TESTIDS.sHome.grid)).toBe(true);
    expect(isTestId("an-id-the-product-does-not-publish")).toBe(false);
    expect(testIdSelector(TESTIDS.sHome.grid)).toBe('[data-testid="s-home-grid"]');
    expect(testId(TESTIDS.sHome.grid)).toEqual({ "data-testid": "s-home-grid" });
  });

  test("no test id literal is spelled in tests/e2e/pages — the page objects read the registry", () => {
    const known = new Set<string>(ALL_TESTIDS);
    const spelled: string[] = [];
    for (const path of filesUnder(PAGES, [".ts"])) {
      // white-box: AM-09 §1 — the criterion is about the TEXT of these files. A page object holding
      // a duplicate literal behaves exactly like one that imports the same string, so no run of
      // anything can tell them apart; reading the source is the only observation that can.
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/["'`]([a-z0-9][a-z0-9-]*)["'`]/g)) {
        const value = match[1] ?? "";
        if (known.has(value)) spelled.push(`${path.slice(REPO_ROOT.length + 1)}: "${value}"`);
      }
    }
    expect(spelled, "a page object spells a test id instead of importing it from src/ui/testids.ts (AM-09 §1)").toEqual([]);
  });

  test("every id src/** publishes is in the registry", () => {
    const known = new Set<string>(ALL_TESTIDS);
    const unregistered = new Set<string>();
    for (const path of filesUnder(SRC, [".ts", ".tsx"])) {
      // white-box: AM-09 §1 — same reading, from the publishing side: an id is a string in a source
      // file until a screen renders, and no unit lane renders every screen.
      // The registry's law binds what the product SHIPS. A suite that renders a component with an
      // id of its own invention ("sw", "held") is naming a fixture, not publishing a screen's handle,
      // and there is nothing for a journey to address — so the suites are out of this reading.
      if (/\.test\.tsx?$/.test(path) || path.endsWith("testids.ts")) continue;
      const source = readFileSync(path, "utf8");
      // The three ways a component publishes an id: the attribute itself, and the two prop shapes a
      // component that renders a TABLE of controls hands it down by (`testId: "…"`, `testId="…"`).
      for (const shape of [/data-testid="([^"$]+)"/g, /\btestId:\s*"([a-z0-9][a-z0-9-]*)"/g, /\btestId="([a-z0-9][a-z0-9-]*)"/g]) {
        for (const match of source.matchAll(shape)) {
          const value = match[1] ?? "";
          if (!known.has(value)) unregistered.add(`${path.slice(REPO_ROOT.length + 1)}: "${value}"`);
        }
      }
    }
    expect([...unregistered], "a component publishes a test id the registry has never heard of — add it to src/ui/testids.ts and to the golden list below, in the same commit (AM-09 §1)").toEqual([]);
  });
});
