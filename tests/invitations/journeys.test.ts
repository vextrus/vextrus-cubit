/**
 * AC-4, in the part a journey run cannot report about itself: that the two new journey specs are
 * COLLECTED by the invocations the criterion names, that every checkpoint the increment fixes is
 * really taken, and that each one's Linux baseline is committed under the shipped
 * `snapshotPathTemplate` (B-20 — this node mints them, so this node owes them).
 *
 * The journeys themselves are graded by running them (`pnpm e2e --journey J-001` and `--journey
 * J-002`); nothing here re-drives a browser, which would be a second opinion about a lane that
 * already has one (ARCH-02). What is asked here is the part the run is silent about: a checkpoint
 * that was never written takes no shot and reds nothing, a checkpoint that shoots without asserting
 * agrees with the baseline it minted itself, and a baseline that was never committed makes the next
 * run mint it instead of comparing against it.
 *
 * A checkpoint NAME is the name its baseline lands under — a file name under
 * `tests/e2e/baselines/design/<journey>/`. It is NOT a route: "invite-pending", "accept",
 * "switched", "panel" and "remove-refused" name shots, and no assertion in this file (or in the
 * journeys it grades) navigates to or asserts a path spelled from one. What each checkpoint must
 * have graded by the time its shutter falls is a state of one of the FOUR routes this increment
 * declares — `/t/{tenant}/settings/members`, `/accept-invitation`, `/sign-in`, `/t/{tenant}` —
 * through the ids and codes the test contract fixes.
 *
 * Each claim is read against the checkpoint's OWN SEGMENT of the spec — the stretch between the shot
 * before it and the shot after it, the stretch that checkpoint is the picture of. An assertion made
 * in some other segment, about another screen in another session, proves another checkpoint's claim
 * and not this one's; and where a checkpoint's name promises a VALUE ("the workspace that was
 * switched to", "the role the journey moved"), the assertion is asked what it compared against,
 * because a sighting of the right element is true of the wrong product too.
 *
 * The route to a baseline is read out of the shipped playwright config rather than spelled here, so
 * a later change to `snapshotPathTemplate` moves this assertion with it (B-19).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  TESTIDS,
  balancedSpanAt,
  codeOf,
  enclosingMemberName,
  expectStatements,
  importSpecifiersOf,
  inRepo,
  repoRelative,
  requireModule,
  resolveSpecifierFile,
} from "./support/invitations-contract";

/** The refusal J-002's last checkpoint stands on — inc-010a's code, worn by the refused row. */
const MEMBER_HAS_ACTS = "MEMBER_HAS_ACTS";
const MEMBERS_REFUSAL = TESTIDS.membersRefusal;

/** The workspace segment of an address bar — `/t/{tenantSlug}/…`, as R-SPINE-002 spells it. */
const WORKSPACE_SEGMENT = "/t/";

/** Where a checkpoint's claim may be graded: the spec slice it owns, and the helpers it calls. */
interface Segment {
  readonly region: string;
  readonly helpers: readonly { readonly code: string }[];
}

/**
 * One assertion, as this suite reads it: the statement itself, and — when it lives in a page object
 * the journey called — the segment's own call to the member that made it. A page object names its
 * parameters for itself; what the JOURNEY handed that member is on the call, so a claim about a
 * value is read across the seam rather than being defeated by it.
 */
interface Grading {
  readonly statement: string;
  readonly through: string;
}

/** One datum a checkpoint's name promises, and — where the promise is about a VALUE — what the
 *  assertion has to carry for it to be that promise rather than a sighting of the same element. */
interface Need {
  readonly what: string;
  readonly token: string;
  readonly inSpec?: boolean;
  readonly carries?: { readonly rule: string; readonly holds: (grading: Grading, segment: Segment) => boolean };
}

/**
 * A checkpoint is a SHOT PLUS AN ASSERTION. Its name is the name a baseline lands under — never a
 * route — and what a checkpoint's name promises is a state of one of the increment's four routes,
 * so each one below names the datum the journey must have graded by the time the shutter falls.
 */
interface Checkpoint {
  readonly name: string;
  readonly asserts: readonly Need[];
}

/** One journey of this increment: how it is collected, what it shoots, and what it must grade. */
interface Journey {
  readonly id: string;
  readonly spec: string;
  readonly shots: string;
  readonly checkpoints: readonly Checkpoint[];
  readonly alongside: string | null;
  readonly sameSessionBetween: readonly [string, string] | null;
}

