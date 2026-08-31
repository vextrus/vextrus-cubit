// @vitest-environment jsdom
/**
 * C-13: a declared state renders its screen's committed copy, never an improvisation.
 *
 * Most of the matrix reads the shared table `src/ui/strings`, where the sentence has one home and no
 * drift is possible. Two screens keep their copy in a table beside the route — the audit log's
 * `audit_…` and the pinned rule set's `ruleset_…` — and `src/ui` may never import `src/app`
 * (ARCH-01), so those two empty states are mirrored into `src/ui/strings/screen-states.ts`. This
 * file is what binds the mirror to the original: each mirrored key is compared to the route table's
 * own value, so re-wording the screen's empty state without re-wording the declared one is a red
 * rather than two screens saying different things (B-17, R-SPINE-060).
 *
 * The comparison is against the shipped table, not against a sentence transcribed here, so the
 * Decision's copy stays the single source both spellings answer to (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import { auditStrings } from "../../src/app/(app)/t/[tenant]/p/[project]/audit/strings";
import { rulesetStrings } from "../../src/app/(app)/t/[tenant]/p/[project]/settings/ruleset/strings";
import { strings } from "../../src/ui/strings";
import { screenStates } from "../../src/ui/screen-states";
import { mountState, unmountAll, visibleText } from "./support/matrix-contract";

/** Each mirrored key of the matrix's table, and the route table's key it must repeat verbatim. */
const MIRRORED: readonly (readonly [keyof typeof strings, string])[] = [
  ["state_empty_audit_heading", auditStrings.audit_empty_none_heading],
  ["state_empty_audit_body", auditStrings.audit_empty_none_body],
  ["state_empty_ruleset_heading", rulesetStrings.ruleset_unpinned_heading],
  ["state_empty_ruleset_body", rulesetStrings.ruleset_unpinned_body],
];

/** The empty cell of each screen whose copy lives beside its route, and the words it owes. */
const OWED: readonly (readonly [string, readonly string[]])[] = [
  ["/t/[tenant]/p/[project]/audit", [auditStrings.audit_empty_none_heading, auditStrings.audit_empty_none_body]],
  [
    "/t/[tenant]/p/[project]/settings/ruleset",
    [rulesetStrings.ruleset_unpinned_heading, rulesetStrings.ruleset_unpinned_body, rulesetStrings.ruleset_unpinned_action],
  ],
];

describe("C-13: the declared empty states repeat the screens' committed copy", () => {
  afterEach(() => {
    unmountAll();
  });

  test("every mirrored key holds the route table's sentence, verbatim", () => {
    expect(MIRRORED.length, "there is a mirrored sentence to grade").toBeGreaterThan(0);
    for (const [key, committed] of MIRRORED) {
      expect(committed.length, `${key}'s source sentence is not empty`).toBeGreaterThan(0);
      expect(strings[key], `${key} is the screen's own committed copy`).toBe(committed);
    }
  });

  test("the audit and ruleset empty cells render exactly those sentences", () => {
    for (const [route, sentences] of OWED) {
      const declaration = screenStates[route];
      expect(declaration, `${route} is declared`).toBeDefined();
      if (declaration === undefined) continue;

      const { root } = mountState(declaration.empty.render());
      expect(root, `${route}/empty mounts an element`).not.toBeNull();
      const read = visibleText(root as Element);
      for (const sentence of sentences) {
        expect(read, `${route}/empty says the screen's own words`).toContain(sentence.replace(/\s+/g, " ").trim());
      }
      unmountAll();
    }
  });
});
