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
 * A checkpoint NAME is the name its baseline lands under — it is not a route, and nothing here reads
 * one as one. What each checkpoint must have graded by the time its shutter falls is a state of one
 * of the four routes this increment declares, through the ids and codes the test contract fixes.
 *
 * The route to a baseline is read out of the shipped playwright config rather than spelled here, so
 * a later change to `snapshotPathTemplate` moves this assertion with it (B-19).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  TESTIDS,
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
const MEMBERS_REFUSAL = "members-refusal";

/**
 * A checkpoint is a SHOT PLUS AN ASSERTION. Its name is the name a baseline lands under — never a
 * route — and what a checkpoint's name promises is a state of one of the increment's four routes,
 * so each one below names the datum the journey must have graded by the time the shutter falls.
 */
interface Checkpoint {
  readonly name: string;
  readonly asserts: readonly { readonly what: string; readonly token: string; readonly inSpec?: boolean }[];
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
          { what: "the switcher lists the memberships the invitee now holds", token: TESTIDS.switcher },
          { what: "the address bar stands inside the workspace that was switched to", token: "toHaveURL", inSpec: true },
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
          { what: "the role the journey moved, as the roster now shows it", token: TESTIDS.memberRowRole },
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
 * Is a datum GRADED by this journey? Three shapes count, and no fourth: the spec asserts on it
 * itself; a page object holds it and the spec grades that member by name; or the page object asserts
 * on it in a method the spec calls. A page object the Builder may edit is pinned both ways by the
 * second and third — a locator nobody asserts through, and an assertion nobody calls, grade nothing.
 */
function graded(specCode: string, helpers: { code: string }[], token: string, inSpec = false): boolean {
  const inSpecStatements = expectStatements(specCode);
  if (inSpecStatements.some((statement) => statement.includes(token))) return true;
  if (inSpec) return false;
  for (const helper of helpers) {
    for (const match of helper.code.matchAll(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))) {
      const member = enclosingMemberName(helper.code, match.index ?? 0);
      if (member === null) continue;
      const named = new RegExp(`\\b${member}\\b`);
      if (inSpecStatements.some((statement) => named.test(statement))) return true;
      const asserted = expectStatements(helper.code).some((statement) => statement.includes(token));
      if (asserted && new RegExp(`\\b${member}\\s*\\(`).test(specCode)) return true;
    }
  }
  return false;
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

      for (const checkpoint of journey.checkpoints) {
        for (const need of checkpoint.asserts) {
          expect(
            graded(specCode, helpers, need.token, need.inSpec ?? false),
            `"${checkpoint.name}" promises ${need.what}, and nothing in ${journey.spec}${need.inSpec === true ? "" : " or the page objects it imports"} grades ${need.token} — the checkpoint's own name is the claim, and an expect(…) on that datum is what makes it one (AC-4, C-05)`,
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