/* ------------------------------------------------------------------ reading what an assertion says
 *
 * A checkpoint whose name promises a VALUE ("the workspace that was switched to", "the role the
 * journey moved") is not proved by a sighting: `toBeVisible()` and `toHaveCount(1)` on the right
 * element are true of the wrong product too. The readings below ask what an assertion is comparing
 * against — and, for the role, whether that is the value this journey itself put there.
 *
 * Nothing is spelled: no role name, no workspace name, no count. Both readings are of the SPEC, so
 * whatever identities a run mints, the rule holds (B-19).
 */

/** What an assertion compares against: the arguments of everything chained after `expect(…)`. */
function matcherValues(statement: string): string {
  const open = statement.indexOf("(");
  if (open < 0) return "";
  const [, close] = balancedSpanAt(statement, open);
  const tail = statement.slice(close + 1);
  return [...tail.matchAll(/\(/g)]
    .map((match) => {
      const [from, to] = balancedSpanAt(tail, match.index ?? 0);
      return tail.slice(from + 1, to);
    })
    .join(" ⁋ ");
}

/** Every bracketed argument list in a fragment — what an ACT was handed. */
function argumentsIn(text: string): string {
  return [...text.matchAll(/\(/g)]
    .map((match) => {
      const [from, to] = balancedSpanAt(text, match.index ?? 0);
      return text.slice(from + 1, to);
    })
    .join(" ⁋ ");
}

/** The handles a journey always has: naming one of these is not naming a value it produced. */
const PLUMBING = new Set(["page", "context", "browser", "testInfo", "expect", "await", "async", "TESTIDS", "testId", "locator", "getByTestId", "first", "nth", "all", "allTextContents", "textContent", "innerText", "toString", "String", "Number", "Boolean", "RegExp", "new", "true", "false", "null", "undefined", "state", "visible", "timeout", "count"]);

/** The values a fragment names: its string literals, and the bindings it reads that are not plumbing. */
function valuesIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/(["'`])([^"'`]*)\1/g)) {
    const literal = (match[2] ?? "").trim();
    if (literal.length >= 2) found.add(literal);
  }
  for (const match of text.matchAll(/\b([A-Za-z_$][\w$]+)\b/g)) {
    const name = match[1] ?? "";
    if (!PLUMBING.has(name)) found.add(name);
  }
  return found;
}

/** Does a fragment compare against a number that could only describe more than one thing? */
function countsMoreThanOne(text: string): boolean {
  return [...text.matchAll(/\b(\d+)\b/g)].some((match) => Number(match[1] ?? "0") >= 2);
}

/** The statement an index sits in — from the boundary before it to the `;` that ends it. */
function statementAt(code: string, at: number): string {
  const from = Math.max(code.lastIndexOf(";", at), code.lastIndexOf("{", at), code.lastIndexOf("}", at)) + 1;
  const end = code.indexOf(";", at);
  return code.slice(from, end < 0 ? code.length : end);
}

/**
 * The ACTS a segment makes on a control: the statements in the spec that drive it, plus — when the
 * control is held by a page object — the spec's own calls to the member that holds it. What the
 * journey handed the control is in there, whichever side of the page-object seam it was written on.
 */
function actsOn(segment: Segment, control: string): string[] {
  const acts: string[] = [];
  for (const match of segment.region.matchAll(new RegExp(control.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))) {
    acts.push(statementAt(segment.region, match.index ?? 0));
  }
  for (const helper of segment.helpers) {
    for (const match of helper.code.matchAll(new RegExp(control.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))) {
      const member = enclosingMemberName(helper.code, match.index ?? 0);
      if (member === null) continue;
      for (const call of segment.region.matchAll(new RegExp(`\\b${member}\\s*\\(`, "g"))) acts.push(statementAt(segment.region, call.index ?? 0));
    }
  }
  return acts;
}

/** What an assertion was COMPARING AGAINST: its own expected values, and what the journey handed it. */
function comparedBy(grading: Grading): Set<string> {
  const found = valuesIn(matcherValues(grading.statement));
  for (const value of valuesIn(argumentsIn(grading.through))) found.add(value);
  return found;
}

/** "Stands inside the workspace switched to": an address assertion built from a value, not a literal. */
const NAMES_THE_WORKSPACE = {
  rule: "an address assertion whose expected value is BUILT from the workspace that was switched to (the run mints its slug, so a fixed literal cannot be it)",
  holds: (grading: Grading): boolean => /toHaveURL|\burl\b/i.test(grading.statement) && /\$\{|\+\s*[A-Za-z_$]/.test(grading.statement),
};

/** "Lists both memberships": an assertion that is about more than the switcher merely being there. */
const LISTS_BOTH_MEMBERSHIPS = {
  rule: "an assertion about MORE THAN ONE entry — a count of at least two, or the workspaces named — never a sighting of the switcher",
  holds: (grading: Grading): boolean => countsMoreThanOne(matcherValues(grading.statement)) || comparedBy(grading).size > 0,
};

/** "The role the journey moved": the slot's content compared to what the role control was handed. */
const SHOWS_THE_ROLE_SET = {
  rule: "the slot's CONTENT compared against the role this journey set through the role control — not a count of the slot",
  holds: (grading: Grading, segment: Segment): boolean => {
    const compared = comparedBy(grading);
    if (compared.size === 0) return false;
    const handed = new Set<string>();
    for (const control of [TESTIDS.memberRoleSelect, TESTIDS.memberRoleForm, TESTIDS.memberRoleSubmit]) {
      for (const act of actsOn(segment, control)) for (const value of valuesIn(argumentsIn(act))) handed.add(value);
    }
    return [...compared].some((value) => handed.has(value));
  },
};

/** The two journeys this increment adds, with the grep each is collected by and its shot directory. */
const JOURNEYS: readonly Journey[] = [
  {
    id: "J-001",
    spec: "tests/e2e/journeys/j-001-auth.spec.ts",
    shots: "j-001-auth",
    checkpoints: [
      { name: "invite-pending", asserts: [{ what: "the invitation just made stands as a pending row", token: TESTIDS.row }] },
      { name: "accept", asserts: [{ what: "the screen names the inviting workspace", token: TESTIDS.acceptWorkspace }] },
      {
        name: "switched",
        asserts: [
          { what: "the switcher lists BOTH of the memberships the invitee now holds", token: TESTIDS.switcher, carries: LISTS_BOTH_MEMBERSHIPS },
          { what: "the address bar stands inside the workspace that was switched to", token: WORKSPACE_SEGMENT, inSpec: true, carries: NAMES_THE_WORKSPACE },
        ],
      },
    ],
    /** The half of J-001 that already ships: the same grep must still collect it (AC-4). */
    alongside: "tests/e2e/journeys/j-001a-auth-core.spec.ts",
    /** AC-4's "no re-auth": between these two checkpoints the session that accepted is the one that switches. */
    sameSessionBetween: ["accept", "switched"],
  },
  {
    id: "J-002",
    spec: "tests/e2e/journeys/j-002-tenant-admin.spec.ts",
    shots: "j-002-tenant-admin",
    checkpoints: [
      {
        name: "panel",
        asserts: [
          { what: "the pending invitation the journey just made", token: TESTIDS.row },
          { what: "the roster standing beneath the panel", token: TESTIDS.memberRow },
          { what: "the role the journey moved, as the roster now shows it", token: TESTIDS.memberRowRole, carries: SHOWS_THE_ROLE_SET },
        ],
      },
      {
        name: "remove-refused",
        asserts: [
          { what: "the refusal code the refused row wears, machine-readably", token: MEMBER_HAS_ACTS, inSpec: true },
          { what: "the slot the refused row answers in", token: MEMBERS_REFUSAL },
        ],
      },
    ],
    alongside: null,
    sameSessionBetween: null,
  },
];

/** The doors a re-authentication goes through — what a "same session" segment may not walk. */
const REAUTH_DOORS = ["/sign-in", "/sign-up", "signIn", "signUp"];

/** Where a name is spelled as a string literal, or -1 — how a checkpoint call is found in the spec. */
function quotedIndex(code: string, name: string): number {
  const found = [`"${name}"`, `'${name}'`, `\`${name}\``].map((literal) => code.indexOf(literal)).filter((index) => index >= 0);
  return found.length === 0 ? -1 : Math.min(...found);
}

/** The journey's own helpers: the page objects and support files its spec imports. */
function journeyHelpers(specFile: string): { file: string; code: string }[] {
  const helpers: { file: string; code: string }[] = [];
  for (const specifier of importSpecifiersOf(specFile)) {
    const landed = resolveSpecifierFile(specFile, specifier);
    if (landed === null) continue;
    const relative = repoRelative(landed);
    if (relative.startsWith("tests/e2e/")) helpers.push({ file: relative, code: codeOf(landed) });
  }
  return helpers;
}

/**
 * The assertions by which a datum is GRADED IN THIS SEGMENT. Three shapes count, and no fourth: the
 * segment asserts on it itself; a page object holds it and the segment grades that member by name;
 * or the page object asserts on it in a method the segment calls. A page object the Builder may edit
 * is pinned both ways by the second and third — a locator nobody asserts through, and an assertion
 * nobody calls, grade nothing.
 *
 * The reading is SCOPED to the checkpoint's own segment, never to the whole file: an assertion made
 * three segments earlier, about another screen in another session, is not what this checkpoint
 * claims. What comes back is the assertions themselves, so a claim about a value can be asked what
 * it compared against.
 */
function gradedBy(segment: Segment, token: string, inSpec = false): Grading[] {
  const here = expectStatements(segment.region);
  const own = (statements: string[]): Grading[] => statements.map((statement) => ({ statement, through: "" }));
  const direct = here.filter((statement) => statement.includes(token));
  if (direct.length > 0 || inSpec) return own(direct);
  const literal = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const helper of segment.helpers) {
    for (const match of helper.code.matchAll(new RegExp(literal, "g"))) {
      const member = enclosingMemberName(helper.code, match.index ?? 0);
      if (member === null) continue;
      const throughTheLocator = here.filter((statement) => new RegExp(`\\b${member}\\b`).test(statement));
      if (throughTheLocator.length > 0) return own(throughTheLocator);
      const asserted = expectStatements(helper.code).filter((statement) => statement.includes(token));
      const calls = [...segment.region.matchAll(new RegExp(`\\b${member}\\s*\\(`, "g"))].map((call) => statementAt(segment.region, call.index ?? 0));
      if (asserted.length > 0 && calls.length > 0) return asserted.map((statement) => ({ statement, through: calls.join(" ⁋ ") }));
    }
  }
  return [];
}

/** Where a shot lands, as the shipped config states it — read, never assumed. */
function baselinePath(directory: string, checkpoint: string): string {
  const config = readFileSync(inRepo("playwright.config.ts"), "utf8");
  const template = /snapshotPathTemplate:\s*["']([^"']+)["']/.exec(config)?.[1];
  expect(template, "the shipped playwright config states where a baseline lands").toBeDefined();
  return (template ?? "").replace("{arg}", `${directory}/${checkpoint}`).replace("{ext}", ".png");
}

describe("AC-4: the journeys are collected, checkpointed and baselined", () => {
  for (const journey of JOURNEYS) {
    test(`AC-4: ${journey.id}'s spec is collected by the grep the runner uses, and takes its checkpoints`, () => {
      const text = readFileSync(requireModule(journey.spec), "utf8");

      // `scripts/e2e.mjs` greps the describe title, so the title is what decides collection.
      const titles = [...text.matchAll(/describe\s*(?:\.\w+)?\s*\(\s*(["'`])([\s\S]*?)\1/g)].map((match) => match[2] ?? "");
      expect(titles.length, `${journey.spec} declares a describe block`).toBeGreaterThan(0);
      expect(
        titles.some((title) => title.includes(journey.id)),
        `${journey.spec}'s describe title carries "${journey.id}" — the runner greps the title, and a spec it does not collect is a segment that is green by omission (AC-4)`,
      ).toBe(true);

      if (journey.alongside !== null) {
        const together = [...readFileSync(inRepo(journey.alongside), "utf8").matchAll(/describe\s*(?:\.\w+)?\s*\(\s*(["'`])([\s\S]*?)\1/g)].map((match) => match[2] ?? "");
        expect(
          together.some((title) => title.includes(journey.id)),
          `${journey.alongside} is still collected by the same grep — ${journey.id}'s auth-and-sessions half runs in the same invocation (AC-4)`,
        ).toBe(true);
      }

      for (const checkpoint of journey.checkpoints) {
        expect(
          quotedIndex(text, checkpoint.name),
          `${journey.spec} takes the checkpoint "${checkpoint.name}" the increment names — a checkpoint nobody takes runs no axe pass and compares no shot (V-E2E, Q-11)`,
        ).toBeGreaterThanOrEqual(0);
      }
    });

    test(`AC-4: ${journey.id} asserts at every checkpoint the state that checkpoint's name promises`, () => {
      // A journey that only navigates and shoots is green against a baseline it minted itself: axe
      // judges accessibility and `toHaveScreenshot` judges the shot against the shot. What makes a
      // checkpoint a proof is the assertion standing behind it — so each one is asked for the datum
      // its own name promises, graded through the ids and codes the test contract fixes (C-05).
      const specFile = requireModule(journey.spec);
      const specCode = codeOf(specFile);
      const helpers = journeyHelpers(specFile);

      const shots = journey.checkpoints.map((checkpoint) => ({ name: checkpoint.name, at: quotedIndex(specCode, checkpoint.name) }));
      for (const shot of shots) expect(shot.at, `${journey.spec} takes the checkpoint "${shot.name}"`).toBeGreaterThanOrEqual(0);

      // Nothing is shot on trust: between one checkpoint and the next, the spec asserts something.
      const ordered = [...shots].sort((first, second) => first.at - second.at);
      ordered.forEach((shot, index) => {
        const from = index === 0 ? 0 : (ordered[index - 1]?.at ?? 0);
        expect(
          /\bexpect\s*[.(]/.test(specCode.slice(from, shot.at)),
          `${journey.spec} reaches "${shot.name}" without asserting anything since the checkpoint before it — a segment that navigates and screenshots agrees with the baseline it minted itself, whatever the product did (AC-4, B-20)`,
        ).toBe(true);
      });

      // Each checkpoint is asked about ITS OWN SEGMENT: the spec between the shot before it and the
      // shot after it — the stretch of journey that checkpoint is the picture of. An assertion made
      // in another segment, about another screen, proves another claim (C-05).
      for (const checkpoint of journey.checkpoints) {
        const place = ordered.findIndex((shot) => shot.name === checkpoint.name);
        const from = place <= 0 ? 0 : (ordered[place - 1]?.at ?? 0);
        const to = ordered[place + 1]?.at ?? specCode.length;
        const segment: Segment = { region: specCode.slice(from, to), helpers };

        for (const need of checkpoint.asserts) {
          const owns = `in ${journey.spec}'s "${checkpoint.name}" segment${need.inSpec === true ? "" : " (or the page objects it calls there)"}`;
          const grading = gradedBy(segment, need.token, need.inSpec ?? false);
          expect(
            grading.length,
            `"${checkpoint.name}" promises ${need.what}, and nothing ${owns} grades ${need.token} — the checkpoint's own name is the claim, and an expect(…) on that datum, made in the stretch of journey the checkpoint pictures, is what makes it one (AC-4, C-05)`,
          ).toBeGreaterThan(0);

          const carries = need.carries;
          if (carries === undefined) continue;
          expect(
            grading.some((one) => carries.holds(one, segment)),
            `"${checkpoint.name}" promises ${need.what}, and ${need.token} IS asserted ${owns} — but no such assertion is ${carries.rule}. An element can be present, and counted, in a product that did the wrong thing; the checkpoint's promise is about what it SAYS (AC-4, B-19)`,
          ).toBe(true);
        }
      }

      if (journey.sameSessionBetween !== null) {
        const [first, second] = journey.sameSessionBetween;
        const region = specCode.slice(quotedIndex(specCode, first), quotedIndex(specCode, second));
        // Assertions may NAME the sign-in door — proving the journey did not land on it is exactly
        // the point. What may not stand between the two checkpoints is an ACT that walks it.
        const acts = expectStatements(region).reduce((text, statement) => text.split(statement).join(" "), region);
        expect(
          REAUTH_DOORS.filter((door) => acts.includes(door)),
          `between "${first}" and "${second}" the spec goes through an authentication door again — the multi-tenancy proof is that the session which ACCEPTED is the session that switches, landing inside the inviting workspace with no re-auth (AC-4, R-SPINE-002)`,
        ).toEqual([]);
      }
    });

    test(`AC-4: ${journey.id}'s baselines are committed where the shipped template puts them`, () => {
      for (const { name: checkpoint } of journey.checkpoints) {
        const path = baselinePath(journey.shots, checkpoint);
        const absolute = inRepo(path);
        expect(existsSync(absolute), `${path} is committed — this node mints both journeys' baselines (B-20), and an absent one is minted by the next run instead of compared against`).toBe(true);
        expect(statSync(absolute).size, `${path} is a real screenshot, not an empty placeholder`).toBeGreaterThan(1000);
      }
    });
  }
});
